/**
 * scripts/auth_auto_login.js
 *
 * NJU 统一认证 — 仅自动填充凭证
 * 滑块验证码由用户手动完成
 */
(function () {
    'use strict';

    const KEYS = [
        'toggle-login', 'login_user', 'login_pass',
        'login_autofill'
    ];

    chrome.storage.local.get(KEYS, (cfg) => {
        if (cfg['toggle-login'] === false || cfg['login_autofill'] === false) return;

        // ── 状态提示框 ──
        const box = document.createElement('div');
        Object.assign(box.style, {
            position: 'fixed', top: '15px', left: '50%', transform: 'translateX(-50%)',
            zIndex: '10000', background: 'rgba(30,30,30,0.9)', color: '#4cd964',
            padding: '10px 20px', borderRadius: '25px', fontSize: '14px', fontWeight: 'bold',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid #4cd964',
            backdropFilter: 'blur(8px)', pointerEvents: 'none'
        });
        document.body.appendChild(box);

        function fill() {
            const u = document.getElementById('username');
            const p = document.getElementById('password');

            if (!u || !p) {
                setTimeout(fill, 200);
                return;
            }

            if (cfg['login_user']) {
                u.value = cfg['login_user'];
                u.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (cfg['login_pass']) {
                p.value = cfg['login_pass'];
                p.dispatchEvent(new Event('input', { bubbles: true }));
            }

            box.innerHTML = '&#x2705; NJU-Hub: 凭证已填充，请手动完成验证';
        }

        if (document.readyState === 'complete') fill();
        else window.addEventListener('load', fill);
    });
})();
