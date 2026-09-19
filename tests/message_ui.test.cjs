const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('popup exposes a local message subscription entry', () => {
    assert.match(read('popup/index.html'), /id="btn-message"[^>]*>邮件订阅</);
    assert.match(read('popup/popup.js'), /getElementById\('btn-message'\)/);
    assert.match(read('popup/popup.js'), /message\/settings\.html/);
});

test('message UI uses template pills, shared dropdowns and the two consent actions', () => {
    const compose = read('message/compose.html');
    const page = read('message/page.js');
    assert.match(compose, /id="template-buttons"/);
    assert.doesNotMatch(compose, /id="template"[^>]*class="glass-select"/);
    assert.match(compose, /id="month"/);
    assert.match(compose, /nju-dropdown\.js/);
    assert.doesNotMatch(page, /consent-check/);
    assert.match(page, /已阅读并同意/);
    assert.match(page, /暂不使用/);
});

test('message and popup controls include glass fallback and scrollbar hiding', () => {
    const messageCss = read('message/message.css');
    const popupCss = read('popup/style.css');
    assert.match(messageCss, /backdrop-filter: blur\(10px\)/);
    assert.match(messageCss, /scrollbar-width: none/);
    assert.match(popupCss, /backdrop-filter: blur\(10px\)/);
    assert.match(popupCss, /body::-webkit-scrollbar/);
});

test('options and message pages load the same dropdown controller', () => {
    assert.match(read('options/template.html'), /scripts\/nju-dropdown\.js/);
    assert.match(read('message/settings.html'), /scripts\/nju-dropdown\.js/);
    assert.match(read('message/compose.html'), /scripts\/nju-dropdown\.js/);
    assert.match(read('options/options.js'), /NjuDropdown\.initAll\(\)/);
});
