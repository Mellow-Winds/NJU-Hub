/**
 * scripts/schedule/xk_schedule_grabber.js
 *
 * 内容脚本：监听 njuScheduleGrab 消息，抓取选课系统「已选课程」窗口的课程数据
 *   「我的课程」页签 → cls='sel'（已选必修）；「我的报名」页签 → cls='pre'（预选待抽签）
 * 依赖：无（独立命名空间 window.__XK_SCHED__，与选课助手的 __XK__ 隔离）
 */

(function () {
    'use strict';

    const NS = (window.__XK_SCHED__ = window.__XK_SCHED__ || {});
    if (NS.loaded) return;   // 防重复注册（扩展重载后 executeScript 兜底注入）
    NS.loaded = true;

    const log = (...args) => console.log('[NJU-Hub] 课表抓取:', ...args);

    // ============ 1. 工具 ============
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    /** 当前可见的课程行（jqx 页签的非激活面板为 display:none，不可见） */
    const visibleRows = () => Array.from(document.querySelectorAll('tr.course-tr'))
        .filter((r) => r.getClientRects().length > 0);

    /** 克隆单元格并剔除 NJU-Hub 注入的徽章/换行后取纯文本 */
    const cleanCell = (sel, row) => {
        const cell = row.querySelector(sel);
        if (!cell) return '';
        const clone = cell.cloneNode(true);
        clone.querySelectorAll('.nj-badge, .nj-br').forEach((el) => el.remove());
        return clone.textContent.trim();
    };

    // ============ 2. 行解析 ============

    /**
     * data-fav-id 交叉校验/回退源
     * 必修格式：名称||时段\n时段；报名格式：名称|教师|时段
     */
    const parseFavId = (favId) => {
        if (!favId) return { name: '', teacher: '', times: [] };
        if (favId.includes('||')) {
            const idx = favId.indexOf('||');
            const times = favId.slice(idx + 2).split('\n').map((t) => t.trim()).filter(Boolean);
            return { name: favId.slice(0, idx).trim(), teacher: '', times };
        }
        const parts = favId.split('|');
        if (parts.length >= 3) {
            return { name: parts[0].trim(), teacher: parts[1].trim(), times: [parts.slice(2).join('|').trim()] };
        }
        return { name: (parts[0] || '').trim(), teacher: '', times: [] };
    };

    /**
     * 选中概率：优先 NJU-Hub 注入徽章「选中概率: N%」，其次按「已选/上限」计算
     * （cap/enroll 与选课助手 calcProb 一致，如 163/20 → 12%）
     */
    const extractProb = (row) => {
        const cell = row.querySelector('.yxrs');
        if (!cell) return null;
        const badge = cell.querySelector('.nj-badge');
        if (badge) {
            const m = badge.textContent.match(/选中概率[:：]\s*(\d+)%/);
            if (m) return parseInt(m[1]);
        }
        const parts = cell.textContent.trim().split('/');
        if (parts.length === 2) {
            const enroll = parseInt(parts[0]), cap = parseInt(parts[1]);
            if (!isNaN(enroll) && !isNaN(cap) && cap > 0) {
                const prob = enroll === 0 ? 100 : Math.round((cap / enroll) * 100);
                return Math.min(prob, 100);
            }
        }
        return null;
    };

    /** 一行课程 → 结构化字段（时间串原样保留，解析在课表页 schedule_parser.js 统一做） */
    const parseRow = (row, fallbackCls) => {
        const isMyCourse = !!row.querySelector('td.xklx');   // 我的课程（已选必修）
        const isMyApply = !!row.querySelector('td.yxrs');     // 我的报名（预选待抽签）
        const cls = isMyCourse ? 'sel' : (isMyApply ? 'pre' : fallbackCls);

        let name = cleanCell('td.kcmc', row);
        let teacher = cleanCell('td.jsmc', row);
        let times = Array.from(row.querySelectorAll('td.sjdd .sjdd-item'))
            .map((el) => el.textContent.trim()).filter(Boolean);
        const campus = cleanCell('td.xq', row);

        // 课程号：kch 单元格去掉收藏按钮后的剩余文本（如 00020010A）
        let code = '';
        const kch = row.querySelector('td.kch');
        if (kch) {
            const clone = kch.cloneNode(true);
            clone.querySelectorAll('.fav-toggle-btn').forEach((el) => el.remove());
            code = clone.textContent.trim();
        }

        // 字段缺失时用 data-fav-id 回退
        const favId = row.querySelector('.kch .fav-toggle-btn')?.getAttribute('data-fav-id') || '';
        const fav = parseFavId(favId);
        if (!name && fav.name) name = fav.name;
        if (!teacher && fav.teacher) teacher = fav.teacher;
        if (!times.length && fav.times.length) times = fav.times;

        if (!name) return null;   // 拿不到课程名 → 无效行

        const prob = isMyApply ? extractProb(row) : null;
        return {
            name,
            teacher,
            clsName: '',
            code,
            campus,
            timeRaw: times.join('，'),
            cls,
            note: prob !== null ? code + ' · ' + prob + '%' : '',
            tcid: row.dataset.teachingclassid || ''
        };
    };

    // ============ 3. 页签与窗口 ============
    /** jqx 双页签（我的课程 / 我的报名），按标题文本精确匹配 */
    const findTabs = () => Array.from(document.querySelectorAll('.jqx-tabs-titleContentWrapper'))
        .filter((el) => ['我的课程', '我的报名'].includes(el.textContent.trim()));

    const clickTab = (wrapper) => {
        try { wrapper.click(); } catch (e) { /* 忽略个别 jqx 版本的点击差异 */ }
        return wait(500);
    };

    /** 失败时截取页面 DOM 样本，供选择器校准（写入课表页 console） */
    const sample = () => {
        const el = document.querySelector('.jqx-tabs') || document.querySelector('[class*="course-"]') || document.body;
        return ((el && el.outerHTML) || String(el)).slice(0, 800);
    };

    // ============ 4. 主抓取流程 ============

    /** 已选课程窗口内的课程行（jqx 窗口容器内，避免误抓选课主列表的行） */
    const windowRows = () => visibleRows().filter((r) =>
        r.closest('.jqx-window') || r.closest('[class*="window-content"]') || r.closest('[class*="window-container"]'));

    const findOpenBtn = () => document.querySelector('button.yxkc-window-btn') ||
        document.querySelector('button[data-i18n-text="home.selectedCourse"]') ||
        Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '已选课程') ||
        null;

    const grabAll = async () => {
        // 窗口未开 → 点击「已选课程」按钮打开（轮询 3s，失败再点一次）
        let rows = windowRows();
        if (!rows.length) {
            const openBtn = findOpenBtn();
            if (!openBtn) {
                return {
                    ok: false,
                    error: '未找到「已选课程」按钮',
                    hint: '请先进入选课系统首页并登录，再回来重新点击同步。',
                    sampleHtml: sample()
                };
            }
            for (let attempt = 0; attempt < 2 && !rows.length; attempt++) {
                openBtn.click();
                for (let i = 0; i < 12 && !rows.length; i++) {
                    await wait(250);
                    rows = windowRows();
                }
            }
        }

        // 仍无窗口行：若页签容器存在则回退抓全部可见行（窗口容器类名可能不同），否则提示用户手动打开
        if (!rows.length) {
            if (!findTabs().length) {
                return {
                    ok: false,
                    error: '「已选课程」窗口未打开',
                    hint: '请点击选课页面上的「已选课程」按钮打开窗口后再同步（或把窗口保持在打开状态）。',
                    sampleHtml: sample()
                };
            }
            rows = visibleRows();
        }

        const seen = new Set();
        const out = [];

        const collect = (fallbackCls) => {
            // 窗口打开时主列表的行也在页面中可见，严格限定在窗口内抓取
            const rowsToScrape = windowRows().length ? windowRows() : visibleRows();
            for (const row of rowsToScrape) {
                const tcid = row.dataset.teachingclassid;
                const sig = tcid || [
                    cleanCell('td.kch', row), cleanCell('td.kcmc', row), cleanCell('td.sjdd', row)
                ].join('|');
                if (seen.has(sig)) continue;
                const parsed = parseRow(row, fallbackCls);
                if (!parsed) continue;
                seen.add(sig);
                out.push(parsed);
            }
        };

        const tabs = findTabs();
        if (tabs.length >= 2) {
            // 依次切到两个页签各抓一次（我的课程 → sel，我的报名 → pre）
            for (const t of tabs) {
                await clickTab(t);
                collect(t.textContent.trim() === '我的课程' ? 'sel' : 'pre');
            }
        } else {
            collect('sel');
        }

        if (!out.length) {
            return {
                ok: false,
                error: '未抓到课程行',
                hint: '请确认已进入「已选课程」窗口（我的课程 / 我的报名），并重新点击同步。',
                sampleHtml: sample()
            };
        }
        log('抓到', out.length, '门课程');
        return { ok: true, count: out.length, rows: out };
    };

    // ============ 5. 消息监听 ============
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!msg || msg.action !== 'njuScheduleGrab') return;
        grabAll().then(sendResponse);
        return true;   // 异步响应
    });
})();
