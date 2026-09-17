const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const seasonal = fs.readFileSync(path.join(__dirname, '../scripts/seasonal-background.js'), 'utf8');
const material = fs.readFileSync(path.join(__dirname, '../scripts/material-global.js'), 'utf8');
const materialCss = fs.readFileSync(path.join(__dirname, '../scripts/material-global.css'), 'utf8');

test('seasonal layer is wired into all four requested surfaces', () => {
    for (const file of [
        '../options/options.html',
        '../popup/index.html',
        '../webportal/webportal.html',
        '../red-black/index.html'
    ]) {
        const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
        assert.match(html, /scripts\/seasonal-background\.js/);
    }
    const personalize = fs.readFileSync(path.join(__dirname, '../options/sections/personalize.html'), 'utf8');
    assert.match(personalize, /id="ui-seasonal-color"/);
    assert.match(personalize, /流溯色彩/);
    assert.match(materialCss, /html\[data-nju-material-page="popup"\]\[data-nju-gradient-enabled="false"\]/);
});

function harness(page = 'options', protocol = 'chrome-extension:') {
    let now = Date.parse('2026-09-17T15:59:59.000Z');
    const props = new Map(), timers = new Map(), listeners = {};
    let timerId = 0;
    const root = { dataset: {}, style: {
        setProperty: (key, value) => props.set(key, value),
        removeProperty: key => props.delete(key)
    } };
    const changes = [];
    const data = { sync: {}, local: {} };
    const area = name => ({
        get(keys, cb) { cb(Object.fromEntries(keys.map(key => [key, data[name][key]]))); }
    });
    const context = vm.createContext({
        window: { addEventListener: (name, cb) => { listeners[name] = cb; } },
        document: { documentElement: root, hidden: false,
            addEventListener: (name, cb) => { listeners[name] = cb; } },
        location: { protocol, pathname: '/' + page + '/index.html' },
        chrome: { runtime: {}, storage: { sync: area('sync'), local: area('local'),
            onChanged: { addListener: cb => changes.push(cb) } } },
        Date: class extends Date { static now() { return now; } },
        setTimeout: (cb, delay) => { timers.set(++timerId, { cb, delay }); return timerId; },
        clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(seasonal, context);
    return { context, root, props, timers, listeners, data,
        engine: context.window.NjuSeasonalBackground,
        now: value => { now = value; },
        load: () => vm.runInContext(material, context),
        change: (key, value, name = 'sync') => {
            data[name][key] = value;
            changes.forEach(cb => cb({ [key]: { newValue: value } }, name));
        }
    };
}

test('96-color cycle wraps seamlessly and stays stable within each UTC+8 day', () => {
    const { engine: e } = harness();
    assert.equal(e.yearColors.length, 96);
    assert.deepEqual(Array.from(e.gradient(0)), [e.yearColors[95], e.yearColors[0], e.yearColors[1]]);
    assert.deepEqual(Array.from(e.gradient(95)), [e.yearColors[94], e.yearColors[95], e.yearColors[0]]);
    const start = Date.parse('2024-02-03T16:00:00Z');
    for (let day = 0; day < 366; day++) {
        const morning = e.getTheme(start + day * 86400000);
        const evening = e.getTheme(start + day * 86400000 + 86399999);
        assert.equal(morning.globalIndex, evening.globalIndex);
        assert.equal(morning.termIndex, Math.min(23, Math.floor(day / 15)));
        assert.equal(morning.tones[1], e.yearColors[morning.globalIndex]);
        if (day % 15 < 14) {
            assert.notEqual(morning.globalIndex, e.getTheme(start + (day + 1) * 86400000).globalIndex);
        }
    }
    assert.equal(e.getTheme(start - 1).termIndex, 23);
    assert.equal(e.getTheme(start).termIndex, 0);
    assert.equal(e.getTheme(Date.parse('2025-02-03T16:00:00Z')).termIndex, 0);
});

test('one refresh timer survives repeated starts and refreshes after midnight or returning to page', () => {
    const h = harness();
    h.engine.start();
    h.engine.start();
    assert.equal(h.timers.size, 1);
    assert.equal([...h.timers.values()][0].delay, 1050);
    const previous = h.props.get('--nju-seasonal-b');
    h.now(Date.parse('2026-09-17T16:00:00.050Z'));
    [...h.timers.values()][0].cb();
    assert.notEqual(h.props.get('--nju-seasonal-b'), previous);
    assert.equal(h.timers.size, 1);
    h.now(Date.parse('2026-12-01T00:00:00Z'));
    h.listeners.visibilitychange();
    assert.equal(h.root.dataset.njuSeason, 'winter');
    h.listeners.pageshow();
    assert.equal(h.timers.size, 1);
});

test('seasonal toggle controls the canvas; wallpaper takes priority over both backgrounds', () => {
    for (const page of ['options', 'webportal', 'red-black']) {
        const h = harness(page);
        h.load();
        assert.equal(h.root.dataset.njuSeasonalEnabled, 'false');
        assert.equal(h.root.dataset.njuGradientEnabled, 'false');
        for (const mode of ['default', 'enhanced', 'liquid-glass']) {
            h.change('ui_material_mode', mode);
            assert.equal(h.root.dataset.njuGradientEnabled, mode === 'liquid-glass' ? 'true' : 'false');
            assert.equal(h.root.dataset.njuSeasonalEnabled, 'false');
            const oldBlue = h.props.get('--nju-global-gradient-b');
            if (mode === 'liquid-glass') assert.match(oldBlue, /^hsl\(/);

            h.change('ui_seasonal_color_enabled', true);
            assert.equal(h.root.dataset.njuSeasonalEnabled, 'true');
            assert.equal(h.root.dataset.njuGradientEnabled, 'true');
            const color = h.props.get('--nju-seasonal-b');
            h.change('ui_theme_color', '#ff0000');
            assert.equal(h.props.get('--nju-seasonal-b'), color);
            assert.equal(h.props.has('--nju-global-gradient-b'), false);

            h.change('ui_wallpaper_data', 'data:image/png;base64,AAAA', 'local');
            h.change('ui_wallpaper_enabled', true);
            assert.equal(h.root.dataset.njuWallpaperEnabled, 'true');
            assert.equal(h.root.dataset.njuSeasonalEnabled, 'false');
            assert.equal(h.root.dataset.njuGradientEnabled, 'false');
            h.change('ui_wallpaper_enabled', false);
            assert.equal(h.root.dataset.njuGradientEnabled, 'true');
            assert.equal(h.props.has('--nju-global-wallpaper-image'), false);

            h.change('ui_seasonal_color_enabled', false);
            assert.equal(h.root.dataset.njuSeasonalEnabled, 'false');
            assert.equal(h.root.dataset.njuGradientEnabled, mode === 'liquid-glass' ? 'true' : 'false');
            if (mode === 'liquid-glass') assert.match(h.props.get('--nju-global-gradient-b'), /^hsl\(/);
        }
    }
});

test('popup ignores wallpaper; host and schedule receive no seasonal background or timer', () => {
    const popup = harness('popup');
    popup.data.sync.ui_wallpaper_enabled = true;
    popup.data.local.ui_wallpaper_data = 'data:image/png;base64,AAAA';
    popup.load();
    assert.equal(popup.root.dataset.njuWallpaperEnabled, 'false');
    assert.equal(popup.root.dataset.njuSeasonalEnabled, 'false');
    assert.equal(popup.root.dataset.njuGradientEnabled, 'false');
    popup.change('ui_seasonal_color_enabled', true);
    assert.equal(popup.root.dataset.njuSeasonalEnabled, 'true');
    assert.equal(popup.root.dataset.njuGradientEnabled, 'true');
    popup.change('ui_seasonal_color_enabled', false);
    assert.equal(popup.root.dataset.njuGradientEnabled, 'false');
    popup.change('ui_material_mode', 'liquid-glass');
    assert.equal(popup.root.dataset.njuGradientEnabled, 'true');
    assert.match(popup.props.get('--nju-global-gradient-b'), /^hsl\(/);
    for (const h of [harness('schedule'), harness('options', 'https:')]) {
        h.load();
        assert.equal(h.root.dataset.njuGradientEnabled, 'false');
        assert.equal(h.timers.size, 0);
    }
    const firefox = harness('webportal', 'moz-extension:');
    firefox.load();
    assert.equal(firefox.root.dataset.njuGradientEnabled, 'false');
    firefox.change('ui_seasonal_color_enabled', true);
    assert.equal(firefox.root.dataset.njuGradientEnabled, 'true');
});
