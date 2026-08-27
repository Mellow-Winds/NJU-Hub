const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'scripts', 'lms_enhance.js');

function viewerUrl(fileUrl) {
    return `https://lms.nju.edu.cn/pdf-viewer?file=${encodeURIComponent(fileUrl)}`;
}

function domElement(url) {
    return {
        getAttribute(name) {
            return name === 'src' ? url : null;
        }
    };
}

function loadLmsHooks(state = {}) {
    let messageHandler = null;
    const runtimeMessages = [];
    const resources = state.resources || [];
    const elements = state.elements || [];
    const pageWindow = {
        addEventListener(type, handler) {
            if (type === 'message') messageHandler = handler;
        }
    };
    pageWindow.top = pageWindow;
    pageWindow.self = pageWindow;

    const context = {
        Blob,
        TextDecoder,
        URL,
        URLSearchParams,
        Uint8Array,
        clearTimeout,
        console,
        setInterval,
        setTimeout,
        window: pageWindow,
        location: {
            href: 'https://lms.nju.edu.cn/course/1/learning-activity?njuhub_lms_worker=1#/2',
            pathname: '/course/1/learning-activity',
            search: '?njuhub_lms_worker=1'
        },
        performance: {
            getEntriesByType() {
                return resources.map(name => ({ name }));
            }
        },
        document: {
            querySelectorAll() {
                return elements;
            }
        },
        chrome: {
            storage: {
                local: {
                    get(keys, callback) {
                        if (typeof callback === 'function') callback({});
                        else return Promise.resolve({});
                    }
                }
            },
            runtime: {
                lastError: null,
                onMessage: { addListener() {} },
                sendMessage(message, callback) {
                    runtimeMessages.push(message);
                    if (state.sendRuntimeMessage) {
                        state.sendRuntimeMessage(message, callback);
                        return;
                    }
                    callback?.({ ok: false, error: 'No test runtime handler' });
                }
            }
        },
        fetch() {
            throw new Error('PDF should not use the legacy fetch path');
        }
    };
    context.globalThis = context;

    const source = fs.readFileSync(sourcePath, 'utf8').replace(
        '    Logic.init();',
        '    globalThis.__NJU_HUB_LMS_TEST__ = { collectPreviewUrls, getFreshPreviewUrl, extractPreviewFileUrl, Logic };'
    );
    vm.runInNewContext(source, context, { filename: sourcePath });
    return {
        hooks: context.__NJU_HUB_LMS_TEST__,
        runtimeMessages,
        getMessageHandler: () => messageHandler
    };
}

test('stale DOM preview URL is never reused for another file', () => {
    const staleFile = 'https://lms-media.nju.edu.cn/files/stale.pdf?token=old';
    const state = {
        resources: [viewerUrl(staleFile)],
        elements: [domElement(viewerUrl(staleFile))]
    };
    const { hooks } = loadLmsHooks(state);
    const before = hooks.collectPreviewUrls();

    assert.equal(before.size, 1);
    assert.equal(hooks.getFreshPreviewUrl(before), null);

    const selectedFile = 'https://lms-media.nju.edu.cn/files/selected.pdf?token=new';
    state.resources.push(viewerUrl(selectedFile));
    assert.equal(hooks.getFreshPreviewUrl(before), selectedFile);
});

test('preview messages from an LMS iframe can resolve the current capture', () => {
    const { hooks, getMessageHandler } = loadLmsHooks();
    hooks.Logic.initWorker();

    let resolved = null;
    hooks.Logic.previewUrlResolver = {
        before: new Set(),
        resolve(url) {
            resolved = url;
        }
    };
    const selectedFile = 'https://lms-media.nju.edu.cn/files/from-iframe.pdf?token=fresh';
    getMessageHandler()({
        source: {},
        data: {
            source: 'NJU-Hub',
            type: 'lms-preview-url',
            url: viewerUrl(selectedFile)
        }
    });

    assert.equal(resolved, selectedFile);
});

test('PDF downloads bypass the unreliable legacy blob endpoint', async () => {
    const { hooks } = loadLmsHooks();
    const result = await hooks.Logic.tryLegacyDownload({
        name: 'lecture.pdf',
        legacyUrl: '/api/uploads/123/blob'
    });

    assert.equal(result.ok, false);
    assert.match(result.reason, /预览授权链路/);
});

test('preview file URLs are restricted to trusted LMS hosts', () => {
    const { hooks } = loadLmsHooks();
    assert.equal(
        hooks.extractPreviewFileUrl(viewerUrl('https://evil.example/lecture.pdf')),
        null
    );
});

test('each PDF in a batch gets a fresh worker tab', async () => {
    let nextTabId = 20;
    const closedTabs = [];
    const state = {
        sendRuntimeMessage(message, callback) {
            if (message.action === 'lmsOpenWorker') {
                callback({ ok: true, tabId: nextTabId++ });
            } else if (message.action === 'lmsWorkerResolve') {
                callback({
                    ok: true,
                    url: `https://lms-media.nju.edu.cn/files/${message.file.uploadId}.pdf?token=fresh`
                });
            } else if (message.action === 'lmsWorkerDownload') {
                callback({ ok: true, downloadId: message.filename });
            } else if (message.action === 'lmsCloseWorker') {
                closedTabs.push(message.tabId);
                callback({ ok: true });
            }
        }
    };
    const { hooks, runtimeMessages } = loadLmsHooks(state);
    hooks.Logic.showDownloadProgress = () => {};
    hooks.Logic.updateDownloadProgress = () => {};
    hooks.Logic.showDownloadComplete = () => {};

    const files = [
        { name: 'first.pdf', uploadId: 101, activityId: 1, legacyUrl: '/api/uploads/101/blob' },
        { name: 'second.pdf', uploadId: 202, activityId: 2, legacyUrl: '/api/uploads/202/blob' }
    ];
    const mask = {
        querySelectorAll() {
            return [{ id: 'f-0' }, { id: 'f-1' }];
        }
    };

    await hooks.Logic.startDownloadQueue(files, mask);

    const opened = runtimeMessages.filter(message => message.action === 'lmsOpenWorker');
    const resolved = runtimeMessages.filter(message => message.action === 'lmsWorkerResolve');
    assert.equal(opened.length, 2);
    assert.equal(resolved.length, 2);
    assert.notEqual(resolved[0].tabId, resolved[1].tabId);
    assert.deepEqual(closedTabs, [20, 21]);
});
