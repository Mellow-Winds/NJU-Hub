const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'selearning_enhance.js'), 'utf8');

function hooks() {
    const holder = {};
    const context = {
        __NJU_HUB_SELEARNING_TEST__: holder,
        URL,
        TextDecoder,
        console,
        location: {
            href: 'https://selearning.nju.edu.cn/course/view.php?id=1',
            origin: 'https://selearning.nju.edu.cn',
            pathname: '/course/view.php'
        }
    };
    vm.runInNewContext(source, context);
    return holder.api;
}

function link(href, text) {
    return {
        href,
        textContent: text,
        getAttribute(name) { return name === 'href' ? href : ''; },
        querySelector() { return null; }
    };
}

test('SElearning content script is registered with the existing NJU permissions', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const entry = manifest.content_scripts.find(item => item.matches?.includes('https://selearning.nju.edu.cn/*'));
    assert.ok(entry);
    assert.deepEqual(entry.css, ['scripts/download_panel.css', 'scripts/selearning_enhance.css']);
    assert.deepEqual(entry.js, ['scripts/selearning_enhance.js']);
    assert.ok(manifest.permissions.includes('downloads'));
    assert.ok(manifest.host_permissions.includes('*://*.nju.edu.cn/*'));
});

test('SElearning display toggle is grouped with SEEC display settings', () => {
    const other = fs.readFileSync(path.join(root, 'options', 'sections', 'other.html'), 'utf8');
    const display = fs.readFileSync(path.join(root, 'options', 'sections', 'seec.html'), 'utf8');
    const popup = fs.readFileSync(path.join(root, 'popup', 'index.html'), 'utf8');
    assert.equal(other.includes('toggle-selearning'), false);
    assert.match(display, /toggle-seec-workpanel[\s\S]*toggle-selearning/);
    assert.match(popup, /toggle-seec-workpanel[\s\S]*toggle-selearning/);
});

