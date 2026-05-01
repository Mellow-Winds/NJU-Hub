import { RenderStage } from './app-render/staged-rendering';
export function isHangingPromiseRejectionError(err) {
    if (typeof err !== 'object' || err === null || !('digest' in err)) {
        return false;
    }
    return err.digest === HANGING_PROMISE_REJECTION;
}
const HANGING_PROMISE_REJECTION = 'HANGING_PROMISE_REJECTION';
class HangingPromiseRejectionError extends Error {
    constructor(route, expression){
        super(`During prerendering, ${expression} rejects when the prerender is complete. Typically these errors are handled by React but if you move ${expression} to a different context by using \`setTimeout\`, \`after\`, or similar functions you may observe this error and you should handle it in that context. This occurred at route "${route}".`), this.route = route, this.expression = expression, this.digest = HANGING_PROMISE_REJECTION;
    }
}
const abortListenersBySignal = new WeakMap();
/**
 * This function constructs a promise that will never resolve. This is primarily
 * useful for cacheComponents where we use promise resolution timing to determine which
 * parts of a render can be included in a prerender.
 *
 * @internal
 */ export function makeHangingPromise(signal, route, expression) {
    if (signal.aborted) {
        return Promise.reject(new HangingPromiseRejectionError(route, expression));
    } else {
        const hangingPromise = new Promise((_, reject)=>{
            const boundRejection = reject.bind(null, new HangingPromiseRejectionError(route, expression));
            let currentListeners = abortListenersBySignal.get(signal);
            if (currentListeners) {
                currentListeners.push(boundRejection);
            } else {
                const listeners = [
                    boundRejection
                ];
                abortListenersBySignal.set(signal, listeners);
                signal.addEventListener('abort', ()=>{
                    for(let i = 0; i < listeners.length; i++){
                        listeners[i]();
                    }
                }, {
                    once: true
                });
            }
        });
        // We are fine if no one actually awaits this promise. We shouldn't consider this an unhandled rejection so
        // we attach a noop catch handler here to suppress this warning. If you actually await somewhere or construct
        // your own promise out of it you'll need to ensure you handle the error when it rejects.
        hangingPromise.catch(ignoreReject);
        return hangingPromise;
    }
}
function ignoreReject() {}
export function makeDevtoolsIOAwarePromise(underlying, requestStore, stage) {
    if (requestStore.stagedRendering) {
        // We resolve each stage in a timeout, so React DevTools will pick this up as IO.
        return requestStore.stagedRendering.delayUntilStage(stage, undefined, underlying);
    }
    // in React DevTools if we resolve in a setTimeout we will observe
    // the promise resolution as something that can suspend a boundary or root.
    return new Promise((resolve)=>{
        // Must use setTimeout to be considered IO React DevTools. setImmediate will not work.
        setTimeout(()=>{
            resolve(underlying);
        }, 0);
    });
}
/**
 * Returns the appropriate runtime stage for the current point in the render.
 * Runtime-prefetchable segments render in the early stages and should wait
 * for EarlyRuntime. Non-prefetchable segments render in the later stages
 * and should wait for Runtime.
 */ export function getRuntimeStage(stagedRendering) {
    if (stagedRendering.currentStage === RenderStage.EarlyStatic || stagedRendering.currentStage === RenderStage.EarlyRuntime) {
        return RenderStage.EarlyRuntime;
    }
    return RenderStage.Runtime;
}
/**
 * Delays until the appropriate runtime stage based on the current stage of
 * the rendering pipeline:
 *
 * - Early stages → wait for EarlyRuntime
 *   (for runtime-prefetchable segments)
 * - Later stages → wait for Runtime
 *   (for segments not using runtime prefetch)
 *
 * This ensures that cookies()/headers()/etc. resolve at the right time for
 * each segment type.
 */ export function delayUntilRuntimeStage(prerenderStore, result) {
    const { stagedRendering } = prerenderStore;
    if (!stagedRendering) {
        return result;
    }
    return stagedRendering.waitForStage(getRuntimeStage(stagedRendering)).then(()=>result);
}

//# sourceMappingURL=dynamic-rendering-utils.js.map