const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../scripts/ehall/core.js');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function portal(initialRoute, enabled = true) {
    const messages = [], observers = [], timeouts = new Map(), changes = [];
    const classes = new Set();
    let nextTimer = 0, scripts = 0;
    const location = { hash: initialRoute, origin: 'https://ehall.nju.edu.cn' };
    const document = {
        body: {},
        documentElement: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } },
        head: { append(script) { scripts++; script.onload(); } },
        createElement() { return { remove() {} }; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {}
    };
    const context = vm.createContext({
        document, location, console, NjuEhallCore: Core,
        window: { addEventListener() {}, postMessage(message) { messages.push(message.type); } },
        chrome: {
            runtime: { getURL: file => `chrome-extension://test/${file}` },
            storage: { local: { async get() { return { 'toggle-ehall': enabled }; } },
                onChanged: { addListener(callback) { changes.push(callback); } } }
        },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe() { this.connected = true; }
            disconnect() { this.connected = false; }
        },
        setInterval() { return ++nextTimer; }, clearInterval() {},
        setTimeout(callback) { const id = ++nextTimer; timeouts.set(id, callback); return id; },
        clearTimeout(id) { timeouts.delete(id); }
    });
    vm.runInContext(read('scripts/ehall/enhance.js'), context);
    return {
        messages, observers, classes, changes,
        get scripts() { return scripts; },
        async navigate(hash) {
            // Vue Router changes the hash using history.pushState, without hashchange.
            location.hash = hash;
            observers.filter(observer => observer.connected).forEach(observer => observer.callback([{ type: 'childList' }]));
            const scheduled = [...timeouts.values()];
            timeouts.clear();
            scheduled.forEach(callback => callback());
            await flush();
        }
    };
}

test('first entry through hall activates home without a hashchange or refresh', async () => {
    const app = portal('#/hall');
    await flush();
    assert.ok(app.observers.some(observer => observer.connected));
    assert.equal(app.scripts, 0);
    await app.navigate('#/home/official_home');
    assert.ok(app.classes.has('nju-ehall-enabled'));
    assert.deepEqual(app.messages, ['start']);
    assert.equal(app.scripts, 1);
});

test('leaving and returning to home retains navigation monitoring and reuses the bridge', async () => {
    const app = portal('#/home/official_home');
    await flush();
    await app.navigate('#/hall');
    assert.equal(app.classes.has('nju-ehall-enabled'), false);
    assert.ok(app.observers.some(observer => observer.connected));
    await app.navigate('#/home/official_home');
    assert.deepEqual(app.messages, ['start', 'stop', 'start']);
    assert.equal(app.scripts, 1);
    assert.equal(app.observers.length, 1);
});

test('disabling from hall stops observing and prevents later home activation', async () => {
    const app = portal('#/hall');
    await flush();
    app.changes.forEach(callback => callback({ 'toggle-ehall': { newValue: false } }, 'local'));
    await app.navigate('#/home/official_home');
    assert.equal(app.observers.some(observer => observer.connected), false);
    assert.equal(app.scripts, 0);
    assert.equal(app.classes.has('nju-ehall-enabled'), false);
});

test('enabling from hall starts monitoring before entering home', async () => {
    const app = portal('#/hall', false);
    await flush();
    assert.equal(app.observers.length, 0);
    app.changes.forEach(callback => callback({ 'toggle-ehall': { newValue: true } }, 'local'));
    await app.navigate('#/home/official_home');
    assert.deepEqual(app.messages, ['start']);
});

test('popup restores the shared ehall setting and persists changes to the same key', () => {
    assert.match(read('popup/index.html'), /id="toggle-ehall"/);
    const elements = new Map(), writes = [];
    const get = id => {
        if (!elements.has(id)) elements.set(id, { checked: true, handlers: {}, addEventListener(event, callback) { this.handlers[event] = callback; } });
        return elements.get(id);
    };
    const toggle = get('toggle-ehall');
    const data = { 'toggle-ehall': false };
    const context = vm.createContext({
        document: { addEventListener() {}, getElementById: get, querySelectorAll: () => [toggle] },
        chrome: { storage: {
            onChanged: { addListener() {} },
            local: {
                get(keys, callback) { callback(Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]]))); },
                set(values) { writes.push(values); Object.assign(data, values); }
            }
        } }
    });
    toggle.id = 'toggle-ehall';
    vm.runInContext(read('popup/popup.js'), context);
    vm.runInContext('loadDashboardData(); bindEvents();', context);
    assert.equal(toggle.checked, false);
    toggle.checked = true;
    toggle.handlers.change();
    assert.equal(writes.at(-1)['toggle-ehall'], true);
    delete data['toggle-ehall'];
    vm.runInContext('loadDashboardData();', context);
    assert.equal(toggle.checked, true);
});
