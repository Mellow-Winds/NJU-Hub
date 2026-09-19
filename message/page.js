(() => {
    async function theme() {
        const data = await chrome.storage.sync.get(['ui_theme_color', 'ui_theme_mode', 'ui_material_mode', 'ui_font_family']);
        const color = /^#[a-f\d]{6}$/i.test(data.ui_theme_color || '') ? data.ui_theme_color : '#0ea5e9';
        const dark = data.ui_theme_mode === 'dark' && (!data.ui_material_mode || data.ui_material_mode === 'default');
        globalThis.MaterialColorUtils?.applyTheme(color, dark);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        document.documentElement.dataset.font = data.ui_font_family || 'google-sans-flex';
    }
    theme().catch(() => {});
    chrome.storage.onChanged.addListener((_, area) => { if (area === 'sync') theme().catch(() => {}); });
    window.messageStatus = (text, error = false) => {
        const status = document.getElementById('status');
        status.textContent = text;
        status.classList.toggle('error', error);
    };
    window.messageSend = async payload => {
        const result = await chrome.runtime.sendMessage({ action: 'sendResendEmail', payload });
        if (!result?.ok) throw new Error(result?.error || '未收到后台结果，请保持原内容重试或到 Resend 控制台核实。');
        return result;
    };
    window.messageResult = result => `${result.scheduledAt ? '已提交预约：' + new Date(result.scheduledAt).toLocaleString() : 'Resend 已接收发送请求。'}\n邮件 ID：${result.id}\n实际投递请查看邮箱或 Resend 控制台。`;
})();
