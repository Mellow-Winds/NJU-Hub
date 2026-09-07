const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const portal = 'https://p-nju.seec.seecoder.cn/course/42';
const fileUrl = 'https://seec-portal.oss-cn-hangzhou.aliyuncs.com/42/lecture.pdf';

function background() {
    let listener;
    const downloads = [];
    const chrome = {
        declarativeNetRequest: { async getSessionRules() { return [1, 2, 3]; } },
        runtime: { onMessage: { addListener(fn) { listener = fn; } }, lastError: null },
        downloads: { download(options, callback) { downloads.push(options); callback(chrome.runtime.lastError ? undefined : 7); } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), { chrome, URL });
    return { chrome, downloads, send(message, sender = portal) {
        let result;
        listener(message, { url: sender }, response => { result = response; });
        return result;
    } };
}

test('SEEC uses browser saving with a safe filename and retains the original URL', () => {
    const bg = background();
    const result = bg.send({ action: 'seecDownload', url: fileUrl, filename: '../讲义:第一章.pdf' });
    assert.equal(result.downloadId, 7);
    assert.equal(bg.downloads[0].url, fileUrl);
    assert.equal(bg.downloads[0].saveAs, false);
    assert.equal(bg.downloads[0].filename, '_讲义_第一章.pdf');
    bg.send({ action: 'seecDownload', url: fileUrl, filename: 'CON.pdf' });
    assert.equal(bg.downloads[1].filename, '_CON.pdf');
});

test('SEEC rejects untrusted URLs and senders without starting downloads', () => {
    const bg = background();
    for (const url of ['javascript:alert(1)', fileUrl.replace('https:', 'http:'), fileUrl.replace('.com/', '.com.evil.test/'), fileUrl.replace('https://', 'https://user@')]) {
        assert.equal(bg.send({ action: 'seecDownload', url }).ok, false);
    }
    assert.equal(bg.send({ action: 'seecDownload', url: fileUrl }, 'https://evil.test').ok, false);
    assert.equal(bg.downloads.length, 0);
});

test('download errors propagate and LMS saving still uses its existing filename', () => {
    const bg = background();
    bg.chrome.runtime.lastError = { message: 'disk error' };
    assert.equal(bg.send({ action: 'seecDownload', url: fileUrl }).error, 'disk error');
    bg.chrome.runtime.lastError = null;
    assert.equal(bg.send({ action: 'lmsWorkerDownload', url: 'https://lms-media.nju.edu.cn/a.pdf', filename: 'course/a.pdf' }).ok, true);
    assert.equal(bg.downloads[1].filename, 'course/a.pdf');
});

