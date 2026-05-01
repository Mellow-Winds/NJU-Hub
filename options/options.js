document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 1. 界面交互逻辑 (UI Interaction)
    // ============================================================

    const tabs = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.settings-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.dataset.target;
            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');
        });
    });

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

    const toggles = document.querySelectorAll('.toggle-password');
    toggles.forEach((iconEl) => {
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
    // 2. 个性化（主题色 / 暗夜模式）
    // ============================================================

    const UI_KEYS = ['ui_theme_color', 'ui_theme_mode', 'ui_font_family'];
    const uiStorage = chrome.storage.sync;

    const applyTheme = ({ color, mode }) => {
        const safeColor = typeof color === 'string' && color.trim() ? color.trim() : '#0ea5e9';
        document.documentElement.style.setProperty('--primary', safeColor);

        const nextMode = mode === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', nextMode);

        const colorInput = document.getElementById('ui-theme-color');
        if (colorInput) colorInput.value = safeColor;

        const darkToggle = document.getElementById('ui-dark-mode');
        if (darkToggle) darkToggle.checked = nextMode === 'dark';

        document.querySelectorAll('.color-chip').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.color?.toLowerCase() === safeColor.toLowerCase());
        });
    };

    const applyFont = (fontKey) => {
        const nextFont = fontKey || 'google-sans-flex';
        document.documentElement.setAttribute('data-font', nextFont);
        const fontSelect = document.getElementById('ui-font-family');
        if (fontSelect) fontSelect.value = nextFont;
    };

    const persistTheme = async ({ color, mode }) => {
        await uiStorage.set({
            ui_theme_color: color,
            ui_theme_mode: mode
        });
    };

    const persistFont = async (fontKey) => {
        await uiStorage.set({ ui_font_family: fontKey });
    };

    // 绑定“个性化”交互
    const bindPersonalize = () => {
        const chips = document.querySelectorAll('.color-chip');
        chips.forEach((btn) => {
            btn.addEventListener('click', async () => {
                const chosen = btn.dataset.color;
                applyTheme({ color: chosen, mode: document.documentElement.getAttribute('data-theme') });
                await persistTheme({ color: chosen, mode: document.documentElement.getAttribute('data-theme') });
            });
        });

        const picker = document.getElementById('ui-theme-color');
        if (picker) {
            picker.addEventListener('input', async (e) => {
                const chosen = e.target.value;
                applyTheme({ color: chosen, mode: document.documentElement.getAttribute('data-theme') });
                await persistTheme({ color: chosen, mode: document.documentElement.getAttribute('data-theme') });
            });
        }

        const darkToggle = document.getElementById('ui-dark-mode');
        if (darkToggle) {
            darkToggle.addEventListener('change', async () => {
                const mode = darkToggle.checked ? 'dark' : 'light';
                applyTheme({ color: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(), mode });
                await persistTheme({ color: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(), mode });
            });
        }

        const fontSelect = document.getElementById('ui-font-family');
        if (fontSelect) {
            fontSelect.addEventListener('change', async () => {
                applyFont(fontSelect.value);
                await persistFont(fontSelect.value);
            });
        }
    };

    bindPersonalize();

    // ============================================================
    // 3. 数据加载逻辑 (Data Loading)
    // ============================================================

    const KEYS = [
        'common-name', 'student_id', 'login_pass',
        'login_autofill', 'login_autologin', 'login_api_url', 'login_api_key', 'login_model',
        'course_major', 'course_pref', 'course_api_url', 'course_api_key', 'course_model',
        // 选课助手个人信息/开关
        'NJU_CAMPUS', 'NJU_CONFLICT', 'NJU_RATING', 'NJU_PIN_FAV',
        'NJU_SCHEDULE',
        'toggle-eval', 'eval_api_url', 'eval_api_key', 'eval_model',
        'toggle-lms',
        // legacy
        'lms_speed',
        // new lms config
        'lms_video_speed', 'lms_video_remove_restrict', 'lms_video_autojump',
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
            if (el) el.value = (val !== undefined && val !== null) ? val : defaultVal;
        };
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val === true;
        };
        const setCheckDefaultOn = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val !== false;
        };

        setVal('common-name', data['common-name']);
        setVal('common-id', data.student_id);
        setVal('common-pwd', data.login_pass);

        setCheck('login-autofill', data.login_autofill);
        setCheck('login-autologin', data.login_autologin);
        setVal('login-api-url', data.login_api_url, 'https://api.siliconflow.cn/v1');
        setVal('login-api-key', data.login_api_key);
        setVal('login-model', data.login_model, 'Qwen/Qwen2-VL-7B-Instruct');

        setVal('course-major', data.course_major);
        setVal('course-pref', data.course_pref);
        setVal('course-api-url', data.course_api_url, 'https://api.siliconflow.cn/v1');
        setVal('course-api-key', data.course_api_key);
        setVal('course-model', data.course_model, 'Qwen/Qwen3-8B');

        // 选课助手：个人信息/开关（与 content script 保持 key 一致）
        setVal('course-my-campus', data.NJU_CAMPUS, 'XL');
        const setCheckDefault = (id, val, defaultVal) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = val === undefined || val === null ? defaultVal : val === true;
        };
        setCheckDefault('course-conflict-check', data.NJU_CONFLICT, true);
        setCheckDefault('course-enable-rating', data.NJU_RATING, true);
        setCheckDefault('course-pin-fav', data.NJU_PIN_FAV, true);

        setCheckDefaultOn('toggle-eval', data['toggle-eval']);
        setVal('eval-api-url', data.eval_api_url, 'https://api.siliconflow.cn/v1');
        setVal('eval-api-key', data.eval_api_key);
        setVal('eval-model', data.eval_model, 'Qwen/Qwen3-8B');

        setCheckDefaultOn('toggle-lms', data['toggle-lms']);

        // LMS 新配置（兼容旧 lms_speed）
        setVal('lms-video-speed', data.lms_video_speed ?? data.lms_speed, '1.0');
        setCheckDefault('lms-video-remove-restrict', data.lms_video_remove_restrict, true);
        setCheckDefault('lms-video-autojump', data.lms_video_autojump, false);
        setCheckDefault('lms-dl-default-all', data.lms_dl_default_all, false);
        setCheckDefault('lms-dl-show-checkbox', data.lms_dl_show_checkbox, true);
        setCheckDefaultOn('toggle-seec-workpanel', data['toggle-seec-workpanel']);
    });

    // ============================================================
    // 4. 数据保存逻辑 (Data Saving)
    // ============================================================

    document.getElementById('save-all-btn').addEventListener('click', () => {
        const btn = document.getElementById('save-all-btn');
        const originalText = btn.innerText;

        btn.innerText = '正在保存...';
        btn.disabled = true;
        btn.style.opacity = '0.75';

        const config = {
            'common-name': document.getElementById('common-name').value.trim(),
            'student_id': document.getElementById('common-id').value.trim(),
            'login_pass': document.getElementById('common-pwd').value.trim(),

            'login_autofill': document.getElementById('login-autofill').checked,
            'login_autologin': document.getElementById('login-autologin').checked,
            'login_api_url': document.getElementById('login-api-url').value.trim(),
            'login_api_key': document.getElementById('login-api-key').value.trim(),
            'login_model': document.getElementById('login-model').value.trim(),

            'course_major': document.getElementById('course-major').value.trim(),
            'course_pref': document.getElementById('course-pref').value.trim(),
            'course_api_url': document.getElementById('course-api-url').value.trim(),
            'course_api_key': document.getElementById('course-api-key').value.trim(),
            'course_model': document.getElementById('course-model').value.trim(),

            // 选课助手个人信息/开关
            'NJU_CAMPUS': document.getElementById('course-my-campus').value,
            'NJU_CONFLICT': document.getElementById('course-conflict-check').checked,
            'NJU_RATING': document.getElementById('course-enable-rating').checked,
            'NJU_PIN_FAV': document.getElementById('course-pin-fav').checked,

            'toggle-eval': document.getElementById('toggle-eval').checked,
            'eval_api_url': document.getElementById('eval-api-url').value.trim(),
            'eval_api_key': document.getElementById('eval-api-key').value.trim(),
            'eval_model': document.getElementById('eval-model').value.trim(),

            'toggle-lms': document.getElementById('toggle-lms').checked,
            // legacy 保留写入，供旧逻辑兜底
            'lms_speed': document.getElementById('lms-video-speed').value,

            // LMS 新配置
            'lms_video_speed': document.getElementById('lms-video-speed').value,
            'lms_video_remove_restrict': document.getElementById('lms-video-remove-restrict').checked,
            'lms_video_autojump': document.getElementById('lms-video-autojump').checked,
            'lms_dl_default_all': document.getElementById('lms-dl-default-all').checked,
            'lms_dl_show_checkbox': document.getElementById('lms-dl-show-checkbox').checked,

            'toggle-seec-workpanel': document.getElementById('toggle-seec-workpanel').checked
        };

        config.login_user = config.student_id;

        const uiConfig = {
            ui_theme_color: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#0ea5e9',
            ui_theme_mode: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
            ui_font_family: document.documentElement.getAttribute('data-font') || 'google-sans-flex'
        };

        chrome.storage.local.set(config, () => {
            uiStorage.set(uiConfig, () => {
            setTimeout(() => {
                btn.innerText = '配置已同步';
                btn.style.opacity = '1';
                btn.disabled = false;
                setTimeout(() => {
                    btn.innerText = originalText;
                }, 1500);
            }, 500);
            });
        });
    });

    // ============================================================
    // 5. 本地数据精细化管理 (Red/Black DB & AI Cache)
    // ============================================================

    const dmList = document.getElementById('dm-list');

    function renderDataManager() {
        chrome.storage.local.get(['NJU_DB', 'NJU_AI_CACHE'], (data) => {
            const db = data.NJU_DB || {};
            const ai = data.NJU_AI_CACHE || {};

            // 合并所有存储的课程 Key
            const allKeys = new Set([...Object.keys(db), ...Object.keys(ai)]);

            if (allKeys.size === 0) {
                dmList.innerHTML = '<div class="dm-empty">暂无任何本地评价库或 AI 分析缓存。</div>';
                return;
            }

            dmList.innerHTML = '';

            // 排序，为了好看一点
            Array.from(allKeys).sort().forEach(key => {
                const hasDb = !!db[key];
                const hasAi = !!ai[key];

                // 格式化展示标签
                const dbTag = hasDb ? `<span class="dm-tag db">评价: ${db[key].length}条</span>` : '';
                let aiTag = '';
                if (hasAi) {
                    const score = ai[key]['综合评分'] || '?';
                    aiTag = `<span class="dm-tag ai">AI: ${score}分</span>`;
                }

                // 替换分隔符 # 为更易读的 -
                const displayTitle = key.replace('#', ' - ');

                const item = document.createElement('div');
                item.className = 'dm-item';
                item.innerHTML = `
                    <label>
                        <input type="checkbox" class="dm-check" value="${key}">
                        <span>${displayTitle}</span>
                    </label>
                    <div class="dm-tags">
                        ${dbTag}
                        ${aiTag}
                    </div>
                `;
                dmList.appendChild(item);
            });
        });
    }

    // 初始化渲染看板
    renderDataManager();

    // 全选
    document.getElementById('dm-select-all').onclick = () => {
        document.querySelectorAll('.dm-check').forEach(cb => cb.checked = true);
    };

    // 反选
    document.getElementById('dm-invert').onclick = () => {
        document.querySelectorAll('.dm-check').forEach(cb => cb.checked = !cb.checked);
    };

    // 删除选中
    document.getElementById('dm-delete').onclick = () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.dm-check:checked'));
        if (checkedBoxes.length === 0) {
            alert('请先勾选需要删除的课程数据！');
            return;
        }

        const keysToDelete = checkedBoxes.map(cb => cb.value);

        if (confirm(`确定要删除选中的 ${keysToDelete.length} 门课程数据吗？（包含历史评价和 AI 缓存）`)) {
            chrome.storage.local.get(['NJU_DB', 'NJU_AI_CACHE'], (data) => {
                let db = data.NJU_DB || {};
                let ai = data.NJU_AI_CACHE || {};
                let hasChanges = false;

                keysToDelete.forEach(key => {
                    if (db[key]) { delete db[key]; hasChanges = true; }
                    if (ai[key]) { delete ai[key]; hasChanges = true; }
                });

                if (hasChanges) {
                    chrome.storage.local.set({ 'NJU_DB': db, 'NJU_AI_CACHE': ai }, () => {
                        renderDataManager(); // 重新渲染列表
                    });
                }
            });
        }
    };

    // 清空所有
    document.getElementById('dm-clear-all').onclick = () => {
        if (confirm('危险操作：确定要清空【所有】历史评价库和 AI 分析缓存吗？')) {
            chrome.storage.local.remove(['NJU_DB', 'NJU_AI_CACHE'], () => {
                renderDataManager();
            });
        }
    };

    // ============================================================
    // 6. 选课助手：课表预览 + 评价管理（导入/导出/清空）
    // ============================================================

    const scheduleModal = document.getElementById('schedule-modal');
    const scheduleBody = document.getElementById('schedule-body');
    const closeSchedule = () => { if (scheduleModal) scheduleModal.style.display = 'none'; };

    const renderSchedule = (list) => {
        if (!scheduleBody) return;
        const items = Array.isArray(list) ? list : [];
        if (items.length === 0) {
            scheduleBody.innerHTML = `
                <div class="schedule-empty">
                    当前没有课表记录。<br>
                    请先打开课表页面并点击页面内的“抓取课表至选课系统”按钮完成同步。<br>
                    同步页面：<span style="font-weight:900">ehall</span>
                </div>
            `;
            return;
        }

        scheduleBody.innerHTML = `
            <div class="schedule-list">
                ${items.map((c) => `
                    <div class="schedule-item">
                        <div class="t1">${c.name || '未命名课程'}</div>
                        <div class="t2">${c.timeStr || ''}</div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    const openSchedule = async () => {
        const data = await chrome.storage.local.get(['NJU_SCHEDULE']);
        renderSchedule(data.NJU_SCHEDULE || []);
        if (scheduleModal) scheduleModal.style.display = 'flex';
    };

    const viewBtn = document.getElementById('btn-view-schedule');
    if (viewBtn) viewBtn.onclick = openSchedule;

    const closeBtn = document.getElementById('schedule-close');
    if (closeBtn) closeBtn.onclick = closeSchedule;
    if (scheduleModal) scheduleModal.addEventListener('click', (e) => { if (e.target === scheduleModal) closeSchedule(); });

    const openEhallBtn = document.getElementById('schedule-open-ehall');
    if (openEhallBtn) openEhallBtn.onclick = () => {
        chrome.tabs.create({ url: 'https://ehall.nju.edu.cn/ywtb-portal/official/index.html#/home/official_home' });
    };

    // 评价：导入（xlsx）
    const dbFile = document.getElementById('course-db-file');
    const btnImport = document.getElementById('course-db-import');
    if (btnImport && dbFile) btnImport.onclick = () => dbFile.click();

    if (dbFile) {
        dbFile.onchange = (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = async (ev) => {
                try {
                    const bytes = new Uint8Array(ev.target.result);
                    const wb = XLSX.read(bytes, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws);

                    const db = {};
                    rows.forEach((row) => {
                        const c = row['课程'] || row['课程名称'];
                        const t = row['授课老师'] || row['任课教师'];
                        const comms = [];
                        Object.keys(row).forEach((k) => {
                            if (String(k).includes('评价') && row[k]) comms.push(row[k]);
                        });
                        if (c && t && comms.length) db[`${c}#${t}`] = comms;
                    });

                    await chrome.storage.local.set({ NJU_DB: db });
                    renderDataManager();
                    alert('导入完成');
                } catch (err) {
                    alert('导入失败：文件格式不正确');
                } finally {
                    dbFile.value = '';
                }
            };
            r.readAsArrayBuffer(f);
        };
    }

    // 评价：导出
    const btnExport = document.getElementById('course-db-export');
    if (btnExport) {
        btnExport.onclick = async () => {
            const data = await chrome.storage.local.get(['NJU_DB']);
            const blob = new Blob([JSON.stringify(data.NJU_DB || {}, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'nju_course_ratings.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
    }

    // 评价：清空
    const btnClear = document.getElementById('course-db-clear');
    if (btnClear) {
        btnClear.onclick = async () => {
            if (!confirm('确定要清空所有评价记录与 AI 缓存吗？')) return;
            await chrome.storage.local.remove(['NJU_DB', 'NJU_AI_CACHE']);
            renderDataManager();
        };
    }

});