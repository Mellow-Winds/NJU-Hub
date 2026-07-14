// background.js - 动态 AI 转发中枢

// ===== NJU 域名请求头伪装 =====
// NJU 各系统（ehall / 教务 / SeaTable 等）会检查 Origin/Referer，
// 拒绝 chrome-extension:// 或非预期域名来源 → 剥离以伪装成无头请求
const RULE_NAV = 1;   // 页面导航（window.open / chrome.tabs.create / <a> 跳转）
const RULE_XHR = 2;   // XHR 请求（SeaTable API 等）

async function ensureHeaderRules() {
    const rules = [
        {
            id: RULE_NAV,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: [
                    { header: "referer", operation: "remove" },
                    { header: "origin", operation: "remove" }
                ]
            },
            condition: {
                urlFilter: "*://*.nju.edu.cn/*",
                resourceTypes: ["main_frame", "sub_frame"]
            }
        },
        {
            id: RULE_XHR,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: [
                    { header: "origin", operation: "remove" },
                    { header: "referer", operation: "remove" }
                ]
            },
            condition: {
                urlFilter: "https://table.nju.edu.cn/api-gateway/*",
                resourceTypes: ["xmlhttprequest"]
            }
        }
    ];

    // 先检查是否已注册
    try {
        const existing = await chrome.declarativeNetRequest.getSessionRules({ ruleIds: [RULE_NAV, RULE_XHR] });
        if (existing && existing.length === 2) return;
    } catch (_) { /* getSessionRules 不可用则跳过，直接注册 */ }

    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [RULE_NAV, RULE_XHR],
        addRules: rules
    });
}

// Service Worker 启动时立即注册
ensureHeaderRules();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
        return false;
    }

    if (request.action === 'callAI') {
        // 解构 payload，提取基础信息和“剩余所有参数” (...rest)
        const { apiKey, baseUrl, model, messages, ...rest } = request.payload;

        console.log(`[后台] 接收到请求，准备调用: ${model}`);

        fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                // 动态参数：优先使用 payload 传来的值，否则使用默认值
                max_tokens: rest.max_tokens || 500,
                temperature: rest.temperature || 0.7,
                ...rest // 将 rest 中其他参数（如 top_p 等）也解构进去
            })
        })
            .then(async response => {
                const data = await response.json();

                if (response.ok && data.choices) {
                    console.log("[后台] 识别结果:", data.choices[0].message.content);
                    sendResponse({ success: true, data: data.choices[0].message.content });
                } else {
                    const errorMsg = data.error?.message || response.statusText;
                    console.error("[后台] API 报错:", errorMsg);
                    sendResponse({ success: false, error: errorMsg });
                }
            })
            .catch(error => {
                console.error("[后台] 网络错误:", error);
                sendResponse({ success: false, error: error.toString() });
            });

        return true; // 保持异步通道开启
    }

    if (request.action === 'fetchJson') {
        const { url } = request.payload;
        fetch(url, { cache: 'no-cache', credentials: 'omit' })
            .then(async response => {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    sendResponse({ ok: response.ok, status: response.status, data });
                } catch (e) {
                    sendResponse({ ok: response.ok, status: response.status, data: null, rawText: text.substring(0, 500), parseError: e.message });
                }
            })
            .catch(error => {
                sendResponse({ ok: false, status: 0, error: error.toString() });
            });
        return true;
    }

    if (request.action === 'seatableRequest') {
        const { url, method, headers, body } = request.payload;

        const fetchOpts = { method, headers, credentials: 'omit' };
        if (body) fetchOpts.body = body;

        // 先确保头剥离规则已注册，再发请求
        ensureHeaderRules().then(() => fetch(url, fetchOpts))
            .then(async response => {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    sendResponse({ ok: response.ok, status: response.status, data });
                } catch (e) {
                    // JSON 解析失败时返回原始文本以便调试
                    sendResponse({ ok: response.ok, status: response.status, data: null, rawText: text.substring(0, 500), parseError: e.message });
                }
            })
            .catch(error => {
                sendResponse({ ok: false, status: 0, error: error.toString() });
            });

        return true; // 保持异步通道开启
    }
});