/**
 * scripts/venue_grab/vg_match.js
 * 场馆抢票 — 纯匹配逻辑（无 DOM 依赖，node 可单测）
 * UMD：浏览器挂 window.__VG_MATCH__，node 走 module.exports
 */
(function (root) {
    'use strict';

    // 'HH:MM[:SS]' → 今天该时刻的 ms 时间戳（是否已过由调用方判断）
    function todayAt(hhmmss, now) {
        const parts = String(hhmmss || '08:00:00').split(':').map(Number);
        const t = new Date(now);
        t.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
        return t.getTime();
    }

    // 提取文本中的 HH:MM（"8:00"→"08:00"）
    function cellTimes(text) {
        return (String(text).match(/\d{1,2}:\d{2}/g) || [])
            .map(t => t.padStart(5, '0'));
    }

    // 按目标时段顺序挑格子；场地偏好（sitePrefs 数组，按序优先）；exclude 为已试过的 text 键
    // cells 由引擎构造，text 形如 "7号场 13:00"（场地名 + 开始时刻，避免起止歧义）
    function pickCandidate(cells, cfg, exclude) {
        const targets = [].concat(cfg.targetTimes || [], cfg.fallbackTimes || []);
        const prefs = cfg.sitePrefs || (cfg.sitePref ? [cfg.sitePref] : []);
        const ex = new Set(exclude || []);
        for (const time of targets) {
            const matching = cells.filter(c =>
                c.available && !ex.has(c.text) && cellTimes(c.text).includes(time));
            if (!matching.length) continue;
            for (const p of prefs) {
                const pref = matching.find(c => c.text.includes(p));
                if (pref) return pref;
            }
            return matching[0];
        }
        return null;
    }

    const api = { todayAt, cellTimes, pickCandidate };
    root.__VG_MATCH__ = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
