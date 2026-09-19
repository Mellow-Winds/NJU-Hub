(() => {
    const fields = document.getElementById('fields');
    const form = document.getElementById('compose-form');
    const subject = document.getElementById('subject');
    const text = document.getElementById('text');
    const template = document.getElementById('template');
    const templateButtons = document.getElementById('template-buttons');
    const color = document.getElementById('content-color');
    const includeSource = document.getElementById('include-source');
    const ddlMonth = document.getElementById('ddl-month'), ddlDay = document.getElementById('ddl-day');
    const ddlHour = document.getElementById('ddl-hour'), ddlMinute = document.getElementById('ddl-minute');
    let defaultNickname = '同学', ddlRefresh = [];
    const month = document.getElementById('month'), day = document.getElementById('day');
    const hour = document.getElementById('hour'), minute = document.getElementById('minute');
    const presets = Array.from(document.querySelectorAll('[data-time]'));
    const id = new URLSearchParams(location.search).get('draftId');
    const key = `NJU_MESSAGE_DRAFT_${id}`;
    let draft, busy = false, submitted = false, saveQueue = Promise.resolve(), timer, receipt;
    let refreshSelects = [];
    const pad = n => String(n).padStart(2, '0');
    function presentation() {
        return { templateId: template.value, nickname: draft.nickname, color: color.value, bold: draft.bold !== false, card: draft.card !== false,
            deadline: draft.deadline || '', deadlineZone: draft.deadlineZone || '', includeSource: includeSource.checked,
            sourceUrl: includeSource.checked ? draft.sourceUrl : '' };
    }
    function presentationState() {
        document.getElementById('presentation-controls').hidden = draft.formatVersion !== 2;
        document.getElementById('deadline-fields').hidden = !MessageModel.templates.find(t => t.id === template.value)?.hasDeadline;
        for (const prop of ['bold', 'card']) document.getElementById(`content-${prop}`).setAttribute('aria-pressed', String(draft[prop] !== false));
    }
    function ddlDays() {
        const [y, m] = ddlMonth.value.split('-').map(Number);
        const count = new Date(y, m, 0).getDate();
        options(ddlDay, Array.from({ length: count }, (_, i) => [i + 1, `${i + 1} 日`]), Math.min(Number(ddlDay.value) || 1, count));
    }
    function setupDeadline() {
        const now = new Date();
        const initial = draft.deadline || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`;
        const [date, time] = initial.split('T'), [y, m, d] = date.split('-'), [h, min] = time.split(':');
        const months = Array.from({ length: 24 }, (_, i) => { const day = new Date(now.getFullYear(), now.getMonth() + i, 1); return [`${day.getFullYear()}-${pad(day.getMonth() + 1)}`, `${day.getFullYear()} 年 ${day.getMonth() + 1} 月`]; });
        if (!months.some(([v]) => v === `${y}-${m}`)) months.unshift([`${y}-${m}`, `${y} 年 ${Number(m)} 月`]);
        options(ddlMonth, months, `${y}-${m}`); ddlDays(); ddlDay.value = String(Number(d));
        options(ddlHour, Array.from({ length: 24 }, (_, i) => [i, `${pad(i)} 时`]), Number(h));
        options(ddlMinute, Array.from({ length: 60 }, (_, i) => [i, `${pad(i)} 分`]), Number(min));
        ddlRefresh = [ddlMonth, ddlDay, ddlHour, ddlMinute].map(select => {
            const instance = NjuDropdown.fromSelect(select, () => select.dispatchEvent(new Event('change', { bubbles: true })));
            return () => instance.refresh ? instance.refresh(select) : instance.setValue(select.value, true);
        });
    }
    function options(select, items, value) {
        select.replaceChildren(...items.map(([v, label]) => { const option = document.createElement('option'); option.value = String(v); option.textContent = label; return option; }));
        select.value = String(value);
    }
    function syncTemplateButtons() {
        templateButtons?.querySelectorAll('[data-template]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.template === template.value));
        });
    }
    function renderTemplateButtons() {
        if (!templateButtons) return;
        templateButtons.replaceChildren();
        MessageModel.templates.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.template = item.id;
            button.textContent = item.label;
            button.setAttribute('aria-pressed', String(item.id === template.value));
            button.addEventListener('click', () => {
                template.value = item.id;
                template.dispatchEvent(new Event('change', { bubbles: true }));
            });
            templateButtons.append(button);
        });
    }
    function updateDays() {
        const [y, m] = month.value.split('-').map(Number);
        const count = new Date(y, m, 0).getDate();
        options(day, Array.from({ length: count }, (_, i) => [i + 1, `${i + 1} 日`]), Math.min(Number(day.value) || 1, count));
    }
    function setupTime() {
        const saved = draft.customTime || {};
        const initial = new Date(draft.scheduledAt || Date.now() + 3600000);
        const start = new Date(); start.setDate(1);
        const months = Array.from({ length: 2 }, (_, i) => { const d = new Date(start.getFullYear(), start.getMonth() + i, 1); return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}`, `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`]; });
        const selectedMonth = saved.month || `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}`;
        if (!months.some(([v]) => v === selectedMonth)) months.unshift([selectedMonth, `${selectedMonth}（草稿日期）`]);
        options(month, months, selectedMonth); updateDays(); day.value = String(saved.day || initial.getDate());
        options(hour, Array.from({ length: 24 }, (_, i) => [i, `${pad(i)} 时`]), saved.hour ?? initial.getHours());
        options(minute, Array.from({ length: 60 }, (_, i) => [i, `${pad(i)} 分`]), saved.minute ?? initial.getMinutes());
    }
    function timeState() {
        const mode = draft.scheduleMode || 'immediate';
        document.getElementById('custom-time').hidden = mode !== 'custom';
        presets.forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.time === mode));
            if (button.dataset.time === 'custom') button.setAttribute('aria-expanded', String(mode === 'custom'));
        });
    }
    function readCustom() {
        draft.customTime = { month: month.value, day: day.value, hour: hour.value, minute: minute.value };
        try { draft.scheduledAt = MessageModel.customTime(month.value, day.value, hour.value, minute.value); }
        catch (_) { draft.scheduledAt = 'invalid'; }
    }
    function preview() {
        document.getElementById('deadline-status').textContent = draft.deadline ? `截止日期：${draft.deadline.replace('T', ' ')}（${draft.deadlineZone || '本机时区'}）` : '未设置截止日期；DDL 与发送时间独立。';
        document.getElementById('preview-subject').textContent = subject.value || '未填写主题';
        if (draft?.formatVersion === 2) {
            // Only our escaped renderer produces HTML; no raw user HTML is inserted.
            document.getElementById('preview-text').innerHTML = MessageModel.email({ ...presentation(), text: text.value }).html;
        } else document.getElementById('preview-text').textContent = text.value || '未填写内容';
        let error = '', label = '立即发送';
        try {
            if (draft?.scheduleMode !== 'immediate' && draft?.scheduledAt) {
                if (!receipt) MessageModel.validateTime(draft.scheduledAt);
                label = `预计发送：${new Date(draft.scheduledAt).toLocaleString()}（本机时区）`;
            }
        } catch (e) { error = e.message; label = '时间无效'; }
        document.getElementById('preview-time').textContent = label;
        document.getElementById('time-error').textContent = error;
        messageRefreshFields();
    }
    function saveDraft() {
        clearTimeout(timer);
        if (!draft || submitted) return saveQueue;
        Object.assign(draft, { subject: subject.value, text: text.value, updatedAt: Date.now() });
        if (draft.formatVersion === 2) Object.assign(draft, { color: color.value, includeSource: includeSource.checked });
        const snapshot = structuredClone(draft);
        document.getElementById('draft-status').textContent = '正在保存…';
        saveQueue = saveQueue.catch(() => {}).then(async () => {
            await chrome.storage.local.set({ [key]: snapshot });
            document.getElementById('draft-status').textContent = '草稿已保存';
        });
        return saveQueue;
    }
    const saveError = () => { document.getElementById('draft-status').textContent = '草稿保存失败，请勿关闭此页。'; };
    async function updateEmail() {
        const data = await chrome.storage.local.get(['resend_self_email', 'resend_from_name', 'resend_api_key', 'resend_nickname']);
        defaultNickname = data.resend_nickname || '同学';
        document.getElementById('self-email').textContent = data.resend_self_email || '尚未配置，请先打开消息订阅设置';
        document.getElementById('preview-to').textContent = data.resend_self_email || '尚未配置自己的邮箱';
        document.getElementById('preview-from').textContent = `${data.resend_from_name || 'NJU-Hub 消息订阅'} <onboarding@resend.dev>`;
        document.getElementById('preview-config').textContent = !data.resend_api_key ? '尚未配置 API Key，请先打开消息订阅设置。' : '';
    }
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && Object.keys(changes).some(k => k.startsWith('resend_'))) updateEmail().catch(() => messageStatus('配置读取失败。', true));
    });
    form.addEventListener('input', () => {
        if (draft && !busy) { preview(); clearTimeout(timer); document.getElementById('draft-status').textContent = '正在保存…'; timer = setTimeout(() => saveDraft().catch(saveError), 300); }
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && draft && !busy) saveDraft().catch(saveError); });
    window.addEventListener('pagehide', () => { if (draft && !busy) saveDraft().catch(saveError); });
    template.addEventListener('change', () => {
        if (!draft || busy) return;
        const previous = draft.templateId || 'custom';
        const original = MessageModel.render(previous, draft.originalText ?? draft.text);
        if (draft.formatVersion === 2) original.text = draft.originalText;
        if ((subject.value !== original.subject || text.value !== original.text) && !window.confirm('切换模板将替换当前标题和正文，是否继续？')) { template.value = previous; syncTemplateButtons(); return; }
        draft.templateId = template.value;
        const rendered = MessageModel.render(template.value, draft.originalText ?? draft.text);
        subject.value = rendered.subject; text.value = draft.formatVersion === 2 ? draft.originalText : rendered.text;
        color.value = MessageModel.templates.find(t => t.id === template.value).color;
        presentationState();
        syncTemplateButtons(); preview(); saveDraft().catch(saveError);
    });
    for (const prop of ['bold', 'card']) document.getElementById(`content-${prop}`).addEventListener('click', () => {
        if (!draft || busy) return;
        draft[prop] = draft[prop] === false; presentationState(); preview(); saveDraft().catch(saveError);
    });
    [color, includeSource].forEach(input => input.addEventListener('change', () => { if (draft && !busy) { preview(); saveDraft().catch(saveError); } }));
    [ddlMonth, ddlDay, ddlHour, ddlMinute].forEach(select => select.addEventListener('change', () => {
        if (!draft || busy) return;
        if (select === ddlMonth) ddlDays();
        draft.deadline = `${ddlMonth.value}-${pad(ddlDay.value)}T${pad(ddlHour.value)}:${pad(ddlMinute.value)}`;
        draft.deadlineZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        ddlRefresh.forEach(fn => fn()); preview(); saveDraft().catch(saveError);
    }));
    document.getElementById('clear-deadline').addEventListener('click', () => {
        if (!draft || busy) return; draft.deadline = ''; preview(); saveDraft().catch(saveError);
    });
    document.getElementById('apply-deadline').addEventListener('click', () => {
        ddlMinute.dispatchEvent(new Event('change', { bubbles: true }));
    });
    presets.forEach(button => button.addEventListener('click', () => {
        if (!draft || busy) return;
        draft.scheduleMode = button.dataset.time;
        if (draft.scheduleMode === 'custom') readCustom();
        else draft.scheduledAt = draft.scheduleMode === 'immediate' ? null : new Date(Date.now() + Number(draft.scheduleMode) * 3600000).toISOString();
        timeState(); preview(); saveDraft().catch(saveError);
    }));
    [month, day, hour, minute].forEach(select => select.addEventListener('change', () => {
        if (!draft || busy) return;
        if (select === month) updateDays();
        readCustom(); refreshSelects.forEach(fn => fn()); preview(); saveDraft().catch(saveError);
    }));
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !draft || !form.reportValidity()) return;
        busy = true; fields.disabled = true;
        try {
            if (!await messageConsent()) { location.href = '../options/options.html'; return; }
            await saveDraft();
            const scheduledAt = draft.scheduledAt || null;
            if (!receipt) MessageModel.validateTime(scheduledAt);
            messageStatus('正在提交…');
            const payload = { requestId: id, subject: subject.value, text: text.value, scheduledAt };
            if (draft.formatVersion === 2) payload.presentation = presentation();
            const result = await messageSend(payload);
            submitted = true;
            messageStatus(messageResult(result));
            document.getElementById('send').textContent = '已提交';
            document.getElementById('draft-status').textContent = '已提交，草稿已结束';
            try { await chrome.storage.local.remove(key); }
            catch (_) { messageStatus(messageResult(result) + '\n本地草稿清理失败，请勿重复发送。', true); }
        } catch (error) {
            messageStatus(error.message, true);
            const data = await chrome.storage.local.get(`NJU_MESSAGE_ATTEMPT_${id}`).catch(() => ({}));
            receipt = data[`NJU_MESSAGE_ATTEMPT_${id}`];
        }
        finally { if (!submitted) { fields.disabled = false; busy = false; } }
    });
    (async () => {
        if (!await messageConsent()) { location.href = '../options/options.html'; return; }
        await updateEmail();
        if (!id || !/^[a-zA-Z0-9-]{16,80}$/.test(id)) throw new Error('未找到草稿，请选中文字后从右键菜单重新进入。');
        const data = await chrome.storage.local.get([key, `NJU_MESSAGE_ATTEMPT_${id}`]);
        receipt = data[`NJU_MESSAGE_ATTEMPT_${id}`];
        if (receipt?.result) { messageStatus(messageResult(receipt.result)); return; }
        draft = data[key];
        if (!draft) throw new Error('草稿不存在或已发送，请从右键菜单重新进入。');
        subject.value = draft.subject;
        text.value = draft.text;
        draft.originalText ??= draft.text;
        // Upgrade only untouched legacy bodies; uncertain attempts keep their exact payload.
        if (!receipt && !draft.formatVersion) {
            const previous = MessageModel.render(draft.templateId || 'custom', draft.originalText);
            if (draft.text === previous.text) { draft.formatVersion = 2; text.value = draft.originalText; }
        }
        draft.nickname ??= defaultNickname;
        color.value = draft.color || MessageModel.templates.find(t => t.id === draft.templateId)?.color || '#475569';
        includeSource.checked = Boolean(draft.includeSource && MessageModel.sourceLink(draft.sourceUrl));
        includeSource.disabled = !MessageModel.sourceLink(draft.sourceUrl);
        document.getElementById('source-link-hint').textContent = draft.sourceUrl || '此草稿没有来源链接';
        // Read existing v1 drafts without rewriting their message or silently moving the time.
        if (!draft.scheduleMode) { draft.scheduleMode = draft.localTime ? 'custom' : 'immediate'; draft.scheduledAt = draft.localTime ? new Date(draft.localTime).toISOString() : null; }
        options(template, MessageModel.templates.map(t => [t.id, t.label]), draft.templateId || 'custom');
        renderTemplateButtons();
        presentationState(); setupDeadline();
        setupTime(); timeState(); preview();
        refreshSelects = [month, day, hour, minute].map(select => {
            const instance = NjuDropdown.fromSelect(select, () => select.dispatchEvent(new Event('change', { bubbles: true })));
            return () => instance.refresh ? instance.refresh(select) : instance.setValue(select.value, true);
        });
        document.getElementById('source').textContent = draft.sourceTitle ? `来自：${draft.sourceTitle}` : '';
        fields.disabled = false;
        if (receipt) messageStatus('上次发送状态未确认，请保持原内容重试，或先到 Resend 控制台核实。', true);
    })().catch(error => messageStatus(error.message, true));
})();
