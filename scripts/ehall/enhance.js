(function () {
    'use strict';
    const Core = globalThis.NjuEhallCore;
    const KEY = 'toggle-ehall';
    const PREFIX = 'nju_ehall_visit:';
    let enabled = false;
    let active = false;
    let context;
    let version = 0;
    let card;
    let nav;
    let recentPanel;
    let sorting = false;
    let tabDrag;
    let inputState;
    let selected = 'recent';
    let savedOrder = [];
    let events = {};
    let services = [];
    let searchIndex = [];
    let catalogueReady = false;
    let catalogueState = '正在加载服务';
    let refreshPromise;
    let maintenance;
    let observer;
    let scheduled;
    let bridgeLoaded;
    const keyboardNodes = new Map();
    const materialNodes = new Map();
    const moves = new Map();
    const reducedMotion = () => document.documentElement.dataset.njuGlobalStill === 'true'
        || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const route = () => /^#\/(?:home\/official_home|online_service)(?:[?]|$)/.test(location.hash);
    const home = () => location.hash.startsWith('#/home/official_home');
    const send = type => window.postMessage({ source: 'nju-ehall-content', type }, location.origin);
    const cacheKey = scope => `nju_ehall_catalogue:${scope}`;
    const orderKey = scope => `nju_ehall_order:${scope}`;
    const button = (text, action) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'nju-ehall-control nju-material-control';
        element.textContent = text;
        element.addEventListener('click', action);
        globalThis.NjuRipple?.attach(element);
        return element;
    };
    const status = text => {
        const element = document.createElement('p');
        element.className = 'nju-ehall-status';
        element.setAttribute('role', 'status');
        element.textContent = text;
        return element;
    };
    function showError(error) {
        console.warn('[NJU Hub] 办事大厅增强', error);
        const host = recentPanel || nav;
        if (host && !host.querySelector('.nju-ehall-error')) {
            const message = status('本地记录保存失败，请检查扩展存储');
            message.classList.add('nju-ehall-error');
            host.append(message);
        }
    }
    async function ensureBridge() {
        if (!bridgeLoaded) bridgeLoaded = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('scripts/ehall/bridge.js');
            script.onload = () => { script.remove(); resolve(); };
            script.onerror = () => { script.remove(); bridgeLoaded = null; reject(new Error('办事大厅页面桥接脚本加载失败')); };
            (document.head || document.documentElement).append(script);
        });
        await bridgeLoaded;
    }
    function visibleTabs() {
        return [{ id: 'recent', title: '最近访问', visible: true }, ...(context?.tabs || [])].filter(tab => tab.visible);
    }
    function orderedTabs() {
        const tabs = visibleTabs();
        return Core.order(savedOrder, tabs.map(tab => tab.id)).map(id => tabs.find(tab => tab.id === id));
    }
    function selectTab(id) {
        if (!card) return;
        if (id !== 'recent') {
            const definition = context.tabs.find(tab => tab.id === id);
            const native = [...card.querySelectorAll('.cus_wdsc.task-horizontal li')]
                .find(element => element.textContent.trim() === definition?.title);
            if (!native) return;
            native.click();
        }
        selected = id;
        card.classList.toggle('nju-ehall-recent-active', id === 'recent');
        recentPanel.hidden = id !== 'recent';
        nav.querySelectorAll('[data-tab]').forEach(tab => {
            const current = tab.dataset.tab === id;
            tab.setAttribute('aria-selected', String(current));
            if (current) tab.dataset.njuMaterialTone = 'purple';
            else tab.removeAttribute('data-nju-material-tone');
            tab.tabIndex = current ? 0 : -1;
        });
        if (id === 'recent') renderRecent();
        fitNav();
    }
    function renderNav() {
        if (!nav || tabDrag) return;
        const focused = nav.querySelector(':focus');
        const focus = focused?.dataset.tab;
        const action = focused?.dataset.action;
        nav.replaceChildren();
        nav.classList.toggle('nju-ehall-sorting', sorting);
        const tabs = document.createElement('div');
        tabs.className = 'nju-ehall-tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', '服务分类');
        for (const tab of orderedTabs()) {
            const item = button(tab.title, () => { if (!sorting) selectTab(tab.id); });
            item.classList.add('nju-ehall-tab');
            item.dataset.tab = tab.id;
            item.setAttribute('role', 'tab');
            if (tab.id === 'recent') item.setAttribute('aria-controls', 'nju-ehall-service-panel');
            item.setAttribute('aria-selected', String(selected === tab.id));
            if (selected === tab.id) item.dataset.njuMaterialTone = 'purple';
            item.tabIndex = sorting || selected === tab.id ? 0 : -1;
            item.draggable = false;
            if (sorting) item.setAttribute('aria-description', '拖动排序，或按 Alt 加左右方向键移动');
            item.addEventListener('dragstart', event => event.preventDefault());
            item.addEventListener('pointerdown', event => beginTabDrag(event, item));
            tabs.append(item);
        }
        tabs.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const items = [...tabs.children];
            let index = items.indexOf(document.activeElement);
            if (sorting && event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                const target = items[index + (event.key === 'ArrowRight' ? 1 : -1)];
                if (target && moveTab(items[index].dataset.tab, target.dataset.tab)) void saveOrder(savedOrder);
                return;
            }
            if (event.key === 'Home') index = 0;
            else if (event.key === 'End') index = items.length - 1;
            else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
            items[index].click();
            items[index].focus();
        });
        const actions = document.createElement('div');
        actions.className = 'nju-ehall-actions';
        const sort = button(sorting ? '完成' : '排序', () => {
            sorting = !sorting;
            renderNav();
            nav.querySelector('[data-action="sort"]')?.focus();
        });
        sort.dataset.action = 'sort';
        sort.setAttribute('aria-pressed', String(sorting));
        const all = document.createElement('a');
        all.className = 'nju-ehall-control nju-material-control';
        all.href = '#/online_service';
        all.textContent = '全部服务';
        globalThis.NjuRipple?.attach(all);
        actions.append(sort);
        if (sorting) {
            const restore = button('恢复默认', () => void saveOrder([]));
            restore.dataset.action = 'reset-order';
            restore.disabled = orderedTabs().every((tab, index) => tab.id === visibleTabs()[index].id);
            actions.append(restore);
        }
        actions.append(all);
        nav.append(tabs, actions);
        if (focus) nav.querySelector(`[data-tab="${focus}"]`)?.focus();
        else if (action) nav.querySelector(`[data-action="${action}"]`)?.focus();
        fitNav();
    }
    function fitNav() {
        if (!nav || !card || tabDrag) return;
        const tabs = nav.querySelector('.nju-ehall-tabs');
        const actions = nav.querySelector('.nju-ehall-actions');
        const available = Math.max(240, document.documentElement.clientWidth - 40);
        const baseFont = sorting ? 17 : 19;
        let scale = 1;
        const applySize = () => {
            nav.style.setProperty('--nju-ehall-tab-font', `${baseFont * scale}px`);
            nav.style.setProperty('--nju-ehall-action-font', `${(sorting ? 14 : 15) * scale}px`);
            nav.style.setProperty('--nju-ehall-tab-padding', `${(sorting ? 8 : 10) * scale}px`);
            nav.style.setProperty('--nju-ehall-nav-gap', `${(sorting ? 6 : 10) * scale}px`);
        };
        const required = () => tabs.getBoundingClientRect().width + actions.getBoundingClientRect().width
            + parseFloat(getComputedStyle(nav).columnGap);
        applySize();
        nav.style.width = 'max-content';
        let width = required();
        for (let attempt = 0; width > available && attempt < 3; attempt++) {
            const next = Math.max(14 / baseFont, scale * available / width * .99);
            if (next >= scale) break;
            scale = next;
            applySize();
            width = required();
        }
        nav.style.width = `${Math.min(available, Math.max(card.getBoundingClientRect().width, width))}px`;
        nav.classList.toggle('nju-ehall-nav-scroll', width > available + 1);
    }
    function placeTabs(elements) {
        const tabs = nav.querySelector('.nju-ehall-tabs');
        const before = new Map([...tabs.children].map(element => [element, element.getBoundingClientRect()]));
        const focused = tabs.contains(document.activeElement) ? document.activeElement : null;
        for (const animation of moves.values()) animation.cancel();
        moves.clear();
        tabs.append(...elements);
        focused?.focus({ preventScroll: true });
        if (reducedMotion()) return;
        for (const element of elements) {
            if (element.dataset.tab === tabDrag?.id) continue;
            const from = before.get(element);
            const to = element.getBoundingClientRect();
            const x = from.left - to.left, y = from.top - to.top;
            if (Math.abs(x) + Math.abs(y) < 1) continue;
            const animation = element.animate([{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }], {
                duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)'
            });
            moves.set(element, animation);
            animation.onfinish = () => { if (moves.get(element) === animation) moves.delete(element); };
        }
    }
    function moveTab(id, targetId) {
        const tabs = nav?.querySelector('.nju-ehall-tabs');
        if (!tabs || id === targetId) return false;
        const elements = [...tabs.children];
        const from = elements.findIndex(element => element.dataset.tab === id);
        const to = elements.findIndex(element => element.dataset.tab === targetId);
        if (from < 0 || to < 0) return false;
        const [moved] = elements.splice(from, 1);
        elements.splice(to, 0, moved);
        placeTabs(elements);
        savedOrder = elements.map(element => element.dataset.tab);
        return true;
    }
    function beginTabDrag(event, item) {
        if (!sorting || event.button !== 0 || tabDrag) return;
        const controller = new AbortController();
        const capture = nav;
        const drag = { id: item.dataset.tab, item, capture, controller, pointerId: event.pointerId,
            originalOrder: [...savedOrder], startX: event.clientX, startY: event.clientY, started: false };
        tabDrag = drag;
        capture.setPointerCapture(event.pointerId);
        const options = { signal: controller.signal, capture: true };
        document.addEventListener('pointermove', current => {
            if (current.pointerId !== drag.pointerId) return;
            if (!drag.started && Math.hypot(current.clientX - drag.startX, current.clientY - drag.startY) < 6) return;
            current.preventDefault();
            if (!drag.started) {
                drag.started = true;
                const rect = item.getBoundingClientRect();
                const style = getComputedStyle(item);
                drag.offsetX = drag.startX - rect.left;
                drag.offsetY = drag.startY - rect.top;
                drag.ghost = item.cloneNode(true);
                drag.ghost.removeAttribute('data-tab');
                drag.ghost.removeAttribute('role');
                drag.ghost.setAttribute('aria-hidden', 'true');
                drag.ghost.tabIndex = -1;
                drag.ghost.classList.add('nju-ehall-drag-ghost');
                drag.ghost.querySelectorAll('.ripple').forEach(ripple => ripple.remove());
                Object.assign(drag.ghost.style, { width: `${rect.width}px`, height: `${rect.height}px`,
                    font: style.font, padding: style.padding, boxSizing: 'border-box' });
                document.body.append(drag.ghost);
                item.classList.add('nju-ehall-dragging');
            }
            drag.ghost.style.transform = `translate3d(${current.clientX - drag.offsetX}px, ${current.clientY - drag.offsetY}px, 0)`;
            const rect = capture.getBoundingClientRect();
            if (current.clientY < rect.top - 12 || current.clientY > rect.bottom + 12) return;
            const tabs = capture.querySelector('.nju-ehall-tabs');
            const elements = [...tabs.children];
            const target = elements.find(element => {
                const left = rect.left + element.offsetLeft - capture.scrollLeft;
                return current.clientX >= left && current.clientX < left + element.offsetWidth;
            });
            if (target) moveTab(drag.id, target.dataset.tab);
        }, options);
        document.addEventListener('pointerup', current => {
            if (current.pointerId !== drag.pointerId) return;
            const rect = capture.getBoundingClientRect();
            const outside = current.clientX < rect.left || current.clientX > rect.right
                || current.clientY < rect.top - 12 || current.clientY > rect.bottom + 12;
            finishTabDrag(outside);
        }, options);
        document.addEventListener('pointercancel', current => {
            if (current.pointerId === drag.pointerId) finishTabDrag(true);
        }, options);
        capture.addEventListener('lostpointercapture', () => { if (tabDrag === drag) finishTabDrag(true); }, { signal: controller.signal });
    }
    function finishTabDrag(cancelled, immediate = false) {
        const drag = tabDrag;
        if (!drag) return;
        drag.controller.abort();
        if (drag.capture.hasPointerCapture(drag.pointerId)) drag.capture.releasePointerCapture(drag.pointerId);
        if (cancelled) {
            savedOrder = drag.originalOrder;
            if (drag.started && !immediate) {
                const elements = [...nav.querySelector('.nju-ehall-tabs').children];
                const ids = Core.order(savedOrder, elements.map(element => element.dataset.tab));
                placeTabs(ids.map(id => elements.find(element => element.dataset.tab === id)));
            }
        }
        tabDrag = null;
        if (!drag.started) { syncOrderView(); return; }
        let completed = false;
        let fallback;
        const complete = () => {
            if (completed) return;
            completed = true;
            clearTimeout(fallback);
            drag.ghost.remove();
            drag.item.classList.remove('nju-ehall-dragging');
        };
        if (!immediate && !reducedMotion()) {
            const destination = drag.item.getBoundingClientRect();
            const animation = drag.ghost.animate([{ transform: drag.ghost.style.transform },
                { transform: `translate3d(${destination.left}px, ${destination.top}px, 0)` }], {
                duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards'
            });
            animation.onfinish = complete;
            animation.oncancel = complete;
            fallback = setTimeout(() => { animation.cancel(); complete(); }, 260);
        } else complete();
        if (!cancelled) void saveOrder(savedOrder);
    }
    async function saveOrder(next) {
        savedOrder = next;
        syncOrderView();
        try { await chrome.storage.local.set({ [orderKey(context.scope)]: next }); }
        catch (error) { showError(error); }
    }
    function syncOrderView() {
        if (!nav || tabDrag) return;
        const displayed = [...nav.querySelectorAll('[data-tab]')].map(element => element.dataset.tab);
        if (displayed.join() !== orderedTabs().map(tab => tab.id).join()) renderNav();
        else {
            const restore = nav.querySelector('[data-action="reset-order"]');
            if (restore) restore.disabled = orderedTabs().every((tab, index) => tab.id === visibleTabs()[index].id);
        }
    }
    function history() { return Core.recent(Object.values(events)); }
    function renderUsage() {
        const recent = history();
        const counts = new Map(recent.map(item => [item.id, item.count]));
        const catalogue = [...new Map([...recent, ...services].map(item => [item.id, item])).values()];
        const entries = [...(card?.querySelectorAll('.wdsc_app') || []),
            ...document.querySelectorAll('.online-service .app-group-item-content-app')];
        for (const entry of entries) {
            const wrapper = entry.querySelector('.wrapper');
            if (!wrapper) continue;
            const name = wrapper.querySelector('.wdscname, .name');
            const item = Core.resolveService(catalogue, name?.getAttribute('title') || name?.textContent, entry.querySelector('img')?.src);
            let caption = wrapper.querySelector('.nju-ehall-usage');
            if (!item) { caption?.remove(); continue; }
            if (!caption) {
                caption = document.createElement('small');
                caption.className = 'nju-ehall-usage';
                wrapper.append(caption);
            }
            const text = `最近七天使用了 ${counts.get(item.id) || 0} 次`;
            if (caption.textContent !== text) caption.textContent = text;
        }
    }
    function serviceLink(item, count) {
        const link = document.createElement('a');
        link.className = 'nju-ehall-service';
        const current = services.find(service => service.id === item.id);
        const available = item.allowed && (!catalogueReady || !!current?.allowed);
        link.href = `${location.origin}/appShow?appId=${encodeURIComponent(item.id)}`;
        link.target = '_blank';
        link.rel = 'noopener';
        if (!available) { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
        const image = document.createElement('img');
        image.alt = '';
        image.loading = 'lazy';
        const icon = current?.icon || item.icon;
        if (icon) image.src = icon;
        let backupIcon = item.icon !== icon ? item.icon : '';
        image.addEventListener('error', () => {
            if (backupIcon) { image.src = backupIcon; backupIcon = ''; }
            else { image.removeAttribute('src'); image.classList.add('nju-ehall-icon-missing'); }
        });
        const text = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = current?.name || item.name;
        text.append(name);
        if (count !== undefined || !available) {
            const detail = document.createElement('small');
            detail.textContent = available ? `最近七天使用了 ${count} 次` : '当前不可用';
            text.append(detail);
        }
        link.append(image, text);
        const record = event => {
            if (!available) { event.preventDefault(); return; }
            if (event.type === 'auxclick' && event.button !== 1) return;
            void recordVisit(item, context.scope);
        };
        link.addEventListener('click', record);
        link.addEventListener('auxclick', record);
        return link;
    }
    function renderRecent() {
        renderUsage();
        if (!recentPanel) return;
        recentPanel.replaceChildren();
        const items = history();
        const list = document.createElement('div');
        list.className = 'nju-ehall-grid';
        items.forEach(item => list.append(serviceLink(item, item.count)));
        recentPanel.append(items.length ? list : status('暂无最近访问'));
        if (!context?.signedIn) recentPanel.append(status('访问记录保存在当前浏览器'));
    }
    async function recordVisit(value, scope) {
        const item = Core.service(value);
        if (!active || !item || !item.allowed || scope !== context?.scope) return;
        const key = `${PREFIX}${scope}:${crypto.randomUUID()}`;
        const current = services.find(service => service.id === item.id);
        const event = { service: { ...item, icon: current?.icon || item.icon }, at: Date.now() };
        events[key] = event;
        renderRecent();
        try { await chrome.storage.local.set({ [key]: event }); }
        catch (error) { delete events[key]; renderRecent(); showError(error); }
    }
    async function refreshCatalogue() {
        if (refreshPromise || !context) return refreshPromise;
        const scope = context.scope;
        const requestVersion = version;
        catalogueState = services.length ? '正在更新服务索引' : '正在加载服务';
        refreshPromise = (async () => {
            try {
                const response = await fetch('/jsonp/ywtb/service/getServices?searchKeyword=&labels=', {
                    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000)
                });
                if (!response.ok) throw new Error(`服务列表 HTTP ${response.status}`);
                const result = await response.json();
                if (result.result !== 'success' || !Array.isArray(result.data)) throw new Error('服务列表返回格式异常或登录已过期');
                if (!active || requestVersion !== version || context?.scope !== scope) return;
                services = [...new Map(result.data.map(Core.service).filter(Boolean).map(item => [item.id, item])).values()];
                searchIndex = Core.index(services, globalThis.pinyinPro.pinyin);
                catalogueReady = true;
                catalogueState = '';
                await chrome.storage.local.set({ [cacheKey(scope)]: { at: Date.now(), services } });
            } catch (error) {
                if (requestVersion !== version) return;
                catalogueState = services.length ? '更新失败，正在使用缓存' : '服务加载失败';
                console.warn('[NJU Hub] 服务索引加载失败', error);
            } finally {
                if (requestVersion === version) {
                    refreshPromise = null;
                    renderRecent();
                    renderSearch();
                }
            }
        })();
        return refreshPromise;
    }
    async function loadAccount(next) {
        const accountChanged = context?.scope !== next.scope;
        context = next;
        if (!accountChanged) { renderNav(); return; }
        finishTabDrag(true, true);
        sorting = false;
        tabDrag = null;
        version++;
        const currentVersion = version;
        events = {};
        services = [];
        searchIndex = [];
        savedOrder = [];
        selected = 'recent';
        catalogueReady = false;
        catalogueState = '正在加载服务';
        refreshPromise = null;
        renderRecent();
        renderSearch();
        const data = await chrome.storage.local.get(null);
        if (!active || version !== currentVersion) return;
        const eventPrefix = `${PREFIX}${next.scope}:`;
        const expired = [];
        for (const [key, event] of Object.entries(data)) {
            if (!key.startsWith(eventPrefix)) continue;
            if (event?.at > Date.now() - Core.WEEK && Core.service(event.service)) events[key] = event;
            else expired.push(key);
        }
        if (expired.length) await chrome.storage.local.remove(expired);
        savedOrder = Array.isArray(data[orderKey(next.scope)]) ? data[orderKey(next.scope)] : [];
        const cached = data[cacheKey(next.scope)];
        if (Array.isArray(cached?.services) && cached.at > Date.now() - Core.WEEK) {
            services = cached.services.map(Core.service).filter(Boolean);
            searchIndex = Core.index(services, globalThis.pinyinPro.pinyin);
        }
        mount();
        renderNav();
        selectTab('recent');
        renderRecent();
        void refreshCatalogue();
    }
    function renderSearch() {
        const state = inputState;
        if (!state || state.composing) return;
        state.panel.replaceChildren();
        const matches = Core.search(searchIndex, state.input.value, history());
        state.results = matches.slice(0, 15);
        state.cursor = -1;
        state.input.removeAttribute('aria-activedescendant');
        const open = !!state.input.value.trim() && state.focused;
        state.panel.hidden = !open;
        state.input.setAttribute('aria-expanded', String(open));
        if (!open) return;
        state.results.forEach((item, index) => {
            const link = serviceLink(item);
            link.id = `nju-ehall-result-${index}`;
            link.setAttribute('role', 'option');
            link.setAttribute('aria-selected', 'false');
            link.tabIndex = -1;
            state.panel.append(link);
        });
        if (catalogueState) {
            state.panel.append(status(catalogueState));
            if (/失败/.test(catalogueState)) state.panel.append(button('重试', () => void refreshCatalogue()));
        } else if (!state.results.length) state.panel.append(status('暂无相关服务'));
        if (matches.length > 15) state.panel.append(status(`共 ${matches.length} 项，继续输入可缩小范围`));
    }
    function bindSearch(input) {
        unbindSearch();
        const container = input.closest('.input');
        if (!container) return;
        const controller = new AbortController();
        const attributes = ['role', 'aria-label', 'aria-autocomplete', 'aria-expanded', 'aria-controls', 'aria-activedescendant', 'placeholder'];
        const previous = attributes.map(name => [name, input.getAttribute(name)]);
        const panel = document.createElement('div');
        panel.className = 'nju-ehall-search nju-material-surface';
        panel.id = 'nju-ehall-search-results';
        panel.setAttribute('role', 'listbox');
        panel.setAttribute('aria-label', '服务搜索结果');
        panel.hidden = true;
        const label = document.createElement('span');
        label.className = 'nju-ehall-search-label';
        label.textContent = '搜索服务 / 拼音首字母';
        label.setAttribute('aria-hidden', 'true');
        container.classList.add('nju-ehall-search-host');
        input.placeholder = ' ';
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-label', '搜索服务，支持名称、拼音和首字母');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', panel.id);
        container.append(label, panel);
        const state = { input, panel, label, container, controller, previous, results: [], cursor: -1, focused: document.activeElement === input, composing: false, handledEnter: false };
        inputState = state;
        const on = (element, event, callback, capture = false) => element.addEventListener(event, callback, { signal: controller.signal, capture });
        on(input, 'compositionstart', () => {
            state.composing = true;
            panel.hidden = true;
            input.setAttribute('aria-expanded', 'false');
        });
        on(input, 'compositionend', () => { state.composing = false; renderSearch(); });
        on(input, 'input', () => renderSearch());
        on(input, 'focus', () => { state.focused = true; renderSearch(); });
        on(container, 'focusout', () => setTimeout(() => {
            if (inputState === state && !container.contains(document.activeElement)) {
                state.focused = false;
                panel.hidden = true;
                input.setAttribute('aria-expanded', 'false');
            }
        }, 0));
        on(document, 'pointerdown', event => {
            if (!container.contains(event.target)) { state.focused = false; panel.hidden = true; input.setAttribute('aria-expanded', 'false'); }
        });
        on(input, 'keydown', event => {
            if (event.isComposing || state.composing || event.keyCode === 229) return;
            if (event.key === 'Escape') {
                event.stopImmediatePropagation();
                state.focused = false;
                panel.hidden = true;
                input.setAttribute('aria-expanded', 'false');
                return;
            }
            const links = [...panel.querySelectorAll('[role="option"]:not([aria-disabled="true"])')];
            if (!links.length) return;
            if (event.key === 'Enter') {
                if (panel.hidden) return;
                event.preventDefault(); event.stopImmediatePropagation();
                state.handledEnter = true;
                links[Math.max(0, state.cursor)]?.click();
                return;
            }
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault(); event.stopImmediatePropagation();
            panel.hidden = false;
            state.focused = true;
            input.setAttribute('aria-expanded', 'true');
            state.cursor = (state.cursor + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
            links.forEach((link, index) => link.setAttribute('aria-selected', String(index === state.cursor)));
            input.setAttribute('aria-activedescendant', links[state.cursor].id);
            links[state.cursor].scrollIntoView({ block: 'nearest' });
        }, true);
        // The host opens its full search on keyup, after our keydown selection.
        on(input, 'keyup', event => {
            if (event.key === 'Enter' && state.handledEnter) {
                event.preventDefault(); event.stopImmediatePropagation();
                state.handledEnter = false;
            }
        }, true);
        const submit = container.querySelector('.input-suffix');
        if (submit) on(submit, 'click', event => {
            const first = panel.querySelector('[role="option"]:not([aria-disabled="true"])');
            if (state.input.value.trim() && first) { event.preventDefault(); event.stopImmediatePropagation(); first.click(); }
        }, true);
    }
    function unbindSearch() {
        if (!inputState) return;
        inputState.controller.abort();
        inputState.panel.remove();
        inputState.label.remove();
        inputState.container.classList.remove('nju-ehall-search-host');
        for (const [name, value] of inputState.previous) {
            if (value === null) inputState.input.removeAttribute(name);
            else inputState.input.setAttribute(name, value);
        }
        inputState = null;
    }
    function unmountCard() {
        document.querySelectorAll('.nju-ehall-usage').forEach(element => element.remove());
        finishTabDrag(true, true);
        for (const animation of moves.values()) animation.cancel();
        moves.clear();
        document.querySelectorAll('.nju-ehall-drag-ghost').forEach(element => {
            element.getAnimations().forEach(animation => animation.cancel());
            element.remove();
        });
        for (const [element, previous] of materialNodes) {
            if (!previous.surface) element.classList.remove('nju-material-surface');
            if (previous.tone === null) element.removeAttribute('data-nju-material-tone');
            else element.setAttribute('data-nju-material-tone', previous.tone);
        }
        materialNodes.clear();
        card?.querySelectorAll('[data-nju-ehall-subcategories]').forEach(element => { delete element.dataset.njuEhallSubcategories; });
        for (const [element, attributes] of keyboardNodes) {
            for (const [name, value] of attributes) {
                if (value === null) element.removeAttribute(name);
                else element.setAttribute(name, value);
            }
            delete element.dataset.njuEhallKeyboard;
        }
        keyboardNodes.clear();
        nav?.remove(); recentPanel?.remove();
        sorting = false;
        tabDrag = null;
        document.querySelectorAll('[data-nju-ehall-flow]').forEach(element => {
            delete element.dataset.njuEhallFlow;
        });
        card?.classList.remove('nju-ehall-card', 'nju-ehall-recent-active');
        card = nav = recentPanel = null;
    }
    function mount() {
        if (!active || !context) return;
        const body = home() ? document.querySelector('.wdsc_content')?.parentElement : null;
        if (body !== card || (card && !nav?.isConnected)) {
            unmountCard();
            if (body) {
                card = body;
                card.classList.add('nju-ehall-card', 'nju-ehall-recent-active');
                let ancestor = body;
                while (ancestor && !ancestor.classList.contains('card-container')) {
                    ancestor.dataset.njuEhallFlow = 'true';
                    ancestor = ancestor.parentElement;
                }
                if (ancestor) ancestor.dataset.njuEhallFlow = 'container';
                nav = document.createElement('nav'); nav.className = 'nju-ehall-nav'; nav.setAttribute('aria-label', '办事大厅服务');
                recentPanel = document.createElement('section'); recentPanel.id = 'nju-ehall-service-panel'; recentPanel.setAttribute('role', 'tabpanel'); recentPanel.setAttribute('aria-label', '最近访问');
                card.prepend(nav, recentPanel);
                selected = 'recent';
                renderNav(); renderRecent();
            }
        }
        if (card) {
            for (const panel of card.querySelectorAll('.wdsc_content > div')) {
                const sidebar = panel.querySelector(':scope > .task-vertical');
                if (sidebar) {
                    panel.dataset.njuEhallSubcategories = 'true';
                    if (!materialNodes.has(sidebar)) {
                        materialNodes.set(sidebar, { surface: sidebar.classList.contains('nju-material-surface'), tone: sidebar.getAttribute('data-nju-material-tone') });
                        sidebar.classList.add('nju-material-surface');
                        sidebar.dataset.njuMaterialTone = 'white-purple';
                    }
                }
            }
            for (const element of card.querySelectorAll('.wdsc_app, .wdsc_app > .iconfont, .task-vertical li')) {
                if (element.hasAttribute('data-nju-ehall-keyboard')) continue;
                // Vue's original click handler remains responsible for opening or switching.
                keyboardNodes.set(element, ['tabindex', 'role', 'aria-label'].map(name => [name, element.getAttribute(name)]));
                element.dataset.njuEhallKeyboard = 'true';
                element.tabIndex = 0;
                element.setAttribute('role', 'button');
                if (element.classList.contains('iconfont')) element.setAttribute('aria-label', '切换收藏');
            }
        }
        const input = document.querySelector('.input .input-inner');
        if (input !== inputState?.input) { if (input) bindSearch(input); else unbindSearch(); }
        renderUsage();
        fitNav();
    }
    function scheduleMount() {
        if (scheduled) return;
        scheduled = setTimeout(() => { scheduled = null; void reconcile(); }, 100);
    }
    async function reconcile() {
        // Vue Router can update the hash with pushState, which emits no hashchange.
        // Observe route-driven DOM changes even when first entering through /hall.
        if (enabled && !observer) {
            observer = new MutationObserver(scheduleMount);
            observer.observe(document.body, { childList: true, subtree: true });
        } else if (!enabled) {
            observer?.disconnect();
            observer = null;
            clearTimeout(scheduled);
            scheduled = null;
        }
        const shouldRun = enabled && route();
        if (shouldRun === active) { mount(); return; }
        active = shouldRun;
        if (!active) {
            version++; context = null; refreshPromise = null;
            clearInterval(maintenance); clearTimeout(scheduled); scheduled = null;
            unmountCard(); unbindSearch(); send('stop');
            document.querySelector('#nju-ehall-start-error')?.remove();
            document.documentElement.classList.remove('nju-ehall-enabled');
            return;
        }
        document.documentElement.classList.add('nju-ehall-enabled');
        maintenance = setInterval(() => {
            renderRecent();
            const expired = Object.entries(events).filter(([, event]) => event.at <= Date.now() - Core.WEEK).map(([key]) => key);
            if (expired.length) chrome.storage.local.remove(expired).catch(showError);
            if (context && !refreshPromise) void refreshCatalogue();
        }, 60000);
        try { await ensureBridge(); if (active) send('start'); }
        catch (error) {
            console.warn('[NJU Hub] 办事大厅增强启动失败', error);
            if (active) {
                const message = status('增强未启动，请刷新页面或重新加载扩展');
                message.id = 'nju-ehall-start-error';
                (document.querySelector('.input') || document.body).append(message);
            }
        }
    }
    window.addEventListener('message', event => {
        if (!active || event.source !== window || event.origin !== location.origin || event.data?.source !== 'nju-ehall-page') return;
        if (event.data.type === 'context') {
            const value = event.data.value;
            if (/^[a-f0-9]{64}$/.test(value?.scope) && Array.isArray(value.tabs)) void loadAccount(value).catch(showError);
        }
        if (event.data.type === 'visit') void recordVisit(event.data.value, event.data.value?.scope);
    });
    window.addEventListener('hashchange', () => { if (home()) selected = 'recent'; void reconcile(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && tabDrag) { event.preventDefault(); finishTabDrag(true); return; }
        if (!active || !['Enter', ' '].includes(event.key)) return;
        const target = event.target.closest('[data-nju-ehall-keyboard]');
        if (target && target === event.target) { event.preventDefault(); target.click(); }
    });
    window.addEventListener('pageshow', () => { if (active) send('start'); });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[KEY]) { enabled = changes[KEY].newValue !== false; void reconcile(); }
        if (!active || !context) return;
        for (const [key, change] of Object.entries(changes)) {
            if (key.startsWith(`${PREFIX}${context.scope}:`)) {
                if (change.newValue) events[key] = change.newValue;
                else delete events[key];
            }
        }
        if (changes[orderKey(context.scope)]) {
            const nextOrder = changes[orderKey(context.scope)].newValue || [];
            if (tabDrag) tabDrag.originalOrder = nextOrder;
            else savedOrder = nextOrder;
            syncOrderView();
        }
        renderRecent();
    });
    window.addEventListener('resize', fitNav);
    chrome.storage.local.get(KEY).then(data => { enabled = data[KEY] !== false; return reconcile(); }).catch(showError);
})();
