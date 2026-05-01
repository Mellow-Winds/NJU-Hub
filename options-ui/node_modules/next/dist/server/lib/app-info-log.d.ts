import type { ConfiguredExperimentalFeature } from '../config';
export type { ConfiguredExperimentalFeature };
/**
 * Logs basic startup info that doesn't require config.
 * Called before "Ready in X" to show immediate feedback.
 */
export declare function logStartInfo({ networkUrl, appUrl, envInfo, logBundler, }: {
    networkUrl: string | null;
    appUrl: string | null;
    envInfo?: string[];
    logBundler: boolean;
}): void;
/**
 * Logs experimental features and config-dependent info.
 * Called after getRequestHandlers completes.
 */
export declare function logExperimentalInfo({ experimentalFeatures, cacheComponents, }: {
    experimentalFeatures?: ConfiguredExperimentalFeature[];
    cacheComponents?: boolean;
}): void;
/**
 * Gets environment info for logging. Fast operation that doesn't require config.
 */
export declare function getEnvInfo(dir: string): string[];
