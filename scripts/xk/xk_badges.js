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
 * 注入所有徽章：收藏按钮、概率、冲突、跨校区、💬评价 + AI 标签
 */
    const injectBadges = () => {
        const db = window.__ratingsDB__ || {};
        const aiCache = GM_getValue(STORAGE.AI_CACHE, {});
        const conflictCheck = GM_getValue(STORAGE.CONFLICT, true);
        const myCampus = GM_getValue(STORAGE.CAMPUS, 'XL');
        const checkCampus = GM_getValue(STORAGE.CHECK_CAMPUS, true);
        let favs = GM_getValue(STORAGE.FAVORITES, {});

        document.querySelectorAll('tr.course-tr').forEach(row => {
            if (row.dataset.checkedHub) return;

            const name = row.querySelector('.kcmc')?.innerText?.trim() || '';
            const teacher = row.querySelector('.jsmc')?.innerText?.trim() || '';
            const time = row.querySelector('.sjdd')?.innerText?.trim() || '';

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
                        if (b) b.innerHTML = `${window.__XK__.I.star} 收藏夹 (${Object.keys(favs).length})`;
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

            // 2. 💬评价 + AI 标签（三级匹配：教师+课程名）
            const jsmcCell = row.querySelector('.jsmc');
            if (jsmcCell && Object.keys(db).length) {
                const rowText = row.innerText.replace(/\s/g, '');
                const nameClean = name.replace(/\s/g, '');

                for (const k in db) {
                    const [c, t] = k.split('#');
                    const cClean = c.replace(/\s/g, '');
                    const ts = t.split(/[\s,，、]+/);

                    // === 三级回退匹配 ===
                    let matched = false;
                    // Level 1: 精确匹配
                    if (name === c && teacher === t) {
                        matched = true;
                    }
                    // Level 2: 去空格精确匹配
                    else if (nameClean === cClean && ts.some(n => n && teacher.includes(n))) {
                        matched = true;
                    }
                    // Level 3: 包含匹配
                    else if (rowText.includes(cClean) && ts.some(n => n && rowText.includes(n))) {
                        matched = true;
                    }

                    if (!matched) continue;

                    let rawData = db[k];
                    // 新格式：按来源分组 {"2020": [...], "2021": [...]}
                    // 旧格式：直接数组 ["评价", ...]
                    let comms;
                    if (Array.isArray(rawData)) {
                        comms = rawData;
                    } else if (rawData && typeof rawData === 'object') {
                        comms = [];
                        for (const srcRevs of Object.values(rawData)) {
                            if (Array.isArray(srcRevs)) comms.push(...srcRevs);
                        }
                    }
                    if (!comms || comms.length === 0) break;

                    // --- 💬 N条评价 徽章 ---
                    const rawTag = document.createElement('span');
                    rawTag.className = 'nj-badge';
                    rawTag.style.background = '#8e8e93';
                    rawTag.style.cursor = 'help';
                    rawTag.innerText = `💬 ${comms.length}条评价`;
                    rawTag.onmouseenter = () => {
                        clearTimeout(window.__popoverTimer);
                        const pop = document.getElementById('nj-popover');
                        if (!pop) return;
                        const SRC_LABELS = {
                            'nju_course_ratings': '📖 鼓励你学哪门课',
                            '2020': '🏷️ 2020 红黑榜', '2021': '🏷️ 2021 南小宝',
                            '2022': '🏷️ 2022 红黑榜', '2023': '🏷️ 2023 红黑榜',
                            '2024冬': '🏷️ 2024冬 红黑榜', '2024春': '🏷️ 2024春 红黑榜',
                            '2025春': '🏷️ 2025春 红黑榜'
                        };
                        let h = `<div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">📌 原始评价库 (${comms.length}条)</div>`;
                        if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
                            for (const [src, label] of Object.entries(SRC_LABELS)) {
                                const revs = rawData[src];
                                if (!revs || !Array.isArray(revs) || revs.length === 0) continue;
                                h += `<div style="font-weight:700;color:#333;margin:10px 0 4px;font-size:13px;">${label} (${revs.length}条)</div>`;
                                revs.forEach(x => {
                                    const safe = String(x).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                    h += `<div class="pop-item">● ${safe}</div>`;
                                });
                            }
                        } else {
                            comms.forEach(x => {
                                const safe = String(x).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                h += `<div class="pop-item">● ${safe}</div>`;
                            });
                        }
                        h += `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #ccc;text-align:center;font-size:11px;color:#888;">📝 贡献评价请访问 <a href="https://table.nju.edu.cn/apps/custom/ad-astra/?page_id=AeyG" target="_blank" style="color:#660874;font-weight:bold;">鼓励你学哪门课评价平台</a></div>`;
                        pop.innerHTML = h;
                        pop.style.maxHeight = '400px';
                        const re = rawTag.getBoundingClientRect();
                        pop.style.left = Math.min(re.left, window.innerWidth - 380) + 'px';
                        pop.style.top = (re.bottom + 8) + 'px';
                        pop.classList.add('visible');
                    };
                    rawTag.onmouseleave = () => {
                        window.__popoverTimer = setTimeout(() => {
                            const pop = document.getElementById('nj-popover');
                            if (pop) pop.classList.remove('visible');
                        }, 300);
                    };
                    appendB(jsmcCell, rawTag);

                    // --- AI 标签 ---
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