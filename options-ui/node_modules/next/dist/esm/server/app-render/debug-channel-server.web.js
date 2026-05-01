/**
 * Web debug channel implementation.
 * Loaded by debug-channel-server.ts.
 */ // Types defined inline for now; will move to debug-channel-server.node.ts later.
export function createDebugChannel() {
    if (process.env.NODE_ENV === 'production') {
        return undefined;
    }
    return createWebDebugChannel();
}
export function createWebDebugChannel() {
    let readableController;
    const clientSideReadable = new ReadableStream({
        start (controller) {
            readableController = controller;
        }
    });
    return {
        serverSide: {
            writable: new WritableStream({
                write (chunk) {
                    readableController == null ? void 0 : readableController.enqueue(chunk);
                },
                close () {
                    readableController == null ? void 0 : readableController.close();
                },
                abort (err) {
                    readableController == null ? void 0 : readableController.error(err);
                }
            })
        },
        clientSide: {
            readable: clientSideReadable
        }
    };
}
/**
 * toNodeDebugChannel is a no-op stub on the web path.
 * It should never be called in edge/web builds.
 */ export function toNodeDebugChannel(_webDebugChannel) {
    throw Object.defineProperty(new Error('toNodeDebugChannel cannot be used in edge/web runtime, this is a bug in the Next.js codebase'), "__NEXT_ERROR_CODE", {
        value: "E1071",
        enumerable: false,
        configurable: true
    });
}

//# sourceMappingURL=debug-channel-server.web.js.map