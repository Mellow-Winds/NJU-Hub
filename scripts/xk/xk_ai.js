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

    let popoverTimer = null;

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
            clearTimeout(popoverTimer);
            const pop = document.getElementById('nj-popover');
            if (!pop) return;
            pop.innerHTML = `
                <div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">AI 深度解析报告</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>给分:</b> ${data['给分']}</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>任务:</b> ${data['事少']}</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>签到:</b> ${data['签到']}</div>
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
            popoverTimer = setTimeout(() => {
                const pop = document.getElementById('nj-popover');
                if (pop) pop.classList.remove('visible');
            }, 300);
        };

        // 点击查看原始评价
        tag.onclick = (e) => {
            e.stopPropagation();
            if (!cacheKey) return;
            const db = GM_getValue(STORAGE.DB, {});
            const rawComments = db[cacheKey];
            if (!rawComments || !Array.isArray(rawComments) || rawComments.length === 0) return;

            const pop = document.getElementById('nj-popover');
            if (!pop) return;
            clearTimeout(popoverTimer);

            if (tag._showingComments) {
                pop.classList.remove('visible');
                tag._showingComments = false;
                return;
            }

            tag._showingComments = true;
            let html = `<div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">📋 原始评价 (${rawComments.length}条) — 点击关闭</div>`;
            rawComments.forEach(c => {
                const safe = String(c).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                html += `<div style="font-size:12px;color:#333;margin-bottom:10px;padding:8px 10px;background:#f8f8f8;border-radius:8px;border-left:3px solid ${THEME.PURPLE};line-height:1.7;">${safe}</div>`;
            });
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
        `;
        document.head.appendChild(style);

        pop.onmouseenter = () => clearTimeout(popoverTimer);
        pop.onmouseleave = () => {
            popoverTimer = setTimeout(() => pop.classList.remove('visible'), 300);
        };
    };

    Object.assign(window.__XK__, {
        getAISettings,
        setAITagState,
        initPopover
    });
})();