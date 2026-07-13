// modules/course.js — 选课助手：评价管理、SeaTable 同步、课表查看
// 由 options.js 在 DOMContentLoaded + 数据加载完成后调用 initCourseModule()

function initCourseModule() {

    // ============================================================
    // 8. Data Manager (Red/Black DB & AI Cache)
    // ============================================================

    const dmList = document.getElementById('dm-list');

    // Data Manager 悬浮评价原文 tooltip
    let dmTooltip = null;
    function ensureDmTooltip() {
        if (dmTooltip) return;
        dmTooltip = document.createElement('div');
        dmTooltip.id = 'dm-tooltip';
        dmTooltip.style.cssText = 'position:fixed;z-index:99999;width:380px;max-height:420px;overflow-y:auto;background:var(--md-sys-color-surface-container-lowest);border:1px solid var(--md-sys-color-outline-variant);border-radius:14px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);opacity:0;pointer-events:none;transform:translateY(4px);transition:opacity 0.18s,transform 0.18s;';
        document.body.appendChild(dmTooltip);
    }

    function showDmTooltip(anchor, key, comments) {
        ensureDmTooltip();
        if (!comments || comments.length === 0) return;
        let html = `<div style="font-weight:800;font-size:13px;color:var(--md-sys-color-primary);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--md-sys-color-outline-variant);">📋 ${key.replace('#',' - ')} (${comments.length}条评价)</div>`;
        comments.forEach((c, i) => {
            const safe = String(c).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
            html += `<div style="font-size:12px;color:var(--md-sys-color-on-surface);margin-bottom:8px;padding:8px 10px;background:var(--md-sys-color-surface-container-low);border-radius:8px;border-left:3px solid var(--md-sys-color-primary);line-height:1.6;">${safe}</div>`;
        });
        dmTooltip.innerHTML = html;
        const r = anchor.getBoundingClientRect();
        dmTooltip.style.left = Math.min(r.right + 4, window.innerWidth - 400) + 'px';
        dmTooltip.style.top = Math.min(r.top, window.innerHeight - 440) + 'px';
        dmTooltip.style.opacity = '1';
        dmTooltip.style.transform = 'translateY(0)';
        dmTooltip.style.pointerEvents = 'auto';
    }

    function hideDmTooltip() {
        if (!dmTooltip) return;
        dmTooltip.style.opacity = '0';
        dmTooltip.style.transform = 'translateY(4px)';
        dmTooltip.style.pointerEvents = 'none';
    }

    ensureDmTooltip();
    dmTooltip.addEventListener('mouseenter', () => { if (dmTooltip._timer) clearTimeout(dmTooltip._timer); });
    dmTooltip.addEventListener('mouseleave', hideDmTooltip);

    function renderDataManager() {
        chrome.storage.local.get(['NJU_DB', 'NJU_AI_CACHE'], (data) => {
            const db = data.NJU_DB || {};
            const ai = data.NJU_AI_CACHE || {};
            const allKeys = new Set([...Object.keys(db), ...Object.keys(ai)]);

            if (allKeys.size === 0) {
                dmList.innerHTML = '<div class="dm-empty">暂无任何本地评价库或 AI 分析缓存。</div>';
                return;
            }

            dmList.innerHTML = '';

            Array.from(allKeys).sort().forEach((key, index) => {
                const hasDb = !!db[key];
                const hasAi = !!ai[key];

                const dbTag = hasDb ? `<span class="dm-tag db">评价: ${db[key].length}条</span>` : '';
                let aiTag = '';
                if (hasAi) {
                    const score = ai[key]['综合评分'] || '?';
                    aiTag = `<span class="dm-tag ai">AI: ${score}分</span>`;
                }

                const displayTitle = key.replace('#', ' - ');

                const item = document.createElement('div');
                item.className = 'dm-item';
                item.style.animationDelay = (index * 30) + 'ms';
                item.style.cursor = hasDb ? 'pointer' : 'default';
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

                if (hasDb) {
                    item.addEventListener('mouseenter', () => {
                        if (dmTooltip._timer) clearTimeout(dmTooltip._timer);
                        showDmTooltip(item, key, db[key]);
                    });
                    item.addEventListener('mouseleave', () => {
                        dmTooltip._timer = setTimeout(hideDmTooltip, 350);
                    });
                }

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
            chrome.tabs.create({ url: 'https://ehall.nju.edu.cn/ywtb-portal/official/index.html#/home/official_home' });
        };
    }

    // ============================================================
    // 10. Course Rating Import/Export/Clear
    // ============================================================

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
                    NjuModal.alert('导入', '导入完成');
                } catch (err) {
                    NjuModal.alert('导入失败', '文件格式不正确，请检查文件内容。');
                } finally {
                    dbFile.value = '';
                }
            };
            r.readAsArrayBuffer(f);
        };
    }

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

    const btnClear = document.getElementById('course-db-clear');
    if (btnClear) {
        btnClear.onclick = async () => {
            NjuModal.confirm({
                title: '清空数据',
                message: '确定要清空所有评价记录与 AI 缓存吗？此操作不可撤销。',
                danger: true,
                onConfirm: async () => {
                    await chrome.storage.local.remove(['NJU_DB', 'NJU_AI_CACHE']);
                    renderDataManager();
                }
            });
        };
    }

    // ============================================================
    // 9.5. SeaTable 云端同步
    // ============================================================

    const seatableStatus = document.getElementById('seatable-status');

    function setSeatableStatus(msg, isError = false) {
        if (!seatableStatus) return;
        seatableStatus.textContent = msg;
        seatableStatus.style.color = isError ? '#c62828' : '';
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
            if (db[dbKey]) {
                const existing = new Set(db[dbKey]);
                existing.add(fullComment);
                db[dbKey] = Array.from(existing);
            } else {
                db[dbKey] = [fullComment];
            }
        });
        return db;
    }

    async function seatableSync(config) {
        const { apiToken, serverUrl, tableName } = config;
        if (!apiToken) throw new Error('API Token 未配置');
        if (!tableName) throw new Error('表名未配置');

        setSeatableStatus('正在获取 Base Token...');
        const { accessToken, dtableUuid, dtableServer } = await seatableGetBaseToken(apiToken, serverUrl);

        setSeatableStatus('正在获取表结构...');
        const colMap = await seatableFetchColumns(accessToken, dtableServer, dtableUuid, tableName);

        setSeatableStatus('正在拉取云端数据...');
        const rows = await seatableFetchRows(accessToken, dtableServer, dtableUuid, tableName);

        if (rows.length === 0) throw new Error('表中没有数据，请检查表名是否正确');

        const newDB = seatableConvertRows(rows, colMap);
        const courseCount = Object.keys(newDB).length;
        if (courseCount === 0) throw new Error('未找到匹配的列（需要"课程名称"、"授课教师"和"评价"列）');

        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['NJU_DB'], (data) => {
                const existingDB = data.NJU_DB || {};
                let mergedCount = 0;
                for (const [key, comms] of Object.entries(newDB)) {
                    if (existingDB[key]) {
                        const existing = new Set(existingDB[key]);
                        const beforeSize = existing.size;
                        comms.forEach(c => existing.add(c));
                        if (existing.size > beforeSize) mergedCount++;
                        existingDB[key] = Array.from(existing);
                    } else {
                        existingDB[key] = comms;
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

    const seatableSyncBtn = document.getElementById('course-seatable-sync');
    if (seatableSyncBtn) {
        seatableSyncBtn.onclick = async () => {
            seatableSyncBtn.disabled = true;
            seatableSyncBtn.textContent = '同步中...';
            setSeatableStatus('');
            try {
                const result = await seatableSync({ apiToken: SEATABLE_TOKEN, serverUrl: SEATABLE_SERVER, tableName: SEATABLE_TABLE });
                setSeatableStatus(`同步完成！合并 ${result.mergedCount} 门课程（共 ${result.totalCourses} 门），云端拉取 ${result.courseCount} 门`);
                renderDataManager();
            } catch (err) {
                setSeatableStatus(`同步失败: ${err.message}`, true);
            } finally {
                seatableSyncBtn.disabled = false;
                seatableSyncBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>立即同步';
            }
        };
    }

    // Expose renderDataManager for external calls (e.g., after save)
    window._renderDataManager = renderDataManager;
}