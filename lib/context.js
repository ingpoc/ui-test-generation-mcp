import debug from 'debug';
import { logUnhandledError } from './log.js';
import { Tab } from './tab.js';
const testDebug = debug('pw:mcp:test');
export class Context {
    tools;
    config;
    _browserContextPromise;
    _browserContextFactory;
    _tabs = [];
    _currentTab;
    clientVersion;
    static _allContexts = new Set();
    _closeBrowserContextPromise;
    _inputRecorder;
    _sessionLog;
    constructor(tools, config, browserContextFactory, sessionLog) {
        this.tools = tools;
        this.config = config;
        this._browserContextFactory = browserContextFactory;
        this._sessionLog = sessionLog;
        testDebug('create context');
        Context._allContexts.add(this);
    }
    static async disposeAll() {
        await Promise.all([...Context._allContexts].map(context => context.dispose()));
    }
    tabs() {
        return this._tabs;
    }
    currentTab() {
        return this._currentTab;
    }
    currentTabOrDie() {
        if (!this._currentTab)
            throw new Error('No open pages available. Use the "browser_navigate" tool to navigate to a page first.');
        return this._currentTab;
    }
    async newTab() {
        const { browserContext } = await this._ensureBrowserContext();
        const page = await browserContext.newPage();
        this._currentTab = this._tabs.find(t => t.page === page);
        return this._currentTab;
    }
    async selectTab(index) {
        const tab = this._tabs[index];
        if (!tab)
            throw new Error(`Tab ${index} not found`);
        await tab.page.bringToFront();
        this._currentTab = tab;
        return tab;
    }
    async ensureTab() {
        const { browserContext } = await this._ensureBrowserContext();
        if (!this._currentTab)
            await browserContext.newPage();
        return this._currentTab;
    }
    async listTabsMarkdown(force = false) {
        if (this._tabs.length === 1 && !force)
            return [];
        if (!this._tabs.length) {
            return [
                '### Open tabs',
                'No open tabs. Use the "browser_navigate" tool to navigate to a page first.',
                '',
            ];
        }
        const lines = ['### Open tabs'];
        for (let i = 0; i < this._tabs.length; i++) {
            const tab = this._tabs[i];
            const title = await tab.title();
            const url = tab.page.url();
            const current = tab === this._currentTab ? ' (current)' : '';
            lines.push(`- ${i}:${current} [${title}] (${url})`);
        }
        lines.push('');
        return lines;
    }
    async closeTab(index) {
        const tab = index === undefined ? this._currentTab : this._tabs[index];
        if (!tab)
            throw new Error(`Tab ${index} not found`);
        const url = tab.page.url();
        await tab.page.close();
        return url;
    }
    _onPageCreated(page) {
        const tab = new Tab(this, page, tab => this._onPageClosed(tab));
        this._tabs.push(tab);
        if (!this._currentTab)
            this._currentTab = tab;
    }
    _onPageClosed(tab) {
        const index = this._tabs.indexOf(tab);
        if (index === -1)
            return;
        this._tabs.splice(index, 1);
        if (this._currentTab === tab)
            this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
        if (!this._tabs.length)
            void this.closeBrowserContext();
    }
    async closeBrowserContext() {
        if (!this._closeBrowserContextPromise)
            this._closeBrowserContextPromise = this._closeBrowserContextImpl().catch(logUnhandledError);
        await this._closeBrowserContextPromise;
        this._closeBrowserContextPromise = undefined;
    }
    async setInputRecorderEnabled(enabled) {
        await this._inputRecorder?.setEnabled(enabled);
    }
    async _closeBrowserContextImpl() {
        if (!this._browserContextPromise)
            return;
        testDebug('close context');
        const promise = this._browserContextPromise;
        this._browserContextPromise = undefined;
        await promise.then(async ({ browserContext, close }) => {
            if (this.config.saveTrace)
                await browserContext.tracing.stop();
            await close();
        });
    }
    async dispose() {
        await this.closeBrowserContext();
        Context._allContexts.delete(this);
    }
    async _setupRequestInterception(context) {
        if (this.config.network?.allowedOrigins?.length) {
            await context.route('**', route => route.abort('blockedbyclient'));
            for (const origin of this.config.network.allowedOrigins)
                await context.route(`*://${origin}/**`, route => route.continue());
        }
        if (this.config.network?.blockedOrigins?.length) {
            for (const origin of this.config.network.blockedOrigins)
                await context.route(`*://${origin}/**`, route => route.abort('blockedbyclient'));
        }
    }
    _ensureBrowserContext() {
        if (!this._browserContextPromise) {
            this._browserContextPromise = this._setupBrowserContext();
            this._browserContextPromise.catch(() => {
                this._browserContextPromise = undefined;
            });
        }
        return this._browserContextPromise;
    }
    async _setupBrowserContext() {
        if (this._closeBrowserContextPromise)
            throw new Error('Another browser context is being closed.');
        // TODO: move to the browser context factory to make it based on isolation mode.
        const result = await this._browserContextFactory.createContext(this.clientVersion);
        const { browserContext } = result;
        await this._setupRequestInterception(browserContext);
        if (this._sessionLog)
            this._inputRecorder = await InputRecorder.create(this._sessionLog, browserContext);
        for (const page of browserContext.pages())
            this._onPageCreated(page);
        browserContext.on('page', page => this._onPageCreated(page));
        if (this.config.saveTrace) {
            await browserContext.tracing.start({
                name: 'trace',
                screenshots: false,
                snapshots: true,
                sources: false,
            });
        }
        return result;
    }
}
export class InputRecorder {
    _actions = [];
    _enabled = false;
    _sessionLog;
    _browserContext;
    _flushTimer;
    constructor(sessionLog, browserContext) {
        this._sessionLog = sessionLog;
        this._browserContext = browserContext;
    }
    static async create(sessionLog, browserContext) {
        const recorder = new InputRecorder(sessionLog, browserContext);
        await recorder._initialize();
        await recorder.setEnabled(true);
        return recorder;
    }
    async _initialize() {
        await this._browserContext._enableRecorder({
            mode: 'recording',
            recorderMode: 'api',
        }, {
            actionAdded: (page, data, code) => {
                if (!this._enabled)
                    return;
                const tab = Tab.forPage(page);
                this._actions.push({ ...data, tab, code: code.trim(), timestamp: performance.now() });
                this._scheduleFlush();
            },
            actionUpdated: (page, data, code) => {
                if (!this._enabled)
                    return;
                const tab = Tab.forPage(page);
                this._actions[this._actions.length - 1] = { ...data, tab, code: code.trim(), timestamp: performance.now() };
                this._scheduleFlush();
            },
            signalAdded: (page, data) => {
                if (data.signal.name !== 'navigation')
                    return;
                const tab = Tab.forPage(page);
                this._actions.push({
                    frame: data.frame,
                    action: {
                        name: 'navigate',
                        url: data.signal.url,
                        signals: [],
                    },
                    startTime: data.timestamp,
                    endTime: data.timestamp,
                    tab,
                    code: `await page.goto('${data.signal.url}');`,
                    timestamp: performance.now(),
                });
                this._scheduleFlush();
            },
        });
    }
    async setEnabled(enabled) {
        this._enabled = enabled;
        if (!enabled)
            await this._flush();
    }
    _clearTimer() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = undefined;
        }
    }
    _scheduleFlush() {
        this._clearTimer();
        this._flushTimer = setTimeout(() => this._flush(), 1000);
    }
    async _flush() {
        this._clearTimer();
        const actions = this._actions;
        this._actions = [];
        await this._sessionLog.logActions(actions);
    }
}
