import '../server/require-hook';
// Import cpu-profile to start profiling early if enabled
import '../server/lib/cpu-profile';
globalThis.NEXT_CLIENT_ASSET_SUFFIX = process.env.__NEXT_PRERENDER_CLIENT_ASSET_SUFFIX;
export { getDefinedNamedExports, hasCustomGetInitialProps, isPageStatic } from './utils';
export { exportPages } from '../export/worker';

//# sourceMappingURL=worker.js.map