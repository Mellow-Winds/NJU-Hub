const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = ['templates.js', 'background.js'].map(file => fs.readFileSync(path.join(__dirname, '../message', file), 'utf8')).join('\n');
const id = '11111111-1111-4111-8111-111111111111';
const origin = 'chrome-extension://test/';
function background(data = {}, transport) {
    const storage = { NJU_MESSAGE_CONSENT_VERSION: 1, resend_api_key: 'test-only-placeholder', resend_self_email: 'self@example.test', resend_from_name: 'NJU-Hub', ...data };
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
    vm.runInNewContext(source, { chrome, fetch, crypto: webcrypto, URL, TextEncoder, AbortSignal, console });
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
    assert.equal(bg.storage['NJU_MESSAGE_DRAFT_' + draftId].sourceUrl, 'https://example.test/?token=private');
    assert.equal(bg.storage['NJU_MESSAGE_DRAFT_' + draftId].includeSource, false);
});

test('no consent or old consent blocks sending before any network request', async () => {
    for (const version of [undefined, 0]) {
        const bg = background({ NJU_MESSAGE_CONSENT_VERSION: version });
        assert.match((await bg.send()).error, /同意/);
        assert.equal(bg.requests.length, 0);
    }
});

test('paused service blocks sending without deleting local configuration', async () => {
    const bg = background({ NJU_MESSAGE_PAUSED: true });
    assert.match((await bg.send()).error, /暂停/);
    assert.equal(bg.requests.length, 0);
    assert.equal(bg.storage.resend_self_email, 'self@example.test');
    assert.equal(bg.storage.resend_api_key, 'test-only-placeholder');
});

test('each child menu creates the chosen template and preserves original selected text', async () => {
    const bg = background(); bg.events.installed();
    assert.equal(bg.menus.length, 7);
    for (const template of ['custom', 'homework', 'notice', 'exam', 'activity', 'todo']) {
        await bg.events.click({ menuItemId: `nju-hub-message-subscription-${template}`, selectionText: '作业\n下周截止' }, {});
        const draftId = new URL(bg.tabs.at(-1).url).searchParams.get('draftId');
        const draft = bg.storage['NJU_MESSAGE_DRAFT_' + draftId];
        assert.equal(draft.templateId, template);
        assert.equal(draft.originalText, '作业\n下周截止');
        assert.ok(draft.text.includes(draft.originalText));
        assert.ok(!draft.subject.includes('\n'));
    }
});

test('rich email escapes content, uses nickname, fixed footer and a deadline independent of delivery', async () => {
    const bg = background();
    const scheduledAt = new Date(Date.now() + 3600000).toISOString();
    const result = await bg.send(bg.payload({ scheduledAt, presentation: {
        templateId: 'homework', nickname: '<小明>', includeDeadline: true, deadline: '2028-02-29T23:59',
        color: '#123456', includeSource: false, sourceUrl: 'https://example.test/private'
    } }));
    assert.equal(result.ok, true);
    const body = JSON.parse(bg.requests[0].body);
    assert.match(body.html, /亲爱的&lt;小明&gt;/);
    assert.match(body.html, /<strong>&lt;b&gt;作业&lt;\/b&gt;<br>明天截止<\/strong>/);
    assert.match(body.html, /border:1px solid #123456/);
    assert.doesNotMatch(body.html, /border-left/);
    assert.match(body.text, /2028-02-29 23:59（UTC\+8）/);
    assert.equal(body.scheduled_at, scheduledAt);
    assert.ok(body.text.endsWith('——来自 NJU-Hub 消息订阅'));
    assert.doesNotMatch(body.html, /example.test|<b>作业/);
    assert.deepEqual(body.to, ['self@example.test']);
});

test('source links are opt-in, escaped and restricted to HTTP(S)', async () => {
    for (const [sourceUrl, allowed] of [['https://www.doubao.com/chat/?a=1&b=2', true], ['javascript:alert(1)', false], ['file:///secret', false], ['https://user:pass@example.test', false]]) {
        const bg = background();
        await bg.send(bg.payload({ presentation: { includeSource: true, sourceUrl, bold: false, card: false, color: 'red;position:fixed' } }));
        const body = JSON.parse(bg.requests[0].body);
        assert.equal(body.html.includes('点击跳转来源</a>'), allowed);
        assert.doesNotMatch(body.html, /position:fixed|<strong>|border-left/);
        if (allowed) assert.match(body.html, /href="https:\/\/www.doubao.com\/chat\/\?a=1&amp;b=2"/);
    }
});

test('invalid DDL blocks fetch, while changing rich style cannot bypass retry fingerprint', async () => {
    for (const deadline of ['2027-02-29T12:00', '2028-04-31T12:00', '2028-01-01T24:00']) {
        const bg = background();
        assert.equal((await bg.send(bg.payload({ presentation: { templateId: 'homework', includeDeadline: true, deadline } }))).ok, false);
        assert.equal(bg.requests.length, 0);
    }
    const bg = background({}, async () => { throw new Error('offline'); });
    const payload = bg.payload({ presentation: { color: '#123456' } });
    await bg.send(payload);
    const retry = background(bg.storage);
    assert.equal((await retry.send({ ...payload, presentation: { color: '#654321' } })).ok, false);
    assert.equal(retry.requests.length, 0);
    assert.equal((await retry.send(payload)).ok, true);
});
