/**
 * scripts/xk/xk_filter.js
 *
 * 排序与过滤层：替换选课页「选择过滤」板块，新增「排序方式」板块
 *  - applyFilter：过滤冲突 / 已满 / 跨校区（自行隐藏行）
 *  - renderToolbar：注入「排序方式 + 过滤 + 加载全部课程」工具栏
 * 依赖：window.__XK__ (storage, conflict, ui)
 */

(function () {
    'use strict';

    const { GM_getValue, GM_setValue, STORAGE, checkConflict, isFull, CAMPUS_MAP, applyRowOrder } = window.__XK__;

    const SORT_MODES = ['none', 'ai', 'prob', 'time'];

    /**
     * 过滤：冲突 / 已满 / 跨校区（用 display 隐藏行，可逆）
     */
    const applyFilter = () => {
        const tbody = document.querySelector('.course-body');
        if (!tbody) return;

        const filterConflict = GM_getValue(STORAGE.FILTER_CONFLICT, false);
        const filterFull = GM_getValue(STORAGE.FILTER_FULL, false);
        const filterCampus = GM_getValue(STORAGE.FILTER_CAMPUS, false);
        const myCampus = GM_getValue(STORAGE.CAMPUS, 'XL');
        const myCampusName = CAMPUS_MAP[myCampus];

        tbody.querySelectorAll('tr.course-tr').forEach(row => {
            let hide = false;

            if (filterConflict) {
                const sj = row.querySelector('.sjdd')?.innerText?.trim() || '';
                if (sj && checkConflict(sj)) hide = true;
            }

            if (!hide && filterFull) {
                const yx = row.querySelector('.yxrs')?.innerText?.trim() || '';
                if (isFull(yx)) hide = true;
            }

            if (!hide && filterCampus) {
                const xq = row.querySelector('.xq')?.innerText?.trim() || '';
                if (xq && xq !== '全部' && !xq.includes(myCampusName)) hide = true;
            }

            row.style.display = hide ? 'none' : '';
        });
    };

    /**
     * 找到站点原「选择过滤」板块（第一个含 data-search="SFCT" 的 search-item）
     */
    const findFilterItem = () => {
        const items = document.querySelectorAll('.search-container .search-item');
        for (const it of items) {
            if (it.querySelector('[data-search="SFCT"], [data-search="SFYM"]')) return it;
        }
        // 兜底：取第一个 .search-item
        const first = document.querySelector('.search-container .search-item');
        return first || null;
    };

    /**
     * 渲染工具栏（替换站点「选择过滤」板块）
     */
    const renderToolbar = () => {
        if (document.getElementById('xk-toolbar-root')) return;

        const item = findFilterItem();
        if (!item) return;

        const mode = GM_getValue(STORAGE.SORT_MODE, 'none');
        const modeIdx = Math.max(0, SORT_MODES.indexOf(mode));

        item.classList.add('xk-filter-item');
        item.innerHTML = `
            <div class="xk-toolbar" id="xk-toolbar-root">
                <div class="xk-tb-row">
                    <span class="xk-tb-label">排序方式</span>
                    <div class="ios-seg-ctrl seg-sort" id="xk-sort-ctrl" data-idx="${modeIdx}">
                        <div class="seg-slider"></div>
                        <div class="seg-btn ${mode === 'none' ? 'active' : ''}" data-val="none">默认</div>
                        <div class="seg-btn ${mode === 'ai' ? 'active' : ''}" data-val="ai">AI推荐</div>
                        <div class="seg-btn ${mode === 'prob' ? 'active' : ''}" data-val="prob">选中概率</div>
                        <div class="seg-btn ${mode === 'time' ? 'active' : ''}" data-val="time">上课时间</div>
                    </div>
                </div>

                <div class="xk-tb-row">
                    <span class="xk-tb-label">过滤</span>
                    <div class="xk-sw-group">
                        <div class="xk-sw-item">
                            <span>冲突</span>
                            <div id="xk-flt-conflict" class="ios-sw ${GM_getValue(STORAGE.FILTER_CONFLICT, false) ? 'on' : ''}"></div>
                        </div>
                        <div class="xk-sw-item">
                            <span>已满</span>
                            <div id="xk-flt-full" class="ios-sw ${GM_getValue(STORAGE.FILTER_FULL, false) ? 'on' : ''}"></div>
                        </div>
                        <div class="xk-sw-item">
                            <span>跨校区</span>
                            <div id="xk-flt-campus" class="ios-sw ${GM_getValue(STORAGE.FILTER_CAMPUS, false) ? 'on' : ''}"></div>
                        </div>
                    </div>
                </div>

            </div>
        `;

        // ===== 排序方式：iOS 分段控制器 =====
        const sortCtrl = document.getElementById('xk-sort-ctrl');
        sortCtrl.querySelectorAll('.seg-btn').forEach(b => {
            b.onclick = (e) => {
                const val = e.target.dataset.val;
                sortCtrl.dataset.idx = SORT_MODES.indexOf(val);
                sortCtrl.querySelectorAll('.seg-btn').forEach(i => i.classList.remove('active'));
                e.target.classList.add('active');
                GM_setValue(STORAGE.SORT_MODE, val);
                applyRowOrder();
            };
        });

        // ===== 过滤：iOS 开关 =====
        const bindSwitch = (id, key) => {
            document.getElementById(id).onclick = function () {
                const next = !GM_getValue(key, false);
                GM_setValue(key, next);
                this.classList.toggle('on', next);
                applyFilter();
            };
        };
        bindSwitch('xk-flt-conflict', STORAGE.FILTER_CONFLICT);
        bindSwitch('xk-flt-full', STORAGE.FILTER_FULL);
        bindSwitch('xk-flt-campus', STORAGE.FILTER_CAMPUS);

        // 注入后立即应用一次过滤与排序
        applyFilter();
        applyRowOrder();
    };

    Object.assign(window.__XK__, { applyFilter, renderToolbar });
})();
