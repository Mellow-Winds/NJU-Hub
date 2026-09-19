(() => {
    const fields = document.getElementById('fields');
    const form = document.getElementById('settings-form');
    const api = document.getElementById('api-key');
    const email = document.getElementById('self-email');
    const name = document.getElementById('from-name');
    const nickname = document.getElementById('nickname');
    let testId = sessionStorage.getItem('nju-message-test-id');
    if (!testId) { testId = crypto.randomUUID(); sessionStorage.setItem('nju-message-test-id', testId); }
    async function save() {
        // Store only on this browser; never sync credentials to a browser account.
        if (!api.value.trim() || /\s/.test(api.value.trim())) throw new Error('请填写有效的 API Key。');
        if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email.value.trim())) throw new Error('请填写一个有效的 Resend 注册邮箱。');
        if (/[<>\r\n\x00-\x1f]/.test(name.value)) throw new Error('显示名不能包含尖括号或换行。');
        await chrome.storage.local.set({ resend_api_key: api.value.trim(), resend_self_email: email.value.trim(), resend_from_name: name.value.trim(), resend_nickname: nickname.value.trim().slice(0, 80) });
    }
    async function run(test) {
        if (!form.reportValidity()) return;
        fields.disabled = true;
        try {
            if (!await messageConsent()) { location.href = '../options/options.html'; return; }
            await save();
            messageStatus(test ? '正在发送测试邮件…' : '配置已保存。');
            if (test) {
                const result = await messageSend({ requestId: testId, subject: 'NJU-Hub 消息订阅测试', text: '这是一封来自 NJU-Hub 的测试邮件。', presentation: { templateId: 'custom', nickname: nickname.value } });
                messageStatus(messageResult(result));
                testId = crypto.randomUUID();
                sessionStorage.setItem('nju-message-test-id', testId);
            }
        } catch (error) { messageStatus(error.message, true); }
        finally { fields.disabled = false; }
    }
    form.addEventListener('submit', event => { event.preventDefault(); run(false); });
    document.getElementById('test-send').addEventListener('click', () => run(true));
    document.getElementById('review-consent').addEventListener('click', () => messageConsent(true).catch(error => messageStatus(error.message, true)));
    async function renderDrafts() {
        const data = await chrome.storage.local.get(null);
        const list = document.getElementById('draft-list');
        const drafts = Object.entries(data).filter(([key, value]) => key.startsWith('NJU_MESSAGE_DRAFT_') && value && !data[`NJU_MESSAGE_ATTEMPT_${key.slice('NJU_MESSAGE_DRAFT_'.length)}`]?.result).sort((a, b) => (b[1].updatedAt || b[1].createdAt || 0) - (a[1].updatedAt || a[1].createdAt || 0));
        list.replaceChildren();
        if (!drafts.length) { list.textContent = '暂无未发送草稿'; return; }
        for (const [key, draft] of drafts) {
            const id = key.slice('NJU_MESSAGE_DRAFT_'.length);
            if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) continue;
            const row = document.createElement('article'); row.className = 'draft-row';
            const heading = document.createElement('h3'); heading.textContent = draft.subject || '未命名消息';
            const meta = document.createElement('p'); meta.className = 'hint-text';
            meta.textContent = `${MessageModel.templates.find(t => t.id === draft.templateId)?.label || '自定义消息'} · ${new Date(draft.updatedAt || draft.createdAt || Date.now()).toLocaleString()}${draft.sourceTitle ? ` · ${draft.sourceTitle}` : ''}`;
            const actions = document.createElement('div'); actions.className = 'actions';
            const resume = document.createElement('a'); resume.className = 'message-pill'; resume.textContent = '继续编辑'; resume.href = `compose.html?draftId=${encodeURIComponent(id)}`;
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除草稿';
            remove.addEventListener('click', async () => {
                if (!window.confirm(`删除草稿“${draft.subject || '未命名消息'}”？删除后无法恢复；不会取消已提交给 Resend 的邮件。`)) return;
                remove.disabled = true;
                try { await chrome.storage.local.remove(key); await renderDrafts(); }
                catch (_) { remove.disabled = false; messageStatus('草稿删除失败，请重试。', true); }
            });
            actions.append(resume, remove); row.append(heading, meta, actions); list.append(row);
        }
    }
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && Object.keys(changes).some(k => k.startsWith('NJU_MESSAGE_DRAFT_') || k.startsWith('NJU_MESSAGE_ATTEMPT_'))) renderDrafts().catch(() => messageStatus('草稿列表读取失败。', true));
    });
    (async () => {
        if (!await messageConsent()) { location.href = '../options/options.html'; return; }
        const data = await chrome.storage.local.get(['resend_api_key', 'resend_self_email', 'resend_from_name', 'resend_nickname']);
        api.value = data.resend_api_key || '';
        email.value = data.resend_self_email || '';
        name.value = data.resend_from_name ?? 'NJU-Hub 消息订阅';
        nickname.value = data.resend_nickname || '';
        messageRefreshFields();
        fields.disabled = false;
        await renderDrafts();
    })().catch(() => messageStatus('读取配置失败，请重新加载插件后重试。', true));
})();
