const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../message/background.js'), 'utf8');
const id = '11111111-1111-4111-8111-111111111111';
const origin = 'chrome-extension://test/';
function background(data = {}, transport) {
    const storage = { resend_api_key: 'test-only-placeholder', resend_self_email: 'self@example.test', resend_from_name: 'NJU-Hub', ...data };
    const requests = [], tabs = [], events = {}, menus = [];
    const event = name => ({ addListener(fn) { events[name] = fn; } });
    const chrome = {
        runtime: { id: 'test', getURL: p => origin + p, onMessage: event('message'), onInstalled: event('installed'), onStartup: event('startup'), lastError: null },
        storage: { local: {
            async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(k => k in storage).map(k => [k, structuredClone(storage[k])])); },
            async set(data) { Object.assign(storage, structuredClone(data)); },
            async remove(key) { delete storage[key]; }
        } },
        tabs: { async create(data) { tabs.push(data); } },
        contextMenus: {
            onClicked: event('click'),
            update(key, options, callback) { menus.push({ key, options }); callback(); },
            create(options, callback) { menus.push(options); callback(); }
        }
    };
    const fetch = async (url, options) => { requests.push({ url, ...options }); return transport ? transport(url, options) : { ok: true, json: async () => ({ id: 'email-id' }) }; };
    vm.runInNewContext(source, { chrome, fetch, crypto: webcrypto, TextEncoder, AbortSignal, console });
    const payload = extra => ({ requestId: id, subject: '提醒', text: '<b>作业</b>\n明天截止', ...extra });
    return { storage, requests, events, tabs, menus, payload, send(p = payload(), sender = { id: 'test', url: origin + 'message/compose.html?draftId=' + id }) {
        return new Promise(resolve => events.message({ action: 'sendResendEmail', payload: p }, sender, resolve));
    } };
}

test('only trusted message pages can send; web content and other extension pages are rejected', async () => {
    const bg = background();
    for (const sender of [ { id: 'test', url: 'https://xk.nju.edu.cn/' }, { id: 'other', url: origin + 'message/compose.html' }, { id: 'test', url: origin + 'popup/index.html' }, { id: 'test', url: origin + 'message/compose.html.evil' } ]) {
        assert.equal((await bg.send(bg.payload(), sender)).ok, false);
    }
    assert.equal(bg.requests.length, 0);
});

test('sends plain text to configured self only, with a fixed from and no credential in body', async () => {
    const bg = background();
    const result = await bg.send(bg.payload({ to: ['other@example.test'], from: 'evil@example.test', apiKey: 'untrusted' }));
    assert.equal(result.id, 'email-id');
    const request = bg.requests[0], body = JSON.parse(request.body);
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.deepEqual(body.to, ['self@example.test']);
    assert.equal(body.from, '"NJU-Hub" <onboarding@resend.dev>');
    assert.equal(body.text, '<b>作业</b>\n明天截止');
    assert.equal(body.html, undefined);
    assert.equal(body.scheduled_at, undefined);
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers.Authorization, 'Bearer test-only-placeholder');
    assert.ok(!request.body.includes('test-only-placeholder'));
});

test('schedule is normalized to UTC; past, invalid and over-30-day times never send', async () => {
    const bg = background();
    const future = new Date(Date.now() + 3600000).toISOString();
    assert.equal((await bg.send(bg.payload({ scheduledAt: future }))).scheduledAt, future);
    assert.equal(JSON.parse(bg.requests[0].body).scheduled_at, future);
    for (const date of ['invalid', new Date(Date.now() - 1000).toISOString(), new Date(Date.now() + 31 * 86400000).toISOString()]) {
        const invalid = background();
        assert.equal((await invalid.send(invalid.payload({ scheduledAt: date }))).ok, false);
        assert.equal(invalid.requests.length, 0);
    }
});

