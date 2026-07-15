/**
 * scripts/pe_score_viewer/pe_score_main.js
 *
 * 入口文件：页面加载后自动执行
 * 并行抓取体测(PFT)和教学(PTM)成绩，数据就绪后展示弹窗
 *
 * 触发方式: 页面加载时自动注入 (无 toggle 开关，默认开启)
 * 依赖: pe_score_fetcher.js, pe_score_ui.js (需在本文件之前加载)
 */

(function () {
    'use strict';

    const PE = window.__PE_SCORE__;
    if (!PE || !PE.fetchPftScore || !PE.fetchPtmScore) {
        console.error('[PE Score] 依赖模块未加载');
        return;
    }

    // ── 初始化 ────────────────────────────────────────────

    async function init() {
        // 防重复注入：用户在平台内导航时可能多次触发 content script
        if (document.getElementById('pe-mini-card') || document.getElementById('pe-modal-overlay')) {
            return;
        }

        // 注入样式
        PE.injectStyles();

        // 创建占位小卡片
        const mini = document.createElement('div');
        mini.id = 'pe-mini-card';
        mini.innerHTML = '<div style="font-size:15px; font-weight:600; color:#660874;">正在获取成绩数据...</div>';
        mini.style.display = 'flex';
        document.body.appendChild(mini);

        try {
            // 并行抓取两个系统
            const [pftResult, ptmResult] = await Promise.allSettled([
                PE.fetchPftScore(),
                PE.fetchPtmScore()
            ]);

            const pftData = pftResult.status === 'fulfilled' ? pftResult.value : { error: '体测成绩抓取失败: ' + (pftResult.reason?.message || '未知错误') };
            const ptmData = ptmResult.status === 'fulfilled' ? ptmResult.value : { error: '教学成绩抓取失败: ' + (ptmResult.reason?.message || '未知错误'), courses: [] };

            // 移除占位卡片
            mini.remove();

            // 展示小卡片（所有页面都显示）
            PE.showMiniCard(pftData, ptmData);

            // 仅在首页自动弹出详情弹窗，其他页面不主动弹出
            const isHomePage = location.pathname === '/ggtypt/home' || location.pathname === '/ggtypt/home/';
            if (isHomePage) {
                PE.showModal(pftData, ptmData);
            }

        } catch (e) {
            mini.innerHTML = `<div style="font-size:13px; color:#660874; font-weight:600;">获取失败<br><small style="font-weight:400;opacity:0.6;">${e.message || '未知错误'}</small></div>`;
        }
    }

    // 等待 DOM 就绪后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
