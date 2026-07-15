/**
 * scripts/pe_score_viewer/pe_score_ui.js
 *
 * UI 渲染层：浮动小卡片 + 大弹窗 + 复制功能
 * 视觉风格参照 elite_gpa_viewer.js (NJU 紫色 #660874, 毛玻璃弹窗)
 *
 * 暴露 window.__PE_SCORE__.injectStyles / showMiniCard / showModal
 */

(function () {
    'use strict';

    window.__PE_SCORE__ = window.__PE_SCORE__ || {};

    const NJU_PURPLE = '#660874';

    // ── 样式注入 ──────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('pe-score-styles')) return;
        const style = document.createElement('style');
        style.id = 'pe-score-styles';
        style.innerHTML = `
            /* 右侧常驻小窗 */
            #pe-mini-card {
                position: fixed;
                right: 25px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 10000;
                width: 220px;
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
            .pe-mini-title { font-size: 14px; color: rgba(0, 0, 0, 0.5); margin-bottom: 4px; }
            .pe-mini-score { font-size: 32px; font-weight: 700; color: #000; margin: 2px 0; }
            .pe-mini-sub { font-size: 13px; color: rgba(0, 0, 0, 0.45); margin-top: 4px; }
            .pe-mini-btn {
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
            .pe-mini-btn:hover { opacity: 0.9; }

            /* 大弹窗遮罩 */
            #pe-modal-overlay {
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
            #pe-maxi-card {
                background: rgba(255, 255, 255, 0.97);
                backdrop-filter: blur(30px) saturate(170%);
                -webkit-backdrop-filter: blur(30px) saturate(170%);
                width: 620px;
                max-height: 90vh;
                overflow-y: auto;
                border-radius: 32px;
                border: 0.5px solid rgba(255, 255, 255, 0.5);
                box-shadow: 0 30px 80px rgba(0, 0, 0, 0.2);
                padding: 40px;
                position: relative;
                box-sizing: border-box;
            }
            #pe-maxi-card::-webkit-scrollbar { width: 6px; }
            #pe-maxi-card::-webkit-scrollbar-track { background: transparent; margin: 32px 0; }
            #pe-maxi-card::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.15); border-radius: 10px; }

            .pe-modal-close {
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
            .pe-modal-close:hover { background: rgba(0,0,0,0.1); }

            .pe-time-stamp { font-size: 15px; color: rgba(0,0,0,0.45); margin-bottom: 25px; text-align: center; font-weight: 500; }

            .pe-user-profile-box {
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

            /* 区段标题 */
            .pe-section-title {
                font-size: 20px;
                font-weight: 800;
                color: ${NJU_PURPLE};
                margin: 30px 0 16px;
                padding-bottom: 8px;
                border-bottom: 2px solid rgba(102, 8, 116, 0.15);
            }

            /* 体测总分大显示 */
            .pe-total-box { text-align: center; margin-bottom: 30px; }
            .pe-total-label { font-size: 18px; color: rgba(0,0,0,0.6); letter-spacing: 0.5px; }
            .pe-total-value { font-size: 60px; font-weight: 800; color: #000; margin: 10px 0; letter-spacing: -1px; }

            /* 体测单项卡片网格 */
            .pe-item-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 25px;
            }
            .pe-item-card {
                background: rgba(255,255,255,0.85);
                border: 1px solid rgba(0,0,0,0.08);
                padding: 16px 20px;
                border-radius: 16px;
                box-sizing: border-box;
            }
            .pe-item-name { font-size: 14px; font-weight: 700; color: rgba(0,0,0,0.6); margin-bottom: 6px; }
            .pe-item-score { font-size: 22px; font-weight: 800; color: #111; }
            .pe-item-detail { font-size: 13px; color: rgba(0,0,0,0.5); margin-top: 4px; }
            .pe-grade-pass { color: #2e7d32; }
            .pe-grade-fail { color: #c62828; font-weight: 700; }

            /* 教学成绩区 */
            .pe-course-card {
                background: rgba(255,255,255,0.85);
                border: 1px solid rgba(0,0,0,0.08);
                padding: 18px 22px;
                border-radius: 18px;
                margin-bottom: 14px;
                box-sizing: border-box;
            }
            .pe-course-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .pe-course-name { font-size: 17px; font-weight: 700; color: #111; }
            .pe-course-term { font-size: 13px; color: rgba(0,0,0,0.45); }
            .pe-course-meta { font-size: 13px; color: rgba(0,0,0,0.5); margin-bottom: 10px; }
            .pe-score-row {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            .pe-score-pill {
                background: rgba(102, 8, 116, 0.06);
                border-radius: 10px;
                padding: 8px 14px;
                text-align: center;
                min-width: 70px;
            }
            .pe-score-pill-name { font-size: 12px; color: rgba(0,0,0,0.5); }
            .pe-score-pill-val { font-size: 18px; font-weight: 700; color: ${NJU_PURPLE}; margin-top: 2px; }
            .pe-score-pill.total .pe-score-pill-val { color: #000; font-size: 22px; }

            /* 复制按钮 */
            .pe-copy-btn {
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
                margin-top: 10px;
            }
            .pe-copy-btn:hover { background: #52065c; }

            /* 复制弹窗 */
            #pe-copy-overlay {
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
            #pe-copy-card {
                background: #ffffff;
                width: 520px;
                height: 480px;
                border-radius: 28px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                padding: 30px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .pe-text-box-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 10px; text-align: center; }
            .pe-text-box-tips { font-size: 14px; color: ${NJU_PURPLE}; font-weight: 700; margin-bottom: 16px; text-align: center; background: rgba(102,8,116,0.06); padding: 10px; border-radius: 10px; line-height: 1.4; }
            .pe-copy-textarea {
                flex: 1;
                width: 100%;
                border: 1px solid rgba(0,0,0,0.18);
                border-radius: 14px;
                padding: 20px 35px;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", monospace;
                font-size: 15px;
                line-height: 1.6;
                resize: none;
                background: #fafafa;
                margin-bottom: 18px;
                outline: none;
                color: #222;
                text-align: left;
                box-sizing: border-box;
            }
            .pe-text-box-close { width: 100%; padding: 14px; background: #333; color: #fff; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; text-align: center; }
            .pe-text-box-close:hover { background: #111; }

            /* 错误提示 */
            .pe-error-box {
                text-align: center;
                padding: 20px;
                color: rgba(0,0,0,0.4);
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }

    // ── 工具函数 ──────────────────────────────────────────

    function getFormattedDate() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d = now.getDate();
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${y}年${m}月${d}日 ${h}:${min}`;
    }

    function gradeClass(grade) {
        if (!grade) return '';
        if (grade.includes('不及格') || grade.includes('不合格')) return 'pe-grade-fail';
        if (grade.includes('及格') || grade.includes('良好') || grade.includes('优秀')) return 'pe-grade-pass';
        return '';
    }

    // ── 大弹窗 ────────────────────────────────────────────

    function showModal(pftData, ptmData) {
        if (document.getElementById('pe-modal-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pe-modal-overlay';
        const currentTimeString = getFormattedDate();

        // 用户信息
        const name = pftData?.name || ptmData?.name || '未知';
        const uid = pftData?.uid || ptmData?.uid || '未知';

        // ── 体测区 HTML ──
        let pftHtml = '';
        if (pftData && !pftData.error) {
            // 单项卡片
            let itemsHtml = '';
            for (const item of pftData.items) {
                const gClass = gradeClass(item.grade);
                const detailText = item.points ? `得分 ${item.points}${item.grade ? ' · ' + item.grade : ''}` : (item.grade || '');
                itemsHtml += `
                    <div class="pe-item-card">
                        <div class="pe-item-name">${item.name}</div>
                        <div class="pe-item-score ${gClass}">${item.score || '—'}</div>
                        <div class="pe-item-detail ${gClass}">${detailText}</div>
                    </div>
                `;
            }

            // 基础数据卡片
            const basicItems = [
                { name: 'BMI', value: pftData.bmi },
                { name: '身高(cm)', value: pftData.height },
                { name: '体重(kg)', value: pftData.weight },
                { name: '加分', value: pftData.bonus }
            ];
            let basicHtml = '';
            for (const b of basicItems) {
                if (b.value) {
                    basicHtml += `
                        <div class="pe-item-card">
                            <div class="pe-item-name">${b.name}</div>
                            <div class="pe-item-score">${b.value}</div>
                        </div>
                    `;
                }
            }

            // 视力数据
            let visionHtml = '';
            if (pftData.visionItems && pftData.visionItems.length > 0) {
                let visionCards = '';
                for (const v of pftData.visionItems) {
                    visionCards += `
                        <div class="pe-item-card">
                            <div class="pe-item-name">${v.name}</div>
                            <div class="pe-item-score" style="font-size:18px;">${v.value}</div>
                        </div>
                    `;
                }
                visionHtml = `
                    <div class="pe-section-title">视力数据</div>
                    <div class="pe-item-grid">${visionCards}</div>
                `;
            }

            pftHtml = `
                <div class="pe-section-title">体测成绩 · ${pftData.period}</div>
                <div class="pe-total-box">
                    <div class="pe-total-label">体测总分</div>
                    <div class="pe-total-value">${pftData.totalScore || '—'}</div>
                </div>
                <div class="pe-item-grid">${itemsHtml}</div>
                <div class="pe-item-grid">${basicHtml}</div>
                ${visionHtml}
            `;
        } else if (pftData && pftData.error) {
            pftHtml = `
                <div class="pe-section-title">体测成绩</div>
                <div class="pe-error-box">${pftData.error}</div>
            `;
        }

        // ── 教学区 HTML ──
        let ptmHtml = '';
        if (ptmData && ptmData.courses && ptmData.courses.length > 0) {
            let courseCards = '';
            for (const c of ptmData.courses) {
                const scoreKeys = ['专项', '素质', '平时', '阳光跑', '总成绩'];
                let pills = '';
                for (const key of scoreKeys) {
                    if (c.scores[key]) {
                        const isTotal = key === '总成绩';
                        pills += `
                            <div class="pe-score-pill ${isTotal ? 'total' : ''}">
                                <div class="pe-score-pill-name">${key}</div>
                                <div class="pe-score-pill-val">${c.scores[key]}</div>
                            </div>
                        `;
                    }
                }
                // 其他非标准项
                for (const [k, v] of Object.entries(c.scores)) {
                    if (!scoreKeys.includes(k)) {
                        pills += `
                            <div class="pe-score-pill">
                                <div class="pe-score-pill-name">${k}</div>
                                <div class="pe-score-pill-val">${v}</div>
                            </div>
                        `;
                    }
                }
                courseCards += `
                    <div class="pe-course-card">
                        <div class="pe-course-header">
                            <span class="pe-course-name">${c.courseName}</span>
                            <span class="pe-course-term">${c.termName}</span>
                        </div>
                        <div class="pe-course-meta">${c.schedule}${c.teacher ? ' | ' + c.teacher : ''}</div>
                        <div class="pe-score-row">${pills}</div>
                    </div>
                `;
            }
            ptmHtml = `
                <div class="pe-section-title">教学成绩</div>
                ${courseCards}
            `;
        } else if (ptmData && (!ptmData.courses || ptmData.courses.length === 0)) {
            ptmHtml = `
                <div class="pe-section-title">教学成绩</div>
                <div class="pe-error-box">暂无教学成绩数据</div>
            `;
        }

        overlay.innerHTML = `
            <div id="pe-maxi-card">
                <div class="pe-modal-close" id="close-pe-modal">✕</div>
                <div class="pe-time-stamp">截至 ${currentTimeString}</div>

                <div class="pe-user-profile-box">
                    <div>姓名：<span>${name}</span></div>
                    <div>学号：<span>${uid}</span></div>
                </div>

                ${pftHtml}
                ${ptmHtml}

                <button class="pe-copy-btn" id="copy-pe-brief">获取纯文本并手动复制</button>
            </div>
        `;

        document.body.appendChild(overlay);

        // 关闭弹窗
        const closeModal = () => {
            overlay.remove();
            const mini = document.getElementById('pe-mini-card');
            if (mini) mini.style.display = 'flex';
        };
        document.getElementById('close-pe-modal').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        // 复制功能
        document.getElementById('copy-pe-brief').addEventListener('click', () => {
            const briefText = buildCopyText(pftData, ptmData, name, uid, currentTimeString);

            const copyOverlay = document.createElement('div');
            copyOverlay.id = 'pe-copy-overlay';
            copyOverlay.innerHTML = `
                <div id="pe-copy-card">
                    <div class="pe-text-box-title">请选择并复制下方文本</div>
                    <div class="pe-text-box-tips">已为您自动选定全文。请直接使用快捷键 [Ctrl + C] 或 [Cmd + C] 完成复制。</div>
                    <textarea class="pe-copy-textarea" id="pe-textarea-target" readonly>${briefText}</textarea>
                    <button class="pe-text-box-close" id="close-pe-textarea">返回详情界面</button>
                </div>
            `;
            document.body.appendChild(copyOverlay);

            const textarea = document.getElementById('pe-textarea-target');
            textarea.focus();
            textarea.select();

            const closeCopyOverlay = () => { copyOverlay.remove(); };
            document.getElementById('close-pe-textarea').addEventListener('click', closeCopyOverlay);
            copyOverlay.addEventListener('click', (e) => { if (e.target === copyOverlay) closeCopyOverlay(); });
        });
    }

    // ── 构建复制文本 ──────────────────────────────────────

    function buildCopyText(pftData, ptmData, name, uid, timeStr) {
        let text = `截至${timeStr}\n姓名：${name}\n学号：${uid}\n`;

        // 体测
        if (pftData && !pftData.error) {
            text += `\n═══ 体测成绩 · ${pftData.period} ═══\n`;
            text += `总分：${pftData.totalScore || '—'}\n`;
            if (pftData.bmi) text += `BMI：${pftData.bmi}  身高：${pftData.height}cm  体重：${pftData.weight}kg\n`;
            for (const item of pftData.items) {
                text += `${item.name}：${item.raw || '—'}\n`;
            }
        }

        // 教学
        if (ptmData && ptmData.courses && ptmData.courses.length > 0) {
            text += `\n═══ 教学成绩 ═══\n`;
            for (const c of ptmData.courses) {
                text += `\n[${c.termName}] ${c.courseName}`;
                if (c.schedule) text += ` (${c.schedule})`;
                if (c.teacher) text += ` | ${c.teacher}`;
                text += '\n';
                for (const [k, v] of Object.entries(c.scores)) {
                    text += `  ${k}：${v}\n`;
                }
            }
        }

        return text;
    }

    // ── 浮动小卡片 ────────────────────────────────────────

    function showMiniCard(pftData, ptmData) {
        let mini = document.getElementById('pe-mini-card');
        if (!mini) {
            mini = document.createElement('div');
            mini.id = 'pe-mini-card';
            document.body.appendChild(mini);
        }

        // 取最新教学成绩的总成绩
        let ptmTotal = '—';
        if (ptmData && ptmData.courses && ptmData.courses.length > 0) {
            const latest = ptmData.courses[ptmData.courses.length - 1];
            if (latest.scores['总成绩']) ptmTotal = latest.scores['总成绩'];
        }

        const pftTotal = (pftData && pftData.totalScore) ? pftData.totalScore : '—';

        mini.innerHTML = `
            <div class="pe-mini-title">体测总分</div>
            <div class="pe-mini-score">${pftTotal}</div>
            <div class="pe-mini-sub">教学最新总成绩：${ptmTotal}</div>
            <button class="pe-mini-btn" id="open-pe-detail">点击查看详情</button>
        `;
        mini.style.display = 'flex';

        document.getElementById('open-pe-detail').addEventListener('click', () => {
            showModal(pftData, ptmData);
            mini.style.display = 'none';
        });
    }

    // ── 暴露接口 ──────────────────────────────────────────

    window.__PE_SCORE__.injectStyles = injectStyles;
    window.__PE_SCORE__.showMiniCard = showMiniCard;
    window.__PE_SCORE__.showModal = showModal;
})();
