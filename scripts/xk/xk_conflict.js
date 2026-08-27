/**
 * scripts/xk/xk_conflict.js
 *
 * 冲突检测、概率计算、时间解析、行排序
 * 依赖：window.__XK__ (storage)
 */

(function () {
    'use strict';

    const { GM_getValue, GM_setValue, STORAGE } = window.__XK__;
    let nextOriginalOrder = 0;

    const CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7 };

    const THEME = {
        P100: '#1b5e20', P80: '#4caf50', P60: '#fdd835', P40: '#ff9800', P20: '#f44336', P0: '#8e0000'
    };

    /**
     * 解析课程时间字符串为时间段数组
     * @param {string} str - 如 "周二 3-4节 1-16周, 周四 5-6节 1-16周"
     * @returns {Array<{day,sS,eS,sW,eW}>}
     */
    const parseTime = (str) => {
        const segments = String(str || '').split(/,|，/);
        let slots = [];
        segments.forEach(seg => {
            const d = seg.match(/周([一二三四五六日])/);
            const s = seg.match(/(\d+)-(\d+)节/);
            const w = seg.match(/(\d+)-(\d+)周/);
            if (d && s && w) {
                slots.push({
                    day: CN_NUM[d[1]],
                    sS: parseInt(s[1]),
                    eS: parseInt(s[2]),
                    sW: parseInt(w[1]),
                    eW: parseInt(w[2])
                });
            }
        });
        return slots;
    };

    /**
     * 检测目标课程时间是否与已抓取课表冲突
     * @param {string} targetTimeStr - 目标课程时间字符串
     * @returns {false|{conflict: true, with: string}}
     */
    const checkConflict = (targetTimeStr) => {
        const conflictCheck = GM_getValue('NJU_CONFLICT', true);
        if (!conflictCheck) return false;

        const mySchedule = GM_getValue('NJU_SCHEDULE', []);
        const targetSlots = parseTime(targetTimeStr);
        for (let my of mySchedule) {
            const mySlots = parseTime(my.timeStr);
            for (let tS of targetSlots) {
                for (let mS of mySlots) {
                    if (tS.day === mS.day) {
                        const wOv = Math.max(tS.sW, mS.sW) <= Math.min(tS.eW, mS.eW);
                        const sOv = Math.max(tS.sS, mS.sS) <= Math.min(tS.eS, mS.eS);
                        if (wOv && sOv) return { conflict: true, with: my.name };
                    }
                }
            }
        }
        return false;
    };

    /**
     * 根据已选/上限计算选中概率
     * @param {string} text - "已选/上限" 格式（满员时可能为 "已满/上限"）
     * @returns {null|{prob: number, color: string}}
     */
    const calcProb = (text) => {
        const parts = text.split('/');
        if (parts.length !== 2) return null;
        const enroll = parseInt(parts[0]), cap = parseInt(parts[1]);
        if (isNaN(enroll) || isNaN(cap)) return null;
        let prob = enroll === 0 ? 100 : (cap / enroll) * 100;
        if (prob > 100) prob = 100;
        let color = THEME.P0;
        if (prob >= 100) color = THEME.P100;
        else if (prob >= 80) color = THEME.P80;
        else if (prob >= 60) color = THEME.P60;
        else if (prob >= 40) color = THEME.P40;
        else if (prob >= 20) color = THEME.P20;
        return { prob: Math.round(prob), color };
    };

    /**
     * 判断课程是否已满（用于过滤/排序沉底）
     * @param {string} text - ".yxrs" 文本
     */
    const isFull = (text) => {
        if (/已满/.test(text)) return true;
        const parts = text.split('/');
        if (parts.length === 2) {
            const enroll = parseInt(parts[0]), cap = parseInt(parts[1]);
            if (!isNaN(enroll) && !isNaN(cap) && enroll >= cap) return true;
        }
        return false;
    };

    // AI 缓存索引（按课程名去空格后分组，避免每次排序全表扫描）
    let _aiIndexCache = { src: null, byName: null };

    const buildAIIndex = (aiCache) => {
        if (_aiIndexCache.src === aiCache) return _aiIndexCache.byName;
        const byName = new Map();
        for (const k in aiCache) {
            const idx = k.indexOf('#');
            if (idx <= 0) continue;
            const c = k.slice(0, idx).replace(/\s/g, '');
            const t = k.slice(idx + 1);
            if (!byName.has(c)) byName.set(c, []);
            byName.get(c).push({ t, entry: aiCache[k] });
        }
        _aiIndexCache = { src: aiCache, byName };
        return byName;
    };

    /**
     * AI 缓存匹配：课程名#教师名（精确 → 去空格模糊）
     * @returns {object|null} aiCache 条目
     */
    const matchAICacheEntry = (name, teacher, aiCache) => {
        const exact = aiCache[name + '#' + teacher];
        if (exact) return exact;
        const nameClean = name.replace(/\s/g, '');
        const list = buildAIIndex(aiCache).get(nameClean);
        if (!list) return null;
        for (const it of list) {
            const ts = it.t.split(/[\s,，、]+/);
            if (ts.some(n => n && teacher.includes(n))) return it.entry;
        }
        return null;
    };

    /**
     * 读取课程行的 AI 综合评分
     * @returns {number|null}
     */
    const getAIScore = (row) => {
        // 优先读取徽章注入时写好的分数（与「力荐 (8.6)」展示一致）
        if (row.dataset.aiScore !== undefined && row.dataset.aiScore !== '') {
            const s = parseFloat(row.dataset.aiScore);
            return isNaN(s) ? null : s;
        }
        // 兜底：重新匹配 AI 缓存（徽章尚未注入时）
        const name = row.querySelector('.kcmc')?.innerText?.trim() || '';
        const teacher = row.querySelector('.jsmc')?.innerText?.trim() || '';
        const aiCache = GM_getValue(STORAGE.AI_CACHE, {}) || {};
        if (!name || !teacher || !Object.keys(aiCache).length) return null;
        const entry = matchAICacheEntry(name, teacher, aiCache);
        if (!entry) return null;
        const score = parseFloat(entry['综合评分']);
        return isNaN(score) ? null : score;
    };

    /**
     * 选中概率排序键（满员/解析失败沉底）
     */
    const getProbSortKey = (row) => {
        const text = row.querySelector('.yxrs')?.innerText?.trim() || '';
        const p = calcProb(text);
        if (!p) return -1;
        if (isFull(text)) return -1;
        return p.prob;
    };

    /**
     * 上课时间排序键：取最早时间段（先比星期，再比开始节）；无时间段沉底
     */
    const getTimeKey = (row) => {
        const text = row.querySelector('.sjdd')?.innerText?.trim() || '';
        const slots = parseTime(text);
        if (!slots.length) return Infinity;
        let min = Infinity;
        for (const s of slots) {
            const key = s.day * 1000 + s.sS;
            if (key < min) min = key;
        }
        return min;
    };

    /**
     * 根据排序模式计算行排序键
     */
    const getSortKey = (row, mode) => {
        switch (mode) {
            case 'ai': {
                const s = getAIScore(row);
                return s === null ? -1 : s;
            }
            case 'prob': return getProbSortKey(row);
            case 'time': return getTimeKey(row);
            default: return 0;
        }
    };

    /**
     * 行排序比较器：收藏置顶 > 排序模式
     */
    const compareRows = (a, b, pinFav, mode) => {
        if (pinFav && a.isFav !== b.isFav) return a.isFav ? -1 : 1;
        if (mode === 'time') return a.key - b.key;
        return b.key - a.key; // ai / prob 降序
    };

    /**
     * 统一行排序：收藏置顶（若开启）+ 按 SORT_MODE 排序
     */
    const applyRowOrder = () => {
        const tbody = document.querySelector('.course-body');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr.course-tr'));
        if (rows.length < 2) return;

        // 站点的默认顺序由后端返回，插件排序会直接重排 DOM；因此首次看到
        // 这批课程时保存稳定的原始序号，切回“默认”时可以真正恢复它。
        rows.forEach((row) => {
            if (row.dataset.xkOriginalOrder === undefined) {
                row.dataset.xkOriginalOrder = String(nextOriginalOrder++);
            }
        });

        const pinFav = GM_getValue(STORAGE.PIN_FAV, true);
        const mode = GM_getValue(STORAGE.SORT_MODE, 'none');

        if (mode === 'none' && !pinFav) {
            const desired = rows.slice().sort((a, b) =>
                Number(a.dataset.xkOriginalOrder) - Number(b.dataset.xkOriginalOrder)
            );
            const alreadyDefault = desired.every((row, idx) => row === rows[idx]);
            if (!alreadyDefault) {
                const fragment = document.createDocumentFragment();
                desired.forEach(row => fragment.appendChild(row));
                tbody.appendChild(fragment);
            }
            return;
        }

        const enriched = rows.map(row => ({
            row,
            isFav: row.classList.contains('is-fav-row'),
            key: getSortKey(row, mode),
            originalOrder: Number(row.dataset.xkOriginalOrder)
        }));

        const desired = enriched.slice().sort((a, b) => {
            const result = compareRows(a, b, pinFav, mode);
            return result || a.originalOrder - b.originalOrder;
        });

        let same = true;
        for (let i = 0; i < enriched.length; i++) {
            if (enriched[i].row !== desired[i].row) { same = false; break; }
        }
        if (same) return;

        const fragment = document.createDocumentFragment();
        desired.forEach(d => fragment.appendChild(d.row));
        tbody.appendChild(fragment);
    };

    Object.assign(window.__XK__, {
        parseTime,
        checkConflict,
        calcProb,
        isFull,
        matchAICacheEntry,
        getAIScore,
        getProbSortKey,
        getTimeKey,
        getSortKey,
        applyRowOrder,
        sortFavRows: applyRowOrder, // 兼容旧调用
        CN_NUM
    });
})();
