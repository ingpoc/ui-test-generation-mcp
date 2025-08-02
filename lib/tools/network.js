import { z } from 'zod';
import { defineTabTool } from './tool.js';
const requests = defineTabTool({
    capability: 'core',
    schema: {
        name: 'browser_network_requests',
        title: 'List network requests',
        description: 'Returns all network requests since loading the page',
        inputSchema: z.object({}),
        type: 'readOnly',
    },
    handle: async (tab, params, response) => {
        const requests = tab.requests();
        [...requests.entries()].forEach(([req, res]) => response.addResult(renderRequest(req, res)));
    },
});
function renderRequest(request, response) {
    const result = [];
    result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
    if (response)
        result.push(`=> [${response.status()}] ${response.statusText()}`);
    return result.join(' ');
}
export default [
    requests,
];
