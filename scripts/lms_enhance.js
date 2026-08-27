/**
 * scripts/lms_enhance.js
 *
 * 目标页面: lms.nju.edu.cn/* (智汇南雍 LMS 平台)
 * 功能概述: LMS 平台增强 — 视频限制解除、自动连播、课件批量下载
 * 触发方式: 页面加载时自动注入
 * 依赖模块: 无
 *
 * 详细说明:
 * 1. 视频增强：解除播放限制（进度条拖拽、倍速），支持自动连播下一集
 * 2. 课件下载：注入浮动下载球，默认全选文件 + 显示 checkbox 选择框
 * 3. 主题跟随：从 chrome.storage.sync 读取 ui_theme_color 作为主题色
 * 4. 配置管理：读取 lms_video_* 和 lms_dl_* 系列开关，各功能可独立启停
 */

(function() {
    'use strict';

    // 1. 读取插件的总开关
    chrome.storage.local.get(['toggle-lms'], (result) => {
        // 如果开关关闭，直接退出，不注入任何代码
        if (result['toggle-lms'] === false) return;

        console.log('[NJU-Hub] LMS Engine Starting...');

        // LMS 配置已迁移到 Options 页统一管理：
        // - 主题色：跟随 options 的 ui_theme_color
        // - 背景模糊/透明度：固定为当前默认值（不再允许页面内自定义）
        // - 下载/视频开关：从 chrome.storage.local 读取

        const DEFAULT_CONFIG = {
            video: { autoJump: false, removeRestrictions: true },
            download: { defaultSelectAll: false, showCheckbox: true },
            appearance: { opacity: 0.85, blur: 10, radius: 14 }
        };

        let Config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

        const loadConfig = async () => {
            const data = await chrome.storage.local.get([
                'ui_theme_color',
                'lms_video_autojump', 'lms_video_remove_restrict',
                'lms_dl_default_all', 'lms_dl_show_checkbox'
            ]);

            if (typeof data.lms_video_autojump === 'boolean') Config.video.autoJump = data.lms_video_autojump;
            if (typeof data.lms_video_remove_restrict === 'boolean') Config.video.removeRestrictions = data.lms_video_remove_restrict;
            if (typeof data.lms_dl_default_all === 'boolean') Config.download.defaultSelectAll = data.lms_dl_default_all;
            if (typeof data.lms_dl_show_checkbox === 'boolean') Config.download.showCheckbox = data.lms_dl_show_checkbox;

            const themeColor = typeof data.ui_theme_color === 'string' && data.ui_theme_color.trim() ? data.ui_theme_color.trim() : '#0ea5e9';
            return { themeColor };
        };

    // ==========================================
    // 2. 动画引擎与辅助函数
    // ==========================================

    const gracefulClose = (maskElement) => {
        if (!maskElement) return;
        maskElement.classList.add('lms-closing');
        const panel = maskElement.querySelector('.lms-panel');
        if(panel) panel.classList.add('lms-closing');
        document.body.style.overflow = '';
        setTimeout(() => { maskElement.remove(); }, 280);
    };

    const toggleScrollLock = (isLocked) => {
        document.body.style.overflow = isLocked ? 'hidden' : '';
    };

    const updateThemeVariables = (themeColor) => {
        const root = document.documentElement;
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 123, 255';
        };
        const rgb = hexToRgb(themeColor);

        root.style.setProperty('--lms-main', themeColor);
        root.style.setProperty('--lms-rgb', rgb);
        root.style.setProperty('--lms-panel-bg', `rgba(255, 255, 255, ${Config.appearance.opacity})`);
        root.style.setProperty('--lms-blur', `${Config.appearance.blur}px`);
        root.style.setProperty('--lms-radius', `${Config.appearance.radius}px`);
    };

    const updateSliderFill = (input) => {
        const val = (input.value - input.min) / (input.max - input.min) * 100;
        input.style.background = `linear-gradient(to right, var(--lms-main) ${val}%, #e5e5e5 ${val}%)`;
    };

    const injectStyles = () => {
        const css = `
            :root {
                --lms-main: #007bff;
                --lms-green: #28BD6E;
                --lms-shadow: 0 12px 40px rgba(0,0,0,0.12);
                --lms-radius: 14px;
                --lms-panel-bg: rgba(255, 255, 255, 0.85);
                --lms-blur: 10px;
                --lms-ease: cubic-bezier(0.25, 0.8, 0.25, 1);
                --lms-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
                --lms-color-trans: background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease, box-shadow 0.4s ease;
            }

            .lms-close { width: 28px; height: 28px; background: #f0f2f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 18px; cursor: pointer; transition: all 0.2s var(--lms-ease); line-height: 1; }
            .lms-close:hover { background: #e4e6e9; color: #333; transform: rotate(90deg); }

            .lms-ios-checkbox {
                position: absolute; left: 20px; top: 50%; transform: translateY(-50%);
                z-index: 2147483647; appearance: none; -webkit-appearance: none;
                width: 22px; height: 22px; border: 2px solid #ccc; border-radius: 6px;
                cursor: pointer; outline: none; transition: all 0.3s var(--lms-spring), var(--lms-color-trans);
                background: rgba(255,255,255,0.9); margin: 0; display: block !important;
            }
            .lms-ios-checkbox:checked { background: var(--lms-main); border-color: var(--lms-main); }
            .lms-ios-checkbox::after { content: ''; position: absolute; left: 6px; top: 2px; width: 5px; height: 10px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg) scale(0); transition: transform 0.2s var(--lms-ease); opacity: 0; }
            .lms-ios-checkbox:checked::after { transform: rotate(45deg) scale(1); opacity: 1; }

            .lms-ios-switch { appearance: none; -webkit-appearance: none; width: 50px; height: 30px; background: #e9e9ea; border-radius: 20px; position: relative; cursor: pointer; outline: none; transition: background 0.3s var(--lms-ease), var(--lms-color-trans); flex-shrink: 0; }
            .lms-ios-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 26px; height: 26px; border-radius: 50%; background: white; box-shadow: 0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06); transition: transform 0.3s var(--lms-spring); }
            .lms-ios-switch:checked { background: var(--lms-main); }
            .lms-ios-switch:checked::after { transform: translateX(20px); }

            .lms-ios-slider { -webkit-appearance: none; appearance: none; width: 140px; height: 6px; background: #e5e5e5; border-radius: 3px; outline: none; cursor: pointer; transition: background 0.3s ease; }
            .lms-ios-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: white; box-shadow: 0 3px 8px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.1s; margin-top: -1px; }
            .lms-ios-slider::-webkit-slider-thumb:active { transform: scale(1.15); }

            .lms-scrollable::-webkit-scrollbar { width: 5px; height: 5px; }
            .lms-scrollable::-webkit-scrollbar-track { background: transparent; }
            .lms-scrollable::-webkit-scrollbar-thumb { background: #d1d1d1; border-radius: 3px; transition: background 0.4s; }
            .lms-scrollable::-webkit-scrollbar-thumb:hover { background: var(--lms-main); }

            .lms-ball-cont-fixed { position: fixed !important; z-index: 100000 !important; }
            .lms-circle-ball { width: 50px; height: 50px; border-radius: 50%; color: white; border: none; font-weight: bold; font-size: 14px; box-shadow: 0 8px 20px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.4s var(--lms-spring), box-shadow 0.4s var(--lms-ease), var(--lms-color-trans); user-select: none; }
            .lms-circle-ball:hover { transform: scale(1.15); box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
            .lms-circle-ball:active { transform: scale(0.9); }

            #lms-cfg-cont { bottom: 30px; left: 30px; }
            #lms-dl-ball-cont { bottom: 30px; right: 30px; }
            .lms-ball-white { background: white; border: 1px solid rgba(0,0,0,0.1); color: #333; font-size: 22px; }
            .lms-ball-green { background: var(--lms-green); font-size: 20px; }
            .lms-ball-main { background: var(--lms-main); }

            .lms-mask { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.25); z-index: 200000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(var(--lms-blur)); -webkit-backdrop-filter: blur(var(--lms-blur)); animation: lmsFadeIn 0.3s var(--lms-ease) forwards; }
            .lms-mask.lms-closing { animation: lmsFadeOut 0.3s var(--lms-ease) forwards; pointer-events: none; }

            .lms-panel { background: var(--lms-panel-bg); backdrop-filter: blur(var(--lms-blur)); -webkit-backdrop-filter: blur(var(--lms-blur)); border-radius: var(--lms-radius); box-shadow: 0 20px 60px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.6); width: 500px; height: 580px; display: flex; flex-direction: column; animation: lmsZoomIn 0.4s var(--lms-spring) forwards; }
            .lms-panel.lms-closing { animation: lmsZoomOut 0.25s var(--lms-ease) forwards; }

            @keyframes lmsFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes lmsFadeOut { from { opacity: 1; } to { opacity: 0; } }
            @keyframes lmsZoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            @keyframes lmsZoomOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }

            .lms-header { padding: 18px 24px; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.5); flex-shrink: 0; border-radius: var(--lms-radius) var(--lms-radius) 0 0; }
            .lms-header h3 { margin: 0; font-size: 18px; color: #333; font-weight: 700; letter-spacing: -0.5px; }

            .lms-tabs { display: flex; position: relative; background: rgba(0,0,0,0.02); border-bottom: 1px solid rgba(0,0,0,0.06); flex-shrink: 0; overflow: hidden; }
            .lms-tab {
                flex: 1; padding: 14px; text-align: center; cursor: pointer; font-weight: 600; color: #777; transition: color 0.4s var(--lms-ease), transform 0.3s var(--lms-spring); z-index: 1;
            }
            .lms-tab.active { color: var(--lms-main); font-weight: 800; transform: scale(1.05); }
            .lms-tab-line { position: absolute; bottom: 0; left: 0; height: 3px; width: 0; background: var(--lms-main); border-radius: 3px 3px 0 0; transition: left 0.4s var(--lms-spring), width 0.4s var(--lms-spring), background-color 0.4s ease; }

            /* 内容切换动画 */
            .lms-tab-content-anim { animation: lmsContentFadeSlide 0.35s var(--lms-ease) forwards; }
            @keyframes lmsContentFadeSlide { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }

            .lms-opt-row { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid rgba(0,0,0,0.04); }
            .lms-opt-info { flex: 1; padding-right: 20px; }
            .lms-opt-title { font-size: 15px; font-weight: 600; color: #333; }
            .lms-opt-desc { font-size: 13px; color: #888; margin-top: 4px; line-height: 1.4; }

            .lms-footer { padding: 16px 24px; border-top: 1px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.02); margin-top: auto; flex-shrink: 0; border-radius: 0 0 var(--lms-radius) var(--lms-radius); }
            .lms-btn { padding: 0 20px; height: 36px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); background: white; color: #555; cursor: pointer; font-weight: 600; font-size: 13px; transition: 0.2s; display: flex; align-items: center; justify-content: center; box-sizing: border-box; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .lms-btn:hover { background: #f9f9f9; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
            .lms-btn-prime { background: var(--lms-main); color: white; border: none; transition: transform 0.2s, filter 0.2s, var(--lms-color-trans); }
            .lms-btn-prime:hover { background: var(--lms-main); filter: brightness(1.1); box-shadow: 0 4px 12px rgba(var(--lms-rgb), 0.3); }
            .lms-btn-danger { color: #ff4d4f; border-color: #ffccc7; }
            .lms-btn-danger:hover { background: #fff1f0; border-color: #ff4d4f; }

            .lms-progress-panel { height: auto; min-height: 280px; }
            .lms-progress-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 34px 36px 30px; text-align: center; }
            .lms-progress-icon { width: 54px; height: 54px; border: 4px solid rgba(var(--lms-rgb), 0.18); border-top-color: var(--lms-main); border-radius: 50%; animation: lmsProgressSpin 0.9s linear infinite; margin-bottom: 22px; }
            .lms-progress-icon.done { border-color: var(--lms-green); animation: none; position: relative; }
            .lms-progress-icon.done::after { content: '✓'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--lms-green); font-size: 30px; font-weight: 800; }
            .lms-progress-title { font-size: 20px; color: #333; font-weight: 700; margin-bottom: 12px; }
            .lms-progress-subtitle { max-width: 360px; color: #888; font-size: 14px; line-height: 1.7; }
            .lms-progress-count { margin-top: 22px; color: var(--lms-main); font-size: 13px; font-weight: 700; }
            .lms-progress-current { max-width: 380px; margin-top: 8px; color: #666; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .lms-complete-body { justify-content: flex-start; overflow-y: auto; }
            .lms-download-errors { width: 100%; max-width: 520px; margin-top: 20px; text-align: left; }
            .lms-download-error { padding: 11px 13px; margin-bottom: 8px; border-radius: 9px; background: rgba(255, 245, 245, 0.78); border: 1px solid rgba(255, 77, 79, 0.16); color: #555; font-size: 12px; line-height: 1.6; }
            .lms-download-error-name { color: #333; font-weight: 700; margin-bottom: 3px; overflow-wrap: anywhere; }
            .lms-download-error-solution { color: #777; margin-top: 3px; }
            .lms-download-error-technical { color: #999; margin-top: 4px; overflow-wrap: anywhere; }
            .lms-complete-footer { background: transparent !important; border-top: none !important; }
            @keyframes lmsProgressSpin { to { transform: rotate(360deg); } }


            /* 下载列表 */
            .lms-list-container { padding: 5px 0; overflow-y: auto; flex: 1; }
            .lms-dl-item {
                position: relative; display: flex; align-items: center;
                padding: 14px 24px; padding-left: 60px;
                border-bottom: 1px solid rgba(0,0,0,0.04); cursor: pointer;
                transition: background 0.25s var(--lms-ease); border-left: 4px solid transparent;
            }
            .lms-dl-item:hover { background: rgba(0,0,0,0.02); }
            .lms-dl-item.selected { box-shadow: inset 0 0 0 2000px rgba(var(--lms-rgb), 0.12) !important; border-left-color: var(--lms-main) !important; }
            .lms-dl-item.selected .lms-dl-name { font-weight: 600; color: var(--lms-main); }
            .lms-dl-item input[type="checkbox"] { display: none; }
            .lms-dl-item.no-cb { padding-left: 24px; }

            .lms-dl-name { font-size: 14px; color: #333; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.5; margin-left: 12px; }
            .lms-file-tag { font-size: 10px; font-weight: 800; color: white; padding: 3px 6px; border-radius: 6px; text-transform: uppercase; min-width: 36px; text-align: center; margin-left: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); flex-shrink: 0; }
            .tag-pdf { background: #ff4d4f; } .tag-doc { background: #40a9ff; } .tag-ppt { background: #fa8c16; } .tag-xls { background: #52c41a; } .tag-code { background: #722ed1; } .tag-file { background: #bfbfbf; }

            .color-dot { width: 26px; height: 26px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); display: inline-block; margin-right: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
            .color-dot.selected { border-color: #333; transform: scale(1.2); }
            .lms-input-text { border: 1px solid #ddd; padding: 0 12px; border-radius: 8px; outline: none; font-size: 14px; width: 100%; height: 36px; box-sizing: border-box; background: rgba(255,255,255,0.8); transition: border 0.2s; }
            .lms-input-text:focus { border-color: var(--lms-main); background: white; }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    };

    function getFileTag(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        let type = 'file';
        if (['pdf'].includes(ext)) type = 'pdf';
        else if (['doc', 'docx', 'wps'].includes(ext)) type = 'doc';
        else if (['ppt', 'pptx', 'dps'].includes(ext)) type = 'ppt';
        else if (['xls', 'xlsx', 'csv'].includes(ext)) type = 'xls';
        else if (['c', 'cpp', 'py', 'java', 'js', 'json'].includes(ext)) type = 'code';
        return `<span class="lms-file-tag tag-${type}">${ext.toUpperCase().substring(0,4)}</span>`;
    }

    const isWorkerPage = new URLSearchParams(location.search).get('njuhub_lms_worker') === '1';

    function runtimeMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(response || { ok: false, error: '插件后台没有返回结果' });
            });
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function sanitizeFilename(filename) {
        return String(filename || 'download')
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
            .trim() || 'download';
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function explainDownloadError(reason) {
        const raw = String(reason || '未知错误');
        if (/A listener indicated an asynchronous response|message channel closed/i.test(raw)) {
            return {
                cause: '后台页面通信通道在页面刷新、关闭或扩展重新加载时中断。',
                solution: '请不要关闭下载过程中出现的标签页，刷新 LMS 页面并重新点击下载。',
                technical: raw
            };
        }
        if (/Receiving end does not exist|Could not establish connection/i.test(raw)) {
            return {
                cause: '后台下载页面尚未加载完成，插件暂时找不到接收指令的页面。',
                solution: '请等待 LMS 页面完全加载后重试；如果持续出现，请重新加载扩展。',
                technical: raw
            };
        }
        if (/未捕获到 pdf-viewer|签名地址/i.test(raw)) {
            return {
                cause: '预览页面已打开，但没有捕获到 LMS 生成的临时下载地址。',
                solution: '请确认该文件可以手动预览；若可以，请刷新扩展后重试。',
                technical: raw
            };
        }
        if (/服务器拒绝了直接下载|权限不足|无权访问|HTTP 401|HTTP 403/i.test(raw)) {
            return {
                cause: '文件列表可以访问，但当前课程不允许直接下载文件内容。',
                solution: '插件已尝试使用预览授权链路；请确认你能在 LMS 中打开该文件预览。',
                technical: raw
            };
        }
        if (/活动页面加载超时|等待页面元素超时/i.test(raw)) {
            return {
                cause: '对应课件页面在规定时间内没有加载出文件内容。',
                solution: '请检查 LMS 网络连接，等待课程页面完全加载后重试。',
                technical: raw
            };
        }
        return {
            cause: raw,
            solution: '请刷新 LMS 页面和扩展后重试；如果仍失败，请保留此错误信息。',
            technical: raw
        };
    }

    function isLikelyErrorText(text) {
        return /权限不足|无法下载|无权访问|没有权限|未登录|登录后访问|access denied|forbidden|permission denied/i.test(text || '');
    }

    async function classifyFileResponse(response, expectedName) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const blob = await response.blob();
        if (!blob.size) return { ok: false, reason: '响应为空' };

        const headerBytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
        const headerText = new TextDecoder().decode(headerBytes);
        const textual = contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('javascript');
        const textualPreview = textual ? await blob.slice(0, 1200).text().catch(() => '') : '';
        const looksHtml = contentType.includes('text/html') || /^\s*<(?:!doctype|html|head|body)/i.test(headerText) || /^\s*<(?:!doctype|html|head|body)/i.test(textualPreview);
        const looksJson = contentType.includes('json') || /^\s*[\[{]/.test(headerText) || /^\s*[\[{]/.test(textualPreview);
        if (looksHtml || looksJson) {
            const preview = textualPreview || await blob.slice(0, 1200).text().catch(() => '');
            return { ok: false, reason: isLikelyErrorText(preview) ? '服务器拒绝了直接下载' : '响应不是文件', blob };
        }
        if (isLikelyErrorText(headerText) || isLikelyErrorText(textualPreview)) return { ok: false, reason: '服务器拒绝了直接下载', blob };

        const ext = String(expectedName || '').split('.').pop().toLowerCase();
        const signatures = {
            pdf: headerText.startsWith('%PDF-'),
            png: headerBytes[0] === 0x89 && headerBytes[1] === 0x50 && headerBytes[2] === 0x4e && headerBytes[3] === 0x47,
            jpg: headerBytes[0] === 0xff && headerBytes[1] === 0xd8,
            jpeg: headerBytes[0] === 0xff && headerBytes[1] === 0xd8,
            zip: headerBytes[0] === 0x50 && headerBytes[1] === 0x4b
        };
        if (signatures[ext] === false) return { ok: false, reason: '文件内容与扩展名不匹配', blob };
        return { ok: true, blob };
    }

    function triggerBlobDownload(blob, filename) {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = sanitizeFilename(filename);
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }

    function extractPreviewFileUrl(viewerUrl) {
        let outer;
        try { outer = new URL(viewerUrl, location.href); } catch (_) { return null; }
        const raw = outer.searchParams.get('file');
        if (!raw) return null;

        let candidate = raw;
        for (let i = 0; i < 2; i += 1) {
            try {
                const decoded = decodeURIComponent(candidate);
                if (decoded === candidate) break;
                candidate = decoded;
            } catch (_) { break; }
        }

        let media;
        try { media = new URL(candidate, location.href); } catch (_) { return null; }
        if (media.protocol !== 'https:' || !['lms.nju.edu.cn', 'lms-media.nju.edu.cn'].includes(media.hostname)) return null;
        return media.href;
    }

    function getRecentPreviewUrl(before) {
        const entries = performance.getEntriesByType('resource').map(entry => entry.name);
        for (let i = entries.length - 1; i >= 0; i -= 1) {
            const url = entries[i];
            if (before.has(url) || !/pdf-viewer|note-bene/i.test(url)) continue;
            const extracted = extractPreviewFileUrl(url);
            if (extracted) return extracted;
        }
        return null;
    }

    function getPreviewUrlFromDom() {
        const elements = document.querySelectorAll('iframe[src], embed[src], object[data], a[href], [data-url]');
        for (const element of elements) {
            const raw = element.getAttribute('src') || element.getAttribute('data') || element.getAttribute('href') || element.getAttribute('data-url');
            if (!raw || !/pdf-viewer|note-bene/i.test(raw)) continue;
            const extracted = extractPreviewFileUrl(raw);
            if (extracted) return extracted;
        }
        return null;
    }

    // ==========================================
    // 3. 逻辑引擎
    // ==========================================
    const Logic = {
        async init() {
            if (isWorkerPage) {
                this.initWorker();
                return;
            }
            // --- 关键：单例运行检测，防止iframe中重复按钮 ---
            if (window.self !== window.top) return;
            if (document.getElementById('lms-dl-ball-cont')) return;

            const { themeColor } = await loadConfig();
            injectStyles();
            updateThemeVariables(themeColor);

            this.renderDownloadBall();
            this.startMonitor();
        },

        DL_ICON: '<svg width="24" height="24" viewBox="0 0 24 24" style="display:block"><path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>',

        renderDownloadBall() {
            if (!location.pathname.includes('/course/')) return;
            const container = document.createElement('div');
            container.id = 'lms-dl-ball-cont';
            container.className = 'lms-ball-cont-fixed';
            container.innerHTML = `<div class="lms-circle-ball lms-ball-green" id="ball-dl">${this.DL_ICON}</div>`;
            container.onclick = () => this.fetchResources();
            document.body.appendChild(container);
        },
        async tryLegacyDownload(file) {
            const url = `${file.legacyUrl}${file.legacyUrl.includes('?') ? '&' : '?'}preview=true`;
            try {
                const response = await fetch(url, {
                    credentials: 'same-origin',
                    redirect: 'follow',
                    cache: 'no-store',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                const finalUrl = response.url || '';
                if (/authserver|login/i.test(finalUrl)) return { ok: false, reason: '重定向到了登录页' };
                if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };

                const result = await classifyFileResponse(response, file.name);
                if (!result.ok) return result;
                triggerBlobDownload(result.blob, file.name);
                return { ok: true, method: 'legacy' };
            } catch (error) {
                return { ok: false, reason: error?.message || '旧接口请求失败' };
            }
        },
        async startDownloadQueue(files, mask) {
            const selected = Array.from(mask.querySelectorAll('input:checked'))
                .map(cb => files[Number(cb.id.split('-')[1])])
                .filter(Boolean);
            if (!selected.length) return;

            const courseId = location.pathname.match(/\/course\/(\d+)/)?.[1];
            if (!courseId) return;
            this.showDownloadProgress(mask, selected.length);

            const results = [];
            for (let index = 0; index < selected.length; index += 1) {
                const file = selected[index];
                this.updateDownloadProgress(mask, index, selected.length, file.name);
                const legacy = await this.tryLegacyDownload(file);
                if (legacy.ok) {
                    results.push({ file, ok: true, method: 'legacy' });
                    this.updateDownloadProgress(mask, index + 1, selected.length, file.name);
                    await sleep(500);
                    continue;
                }

                let worker = null;
                try {
                    if (!file.activityId) {
                        results.push({ file, ok: false, reason: legacy.reason || '缺少活动页面信息' });
                        continue;
                    }

                    worker = await runtimeMessage({ action: 'lmsOpenWorker', courseId });
                    if (!worker.ok) {
                        results.push({ file, ok: false, reason: worker.error || '无法创建后台标签页' });
                        continue;
                    }

                    const activityUrl = `https://lms.nju.edu.cn/course/${courseId}/learning-activity?njuhub_lms_worker=1#/${encodeURIComponent(file.activityId)}`;
                    const preview = await runtimeMessage({
                        action: 'lmsWorkerResolve',
                        tabId: worker.tabId,
                        activityUrl,
                        file: {
                            name: file.name,
                            uploadId: file.uploadId,
                            referenceId: file.referenceId,
                            activityId: file.activityId
                        }
                    });
                    if (!preview.ok || !preview.url) {
                        results.push({ file, ok: false, reason: preview.error || legacy.reason || '预览授权地址获取失败' });
                        continue;
                    }

                    const download = await runtimeMessage({
                        action: 'lmsWorkerDownload',
                        url: preview.url,
                        filename: file.name
                    });
                    results.push(download.ok
                        ? { file, ok: true, method: 'preview' }
                        : { file, ok: false, reason: download.error || '浏览器下载失败' });
                } finally {
                    if (worker?.ok) await runtimeMessage({ action: 'lmsCloseWorker', tabId: worker.tabId });
                }
                this.updateDownloadProgress(mask, index + 1, selected.length, file.name);
                await sleep(700);
            }

            this.showDownloadComplete(mask, results);
        },
        async fetchResources() {
            const courseId = location.pathname.match(/\/course\/(\d+)/)?.[1];
            if (!courseId) return;
            const b = document.getElementById('ball-dl'); b.innerText = '...';
            try {
                const res = await fetch(`/api/courses/${courseId}/activities?sub_course_id=0`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                if (!res.ok) throw new Error(`活动列表请求失败 (${res.status})`);
                const data = await res.json();
                const files = [];
                data.activities?.forEach(act => act.uploads?.forEach(u => {
                    const uploadId = u.id ?? u.file_id ?? u.upload_id;
                    if (uploadId == null || !u.name) return;
                    files.push({
                        name: u.name,
                        uploadId,
                        referenceId: u.reference_id,
                        activityId: act.id ?? act.activity_id,
                        legacyUrl: `/api/uploads/${uploadId}/blob`
                    });
                }));
                if (!files.length) return;
                this.showDownloadModal(files);
            } catch (e) { console.warn('[NJU-Hub] 获取 LMS 文件列表失败:', e); }
            b.innerHTML = this.DL_ICON;
        },
        showDownloadModal(files) {
            toggleScrollLock(true);
            const mask = document.createElement('div');
            mask.className = 'lms-mask';

            const checkboxHtml = (i) => Config.download.showCheckbox ?
                `<input type="checkbox" class="lms-ios-checkbox" id="f-${i}" ${Config.download.defaultSelectAll ? 'checked' : ''}>` :
                `<input type="checkbox" id="f-${i}" ${Config.download.defaultSelectAll ? 'checked' : ''} style="display:none">`;

            mask.innerHTML = `
                <div class="lms-panel">
                    <div class="lms-header"><h3>课件下载 (${files.length})</h3><div class="lms-close" id="lms-dl-close">×</div></div>
                    <div class="lms-list-container lms-scrollable">
                        ${files.map((f, i) => `
                            <div class="lms-dl-item ${Config.download.showCheckbox?'':'no-cb'}" data-idx="${i}">
                                ${checkboxHtml(i)}
                                ${getFileTag(f.name)}
                                <label class="lms-dl-name">${f.name}</label>
                            </div>
                        `).join('')}
                    </div>
                    <div class="lms-footer">
                        <div style="display:flex; gap:10px;">
                            <button class="lms-btn" id="lms-all">全选</button>
                            <button class="lms-btn" id="lms-inv">反选</button>
                        </div>
                        <button class="lms-btn lms-btn-prime" id="lms-do">下载所选</button>
                    </div>
                </div>
            `;
            document.body.appendChild(mask);

            const updateRowStyle = () => {
                mask.querySelectorAll('.lms-dl-item').forEach(row => {
                    const cb = row.querySelector('input');
                    if (cb.checked) row.classList.add('selected');
                    else row.classList.remove('selected');
                });
            };
            if(Config.download.defaultSelectAll) updateRowStyle();

            mask.querySelectorAll('.lms-dl-item').forEach(row => {
                row.onclick = (e) => {
                    if (e.target.tagName !== 'INPUT') {
                        const cb = row.querySelector('input');
                        cb.checked = !cb.checked;
                    }
                    updateRowStyle();
                };
            });

            mask.querySelector('#lms-dl-close').onclick = () => gracefulClose(mask);
            mask.querySelector('#lms-all').onclick = () => {
                mask.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = true);
                updateRowStyle();
            };
            mask.querySelector('#lms-inv').onclick = () => {
                mask.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = !c.checked);
                updateRowStyle();
            };
            mask.querySelector('#lms-do').onclick = async () => {
                await this.startDownloadQueue(files, mask);
            };
            mask.onclick = (e) => { if(e.target === mask) gracefulClose(mask); };
        },

        showDownloadProgress(mask, total) {
            mask.classList.remove('lms-closing');
            mask.innerHTML = `
                <div class="lms-panel lms-progress-panel">
                    <div class="lms-header"><h3>课件下载</h3></div>
                    <div class="lms-progress-body">
                        <div class="lms-progress-icon" aria-hidden="true"></div>
                        <div class="lms-progress-title">正在下载中，这可能需要一些时间。</div>
                        <div class="lms-progress-subtitle">下载过程中可能会打开新标签页，是正常现象。请勿关闭新标签页。</div>
                        <div class="lms-progress-count" data-progress-count>准备下载 0 / ${total}</div>
                        <div class="lms-progress-current" data-progress-current></div>
                    </div>
                </div>
            `;
            mask.onclick = () => {};
        },

        updateDownloadProgress(mask, completed, total, currentName) {
            const count = mask.querySelector('[data-progress-count]');
            const current = mask.querySelector('[data-progress-current]');
            if (count) count.textContent = completed >= total ? `正在整理下载结果（${total} / ${total}）` : `已处理 ${completed} / ${total}`;
            if (current) current.textContent = completed >= total ? '' : `当前文件：${currentName || ''}`;
        },

        showDownloadComplete(mask, results) {
            const successCount = results.filter(result => result.ok).length;
            const failed = results.filter(result => !result.ok);
            mask.classList.remove('lms-closing');
            mask.innerHTML = `
                <div class="lms-panel lms-progress-panel">
                    <div class="lms-header"><h3>课件下载</h3><div class="lms-close" data-download-close>×</div></div>
                    <div class="lms-progress-body lms-complete-body">
                        <div class="lms-progress-icon done" aria-hidden="true"></div>
                        <div class="lms-progress-title">下载完成</div>
                        <div class="lms-progress-subtitle">成功下载 ${successCount} 个文件${failed.length ? `，${failed.length} 个文件失败。` : '。'}</div>
                        ${failed.length ? `
                            <div class="lms-download-errors">
                                ${failed.map(item => {
                                    const detail = explainDownloadError(item.reason);
                                    return `<div class="lms-download-error">
                                        <div class="lms-download-error-name">${escapeHtml(item.file.name)}</div>
                                        <div>原因：${escapeHtml(detail.cause)}</div>
                                        <div class="lms-download-error-solution">解决方案：${escapeHtml(detail.solution)}</div>
                                        <div class="lms-download-error-technical">技术信息：${escapeHtml(detail.technical)}</div>
                                    </div>`;
                                }).join('')}
                            </div>
                        ` : ''}
                        <div class="lms-footer lms-complete-footer" style="width:100%; box-sizing:border-box; margin-top:28px;">
                            <span style="color:#888;font-size:12px;">可以安全关闭此窗口</span>
                            <button class="lms-btn lms-btn-prime" data-download-close>关闭</button>
                        </div>
                    </div>
                </div>
            `;
            mask.querySelectorAll('[data-download-close]').forEach(element => {
                element.onclick = () => gracefulClose(mask);
            });
            mask.onclick = (event) => { if (event.target === mask) gracefulClose(mask); };
        },

        initWorker() {
            this.previewUrlResolver = null;
            window.addEventListener('message', (event) => {
                if (event.source !== window || event.data?.source !== 'NJU-Hub' || event.data?.type !== 'lms-preview-url') return;
                const extracted = extractPreviewFileUrl(event.data.url);
                if (!extracted || !this.previewUrlResolver) return;
                const resolve = this.previewUrlResolver;
                this.previewUrlResolver = null;
                resolve(extracted);
            });
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action !== 'lmsWorkerResolveCurrent') return false;
                this.resolveCurrentActivityFile(request.file || {})
                    .then(sendResponse)
                    .catch(error => sendResponse({ ok: false, error: error?.message || '预览解析失败' }));
                return true;
            });
        },

        async waitFor(selector, timeout = 10000) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const element = document.querySelector(selector);
                if (element) return element;
                await sleep(250);
            }
            throw new Error(`等待页面元素超时: ${selector}`);
        },

        async resolveCurrentActivityFile(file) {
            const expectedName = String(file.name || '');
            const start = Date.now();
            let target = null;
            while (Date.now() - start < 12000) {
                const candidates = Array.from(document.querySelectorAll('.file-info .file-name'));
                target = candidates.find(element => (element.textContent || '').trim() === expectedName)
                    || candidates.find(element => (element.getAttribute('original-title') || '').trim() === expectedName);
                if (target) break;
                await sleep(250);
            }
            if (!target) throw new Error(`当前活动页面找不到文件: ${expectedName}`);

            const before = new Set(performance.getEntriesByType('resource').map(entry => entry.name));
            target.click();
            await this.waitFor('.document-preview-view-mode', 10000);
            const noteMode = document.querySelector('#note-mode');
            if (!noteMode) throw new Error('找不到笔记模式按钮');
            noteMode.click();

            const bridgeUrl = await new Promise((resolve) => {
                this.previewUrlResolver = resolve;
                const captureStart = Date.now();
                const poll = async () => {
                    while (Date.now() - captureStart < 12000) {
                        const url = getRecentPreviewUrl(before) || getPreviewUrlFromDom();
                        if (url) {
                            this.previewUrlResolver = null;
                            resolve(url);
                            return;
                        }
                        await sleep(250);
                    }
                    this.previewUrlResolver = null;
                    resolve(null);
                };
                poll();
            });
            if (bridgeUrl) return { ok: true, url: bridgeUrl };
            throw new Error('未捕获到 pdf-viewer 的签名地址');
        },

        startMonitor() {
            setInterval(() => {
                const v = document.querySelector('video');
                if (v && Config.video.removeRestrictions) { v.controls = true; v.oncontextmenu = null; }
            }, 2000);
        }
    };

    Logic.init();

    });
})();
