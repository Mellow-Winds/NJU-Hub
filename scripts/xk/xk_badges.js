/**
 * scripts/xk/xk_badges.js
 *
 * 徽章注入层：为每行课程注入收藏按钮、概率标签、冲突标签、跨校区标签、AI 标签
 * 依赖：window.__XK__ (storage, conflict, ai, ui)
 */

(function () {
    'use strict';

    const { GM_getValue, GM_setValue, STORAGE, checkConflict, calcProb, sortFavRows, setAITagState, CAMPUS_MAP } = window.__XK__;

    const THEME = { CONFLICT: '#FF3B30', CAMPUS: '#FF9500' };

    /**
     * 辅助函数：在 cell 中追加元素（换行后）
     */
    const appendB = (cell, el) => {
        if (!cell.querySelector('.nj-br')) {
            const br = document.createElement('br');
            br.className = 'nj-br';
            cell.appendChild(br);
        }
        cell.appendChild(el);
    };

    /**
     * 注入所有徽章：收藏按钮、概率、冲突、跨校区、AI 标签
     */
    const injectBadges = () => {
        const db = GM_getValue(STORAGE.DB, {});
        const aiCache = GM_getValue(STORAGE.AI_CACHE, {});
        const conflictCheck = GM_getValue(STORAGE.CONFLICT, true);
        const myCampus = GM_getValue(STORAGE.CAMPUS, 'XL');
        const checkCampus = GM_getValue(STORAGE.CHECK_CAMPUS, true);
        let favs = GM_getValue(STORAGE.FAVORITES, {});

        document.querySelectorAll('tr.course-tr').forEach(row => {
            if (row.dataset.checkedHub) return;

            const name = row.querySelector('.kcmc')?.innerText || '未知';
            const teacher = row.querySelector('.jsmc')?.innerText || '未知';
            const time = row.querySelector('.sjdd')?.innerText || '';

            // 0. 收藏按钮
            const kchCell = row.querySelector('.kch');
            if (kchCell) {
                const compositeId = `${name}|${teacher}|${time}`;
                const isFav = !!favs[compositeId];
                if (isFav) row.classList.add('is-fav-row');

                if (compositeId && !kchCell.querySelector('.fav-toggle-btn')) {
                    const btn = document.createElement('span');
                    btn.className = `fav-toggle-btn ${isFav ? 'active' : ''}`;
                    btn.innerHTML = isFav ? '已收藏' : '收藏';
                    btn.dataset.favId = compositeId;

                    btn.onclick = (e) => {
                        e.stopPropagation();
                        favs = GM_getValue(STORAGE.FAVORITES, {});
                        if (favs[compositeId]) {
                            delete favs[compositeId];
                            btn.classList.remove('active');
                            btn.innerHTML = '收藏';
                            row.classList.remove('is-fav-row');
                        } else {
                            favs[compositeId] = { name, teacher, time, added: Date.now() };
                            btn.classList.add('active');
                            btn.innerHTML = '已收藏';
                            row.classList.add('is-fav-row');
                        }
                        GM_setValue(STORAGE.FAVORITES, favs);
                        const b = document.getElementById('btn-open-fav');
                        if (b) b.innerText = `⭐ 收藏夹 (${Object.keys(favs).length})`;
                        sortFavRows();
                    };
                    kchCell.prepend(btn);
                }
            }

            // 1. 选中概率
            const numCell = row.querySelector('.yxrs');
            if (numCell) {
                const p = calcProb(numCell.innerText.trim());
                if (p) {
                    const t = document.createElement('span');
                    t.className = 'nj-badge';
                    t.style.background = p.color;
                    t.innerText = `选中概率: ${p.prob}%`;
                    appendB(numCell, t);
                }
            }

            // 2. AI 评价标签
            const jsmcCell = row.querySelector('.jsmc');
            if (jsmcCell && Object.keys(db).length) {
                const rowText = row.innerText.replace(/\s/g, '');
                for (const k in db) {
                    const [c, t] = k.split('#');
                    if (rowText.includes(c.replace(/\s/g, ''))) {
                        const ts = t.split(/[\s,，、]+/);
                        if (ts.some(n => n && rowText.includes(n))) {
                            let comms = db[k].comments || db[k];
                            if (!Array.isArray(comms) || comms.length === 0) break;

                            const cacheKey = `${c}#${t}`;
                            const cached = aiCache[cacheKey];

                            if (cached) {
                                const aiTag = document.createElement('span');
                                aiTag.className = 'nj-badge';
                                setAITagState(aiTag, cached, cacheKey);
                                appendB(jsmcCell, aiTag);
                            } else {
                                window.pendingAITasks = window.pendingAITasks || [];
                                window.pendingAITasks.push({
                                    course: c, teacher: t, comments: comms,
                                    cacheKey: cacheKey, cell: jsmcCell
                                });
                            }
                            break;
                        }
                    }
                }
            }

            // 3. 冲突检测
            const sjCell = row.querySelector('.sjdd');
            if (sjCell && conflictCheck) {
                const st = sjCell.innerText;
                if (st && checkConflict(st)) {
                    const r = checkConflict(st);
                    const tag = document.createElement('span');
                    tag.className = 'nj-badge';
                    tag.style.background = THEME.CONFLICT;
                    tag.innerText = `冲突: ${r.with}`;
                    appendB(sjCell, tag);
                }
            }

            // 4. 跨校区检测
            const xqCell = row.querySelector('.xq');
            if (xqCell && checkCampus && myCampus) {
                const xt = xqCell.innerText.trim();
                const myCampusName = CAMPUS_MAP[myCampus];
                if (xt && xt !== '全部' && !xt.includes(myCampusName)) {
                    const tag = document.createElement('span');
                    tag.className = 'nj-badge';
                    tag.style.background = THEME.CAMPUS;
                    tag.innerText = '跨校区';
                    appendB(xqCell, tag);
                }
            }

            row.dataset.checkedHub = 'true';
        });

        sortFavRows();
    };

    Object.assign(window.__XK__, { injectBadges });
})();