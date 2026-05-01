import { loadEnvConfig } from '@next/env';
import * as inspector from 'inspector';
import * as Log from '../../build/output/log';
import { bold, purple, strikethrough } from '../../lib/picocolors';
import { experimentalSchema } from '../config-schema';
/**
 * Logs basic startup info that doesn't require config.
 * Called before "Ready in X" to show immediate feedback.
 */ export function logStartInfo({ networkUrl, appUrl, envInfo, logBundler }) {
    let versionSuffix = '';
    const parts = [];
    if (logBundler) {
        if (process.env.TURBOPACK) {
            parts.push('Turbopack');
        } else if (process.env.NEXT_RSPACK) {
            parts.push('Rspack');
        } else {
            parts.push('webpack');
        }
    }
    if (parts.length > 0) {
        versionSuffix = ` (${parts.join(', ')})`;
    }
    Log.bootstrap(`${bold(purple(`${Log.prefixes.ready} Next.js ${"16.2.4"}`))}${versionSuffix}`);
    if (appUrl) {
        Log.bootstrap(`- Local:         ${appUrl}`);
    }
    if (networkUrl) {
        Log.bootstrap(`- Network:       ${networkUrl}`);
    }
    const inspectorUrl = inspector.url();
    if (inspectorUrl) {
        // Could also parse this port from the inspector URL.
        // process.debugPort will always be defined even if the process is not being inspected.
        // The full URL seems noisy as far as I can tell.
        // Node.js will print the full URL anyway.
        const debugPort = process.debugPort;
        Log.bootstrap(`- Debugger port: ${debugPort}`);
    }
    if (envInfo == null ? void 0 : envInfo.length) Log.bootstrap(`- Environments: ${envInfo.join(', ')}`);
}
/**
 * Logs experimental features and config-dependent info.
 * Called after getRequestHandlers completes.
 */ export function logExperimentalInfo({ experimentalFeatures, cacheComponents }) {
    if (cacheComponents) {
        Log.bootstrap(`- Cache Components enabled`);
    }
    if (experimentalFeatures == null ? void 0 : experimentalFeatures.length) {
        Log.bootstrap(`- Experiments (use with caution):`);
        for (const exp of experimentalFeatures){
            const isValid = Object.prototype.hasOwnProperty.call(experimentalSchema, exp.key);
            if (isValid) {
                const symbol = typeof exp.value === 'boolean' ? exp.value === true ? bold('✓') : bold('⨯') : '·';
                const suffix = typeof exp.value === 'number' || typeof exp.value === 'string' ? `: ${JSON.stringify(exp.value)}` : '';
                const reason = exp.reason ? ` (${exp.reason})` : '';
                Log.bootstrap(`  ${symbol} ${exp.key}${suffix}${reason}`);
            } else {
                Log.bootstrap(`  ? ${strikethrough(exp.key)} (invalid experimental key)`);
            }
        }
    }
    // New line after the bootstrap info
    Log.info('');
}
/**
 * Gets environment info for logging. Fast operation that doesn't require config.
 */ export function getEnvInfo(dir) {
    const { loadedEnvFiles } = loadEnvConfig(dir, true, console, false);
    return loadedEnvFiles.map((f)=>f.path);
}

//# sourceMappingURL=app-info-log.js.map