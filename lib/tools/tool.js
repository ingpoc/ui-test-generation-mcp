export function defineTool(tool) {
    return tool;
}
export function defineTabTool(tool) {
    return {
        ...tool,
        handle: async (context, params, response) => {
            const tab = context.currentTabOrDie();
            const modalStates = tab.modalStates().map(state => state.type);
            if (tool.clearsModalState && !modalStates.includes(tool.clearsModalState))
                response.addError(`Error: The tool "${tool.schema.name}" can only be used when there is related modal state present.\n` + tab.modalStatesMarkdown().join('\n'));
            else if (!tool.clearsModalState && modalStates.length)
                response.addError(`Error: Tool "${tool.schema.name}" does not handle the modal state.\n` + tab.modalStatesMarkdown().join('\n'));
            else
                return tool.handle(tab, params, response);
        },
    };
}
