import type { LoaderTree } from '../lib/app-dir-module';
import { type FlightRouterState, type PrefetchHints } from '../../shared/lib/app-router-types';
import type { GetDynamicParamFromSegment } from './app-render';
export declare function createFlightRouterStateFromLoaderTree(loaderTree: LoaderTree, hintTree: PrefetchHints | null, getDynamicParamFromSegment: GetDynamicParamFromSegment, searchParams: any): Promise<FlightRouterState>;
export declare function createRouteTreePrefetch(loaderTree: LoaderTree, hintTree: PrefetchHints | null, getDynamicParamFromSegment: GetDynamicParamFromSegment): Promise<FlightRouterState>;
