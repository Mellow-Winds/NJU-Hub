import type { SupportedErrorEvent } from '../container/runtime-error/render-error';
import type { OriginalStackFrame } from '../../shared/stack-frame';
export type ReadyErrorCause = {
    error: Error;
    frames: () => Promise<readonly OriginalStackFrame[]>;
    cause?: ReadyErrorCause;
};
export type ReadyRuntimeError = {
    id: number;
    runtime: true;
    error: Error & {
        environmentName?: string;
    };
    frames: () => Promise<readonly OriginalStackFrame[]>;
    type: 'runtime' | 'console' | 'recoverable';
    cause?: ReadyErrorCause;
};
export declare const useFrames: (error: ReadyRuntimeError | null) => readonly OriginalStackFrame[];
export declare function getErrorByType(event: SupportedErrorEvent, isAppDir: boolean): ReadyRuntimeError;
