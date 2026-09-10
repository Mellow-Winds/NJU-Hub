(function () {
    'use strict';

    const MODE_KEY = 'ui_material_mode';
    const CONFIG_KEY = 'ui_material_config';
    const WALLPAPER_ENABLED_KEY = 'ui_wallpaper_enabled';
    const WALLPAPER_DATA_KEY = 'ui_wallpaper_data';
    const MAX_WALLPAPER_LENGTH = 3_000_000;
    const defaults = { blur: 24, opacity: 68, reducedTransparency: false, still: false };

    let state = {
        mode: 'default',
        ...defaults,
        wallpaperEnabled: false,
        wallpaperData: ''
    };
    let saveTimer = 0;

    const normalizeConfig = (value) => {
        const source = value && typeof value === 'object' ? value : {};
        const blur = Number(source.blur);
        const opacity = Number(source.opacity);
        return {
            blur: Number.isFinite(blur) ? Math.min(36, Math.max(0, blur)) : defaults.blur,
            opacity: Number.isFinite(opacity) ? Math.min(96, Math.max(40, opacity)) : defaults.opacity,
            reducedTransparency: source.reducedTransparency === true,
            still: source.still === true
        };
    };

    const safeImageData = (value) => {
        if (typeof value !== 'string') return '';
        return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value) ? value : '';
    };

    const storageCall = (area, method, ...args) => new Promise((resolve, reject) => {
        try {
            area[method](...args, (result) => {
                const error = chrome.runtime?.lastError;
                if (error) reject(new Error(error.message));
                else resolve(result || {});
            });
        } catch (error) {
            reject(error);
        }
    });

    const renderLaboratory = (host) => {
        host.innerHTML = `
            <div class="lab-page"><div class="lab-card lab-controls" aria-labelledby="material-laboratory-title">
                <div class="lab-controls-heading">
                    <h3 id="material-laboratory-title">材质调校</h3>
                    <span>即时生效</span>
                </div>
                <p class="lab-controls-intro">用同一组颜色，改变表面的厚度。</p>
                <div class="lab-mode-list" role="group" aria-label="卡片材质">
                    <label><input type="radio" name="lab-mode" value="default">普通卡片</label>
                    <label><input type="radio" name="lab-mode" value="enhanced">更好的卡片</label>
                    <label><input type="radio" name="lab-mode" value="liquid-glass">液态玻璃</label>
                </div>
                <div class="lab-ranges">
                    <div class="lab-range">
                        <label for="lab-blur"><span>背景模糊</span><output id="lab-blur-value"></output></label>
                        <input id="lab-blur" type="range" min="0" max="36" value="24">
                    </div>
                    <div class="lab-range">
                        <label for="lab-opacity"><span>表面厚度</span><output id="lab-opacity-value"></output></label>
                        <input id="lab-opacity" type="range" min="40" max="96" value="68">
                    </div>
                </div>
                <div class="lab-preferences">
                    <label><span>降低透明度</span><input id="lab-reduced-transparency" type="checkbox"></label>
                    <label><span>减少动态效果</span><input id="lab-still" type="checkbox"></label>
                </div>
                <p id="lab-status" class="lab-caption" role="status" aria-live="polite"></p>
                <button type="button" class="lab-reset btn-small" data-lab-action="reset">恢复默认材质</button>
            </div></div>`;
    };

    const applyWallpaper = () => {
        const root = document.documentElement;
        const active = state.wallpaperEnabled && Boolean(state.wallpaperData);
        root.classList.toggle('ui-wallpaper-enabled', active);
        if (active) root.style.setProperty('--personalize-wallpaper-image', `url("${state.wallpaperData}")`);
        else root.style.removeProperty('--personalize-wallpaper-image');
        root.dataset.njuWallpaperEnabled = String(active);
        if (active) root.style.setProperty('--nju-global-wallpaper-image', `url("${state.wallpaperData}")`);
        else root.style.removeProperty('--nju-global-wallpaper-image');

        const preview = document.getElementById('ui-wallpaper-preview');
        const clear = document.getElementById('ui-wallpaper-clear');
        const status = document.getElementById('ui-wallpaper-status');
        if (preview) {
            preview.classList.toggle('has-wallpaper', active);
            preview.style.backgroundImage = active ? `url("${state.wallpaperData}")` : '';
            const label = preview.querySelector('.wallpaper-preview-label');
            if (label) label.textContent = active ? '当前壁纸' : '未选择壁纸';
        }
        if (clear) clear.hidden = !active;
        if (status && active && !status.dataset.customMessage) status.textContent = '壁纸已应用到当前设置页。';
    };

    const apply = () => {
        const root = document.documentElement;
        root.dataset.njuMode = state.mode;
        root.dataset.njuGlobalMode = state.mode;
        root.dataset.njuGlobalStill = String(state.still);
        root.dataset.njuReducedTransparency = String(state.reducedTransparency);
        root.style.setProperty('--personalize-blur', `${state.blur}px`);
        root.style.setProperty('--personalize-opacity', `${state.reducedTransparency ? Math.max(88, state.opacity) : state.opacity}%`);
        root.style.setProperty('--nju-global-blur', `${state.blur}px`);
        root.style.setProperty('--nju-global-opacity', `${state.reducedTransparency ? Math.max(88, state.opacity) : state.opacity}%`);
        root.dataset.njuStill = String(state.still);
        applyWallpaper();

        const better = document.getElementById('ui-better-card-mode');
        const glass = document.getElementById('ui-glass-mode');
        if (better) better.checked = state.mode === 'enhanced';
        if (glass) glass.checked = state.mode === 'liquid-glass';
        const darkToggle = document.getElementById('ui-dark-mode');
        if (darkToggle) {
            darkToggle.disabled = state.mode !== 'default';
            darkToggle.setAttribute('aria-disabled', String(darkToggle.disabled));
            darkToggle.title = darkToggle.disabled ? '暗夜模式仅适用于普通卡片' : '';
            if (darkToggle.disabled) darkToggle.checked = false;
        }
        document.querySelectorAll('[name="lab-mode"]').forEach(input => {
            input.checked = input.value === state.mode;
        });

        const blur = document.getElementById('lab-blur');
        const opacity = document.getElementById('lab-opacity');
        const reducedTransparency = document.getElementById('lab-reduced-transparency');
        const still = document.getElementById('lab-still');
        if (blur) { blur.value = String(state.blur); blur.disabled = state.mode !== 'liquid-glass'; }
        if (opacity) { opacity.value = String(state.opacity); opacity.disabled = state.mode !== 'liquid-glass'; }
        if (reducedTransparency) reducedTransparency.checked = state.reducedTransparency;
        if (still) still.checked = state.still;
        const blurValue = document.getElementById('lab-blur-value');
        const opacityValue = document.getElementById('lab-opacity-value');
        if (blurValue) blurValue.textContent = `${state.blur} px`;
        if (opacityValue) opacityValue.textContent = `${state.opacity}%`;

        const status = document.getElementById('lab-status');
        if (status) {
            status.textContent = state.mode === 'default'
                ? '关闭增强材质，显示默认卡片。'
                : state.mode === 'enhanced'
                    ? '更好的卡片：不透光，边界更清晰。'
                    : '液态玻璃：背景透过卡片，模糊和高光保持开启。';
        }
    };

    const saveConfig = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            storageCall(chrome.storage.sync, 'set', {
                [CONFIG_KEY]: {
                    blur: state.blur,
                    opacity: state.opacity,
                    reducedTransparency: state.reducedTransparency,
                    still: state.still
                }
            }).catch(() => {});
        }, 180);
    };

    const saveMode = async (mode) => {
        state.mode = ['default', 'enhanced', 'liquid-glass'].includes(mode) ? mode : 'default';
        apply();
        try {
            const nextValues = { [MODE_KEY]: state.mode };
            // Dark mode is a property of the default material only. Changing to
            // either enhanced or liquid glass immediately moves the theme back to
            // the light palette instead of leaving an invalid mixed state behind.
            if (state.mode !== 'default') nextValues.ui_theme_mode = 'light';
            await storageCall(chrome.storage.sync, 'set', nextValues);
        } catch (error) {
            const status = document.getElementById('lab-status');
            if (status) status.textContent = `材质状态保存失败：${error.message}`;
        }
    };

    const spawnModeRipple = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const label = target?.closest('.lab-mode-list label');
        if (!label || event.button > 0) return;
        const rect = label.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.35;
        const ripple = document.createElement('span');
        ripple.className = 'lab-ripple';
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
        label.appendChild(ripple);
        requestAnimationFrame(() => ripple.classList.add('is-active'));
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    };

    const loadState = async () => {
        const [sync, local] = await Promise.all([
            storageCall(chrome.storage.sync, 'get', [MODE_KEY, CONFIG_KEY, WALLPAPER_ENABLED_KEY]),
            storageCall(chrome.storage.local, 'get', [WALLPAPER_DATA_KEY])
        ]);
        state = {
            ...state,
            ...normalizeConfig(sync[CONFIG_KEY]),
            mode: ['default', 'enhanced', 'liquid-glass'].includes(sync[MODE_KEY]) ? sync[MODE_KEY] : 'default',
            wallpaperEnabled: sync[WALLPAPER_ENABLED_KEY] === true,
            wallpaperData: safeImageData(local[WALLPAPER_DATA_KEY])
        };
        apply();
    };

    const compressImage = (file) => new Promise((resolve, reject) => {
        if (!(file instanceof Blob) || !file.type.startsWith('image/')) {
            reject(new Error('请选择图片文件。'));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('图片读取失败，请重试。'));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error('图片无法解析，请更换图片。'));
            image.onload = () => {
                const maxDimension = 2400;
                const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                const context = canvas.getContext('2d');
                if (!context) { reject(new Error('当前浏览器不支持图片处理。')); return; }
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                const result = canvas.toDataURL('image/webp', .84);
                if (result.length > MAX_WALLPAPER_LENGTH) reject(new Error('图片压缩后仍然过大，请选择更小的图片。'));
                else resolve(result);
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });

    const setWallpaper = async (data) => {
        if (!data || data.length > MAX_WALLPAPER_LENGTH) throw new Error('图片压缩后仍然过大，请选择更小的图片。');
        await storageCall(chrome.storage.local, 'set', { [WALLPAPER_DATA_KEY]: data });
        await storageCall(chrome.storage.sync, 'set', { [WALLPAPER_ENABLED_KEY]: true });
        state.wallpaperData = data;
        state.wallpaperEnabled = true;
        applyWallpaper();
    };

    const clearWallpaper = async () => {
        await storageCall(chrome.storage.local, 'remove', [WALLPAPER_DATA_KEY]);
        await storageCall(chrome.storage.sync, 'set', { [WALLPAPER_ENABLED_KEY]: false });
        state.wallpaperData = '';
        state.wallpaperEnabled = false;
        applyWallpaper();
    };

    const mount = () => {
        const host = document.getElementById('material-laboratory');
        if (!host) return;
        renderLaboratory(host);
        apply();

        document.addEventListener('change', (event) => {
            if (event.target.name === 'lab-mode') saveMode(event.target.value);
            if (event.target.id === 'ui-better-card-mode') saveMode(event.target.checked ? 'enhanced' : 'default');
            if (event.target.id === 'ui-glass-mode') saveMode(event.target.checked ? 'liquid-glass' : 'default');
        });

        host.addEventListener('pointerdown', spawnModeRipple);

        host.addEventListener('input', (event) => {
            if (event.target.id === 'lab-blur') state.blur = Number(event.target.value);
            if (event.target.id === 'lab-opacity') state.opacity = Number(event.target.value);
            if (event.target.id === 'lab-reduced-transparency') state.reducedTransparency = event.target.checked;
            if (event.target.id === 'lab-still') state.still = event.target.checked;
            if (['lab-blur', 'lab-opacity', 'lab-reduced-transparency', 'lab-still'].includes(event.target.id)) {
                apply();
                saveConfig();
            }
        });

        host.addEventListener('click', (event) => {
            if (event.target.closest('[data-lab-action="reset"]')) {
                state = { ...state, ...defaults, mode: 'default' };
                apply();
                saveMode('default');
                saveConfig();
            }
        });

        const wallpaperInput = document.getElementById('ui-wallpaper-input');
        const wallpaperStatus = document.getElementById('ui-wallpaper-status');
        document.getElementById('ui-wallpaper-select')?.addEventListener('click', () => wallpaperInput?.click());
        wallpaperInput?.addEventListener('change', async () => {
            const file = wallpaperInput.files?.[0];
            if (!file) return;
            if (wallpaperStatus) { wallpaperStatus.textContent = '正在处理图片…'; wallpaperStatus.dataset.customMessage = 'true'; }
            try {
                await setWallpaper(await compressImage(file));
                if (wallpaperStatus) { wallpaperStatus.textContent = '壁纸已应用到当前设置页。'; delete wallpaperStatus.dataset.customMessage; }
            } catch (error) {
                if (wallpaperStatus) wallpaperStatus.textContent = error.message || '壁纸应用失败，请重试。';
            } finally {
                wallpaperInput.value = '';
            }
        });
        document.getElementById('ui-wallpaper-clear')?.addEventListener('click', async () => {
            try {
                await clearWallpaper();
                if (wallpaperStatus) { wallpaperStatus.textContent = '壁纸已清除。'; delete wallpaperStatus.dataset.customMessage; }
            } catch (error) {
                if (wallpaperStatus) wallpaperStatus.textContent = error.message || '壁纸清除失败，请重试。';
            }
        });

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && (changes[MODE_KEY] || changes[CONFIG_KEY] || changes[WALLPAPER_ENABLED_KEY])) loadState().catch(() => {});
            if (area === 'local' && changes[WALLPAPER_DATA_KEY]) loadState().catch(() => {});
        });
        loadState().catch((error) => {
            const status = document.getElementById('lab-status');
            if (status) status.textContent = `材质配置读取失败，已使用默认材质：${error.message}`;
        });
    };

    document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
