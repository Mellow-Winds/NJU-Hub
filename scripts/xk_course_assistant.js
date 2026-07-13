/**
 * scripts/xk_course_assistant.js
 *
 * 目标页面: ehallapp.nju.edu.cn/jwapp/sys/wdkb/* (课表页)
 *           xk.nju.edu.cn/xsxkapp/* (选课系统)
 * 功能概述: 选课助手核心 — 课表抓取同步、AI 红黑榜分析、冲突检测、收藏夹管理
 * 触发方式: 页面加载时自动注入
 * 依赖模块: background.js (AI 请求转发), libs/xlsx.full.min.js (Excel 读写)
 *
 * 详细说明:
 * 1. 课表页面：注入"抓取课表至选课系统"按钮，解析 jqxGrid 将课表数据存入 storage
 * 2. 选课页面：渲染浮动工具栏（可拖拽），提供自动选择、收藏夹入口
 * 3. 冲突检测：将候选课程与已抓取课表比对，标注时间冲突和跨校区警告
 * 4. 收集管理：为每门课程添加收藏/取消按钮，支持置顶排序、JSON 导入导出
 * 5. AI 分析：从 SeaTable 公共评价库同步数据后，调用 LLM 生成"力荐/推荐/一般/劝退"标签
 * 6. 数据管理：NJU_SCHEDULE(课表)、NJU_FAVORITES(收藏)、NJU_DB(评价库)、NJU_AI_CACHE(AI缓存)
 */

