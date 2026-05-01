/**
 * Web stream operations for the rendering pipeline.
 * Loaded by stream-ops.ts (re-export in this PR, conditional switcher later).
 */
import type { PostponedState, PrerenderOptions } from 'react-dom/static';
import { resume } from 'react-dom/server';
type FlightRenderToReadableStream = (model: any, webpackMap: any, options?: any) => ReadableStream<Uint8Array>;
export type AnyStream = ReadableStream<Uint8Array>;
export type ContinueStreamSharedOptions = {
    deploymentId: string | undefined;
    getServerInsertedHTML: () => Promise<string>;
    getServerInsertedMetadata: () => Promise<string>;
};
export type ContinueFizzStreamOptions = ContinueStreamSharedOptions & {
    inlinedDataStream: AnyStream | undefined;
    isStaticGeneration: boolean;
    allReady?: Promise<void>;
    validateRootLayout?: boolean;
    suffix?: string;
};
export type ContinueStaticPrerenderOptions = ContinueStreamSharedOptions & {
    inlinedDataStream: AnyStream;
};
export type ContinueDynamicHTMLResumeOptions = ContinueStreamSharedOptions & {
    inlinedDataStream: AnyStream;
    delayDataUntilFirstHtmlChunk: boolean;
};
export type FlightComponentMod = {
    renderToReadableStream: FlightRenderToReadableStream;
};
export type ServerPrerenderComponentMod = {
    prerender: (...args: any[]) => Promise<any>;
};
export type FlightPayload = Parameters<FlightRenderToReadableStream>[0];
export type FlightClientModules = Parameters<FlightRenderToReadableStream>[1];
export type FlightRenderOptions = Parameters<FlightRenderToReadableStream>[2];
export type FizzStreamResult = {
    stream: AnyStream;
    allReady: Promise<void>;
    abort?: (reason?: unknown) => void;
};
export { continueStaticPrerender, continueDynamicPrerender, continueStaticFallbackPrerender, continueDynamicHTMLResume, streamToBuffer, chainStreams, createDocumentClosingStream, } from '../stream-utils/node-web-streams-helper';
export { processPrelude } from './app-render-prerender-utils';
/**
 * Wrapper for continueFizzStream that accepts AnyStream.
 * The underlying implementation expects ReactDOMServerReadableStream but at
 * the stream-ops boundary we only expose AnyStream.
 */
export declare function continueFizzStream(renderStream: AnyStream, opts: ContinueFizzStreamOptions): Promise<ReadableStream<Uint8Array>>;
export declare const nodeReadableToWeb: ((readable: import('node:stream').Readable) => ReadableStream<Uint8Array>) | undefined;
export declare function createInlinedDataStream(source: AnyStream, nonce: string | undefined, formState: unknown | null): AnyStream;
export declare function createPendingStream(): AnyStream;
export declare function createOnHeadersCallback(appendHeader: (key: string, value: string) => void): NonNullable<PrerenderOptions['onHeaders']>;
export declare function resumeAndAbort(element: React.ReactElement, postponed: PostponedState | null, opts: Parameters<typeof resume>[2] & {
    nonce?: string;
}): Promise<AnyStream>;
export declare function renderToFlightStream(ComponentMod: FlightComponentMod, payload: FlightPayload, clientModules: FlightClientModules, opts: FlightRenderOptions): AnyStream;
export declare function streamToString(stream: AnyStream): Promise<string>;
export declare function renderToFizzStream(element: React.ReactElement, streamOptions: any): Promise<FizzStreamResult>;
export declare function resumeToFizzStream(element: React.ReactElement, postponedState: PostponedState, streamOptions: any): Promise<FizzStreamResult>;
export declare function getServerPrerender(ComponentMod: ServerPrerenderComponentMod): (...args: any[]) => any;
export declare const getClientPrerender: typeof import('react-dom/static').prerender;
export declare function pipeRuntimePrefetchTransform(stream: AnyStream, sentinel: number, isPartial: boolean, staleTime: number): AnyStream;
