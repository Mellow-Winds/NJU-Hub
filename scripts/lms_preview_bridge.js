// Injected into the LMS page's main world so requests made by Angular's
// fetch/XHR code can be observed from the isolated content script.
(function () {
    'use strict';
    if (window.__NJU_HUB_LMS_PREVIEW_BRIDGE__) return;
    window.__NJU_HUB_LMS_PREVIEW_BRIDGE__ = true;

    const publish = (value) => {
        const url = typeof value === 'string' ? value : value?.url;
        if (!url || !/pdf-viewer|note-bene/i.test(url)) return;
        const target = window.top || window;
        target.postMessage({
            source: 'NJU-Hub',
            type: 'lms-preview-url',
            url
        }, '*');
    };

    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
        window.fetch = function (input, init) {
            publish(typeof input === 'string' ? input : input?.url);
            return originalFetch.call(this, input, init);
        };
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        publish(url);
        return originalOpen.call(this, method, url, ...rest);
    };

    const originalPushState = history.pushState;
    history.pushState = function (state, title, url) {
        publish(url);
        return originalPushState.call(this, state, title, url);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (state, title, url) {
        publish(url);
        return originalReplaceState.call(this, state, title, url);
    };
})();
