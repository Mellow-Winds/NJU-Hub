"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "handleBuildComplete", {
    enumerable: true,
    get: function() {
        return handleBuildComplete;
    }
});
const _path = /*#__PURE__*/ _interop_require_default(require("path"));
const _promises = /*#__PURE__*/ _interop_require_default(require("fs/promises"));
const _url = require("url");
const _log = /*#__PURE__*/ _interop_require_wildcard(require("../output/log"));
const _utils = require("../utils");
const _renderingmode = require("../rendering-mode");
const _interopdefault = require("../../lib/interop-default");
const _recursivereaddir = require("../../lib/recursive-readdir");
const _utils1 = require("../../shared/lib/router/utils");
const _apppaths = require("../../shared/lib/router/utils/app-paths");
const _constants = require("../../shared/lib/constants");
const _normalizepagepath = require("../../shared/lib/page-path/normalize-page-path");
const _routingutils = require("next/dist/compiled/@vercel/routing-utils");
const _constants1 = require("../../lib/constants");
const _normalizelocalepath = require("../../shared/lib/i18n/normalize-locale-path");
const _ismetadataroute = require("../../lib/metadata/is-metadata-route");
const _addpathprefix = require("../../shared/lib/router/utils/add-path-prefix");
const _redirectstatus = require("../../lib/redirect-status");
const _routeregex = require("../../shared/lib/router/utils/route-regex");
const _escaperegexp = require("../../shared/lib/escape-regexp");
const _sortableroutes = require("../../shared/lib/router/utils/sortable-routes");
const _requirehook = require("../../server/require-hook");
const _generateroutesmanifest = require("../generate-routes-manifest");
const _bundler = require("../../lib/bundler");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function normalizePathnames(config, outputs) {
    // normalize pathname field with basePath
    if (config.basePath) {
        for (const output of [
            ...outputs.pages,
            ...outputs.pagesApi,
            ...outputs.appPages,
            ...outputs.appRoutes,
            ...outputs.prerenders,
            ...outputs.staticFiles
        ]){
            output.pathname = (0, _addpathprefix.addPathPrefix)(output.pathname, config.basePath).replace(/\/$/, '') || '/';
        }
    }
}
async function handleBuildComplete({ dir, config, appType, buildId, configOutDir, distDir, pageKeys, bundler, tracingRoot, adapterPath, appPageKeys, staticPages, nextVersion, hasStatic404, hasStatic500, routesManifest, serverPropsPages, hasNodeMiddleware, prerenderManifest, middlewareManifest, requiredServerFiles, hasInstrumentationHook, functionsConfigManifest }) {
    const adapterMod = (0, _interopdefault.interopDefault)(await import((0, _url.pathToFileURL)(require.resolve(adapterPath)).href));
    if (typeof adapterMod.onBuildComplete === 'function') {
        const outputs = {
            pages: [],
            pagesApi: [],
            appPages: [],
            appRoutes: [],
            prerenders: [],
            staticFiles: []
        };
        if (config.output === 'export') {
            // collect export assets and provide as static files
            const exportFiles = await (0, _recursivereaddir.recursiveReadDir)(configOutDir);
            for (const file of exportFiles){
                let pathname = (file.endsWith('.html') ? file.replace(/\.html$/, '') : file).replace(/\\/g, '/');
                pathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
                outputs.staticFiles.push({
                    id: file,
                    pathname,
                    filePath: _path.default.join(configOutDir, file),
                    type: _constants.AdapterOutputType.STATIC_FILE,
                    immutableHash: undefined
                });
            }
        } else {
            const staticFiles = await (0, _recursivereaddir.recursiveReadDir)(_path.default.join(distDir, 'static'));
            const clientHashes = bundler === _bundler.Bundler.Turbopack && config.experimental.immutableAssetToken ? JSON.parse(await _promises.default.readFile(_path.default.join(distDir, 'immutable-static-hashes.json'), 'utf8')) : undefined;
            for (const file of staticFiles){
                const pathname = _path.default.posix.join('/_next/static', file);
                const filePath = _path.default.join(distDir, 'static', file);
                const id = _path.default.join('static', file);
                outputs.staticFiles.push({
                    type: _constants.AdapterOutputType.STATIC_FILE,
                    id,
                    pathname,
                    filePath,
                    immutableHash: clientHashes == null ? void 0 : clientHashes[id]
                });
            }
            const sharedNodeAssets = {};
            const pagesSharedNodeAssets = {};
            const appPagesSharedNodeAssets = {};
            for (const file of requiredServerFiles){
                // add to shared node assets
                const filePath = _path.default.join(dir, file);
                const fileOutputPath = _path.default.relative(tracingRoot, filePath);
                sharedNodeAssets[fileOutputPath] = filePath;
            }
            // add "next/setup-node-env" stub so it can be required top-level
            // TODO: should we make this always available without adapters
            const setupNodeStubPath = _path.default.join(_path.default.dirname(require.resolve('next/package.json')), 'setup-node-env.js');
            sharedNodeAssets[_path.default.relative(tracingRoot, setupNodeStubPath)] = require.resolve('next/dist/build/adapter/setup-node-env.external');
            const moduleTypes = [
                'app-page',
                'pages'
            ];
            for (const type of moduleTypes){
                const currentDependencies = [];
                const modulePath = require.resolve(`next/dist/server/route-modules/${type}/module.compiled`);
                currentDependencies.push(modulePath);
                const contextDir = _path.default.join(_path.default.dirname(modulePath), 'vendored', 'contexts');
                for (const item of (await _promises.default.readdir(contextDir))){
                    if (item.match(/\.(mjs|cjs|js)$/)) {
                        currentDependencies.push(_path.default.join(contextDir, item));
                    }
                }
                for (const dependencyPath of currentDependencies){
                    const rootRelativeFilePath = _path.default.relative(tracingRoot, dependencyPath);
                    if (type === 'pages') {
                        pagesSharedNodeAssets[rootRelativeFilePath] = _path.default.join(tracingRoot, rootRelativeFilePath);
                    } else {
                        appPagesSharedNodeAssets[rootRelativeFilePath] = _path.default.join(tracingRoot, rootRelativeFilePath);
                    }
                }
            }
            if (bundler !== _bundler.Bundler.Turbopack) {
                const { nodeFileTrace } = require('next/dist/compiled/@vercel/nft');
                const { makeIgnoreFn } = require('../collect-build-traces');
                const sharedTraceIgnores = [
                    '**/next/dist/compiled/next-server/**/*.dev.js',
                    '**/next/dist/compiled/webpack/*',
                    '**/node_modules/webpack5/**/*',
                    '**/next/dist/server/lib/route-resolver*',
                    'next/dist/compiled/semver/semver/**/*.js',
                    '**/node_modules/react{,-dom,-dom-server-turbopack}/**/*.development.js',
                    '**/*.d.ts',
                    '**/*.map',
                    '**/next/dist/pages/**/*',
                    '**/node_modules/sharp/**/*',
                    '**/@img/sharp-libvips*/**/*',
                    '**/next/dist/compiled/edge-runtime/**/*',
                    '**/next/dist/server/web/sandbox/**/*',
                    '**/next/dist/server/post-process.js'
                ];
                const sharedIgnoreFn = makeIgnoreFn(tracingRoot, sharedTraceIgnores);
                // These are modules that are necessary for bootstrapping node env
                const necessaryNodeDependencies = [
                    require.resolve('next/dist/server/node-environment'),
                    require.resolve('next/dist/server/require-hook'),
                    require.resolve('next/dist/server/node-polyfill-crypto'),
                    ...Object.values(_requirehook.defaultOverrides).filter((item)=>_path.default.extname(item))
                ];
                const { fileList, esmFileList } = await nodeFileTrace(necessaryNodeDependencies, {
                    base: tracingRoot,
                    ignore: sharedIgnoreFn
                });
                esmFileList.forEach((item)=>fileList.add(item));
                for (const rootRelativeFilePath of fileList){
                    sharedNodeAssets[rootRelativeFilePath] = _path.default.join(tracingRoot, rootRelativeFilePath);
                }
            }
            if (hasInstrumentationHook) {
                const assets = await handleTraceFiles(_path.default.join(distDir, 'server', 'instrumentation.js.nft.json'), 'neutral');
                const fileOutputPath = _path.default.relative(tracingRoot, _path.default.join(distDir, 'server', 'instrumentation.js'));
                sharedNodeAssets[fileOutputPath] = _path.default.join(distDir, 'server', 'instrumentation.js');
                Object.assign(sharedNodeAssets, assets);
            }
            async function handleTraceFiles(traceFilePath, type) {
                const assets = Object.assign({}, sharedNodeAssets, type === 'pages' ? pagesSharedNodeAssets : {}, type === 'app' ? appPagesSharedNodeAssets : {});
                const traceData = JSON.parse(await _promises.default.readFile(traceFilePath, 'utf8'));
                const traceFileDir = _path.default.dirname(traceFilePath);
                for (const relativeFile of traceData.files){
                    const tracedFilePath = _path.default.join(traceFileDir, relativeFile);
                    const fileOutputPath = _path.default.relative(tracingRoot, tracedFilePath);
                    assets[fileOutputPath] = tracedFilePath;
                }
                return assets;
            }
            async function handleEdgeFunction(page, isMiddleware = false) {
                let type = _constants.AdapterOutputType.PAGES;
                const isAppPrefix = page.name.startsWith('app/');
                const isAppPage = isAppPrefix && page.name.endsWith('/page');
                const isAppRoute = isAppPrefix && page.name.endsWith('/route');
                let currentOutputs = outputs.pages;
                if (isMiddleware) {
                    type = _constants.AdapterOutputType.MIDDLEWARE;
                } else if (isAppPage) {
                    currentOutputs = outputs.appPages;
                    type = _constants.AdapterOutputType.APP_PAGE;
                } else if (isAppRoute) {
                    currentOutputs = outputs.appRoutes;
                    type = _constants.AdapterOutputType.APP_ROUTE;
                } else if (page.page.startsWith('/api')) {
                    currentOutputs = outputs.pagesApi;
                    type = _constants.AdapterOutputType.PAGES_API;
                }
                const route = page.page.replace(/^(app|pages)\//, '');
                const pathname = isAppPrefix ? (0, _apppaths.normalizeAppPath)(route) : route === '/index' ? '/' : route;
                const edgeEntrypointRelativePath = page.entrypoint;
                const edgeEntrypointPath = _path.default.join(distDir, edgeEntrypointRelativePath);
                const output = {
                    type,
                    id: page.name,
                    runtime: 'edge',
                    sourcePage: route,
                    pathname,
                    filePath: edgeEntrypointPath,
                    edgeRuntime: {
                        modulePath: edgeEntrypointPath,
                        entryKey: `middleware_${page.name}`,
                        handlerExport: 'handler'
                    },
                    assets: {},
                    wasmAssets: {},
                    config: {
                        env: page.env
                    }
                };
                function handleFile(file) {
                    const originalPath = _path.default.join(distDir, file);
                    const fileOutputPath = _path.default.relative(config.distDir, _path.default.join(_path.default.relative(tracingRoot, distDir), file));
                    if (!output.assets) {
                        output.assets = {};
                    }
                    output.assets[fileOutputPath] = originalPath;
                }
                for (const file of page.files){
                    handleFile(file);
                }
                for (const item of [
                    ...page.assets || []
                ]){
                    if (!output.assets) {
                        output.assets = {};
                    }
                    output.assets[item.name] = _path.default.join(distDir, item.filePath);
                }
                for (const item of page.wasm || []){
                    if (!output.wasmAssets) {
                        output.wasmAssets = {};
                    }
                    output.wasmAssets[item.name] = _path.default.join(distDir, item.filePath);
                }
                if (type === _constants.AdapterOutputType.MIDDLEWARE) {
                    ;
                    output.config.matchers = page.matchers.map((item)=>{
                        return {
                            source: item.originalSource,
                            sourceRegex: item.regexp,
                            has: item.has,
                            missing: [
                                ...item.missing || [],
                                // always skip middleware for on-demand revalidate
                                {
                                    type: 'header',
                                    key: 'x-prerender-revalidate',
                                    value: prerenderManifest.preview.previewModeId
                                }
                            ]
                        };
                    });
                    output.pathname = '/_middleware';
                    output.id = page.name;
                    outputs.middleware = output;
                } else {
                    currentOutputs.push(output);
                }
                // need to add matching .rsc output
                if (isAppPage) {
                    const rscPathname = (0, _normalizepagepath.normalizePagePath)(output.pathname) + '.rsc';
                    outputs.appPages.push({
                        ...output,
                        pathname: rscPathname,
                        id: page.name + '.rsc'
                    });
                } else if (type !== _constants.AdapterOutputType.MIDDLEWARE && serverPropsPages.has(pathname)) {
                    const nextDataPath = _path.default.posix.join('/_next/data/', buildId, (0, _normalizepagepath.normalizePagePath)(pathname) + '.json');
                    outputs.pages.push({
                        ...output,
                        pathname: nextDataPath
                    });
                }
            }
            const edgeFunctionHandlers = [];
            for (const middleware of Object.values(middlewareManifest.middleware)){
                if ((0, _utils.isMiddlewareFilename)(middleware.name)) {
                    edgeFunctionHandlers.push(handleEdgeFunction(middleware, true));
                }
            }
            for (const page of Object.values(middlewareManifest.functions)){
                edgeFunctionHandlers.push(handleEdgeFunction(page));
            }
            const pagesDistDir = _path.default.join(distDir, 'server', 'pages');
            const pageOutputMap = {};
            const rscFallbackPath = _path.default.join(distDir, 'server', 'rsc-fallback.json');
            if (appPageKeys && appPageKeys.length > 0 && pageKeys.length > 0) {
                await _promises.default.writeFile(rscFallbackPath, '{}');
            }
            for (const page of pageKeys){
                if (page === '/_app' || page === '/_document') {
                    continue;
                }
                if (middlewareManifest.functions.hasOwnProperty(page)) {
                    continue;
                }
                const route = (0, _normalizepagepath.normalizePagePath)(page);
                const pageFile = _path.default.join(pagesDistDir, `${route}.js`);
                // if it's an auto static optimized page it's just
                // a static file
                if (staticPages.has(page)) {
                    if (config.i18n) {
                        for (const locale of config.i18n.locales || []){
                            const localePage = page === '/' ? `/${locale}` : (0, _addpathprefix.addPathPrefix)(page, `/${locale}`);
                            const localeOutput = {
                                id: localePage,
                                pathname: localePage,
                                type: _constants.AdapterOutputType.STATIC_FILE,
                                filePath: _path.default.join(pagesDistDir, `${(0, _normalizepagepath.normalizePagePath)(localePage)}.html`),
                                immutableHash: undefined
                            };
                            outputs.staticFiles.push(localeOutput);
                            if (appPageKeys && appPageKeys.length > 0) {
                                outputs.staticFiles.push({
                                    id: `${localePage}.rsc`,
                                    pathname: `${localePage}.rsc`,
                                    type: _constants.AdapterOutputType.STATIC_FILE,
                                    filePath: rscFallbackPath,
                                    immutableHash: undefined
                                });
                            }
                        }
                    } else {
                        const staticOutput = {
                            id: page,
                            pathname: route,
                            type: _constants.AdapterOutputType.STATIC_FILE,
                            filePath: pageFile.replace(/\.js$/, '.html'),
                            immutableHash: undefined
                        };
                        outputs.staticFiles.push(staticOutput);
                        if (appPageKeys && appPageKeys.length > 0) {
                            outputs.staticFiles.push({
                                id: `${page}.rsc`,
                                pathname: `${route}.rsc`,
                                type: _constants.AdapterOutputType.STATIC_FILE,
                                filePath: rscFallbackPath,
                                immutableHash: undefined
                            });
                        }
                    }
                    continue;
                }
                const pageTraceFile = `${pageFile}.nft.json`;
                const assets = await handleTraceFiles(pageTraceFile, 'pages').catch((err)=>{
                    if (err.code !== 'ENOENT' || page !== '/404' && page !== '/500') {
                        _log.warn(`Failed to locate traced assets for ${pageFile}`, err);
                    }
                    return {};
                });
                const functionConfig = functionsConfigManifest.functions[route] || {};
                let sourcePage = route.replace(/^\//, '');
                sourcePage = sourcePage === 'api' ? 'api/index' : sourcePage;
                const output = {
                    id: route,
                    type: page.startsWith('/api') ? _constants.AdapterOutputType.PAGES_API : _constants.AdapterOutputType.PAGES,
                    filePath: pageTraceFile.replace(/\.nft\.json$/, ''),
                    pathname: route,
                    sourcePage,
                    assets,
                    runtime: 'nodejs',
                    config: {
                        maxDuration: functionConfig.maxDuration,
                        preferredRegion: functionConfig.regions
                    }
                };
                pageOutputMap[page] = output;
                if (output.type === _constants.AdapterOutputType.PAGES) {
                    var _config_i18n;
                    outputs.pages.push(output);
                    // if page is get server side props we need to create
                    // the _next/data output as well
                    if (serverPropsPages.has(page)) {
                        const dataPathname = _path.default.posix.join('/_next/data', buildId, (0, _normalizepagepath.normalizePagePath)(page) + '.json');
                        outputs.pages.push({
                            ...output,
                            pathname: dataPathname,
                            id: dataPathname
                        });
                        if (appPageKeys && appPageKeys.length > 0) {
                            const rscPage = `${page === '/' ? '/index' : page}.rsc`;
                            outputs.staticFiles.push({
                                id: rscPage,
                                pathname: rscPage,
                                type: _constants.AdapterOutputType.STATIC_FILE,
                                filePath: rscFallbackPath,
                                immutableHash: undefined
                            });
                        }
                    }
                    for (const locale of ((_config_i18n = config.i18n) == null ? void 0 : _config_i18n.locales) || []){
                        const localePage = page === '/' ? `/${locale}` : (0, _addpathprefix.addPathPrefix)(page, `/${locale}`);
                        outputs.pages.push({
                            ...output,
                            id: localePage,
                            pathname: localePage
                        });
                        if (serverPropsPages.has(page)) {
                            const dataPathname = _path.default.posix.join('/_next/data', buildId, localePage + '.json');
                            outputs.pages.push({
                                ...output,
                                pathname: dataPathname,
                                id: dataPathname
                            });
                            if (appPageKeys && appPageKeys.length > 0) {
                                outputs.staticFiles.push({
                                    id: `${localePage}.rsc`,
                                    pathname: `${localePage}.rsc`,
                                    type: _constants.AdapterOutputType.STATIC_FILE,
                                    filePath: rscFallbackPath,
                                    immutableHash: undefined
                                });
                            }
                        }
                    }
                } else {
                    outputs.pagesApi.push(output);
                }
            }
            if (hasNodeMiddleware) {
                var _functionConfig_matchers;
                const middlewareFile = _path.default.join(distDir, 'server', 'middleware.js');
                const middlewareTrace = `${middlewareFile}.nft.json`;
                const assets = await handleTraceFiles(middlewareTrace, 'neutral');
                const functionConfig = functionsConfigManifest.functions['/_middleware'] || {};
                outputs.middleware = {
                    pathname: '/_middleware',
                    id: '/_middleware',
                    sourcePage: 'middleware',
                    assets,
                    type: _constants.AdapterOutputType.MIDDLEWARE,
                    runtime: 'nodejs',
                    filePath: middlewareFile,
                    config: {
                        matchers: ((_functionConfig_matchers = functionConfig.matchers) == null ? void 0 : _functionConfig_matchers.map((item)=>{
                            return {
                                source: item.originalSource,
                                sourceRegex: item.regexp,
                                has: item.has,
                                missing: [
                                    ...item.missing || [],
                                    // always skip middleware for on-demand revalidate
                                    {
                                        type: 'header',
                                        key: 'x-prerender-revalidate',
                                        value: prerenderManifest.preview.previewModeId
                                    }
                                ]
                            };
                        })) || []
                    }
                };
            }
            const appOutputMap = {};
            const appDistDir = _path.default.join(distDir, 'server', 'app');
            if (appPageKeys) {
                for (const page of appPageKeys){
                    var _config_i18n_locales, _config_i18n1;
                    if (middlewareManifest.functions.hasOwnProperty(page)) {
                        continue;
                    }
                    const normalizedPage = (0, _apppaths.normalizeAppPath)(page);
                    // Skip static metadata routes only when they are prerendered.
                    // Dynamic metadata routes (e.g. robots/sitemap using connection())
                    // should remain app routes in adapter outputs.
                    const isStaticMetadataRoute = (0, _ismetadataroute.isStaticMetadataFile)(normalizedPage);
                    const isPrerenderedMetadataRoute = prerenderManifest.routes[normalizedPage] || prerenderManifest.dynamicRoutes[normalizedPage] || ((_config_i18n1 = config.i18n) == null ? void 0 : (_config_i18n_locales = _config_i18n1.locales) == null ? void 0 : _config_i18n_locales.some((locale)=>{
                        const localePathname = _path.default.posix.join('/', locale, normalizedPage.slice(1));
                        return prerenderManifest.routes[localePathname] || prerenderManifest.dynamicRoutes[localePathname];
                    }));
                    if (isStaticMetadataRoute && isPrerenderedMetadataRoute) {
                        continue;
                    }
                    const pageFile = _path.default.join(appDistDir, `${page}.js`);
                    const pageTraceFile = `${pageFile}.nft.json`;
                    const assets = await handleTraceFiles(pageTraceFile, 'app').catch((err)=>{
                        _log.warn(`Failed to copy traced files for ${pageFile}`, err);
                        return {};
                    });
                    // If this is a parallel route we just need to merge
                    // the assets as they share the same pathname
                    const existingOutput = appOutputMap[normalizedPage];
                    if (existingOutput) {
                        Object.assign(existingOutput.assets, assets);
                        existingOutput.assets[_path.default.relative(tracingRoot, pageFile)] = pageFile;
                        continue;
                    }
                    const functionConfig = functionsConfigManifest.functions[normalizedPage] || {};
                    const output = {
                        pathname: normalizedPage,
                        id: normalizedPage,
                        sourcePage: page,
                        assets,
                        type: page.endsWith('/route') ? _constants.AdapterOutputType.APP_ROUTE : _constants.AdapterOutputType.APP_PAGE,
                        runtime: 'nodejs',
                        filePath: pageFile,
                        config: {
                            maxDuration: functionConfig.maxDuration,
                            preferredRegion: functionConfig.regions
                        }
                    };
                    appOutputMap[normalizedPage] = output;
                    if (output.type === _constants.AdapterOutputType.APP_PAGE) {
                        outputs.appPages.push({
                            ...output,
                            pathname: (0, _normalizepagepath.normalizePagePath)(output.pathname) + '.rsc',
                            id: (0, _normalizepagepath.normalizePagePath)(output.pathname) + '.rsc'
                        });
                        outputs.appPages.push(output);
                    } else {
                        outputs.appRoutes.push(output);
                        outputs.appRoutes.push({
                            ...output,
                            pathname: (0, _normalizepagepath.normalizePagePath)(output.pathname) + '.rsc',
                            id: (0, _normalizepagepath.normalizePagePath)(output.pathname) + '.rsc'
                        });
                    }
                }
            }
            const getParentOutput = (srcRoute, childRoute, allowMissing)=>{
                var _config_i18n;
                const normalizedSrcRoute = (0, _normalizelocalepath.normalizeLocalePath)(srcRoute, ((_config_i18n = config.i18n) == null ? void 0 : _config_i18n.locales) || []).pathname;
                const parentOutput = pageOutputMap[normalizedSrcRoute] || appOutputMap[normalizedSrcRoute];
                if (!parentOutput && !allowMissing) {
                    console.error({
                        appOutputs: Object.keys(appOutputMap),
                        pageOutputs: Object.keys(pageOutputMap)
                    });
                    throw Object.defineProperty(new Error(`Invariant: failed to find source route ${srcRoute} for prerender ${childRoute}`), "__NEXT_ERROR_CODE", {
                        value: "E777",
                        enumerable: false,
                        configurable: true
                    });
                }
                return parentOutput;
            };
            const { prefetchSegmentDirSuffix, prefetchSegmentSuffix, varyHeader, didPostponeHeader, contentTypeHeader: rscContentTypeHeader } = routesManifest.rsc;
            const handleAppMeta = async (route, initialOutput, meta, ctx)=>{
                if (meta.postponed && initialOutput.fallback) {
                    initialOutput.fallback.postponedState = meta.postponed;
                }
                if (meta == null ? void 0 : meta.segmentPaths) {
                    const normalizedRoute = (0, _normalizepagepath.normalizePagePath)(route);
                    const segmentsDir = _path.default.join(appDistDir, `${normalizedRoute}${prefetchSegmentDirSuffix}`);
                    // If client param parsing is enabled, we follow the same logic as
                    // the HTML allowQuery as it's already going to vary based on if
                    // there's a static shell generated or if there's fallback root
                    // params. If there are fallback root params, and we can serve a
                    // fallback, then we should follow the same logic for the segment
                    // prerenders.
                    //
                    // If client param parsing is not enabled, we have to use the
                    // allowQuery because the segment payloads will contain dynamic
                    // segment values.
                    const segmentAllowQuery = routesManifest.rsc.clientParamParsing ? ctx.htmlAllowQuery : ctx.dataAllowQuery;
                    for (const segmentPath of meta.segmentPaths){
                        var _initialOutput_fallback, _initialOutput_fallback1, _initialOutput_fallback2;
                        const outputSegmentPath = _path.default.join(normalizedRoute + prefetchSegmentDirSuffix, segmentPath) + prefetchSegmentSuffix;
                        // Only use the fallback value when the allowQuery is defined and
                        // either: (1) it is empty, meaning segments do not vary by params,
                        // or (2) client param parsing is enabled, meaning the segment
                        // payloads are safe to reuse across params.
                        const shouldAttachSegmentFallback = segmentAllowQuery && (segmentAllowQuery.length === 0 || routesManifest.rsc.clientParamParsing);
                        const fallbackPathname = shouldAttachSegmentFallback ? _path.default.join(segmentsDir, segmentPath + prefetchSegmentSuffix) : undefined;
                        outputs.prerenders.push({
                            id: outputSegmentPath,
                            pathname: outputSegmentPath,
                            type: _constants.AdapterOutputType.PRERENDER,
                            parentOutputId: initialOutput.parentOutputId,
                            groupId: initialOutput.groupId,
                            config: {
                                ...initialOutput.config,
                                bypassFor: undefined,
                                partialFallback: undefined
                            },
                            fallback: {
                                filePath: fallbackPathname,
                                postponedState: undefined,
                                initialExpiration: (_initialOutput_fallback = initialOutput.fallback) == null ? void 0 : _initialOutput_fallback.initialExpiration,
                                initialRevalidate: (_initialOutput_fallback1 = initialOutput.fallback) == null ? void 0 : _initialOutput_fallback1.initialRevalidate,
                                initialHeaders: {
                                    ...meta.headers,
                                    ...(_initialOutput_fallback2 = initialOutput.fallback) == null ? void 0 : _initialOutput_fallback2.initialHeaders,
                                    vary: varyHeader,
                                    'content-type': rscContentTypeHeader,
                                    [didPostponeHeader]: '2'
                                }
                            }
                        });
                    }
                }
            };
            let prerenderGroupId = 1;
            const getAppRouteMeta = async (route, isAppPage)=>{
                const basename = route.endsWith('/') ? `${route}index` : route;
                const meta = isAppPage ? JSON.parse(await _promises.default.readFile(_path.default.join(appDistDir, `${basename}.meta`), 'utf8').catch(()=>'{}')) : {};
                if (meta.headers) {
                    // normalize these for consistency
                    for (const key of Object.keys(meta.headers)){
                        const keyLower = key.toLowerCase();
                        let value = meta.headers[key];
                        // normalize values to strings (e.g. set-cookie can be an array)
                        if (Array.isArray(value)) {
                            value = value.join(', ');
                        } else if (typeof value !== 'string') {
                            value = String(value);
                        }
                        if (keyLower !== key) {
                            delete meta.headers[key];
                        }
                        meta.headers[keyLower] = value;
                    }
                }
                return meta;
            };
            const filePathCache = new Map();
            const cachedFilePathCheck = async (filePath)=>{
                if (filePathCache.has(filePath)) {
                    return filePathCache.get(filePath);
                }
                const newCheck = _promises.default.access(filePath).then(()=>true).catch(()=>false);
                filePathCache.set(filePath, newCheck);
                return newCheck;
            };
            for(const route in prerenderManifest.routes){
                var _routesManifest_dynamicRoutes_find;
                const { initialExpireSeconds: initialExpiration, initialRevalidateSeconds: initialRevalidate, initialHeaders, initialStatus, dataRoute, prefetchDataRoute, renderingMode, allowHeader, experimentalBypassFor } = prerenderManifest.routes[route];
                const srcRoute = prerenderManifest.routes[route].srcRoute || route;
                const srcRouteInfo = prerenderManifest.dynamicRoutes[srcRoute];
                const isAppPage = Boolean(appOutputMap[srcRoute]) || srcRoute === '/_not-found';
                // if we already have 404.html favor that instead of
                // _not-found prerender
                if (srcRoute === '/_not-found' && hasStatic404) {
                    continue;
                }
                const isNotFoundTrue = prerenderManifest.notFoundRoutes.includes(route);
                let allowQuery;
                const routeKeys = (_routesManifest_dynamicRoutes_find = routesManifest.dynamicRoutes.find((item)=>item.page === srcRoute)) == null ? void 0 : _routesManifest_dynamicRoutes_find.routeKeys;
                if (!(0, _utils1.isDynamicRoute)(route)) {
                    // for non-dynamic routes we use an empty array since
                    // no query values bust the cache for non-dynamic prerenders
                    // prerendered paths also do not pass allowQuery as they match
                    // during handle: 'filesystem' so should not cache differently
                    // by query values
                    allowQuery = [];
                } else if (routeKeys) {
                    // if we have routeKeys in the routes-manifest we use those
                    // for allowQuery for dynamic routes
                    allowQuery = Object.values(routeKeys);
                }
                let filePath = _path.default.join(isAppPage ? appDistDir : pagesDistDir, `${(0, _normalizepagepath.normalizePagePath)(route)}.${isAppPage && !dataRoute ? 'body' : 'html'}`);
                // Check if this is a static metadata route (e.g., /favicon.ico, /icon.png, /opengraph-image.png)
                // These should be output as static files, not prerenders.
                if ((0, _ismetadataroute.isStaticMetadataFile)(route)) {
                    // For static metadata from app router, check if the .body file exists
                    const staticMetadataFilePath = _path.default.join(appDistDir, `${(0, _normalizepagepath.normalizePagePath)(route)}.body`);
                    if (await cachedFilePathCheck(staticMetadataFilePath)) {
                        outputs.staticFiles.push({
                            id: route,
                            pathname: route,
                            type: _constants.AdapterOutputType.STATIC_FILE,
                            filePath: staticMetadataFilePath,
                            immutableHash: undefined
                        });
                        continue;
                    }
                }
                // we use the static 404 for notFound: true if available
                // if not we do a blocking invoke on first request
                if (isNotFoundTrue && hasStatic404) {
                    var _config_i18n2;
                    const locale = config.i18n && (0, _normalizelocalepath.normalizeLocalePath)(route, (_config_i18n2 = config.i18n) == null ? void 0 : _config_i18n2.locales).detectedLocale;
                    for (const currentFilePath of [
                        _path.default.join(pagesDistDir, locale || '', '404.html'),
                        _path.default.join(pagesDistDir, '404.html')
                    ]){
                        if (await cachedFilePathCheck(currentFilePath)) {
                            filePath = currentFilePath;
                            break;
                        }
                    }
                }
                const meta = await getAppRouteMeta(route, isAppPage);
                let htmlAllowQuery = allowQuery;
                let dataAllowQuery = allowQuery;
                const dataInitialHeaders = {};
                // We additionally vary based on if there's a postponed prerender
                // because if there isn't, then that means that we generated an
                // empty shell, and producing an empty RSC shell would be a waste.
                // If there is a postponed prerender, then the RSC shell would be
                // non-empty, and it would be valuable to also generate an empty
                // RSC shell.
                if (meta.postponed) {
                    htmlAllowQuery = [];
                    if (routesManifest.rsc.dynamicRSCPrerender) {
                        // If client param parsing is enabled, we follow the same logic as the
                        // HTML allowQuery as it's already going to vary based on if there's a
                        // static shell generated or if there's fallback root params. If there
                        // are fallback root params, and we can serve a fallback, then we
                        // should follow the same logic for the dynamic RSC routes.
                        //
                        // If client param parsing is not enabled, we have to use the
                        // allowQuery because the RSC payloads will contain dynamic segment
                        // values.
                        if (routesManifest.rsc.clientParamParsing) {
                            dataAllowQuery = htmlAllowQuery;
                        }
                    }
                }
                if (renderingMode === _renderingmode.RenderingMode.PARTIALLY_STATIC) {
                    // Dynamic RSC requests cannot be cached, so we explicity set it
                    // here to ensure that the response is not cached by the browser.
                    dataInitialHeaders['cache-control'] = 'private, no-store, no-cache, max-age=0, must-revalidate';
                }
                const initialOutput = {
                    id: route,
                    type: _constants.AdapterOutputType.PRERENDER,
                    pathname: route,
                    parentOutputId: srcRoute === '/_not-found' ? srcRoute : getParentOutput(srcRoute, route).id,
                    groupId: prerenderGroupId,
                    pprChain: isAppPage && renderingMode === _renderingmode.RenderingMode.PARTIALLY_STATIC ? {
                        headers: {
                            [_constants1.NEXT_RESUME_HEADER]: '1'
                        }
                    } : undefined,
                    parentFallbackMode: srcRouteInfo == null ? void 0 : srcRouteInfo.fallback,
                    fallback: !isNotFoundTrue || isNotFoundTrue && hasStatic404 ? {
                        filePath,
                        postponedState: undefined,
                        initialStatus: initialStatus ?? meta.status ?? (isNotFoundTrue ? 404 : undefined),
                        initialHeaders: {
                            ...initialHeaders,
                            vary: varyHeader,
                            'content-type': _constants1.HTML_CONTENT_TYPE_HEADER,
                            ...meta.headers
                        },
                        initialExpiration,
                        initialRevalidate: typeof initialRevalidate === 'undefined' ? 1 : initialRevalidate
                    } : undefined,
                    config: {
                        allowQuery,
                        allowHeader,
                        renderingMode,
                        bypassFor: isAppPage && srcRoute !== '/_not-found' ? experimentalBypassFor : undefined,
                        bypassToken: prerenderManifest.preview.previewModeId
                    }
                };
                outputs.prerenders.push(initialOutput);
                if (!isAppPage && appPageKeys && appPageKeys.length > 0) {
                    const rscPage = `${route === '/' ? '/index' : route}.rsc`;
                    outputs.staticFiles.push({
                        id: rscPage,
                        pathname: rscPage,
                        type: _constants.AdapterOutputType.STATIC_FILE,
                        filePath: rscFallbackPath,
                        immutableHash: undefined
                    });
                }
                if (dataRoute) {
                    let dataFilePath = _path.default.join(pagesDistDir, `${(0, _normalizepagepath.normalizePagePath)(route)}.json`);
                    let postponed = meta.postponed;
                    const dataRouteToUse = renderingMode === _renderingmode.RenderingMode.PARTIALLY_STATIC && prefetchDataRoute ? prefetchDataRoute : dataRoute;
                    if (isAppPage) {
                        var _this;
                        // When experimental PPR is enabled, we expect that the data
                        // that should be served as a part of the prerender should
                        // be from the prefetch data route. If this isn't enabled
                        // for ppr, the only way to get the data is from the data
                        // route.
                        dataFilePath = _path.default.join(appDistDir, (_this = dataRouteToUse ?? dataRoute) == null ? void 0 : _this.replace(/^\//, ''));
                    }
                    if (renderingMode === _renderingmode.RenderingMode.PARTIALLY_STATIC && !await cachedFilePathCheck(dataFilePath)) {
                        var _initialOutput_fallback;
                        outputs.prerenders.push({
                            ...initialOutput,
                            id: dataRoute,
                            pathname: dataRoute,
                            fallback: {
                                ...initialOutput.fallback,
                                postponedState: postponed,
                                initialStatus: undefined,
                                initialHeaders: {
                                    ...(_initialOutput_fallback = initialOutput.fallback) == null ? void 0 : _initialOutput_fallback.initialHeaders,
                                    ...dataInitialHeaders,
                                    'content-type': isAppPage ? rscContentTypeHeader : _constants1.JSON_CONTENT_TYPE_HEADER
                                },
                                filePath: undefined
                            }
                        });
                    } else {
                        var _initialOutput_fallback1;
                        outputs.prerenders.push({
                            ...initialOutput,
                            id: dataRoute,
                            pathname: dataRoute,
                            fallback: isNotFoundTrue ? undefined : {
                                ...initialOutput.fallback,
                                initialStatus: undefined,
                                initialHeaders: {
                                    ...(_initialOutput_fallback1 = initialOutput.fallback) == null ? void 0 : _initialOutput_fallback1.initialHeaders,
                                    ...dataInitialHeaders,
                                    'content-type': isAppPage ? rscContentTypeHeader : _constants1.JSON_CONTENT_TYPE_HEADER
                                },
                                postponedState: undefined,
                                filePath: dataFilePath
                            }
                        });
                    }
                }
                if (isAppPage) {
                    await handleAppMeta(route, initialOutput, meta, {
                        htmlAllowQuery,
                        dataAllowQuery
                    });
                }
                prerenderGroupId += 1;
            }
            for(const dynamicRoute in prerenderManifest.dynamicRoutes){
                var _routesManifest_dynamicRoutes_find1;
                const { fallback, fallbackExpire, fallbackRevalidate, fallbackHeaders, fallbackStatus, fallbackSourceRoute, fallbackRootParams, remainingPrerenderableParams, allowHeader, dataRoute, renderingMode, experimentalBypassFor } = prerenderManifest.dynamicRoutes[dynamicRoute];
                const srcRoute = fallbackSourceRoute || dynamicRoute;
                const parentOutput = getParentOutput(srcRoute, dynamicRoute);
                const isAppPage = Boolean(appOutputMap[srcRoute]);
                const meta = await getAppRouteMeta(dynamicRoute, isAppPage);
                const routeKeys = ((_routesManifest_dynamicRoutes_find1 = routesManifest.dynamicRoutes.find((item)=>item.page === dynamicRoute)) == null ? void 0 : _routesManifest_dynamicRoutes_find1.routeKeys) || {};
                const allowQuery = Object.values(routeKeys);
                const partialFallbacksEnabled = config.experimental.partialFallbacks === true;
                const partialFallback = partialFallbacksEnabled && isAppPage && remainingPrerenderableParams !== undefined && remainingPrerenderableParams.length > 0 && renderingMode === _renderingmode.RenderingMode.PARTIALLY_STATIC && typeof fallback === 'string' && Boolean(meta.postponed);
                // Today, consumers of this build output can only upgrade a fallback shell
                // when all remaining route params become concrete in the upgraded entry.
                // They cannot yet represent intermediate shells like `/[foo]/[bar] -> /foo/[bar]`,
                // because we do not emit which fallback params should remain deferred after
                // the upgrade. Until that contract exists, only emit `partialFallback` for
                // the conservative case where the upgraded entry can become fully concrete.
                const canEmitPartialFallback = partialFallback && (fallbackRootParams == null ? void 0 : fallbackRootParams.length) === 0 && allowQuery.length === (remainingPrerenderableParams == null ? void 0 : remainingPrerenderableParams.length);
                let htmlAllowQuery = allowQuery;
                // We only want to vary on the shell contents if there is a fallback
                // present and able to be served.
                if (typeof fallback === 'string') {
                    if (fallbackRootParams && fallbackRootParams.length > 0) {
                        htmlAllowQuery = fallbackRootParams;
                    } else if (meta.postponed) {
                        // If there's postponed fallback content, we usually collapse to a shared shell (`[]`).
                        // For opt-in partial fallbacks in cache components, keep only the
                        // params that can still complete this shell.
                        const remainingPrerenderableQueryKeys = new Set((remainingPrerenderableParams ?? []).map((param)=>`${_constants1.NEXT_QUERY_PARAM_PREFIX}${param.paramName}`));
                        htmlAllowQuery = canEmitPartialFallback && routesManifest.rsc.clientParamParsing ? Object.values(routeKeys).filter((routeKey)=>remainingPrerenderableQueryKeys.has(routeKey)) : [];
                    }
                }
                const initialOutput = {
                    id: dynamicRoute,
                    type: _constants.AdapterOutputType.PRERENDER,
                    pathname: dynamicRoute,
                    parentOutputId: parentOutput.id,
                    groupId: prerenderGroupId,
                    pprChain: isAppPage && renderingMode === _renderingmode.RenderingMode.PARTIALLY_STATIC ? {
                        headers: {
                            [_constants1.NEXT_RESUME_HEADER]: '1'
                        }
                    } : undefined,
                    fallback: typeof fallback === 'string' ? {
                        filePath: _path.default.join(isAppPage ? appDistDir : pagesDistDir, // app router dynamic route fallbacks don't have the
                        // extension so ensure it's added here
                        fallback.endsWith('.html') ? fallback : `${fallback}.html`),
                        postponedState: undefined,
                        initialStatus: fallbackStatus ?? meta.status,
                        initialHeaders: {
                            ...fallbackHeaders,
                            ...(appPageKeys == null ? void 0 : appPageKeys.length) ? {
                                vary: varyHeader
                            } : {},
                            'content-type': _constants1.HTML_CONTENT_TYPE_HEADER,
                            ...meta.headers
                        },
                        initialExpiration: fallbackExpire,
                        initialRevalidate: fallbackRevalidate ?? 1
                    } : undefined,
                    config: {
                        allowQuery: htmlAllowQuery,
                        allowHeader,
                        renderingMode,
                        partialFallback: canEmitPartialFallback || undefined,
                        bypassFor: isAppPage ? experimentalBypassFor : undefined,
                        bypassToken: prerenderManifest.preview.previewModeId
                    }
                };
                if (!config.i18n || isAppPage) {
                    outputs.prerenders.push(initialOutput);
                    if (!isAppPage && fallback !== false && appPageKeys && appPageKeys.length > 0) {
                        const rscPage = `${srcRoute === '/' ? '/index' : srcRoute}.rsc`;
                        outputs.staticFiles.push({
                            id: rscPage,
                            pathname: rscPage,
                            type: _constants.AdapterOutputType.STATIC_FILE,
                            filePath: rscFallbackPath,
                            immutableHash: undefined
                        });
                    }
                    let dataAllowQuery = allowQuery;
                    const dataInitialHeaders = {};
                    if (meta.postponed && routesManifest.rsc.dynamicRSCPrerender) {
                        // If client param parsing is enabled, we follow the same logic as the
                        // HTML allowQuery as it's already going to vary based on if there's a
                        // static shell generated or if there's fallback root params. If there
                        // are fallback root params, and we can serve a fallback, then we
                        // should follow the same logic for the dynamic RSC routes.
                        //
                        // If client param parsing is not enabled, we have to use the
                        // allowQuery because the RSC payloads will contain dynamic segment
                        // values.
                        if (routesManifest.rsc.clientParamParsing) {
                            dataAllowQuery = htmlAllowQuery;
                        }
                    }
                    if (renderingMode === _renderingmode.RenderingMode.PARTIALLY_STATIC) {
                        // Dynamic RSC requests cannot be cached, so we explicity set it
                        // here to ensure that the response is not cached by the browser.
                        dataInitialHeaders['cache-control'] = 'private, no-store, no-cache, max-age=0, must-revalidate';
                    }
                    if (isAppPage) {
                        await handleAppMeta(dynamicRoute, initialOutput, meta, {
                            htmlAllowQuery,
                            dataAllowQuery
                        });
                    }
                    if (renderingMode === _renderingmode.RenderingMode.PARTIALLY_STATIC) {
                        var _initialOutput_fallback2;
                        outputs.prerenders.push({
                            ...initialOutput,
                            id: `${dynamicRoute}.rsc`,
                            pathname: `${dynamicRoute}.rsc`,
                            fallback: {
                                ...initialOutput.fallback,
                                filePath: undefined,
                                postponedState: meta.postponed,
                                initialStatus: undefined,
                                initialHeaders: {
                                    ...(_initialOutput_fallback2 = initialOutput.fallback) == null ? void 0 : _initialOutput_fallback2.initialHeaders,
                                    ...dataInitialHeaders,
                                    'content-type': isAppPage ? rscContentTypeHeader : _constants1.JSON_CONTENT_TYPE_HEADER
                                }
                            },
                            config: {
                                ...initialOutput.config,
                                allowQuery: dataAllowQuery,
                                partialFallback: undefined
                            }
                        });
                    } else if (dataRoute) {
                        outputs.prerenders.push({
                            ...initialOutput,
                            id: dataRoute,
                            pathname: dataRoute,
                            fallback: undefined,
                            config: {
                                ...initialOutput.config,
                                partialFallback: undefined
                            }
                        });
                    }
                    prerenderGroupId += 1;
                } else {
                    for (const locale of config.i18n.locales){
                        const currentOutput = {
                            ...initialOutput,
                            pathname: _path.default.posix.join(`/${locale}`, initialOutput.pathname),
                            id: _path.default.posix.join(`/${locale}`, initialOutput.id),
                            fallback: typeof fallback === 'string' ? {
                                ...initialOutput.fallback,
                                initialStatus: undefined,
                                postponedState: undefined,
                                filePath: _path.default.join(pagesDistDir, locale, // app router dynamic route fallbacks don't have the
                                // extension so ensure it's added here
                                fallback.endsWith('.html') ? fallback : `${fallback}.html`)
                            } : undefined,
                            groupId: prerenderGroupId
                        };
                        outputs.prerenders.push(currentOutput);
                        if (!isAppPage && fallback !== false && appPageKeys && appPageKeys.length > 0) {
                            const rscPage = `${_path.default.posix.join(`/${locale}`, initialOutput.pathname)}.rsc`;
                            outputs.staticFiles.push({
                                id: rscPage,
                                pathname: rscPage,
                                type: _constants.AdapterOutputType.STATIC_FILE,
                                filePath: rscFallbackPath,
                                immutableHash: undefined
                            });
                        }
                        if (dataRoute) {
                            const dataPathname = _path.default.posix.join(`/_next/data`, buildId, locale, dynamicRoute + '.json');
                            outputs.prerenders.push({
                                ...initialOutput,
                                id: dataPathname,
                                pathname: dataPathname,
                                // data route doesn't have skeleton fallback
                                fallback: undefined,
                                config: {
                                    ...initialOutput.config,
                                    partialFallback: undefined
                                },
                                groupId: prerenderGroupId
                            });
                        }
                        prerenderGroupId += 1;
                    }
                }
            }
            // ensure 404
            const staticErrorDocs = [
                ...hasStatic404 ? [
                    '/404'
                ] : [],
                ...hasStatic500 ? [
                    '/500'
                ] : []
            ];
            for (const errorDoc of staticErrorDocs){
                var _config_i18n3;
                const errorDocPath = _path.default.posix.join('/', ((_config_i18n3 = config.i18n) == null ? void 0 : _config_i18n3.defaultLocale) || '', errorDoc);
                if (!prerenderManifest.routes[errorDocPath]) {
                    var _config_i18n_locales1, _config_i18n4;
                    for (const currentDocPath of [
                        errorDocPath,
                        ...((_config_i18n4 = config.i18n) == null ? void 0 : (_config_i18n_locales1 = _config_i18n4.locales) == null ? void 0 : _config_i18n_locales1.map((locale)=>_path.default.posix.join('/', locale, errorDoc))) || []
                    ]){
                        const currentFilePath = _path.default.join(pagesDistDir, `${currentDocPath}.html`);
                        if (await cachedFilePathCheck(currentFilePath)) {
                            outputs.staticFiles.push({
                                pathname: currentDocPath,
                                id: currentDocPath,
                                type: _constants.AdapterOutputType.STATIC_FILE,
                                filePath: currentFilePath,
                                immutableHash: undefined
                            });
                        }
                    }
                }
            }
        }
        normalizePathnames(config, outputs);
        const dynamicRoutes = [];
        const dynamicDataRoutes = [];
        const dynamicSegmentRoutes = [];
        const getDestinationQuery = (routeKeys)=>{
            const items = Object.entries(routeKeys ?? {});
            if (items.length === 0) return '';
            return '?' + items.map(([key, value])=>`${value}=$${key}`).join('&');
        };
        const fallbackFalseHasCondition = [
            {
                type: 'cookie',
                key: '__prerender_bypass',
                value: prerenderManifest.preview.previewModeId
            },
            {
                type: 'cookie',
                key: '__next_preview_data'
            }
        ];
        for (const route of routesManifest.dynamicRoutes){
            var _prerenderManifest_dynamicRoutes_route_page;
            const shouldLocalize = config.i18n;
            const routeRegex = (0, _routeregex.getNamedRouteRegex)(route.page, {
                prefixRouteKeys: true
            });
            const isFallbackFalse = ((_prerenderManifest_dynamicRoutes_route_page = prerenderManifest.dynamicRoutes[route.page]) == null ? void 0 : _prerenderManifest_dynamicRoutes_route_page.fallback) === false;
            const { hasFallbackRootParams } = route;
            const sourceRegex = routeRegex.namedRegex.replace('^', `^${config.basePath && config.basePath !== '/' ? _path.default.posix.join('/', config.basePath || '') : ''}[/]?${shouldLocalize ? '(?<nextLocale>[^/]{1,})' : ''}`);
            const destination = _path.default.posix.join('/', config.basePath, shouldLocalize ? '/$nextLocale' : '', route.page) + getDestinationQuery(route.routeKeys);
            if (appPageKeys && appPageKeys.length > 0) {
                // If we have fallback root params (implying we've already
                // emitted a rewrite for the /_tree request), or if the route
                // has PPR enabled and client param parsing is enabled, then
                // we don't need to include any other suffixes.
                const shouldSkipSuffixes = hasFallbackRootParams;
                dynamicRoutes.push({
                    source: route.page + '.rsc',
                    sourceRegex: sourceRegex.replace(new RegExp((0, _escaperegexp.escapeStringRegexp)('(?:/)?$')), // Now than the upstream issues has been resolved, we can safely
                    // add the suffix back, this resolves a bug related to segment
                    // rewrites not capturing the correct suffix values when
                    // enabled.
                    shouldSkipSuffixes ? '(?<rscSuffix>\\.rsc|\\.segments/.+\\.segment\\.rsc)(?:/)?$' : '(?<rscSuffix>\\.rsc|\\.segments/.+\\.segment\\.rsc)(?:/)?$'),
                    destination: destination == null ? void 0 : destination.replace(/($|\?)/, '$rscSuffix$1'),
                    has: isFallbackFalse && !pageKeys.includes(route.page) ? fallbackFalseHasCondition : undefined,
                    missing: undefined
                });
            }
            // needs basePath and locale handling if pages router
            dynamicRoutes.push({
                source: route.page,
                sourceRegex,
                destination,
                has: isFallbackFalse ? fallbackFalseHasCondition : undefined,
                missing: undefined
            });
            for (const segmentRoute of route.prefetchSegmentDataRoutes || []){
                dynamicSegmentRoutes.push({
                    source: route.page,
                    sourceRegex: segmentRoute.source.replace('^', `^${config.basePath && config.basePath !== '/' ? _path.default.posix.join('/', config.basePath || '') : ''}[/]?`),
                    destination: _path.default.posix.join('/', config.basePath, segmentRoute.destination + getDestinationQuery(segmentRoute.routeKeys)),
                    has: undefined,
                    missing: undefined
                });
            }
        }
        const needsMiddlewareResolveRoutes = outputs.middleware && outputs.pages.length > 0;
        const dataRoutePages = new Set([
            ...routesManifest.dataRoutes.map((item)=>item.page)
        ]);
        const sortedDataPages = (0, _sortableroutes.sortSortableRoutes)([
            ...needsMiddlewareResolveRoutes ? [
                ...staticPages
            ].map((page)=>({
                    sourcePage: page,
                    page
                })) : [],
            ...routesManifest.dataRoutes.map((item)=>({
                    sourcePage: item.page,
                    page: item.page
                }))
        ]);
        for (const { page } of sortedDataPages){
            if (needsMiddlewareResolveRoutes || (0, _utils1.isDynamicRoute)(page)) {
                var _prerenderManifest_dynamicRoutes_page;
                const shouldLocalize = config.i18n;
                const isFallbackFalse = ((_prerenderManifest_dynamicRoutes_page = prerenderManifest.dynamicRoutes[page]) == null ? void 0 : _prerenderManifest_dynamicRoutes_page.fallback) === false;
                const routeRegex = (0, _routeregex.getNamedRouteRegex)(page + '.json', {
                    prefixRouteKeys: true,
                    includeSuffix: true
                });
                const isDataRoute = dataRoutePages.has(page);
                const destination = _path.default.posix.join('/', config.basePath, ...isDataRoute ? [
                    `_next/data`,
                    buildId
                ] : '', ...page === '/' ? [
                    shouldLocalize ? '$nextLocale.json' : 'index.json'
                ] : [
                    shouldLocalize ? '$nextLocale' : '',
                    page + (isDataRoute ? '.json' : '') + getDestinationQuery(routeRegex.routeKeys || {})
                ]);
                dynamicDataRoutes.push({
                    source: page,
                    sourceRegex: shouldLocalize && page === '/' ? '^' + _path.default.posix.join('/', config.basePath, '_next/data', (0, _escaperegexp.escapeStringRegexp)(buildId), '(?<nextLocale>[^/]{1,}).json') : routeRegex.namedRegex.replace('^', `^${_path.default.posix.join('/', config.basePath, `_next/data`, (0, _escaperegexp.escapeStringRegexp)(buildId))}[/]?${shouldLocalize ? '(?<nextLocale>[^/]{1,})' : ''}`),
                    destination,
                    has: isFallbackFalse ? fallbackFalseHasCondition : undefined,
                    missing: undefined
                });
            }
        }
        const buildRewriteItem = (route)=>{
            const converted = (0, _routingutils.convertRewrites)([
                route
            ], [
                'nextInternalLocale'
            ])[0];
            const regex = converted.src || route.regex;
            return {
                source: route.source,
                sourceRegex: route.internal ? regex : (0, _redirectstatus.modifyRouteRegex)(regex),
                destination: converted.dest || route.destination,
                has: route.has,
                missing: route.missing
            };
        };
        const buildRouteFromHeader = (route)=>{
            const converted = (0, _routingutils.convertHeaders)([
                route
            ])[0];
            const regex = converted.src || route.regex;
            return {
                source: route.source,
                sourceRegex: route.internal ? regex : (0, _redirectstatus.modifyRouteRegex)(regex),
                headers: 'headers' in converted ? converted.headers || {} : {},
                has: route.has,
                missing: route.missing,
                priority: route.internal || undefined
            };
        };
        try {
            _log.info(`Running onBuildComplete from ${adapterMod.name}`);
            const combinedDynamicRoutes = [
                ...dynamicDataRoutes,
                ...dynamicSegmentRoutes,
                ...dynamicRoutes
            ];
            const rewrites = {
                beforeFiles: routesManifest.rewrites.beforeFiles.map(buildRewriteItem),
                afterFiles: routesManifest.rewrites.afterFiles.map(buildRewriteItem),
                fallback: routesManifest.rewrites.fallback.map(buildRewriteItem)
            };
            const redirects = routesManifest.redirects.map((route)=>{
                const converted = (0, _routingutils.convertRedirects)([
                    route
                ], 307)[0];
                const regex = converted.src || route.regex;
                return {
                    source: route.source,
                    sourceRegex: route.internal ? regex : (0, _redirectstatus.modifyRouteRegex)(regex),
                    headers: 'headers' in converted ? converted.headers || {} : {},
                    status: converted.status || (0, _redirectstatus.getRedirectStatus)(route),
                    has: route.has,
                    missing: route.missing,
                    priority: route.internal || undefined
                };
            });
            const headers = routesManifest.headers.map((route)=>buildRouteFromHeader(route));
            const onMatchHeaders = routesManifest.onMatchHeaders.map((route)=>buildRouteFromHeader(route));
            await adapterMod.onBuildComplete({
                routing: {
                    beforeMiddleware: [
                        ...headers,
                        ...redirects
                    ],
                    beforeFiles: rewrites.beforeFiles,
                    afterFiles: rewrites.afterFiles,
                    dynamicRoutes: combinedDynamicRoutes,
                    onMatch: [
                        {
                            // This ensures we only match known emitted-by-Next.js files and not
                            // user-emitted files which may be missing a hash in their filename.
                            sourceRegex: `${_path.default.posix.join(config.basePath || '/', '_next/static', `/(?:[^/]+/pages|pages|chunks|runtime|css|image|media|${(0, _escaperegexp.escapeStringRegexp)(buildId)})/.+`)}`,
                            // Next.js assets contain a hash or entropy in their filenames, so they
                            // are guaranteed to be unique and cacheable indefinitely.
                            headers: {
                                'cache-control': `public,max-age=${_constants1.CACHE_ONE_YEAR_SECONDS},immutable`
                            }
                        },
                        ...onMatchHeaders
                    ],
                    fallback: rewrites.fallback,
                    shouldNormalizeNextData: !!needsMiddlewareResolveRoutes,
                    rsc: (0, _generateroutesmanifest.generateRoutesManifest)({
                        appType,
                        pageKeys: {
                            pages: pageKeys,
                            app: appPageKeys
                        },
                        config,
                        redirects: [],
                        headers: [],
                        onMatchHeaders: [],
                        rewrites,
                        restrictedRedirectPaths: [],
                        isAppPPREnabled: config.cacheComponents
                    }).routesManifest.rsc
                },
                outputs,
                config,
                distDir,
                buildId,
                nextVersion,
                projectDir: dir,
                repoRoot: tracingRoot
            });
        } catch (err) {
            _log.error(`Failed to run onBuildComplete from ${adapterMod.name}`);
            throw err;
        }
    }
}

//# sourceMappingURL=build-complete.js.map