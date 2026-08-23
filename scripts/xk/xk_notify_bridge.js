/**
 * scripts/xk/xk_notify_bridge.js
 *
 * 运行环境: Main World（页面主执行环境，非扩展隔离沙箱）
 * 功能概述: 延迟选课页上的编程式页面跳转（location.reload / location.href = / assign /
 *           replace），让用户在右下角气泡里看清通知（如「请求过快」）后再被刷新。
 * 注入方式: 由 background 通过 chrome.scripting.executeScript({ world: 'MAIN' }) 注入，
 *           绕过页面 CSP 限制。延迟毫秒数通过 <html data-xk-notify-delay> 属性读取。
 *
 * 触发延迟窗口（置位 notifyUntil）：
 *   1. 捕获阶段监听 document click —— 早于按钮自身的处理函数，规避「通知异步渲染、
 *      跳转同步执行」的竞态（这是「请求过快」秒跳的根因）
 *   2. MutationObserver 检测 .bh-tip 出现（兜底，覆盖无点击的退登场景）
 *
 * 仅拦截编程式跳转，不影响用户点击 <a> 链接等正常导航。
 */
(function () {
    'use strict';

    var delay = 3000;
    try {
        var dAttr = document.documentElement.getAttribute('data-xk-notify-delay');
        if (dAttr) {
            var d = parseInt(dAttr, 10);
            if (!isNaN(d) && d > 0) delay = d;
        }
    } catch (e) { /* 忽略，使用默认值 */ }

    // 最近一次「需要延迟」事件的截止时间戳（0 表示当前无需延迟）
    var notifyUntil = 0;

    // 1. 点击即开启延迟窗口（捕获阶段，先于目标元素自身处理函数；含程序化 click()）
    document.addEventListener('click', function () {
        notifyUntil = Date.now() + delay;
    }, true);

    // 2. 检测 .bh-tip 出现时也开启延迟窗口（兜底）
    var observer = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
            var added = muts[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
                var n = added[j];
                if (n.nodeType !== 1) continue;
                if ((n.matches && n.matches('.bh-tip')) || (n.querySelector && n.querySelector('.bh-tip'))) {
                    notifyUntil = Date.now() + delay;
                    return;
                }
            }
        }
    });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

    /**
     * 在延迟窗口内则延迟执行，否则立即执行
     */
    function schedule(fn) {
        var remaining = notifyUntil - Date.now();
        if (remaining > 0) {
            setTimeout(fn, remaining);
        } else {
            fn();
        }
    }

    var LP = Location.prototype;
    var origReload = LP.reload;
    var origAssign = LP.assign;
    var origReplace = LP.replace;

    try {
        LP.reload = function () {
            var self = this;
            schedule(function () { origReload.call(self); });
        };
    } catch (e) { /* 忽略 */ }

    try {
        LP.assign = function (url) {
            var self = this;
            schedule(function () { origAssign.call(self, url); });
        };
    } catch (e) { /* 忽略 */ }

    try {
        LP.replace = function (url) {
            var self = this;
            schedule(function () { origReplace.call(self, url); });
        };
    } catch (e) { /* 忽略 */ }

    // href 是原型上的 accessor，需用 defineProperty 覆盖 setter
    try {
        var hrefDesc = Object.getOwnPropertyDescriptor(LP, 'href');
        if (hrefDesc && hrefDesc.set) {
            Object.defineProperty(LP, 'href', {
                get: function () { return hrefDesc.get.call(this); },
                set: function (url) {
                    var self = this;
                    schedule(function () { hrefDesc.set.call(self, url); });
                },
                configurable: true,
                enumerable: true
            });
        }
    } catch (e) { /* 忽略 */ }

    console.log('[NJU-Hub] 通知跳转延迟桥接已注入 (delay=' + delay + 'ms)');
})();
