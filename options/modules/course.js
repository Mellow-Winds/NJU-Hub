// modules/course.js — 选课助手：评价管理、SeaTable 同步、课表查看
// 由 options.js 在 DOMContentLoaded + 数据加载完成后调用 initCourseModule()

function initCourseModule() {

    // ============================================================
    // 8. Data Manager (Red/Black DB & AI Cache)
    // ============================================================

    const dmList = document.getElementById('dm-list');

    function getReviewCount(data) {
        if (!data) return 0;
        if (Array.isArray(data)) return data.length;
        if (typeof data === 'object') {
            let count = 0;
            for (const revs of Object.values(data)) {
                if (Array.isArray(revs)) count += revs.length;
            }
            return count;
        }
        return 0;
    }

    const srcLabels = {
        'nju_course_ratings': '📖 鼓励你学哪门课',
        '2020': '🏷️ 2020 红黑榜', '2021': '🏷️ 2021 南小宝',
        '2022': '🏷️ 2022 红黑榜', '2023': '🏷️ 2023 红黑榜',
        '2024冬': '🏷️ 2024冬 红黑榜', '2024春': '🏷️ 2024春 红黑榜',
        '2025春': '🏷️ 2025春 红黑榜'
    };

    function buildReviewHTML(key, comments) {
        if (!comments) return '';
        let html = '';
        let totalCount = 0;

        if (Array.isArray(comments)) {
            totalCount = comments.length;
            if (totalCount === 0) return '';
            html = `<div style="font-weight:800;font-size:13px;color:var(--md-sys-color-primary);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--md-sys-color-outline-variant);">📋 ${key.replace('#',' - ')} (${totalCount}条评价)</div>`;
            comments.forEach((c) => {
                const safe = String(c).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
                html += `<div style="font-size:12px;color:var(--md-sys-color-on-surface);margin-bottom:6px;padding:6px 8px;background:var(--md-sys-color-surface-container-low);border-radius:6px;border-left:3px solid var(--md-sys-color-primary);line-height:1.6;">${safe}</div>`;
            });
        } else if (typeof comments === 'object') {
            for (const [src, revs] of Object.entries(comments)) {
                if (!revs || !Array.isArray(revs) || revs.length === 0) continue;
                totalCount += revs.length;
            }
            if (totalCount === 0) return '';
            html = `<div style="font-weight:800;font-size:13px;color:var(--md-sys-color-primary);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--md-sys-color-outline-variant);">📋 ${key.replace('#',' - ')} (${totalCount}条评价)</div>`;
            for (const [src, revs] of Object.entries(comments)) {
                if (!revs || !Array.isArray(revs) || revs.length === 0) continue;
                const label = srcLabels[src] || `📂 ${src}`;
                html += `<div style="font-weight:700;color:var(--md-sys-color-on-surface-variant);margin:8px 0 4px;font-size:13px;">${label} (${revs.length}条)</div>`;
                revs.forEach((c) => {
                    const safe = String(c).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
                    html += `<div style="font-size:12px;color:var(--md-sys-color-on-surface);margin-bottom:6px;padding:6px 8px;background:var(--md-sys-color-surface-container-low);border-radius:6px;border-left:3px solid var(--md-sys-color-primary);line-height:1.6;">${safe}</div>`;
                });
            }
        }
        return html || '';
    }

    async function renderDataManager() {
        // 首次打开：若 NJU_DB 为空，从内置 merged_ratings.json 初始化
        const initData = await chrome.storage.local.get(['NJU_DB']);
        if (!initData.NJU_DB || Object.keys(initData.NJU_DB).length === 0) {
            try {
                const url = chrome.runtime.getURL('data/merged_ratings.json');
                const resp = await fetch(url);
                if (resp.ok) {
                    const builtin = await resp.json();
                    if (builtin && Object.keys(builtin).length > 0) {
                        await chrome.storage.local.set({ NJU_DB: builtin });
                    }
                }
            } catch (e) {
                console.warn('[NJU-Hub] 内置评价库加载失败:', e);
            }
        }

        chrome.storage.local.get(['NJU_DB', 'NJU_AI_CACHE'], (data) => {
            const db = data.NJU_DB || {};
            const ai = data.NJU_AI_CACHE || {};

            // 跳过仅有 AI 缓存但无原始评价的条目（孤岛数据）
            const keysToShow = Object.keys(db).filter(k => getReviewCount(db[k]) > 0);

            // 顺便清理孤岛 AI 缓存
            const orphanAiKeys = Object.keys(ai).filter(k => !db[k] || getReviewCount(db[k]) === 0);
            if (orphanAiKeys.length > 0) {
                orphanAiKeys.forEach(k => delete ai[k]);
                chrome.storage.local.set({ 'NJU_AI_CACHE': ai });
            }

            if (keysToShow.length === 0) {
                dmList.innerHTML = '<div class="dm-empty">暂无评价数据。请点击"同步评价库"获取云端数据。</div>';
                return;
            }

            dmList.innerHTML = '';

            keysToShow.sort().forEach((key, index) => {
                const reviewCount = getReviewCount(db[key]);
                const hasAi = !!ai[key];
                const displayTitle = key.replace('#', ' - ');

                const item = document.createElement('div');
                item.className = 'dm-item';
                item.style.animationDelay = (index * 30) + 'ms';
                item.innerHTML = `
                    <label class="dm-item-label">
                        <input type="checkbox" class="dm-check" value="${key}">
                        <span class="dm-item-title">${displayTitle}</span>
                    </label>
                    <div class="dm-item-right">
                        <span class="dm-tag db">${reviewCount}条评价</span>
                        ${hasAi ? `<span class="dm-tag ai">AI: ${ai[key]['综合评分'] || '?'}分</span>` : ''}
                        <span class="dm-expand-hint">▼</span>
                    </div>
                `;

                // 点击展开评价（checkbox 不触发）
                const expandHint = item.querySelector('.dm-expand-hint');
                item.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    // 收起其他已展开的
                    const allExpanded = dmList.querySelectorAll('.dm-item.expanded');
                    allExpanded.forEach(el => {
                        if (el !== item) {
                            el.classList.remove('expanded');
                            const h = el.querySelector('.dm-expand-hint');
                            if (h) h.textContent = '▼';
                            const panel = el.nextElementSibling;
                            if (panel && panel.classList.contains('dm-expand-panel')) panel.remove();
                        }
                    });
                    // 切换当前
                    if (item.classList.contains('expanded')) {
                        item.classList.remove('expanded');
                        if (expandHint) expandHint.textContent = '▼';
                        const panel = item.nextElementSibling;
                        if (panel && panel.classList.contains('dm-expand-panel')) panel.remove();
                    } else {
                        item.classList.add('expanded');
                        if (expandHint) expandHint.textContent = '▲';
                        const panel = document.createElement('div');
                        panel.className = 'dm-expand-panel';
                        // 构建评价 + AI 分析
                        let panelHTML = buildReviewHTML(key, db[key]);
                        if (hasAi) {
                            const a = ai[key];
                            panelHTML += `
                                <div style="margin-top:14px;padding-top:12px;border-top:2px solid var(--md-sys-color-outline-variant);">
                                    <div style="font-weight:800;font-size:13px;color:#660874;margin-bottom:8px;">🤖 AI 深度解析</div>
                                    <div style="font-size:12px;color:var(--md-sys-color-on-surface);margin-bottom:4px;">● <b>给分:</b> ${a['给分'] || '—'}</div>
                                    <div style="font-size:12px;color:var(--md-sys-color-on-surface);margin-bottom:4px;">● <b>任务:</b> ${a['事少'] || '—'}</div>
                                    <div style="font-size:12px;color:var(--md-sys-color-on-surface);margin-bottom:4px;">● <b>签到:</b> ${a['签到'] || '—'}</div>
                                    <div style="font-size:12px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--md-sys-color-outline-variant);color:#1b5e20;font-weight:bold;">结论: ${a['总结'] || '—'}</div>
                                    <div style="font-size:11px;margin-top:8px;padding-top:6px;border-top:1px solid var(--md-sys-color-outline-variant);color:var(--md-sys-color-on-surface-variant);text-align:center;">⚠️ AI 生成可能有误，注意核实。如需核实请看原评价。</div>
                                </div>`;
                        }
                        panel.innerHTML = panelHTML;
                        item.after(panel);
                    }
                });

                dmList.appendChild(item);
            });

            filterDataManager();
        });
    }

    function filterDataManager() {
        const query = (document.getElementById('dm-search')?.value || '').trim().toLowerCase();
        document.querySelectorAll('.dm-item').forEach(item => {
            const text = (item.textContent || '').toLowerCase();
            item.style.display = query === '' || text.includes(query) ? '' : 'none';
        });
    }

    renderDataManager();

    const dmSearchInput = document.getElementById('dm-search');
    if (dmSearchInput) {
        dmSearchInput.addEventListener('input', filterDataManager);
    }

    document.getElementById('dm-select-all').onclick = () => {
        document.querySelectorAll('.dm-check').forEach(cb => cb.checked = true);
    };

    document.getElementById('dm-invert').onclick = () => {
        document.querySelectorAll('.dm-check').forEach(cb => cb.checked = !cb.checked);
    };

    document.getElementById('dm-delete').onclick = () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.dm-check:checked'));
        if (checkedBoxes.length === 0) {
            NjuModal.alert('提示', '请先勾选需要删除的课程数据！');
            return;
        }

        const keysToDelete = checkedBoxes.map(cb => cb.value);

        NjuModal.confirm({
            title: '删除确认',
            message: `确定要删除选中的 ${keysToDelete.length} 门课程数据吗？（包含历史评价和 AI 缓存）`,
            danger: true,
            onConfirm: () => {
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
                            renderDataManager();
                        });
                    }
                });
            }
        });
    };

    document.getElementById('dm-clear-all').onclick = () => {
        NjuModal.confirm({
            title: '危险操作',
            message: '确定要清空【所有】历史评价库和 AI 分析缓存吗？此操作不可撤销。',
            danger: true,
            onConfirm: () => {
                chrome.storage.local.remove(['NJU_DB', 'NJU_AI_CACHE'], () => {
                    renderDataManager();
                });
            }
        });
    };

    // ============================================================
    // 9. Schedule Preview Modal (Container Transform)
    // ============================================================

    const scheduleModal = document.getElementById('schedule-modal');
    const scheduleBody = document.getElementById('schedule-body');

    const openModal = () => {
        if (!scheduleModal) return;
        scheduleModal.style.display = 'flex';
        scheduleModal.offsetHeight;
        scheduleModal.classList.add('open');
    };

    const closeModal = () => {
        if (!scheduleModal) return;
        scheduleModal.classList.remove('open');
        setTimeout(() => {
            scheduleModal.style.display = 'none';
        }, 400);
    };

    const renderSchedule = (list) => {
        if (!scheduleBody) return;
        const items = Array.isArray(list) ? list : [];
        if (items.length === 0) {
            scheduleBody.innerHTML = `
                <div class="schedule-empty">
                    当前没有课表记录。<br>
                    请先打开课表页面并点击页面内的"抓取课表至选课系统"按钮完成同步。<br>
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
        openModal();
    };

    const importBtn = document.getElementById('btn-import-schedule');
    if (importBtn) {
        importBtn.onclick = () => {
            chrome.tabs.create({ url: 'https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/*default/index.do#/xskcb' });
        };
    }

    const viewBtn = document.getElementById('btn-view-schedule');
    if (viewBtn) viewBtn.onclick = openSchedule;

    const clearScheduleBtn = document.getElementById('btn-clear-schedule');
    if (clearScheduleBtn) {
        clearScheduleBtn.onclick = async () => {
            const data = await chrome.storage.local.get(['NJU_SCHEDULE']);
            const count = (Array.isArray(data.NJU_SCHEDULE) && data.NJU_SCHEDULE.length) || 0;
            if (count === 0) {
                NjuModal.alert('提示', '当前没有课表记录，无需清空。');
                return;
            }
            NjuModal.confirm({
                title: '清空课表',
                message: `确定要清空当前 ${count} 门课程吗？此操作不可撤销。`,
                danger: true,
                onConfirm: async () => {
                    await chrome.storage.local.remove(['NJU_SCHEDULE']);
                    renderSchedule([]);
                    NjuModal.alert('提示', '课表已清空。');
                }
            });
        };
    }

    const closeBtn = document.getElementById('schedule-close');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (scheduleModal) {
        scheduleModal.addEventListener('click', (e) => {
            if (e.target === scheduleModal) closeModal();
        });
    }

    const openEhallBtn = document.getElementById('schedule-open-ehall');
    if (openEhallBtn) {
        openEhallBtn.onclick = () => {
            chrome.tabs.create({ url: 'https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/*default/index.do#/xskcb' });
        };
    }

    // ============================================================
    // 10. Course Rating Export
    // ============================================================

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

    // ============================================================
    // 11. Cloud Sync (GitHub + SeaTable)
    // ============================================================

    const syncStatus = document.getElementById('course-sync-status');

    function setSyncStatus(msg, isError = false) {
        if (!syncStatus) return;
        syncStatus.textContent = msg;
        syncStatus.style.color = isError ? '#c62828' : '';
    }

    function seatableFetch(url, token, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'seatableRequest',
                payload: {
                    url,
                    method,
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Accept': 'application/json; charset=utf-8; indent=4',
                        ...(body ? { 'Content-Type': 'application/json' } : {})
                    },
                    ...(body ? { body: JSON.stringify(body) } : {})
                }
            }, (resp) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!resp || !resp.ok) {
                    const errMsg = resp?.rawText || resp?.parseError || resp?.data?.error_msg || resp?.error || `HTTP ${resp?.status || '未知'}`;
                    reject(new Error(errMsg));
                    return;
                }
                if (resp.parseError) {
                    reject(new Error(`JSON 解析失败: ${resp.parseError}\n原始响应: ${resp.rawText || '(空)'}`));
                    return;
                }
                resolve(resp.data);
            });
        });
    }

    async function seatableGetBaseToken(apiToken, serverUrl) {
        const url = `${serverUrl}/api/v2.1/dtable/app-access-token/`;
        const data = await seatableFetch(url, apiToken);
        if (!data.access_token) throw new Error('返回数据中缺少 access_token');
        return {
            accessToken: data.access_token,
            dtableUuid: data.dtable_uuid,
            dtableServer: data.dtable_server || serverUrl
        };
    }

    async function seatableFetchRows(baseToken, dtableServer, dtableUuid, tableName) {
        const url = `${dtableServer}api/v2/dtables/${dtableUuid}/rows/?table_name=${encodeURIComponent(tableName)}&limit=1000`;
        const data = await seatableFetch(url, baseToken);
        return data.rows || [];
    }

    async function seatableFetchColumns(baseToken, dtableServer, dtableUuid, tableName) {
        const url = `${dtableServer}api/v2/dtables/${dtableUuid}/columns/?table_name=${encodeURIComponent(tableName)}`;
        const data = await seatableFetch(url, baseToken);
        if (!data.columns || data.columns.length === 0) throw new Error('未找到列定义');
        const nameToKey = {};
        data.columns.forEach(col => { nameToKey[col.name] = col.key; });
        return nameToKey;
    }

    function seatableConvertRows(rows, col) {
        const keyCN = col['课程名称'] || col['课程名'] || col['课程'];
        const keyTch = col['授课教师'] || col['教师'] || col['老师'];
        const keyComment = col['评价'] || col['评论'] || col['评价内容'];
        const keyDiff = col['课程难度'] || col['难度'];
        const keyGrade = col['给分好坏'] || col['给分'] || col['给分情况'];
        const keyHW = col['作业多少'] || col['作业'] || col['作业量'];
        const keyExam = col['收获多少'] || col['考试'] || col['考试情况'];

        if (!keyCN || !keyTch || !keyComment) {
            console.warn('[SeaTable] 列映射不完整，可用列名:', Object.keys(col).join(', '));
        }

        const db = {};
        rows.forEach(row => {
            const courseName = (keyCN && row[keyCN]) || '';
            const teacher = (keyTch && row[keyTch]) || '';
            const comment = (keyComment && row[keyComment]) || '';

            if (!courseName || !teacher) return;
            if (!comment || !String(comment).trim()) return;

            const parts = [String(comment).trim()];
            const tags = [];
            if (keyDiff && row[keyDiff]) tags.push(`难度:${row[keyDiff]}`);
            if (keyGrade && row[keyGrade]) tags.push(`给分:${row[keyGrade]}`);
            if (keyHW && row[keyHW]) tags.push(`作业:${row[keyHW]}`);
            if (keyExam && row[keyExam]) tags.push(`考试:${row[keyExam]}`);
            if (tags.length > 0) parts.push(`【${tags.join(' | ')}】`);

            const fullComment = parts.join(' ');

            const dbKey = `${courseName}#${teacher}`;
            if (!db[dbKey]) db[dbKey] = { 'nju_course_ratings': [] };
            const arr = db[dbKey]['nju_course_ratings'];
            if (!arr.includes(fullComment)) arr.push(fullComment);
        });
        return db;
    }

    async function seatableSync(config) {
        const { apiToken, serverUrl, tableName } = config;
        if (!apiToken) throw new Error('API Token 未配置');
        if (!tableName) throw new Error('表名未配置');

        setSyncStatus('正在获取 Base Token...');
        const { accessToken, dtableUuid, dtableServer } = await seatableGetBaseToken(apiToken, serverUrl);

        setSyncStatus('正在获取表结构...');
        const colMap = await seatableFetchColumns(accessToken, dtableServer, dtableUuid, tableName);

        setSyncStatus('正在拉取云端数据...');
        const rows = await seatableFetchRows(accessToken, dtableServer, dtableUuid, tableName);

        if (rows.length === 0) throw new Error('表中没有数据，请检查表名是否正确');

        const newDB = seatableConvertRows(rows, colMap);
        const courseCount = Object.keys(newDB).length;
        if (courseCount === 0) throw new Error('未找到匹配的列（需要"课程名称"、"授课教师"和"评价"列）');

        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['NJU_DB'], (data) => {
                const existingDB = data.NJU_DB || {};
                let mergedCount = 0;
                for (const [key, srcObj] of Object.entries(newDB)) {
                    const newRevs = srcObj['nju_course_ratings'] || [];
                    if (existingDB[key]) {
                        let existing = existingDB[key];
                        // 兼容旧数组格式：转为对象格式
                        let arr;
                        if (Array.isArray(existing)) {
                            arr = existing;
                            existing = { 'nju_course_ratings': arr };
                            existingDB[key] = existing;
                        } else if (existing && typeof existing === 'object') {
                            arr = existing['nju_course_ratings'] || (existing['nju_course_ratings'] = []);
                        } else {
                            arr = [];
                            existing = { 'nju_course_ratings': arr };
                            existingDB[key] = existing;
                        }
                        const beforeSize = arr.length;
                        const set = new Set(arr);
                        newRevs.forEach(c => set.add(c));
                        existing['nju_course_ratings'] = Array.from(set);
                        if (existing['nju_course_ratings'].length > beforeSize) mergedCount++;
                    } else {
                        existingDB[key] = srcObj;
                        mergedCount++;
                    }
                }
                chrome.storage.local.set({ NJU_DB: existingDB, seatable_last_sync: Date.now() }, () => {
                    resolve({ courseCount, mergedCount, totalCourses: Object.keys(existingDB).length });
                });
            });
        });
    }

    const SEATABLE_TOKEN = '00f50a5653ad7f17f018fbc3a8a88d141ad33e23';
    const SEATABLE_SERVER = 'https://table.nju.edu.cn';
    const SEATABLE_TABLE = 'opendata_export';

    function githubFetch(url) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'fetchJson', payload: { url } }, (resp) => {
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                if (!resp || !resp.ok) { reject(new Error(resp?.error || resp?.rawText || `HTTP ${resp?.status}`)); return; }
                resolve(resp.data);
            });
        });
    }

    const GITHUB_REVIEWS_URL = 'https://raw.githubusercontent.com/Mellow-Winds/NJU-Hub/main/data/merged_ratings.json';
    const GITHUB_AI_URL = 'https://raw.githubusercontent.com/Mellow-Winds/NJU-Hub/main/data/ai_cache.json';

    // 同步评价库（并行：GitHub + SeaTable，并关系）
    const syncReviewsBtn = document.getElementById('course-sync-reviews');
    if (syncReviewsBtn) {
        syncReviewsBtn.onclick = async () => {
            syncReviewsBtn.disabled = true;
            const origHTML = syncReviewsBtn.innerHTML;
            syncReviewsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>同步中...';
            setSyncStatus('');

            // 并行拉取 GitHub + SeaTable
            const githubPromise = (async () => {
                const remote = await githubFetch(GITHUB_REVIEWS_URL);
                if (!remote || Object.keys(remote).length === 0) throw new Error('远程数据为空');
                const data = await chrome.storage.local.get(['NJU_DB']);
                const db = data.NJU_DB || {};
                let merged = 0;
                for (const [key, val] of Object.entries(remote)) {
                    if (db[key]) {
                        const existing = db[key];
                        if (typeof existing === 'object' && !Array.isArray(existing) && typeof val === 'object' && !Array.isArray(val)) {
                            for (const [src, revs] of Object.entries(val)) {
                                if (!Array.isArray(revs)) continue;
                                if (!existing[src]) { existing[src] = revs; merged++; }
                                else {
                                    const set = new Set([...existing[src], ...revs]);
                                    if (set.size > existing[src].length) { existing[src] = Array.from(set); merged++; }
                                }
                            }
                        } else if (Array.isArray(existing) && Array.isArray(val)) {
                            const set = new Set([...existing, ...val]);
                            if (set.size > existing.length) { db[key] = Array.from(set); merged++; }
                        } else {
                            db[key] = val; merged++;
                        }
                    } else {
                        db[key] = val; merged++;
                    }
                }
                await chrome.storage.local.set({ NJU_DB: db });
                return { merged, total: Object.keys(remote).length };
            })();

            const seatablePromise = (async () => {
                const result = await seatableSync({ apiToken: SEATABLE_TOKEN, serverUrl: SEATABLE_SERVER, tableName: SEATABLE_TABLE });
                return { merged: result.mergedCount || 0, total: result.courseCount || 0 };
            })();

            const [githubResult, seatableResult] = await Promise.allSettled([githubPromise, seatablePromise]);

            const githubOk = githubResult.status === 'fulfilled';
            const seatableOk = seatableResult.status === 'fulfilled';
            const githubInfo = githubOk ? githubResult.value : null;
            const seatableInfo = seatableOk ? seatableResult.value : null;

            if (!githubOk) console.warn('[NJU-Hub] GitHub 评价库拉取失败:', githubResult.reason);
            if (!seatableOk) console.warn('[NJU-Hub] SeaTable 同步失败:', seatableResult.reason);

            if (githubOk || seatableOk) {
                const parts = [];
                if (githubOk) parts.push(`GitHub: ${githubInfo.total} 门课程`);
                if (seatableOk) parts.push(`SeaTable: 合并 ${seatableInfo.merged} 门`);
                setSyncStatus(`同步完成！${parts.join('，')}`);
            } else {
                setSyncStatus('同步失败：GitHub 和 SeaTable 均无法连接，请稍后重试', true);
            }

            syncReviewsBtn.disabled = false;
            syncReviewsBtn.innerHTML = origHTML;
            renderDataManager();
        };
    }

    // 同步AI评价库（GitHub）
    const syncAIBtn = document.getElementById('course-sync-ai');
    if (syncAIBtn) {
        syncAIBtn.onclick = async () => {
            syncAIBtn.disabled = true;
            const origHTML = syncAIBtn.innerHTML;
            syncAIBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>同步中...';
            setSyncStatus('');

            try {
                setSyncStatus('正在从 GitHub 拉取 AI 评价库...');
                const remote = await githubFetch(GITHUB_AI_URL);
                if (remote && Object.keys(remote).length > 0) {
                        const data = await chrome.storage.local.get(['NJU_AI_CACHE']);
                        const ai = data.NJU_AI_CACHE || {};
                        let merged = 0;
                        for (const [key, val] of Object.entries(remote)) {
                            if (!ai[key]) { ai[key] = val; merged++; }
                            else { Object.assign(ai[key], val); merged++; }
                        }
                        await chrome.storage.local.set({ NJU_AI_CACHE: ai });
                        setSyncStatus(`AI 评价库同步完成！${merged} 门课程`);
                    } else {
                        setSyncStatus('同步失败：远程数据为空', true);
                    }
            } catch (e) {
                console.warn('[NJU-Hub] AI 评价库拉取失败:', e);
                setSyncStatus(`同步失败: ${e.message}`, true);
            }

            syncAIBtn.disabled = false;
            syncAIBtn.innerHTML = origHTML;
            renderDataManager();
        };
    }

    // Expose renderDataManager for external calls (e.g., after save)
    window._renderDataManager = renderDataManager;
}