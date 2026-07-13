/**
 * scripts/elite_gpa_viewer.js
 *
 * 目标页面: elite.nju.edu.cn/exchangesystem/* (交换生/精英系统)
 * 功能概述: 在交换生系统首页显示 GPA 浮动卡片，支持单栏大字展示
 * 触发方式: 页面加载时自动注入
 * 依赖模块: 无
 *
 * 详细说明:
 * 1. 页面右侧注入固定定位的 GPA 迷你卡片，显示 GPA 数值
 * 2. 点击卡片可展开大弹窗，展示详细排名信息
 * 3. 兼容油猴脚本格式（保留 @match 元数据），也可作为独立脚本使用
 */

// ==UserScript==
// @name         南京大学快速查看GPA (清晰单栏定制版)
// @namespace    http://tampermonkey.net/
// @version      2026-07-13
// @description  在南大交换生系统首页直观显示GPA、姓名学号与细化排名，支持单栏大字展示与高强兼容性文本手动复制
// @author       Coxine, MellowWinds & AI Assistant
// @match        http://elite.nju.edu.cn/exchangesystem/
// @match        http://elite.nju.edu.cn/exchangesystem/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nju.edu.cn
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const NJU_PURPLE = '#660874';

    const injectStyles = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            /* 右侧常驻小窗样式 */
            #gpa-mini-card {
                position: fixed;
                right: 25px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 10000;
                width: 210px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px) saturate(160%);
                -webkit-backdrop-filter: blur(20px) saturate(160%);
                border: 0.5px solid rgba(0, 0, 0, 0.15);
                border-radius: 24px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                padding: 24px 18px;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
                text-align: center;
            }
            .mini-title { font-size: 14px; color: rgba(0, 0, 0, 0.5); margin-bottom: 4px; }
            .mini-gpa { font-size: 32px; font-weight: 700; color: #000; margin: 2px 0; }
            .mini-btn {
                margin-top: 14px;
                padding: 8px 16px;
                background: ${NJU_PURPLE};
                color: #fff;
                border-radius: 14px;
                font-size: 13px;
                cursor: pointer;
                border: none;
                font-weight: 600;
                transition: opacity 0.2s;
            }
            .mini-btn:hover { opacity: 0.9; }

            /* 大弹窗遮罩及单栏大空间容器 */
            #gpa-modal-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 10001;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
            }
            #gpa-maxi-card {
                background: rgba(255, 255, 255, 0.97);
                backdrop-filter: blur(30px) saturate(170%);
                -webkit-backdrop-filter: blur(30px) saturate(170%);
                width: 580px;
                max-height: 90vh;
                overflow-y: auto;
                border-radius: 32px;
                border: 0.5px solid rgba(255, 255, 255, 0.5);
                box-shadow: 0 30px 80px rgba(0, 0, 0, 0.2);
                padding: 40px;
                position: relative;
                box-sizing: border-box;
            }

            /* 修复滚动条直角溢出圆角的问题 */
            #gpa-maxi-card::-webkit-scrollbar {
                width: 6px;
            }
            #gpa-maxi-card::-webkit-scrollbar-track {
                background: transparent;
                margin: 32px 0;
            }
            #gpa-maxi-card::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.15);
                border-radius: 10px;
            }

            .modal-close {
                position: absolute;
                top: 24px; right: 24px;
                width: 32px; height: 32px;
                border-radius: 50%;
                background: rgba(0,0,0,0.06);
                color: rgba(0,0,0,0.5);
                display: flex; align-items: center; justify-content: center;
                font-size: 16px; cursor: pointer; transition: background 0.2s;
                z-index: 10;
            }
            .modal-close:hover { background: rgba(0,0,0,0.1); }

            /* 大弹窗文本字号 */
            .time-stamp { font-size: 15px; color: rgba(0,0,0,0.45); margin-bottom: 25px; text-align: center; font-weight: 500; }

            /* 用户基础身份卡片 */
            .user-profile-box {
                background: rgba(102, 8, 116, 0.04);
                border: 1px solid rgba(102, 8, 116, 0.08);
                border-radius: 18px;
                padding: 16px 24px;
                margin-bottom: 25px;
                display: flex;
                justify-content: space-between;
                font-size: 16px;
                color: #333;
                font-weight: 600;
            }

            /* GPA 大显示区 */
            .main-gpa-box { text-align: center; margin-bottom: 30px; }
            .gpa-label { font-size: 18px; color: rgba(0,0,0,0.6); letter-spacing: 0.5px; }
            .gpa-value { font-size: 60px; font-weight: 800; color: #000; margin: 10px 0; letter-spacing: -1px; }

            /* 单栏布局排列结构 */
            .info-grid-vertical {
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-bottom: 35px;
            }
            .info-item-single {
                background: rgba(255,255,255,0.85);
                border: 1px solid rgba(0,0,0,0.08);
                padding: 20px 24px;
                border-radius: 20px;
                box-sizing: border-box;
            }
            .item-label { font-size: 16px; font-weight: 700; color: rgba(0,0,0,0.6); margin-bottom: 8px; }
            .item-val { font-size: 24px; font-weight: 800; color: #111; }
            .item-val.purple { color: ${NJU_PURPLE}; }
            .item-sub-desc { font-size: 15px; color: rgba(0,0,0,0.5); font-weight: 600; margin-top: 4px; }

            .item-explain-custom { font-size: 14px; color: rgba(0,0,0,0.5); line-height: 1.6; margin-top: 10px; border-top: 0.5px dashed rgba(0,0,0,0.12); padding-top: 10px; font-weight: 500; }
            .item-explain-custom strong { color: #000; font-weight: 700; }

            .copy-btn {
                width: 100%;
                padding: 16px;
                background: ${NJU_PURPLE};
                color: #fff;
                border: none;
                border-radius: 18px;
                font-size: 17px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.2s;
                box-shadow: 0 4px 14px rgba(102, 8, 116, 0.2);
            }
            .copy-btn:hover { background: #52065c; }

            /* 全新独立高层级手动复制遮罩弹窗 */
            #gpa-copy-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 10002;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
            }
            #gpa-copy-card {
                background: #ffffff;
                width: 500px;
                height: 480px;
                border-radius: 28px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                padding: 30px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .text-box-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 10px; text-align: center;}
            .text-box-tips { font-size: 14px; color: ${NJU_PURPLE}; font-weight: 700; margin-bottom: 16px; text-align: center; background: rgba(102,8,116,0.06); padding: 10px; border-radius: 10px; line-height: 1.4;}

            /* 修复文本块左对齐核心属性：text-align: left 并增加合理的左右内边距 */
            .copy-textarea {
                flex: 1;
                width: 100%;
                border: 1px solid rgba(0,0,0,0.18);
                border-radius: 14px;
                padding: 20px 35px; /* 增加内边距使其居中感更好 */
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", monospace;
                font-size: 15px;
                line-height: 1.6;
                resize: none;
                background: #fafafa;
                margin-bottom: 18px;
                outline: none;
                color: #222;
                text-align: left; /* 强制文本框内部所有文字内容绝对左对齐 */
                box-sizing: border-box;
            }
            .text-box-close { width: 100%; padding: 14px; background: #333; color: #fff; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; text-align: center;}
            .text-box-close:hover { background: #111; }
        `;
        document.head.appendChild(style);
    };

    const getFormattedDate = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d = now.getDate();
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${y}年${m}月${d}日 ${h}:${min}`;
    };

    const fetchUserProfile = () => {
        let name = "未知";
        let uid = "未知";
        const loginInDiv = document.querySelector('.login-in');
        if (loginInDiv) {
            const pElements = loginInDiv.querySelectorAll('p');
            pElements.forEach(p => {
                const text = p.innerText || "";
                if (text.includes("姓名：")) {
                    name = p.querySelector('span')?.innerText?.trim() || name;
                } else if (text.includes("学/工号：")) {
                    uid = p.querySelector('span')?.innerText?.trim() || uid;
                }
            });
        }
        return { name, uid };
    };

    const showModal = (data) => {
        if (document.getElementById('gpa-modal-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'gpa-modal-overlay';

        const originalPercent = parseFloat(data.rankPercentStr);
        const regularPercent = (100 - originalPercent).toFixed(1);
        const profile = fetchUserProfile();
        const currentTimeString = getFormattedDate();

        overlay.innerHTML = `
            <div id="gpa-maxi-card">
                <div class="modal-close" id="close-gpa-modal">✕</div>
                <div class="time-stamp">截至 ${currentTimeString}</div>

                <div class="user-profile-box">
                    <div>姓名：<span>${profile.name}</span></div>
                    <div>学号：<span>${profile.uid}</span></div>
                </div>

                <div class="main-gpa-box">
                    <div class="gpa-label">您的 GPA 是</div>
                    <div class="gpa-value">${data.gpa.toFixed(2)}</div>
                </div>

                <div class="info-grid-vertical">
                    <div class="info-item-single">
                        <div class="item-label">当前总排名情况</div>
                        <div class="item-val purple">${data.rank} / ${data.total}</div>
                        <div class="item-sub-desc">本专业 ${data.total} 人</div>
                    </div>

                    <div class="info-item-single">
                        <div class="item-label">排名百分比</div>
                        <div class="item-val">${data.rankPercentStr}</div>
                        <div class="item-explain-custom">
                            获取自系统的原始上报数据，<strong>一般收集信息是填这个。</strong>这个数据代表排在你前面的人占总人数的比例，<strong>数字越小越厉害！</strong>
                        </div>
                    </div>

                    <div class="info-item-single">
                        <div class="item-label">百分比排名</div>
                        <div class="item-val purple">${regularPercent}%</div>
                        <div class="item-explain-custom">
                            转换后的统计学常规比例，代表分数低于你的人占总人数的比例。<strong>数字越大越优秀！</strong>
                        </div>
                    </div>

                    <div class="info-item-single">
                        <div class="item-label">英语四级成绩</div>
                        <div class="item-val">${data.cet4 || 'null'}</div>
                    </div>

                    <div class="info-item-single">
                        <div class="item-label">英语六级成绩</div>
                        <div class="item-val">${data.cet6 || 'null'}</div>
                    </div>
                </div>
                <button class="copy-btn" id="copy-gpa-brief">获取纯文本并手动复制</button>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeModal = () => {
            overlay.remove();
            document.getElementById('gpa-mini-card').style.display = 'flex';
        };
        document.getElementById('close-gpa-modal').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if(e.target === overlay) closeModal(); });

        document.getElementById('copy-gpa-brief').addEventListener('click', () => {
            // 文本输出模板（前两行补充空格调整冒号对齐）
            const briefText = `截至${currentTimeString}\n姓名：${profile.name}\n学号：${profile.uid}\n1. 平均学分绩（GPA）：${data.gpa.toFixed(2)}\n2. 排名/专业人数：${data.rank}/${data.total}\n3. 排名百分比：${data.rankPercentStr}\n4. 百分比排名：${regularPercent}%\n5. 英语四级分数：${data.cet4 || 'null'}\n6. 英语六级分数：${data.cet6 || 'null'}`;

            const copyOverlay = document.createElement('div');
            copyOverlay.id = 'gpa-copy-overlay';
            copyOverlay.innerHTML = `
                <div id="gpa-copy-card">
                    <div class="text-box-title">请选择并复制下方文本</div>
                    <div class="text-box-tips">已为您自动选定全文。请直接使用快捷键 [Ctrl + C] 或 [Cmd + C] 完成复制。</div>
                    <textarea class="copy-textarea" id="gpa-textarea-target" readonly>${briefText}</textarea>
                    <button class="text-box-close" id="close-gpa-textarea">返回详情界面</button>
                </div>
            `;

            document.body.appendChild(copyOverlay);

            const textarea = document.getElementById('gpa-textarea-target');
            textarea.focus();
            textarea.select();

            const closeCopyOverlay = () => { copyOverlay.remove(); };
            document.getElementById('close-gpa-textarea').addEventListener('click', closeCopyOverlay);
            copyOverlay.addEventListener('click', (e) => { if(e.target === copyOverlay) closeCopyOverlay(); });
        });
    };

    const init = () => {
        injectStyles();

        const miniCard = document.createElement('div');
        miniCard.id = 'gpa-mini-card';
        miniCard.style.display = 'none';
        document.body.appendChild(miniCard);

        const loginDiv = document.querySelector('.login-in');

        if (!loginDiv) {
            miniCard.innerHTML = `
                <div style="font-size: 22px; font-weight: 700; color: ${NJU_PURPLE}; margin-bottom: 8px;">未登录</div>
                <div style="font-size: 13px; color: rgba(0, 0, 0, 0.45); line-height: 1.5;">请先登录交换生系统<br>以获取您的成绩排名</div>
            `;
            miniCard.style.display = 'flex';
            return;
        }

        miniCard.innerHTML = `
            <div style="font-size: 15px; font-weight: 600; color: ${NJU_PURPLE};">正在获取数据</div>
        `;
        miniCard.style.display = 'flex';

        calcRank().then(data => {
            if (data) {
                miniCard.innerHTML = `
                    <div class="mini-title">平均绩点 (GPA)</div>
                    <div class="mini-gpa">${data.gpa.toFixed(2)}</div>
                    <button class="mini-btn" id="open-gpa-detail">点击查看详情</button>
                `;

                document.getElementById('open-gpa-detail').addEventListener('click', () => {
                    showModal(data);
                    miniCard.style.display = 'none';
                });

                showModal(data);
                miniCard.style.display = 'none';
            } else {
                miniCard.innerHTML = `<div style="font-size:13px; color:${NJU_PURPLE}; font-weight:600;">获取失败<br><small style="font-weight:400;opacity:0.6;">接口抓取异常</small></div>`;
            }
        });
    };

    async function calcRank() {
        const url = "http://elite.nju.edu.cn/exchangesystem/index/create?pid=380";
        try {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const gpaElement = doc.querySelector('body > div > div:nth-child(4) > div:nth-child(11) > div:nth-child(3) > div.xm_text_span > span');
            if (!gpaElement) return null;

            const gpaRaw = gpaElement.innerText.trim();
            const gpa = parseFloat(gpaRaw);
            const rankPercentStr = doc.querySelector('input[name="data.pmbfb"]')?.value || "0%";
            const total = parseInt(doc.querySelector('input[name="data.zyzrs"]')?.value || "0");
            const rank = Math.round(parseFloat(rankPercentStr) * total / 100);

            const cet4 = doc.querySelector('input[name="data.cet4"]')?.value || null;
            const cet6 = doc.querySelector('input[name="data.cet6"]')?.value || null;

            return {
                gpa, rankPercentStr, total, rank, cet4, cet6
            };
        } catch (e) {
            return null;
        }
    }

    init();
})();