import { bold, cyan } from '../picocolors';
import os from 'os';
import path from 'path';
import semver from 'next/dist/compiled/semver';
import { FatalError } from '../fatal-error';
import isError from '../is-error';
function resolvePathAliasTarget(baseUrl, target) {
    if (path.isAbsolute(target) || target.startsWith('./') || target.startsWith('../')) {
        return target;
    }
    if (baseUrl === '.' || baseUrl === './') {
        return `./${target}`;
    }
    const resolvedTarget = path.join(baseUrl, target);
    if (path.isAbsolute(resolvedTarget) || resolvedTarget.startsWith('./') || resolvedTarget.startsWith('../')) {
        return resolvedTarget;
    }
    return `./${resolvedTarget}`;
}
function rewritePathAliasesWithoutBaseUrl(baseUrl, originalPaths) {
    const rewrittenPaths = originalPaths && typeof originalPaths === 'object' ? Object.fromEntries(Object.entries(originalPaths).map(([key, values])=>[
            key,
            Array.isArray(values) ? values.map((value)=>typeof value === 'string' ? resolvePathAliasTarget(baseUrl, value) : value) : values
        ])) : {
        '*': [
            resolvePathAliasTarget(baseUrl, '*')
        ]
    };
    if (!Object.prototype.hasOwnProperty.call(rewrittenPaths, '*')) {
        rewrittenPaths['*'] = [
            resolvePathAliasTarget(baseUrl, '*')
        ];
    }
    return rewrittenPaths;
}
function getNormalizedBaseUrlForPaths(baseUrl, tsConfigPath) {
    const tsConfigDir = path.resolve(path.dirname(tsConfigPath));
    const absoluteBaseUrl = path.isAbsolute(baseUrl) ? baseUrl : baseUrl.startsWith('./') || baseUrl.startsWith('../') ? path.resolve(tsConfigDir, baseUrl) : path.resolve(baseUrl);
    const relativeBaseUrl = path.relative(tsConfigDir, absoluteBaseUrl);
    return relativeBaseUrl || '.';
}
export async function getTypeScriptConfiguration(typescript, tsConfigPath, metaOnly) {
    try {
        var _result_errors;
        const formatDiagnosticsHost = {
            getCanonicalFileName: (fileName)=>fileName,
            getCurrentDirectory: typescript.sys.getCurrentDirectory,
            getNewLine: ()=>os.EOL
        };
        const { config, error } = typescript.readConfigFile(tsConfigPath, typescript.sys.readFile);
        if (error) {
            throw Object.defineProperty(new FatalError(typescript.formatDiagnostic(error, formatDiagnosticsHost)), "__NEXT_ERROR_CODE", {
                value: "E394",
                enumerable: false,
                configurable: true
            });
        }
        let configToParse = config;
        if (semver.gte(typescript.version, '6.0.0')) {
            var _configToParse_compilerOptions, _configToParse_compilerOptions1;
            const target = (_configToParse_compilerOptions = configToParse.compilerOptions) == null ? void 0 : _configToParse_compilerOptions.target;
            if (typeof target === 'string' && (target.toLowerCase() === 'es3' || target.toLowerCase() === 'es5')) {
                const { target: _target, ...restCompilerOptions } = configToParse.compilerOptions ?? {};
                // TypeScript 6 deprecates ES3/ES5 targets. Rewrite deprecated
                // targets in-memory to keep typechecking working without requiring
                // `ignoreDeprecations`.
                configToParse = {
                    ...configToParse,
                    compilerOptions: {
                        ...restCompilerOptions,
                        target: 'es2015'
                    }
                };
            }
            const baseUrl = (_configToParse_compilerOptions1 = configToParse.compilerOptions) == null ? void 0 : _configToParse_compilerOptions1.baseUrl;
            const hasBaseUrl = typeof baseUrl === 'string' && baseUrl.length > 0;
            if (hasBaseUrl) {
                var _configToParse_compilerOptions2;
                const rewrittenPaths = rewritePathAliasesWithoutBaseUrl(baseUrl, (_configToParse_compilerOptions2 = configToParse.compilerOptions) == null ? void 0 : _configToParse_compilerOptions2.paths);
                const { baseUrl: _baseUrl, ...restCompilerOptions } = configToParse.compilerOptions ?? {};
                // TypeScript 6 deprecates `baseUrl`; rewrite aliases to explicit
                // relative paths so path mapping still works without this option.
                configToParse = {
                    ...configToParse,
                    compilerOptions: {
                        ...restCompilerOptions,
                        paths: rewrittenPaths
                    }
                };
            }
        }
        const result = typescript.parseJsonConfigFileContent(configToParse, // When only interested in meta info,
        // avoid enumerating all files (for performance reasons)
        metaOnly ? {
            ...typescript.sys,
            readDirectory (_path, extensions, _excludes, _includes, _depth) {
                return [
                    extensions ? `file${extensions[0]}` : `file.ts`
                ];
            }
        } : typescript.sys, path.dirname(tsConfigPath));
        if (semver.gte(typescript.version, '6.0.0')) {
            const parsedBaseUrl = result.options.baseUrl;
            if (typeof parsedBaseUrl === 'string' && parsedBaseUrl.length > 0) {
                const normalizedBaseUrl = getNormalizedBaseUrlForPaths(parsedBaseUrl, tsConfigPath);
                // `baseUrl` can come from extended tsconfigs. Rewrite paths from the
                // fully-resolved baseUrl and remove it so TS6 deprecation checks do not
                // fail type checking.
                result.options.paths = rewritePathAliasesWithoutBaseUrl(normalizedBaseUrl, result.options.paths);
                delete result.options.baseUrl;
            }
        }
        if (result.errors) {
            result.errors = result.errors.filter(({ code })=>// No inputs were found in config file
                code !== 18003);
        }
        if ((_result_errors = result.errors) == null ? void 0 : _result_errors.length) {
            throw Object.defineProperty(new FatalError(typescript.formatDiagnostic(result.errors[0], formatDiagnosticsHost)), "__NEXT_ERROR_CODE", {
                value: "E394",
                enumerable: false,
                configurable: true
            });
        }
        return result;
    } catch (err) {
        if (isError(err) && err.name === 'SyntaxError') {
            const reason = '\n' + (err.message ?? '');
            throw Object.defineProperty(new FatalError(bold('Could not parse' + cyan('tsconfig.json') + '.' + ' Please make sure it contains syntactically correct JSON.') + reason), "__NEXT_ERROR_CODE", {
                value: "E1023",
                enumerable: false,
                configurable: true
            });
        }
        throw err;
    }
}

//# sourceMappingURL=getTypeScriptConfiguration.js.map