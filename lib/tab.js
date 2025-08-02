import { EventEmitter } from 'events';
import { callOnPageNoTrace, waitForCompletion } from './tools/utils.js';
import { logUnhandledError } from './log.js';
import { ManualPromise } from './manualPromise.js';
import { outputFile } from './config.js';
export const TabEvents = {
    modalState: 'modalState'
};
export class Tab extends EventEmitter {
    context;
    page;
    _consoleMessages = [];
    _recentConsoleMessages = [];
    _requests = new Map();
    _onPageClose;
    _modalStates = [];
    _downloads = [];
    constructor(context, page, onPageClose) {
        super();
        this.context = context;
        this.page = page;
        this._onPageClose = onPageClose;
        page.on('console', event => this._handleConsoleMessage(messageToConsoleMessage(event)));
        page.on('pageerror', error => this._handleConsoleMessage(pageErrorToConsoleMessage(error)));
        page.on('request', request => this._requests.set(request, null));
        page.on('response', response => this._requests.set(response.request(), response));
        page.on('close', () => this._onClose());
        page.on('filechooser', chooser => {
            this.setModalState({
                type: 'fileChooser',
                description: 'File chooser',
                fileChooser: chooser,
            });
        });
        page.on('dialog', dialog => this._dialogShown(dialog));
        page.on('download', download => {
            void this._downloadStarted(download);
        });
        page.setDefaultNavigationTimeout(60000);
        page.setDefaultTimeout(5000);
        page[tabSymbol] = this;
    }
    static forPage(page) {
        return page[tabSymbol];
    }
    modalStates() {
        return this._modalStates;
    }
    setModalState(modalState) {
        this._modalStates.push(modalState);
        this.emit(TabEvents.modalState, modalState);
    }
    clearModalState(modalState) {
        this._modalStates = this._modalStates.filter(state => state !== modalState);
    }
    modalStatesMarkdown() {
        const result = ['### Modal state'];
        if (this._modalStates.length === 0)
            result.push('- There is no modal state present');
        for (const state of this._modalStates) {
            const tool = this.context.tools.filter(tool => 'clearsModalState' in tool).find(tool => tool.clearsModalState === state.type);
            result.push(`- [${state.description}]: can be handled by the "${tool?.schema.name}" tool`);
        }
        return result;
    }
    _dialogShown(dialog) {
        this.setModalState({
            type: 'dialog',
            description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
            dialog,
        });
    }
    async _downloadStarted(download) {
        const entry = {
            download,
            finished: false,
            outputFile: await outputFile(this.context.config, download.suggestedFilename())
        };
        this._downloads.push(entry);
        await download.saveAs(entry.outputFile);
        entry.finished = true;
    }
    _clearCollectedArtifacts() {
        this._consoleMessages.length = 0;
        this._recentConsoleMessages.length = 0;
        this._requests.clear();
    }
    _handleConsoleMessage(message) {
        this._consoleMessages.push(message);
        this._recentConsoleMessages.push(message);
    }
    _onClose() {
        this._clearCollectedArtifacts();
        this._onPageClose(this);
    }
    async title() {
        return await callOnPageNoTrace(this.page, page => page.title());
    }
    async waitForLoadState(state, options) {
        await callOnPageNoTrace(this.page, page => page.waitForLoadState(state, options).catch(logUnhandledError));
    }
    async navigate(url) {
        this._clearCollectedArtifacts();
        const downloadEvent = callOnPageNoTrace(this.page, page => page.waitForEvent('download').catch(logUnhandledError));
        try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        }
        catch (_e) {
            const e = _e;
            const mightBeDownload = e.message.includes('net::ERR_ABORTED') // chromium
                || e.message.includes('Download is starting'); // firefox + webkit
            if (!mightBeDownload)
                throw e;
            // on chromium, the download event is fired *after* page.goto rejects, so we wait a lil bit
            const download = await Promise.race([
                downloadEvent,
                new Promise(resolve => setTimeout(resolve, 3000)),
            ]);
            if (!download)
                throw e;
            // Make sure other "download" listeners are notified first.
            await new Promise(resolve => setTimeout(resolve, 500));
            return;
        }
        // Cap load event to 5 seconds, the page is operational at this point.
        await this.waitForLoadState('load', { timeout: 5000 });
    }
    consoleMessages() {
        return this._consoleMessages;
    }
    requests() {
        return this._requests;
    }
    _takeRecentConsoleMarkdown() {
        if (!this._recentConsoleMessages.length)
            return [];
        const result = this._recentConsoleMessages.map(message => {
            return `- ${trim(message.toString(), 100)}`;
        });
        return [`### New console messages`, ...result, ''];
    }
    _listDownloadsMarkdown() {
        if (!this._downloads.length)
            return [];
        const result = ['### Downloads'];
        for (const entry of this._downloads) {
            if (entry.finished)
                result.push(`- Downloaded file ${entry.download.suggestedFilename()} to ${entry.outputFile}`);
            else
                result.push(`- Downloading file ${entry.download.suggestedFilename()} ...`);
        }
        result.push('');
        return result;
    }
    async captureSnapshot() {
        const result = [];
        if (this.modalStates().length) {
            result.push(...this.modalStatesMarkdown());
            return result.join('\n');
        }
        result.push(...this._takeRecentConsoleMarkdown());
        result.push(...this._listDownloadsMarkdown());
        await this._raceAgainstModalStates(async () => {
            const snapshot = await this.page._snapshotForAI();
            result.push(`### Page state`, `- Page URL: ${this.page.url()}`, `- Page Title: ${await this.page.title()}`, `- Page Snapshot:`, '```yaml', snapshot, '```');
        });
        return result.join('\n');
    }
    _javaScriptBlocked() {
        return this._modalStates.some(state => state.type === 'dialog');
    }
    async _raceAgainstModalStates(action) {
        if (this.modalStates().length)
            return this.modalStates()[0];
        const promise = new ManualPromise();
        const listener = (modalState) => promise.resolve(modalState);
        this.once(TabEvents.modalState, listener);
        return await Promise.race([
            action().then(() => {
                this.off(TabEvents.modalState, listener);
                return undefined;
            }),
            promise,
        ]);
    }
    async waitForCompletion(callback) {
        await this._raceAgainstModalStates(() => waitForCompletion(this, callback));
    }
    async refLocator(params) {
        return (await this.refLocators([params]))[0];
    }
    async refLocators(params) {
        const snapshot = await this.page._snapshotForAI();
        return params.map(param => {
            if (!snapshot.includes(`[ref=${param.ref}]`))
                throw new Error(`Ref ${param.ref} not found in the current page snapshot. Try capturing new snapshot.`);
            return this.page.locator(`aria-ref=${param.ref}`).describe(param.element);
        });
    }
    async waitForTimeout(time) {
        if (this._javaScriptBlocked()) {
            await new Promise(f => setTimeout(f, time));
            return;
        }
        await callOnPageNoTrace(this.page, page => {
            return page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
        });
    }
}
function messageToConsoleMessage(message) {
    return {
        type: message.type(),
        text: message.text(),
        toString: () => `[${message.type().toUpperCase()}] ${message.text()} @ ${message.location().url}:${message.location().lineNumber}`,
    };
}
function pageErrorToConsoleMessage(errorOrValue) {
    if (errorOrValue instanceof Error) {
        return {
            type: undefined,
            text: errorOrValue.message,
            toString: () => errorOrValue.stack || errorOrValue.message,
        };
    }
    return {
        type: undefined,
        text: String(errorOrValue),
        toString: () => String(errorOrValue),
    };
}
function trim(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength) + '...';
}
const tabSymbol = Symbol('tabSymbol');
