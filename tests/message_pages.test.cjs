const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const id = '11111111-1111-4111-8111-111111111111';
const draftKey = 'NJU_MESSAGE_DRAFT_' + id;
const flush = () => new Promise(resolve => setImmediate(resolve));
function page(file, initial, response = { ok: true, id: 'mail-id' }) {
    const storage = structuredClone(initial), elements = {}, messages = [], statuses = [], writes = [];
    const get = id => elements[id] ||= { value: '', disabled: id === 'fields', textContent: '', handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, reportValidity() { return true; } };
    const chrome = {
        runtime: { async sendMessage(message) { messages.push(message); return response; } },
        storage: { onChanged: { addListener() {} }, local: {
            async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(k => k in storage).map(k => [k, structuredClone(storage[k])])); },
            async set(data) { writes.push(structuredClone(data)); Object.assign(storage, structuredClone(data)); },
            async remove(key) { delete storage[key]; }
        } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../message', file), 'utf8'), {
        document: { getElementById: get }, chrome, crypto: webcrypto, URLSearchParams,
        location: { search: '?draftId=' + id }, sessionStorage: { getItem() { return null; }, setItem() {} },
        messageStatus(text, error) { statuses.push({ text, error }); },
        messageResult: result => `accepted:${result.id}`,
        async messageSend(payload) {
            const result = await chrome.runtime.sendMessage({ action: 'sendResendEmail', payload });
            if (!result.ok) throw new Error(result.error);
            return result;
        }
    });
    return { storage, elements, messages, statuses, writes, get };
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
    assert.deepEqual(Object.keys(app.messages[0].payload).sort(), ['requestId', 'scheduledAt', 'subject', 'text']);
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
    await app.get('test-send').handlers.click();
    assert.equal(app.storage.resend_api_key, 'test-placeholder');
    assert.equal(app.storage.resend_self_email, 'self@example.test');
    assert.ok(!JSON.stringify(app.messages).includes('test-placeholder'));
    assert.equal(app.messages.length, 1);
    assert.equal(app.get('fields').disabled, false);
});
