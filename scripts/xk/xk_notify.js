/**
 * scripts/xk/xk_notify.js
 *
 * 通知层：拦截选课系统原生 bh-tip 通知，重绘为右下角气泡，并注入主世界桥接脚本延迟跳转
 * 依赖：window.__XK__ (storage)
 *
 * 背景：
 *   - 原生 bh-tip 位于顶部（top:16px），与浮动岛重叠
 *   - 通知出现后系统常会跳回登录页（会话过期），太快看不清
 *   - 无通知时 DOM 中不存在该元素，需用 MutationObserver 检测
 *
 * 职责：
 *   1. 注入气泡样式与容器
 *   2. MutationObserver 检测 .bh-tip 出现 → 隐藏原生 → 重绘右下角气泡（4s 自动消失）
 *   3. 注入 xk_notify_bridge.js 到 Main World，延迟通知之后的页面跳转
 */
(function () {
    'use strict';

    const { GM_getValue, STORAGE } = window.__XK__;

    const DEFAULT_DELAY = 3000;   // 跳转延迟毫秒数
    const BUBBLE_MS = 4000;       // 气泡自动消失毫秒数

    const TYPE_COLOR = {
        danger: '#FF3B30',
        warning: '#FF9500',
        success: '#34C759',
        info: '#007AFF'
    };

    // 去重：记录上一条气泡的文本/类型/时间戳，避免 loading 态连续触发
    let lastTip = { text: '', type: '', t: 0 };

    /**
     * 注入气泡 CSS 样式
     */
    const injectNotifyStyles = () => {
        if (document.getElementById('xk-notify-style')) return;
        const style = document.createElement('style');
        style.id = 'xk-notify-style';
        style.innerHTML = `
            #xk-notify-root {
                position: fixed; bottom: 32px; right: 32px; z-index: 2147483646;
                display: flex; flex-direction: column; align-items: flex-end; gap: 14px;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .xk-bubble {
                pointer-events: auto;
                max-width: 560px; min-width: 420px;
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                border: 1px solid #e5e5ea; border-radius: 20px;
                padding: 24px 32px;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
                display: flex; align-items: center; gap: 16px;
                font-size: 22px; font-weight: 700; color: #1c1c1e;
                transform: translateY(16px); opacity: 0;
                transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s;
            }
            .xk-bubble.show { transform: translateY(0); opacity: 1; }
            .xk-bubble.hide { transform: translateY(16px); opacity: 0; }
            .xk-bubble-dot {
                width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
            }
            .xk-bubble-text { flex: 1; line-height: 1.5; word-break: break-word; }
        `;
        document.head.appendChild(style);
    };

    /**
     * 获取（或创建）气泡容器
     */
    const ensureRoot = () => {
        let root = document.getElementById('xk-notify-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'xk-notify-root';
            document.body.appendChild(root);
        }
        return root;
    };

    /**
     * 弹出右下角气泡
     * @param {string} type - danger | warning | success | info
     * @param {string} text - 通知文本
     */
    const showBubble = (type, text) => {
        const now = Date.now();
        if (lastTip.text === text && lastTip.type === type && now - lastTip.t < 500) return;
        lastTip = { text, type, t: now };

        const root = ensureRoot();
        const bubble = document.createElement('div');
        bubble.className = `xk-bubble xk-bubble-${type}`;
        bubble.innerHTML = `
            <span class="xk-bubble-dot" style="background:${TYPE_COLOR[type] || TYPE_COLOR.info};"></span>
            <span class="xk-bubble-text"></span>
        `;
        bubble.querySelector('.xk-bubble-text').textContent = text;
        bubble.style.borderLeft = `4px solid ${TYPE_COLOR[type] || TYPE_COLOR.info}`;
        root.appendChild(bubble);

        requestAnimationFrame(() => bubble.classList.add('show'));

        setTimeout(() => {
            bubble.classList.remove('show');
            bubble.classList.add('hide');
            setTimeout(() => bubble.remove(), 350);
        }, BUBBLE_MS);
    };

    /**
     * 处理单个原生 bh-tip 元素：读类型/文本，隐藏原生，重绘气泡
     */
    const handleTip = (tip) => {
        if (tip.dataset.xkNotify) return;
        tip.dataset.xkNotify = '1';

        let type = 'info';
        if (tip.classList.contains('bh-tip-danger')) type = 'danger';
        else if (tip.classList.contains('bh-tip-warning')) type = 'warning';
        else if (tip.classList.contains('bh-tip-success')) type = 'success';

        const span = tip.querySelector('.bh-tip-content span');
        const text = (span ? span.innerText : tip.innerText || '').replace(/\s+/g, ' ').trim();
        if (!text) return;

        tip.style.display = 'none';
        showBubble(type, text);
    };

    /**
     * 启动 MutationObserver，检测 bh-tip 出现（含已存在的）
     */
    const startObserver = () => {
        const obs = new MutationObserver((muts) => {
            for (const m of muts) {
                for (const n of m.addedNodes) {
                    if (n.nodeType !== 1) continue;
                    if (n.matches && n.matches('.bh-tip')) handleTip(n);
                    if (n.querySelectorAll) n.querySelectorAll('.bh-tip').forEach(handleTip);
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll('.bh-tip').forEach(handleTip);
    };

    /**
     * 注入主世界桥接脚本（通过 background 的 chrome.scripting，绕过页面 CSP）
     */
    const injectBridge = () => {
        const delay = GM_getValue(STORAGE.NOTIFY_DELAY, DEFAULT_DELAY) || DEFAULT_DELAY;
        document.documentElement.setAttribute('data-xk-notify-delay', String(delay));
        chrome.runtime.sendMessage({ action: 'injectNotifyBridge' }, () => {
            void chrome.runtime.lastError; // 忽略上下文失效等错误
        });
    };

    const startNotify = () => {
        injectNotifyStyles();
        injectBridge();
        startObserver();
    };

    Object.assign(window.__XK__, { startNotify });
})();
