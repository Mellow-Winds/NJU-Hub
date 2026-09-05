/**
 * schedule/schedule_data.js
 *
 * 课表数据模块：NJU_SCHED_TABLE 读写、默认空数据、note/info 派生、同步合并
 * 依赖：无（页面脚本，命名空间 window.__SCHED__）
 *
 * 课程字段（与 schedule-check 技能 data.py 对齐）：
 *   day(1=周一..5=周五)  s(开始节)  e(结束节,不含)  name  code(课程号)
 *   teacher(教师)  clsName(班号)  room(教室)  weeks(周次原文)  campus(校区)
 *   cls(sel已选 / pre预选待抽签 / pre_cf预选撞必修)
 *   note/info(自由文本，非空时覆盖派生值)  timeRaw(抓取原始时间串)
 *   tcid(教学班 ID，我的报名行专用稳定键)  manual(手动添加标记)
 * 编码例：周三 9-11 节 -> day=3, s=9, e=12
 */

(function () {
    'use strict';

    window.__SCHED__ = window.__SCHED__ || {};

    const KEY = 'NJU_SCHED_TABLE';

    // ============ 1. 默认空数据（不在共享仓库内置个人课表） ============
    const defaultData = () => ({
        meta: {
            season: '2026秋',
            title: '2026-2027学年 第1学期 课表总览',
            subtitle: '已选必修 + 预选待抽签 · 每格=1节等高 · 悬浮见详情',
            h: 44,                                  // 每节高度 px
            snapshot: '',
            notes: []
        },
        courses: [],
        updatedAt: 0
    });

    const defaultCourse = () => ({
        day: 1, s: 3, e: 5, name: '', code: '', teacher: '', clsName: '',
        room: '', weeks: '', campus: '', cls: 'pre',
        note: '', info: '', timeRaw: '', parseFail: false,
        tcid: '', manual: false
    });

    // ============ 2. 读写 ============
    const load = async () => {
        try {
            const res = await chrome.storage.local.get(KEY);
            const d = res[KEY];
            if (d && d.meta && Array.isArray(d.courses)) return normalize(d);
        } catch (e) {
            console.warn('[NJU-Hub] 课表: 读取本地存储失败，使用空数据', e);
        }
        return defaultData();
    };

    const save = async (data) => {
        data.updatedAt = Date.now();
        await chrome.storage.local.set({ [KEY]: data });
    };

    /** 补齐缺失字段，防止旧版本数据缺键 */
    const normalize = (d) => {
        const base = defaultData();
        d.meta = Object.assign({}, base.meta, d.meta || {});
        d.courses = (d.courses || []).map(c => Object.assign(defaultCourse(), c));
        return d;
    };

    // ============ 3. note/info 派生（保证与 schedule-check 原版视觉一致） ============
    // 原版 data.py：note 形如 '02班 · 赵凤山'，info 形如 '7-14周 · 教121'
    const effectiveNote = (c) => c.note || [c.clsName, c.teacher].filter(Boolean).join(' · ');
    const effectiveInfo = (c) => c.info || [c.weeks ? c.weeks + '周' : '', c.room || c.campus].filter(Boolean).join(' · ');

    // ============ 4. 同步合并策略（按稳定键替换，避免重复累积） ============
    // 手动添加的课程（manual）全保留；同步来源的旧课程与新抓取按稳定键匹配：
    //   匹配 → 保留旧对象（保护用户手工补的教师/教室、修好的解析失败行等编辑）
    //   不匹配（已退课）→ 丢弃；新抓取未匹配旧课 → 新增
    // 稳定键：我的报名用教学班 ID（tcid），其余用 状态|课名|原始时间串
    const mergeSynced = (data, newCourses) => {
        const old = data.courses;
        const manual = old.filter(c => c.manual);
        const oldSynced = old.filter(c => !c.manual);

        const keyOf = (c) => c.tcid ? 'tcid:' + c.tcid : c.cls + '|' + c.name + '|' + c.timeRaw;
        const matchedIdx = new Set();
        const result = manual.slice();

        for (const o of oldSynced) {
            const k = keyOf(o);
            const i = newCourses.findIndex((n, idx) => !matchedIdx.has(idx) && keyOf(n) === k);
            if (i >= 0) { matchedIdx.add(i); result.push(o); }
            // 未匹配 → 丢弃（已退课）
        }
        newCourses.forEach((n, idx) => {
            if (!matchedIdx.has(idx)) result.push(n);   // 新课程
        });
        data.courses = result;
        return data;
    };

    Object.assign(window.__SCHED__, {
        KEY, defaultData, defaultCourse, load, save, normalize,
        effectiveNote, effectiveInfo, mergeSynced
    });
})();
