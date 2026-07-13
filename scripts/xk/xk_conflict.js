/**
 * scripts/xk/xk_conflict.js
 *
 * 冲突检测与概率计算：checkConflict、calcProb、sortFavRows
 * 依赖：window.__XK__ (storage)
 */

(function () {
    'use strict';

    const { GM_getValue, GM_setValue } = window.__XK__;

    const CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7 };

    const THEME = {
        P100: '#1b5e20', P80: '#4caf50', P60: '#fdd835', P40: '#ff9800', P20: '#f44336', P0: '#8e0000'
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
        const parse = (str) => {
            const segments = str.split(/,|，/);
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

        const targetSlots = parse(targetTimeStr);
        for (let my of mySchedule) {
            const mySlots = parse(my.timeStr);
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
     * @param {string} text - "已选/上限" 格式
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
     * 收藏置顶排序：将收藏行移至表格顶部
     */
    const sortFavRows = () => {
        const pinFav = GM_getValue('NJU_PIN_FAV', true);
        if (!pinFav) return;

        const tbody = document.querySelector('.course-body');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr.course-tr'));
        if (rows.length === 0) return;

        let isSorted = true;
        let foundNonFav = false;

        for (let row of rows) {
            const isFav = row.classList.contains('is-fav-row');
            if (!isFav) {
                foundNonFav = true;
            } else if (foundNonFav) {
                isSorted = false;
                break;
            }
        }

        if (!isSorted) {
            const fragment = document.createDocumentFragment();
            const favs = rows.filter(r => r.classList.contains('is-fav-row'));
            const nonFavs = rows.filter(r => !r.classList.contains('is-fav-row'));

            favs.forEach(r => fragment.appendChild(r));
            nonFavs.forEach(r => fragment.appendChild(r));

            tbody.appendChild(fragment);
        }
    };

    Object.assign(window.__XK__, {
        checkConflict,
        calcProb,
        sortFavRows,
        CN_NUM
    });
})();