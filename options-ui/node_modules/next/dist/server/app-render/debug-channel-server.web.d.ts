/**
 * Web debug channel implementation.
 * Loaded by debug-channel-server.ts.
 */
export type DebugChannelPair = {
    serverSide: DebugChannelServer;
    clientSide: DebugChannelClient;
};
export type DebugChannelServer = {
    readable?: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
};
type DebugChannelClient = {
    readable: ReadableStream<Uint8Array>;
    writable?: WritableStream<Uint8Array>;
};
export declare function createDebugChannel(): DebugChannelPair | undefined;
export declare function createWebDebugChannel(): DebugChannelPair;
/**
 * toNodeDebugChannel is a no-op stub on the web path.
 * It should never be called in edge/web builds.
 */
export declare function toNodeDebugChannel(_webDebugChannel: DebugChannelServer): never;
export {};
