/**
 * schedule/schedule_layout.js
 *
 * 网格课表算法与渲染：移植 schedule-check 技能 build_schedule.py
 *   clusterGroups（重叠簇）→ laneAssign（并排 lane）→ layoutDay（≥3门预选折叠抢课池）
 *   像素公式与原版逐字节一致：top=(s-1)*H  height=(e-s)*H  left/width 按 lane 百分比
 * 依赖：window.__SCHED__（effectiveNote/effectiveInfo）
 */

(function () {
    'use strict';

    window.__SCHED__ = window.__SCHED__ || {};

    const NROWS = 11;                                          // 每天 11 节
    const DAYS = ['星期一', '星期二', '星期三', '星期四', '星期五'];
    const BADGE_COLORS = { sel: '#2f6ad0', pre: '#d89a00', pre_cf: '#d33838' };

    // ============ 1. 网格 CSS（与导出的单文件 HTML 共用同一份，固定浅色不随主题反转） ============
    // 基础规则仅供导出的独立页面使用；页面内注入时去掉（页面已有自己的 reset 与背景）
    const BASE_CSS = '*{box-sizing:border-box;margin:0;padding:0}' +
        "body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;background:#eef1f7;color:#222;padding:16px}";

    const GRID_CSS_TEMPLATE = '.wrap{max-width:1280px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.08);padding:18px 20px 22px}' +
        'h1{font-size:19px}' +
        '.sub{color:#666;font-size:12px;margin:3px 0 12px}' +
        '.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;margin-bottom:10px;align-items:center}' +
        '.dot{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:5px;border:1px solid rgba(0,0,0,.12)}' +
        '.gwrap{display:flex;align-items:stretch;border:1px solid #d5dbe7;border-radius:8px;overflow:hidden;background:#fafbfe}' +
        '.axis{width:62px;flex:none;border-right:1px solid #d5dbe7;background:#eef1f8}' +
        '.axis .ah{height:@@H@@px}' +
        '.axis .ab{position:relative;height:@@AXISH@@px}' +
        '.axis .ts{position:absolute;left:0;right:0;font-size:11px;color:#78819a;text-align:center}' +
        '.day{flex:1;min-width:0}' +
        '.day+.day{border-left:1px solid #d5dbe7}' +
        '.dayhead{height:@@H@@px;display:flex;align-items:center;justify-content:center;background:#2f4b8f;color:#fff;font-size:13px;font-weight:600}' +
        '.body{position:relative;height:@@AXISH@@px;background:#fff;background-image:repeating-linear-gradient(to bottom,rgba(213,219,231,0) 0 @@H1@@px,#dde3ef @@H1@@px @@H@@px)}' +
        '.course{position:absolute;overflow:hidden;border-radius:5px;font-size:11px;line-height:1.3;padding:4px 6px;cursor:default;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}' +
        '.course .n{font-weight:700}' +
        '.course .m{color:rgba(0,0,0,.6);font-size:10px;margin-top:2px}' +
        '.sel{background:#dce9ff;border-left:4px solid #2f6ad0}' +
        '.pre{background:#fff0cd;border-left:4px solid #d89a00}' +
        '.cf{background:#ffd8d8;border-left:4px solid #d33838}' +
        '.cf .m{color:#8f1f1f}' +
        '.pool{position:absolute;overflow:hidden;border-radius:6px;font-size:11px;background:#fdf6e3;border:1.5px dashed #d89a00;padding:5px 8px;cursor:default}' +
        '.pool .pt{font-weight:700;color:#8a5f00;font-size:11px}' +
        '.pool .pline{font-size:10.5px;line-height:1.5}' +
        '.pool .pline b{color:#5a4300}' +
        '.pool .pct{color:#b06f00;font-weight:700}' +
        '.note{margin-top:16px;font-size:12.5px;color:#444;background:#f6f8fc;border:1px solid #e3e8f2;border-radius:8px;padding:12px 14px;line-height:1.9}' +
        '.note h2{font-size:13.5px;color:#2f4b8f}' +
        '.note ul{margin-left:18px}' +
        '.red{color:#c03030;font-weight:600}' +
        '.amb{color:#9a6b00;font-weight:600}';

    /** @param {number} H 每节高度 px @param {boolean} includeBase 是否含 body/reset 基础规则（仅导出用） */
    const gridCssFor = (H, includeBase) => {
        const h = H || 44;
        const css = GRID_CSS_TEMPLATE
            .replace(/@@AXISH@@/g, String(NROWS * h))
            .replace(/@@H@@/g, String(h))
            .replace(/@@H1@@/g, String(h - 1));
        return (includeBase ? BASE_CSS : '') + css;
    };

    // ============ 2. 排版算法（与 build_schedule.py 一一对应） ============

    /** 按 s 排序、e 游标把时间重叠课程连成簇 */
    const clusterGroups = (courses) => {
        const cs = courses.slice().sort((a, b) => a.s - b.s || a.e - b.e);
        const groups = [];
        let cur = [], curEnd = null;
        for (const c of cs) {
            if (cur.length && c.s >= curEnd) {
                groups.push(cur);
                cur = [];
            }
            cur.push(c);
            curEnd = Math.max(curEnd === null ? c.s : curEnd, c.e);
        }
        if (cur.length) groups.push(cur);
        return groups;
    };

    /** 簇内贪心分 lane（first-fit），返回 [{course,lane}] 与 lane 总数 */
    const laneAssign = (group) => {
        const slots = [], assigns = [];
        for (const c of group.slice().sort((a, b) => a.s - b.s || a.e - b.e)) {
            let lane = slots.findIndex(last => last <= c.s);
            if (lane === -1) { lane = slots.length; slots.push(c.e); }
            else { slots[lane] = c.e; }
            assigns.push({ course: c, lane });
        }
        return { assigns, laneCount: slots.length };
    };

    /** 当天排版：簇 ≥3 门且全非 sel → 折叠虚线抢课池；否则并排色条 */
    const layoutDay = (courses) => {
        const items = [];
        for (const g of clusterGroups(courses)) {
            const allPre = g.every(c => c.cls !== 'sel');
            if (g.length >= 3 && allPre) {
                const ms = Math.min(...g.map(c => c.s));
                const me = Math.max(...g.map(c => c.e));
                items.push({ type: 'pool', group: g, ms, me });
            } else {
                const { assigns, laneCount } = laneAssign(g);
                for (const { course, lane } of assigns) {
                    items.push({ type: 'bar', course, lane, laneCount });
                }
            }
        }
        return items;
    };

    // ============ 3. HTML 拼接（与 build_schedule.py 的 course_block/pool_block 同构） ============

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const courseBlockHtml = (c, lane, laneCount, H) => {
        const { effectiveNote, effectiveInfo } = window.__SCHED__;
        const note = effectiveNote(c);
        const info = effectiveInfo(c);
        const colorclass = c.cls === 'sel' ? 'sel' : (c.cls === 'pre_cf' ? 'cf' : 'pre');
        const tag = c.cls === 'sel' ? '已选' : '预选';
        const title = (c.name + ' | ' + note + ' | ' + info).replace(/\|/g, '  ');
        const metaLine = info + (note ? ' · ' + note : '');
        const top = (c.s - 1) * H;
        const height = (c.e - c.s) * H;
        const left = (100 * lane / laneCount).toFixed(4);
        const width = (100 / laneCount).toFixed(4);
        return '<div class="course ' + colorclass + '" style="top:' + top + 'px;height:' + height +
            'px;left:' + left + '%;width:' + width + '%" title="' + esc(title) + '">' +
            '<div class="n">' + esc(c.name) +
            ' <span style="font-weight:400;font-size:9px;color:#fff;background:' + BADGE_COLORS[c.cls] +
            ';border-radius:7px;padding:0 4px">' + tag + '</span></div>' +
            '<div class="m">' + esc(metaLine) + '</div></div>';
    };

    const poolBlockHtml = (group, H) => {
        const { effectiveNote } = window.__SCHED__;
        const ms = Math.min(...group.map(c => c.s));
        const me = Math.max(...group.map(c => c.e));
        const top = (ms - 1) * H;
        const height = (me - ms) * H;
        const lines = group.map(c => {
            const pct = (effectiveNote(c).split(' · ').find(t => t.includes('%'))) || '';
            return '<div class="pline"><b>' + esc(c.name) + '</b> <span class="pct">' + esc(pct) + '</span></div>';
        }).join('');
        return '<div class="pool" style="top:' + top + 'px;height:' + height +
            'px;left:0;width:100%" title="同槽抢课池（同一时段，多门占坑，中签择一）">' +
            '<div class="pt">⚠ 同槽抢课池 · 中签择一</div>' + lines + '</div>';
    };

    // ============ 4. 整体 HTML（页面内渲染与导出共用） ============

    const LEGEND_HTML = '<div class="legend">' +
        '<span><span class="dot" style="background:#dce9ff"></span>已选课</span>' +
        '<span><span class="dot" style="background:#fff0cd"></span>预选课（待抽签）</span>' +
        '<span><span class="dot" style="background:#ffd8d8;border-color:#d33838"></span>预选 · 撞已选必修</span>' +
        '<span style="color:#888">同节左右并排=时间冲突 · 虚线框=同槽抢课池（多门择一）</span></div>';

    /**
     * 生成 .wrap 内部完整课表 HTML（h1/副标题/图例/网格/清单）
     * @param {object} meta  @param {Array} courses（含 parseFail 的课程不渲染）
     */
    const buildGridHtml = (meta, courses) => {
        const H = meta.h || 44;
        const renderable = courses.filter(c => !c.parseFail);

        // 节次轴（1-11）
        const axisParts = ['<div class="axis"><div class="ah"></div><div class="ab">'];
        for (let i = 1; i <= NROWS; i++) {
            axisParts.push('<div class="ts" style="top:' + (i - 1) * H + 'px;height:' + H +
                'px;line-height:' + H + 'px">' + i + '</div>');
        }
        axisParts.push('</div></div>');

        // 周一至周五 5 列
        const cols = [];
        for (let d = 1; d <= 5; d++) {
            const dayCourses = renderable.filter(c => c.day === d);
            const parts = ['<div class="day"><div class="dayhead">' + DAYS[d - 1] + '</div><div class="body">'];
            for (const item of layoutDay(dayCourses)) {
                if (item.type === 'bar') parts.push(courseBlockHtml(item.course, item.lane, item.laneCount, H));
                else parts.push(poolBlockHtml(item.group, H));
            }
            parts.push('</div></div>');
            cols.push(parts.join(''));
        }

        const sub = [meta.subtitle, meta.snapshot].filter(Boolean).join(' · ');
        const noteHtml = (meta.notes && meta.notes.length)
            ? '<div class="note"><h2>冲突与处理清单</h2><ul>' +
              meta.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul></div>'
            : '';

        return '<h1>' + esc(meta.title) + '</h1>' +
            '<div class="sub">' + esc(sub) + '</div>' +
            LEGEND_HTML +
            '<div class="gwrap">' + axisParts.join('') + cols.join('') + '</div>' +
            noteHtml;
    };

    // ============ 5. 页面内渲染 ============

    let _styleEl = null;

    /** 注入网格样式（仅一次；H 变化时更新） */
    const ensureGridStyle = (H) => {
        const css = gridCssFor(H, false);
        if (!_styleEl) {
            _styleEl = document.createElement('style');
            _styleEl.id = 'schedule-grid-style';
            document.head.appendChild(_styleEl);
        }
        if (_styleEl.textContent !== css) _styleEl.textContent = css;
    };

    /** 渲染到页面容器 */
    const renderGrid = (container, meta, courses) => {
        ensureGridStyle(meta.h);
        container.innerHTML = '<div class="wrap">' + buildGridHtml(meta, courses) + '</div>';
    };

    Object.assign(window.__SCHED__, {
        NROWS, DAYS, gridCssFor, clusterGroups, laneAssign, layoutDay,
        courseBlockHtml, poolBlockHtml, buildGridHtml, renderGrid
    });
})();
