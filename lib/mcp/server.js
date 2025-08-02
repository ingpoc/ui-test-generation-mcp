import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
export async function connect(serverBackendFactory, transport, runHeartbeat) {
    const backend = serverBackendFactory();
    await backend.initialize?.();
    const server = createServer(backend, runHeartbeat);
    await server.connect(transport);
}
export function createServer(backend, runHeartbeat) {
    const server = new Server({ name: backend.name, version: backend.version }, {
        capabilities: {
            tools: {},
        }
    });
    const tools = backend.tools();
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: zodToJsonSchema(tool.inputSchema),
                annotations: {
                    title: tool.title,
                    readOnlyHint: tool.type === 'readOnly',
                    destructiveHint: tool.type === 'destructive',
                    openWorldHint: true,
                },
            })) };
    });
    let heartbeatRunning = false;
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        if (runHeartbeat && !heartbeatRunning) {
            heartbeatRunning = true;
            startHeartbeat(server);
        }
        const errorResult = (...messages) => ({
            content: [{ type: 'text', text: '### Result\n' + messages.join('\n') }],
            isError: true,
        });
        const tool = tools.find(tool => tool.name === request.params.name);
        if (!tool)
            return errorResult(`Error: Tool "${request.params.name}" not found`);
        try {
            return await backend.callTool(tool, tool.inputSchema.parse(request.params.arguments || {}));
        }
        catch (error) {
            return errorResult(String(error));
        }
    });
    addServerListener(server, 'initialized', () => backend.serverInitialized?.(server.getClientVersion()));
    addServerListener(server, 'close', () => backend.serverClosed?.());
    return server;
}
const startHeartbeat = (server) => {
    const beat = () => {
        Promise.race([
            server.ping(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 5000)),
        ]).then(() => {
            setTimeout(beat, 3000);
        }).catch(() => {
            void server.close();
        });
    };
    beat();
};
function addServerListener(server, event, listener) {
    const oldListener = server[`on${event}`];
    server[`on${event}`] = () => {
        oldListener?.();
        listener();
    };
}
