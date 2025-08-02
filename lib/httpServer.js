import assert from 'assert';
import http from 'http';
export async function startHttpServer(config) {
    const { host, port } = config;
    const httpServer = http.createServer();
    await new Promise((resolve, reject) => {
        httpServer.on('error', reject);
        httpServer.listen(port, host, () => {
            resolve();
            httpServer.removeListener('error', reject);
        });
    });
    return httpServer;
}
export function httpAddressToString(address) {
    assert(address, 'Could not bind server socket');
    if (typeof address === 'string')
        return address;
    const resolvedPort = address.port;
    let resolvedHost = address.family === 'IPv4' ? address.address : `[${address.address}]`;
    if (resolvedHost === '0.0.0.0' || resolvedHost === '[::]')
        resolvedHost = 'localhost';
    return `http://${resolvedHost}:${resolvedPort}`;
}
