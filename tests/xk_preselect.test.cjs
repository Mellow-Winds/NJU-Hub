const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(data = {}) {
    const context = vm.createContext({ window: { __XK__: {
        STORAGE: { SCHEDULE: 'NJU_SCHEDULE' },
        GM_getValue: (key, fallback) => data[key] ?? fallback,
        GM_setValue: (key, value) => { data[key] = value; }
    } } });
    for (const file of ['schedule/schedule_parser.js', 'schedule/schedule_layout.js', 'scripts/xk/xk_preselect.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    }
    return context.window;
}

test('combined timetable reads existing selected storage and deduplicates the preselection group', () => {
    const c = { name: '课程A', teacher: '教师', timeStr: '周一 1-2节' };
    const w = setup({ NJU_SCHEDULE: [c], NJU_PRESELECT: {
        '课程A|教师|周一 1-2节': { name: c.name, teacher: c.teacher, time: c.timeStr },
        '课程B||周日 12-13节': { name: '课程B', time: '周日 12-13节' }
    } });
    const result = w.__XK__.preselectEntries();
    assert.equal(result.length, 2);
    assert.equal(result[0].source, 'selected');
    assert.equal(result[1].source, 'pre');
    assert.equal(w.__XK__.preselectSlots(result[1])[0].day, 7);
    assert.equal(w.__XK__.preselectSlots(result[1])[0].e, 14);
});

test('time parser supports multiple adjacent meetings and rejects invalid periods', () => {
    const w = setup();
    const result = w.__SCHED__.parseTimeStr('周一 1–2节 1-16周 周三 3-4节 1-16周');
    assert.equal(result.slots.length, 2);
    assert.equal(result.slots[1].day, 3);
    assert.equal(w.__SCHED__.parseTimeStr('周一 0-2节').fail, true);
    assert.equal(w.__SCHED__.parseTimeStr('周一 5-2节').fail, true);
    assert.equal(w.__SCHED__.parseTimeStr('时间待定').fail, true);
});

test('overlapping courses retain individual lanes regardless of source', () => {
    const w = setup();
    const courses = [{ s: 1, e: 3 }, { s: 2, e: 4 }, { s: 3, e: 5 }];
    const groups = w.__SCHED__.clusterGroups(courses);
    const layout = w.__SCHED__.laneAssign(groups[0]);
    assert.equal(layout.assigns.length, 3);
    assert.equal(layout.laneCount, 2);
    assert.equal(layout.assigns[0].lane, layout.assigns[2].lane);
});

test('room and week variants occupy a single interval while separate meetings remain', () => {
    const w = setup();
    const slots = w.__XK__.preselectSlots({ timeStr: '周一 1-2节 1-8周 教101;周一 1-2节 9-18周 教202;周一 2-3节 9-18周 教303;周三 5-6节 1-18周 教101' });
    assert.equal(slots.length, 2);
    assert.equal(slots[0].s, 1);
    assert.equal(slots[0].e, 4);
    assert.equal(slots[1].day, 3);
});

test('duplicate source records retain all removal references without merging different classes', () => {
    const w = setup({ NJU_SCHEDULE: [
        { name: '数据库系统', teacher: '张老师', timeStr: '周一 1-2节 1-8周 教101' },
        { name: '数据库系统', teacher: '张老师', timeStr: '周一 1-2节 9-18周 教202' },
        { name: '数据库系统', teacher: '李老师', timeStr: '周一 1-2节' },
        { name: '数据库系统', teacher: '张老师', clsName: '02班', timeStr: '周一 1-2节' }
    ], NJU_PRESELECT: { saved: { name: '数据库系统', teacher: '张老师', time: '周一 1-2节 1-18周 教303' } } });
    const courses = w.__XK__.preselectEntries();
    assert.equal(courses.length, 3);
    assert.equal(courses[0].slots.length, 1);
    assert.equal(courses[0].indices.join(','), '0,1');
    assert.equal(courses[0].preIds.join(','), 'saved');
});

test('screenshot regression: teacherless imported records merge with enriched records in either order', () => {
    const names = ['计算机组织结构', '线性代数（第一层次）', '发展经济学', '数据库系统概论', '管理学', '形势与政策', '中国近现代史纲要'];
    const rows = names.flatMap((name, i) => [
        { name, timeStr: `周一 ${i + 1}-${i + 2}节 1-18周 教101` },
        { name, teacher: '教师甲、教师乙', code: String(i), timeStr: `周一 ${i + 1}-${i + 2}节 1-18周 教202` }
    ]);
    for (const ordered of [rows, rows.slice().reverse()]) {
        const courses = setup({ NJU_SCHEDULE: ordered }).__XK__.preselectEntries();
        assert.equal(courses.length, names.length);
        for (const c of courses) {
            assert.equal(c.teacher, '教师甲、教师乙');
            assert.equal(c.slots.length, 1);
            assert.equal(c.indices.length, 2);
        }
    }
});

test('missing-teacher matching requires a unique overlapping class with no conflicting identifiers', () => {
    const sparse = { name: '线性代数', timeStr: '周一 1-2节' };
    const rich = { ...sparse, teacher: '朱昊', tcid: 'A' };
    for (const rows of [
        [sparse, rich, { ...rich, teacher: '另一教师', tcid: 'B' }],
        [sparse, { ...rich, timeStr: '周二 1-2节' }],
        [{ ...sparse, tcid: 'B' }, rich]
    ]) assert.equal(setup({ NJU_SCHEDULE: rows }).__XK__.preselectEntries().length, rows.length);
});

test('enrichment keeps selected color and all preselection removal references', () => {
    const w = setup({ NJU_SCHEDULE: [{ name: '线性代数 （第一层次）', timeStr: '周一 1-2节' }],
        NJU_PRESELECT: { rich: { name: '线性代数(第一层次)', teacher: '朱昊', time: '周一 1-2节' } } });
    const courses = w.__XK__.preselectEntries();
    assert.equal(courses.length, 1);
    assert.equal(courses[0].teacher, '朱昊');
    assert.equal(courses[0].source, 'selected');
    assert.equal(courses[0].indices.join(','), '0');
    assert.equal(courses[0].preIds.join(','), 'rich');
});

test('campus-prefixed PE class alias merges with teacher-enriched course in either order', () => {
    const rows = [
        { name: '仙林羽毛球初级3', timeStr: '周一 4-5节 1-18周' },
        { name: '羽毛球初级', teacher: '邵力平', timeStr: '周一 4-5节 1-18周' }
    ];
    for (const ordered of [rows, rows.slice().reverse()]) {
        const courses = setup({ NJU_SCHEDULE: ordered }).__XK__.preselectEntries();
        assert.equal(courses.length, 1);
        assert.equal(courses[0].name, '羽毛球初级');
        assert.equal(courses[0].teacher, '邵力平');
        assert.equal(courses[0].indices.length, 2);
        assert.equal(courses[0].slots.length, 1);
    }
});

test('alias matching preserves numbered subjects, different times and ambiguous PE classes', () => {
    for (const rows of [
        [{ name: '大学英语1' }, { name: '大学英语2', teacher: '教师' }],
        [{ name: '仙林羽毛球初级3' }, { name: '羽毛球初级', teacher: '邵力平', timeStr: '周二 4-5节' }],
        [{ name: '仙林羽毛球初级3' }, { name: '羽毛球初级', teacher: '邵力平' }, { name: '羽毛球初级', teacher: '另一教师' }]
    ]) {
        const courses = setup({ NJU_SCHEDULE: rows.map(c => ({ timeStr: '周一 4-5节', ...c })) }).__XK__.preselectEntries();
        assert.equal(courses.length, rows.length);
    }
});
