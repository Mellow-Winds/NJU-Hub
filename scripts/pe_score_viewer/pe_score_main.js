/**
 * scripts/pe_score_viewer/pe_score_main.js
 *
 * 入口文件：页面加载后自动执行
 * 并行抓取体测(PFT)和教学(PTM)成绩，数据就绪后展示弹窗
 *
 * 触发方式: 页面加载时自动注入 (无 toggle 开关，默认开启)
 * 依赖: pe_score_fetcher.js, pe_score_ui.js (需在本文件之前加载)
 *
 * 核心问题修复:
 *   ggtypt 平台有三个子系统 (/ggtypt, /pft, /ptm)，各自有独立 session。
 *   从 /ggtypt/home 页面直接 fetch /pft/myresult 或 /ptm/student/score/course 时，
 *   如果目标子系统 session 未建立，服务器会 302 重定向到 http://ggtypt.nju.edu.cn/pft/login
 *   (HTTP!)，在 HTTPS 页面中触发 Mixed Content 阻断，导致 fetch 抛出 "Failed to fetch"。
 *
 *   修复方案:
 *   1. background.js 添加 declarativeNetRequest 规则，将 http://ggtypt.nju.edu.cn/* 升级为 HTTPS
 *   2. fetch 数据前，先用隐藏 iframe 导航到 /pft/loginto 和 /ptm/loginto，
 *      通过 SSO 重定向链建立各子系统 session
 */

(function () {
    'use strict';

    const PE = window.__PE_SCORE__;
    if (!PE || !PE.fetchPftScore || !PE.fetchPtmScore) {
        console.error('[PE Score] 依赖模块未加载');
        return;
    }

    // ── 通过隐藏 iframe 建立 SSO session ──────────────────

    /**
     * 用隐藏 iframe 导航到指定 URL，等待 SSO 重定向链完成并建立 session
     * iframe 加载完成后会触发 onload，我们等待它稳定（不再重定向）
     *
     * @param {string} logintoUrl - SSO 入口 URL (如 /pft/loginto)
     * @param {number} timeout - 超时时间 (ms)
     * @returns {Promise<boolean>} 是否成功建立 session
     */
    function establishSession(logintoUrl, timeout = 8000) {
        return new Promise((resolve) => {
            let settled = false;
            let lastHref = '';
            let stableCount = 0;
            let timer = null;
            let timeoutTimer = null;

            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed; width:0; height:0; border:0; left:-9999px; top:-9999px; visibility:hidden;';
            iframe.src = logintoUrl;

            const cleanup = () => {
                if (timer) clearInterval(timer);
                if (timeoutTimer) clearTimeout(timeoutTimer);
                iframe.remove();
            };

            // 超时处理
            timeoutTimer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    resolve(false);
                }
            }, timeout);

            // 轮询 iframe 的 URL，当连续 3 次 (150ms) 不变时认为重定向链已稳定
            iframe.onload = () => {
                if (settled) return;
                // 开始轮询 URL 稳定性
                timer = setInterval(() => {
                    if (settled) return;
                    try {
                        const currentHref = iframe.contentWindow.location.href;
                        if (currentHref === lastHref) {
                            stableCount++;
                            // URL 连续 3 次不变 → session 建立完成
                            if (stableCount >= 3) {
                                settled = true;
                                cleanup();
                                resolve(true);
                            }
                        } else {
                            stableCount = 0;
                            lastHref = currentHref;
                        }
                    } catch (e) {
                        // 跨域时无法读取 location，但 onload 已触发说明加载完成
                        stableCount++;
                        if (stableCount >= 3) {
                            settled = true;
                            cleanup();
                            resolve(true);
                        }
                    }
                }, 50);
            };

            // 错误处理
            iframe.onerror = () => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    resolve(false);
                }
            };

            document.body.appendChild(iframe);
        });
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
            // 先通过隐藏 iframe 建立 PFT 和 PTM 的 SSO session
            // 这会触发 /pft/loginto → /ggtypt/login?service=... → /pft/home 的重定向链
            // 建立 session 后，后续 fetch /pft/myresult 才不会被重定向到 http://pft/login
            await Promise.allSettled([
                establishSession('/pft/loginto'),
                establishSession('/ptm/loginto')
            ]);

            // 并行抓取两个系统
            const [pftResult, ptmResult] = await Promise.allSettled([
                PE.fetchPftScore(),
                PE.fetchPtmScore()
            ]);

            const pftData = pftResult.status === 'fulfilled' ? pftResult.value : { error: '体测成绩抓取失败: ' + (pftResult.reason?.message || '未知错误') };
            const ptmData = ptmResult.status === 'fulfilled' ? ptmResult.value : { error: '教学成绩抓取失败: ' + (ptmResult.reason?.message || '未知错误'), courses: [] };

            // 判断是否至少有一个成功
            const pftOk = !pftData.error;
            const ptmOk = !ptmData.error;

            // 移除占位卡片
            mini.remove();

            if (!pftOk && !ptmOk) {
                // 两个都失败：只显示错误小卡片，不弹窗
                const errMini = document.createElement('div');
                errMini.id = 'pe-mini-card';
                errMini.innerHTML = `<div style="font-size:13px; color:#660874; font-weight:600;">成绩获取失败<br><small style="font-weight:400;opacity:0.6;">请先手动进入体测/教学页面后再刷新</small></div>`;
                errMini.style.display = 'flex';
                document.body.appendChild(errMini);
                return;
            }

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
