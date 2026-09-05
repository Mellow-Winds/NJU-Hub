// schedule/schedule.js — 课表页主控制器：视图切换、编辑、同步状态机、冲突检测、主题

let data = null;            // 当前课表数据（NJU_SCHED_TABLE）
let currentView = 'grid';
let saveTimer = null;
let syncing = false;

const CLS_LABEL = { sel: '已选', pre: '预选', pre_cf: '预选·撞必修' };
const DAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五'];

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    data = await window.__SCHED__.load();
    bindTopbar();
    bindMetaForm();
    bindCourseList();
    renderGridView();
    renderEditView();
});

// ============ 1. 主题（与 webportal 同款：MD3 变量 + data-theme 标记） ============
function initTheme() {
    const MCU = window.MaterialColorUtils;
    if (!MCU) return;
    chrome.storage.sync.get(['ui_theme_color', 'ui_theme_mode'], (d) => {
        const color = d.ui_theme_color || '#0ea5e9';
        const isDark = d.ui_theme_mode === 'dark';
        if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        MCU.applyTheme(color, isDark);
    });
}

// ============ 2. 提示条 ============
let toastTimer = null;
function showToast(msg, isError = false) {
    const el = document.getElementById('sync-message');
    el.textContent = msg;
    el.classList.toggle('error', isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 5000);
}

// ============ 3. 顶栏事件 ============
function bindTopbar() {
    document.querySelectorAll('.nav-link[data-view]').forEach((btn) => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.getElementById('brand-home').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('grid');
    });
    document.getElementById('sync-button').addEventListener('click', onSync);
    document.getElementById('export-button').addEventListener('click', onExport);
    document.getElementById('btn-save').addEventListener('click', () => doSave(true));
    document.getElementById('btn-add-course').addEventListener('click', addCourse);
    document.getElementById('btn-conflict-check').addEventListener('click', autoCheckConflicts);
}

function switchView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach((v) => {
        v.classList.toggle('active', v.id === name + '-view');
    });
    document.querySelectorAll('.nav-link[data-view]').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === name);
    });
}

// ============ 4. 课表网格视图 ============
function renderGridView() {
    const container = document.getElementById('grid-render');
    if (!data.courses.length) {
        container.innerHTML =
            '<div class="empty-state">' +
            '<h2>还没有课程数据</h2>' +
            '<p>从选课系统「已选课程」页一键同步，或在编辑视图手动添加课程。</p>' +
            '<div class="empty-actions">' +
            '<button class="filled-button" id="empty-sync" type="button">从选课系统同步</button>' +
            '<button class="text-button" id="empty-add" type="button">手动添加课程</button>' +
            '</div></div>';
        document.getElementById('empty-sync').addEventListener('click', onSync);
        document.getElementById('empty-add').addEventListener('click', () => {
            addCourse();
            switchView('edit');
        });
        return;
    }
    window.__SCHED__.renderGrid(container, data.meta, data.courses);
}

// ============ 5. 编辑视图 ============
const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderEditView() {
    // meta 表单回填（输入框聚焦中时跳过，避免打断输入）
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = val;
    };
    setVal('meta-season', data.meta.season);
    setVal('meta-title', data.meta.title);
    setVal('meta-subtitle', data.meta.subtitle);
    setVal('meta-h', data.meta.h);
    setVal('meta-snapshot', data.meta.snapshot);
    setVal('meta-notes', (data.meta.notes || []).join('\n'));

    renderCourseList();
}

function renderCourseList() {
    const list = document.getElementById('course-list');
    if (!data.courses.length) {
        list.innerHTML = '<div class="empty-state" style="padding:24px">' +
            '<p>暂无课程，点击右上「＋ 添加课程」，或从选课系统同步。</p></div>';
        return;
    }
    list.innerHTML = data.courses.map((c, i) => courseCardHtml(c, i)).join('');
}

