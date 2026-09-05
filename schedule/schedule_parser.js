/**
 * schedule/schedule_parser.js
 *
 * 时间串解析：把「已选课程」页抓到的原始时间文本解析为结构化时间段
 * 参照 scripts/xk/xk_conflict.js 的 parseTime 思路并增强：
 *   支持 周X/星期X/礼拜X（中文数字或 1-7）、X-Y节/第X-Y节/第X节（单节）、
 *   X-Y周(单/双)、多段以 ,，;；换行 分隔、段内余文本提取为教室
 * 依赖：window.__SCHED__
 */

(function () {
    'use strict';

    window.__SCHED__ = window.__SCHED__ || {};

    const CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };

    const RE_DAY = /周([一二三四五六日天1-7])|星期([一二三四五六日天1-7])|礼拜([一二三四五六日天1-7])/;
    const RE_DAY_STRIP = /周[一二三四五六日天1-7]|星期[一二三四五六日天1-7]|礼拜[一二三四五六日天1-7]/;
    const RE_SEC = /(?:第)?(\d+)(?:-(?:第)?(\d+))?节/;
    const RE_WEEK = /(?:第)?(\d+)-(?:第)?(\d+)周(?:[\(（]?([单双])[\)）]?)?/;

    /**
     * 解析单个时间段（"周二 7-8节 7-18周 费彝民楼B-820"）
     * @param {string} seg 单段文本
     * @returns {null|{day, s, e, weeks, room}} 缺星期或缺节次 → null
     */
    const parseSegment = (seg) => {
        const s = String(seg || '').trim();
        if (!s) return null;

        const dayMatch = s.match(RE_DAY);
        if (!dayMatch) return null;
        const dayText = dayMatch[1] || dayMatch[2] || dayMatch[3];
        const day = /^[1-7]$/.test(dayText) ? parseInt(dayText) : CN_NUM[dayText];
        if (!day) return null;

        const secMatch = s.match(RE_SEC);
        if (!secMatch) return null;
        const sS = parseInt(secMatch[1]);
        const eS = secMatch[2] ? parseInt(secMatch[2]) : sS;

        let weeks = '';
        const wkMatch = s.match(RE_WEEK);
        if (wkMatch) {
            weeks = wkMatch[3] ? `${wkMatch[1]}-${wkMatch[2]}${wkMatch[3]}` : `${wkMatch[1]}-${wkMatch[2]}`;
        }

        // 教室 = 去掉星期/节次/周次后的剩余文本（如 费彝民楼B-820、教121、馆3-201/103）
        const room = s
            .replace(RE_DAY_STRIP, '')
            .replace(RE_SEC, '')
            .replace(RE_WEEK, '')
            .trim();

        return { day, s: sS, e: eS + 1, weeks, room };  // e 为结束节不含，与 data.py 约定一致
    };

    /**
     * 解析一条完整时间串（可含多段，如 "周一 3-4节 4-18周, 周三 1-2节 4-18周"）
     * @param {string} str
     * @returns {{slots: Array, fail: boolean}} fail=整串无任何可解析时间段
     */
    const parseTimeStr = (str) => {
        const segments = String(str || '').split(/[\n,，;；]+/);
        const slots = [];
        for (const seg of segments) {
            const slot = parseSegment(seg);
            if (slot) slots.push(slot);
        }
        return { slots, fail: slots.length === 0 };
    };

    /**
     * 抓取行 → 课程数组（多时间段展开为多条，字段与 schedule_data.defaultCourse 对齐）
     * @param {Array} rows 抓取器返回的原始行 {name, teacher, clsName, code, campus, timeRaw, cls, prob}
     * @returns {{courses: Array, failCount: number}}
     */
    const rowsToCourses = (rows) => {
        const courses = [];
        let failCount = 0;
        for (const r of rows) {
            const parsed = parseTimeStr(r.timeRaw);
            if (parsed.fail) {
                failCount++;
                courses.push(Object.assign(window.__SCHED__.defaultCourse(), {
                    day: 1, s: 3, e: 5,
                    name: r.name, code: r.code, teacher: r.teacher,
                    clsName: r.clsName || '', campus: r.campus || '',
                    cls: r.cls || 'sel', note: r.note || '', timeRaw: r.timeRaw,
                    tcid: r.tcid || '', parseFail: true
                }));
                continue;
            }
            for (const slot of parsed.slots) {
                courses.push(Object.assign(window.__SCHED__.defaultCourse(), {
                    day: slot.day, s: slot.s, e: slot.e, weeks: slot.weeks,
                    name: r.name, code: r.code, teacher: r.teacher,
                    clsName: r.clsName || '', campus: r.campus || '',
                    room: r.room || slot.room, cls: r.cls || 'sel',
                    note: r.note || '', timeRaw: r.timeRaw, tcid: r.tcid || ''
                }));
            }
        }
        return { courses, failCount };
    };

    Object.assign(window.__SCHED__, { CN_NUM, parseSegment, parseTimeStr, rowsToCourses });
})();
