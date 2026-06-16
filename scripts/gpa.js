// scripts/gpa.js - GPA 快速查看 (原生逻辑移植版)

(function () {
    'use strict';

    // 1. 读取总开关
    chrome.storage.local.get(['toggle-gpa'], (cfg) => {
        if (cfg['toggle-gpa'] === false) return;

        const NJU_PURPLE = '#660874';

        // --- 样式注入 (保持原有的 iOS 风格) ---
        const injectStyles = () => {
            if (document.getElementById('gpa-styles')) return;
            const style = document.createElement('style');
            style.id = 'gpa-styles';
            style.innerHTML = `
                #gpa-ios-card {
                    position: fixed; right: 25px; top: 50%; transform: translateY(-50%);
                    z-index: 10000; width: 190px; display: flex; flex-direction: column;
                    background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(20px) saturate(160%);
                    -webkit-backdrop-filter: blur(20px) saturate(160%);
                    border: 0.5px solid rgba(0, 0, 0, 0.1); border-radius: 28px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12); padding: 24px 18px;
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
                    text-align: center; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .loading-title { font-size: 19px; font-weight: 600; color: ${NJU_PURPLE}; margin-bottom: 6px; }
                .not-logged-title { font-size: 24px; font-weight: 700; color: ${NJU_PURPLE}; margin-bottom: 8px; }
                .loading-sub { font-size: 11px; color: rgba(0, 0, 0, 0.4); line-height: 1.4; }
                .gpa-header { font-size: 12px; color: rgba(0, 0, 0, 0.5); margin-bottom: 2px; }
                .gpa-main-value { font-size: 35px; font-weight: 700; color: #000; margin: 4px 0; font-variant-numeric: tabular-nums; }
                .rank-container { margin-top: 16px; padding-top: 16px; border-top: 0.5px solid rgba(0, 0, 0, 0.08); }
                .rank-label { font-size: 12px; color: rgba(0, 0, 0, 0.5); margin-bottom: 4px; }
                .rank-text { font-size: 18px; font-weight: 600; color: ${NJU_PURPLE}; }
                .progress-bar { width: 100%; height: 4px; background: rgba(0, 0, 0, 0.05); border-radius: 2px; margin-top: 12px; overflow: hidden; }
                .progress-fill { height: 100%; background: ${NJU_PURPLE}; width: 0%; transition: width 1.6s ease-out; }
            `;
            document.head.appendChild(style);
        };

        // --- 数字动画 ---
        const animateValue = (element, start, end, duration, decimals = 0) => {
            if (!element) return;
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const value = progress * (end - start) + start;
                element.innerHTML = value.toFixed(decimals);
                if (progress < 1) window.requestAnimationFrame(step);
            };
            window.requestAnimationFrame(step);
        };

        // --- 核心逻辑 ---
        async function calcRank() {
            const url = "http://elite.nju.edu.cn/exchangesystem/index/create?pid=380";
            try {
                const response = await fetch(url);
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const gpaElement = doc.querySelector('body > div > div:nth-child(4) > div:nth-child(11) > div:nth-child(3) > div.xm_text_span > span');
                if (!gpaElement) return null;

                const gpa = parseFloat(gpaElement.innerText);
                const rankPercentStr = doc.querySelector('input[name="data.pmbfb"]')?.value || "0%";
                const total = parseInt(doc.querySelector('input[name="data.zyzrs"]')?.value || "0");

                const rank = Math.round(parseFloat(rankPercentStr) * total / 100);
                return [gpa, rank, total];
            } catch (e) {
                console.error('[GPA] 抓取失败:', e);
                return null;
            }
        }

        const init = () => {
            if (document.getElementById('gpa-ios-card')) return;
            injectStyles();

            const card = document.createElement('div');
            card.id = 'gpa-ios-card';
            document.body.appendChild(card);

            const loginDiv = document.querySelector('.login-in');

            if (!loginDiv) {
                card.innerHTML = `
                    <div class="not-logged-title">未登录</div>
                    <div class="loading-sub">请先登录交换生系统，此处将自动展现GPA</div>
                `;
                return;
            }

            card.innerHTML = `
                <div class="loading-title">同步中</div>
                <div class="loading-sub">正在获取数据...</div>
            `;

            calcRank().then(data => {
                if (data) {
                    const [gpa, rank, total] = data;
                    const percent = total > 0 ? ((1 - rank / total) * 100).toFixed(1) : 0;

                    // 【核心修复点】：将抓取到的数据写入扩展存储，这样 Popup 就能读到了！
                    chrome.storage.local.set({
                        gpa_cache: {
                            gpa: gpa.toFixed(3),
                            rank: rank,
                            total: total,
                            percent: percent
                        }
                    }, () => {
                        console.log('[GPA] 数据已同步至控制中心');
                    });

                    card.innerHTML = `
                        <div class="gpa-header">平均绩点（GPA）</div>
                        <div class="gpa-main-value" id="count-gpa">0.000</div>
                        <div class="rank-container">
                            <div class="rank-label">排名</div>
                            <div class="rank-text">
                                <span id="count-rank">0</span> <span style="font-size:12px; color:rgba(0,0,0,0.3); font-weight:400;">/ ${total}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" id="gpa-bar"></div>
                            </div>
                            <div style="font-size:10px; color:${NJU_PURPLE}; margin-top:8px; font-weight:500; opacity:0.6;">超越了 ${percent}% 的同学</div>
                        </div>
                    `;

                    setTimeout(() => {
                        animateValue(document.getElementById('count-gpa'), 0, gpa, 1200, 3);
                        animateValue(document.getElementById('count-rank'), 0, rank, 1200, 0);
                        document.getElementById('gpa-bar').style.width = `${percent}%`;
                    }, 100);
                } else {
                    card.innerHTML = `<div style="font-size:12px; color:${NJU_PURPLE};">同步失败<br><small>系统响应超时或未解析</small></div>`;
                }
            });
        };

        if (document.readyState === 'complete') init();
        else window.addEventListener('load', init);
    });
})();