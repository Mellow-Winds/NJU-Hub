// scripts/course_helper_plus.js - 独立全自动抢课引擎 (带强力穿透弹窗版)

(async function () {
    'use strict';

    // 仅在选课页面运行
    if (!window.location.href.includes('xsxkapp')) return;

    // 检查插件总开关
    let globalStorage = await chrome.storage.local.get(null);
    if (globalStorage['toggle-schedule'] === false) return;

    const THEME_SNIPER = '#ff3b30'; // 抢课专属战术红
    const APPLE_EASE = 'cubic-bezier(0.19, 1, 0.22, 1)';
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ================== 1. UI 样式注入 ==================
    const injectSniperStyles = () => {
        if (document.getElementById('sniper-plus-style')) return;
        const style = document.createElement('style');
        style.id = 'sniper-plus-style';
        style.innerHTML = `
            .sniper-toggle-btn { display: table; margin: 0 auto 4px auto; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s; border: 1px solid #ddd; background: #f8f8f8; color: #666; white-space: nowrap; }
            .sniper-toggle-btn.active { background: ${THEME_SNIPER}; color: white; border-color: ${THEME_SNIPER}; box-shadow: 0 2px 6px rgba(255, 59, 48, 0.3); }
            .sniper-toggle-btn:hover { transform: scale(1.05); }

            tr.course-tr.is-sniper-row > td { background-color: #fff5f5 !important; }

            #sp-island-root { position: fixed; top: 10px; left: calc(50% + 230px); z-index: 999998; font-family: sans-serif; pointer-events: none; }
            .sp-island { pointer-events: auto; background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(20px); border: 1px solid #eee; border-radius: 24px; width: 120px; height: 38px; display: flex; flex-direction: column; align-items: center; overflow: hidden; transition: all 0.5s ${APPLE_EASE}; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .sp-island.expanded { width: 300px; height: 180px; box-shadow: 0 25px 70px rgba(255,59,48,0.2); border-color: #ffccca; }
            
            .sp-status-wrapper { width: 120px; height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; cursor: pointer; }
            .sp-status-text { font-weight: 800; font-size: 13px; color: #ff3b30; }
            .sp-status-dot { width: 8px; height: 8px; border-radius: 50%; background-color: #ff3b30; transition: 0.3s; animation: sniperPulseDot 2s infinite; }
            
            .sp-panel { opacity: 0; width: 100%; padding: 0 20px; display: flex; flex-direction: column; pointer-events: none; transition: 0.2s; margin-top: 5px; box-sizing: border-box; }
            .sp-island.expanded .sp-panel { opacity: 1; pointer-events: auto; transition-delay: 0.1s; }

            .sniper-status-text { font-size: 12px; color: #666; text-align: center; margin-bottom: 8px; font-weight: bold; }
            .sniper-start-btn { width: 100%; padding: 12px; font-size: 14px; font-weight: 900; background: linear-gradient(135deg, #ff3b30, #ff9500); color: white; border: none; border-radius: 12px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 15px rgba(255, 59, 48, 0.4); }
            .sniper-start-btn:active { transform: scale(0.96); }
            .sniper-start-btn:disabled { background: #ccc; box-shadow: none; cursor: not-allowed; transform: none; }

            .sniper-manage-btn { width: 100%; padding: 8px; font-size: 12px; font-weight: 700; background: #fff0f0; color: #ff3b30; border: 1px solid #ffccca; border-radius: 10px; cursor: pointer; transition: 0.2s; margin-top: 8px; }
            .sniper-manage-btn:hover { background: #ffe5e5; }

            .sp-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2147483647; display: none; align-items: center; justify-content: center; }
            .sp-modal-overlay.open { display: flex; }
            .sp-modal { width: 500px; max-height: 80vh; background: #fff; border-radius: 16px; display: flex; flex-direction: column; }
            .sp-header { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; color: ${THEME_SNIPER}; }
            .sp-body { flex: 1; overflow-y: auto; padding: 10px; background: #f9f9f9; }
            .sp-footer { padding: 15px; border-top: 1px solid #eee; display: flex; justify-content: space-between; }
            
            .sp-row { background: #fff; margin-bottom: 8px; padding: 12px; border-radius: 8px; border: 1px solid #eee; display: flex; align-items: center; }
            .sp-info { flex: 1; margin-left: 10px; }
            .sp-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #eee; color: #666; margin-left: 5px; }
            .sp-tag.done { background: #e8f5e9; color: #1565c0; }
            .sp-tag.wait { background: #fff8e1; color: #f57f17; }

            @keyframes sniperPulseDot { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(255, 59, 48, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); } }
            .sniper-btn-animate { animation: sniperPulseDot 2s infinite; }
        `;
        document.head.appendChild(style);
    };

    // ================== 2. UI 组件与管理看板 ==================
    const buildCommanderUI = () => {
        if (document.getElementById('sp-island-root')) return;

        const islandRoot = document.createElement('div');
        islandRoot.id = 'sp-island-root';
        islandRoot.innerHTML = `
            <div id="sp-island-main" class="sp-island">
                <div class="sp-status-wrapper">
                    <div class="sp-status-dot"></div>
                    <span class="sp-status-text">抢课引擎</span>
                </div>
                <div class="sp-panel">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                        <span style="font-size:13px; font-weight:700; color:#333;">任务队列</span>
                        <span id="sniper-badge-count" style="font-size:12px; color:#ff3b30; font-weight:bold;">0 门</span>
                    </div>
                    <div class="sniper-status-text" id="sniper-status">状态：等待指令</div>
                    <button class="sniper-start-btn sniper-btn-animate" id="sniper-btn-fire">启动全自动抢课</button>
                    <button class="sniper-manage-btn" id="sniper-btn-manage">管理队列与优先级</button>
                </div>
            </div>
        `;
        document.body.appendChild(islandRoot);

        const island = document.getElementById('sp-island-main');
        island.onmouseenter = () => island.classList.add('expanded');
        island.onmouseleave = () => { if(!window.isSniperRunning) island.classList.remove('expanded'); };

        const modal = document.createElement('div');
        modal.id = 'sp-modal-wrap';
        modal.className = 'sp-modal-overlay';
        modal.innerHTML = `
            <div class="sp-modal">
                <div class="sp-header"><span>抢课序列管理</span><span style="cursor:pointer;" id="sp-close">✕</span></div>
                <div class="sp-body" id="sp-list-container"></div>
                <div class="sp-footer">
                    <div>
                        <button id="sp-btn-del" style="padding:8px 12px; background:#ff3b30; color:#fff; border:none; border-radius:6px; cursor:pointer;">移除选中</button>
                    </div>
                    <button id="sp-btn-reset" style="padding:8px 12px; background:#007AFF; color:#fff; border:none; border-radius:6px; cursor:pointer;">重置任务(全部重抢)</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('sniper-btn-manage').onclick = renderSniperList;
        document.getElementById('sp-close').onclick = () => modal.classList.remove('open');
        document.getElementById('sniper-btn-fire').onclick = startSniperEngine;

        document.getElementById('sp-btn-del').onclick = async () => {
            const checks = document.querySelectorAll('.sp-check:checked');
            if (checks.length === 0) return;
            if (confirm('确定移出抢课清单吗？')) {
                let data = await chrome.storage.local.get('NJU_SNIPER_LIST');
                let list = data.NJU_SNIPER_LIST || {};
                checks.forEach(c => delete list[c.value]);
                await chrome.storage.local.set({ NJU_SNIPER_LIST: list });
                renderSniperList();
                refreshSniperBadges();
            }
        };

        document.getElementById('sp-btn-reset').onclick = async () => {
            let data = await chrome.storage.local.get('NJU_SNIPER_LIST');
            let list = data.NJU_SNIPER_LIST || {};
            Object.keys(list).forEach(k => list[k].attempted = false);
            await chrome.storage.local.set({ NJU_SNIPER_LIST: list });
            renderSniperList();
            alert("已全部重置为【未执行】状态！");
        };

        refreshSniperBadges();
    };

    const renderSniperList = async () => {
        let data = await chrome.storage.local.get('NJU_SNIPER_LIST');
        let list = data.NJU_SNIPER_LIST || {};
        const container = document.getElementById('sp-list-container');
        container.innerHTML = '';

        const arr = Object.values(list).sort((a, b) => a.added - b.added);

        if (arr.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:#999;">清单为空，请在表格中点击【抢课】添加</div>';
        } else {
            arr.forEach(item => {
                const tag = item.attempted ? '<span class="sp-tag done">已尝试</span>' : '<span class="sp-tag wait">排队中</span>';
                const row = document.createElement('div');
                row.className = 'sp-row';
                row.innerHTML = `
                    <input type="checkbox" class="sp-check" value="${item.id}">
                    <div class="sp-info">
                        <div style="font-weight:bold; font-size:14px; color:#333;">${item.name} ${tag}</div>
                        <div style="font-size:12px; color:#666; margin-top:4px;">${item.teacher} | ${item.time}</div>
                        <div style="font-size:11px; color:#007AFF; margin-top:2px;">[路径] ${item.tab1Name} ➔ ${item.tab2Name || '无小类'}</div>
                    </div>
                `;
                container.appendChild(row);
            });
        }
        document.getElementById('sp-modal-wrap').classList.add('open');
    };

    const refreshSniperBadges = async () => {
        let data = await chrome.storage.local.get('NJU_SNIPER_LIST');
        let count = Object.keys(data.NJU_SNIPER_LIST || {}).length;
        const badge = document.getElementById('sniper-badge-count');
        if (badge) badge.innerText = `${count} 门`;
    };

    // ================== 3. 页面按钮注入与路由嗅探 ==================
    const appendB = (cell, el) => {
        if(!cell.querySelector('.nj-br')) { const br=document.createElement('br'); br.className='nj-br'; cell.appendChild(br); }
        cell.appendChild(el);
    };

    const injectSniperButtons = async () => {
        let data = await chrome.storage.local.get('NJU_SNIPER_LIST');
        let snipers = data.NJU_SNIPER_LIST || {};

        document.querySelectorAll('tr.course-tr').forEach(row => {
            if(row.dataset.checkedSniper) return;

            const name = row.querySelector('.kcmc')?.innerText || '未知';
            const teacher = row.querySelector('.jsmc')?.innerText || '未知';
            const time = row.querySelector('.sjdd')?.innerText || '';

            const kchCell = row.querySelector('.kch');
            if (kchCell) {
                const compositeId = `${name}|${teacher}|${time}`;
                const isSniper = !!snipers[compositeId];

                if (isSniper) row.classList.add('is-sniper-row');

                let btnGroup = kchCell.querySelector('.btn-group-kch');
                if (!btnGroup) {
                    btnGroup = document.createElement('div');
                    btnGroup.className = 'btn-group-kch';
                    kchCell.prepend(btnGroup);
                }

                if (!btnGroup.querySelector('.sniper-toggle-btn')) {
                    const btn = document.createElement('span');
                    btn.className = `sniper-toggle-btn ${isSniper ? 'active' : ''}`;
                    btn.innerHTML = isSniper ? '待抢课' : '抢课';

                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        let freshData = await chrome.storage.local.get('NJU_SNIPER_LIST');
                        let currentList = freshData.NJU_SNIPER_LIST || {};

                        if (currentList[compositeId]) {
                            delete currentList[compositeId];
                            btn.classList.remove('active'); btn.innerHTML = '抢课';
                            row.classList.remove('is-sniper-row');
                            const tag = row.querySelector('.sniper-badge'); if(tag) tag.remove();
                        } else {
                            const tab1Active = document.querySelector('#cvPageHeadTab li.cv-active a');
                            const tab1 = tab1Active ? tab1Active.dataset.teachingclasstype : '';
                            const tab1Name = tab1Active ? tab1Active.innerText : '未知大类';

                            const tab2Active = document.querySelector('.second-tab-list .second-tab.cv-active');
                            const tab2 = tab2Active ? tab2Active.dataset.teachingclasstype : '';
                            const tab2Name = tab2Active ? tab2Active.innerText : '';

                            currentList[compositeId] = {
                                id: compositeId, name, teacher, time,
                                tab1, tab1Name, tab2, tab2Name,
                                added: Date.now(), attempted: false
                            };
                            btn.classList.add('active'); btn.innerHTML = '待抢课';
                            row.classList.add('is-sniper-row');

                            const kcmcCell = row.querySelector('.kcmc');
                            const tag = document.createElement('span');
                            tag.className='nj-badge sniper-badge'; tag.style.background=THEME_SNIPER; tag.innerText=`待抢课`;
                            appendB(kcmcCell, tag);
                        }

                        await chrome.storage.local.set({ NJU_SNIPER_LIST: currentList });
                        refreshSniperBadges();
                    };
                    btnGroup.prepend(btn);
                }

                if (isSniper && !row.querySelector('.sniper-badge')) {
                    const kcmcCell = row.querySelector('.kcmc');
                    const tag = document.createElement('span');
                    tag.className='nj-badge sniper-badge'; tag.style.background=THEME_SNIPER; tag.innerText=`待抢课`;
                    appendB(kcmcCell, tag);
                }
            }
            row.dataset.checkedSniper = "true";
        });
    };

    // ================== 4. 自动抢课核心执行引擎 (强力穿透弹窗版) ==================
    const startSniperEngine = async () => {
        if (window.isSniperRunning) return;

        let data = await chrome.storage.local.get('NJU_SNIPER_LIST');
        let snipers = data.NJU_SNIPER_LIST || {};
        let targets = Object.values(snipers).filter(s => !s.attempted).sort((a,b) => a.added - b.added);

        if (targets.length === 0) {
            alert("没有待执行的抢课任务！\n请先点击【抢课】按钮添加，或在【管理队列】中重置。");
            return;
        }

        window.isSniperRunning = true;
        const island = document.getElementById('sp-island-main');
        island.classList.add('expanded');

        const btn = document.getElementById('sniper-btn-fire');
        const statusNode = document.getElementById('sniper-status');
        btn.classList.remove('sniper-btn-animate');
        btn.innerText = '引擎运行中 (请勿操作)';
        btn.disabled = true;

        try {
            for (let i = 0; i < targets.length; i++) {
                let target = targets[i];
                statusNode.innerHTML = `<span style="color:#007AFF;">[${i+1}/${targets.length}] 正在巡逻: ${target.name}</span>`;

                // 1. 切换大类
                let currentTab1 = document.querySelector('#cvPageHeadTab li.cv-active a')?.dataset.teachingclasstype;
                if (target.tab1 && currentTab1 !== target.tab1) {
                    let t1Btn = document.querySelector(`#cvPageHeadTab a[data-teachingclasstype="${target.tab1}"]`);
                    if (t1Btn) {
                        t1Btn.click();
                        await sleep(1500);
                    }
                }

                // 2. 切换小类
                if (target.tab2) {
                    let currentTab2 = document.querySelector('.second-tab-list .second-tab.cv-active')?.dataset.teachingclasstype;
                    if (currentTab2 !== target.tab2) {
                        let t2Btn = document.querySelector(`.second-tab-list .second-tab[data-teachingclasstype="${target.tab2}"]`);
                        if (t2Btn) {
                            t2Btn.click();
                            await sleep(1500);
                        }
                    }
                }

                await sleep(800);

                // 3. 寻找课程并点击
                let rows = document.querySelectorAll('tr.course-tr');
                let foundRow = Array.from(rows).find(row => {
                    let n = row.querySelector('.kcmc')?.innerText || '';
                    let t = row.querySelector('.jsmc')?.innerText || '';
                    let tm = row.querySelector('.sjdd')?.innerText || '';
                    return n.includes(target.name) && t.includes(target.teacher) && tm.includes(target.time);
                });

                if (foundRow) {
                    let chooseBtn = foundRow.querySelector('.cv-choice');
                    let capNode = foundRow.querySelector('.yxrs-value');

                    if (chooseBtn && capNode && !capNode.classList.contains('cv-color-danger')) {
                        statusNode.innerHTML = `<span style="color:#34C759;">发现名额，正在点击：${target.name}</span>`;
                        chooseBtn.click();

                        // ==========================================
                        // 弹窗穿透机制 (轮询寻找并点击确认)
                        // ==========================================
                        let confirmed = false;
                        for (let w = 0; w < 15; w++) { // 轮询 15 次，每次 200ms = 3 秒硬等
                            await sleep(200);
                            const confirmBtn = document.querySelector('.cv-sure, .cvBtnFlag[data-type="sure"]');
                            if (confirmBtn && confirmBtn.offsetParent) { // 必须确保按钮出现并可见
                                confirmBtn.click();
                                confirmed = true;
                                statusNode.innerHTML = `<span style="color:#34C759;">确认弹窗已处理</span>`;
                                break;
                            }
                        }

                        if (!confirmed) {
                            statusNode.innerHTML = `<span style="color:#ff9500;">未捕捉到确认弹窗，跳过...</span>`;
                        }

                        await sleep(1200); // 留给教务系统发送网络请求的缓冲时间
                    } else {
                        statusNode.innerHTML = `<span style="color:#ff9500;">容量满或无法选择：${target.name}</span>`;
                    }
                } else {
                    statusNode.innerHTML = `<span style="color:#ff3b30;">未找到对应课程：${target.name}</span>`;
                }

                // 标记已尝试
                let freshData = await chrome.storage.local.get('NJU_SNIPER_LIST');
                let curList = freshData.NJU_SNIPER_LIST || {};
                if (curList[target.id]) {
                    curList[target.id].attempted = true;
                    await chrome.storage.local.set({ NJU_SNIPER_LIST: curList });
                }

                await sleep(1000); // 间隔防封禁
            }

            statusNode.innerHTML = `<span style="color:#ff3b30;">队列全部执行完毕</span>`;
            alert("抢课巡逻完成！请检查【已选课程】确认结果。");

        } catch (e) {
            console.error("Sniper Error:", e);
            statusNode.innerHTML = `<span style="color:#ff3b30;">执行中断报错</span>`;
        } finally {
            window.isSniperRunning = false;
            btn.classList.add('sniper-btn-animate');
            btn.innerText = '启动全自动抢课';
            btn.disabled = false;
            refreshSniperBadges();
            setTimeout(() => { island.classList.remove('expanded'); }, 3000);
        }
    };

    // ================== 5. 初始化绑定 ==================
    injectSniperStyles();
    buildCommanderUI();

    setInterval(() => {
        injectSniperButtons();
    }, 1500);

})();