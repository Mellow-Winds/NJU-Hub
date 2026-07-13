/**
 * scripts/xk/xk_ui.js
 *
 * UI 层：CSS 注入、浮动岛渲染（iOS 滑动条 + 开关）、收藏夹 Modal、拖拽
 * 依赖：window.__XK__
 *
 * 浮动岛控件（从 options 复制，options 保留）：
 *   - 校区选择：iOS 4 段滑动条 (XL/GL/PK/SZ) → NJU_CAMPUS
 *   - 冲突预警：iOS 开关 → NJU_CONFLICT
 *   - 置顶收藏：iOS 开关 → NJU_PIN_FAV
 *   - 自动确认：iOS 开关 → NJU_AUTO
 */

(function () {
    'use strict';

    const { GM_getValue, GM_setValue, STORAGE } = window.__XK__;

    const THEME = {
        ADD: '#007AFF', CONFLICT: '#FF3B30', CAMPUS: '#FF9500', PURPLE: '#660874',
        STAR_ON: '#FF9500', STAR_OFF: '#999999'
    };

    // 内联 SVG 图标 (16x16 viewBox, 18px 显示)
    const I = {
        school: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#FF9500" d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>',
        shield: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#007AFF" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>',
        pin: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#FF9500" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>',
        bolt: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#FF9500" d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.59-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83zM11 15h2v-6h-2v6z"/></svg>',
        star: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#FF9500" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
        calendar: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#660874" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>',
        gear: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#660874" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
        robot: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#fff" d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zm-9-6c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm5.5 1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z"/></svg>',
        save: '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:2px;"><path fill="#fff" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px;margin-right:2px;"><path fill="#fff" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
        clipboard: '<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px;margin-right:2px;"><path fill="#fff" d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>'
    };

    const APPLE_EASE = 'cubic-bezier(0.19, 1, 0.22, 1)';
    const CAMPUS_MAP = { 'XL': '仙林', 'GL': '鼓楼', 'PK': '浦口', 'SZ': '苏州' };
    const CAMPUS_IDX = { 'XL': 0, 'GL': 1, 'PK': 2, 'SZ': 3 };

    // 临时配置（保存前）
    let tempConfig = {};

    /**
     * 注入全局 CSS 样式
     */
    const injectStyles = () => {
        if (document.getElementById('xk-hub-style')) return;
        const style = document.createElement('style');
        style.id = 'xk-hub-style';
        style.innerHTML = `
            #xk-island-root {
                position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
                z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                pointer-events: none;
            }
            .xk-island {
                pointer-events: auto; background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                border: 1px solid #e5e5ea; border-radius: 24px;
                width: 160px; height: 40px;
                display: flex; flex-direction: column; align-items: center; overflow: hidden;
                transition: width 0.5s ${APPLE_EASE}, height 0.5s ${APPLE_EASE};
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }
            .xk-island.expanded { width: 380px; height: 420px; box-shadow: 0 25px 70px rgba(0,0,0,0.15); }
            .status-wrapper {
                width: 160px; height: 40px; display: flex; align-items: center;
                justify-content: center; gap: 8px; flex-shrink: 0;
            }
            .status-text { font-weight: 700; font-size: 13px; color: #1c1c1e; letter-spacing: -0.2px; }
            .status-dot { width: 8px; height: 8px; border-radius: 50%; transition: 0.3s; }
            .xk-panel {
                opacity: 0; width: 100%; padding: 0 20px; display: flex; flex-direction: column;
                gap: 12px; pointer-events: none; transition: 0.2s; margin-top: 6px;
                box-sizing: border-box;
            }
            .xk-island.expanded .xk-panel { opacity: 1; pointer-events: auto; transition-delay: 0.1s; }

            /* iOS 分段控制器 */
            .ios-seg-ctrl {
                position: relative; display: flex; background: #e5e5ea; border-radius: 9px;
                padding: 2px; width: 100%; height: 32px; box-sizing: border-box;
            }
            .seg-slider {
                position: absolute; top: 2px; left: 2px; height: 28px; background: #fff;
                border-radius: 7px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: transform 0.3s ${APPLE_EASE}; z-index: 1;
            }
            .seg-btn {
                flex: 1; text-align: center; font-size: 12px; font-weight: 600; color: #666;
                z-index: 2; cursor: pointer; display: flex; align-items: center;
                justify-content: center; transition: color 0.2s; border-radius: 7px;
            }
            .seg-btn.active { color: #000; font-weight: 700; }
            .seg-campus .seg-slider { width: calc((100% - 4px) / 4); }
            .seg-campus[data-idx="0"] .seg-slider { transform: translateX(0%); }
            .seg-campus[data-idx="1"] .seg-slider { transform: translateX(100%); }
            .seg-campus[data-idx="2"] .seg-slider { transform: translateX(200%); }
            .seg-campus[data-idx="3"] .seg-slider { transform: translateX(300%); }

            /* iOS 开关 */
            .ios-sw {
                position: relative; width: 44px; height: 26px; background: #e3e3e4;
                border-radius: 13px; cursor: pointer; transition: 0.3s; flex-shrink: 0;
            }
            .ios-sw.on { background: #34C759; }
            .ios-sw::after {
                content: ''; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px;
                background: #fff; border-radius: 50%; transition: 0.3s;
                box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            }
            .ios-sw.on::after { transform: translateX(18px); }

            /* 按钮 */
            .xk-btn {
                flex: 1; padding: 10px 12px; border-radius: 10px; border: none;
                font-size: 12px; font-weight: 700; cursor: pointer; transition: transform 0.1s;
                white-space: nowrap;
            }
            .xk-btn:active { transform: scale(0.96); }
            .save-btn {
                width: 100%; padding: 12px; border-radius: 12px; border: none;
                font-size: 14px; font-weight: 800; cursor: pointer;
                background: #34C759; color: white; margin-top: 2px; transition: transform 0.1s;
            }
            .save-btn:active { transform: scale(0.96); }

            /* 收藏高亮 */
            tr.course-tr.is-fav-row:not(.cv-has-selected) > td { background-color: #fffdf2 !important; }

            /* 徽章 */
            .nj-br { display: block; margin-top: 4px; content: ""; }
            .nj-badge {
                display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px;
                font-weight: 800; color: #fff; margin: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                white-space: normal; line-height: 1.4; text-align: center; cursor: default;
                max-width: 160px; vertical-align: middle;
            }
            .fav-toggle-btn {
                display: table; margin: 0 auto 4px auto; padding: 2px 8px;
                border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer;
                transition: 0.2s; border: 1px solid #ddd; background: #f8f8f8; color: #666;
                white-space: nowrap;
            }
            .fav-toggle-btn.active {
                background: ${THEME.STAR_ON}; color: white; border-color: ${THEME.STAR_ON};
                box-shadow: 0 2px 6px rgba(255, 149, 0, 0.3);
            }
            .fav-toggle-btn:hover { transform: scale(1.05); }

            /* Modal */
            .xk-modal-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.4);
                backdrop-filter: blur(8px); z-index: 2147483647;
                display: flex; justify-content: center; align-items: center;
                opacity: 0; pointer-events: none; transition: opacity 0.4s ${APPLE_EASE};
            }
            .xk-modal-overlay.open { opacity: 1; pointer-events: auto; }
            .xk-modal {
                width: 450px; max-width: 90vw; max-height: 80vh; background: #fff;
                border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                display: flex; flex-direction: column; overflow: hidden;
                transform: scale(0.92); transition: transform 0.4s ${APPLE_EASE};
            }
            .xk-modal-overlay.open .xk-modal { transform: scale(1); }
            .xk-header {
                padding: 18px 20px; border-bottom: 1px solid #f0f0f0;
                display: flex; justify-content: space-between; align-items: center;
                font-weight: 800; font-size: 17px; background: #fff;
            }
            .xk-close { cursor: pointer; color: #888; font-size: 22px; line-height: 1; transition: 0.2s; }
            .xk-close:hover { color: #333; }
            .xk-body {
                flex: 1; overflow-y: auto; padding: 10px; display: flex;
                flex-direction: column; gap: 8px; background: #f2f2f7;
            }
            .xk-footer {
                padding: 15px 20px; border-top: 1px solid #f0f0f0;
                display: flex; gap: 10px; background: #fff; justify-content: space-between;
            }
            .fav-row {
                display: flex; align-items: center; padding: 14px; background: #fff;
                border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.2s;
            }
            .fav-row:hover { transform: scale(1.01); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
            .fav-check { margin-right: 14px; transform: scale(1.3); cursor: pointer; accent-color: ${THEME.ADD}; }
            .fav-info { flex: 1; display: flex; flex-direction: column; }
            .fav-name { font-weight: 600; color: #333; font-size: 14px; margin-bottom: 3px; }
            .fav-detail { color: #888; font-size: 12px; }

            /* 课表 Modal 行 */
            .sched-row {
                display: flex; align-items: flex-start; padding: 14px; background: #fff;
                border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.2s;
            }
            .sched-row:hover { transform: scale(1.01); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
            .sched-idx {
                width: 28px; height: 28px; border-radius: 50%; background: ${THEME.PURPLE};
                color: #fff; font-size: 12px; font-weight: 700; display: flex;
                align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px;
            }
            .sched-info { flex: 1; display: flex; flex-direction: column; }
            .sched-name { font-weight: 600; color: #333; font-size: 14px; margin-bottom: 3px; }
            .sched-time { color: #888; font-size: 12px; }
        `;
        document.head.appendChild(style);
    };

    /**
     * 更新收藏夹列表 UI
     */
    const updateFavList = (favs) => {
        const container = document.getElementById('fav-container');
        if (!container) return;
        container.innerHTML = '';
        const list = Object.entries(favs);
        if (!list.length) {
            container.innerHTML = '<div style="text-align:center;color:#999;margin-top:20px;padding:20px;">暂无收藏</div>';
            return;
        }
        list.forEach(([id, i]) => {
            const row = document.createElement('div');
            row.className = 'fav-row';
            row.innerHTML = `<input type="checkbox" class="fav-check" value="${id}"><div class="fav-info"><div class="fav-name">${i.name}</div><div class="fav-detail">${i.teacher} | ${i.time}</div></div>`;
            container.appendChild(row);
        });
    };

    /**
     * 更新课表列表 UI
     */
    const updateSchedList = () => {
        const container = document.getElementById('sched-container');
        if (!container) return;
        container.innerHTML = '';
        const schedule = GM_getValue(STORAGE.SCHEDULE, []);
        if (!schedule.length) {
            container.innerHTML = '<div style="text-align:center;color:#999;margin-top:20px;padding:20px;">暂无课表<br><small>请先在 ehall 课表页面导入</small></div>';
            return;
        }
        schedule.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'sched-row';
            row.innerHTML = `
                <div class="sched-idx">${idx + 1}</div>
                <div class="sched-info">
                    <div class="sched-name">${item.name || '(未命名)'}</div>
                    <div class="sched-time">${item.teacher || ''} ${item.time || ''}</div>
                </div>
            `;
            container.appendChild(row);
        });
    };

    /**
     * 更新课表按钮上的计数
     */
    const updateSchedCount = () => {
        const btn = document.getElementById('btn-open-sched');
        if (!btn) return;
        const schedule = GM_getValue(STORAGE.SCHEDULE, []);
        btn.innerHTML = `${I.calendar} 课表 (${schedule.length})`;
    };

    /**
     * 注入收藏夹管理 Modal + 课表查看 Modal
     */
    const injectModals = () => {
        if (document.getElementById('fav-modal-wrapper')) return;
        const div = document.createElement('div');
        div.id = 'fav-modal-wrapper';
        div.className = 'xk-modal-overlay';
        div.innerHTML = `
            <div class="xk-modal">
                <div class="xk-header"><span>${I.star} 收藏夹管理</span><span class="xk-close" id="fav-close">✕</span></div>
                <div class="xk-body" id="fav-container"></div>
                <div class="xk-footer">
                    <div style="display:flex; gap:5px;">
                        <button class="xk-btn" id="fav-select-all" style="background:#eee; color:#333; padding:8px 12px; flex:none;">全选</button>
                        <button class="xk-btn" id="fav-del-sel" style="background:#FF3B30; color:white; padding:8px 12px; flex:none;">删除</button>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="xk-btn" id="fav-export" style="background:#007AFF; color:white; padding:8px 12px; flex:none;">备份</button>
                        <button class="xk-btn" id="fav-import" style="background:#34C759; color:white; padding:8px 12px; flex:none;">恢复</button>
                        <input type="file" id="fav-imp-file" style="display:none" accept=".json">
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(div);

        const favModal = div;
        document.getElementById('fav-close').onclick = () => favModal.classList.remove('open');
        favModal.onclick = (e) => { if (e.target === favModal) favModal.classList.remove('open'); };

        document.getElementById('fav-select-all').onclick = () => {
            const checks = document.getElementById('fav-container').querySelectorAll('.fav-check');
            const all = Array.from(checks).every(c => c.checked);
            checks.forEach(c => c.checked = !all);
        };

        document.getElementById('fav-del-sel').onclick = () => {
            const checked = document.getElementById('fav-container').querySelectorAll('.fav-check:checked');
            if (checked.length === 0) return;
            if (confirm('确定删除选中课程？')) {
                let favs = GM_getValue(STORAGE.FAVORITES, {});
                checked.forEach(c => {
                    delete favs[c.value];
                    document.querySelectorAll('.fav-toggle-btn').forEach(btn => {
                        if (btn.dataset.favId === c.value) {
                            btn.classList.remove('active');
                            btn.innerHTML = '收藏';
                            const tr = btn.closest('tr.course-tr');
                            if (tr) tr.classList.remove('is-fav-row');
                        }
                    });
                });
                GM_setValue(STORAGE.FAVORITES, favs);
                updateFavList(favs);
                document.getElementById('btn-open-fav').innerHTML = `${I.star} 收藏夹 (${Object.keys(favs).length})`;
                if (window.__XK__.sortFavRows) window.__XK__.sortFavRows();
            }
        };

        document.getElementById('fav-export').onclick = () => {
            const blob = new Blob([JSON.stringify(GM_getValue(STORAGE.FAVORITES, {}), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'nju_favs.json';
            a.click();
        };

        document.getElementById('fav-import').onclick = () => document.getElementById('fav-imp-file').click();
        document.getElementById('fav-imp-file').onchange = (e) => {
            const r = new FileReader();
            r.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    Object.assign(GM_getValue(STORAGE.FAVORITES, {}), imported);
                    GM_setValue(STORAGE.FAVORITES, GM_getValue(STORAGE.FAVORITES));
                    location.reload();
                } catch (err) {
                    alert('文件格式错误，请检查。');
                }
            };
            r.readAsText(e.target.files[0]);
        };

        // ===== 课表查看 Modal =====
        const schedDiv = document.createElement('div');
        schedDiv.id = 'sched-modal-wrapper';
        schedDiv.className = 'xk-modal-overlay';
        schedDiv.innerHTML = `
            <div class="xk-modal">
                <div class="xk-header"><span>${I.calendar} 我的课表</span><span class="xk-close" id="sched-close">✕</span></div>
                <div class="xk-body" id="sched-container"></div>
                <div class="xk-footer">
                    <button class="xk-btn" id="sched-clear" style="background:#FF3B30; color:white; padding:8px 16px; flex:none;">${I.trash} 清空课表</button>
                    <div style="flex:1;"></div>
                    <button class="xk-btn" id="sched-import" style="background:${THEME.PURPLE}; color:white; padding:8px 16px; flex:none;">${I.clipboard} 导入课表</button>
                </div>
            </div>
        `;
        document.body.appendChild(schedDiv);

        const schedModal = schedDiv;
        document.getElementById('sched-close').onclick = () => schedModal.classList.remove('open');
        schedModal.onclick = (e) => { if (e.target === schedModal) schedModal.classList.remove('open'); };

        document.getElementById('sched-import').onclick = () => {
            chrome.tabs.create({ url: 'https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/index.do' });
        };

        document.getElementById('sched-clear').onclick = () => {
            const schedule = GM_getValue(STORAGE.SCHEDULE, []);
            if (schedule.length === 0) return;
            if (confirm(`确定清空全部 ${schedule.length} 门课表记录吗？`)) {
                GM_setValue(STORAGE.SCHEDULE, []);
                updateSchedList();
                updateSchedCount();
            }
        };
    };

    /**
     * 渲染浮动岛（iOS 风格控件）
     */
    const renderIsland = () => {
        if (document.getElementById('xk-island-root')) return;

        // 初始化临时配置
        tempConfig = {
            myCampus: GM_getValue(STORAGE.CAMPUS, 'XL'),
            conflictCheck: GM_getValue(STORAGE.CONFLICT, true),
            pinFav: GM_getValue(STORAGE.PIN_FAV, true),
            autoConfirm: GM_getValue(STORAGE.AUTO, false)
        };

        const root = document.createElement('div');
        root.id = 'xk-island-root';
        const favorites = GM_getValue(STORAGE.FAVORITES, {});

        const campusIdx = CAMPUS_IDX[tempConfig.myCampus] || 0;

        root.innerHTML = `
            <div id="xk-island-main" class="xk-island">
                <div class="status-wrapper">
                    <div id="xk-dot" class="status-dot"></div>
                    <span class="status-text">NJU Hub</span>
                </div>
                <div class="xk-panel">
                    <div style="font-size:12px; font-weight:700; color:#8e8e93;">${I.school} 我的主校区</div>
                    <div class="ios-seg-ctrl seg-campus" id="ctrl-campus" data-idx="${campusIdx}">
                        <div class="seg-slider"></div>
                        <div class="seg-btn ${tempConfig.myCampus === 'XL' ? 'active' : ''}" data-val="XL">仙林</div>
                        <div class="seg-btn ${tempConfig.myCampus === 'GL' ? 'active' : ''}" data-val="GL">鼓楼</div>
                        <div class="seg-btn ${tempConfig.myCampus === 'PK' ? 'active' : ''}" data-val="PK">浦口</div>
                        <div class="seg-btn ${tempConfig.myCampus === 'SZ' ? 'active' : ''}" data-val="SZ">苏州</div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px; font-weight:600; color:#1c1c1e;">${I.shield} 冲突预警</span>
                        <div id="sw-conflict" class="ios-sw ${tempConfig.conflictCheck ? 'on' : ''}"></div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px; font-weight:600; color:#1c1c1e;">${I.pin} 置顶收藏</span>
                        <div id="sw-pin" class="ios-sw ${tempConfig.pinFav ? 'on' : ''}"></div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px; font-weight:600; color:#1c1c1e;">${I.bolt} 自动确认</span>
                        <div id="sw-auto" class="ios-sw ${tempConfig.autoConfirm ? 'on' : ''}"></div>
                    </div>

                    <div style="display:flex; gap:10px; width: 100%;">
                        <button id="btn-open-fav" class="xk-btn" style="background:#f0f0f5; color:#333; border:1px solid #ddd;">${I.star} 收藏夹 (${Object.keys(favorites).length})</button>
                        <button id="btn-open-sched" class="xk-btn" style="background:#f0f0f5; color:#333; border:1px solid #ddd;">${I.calendar} 课表 (${(GM_getValue(STORAGE.SCHEDULE, [])).length})</button>
                    </div>

                    <div style="display:flex; gap:10px; width: 100%;">
                        <button id="btn-open-ai" class="xk-btn" style="background:#f3e8ff; color:${THEME.PURPLE}; border:1px solid #d8b4fe;">${I.gear} 插件设置</button>
                        <button id="btn-ai-analyze" class="xk-btn" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; border:none;">${I.robot} 一键AI分析</button>
                    </div>

                    <button id="btn-save" class="save-btn">${I.save} 保存配置</button>
                </div>
            </div>
        `;
        document.body.appendChild(root);
        injectModals();

        const island = document.getElementById('xk-island-main');

        // ===== hover 展开 =====
        island.onmouseenter = () => island.classList.add('expanded');
        island.onmouseleave = () => island.classList.remove('expanded');

        document.getElementById('xk-dot').style.backgroundColor = '#34C759';

        // ===== 校区滑动条 =====
        const campCtrl = document.getElementById('ctrl-campus');
        campCtrl.querySelectorAll('.seg-btn').forEach(b => {
            b.onclick = (e) => {
                campCtrl.dataset.idx = CAMPUS_IDX[e.target.dataset.val];
                campCtrl.querySelectorAll('.seg-btn').forEach(i => i.classList.remove('active'));
                e.target.classList.add('active');
                tempConfig.myCampus = e.target.dataset.val;
            };
        });

        // ===== iOS 开关 =====
        const bindT = (id, key) => {
            document.getElementById(id).onclick = function () {
                tempConfig[key] = !tempConfig[key];
                this.classList.toggle('on');
            };
        };
        bindT('sw-conflict', 'conflictCheck');
        bindT('sw-pin', 'pinFav');
        bindT('sw-auto', 'autoConfirm');

        // ===== 保存按钮 =====
        document.getElementById('btn-save').onclick = () => {
            GM_setValue(STORAGE.CAMPUS, tempConfig.myCampus);
            GM_setValue(STORAGE.CONFLICT, tempConfig.conflictCheck);
            GM_setValue(STORAGE.PIN_FAV, tempConfig.pinFav);
            GM_setValue(STORAGE.AUTO, tempConfig.autoConfirm);
            location.reload();
        };

        // ===== 收藏夹按钮 =====
        document.getElementById('btn-open-fav').onclick = () => {
            updateFavList(GM_getValue(STORAGE.FAVORITES, {}));
            document.getElementById('fav-modal-wrapper').classList.add('open');
        };

        // ===== 插件设置按钮 → 通过 background 打开 options 页 =====
        document.getElementById('btn-open-ai').onclick = () => {
            chrome.storage.local.set({ options_goto: 'section-course' }, () => {
                chrome.runtime.sendMessage({ action: 'openOptions' });
            });
        };

        // ===== 课表按钮 =====
        document.getElementById('btn-open-sched').onclick = () => {
            updateSchedList();
            document.getElementById('sched-modal-wrapper').classList.add('open');
        };

        // ===== 一键AI分析按钮 =====
        document.getElementById('btn-ai-analyze').onclick = () => {
            if (window.__XK__.analyzeAllPending) {
                window.__XK__.analyzeAllPending();
            }
        };
    };

    Object.assign(window.__XK__, {
        THEME,
        I,
        APPLE_EASE,
        CAMPUS_MAP,
        CAMPUS_IDX,
        injectStyles,
        updateFavList,
        updateSchedList,
        updateSchedCount,
        injectModals,
        renderIsland
    });
})();