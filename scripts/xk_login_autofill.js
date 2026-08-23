/**
 * scripts/xk_login_autofill.js
 *
 * 选课系统登录页（xk.nju.edu.cn）— 仅自动填充学号/密码
 * 点选验证码由用户手动完成
 */
(function () {
    'use strict';

    const KEYS = [
        'toggle-login', 'login_user', 'student_id', 'login_pass',
        'login_autofill'
    ];

    // login_user 由 options 保存时从 student_id 派生；兜底读取 student_id，兼容历史版本
    const userId = cfg => cfg['login_user'] || cfg['student_id'];

    // 有界轮询：最多重试 50 次（≈10s），避免在已登录的选课页上无限循环
    const MAX_ATTEMPTS = 50;

    chrome.storage.local.get(KEYS, (cfg) => {
        if (cfg['toggle-login'] === false || cfg['login_autofill'] === false) return;

        // 立即开始轮询，不等待 window.load（该页外部资源较多，load 可能迟迟不触发）
        fill(0);

        function fill(attempt) {
            const u = document.getElementById('loginName');
            const p = document.getElementById('loginPwd');

            if (!u || !p) {
                if (attempt < MAX_ATTEMPTS) {
                    setTimeout(() => fill(attempt + 1), 200);
                }
                return;
            }

            if (userId(cfg)) {
                u.value = userId(cfg);
                u.dispatchEvent(new Event('input', { bubbles: true }));
                u.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (cfg['login_pass']) {
                p.value = cfg['login_pass'];
                p.dispatchEvent(new Event('input', { bubbles: true }));
                p.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // ── 状态提示框（仅在成功定位表单后创建）──
            const box = document.createElement('div');
            Object.assign(box.style, {
                position: 'fixed', top: '15px', left: '50%', transform: 'translateX(-50%)',
                zIndex: '10000', background: 'rgba(30,30,30,0.9)', color: '#4cd964',
                padding: '10px 20px', borderRadius: '25px', fontSize: '14px', fontWeight: 'bold',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid #4cd964',
                backdropFilter: 'blur(8px)', pointerEvents: 'none'
            });
            box.innerHTML = '&#x2705; NJU-Hub: 凭证已填充，请手动完成验证码';
            document.body.appendChild(box);
        }
    });
})();