test('SElearning display toggle does not disable batch downloading', () => {
    assert.match(source, /function ensureDownloadBall\(\) \{\s*syncDrawerState\(\);\s*if \(!isCoursePage\(\)\) return;/);
    assert.match(source, /function openCoursewareDownload\(\) \{\s*if \(state\.dialog\) return;/);
    assert.match(source, /function setDisplayEnabled\(enabled\)/);
    assert.match(source, /function initializeDownloadEnhancement\(\)/);
    assert.doesNotMatch(source, /function setEnabled\(enabled\)/);
});

test('SElearning left drawer follows all three material modes', () => {
    const css = fs.readFileSync(path.join(root, 'scripts', 'selearning_enhance.css'), 'utf8');
    for (const mode of ['default', 'enhanced', 'liquid-glass']) {
        assert.match(css, new RegExp(`data-nju-global-mode="${mode}"\\] #nav-drawer\\[data-nju-selearning-enabled="true"\\]`));
    }
    assert.match(source, /function syncDrawerState\(\)/);
    assert.match(source, /MATERIAL_MODE_KEY = 'ui_material_mode'/);
});

test('SElearning initialization marks the actual Moodle drawer and loads the material mode', () => {
    const element = () => ({
        dataset: {},
        attributes: new Map(),
        setAttribute(name, value) { this.attributes.set(name, String(value)); },
        removeAttribute(name) { this.attributes.delete(name); },
        getAttribute(name) { return this.attributes.get(name) ?? null; },
        toggleAttribute(name, enabled) {
            if (enabled && !this.attributes.has(name)) this.setAttribute(name, '');
            if (!enabled) this.removeAttribute(name);
            return enabled;
        }
    });
    const root = element();
    let drawer = element();
    let onChanged;
    let onMutation;
    const context = {
        URL,
        TextDecoder,
        console,
        location: {
            pathname: '/course/view.php',
            href: 'https://selearning.nju.edu.cn/course/view.php?id=445',
            origin: 'https://selearning.nju.edu.cn'
        },
        document: {
            documentElement: root,
            body: {},
            getElementById(id) { return id === 'nav-drawer' ? drawer : null; },
            querySelectorAll() { return []; },
            createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }
        },
        MutationObserver: class { constructor(callback) { onMutation = callback; } observe() {} disconnect() {} },
        chrome: {
            storage: {
                local: { get(keys, callback) { callback({ 'toggle-selearning': true }); } },
                sync: { get(keys, callback) { callback({ 'ui_material_mode': 'liquid-glass' }); } },
                onChanged: { addListener(callback) { onChanged = callback; } }
            }
        }
    };
    vm.runInNewContext(source, context);
    assert.equal(root.dataset.njuGlobalMode, 'liquid-glass');
    const attribute = 'data-nju-selearning-enabled';
    assert.equal(drawer.getAttribute(attribute), 'true', 'must match the CSS attribute value, not just attribute presence');
    assert.equal(root.getAttribute(attribute), 'true');
    onChanged({ 'toggle-selearning': { newValue: false } }, 'local');
    assert.equal(drawer.getAttribute(attribute), null);
    assert.equal(root.getAttribute(attribute), null);
    onChanged({ 'toggle-selearning': { newValue: true } }, 'local');
    assert.equal(drawer.getAttribute(attribute), 'true');
    drawer = element();
    onMutation();
    assert.equal(drawer.getAttribute(attribute), 'true');
    for (const mode of ['default', 'enhanced', 'liquid-glass']) {
        onChanged({ ui_material_mode: { newValue: mode } }, 'sync');
        assert.equal(root.dataset.njuGlobalMode, mode);
        assert.equal(drawer.getAttribute(attribute), 'true');
    }
});

test('SElearning dialog resets native close-button borders', () => {
    const css = fs.readFileSync(path.join(root, 'scripts', 'selearning_enhance.css'), 'utf8');
    assert.match(css, /\.selearning-download-mask \.lms-close[\s\S]*border:\s*0/);
    assert.match(css, /\.selearning-download-mask \.lms-close:focus-visible[\s\S]*outline:\s*2px/);
    assert.match(css, /^#selearning-dl-ball\s*\{/m);
});

test('popup feature rows do not change surface color on hover', () => {
    const css = fs.readFileSync(path.join(root, 'popup', 'style.css'), 'utf8');
    assert.doesNotMatch(css, /\.feature-row:hover\s*\{[\s\S]*?background\s*:/);
});

test('same-origin URL validation rejects external and credentialed links', () => {
    const api = hooks();
    const origin = 'https://selearning.nju.edu.cn';
    assert.equal(api.sameOriginUrl('/pluginfile.php/1/lecture.pdf', `${origin}/course/view.php?id=1`, origin), `${origin}/pluginfile.php/1/lecture.pdf`);
    assert.equal(api.sameOriginUrl('https://evil.example/file.pdf', `${origin}/course/view.php?id=1`, origin), null);
    assert.equal(api.sameOriginUrl('https://user:pass@selearning.nju.edu.cn/file.pdf', `${origin}/course/view.php?id=1`, origin), null);
    assert.equal(api.isLikelyFileUrl(`${origin}/pluginfile.php/1/a.pptx`), true);
    assert.equal(api.isLikelyFileUrl(`${origin}/mod/resource/view.php?id=1`), false);
});

test('file names are safe for independent browser downloads', () => {
    const api = hooks();
    assert.equal(api.sanitizeFilename('../讲义:第一章.pdf'), '_讲义_第一章.pdf');
    assert.equal(api.sanitizeFilename('CON.pdf'), '_CON.pdf');
    assert.equal(api.sanitizeFilename('   '), 'download');
});

test('folder parser keeps same-origin file links and adds folder context', () => {
    const api = hooks();
    const origin = 'https://selearning.nju.edu.cn';
    const folderDocument = {
        querySelectorAll(selector) {
            assert.equal(selector, 'a[href]');
            return [
                link('/pluginfile.php/1/lecture.pdf?forcedownload=1', 'Lecture 01.pdf'),
                link('/pluginfile.php/1/lecture.pdf?forcedownload=1', 'duplicate'),
                link('/mod/resource/view.php?id=2', 'not a file'),
                link('https://evil.example/secret.pdf', 'external')
            ];
        }
    };
    const files = api.parseFolderDocument(folderDocument, `${origin}/mod/folder/view.php?id=1`, '第一章', origin);
    assert.equal(files.length, 1);
    assert.equal(files[0].name, 'Lecture 01.pdf');
    assert.equal(files[0].displayName, '第一章 / Lecture 01.pdf');
    assert.equal(files[0].downloadName, '第一章 - Lecture 01.pdf');
});

test('courseware activity parser recognizes resource and folder activities only', () => {
    const api = hooks();
    const origin = 'https://selearning.nju.edu.cn';
    const activity = (type, name, href) => ({
        classList: { contains(value) { return value === type || value === `modtype_${type}`; } },
        querySelector(selector) {
            if (selector === '.instancename') return { textContent: `${name} 文件`, querySelectorAll() { return []; } };
            return link(href, name);
        }
    });
    const section = {
        querySelectorAll(selector) {
            assert.equal(selector, 'li.activity');
            return [
                activity('resource', 'Lecture 01', '/mod/resource/view.php?id=1'),
                activity('folder', '第一章', '/mod/folder/view.php?id=2'),
                activity('quiz', '作业', '/mod/quiz/view.php?id=3')
            ];
        }
    };
    const files = api.collectActivities(section, origin);
    assert.equal(JSON.stringify(files.map(file => [file.kind, file.name, file.url])), JSON.stringify([
        ['resource', 'Lecture 01', `${origin}/mod/resource/view.php?id=1`],
        ['folder', '第一章', `${origin}/mod/folder/view.php?id=2`]
    ]));
});
