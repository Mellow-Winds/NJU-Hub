/**
 * scripts/xk/xk_storage.js
 *
 * 存储层：GM_* 包装器、全局状态同步、storage key 常量
 * 依赖：chrome.storage.local, chrome.storage.onChanged
 * 导出：window.__XK__ = { STORAGE, GM_getValue, GM_setValue, GM_deleteValue, ... }
 */

(function () {
    'use strict';

    const STORAGE = {
        // 核心数据
        SCHEDULE: 'NJU_SCHEDULE',
        FAVORITES: 'NJU_FAVORITES',
        DB: 'NJU_DB',
        AI_CACHE: 'NJU_AI_CACHE',

        // 配置
        CAMPUS: 'NJU_CAMPUS',
        CONFLICT: 'NJU_CONFLICT',
        AUTO: 'NJU_AUTO',
        CHECK_CAMPUS: 'NJU_CHECK_CAMPUS',
        PIN_FAV: 'NJU_PIN_FAV',
        MODE: 'NJU_MODE',

        // UI
        ISLAND_POS: 'NJU_ISLAND_POS',

        // 课表开关
        TOGGLE: 'toggle-schedule',

        // AI 配置
        API_URL: 'course_api_url',
        API_KEY: 'course_api_key',
        MODEL: 'course_model',
        MAJOR: 'course_major',
        PREF: 'course_pref',
        AI_LAST_FETCH: 'NJU_AI_LAST_FETCH',
        GITHUB_RAW: 'https://raw.githubusercontent.com/Mellow-Winds/NJU-Hub/main/data/ai_cache.json'
    };

    // 全局缓存，保持与 chrome.storage 同步
    let globalStorage = {};

    const GM_getValue = (key, def) => globalStorage[key] !== undefined ? globalStorage[key] : def;

    const GM_setValue = (key, val) => {
        globalStorage[key] = val;
        chrome.storage.local.set({ [key]: val });
    };

    const GM_deleteValue = (key) => {
        delete globalStorage[key];
        chrome.storage.local.remove(key);
    };

    chrome.storage.onChanged.addListener((changes) => {
        for (let [key, { newValue }] of Object.entries(changes)) {
            globalStorage[key] = newValue;
        }
    });

    // 初始化：从 chrome.storage 加载全部数据
    const init = async () => {
        globalStorage = await chrome.storage.local.get(null);
        return globalStorage;
    };

    window.__XK__ = window.__XK__ || {};
    Object.assign(window.__XK__, {
        STORAGE,
        GM_getValue,
        GM_setValue,
        GM_deleteValue,
        init,
        getGlobalStorage: () => globalStorage
    });
})();