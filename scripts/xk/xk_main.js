/**
 * scripts/xk/xk_main.js
 *
 * 主入口：路由分发、初始化、自动确认 MutationObserver、轮询注入
 * 依赖：xk_storage.js → xk_conflict.js → xk_ai.js → xk_ui.js → xk_badges.js → xk_schedule.js
 *
 * 页面路由：
 *   - ehallapp.nju.edu.cn/jwapp/sys/wdkb → 课表页：注入抓取按钮
 *   - xk.nju.edu.cn/xsxkapp → 选课页：浮动岛 + 徽章
 */

(async function () {
    'use strict';

    // 等待 storage 初始化
    const { init, GM_getValue, STORAGE } = window.__XK__;
    await init();

    // 检查总开关
    if (GM_getValue(STORAGE.TOGGLE) === false) return;

    const currentURL = window.location.href;

    // ================== 课表页面 ==================
    if (currentURL.includes('jwapp/sys/wdkb')) {
        const { startSchedulePage } = window.__XK__;
        startSchedulePage();
        return;
    }

    // ================== 选课页面 ==================
    if (!currentURL.includes('xsxkapp')) return;

    const {
        injectStyles, renderIsland, initPopover, injectBadges, sortFavRows
    } = window.__XK__;

    // 初始化全局 pendingAITasks
    window.pendingAITasks = window.pendingAITasks || [];

    /**
     * 自动确认 MutationObserver：监听弹窗中的确认按钮
     */
    const startAutoConfirm = () => {
        const autoConfirm = GM_getValue(STORAGE.AUTO, false);
        const obs = new MutationObserver(() => {
            if (autoConfirm) {
                const btn = document.querySelector('.cv-sure, .cvBtnFlag[data-type="sure"]');
                if (btn && btn.offsetParent) {
                    setTimeout(() => btn.click(), 50);
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    };

    /**
     * 轮询注入：确保页面加载后 UI 和徽章都存在
     */
    const startPolling = () => {
        setInterval(() => {
            if (!document.getElementById('xk-island-root')) {
                injectStyles();
                renderIsland();
                initPopover();
            }
            injectBadges();
        }, 1000);
    };

    // 启动
    startAutoConfirm();
    startPolling();

    // Tab 切换时清除匹配缓存，以便重新匹配
    const tabLinks = document.querySelectorAll('#cvPageHeadTab a');
    tabLinks.forEach(a => {
        a.addEventListener('click', () => {
            document.querySelectorAll('tr.course-tr').forEach(row => {
                delete row.dataset.checkedHub;
            });
        });
    });

    console.log('[NJU-Hub] 选课助手已启动');
})();