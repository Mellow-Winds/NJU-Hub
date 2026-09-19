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
    // Operation results are presented by the shared non-blocking notice only.
    window.messageStatus = () => {};
    window.messageSend = async payload => {
        const result = await chrome.runtime.sendMessage({ action: 'sendResendEmail', payload });
        if (!result?.ok) throw new Error(result?.error || '未收到后台结果，请保持原内容重试或到 Resend 控制台核实。');
        return result;
    };
    window.messageResult = result => `${result.scheduledAt ? '已提交预约：' + new Date(result.scheduledAt).toLocaleString() : 'Resend 已接收发送请求。'}\n邮件 ID：${result.id}\n实际投递请查看邮箱或 Resend 控制台。`;

    const closeDialog = (dialog, done) => {
        let closed = false;
        const finish = () => {
            if (closed) return;
            closed = true;
            dialog.removeEventListener('animationend', onAnimationEnd);
            dialog.close();
            dialog.remove();
            done();
        };
        const onAnimationEnd = event => { if (event.target === dialog) finish(); };
        if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return finish();
        dialog.classList.add('closing');
        dialog.addEventListener('animationend', onAnimationEnd);
        setTimeout(finish, 240);
    };

    window.messageConfirm = ({ title, message, confirmText = '确定', cancelText = '取消', dangerous = false }) => new Promise(resolve => {
        const previousFocus = document.activeElement;
        const dialog = document.createElement('dialog');
        dialog.className = 'message-dialog message-confirm-dialog';
        dialog.setAttribute('aria-labelledby', 'message-confirm-title');
        const heading = document.createElement('h2');
        heading.id = 'message-confirm-title';
        heading.textContent = title;
        const body = document.createElement('p');
        body.textContent = message;
        const actions = document.createElement('div');
        actions.className = 'actions';
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'btn-small ripple-container'; cancel.dataset.njuRipple = '';
        cancel.textContent = cancelText;
        const accept = document.createElement('button');
        accept.type = 'button'; accept.className = `${dangerous ? 'btn-small' : 'btn-save'} ripple-container`; accept.dataset.njuRipple = '';
        accept.textContent = confirmText;
        if (cancelText) actions.append(cancel);
        actions.append(accept); dialog.append(heading, body, actions); document.body.append(dialog);
        globalThis.NjuRipple?.attachAll(dialog);
        let result = false;
        const finish = value => { result = value; closeDialog(dialog, () => { previousFocus?.focus(); resolve(result); }); };
        cancel.addEventListener('click', () => finish(false));
        accept.addEventListener('click', () => finish(true));
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
        dialog.showModal(); accept.focus();
    });

    let noticeSequence = 0;
    window.messageNotice = (title, message, error = false) => {
        let root = document.getElementById('message-notice-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'message-notice-root';
            root.setAttribute('aria-live', error ? 'assertive' : 'polite');
            document.body.append(root);
        }
        const noticeKey = `${error ? 'error' : 'info'}\u0000${title}\u0000${message}`;
        const duplicate = Array.from(root.children).find(item => item._messageNoticeKey === noticeKey && !item.classList.contains('hide'));
        if (duplicate) return Promise.resolve();
        const notice = document.createElement('div');
        notice.className = `message-toast${error ? ' error' : ''}`;
        notice._messageNoticeKey = noticeKey;
        notice.dataset.noticeId = String(++noticeSequence);
        notice.setAttribute('role', error ? 'alert' : 'status');
        const dot = document.createElement('span'); dot.className = 'message-toast-dot'; dot.setAttribute('aria-hidden', 'true');
        const copy = document.createElement('div');
        const heading = document.createElement('strong'); heading.textContent = title;
        const body = document.createElement('span'); body.textContent = message;
        copy.append(heading, body); notice.append(dot, copy); root.append(notice);
        while (root.children.length > 3) root.firstElementChild?.remove();
        requestAnimationFrame(() => notice.classList.add('show'));
        const dismiss = () => {
            if (!notice.isConnected || notice.classList.contains('hide')) return;
            notice.classList.remove('show'); notice.classList.add('hide');
            setTimeout(() => notice.remove(), 240);
        };
        setTimeout(dismiss, error ? 6500 : 4200);
        return Promise.resolve();
    };

    window.messageFields = () => {
        document.querySelectorAll('.message-field').forEach(label => {
            const input = label.querySelector('input, textarea');
            const sync = () => label.classList.toggle('has-value', Boolean(input.value));
            input.addEventListener('input', sync);
            input.addEventListener('change', sync);
            sync();
        });
    };
    window.messageRefreshFields = () => document.querySelectorAll('.message-field').forEach(label => label.classList.toggle('has-value', Boolean(label.querySelector('input, textarea').value)));
    messageFields();

    let consentPending;
    window.messageConsent = async (review = false) => {
        if (consentPending) return consentPending;
        const data = await chrome.storage.local.get(['NJU_MESSAGE_CONSENT_VERSION', 'NJU_MESSAGE_PAUSED']);
        if (!review && data.NJU_MESSAGE_CONSENT_VERSION === MessageModel.consentVersion && data.NJU_MESSAGE_PAUSED !== true) return true;
        consentPending = new Promise(resolve => {
            const previousFocus = document.activeElement;
            const dialog = document.createElement('dialog'); dialog.className = 'message-dialog';
            dialog.setAttribute('aria-labelledby', 'consent-title');
            dialog.innerHTML = `<h2 id="consent-title">开始使用消息订阅</h2>
                <ol><li>用自己的个人邮箱注册 <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer">Resend</a>，创建有发送权限的 API Key。</li><li>填写密钥和同一注册邮箱，发送测试邮件。</li><li>选中文字 → 右键选择模板 → 编辑、预览并发送给自己。</li></ol>
                <p class="mail-warning">请勿使用学校 edu.cn 邮箱注册 Resend 或收信，邮件可能被拒收或退回。建议使用自己的 QQ 邮箱或其他个人邮箱。</p>
                <h3>服务与隐私</h3><p>邮件投递和预约由 Resend 提供，受其服务可用性、额度和收件方策略影响。NJU-Hub 不保证准时送达，重要 DDL 请同时保留其他提醒。</p>
                <p>API Key 仅保存在本地浏览器；发送时直接提交给 Resend 鉴权。主题、正文、称呼、DDL、本人邮箱和预约时间也会交给 Resend 处理，不经过 NJU-Hub 服务器。草稿及来源链接保存在本地；只有开启“附上来源链接”才会将链接加入邮件，链接可能包含私密参数。</p>
                <p>只支持发送给自己，收件邮箱必须与 Resend 注册邮箱一致。发件人固定为 onboarding@resend.dev，无需验证域名。当前不支持发送给他人。</p>
                <p id="consent-error" class="mail-warning" role="alert"></p>
                <div class="actions"><button class="btn-small ripple-container" data-nju-ripple type="button" id="consent-decline">暂不使用</button><button class="btn-save ripple-container" data-nju-ripple type="button" id="consent-accept">已阅读并同意</button></div>`;
            document.body.append(dialog);
            globalThis.NjuRipple?.attachAll(dialog);
            const accept = dialog.querySelector('#consent-accept');
            let saving = false;
            const finish = value => closeDialog(dialog, () => { consentPending = null; previousFocus?.focus(); resolve(value); });
            accept.addEventListener('click', async () => {
                if (saving) return;
                saving = true; accept.disabled = true;
                try {
                    await chrome.storage.local.set({ NJU_MESSAGE_CONSENT_VERSION: MessageModel.consentVersion, NJU_MESSAGE_CONSENT_AT: Date.now(), NJU_MESSAGE_PAUSED: false });
                    finish(true);
                } catch (_) { dialog.querySelector('#consent-error').textContent = '同意状态保存失败，请重试。'; saving = false; accept.disabled = false; }
            });
            const pause = async () => {
                if (saving) return;
                saving = true; accept.disabled = true;
                try { await chrome.storage.local.set({ NJU_MESSAGE_PAUSED: true }); finish(false); }
                catch (_) { dialog.querySelector('#consent-error').textContent = '暂停状态保存失败，请重试。'; saving = false; accept.disabled = false; }
            };
            dialog.querySelector('#consent-decline').addEventListener('click', pause);
            dialog.addEventListener('cancel', e => { e.preventDefault(); pause(); });
            dialog.showModal(); accept.focus();
        });
        return consentPending;
    };
})();
