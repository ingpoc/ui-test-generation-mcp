export class Response {
    _result = [];
    _code = [];
    _images = [];
    _context;
    _includeSnapshot = false;
    _includeTabs = false;
    _snapshot;
    toolName;
    toolArgs;
    _isError;
    constructor(context, toolName, toolArgs) {
        this._context = context;
        this.toolName = toolName;
        this.toolArgs = toolArgs;
    }
    addResult(result) {
        this._result.push(result);
    }
    addError(error) {
        this._result.push(error);
        this._isError = true;
    }
    isError() {
        return this._isError;
    }
    result() {
        return this._result.join('\n');
    }
    addCode(code) {
        this._code.push(code);
    }
    code() {
        return this._code.join('\n');
    }
    addImage(image) {
        this._images.push(image);
    }
    images() {
        return this._images;
    }
    setIncludeSnapshot() {
        this._includeSnapshot = true;
    }
    setIncludeTabs() {
        this._includeTabs = true;
    }
    async snapshot() {
        if (this._snapshot !== undefined)
            return this._snapshot;
        if (this._includeSnapshot && this._context.currentTab())
            this._snapshot = await this._context.currentTabOrDie().captureSnapshot();
        else
            this._snapshot = '';
        return this._snapshot;
    }
    async serialize() {
        const response = [];
        // Start with command result.
        if (this._result.length) {
            response.push('### Result');
            response.push(this._result.join('\n'));
            response.push('');
        }
        // Add code if it exists.
        if (this._code.length) {
            response.push(`### Ran Playwright code
\`\`\`js
${this._code.join('\n')}
\`\`\``);
            response.push('');
        }
        // List browser tabs.
        if (this._includeSnapshot || this._includeTabs)
            response.push(...(await this._context.listTabsMarkdown(this._includeTabs)));
        // Add snapshot if provided.
        const snapshot = await this.snapshot();
        if (snapshot)
            response.push(snapshot, '');
        // Main response part
        const content = [
            { type: 'text', text: response.join('\n') },
        ];
        // Image attachments.
        if (this._context.config.imageResponses !== 'omit') {
            for (const image of this._images)
                content.push({ type: 'image', data: image.data.toString('base64'), mimeType: image.contentType });
        }
        return { content, isError: this._isError };
    }
}
