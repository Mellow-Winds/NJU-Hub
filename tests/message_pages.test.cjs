const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const id = '11111111-1111-4111-8111-111111111111';
const draftKey = 'NJU_MESSAGE_DRAFT_' + id;
const flush = () => new Promise(resolve => setImmediate(resolve));
function page(file, initial, response = { ok: true, id: 'mail-id' }, consent = true) {
    const storage = structuredClone(initial), elements = {}, messages = [], statuses = [], writes = [];
    function element() {
        return { value: '', textContent: '', handlers: {}, children: [], attributes: {}, dataset: {},
            addEventListener(name, fn) { this.handlers[name] = fn; }, querySelectorAll() { return []; }, reportValidity() { return true; },
            setAttribute(name, value) { this.attributes[name] = value; },
            replaceChildren(...items) { this.children = items; }, append(...items) { this.children.push(...items); }
        };
    }
    const get = id => elements[id] ||= Object.assign(element(), { disabled: id === 'fields' });
    const presets = ['immediate', '3', '12', '24', '72', '168', 'custom'].map(mode => Object.assign(element(), { dataset: { time: mode } }));
    const docEvents = {}, winEvents = {};
    const document = { getElementById: get, querySelectorAll: () => presets, createElement: element, addEventListener(name, fn) { docEvents[name] = fn; } };
    const window = { confirm: () => true, addEventListener(name, fn) { winEvents[name] = fn; } };
    const location = { search: '?draftId=' + id };
    const chrome = {
        runtime: { async sendMessage(message) { messages.push(message); return response; } },
        storage: { onChanged: { addListener() {} }, local: {
            async get(keys) { return Object.fromEntries((keys === null ? Object.keys(storage) : Array.isArray(keys) ? keys : [keys]).filter(k => k in storage).map(k => [k, structuredClone(storage[k])])); },
            async set(data) { writes.push(structuredClone(data)); Object.assign(storage, structuredClone(data)); },
            async remove(key) { delete storage[key]; }
        } }
    };
    const context = vm.createContext({
        document, window, chrome, crypto: webcrypto, URL, URLSearchParams, structuredClone, setTimeout, clearTimeout,
        location, sessionStorage: { getItem() { return null; }, setItem() {} },
        messageConsent: async () => consent, messageRefreshFields() {},
        NjuDropdown: { fromSelect() { return { setValue() {} }; } },
        messageStatus(text, error) { statuses.push({ text, error }); },
        messageResult: result => `accepted:${result.id}`,
        async messageSend(payload) {
            const result = await chrome.runtime.sendMessage({ action: 'sendResendEmail', payload });
            if (!result.ok) throw new Error(result.error);
            return result;
        }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../message/templates.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../message', file), 'utf8'), context);
    return { storage, elements, messages, statuses, writes, get, presets, window, document, docEvents, winEvents, location };
}
test('compose restores the draft, sends no key/from/to and cleans up only after acceptance', async () => {
    const app = page('compose.js', {
        resend_self_email: 'self@example.test',
        [draftKey]: { subject: '作业', text: '<script>plain text</script>', sourceTitle: '课程网页' }
    });
    await flush();
    assert.equal(app.get('text').value, '<script>plain text</script>');
    assert.equal(app.get('self-email').textContent, 'self@example.test');
    assert.equal(app.get('fields').disabled, false);
    app.get('text').value = 'edited';
    await app.get('compose-form').handlers.submit({ preventDefault() {} });
    assert.equal(app.messages[0].payload.text, 'edited');
    assert.deepEqual(Object.keys(app.messages[0].payload).sort(), ['presentation', 'requestId', 'scheduledAt', 'subject', 'text']);
    assert.equal(app.storage[draftKey], undefined);
    assert.equal(app.get('fields').disabled, true);
    assert.match(app.statuses.at(-1).text, /accepted/);
});
test('failed send preserves edited draft and enables retry', async () => {
    const app = page('compose.js', { [draftKey]: { subject: 'test', text: 'body' } }, { ok: false, error: 'network uncertain' });
    await flush();
    app.get('text').value = 'keep me';
    await app.get('compose-form').handlers.submit({ preventDefault() {} });
    assert.equal(app.storage[draftKey].text, 'keep me');
    assert.equal(app.get('fields').disabled, false);
    assert.match(app.statuses.at(-1).text, /network uncertain/);
});
test('missing draft remains disabled and successful receipt cannot be resubmitted after reload', async () => {
    const missing = page('compose.js', {});
    await flush();
    assert.equal(missing.get('fields').disabled, true);
    assert.equal(missing.statuses.at(-1).error, true);
    const sent = page('compose.js', { ['NJU_MESSAGE_ATTEMPT_' + id]: { result: { id: 'already-sent' } } });
    await flush();
    assert.equal(sent.get('fields').disabled, true);
    assert.match(sent.statuses.at(-1).text, /already-sent/);
});
test('settings only persists locally and testing uses the saved config without transmitting key in runtime message', async () => {
    const app = page('settings.js', {});
    await flush();
    app.get('api-key').value = 'test-placeholder';
    app.get('self-email').value = 'self@example.test';
    app.get('from-name').value = '我的提醒';
    app.get('nickname').value = '小明';
    await app.get('test-send').handlers.click();
    assert.equal(app.storage.resend_api_key, 'test-placeholder');
    assert.equal(app.storage.resend_self_email, 'self@example.test');
    assert.equal(app.storage.resend_nickname, '小明');
    assert.equal(app.messages[0].payload.presentation.nickname, '小明');
    assert.ok(!JSON.stringify(app.messages).includes('test-placeholder'));
    assert.equal(app.messages.length, 1);
    assert.equal(app.get('fields').disabled, false);
});

test('presets persist absolute time, custom controls expand and preview preserves literal text', async () => {
    const app = page('compose.js', { [draftKey]: { subject: 'test', text: '<img src=x>\nnext' } });
    await flush();
    assert.match(app.get('preview-text').innerHTML, /&lt;img src=x&gt;<br>next/);
    for (const hours of ['3', '12', '24', '72', '168']) {
        app.presets.find(p => p.dataset.time === hours).handlers.click(); await flush();
        const delay = Date.parse(app.storage[draftKey].scheduledAt) - Date.now();
        assert.ok(Math.abs(delay - Number(hours) * 3600000) < 2000);
    }
    app.presets.at(-1).handlers.click(); await flush();
    assert.equal(app.get('custom-time').hidden, false);
    app.get('minute').value = '42'; app.get('minute').handlers.change(); await flush();
    const custom = app.storage[draftKey].scheduledAt;
    app.presets[0].handlers.click(); await flush();
    assert.equal(app.get('custom-time').hidden, true);
    assert.equal(app.storage[draftKey].scheduledAt, null);
    app.presets.at(-1).handlers.click(); await flush();
    assert.equal(app.storage[draftKey].scheduledAt, custom);
    const restored = page('compose.js', app.storage); await flush();
    assert.equal(restored.get('minute').value, '42');
    assert.equal(restored.get('custom-time').hidden, false);
});

test('template cancellation keeps edits, confirmation uses original selection', async () => {
    const app = page('compose.js', { [draftKey]: { templateId: 'custom', subject: 'NJU-Hub 消息', text: 'original', originalText: 'original' } });
    await flush();
    app.get('text').value = 'manual changes'; app.window.confirm = () => false;
    app.get('template').value = 'homework'; app.get('template').handlers.change();
    assert.equal(app.get('text').value, 'manual changes');
    assert.equal(app.get('template').value, 'custom');
    app.window.confirm = () => true;
    app.get('template').value = 'homework'; app.get('template').handlers.change(); await flush();
    assert.match(app.get('text').value, /original/);
    assert.match(app.get('preview-subject').textContent, /作业/);
    assert.equal(app.storage[draftKey].templateId, 'homework');
});

test('expired draft blocks submission without shifting time or discarding content', async () => {
    const past = new Date(Date.now() - 60000).toISOString();
    const app = page('compose.js', { [draftKey]: { subject: 'past', text: 'keep', scheduleMode: '3', scheduledAt: past } });
    await flush();
    assert.equal(app.get('preview-time').textContent, '时间无效');
    await app.get('compose-form').handlers.submit({ preventDefault() {} });
    assert.equal(app.messages.length, 0);
    assert.equal(app.storage[draftKey].scheduledAt, past);
    assert.equal(app.get('fields').disabled, false);
});

test('declining first-use leaves configuration and sending disabled', async () => {
    for (const file of ['compose.js', 'settings.js']) {
        const app = page(file, {}, undefined, false); await flush();
        assert.equal(app.get('fields').disabled, true);
        assert.equal(app.location.href, '../options/options.html');
        assert.equal(app.messages.length, 0);
        assert.equal(app.writes.length, 0);
    }
});

test('draft list restores each draft and deletes only after explicit confirmation', async () => {
    const otherKey = 'NJU_MESSAGE_DRAFT_22222222-2222-4222-8222-222222222222';
    const app = page('settings.js', { [draftKey]: { subject: 'one', text: 'body' }, [otherKey]: { subject: 'two' } }); await flush();
    const list = app.get('draft-list'); assert.equal(list.children.length, 2);
    const actions = list.children[0].children[2];
    assert.match(actions.children[0].href, new RegExp(id));
    app.window.confirm = () => false; await actions.children[1].handlers.click();
    assert.ok(app.storage[draftKey]);
    app.window.confirm = () => true; await actions.children[1].handlers.click();
    assert.equal(app.storage[draftKey], undefined); assert.ok(app.storage[otherKey]);
});

test('rich draft saves independent DDL, styles and source choice and restores matching preview', async () => {
    const app = page('compose.js', { resend_nickname: '小明', [draftKey]: {
        formatVersion: 2, templateId: 'homework', subject: '作业', text: '数学题', originalText: '数学题',
        sourceUrl: 'https://www.doubao.com/chat/', scheduleMode: 'immediate', scheduledAt: null
    } });
    await flush();
    assert.equal(app.get('include-source').checked, false);
    assert.equal(app.get('deadline-fields').hidden, false);
    assert.match(app.get('preview-text').innerHTML, /亲爱的小明/);
    app.get('ddl-month').value = '2028-02'; app.get('ddl-month').handlers.change();
    app.get('ddl-day').value = '29'; app.get('ddl-day').handlers.change();
    app.get('content-bold').handlers.click();
    app.get('content-card').handlers.click();
    app.get('content-color').value = '#123456'; app.get('content-color').handlers.change();
    app.get('include-source').checked = true; app.get('include-source').handlers.change();
    await flush();
    assert.equal(app.storage[draftKey].scheduledAt, null);
    assert.match(app.storage[draftKey].deadline, /^2028-02-29T/);
    assert.equal(app.storage[draftKey].bold, false);
    assert.equal(app.storage[draftKey].card, false);
    const restored = page('compose.js', app.storage); await flush();
    assert.equal(restored.get('preview-text').innerHTML, app.get('preview-text').innerHTML);
    assert.match(restored.get('preview-text').innerHTML, /点击跳转来源/);
    await restored.get('compose-form').handlers.submit({ preventDefault() {} });
    assert.equal(restored.messages[0].payload.presentation.includeSource, true);
    assert.equal(restored.messages[0].payload.presentation.color, '#123456');
});

test('legacy uncertain requests keep exact plain payload for safe retry', async () => {
    const app = page('compose.js', { [draftKey]: { subject: 'old', text: 'exact body' }, ['NJU_MESSAGE_ATTEMPT_' + id]: { fingerprint: 'previous' } });
    await flush();
    assert.equal(app.get('presentation-controls').hidden, true);
    await app.get('compose-form').handlers.submit({ preventDefault() {} });
    assert.equal(app.messages[0].payload.presentation, undefined);
    assert.equal(app.messages[0].payload.text, 'exact body');
});
