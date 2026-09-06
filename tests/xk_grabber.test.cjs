const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function fixture({ hasButton = true, empty = false } = {}) {
    let opened = false, selected = false, clicks = 0;
    const cell = text => ({ textContent: text, cloneNode: () => ({ textContent: text, querySelectorAll: () => [] }) });
    const scope = { querySelectorAll: () => empty ? [] : [course, application] };
    function row(name, teacher, apply = false) {
        const fields = { 'td.kcmc': cell(name), 'td.jsmc': cell(teacher), 'td.kch': cell('123'), 'td.sjdd': cell('周一 1-2节 1-18周 教101') };
        fields[apply ? 'td.yxrs' : 'td.xklx'] = cell('');
        return { dataset: { teachingclassid: name },
            getClientRects: () => opened && selected ? [{}] : [],
            closest: () => scope,
            querySelector: selector => fields[selector] || null,
            querySelectorAll: () => [] };
    }
    const course = row('数据库系统', '教师甲、教师乙');
    const application = row('报名课程', '教师丙', true);
    const main = row('主列表课程', '教师丁');
    main.closest = () => null;
    main.getClientRects = () => [{}];
    const tab = { textContent: '我的课程', getClientRects: () => opened ? [{}] : [], closest: () => scope, click: () => { selected = true; } };
    const document = {
        querySelector: selector => selector === 'button.yxkc-window-btn' && hasButton ? { click: () => { opened = true; clicks++; } } : null,
        querySelectorAll: selector => selector === 'tr.course-tr' ? [main, course, application] : selector === '.jqx-tabs-titleContentWrapper' ? [tab] : []
    };
    const context = vm.createContext({ window: {}, document, console, setTimeout: fn => { fn(); }, chrome: { runtime: { onMessage: { addListener() {} } } } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/schedule/xk_schedule_grabber.js'), 'utf8'), context);
    return { grab: context.window.__XK_SCHED__.grabSelected, clicks: () => clicks };
}

test('selected import opens official window, switches tab and retains teacher and plain time cells', async () => {
    const f = fixture();
    const result = await f.grab();
    assert.equal(result.ok, true);
    assert.equal(f.clicks(), 1);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].name, '数据库系统');
    assert.equal(result.rows[0].teacher, '教师甲、教师乙');
    assert.equal(result.rows[0].timeRaw, '周一 1-2节 1-18周 教101');
    assert.equal(result.rows[0].tcid, '数据库系统');
});

test('missing button and empty window fail without importing main-list courses', async () => {
    assert.equal((await fixture({ hasButton: false }).grab()).ok, false);
    assert.equal((await fixture({ empty: true }).grab()).ok, false);
});
