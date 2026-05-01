import { RenderStage, type AdvanceableRenderStage, type StagedRenderingController } from './app-render/staged-rendering';
import type { PrerenderStoreModernRuntime, RequestStore } from './app-render/work-unit-async-storage.external';
export declare function isHangingPromiseRejectionError(err: unknown): err is HangingPromiseRejectionError;
declare class HangingPromiseRejectionError extends Error {
    readonly route: string;
    readonly expression: string;
    readonly digest = "HANGING_PROMISE_REJECTION";
    constructor(route: string, expression: string);
}
export declare function makeDevtoolsIOAwarePromise<T>(underlying: T, requestStore: RequestStore, stage: AdvanceableRenderStage): Promise<T>;
/**
 * Returns the appropriate runtime stage for the current point in the render.
 * Runtime-prefetchable segments render in the early stages and should wait
 * for EarlyRuntime. Non-prefetchable segments render in the later stages
 * and should wait for Runtime.
 */
export declare function getRuntimeStage(stagedRendering: StagedRenderingController): RenderStage.EarlyRuntime | RenderStage.Runtime;
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
 */
export declare function delayUntilRuntimeStage<T>(prerenderStore: PrerenderStoreModernRuntime, result: Promise<T>): Promise<T>;
export {};
