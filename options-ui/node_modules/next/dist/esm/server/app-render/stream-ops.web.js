/**
 * Web stream operations for the rendering pipeline.
 * Loaded by stream-ops.ts (re-export in this PR, conditional switcher later).
 */ import { resume, renderToReadableStream } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { renderToInitialFizzStream, streamToString as webStreamToString, createRuntimePrefetchTransformStream, continueFizzStream as webContinueFizzStream } from '../stream-utils/node-web-streams-helper';
import { createInlinedDataReadableStream } from './use-flight-response';
// ---------------------------------------------------------------------------
// Continue functions
// ---------------------------------------------------------------------------
export { continueStaticPrerender, continueDynamicPrerender, continueStaticFallbackPrerender, continueDynamicHTMLResume, streamToBuffer, chainStreams, createDocumentClosingStream } from '../stream-utils/node-web-streams-helper';
export { processPrelude } from './app-render-prerender-utils';
/**
 * Wrapper for continueFizzStream that accepts AnyStream.
 * The underlying implementation expects ReactDOMServerReadableStream but at
 * the stream-ops boundary we only expose AnyStream.
 */ export function continueFizzStream(renderStream, opts) {
    return webContinueFizzStream(renderStream, opts);
}
// Not available in web bundles
export const nodeReadableToWeb = undefined;
// ---------------------------------------------------------------------------
// Composed helpers
// ---------------------------------------------------------------------------
export function createInlinedDataStream(source, nonce, formState) {
    return createInlinedDataReadableStream(source, nonce, formState);
}
export function createPendingStream() {
    return new ReadableStream();
}
export function createOnHeadersCallback(appendHeader) {
    return (headers)=>{
        headers.forEach((value, key)=>{
            appendHeader(key, value);
        });
    };
}
export async function resumeAndAbort(element, postponed, opts) {
    return resume(element, postponed, opts);
}
export function renderToFlightStream(ComponentMod, payload, clientModules, opts) {
    return ComponentMod.renderToReadableStream(payload, clientModules, opts);
}
export async function streamToString(stream) {
    return webStreamToString(stream);
}
export async function renderToFizzStream(element, streamOptions) {
    const stream = await renderToInitialFizzStream({
        ReactDOMServer: {
            renderToReadableStream
        },
        element,
        streamOptions
    });
    return {
        stream,
        allReady: stream.allReady,
        abort: undefined
    };
}
export async function resumeToFizzStream(element, postponedState, streamOptions) {
    const stream = await resume(element, postponedState, streamOptions);
    return {
        stream,
        allReady: stream.allReady,
        abort: undefined
    };
}
export function getServerPrerender(ComponentMod) {
    return ComponentMod.prerender;
}
export const getClientPrerender = prerender;
export function pipeRuntimePrefetchTransform(stream, sentinel, isPartial, staleTime) {
    return stream.pipeThrough(createRuntimePrefetchTransformStream(sentinel, isPartial, staleTime));
}

//# sourceMappingURL=stream-ops.web.js.map