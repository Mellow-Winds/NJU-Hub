// background.js - 动态 AI 转发中枢

// ===== NJU 域名请求头伪装 =====
// NJU 各系统（ehall / 教务 / SeaTable 等）会检查 Origin/Referer，
// 拒绝 chrome-extension:// 或非预期域名来源 → 剥离以伪装成无头请求
const RULE_NAV = 1;   // 页面导航（window.open / chrome.tabs.create / <a> 跳转）
const RULE_XHR = 2;   // XHR 请求（SeaTable API 等）
const RULE_HTTPS_UPGRADE = 3;  // HTTP→HTTPS 升级（ggtypt 平台 Mixed Content 修复）

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
        },
        // ggtypt 平台服务器会将未登录请求 302 重定向到 http://ggtypt.nju.edu.cn/pft/login
        // 在 HTTPS 页面中触发 Mixed Content 阻断。此规则将 HTTP 升级为 HTTPS。
        {
            id: RULE_HTTPS_UPGRADE,
            priority: 2,
            action: {
                type: "redirect",
                redirect: { transform: { scheme: "https" } }
            },
            condition: {
                urlFilter: "http://ggtypt.nju.edu.cn/*",
                resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "other"]
            }
        }
    ];

    // 先检查是否已注册
    try {
        const existing = await chrome.declarativeNetRequest.getSessionRules({ ruleIds: [RULE_NAV, RULE_XHR, RULE_HTTPS_UPGRADE] });
        if (existing && existing.length === 3) return;
    } catch (_) { /* getSessionRules 不可用则跳过，直接注册 */ }

    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [RULE_NAV, RULE_XHR, RULE_HTTPS_UPGRADE],
        addRules: rules
    });
}

// Service Worker 启动时立即注册
ensureHeaderRules();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'lmsOpenWorker') {
        const courseId = String(request.courseId || '').match(/^\d+$/)?.[0];
        if (!courseId) {
            sendResponse({ ok: false, error: '无效的课程 ID' });
            return false;
        }

        const workerUrl = `https://lms.nju.edu.cn/course/${courseId}/courseware?njuhub_lms_worker=1#/`;
        chrome.tabs.create({ url: workerUrl, active: false }, (tab) => {
            if (chrome.runtime.lastError || !tab?.id) {
                sendResponse({ ok: false, error: chrome.runtime.lastError?.message || '无法创建后台标签页' });
                return;
            }
            sendResponse({ ok: true, tabId: tab.id });
        });
        return true;
    }

    if (request.action === 'lmsCloseWorker') {
        const tabId = Number(request.tabId);
        if (!Number.isInteger(tabId)) {
            sendResponse({ ok: false, error: '无效的后台标签页 ID' });
            return false;
        }
        chrome.tabs.remove(tabId, () => {
            sendResponse({ ok: !chrome.runtime.lastError, error: chrome.runtime.lastError?.message || null });
        });
        return true;
    }

    if (request.action === 'lmsWorkerResolve') {
        const tabId = Number(request.tabId);
        if (!Number.isInteger(tabId)) {
            sendResponse({ ok: false, error: '无效的后台标签页 ID' });
            return false;
        }

        const targetUrl = String(request.activityUrl || '');
        if (!/^https:\/\/lms\.nju\.edu\.cn\/course\/\d+\/learning-activity\?njuhub_lms_worker=1#\/\d+/.test(targetUrl)) {
            sendResponse({ ok: false, error: '无效的活动页面地址' });
            return false;
        }

        const forwardResolve = () => {
            const injectBridge = chrome.scripting.executeScript({
                target: { tabId, allFrames: true },
                world: 'MAIN',
                files: ['scripts/lms_preview_bridge.js']
            }).catch(() => null);

            injectBridge.finally(() => setTimeout(() => chrome.tabs.sendMessage(tabId, {
                action: 'lmsWorkerResolveCurrent',
                file: request.file || null
            }, (result) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                    return;
                }
                sendResponse(result || { ok: false, error: '后台页面没有返回结果' });
            }), 150));
        };

        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            chrome.tabs.onUpdated.removeListener(onUpdated);
            sendResponse({ ok: false, error: '活动页面加载超时' });
        }, 20000);

        const onUpdated = (updatedTabId, changeInfo) => {
            if (updatedTabId !== tabId || changeInfo.status !== 'complete' || settled) return;
            settled = true;
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(onUpdated);
            setTimeout(forwardResolve, 300);
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.tabs.update(tabId, { url: targetUrl }, () => {
            if (chrome.runtime.lastError && !settled) {
                settled = true;
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(onUpdated);
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            }
        });
        return true;
    }

    if (request.action === 'lmsWorkerDownload') {
        const url = String(request.url || '');
        const filename = String(request.filename || 'download');
        let parsed;
        try { parsed = new URL(url); } catch (_) { parsed = null; }
        if (!parsed || !['lms.nju.edu.cn', 'lms-media.nju.edu.cn'].includes(parsed.hostname)) {
            sendResponse({ ok: false, error: '下载地址域名不受信任' });
            return false;
        }

        chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
            if (chrome.runtime.lastError || downloadId == null) {
                sendResponse({ ok: false, error: chrome.runtime.lastError?.message || '浏览器下载失败' });
                return;
            }
            sendResponse({ ok: true, downloadId });
        });
        return true;
    }

    if (request.action === 'lmsWorkerCommand') {
        const tabId = Number(request.tabId);
        if (!Number.isInteger(tabId)) {
            sendResponse({ ok: false, error: '无效的后台标签页 ID' });
            return false;
        }
        chrome.tabs.sendMessage(tabId, request.command || {}, (result) => {
            if (chrome.runtime.lastError) {
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                return;
            }
            sendResponse(result || { ok: false, error: '后台页面没有返回结果' });
        });
        return true;
    }

    if (request.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
        return false;
    }

    if (request.action === 'injectNotifyBridge') {
        // 在主世界注入通知跳转延迟桥接（绕过页面 CSP）
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            world: 'MAIN',
            files: ['scripts/xk/xk_notify_bridge.js']
        }).catch(err => console.error('[后台] 注入通知桥接失败:', err));
        return false;
    }

    if (request.action === 'injectVenueOcr') {
        // 场馆抢票：主世界注入验证码 XHR 钩子 + 隔离世界注入 OCR 推理包
        const tabId = sender.tab && sender.tab.id;
        if (!Number.isInteger(tabId)) { sendResponse({ ok: false }); return false; }
        chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            files: ['scripts/venue_grab/vg_captcha_hook.js']
        }).catch(err => console.error('[后台] 注入验证码钩子失败:', err));
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['libs/venue_ocr/vg_ocr_bundle.js']
        }).then(() => {
            // 预热：立刻加载 det+rec 模型会话（验证码出现时即可推理，不用等 70MB）
            const modelsBase = chrome.runtime.getURL('libs/venue_ocr/');
            return chrome.scripting.executeScript({
                target: { tabId },
                func: (base) => window.__VG_OCR__ && window.__VG_OCR__.prewarm(base),
                args: [modelsBase],
            });
        }).catch(err => console.error('[后台] 注入 OCR 包失败:', err));
        sendResponse({ ok: true });
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
