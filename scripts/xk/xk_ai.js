/**
 * scripts/xk/xk_ai.js
 *
 * AI 分析层：SeaTable 评价库同步、LLM 分析、AI 缓存、Popover 展示
 * 依赖：window.__XK__, background.js (AI 请求转发)
 *
 * 注意：评价系统（关键词红黑榜）将在 Phase 3 单独实现
 */

(function () {
    'use strict';

    const { GM_getValue, GM_setValue, STORAGE } = window.__XK__;

    const THEME = {
        GOOD: '#1b5e20', BAD: '#c62828', PURPLE: '#660874',
        P80: '#4caf50', P60: '#fdd835', P40: '#ff9800'
    };

        // 全局共享 popover timer，供 badges 和 ai 模块共同使用
    window.__popoverTimer = null;

    /**
     * 获取 AI 设置（从 options 页同步）
     */
    const getAISettings = () => ({
        url: GM_getValue(STORAGE.API_URL) || 'https://api.siliconflow.cn/v1',
        key: GM_getValue(STORAGE.API_KEY, ''),
        model: GM_getValue(STORAGE.MODEL) || 'Qwen/Qwen3-8B',
        major: GM_getValue(STORAGE.MAJOR) || '未知专业',
        pref: GM_getValue(STORAGE.PREF) || '给分高，事少，不点名'
    });

    /**
     * 设置 AI 标签状态：分数、颜色、hover Popover、点击查看原文
     * @param {HTMLElement} tag - 标签元素
     * @param {object} data - AI 分析结果 {综合评分, 给分, 事少, 签到, 总结}
     * @param {string} cacheKey - 缓存键 "课程名#教师名"
     */
    const setAITagState = (tag, data, cacheKey) => {
        const score = parseFloat(data['综合评分']);
        let label = '一般', color = THEME.P60;
        if (score >= 8.5) { label = '力荐'; color = THEME.GOOD; }
        else if (score >= 7.0) { label = '推荐'; color = THEME.P80; }
        else if (score >= 5.0) { label = '一般'; color = THEME.P40; }
        else { label = '劝退'; color = THEME.BAD; }

        tag.innerText = `${label} (${score})`;
        tag.style.background = color;
        tag.style.color = '#fff';
        tag.style.cursor = 'pointer';
        if (cacheKey) tag.dataset.ckey = cacheKey;

        tag.onmouseenter = () => {
            if (tag._showingComments) return;
            clearTimeout(window.__popoverTimer);
            window.__popoverTimer = null;
            const pop = document.getElementById('nj-popover');
            if (!pop) return;
            pop.innerHTML = `
                <div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">AI 深度解析报告</div>
                <div class="pop-item">● <b>给分:</b> ${data['给分']}</div>
                <div class="pop-item">● <b>任务:</b> ${data['事少']}</div>
                <div class="pop-item">● <b>签到:</b> ${data['签到']}</div>
                <div style="font-size:12px; margin-top:8px; padding-top:8px; border-top:1px dashed #ccc; color:#1b5e20; font-weight:bold;">结论: ${data['总结']}</div>
            `;
            pop.style.maxHeight = '400px';
            const r = tag.getBoundingClientRect();
            pop.style.left = Math.min(r.left, window.innerWidth - 380) + 'px';
            pop.style.top = (r.bottom + 8) + 'px';
            pop.classList.add('visible');
        };

        tag.onmouseleave = () => {
            if (tag._showingComments) return;
            window.__popoverTimer = setTimeout(() => {
                const pop = document.getElementById('nj-popover');
                if (pop) pop.classList.remove('visible');
            }, 300);
        };

        // 点击查看原始评价（按来源分组）
        tag.onclick = (e) => {
            e.stopPropagation();
            if (!cacheKey) return;
            const db = window.__ratingsDB__ || {};
            const srcData = db[cacheKey];
            if (!srcData || typeof srcData !== 'object') return;

            const pop = document.getElementById('nj-popover');
            if (!pop) return;
            clearTimeout(window.__popoverTimer);

            if (tag._showingComments) {
                pop.classList.remove('visible');
                tag._showingComments = false;
                return;
            }

            tag._showingComments = true;

            // 按来源分组展示
            const SRC_LABELS = {
                'nju_course_ratings': '📖 鼓励你学哪门课',
                '2020': '🏷️ 2020 红黑榜', '2021': '🏷️ 2021 南小宝',
                '2022': '🏷️ 2022 红黑榜', '2023': '🏷️ 2023 红黑榜',
                '2024冬': '🏷️ 2024冬 红黑榜', '2024春': '🏷️ 2024春 红黑榜',
                '2025春': '🏷️ 2025春 红黑榜'
            };

            let totalCount = 0;
            let html = `<div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">📋 原始评价 — 点击关闭</div>`;

            for (const [src, label] of Object.entries(SRC_LABELS)) {
                const reviews = srcData[src];
                if (!reviews || !Array.isArray(reviews) || reviews.length === 0) continue;
                totalCount += reviews.length;
                html += `<div style="font-weight:700;color:#333;margin:10px 0 4px;font-size:13px;">${label} (${reviews.length}条)</div>`;
                reviews.forEach(c => {
                    const safe = String(c).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                    html += `<div class="pop-item">● ${safe}</div>`;
                });
            }

            if (totalCount === 0) {
                html += `<div class="pop-item" style="color:#999;">暂无评价</div>`;
            }

            pop.innerHTML = html;
            pop.style.maxHeight = '520px';

            const r = tag.getBoundingClientRect();
            pop.style.left = Math.min(r.left, window.innerWidth - 380) + 'px';
            pop.style.top = (r.bottom + 8) + 'px';
            pop.classList.add('visible');

            const close = (ev) => {
                if (!pop.contains(ev.target) && ev.target !== tag) {
                    pop.classList.remove('visible');
                    tag._showingComments = false;
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 10);
        };
    };

    /**
     * 初始化 Popover 容器
     */
    const initPopover = () => {
        if (document.getElementById('nj-popover')) return;
        const pop = document.createElement('div');
        pop.id = 'nj-popover';
        pop.style.cssText = `
            position: fixed; z-index: 2147483647; width: 360px; max-height: 400px; overflow-y: auto;
            background: rgba(255,255,255,0.98); border-radius: 16px; padding: 18px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25); opacity: 0; pointer-events: none;
            transform: scale(0.96) translateY(5px); transition: 0.2s;
            font-family: sans-serif;
        `;
        document.body.appendChild(pop);

        // 添加 visible 类控制
        const style = document.createElement('style');
        style.textContent = `
            #nj-popover.visible { opacity: 1 !important; pointer-events: auto !important; transform: scale(1) translateY(0) !important; }
            .pop-item { font-size: 12px; color: #555; margin-bottom: 6px; border-bottom: 1px dashed #eee; padding-bottom: 6px; line-height: 1.7; }
        `;
        document.head.appendChild(style);

        pop.onmouseenter = () => {
            clearTimeout(window.__popoverTimer);
        };
        pop.onmouseleave = () => {
            window.__popoverTimer = setTimeout(() => pop.classList.remove('visible'), 300);
        };
    };

    /**
     * 三层加载 AI 缓存：Local > GitHub Raw > Built-in
     * 返回最终使用的 aiCache 对象
     */
    const loadAICache = async () => {
        // Layer 1: 本地缓存
        let aiCache = GM_getValue(STORAGE.AI_CACHE, null);
        if (aiCache && Object.keys(aiCache).length > 0) {
            console.log('[NJU-Hub] AI 缓存: 使用本地缓存 (' + Object.keys(aiCache).length + '条)');
            return aiCache;
        }

        // Layer 2: GitHub Raw 每日拉取
        const lastFetch = GM_getValue(STORAGE.AI_LAST_FETCH, 0);
        const now = Date.now();
        const githubUrl = STORAGE.GITHUB_RAW;

        if (!lastFetch || (now - lastFetch) > 86400000) {
            try {
                console.log('[NJU-Hub] AI 缓存: 尝试从 GitHub 拉取...');
                const resp = await fetch(githubUrl, { cache: 'no-cache' });
                if (resp.ok) {
                    const remote = await resp.json();
                    if (remote && Object.keys(remote).length > 0) {
                        GM_setValue(STORAGE.AI_CACHE, remote);
                        GM_setValue(STORAGE.AI_LAST_FETCH, now);
                        console.log('[NJU-Hub] AI 缓存: GitHub 拉取成功 (' + Object.keys(remote).length + '条)');
                        return remote;
                    }
                }
            } catch (e) {
                console.warn('[NJU-Hub] AI 缓存: GitHub 拉取失败, 回退到内置缓存', e);
            }
        }

        // Layer 3: 内置缓存 (data/ai_cache.json)
        try {
            console.log('[NJU-Hub] AI 缓存: 加载内置缓存...');
            const builtinUrl = chrome.runtime.getURL('data/ai_cache.json');
            const resp = await fetch(builtinUrl);
            if (resp.ok) {
                const builtin = await resp.json();
                if (builtin && Object.keys(builtin).length > 0) {
                    GM_setValue(STORAGE.AI_CACHE, builtin);
                    GM_setValue(STORAGE.AI_LAST_FETCH, now);
                    console.log('[NJU-Hub] AI 缓存: 内置缓存加载成功 (' + Object.keys(builtin).length + '条)');
                    return builtin;
                }
            }
        } catch (e) {
            console.warn('[NJU-Hub] AI 缓存: 内置缓存加载失败', e);
        }

        return {};
    };

    /**
     * 一键 AI 分析：批量处理所有待分析课程
     */
    const analyzeAllPending = async () => {
        const tasks = window.pendingAITasks || [];
        if (!tasks.length) {
            alert('当前页面没有待分析的课程。');
            return;
        }

        const settings = getAISettings();
        if (!settings.key) {
            alert('请先在插件设置中配置 API Key。');
            return;
        }

        // 更新按钮状态
        const btn = document.getElementById('btn-ai-analyze');
        if (btn) {
            btn.disabled = true;
            btn.innerText = '🤖 分析中...';
        }

        let done = 0;
        const total = tasks.length;
        const aiCache = GM_getValue(STORAGE.AI_CACHE, {});

        for (const task of tasks) {
            try {
                if (btn) btn.innerText = `🤖 分析中 (${done + 1}/${total})...`;

                const prompt = `你是南京大学的一名课程评价分析助手。请根据以下学生对 "${task.course}" 课程（授课教师: ${task.teacher}）的评价，综合分析并给出评分（1-10分制）。

评价内容：
${task.comments.map((c, i) => `${i + 1}. ${c}`).join('\n')}

请按以下格式输出（严格遵守格式，不要输出额外内容）：
综合评分: X.X
给分: <一句话总结给分情况>
事少: <一句话总结任务量>
签到: <一句话总结签到情况>
总结: <一句话综合评价>`;

                const resp = await fetch(`${settings.url}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${settings.key}`
                    },
                    body: JSON.stringify({
                        model: settings.model,
                        messages: [
                            { role: 'system', content: '你是一个课程评价分析助手，只输出指定格式的分析结果。' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.3,
                        max_tokens: 500
                    })
                });

                if (!resp.ok) {
                    console.warn(`[NJU-Hub] AI 分析失败 (${task.cacheKey}): HTTP ${resp.status}`);
                    done++;
                    continue;
                }

                const json = await resp.json();
                const text = json.choices?.[0]?.message?.content || '';

                // 解析 AI 返回
                const result = {};
                const lines = text.split('\n');
                for (const line of lines) {
                    const m = line.match(/^(.+?):\s*(.+)/);
                    if (m) result[m[1].trim()] = m[2].trim();
                }

                if (result['综合评分']) {
                    aiCache[task.cacheKey] = result;
                    GM_setValue(STORAGE.AI_CACHE, aiCache);

                    // 注入 AI 标签到对应 cell
                    const aiTag = document.createElement('span');
                    aiTag.className = 'nj-badge';
                    setAITagState(aiTag, result, task.cacheKey);

                    // 在 cell 中追加（需要换行）
                    const br = document.createElement('br');
                    br.className = 'nj-br';
                    task.cell.appendChild(br);
                    task.cell.appendChild(aiTag);
                }

                done++;
            } catch (err) {
                console.warn(`[NJU-Hub] AI 分析异常 (${task.cacheKey}):`, err);
                done++;
            }
        }

        // 清空待处理队列
        window.pendingAITasks = [];

        if (btn) {
            btn.disabled = false;
            btn.innerText = `🤖 一键AI分析 ✓`;
            setTimeout(() => { btn.innerText = '🤖 一键AI分析'; }, 2000);
        }
    };

    /**
     * 加载评价库 DB：先尝试 GitHub 获取最新，再回退内置
     * 存入全局变量 window.__ratingsDB__（不存 chrome.storage，2MB 太大）
     */
    const loadDB = async () => {
        // 优先尝试 GitHub 获取最新评价库
        const lastFetch = GM_getValue(STORAGE.AI_LAST_FETCH, 0);
        const now = Date.now();

        if (!lastFetch || (now - lastFetch) > 86400000) {
            try {
                console.log('[NJU-Hub] 评价库: 尝试从 GitHub 拉取...');
                const githubUrl = 'https://raw.githubusercontent.com/nju-hub/nju-hub/main/data/merged_ratings.json';
                const resp = await fetch(githubUrl, { cache: 'no-cache' });
                if (resp.ok) {
                    const remote = await resp.json();
                    if (remote && Object.keys(remote).length > 0) {
                        window.__ratingsDB__ = remote;
                        GM_setValue(STORAGE.AI_LAST_FETCH, now);
                        console.log('[NJU-Hub] 评价库: GitHub 拉取成功 (' + Object.keys(remote).length + '门)');
                        return remote;
                    }
                }
            } catch (e) {
                console.warn('[NJU-Hub] 评价库: GitHub 拉取失败, 回退到内置', e);
            }
        }

        // 回退：加载内置评价库
        try {
            console.log('[NJU-Hub] 评价库: 加载内置...');
            const builtinUrl = chrome.runtime.getURL('data/merged_ratings.json');
            const resp = await fetch(builtinUrl);
            if (resp.ok) {
                const builtin = await resp.json();
                if (builtin && Object.keys(builtin).length > 0) {
                    window.__ratingsDB__ = builtin;
                    console.log('[NJU-Hub] 评价库: 内置加载成功 (' + Object.keys(builtin).length + '门)');
                    return builtin;
                }
            }
        } catch (e) {
            console.warn('[NJU-Hub] 评价库: 内置加载失败', e);
        }

        window.__ratingsDB__ = {};
        return {};
    };

    Object.assign(window.__XK__, {
        getAISettings,
        setAITagState,
        initPopover,
        loadAICache,
        loadDB,
        analyzeAllPending
    });
})();