// Minimal DOM for exercising the actual courseware handlers without a browser.
class Element {
    constructor() {
        this.children = []; this.dataset = {}; this.style = {}; this.checked = false;
        this.classList = {
            contains: name => (this.className || '').split(' ').includes(name),
            add: name => { if (!this.classList.contains(name)) this.className = `${this.className || ''} ${name}`; },
            remove: name => { this.className = (this.className || '').split(' ').filter(item => item !== name).join(' '); },
            toggle: (name, value) => value ? this.classList.add(name) : this.classList.remove(name)
        };
    }
    setAttribute(name, value) { this[name] = value; }
    focus() {}
    getClientRects() { return [{}]; }
    set innerHTML(html) {
        this.children = [];
        for (const match of html.matchAll(/<(?:div|span|button|input|a|h3)\b([^>]*)>/g)) {
            const element = new Element();
            element.className = /class="([^"]*)"/.exec(match[1])?.[1] || '';
            element.id = /id="([^"]*)"/.exec(match[1])?.[1];
            this.appendChild(element);
        }
    }
    appendChild(child) { child.parent = this; this.children.push(child); }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    replaceChildren() { this.children = []; }
    querySelectorAll(selector) {
        const checked = selector.endsWith(':checked');
        const cls = selector.replace(/^\./, '').replace(':checked', '');
        return this.children.flatMap(child => [
            ...((child.className || '').split(' ').includes(cls) && (!checked || child.checked) ? [child] : []),
            ...child.querySelectorAll(selector)
        ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
}

function panel() {
    const tab = new Element();
    const body = new Element();
    body.appendChild(tab);
    let rows = [];
    const tabQuery = tab.querySelectorAll.bind(tab);
    tab.querySelectorAll = selector => selector === '.el-table__row' ? rows : tabQuery(selector);
    const findId = (element, id) => element.id === id ? element : element.children.map(child => findId(child, id)).find(Boolean);
    const messages = [];
    const callbacks = [];
    const context = {
        document: {
            body,
            addEventListener() {}, removeEventListener() {},
            querySelector: () => tab,
            getElementById: id => findId(body, id),
            createElement: () => new Element()
        },
        setTimeout: callback => callback(),
        location: { pathname: '/course/42' },
        chrome: { runtime: { sendMessage(message, callback) { messages.push(message); callbacks.push(callback); } } }
    };
    const source = fs.readFileSync(path.join(root, 'scripts/seec_workpanel.js'), 'utf8');
    vm.runInNewContext(source.slice(source.indexOf('    function saveCourseware('), source.indexOf('    setInterval(() => {')), context);
    return { context, tab, body, messages, callbacks, render(names) {
        rows = names.map(name => ({ innerText: name, cells: [null, { innerText: name }, { innerText: '1 MB' }, { innerText: 'today' }] }));
        context.processCourseware();
    } };
}

test('card downloads directly without a dialog, blocks duplicate clicks and allows retry', async () => {
    const p = panel();
    p.render(['讲义 #1.pdf']);
    const submit = p.tab.querySelector('.seec-save');
    const pending = submit.onclick();
    await submit.onclick();
    assert.equal(p.body.querySelectorAll('.seec-download-mask').length, 0);
    assert.equal(p.messages.length, 1);
    assert.equal(p.messages[0].url, `${fileUrl.slice(0, fileUrl.lastIndexOf('/') + 1)}${encodeURIComponent('讲义 #1.pdf')}`);
    p.callbacks.shift()({ ok: false, error: 'network error' });
    await pending;
    assert.match(p.tab.querySelector('.seec-save-status').textContent, /network error/);
    assert.equal(submit.disabled, false);
    const retry = submit.onclick();
    p.callbacks.shift()({ ok: true, downloadId: 9 });
    await retry;
    assert.equal(p.tab.querySelector('.seec-save-status').textContent, '已提交下载');
    assert.equal(submit.disabled, false);
    assert.equal(p.body.querySelectorAll('.seec-download-mask').length, 0);
});

test('batch only saves selected files and continues after a failure', async () => {
    const p = panel();
    p.render(['a.pdf', 'b.pdf', 'c.pdf']);
    p.context.showCoursewareDownload();
    const inputs = p.body.querySelectorAll('.seec-file-select');
    inputs[0].checked = inputs[2].checked = true;
    const pending = p.body.querySelector('.seec-dl-submit').onclick();
    p.callbacks.shift()({ ok: false, error: 'failed' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(p.messages[1].filename, 'c.pdf');
    p.callbacks.shift()({ ok: true, downloadId: 8 });
    await pending;
    assert.equal(p.messages.length, 2);
    assert.equal(p.body.querySelectorAll('.lms-download-error').length, 1);
    assert.match(p.body.querySelector('.lms-download-error').textContent, /a.pdf/);
});

test('course changes rebuild links and missing course IDs never default to course 17', async () => {
    const p = panel();
    p.render(['a.pdf']);
    p.context.location.pathname = '/course/99';
    p.context.processCourseware();
    assert.match(p.tab.querySelector('.seec-read').href, /\/99\/a.pdf$/);
    p.context.location.pathname = '/unknown';
    p.context.processCourseware();
    await p.tab.querySelector('.seec-save').onclick();
    assert.match(p.tab.querySelector('.seec-save-status').textContent, /无法识别当前课程/);
    assert.equal(p.messages.length, 0);
    p.render([]);
    assert.equal(p.tab.querySelectorAll('.seec-save').length, 0);
});

test('LMS-style select all and invert update row highlights and keep the course snapshot', async () => {
    const p = panel();
    p.render(['a.pdf', 'b.pdf']);
    p.context.showCoursewareDownload();
    assert.equal(p.body.querySelector('.seec-dl-submit').disabled, true);
    p.body.querySelector('.seec-dl-all').onclick();
    assert.equal(p.body.querySelectorAll('.selected').length, 2);
    p.body.querySelector('.seec-dl-invert').onclick();
    assert.equal(p.body.querySelectorAll('.selected').length, 0);
    const row = p.body.querySelector('.lms-dl-item');
    row.onclick({ target: row });
    assert.equal(p.body.querySelector('.seec-dl-submit').disabled, false);
    p.context.location.pathname = '/course/99';
    p.render(['new.pdf']);
    const pending = p.body.querySelector('.seec-dl-submit').onclick();
    assert.match(p.messages[0].url, /\/42\/a.pdf$/);
    p.callbacks.shift()({ ok: true, downloadId: 1 });
    await pending;
    p.body.querySelector('.seec-dl-close').onclick();
    assert.equal(p.body.querySelectorAll('.seec-download-mask').length, 0);
});
