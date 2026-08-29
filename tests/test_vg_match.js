const assert = require('assert');
const m = require('../scripts/venue_grab/vg_match.js');

// todayAt：只做当天时刻换算
assert.strictEqual(m.todayAt('08:00:00', new Date('2026-08-30T06:00:00').getTime()),
    new Date('2026-08-30T08:00:00').getTime());

// cellTimes：提取并补零
assert.deepStrictEqual(m.cellTimes('08:00-09:00 5号场 ¥30'), ['08:00', '09:00']);
assert.deepStrictEqual(m.cellTimes('无时间文本'), []);

// pickCandidate：多场地偏好按序 / fallback 兜底 / exclude 跳过 / 无匹配 null
// text 约定 = "场地名 开始时刻"（引擎构造，规避起止时间歧义）
const cells = [
    { text: '3号场 08:00', available: false },
    { text: '5号场 08:00', available: true },
    { text: '1号场 08:00', available: true },
    { text: '1号场 09:00', available: true },
];
assert.strictEqual(m.pickCandidate(cells, { targetTimes: ['08:00'], sitePrefs: ['5号场'] }, []), cells[1]);
assert.strictEqual(m.pickCandidate(cells, { targetTimes: ['08:00'], sitePrefs: ['3号场', '5号场'] }, []), cells[1]);
assert.strictEqual(m.pickCandidate(cells, { targetTimes: ['08:00'], sitePrefs: ['9号场'] }, []), cells[1]);
assert.strictEqual(m.pickCandidate(cells, { targetTimes: ['08:00'], sitePrefs: [] }, []), cells[1]);
assert.strictEqual(m.pickCandidate(cells, { targetTimes: ['10:00'], fallbackTimes: ['09:00'] }, []), cells[3]);
assert.strictEqual(m.pickCandidate(cells, { targetTimes: ['08:00'] }, ['5号场 08:00', '1号场 08:00']), null);
assert.strictEqual(m.pickCandidate(cells, { targetTimes: ['10:00'] }, []), null);
// 旧版单 sitePref 兼容
assert.strictEqual(m.pickCandidate(cells, { targetTimes: ['08:00'], sitePref: '5号场' }, []), cells[1]);

// 起止时间歧义回归：目标 14:00 不应命中 13:00 开始的格子
const amb = [
    { text: '7号场 13:00', available: true },
    { text: '7号场 14:00', available: true },
];
assert.strictEqual(m.pickCandidate(amb, { targetTimes: ['14:00'] }, []), amb[1]);

console.log('test_vg_match: all pass');
