/**
 * scripts/venue_grab/vg_captcha_ai.js
 * 自动点选验证码编排层（内容脚本，隔离世界）
 *  - 监听 vg_captcha_raw（主世界钩子转来的 captcha/get 响应）
 *  - 调 __VG_OCR__.solve（libs/venue_ocr/vg_ocr_bundle.js，ddddocr det+rec）
 *  - 按序在验证码图上派发坐标点击，失败自动刷新重试（上限 5 次）
 * 引擎经 window.__VG_CAPTCHA_AUTO__.run(cfg) 调用
 */
(function () {
    'use strict';

    const MODELS_URL = chrome.runtime.getURL('libs/venue_ocr/');
    const MAX_ATTEMPTS = 5;
    const RESULT_TIMEOUT_MS = 6000;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const diag = (msg) => { try { window.dispatchEvent(new CustomEvent('vg_ai_log', { detail: msg })); } catch (e) {} };

    const auto = {
        _payload: null,

        reset() { this._payload = null; this._attempts = 0; },

        async run() {
            this._attempts = 0;
            diag('bundle=' + (typeof window.__VG_OCR__) + ' hookPayload=' + (this._payload ? 'yes' : 'waiting'));
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                // 等待 captcha/get 载荷（提交后钩子会立刻抓到）
                let payload = this._payload;
                for (let i = 0; i < 20 && !payload; i++) { await sleep(150); payload = this._payload; }
                if (!payload) { diag('attempt' + attempt + ': 未收到验证码载荷'); return 'failed'; }

                const words = payload.words;
                if (!words || !words.length) { diag('attempt' + attempt + ': wordList 为空'); return 'failed'; }

                let res;
                try {
                    res = await window.__VG_OCR__.solve(MODELS_URL, payload.img, words);
                } catch (e) {
                    diag('attempt' + attempt + ': solve 异常 ' + (e && e.message || e));
                    return 'failed';
                }
                diag('attempt' + attempt + ': 识别=' + JSON.stringify(res.found) + ' 目标=' + JSON.stringify(words) + ' ok=' + res.ok);
                if (!res.ok) {
                    await this._refreshAndAwait();
                    continue;
                }

                // 按序点击（原图坐标 → 显示坐标换算）
                const target = document.querySelector('.verify-img-panel img') ||
                    document.querySelector('.verify-img-panel');
                if (!target) { diag('未找到验证码图元素'); return 'failed'; }
                const rect = target.getBoundingClientRect();
                const sx = rect.width / (target.naturalWidth || rect.width);
                const sy = rect.height / (target.naturalHeight || rect.height);
                diag('点击目标=' + target.className + ' natural=' + target.naturalWidth + 'x' + target.naturalHeight + ' rect=' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ' 点=' + JSON.stringify(res.points));
                const markerCount = () => document.querySelectorAll('.verify-img-panel [class*="point"], .verify-img-panel [class*="move"]').length;
                const before = markerCount();
                for (const [x, y] of res.points) {
                    target.dispatchEvent(new MouseEvent('click', {
                        bubbles: true, cancelable: true, view: window,
                        clientX: rect.left + x * sx, clientY: rect.top + y * sy,
                    }));
                    await sleep(150);
                }
                diag('点击后标记数 ' + before + '→' + markerCount());

                // 等结果：浮层关闭 = 校验通过（SPA 自动提交订单）
                const r = await this._waitResult();
                diag('attempt' + attempt + ' 结果=' + r);
                if (r === 'solved') return 'solved';
                await this._refreshAndAwait();
            }
            return 'failed';
        },

        async _waitResult() {
            const t0 = Date.now();
            while (Date.now() - t0 < RESULT_TIMEOUT_MS) {
                if (!document.querySelector('.verifybox') || !document.querySelector('.verifybox').offsetParent) {
                    return 'solved';
                }
                await sleep(150);
            }
            return 'timeout';
        },

        // 点刷新换图，并等待新载荷到达
        async _refreshAndAwait() {
            this._payload = null;
            const rf = document.querySelector('.verify-refresh');
            if (rf) rf.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            for (let i = 0; i < 20 && !this._payload; i++) await sleep(150);
        },
    };

    window.addEventListener('vg_captcha_raw', e => {
        try {
            const b = JSON.parse(e.detail);
            const rd = (b.data && b.data.repData) || {};
            let words = rd.wordList;
            // 兜底：响应无 wordList 时从提示文本解析"请依次点击：X, Y, Z"
            if (!words || !words.length) {
                const msg = document.querySelector('.verify-msg');
                const text = msg ? msg.innerText.replace(/请依次点击[:：]?/, '') : '';
                words = text.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
            }
            if (rd.originalImageBase64 && words && words.length) {
                auto._payload = { img: rd.originalImageBase64, words };
            }
        } catch (e2) { /* 非 JSON 忽略 */ }
    });

    window.__VG_CAPTCHA_AUTO__ = auto;
})();
