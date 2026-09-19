(() => {
    const fields = document.getElementById('fields');
    const form = document.getElementById('compose-form');
    const subject = document.getElementById('subject');
    const text = document.getElementById('text');
    const time = document.getElementById('scheduled-at');
    const id = new URLSearchParams(location.search).get('draftId');
    const key = `NJU_MESSAGE_DRAFT_${id}`;
    let draft, busy = false, saveQueue = Promise.resolve();
    function saveDraft() {
        Object.assign(draft, { subject: subject.value, text: text.value, localTime: time.value });
        const snapshot = { ...draft };
        saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set({ [key]: snapshot }));
        return saveQueue;
    }
    async function updateEmail() {
        const data = await chrome.storage.local.get('resend_self_email');
        document.getElementById('self-email').textContent = data.resend_self_email || '尚未配置，请先打开消息订阅设置';
    }
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.resend_self_email) updateEmail().catch(() => messageStatus('邮箱读取失败。', true));
    });
    form.addEventListener('input', () => {
        if (draft && !busy) saveDraft().catch(() => messageStatus('草稿保存失败，请勿关闭此页。', true));
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !draft || !form.reportValidity()) return;
        busy = true; fields.disabled = true;
        let submitted = false;
        try {
            await saveDraft();
            const scheduledAt = time.value ? new Date(time.value).toISOString() : null;
            messageStatus('正在提交…');
            const result = await messageSend({ requestId: id, subject: subject.value, text: text.value, scheduledAt });
            submitted = true;
            messageStatus(messageResult(result));
            document.getElementById('send').textContent = '已提交';
            try { await chrome.storage.local.remove(key); }
            catch (_) { messageStatus(messageResult(result) + '\n本地草稿清理失败，请勿重复发送。', true); }
        } catch (error) { messageStatus(error.message, true); }
        finally { if (!submitted) { fields.disabled = false; busy = false; } }
    });
    (async () => {
        await updateEmail();
        if (!id || !/^[a-zA-Z0-9-]{16,80}$/.test(id)) throw new Error('未找到草稿，请选中文字后从右键菜单重新进入。');
        const data = await chrome.storage.local.get([key, `NJU_MESSAGE_ATTEMPT_${id}`]);
        const receipt = data[`NJU_MESSAGE_ATTEMPT_${id}`];
        if (receipt?.result) { messageStatus(messageResult(receipt.result)); return; }
        draft = data[key];
        if (!draft) throw new Error('草稿不存在或已发送，请从右键菜单重新进入。');
        subject.value = draft.subject;
        text.value = draft.text;
        time.value = draft.localTime || '';
        document.getElementById('source').textContent = draft.sourceTitle ? `来自：${draft.sourceTitle}` : '';
        fields.disabled = false;
        if (receipt) messageStatus('上次发送状态未确认，请保持原内容重试，或先到 Resend 控制台核实。', true);
    })().catch(error => messageStatus(error.message, true));
})();
