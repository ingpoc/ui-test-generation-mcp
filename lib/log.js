import debug from 'debug';
const errorsDebug = debug('pw:mcp:errors');
export function logUnhandledError(error) {
    errorsDebug(error);
}
export const testDebug = debug('pw:mcp:test');