test('invalid configuration and message content are rejected before fetch', async () => {
    for (const config of [{ resend_api_key: '' }, { resend_self_email: 'a@b.test,c@d.test' }, { resend_from_name: 'name\r\nInjected: x' }]) {
        const bg = background(config);
        assert.equal((await bg.send()).ok, false);
        assert.equal(bg.requests.length, 0);
    }
    for (const payload of [{ subject: '' }, { text: ' ' }, { text: 'x'.repeat(50001) }, { subject: 'a\nb' }, { requestId: '../evil' }]) {
        const bg = background();
        assert.equal((await bg.send(bg.payload(payload))).ok, false);
        assert.equal(bg.requests.length, 0);
    }
});

test('concurrent submissions and successful retries issue just one request', async () => {
    const bg = background();
    const results = await Promise.all([bg.send(), bg.send()]);
    assert.ok(results.every(r => r.ok));
    assert.equal((await bg.send()).ok, true);
    assert.equal(bg.requests.length, 1);
});

test('uncertain network requests retry using same idempotency key across worker restarts', async () => {
    const bg = background({}, async () => { throw new Error('secret transport information'); });
    const failed = await bg.send();
    assert.equal(failed.ok, false);
    assert.ok(!failed.error.includes('secret'));
    const next = background(bg.storage);
    assert.equal((await next.send()).ok, true);
    assert.equal(next.requests[0].headers['Idempotency-Key'], bg.requests[0].headers['Idempotency-Key']);
    const changed = background(bg.storage);
    assert.equal((await changed.send(changed.payload({ text: 'different' }))).ok, false);
    assert.equal(changed.requests.length, 0);
});

test('provider rejection is actionable, hides raw data and allows correction', async () => {
    const bg = background({}, async () => ({ ok: false, status: 403, json: async () => ({ message: 'test-only-placeholder' }) }));
    const result = await bg.send();
    assert.equal(result.ok, false);
    assert.match(result.error, /注册邮箱/);
    assert.ok(!result.error.includes('test-only-placeholder'));
    assert.equal(bg.storage['NJU_MESSAGE_ATTEMPT_' + id], undefined);
});

test('missing success id and server errors stay uncertain, and expired retries never send', async () => {
    for (const response of [{ ok: true, json: async () => ({}) }, { ok: false, status: 500, json: async () => ({}) }]) {
        const bg = background({}, async () => response);
        assert.equal((await bg.send()).ok, false);
        const key = 'NJU_MESSAGE_ATTEMPT_' + id;
        assert.ok(bg.storage[key]);
        bg.storage[key].createdAt = Date.now() - 25 * 3600000;
        const expired = background(bg.storage);
        assert.equal((await expired.send()).ok, false);
        assert.equal(expired.requests.length, 0);
    }
});

test('selection creates isolated local drafts with opaque URLs, and menu updates are scoped', async () => {
    const bg = background();
    bg.events.installed();
    assert.equal(bg.menus[0].key, 'nju-hub-message-subscription');
    assert.deepEqual(Array.from(bg.menus[0].options.contexts), ['selection']);
    await bg.events.click({ menuItemId: 'other', selectionText: 'ignore' }, {});
    assert.equal(bg.tabs.length, 0);
    await bg.events.click({ menuItemId: 'nju-hub-message-subscription', selectionText: 'private text' }, { title: '课程', url: 'https://example.test/?token=private' });
    await bg.events.click({ menuItemId: 'nju-hub-message-subscription', selectionText: 'second' }, {});
    assert.equal(bg.tabs.length, 2);
    assert.notEqual(bg.tabs[0].url, bg.tabs[1].url);
    assert.ok(!bg.tabs[0].url.includes('private'));
    const draftId = new URL(bg.tabs[0].url).searchParams.get('draftId');
    assert.equal(bg.storage['NJU_MESSAGE_DRAFT_' + draftId].text, 'private text');
    assert.equal(bg.storage['NJU_MESSAGE_DRAFT_' + draftId].sourceUrl, undefined);
});
