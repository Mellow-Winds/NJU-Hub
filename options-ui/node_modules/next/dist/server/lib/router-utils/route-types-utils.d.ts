import { type Group } from '../../../shared/lib/router/utils/route-regex';
import type { NextConfigComplete } from '../../config-shared';
import type { RouteInfo, SlotInfo } from '../../../build/file-classifier';
interface ManifestRouteInfo {
    path: string;
    groups: {
        [groupName: string]: Group;
    };
}
export interface RouteTypesManifest {
    appRoutes: Record<string, ManifestRouteInfo>;
    pageRoutes: Record<string, ManifestRouteInfo>;
    layoutRoutes: Record<string, ManifestRouteInfo & {
        slots: string[];
    }>;
    appRouteHandlerRoutes: Record<string, ManifestRouteInfo>;
    /** Map of redirect source => ManifestRouteInfo */
    redirectRoutes: Record<string, ManifestRouteInfo>;
    /** Map of rewrite source => ManifestRouteInfo */
    rewriteRoutes: Record<string, ManifestRouteInfo>;
    /** File paths for validation */
    appPagePaths: Set<string>;
    pagesRouterPagePaths: Set<string>;
    layoutPaths: Set<string>;
    appRouteHandlers: Set<string>;
    pageApiRoutes: Set<string>;
    /** Direct mapping from file paths to routes for validation */
    filePathToRoute: Map<string, string>;
}
export declare function convertCustomRouteSource(source: string): string[];
/**
 * Extracts route parameters from a route pattern
 */
export declare function extractRouteParams(route: string): {
    [groupName: string]: Group;
};
/**
 * Creates a route types manifest from processed route data
 * (used for both build and dev)
 */
export declare function createRouteTypesManifest({ dir, pageRoutes, appRoutes, appRouteHandlers, pageApiRoutes, layoutRoutes, slots, redirects, rewrites, validatorFilePath, }: {
    dir: string;
    pageRoutes: RouteInfo[];
    appRoutes: RouteInfo[];
    appRouteHandlers: RouteInfo[];
    pageApiRoutes: RouteInfo[];
    layoutRoutes: RouteInfo[];
    slots: SlotInfo[];
    redirects?: NextConfigComplete['redirects'];
    rewrites?: NextConfigComplete['rewrites'];
    validatorFilePath?: string;
}): Promise<RouteTypesManifest>;
export declare function writeRouteTypesManifest(manifest: RouteTypesManifest, filePath: string, config: NextConfigComplete): Promise<void>;
export declare function writeValidatorFile(manifest: RouteTypesManifest, filePath: string, strict: boolean): Promise<void>;
export {};
