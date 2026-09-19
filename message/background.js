(() => {
    'use strict';
    const MENU = 'nju-hub-message-subscription';
    const CONFIG = ['resend_api_key', 'resend_self_email', 'resend_from_name', 'NJU_MESSAGE_CONSENT_VERSION', 'NJU_MESSAGE_PAUSED'];
    const DAY = 86400000;
    const active = new Map();
    const ownPages = ['message/settings.html', 'message/compose.html'].map(p => chrome.runtime.getURL(p));
    const validId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value);

    function authorized(sender) {
        return sender.id === chrome.runtime.id && ownPages.includes((sender.url || '').split(/[?#]/)[0]);
    }

    function configValid(config) {
        if (typeof config.resend_api_key !== 'string' || !config.resend_api_key.trim() || /\s/.test(config.resend_api_key.trim())) throw new Error('请在消息订阅设置中填写有效的 API Key。');
        if (typeof config.resend_self_email !== 'string' || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(config.resend_self_email.trim())) throw new Error('请填写一个有效的 Resend 注册邮箱。');
        const name = config.resend_from_name || '';
        if (typeof name !== 'string' || name.length > 80 || /[<>\r\n\x00-\x1f]/.test(name)) throw new Error('显示名最多 80 字，不能包含尖括号或换行。');
    }

    async function send(payload) {
        if (!payload || !validId(payload.requestId)) throw new Error('发送标识无效，请重新打开编辑页。');
        const config = await chrome.storage.local.get(CONFIG);
        if (config.NJU_MESSAGE_CONSENT_VERSION !== MessageModel.consentVersion) throw new Error('请先阅读并同意消息订阅服务说明。');
        if (config.NJU_MESSAGE_PAUSED === true) throw new Error('消息订阅服务已暂停，请重新阅读并同意隐私声明后恢复。');
        configValid(config);
        const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
        const text = typeof payload.text === 'string' ? payload.text : '';
        if (!subject || subject.length > 200 || /[\r\n]/.test(subject)) throw new Error('请填写 1–200 字的单行主题。');
        if (!text.trim() || text.length > 50000) throw new Error('消息内容不能为空，最多 50000 字。');
        // Only send to the account owner's configured email. Never accept from/to
        // from the caller. Sending to others would require a verified domain.
        const name = (config.resend_from_name || '').trim();
        const body = {
            from: name ? `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" <onboarding@resend.dev>` : 'onboarding@resend.dev',
            to: [config.resend_self_email.trim()], subject, text
        };
        // Render structured fields here; never accept caller-provided HTML.
        if (payload.presentation) Object.assign(body, MessageModel.email({ ...payload.presentation, text }));
        if (payload.scheduledAt) {
            const date = new Date(payload.scheduledAt);
            if (!Number.isFinite(date.getTime())) throw new Error('请选择有效的发送时间。');
            body.scheduled_at = date.toISOString();
        }
        const serialized = JSON.stringify(body);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
        const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        const key = `NJU_MESSAGE_ATTEMPT_${payload.requestId}`;
        const previous = (await chrome.storage.local.get(key))[key];
        if (previous?.fingerprint !== undefined && previous.fingerprint !== fingerprint) throw new Error('上次请求尚有记录，请保持原内容重试；修改内容前请在 Resend 控制台确认发送状态。');
        if (previous?.result) return previous.result;
        if (previous && Date.now() - previous.createdAt >= DAY) throw new Error('请求已超过安全重试期限，请先到 Resend 控制台核实状态。');
        if (!previous && body.scheduled_at) {
            const delay = Date.parse(body.scheduled_at) - Date.now();
            if (delay <= 0 || delay > 30 * DAY) throw new Error('预约时间须在未来 30 天内。');
        }
        // Persist before the request: a service-worker restart must not lose the
        // idempotency key. No API key or message body is stored in this receipt.
        await chrome.storage.local.set({ [key]: previous || { fingerprint, createdAt: Date.now() } });
        let response, data;
        try {
            response = await fetch('https://api.resend.com/emails', {
                method: 'POST', credentials: 'omit', redirect: 'error',
                headers: {
                    // Key persists locally only; authentication goes directly to Resend.
                    'Authorization': `Bearer ${config.resend_api_key.trim()}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': `nju-message-${payload.requestId}`
                },
                body: serialized, signal: AbortSignal.timeout(20000)
            });
            data = await response.json();
        } catch (_) {
            throw new Error('网络中断或响应异常，发送状态未确认。保持原内容重试，或到 Resend 控制台核实。');
        }
        if (!response.ok) {
            // Do not echo server response bodies: they may contain request data.
            if (response.status < 500 && response.status !== 409) await chrome.storage.local.remove(key);
            const errors = {
                400: '请求参数不符合要求，请检查主题、内容和时间。',
                401: 'API Key 无效，请重新配置。',
                403: '请检查 API Key 权限；测试发件地址只能发送到 Resend 注册邮箱。',
                409: '请求状态冲突，请保持原内容重试或到 Resend 控制台核实。',
                422: '邮箱或预约时间不符合 Resend 要求。',
                429: '发送频率或额度受限，请稍后重试。'
            };
            throw new Error(errors[response.status] || `Resend 暂时无法处理请求（HTTP ${response.status}），请核实状态后重试。`);
        }
        if (typeof data?.id !== 'string' || !data.id) throw new Error('Resend 未返回邮件 ID，发送状态未确认，请保持原内容重试。');
        const result = { ok: true, id: data.id, scheduledAt: body.scheduled_at || null };
        await chrome.storage.local.set({ [key]: { fingerprint, createdAt: previous?.createdAt || Date.now(), result } });
        return result;
    }

    chrome.runtime.onMessage.addListener((request, sender, respond) => {
        if (request.action !== 'sendResendEmail') return false;
        if (!authorized(sender)) { respond({ ok: false, error: '仅允许消息订阅页面发送邮件。' }); return false; }
        const id = request.payload?.requestId;
        // Clear the in-flight entry before replying so an immediate retry cannot
        // accidentally receive the previous request's already-resolved error.
        if (!active.has(id)) active.set(id, send(request.payload).catch(error => ({ ok: false, error: error.message })).finally(() => active.delete(id)));
        active.get(id).then(respond);
        return true;
    });

    function ensureMenu() {
        function upsert(id, options, done = () => {}) {
            chrome.contextMenus.update(id, options, () => {
                if (!chrome.runtime.lastError) return done();
                chrome.contextMenus.create({ id, ...options }, () => {
                    if (chrome.runtime.lastError) console.warn('[消息订阅] 右键菜单注册失败。');
                    else done();
                });
            });
        }
        upsert(MENU, { title: '加入 NJU-Hub 消息订阅', contexts: ['selection'] }, () => {
            for (const template of MessageModel.templates) upsert(`${MENU}-${template.id}`, { parentId: MENU, title: `发送为${template.label}`, contexts: ['selection'] });
        });
    }
    chrome.runtime.onInstalled.addListener(ensureMenu);
    chrome.runtime.onStartup.addListener(ensureMenu);
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        const templateId = info.menuItemId === MENU ? 'custom' : String(info.menuItemId).replace(`${MENU}-`, '');
        if (!MessageModel.templates.some(t => t.id === templateId) || !info.selectionText?.trim()) return;
        const id = crypto.randomUUID();
        try {
            await chrome.storage.local.set({ [`NJU_MESSAGE_DRAFT_${id}`]: {
                id, ...MessageModel.render(templateId, info.selectionText), text: info.selectionText, formatVersion: 2, templateId, originalText: info.selectionText,
                scheduleMode: 'immediate', scheduledAt: null,
                // Kept locally; sent only after the user enables the source-link switch.
                sourceUrl: MessageModel.sourceLink(info.pageUrl || tab?.url), includeSource: false,
                createdAt: Date.now(), updatedAt: Date.now()
            } });
            await chrome.tabs.create({ url: chrome.runtime.getURL(`message/compose.html?draftId=${id}`) });
        } catch (_) {
            await chrome.tabs.create({ url: chrome.runtime.getURL('message/compose.html?error=draft') });
        }
    });
})();
