import common from './tools/common.js';
import console from './tools/console.js';
import dialogs from './tools/dialogs.js';
import evaluate from './tools/evaluate.js';
import files from './tools/files.js';
import keyboard from './tools/keyboard.js';
import navigate from './tools/navigate.js';
import network from './tools/network.js';
import screenshot from './tools/screenshot.js';
import snapshot from './tools/snapshot.js';
import wait from './tools/wait.js';
import testGeneration from './tools/test-generation.js';
export const allTools = [
    ...common,
    ...console,
    ...dialogs,
    ...evaluate,
    ...files,
    ...keyboard,
    ...navigate,
    ...network,
    ...screenshot,
    ...snapshot,
    ...testGeneration,
    ...wait,
];
export function filteredTools(config) {
    return allTools.filter(tool => tool.capability.startsWith('core') || config.capabilities?.includes(tool.capability));
}
