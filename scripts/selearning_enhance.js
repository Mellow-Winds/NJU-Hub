/**
 * scripts/selearning_enhance.js
 *
 * 目标页面：selearning.nju.edu.cn/*（Moodle 教学平台）
 * 功能：课件章节增强、直接资源/文件夹资源批量下载。
 * 说明：下载使用当前页面登录态获取文件内容，以便绕过 PDF Viewer，
 *       并沿用 SEEC 的独立文件选择、进度、失败重试交互。
 */

(function () {
    'use strict';

    const TOGGLE_KEY = 'toggle-selearning';
    const MATERIAL_MODE_KEY = 'ui_material_mode';
    const MATERIAL_MODES = new Set(['default', 'enhanced', 'liquid-glass']);
    const ENABLED_ATTRIBUTE = 'data-nju-selearning-enabled';
    const DOWNLOAD_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="display:block"><path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>';
    const FILE_EXTENSIONS = /\.(?:pdf|pptx?|docx?|xlsx?|csv|zip|rar|7z|txt|md|png|jpe?g|gif|mp4|mp3)(?:$|[?#])/i;
    const state = {
        displayEnabled: false,
        observer: null,
        dialog: null
    };

    function normalizeText(value) {
        return String(value ?? '').replace(/[\s\u00a0]+/g, ' ').trim();
    }

    function stripActivitySuffix(value) {
        return normalizeText(value).replace(/\s+(?:文件夹|文件)$/, '').trim();
    }

    function sanitizeFilename(filename) {
        let safe = String(filename || 'download')
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
            .replace(/^[. ]+|[. ]+$/g, '')
            .trim() || 'download';
        if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = `_${safe}`;
        return safe;
    }

    function sameOriginUrl(value, baseUrl, expectedOrigin) {
        let parsed;
        try {
            parsed = new URL(value, baseUrl || location.href);
        } catch (_) {
            return null;
        }

        let origin = expectedOrigin;
        if (!origin) {
            try { origin = new URL(baseUrl || location.href).origin; } catch (_) { origin = ''; }
        }
        if (!origin || parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
        return parsed.href;
    }

    function readableText(node) {
        if (!node) return '';
        if (typeof node.cloneNode === 'function') {
            const clone = node.cloneNode(true);
            if (typeof clone.querySelectorAll === 'function') {
                clone.querySelectorAll('.accesshide, .sr-only, .visually-hidden').forEach(element => element.remove());
            }
            return normalizeText(clone.textContent || clone.innerText);
        }
        return normalizeText(node.textContent || node.innerText);
    }

    function getNodeAttribute(node, names) {
        for (const name of names) {
            const value = typeof node?.getAttribute === 'function' ? node.getAttribute(name) : node?.[name];
            if (value) return value;
        }
        return '';
    }

    function filenameFromUrl(value) {
        try {
            const pathname = new URL(value).pathname;
            const part = pathname.split('/').filter(Boolean).pop() || 'download';
            return decodeURIComponent(part);
        } catch (_) {
            return 'download';
        }
    }

    function fileLabel(anchor, url) {
        const preferred = typeof anchor?.querySelector === 'function'
            ? anchor.querySelector('.fp-filename, .fp-filename-icon, .filename')
            : null;
        let name = readableText(preferred || anchor);
        if (!name || /^(?:下载|打开|查看)$/i.test(name)) name = filenameFromUrl(url);
        return name.replace(/\s+(?:下载|打开|查看)$/, '').trim() || filenameFromUrl(url);
    }

    function isLikelyFileUrl(value) {
        let url;
        try { url = new URL(value); } catch (_) { return false; }
        const path = url.pathname.toLowerCase();
        return /\/(?:pluginfile|file)\.php(?:\/|$)/.test(path) || FILE_EXTENSIONS.test(path);
    }

    function isCoursePage() {
        return /\/course\/view\.php$/i.test(location.pathname) || /\/course\/\d+\/?$/i.test(location.pathname);
    }

    function normalizeMaterialMode(value) {
        return MATERIAL_MODES.has(value) ? value : 'default';
    }

    function findCoursewareSection(root = document) {
        const contents = Array.from(root.querySelectorAll?.('.content') || []);
        return contents.find(content => {
            const heading = content.querySelector?.('h3.sectionname');
            return normalizeText(heading?.textContent).replace(/\s/g, '') === '课件';
        }) || null;
    }

    function getActivityName(activity, anchor) {
        const instanceName = activity.querySelector?.('.instancename');
        return stripActivitySuffix(readableText(instanceName || anchor));
    }

    function collectActivities(section, expectedOrigin) {
        const activities = Array.from(section?.querySelectorAll?.('li.activity') || []);
        return activities.map(activity => {
            const anchor = activity.querySelector?.('a.aalink[href]') || activity.querySelector?.('a[href]');
            if (!anchor) return null;
            const rawUrl = getNodeAttribute(anchor, ['href']) || anchor.href;
            const url = sameOriginUrl(rawUrl, location.href, expectedOrigin || location.origin);
            if (!url) return null;
            const name = getActivityName(activity, anchor);
            if (!name) return null;
            if (activity.classList?.contains('folder') || activity.classList?.contains('modtype_folder')) {
                return { kind: 'folder', name, url };
            }
            if (activity.classList?.contains('resource') || activity.classList?.contains('modtype_resource')) {
                return { kind: 'resource', name, url };
            }
            return null;
        }).filter(Boolean);
    }

    function parseFolderDocument(folderDocument, baseUrl, folderName, expectedOrigin) {
        const anchors = Array.from(folderDocument?.querySelectorAll?.('a[href]') || []);
        const files = [];
        const seen = new Set();
        for (const anchor of anchors) {
            const rawUrl = getNodeAttribute(anchor, ['href']) || anchor.href;
            const url = sameOriginUrl(rawUrl, baseUrl, expectedOrigin);
            if (!url || !isLikelyFileUrl(url) || seen.has(url)) continue;
            seen.add(url);
            const name = fileLabel(anchor, url);
            files.push({
                kind: 'folder-file',
                folderName: folderName || '',
                name,
                displayName: folderName ? `${folderName} / ${name}` : name,
                downloadName: folderName ? `${folderName} - ${name}` : name,
                url
            });
        }
        return files;
    }

    function collectEmbeddedFileUrls(pageDocument, baseUrl, expectedOrigin) {
        const nodes = Array.from(pageDocument?.querySelectorAll?.(
            'a[href], iframe[src], embed[src], object[data], [data-url], [data-download-url]'
        ) || []);
        const urls = [];
        const seen = new Set();
        for (const node of nodes) {
            const rawUrl = getNodeAttribute(node, ['href', 'src', 'data', 'data-url', 'data-download-url']);
            const url = sameOriginUrl(rawUrl, baseUrl, expectedOrigin);
            if (!url || !isLikelyFileUrl(url) || seen.has(url)) continue;
            seen.add(url);
            urls.push(url);
        }
        return urls;
    }

    function responseLooksLikeHtml(contentType, sample) {
        return /(?:text\/html|application\/xhtml|application\/json)/i.test(contentType || '')
            || /^\s*(?:<!doctype|<html|<head|<body)/i.test(sample || '');
    }

    function looksLikeLoginPage(url, text) {
        return /authserver|\/login(?:\.php)?(?:[/?#]|$)/i.test(url || '')
            || /(?:请先登录|登录后访问|用户名|密码|未登录|login|sign in|access denied|forbidden)/i.test((text || '').slice(0, 4000));
    }

    async function fetchHtmlPage(url, expectedOrigin) {
        const safeUrl = sameOriginUrl(url, location.href, expectedOrigin || location.origin);
        if (!safeUrl) throw new Error('链接不是当前 SElearning 站点地址');
        const response = await fetch(safeUrl, {
            credentials: 'include',
            redirect: 'follow',
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const finalUrl = sameOriginUrl(response.url || safeUrl, safeUrl, expectedOrigin || location.origin);
        if (!finalUrl) throw new Error('登录状态可能已失效，页面跳转到了非 SElearning 地址');
        const text = await response.text();
        if (looksLikeLoginPage(finalUrl, text)) throw new Error('当前登录状态无效，请先登录 SElearning');
        if (!responseLooksLikeHtml(response.headers?.get?.('content-type') || '', text.slice(0, 4000))) {
            throw new Error('文件夹页面返回的不是 HTML');
        }
        const parsed = new DOMParser().parseFromString(text, 'text/html');
        return { document: parsed, url: finalUrl };
    }

    async function classifyBlob(blob, filename) {
        if (!blob?.size) throw new Error('服务器返回了空文件');
        const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
        const header = new TextDecoder().decode(bytes);
        const extension = String(filename || '').split('.').pop().toLowerCase();
        if (extension === 'pdf' && !header.startsWith('%PDF-')) throw new Error('文件内容不是有效的 PDF');
        if (/^(?:pptx|docx|xlsx|zip|jar|epub)$/i.test(extension) && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
            throw new Error('文件内容与扩展名不匹配');
        }
        if (extension === 'ppt' && !(bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)) {
            throw new Error('文件内容与扩展名不匹配');
        }
        return blob;
    }

    async function fetchFilePayload(url, filename, expectedOrigin) {
        const safeUrl = sameOriginUrl(url, location.href, expectedOrigin || location.origin);
        if (!safeUrl) throw new Error('文件链接不是当前 SElearning 站点地址');
        const response = await fetch(safeUrl, {
            credentials: 'include',
            redirect: 'follow',
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const finalUrl = sameOriginUrl(response.url || safeUrl, safeUrl, expectedOrigin || location.origin);
        if (!finalUrl) throw new Error('登录状态可能已失效，文件跳转到了非 SElearning 地址');

        const blob = await response.blob();
        const sample = await blob.slice(0, 4000).text().catch(() => '');
        const contentType = response.headers?.get?.('content-type') || '';
        const isMarkup = responseLooksLikeHtml(contentType, sample);
        if (isMarkup) {
            const text = await blob.text();
            if (looksLikeLoginPage(finalUrl, text)) throw new Error('当前登录状态无效，请先登录 SElearning');
            return {
                kind: 'html',
                document: new DOMParser().parseFromString(text, 'text/html'),
                url: finalUrl
            };
        }
        if (/authserver|\/login(?:\.php)?(?:[/?#]|$)/i.test(finalUrl)) throw new Error('当前登录状态无效或文件无权访问');
        return { kind: 'file', blob: await classifyBlob(blob, filename), url: finalUrl };
    }

    async function resolveFileBlob(file, expectedOrigin) {
        const first = await fetchFilePayload(file.url, file.downloadName || file.name, expectedOrigin);
        if (first.kind === 'file') return first;

        const candidates = collectEmbeddedFileUrls(first.document, first.url, expectedOrigin);
        let lastError = null;
        for (const candidate of candidates) {
            try {
                const resolved = await fetchFilePayload(candidate, file.downloadName || file.name, expectedOrigin);
                if (resolved.kind === 'file') return resolved;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('未找到该资源的真实文件地址');
    }

    async function expandFolder(entry, expectedOrigin) {
        const page = await fetchHtmlPage(entry.url, expectedOrigin);
        let files = parseFolderDocument(page.document, page.url, entry.name, expectedOrigin);
        if (!files.length) {
            files = collectEmbeddedFileUrls(page.document, page.url, expectedOrigin).map(url => {
                const name = filenameFromUrl(url);
                return {
                    kind: 'folder-file',
                    folderName: entry.name,
                    name,
                    displayName: `${entry.name} / ${name}`,
                    downloadName: `${entry.name} - ${name}`,
                    url
                };
            });
        }
        if (!files.length) throw new Error(`文件夹“${entry.name}”中没有找到可下载文件`);
        return files;
    }

    async function discoverCourseware(root = document) {
        const expectedOrigin = location.origin;
        const section = findCoursewareSection(root);
        if (!section) throw new Error('当前页面没有找到“课件”章节');
        const activities = collectActivities(section, expectedOrigin);
        const files = [];
        const errors = [];
        for (const activity of activities) {
            if (activity.kind === 'resource') {
                files.push({
                    kind: 'resource',
                    name: activity.name,
                    displayName: activity.name,
                    downloadName: activity.name,
                    url: activity.url
                });
                continue;
            }
            try {
                files.push(...await expandFolder(activity, expectedOrigin));
            } catch (error) {
                errors.push({ name: activity.name, error: error?.message || '读取文件夹失败' });
            }
        }

        const deduped = [];
        const seen = new Set();
        for (const file of files) {
            if (seen.has(file.url)) continue;
            seen.add(file.url);
            deduped.push(file);
        }
        return { files: deduped, errors };
    }

    function triggerBlobDownload(blob, filename) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = sanitizeFilename(filename);
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }

    function fileExtension(filename) {
        const extension = String(filename || '').split('.').pop().toLowerCase();
        return extension.length <= 5 ? extension : 'file';
    }

    function createDialog() {
        const mask = document.createElement('div');
        mask.className = 'lms-mask selearning-download-mask';
        mask.setAttribute('role', 'dialog');
        mask.setAttribute('aria-modal', 'true');
        mask.setAttribute('aria-label', '课件下载');
        const previousOverflow = document.body.style.overflow;
        const previousFocus = document.activeElement;
        const dialog = { mask, previousOverflow, previousFocus, running: false, closed: false };

        const onKey = event => {
            if (event.key === 'Escape') dialog.close();
            if (event.key !== 'Tab') return;
            const controls = Array.from(mask.querySelectorAll('button:not(:disabled), input'));
            if (!controls.length) { event.preventDefault(); return; }
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };

        dialog.close = () => {
            if (dialog.running || dialog.closed) return;
            dialog.closed = true;
            mask.classList.add('lms-closing');
            mask.querySelector('.lms-panel')?.classList.add('lms-closing');
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKey);
            setTimeout(() => {
                mask.remove();
                if (state.dialog === dialog) state.dialog = null;
                previousFocus?.focus?.();
            }, 280);
        };

        document.addEventListener('keydown', onKey);
        mask.onclick = event => { if (event.target === mask) dialog.close(); };
        document.body.style.overflow = 'hidden';
        document.body.appendChild(mask);
        state.dialog = dialog;
        return dialog;
    }

    function renderDiscoveryLoading(dialog) {
        dialog.mask.innerHTML = `<div class="lms-panel lms-progress-panel">
            <div class="lms-header"><h3>课件下载</h3><button type="button" class="lms-close selearning-dl-close" aria-label="关闭">×</button></div>
            <div class="lms-progress-body" role="status">
                <div class="lms-progress-icon" aria-hidden="true"></div>
                <div class="lms-progress-title">正在读取课件列表，请稍候。</div>
                <div class="lms-progress-subtitle">正在展开文件夹并检查当前登录权限。</div>
            </div>
        </div>`;
        dialog.mask.querySelector('.selearning-dl-close').onclick = dialog.close;
        dialog.mask.querySelector('.selearning-dl-close').focus();
    }

    function renderDiscoveryError(dialog, error) {
        dialog.mask.innerHTML = `<div class="lms-panel lms-progress-panel">
            <div class="lms-header"><h3>课件下载</h3><button type="button" class="lms-close selearning-dl-close" aria-label="关闭">×</button></div>
            <div class="lms-progress-body lms-complete-body" role="alert">
                <div class="lms-progress-title">读取失败</div>
                <div class="lms-download-errors"><div class="lms-download-error" data-discovery-error></div></div>
                <div class="lms-footer lms-complete-footer" style="width:100%;box-sizing:border-box;margin-top:28px">
                    <button type="button" class="lms-btn lms-btn-prime selearning-dl-close">关闭</button>
                </div>
            </div>
        </div>`;
        dialog.mask.querySelector('[data-discovery-error]').textContent = error?.message || '读取课件列表失败';
        dialog.mask.querySelectorAll('.selearning-dl-close').forEach(button => { button.onclick = dialog.close; });
        dialog.mask.querySelector('.selearning-dl-close').focus();
    }

    function renderDownloadList(dialog, files, discoveryErrors) {
        dialog.mask.innerHTML = `<div class="lms-panel">
            <div class="lms-header"><h3>课件下载 (${files.length})</h3><button type="button" class="lms-close selearning-dl-close" aria-label="关闭">×</button></div>
            <div class="lms-list-container lms-scrollable" data-file-list></div>
            <div class="lms-footer">
                <div style="display:flex;gap:10px"><button type="button" class="lms-btn selearning-dl-all">全选</button><button type="button" class="lms-btn selearning-dl-invert">反选</button></div>
                <button type="button" class="lms-btn lms-btn-prime selearning-dl-submit" disabled>下载所选</button>
            </div>
        </div>`;
        const list = dialog.mask.querySelector('[data-file-list]');
        const submit = dialog.mask.querySelector('.selearning-dl-submit');

        if (discoveryErrors.length) {
            const notice = document.createElement('div');
            notice.className = 'lms-download-error';
            notice.textContent = discoveryErrors.map(item => `${item.name}：${item.error}`).join('；');
            list.appendChild(notice);
        }

        const update = () => {
            dialog.mask.querySelectorAll('.lms-dl-item').forEach(row => {
                row.classList.toggle('selected', row.querySelector('.selearning-file-select').checked);
            });
            submit.disabled = !dialog.mask.querySelectorAll('.selearning-file-select:checked').length;
        };

        files.forEach(file => {
            const row = document.createElement('div');
            row.className = 'lms-dl-item';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'lms-ios-checkbox selearning-file-select';
            input.checked = files.length === 1;
            input.setAttribute('aria-label', file.displayName);
            input.file = file;
            const tag = document.createElement('span');
            tag.className = `lms-file-tag tag-${/^(pdf|doc|ppt|xls)/.exec(fileExtension(file.name))?.[1] || 'file'}`;
            tag.textContent = fileExtension(file.name);
            const name = document.createElement('span');
            name.className = 'lms-dl-name';
            name.textContent = file.displayName;
            row.title = file.displayName;
            row.append(input, tag, name);
            row.onclick = event => {
                if (event.target !== input) input.checked = !input.checked;
                update();
            };
            input.onchange = update;
            list.appendChild(row);
        });

        if (!files.length) {
            list.textContent = '当前“课件”章节暂无可下载文件。';
            list.style.padding = '24px';
        }
        dialog.mask.querySelector('.selearning-dl-close').onclick = dialog.close;
        dialog.mask.querySelector('.selearning-dl-all').onclick = () => {
            dialog.mask.querySelectorAll('.selearning-file-select').forEach(input => { input.checked = true; });
            update();
        };
        dialog.mask.querySelector('.selearning-dl-invert').onclick = () => {
            dialog.mask.querySelectorAll('.selearning-file-select').forEach(input => { input.checked = !input.checked; });
            update();
        };
        submit.onclick = () => runDownloadQueue(dialog, Array.from(dialog.mask.querySelectorAll('.selearning-file-select:checked'), input => input.file));
        update();
        dialog.mask.querySelector('.selearning-dl-close').focus();
    }

    function renderDownloadProgress(dialog, total) {
        dialog.mask.innerHTML = `<div class="lms-panel lms-progress-panel">
            <div class="lms-header"><h3>课件下载</h3></div>
            <div class="lms-progress-body" role="status">
                <div class="lms-progress-icon" aria-hidden="true"></div>
                <div class="lms-progress-title">正在下载，请稍候。</div>
                <div class="lms-progress-subtitle">文件将保存到浏览器的下载目录。</div>
                <div class="lms-progress-count" data-progress-count>已处理 0 / ${total}</div>
                <div class="lms-progress-current" data-progress-current></div>
            </div>
        </div>`;
    }

    function renderDownloadComplete(dialog, results) {
        const failed = results.filter(result => !result.ok);
        const successCount = results.length - failed.length;
        dialog.mask.innerHTML = `<div class="lms-panel lms-progress-panel">
            <div class="lms-header"><h3>课件下载</h3><button type="button" class="lms-close selearning-dl-close" aria-label="关闭">×</button></div>
            <div class="lms-progress-body lms-complete-body" role="status">
                <div class="lms-progress-icon done" aria-hidden="true"></div>
                <div class="lms-progress-title">${failed.length ? '部分下载失败' : '下载已提交'}</div>
                <div class="lms-progress-subtitle">已提交 ${successCount} 个文件${failed.length ? `，${failed.length} 个文件失败` : ''}。<br>保存完成情况请查看浏览器下载列表。</div>
                <div class="lms-download-errors" data-download-errors></div>
                <div class="lms-footer lms-complete-footer" style="width:100%;box-sizing:border-box;margin-top:28px">
                    <button type="button" class="lms-btn selearning-dl-retry" style="display:none">重试失败文件</button>
                    <button type="button" class="lms-btn lms-btn-prime selearning-dl-close">关闭</button>
                </div>
            </div>
        </div>`;
        const errorList = dialog.mask.querySelector('[data-download-errors]');
        failed.forEach(result => {
            const item = document.createElement('div');
            item.className = 'lms-download-error';
            item.textContent = `${result.file.displayName}：${result.error}`;
            errorList.appendChild(item);
        });
        const retry = dialog.mask.querySelector('.selearning-dl-retry');
        retry.style.display = failed.length ? '' : 'none';
        retry.onclick = () => runDownloadQueue(dialog, failed.map(result => result.file));
        dialog.mask.querySelectorAll('.selearning-dl-close').forEach(button => { button.onclick = dialog.close; });
        dialog.mask.querySelector('.selearning-dl-close').focus();
    }

    async function runDownloadQueue(dialog, selected) {
        if (dialog.running || !selected.length) return;
        dialog.running = true;
        renderDownloadProgress(dialog, selected.length);
        const results = [];
        const expectedOrigin = location.origin;
        for (const file of selected) {
            const count = dialog.mask.querySelector('[data-progress-count]');
            const current = dialog.mask.querySelector('[data-progress-current]');
            if (count) count.textContent = `已处理 ${results.length} / ${selected.length}`;
            if (current) current.textContent = `当前文件：${file.displayName}`;
            try {
                const resolved = await resolveFileBlob(file, expectedOrigin);
                triggerBlobDownload(resolved.blob, file.downloadName || file.name);
                results.push({ file, ok: true });
            } catch (error) {
                results.push({ file, ok: false, error: error?.message || '下载失败' });
            }
            if (count) count.textContent = `已处理 ${results.length} / ${selected.length}`;
            await new Promise(resolve => setTimeout(resolve, 180));
        }
        dialog.running = false;
        renderDownloadComplete(dialog, results);
    }

    function ensureDownloadBall() {
        syncDrawerState();
        if (!isCoursePage()) return;
        const section = findCoursewareSection(document);
        let ball = document.getElementById('selearning-dl-ball');
        if (!section) {
            if (ball) ball.style.display = 'none';
            return;
        }
        if (!ball) {
            ball = document.createElement('button');
            ball.id = 'selearning-dl-ball';
            ball.type = 'button';
            ball.className = 'lms-circle-ball lms-ball-green';
            ball.title = '课件批量下载';
            ball.setAttribute('aria-label', '课件批量下载');
            ball.innerHTML = DOWNLOAD_ICON;
            ball.onclick = openCoursewareDownload;
            document.body.appendChild(ball);
        }
        ball.style.display = 'flex';
    }

    function openCoursewareDownload() {
        if (state.dialog) return;
        const dialog = createDialog();
        renderDiscoveryLoading(dialog);
        discoverCourseware()
            .then(result => {
                if (dialog.closed) return;
                if (!result.files.length) {
                    const detail = result.errors.length
                        ? result.errors.map(item => `${item.name}：${item.error}`).join('；')
                        : '当前“课件”章节暂无可下载文件';
                    throw new Error(detail);
                }
                renderDownloadList(dialog, result.files, result.errors);
            })
            .catch(error => {
                if (!dialog.closed) renderDiscoveryError(dialog, error);
            });
    }

    function setDisplayEnabled(enabled) {
        state.displayEnabled = enabled;
        if (enabled) document.documentElement.setAttribute(ENABLED_ATTRIBUTE, 'true');
        else document.documentElement.removeAttribute(ENABLED_ATTRIBUTE);
        syncDrawerState();
    }

    function syncDrawerState() {
        const drawer = document.getElementById('nav-drawer');
        if (!drawer) return;
        // CSS matches the literal value "true"; toggleAttribute creates "".
        if (state.displayEnabled) drawer.setAttribute(ENABLED_ATTRIBUTE, 'true');
        else drawer.removeAttribute(ENABLED_ATTRIBUTE);
    }

    function initializeDownloadEnhancement() {
        ensureDownloadBall();
        if (!state.observer && document.body) {
            state.observer = new MutationObserver(ensureDownloadBall);
            state.observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    const testApi = {
        normalizeText,
        sanitizeFilename,
        sameOriginUrl,
        isLikelyFileUrl,
        findCoursewareSection,
        collectActivities,
        parseFolderDocument,
        collectEmbeddedFileUrls,
        responseLooksLikeHtml,
        looksLikeLoginPage
    };

    if (globalThis.__NJU_HUB_SELEARNING_TEST__) {
        globalThis.__NJU_HUB_SELEARNING_TEST__.api = testApi;
        return;
    }

    chrome.storage.local.get([TOGGLE_KEY], result => {
        setDisplayEnabled(result[TOGGLE_KEY] !== false);
        // Read the mode here as well as from material-global.js. This keeps the
        // site-specific stylesheet working even if the global content script
        // has not finished loading its asynchronous settings yet.
        chrome.storage.sync.get([MATERIAL_MODE_KEY], syncResult => {
            document.documentElement.dataset.njuGlobalMode = normalizeMaterialMode(syncResult[MATERIAL_MODE_KEY]);
        });
        initializeDownloadEnhancement();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[TOGGLE_KEY]) setDisplayEnabled(changes[TOGGLE_KEY].newValue !== false);
        if (area === 'sync' && changes[MATERIAL_MODE_KEY]) {
            document.documentElement.dataset.njuGlobalMode = normalizeMaterialMode(changes[MATERIAL_MODE_KEY].newValue);
        }
    });
})();
