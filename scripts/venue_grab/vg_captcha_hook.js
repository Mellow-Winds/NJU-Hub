/**
 * scripts/venue_grab/vg_captcha_hook.js — Main World
 * hook XHR 被动截获 SPA 自己的 captcha/get 响应（图片+wordList），
 * 经 CustomEvent('vg_captcha_raw') 转交内容脚本。由 background 在武装时注入。
 */
(function () {
    'use strict';
    if (window.__VG_CAPTCHA_HOOK__) return;
    window.__VG_CAPTCHA_HOOK__ = true;

    const oo = XMLHttpRequest.prototype.open;
    const os = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) {
        this.__vgUrl = String(u || '');
        return oo.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
        if (/captcha\/get/.test(this.__vgUrl)) {
            this.addEventListener('load', function () {
                try {
                    window.dispatchEvent(new CustomEvent('vg_captcha_raw', {
                        detail: String(this.responseText || '').slice(0, 300000)
                    }));
                } catch (e) { /* 隔离世界未监听时静默 */ }
            });
        }
        return os.apply(this, arguments);
    };
})();
