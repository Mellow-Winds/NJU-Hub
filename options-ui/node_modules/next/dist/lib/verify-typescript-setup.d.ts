import type { TypeCheckResult } from './typescript/runTypeCheck';
export declare function verifyAndRunTypeScript({ dir, distDir, cacheDir, strictRouteTypes, tsconfigPath, shouldRunTypeCheck, typedRoutes, disableStaticImages, hasAppDir, hasPagesDir, appDir, pagesDir, debugBuildPaths, }: {
    dir: string;
    distDir: string;
    cacheDir?: string;
    strictRouteTypes: boolean;
    tsconfigPath: string | undefined;
    shouldRunTypeCheck: boolean;
    typedRoutes: boolean;
    disableStaticImages: boolean;
    hasAppDir: boolean;
    hasPagesDir: boolean;
    appDir?: string;
    pagesDir?: string;
    debugBuildPaths?: {
        app?: string[];
        pages?: string[];
    };
}): Promise<{
    result?: TypeCheckResult;
    version: string | null;
}>;