(async function () {
    'use strict';

    // ================== 0. 插件环境初始化与状态同步 ==================
    let globalStorage = await chrome.storage.local.get(null);

    // 如果用户在 Popup 仪表盘中关闭了“课表侦察兵”，则直接退出
    if (globalStorage['toggle-schedule'] === false) return;

    // 模拟油猴 API，实现无缝平替并与插件 Storage 联动
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

    // ================== 1. 核心配置 ==================
    const THEME = {
        ADD: '#007AFF', GOOD: '#1b5e20', BAD: '#c62828',
        CONFLICT: '#FF3B30', CAMPUS: '#FF9500', PURPLE: '#660874',
        STAR_ON: '#FF9500', STAR_OFF: '#999999',
        P100: '#1b5e20', P80: '#4caf50', P60: '#fdd835', P40: '#ff9800', P20: '#f44336', P0: '#8e0000'
    };

    const APPLE_EASE = 'cubic-bezier(0.19, 1, 0.22, 1)';
    const CN_NUM = {'一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '日':7};
    const CAMPUS_MAP = { 'XL': '仙林', 'GL': '鼓楼', 'PK': '浦口', 'SZ': '苏州' };
    const CAMPUS_IDX = { 'XL': 0, 'GL': 1, 'PK': 2, 'SZ': 3 };

    const getAISettings = () => {
        return {
            url: GM_getValue('course_api_url') || 'https://api.siliconflow.cn/v1',
            key: GM_getValue('course_api_key', ''),
            model: GM_getValue('course_model') || 'Qwen/Qwen3-8B',
            major: GM_getValue('course_major') || '未知专业',
            pref: GM_getValue('course_pref') || '给分高，事少，不点名'
        };
    };

    // 本地关键词评价系统已移除 — 准确率过低，全部依赖 AI 深度分析

    // ================== 2. 路由分发 (课表同步) ==================
    const currentURL = window.location.href;
    if (currentURL.includes('jwapp/sys/wdkb')) {
        const injectSyncBtn = () => {
            if(document.getElementById('nju-sync-btn')) return;
            const btn = document.createElement('div');
            btn.id = 'nju-sync-btn'; btn.innerHTML = '抓取课表至选课系统';
            btn.style.cssText = `position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 9999; padding: 8px 20px; background: ${THEME.PURPLE}; color: white; border-radius: 20px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: 0.2s ${APPLE_EASE};`;
            btn.onclick = () => {
                // 限定选择器到主滚动区域的 grid body，避免冻结列重复行导致数据翻倍
                let rows = document.querySelectorAll('.jqx-grid-content .jqx-grid-body tr[id^="row"]');
                if (rows.length === 0) {
                    // fallback：尝试无冻结列的简单 grid 结构
                    rows = document.querySelectorAll('div[role="grid"] > div:last-child tr[id^="row"]');
                }
                if (rows.length === 0) {
                    // 最终 fallback：回退到原始选择器
                    rows = document.querySelectorAll('tr[id^="row"]');
                }
                if (rows.length === 0) { alert('表格未加载，请刷新页面后重试。'); return; }
                let data = [];
                const seen = new Set();
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td[role="gridcell"]');
                    if (cells.length > 6) {
                        // jqxGrid 非固定列设 visibility:hidden，innerText 返回空；改用 textContent + span title
                        const t = cells[6].querySelector('span')?.getAttribute('title') || cells[6].textContent.trim();
                        const n = cells[2].querySelector('span')?.getAttribute('title') || cells[2].textContent.trim();
                        if (t && t.length > 2) {
                            const key = `${n.replace(/\d+班$/, '').trim()}|${t}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                data.push({ name: n.replace(/\d+班$/, '').trim(), timeStr: t });
                            }
                        }
                    }
                });
                if (data.length > 0) {
                    GM_setValue('NJU_SCHEDULE', data);
                    alert(`成功抓取 ${data.length} 门课程。请前往选课系统查看冲突。`);
                } else {
                    alert('未能抓取到课程数据，请确认课表页面已完全加载。');
                }
            };
            document.body.appendChild(btn);
        };
        setInterval(injectSyncBtn, 2000);
        return;
    }

    if (!currentURL.includes('xsxkapp')) return;

    // ================== 3. 选课核心逻辑 ==================
    let config = {
        autoConfirm: GM_getValue('NJU_AUTO', false),
        conflictCheck: GM_getValue('NJU_CONFLICT', true),
        myCampus: GM_getValue('NJU_CAMPUS', 'XL'),
        checkCampus: GM_getValue('NJU_CHECK_CAMPUS', true),
        pinFav: GM_getValue('NJU_PIN_FAV', true) // 置顶配置
    };
    let tempConfig = { ...config };
    window.pendingAITasks = window.pendingAITasks || [];

    // --- 智能置顶算法 ---
    const sortFavRows = () => {
        if (!config.pinFav) return;
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

    const checkConflict = (targetTimeStr) => {
        if (!config.conflictCheck) return false;
        const mySchedule = GM_getValue('NJU_SCHEDULE', []);
        const parse = (str) => {
            const segments = str.split(/,|，/); let slots = [];
            segments.forEach(seg => {
                const d = seg.match(/周([一二三四五六日])/), s = seg.match(/(\d+)-(\d+)节/), w = seg.match(/(\d+)-(\d+)周/);
                if (d && s && w) slots.push({ day: CN_NUM[d[1]], sS: parseInt(s[1]), eS: parseInt(s[2]), sW: parseInt(w[1]), eW: parseInt(w[2]) });
            }); return slots;
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

    const calcProb = (text) => {
        const parts = text.split('/'); if (parts.length !== 2) return null;
        const enroll = parseInt(parts[0]), cap = parseInt(parts[1]);
        if (isNaN(enroll) || isNaN(cap)) return null;
        let prob = enroll === 0 ? 100 : (cap / enroll) * 100;
        if (prob > 100) prob = 100;
        let color = THEME.P0;
        if(prob>=100) color=THEME.P100; else if(prob>=80) color=THEME.P80; else if(prob>=60) color=THEME.P60; else if(prob>=40) color=THEME.P40; else if(prob>=20) color=THEME.P20;
        return { prob: Math.round(prob), color };
    };

    // ================== 4. UI 样式 ==================
    const injectStyles = () => {
        if (document.getElementById('xk-hub-style')) return;
        const style = document.createElement('style');
        style.id = 'xk-hub-style';
        style.innerHTML = `
            #xk-island-root { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 999999; font-family: sans-serif; pointer-events: none; }
            .xk-island {
                pointer-events: auto; background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(20px);
                border: 1px solid #eee; border-radius: 24px; width: 140px; height: 38px;
                display: flex; flex-direction: column; align-items: center; overflow: hidden;
                transition: width 0.5s ${APPLE_EASE}, height 0.5s ${APPLE_EASE}, transform 0.5s ${APPLE_EASE};
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            .xk-island.expanded { width: 340px; height: 180px; box-shadow: 0 25px 70px rgba(0,0,0,0.2); }
            .xk-island.dragging { transition: none !important; user-select: none; }
            .status-wrapper { width: 140px; height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; cursor: grab; }
            .status-text { font-weight: 800; font-size: 14px; color: #333; }
            .status-dot { width: 8px; height: 8px; border-radius: 50%; transition: 0.3s; }
            .xk-panel { opacity: 0; width: 100%; padding: 0 20px; display: flex; flex-direction: column; gap: 13px; pointer-events: none; transition: 0.2s; margin-top: 5px; box-sizing: border-box; }
            .xk-island.expanded .xk-panel { opacity: 1; pointer-events: auto; transition-delay: 0.1s; }
            .help-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #eee; color: #666; font-size: 11px; font-weight: bold; cursor: default !important; margin-left: 6px; }
            
            /* 收藏高亮样式 */
            tr.course-tr.is-fav-row:not(.cv-has-selected) > td { background-color: #fffdf2 !important; }
            
            .nj-br { display: block; margin-top: 4px; content: ""; }
            .nj-badge {
                display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; color: #fff;
                margin: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: normal; line-height: 1.4; text-align: center; cursor: default; max-width: 160px; vertical-align: middle;
            }
            
            .fav-toggle-btn { display: table; margin: 0 auto 4px auto; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s; border: 1px solid #ddd; background: #f8f8f8; color: #666; white-space: nowrap; }
            .fav-toggle-btn.active { background: ${THEME.STAR_ON}; color: white; border-color: ${THEME.STAR_ON}; box-shadow: 0 2px 6px rgba(255, 149, 0, 0.3); }
            .fav-toggle-btn:hover { transform: scale(1.05); }

            /* Modal 独立显示层 */
            .xk-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); z-index: 2147483647; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.4s ${APPLE_EASE}; }
            .xk-modal-overlay.open { opacity: 1; pointer-events: auto; }
            .xk-modal { width: 450px; max-width: 90vw; max-height: 80vh; background: #fff; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; transform: scale(0.92); transition: transform 0.4s ${APPLE_EASE}; }
            .xk-modal-overlay.open .xk-modal { transform: scale(1); }
            .xk-header { padding: 18px 20px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 17px; background: #fff; }
            .xk-close { cursor: pointer; color: #888; font-size: 22px; line-height: 1; transition: 0.2s; }
            .xk-close:hover { color: #333; }
            .xk-body { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; background: #f2f2f7; }
            .xk-footer { padding: 15px 20px; border-top: 1px solid #f0f0f0; display: flex; gap: 10px; background: #fff; justify-content: space-between; flex-wrap: wrap; }
            
            .fav-row { display: flex; align-items: center; padding: 14px; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.2s; }
            .fav-row:hover { transform: scale(1.01); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
            .fav-check { margin-right: 14px; transform: scale(1.3); cursor: pointer; accent-color: ${THEME.ADD}; }
            .fav-info { flex: 1; display: flex; flex-direction: column; }
            .fav-name { font-weight: 600; color: #333; font-size: 14px; margin-bottom: 3px; }
            .fav-detail { color: #888; font-size: 12px; }

            /* Controls */
            .ios-sw { position: relative; width: 44px; height: 26px; background: #e3e3e4; border-radius: 13px; cursor: pointer; transition: 0.3s; }
            .ios-sw.on { background: #34C759; }
            .ios-sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; background: #fff; border-radius: 50%; transition: 0.3s; }
            .ios-sw.on::after { transform: translateX(18px); }
            .xk-btn { flex: 1; padding: 10px; border-radius: 10px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; transition: transform 0.1s; }
            .xk-btn:active { transform: scale(0.96); }
            .save-btn { width: 100%; padding: 12px; border-radius: 12px; border: none; font-size: 14px; font-weight: 800; cursor: pointer; background: #34C759; color: white; margin-top: 2px; transition: transform 0.1s; }

            #nj-popover { position: fixed; z-index: 2147483647; width: 360px; max-height: 400px; overflow-y: auto; background: rgba(255,255,255,0.98); border-radius: 16px; padding: 18px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); opacity: 0; pointer-events: none; transform: scale(0.96) translateY(5px); transition: 0.2s; }
            #nj-popover.visible { opacity: 1; pointer-events: auto; transform: scale(1) translateY(0); }
            .pop-item { font-size: 12px; color: #555; margin-bottom: 6px; border-bottom: 1px dashed #eee; padding-bottom: 6px; }
        `;
        document.head.appendChild(style);
    };

    // ================== 5. UI 及 AI 逻辑 ==================
    let popoverTimer = null;

    const injectModals = () => {
        // 恢复原版页面内收藏夹管理模态框
        if (!document.getElementById('fav-modal-wrapper')) {
            const div = document.createElement('div');
            div.id = 'fav-modal-wrapper';
            div.className = 'xk-modal-overlay';
            div.innerHTML = `
                <div class="xk-modal">
                    <div class="xk-header"><span>收藏夹管理</span><span class="xk-close" id="fav-close">✕</span></div>
                    <div class="xk-body" id="fav-container"></div>
                    <div class="xk-footer">
                        <div style="display:flex; gap:5px;">
                            <button class="xk-btn" id="fav-select-all" style="background:#eee; color:#333; padding:8px 12px;">全选</button>
                            <button class="xk-btn" id="fav-del-sel" style="background:#FF3B30; color:white; padding:8px 12px;">删除</button>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="xk-btn" id="fav-export" style="background:#007AFF; color:white; padding:8px 12px;">备份</button>
                            <button class="xk-btn" id="fav-import" style="background:#34C759; color:white; padding:8px 12px;">恢复</button>
                            <input type="file" id="fav-imp-file" style="display:none" accept=".json">
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(div);

            const favModal = document.getElementById('fav-modal-wrapper');
            document.getElementById('fav-close').onclick = () => favModal.classList.remove('open');
            favModal.onclick = (e) => { if(e.target === favModal) favModal.classList.remove('open'); };

            document.getElementById('fav-select-all').onclick = () => {
                const checks = document.getElementById('fav-container').querySelectorAll('.fav-check');
                const all = Array.from(checks).every(c => c.checked);
                checks.forEach(c => c.checked = !all);
            };

            // 彻底修复的删除逻辑
            document.getElementById('fav-del-sel').onclick = () => {
                const checked = document.getElementById('fav-container').querySelectorAll('.fav-check:checked');
                if(checked.length === 0) return;
                if(confirm('删除选中？')) {
                    let favs = GM_getValue('NJU_FAVORITES', {});
                    checked.forEach(c => {
                        delete favs[c.value];
                        // 同步取消选课表格上的状态
                        document.querySelectorAll('.fav-toggle-btn').forEach(btn => {
                            if(btn.dataset.favId === c.value) {
                                btn.classList.remove('active');
                    btn.innerHTML='收藏';
                                const tr = btn.closest('tr.course-tr');
                                if(tr) tr.classList.remove('is-fav-row');
                            }
                        });
                    });
                    GM_setValue('NJU_FAVORITES', favs);
                    updateFavList(favs);
                    document.getElementById('btn-open-fav').innerText = `收藏夹 (${Object.keys(favs).length})`;
                    sortFavRows(); // 删除后重新排序
                }
            };

            document.getElementById('fav-export').onclick = () => {
                const blob = new Blob([JSON.stringify(GM_getValue('NJU_FAVORITES', {}), null, 2)], {type:'application/json'});
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nju_favs.json'; a.click();
            };
            document.getElementById('fav-import').onclick = () => document.getElementById('fav-imp-file').click();
            document.getElementById('fav-imp-file').onchange = (e) => {
                const r = new FileReader(); r.onload = (ev) => {
                    try { Object.assign(GM_getValue('NJU_FAVORITES', {}), JSON.parse(ev.target.result)); GM_setValue('NJU_FAVORITES', GM_getValue('NJU_FAVORITES')); location.reload(); } catch(e){ alert('文件错误'); }
                }; r.readAsText(e.target.files[0]);
            };
        }
    };

    const updateFavList = (favs) => {
        const container = document.getElementById('fav-container');
        container.innerHTML = '';
        const list = Object.entries(favs);
        if(!list.length) { container.innerHTML = '<div style="text-align:center;color:#999;margin-top:20px;padding:20px;">暂无收藏</div>'; return; }
        list.forEach(([id, i]) => {
            const row = document.createElement('div'); row.className = 'fav-row';
            row.innerHTML = `<input type="checkbox" class="fav-check" value="${id}"><div class="fav-info"><div class="fav-name">${i.name}</div><div class="fav-detail">${i.teacher} | ${i.time}</div></div>`;
            container.appendChild(row);
        });
    };

    const setAITagState = (tag, data, cacheKey) => {
        const score = parseFloat(data['综合评分']);
        let label = '一般'; let color = THEME.P60;
        if (score >= 8.5) { label = '力荐'; color = THEME.GOOD; }
        else if (score >= 7.0) { label = '推荐'; color = THEME.P80; }
        else if (score >= 5.0) { label = '一般'; color = THEME.P40; }
        else { label = '劝退'; color = THEME.BAD; }

        tag.innerText = `${label} (${score})`;
        tag.style.background = color; tag.style.color = '#fff';
        tag.style.cursor = 'pointer';
        if (cacheKey) tag.dataset.ckey = cacheKey;

        tag.onmouseenter = () => {
            if (tag._showingComments) return; // 正在查看原文时悬停不覆盖
            clearTimeout(popoverTimer);
            const pop = document.getElementById('nj-popover');
            pop.innerHTML = `
                <div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">AI 深度解析报告</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>给分:</b> ${data['给分']}</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>任务:</b> ${data['事少']}</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>签到:</b> ${data['签到']}</div>
                <div style="font-size:12px; margin-top:8px; padding-top:8px; border-top:1px dashed #ccc; color:#1b5e20; font-weight:bold;">结论: ${data['总结']}</div>
            `;
            pop.style.maxHeight = '400px';
            const r = tag.getBoundingClientRect();
            pop.style.left = Math.min(r.left, window.innerWidth - 380) + 'px';
            pop.style.top = (r.bottom + 8) + 'px';
            pop.classList.add('visible');
        };
        tag.onmouseleave = () => {
            if (tag._showingComments) return;
            popoverTimer = setTimeout(() => document.getElementById('nj-popover').classList.remove('visible'), 300);
        };

        // 点击查看所有原始评价
        tag.onclick = (e) => {
            e.stopPropagation();
            if (!cacheKey) return;
            const db = GM_getValue('NJU_DB', {});
            const rawComments = db[cacheKey];
            if (!rawComments || !Array.isArray(rawComments) || rawComments.length === 0) return;

            const pop = document.getElementById('nj-popover');
            clearTimeout(popoverTimer);

            // 切换：如果正在显示原文，点击关闭
            if (tag._showingComments) {
                pop.classList.remove('visible');
                tag._showingComments = false;
                return;
            }

            tag._showingComments = true;

            // 构建原文列表
            let html = `<div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">📋 原始评价 (${rawComments.length}条) — 点击关闭</div>`;
            rawComments.forEach((c, i) => {
                const safe = String(c).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                html += `<div style="font-size:12px;color:#333;margin-bottom:10px;padding:8px 10px;background:#f8f8f8;border-radius:8px;border-left:3px solid ${THEME.PURPLE};line-height:1.7;">${safe}</div>`;
            });
            pop.innerHTML = html;
            pop.style.maxHeight = '520px';

            const r = tag.getBoundingClientRect();
            pop.style.left = Math.min(r.left, window.innerWidth - 380) + 'px';
            pop.style.top = (r.bottom + 8) + 'px';
            pop.classList.add('visible');

            // 点击空白关闭
            const close = (ev) => {
                if (!pop.contains(ev.target) && ev.target !== tag) {
                    pop.classList.remove('visible');
                    tag._showingComments = false;
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 10);
        };
    };

    const renderIsland = () => {
        if (document.getElementById('xk-island-root')) return;
        const root = document.createElement('div');
        root.id = 'xk-island-root';
        let favorites = GM_getValue('NJU_FAVORITES', {});

        root.innerHTML = `
            <div id="xk-island-main" class="xk-island">
                <div class="status-wrapper"><div id="xk-dot" class="status-dot"></div><span class="status-text">选课工具栏</span></div>
                <div class="xk-panel">
                    <div id="row-auto" style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px; font-weight:700;">自动选择</span>
                        <div id="sw-auto" class="ios-sw ${tempConfig.autoConfirm ? 'on' : ''}"></div>
                    </div>
                    <div style="display:flex; gap:10px; width: 100%;">
                        <button id="btn-open-fav" class="xk-btn" style="background:#f0f0f5; color:#333; border:1px solid #ddd;">收藏夹 (${Object.keys(favorites).length})</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(root);
        injectModals();

        const island = document.getElementById('xk-island-main');

        // ===== 拖拽功能 =====
        let dragState = { isDragging: false, hasMoved: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 };
        let suppressHover = false;

        // 恢复持久化位置
        const savedPos = GM_getValue('NJU_ISLAND_POS', null);
        if (savedPos && savedPos.left && savedPos.top) {
            root.style.left = savedPos.left;
            root.style.top = savedPos.top;
            root.style.transform = 'none';
        }

        const statusWrapper = island.querySelector('.status-wrapper');

        statusWrapper.addEventListener('mousedown', (e) => {
            dragState.isDragging = true;
            dragState.hasMoved = false;
            suppressHover = true;
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;
            const rect = root.getBoundingClientRect();
            dragState.startLeft = rect.left;
            dragState.startTop = rect.top;
            statusWrapper.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragState.isDragging) return;
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            if (!dragState.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                dragState.hasMoved = true;
                island.classList.add('dragging');
                island.classList.remove('expanded');
            }
            if (dragState.hasMoved) {
                root.style.left = (dragState.startLeft + dx) + 'px';
                root.style.top = (dragState.startTop + dy) + 'px';
                root.style.transform = 'none';
            }
        });

        document.addEventListener('mouseup', () => {
            if (!dragState.isDragging) return;
            island.classList.remove('dragging');
            statusWrapper.style.cursor = '';
            if (dragState.hasMoved) {
                GM_setValue('NJU_ISLAND_POS', { left: root.style.left, top: root.style.top });
            }
            dragState.isDragging = false;
            dragState.hasMoved = false;
            setTimeout(() => { suppressHover = false; }, 150);
        });

        // ===== hover 展开 (拖拽感知) =====
        island.onmouseenter = () => { if (!suppressHover) island.classList.add('expanded'); };
        island.onmouseleave = () => { if (!suppressHover) island.classList.remove('expanded'); };

        document.getElementById('xk-dot').style.backgroundColor = '#34C759';

        // 自动选择开关
        document.getElementById('sw-auto').onclick = function() {
            tempConfig.autoConfirm = !tempConfig.autoConfirm;
            this.classList.toggle('on');
            GM_setValue('NJU_AUTO', tempConfig.autoConfirm);
        };

        // 收藏夹 Modal
        document.getElementById('btn-open-fav').onclick = () => {
            updateFavList(GM_getValue('NJU_FAVORITES', {}));
            document.getElementById('fav-modal-wrapper').classList.add('open');
        };
    };

    const initPopover = () => {
        if(document.getElementById('nj-popover')) return;
        const pop = document.createElement('div'); pop.id = 'nj-popover'; document.body.appendChild(pop);
        pop.onmouseenter = () => clearTimeout(popoverTimer);
        pop.onmouseleave = () => popoverTimer = setTimeout(() => pop.classList.remove('visible'), 300);
    };

    const appendB = (cell, el) => {
        if(!cell.querySelector('.nj-br')) { const br=document.createElement('br'); br.className='nj-br'; cell.appendChild(br); }
        cell.appendChild(el);
    };

    const injectBadges = () => {
        const db = GM_getValue('NJU_DB', {});
        const aiCache = GM_getValue('NJU_AI_CACHE', {});
        let favs = GM_getValue('NJU_FAVORITES', {});

        document.querySelectorAll('tr.course-tr').forEach(row => {
            if(row.dataset.checkedHub) return;

            const name = row.querySelector('.kcmc')?.innerText || '未知';
            const teacher = row.querySelector('.jsmc')?.innerText || '未知';
            const time = row.querySelector('.sjdd')?.innerText || '';

            // 0. 精确收藏逻辑与置顶初始化
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
                        favs = GM_getValue('NJU_FAVORITES', {});
                        if (favs[compositeId]) {
                            delete favs[compositeId];
                            btn.classList.remove('active'); btn.innerHTML = '收藏';
                            row.classList.remove('is-fav-row');
                        } else {
                            favs[compositeId] = { name, teacher, time, added: Date.now() };
                            btn.classList.add('active'); btn.innerHTML = '已收藏';
                            row.classList.add('is-fav-row');
                        }
                        GM_setValue('NJU_FAVORITES', favs);
                        const b = document.getElementById('btn-open-fav'); if(b) b.innerText = `收藏夹 (${Object.keys(favs).length})`;
                        sortFavRows();
                    };
                    kchCell.prepend(btn);
                }
            }

            // 1. 概率
            const numCell = row.querySelector('.yxrs');
            if (numCell) {
                const p = calcProb(numCell.innerText.trim());
                if(p) { const t = document.createElement('span'); t.className = 'nj-badge'; t.style.background = p.color; t.innerText = `选中概率: ${p.prob}%`; appendB(numCell, t); }
            }

            // 2. 双系统并存评价
            const jsmcCell = row.querySelector('.jsmc');
            if (jsmcCell && Object.keys(db).length) {
                const rowText = row.innerText.replace(/\s/g, '');
                for(const k in db) {
                    const [c,t] = k.split('#');
                    if(rowText.includes(c.replace(/\s/g,''))) {
                        const ts = t.split(/[\s,，、]+/);
                        if(ts.some(n=>n&&rowText.includes(n))) {
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
                                window.pendingAITasks.push({ course: c, teacher: t, comments: comms, cacheKey: cacheKey, cell: jsmcCell });
                            }
                            break;
                        }
                    }
                }
            }

            // 3. 冲突 / 跨校区
            const sjCell = row.querySelector('.sjdd'); const xqCell = row.querySelector('.xq');
            if(sjCell && config.conflictCheck) {
                const st = sjCell.innerText;
                if(st && checkConflict(st)) { const r = checkConflict(st); const tag = document.createElement('span'); tag.className='nj-badge'; tag.style.background=THEME.CONFLICT; tag.innerText=`冲突: ${r.with}`; appendB(sjCell, tag); }
            }
            if(xqCell && config.checkCampus && config.myCampus) {
                const xt = xqCell.innerText.trim();
                const myCampusName = CAMPUS_MAP[config.myCampus];
                if(xt && xt !== '全部' && !xt.includes(myCampusName)) {
                    const tag = document.createElement('span'); tag.className='nj-badge'; tag.style.background=THEME.CAMPUS; tag.innerText=`跨校区`; appendB(xqCell, tag);
                }
            }

            row.dataset.checkedHub = "true";
        });

        sortFavRows();
    };

    const startObserver = () => {
        const obs = new MutationObserver(() => {
            if (config.autoConfirm) { const btn = document.querySelector('.cv-sure, .cvBtnFlag[data-type="sure"]'); if (btn && btn.offsetParent) setTimeout(() => btn.click(), 50); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    };

    setInterval(() => { if(!document.getElementById('xk-island-root')) { injectStyles(); renderIsland(); initPopover(); } injectBadges(); }, 1000);
    startObserver();
})();