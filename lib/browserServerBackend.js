import { Context } from './context.js';
import { logUnhandledError } from './log.js';
import { Response } from './response.js';
import { SessionLog } from './sessionLog.js';
import { filteredTools } from './tools.js';
import { packageJSON } from './package.js';
export class BrowserServerBackend {
    name = 'Playwright';
    version = packageJSON.version;
    onclose;
    _tools;
    _context;
    _sessionLog;
    _config;
    _browserContextFactory;
    constructor(config, browserContextFactory) {
        this._config = config;
        this._browserContextFactory = browserContextFactory;
        this._tools = filteredTools(config);
    }
    async initialize() {
        this._sessionLog = this._config.saveSession ? await SessionLog.create(this._config) : undefined;
        this._context = new Context(this._tools, this._config, this._browserContextFactory, this._sessionLog);
    }
    tools() {
        return this._tools.map(tool => tool.schema);
    }
    async callTool(schema, parsedArguments) {
        const context = this._context;
        const response = new Response(context, schema.name, parsedArguments);
        const tool = this._tools.find(tool => tool.schema.name === schema.name);
        await context.setInputRecorderEnabled(false);
        try {
            await tool.handle(context, parsedArguments, response);
        }
        catch (error) {
            response.addError(String(error));
        }
        finally {
            await context.setInputRecorderEnabled(true);
        }
        await this._sessionLog?.logResponse(response);
        return await response.serialize();
    }
    serverInitialized(version) {
        this._context.clientVersion = version;
    }
    serverClosed() {
        this.onclose?.();
        void this._context.dispose().catch(logUnhandledError);
    }
}
