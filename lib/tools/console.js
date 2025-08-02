import { z } from 'zod';
import { defineTabTool } from './tool.js';
const console = defineTabTool({
    capability: 'core',
    schema: {
        name: 'browser_console_messages',
        title: 'Get console messages',
        description: 'Returns all console messages',
        inputSchema: z.object({}),
        type: 'readOnly',
    },
    handle: async (tab, params, response) => {
        tab.consoleMessages().map(message => response.addResult(message.toString()));
    },
});
export default [
    console,
];
