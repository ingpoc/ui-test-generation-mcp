import { z } from 'zod';
import { defineTabTool } from './tool.js';
const handleDialog = defineTabTool({
    capability: 'core',
    schema: {
        name: 'browser_handle_dialog',
        title: 'Handle a dialog',
        description: 'Handle a dialog',
        inputSchema: z.object({
            accept: z.boolean().describe('Whether to accept the dialog.'),
            promptText: z.string().optional().describe('The text of the prompt in case of a prompt dialog.'),
        }),
        type: 'destructive',
    },
    handle: async (tab, params, response) => {
        response.setIncludeSnapshot();
        const dialogState = tab.modalStates().find(state => state.type === 'dialog');
        if (!dialogState)
            throw new Error('No dialog visible');
        tab.clearModalState(dialogState);
        await tab.waitForCompletion(async () => {
            if (params.accept)
                await dialogState.dialog.accept(params.promptText);
            else
                await dialogState.dialog.dismiss();
        });
    },
    clearsModalState: 'dialog',
});
export default [
    handleDialog,
];
