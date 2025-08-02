import { z } from 'zod';
import { defineTool, defineTabTool } from './tool.js';
const navigate = defineTool({
    capability: 'core',
    schema: {
        name: 'browser_navigate',
        title: 'Navigate to a URL',
        description: 'Navigate to a URL',
        inputSchema: z.object({
            url: z.string().describe('The URL to navigate to'),
        }),
        type: 'destructive',
    },
    handle: async (context, params, response) => {
        const tab = await context.ensureTab();
        await tab.navigate(params.url);
        response.setIncludeSnapshot();
        response.addCode(`await page.goto('${params.url}');`);
    },
});
const goBack = defineTabTool({
    capability: 'core',
    schema: {
        name: 'browser_navigate_back',
        title: 'Go back',
        description: 'Go back to the previous page',
        inputSchema: z.object({}),
        type: 'readOnly',
    },
    handle: async (tab, params, response) => {
        await tab.page.goBack();
        response.setIncludeSnapshot();
        response.addCode(`await page.goBack();`);
    },
});
const goForward = defineTabTool({
    capability: 'core',
    schema: {
        name: 'browser_navigate_forward',
        title: 'Go forward',
        description: 'Go forward to the next page',
        inputSchema: z.object({}),
        type: 'readOnly',
    },
    handle: async (tab, params, response) => {
        await tab.page.goForward();
        response.setIncludeSnapshot();
        response.addCode(`await page.goForward();`);
    },
});
export default [
    navigate,
    goBack,
    goForward,
];
