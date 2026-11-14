// Runs in the page world to read the current account and observe real Vue service opens.
(function () {
    'use strict';
    if (window.__njuEhallBridge) return;
    window.__njuEhallBridge = true;
    let timer;
    let signature = '';
    let generation = 0;
    let currentScope = '';
    const hooks = new Map();
    const publish = (type, value) => window.postMessage({ source: 'nju-ehall-page', type, value }, location.origin);
    function stop() {
        clearInterval(timer);
        timer = null;
        signature = '';
        generation++;
        for (const [vm, hook] of hooks) {
            if (vm[hook.name] === hook.wrapped) vm[hook.name] = hook.original;
        }
        hooks.clear();
    }
    async function scan() {
        const version = generation;
        const components = [...document.querySelectorAll('*')].filter(el => el.__vue__).map(el => el.__vue__);
        const header = components.find(vm => vm.$options.name === 'HeaderUser');
        const user = header?.$store?.state?.userInfo;
        if (!user) return;
        const account = user.hasLogin && user.userId ? String(user.userId) : 'anonymous';
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(account));
        const scope = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (version !== generation || !timer) return;
        currentScope = scope;
        const card = components.find(vm => Array.isArray(vm.tabList) && typeof vm.handleClick === 'function' && 'wdscApps' in vm);
        const tabs = card?.tabList.map(tab => ({ id: tab.id, title: tab.title, visible: tab.isShow === true })) || [];
        const context = { scope, signedIn: !!user.hasLogin, tabs };
        const next = JSON.stringify(context);
        if (signature !== next) { signature = next; publish('context', context); }
        for (const vm of components) {
            const name = vm === card ? 'handleClick' : vm.$options.name === 'OnlineService' ? 'goAppService' : null;
            if (!name || hooks.has(vm) || typeof vm[name] !== 'function') continue;
            const original = vm[name];
            const wrapped = function (item, ...args) {
                const result = original.call(this, item, ...args);
                if (item && item.hasPermission !== 0) publish('visit', {
                    scope: currentScope, serviceId: item.appId || item.serviceId, serviceName: item.appName || item.serviceName,
                    serviceIcon: item.appIcon || item.serviceIcon || item.middleIcon || item.icon, hasPermission: item.hasPermission
                });
                return result;
            };
            vm[name] = wrapped;
            hooks.set(vm, { name, original, wrapped });
        }
        for (const [vm, hook] of hooks) {
            if (vm._isDestroyed) { if (vm[hook.name] === hook.wrapped) vm[hook.name] = hook.original; hooks.delete(vm); }
        }
    }
    window.addEventListener('message', event => {
        if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'nju-ehall-content') return;
        if (event.data.type === 'stop') stop();
        if (event.data.type === 'start') {
            stop();
            timer = setInterval(() => scan().catch(error => console.warn('[NJU Hub] 办事大厅上下文读取失败', error)), 1200);
            scan().catch(error => console.warn('[NJU Hub] 办事大厅上下文读取失败', error));
        }
    });
    publish('ready', null);
})();
