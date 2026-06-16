// ==UserScript==
// @name         NJU南大教务全自动评教 (v3.0 状态机版)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  锁定“很好”，随机评语，自动处理多级弹窗，期末/助教自动流转，自动穿透总览页
// @author       DTR
// @match        *://ehallapp.nju.edu.cn/jwapp/sys/wspjyyapp/*
// @match        *://*.nju.edu.cn/jwapp/sys/wspjyyapp/*
// @license      MIT
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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

    // ================= 状态管理 =================
    // 使用 sessionStorage 在页面跳转/刷新时保持自动运行状态
    let isAutoRunning = sessionStorage.getItem('nju_auto_eval_running') === 'true';
    let isProcessing = false; // 防止异步队列堆叠卡死

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

        // 查找并点击底部提交按钮 (涵盖常见的 EMAP 框架按钮特征)
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
            // [阶段 A-0] 检查是否处于总览首页（需要点击“待我评教”卡片穿透进入列表）
            const dwpjCard = document.querySelector('div[type="dwpj"]');
            if (dwpjCard && dwpjCard.offsetParent !== null) {
                // 仅当当前界面没有显示列表标签页时才点击（防止覆盖误判）
                const tab0 = document.querySelector('#tabName-content-0');
                if (!tab0) {
                    dwpjCard.click();
                    console.log('[NJU-Auto] 检测到总览界面，自动穿透点击“待我评教”卡片...');
                    await sleep(1500); // 预留进入列表页的加载时间
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
                    return; // 中断当前循环，进入下一个事件节拍
                }
            }

            const dialogCenter = document.querySelector('.bh-dialog-center');
            if (dialogCenter && dialogCenter.offsetParent !== null) {
                const text = dialogCenter.textContent;
                // 提交表单的二次确认框
                if (text.includes('确定要提交吗')) {
                    const confirmBtn = dialogCenter.querySelector('a.bh-bg-primary');
                    if (confirmBtn) {
                        confirmBtn.click();
                        console.log('[NJU-Auto] 确认提交表单');
                        await sleep(2000);
                        return;
                    }
                }
                // 助教未评的警示框
                else if (text.includes('存在助教教师还未评教')) {
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
                // 提取括号内的数字
                const num0 = parseInt(tab0.textContent.match(/\d+/) || [0], 10);
                const num1 = parseInt(tab1.textContent.match(/\d+/) || [0], 10);

                // 终结条件
                if (num0 === 0 && num1 === 0) {
                    toggleAutoRun(false);
                    console.log('[NJU-Auto] 🎉 恭喜，全部评教已完成！');
                    alert('🎉 全部评教任务已顺利清空！');
                    return;
                }

                // 决策目标板块：优先期末，期末为0则选助教
                let targetTabIndex = num0 > 0 ? 0 : 1;
                const targetTabId = `#tabName-content-${targetTabIndex}`;
                const targetTabContentId = `.tab-content-${targetTabIndex}`;
                const targetTab = document.querySelector(targetTabId);

                // 若目标 Tab 未处于激活状态，执行点击切换
                if (targetTab && !targetTab.classList.contains('jqx-tabs-title-selected-top')) {
                    targetTab.click();
                    console.log(`[NJU-Auto] 正在切换至面板: ${targetTabIndex === 0 ? '期末评教' : '助教评教'}`);
                    await sleep(1200); // 给框架渲染新面板留足时间
                    return;
                }

                // 在激活的面板中寻找待评估卡片
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
                                    await sleep(2000); // 预留页面跳转时间
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
            btn.innerHTML = '💭正在评价...';
            btn.style.backgroundColor = '#e91e63'; // 运行态变为粉色警告色
            btn.style.boxShadow = '0 8px 25px rgba(233, 30, 99, 0.4)';
            btn.style.transform = 'scale(0.95)'; // 运行中稍微缩小一点作为状态区分
        } else {
            btn.innerHTML = '⚠️开始自动评教';
            btn.style.backgroundColor = '#673ab7'; // 闲置态为紫色
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
    setInterval(injectButton, 1000); // 确保控制按钮永驻
    setInterval(processLoop, 1500);  // 状态机心跳频率设定为 1.5 秒
})();