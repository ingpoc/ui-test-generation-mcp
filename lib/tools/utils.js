// @ts-ignore
import { asLocator } from 'playwright-core/lib/utils';
export async function waitForCompletion(tab, callback) {
    const requests = new Set();
    let frameNavigated = false;
    let waitCallback = () => { };
    const waitBarrier = new Promise(f => { waitCallback = f; });
    const requestListener = (request) => requests.add(request);
    const requestFinishedListener = (request) => {
        requests.delete(request);
        if (!requests.size)
            waitCallback();
    };
    const frameNavigateListener = (frame) => {
        if (frame.parentFrame())
            return;
        frameNavigated = true;
        dispose();
        clearTimeout(timeout);
        void tab.waitForLoadState('load').then(waitCallback);
    };
    const onTimeout = () => {
        dispose();
        waitCallback();
    };
    tab.page.on('request', requestListener);
    tab.page.on('requestfinished', requestFinishedListener);
    tab.page.on('framenavigated', frameNavigateListener);
    const timeout = setTimeout(onTimeout, 10000);
    const dispose = () => {
        tab.page.off('request', requestListener);
        tab.page.off('requestfinished', requestFinishedListener);
        tab.page.off('framenavigated', frameNavigateListener);
        clearTimeout(timeout);
    };
    try {
        const result = await callback();
        if (!requests.size && !frameNavigated)
            waitCallback();
        await waitBarrier;
        await tab.waitForTimeout(1000);
        return result;
    }
    finally {
        dispose();
    }
}
export function sanitizeForFilePath(s) {
    const sanitize = (s) => s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
    const separator = s.lastIndexOf('.');
    if (separator === -1)
        return sanitize(s);
    return sanitize(s.substring(0, separator)) + '.' + sanitize(s.substring(separator + 1));
}
export async function generateLocator(locator) {
    try {
        const { resolvedSelector } = await locator._resolveSelector();
        return asLocator('javascript', resolvedSelector);
    }
    catch (e) {
        throw new Error('Ref not found, likely because element was removed. Use browser_snapshot to see what elements are currently on the page.');
    }
}
export async function callOnPageNoTrace(page, callback) {
    return await page._wrapApiCall(() => callback(page), { internal: true });
}
