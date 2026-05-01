import { NextBuildContext } from '../build-context';
import { getTraceEvents } from '../../trace';
import type { TraceState } from '../../trace';
export declare function turbopackBuild(): Promise<{
    duration: number;
    buildTraceContext: undefined;
    shutdownPromise: Promise<void>;
}>;
export declare function workerMain(workerData: {
    buildContext: typeof NextBuildContext;
    traceState: TraceState & {
        shouldSaveTraceEvents: boolean;
    };
}): Promise<Omit<Awaited<ReturnType<typeof turbopackBuild>>, 'shutdownPromise'>>;
export declare function waitForShutdown(): Promise<{
    debugTraceEvents?: ReturnType<typeof getTraceEvents>;
}>;
