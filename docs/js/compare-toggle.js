/**
 * compare-toggle.js — Before/After 点击切换组件
 * 零依赖，纯原生 JS
 * 点击图片或按钮即可在 Before / After 之间切换
 */
(function () {
    'use strict';

    const blocks = document.querySelectorAll('[data-compare]');

    blocks.forEach(function (block) {
        const toggle = block.querySelector('[data-toggle]');
        const btn = block.querySelector('[data-toggle-btn]');
        const toggleText = btn ? btn.querySelector('.toggle-text') : null;

        function switchState() {
            const showAfter = toggle.classList.toggle('show-after');
            // 同步给 block，用于按钮样式切换
            block.classList.toggle('show-after', showAfter);
            if (toggleText) {
                toggleText.textContent = showAfter ? '点击图片或此处切换 Before' : '点击图片或此处切换 After';
            }
        }

        // 点击图片区域切换
        if (toggle) {
            toggle.addEventListener('click', function (e) {
                if (e.target.closest('.compare-label')) return;
                switchState();
            });
        }

        // 点击按钮切换
        if (btn) {
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('role', 'button');
            btn.setAttribute('aria-label', '切换 Before / After');
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                switchState();
            });
            btn.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    switchState();
                }
            });
        }
    });
})();
