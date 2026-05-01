import type { LoaderTree } from '../../lib/app-dir-module';
import type { AppSegmentConfig, InstantSample } from '../../../build/segment-config/app/app-segment-config';
export declare function anySegmentHasRuntimePrefetchEnabled(tree: LoaderTree): Promise<boolean>;
export declare function isPageAllowedToBlock(tree: LoaderTree): Promise<boolean>;
type FoundSegmentWithConfig = {
    path: string[];
    config: NonNullable<AppSegmentConfig['unstable_instant']>;
};
export declare const anySegmentNeedsInstantValidationInDev: (arg: LoaderTree) => Promise<boolean>;
export declare const anySegmentNeedsInstantValidationInBuild: (arg: LoaderTree) => Promise<boolean>;
export declare const findSegmentsWithInstantConfig: (arg: LoaderTree) => Promise<FoundSegmentWithConfig[]>;
export declare const resolveInstantConfigSamplesForPage: (tree: LoaderTree) => Promise<InstantSample[] | null>;
export {};
