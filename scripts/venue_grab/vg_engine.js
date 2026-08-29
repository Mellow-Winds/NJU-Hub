/**
 * scripts/venue_grab/vg_engine.js
 * 场馆抢票引擎 — 武装预检 → 倒计时 → 狩猎(限频刷新) → 匹配点击 → 重试 → 人工交接
 * 状态经 chrome.storage.local['vg_state'] 跨页面刷新存活（狩猎循环依赖 reload）
 *
 * 点击链（2026-08-29 采集实测）：
 *   点格子(.reserveBlock.free) → 点同伴(.buddy-row，可选) → 勾须知(.xieyi) →
 *   点提交(.submit_order_box .action .btn) → .verifybox 验证码浮层出现 → 人工点选文字
 */
(function () {
    'use strict';
    if (!location.pathname.startsWith('/venue')) return;

    const { todayAt, cellTimes, pickCandidate } = window.__VG_MATCH__;
    const SEL = window.__VG_SEL__;
    const STATE_KEY = 'vg_state';
    const POLL_MS = 100, POLL_WINDOW_MS = 2000;   // 每轮刷新后最多等 2s
    const MAX_ATTEMPTS = 60, WINDOW_MS = 180000;  // 兜底上限
    const CELL_WAIT_MS = 150, RETRY_GAP_MS = 200;
    const SUBMIT_POLL_MS = 100, SUBMIT_TIMEOUT_MS = 3000; // 提交后轮询验证码/失败提示
    const LEAD_MS = 800;  // 提前量：T-0 前 0.8s 发起刷新，让 day/info 请求正好落在 8 点后

    const $ = id => document.getElementById(id);
    let state = { armed: false, phase: '', startAt: 0, deadline: 0, attempts: 0, tried: [], log: [] };
    let pollTimer = null, tickTimer = null;

    // ---------- 存储与日志 ----------
    const save = () => chrome.storage.local.set({ [STATE_KEY]: state });
    function log(msg) {
        state.log = (state.log || []).concat(`[${new Date().toLocaleTimeString('zh-CN')}] ${msg}`).slice(-30);
        save(); renderLog();
    }
    function renderLog() {
        const el = $('vg-log'); if (!el) return;
        el.innerHTML = (state.log || []).map(l => `<div>${l}</div>`).join('');
        el.scrollTop = el.scrollHeight;
    }
    function setPhase(p) { state.phase = p; const el = $('vg-phase'); if (el) el.textContent = p; save(); }

    // ---------- 登录态预检（DOM 判定） ----------
    // ponytail: 场馆 API 有 app-key/timestamp/sign/cgAuthorization 签名防护，
    // 自构造请求必然 401/400，故不调接口；token 失效时 SPA 整页跳 CAS，
    // 页面上 .isLogin 状态条仍在 = 登录态存活
    function checkLogin() {
        const ok = !!document.querySelector(SEL.isLogin) && !location.href.includes('authserver');
        return Promise.resolve({ ok, reason: ok ? '' : '未检测到登录状态，请先在场馆系统完成统一认证登录' });
    }

    // ---------- DOM 探测 ----------
    const visible = el => el && el.offsetParent;
    function headerStarts(table) {
        // 表头每列的开始时刻（按 colspan 展开后的栅格列号索引）
        const map = {};
        let col = 0;
        for (const cell of table.querySelectorAll('thead tr:first-child th, thead tr:first-child td')) {
            const start = cellTimes(cell.innerText)[0];
            if (start) map[col] = start;
            col += cell.colSpan || 1;
        }
        return map;
    }
    function collectCells() {
        const table = document.querySelector(SEL.gridTable);
        if (!table) return [];
        const starts = headerStarts(table);
        const cells = [];
        for (const tr of table.querySelectorAll('tbody tr')) {
            const tds = [...tr.cells];
            const site = (tds[0] && tds[0].innerText || '').trim();
            for (let i = 1; i < tds.length; i++) {
                const block = tds[i].querySelector(SEL.slotBlock);
                if (!block) continue;
                let col = 0;
                for (const t of tds.slice(0, i)) col += t.colSpan || 1;
                const start = starts[col];
                if (!start) continue;
                cells.push({
                    el: block, text: `${site} ${start}`,
                    available: block.classList.contains(SEL.freeClass)
                });
            }
        }
        return cells;
    }
    const captchaOpen = () => visible(document.querySelector(SEL.captchaBox));
    function failToast() {
        for (const s of SEL.toast) {
            for (const t of document.querySelectorAll(s)) {
                if (!visible(t)) continue;
                const kw = SEL.failKeywords.find(k => t.innerText.includes(k));
                if (kw) return t.innerText.trim();
            }
        }
        return null;
    }

    // ---------- 点击链 ----------
    function ensureAgree() {
        const w = document.querySelector(SEL.agreeWrapper);
        if (w && !w.classList.contains(SEL.agreeCheckedClass)) {
            w.click();
            log('已勾选预约须知');
        }
    }
    function ensureBuddy(name) {
        if (!name) return;
        const row = [...document.querySelectorAll(SEL.buddyRow)]
            .find(e => e.innerText.trim() === name || e.innerText.includes(name));
        if (row && !row.classList.contains(SEL.buddyActiveClass)) {
            row.click();
            log(`已选择同伴：${row.innerText.trim()}`);
        } else if (!row) {
            log(`未找到同伴"${name}"，请手动选择`);
        }
    }
    function tryClickChain(cfg) {
        setPhase('clicking');
        const cell = pickCandidate(
            collectCells(),
            { targetTimes: [cfg.timeText], fallbackTimes: [], sitePrefs: cfg.spaceNames || [] },
            state.tried
        );
        if (!cell) return stop('无可约目标');
        state.tried.push(cell.text);
        log(`点击格子：${cell.text}`);
        if (!cfg.dryRun) cell.el.click();

        setTimeout(() => {
            ensureBuddy(cfg.buddyName);
            ensureAgree();
            const btn = document.querySelector(SEL.submitBtn);
            if (!visible(btn)) { log('未找到提交按钮'); return stop('无提交按钮'); }
            log(cfg.dryRun ? '[演练] 应点击提交' : '点击提交');
            if (!cfg.dryRun) btn.click();

            // 提交后轮询：验证码浮层一出现立即处理（自动点选或交接人工）
            const t0 = Date.now();
            const checkTimer = setInterval(() => {
                if (captchaOpen()) {
                    clearInterval(checkTimer);
                    if (!(cfg.autoCaptcha && window.__VG_CAPTCHA_AUTO__)) {
                        setPhase('handoff');
                        log('验证码已弹出，请点选文字完成提交');
                        disarm();
                        return;
                    }
                    setPhase('autocaptcha');
                    log('验证码已弹出，自动点选中…');
                    window.__VG_CAPTCHA_AUTO__.run().then(res => {
                        if (res === 'solved') {
                            setPhase('handoff');
                            log('验证码通过，预约已提交，请查看结果');
                        } else {
                            setPhase('handoff');
                            log('自动点选未成功，请手动完成验证码');
                        }
                        disarm();
                    });
                    return;
                }
                const fail = failToast();
                if (fail) {
                    clearInterval(checkTimer);
                    if (state.tried.length <= cfg.retries) {
                        log(`失败：${fail}，重试 ${state.tried.length}/${cfg.retries}`);
                        setTimeout(() => tryClickChain(cfg), RETRY_GAP_MS);
                    } else {
                        stop(`重试耗尽：${fail}`);
                    }
                    return;
                }
                if (Date.now() - t0 > SUBMIT_TIMEOUT_MS) {
                    clearInterval(checkTimer);
                    stop('提交后无验证码浮层，请人工检查页面');
                }
            }, SUBMIT_POLL_MS);
        }, CELL_WAIT_MS);
    }

    // ---------- 狩猎循环（跨刷新存活） ----------
    // T-0 入口：格子已渲染（8 点后武装/已在新页）→ 直接开抢；否则跳转/刷新
    function beginHunt(cfg) {
        if (collectCells().length) {
            log('格子已渲染，直接开抢');
            return tryClickChain(cfg);
        }
        setPhase('hunting'); save();
        log('触发！开始狩猎');
        const cur = location.pathname.match(/venue-reservation\/(\d+)/);
        if (cfg.siteId && (!cur || cur[1] !== String(cfg.siteId))) {
            log(`跳转目标场馆：${cfg.siteLabel || cfg.siteId}`);
            location.href = `/venue/venue-reservation/${cfg.siteId}`;
        } else {
            location.reload(); // 引擎在下次 load 时经 resume() 接续
        }
    }

    function huntTick(cfg) {
        if (Date.now() > state.deadline || state.attempts >= MAX_ATTEMPTS) return stop('时间窗口/次数超限');
        state.attempts += 1;
        save();
        log(`格子未渲染，第 ${state.attempts} 次刷新`);
        location.reload(); // 引擎在下次 load 时经 resume() 接续
    }

    function pollForGrid(cfg) {
        const t0 = Date.now();
        clearInterval(pollTimer);
        pollTimer = setInterval(() => {
            if (!state.armed) return clearInterval(pollTimer);
            if (collectCells().length) {
                clearInterval(pollTimer);
                log('格子已渲染，开始点击');
                return tryClickChain(cfg);
            }
            if (Date.now() - t0 > POLL_WINDOW_MS) {
                clearInterval(pollTimer);
                return huntTick(cfg); // 2s 未渲染 → 刷新
            }
        }, POLL_MS);
    }

    function resume() {
        chrome.storage.local.get([STATE_KEY], d => {
            state = Object.assign(state, d[STATE_KEY] || {});
            if (!state.armed || !state.phaseCfg) return;
            renderLog(); setPhase(state.phase);
            // 刷新后钩子/OCR 包随旧页面销毁，重新注入（模型有浏览器缓存，代价小）
            if (state.phaseCfg.autoCaptcha) {
                chrome.runtime.sendMessage({ action: 'injectVenueOcr' });
            }
            if (state.phase === 'hunting') setTimeout(() => pollForGrid(state.phaseCfg), 800);
        });
    }

    // ---------- 武装 / 解除 ----------
    function arm(cfg) {
        checkLogin().then(r => {
            if (!r.ok) { log(`预检失败：${r.reason}`); alert(`NJU-Hub 抢票预检：${r.reason}`); return; }
            log('登录态预检通过');
            if (cfg.autoCaptcha) {
                // 预热：注入验证码钩子 + OCR 推理包并加载模型（离 T-0 还有几分钟）
                chrome.runtime.sendMessage({ action: 'injectVenueOcr' }, res => {
                    log(res && res.ok ? '验证码自动点选已预热' : '验证码预热注入失败');
                });
            }
            const today = todayAt(cfg.triggerTime, Date.now());
            state = {
                armed: true, phase: 'countdown', phaseCfg: cfg,
                startAt: today > Date.now() ? today : Date.now(), // 触发时间已过 → 立即
                deadline: Date.now() + WINDOW_MS, attempts: 0, tried: [], log: state.log
            };
            save(); startCountdown(cfg);
        });
    }
    function startCountdown(cfg) {
        setPhase('countdown');
        clearInterval(tickTimer);
        tickTimer = setInterval(() => {
            if (!state.armed) return clearInterval(tickTimer);
            const left = state.startAt - Date.now();
            const cd = $('vg-countdown');
            if (cd) cd.textContent = left > 0 ? new Date(left).toISOString().substr(11, 8) : '00:00:00';
            if (left <= LEAD_MS) {  // 提前 LEAD_MS 发起，让 day/info 请求正好落在 T-0 后
                clearInterval(tickTimer);
                beginHunt(cfg);
            }
        }, 100);
    }
    function stop(reason) {
        log(`结束：${reason}`);
        alert(`NJU-Hub 抢票结束：${reason}`);
        disarm();
    }
    function disarm() {
        state.armed = false; state.phase = ''; state.phaseCfg = null; state._guarded = false;
        clearInterval(tickTimer); clearInterval(pollTimer);
        const cd = $('vg-countdown'); if (cd) cd.textContent = '--:--:--';
        setPhase('待命'); save();
    }

    // T-60s 登录态复检（用户要求：抢场前保证令牌不掉）
    setInterval(() => {
        if (state.armed && state.phase === 'countdown' &&
            state.startAt - Date.now() <= 60000 && !state._guarded) {
            state._guarded = true; save();
            checkLogin().then(r => {
                if (!r.ok) { log(`T-60s 复检失败：${r.reason}`); alert(`NJU-Hub：${r.reason}，请立即处理！`); }
            });
        }
    }, 1000);

    window.addEventListener('vg_arm', e => arm(e.detail.cfg));
    window.addEventListener('vg_disarm', () => disarm());
    // 自动点选模块的诊断日志进面板
    window.addEventListener('vg_ai_log', e => log('[AI] ' + e.detail));
    resume(); // 刷新后接续狩猎
})();
