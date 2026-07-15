/**
 * scripts/pe_score_viewer/pe_score_fetcher.js
 *
 * 数据抓取层：从公共体育教育平台静默 fetch 体测(PFT)和教学(PTM)成绩
 * 暴露 window.__PE_SCORE__ 命名空间，供 pe_score_main.js 调用
 *
 * 数据来源:
 *   PFT(体测): /pft/myresult → #dataTables-main 表格 + 运动处方
 *   PTM(教学): /ptm/student/score/course?termId=xxx → 课程列表
 *              /ptm/student/score/detail?courseId=xxx → 成绩详情
 */

(function () {
    'use strict';

    window.__PE_SCORE__ = window.__PE_SCORE__ || {};

    // ── 工具函数 ──────────────────────────────────────────

    /**
     * fetch HTML 并解析为 Document
     * 检测登录重定向：如果返回的页面是登录页，抛出错误
     */
    async function fetchDoc(url) {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        // 检测登录重定向页面
        if (doc.querySelector('form[action*="login"]') || doc.querySelector('input[name="username"]')) {
            throw new Error('登录已过期，请重新登录');
        }
        return doc;
    }

    /**
     * 从首页 b 标签提取用户信息
     * 格式: <b>学生:251250226/代添瑞</b>
     */
    function extractUserInfo(doc) {
        let name = '未知', uid = '未知';
        const b = doc.querySelector('b');
        if (b) {
            const text = b.textContent.trim();
            // "学生:251250226/代添瑞，欢迎使用3"
            const match = text.match(/学生:\s*(\S+)\/([^\s，]+)/);
            if (match) {
                uid = match[1];
                name = match[2];
            }
        }
        // 备用: user-info span
        if (name === '未知') {
            const userInfo = doc.querySelector('.user-info');
            if (userInfo) name = userInfo.textContent.trim();
        }
        return { name, uid };
    }

    // ── PFT 体测成绩 ──────────────────────────────────────

    /**
     * 抓取体测成绩
     * 表格 #dataTables-main，每项成绩格式: "成绩/得分/等级" (如 "4054/74/及格")
     * 运动处方在 label.col-sm-7.control-label 中
     */
    async function fetchPftScore() {
        const doc = await fetchDoc('/pft/myresult');
        const userInfo = extractUserInfo(doc);

        const table = doc.querySelector('#dataTables-main');
        if (!table) return { ...userInfo, error: '未找到体测成绩表格', period: '', items: [], totalScore: '', prescriptions: [] };

        const headers = [];
        table.querySelectorAll('thead th').forEach(th => headers.push(th.textContent.trim()));

        const rows = table.querySelectorAll('tbody tr');
        if (rows.length === 0) return { ...userInfo, error: '体测成绩表格无数据', period: '', items: [], totalScore: '', prescriptions: [] };

        const cells = rows[0].querySelectorAll('td');
        const cellTexts = [];
        cells.forEach(c => cellTexts.push(c.textContent.trim()));

        // 解析各项成绩 (格式: "成绩/得分/等级" 或纯数字)
        function parseScoreCell(text) {
            if (!text || text.trim() === '') return { raw: '', score: '', points: '', grade: '' };
            text = text.trim();
            const parts = text.split('/');
            if (parts.length >= 3) {
                return { raw: text, score: parts[0], points: parts[1], grade: parts[2] };
            } else if (parts.length === 2) {
                return { raw: text, score: parts[0], points: parts[1], grade: '' };
            }
            return { raw: text, score: text, points: '', grade: '' };
        }

        // 表头索引映射
        const headerMap = {};
        headers.forEach((h, i) => { headerMap[h] = i; });

        const period = cellTexts[headerMap['期次']] || '';
        const nameUid = cellTexts[headerMap['姓名/学号']] || '';
        const nameUidParts = nameUid.split('/');
        if (nameUidParts.length === 2) {
            userInfo.name = nameUidParts[0];
            userInfo.uid = nameUidParts[1];
        }

        const bmi = cellTexts[headerMap['身高体重比（BMI）']] || '';
        const height = cellTexts[headerMap['身高']] || '';
        const weight = cellTexts[headerMap['体重']] || '';
        const bonus = cellTexts[headerMap['加分']] || '';
        const totalScore = cellTexts[headerMap['总分（含单项加分）']] || '';

        // 各单项成绩
        const itemHeaders = ['肺活量', '50米跑', '立定跳远', '坐位体前屈', '800/1000米跑', '引体向上/仰卧起坐'];
        const items = [];
        for (const h of itemHeaders) {
            if (headerMap[h] !== undefined) {
                const cell = cellTexts[headerMap[h]];
                const parsed = parseScoreCell(cell);
                items.push({ name: h, ...parsed });
            }
        }

        // 视力数据
        const visionItems = [];
        const visionHeaders = ['左裸眼', '右裸眼', '左屈光', '右屈光', '左串镜', '右串镜'];
        for (const h of visionHeaders) {
            if (headerMap[h] !== undefined) {
                const val = cellTexts[headerMap[h]];
                if (val) visionItems.push({ name: h, value: val });
            }
        }

        // 运动处方
        const prescriptions = [];
        const prescriptionHeaders = doc.querySelectorAll('label.col-sm-7.control-label');
        prescriptionHeaders.forEach(label => {
            const text = label.textContent.trim();
            if (text.includes('建议以下运动处方')) {
                const match = text.match(/【(.+?)】/);
                const itemName = match ? match[1] : '未知';
                const scoreMatch = text.match(/成绩：\s*<font[^>]*>([^<]+)<\/font>/);
                const gradeMatch = text.match(/等级：\s*<font[^>]*>([^<]+)<\/font>/);
                // 备用: 直接从文本提取
                const scoreAlt = text.match(/成绩：(\S+)/);
                const gradeAlt = text.match(/等级：(\S+)/);
                const score = scoreMatch ? scoreMatch[1] : (scoreAlt ? scoreAlt[1].replace(/[^\d.]/g, '') : '');
                const grade = gradeMatch ? gradeMatch[1] : (gradeAlt ? gradeAlt[1].replace(/[^\u4e00-\u9fa5a-z]/gi, '') : '');

                // 处方条目在同级 div.row > form 中
                const rowDiv = label.parentElement.nextElementSibling;
                const rxItems = [];
                if (rowDiv) {
                    const forms = rowDiv.querySelectorAll('form');
                    forms.forEach(form => {
                        const labels = form.querySelectorAll('label');
                        if (labels.length >= 4) {
                            const rxName = labels[1]?.textContent.trim() || '';
                            const rxDesc = labels[2]?.textContent.trim() || '';
                            const rxDosage = labels[3]?.textContent.trim() || '';
                            if (rxName || rxDesc || rxDosage) {
                                rxItems.push({ name: rxName, desc: rxDesc, dosage: rxDosage });
                            }
                        }
                    });
                }
                prescriptions.push({ itemName, score, grade, items: rxItems });
            }
        });

        return {
            ...userInfo,
            period, bmi, height, weight, bonus, totalScore,
            items, visionItems, prescriptions
        };
    }

    // ── PTM 教学成绩 ──────────────────────────────────────

    /**
     * 抓取教学成绩
     * 1. 获取所有学期列表
     * 2. 遍历有课程的学期，获取课程列表
     * 3. 遍历每门课程，获取成绩详情
     */
    async function fetchPtmScore() {
        // 先用一个默认 termId 获取学期列表
        const doc = await fetchDoc('/ptm/student/score/course?termId=123');
        const userInfo = extractUserInfo(doc);

        // 提取所有学期
        const termOptions = doc.querySelectorAll('#termId option');
        const terms = [];
        termOptions.forEach(opt => {
            const value = opt.getAttribute('value');
            const name = opt.textContent.trim();
            if (value && name) terms.push({ value, name });
        });

        // 遍历每个学期，获取课程列表
        const allCourses = [];
        for (const term of terms) {
            try {
                const termDoc = await fetchDoc(`/ptm/student/score/course?termId=${term.value}`);
                const tbody = termDoc.querySelector('tbody');
                if (!tbody) continue;
                const rows = tbody.querySelectorAll('tr');
                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 4) continue;
                    const courseInfo = cells[1]?.textContent.trim() || '';
                    const link = row.querySelector('a[href*="courseId"]');
                    if (!link) continue;
                    const href = link.getAttribute('href');
                    const courseIdMatch = href.match(/courseId=([^&]+)/);
                    if (!courseIdMatch) continue;
                    const courseId = courseIdMatch[1];

                    // 解析课程信息: "体适能 | 星期四 第5，6节 | 赵岚"
                    const parts = courseInfo.split('|').map(s => s.trim());
                    const courseName = parts[0] || '';
                    const schedule = parts[1] || '';
                    const teacher = parts[2] || '';

                    allCourses.push({
                        termName: term.name,
                        termValue: term.value,
                        courseId,
                        courseName,
                        schedule,
                        teacher,
                        scores: {}
                    });
                }
            } catch (e) {
                // 跳过出错的学期
            }
        }

        // 获取每门课程的成绩详情
        for (const course of allCourses) {
            try {
                const detailDoc = await fetchDoc(`/ptm/student/score/detail?courseId=${course.courseId}&`);
                const profileRows = detailDoc.querySelectorAll('.profile-info-row');
                profileRows.forEach(row => {
                    const nameEl = row.querySelector('.profile-info-name');
                    const valueEl = row.querySelector('.profile-info-value');
                    if (nameEl && valueEl) {
                        const name = nameEl.textContent.trim();
                        const value = valueEl.textContent.trim();
                        course.scores[name] = value;
                    }
                });
            } catch (e) {
                // 跳过出错课程
            }
        }

        return { ...userInfo, courses: allCourses };
    }

    // ── 暴露接口 ──────────────────────────────────────────

    window.__PE_SCORE__.fetchPftScore = fetchPftScore;
    window.__PE_SCORE__.fetchPtmScore = fetchPtmScore;
})();
