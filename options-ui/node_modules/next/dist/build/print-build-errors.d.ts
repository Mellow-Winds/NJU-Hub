import type { TurbopackResult } from './swc/types';
/**
 * Processes and reports build issues from Turbopack entrypoints.
 *
 * @param entrypoints - The result object containing build issues to process.
 * @param isDev - A flag indicating if the build is running in development mode.
 * @return This function does not return a value but logs or throws errors based on the issues.
 * @throws {Error} If a fatal issue is encountered, this function throws an error. In development mode, we only throw on
 *                 'fatal' and 'bug' issues. In production mode, we also throw on 'error' issues.
 */
export declare function printBuildErrors(entrypoints: TurbopackResult, isDev: boolean): void;
