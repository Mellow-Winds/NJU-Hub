import * as Log from './output/log';
import { Worker } from '../lib/worker';
import createSpinner from './spinner';
import { eventTypeCheckCompleted } from '../telemetry/events';
import isError from '../lib/is-error';
import { hrtimeDurationToString } from './duration-to-string';
/**
 * typescript will be loaded in "next/lib/verify-typescript-setup" and
 * then passed to "next/lib/typescript/runTypeCheck" as a parameter.
 *
 * Since it is impossible to pass a function from main thread to a worker,
 * instead of running "next/lib/typescript/runTypeCheck" in a worker,
 * we will run entire "next/lib/verify-typescript-setup" in a worker instead.
 */ function verifyAndRunTypeScript(dir, distDir, strictRouteTypes, shouldRunTypeCheck, tsconfigPath, typedRoutes, disableStaticImages, cacheDir, enableWorkerThreads, hasAppDir, hasPagesDir, appDir, pagesDir, debugBuildPaths) {
    let impl;
    let typeCheckWorker;
    if (shouldRunTypeCheck) {
        typeCheckWorker = new Worker(require.resolve('../lib/verify-typescript-setup'), {
            exposedMethods: [
                'verifyAndRunTypeScript'
            ],
            debuggerPortOffset: -1,
            isolatedMemory: false,
            numWorkers: 1,
            enableWorkerThreads,
            maxRetries: 0
        });
        impl = typeCheckWorker.verifyAndRunTypeScript;
    } else {
        // When not running typecheck, just run the implementation in-process without spawning a worker,
        // to avoid the overhead of the worker.
        impl = require('../lib/verify-typescript-setup').verifyAndRunTypeScript;
    }
    return impl({
        dir,
        distDir,
        strictRouteTypes,
        shouldRunTypeCheck,
        tsconfigPath,
        typedRoutes,
        disableStaticImages,
        cacheDir,
        hasAppDir,
        hasPagesDir,
        appDir,
        pagesDir,
        debugBuildPaths
    }).then((result)=>{
        typeCheckWorker == null ? void 0 : typeCheckWorker.end();
        return result;
    }).catch(()=>{
        // The error is already logged in the worker, we simply exit the main thread to prevent the
        // `Jest worker encountered 1 child process exceptions, exceeding retry limit` from showing up
        process.exit(1);
    });
}
export async function startTypeChecking({ cacheDir, config, dir, nextBuildSpan, pagesDir, telemetry, appDir, debugBuildPaths }) {
    const ignoreTypeScriptErrors = Boolean(config.typescript.ignoreBuildErrors);
    if (ignoreTypeScriptErrors) {
        Log.info('Skipping validation of types');
    }
    let typeCheckingSpinnerPrefixText;
    let typeCheckingSpinner;
    if (!ignoreTypeScriptErrors) {
        typeCheckingSpinnerPrefixText = 'Running TypeScript';
    }
    if (typeCheckingSpinnerPrefixText) {
        typeCheckingSpinner = createSpinner(typeCheckingSpinnerPrefixText);
    }
    const typeCheckAndLintStart = process.hrtime();
    try {
        var _createSpinner;
        const [verifyResult, typeCheckEnd] = await nextBuildSpan.traceChild('run-typescript').traceAsyncFn(()=>verifyAndRunTypeScript(dir, config.distDir, Boolean(config.experimental.strictRouteTypes), !ignoreTypeScriptErrors, config.typescript.tsconfigPath, Boolean(config.typedRoutes), config.images.disableStaticImages, cacheDir, config.experimental.workerThreads, !!appDir, !!pagesDir, appDir, pagesDir, debugBuildPaths).then((resolved)=>{
                const checkEnd = process.hrtime(typeCheckAndLintStart);
                return [
                    resolved,
                    checkEnd
                ];
            }));
        if (typeCheckingSpinner) {
            typeCheckingSpinner.stop();
        }
        (_createSpinner = createSpinner(`Finished TypeScript${ignoreTypeScriptErrors ? ' config validation' : ''} in ${hrtimeDurationToString(typeCheckEnd)}`)) == null ? void 0 : _createSpinner.stopAndPersist();
        if (!ignoreTypeScriptErrors && verifyResult) {
            var _verifyResult_result, _verifyResult_result1, _verifyResult_result2;
            telemetry.record(eventTypeCheckCompleted({
                durationInSeconds: typeCheckEnd[0],
                typescriptVersion: verifyResult.version,
                inputFilesCount: (_verifyResult_result = verifyResult.result) == null ? void 0 : _verifyResult_result.inputFilesCount,
                totalFilesCount: (_verifyResult_result1 = verifyResult.result) == null ? void 0 : _verifyResult_result1.totalFilesCount,
                incremental: (_verifyResult_result2 = verifyResult.result) == null ? void 0 : _verifyResult_result2.incremental
            }));
        }
    } catch (err) {
        // prevent showing jest-worker internal error as it
        // isn't helpful for users and clutters output
        if (isError(err) && err.message === 'Call retries were exceeded') {
            await telemetry.flush();
            process.exit(1);
        }
        throw err;
    }
}

//# sourceMappingURL=type-check.js.map