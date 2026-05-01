/**
 * Vary Params Decoding
 *
 * This module is shared between server and client.
 */ /**
 * Synchronously reads vary params from a thenable.
 *
 * By the time this is called (client-side or in collectSegmentData), the
 * thenable should already be fulfilled because the Flight stream has been
 * fully received. We check the status synchronously to avoid unnecessary
 * microtasks.
 *
 * Returns null if the thenable is still pending (which shouldn't happen in
 * normal operation - it indicates the server failed to track vary params).
 */ export function readVaryParams(thenable) {
    // Attach a no-op listener to force Flight to synchronously resolve the
    // thenable. When a thenable arrives from the Flight stream, it may be in an
    // intermediate 'resolved_model' state (data received but not unwrapped).
    // Calling .then() triggers Flight to transition it to 'fulfilled', making
    // the value available synchronously. React uses this same optimization
    // internally to avoid unnecessary microtasks.
    thenable.then(noop);
    // If the thenable is still not 'fulfilled' after calling .then(), the server
    // failed to resolve it before the stream ended. Treat as unknown.
    if (thenable.status !== 'fulfilled') {
        return null;
    }
    return thenable.value;
}
const noop = ()=>{};

//# sourceMappingURL=vary-params-decoding.js.map