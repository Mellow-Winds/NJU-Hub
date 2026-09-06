/* 选课页预选课组及合并课表；移除只影响插件本地数据。 */
(function () {
    'use strict';
    const X = window.__XK__;
    const { GM_getValue: get, GM_setValue: set, STORAGE } = X;
    const KEY = 'NJU_PRESELECT';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const identity = c => [c.name, c.teacher || '', c.timeStr || c.time || c.timeRaw || ''].join('|');
    const normalized = value => String(value || '').normalize('NFKC').replace(/\s+/g, '').trim();
    const teacherKey = value => normalized(value).split(/[,，、;；]+/).filter(Boolean).sort().join(',');
    // 体育课在教务课表中带校区和班序号，选课页使用课程本名。
    // 不移除普通课程末尾的数字，避免把“大学英语1/2”等不同课程合并。
    const courseAlias = value => normalized(value)
        .replace(/^(?:仙林|鼓楼|浦口|苏州)(?:校区)?/, '')
        .replace(/(初级|中级|高级)\d+(?:班)?$/, '$1')
        .replace(/\d+班$/, '');
    const entries = () => {
        const all = get(STORAGE.SCHEDULE, []).map((c, index) => ({ ...c, source: 'selected', index, id: identity(c) }))
            .concat(Object.entries(get(KEY, {})).map(([id, c]) => ({ ...c, source: 'pre', id })));
        const grouped = new Map();
        for (const c of all) {
            // 教室、周次变化不产生新的教学班；保留不同教师/班号的课程。
            const key = [normalized(c.name), teacherKey(c.teacher), normalized(c.tcid), normalized(c.code), normalized(c.clsName)].join('|');
            if (!grouped.has(key)) grouped.set(key, { ...c, slots: [], indices: [], preIds: [] });
            const merged = grouped.get(key);
            merged.slots.push(...slotsFor(c));
            if (c.source === 'selected') merged.indices.push(c.index);
            else merged.preIds.push(c.id);
        }
        const groups = [...grouped.values()].map(c => ({ ...c, slots: slotsFor(c) }));
        const absorbed = new Set();
        // 教务导入可能只有名称和时间，旧课表则有教师。先建立完整记录，
        // 再将缺教师记录匹配到唯一的同名、同时段课程，避免依赖输入顺序。
        for (const sparse of groups.filter(c => !teacherKey(c.teacher))) {
            const candidates = groups.filter(c => teacherKey(c.teacher)
                && courseAlias(c.name) === courseAlias(sparse.name)
                && ['tcid', 'code', 'clsName'].every(field => !normalized(c[field]) || !normalized(sparse[field])
                    || normalized(c[field]) === normalized(sparse[field]))
                && sparse.slots.some(a => c.slots.some(b => a.day === b.day && a.s < b.e && b.s < a.e)));
            if (candidates.length !== 1) continue;
            const target = candidates[0];
            target.slots = slotsFor({ slots: [...target.slots, ...sparse.slots] });
            target.indices.push(...sparse.indices);
            target.preIds.push(...sparse.preIds);
            if (sparse.source === 'selected') target.source = 'selected';
            absorbed.add(sparse);
        }
        return groups.filter(c => !absorbed.has(c));
    };
    const slotsFor = c => {
        const raw = Array.isArray(c.slots) ? c.slots : c.day && c.s && c.e ? [c]
            : window.__SCHED__.parseTimeStr(c.timeStr || c.time || c.timeRaw).slots;
        const merged = [];
        for (const slot of raw.filter(s => s.day >= 1 && s.day <= 7 && s.s >= 1 && s.e > s.s && s.e <= 21)
            .slice().sort((a, b) => a.day - b.day || a.s - b.s || a.e - b.e)) {
            const last = merged.at(-1);
            // 总览只占用一次时间：不同周次/教室的重复、交叠及相邻区间取并集。
            if (last && last.day === slot.day && slot.s <= last.e) last.e = Math.max(last.e, slot.e);
            else merged.push({ day: slot.day, s: slot.s, e: slot.e });
        }
        return merged;
    };
    const migrate = () => {
        if (get('NJU_PRESELECT_MIGRATED', false)) return;
        const legacy = get('NJU_SCHED_TABLE', {}).courses || [];
        const grouped = new Map();
        for (const c of legacy) {
            const key = `${c.cls}|${c.tcid || identity(c)}`;
            if (!grouped.has(key)) grouped.set(key, { name: c.name, teacher: c.teacher || '', time: c.timeRaw || '', cls: c.cls, slots: [] });
            if (!c.parseFail && c.day >= 1 && c.day <= 7 && c.s >= 1 && c.e > c.s) grouped.get(key).slots.push({ day: c.day, s: c.s, e: c.e, room: c.room, weeks: c.weeks });
        }
        const pre = { ...get(KEY, {}) };
        const selected = [...get(STORAGE.SCHEDULE, [])];
        for (const c of grouped.values()) {
            if (c.cls === 'sel') {
                if (!selected.some(s => identity(s) === identity(c))) selected.push({ ...c, timeStr: c.time });
            } else if (!pre[identity(c)]) pre[identity(c)] = c;
        }
        if (legacy.length) { set(KEY, pre); set(STORAGE.SCHEDULE, selected); }
        set('NJU_PRESELECT_MIGRATED', true);
    };
    let manager, timetable, editing = false;
    const remove = courses => {
        const pre = { ...get(KEY, {}) };
        const indices = new Set();
        for (const c of courses) {
            for (const id of c.preIds || [c.id]) delete pre[id];
            for (const index of c.indices || (c.source === 'selected' ? [c.index] : [])) indices.add(index);
        }
        set(KEY, pre);
        if (indices.size) set(STORAGE.SCHEDULE, get(STORAGE.SCHEDULE, []).filter((_, i) => !indices.has(i)));
        refresh();
    };
    const modal = (id, title, wide = false) => {
        const el = document.createElement('div');
        el.id = id;
        el.className = 'xk-modal-overlay';
        el.inert = true;
        el.innerHTML = `<section class="xk-modal" role="dialog" aria-modal="true" aria-label="${title}" style="${wide ? 'width:1100px;' : ''}"><header class="xk-header"><div class="pre-heading">${X.I.calendar} ${title}</div><button type="button" class="xk-close" aria-label="关闭">✕</button></header><div class="xk-body"></div><footer class="xk-footer"></footer></section>`;
        const close = () => {
            el.classList.remove('open');
            el.inert = true;
            const island = el._opener?.closest('.xk-island');
            const target = island && !island.classList.contains('expanded') ? island.querySelector('.status-wrapper') : el._opener;
            target?.focus({ preventScroll: true });
            if (island) island.scrollTop = 0;
        };
        el.querySelector('.xk-close').onclick = close;
        el.onclick = e => { if (e.target === el) close(); };
        el.onkeydown = e => {
            if (e.key === 'Escape') close();
            if (e.key === 'Tab') {
                const focusable = [...el.querySelectorAll('button,input')];
                const first = focusable[0], last = focusable.at(-1);
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        document.body.appendChild(el);
        return el;
    };
    const open = el => {
        el._opener = document.activeElement;
        el.inert = false;
        el.classList.add('open');
        el.querySelector('button').focus({ preventScroll: true });
    };
    const renderManager = () => {
        if (!manager) return;
        const list = Object.entries(get(KEY, {}));
        manager.querySelector('.xk-body').innerHTML = list.length ? list.map(([id, c]) => `<label class="fav-row"><input type="checkbox" value="${esc(id)}"><div class="fav-info"><div class="fav-name">${esc(c.name)}</div><div class="fav-detail">${esc(c.teacher)} | ${esc(c.time || c.timeRaw)}</div></div></label>`).join('') : '<div class="pre-empty">暂无预选课程<br><small>请在课程列表点击“预选”</small></div>';
    };
    const renderTimetable = () => {
        if (!timetable) return;
        const courses = entries();
        const expanded = courses.flatMap((c, index) => slotsFor(c).map(slot => ({ ...c, ...slot, courseIndex: index })));
        const H = 48;
        const rows = Math.max(11, ...expanded.map(c => c.e - 1));
        const days = ['一', '二', '三', '四', '五', '六', '日'];
        let html = `<div class="pre-grid"><div><div class="pre-day">节次</div><div style="height:${rows * H}px">`;
        for (let i = 1; i <= rows; i++) html += `<div class="pre-period">${i}</div>`;
        html += '</div></div>';
        days.forEach((day, i) => {
            html += `<div><div class="pre-day">星期${day}</div><div class="pre-day-body" style="height:${rows * H}px">`;
            for (const group of window.__SCHED__.clusterGroups(expanded.filter(c => c.day === i + 1))) {
                const { assigns, laneCount } = window.__SCHED__.laneAssign(group);
                for (const { course: c, lane } of assigns) {
                    const detail = c.teacher || '';
                    html += `<div class="pre-course ${c.source === 'selected' ? 'pre-blue' : 'pre-amber'}" style="top:${(c.s - 1) * H}px;height:${(c.e - c.s) * H}px;left:${100 * lane / laneCount}%;width:${100 / laneCount}%" title="${esc(c.name + ' · ' + detail)}">${editing ? `<button type="button" data-remove="${c.courseIndex}" aria-label="移除${esc(c.name)}">×</button>` : ''}<strong>${esc(c.name)}</strong><small>${esc(detail)}</small></div>`;
                }
            }
            html += '</div></div>';
        });
        html += '</div>';
        const unscheduled = courses.map((c, index) => ({ c, index })).filter(({ c }) => !slotsFor(c).length);
        if (!courses.length) html += '<p>暂无课程。请导入已选课表或在课程列表添加预选。</p>';
        if (unscheduled.length) html += '<p>以下课程的时间尚无法解析：</p>' + unscheduled.map(({ c, index }) => `<div class="fav-row">${esc(c.name)} · ${esc(c.teacher)} ${editing ? `<button type="button" data-remove="${index}">移除</button>` : ''}</div>`).join('');
        const body = timetable.querySelector('.xk-body');
        body.innerHTML = html;
        body.querySelectorAll('[data-remove]').forEach(btn => { btn.onclick = () => remove([courses[Number(btn.dataset.remove)]]); });
    };
    const refresh = () => {
        const pre = get(KEY, {});
        document.querySelectorAll('.pre-toggle-btn').forEach(btn => {
            const active = !!pre[btn.dataset.preId];
            btn.textContent = active ? '取消预选' : '预选';
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        const count = document.getElementById('btn-open-pre');
        if (count) count.textContent = `预选课程管理 (${Object.keys(pre).length})`;
        const schedCount = document.getElementById('btn-open-sched');
        if (schedCount) schedCount.innerHTML = `${X.I.calendar} 课表 (${entries().length})`;
        renderManager();
        renderTimetable();
    };
    const injectPreselect = (cell, course) => {
        if (cell.querySelector('.pre-toggle-btn')) return;
        let actions = cell.querySelector('.pre-actions');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'pre-actions';
            const fav = cell.querySelector('.fav-toggle-btn');
            if (fav) actions.appendChild(fav);
            cell.prepend(actions);
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pre-toggle-btn';
        btn.dataset.preId = identity(course);
        btn.onclick = e => {
            e.stopPropagation();
            const pre = { ...get(KEY, {}) };
            if (pre[btn.dataset.preId]) delete pre[btn.dataset.preId];
            else pre[btn.dataset.preId] = { ...course, added: Date.now() };
            set(KEY, pre);
            refresh();
        };
        actions.appendChild(btn);
        const active = !!get(KEY, {})[btn.dataset.preId];
        btn.textContent = active ? '取消预选' : '预选';
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    };
    const startPreselect = () => {
        if (document.getElementById('xk-timetable-float')) return;
        migrate();
        const style = document.createElement('style');
        style.textContent = `.pre-actions{display:flex;justify-content:center;align-items:center;gap:6px;margin-bottom:4px}.pre-actions .fav-toggle-btn{margin:0}.pre-toggle-btn{border:1px solid #ddd;border-radius:10px;padding:2px 8px;font-size:11px;white-space:nowrap;cursor:pointer;background:#f8f8f8;color:#666}.pre-toggle-btn.active{background:#8061bd;color:white}#xk-timetable-float{position:fixed;z-index:2147483646;border:0;border-radius:50%;width:52px;height:52px;display:flex;align-items:center;justify-content:center;padding:0;background:#660874;color:white;box-shadow:0 4px 18px #0003;cursor:grab;touch-action:none}#xk-timetable-float svg{width:24px;height:24px;pointer-events:none}#xk-timetable-float:focus-visible{outline:2px solid #660874;outline-offset:4px}#xk-timetable-modal .pre-grid{display:grid;grid-template-columns:44px repeat(7,minmax(100px,1fr));min-width:780px}#xk-timetable-modal .pre-day{text-align:center;background:#344e87;color:white;padding:10px 0}#xk-timetable-modal .pre-day-body{position:relative;border-left:1px solid #dce2ed;background:repeating-linear-gradient(to bottom,#fff 0 47px,#dce2ed 47px 48px)}#xk-timetable-modal .pre-period{height:48px;text-align:center;line-height:48px}#xk-timetable-modal .pre-course{position:absolute;box-sizing:border-box;border-radius:6px;padding:6px;overflow:hidden;overflow-wrap:anywhere;font-size:12px;border-left:3px solid}#xk-timetable-modal .pre-blue{background:#dce9ff;border-color:#2f6ad0}#xk-timetable-modal .pre-amber{background:#fff0cd;border-color:#d89a00}#xk-timetable-modal small{display:block;font-size:10px}#xk-timetable-modal [data-remove]{float:right;cursor:pointer;appearance:none;border:0;background:transparent;color:#888;border-radius:5px;padding:0 3px;font-size:16px;line-height:20px;font-family:inherit;box-shadow:none}#xk-timetable-modal .pre-course strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}#xk-timetable-modal .pre-course small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#xk-timetable-modal .xk-body{overflow:auto}#xk-timetable-modal .xk-header button{cursor:pointer}#xk-timetable-modal .pre-heading{display:flex;gap:12px;align-items:center}#xk-pre-manager .pre-empty{text-align:center;color:#999;margin-top:20px;padding:20px}#xk-pre-manager .pre-select-all{background:#eee;color:#333;flex:none;padding:8px 12px}#xk-pre-manager .pre-delete{background:#FF3B30;color:white;flex:none;padding:8px 12px}`;
        document.head.appendChild(style);
        manager = modal('xk-pre-manager', '预选课程管理');
        manager.querySelector('footer').innerHTML = '<div style="display:flex;gap:5px"><button type="button" class="xk-btn pre-select-all" data-all>全选</button><button type="button" class="xk-btn pre-delete" data-delete>移除所选</button></div>';
        manager.querySelector('[data-all]').onclick = () => {
            const checks = [...manager.querySelectorAll('input')];
            const checked = !checks.every(c => c.checked);
            checks.forEach(c => { c.checked = checked; });
        };
        manager.querySelector('[data-delete]').onclick = () => remove([...manager.querySelectorAll('input:checked')].map(c => ({ source: 'pre', id: c.value })));
        timetable = modal('xk-timetable-modal', '我的课表', true);
        timetable.querySelector('.pre-heading').innerHTML = `<button type="button" class="xk-btn">编辑</button><span>${X.I.calendar} 我的课表</span>`;
        timetable.querySelector('.pre-heading button').onclick = e => {
            editing = !editing;
            e.target.textContent = editing ? '完成' : '编辑';
            renderTimetable();
        };
        timetable.querySelector('footer').innerHTML = '<small>移除仅修改插件本地记录；同一时段的课程并排显示。</small><button type="button" class="xk-btn">导入已选课表</button>';
        timetable.querySelector('footer button').onclick = () => window.open('https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/*default/index.do#/xskcb', '_blank');
        const btn = document.createElement('button');
        btn.id = 'xk-timetable-float';
        btn.type = 'button';
        btn.innerHTML = X.I.calendar;
        btn.setAttribute('aria-label', '我的课表');
        btn.title = '我的课表';
        btn.querySelector('svg').setAttribute('aria-hidden', 'true');
        btn.querySelector('svg').style.margin = '0';
        btn.querySelector('path').setAttribute('fill', 'currentColor');
        const position = get('NJU_TIMETABLE_POS', { x: innerWidth - 130, y: innerHeight - 90 });
        const place = (x, y) => {
            btn.style.left = `${Math.max(0, Math.min(x, innerWidth - btn.offsetWidth))}px`;
            btn.style.top = `${Math.max(0, Math.min(y, innerHeight - btn.offsetHeight))}px`;
        };
        document.body.appendChild(btn);
        place(position.x, position.y);
        let drag, moved = false;
        btn.onpointerdown = e => {
            if (e.button !== 0) return;
            drag = { x: e.clientX, y: e.clientY, left: btn.offsetLeft, top: btn.offsetTop };
            moved = false;
            btn.setPointerCapture(e.pointerId);
        };
        btn.onpointermove = e => {
            if (!drag) return;
            if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) moved = true;
            if (moved) place(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y);
        };
        btn.onpointerup = () => {
            if (drag && moved) set('NJU_TIMETABLE_POS', { x: btn.offsetLeft, y: btn.offsetTop });
            drag = null;
        };
        btn.onpointercancel = () => { drag = null; moved = true; };
        btn.onclick = e => { if (moved && e.detail !== 0) { moved = false; return; } renderTimetable(); open(timetable); };
        window.addEventListener('resize', () => place(btn.offsetLeft, btn.offsetTop));
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes[KEY] || changes[STORAGE.SCHEDULE])) refresh();
        });
        refresh();
    };
    Object.assign(X, { injectPreselect, startPreselect, preselectEntries: entries, preselectSlots: slotsFor,
        openPreselect: () => { renderManager(); open(manager); },
        openTimetable: () => { renderTimetable(); open(timetable); } });
})();
