// background.js - 动态 AI 转发中枢

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});