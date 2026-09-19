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
    assert.match(read('message/compose.js'), /btn-small ripple-container/);
    assert.match(compose, /<h2 class="section-label">消息模板<\/h2>/);
    assert.doesNotMatch(compose, /id="self-email"/);
    assert.doesNotMatch(compose, /id="template"[^>]*class="glass-select"/);
    assert.match(compose, /id="month"/);
    assert.match(compose, /id="include-deadline"[^>]*type="checkbox"/);
    assert.match(compose, /id="content-bold"[^>]*type="checkbox"/);
    assert.match(compose, /id="content-card"[^>]*type="checkbox"/);
    assert.doesNotMatch(compose, /id="apply-deadline"|id="clear-deadline"|固定后缀/);
    assert.match(compose, /nju-dropdown\.js/);
    assert.doesNotMatch(page, /consent-check/);
    assert.match(page, /已阅读并同意/);
    assert.match(page, /暂不使用/);
    assert.match(page, /className = `message-toast/);
    assert.doesNotMatch(page, /window\.messageNotice[\s\S]{0,180}messageConfirm/);
    assert.match(page, /_messageNoticeKey/);
    assert.doesNotMatch(compose, /id="status"/);
    assert.doesNotMatch(read('message/settings.html'), /id="status"/);
    assert.match(read('message/settings.html'), /class="message-help"/);
    assert.doesNotMatch(read('message/settings.html'), /<details|<summary/);
    assert.doesNotMatch(page, /btn-danger/);
});

test('message and popup controls share personalized glass styling and hide scrollbars', () => {
    const messageCss = read('message/message.css');
    const materialCss = read('scripts/material-global.css');
    const popupCss = read('popup/style.css');
    assert.match(messageCss, /backdrop-filter: blur\(10px\)/);
    assert.match(messageCss, /scrollbar-width: none/);
    assert.match(materialCss, /message-shell \.btn-save/);
    assert.match(materialCss, /data-nju-global-mode="liquid-glass"/);
    assert.match(materialCss, /var\(--nju-global-blur/);
    assert.match(popupCss, /backdrop-filter: blur\(10px\)/);
    assert.match(popupCss, /body::-webkit-scrollbar/);
    assert.doesNotMatch(messageCss, /border-(?:top|bottom|left|right)\s*:/);
});

test('options and message pages load the same dropdown controller', () => {
    assert.match(read('options/template.html'), /scripts\/nju-dropdown\.js/);
    assert.match(read('message/settings.html'), /scripts\/nju-dropdown\.js/);
    assert.match(read('message/compose.html'), /scripts\/nju-dropdown\.js/);
    assert.match(read('options/options.js'), /NjuDropdown\.initAll\(\)/);
});
