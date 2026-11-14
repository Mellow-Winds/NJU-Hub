(function (root) {
    'use strict';
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const compact = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s'’·_-]+/g, '');
    function service(value) {
        const id = String(value?.serviceId || value?.appId || value?.id || '');
        const name = String(value?.serviceName || value?.appName || value?.name || '').trim();
        if (!/^[\w-]{1,100}$/.test(id) || !name) return null;
        const icon = String(value.serviceIcon || value.appIcon || value.middleIcon || value.icon || '');
        return { id, name: name.slice(0, 200), icon: /^https:\/\/[^\s]+$/.test(icon) ? icon : '',
            allowed: value.hasPermission !== 0 && value.hasPermission !== false && value.allowed !== false,
            domain: String(value.domainName || value.domain || '').slice(0, 100) };
    }
    function recent(events, now = Date.now()) {
        const groups = new Map();
        for (const event of events) {
            const item = service(event.service);
            if (!item || !Number.isFinite(event.at) || event.at <= now - WEEK || event.at > now) continue;
            const existing = groups.get(item.id);
            if (existing) {
                existing.count++;
                if (event.at > existing.last) Object.assign(existing, item, { last: event.at });
            } else groups.set(item.id, { ...item, count: 1, last: event.at });
        }
        return [...groups.values()].sort((a, b) => b.last - a.last || a.id.localeCompare(b.id));
    }
    function order(saved, available) {
        return [...new Set([...(Array.isArray(saved) ? saved : []), ...available])].filter(id => available.includes(id));
    }
    function resolveService(services, name, icon) {
        const matches = services.filter(item => item.name === String(name || '').trim());
        if (matches.length === 1) return matches[0];
        // Icons identify a known catalogue entry only when duplicate names need disambiguation.
        const path = value => String(value || '').split(/[?#]/)[0];
        const sameIcon = icon ? matches.filter(item => item.icon && path(item.icon) === path(icon)) : [];
        return sameIcon.length === 1 ? sameIcon[0] : null;
    }
    function index(services, pinyin) {
        return services.map(item => {
            const syllables = pinyin(item.name, { toneType: 'none', type: 'array' });
            return { ...item, text: compact(item.name), full: compact(syllables.join('')),
                initials: compact(syllables.map(part => /^[a-z]/i.test(part) ? part[0] : part).join('')) };
        });
    }
    function search(items, query, history = []) {
        const term = compact(query);
        if (!term) return [];
        const times = new Map(history.map(item => [item.id, item.last]));
        return items.map(item => {
            let rank = 5;
            if (item.text === term) rank = 0;
            else if (item.text.startsWith(term)) rank = 1;
            else if (item.text.includes(term)) rank = 2;
            else if (item.full.includes(term) || item.initials.includes(term)) rank = 3;
            return { item, rank };
        }).filter(result => result.rank < 5).sort((a, b) => a.rank - b.rank
            || (times.get(b.item.id) || 0) - (times.get(a.item.id) || 0)
            || a.item.name.localeCompare(b.item.name, 'zh-CN')).map(result => result.item);
    }
    const api = { WEEK, compact, service, recent, order, resolveService, index, search };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.NjuEhallCore = api;
})(globalThis);
