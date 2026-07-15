document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 0. MD3 Outlined Dropdown Component
    // ============================================================

    class NjuDropdown {
        constructor(el) {
            this.el = el;
            this.trigger = el.querySelector('.nju-dropdown-trigger');
            this.menu = el.querySelector('.nju-dropdown-menu');
            this.textEl = el.querySelector('.nju-dropdown-text');
            this.options = [...el.querySelectorAll('li[data-value]')];
            this._value = this.options.find(o => o.classList.contains('active'))?.dataset.value || '';
            this._onChange = null;
            this._onThisDocClick = (e) => { if (!el.contains(e.target)) this.close(); };
            // 找到最近的 .card 祖先，用于展开时提升层叠顺序
            this._card = el.closest('.card');
            this.init();
        }

        init() {
            this.trigger.addEventListener('click', () => this.toggle());
            this.trigger.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); }
                if (e.key === 'ArrowDown') { e.preventDefault(); if (!this.el.classList.contains('open')) this.open(); this._focusNext(); }
                if (e.key === 'ArrowUp') { e.preventDefault(); if (!this.el.classList.contains('open')) this.open(); this._focusPrev(); }
                if (e.key === 'Escape') { this.close(); this.trigger.focus(); }
            });
            this.options.forEach(li => {
                li.addEventListener('click', () => {
                    this.setValue(li.dataset.value);
                    this.close();
                    this.trigger.focus();
                });
            });
        }

        open() {
            NjuDropdown.closeAll();
            // 提升父级 .card 的层叠顺序，防止被后续卡片裁切（后续卡片因 animation-fill-mode: both 的 transform 创建了独立层叠上下文）
            if (this._card) {
                this._card.style.position = 'relative';
                this._card.style.zIndex = '100';
            }
            this.el.classList.add('open');
            this.trigger.setAttribute('aria-expanded', 'true');
            document.addEventListener('pointerdown', this._onThisDocClick);
        }

        close() {
            if (this._card) {
                this._card.style.zIndex = '';
                this._card.style.position = '';
            }
            this.el.classList.remove('open');
            this.trigger.setAttribute('aria-expanded', 'false');
            document.removeEventListener('pointerdown', this._onThisDocClick);
        }

        toggle() {
            this.el.classList.contains('open') ? this.close() : this.open();
        }

        setValue(val, silent = false) {
            this._value = val;
            this.options.forEach(o => o.classList.toggle('active', o.dataset.value === val));
            const selected = this.options.find(o => o.dataset.value === val);
            if (selected) this.textEl.textContent = selected.textContent;
            if (!silent && this._onChange) this._onChange(val);
        }

        getValue() { return this._value; }

        onChange(fn) { this._onChange = fn; }

        _focusNext() {
            const active = this.menu.querySelector('li.active') || this.options[0];
            const idx = this.options.indexOf(active);
            const next = this.options[(idx + 1) % this.options.length];
            this._setFocus(next);
        }

        _focusPrev() {
            const active = this.menu.querySelector('li.active') || this.options[0];
            const idx = this.options.indexOf(active);
            const prev = this.options[(idx - 1 + this.options.length) % this.options.length];
            this._setFocus(prev);
        }

        _setFocus(li) {
            this.options.forEach(o => o.style.outline = 'none');
            li.style.outline = `2px solid var(--dd-border-open)`;
            li.scrollIntoView({ block: 'nearest' });
        }

        static closeAll() {
            document.querySelectorAll('.nju-dropdown.open').forEach(el => {
                el.classList.remove('open');
                el.querySelector('.nju-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
            });
        }

        static getById(id) {
            const el = document.getElementById(id);
            return el?._njuDropdown || null;
        }
    }

    // Attach instances to DOM elements
    document.querySelectorAll('.nju-dropdown').forEach(el => {
        el._njuDropdown = new NjuDropdown(el);
    });

    // ============================================================
    // 1. MD3 Ripple Effect
    // ============================================================

    /**
     * Attach Material Design 3 ripple effect to an element.
     * @param {Element} el — target element
     * @param {string} [animClass='animate'] — CSS animation class ('animate' or 'animate-nav')
     */
    function attachRipple(el, animClass = 'animate') {
        if (el.dataset.ripple) return;
        el.dataset.ripple = '1';
        el.style.position = el.style.position || 'relative';
        el.style.overflow = 'hidden';

        const getPointerPos = (e) => {
            const rect = el.getBoundingClientRect();
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            return { x, y };
        };

        const spawn = (e) => {
            const { x, y } = getPointerPos(e);
            const size = Math.max(el.clientWidth, el.clientHeight) * 2;
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (x - size / 2) + 'px';
            ripple.style.top = (y - size / 2) + 'px';
            el.appendChild(ripple);

            // Force reflow then animate
            ripple.offsetHeight;
            ripple.classList.add(animClass);

            ripple.addEventListener('animationend', () => ripple.remove());
        };

        el.addEventListener('pointerdown', spawn);
    }

    /** Auto-attach ripple to all interactive elements */
    function initRipples() {
        // Nav items get the contained nav ripple
        document.querySelectorAll('.nav-item').forEach(el => attachRipple(el, 'animate-nav'));

        // Other interactive elements get the default expansive ripple
        const otherSelectors = [
            '.btn-save',
            '.btn-small',
            '.color-chip',
            '.nju-modal-close',
            '#btn-view-schedule',
            '#btn-clear-schedule',
            '#schedule-open-ehall',
        ];
        otherSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => attachRipple(el, 'animate'));
        });
    }

    // ============================================================
    // 2. Material Color Utilities — Theme Management
    // ============================================================

    const MCU = window.MaterialColorUtils;
    // Track the original source color to prevent tonal-palette drift
    // when toggling dark mode or saving (never read back from computed CSS).
    let _currentSourceColor = '#0ea5e9';


    const applyTheme = ({ color, mode }) => {
        const safeColor = (typeof color === 'string' && color.trim()) ? color.trim() : '#0ea5e9';
        const isDark = mode === 'dark';
        // Remember the original source color
        _currentSourceColor = safeColor;


        // Apply Material You theme (generates full tonal palette + CSS vars)
        if (MCU) {
            MCU.applyTheme(safeColor, isDark);
        } else {
            // Fallback: just set --primary
            document.documentElement.style.setProperty('--primary', safeColor);
        }

        // Set theme attribute
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

        // Sync UI controls
        const colorInput = document.getElementById('ui-theme-color');
        if (colorInput) colorInput.value = safeColor;

        const darkToggle = document.getElementById('ui-dark-mode');
        if (darkToggle) darkToggle.checked = isDark;

        document.querySelectorAll('.color-chip').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.color?.toLowerCase() === safeColor.toLowerCase());
        });
    };

    const applyFont = (fontKey) => {
        const nextFont = fontKey || 'google-sans-flex';
        document.documentElement.setAttribute('data-font', nextFont);
        const fontDropdown = NjuDropdown.getById('ui-font-family');
        if (fontDropdown) fontDropdown.setValue(nextFont, true);
    };

    const UI_KEYS = ['ui_theme_color', 'ui_theme_mode', 'ui_font_family'];
    const uiStorage = chrome.storage.sync;

    const persistTheme = async ({ color, mode }) => {
        await uiStorage.set({ ui_theme_color: color, ui_theme_mode: mode });
    };

    const persistFont = async (fontKey) => {
        await uiStorage.set({ ui_font_family: fontKey });
    };

    // ============================================================
    // 3. Tab Switching — Fade Through Transition
    // ============================================================

    const tabs = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.settings-section');

    /**
     * Switch to a section: hide current immediately, show new with animation.
     * Clean and simple — no exit animation overlap.
     */
    function switchSection(targetId) {
        const targetSection = document.getElementById(targetId);
        if (!targetSection || targetSection.classList.contains('active')) return;

        // Hide all sections immediately
        sections.forEach(s => s.classList.remove('active'));

        // Show target with entrance animation
        targetSection.classList.add('active');

        // Re-trigger card stagger by resetting animation
        targetSection.querySelectorAll('.card').forEach(card => {
            card.style.animation = 'none';
            card.offsetHeight; // force reflow
            card.style.animation = '';
        });

        // Update tab active state
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`.nav-item[data-target="${targetId}"]`)?.classList.add('active');
    }

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            switchSection(tab.dataset.target);
        });
    });

    // ============================================================
    // 4. Password Toggle (Eye Icon)
    // ============================================================

    const EYE_OPEN_SVG = `
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"/>
        </svg>
    `;
    const EYE_OFF_SVG = `
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" opacity="0.35"/>
            <path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;

    document.querySelectorAll('.toggle-password').forEach((iconEl) => {
        iconEl.addEventListener('click', () => {
            const wrapper = iconEl.closest('.password-wrapper');
            const input = wrapper.querySelector('input');
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            iconEl.innerHTML = isPassword ? EYE_OFF_SVG : EYE_OPEN_SVG;
            iconEl.setAttribute('aria-label', isPassword ? '隐藏密码' : '显示密码');
        });
    });

    // ============================================================
    // 5. Personalization Bindings
    // ============================================================

    const bindPersonalize = () => {
        // Color chips
        document.querySelectorAll('.color-chip').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const chosen = btn.dataset.color;
                const mode = document.documentElement.getAttribute('data-theme');
                applyTheme({ color: chosen, mode });
                await persistTheme({ color: chosen, mode });
            });
        });

        // Color picker
        const picker = document.getElementById('ui-theme-color');
        if (picker) {
            picker.addEventListener('input', async (e) => {
                const chosen = e.target.value;
                const mode = document.documentElement.getAttribute('data-theme');
                applyTheme({ color: chosen, mode });
                await persistTheme({ color: chosen, mode });
            });
        }

        // Dark mode toggle
        const darkToggle = document.getElementById('ui-dark-mode');
        if (darkToggle) {
            darkToggle.addEventListener('change', async () => {
                const mode = darkToggle.checked ? 'dark' : 'light';
                const color = _currentSourceColor;
                applyTheme({ color, mode });
                await persistTheme({ color, mode });
            });
        }

        // Font dropdown
        const fontDropdown = NjuDropdown.getById('ui-font-family');
        if (fontDropdown) {
            fontDropdown.onChange(async (val) => {
                applyFont(val);
                await persistFont(val);
            });
        }
    };

    bindPersonalize();

    // ============================================================
    // 6. Data Loading
    // ============================================================

    const KEYS = [
        'common-name', 'student_id', 'login_pass',
        'login_autofill', 'login_autologin', 'login_ai_enable', 'login_api_url', 'login_api_key', 'login_model',
        'login_extract_api_url', 'login_extract_api_key', 'login_extract_model',
        'course_major', 'course_pref', 'course_api_url', 'course_api_key', 'course_model',
        'NJU_CAMPUS', 'NJU_CONFLICT', 'NJU_PIN_FAV',
        'NJU_SCHEDULE',
        'seatable_last_sync',
        'toggle-eval', 'eval_api_url', 'eval_api_key', 'eval_model',
        'toggle-spoc-redirect',
        'toggle-lms',
        'lms_video_remove_restrict', 'lms_video_autojump',
        'lms_dl_default_all', 'lms_dl_show_checkbox',
        'toggle-seec-workpanel'
    ];

    Promise.all([
        uiStorage.get(UI_KEYS),
        chrome.storage.local.get(KEYS)
    ]).then(([uiData, data]) => {
        applyTheme({
            color: uiData.ui_theme_color || '#0ea5e9',
            mode: uiData.ui_theme_mode || 'light'
        });
        applyFont(uiData.ui_font_family || 'google-sans-flex');

        const setVal = (id, val, defaultVal = '') => {
            const el = document.getElementById(id);
            if (!el) return;
            // Custom dropdown
            if (el.classList.contains('nju-dropdown') && el._njuDropdown) {
                el._njuDropdown.setValue((val !== undefined && val !== null) ? val : defaultVal, true);
                return;
            }
            // Native input/select/textarea
            el.value = (val !== undefined && val !== null) ? val : defaultVal;
        };
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val === true;
        };
        const setCheckDefaultOn = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val !== false;
        };
        const setCheckDefault = (id, val, defaultVal) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = val === undefined || val === null ? defaultVal : val === true;
        };

        setVal('common-name', data['common-name']);
        setVal('common-id', data.student_id);
        setVal('common-pwd', data.login_pass);

        setCheck('login-autofill', data.login_autofill);
        setCheck('login-autologin', data.login_autologin);
        setCheck('login-ai-enable', data.login_ai_enable);
        // AI 配置折叠
        const aiToggle = document.getElementById('login-ai-enable');
        const aiConfig = document.getElementById('login-ai-config');
        const syncAiConfig = () => { aiConfig.style.display = aiToggle.checked ? '' : 'none'; };
        syncAiConfig();
        aiToggle.addEventListener('change', syncAiConfig);
        setVal('login-api-url', data.login_api_url);
        setVal('login-api-key', data.login_api_key);
        setVal('login-model', data.login_model);
        setVal('login-extract-api-url', data.login_extract_api_url);
        setVal('login-extract-api-key', data.login_extract_api_key);
        setVal('login-extract-model', data.login_extract_model);

        setVal('course-major', data.course_major);
        setVal('course-pref', data.course_pref);
        setVal('course-api-url', data.course_api_url);
        setVal('course-api-key', data.course_api_key);
        setVal('course-model', data.course_model);

        setVal('course-my-campus', data.NJU_CAMPUS, 'XL');
        setCheckDefault('course-conflict-check', data.NJU_CONFLICT, true);
        setCheckDefault('course-pin-fav', data.NJU_PIN_FAV, true);
        setCheckDefault('course-use-own-ai', data.NJU_USE_OWN_AI, false);
        // 自用AI配置折叠
        (() => {
            const ownAiToggle = document.getElementById('course-use-own-ai');
            const ownAiConfig = document.getElementById('course-own-ai-config');
            if (ownAiToggle && ownAiConfig) {
                const syncOwnAi = () => { ownAiConfig.style.display = ownAiToggle.checked ? '' : 'none'; };
                syncOwnAi();
                ownAiToggle.addEventListener('change', syncOwnAi);
            }
        })();


        setCheckDefaultOn('toggle-eval', data['toggle-eval']);
        setCheckDefaultOn('toggle-spoc-redirect', data['toggle-spoc-redirect']);
        // eval AI 字段已移除，保留读取以兼容旧数据（字段可选）
        setVal('eval-api-url', data.eval_api_url);
        setVal('eval-api-key', data.eval_api_key);
        setVal('eval-model', data.eval_model);

        setCheckDefaultOn('toggle-lms', data['toggle-lms']);
        // LMS 子配置折叠
        (() => {
            const lmsToggle = document.getElementById('toggle-lms');
            const lmsSubConfig = document.getElementById('lms-sub-config');
            if (lmsToggle && lmsSubConfig) {
                const syncLms = () => { lmsSubConfig.style.display = lmsToggle.checked ? '' : 'none'; };
                syncLms();
                lmsToggle.addEventListener('change', syncLms);
            }
        })();

        setCheckDefault('lms-video-remove-restrict', data.lms_video_remove_restrict, true);
        setCheckDefault('lms-video-autojump', data.lms_video_autojump, false);
        setCheckDefault('lms-dl-default-all', data.lms_dl_default_all, false);
        setCheckDefault('lms-dl-show-checkbox', data.lms_dl_show_checkbox, true);
        setCheckDefaultOn('toggle-seec-workpanel', data['toggle-seec-workpanel']);

        // Initialize ripples after DOM is fully rendered
        initRipples();
    });

    // ============================================================
    // 7. Data Saving
    // ============================================================

    document.getElementById('save-all-btn').addEventListener('click', () => {
        const btn = document.getElementById('save-all-btn');
        const originalText = btn.innerText;

        btn.innerText = '正在保存...';
        btn.disabled = true;
        btn.classList.add('saving');

        const config = {
            'common-name': document.getElementById('common-name').value.trim(),
            'student_id': document.getElementById('common-id').value.trim(),
            'login_pass': document.getElementById('common-pwd').value.trim(),
            'login_autofill': document.getElementById('login-autofill').checked,
            'login_autologin': document.getElementById('login-autologin').checked,
            'login_ai_enable': document.getElementById('login-ai-enable').checked,
            'login_api_url': document.getElementById('login-api-url').value.trim(),
            'login_api_key': document.getElementById('login-api-key').value.trim(),
            'login_model': document.getElementById('login-model').value.trim(),
            'login_extract_api_url': document.getElementById('login-extract-api-url').value.trim(),
            'login_extract_api_key': document.getElementById('login-extract-api-key').value.trim(),
            'login_extract_model': document.getElementById('login-extract-model').value.trim(),
            'course_major': document.getElementById('course-major').value.trim(),
            'course_pref': document.getElementById('course-pref').value.trim(),
            'course_api_url': document.getElementById('course-api-url').value.trim(),
            'course_api_key': document.getElementById('course-api-key').value.trim(),
            'course_model': document.getElementById('course-model').value.trim(),
            'NJU_CAMPUS': NjuDropdown.getById('course-my-campus')?.getValue() || 'XL',
            'NJU_CONFLICT': document.getElementById('course-conflict-check').checked,
            'NJU_PIN_FAV': document.getElementById('course-pin-fav').checked,
            'NJU_USE_OWN_AI': document.getElementById('course-use-own-ai').checked,
            'toggle-eval': document.getElementById('toggle-eval').checked,
            'toggle-spoc-redirect': document.getElementById('toggle-spoc-redirect').checked,
            'eval_api_url': document.getElementById('eval-api-url')?.value?.trim() || '',
            'eval_api_key': document.getElementById('eval-api-key')?.value?.trim() || '',
            'eval_model': document.getElementById('eval-model')?.value?.trim() || '',
            'toggle-lms': document.getElementById('toggle-lms').checked,
            'lms_video_remove_restrict': document.getElementById('lms-video-remove-restrict').checked,
            'lms_video_autojump': document.getElementById('lms-video-autojump').checked,
            'lms_dl_default_all': document.getElementById('lms-dl-default-all').checked,
            'lms_dl_show_checkbox': document.getElementById('lms-dl-show-checkbox').checked,
            'toggle-seec-workpanel': document.getElementById('toggle-seec-workpanel').checked
        };

        config.login_user = config.student_id;

        const primaryColor = _currentSourceColor;

        const uiConfig = {
            ui_theme_color: primaryColor,
            ui_theme_mode: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
            ui_font_family: document.documentElement.getAttribute('data-font') || 'google-sans-flex'
        };

        chrome.storage.local.set(config, () => {
            uiStorage.set(uiConfig, () => {
                setTimeout(() => {
                    btn.innerText = '配置已同步 ✓';
                    btn.disabled = false;
                    btn.classList.remove('saving');
                    setTimeout(() => {
                        btn.innerText = originalText;
                    }, 1500);
                }, 500);
            });
        });
    });

    // ============================================================
    // 8. options_goto: auto-navigate from floating island button
    // ============================================================
    chrome.storage.local.get(['options_goto'], (data) => {
        if (data.options_goto) {
            switchSection(data.options_goto);
            chrome.storage.local.remove(['options_goto']);
        }
    });

    // ============================================================
    // 9. Init course module (Data Manager, SeaTable, Schedule, etc.)
    // ============================================================
    if (typeof initCourseModule === 'function') {
        initCourseModule();
    }

    // 10. Privacy Policy Modal
    // ============================================================
    const privacyBtn = document.getElementById('btn-privacy-policy');
    if (privacyBtn) {
        privacyBtn.onclick = () => {
            const privacyHtml = `
                <div style="color:#44474F;font-size:14px;line-height:1.8;">
                    <p style="margin-top:0;"><strong style="color:#1A1B21;font-size:16px;">数据收集与使用</strong></p>
                    <p>本插件<strong>不收集、不存储、不上传</strong>任何用户个人数据至开发者服务器。所有配置信息（包括学号、密码、API Key、课表数据、课程评价等）均<strong>仅存储于您本地浏览器的 Chrome Storage 中</strong>，开发者无法访问这些数据。</p>

                    <p style="margin-top:20px;"><strong style="color:#1A1B21;font-size:16px;">第三方 AI 服务</strong></p>
                    <p>当您使用自动登录（验证码识别）、选课助手等 AI 功能时，插件会将相关请求数据（如验证码图片、课程信息等）发送至<strong>您自行配置</strong>的第三方 AI 服务提供商（如 SiliconFlow、OpenAI、智谱 AI 等）。这些请求<strong>直接由您的浏览器发送至对应 API 地址</strong>，不经过开发者服务器。请参阅对应服务提供商的隐私政策以了解其数据处理方式。</p>

                    <p style="margin-top:20px;"><strong style="color:#1A1B21;font-size:16px;">权限使用说明</strong></p>
                    <p><code style="background:#E8E8EF;padding:1px 6px;border-radius:4px;font-size:13px;">storage</code> — 用于在本地保存您的配置信息、课表数据和课程评价。</p>
                    <p><code style="background:#E8E8EF;padding:1px 6px;border-radius:4px;font-size:13px;">activeTab / scripting</code> — 用于在当前标签页注入功能增强脚本（GPA查询、课表抓取、自动评教等），仅在您主动触发的页面上执行。</p>
                    <p><code style="background:#E8E8EF;padding:1px 6px;border-radius:4px;font-size:13px;">host_permissions</code> — 用于访问南大相关系统（统一认证、教务系统、LMS、SEEC 等）以提供自动登录、课表同步、LMS 增强等核心功能，以及访问您配置的 AI API 地址以提供 AI 辅助功能。</p>

                    <p style="margin-top:20px;"><strong style="color:#1A1B21;font-size:16px;">您的权利</strong></p>
                    <p>您可以随时在插件设置页面查看、修改或清除所有存储的数据。卸载插件将自动清除所有本地存储数据。如对隐私政策有任何疑问，请通过下方联系方式与开发者联系。</p>

                    <p style="margin-top:20px;"><strong style="color:#1A1B21;font-size:16px;">政策更新</strong></p>
                    <p>本隐私政策可能随插件功能更新而调整，最新版本将在插件设置页面中同步更新。建议您定期查看。</p>
                </div>
            `;
            NjuModal.open('隐私政策', privacyHtml);
        };
    }

});
