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
        'login_api_key', 'login_model', 'login_autofill', 'login_autologin'
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
            statusBox.innerHTML = `NJU ToolBox: ${msg}`;
            statusBox.style.color = color;
            statusBox.style.borderColor = color;
        };

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

            if (!cfg['login_api_key']) {
                updateStatus('未配置 API Key', '#ff4d4f');
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

                // 核心修复：自动清理末尾多余的 /chat/completions 确保拼接正确
                let safeBaseUrl = cfg['login_api_url'] || "https://api.siliconflow.cn/v1";
                safeBaseUrl = safeBaseUrl.replace(/\/chat\/completions\/?$/, '');

                // 带重试的验证码识别函数：约束模型返回恰好 4 位字符
                async function recognizeCaptcha(b64, retry = 0) {
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
                            max_tokens: 5,
                            temperature: isRetry ? 0.01 : 0.1
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`API Error: ${response.status}`);
                    }

                    const data = await response.json();
                    let text = data.choices[0].message.content.trim();
                    console.log(`[NJU ToolBox] 原始回复${isRetry ? '(重试)' : ''}:`, text);

                    // 清洗数据
                    text = text.replace(/beginofbox.*?endofbox|<box>.*?<\/box>|box/gi, '').replace(/[^a-zA-Z0-9]/g, '');
                    if (text.length > 4) {
                        text = text.substring(text.length - 4);
                    }

                    if (text.length === 4) return text;           // 成功
                    if (retry < 1) return recognizeCaptcha(b64, 1);  // 重试一次
                    return null;                                   // 重试后仍失败
                }

                const code = await recognizeCaptcha(base64);
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