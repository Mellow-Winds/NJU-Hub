(() => {
    const fields = document.getElementById('fields');
    const form = document.getElementById('settings-form');
    const api = document.getElementById('api-key');
    const email = document.getElementById('self-email');
    const name = document.getElementById('from-name');
    let testId = sessionStorage.getItem('nju-message-test-id');
    if (!testId) { testId = crypto.randomUUID(); sessionStorage.setItem('nju-message-test-id', testId); }
    async function save() {
        // Store only on this browser; never sync credentials to a browser account.
        if (!api.value.trim() || /\s/.test(api.value.trim())) throw new Error('请填写有效的 API Key。');
        if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email.value.trim())) throw new Error('请填写一个有效的 Resend 注册邮箱。');
        if (/[<>\r\n\x00-\x1f]/.test(name.value)) throw new Error('显示名不能包含尖括号或换行。');
        await chrome.storage.local.set({ resend_api_key: api.value.trim(), resend_self_email: email.value.trim(), resend_from_name: name.value.trim() });
    }
    async function run(test) {
        if (!form.reportValidity()) return;
        fields.disabled = true;
        try {
            await save();
            messageStatus(test ? '正在发送测试邮件…' : '配置已保存。');
            if (test) {
                const result = await messageSend({ requestId: testId, subject: 'NJU-Hub 消息订阅测试', text: '这是一封来自 NJU-Hub 的测试邮件。' });
                messageStatus(messageResult(result));
                testId = crypto.randomUUID();
                sessionStorage.setItem('nju-message-test-id', testId);
            }
        } catch (error) { messageStatus(error.message, true); }
        finally { fields.disabled = false; }
    }
    form.addEventListener('submit', event => { event.preventDefault(); run(false); });
    document.getElementById('test-send').addEventListener('click', () => run(true));
    chrome.storage.local.get(['resend_api_key', 'resend_self_email', 'resend_from_name']).then(data => {
        api.value = data.resend_api_key || '';
        email.value = data.resend_self_email || '';
        name.value = data.resend_from_name ?? 'NJU-Hub 消息订阅';
        fields.disabled = false;
    }).catch(() => messageStatus('读取配置失败，请重新加载插件后重试。', true));
})();
