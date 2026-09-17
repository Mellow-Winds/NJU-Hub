(function () {
    'use strict';

    const MODE_KEY = 'ui_material_mode';
    const CONFIG_KEY = 'ui_material_config';
    const THEME_COLOR_KEY = 'ui_theme_color';
    const SEASONAL_COLOR_KEY = 'ui_seasonal_color_enabled';
    const WALLPAPER_ENABLED_KEY = 'ui_wallpaper_enabled';
    const WALLPAPER_DATA_KEY = 'ui_wallpaper_data';
    const defaults = { mode: 'default', blur: 24, opacity: 68, reducedTransparency: false, still: false };
    const state = {
        ...defaults,
        themeColor: '#0ea5e9',
        seasonalColorEnabled: false,
        wallpaperEnabled: false,
        wallpaperData: ''
    };
    const root = document.documentElement;

    const pageName = () => {
        if (!['chrome-extension:', 'moz-extension:'].includes(location.protocol)) return 'host';
        if (/\/popup\//.test(location.pathname)) return 'popup';
        if (/\/webportal\//.test(location.pathname)) return 'webportal';
        if (/\/red-black\//.test(location.pathname)) return 'red-black';
        if (/\/schedule\//.test(location.pathname)) return 'schedule';
        return 'extension';
    };

    root.dataset.njuMaterialPage = pageName();
    const wallpaperPages = new Set(['extension', 'webportal', 'red-black']);
    const gradientPages = new Set(['extension', 'popup', 'webportal', 'red-black']);

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

    const safeImageData = (value) => (
        typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value) ? value : ''
    );

    const safeThemeColor = (value) => {
        const color = typeof value === 'string' ? value.trim() : '';
        return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : state.themeColor;
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const wrapHue = (value) => ((value % 360) + 360) % 360;
    const randomBetween = (min, max) => min + Math.random() * (max - min);

    const hexToHsl = (value) => {
        let hex = String(value || '').trim().replace(/^#/, '');
        if (hex.length === 3) hex = hex.split('').map((part) => part + part).join('');
        if (!/^[0-9a-f]{6}$/i.test(hex)) return { h: 204, s: 87, l: 48 };

        const red = parseInt(hex.slice(0, 2), 16) / 255;
        const green = parseInt(hex.slice(2, 4), 16) / 255;
        const blue = parseInt(hex.slice(4, 6), 16) / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const lightness = (max + min) / 2;

        if (max === min) return { h: 0, s: 0, l: lightness * 100 };

        const delta = max - min;
        const saturation = lightness > 0.5
            ? delta / (2 - max - min)
            : delta / (max + min);
        let hue;

        switch (max) {
            case red:
                hue = (green - blue) / delta + (green < blue ? 6 : 0);
                break;
            case green:
                hue = (blue - red) / delta + 2;
                break;
            default:
                hue = (red - green) / delta + 4;
                break;
        }

        return { h: hue * 60, s: saturation * 100, l: lightness * 100 };
    };

    const pastelHsl = (hue, saturation, lightness) => (
        `hsl(${Math.round(wrapHue(hue))}, ${Math.round(clamp(saturation, 36, 74))}%, ${Math.round(clamp(lightness, 89, 98))}%)`
    );

    const createThemeGradient = (themeColor) => {
        const { h, s } = hexToHsl(themeColor);
        const baseHue = wrapHue(h + randomBetween(-12, 12));
        const saturation = clamp(42 + s * 0.25, 42, 68);

        return {
            angle: `${Math.round(randomBetween(112, 248))}deg`,
            a: pastelHsl(baseHue + randomBetween(-26, -4), saturation + randomBetween(-6, 4), randomBetween(93, 97)),
            b: pastelHsl(baseHue + randomBetween(-6, 22), saturation + randomBetween(-4, 8), randomBetween(91, 95)),
            c: pastelHsl(baseHue + randomBetween(14, 42), saturation + randomBetween(-5, 5), randomBetween(93, 97))
        };
    };

    const apply = () => {
        const mode = ['default', 'enhanced', 'liquid-glass'].includes(state.mode) ? state.mode : defaults.mode;
        root.dataset.njuGlobalMode = mode;
        root.dataset.njuGlobalStill = String(state.still);
        root.dataset.njuReducedTransparency = String(state.reducedTransparency);
        root.style.setProperty('--nju-global-blur', `${state.blur}px`);
        root.style.setProperty('--nju-global-opacity', `${state.reducedTransparency ? Math.max(88, state.opacity) : state.opacity}%`);

        const wallpaperActive = wallpaperPages.has(root.dataset.njuMaterialPage)
            && state.wallpaperEnabled
            && Boolean(state.wallpaperData);
        const seasonalActive = gradientPages.has(root.dataset.njuMaterialPage)
            && state.seasonalColorEnabled
            && Boolean(window.NjuSeasonalBackground)
            && !wallpaperActive;
        const blueGradientActive = gradientPages.has(root.dataset.njuMaterialPage)
            && mode === 'liquid-glass'
            && !wallpaperActive;
        const gradientActive = seasonalActive || blueGradientActive;

        root.dataset.njuWallpaperEnabled = String(wallpaperActive);
        root.dataset.njuSeasonalEnabled = String(seasonalActive);
        root.dataset.njuGradientEnabled = String(gradientActive);
        if (wallpaperActive) root.style.setProperty('--nju-global-wallpaper-image', `url("${state.wallpaperData}")`);
        else root.style.removeProperty('--nju-global-wallpaper-image');

        if (seasonalActive) {
            window.NjuSeasonalBackground.apply();
            window.NjuSeasonalBackground.start();
            root.style.removeProperty('--nju-global-gradient-angle');
            root.style.removeProperty('--nju-global-gradient-a');
            root.style.removeProperty('--nju-global-gradient-b');
            root.style.removeProperty('--nju-global-gradient-c');
        } else if (blueGradientActive) {
            const gradient = createThemeGradient(state.themeColor);
            root.style.setProperty('--nju-global-gradient-angle', gradient.angle);
            root.style.setProperty('--nju-global-gradient-a', gradient.a);
            root.style.setProperty('--nju-global-gradient-b', gradient.b);
            root.style.setProperty('--nju-global-gradient-c', gradient.c);
        } else {
            root.style.removeProperty('--nju-global-gradient-angle');
            root.style.removeProperty('--nju-global-gradient-a');
            root.style.removeProperty('--nju-global-gradient-b');
            root.style.removeProperty('--nju-global-gradient-c');
        }
    };

    const load = () => {
        chrome.storage.sync.get([
            MODE_KEY,
            CONFIG_KEY,
            THEME_COLOR_KEY,
            SEASONAL_COLOR_KEY,
            WALLPAPER_ENABLED_KEY
        ], (data) => {
            if (chrome.runtime.lastError) return;
            chrome.storage.local.get([WALLPAPER_DATA_KEY], (localData) => {
                if (chrome.runtime.lastError) return;
                state.mode = ['default', 'enhanced', 'liquid-glass'].includes(data[MODE_KEY]) ? data[MODE_KEY] : defaults.mode;
                state.themeColor = safeThemeColor(data[THEME_COLOR_KEY]);
                state.seasonalColorEnabled = data[SEASONAL_COLOR_KEY] === true;
                Object.assign(state, normalize(data[CONFIG_KEY]));
                state.wallpaperEnabled = data[WALLPAPER_ENABLED_KEY] === true;
                state.wallpaperData = safeImageData(localData[WALLPAPER_DATA_KEY]);
                apply();
            });
        });
    };

    apply();
    load();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && (
            changes[MODE_KEY]
            || changes[CONFIG_KEY]
            || changes[THEME_COLOR_KEY]
            || changes[SEASONAL_COLOR_KEY]
            || changes[WALLPAPER_ENABLED_KEY]
        )) load();
        if (area === 'local' && changes[WALLPAPER_DATA_KEY]) load();
    });
})();
