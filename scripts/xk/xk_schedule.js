/**
 * scripts/xk/xk_schedule.js
 *
 * 课表页模块：在 ehallapp.nju.edu.cn/jwapp/sys/wdkb 注入"抓取课表"按钮
 * 依赖：window.__XK__
 */

(function () {
    'use strict';

    const { GM_getValue, GM_setValue, STORAGE, APPLE_EASE } = window.__XK__;
    const THEME_PURPLE = '#660874';

    /**
     * 在课表页面注入同步按钮
     */
    const injectSyncBtn = () => {
        if (document.getElementById('nju-sync-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'nju-sync-btn';
        btn.innerHTML = '抓取课表至选课系统';
        btn.style.cssText = `
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
            z-index: 9999; padding: 8px 20px; background: ${THEME_PURPLE};
            color: white; border-radius: 20px; cursor: pointer; font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: 0.2s ${APPLE_EASE};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

        btn.onclick = () => {
            // 优先使用 jqxGrid 的 grid body 选择器
            let rows = document.querySelectorAll('.jqx-grid-content .jqx-grid-body tr[id^="row"]');
            if (rows.length === 0) {
                rows = document.querySelectorAll('div[role="grid"] > div:last-child tr[id^="row"]');
            }
            if (rows.length === 0) {
                rows = document.querySelectorAll('tr[id^="row"]');
            }

            if (rows.length === 0) {
                alert('表格未加载，请刷新页面后重试。');
                return;
            }

            let data = [];
            const seen = new Set();

            rows.forEach(row => {
                const cells = row.querySelectorAll('td[role="gridcell"]');
                if (cells.length > 6) {
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
                GM_setValue(STORAGE.SCHEDULE, data);
                alert(`成功抓取 ${data.length} 门课程。请前往选课系统查看冲突。`);
            } else {
                alert('未能抓取到课程数据，请确认课表页面已完全加载。');
            }
        };

        document.body.appendChild(btn);
    };

    /**
     * 启动课表页面轮询（等待页面加载完毕后注入按钮）
     */
    const startSchedulePage = () => {
        setInterval(injectSyncBtn, 2000);
    };

    Object.assign(window.__XK__, { startSchedulePage });
})();