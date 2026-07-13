/**
 * scripts/auto_eval.js
 *
 * 目标页面: ehallapp.nju.edu.cn/jwapp/sys/wspjyyapp/* (办事大厅评教页面)
 * 功能概述: 全自动评教 — 锁定"很好"选项，随机生成评语，自动处理多级弹窗
 * 触发方式: 页面加载时自动注入，用户点击右下角浮动按钮启动
 * 依赖模块: libs/nju-modal.js (弹窗组件)
 *
 * 详细说明:
 * 1. 状态机模式：自动识别当前所处阶段（期末评教 / 助教评教 / 总览页）
 * 2. 表单填涂：将所有单选题锁定为"很好"，跳过非必填项
 * 3. 评语生成：内置 30 条语料库随机抽取，无需 AI 配置
 * 4. 弹窗穿透：自动处理"保存成功"等确认弹窗，点击"下一份"流转
 * 5. 总览页自动提交：识别所有评教完成状态后自动点击最终提交按钮
 * 6. 按钮状态：SVG 图标（开始/旋转/完成），运行中禁止重复点击
 */

(function() {
    'use strict';

    // 检查总开关
    chrome.storage.local.get(['toggle-eval'], (cfg) => {
        if (cfg['toggle-eval'] === false) return;

        console.log('[NJU-Hub] 全自动评教模块已加载 (v3.1 状态机版)');

        // ================= 配置区 =================
        const CONFIG = {
            targetText: "很好",
            comments: [
                "老师授课认真负责，课堂气氛活跃，非常满意！",
                "教学内容丰富，由浅入深，非常容易理解。",
                "老师备备课极其充分，重点突出，获益匪浅。",
                "对学生很有耐心，课后答疑也非常细致。",
                "教学安排合理，由表及里，逻辑非常清晰。",
                "课堂互动很多，能充分调动大家的学习积极性。",
                "老师讲课风趣幽默，枯燥的知识也变得很有趣。",
                "理论结合实际，拓展了很多实用的前沿内容。",
                "课件制作精美，条理清晰，重点难点一目了然。",
                "老师对课堂纪律抓得好，学习氛围非常浓厚。",
                "讲课声音洪亮，充满激情，听课完全不会犯困。",
                "授课内容含金量高，作业布置和反馈都很及时。",
                "对待教学非常敬业，能设身处地为学生着想。",
                "不仅传授知识，还引导我们建立科学的思维方式。",
                "教学思路清晰，循循善诱，上课体验非常好。",
                "重点知识讲解得非常透彻，能够照顾到不同基础的同学。",
                "课堂节奏把控得极好，效率高且听得轻松。",
                "非常注重因材施教，课后认真听取同学们的反馈意见。",
                "老师很有学者风范，授课严谨又不失生动。",
                "每堂课都有新的收获，这门课开设得非常有意义。",
                "教学方法新颖，很好地激发了大家的探究欲望。",
                "老师非常平易近人，讨论时能给予很有价值的启发。",
                "框架结构清晰完整，复习起来目标非常明确。",
                "老师不仅关注成绩，更注重培养我们的实践动手能力。",
                "上课内容前沿，结合了很多业界前沿案例，视野开阔。",
                "老师对专业知识研究很深，讲解起来举重若轻。",
                "课堂时间利用率极高，干货满满，非常有诚意。",
                "老师能把复杂的概念用最通俗易懂的语言讲明白。",
                "对学术态度十分严谨，在潜移默化中影响了我们。",
                "考核方式客观公正，真正能检验出大家的学习成果。"
            ],
            btnStyle: `
                position: fixed; right: 40px; bottom: 40px;
                z-index: 999999; padding: 16px 28px; font-size: 22px;
                background-color: #673ab7; color: white;
                border: none; border-radius: 50px; cursor: pointer;
                font-weight: bold; box-shadow: 0 8px 25px rgba(103,58,183,0.4);
                transition: all 0.3s ease;
                letter-spacing: 2px;
            `
        };

        // ================= SVG 图标库 =================
        const ICONS = {
            start: '<svg width="22" height="22" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:6px"><path fill="currentColor" d="M8 5v14l11-7L8 5z"/></svg>',
            spinner: '<svg width="22" height="22" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:6px" class="nju-eval-spin"><path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',
            check: '<svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
        };

        // 注入旋转动画样式（仅一次）
        if (!document.getElementById('nju-eval-style')) {
            const style = document.createElement('style');
            style.id = 'nju-eval-style';
            style.textContent = '@keyframes nju-eval-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.nju-eval-spin{animation:nju-eval-spin 1s linear infinite;transform-origin:center center}';
            document.head.appendChild(style);
        }

        // ================= 状态管理 =================
        let isAutoRunning = sessionStorage.getItem('nju_auto_eval_running') === 'true';
        let isProcessing = false;

        // ================= 工具函数 =================
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        function getElementByText(selector, text) {
            const elements = document.querySelectorAll(selector);
            for (let el of elements) {
                if (el.textContent.includes(text)) return el;
            }
            return null;
        }

        // ================= 核心流程区 =================

        // 动作 1：处理表单填涂
        async function evaluateForm() {
            let count = 0;
            document.querySelectorAll('.bh-radio-label').forEach(label => {
                if (label.textContent.trim().includes(CONFIG.targetText)) {
                    label.click();
                    count++;
                }
            });

            document.querySelectorAll('textarea').forEach(box => {
                if (box.value.length < 5) {
                    const randomMsg = CONFIG.comments[Math.floor(Math.random() * CONFIG.comments.length)];
                    box.value = randomMsg;
                    box.dispatchEvent(new Event('input', { bubbles: true }));
                    box.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            console.log(`[NJU-Auto] 填表完毕，勾选 ${count} 个选项。准备提交...`);

            await sleep(1000);

            const submitBtn = getElementByText('a.bh-btn.bh-bg-primary', '提交') ||
                              getElementByText('button.bh-btn.bh-bg-primary', '提交') ||
                              document.querySelector('[data-action="提交"]');
            if (submitBtn) {
                submitBtn.click();
                console.log('[NJU-Auto] 已触发初级提交。');
            }
        }

        // 动作 2：状态机主循环
        async function processLoop() {
            if (!isAutoRunning || isProcessing) return;
            isProcessing = true;

            try {
                // [阶段 A-0] 检查是否处于总览首页（需要点击"待我评教"卡片穿透进入列表）
                const dwpjCard = document.querySelector('div[type="dwpj"]');
                if (dwpjCard && dwpjCard.offsetParent !== null) {
                    const tab0 = document.querySelector('#tabName-content-0');
                    if (!tab0) {
                        dwpjCard.click();
                        console.log('[NJU-Auto] 检测到总览界面，自动穿透点击"待我评教"卡片...');
                        await sleep(1500);
                        return;
                    }
                }

                // [阶段 A-1] 阻断弹窗清理
                const favTeacherTitle = getElementByText('.jqx-window h3', '推荐我最喜爱老师');
                if (favTeacherTitle && favTeacherTitle.offsetParent !== null) {
                    const skipBtn = getElementByText('#buttons button', '暂不推荐');
                    if (skipBtn) {
                        skipBtn.click();
                        console.log('[NJU-Auto] 清理弹窗：暂不推荐最喜爱老师');
                        await sleep(1000);
                        return;
                    }
                }

                const dialogCenter = document.querySelector('.bh-dialog-center');
                if (dialogCenter && dialogCenter.offsetParent !== null) {
                    const text = dialogCenter.textContent;
                    if (text.includes('确定要提交吗')) {
                        const confirmBtn = dialogCenter.querySelector('a.bh-bg-primary');
                        if (confirmBtn) {
                            confirmBtn.click();
                            console.log('[NJU-Auto] 确认提交表单');
                            await sleep(2000);
                            return;
                        }
                    } else if (text.includes('存在助教教师还未评教')) {
                        const skipTaBtn = getElementByText('.bh-dialog-center a.bh-dialog-btn:not(.bh-bg-primary)', '暂时不评');
                        if (skipTaBtn) {
                            skipTaBtn.click();
                            console.log('[NJU-Auto] 清理弹窗：暂时不评助教');
                            await sleep(1000);
                            return;
                        }
                    }
                }

                // [阶段 B] 判断页面类型 (若有电台标签，说明在详情页)
                const radios = document.querySelectorAll('.bh-radio-label');
                if (radios.length > 0) {
                    await evaluateForm();
                    await sleep(1500);
                    return;
                }

                // [阶段 C] 首页流转调度中心
                const tab0 = document.querySelector('#tabName-content-0 .jqx-tabs-titleContentWrapper');
                const tab1 = document.querySelector('#tabName-content-1 .jqx-tabs-titleContentWrapper');

                if (tab0 && tab1) {
                    const num0 = parseInt(tab0.textContent.match(/\d+/) || [0], 10);
                    const num1 = parseInt(tab1.textContent.match(/\d+/) || [0], 10);

                    if (num0 === 0 && num1 === 0) {
                        toggleAutoRun(false);
                        console.log('[NJU-Auto] 恭喜，全部评教已完成！');
                        NjuModal.alert('评教完成', '全部评教任务已顺利清空！');
                        return;
                    }

                    let targetTabIndex = num0 > 0 ? 0 : 1;
                    const targetTabId = `#tabName-content-${targetTabIndex}`;
                    const targetTabContentId = `.tab-content-${targetTabIndex}`;
                    const targetTab = document.querySelector(targetTabId);

                    if (targetTab && !targetTab.classList.contains('jqx-tabs-title-selected-top')) {
                        targetTab.click();
                        console.log(`[NJU-Auto] 正在切换至面板: ${targetTabIndex === 0 ? '期末评教' : '助教评教'}`);
                        await sleep(1200);
                        return;
                    }

                    const activeContent = document.querySelector(targetTabContentId);
                    if (activeContent && activeContent.style.display !== 'none') {
                        const dcjTags = activeContent.querySelectorAll('.tab.bh-tag.dcj');
                        for (let tag of dcjTags) {
                            if (tag.textContent.includes('待参加')) {
                                const card = tag.closest('.pj-card');
                                if (card) {
                                    const enterBtn = card.querySelector('.card-btn.blue');
                                    if (enterBtn) {
                                        enterBtn.click();
                                        console.log('[NJU-Auto] 锁定待评课程，正在进入...');
                                        await sleep(2000);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[NJU-Auto] 状态机异常:', e);
            } finally {
                isProcessing = false;
            }
        }

        // ================= UI 与控制区 =================

        function toggleAutoRun(forceState) {
            if (typeof forceState === 'boolean') {
                isAutoRunning = forceState;
            } else {
                isAutoRunning = !isAutoRunning;
            }
            sessionStorage.setItem('nju_auto_eval_running', isAutoRunning);
            updateButtonUI();
            if (isAutoRunning) console.log('[NJU-Auto] 全自动模式已开启。');
            else console.log('[NJU-Auto] 全自动模式已挂起。');
        }

        function updateButtonUI() {
            const btn = document.getElementById('nju-mega-btn');
            if (!btn) return;
            if (isAutoRunning) {
                btn.innerHTML = ICONS.spinner + '正在评价...';
                btn.style.backgroundColor = '#e91e63';
                btn.style.boxShadow = '0 8px 25px rgba(233, 30, 99, 0.4)';
                btn.style.transform = 'scale(0.95)';
            } else {
                btn.innerHTML = ICONS.start + '开始自动评教';
                btn.style.backgroundColor = '#673ab7';
                btn.style.boxShadow = '0 8px 25px rgba(103, 58, 183, 0.4)';
                btn.style.transform = 'scale(1)';
            }
        }

        function injectButton() {
            if (document.getElementById('nju-mega-btn')) {
                updateButtonUI();
                return;
            }
            const btn = document.createElement('button');
            btn.id = 'nju-mega-btn';
            btn.style.cssText = CONFIG.btnStyle;
            btn.onclick = (e) => {
                e.preventDefault();
                toggleAutoRun();
            };
            document.body.appendChild(btn);
            updateButtonUI();
        }

        // 启动守护定时器
        setInterval(injectButton, 1000);
        setInterval(processLoop, 1500);
    });

})();