/** 一门课程 → 一张编辑卡片 */
function courseCardHtml(c, i) {
    const opts = (from, to, cur) => {
        let s = '';
        for (let v = from; v <= to; v++) s += `<option value="${v}"${v === cur ? ' selected' : ''}>${v}</option>`;
        return s;
    };
    const dayOpts = DAY_LABELS.map((label, v) =>
        v === 0 ? '' : `<option value="${v}"${v === c.day ? ' selected' : ''}>${label}</option>`).join('');
    const clsOpts = Object.keys(CLS_LABEL).map(k =>
        `<option value="${k}"${k === c.cls ? ' selected' : ''}>${CLS_LABEL[k]}</option>`).join('');

    return '<div class="course-card" data-index="' + i + '">' +
        '<div class="course-card-head">' +
        '<span class="course-card-index">#' + (i + 1) + '</span>' +
        '<input class="field-name" data-field="name" value="' + esc(c.name) + '" placeholder="课程名">' +
        '<span class="cls-badge ' + c.cls + '">' + CLS_LABEL[c.cls] + '</span>' +
        (c.parseFail ? '<span class="parse-fail-badge" title="抓取的时间串无法解析，请手工补全星期/节次后自动清除">解析失败</span>' : '') +
        '<button class="card-delete" data-act="delete" type="button">删除</button>' +
        '</div>' +
        '<div class="course-card-grid">' +
        '<label class="course-field">课程号<input data-field="code" value="' + esc(c.code) + '" placeholder="如 00020010A"></label>' +
        '<label class="course-field">班号<input data-field="clsName" value="' + esc(c.clsName) + '" placeholder="如 02班"></label>' +
        '<label class="course-field">教师<input data-field="teacher" value="' + esc(c.teacher) + '"></label>' +
        '<label class="course-field">星期<select data-field="day">' + dayOpts + '</select></label>' +
        '<label class="course-field">开始节<select data-field="s">' + opts(1, 11, c.s) + '</select></label>' +
        '<label class="course-field">结束节(不含)<select data-field="e">' + opts(2, 12, c.e) + '</select></label>' +
        '<label class="course-field">周次<input data-field="weeks" value="' + esc(c.weeks) + '" placeholder="如 4-18、7-14单"></label>' +
        '<label class="course-field">教室<input data-field="room" value="' + esc(c.room) + '"></label>' +
        '<label class="course-field">校区<input data-field="campus" value="' + esc(c.campus) + '"></label>' +
        '<label class="course-field">状态<select data-field="cls">' + clsOpts + '</select></label>' +
        '<label class="course-field">note 覆盖<input data-field="note" value="' + esc(c.note) + '" placeholder="留空自动派生"></label>' +
        '<label class="course-field">info 覆盖<input data-field="info" value="' + esc(c.info) + '" placeholder="留空自动派生"></label>' +
        (c.timeRaw ? '<div class="course-field course-row-full">抓取原文' +
            '<span class="time-raw' + (c.parseFail ? ' fail' : '') + '">' + esc(c.timeRaw) + '</span></div>' : '') +
        '</div></div>';
}

// ============ 6. 编辑事件与保存 ============
function bindMetaForm() {
    document.getElementById('meta-form').addEventListener('input', (e) => {
        const el = e.target;
        if (!el.id || !el.id.startsWith('meta-')) return;
        const key = el.id.slice(5);
        if (key === 'h') {
            const v = parseInt(el.value);
            data.meta.h = (isNaN(v) || v < 20) ? 44 : v;
        } else if (key === 'notes') {
            data.meta.notes = el.value.split(/\r?\n/).filter((l) => l.trim());
        } else {
            data.meta[key] = el.value;
        }
        scheduleSave();
    });
}

function bindCourseList() {
    const list = document.getElementById('course-list');
    list.addEventListener('input', onCourseInput);
    list.addEventListener('change', onCourseInput);
    list.addEventListener('click', (e) => {
        const delBtn = e.target.closest('[data-act="delete"]');
        if (!delBtn) return;
        const card = delBtn.closest('.course-card');
        const idx = parseInt(card.dataset.index);
        const name = data.courses[idx]?.name || '未命名课程';
        const doDelete = () => {
            data.courses.splice(idx, 1);
            doSave(true);
            renderEditView();
        };
        if (window.NjuModal) {
            NjuModal.confirm({
                title: '删除课程',
                message: '确定删除「' + name + '」？',
                confirmText: '删除',
                cancelText: '取消',
                danger: true,
                onConfirm: doDelete
            });
        } else if (window.confirm('确定删除「' + name + '」？')) {
            doDelete();
        }
    });
}

