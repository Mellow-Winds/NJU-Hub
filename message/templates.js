(() => {
    'use strict';
    const templates = [
        { id: 'custom', label: '自定义消息', heading: 'NJU-Hub 消息', intro: '', outro: '' },
        { id: 'homework', label: '作业', heading: '作业提醒', intro: '亲爱的同学：\n\n您有一项作业需要关注：\n\n', outro: '\n\n请及时查看并安排时间完成。' },
        { id: 'notice', label: '通知', heading: '通知', intro: '通知内容：\n\n', outro: '\n\n请及时查看。' },
        { id: 'exam', label: '考试 / 测验', heading: '考试 / 测验提醒', intro: '考试或测验提醒：\n\n', outro: '\n\n请提前安排复习和准备时间。' },
        { id: 'activity', label: '课程 / 活动', heading: '课程 / 活动提醒', intro: '课程或活动信息：\n\n', outro: '\n\n请根据需要提前安排时间。' },
        { id: 'todo', label: '待办事项', heading: '待办事项', intro: '待办事项：\n\n', outro: '\n\n请及时处理。' }
    ];
    function render(id, content = '') {
        const item = templates.find(t => t.id === id) || templates[0];
        const summary = content.replace(/\s+/g, ' ').trim().slice(0, 60);
        return {
            subject: item.heading + (item.id !== 'custom' && summary ? `：${summary}` : ''),
            text: item.intro + content + item.outro + (item.id === 'custom' ? '' : '\n\n——来自 NJU-Hub 消息订阅')
        };
    }
    function validateTime(value, now = Date.now()) {
        if (!value) return null;
        const date = new Date(value), delay = date.getTime() - now;
        if (!Number.isFinite(delay) || delay <= 0 || delay > 30 * 86400000) throw new Error('预约时间须在未来 30 天内，请重新选择。');
        return date.toISOString();
    }
    function customTime(month, day, hour, minute) {
        const [year, m] = month.split('-').map(Number);
        const d = new Date(year, m - 1, Number(day), Number(hour), Number(minute));
        // Reject calendar rollover and nonexistent local times (e.g. DST jumps).
        if (d.getFullYear() !== year || d.getMonth() !== m - 1 || d.getDate() !== Number(day) || d.getHours() !== Number(hour) || d.getMinutes() !== Number(minute)) throw new Error('请选择有效的日期和时间。');
        return d.toISOString();
    }
    const footer = '——来自 NJU-Hub 消息订阅';
    const colors = ['#475569', '#7c3aed', '#0369a1', '#b91c1c', '#047857', '#b45309'];
    templates.forEach((item, index) => { item.color = colors[index]; item.hasDeadline = ['homework', 'exam', 'activity', 'todo'].includes(item.id); });
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function sourceLink(value) {
        try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
        catch (_) { return ''; }
    }
    function email(model) {
        const item = templates.find(t => t.id === model.templateId) || templates[0];
        const color = /^#[a-f\d]{6}$/i.test(model.color || '') ? model.color : item.color;
        const nickname = String(model.nickname || '同学').trim().slice(0, 80) || '同学';
        const content = String(model.text || '');
        const intro = item.id === 'custom' ? '' : item.id === 'homework' ? '您有一项作业需要关注：' : item.intro.trim();
        const greeting = `亲爱的${nickname}：`;
        let deadline = '';
        if (item.hasDeadline && model.deadline) {
            if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(model.deadline)) throw new Error('请选择有效的 DDL 日期。');
            const [date, time] = model.deadline.split('T');
            const [year, month, day] = date.split('-').map(Number);
            const check = new Date(Date.UTC(year, month - 1, day));
            const [hour, minute] = time.split(':').map(Number);
            if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error('请选择有效的 DDL 日期。');
            deadline = `截止日期是：${date} ${time}${model.deadlineZone ? `（${String(model.deadlineZone).slice(0, 80)}）` : ''}`;
        }
        const link = model.includeSource ? sourceLink(model.sourceUrl) : '';
        const lines = [greeting, intro, content, deadline, item.outro.trim(), link ? `点击跳转来源：${link}` : '', footer].filter(Boolean);
        const body = escape(content).replace(/\r?\n/g, '<br>');
        const card = model.card !== false;
        const html = `<div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.8;max-width:640px;margin:auto;padding:24px;background:#ffffff"><p>${escape(greeting)}</p>${intro ? `<p>${escape(intro)}</p>` : ''}<div style="padding:${card ? '20px' : '0'};${card ? `border:1px solid ${color};border-left:5px solid ${color};border-radius:12px;background:${color}0d;` : ''}color:${color};overflow-wrap:anywhere">${model.bold !== false ? `<strong>${body}</strong>` : body}</div>${deadline ? `<p><strong>${escape(deadline)}</strong></p>` : ''}${item.outro ? `<p>${escape(item.outro.trim())}</p>` : ''}${link ? `<p><a href="${escape(link)}" target="_blank" rel="noopener noreferrer" style="color:${color}">点击跳转来源</a></p>` : ''}<p style="margin-top:28px;color:#64748b;font-size:13px">${footer}</p></div>`;
        return { text: lines.join('\n\n'), html };
    }
    globalThis.MessageModel = { templates, render, validateTime, customTime, email, sourceLink, footer, consentVersion: 1 };
})();
