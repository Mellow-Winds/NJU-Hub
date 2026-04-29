// scripts/eval.js - 自动评教 (AI 独立配置 + 动态参数版)

(function() {
    'use strict';

    // 1. 改为读取评教专用的独立配置
    const keys = ['toggle-eval', 'eval_api_key', 'eval_api_url', 'eval_model'];

    chrome.storage.local.get(keys, (cfg) => {
        if (cfg['toggle-eval'] === false) return;

        console.log('[NJU-Hub] Auto-Eval Module Loaded (AI Edition)');

        // 备用语料库
        const BACKUP_COMMENTS = [
            "老师授课认真，知识点讲解清晰。",
            "课程内容充实，收获很大，老师辛苦了！",
            "课堂氛围很好，老师很负责。",
            "教学深入浅出，很有启发性。",
            "非常喜欢这门课，老师很有耐心。"
        ];

        // 注入按钮逻辑 (保持原样)
        const injectButton = () => {
            if (document.getElementById('nju-eval-btn')) return;
            const btn = document.createElement('div');
            btn.id = 'nju-eval-btn';
            btn.innerText = '一键 AI 满分';
            btn.style.cssText = `
                position: fixed; bottom: 100px; right: 20px; z-index: 9999;
                background: linear-gradient(135deg, #6c5ce7, #a29bfe);
                color: white; padding: 10px 20px; border-radius: 30px;
                font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(108,92,231,0.4);
                transition: transform 0.2s; user-select: none;
            `;

            btn.onclick = async () => {
                btn.innerText = 'AI 生成中...';
                try {
                    await runAutoEval(cfg);
                    btn.innerText = '评价完成';
                    btn.style.background = '#2ecc71';
                } catch (e) {
                    btn.innerText = '出错了';
                }
                setTimeout(() => {
                    btn.innerText = '一键 AI 满分';
                    btn.style.background = 'linear-gradient(135deg, #6c5ce7, #a29bfe)';
                }, 3000);
            };
            document.body.appendChild(btn);
        };

        // 核心执行函数
        const runAutoEval = async (config) => {
            // A. 勾选满分选项
            const labels = document.querySelectorAll('.bh-radio-label, .bh-radio, label');
            labels.forEach(label => {
                const text = label.innerText.trim();
                if (text.includes("很好") || text.includes("非常满意") || text.includes("完全符合")) {
                    label.click();
                    const icon = label.querySelector('i.bh-choice-helper');
                    if(icon) icon.click();
                }
            });

            // B. 填写评语 (AI 生成)
            const textAreas = document.querySelectorAll('textarea');
            if (textAreas.length === 0) return;

            // 检查独立 Key
            if (!config.eval_api_key) {
                fillWithBackup(textAreas);
                return;
            }

            for (const box of textAreas) {
                if (box.value.length > 5) continue;

                const prompt = `你是一名大学生。请为一门大学课程写一条简短的、正面的教学评价。
                要求：自然、真诚，30-50字，包含老师负责、氛围好等。直接输出评语。`;

                box.placeholder = "AI 正在撰写评价...";

                // 调用时传入更宽松的 Token 限制，保证评语完整
                const comment = await callAI(config, prompt);

                if (comment) {
                    fillInput(box, comment);
                } else {
                    fillWithBackup([box]);
                }
            }
        };

        const callAI = (config, prompt) => {
            return new Promise(resolve => {
                chrome.runtime.sendMessage({
                    action: 'callAI',
                    payload: {
                        apiKey: config.eval_api_key,
                        baseUrl: config.eval_api_url,
                        model: config.eval_model,
                        messages: [{ role: "user", content: prompt }],
                        // 动态参数：评语不需要像验证码那么短，给 150 足够了
                        max_tokens: 150,
                        temperature: 0.8
                    }
                }, (res) => {
                    if (res && res.success) resolve(res.data);
                    else resolve(null);
                });
            });
        };

        const fillInput = (box, text) => {
            box.value = text;
            ['input', 'change', 'blur'].forEach(ev => box.dispatchEvent(new Event(ev, { bubbles: true })));
        };

        const fillWithBackup = (boxes) => {
            boxes.forEach(box => {
                const randomMsg = BACKUP_COMMENTS[Math.floor(Math.random() * BACKUP_COMMENTS.length)];
                fillInput(box, randomMsg);
            });
        };

        setTimeout(injectButton, 2000);
    });
})();