function onCourseInput(e) {
    const input = e.target;
    const card = input.closest('.course-card');
    if (!card || !input.dataset.field) return;
    const c = data.courses[parseInt(card.dataset.index)];
    if (!c) return;

    const field = input.dataset.field;
    if (field === 'cls') {
        c.cls = input.value;
        const badge = card.querySelector('.cls-badge');
        badge.className = 'cls-badge ' + c.cls;
        badge.textContent = CLS_LABEL[c.cls];
    } else if (field === 'day' || field === 's' || field === 'e') {
        const v = parseInt(input.value);
        if (isNaN(v)) return;
        c[field] = v;
        // 保证结束节 > 开始节
        if (c.e <= c.s) {
            if (field === 's') { c.e = c.s + 1; card.querySelector('[data-field="e"]').value = c.e; }
            else { c.s = c.e - 1; card.querySelector('[data-field="s"]').value = c.s; }
        }
        // 手工补全时间 → 清除解析失败标记
        if (c.parseFail) clearParseFail(card, c);
    } else {
        c[field] = input.value;
        if (field === 'weeks' && c.parseFail) clearParseFail(card, c);
    }
    scheduleSave();
}

function clearParseFail(card, c) {
    c.parseFail = false;
    const badge = card.querySelector('.parse-fail-badge');
    if (badge) badge.remove();
    const raw = card.querySelector('.time-raw.fail');
    if (raw) raw.classList.remove('fail');
}

