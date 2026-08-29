/**
 * scripts/venue_grab/vg_ui.js
 * 场馆抢票面板 — 静态内嵌数据（vg_data.js，零运行时读取）
 * 校区 → 运动类型 → 场馆 三级级联；时段/场地随场馆联动；场地偏好可多选
 */
(function () {
    'use strict';
    if (!location.pathname.startsWith('/venue')) return;
    if (document.getElementById('vg-panel')) return;

    const CFG_KEY = 'vg_config';
    const DATA = window.__VG_DATA__ || { sites: [], buddies: [] };
    const DEFAULT_CFG = {
        triggerTime: '08:00:00', siteId: '', siteLabel: '', timeText: '08:00',
        spaceNames: [], buddyName: '', retries: 4, dryRun: false, autoCaptcha: false
    };
    let cfg = Object.assign({}, DEFAULT_CFG);

    // 当前页面 URL 里的 siteId（面板默认选中它）
    const curSiteId = (location.pathname.match(/venue-reservation\/(\d+)/) || [])[1] || '';

    const css = document.createElement('style');
    css.id = 'vg-style';
    css.textContent = `
        #vg-panel{position:fixed;right:20px;bottom:20px;z-index:999999;width:280px;
          background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.18);
          font:13px/1.5 -apple-system,'Segoe UI','PingFang SC',sans-serif;color:#222;overflow:hidden}
        #vg-panel .vg-head{background:#660874;color:#fff;padding:8px 14px;font-weight:700;
          display:flex;justify-content:space-between;align-items:center}
        #vg-panel .vg-body{padding:10px 14px;max-height:72vh;overflow-y:auto}
        #vg-panel label{display:block;margin:6px 0 2px;color:#666;font-size:12px}
        #vg-panel label.vg-inline{display:inline}
        #vg-panel select,#vg-panel input[type=text],#vg-panel input[type=number]{width:100%;box-sizing:border-box;
          border:1px solid #ddd;border-radius:8px;padding:5px 8px;font-size:13px;background:#fff}
        #vg-space-box{display:flex;flex-wrap:wrap;gap:4px;border:1px solid #eee;border-radius:8px;padding:6px}
        #vg-space-box:empty::after{content:'该场地无场地信息';color:#bbb;font-size:11px}
        #vg-space-box .vg-chk{display:inline-flex;align-items:center;gap:3px;margin:0;
          border:1px solid #e3d5e8;border-radius:10px;padding:2px 8px;font-size:11px;color:#444;
          cursor:pointer;user-select:none}
        #vg-space-box .vg-chk:has(input:checked){background:#660874;color:#fff;border-color:#660874}
        #vg-space-box .vg-chk input{width:auto;margin:0}
        #vg-space-all{border:0;background:none;color:#660874;font-size:11px;font-weight:700;
          cursor:pointer;padding:0;float:right}
        #vg-countdown{font-size:26px;font-weight:800;text-align:center;color:#660874;
          padding:6px 0;min-height:36px;font-variant-numeric:tabular-nums}
        #vg-log{max-height:110px;overflow-y:auto;background:#f7f5f9;border-radius:8px;
          padding:6px 8px;font-size:11px;color:#555;margin-top:8px}
        #vg-panel .vg-btns{display:flex;gap:8px;margin-top:10px}
        #vg-panel button.vg-btn{flex:1;border:0;border-radius:10px;padding:8px 0;font-weight:700;
          cursor:pointer;color:#fff}
        #vg-arm-btn{background:#660874}#vg-disarm-btn{background:#999}
        #vg-panel .vg-row{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#666}
    `;
    document.head.appendChild(css);

    const panel = document.createElement('div');
    panel.id = 'vg-panel';
    panel.innerHTML = `
        <div class="vg-head"><span>场馆抢票</span><span id="vg-phase">待命</span></div>
        <div class="vg-body">
          <div id="vg-countdown">--:--:--</div>
          <label>校区</label>
          <select id="vg-campus"></select>
          <label>运动类型</label>
          <select id="vg-sport"></select>
          <label>场馆</label>
          <select id="vg-site"></select>
          <label>目标时段（开始时刻）</label>
          <select id="vg-time"></select>
          <label>场地偏好（可多选，不选=抢最先可约的）<button id="vg-space-all" type="button">全选</button></label>
          <div id="vg-space-box"></div>
          <label>同伴</label>
          <select id="vg-buddy"><option value="">不选（手动处理）</option></select>
          <label>触发时间</label><input type="text" id="vg-trigger" placeholder="08:00:00">
          <label>重试次数</label><input type="number" id="vg-retries" min="1" max="20">
          <div class="vg-row"><input type="checkbox" id="vg-dryrun"><span>演练模式（只记录不点击）</span></div>
          <div class="vg-row"><input type="checkbox" id="vg-autocaptcha"><span>自动点选验证码（实验性）</span></div>
          <div class="vg-btns">
            <button id="vg-arm-btn" class="vg-btn">启动</button>
            <button id="vg-disarm-btn" class="vg-btn">取消</button>
          </div>
          <div id="vg-log"></div>
        </div>`;
    document.body.appendChild(panel);

    const $id = id => document.getElementById(id);
    const siteById = id => DATA.sites.find(s => s.id === String(id));

    // ---------- 级联下拉 ----------
    function fillCampus() {
        const sel = $id('vg-campus');
        const campuses = [...new Set(DATA.sites.map(s => s.campus))];
        sel.innerHTML = campuses.map(c => `<option value="${c}">${c}</option>`).join('');
        const cur = siteById(cfg.siteId || curSiteId);
        sel.value = cur ? cur.campus : campuses[0];
    }
    function fillSport() {
        const sel = $id('vg-sport');
        const sports = [...new Set(DATA.sites.filter(s => s.campus === $id('vg-campus').value).map(s => s.sport))];
        sel.innerHTML = sports.map(s => `<option value="${s}">${s}</option>`).join('');
        const cur = siteById(cfg.siteId || curSiteId);
        sel.value = cur && cur.campus === $id('vg-campus').value ? cur.sport : sports[0];
    }
    function fillSite() {
        const sel = $id('vg-site');
        const sites = DATA.sites.filter(s =>
            s.campus === $id('vg-campus').value && s.sport === $id('vg-sport').value);
        sel.innerHTML = sites.map(s =>
            `<option value="${s.id}">${s.venue}${s.spaces.length ? '' : '（暂未开放）'}</option>`).join('');
        const wanted = cfg.siteId || curSiteId;
        sel.value = sites.some(s => s.id === wanted) ? wanted : (sites[0] ? sites[0].id : '');
    }
    function fillTime() {
        const sel = $id('vg-time');
        const site = siteById($id('vg-site').value) || { times: [] };
        const times = [...new Set(site.times.map(t => t.t))].sort();
        sel.innerHTML = times.length
            ? times.map(t => `<option value="${t}">${t}</option>`).join('')
            : '<option value="">该场地暂无时段数据</option>';
        sel.value = times.includes(cfg.timeText) ? cfg.timeText : (times[0] || '');
    }
    function fillSpace() {
        const box = $id('vg-space-box');
        const site = siteById($id('vg-site').value) || { spaces: [] };
        box.innerHTML = site.spaces
            .map(s => `<label class="vg-chk"><input type="checkbox" value="${s}">${s}</label>`).join('');
        [...box.querySelectorAll('input')].forEach(i => { i.checked = cfg.spaceNames.includes(i.value); });
    }
    function fillBuddy() {
        const sel = $id('vg-buddy');
        sel.innerHTML = '<option value="">不选（手动处理）</option>' +
            DATA.buddies.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
        sel.value = DATA.buddies.some(b => b.name === cfg.buddyName) ? cfg.buddyName : '';
    }
    function fillForm() {
        fillCampus(); fillSport(); fillSite(); fillTime(); fillSpace(); fillBuddy();
        $id('vg-trigger').value = cfg.triggerTime;
        $id('vg-retries').value = cfg.retries;
        $id('vg-dryrun').checked = !!cfg.dryRun;
        $id('vg-autocaptcha').checked = !!cfg.autoCaptcha;
    }

    function readForm() {
        const siteSel = $id('vg-site');
        cfg = {
            triggerTime: $id('vg-trigger').value.trim() || '08:00:00',
            siteId: siteSel.value,
            siteLabel: `${$id('vg-campus').value} ${siteSel.selectedOptions[0] ? siteSel.selectedOptions[0].textContent : ''}`,
            timeText: $id('vg-time').value || '08:00',
            spaceNames: [...$id('vg-space-box').querySelectorAll('input:checked')].map(i => i.value),
            buddyName: $id('vg-buddy').value,
            retries: Math.max(1, parseInt($id('vg-retries').value, 10) || 4),
            dryRun: $id('vg-dryrun').checked,
            autoCaptcha: $id('vg-autocaptcha').checked
        };
        chrome.storage.local.set({ [CFG_KEY]: cfg });
        return cfg;
    }

    chrome.storage.local.get([CFG_KEY], d => {
        cfg = Object.assign({}, DEFAULT_CFG, d[CFG_KEY] || {});
        fillForm();
    });

    // 级联：校区→运动类型→场馆→时段/场地
    $id('vg-campus').addEventListener('change', () => { fillSport(); fillSite(); fillTime(); fillSpace(); });
    $id('vg-sport').addEventListener('change', () => { fillSite(); fillTime(); fillSpace(); });
    $id('vg-site').addEventListener('change', () => { fillTime(); fillSpace(); });

    // 场地全选/清空切换
    $id('vg-space-all').addEventListener('click', () => {
        const boxes = [...$id('vg-space-box').querySelectorAll('input')];
        const all = boxes.length && boxes.every(b => b.checked);
        boxes.forEach(b => { b.checked = !all; });
        $id('vg-space-all').textContent = all ? '全选' : '清空';
    });

    $id('vg-arm-btn').onclick = () =>
        window.dispatchEvent(new CustomEvent('vg_arm', { detail: { cfg: readForm() } }));
    $id('vg-disarm-btn').onclick = () =>
        window.dispatchEvent(new CustomEvent('vg_disarm'));
})();
