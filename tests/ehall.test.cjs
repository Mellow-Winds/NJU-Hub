const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../scripts/ehall/core.js');
const { pinyin } = require('../libs/pinyin-pro.js');

const scholarship = { id: '4592429014624916', name: '奖学金', allowed: true };
const grant = { id: '4593050789040300', name: '助学金', allowed: true };

test('recent visits count individual events within a rolling seven-day window', () => {
    const now = 1800000000000;
    const events = [
        { service: scholarship, at: now - Core.WEEK },
        { service: scholarship, at: now - Core.WEEK + 1 },
        { service: scholarship, at: now - 100 },
        { service: grant, at: now - 10 },
        { service: scholarship, at: now + 1 },
        { service: scholarship, at: 'invalid' }
    ];
    const result = Core.recent(events, now);
    assert.deepEqual(result.map(item => [item.id, item.count]), [[grant.id, 1], [scholarship.id, 2]]);
    assert.equal(Core.recent(events, now + Core.WEEK + 2).length, 0);
});

test('recent visits deduplicate by ID and preserve latest display metadata', () => {
    const now = Date.now();
    const result = Core.recent([
        { service: { ...scholarship, name: '旧名称' }, at: now - 20 },
        { service: scholarship, at: now - 10 },
        { service: { ...grant, name: '奖学金' }, at: now - 5 }
    ], now);
    assert.equal(result.length, 2);
    assert.equal(result.find(item => item.id === scholarship.id).name, '奖学金');
    assert.equal(result.find(item => item.id === scholarship.id).count, 2);
});

test('saved category order drops unavailable categories and appends new categories', () => {
    assert.deepEqual(Core.order(['b', 'b', 'hidden', 'recent'], ['recent', 'a', 'b', 'new']), ['b', 'recent', 'a', 'new']);
    assert.deepEqual(Core.order(null, ['recent', 'a']), ['recent', 'a']);
});

test('service normalization preserves permission and rejects invalid identities and image schemes', () => {
    assert.equal(Core.service({ serviceId: '1', serviceName: '锁定服务', hasPermission: 0 }).allowed, false);
    assert.equal(Core.service({ ...scholarship, icon: 'javascript:alert(1)' }).icon, '');
    assert.equal(Core.service({ id: '../unsafe', name: '测试' }), null);
    assert.equal(Core.service({ id: '1', name: '' }), null);
    assert.equal(Core.service(Core.service(scholarship)).name, scholarship.name);
});

test('native middleIcon survives normalization and saving as a recent visit', () => {
    const icon = 'https://ehall.nju.edu.cn/resources/app/4592429014624916/icon_72.png';
    const native = { appId: scholarship.id, appName: scholarship.name, middleIcon: icon, hasPermission: 1 };
    const saved = Core.service(native);
    assert.equal(saved.icon, icon);
    assert.equal(Core.service(saved).icon, icon);
    assert.equal(Core.recent([{ service: saved, at: Date.now() }])[0].icon, icon);
});

test('category usage resolves catalogue IDs without mixing services with identical names', () => {
    const one = { id: '1', name: '课表', icon: 'https://ehall.nju.edu.cn/a.png?_=1' };
    const two = { id: '2', name: '课表', icon: 'https://ehall.nju.edu.cn/b.png' };
    assert.equal(Core.resolveService([one], '课表', '').id, '1');
    assert.equal(Core.resolveService([one, two], '课表', 'https://ehall.nju.edu.cn/a.png?_=2').id, '1');
    assert.equal(Core.resolveService([one, two], '课表', ''), null);
    assert.equal(Core.resolveService([one, two], '其他服务', one.icon), null);
});

test('search matches Chinese, full pinyin, initials, English and normalized input', () => {
    const index = Core.index([scholarship, grant, { id: '3', name: 'OneDrive网盘' }], pinyin);
    for (const query of ['奖学金', '奖学', 'jiangxuejin', 'jxj', 'ＪＸＪ', ' J X J ']) {
        assert.equal(Core.search(index, query)[0].id, scholarship.id, query);
    }
    assert.equal(Core.search(index, 'zxj')[0].id, grant.id);
    assert.equal(Core.search(index, 'onedrive')[0].id, '3');
    assert.deepEqual(Core.search(index, '不存在的服务'), []);
    assert.deepEqual(Core.search(index, '   '), []);
});

test('exact name outranks partial matches and recency breaks equal matching ranks', () => {
    const index = Core.index([scholarship, { id: '2', name: '奖学金申请' }, { id: '3', name: '奖学金办理' }], pinyin);
    const history = [{ id: '2', last: 20 }, { id: '3', last: 30 }];
    assert.equal(Core.search(index, '奖学金', history)[0].id, scholarship.id);
    assert.deepEqual(Core.search(index, 'jxj', history).slice(0, 2).map(item => item.id), ['3', '2']);
});
