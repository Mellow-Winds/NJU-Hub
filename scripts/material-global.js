(function () {
    'use strict';

    const MODE_KEY = 'ui_material_mode';
    const CONFIG_KEY = 'ui_material_config';
    const defaults = { mode: 'default', blur: 24, opacity: 68, reducedTransparency: false, still: false };
    const state = { ...defaults };
    const root = document.documentElement;

    const pageName = () => {
        if (location.protocol !== 'chrome-extension:') return 'host';
        if (/\/popup\//.test(location.pathname)) return 'popup';
        if (/\/webportal\//.test(location.pathname)) return 'webportal';
        if (/\/red-black\//.test(location.pathname)) return 'red-black';
        if (/\/schedule\//.test(location.pathname)) return 'schedule';
        return 'extension';
    };

    root.dataset.njuMaterialPage = pageName();

    const normalize = (value) => {
        const config = value && typeof value === 'object' ? value : {};
        const blur = Number(config.blur);
        const opacity = Number(config.opacity);
        return {
            blur: Number.isFinite(blur) ? Math.min(36, Math.max(0, blur)) : defaults.blur,
            opacity: Number.isFinite(opacity) ? Math.min(96, Math.max(40, opacity)) : defaults.opacity,
            reducedTransparency: config.reducedTransparency === true,
            still: config.still === true
        };
    };

    const apply = () => {
        root.dataset.njuGlobalMode = ['default', 'enhanced', 'liquid-glass'].includes(state.mode) ? state.mode : defaults.mode;
        root.dataset.njuGlobalStill = String(state.still);
        root.dataset.njuReducedTransparency = String(state.reducedTransparency);
        root.style.setProperty('--nju-global-blur', `${state.blur}px`);
        root.style.setProperty('--nju-global-opacity', `${state.reducedTransparency ? Math.max(88, state.opacity) : state.opacity}%`);
    };

    const load = () => {
        chrome.storage.sync.get([MODE_KEY, CONFIG_KEY], (data) => {
            if (chrome.runtime.lastError) return;
            state.mode = ['default', 'enhanced', 'liquid-glass'].includes(data[MODE_KEY]) ? data[MODE_KEY] : defaults.mode;
            Object.assign(state, normalize(data[CONFIG_KEY]));
            apply();
        });
    };

    apply();
    load();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && (changes[MODE_KEY] || changes[CONFIG_KEY])) load();
    });
})();
