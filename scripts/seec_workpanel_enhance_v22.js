// scripts/seec_workpanel_enhance_v22.js
// 将 Tampermonkey 用户脚本逻辑接入为扩展 content script，并由 storage 开关控制启用。

(function () {
  'use strict';

  const TOGGLE_KEY = 'toggle-seec-workpanel';

  chrome.storage.local.get([TOGGLE_KEY], (cfg) => {
    // 默认开启：只有明确写入 false 时才不执行。
    if (cfg[TOGGLE_KEY] === false) return;

    let taskMap = {};
    const IGNORE_KEY = 'gemini_ignored_tasks';
    let ignoredTasks = JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]');

    // 1. 注入核心视觉规范 CSS
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = `
        /* =========================================
           全局净化
           ========================================= */
        .global-footer-wrapper, #global-footer-body { display: none !important; }
        .el-timeline { display: none !important; } /* 隐藏原生任务时间轴 */

        /* 彻底隐藏原生课件表格及自带的预览弹窗 */
        .courseware-tab > .el-table,
        .courseware-tab > .el-overlay { display: none !important; }

        /* =========================================
           全局顶栏胶囊化
           ========================================= */
        #menu.el-menu--horizontal { border-bottom: none !important; background: rgba(235, 235, 240, 0.6) !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; border-radius: 16px !important; padding: 6px !important; display: inline-flex !important; align-items: center !important; height: auto !important; margin-top: 12px !important; }
        #menu .el-menu-item { border-bottom: none !important; border-radius: 12px !important; margin: 0 4px !important; height: 38px !important; line-height: 38px !important; font-weight: 700 !important; color: #7f8c8d !important; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important; padding: 0 24px !important; background: transparent !important; }
        #menu .el-menu-item:hover { color: #34495e !important; background: rgba(255,255,255,0.4) !important; }
        #menu .el-menu-item.is-active, #menu .el-menu-item:focus { background: #ffffff !important; color: #2c3e50 !important; font-weight: 900 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04) !important; transform: scale(1.02) !important; }

        /* =========================================
           局部标签页胶囊化与入场动画
           ========================================= */
        .el-tab-pane { animation: iosFadeInUp 0.45s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; will-change: transform, opacity; }
        @keyframes iosFadeInUp { 0% { opacity: 0; transform: translateY(15px) scale(0.99); } 100% { opacity: 1; transform: translateY(0) scale(1); } }

        .el-tabs--card > .el-tabs__header { border-bottom: none !important; margin-bottom: 25px !important; padding-left: 5px !important; }
        .el-tabs--card > .el-tabs__header .el-tabs__nav { border: none !important; background: rgba(235, 235, 240, 0.6) !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; border-radius: 16px !important; padding: 6px !important; display: inline-flex !important; box-shadow: inset 0 2px 5px rgba(0,0,0,0.03) !important; }
        .el-tabs--card > .el-tabs__header .el-tabs__item { border: none !important; border-radius: 12px !important; margin: 0 4px !important; height: 38px !important; line-height: 38px !important; font-weight: 700 !important; color: #7f8c8d !important; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important; padding: 0 24px !important; }
        .el-tabs--card > .el-tabs__header .el-tabs__item.is-active { background: #ffffff !important; color: #2c3e50 !important; font-weight: 900 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04) !important; transform: scale(1.02) !important; }
        .el-tabs--card > .el-tabs__header .el-tabs__item:not(.is-active):hover { color: #34495e !important; background: rgba(255,255,255,0.4) !important; }

        .el-card__body > .el-button--success { top: 25px !important; right: 25px !important; border-radius: 12px !important; font-weight: 800 !important; box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3) !important; transition: all 0.3s !important; border: none !important; }
        .el-card__body > .el-button--success:hover { transform: translateY(-2px) scale(1.05) !important; box-shadow: 0 6px 16px rgba(103, 194, 58, 0.4) !important; }

        /* =========================================
           三栏网格基础基建
           ========================================= */
        .gemini-main-container { padding: 10px 0; font-family: -apple-system, sans-serif; }
        .gemini-section-title { font-size: 20px !important; font-weight: 900 !important; color: #333 !important; margin: 20px 0 12px 10px !important; display: flex; align-items: center; gap: 8px; }
        .gemini-section-title::before { content: ''; width: 5px; height: 20px; border-radius: 3px; display: inline-block; }
        .title-todo::before { background: #ff4d4f; } .title-done::before { background: #28BD6E; } .title-closed::before { background: #95a5a6; } .title-ignored::before { background: #dcdde1; } .title-cw::before { background: #007bff; }

        .gemini-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 18px !important; padding: 5px 10px 20px 10px !important; min-height: 20px; }

        .gemini-card {
            background: rgba(255, 255, 255, 0.98) !important; backdrop-filter: blur(15px); border-radius: 18px !important; padding: 20px !important;
            height: 100% !important; box-sizing: border-box !important; border: 1px solid rgba(0,0,0,0.06) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.02) !important; transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
            display: flex; flex-direction: column; justify-content: space-between; gap: 10px; position: relative; cursor: pointer;
        }
        .gemini-card:hover { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(0,0,0,0.08) !important; z-index: 10; }

        .gemini-card-header { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; gap:8px; }
        .gemini-card-title { font-size: 16px !important; font-weight: 800 !important; color: #2c3e50 !important; margin: 0 !important; line-height: 1.4; flex: 1; }
        .gemini-card-countdown { font-size: 16px !important; font-weight: 900 !important; color: #000 !important; white-space: nowrap !important; }
        .gemini-card-info { font-size: 11px !important; color: #7f8c8d !important; margin: 2px 0; }
        .gemini-status-badge { align-self: flex-start; padding: 4px 12px !important; border-radius: 10px !important; font-weight: 900 !important; font-size: 12px !important; }
        .gemini-card-success { border-top: 6px solid #28BD6E !important; } .gemini-card-warning { border-top: 6px solid #f39c12 !important; } .gemini-card-error { border-top: 6px solid #ff4d4f !important; }
        .gemini-card-closed { filter: grayscale(1) !important; opacity: 0.55 !important; background: #f1f2f3 !important; border-top: 6px solid #95a5a6 !important; }
        .badge-success { background: #f0f9eb; color: #67c23a; } .badge-warning { background: #fdf6ec; color: #e6a23c; } .badge-error { background: #fff1f0; color: #ff4d4f; }
        @keyframes gemini-pulse { 0% { box-shadow: 0 0 0 0px rgba(255, 77, 79, 0.2); } 70% { box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); } 100% { box-shadow: 0 0 0 0px rgba(255, 77, 79, 0); } }
        .gemini-urgent-card { animation: gemini-pulse 2s infinite !important; }

        .cw-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 15px !important; font-weight: 800 !important; color: #2c3e50 !important; line-height: 1.4; height: 42px; margin-bottom: 8px; }
        .gemini-cw-btn {
            background: #007bff !important; color: #ffffff !important; border-radius: 12px !important; padding: 10px 0 !important; font-size: 14px !important;
            font-weight: 800 !important; text-align: center !important; text-decoration: none !important; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
            display: block !important; width: 100% !important; box-shadow: 0 4px 10px rgba(0, 123, 255, 0.3) !important; margin-top: 12px;
        }
        .gemini-card:hover .gemini-cw-btn { background: #0069d9 !important; transform: scale(1.02) !important; box-shadow: 0 6px 15px rgba(0, 123, 255, 0.4) !important; }

        .gemini-fab-setting { position: fixed; right: 30px; bottom: 30px; width: 50px; height: 50px; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); border-radius: 50%; box-shadow: 0 8px 20px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; z-index: 100000; transition: all 0.3s; border: 1px solid rgba(0,0,0,0.05); }
        .gemini-fab-setting:hover { transform: scale(1.1) rotate(90deg); box-shadow: 0 12px 25px rgba(0,0,0,0.15); }
        .gemini-mask { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.3); z-index: 200000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); animation: fadeIn 0.3s forwards; }
        .gemini-panel { background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); border-radius: 20px; width: 420px; max-height: 75vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.6); animation: popIn 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        .gemini-panel-header { padding: 20px 24px; font-size: 18px; font-weight: 800; color:#333; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.5); }
        .gemini-panel-body { overflow-y: auto; padding: 10px 24px 20px; flex: 1; }
        .gemini-task-opt { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(0,0,0,0.04); }
        .gemini-ios-switch { appearance: none; -webkit-appearance: none; width: 46px; height: 26px; background: #e9e9ea; border-radius: 13px; position: relative; cursor: pointer; outline: none; transition: 0.3s; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1); }
        .gemini-ios-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: transform 0.3s; }
        .gemini-ios-switch:checked { background: #ff4d4f; } .gemini-ios-switch:checked::after { transform: translateX(20px); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
    document.head.appendChild(styleSheet);

    // 2. 数据窃取 (任务)
    const originalSend = XMLHttpRequest.prototype.send;
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
      this._url = u;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', function () {
        if (this._url && this._url.includes('exam/student/course')) {
          try {
            const res = JSON.parse(this.responseText);
            if (res.code === 0 && res.data) {
              res.data.forEach((t) => {
                if (t.result && t.result.score !== undefined) taskMap[t.name] = t.result.score;
                else if (t.joined) taskMap[t.name] = '待批改';
                else if (!taskMap[t.name]) taskMap[t.name] = undefined;
              });
              setTimeout(() => processAssignments(false), 0);
            }
          } catch (e) { }
        }
      });
      return originalSend.apply(this, arguments);
    };

    function getDDLInfo(timeStr) {
      try {
        const parts = timeStr.split('—');
        const endTimeStr = parts[parts.length - 1].trim();
        const diff = new Date(endTimeStr).getTime() - Date.now();
        if (diff <= 0) return { text: '已逾期', level: 'expired' };
        const days = Math.floor(diff / 86400000), hours = Math.floor((diff % 86400000) / 3600000);
        if (days > 0) return { text: `剩余 ${days}天 ${hours}时`, level: days < 3 ? 'warning' : 'normal' };
        return { text: `剩余 ${hours}时`, level: 'urgent' };
      } catch (e) { return null; }
    }

    // 3. 任务面板渲染
    function processAssignments(forceRefresh = false) {
      const taskTab = document.querySelector('.task-tab > div');
      if (!taskTab) return;
      if (!document.getElementById('gemini-task-main')) {
        const main = document.createElement('div'); main.id = 'gemini-task-main'; main.className = 'gemini-main-container';
        main.innerHTML = `
            <div id="section-todo"><div class="gemini-section-title title-todo">待完成</div><div class="gemini-grid" id="grid-todo"></div></div>
            <div id="section-done"><div class="gemini-section-title title-done">已完成</div><div class="gemini-grid" id="grid-done"></div></div>
            <div id="section-closed"><div class="gemini-section-title title-closed">已结束</div><div class="gemini-grid" id="grid-closed"></div></div>
            <div id="section-ignored" style="display:none;"><div class="gemini-section-title title-ignored">已忽略</div><div class="gemini-grid" id="grid-ignored"></div></div>
        `;
        taskTab.appendChild(main);
      }

      const items = document.querySelectorAll('.el-timeline-item');
      const grids = {
        todo: document.getElementById('grid-todo'),
        done: document.getElementById('grid-done'),
        closed: document.getElementById('grid-closed'),
        ignored: document.getElementById('grid-ignored'),
      };
      if (!grids.todo) return;

      if (forceRefresh) {
        Object.values(grids).forEach(g => (g.innerHTML = ''));
        items.forEach(item => (item.dataset.processed = 'false'));
      }

      items.forEach(item => {
        if (item.dataset.processed === 'true') return;
        const node = item.querySelector('.el-timeline-item__content'),
          titleNode = node?.querySelector('.task-title'),
          timestampNode = item.querySelector('.el-timeline-item__timestamp'),
          originalTag = node?.querySelector('.el-tag');
        if (!titleNode || !timestampNode) return;

        const name = titleNode.innerText.trim();
        if (!(name in taskMap)) taskMap[name] = undefined;
        const ddlRaw = timestampNode.innerText.trim(),
          score = taskMap[name],
          ddl = getDDLInfo(ddlRaw),
          isOriginallyClosed = originalTag && originalTag.innerText.includes('已关闭'),
          isIgnored = ignoredTasks.includes(name);

        let cardClass = 'gemini-card',
          badgeClass = 'gemini-status-badge',
          statusText = '',
          targetGrid = 'todo',
          countdownColor = '#000';

        if (isIgnored) {
          targetGrid = 'ignored';
          cardClass += ' gemini-card-closed';
          badgeClass += ' badge-error';
          statusText = '已忽略';
          countdownColor = '#7f8c8d';
        } else if (isOriginallyClosed || (ddl && ddl.level === 'expired')) {
          targetGrid = 'closed';
          cardClass += ' gemini-card-closed';
          badgeClass += ' badge-error';
          statusText = score !== undefined ? `${score}分` : '已关闭';
          countdownColor = '#7f8c8d';
        } else if (score === 100) {
          targetGrid = 'done';
          cardClass += ' gemini-card-success';
          badgeClass += ' badge-success';
          statusText = `${score}分`;
        } else {
          targetGrid = 'todo';
          cardClass += ' gemini-card-error';
          badgeClass += ' badge-error';
          statusText = score !== undefined ? `${score}分` : '未参加';
          if (score === '待批改') {
            statusText = '待批改';
            cardClass = cardClass.replace('error', 'warning');
            badgeClass = 'badge-warning';
          }
          if (ddl && ddl.level === 'urgent') {
            cardClass += ' gemini-urgent-card';
            countdownColor = '#ff4d4f';
          }
        }

        const card = document.createElement('div'); card.className = cardClass;
        card.innerHTML = `<div><div class="gemini-card-header"><h3 class="gemini-card-title">${name}</h3><span class="gemini-card-countdown" style="color: ${countdownColor} !important;">${ddl ? ddl.text : ''}</span></div><div class="gemini-card-info" style="margin-top:8px">DDL: ${ddlRaw}</div></div><div class="${badgeClass}">${statusText}</div>`;
        card.onclick = (e) => { e.preventDefault(); e.stopPropagation(); titleNode.click(); };
        grids[targetGrid].appendChild(card);
        item.dataset.processed = 'true';
      });

      document.getElementById('section-ignored').style.display = grids.ignored.children.length > 0 ? 'block' : 'none';
    }

    // 4. 核心：课件彻底卡片化重构
    function processCourseware() {
      const cwTab = document.querySelector('.courseware-tab');
      if (!cwTab) return;

      // 寻找原生表格里的数据
      const rows = cwTab.querySelectorAll('.el-table__row');
      if (rows.length === 0) return;

      // 创建课件大面板
      let cwGridContainer = document.getElementById('gemini-cw-main');
      if (!cwGridContainer) {
        cwGridContainer = document.createElement('div');
        cwGridContainer.id = 'gemini-cw-main';
        cwGridContainer.className = 'gemini-main-container';
        cwGridContainer.innerHTML = `
            <div class="gemini-section-title title-cw">课程资料库</div>
            <div class="gemini-grid" id="grid-courseware"></div>
        `;
        cwTab.appendChild(cwGridContainer);
      }

      const grid = document.getElementById('grid-courseware');
      const courseId = location.pathname.match(/\/course\/(\d+)/)?.[1] || '17';

      rows.forEach(row => {
        if (row.dataset.geminiCwRebuilt === 'true') return;

        const nameCell = row.cells[1], sizeCell = row.cells[2], dateCell = row.cells[3];
        if (!nameCell) return;

        const fileName = nameCell.innerText.trim();
        const fileSize = sizeCell ? sizeCell.innerText.trim() : '';
        const fileDate = dateCell ? dateCell.innerText.trim() : '';
        const ossUrl = `https://seec-portal.oss-cn-hangzhou.aliyuncs.com/${courseId}/${encodeURIComponent(fileName)}`;

        // 识别扩展名赋予卡片顶部色彩
        const ext = fileName.split('.').pop().toLowerCase();
        let borderColor = '#007bff';
        if (ext === 'pdf') { borderColor = '#ff4d4f'; }
        else if (ext.startsWith('doc')) { borderColor = '#40a9ff'; }
        else if (ext.startsWith('ppt')) { borderColor = '#fa8c16'; }
        else if (ext.startsWith('xls')) { borderColor = '#52c41a'; }

        const card = document.createElement('div');
        card.className = 'gemini-card';
        card.style.borderTop = `6px solid ${borderColor}`;

        card.innerHTML = `
            <div>
                <h3 class="cw-title" title="${fileName}">${fileName}</h3>
                <div class="gemini-card-info" style="margin-top:4px">大小: ${fileSize}</div>
                <div class="gemini-card-info">上传: ${fileDate}</div>
            </div>
            <div class="gemini-cw-btn">直连阅读 / 下载</div>
        `;

        // 点击整张卡片都能触发果冻直连
        card.onclick = () => { window.open(ossUrl, '_blank'); };

        grid.appendChild(card);
        row.dataset.geminiCwRebuilt = 'true';
      });
    }

    // 定时调度器统筹
    setInterval(() => {
      processAssignments(false);
      processCourseware();
    }, 800);

    // 5. 设置面板模块
    const settingBtn = document.createElement('div');
    settingBtn.className = 'gemini-fab-setting';
    settingBtn.innerHTML = '设置';
    document.body.appendChild(settingBtn);

    settingBtn.onclick = () => {
      const mask = document.createElement('div'); mask.className = 'gemini-mask';
      const tasks = Object.keys(taskMap).length > 0 ? Object.keys(taskMap) : Array.from(document.querySelectorAll('.task-title')).map(n => n.innerText.trim());
      const taskHtml = [...new Set(tasks)].map(t => `<div class="gemini-task-opt"><span style="font-size:14px; font-weight:600; color:#333;">${t}</span><input type="checkbox" class="gemini-ios-switch" data-task="${t}" ${ignoredTasks.includes(t) ? 'checked' : ''}></div>`).join('');

      mask.innerHTML = `<div class="gemini-panel"><div class="gemini-panel-header"><span>偏好设置</span><span style="cursor:pointer; color:#999;" id="gemini-close-setting">×</span></div><div class="gemini-panel-body">${taskHtml || '<div style="text-align:center; color:#999; padding:20px;">请先打开“任务”页加载数据</div>'}</div></div>`;
      document.body.appendChild(mask);

      mask.querySelectorAll('.gemini-ios-switch').forEach(sw => sw.onchange = (e) => {
        const tName = e.target.dataset.task;
        if (e.target.checked) {
          if (!ignoredTasks.includes(tName)) ignoredTasks.push(tName);
        } else {
          ignoredTasks = ignoredTasks.filter(t => t !== tName);
        }
        localStorage.setItem(IGNORE_KEY, JSON.stringify(ignoredTasks));
      });

      mask.querySelector('#gemini-close-setting').onclick = () => {
        mask.style.animation = 'fadeIn 0.3s reverse';
        setTimeout(() => { mask.remove(); processAssignments(true); }, 280);
      };
    };

    // 6. 报错暗杀与初始唤醒
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && (n.innerText?.includes('SQL') || n.innerText?.includes('Duplicate'))) n.remove();
    }))).observe(document.body, { childList: true, subtree: true });

    let clicked = false;
    const clickTimer = setInterval(() => {
      const tab = document.getElementById('tab-task');
      if (tab && !clicked) {
        if (!tab.classList.contains('is-active')) tab.click();
        clicked = true;
        clearInterval(clickTimer);
      }
    }, 100);
    setTimeout(() => clearInterval(clickTimer), 5000);
  });
})();