function addCourse() {
    const c = window.__SCHED__.defaultCourse();
    c.manual = true;   // 手动添加的课程同步时不会被覆盖
    data.courses.push(c);
    renderEditView();
    const list = document.getElementById('course-list');
    const cards = list.querySelectorAll('.course-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 输入防抖 500ms 自动写 storage，并实时重渲染网格
function scheduleSave(immediate = false) {
    clearTimeout(saveTimer);
    if (immediate) { doSave(true); return; }
    saveTimer = setTimeout(() => doSave(false), 500);
}

async function doSave(withToast) {
    try {
        await window.__SCHED__.save(data);
        renderGridView();
        if (withToast) showToast('已保存');
    } catch (e) {
        console.warn('[NJU-Hub] 课表: 保存失败', e);
        showToast('保存失败：' + (e && e.message || e), true);
    }
}

// ============ 7. 自动冲突检测（pre 与任一 sel 时间重叠 → pre_cf） ============
const weeksRange = (c) => {
    const m = (c.weeks || '').match(/(\d+)-(\d+)/);
    if (!m) return null;
    return [parseInt(m[1]), parseInt(m[2])];
};
const weeksOverlap = (a, b) => {
    const ra = weeksRange(a), rb = weeksRange(b);
    if (!ra || !rb) return true;   // 周次未知视作整学期（保守）
    return Math.max(ra[0], rb[0]) <= Math.min(ra[1], rb[1]);
};
const timeOverlap = (a, b) => a.day === b.day && a.s < b.e && b.s < a.e;

function autoCheckConflicts() {
    const sels = data.courses.filter((c) => c.cls === 'sel' && !c.parseFail);
    let changed = 0;
    for (const c of data.courses) {
        if (c.cls === 'sel' || c.parseFail) continue;
        const conflict = sels.some((x) => x !== c && timeOverlap(c, x) && weeksOverlap(c, x));
        const want = conflict ? 'pre_cf' : 'pre';
        if (c.cls !== want) { c.cls = want; changed++; }
    }
    doSave(true);
    renderEditView();
    showToast('冲突检测完成：' + changed + ' 门课程状态已更新');
}

// ============ 8. 从选课系统同步（状态机） ============
function setSyncing(on) {
    syncing = on;
    const btn = document.getElementById('sync-button');
    btn.disabled = on;
    btn.classList.toggle('loading', on);
}

async function onSync() {
    if (syncing) return;
    setSyncing(true);
    try {
        const tabs = await chrome.tabs.query({ url: '*://xk.nju.edu.cn/*' });
        // 过滤登录页（authserver 重定向过来时 URL 可能带 authserver），优先已激活且加载完成的页
        const clean = tabs.filter((t) => !/authserver/i.test(t.url || '') && t.status === 'complete');
        let tab = clean.find((t) => t.active) || clean[0] ||
            tabs.find((t) => !/authserver/i.test(t.url || '')) || tabs[0];
        if (!tab || tab.id == null) {
            showToast('已打开选课系统，请登录并进入「已选课程」页后回来再次点击同步。');
            await chrome.tabs.create({ url: 'https://xk.nju.edu.cn/' });
            return;
        }
        // 激活目标标签页：部分 SPA 在后台标签页不响应内容脚本的点击
        if (!tab.active) {
            await chrome.tabs.update(tab.id, { active: true });
            await new Promise((r) => setTimeout(r, 400));
        }
        const resp = await grabFromTab(tab.id);
        if (!resp) {
            showToast('同步失败：无法与选课页通信（页面可能未完全加载），请刷新选课页后重试。', true);
            return;
        }
        if (!resp.ok) {
            showToast(resp.hint || resp.error || '未找到课程数据。', true);
            if (resp.sampleHtml) {
                console.log('[NJU-Hub] 课表: 选课页 DOM 样本（供选择器校准）:\n', resp.sampleHtml);
            }
            return;
        }
        const { courses, failCount } = window.__SCHED__.rowsToCourses(resp.rows || []);
        if (failCount) {
            console.log('[NJU-Hub] 课表: 以下时间串解析失败（原文已保留，可在编辑视图手工补全）:',
                courses.filter((c) => c.parseFail).map((c) => c.timeRaw));
        }
        window.__SCHED__.mergeSynced(data, courses);
        const today = new Date().toISOString().slice(0, 10);
        data.meta.snapshot = today + ' · 从选课系统同步 ' + resp.count + ' 门课程';
        await window.__SCHED__.save(data);
        renderGridView();
        renderEditView();
        const msg = '同步成功：抓取 ' + resp.count + ' 门课程（' + courses.length + ' 个时间段）' +
            (failCount ? '；' + failCount + ' 行时间解析失败，已保留原文（编辑视图中标红）' : '');
        showToast(msg);
    } catch (e) {
        console.warn('[NJU-Hub] 课表: 同步异常', e);
        showToast('同步失败：' + (e && e.message || e), true);
    } finally {
        setSyncing(false);
    }
}

/**
 * 向选课页内容脚本发抓取消息；无接收端时注入兜底并重试（覆盖 SPA 未渲染完 / 扩展刚重载）
 * @returns {Promise<object|null>} 结构化响应；null=最终无响应
 */
async function grabFromTab(tabId) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const resp = await sendTabMessage(tabId, { action: 'njuScheduleGrab' });
        if (resp !== null) return resp;
        if (attempt === 0) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['scripts/schedule/xk_schedule_grabber.js']
                });
            } catch (e) {
                console.warn('[NJU-Hub] 课表: 注入抓取脚本失败', e);
            }
        }
        await new Promise((r) => setTimeout(r, 800));
    }
    return null;
}

const sendTabMessage = (tabId, msg) => new Promise((resolve) => {
    try {
        chrome.tabs.sendMessage(tabId, msg, (resp) => {
            if (chrome.runtime.lastError) { resolve(null); return; }
            resolve(resp);
        });
    } catch (e) {
        resolve(null);
    }
});

// ============ 9. 导出单文件 HTML ============
async function onExport() {
    const res = await window.__SCHED__.downloadHtml(data.meta, data.courses);
    showToast(res.ok ? '课表 HTML 已导出，请查看浏览器下载。' : '导出失败：' + res.error, !res.ok);
}
