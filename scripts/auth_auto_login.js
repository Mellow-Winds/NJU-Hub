/**
 * scripts/auth_auto_login.js
 *
 * 目标页面: authserver.nju.edu.cn/authserver/login* (南京大学统一认证登录页)
 * 功能概述: 自动填充账号密码 + AI 视觉模型识别验证码，支持自动提交
 * 触发方式: 页面加载时自动注入
 * 依赖模块: background.js (AI 视觉识别请求转发)
 *
 * 详细说明:
 * 1. 读取用户配置的学号和统一认证密码，自动填入登录表单
 * 2. 捕获验证码图片 → Canvas 绘制 → 转为 Base64 → 发送给 LLM 视觉模型识别
 * 3. 支持两种模式：自动填充（仅填表）和自动登录（填表 + 自动提交）
 * 4. 验证码识别失败时自动重试，带约束 prompt 确保模型输出恰好 4 位字符
 * 5. 顶部注入状态提示框，实时显示"正在识别验证码…"等进度信息
 */

(function() {
    'use strict';

    const STORAGE_KEYS = [
        'toggle-login', 'login_user', 'login_pass', 'login_api_url',
        'login_api_key', 'login_model', 'login_ai_enable', 'login_autofill', 'login_autologin',
        'login_extract_api_url', 'login_extract_api_key', 'login_extract_model'
    ];

    chrome.storage.local.get(STORAGE_KEYS, (cfg) => {
        // 总开关或自动填充关闭则退出
        if (cfg['toggle-login'] === false || cfg['login_autofill'] === false) return;

        // --- 防护：确保只执行一次 ---
        let hasRun = false;

        // --- UI: 创建战术状态提示框 ---
        const statusBox = document.createElement('div');
        statusBox.id = 'nju-commander-status';
        statusBox.style.cssText = `
            position: fixed; top: 15px; left: 50%; transform: translateX(-50%);
            z-index: 10000; background: rgba(30, 30, 30, 0.9); color: #00f2fe;
            padding: 10px 20px; border-radius: 25px; font-size: 14px; font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid #444;
            backdrop-filter: blur(8px); pointer-events: none; transition: all 0.3s ease;
        `;
        document.body.appendChild(statusBox);

        const updateStatus = (msg, color = "#00f2fe") => {
            statusBox.innerHTML = `NJU-Hub: ${msg}`;
            statusBox.style.color = color;
            statusBox.style.borderColor = color;
        };

        // --- LLM 验证码识别函数 ---

        // 带重试的验证码识别：约束模型返回恰好 4 位字符
        async function recognizeCaptcha(b64, retry = 0) {
            let safeBaseUrl = cfg['login_api_url'] || "https://api.siliconflow.cn/v1";
            safeBaseUrl = safeBaseUrl.replace(/\/chat\/completions\/?$/, '');

            const isRetry = retry > 0;
            const prompt = isRetry
                ? 'The image is a 4-character captcha code. Output the 4 characters ONLY. If you output anything else, the system will reject it. 4 characters. No more, no less.'
                : 'Read this captcha image. It contains exactly 4 alphanumeric characters. Output those 4 characters and nothing else. Do not add spaces, punctuation, newlines, or any other text. Just the 4 characters. Example output: 3AB9';

            const response = await fetch(`${safeBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg['login_api_key']}`
                },
                body: JSON.stringify({
                    model: cfg['login_model'] || "Qwen/Qwen2-VL-7B-Instruct",
                    messages: [{
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: b64 } }
                        ]
                    }],
                    max_tokens: 20,
                    temperature: isRetry ? 0.01 : 0.1
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const rawText = data.choices[0].message.content.trim();
            console.log(`[NJU-Hub] 原始回复${isRetry ? '(重试)' : ''}:`, rawText);

            // 路线A：强化清洗 —— 先剥离所有标签块，再提取4位验证码
            let text = rawText;
            // 1. 剥离 <think>...</think>、<reasoning>...</reasoning>、<box>...</box> 等标签块（跨行匹配）
            text = text.replace(/<(think|reasoning|box|system|assistant)>[\s\S]*?<\/\1>/gi, '');
            // 2. 剥离自闭合或未闭合的残留标签
            text = text.replace(/<\/?(think|reasoning|box|system|assistant)>/gi, '');
            // 3. 优先匹配独立的4位字母数字片段（如 "The answer is A3B9" → A3B9）
            const m = text.match(/\b([A-Za-z0-9]{4})\b/);
            if (m) {
                text = m[1];
            } else {
                // 退化：去非字母数字后取前4位
                text = text.replace(/[^a-zA-Z0-9]/g, '');
                if (text.length >= 4) text = text.substring(0, 4);
            }

            if (text.length === 4) return text;  // 路线A成功

            // 路线B：二次提取 —— 把原始回复交给文本模型提取4位验证码
            const extracted = await extractCaptcha(rawText);
            if (extracted) {
                console.log(`[NJU-Hub] 二次提取成功: ${extracted}`);
                return extracted;
            }

            // 路线A+B均失败，触发重试
            if (retry < 1) return recognizeCaptcha(b64, retry + 1);
            return null;
        }

        // 二次提取函数：用文本模型从模型A的原始回复中提取4位验证码
        async function extractCaptcha(rawText) {
            // 模型B未配置则跳过
            if (!cfg['login_extract_model'] || !cfg['login_extract_api_key']) return null;

            let extractBaseUrl = cfg['login_extract_api_url'] || cfg['login_api_url'] || "https://api.siliconflow.cn/v1";
            extractBaseUrl = extractBaseUrl.replace(/\/chat\/completions\/?$/, '');

            try {
                const response = await fetch(`${extractBaseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cfg['login_extract_api_key']}`
                    },
                    body: JSON.stringify({
                        model: cfg['login_extract_model'],
                        messages: [{ role: "user", content: '从以下文本中提取验证码。验证码恰好是4个字母或数字字符。只输出这4个字符，不要输出任何其他内容。\n\n文本：' + rawText }],
                        max_tokens: 10,
                        temperature: 0
                    })
                });

                if (!response.ok) return null;

                const data = await response.json();
                let text = data.choices[0].message.content.trim();
                text = text.replace(/[^a-zA-Z0-9]/g, '');
                return text.length === 4 ? text : null;
            } catch (e) {
                console.warn('[NJU-Hub] 二次提取失败:', e.message);
                return null;
            }
        }

        // --- 核心执行函数 ---
        async function runLoginSequence() {
            // 防止重复执行
            if (hasRun) return;
            hasRun = true;

            const uInput = document.getElementById('username');
            const pInput = document.getElementById('password');
            const img = document.getElementById('captchaImg');

            // 1. 自动填充凭证
            if (uInput && cfg['login_user']) {
                uInput.value = cfg['login_user'];
                uInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (pInput && cfg['login_pass']) {
                pInput.value = cfg['login_pass'];
                pInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            if (!img) return;
            if (img.naturalWidth === 0) {
                // 图片还未加载，等待加载完成后再执行
                img.addEventListener('load', runLoginSequence, { once: true });
                return;
            }

            try {
                // 捕获验证码 Base64
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                const base64 = canvas.toDataURL('image/jpeg', 0.95);

                updateStatus('正在识别验证码...', '#ffd700');

                // === 优先通道：本地 ONNX 推理（ddddocr 模型） ===
                let code = null;
                if (typeof CaptchaOCR !== 'undefined') {
                    try {
                        updateStatus('本地模型识别中...', '#00f2fe');
                        console.log('[NJU-Hub] === 尝试本地 ONNX 推理 ===');
                        code = await CaptchaOCR.recognize(img);
                        if (code) {
                            console.log('[NJU-Hub] ONNX 本地识别成功:', code);
                        } else {
                            console.warn('[NJU-Hub] ONNX 本地识别返回 null，降级到 LLM');
                        }
                    } catch (onnxErr) {
                        console.warn('[NJU-Hub] ONNX 本地识别异常，降级到 LLM:', onnxErr.message || onnxErr);
                        console.warn('[NJU-Hub] 异常堆栈:', onnxErr.stack);
                    }
                } else {
                    console.warn('[NJU-Hub] CaptchaOCR 模块未加载，直接使用 LLM 通道');
                }

                // === 后备通道：LLM 视觉模型识别 ===
                if (!code) {
                    if (cfg['login_ai_enable'] === false) {
                        console.log('[NJU-Hub] AI 识别已关闭，跳过 LLM 降级');
                        updateStatus('本地识别失败，AI 已关闭', '#ff4d4f');
                    } else if (!cfg['login_api_key']) {
                        updateStatus('ONNX 识别失败且未配置 API Key', '#ff4d4f');
                    } else {
                        updateStatus('LLM 识别中...', '#ffd700');
                        try {
                            const llmCode = await recognizeCaptcha(base64);
                            if (llmCode) {
                                code = llmCode;
                                updateStatus(`LLM识别成功: ${code}`, "#4cd964");
                            }
                        } catch (llmErr) {
                            console.error('[NJU-Hub] LLM 识别异常:', llmErr.message || llmErr);
                            updateStatus(`LLM 识别失败: ${llmErr.message || '未知错误'}`, '#ff4d4f');
                        }
                    }
                }

                if (code) {
                    updateStatus(`识别成功: ${code}`, "#4cd964");
                    const cInput = document.getElementById('captcha');
                    if (cInput) {
                        cInput.value = code;
                        // 触发事件确保教务系统 React/Vue 框架感知输入
                        ['input', 'change', 'blur'].forEach(ev =>
                            cInput.dispatchEvent(new Event(ev, { bubbles: true }))
                        );

                        // 4. 自动登录开关判断
                        if (cfg['login_autologin'] === true) {
                            setTimeout(() => {
                                const btn = document.querySelector('.auth_login_btn') || document.getElementById('login_submit');
                                if (btn) {
                                    updateStatus('正在发起登录...', '#4cd964');
                                    btn.click();
                                }
                            }, 800);
                        } else {
                            updateStatus('识别完成，请手动登录');
                        }
                    }
                } else {
                    updateStatus('验证码识别失败，请手动输入', '#ff4d4f');
                }

            } catch (err) {
                console.error(err);
                updateStatus(`错误: ${err.message || 'API 超时'}`, '#ff4d4f');
            }
        }

        // 启动逻辑
        if (document.readyState === 'complete') {
            runLoginSequence();
        } else {
            window.addEventListener('load', runLoginSequence);
        }
    });
})();