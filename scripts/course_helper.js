// scripts/course_helper.js - 选课与课表侦察兵模块

(async function () {
    'use strict';

    // ================== 0. 插件环境初始化与状态同步 ==================
    let globalStorage = await chrome.storage.local.get(null);

    // 如果用户在 Popup 仪表盘中关闭了“课表侦察兵”，则直接退出
    if (globalStorage['toggle-schedule'] === false) return;

    // 模拟油猴 API，实现无缝平替并与插件 Storage 联动
    const GM_getValue = (key, def) => globalStorage[key] !== undefined ? globalStorage[key] : def;
    const GM_setValue = (key, val) => {
        globalStorage[key] = val;
        chrome.storage.local.set({ [key]: val });
    };
    const GM_deleteValue = (key) => {
        delete globalStorage[key];
        chrome.storage.local.remove(key);
    };

    chrome.storage.onChanged.addListener((changes) => {
        for (let [key, { newValue }] of Object.entries(changes)) {
            globalStorage[key] = newValue;
        }
    });

    // ================== 1. 核心配置 ==================
    const THEME = {
        PRE: '#34C759', ADD: '#007AFF', GOOD: '#1b5e20', BAD: '#c62828',
        CONFLICT: '#FF3B30', CAMPUS: '#FF9500', PURPLE: '#660874',
        STAR_ON: '#FF9500', STAR_OFF: '#999999',
        P100: '#1b5e20', P80: '#4caf50', P60: '#fdd835', P40: '#ff9800', P20: '#f44336', P0: '#8e0000'
    };

    const APPLE_EASE = 'cubic-bezier(0.19, 1, 0.22, 1)';
    const CN_NUM = {'一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '日':7};
    const CAMPUS_MAP = { 'XL': '仙林', 'GL': '鼓楼', 'PK': '浦口', 'SZ': '苏州' };
    const CAMPUS_IDX = { 'XL': 0, 'GL': 1, 'PK': 2, 'SZ': 3 };

    const getAISettings = () => {
        return {
            url: GM_getValue('course_api_url') || 'https://api.siliconflow.cn/v1',
            key: GM_getValue('course_api_key', ''),
            model: GM_getValue('course_model') || 'Qwen/Qwen3-8B',
            major: GM_getValue('course_major') || '未知专业',
            pref: GM_getValue('course_pref') || '给分高，事少，不点名'
        };
    };

    // --- 强化版红榜词库 (400+) ---
    const RED_WORDS = [
        '神仙', '神', 'yyds', '绝绝子', '宝藏', '满分', '很棒', '不错', '可以', '牛', '强推', '力荐', '推荐', '必选', '首选', '神中神', '五星好评', '良心课程', '满分推荐',
        '好课', '好老师', '超级好', '特别好', '真的好', '挺好', '很好', '巨好', '超棒', '绝了', '爱死', '吹爆', '无敌', '完美', '顶', '赞', '非常推荐', '值得选',
        '给分好', '给分高', '分高', '分好', '满绩', '高分', '90+', '95+', '90分', '95分', '98', '99', '不吝啬', '大方', '给分大方', '慷慨', '手松', '给分松',
        '奶', '奶爸', '奶妈', '捞', '捞人', '海底捞', '调分', '向上调', '不挂人', '容易过', '好过', '及格万岁', '精准扶贫', '送分', '送分题', '不压分', '福利',
        '稳', '稳过', '稳拿', '稳稳的', '不翻车', '不玄学', '不搞心态', '不恶意', '不卡线', '不为难人', '不卡人', '不搞事情', '人均高分', '人均90', '全班高分', '绩点友好', 'GPA友好', '对绩点友好', '对学生友好',
        '分数感人', '给分感人', '分巨高', '分超高', '给分神仙', '给分良心', '分数漂亮', '好看', '高绩点', '保研', '刷分', '提分',
        '事少', '事儿少', '作业少', '无作业', '没作业', '作业不多', '作业简单', '任务轻', '负担轻', '不点名', '无点名', '没点名', '签到少', '不签到', '偶尔点名',
        '无pre', '没pre', '不考试', '无考试', '没考试', '无期中', '无期末', '开卷', '半开卷', '水课', '很水', '划水', '摸鱼', '轻松', '不累', '压力小', '自由',
        '考试简单', '题目简单', '原题', '往年题', '题库', '重点准', '划重点', '给重点', '复习资料', '透题', '论文给分好',
        '任务量小', '负担小', '不卷', '养老', '躺平', '适合摸鱼', '适合划水', '可以翘课', '可以不来', '随便听听', '不用听', '玩手机', '做自己的事', '写作业', '自习',
        '人好', '人超好', '人nice', 'nice', '温柔', '和蔼', '亲切', '耐心', '负责', '认真', '细心', '可爱', '有趣', '风趣', '幽默',
        '帅', '帅气', '美', '漂亮', '女神', '男神', '大佬', '大牛', '学术大牛', '干货', '收获', '学到东西', '涨知识', '清晰', '生动',
        '菩萨', '活菩萨', '天使', '知性', '儒雅', '随和', '开明', '通情达理', '好说话', '理解学生', '尊重', '不为难', '氛围好', '互动好', '体验好',
        '老师正常', '三观正', '有边界感', '不爹', '不PUA', '不阴阳', '不内涵', '不摆架子', '不装', '好沟通', '能商量', '会听意见', '尊重人', '真·老师', '真负责',
        '听着舒服', '讲得明白', '条理清楚', '思路清晰', '不折腾', '不整活', '不搞花样', '正常人课程', '正常上课', '正常考', '正常给分', '不恶心', '不折磨人', '不浪费时间', '不拖后腿',
        '善解人意', '体贴', '关心学生', '像朋友', '没架子', '平易近人', '讲课好', '讲得好', '水平高', '有水平', '不仅学到知识', '人生导师', '三观超正',
        '闭眼选', '闭眼冲', '闭眼入', '冲', '快选', '选它', '爱了', '喜欢', '开心', '快乐', '享受', '幸福', '值得', '良心', '福音', '舒服', '感动', '感恩', '救星', '放心',
        '爽', '舒服爆了', '一整个爱住', '狠狠推荐', '狠狠安利', '不选会后悔', '选了不亏', '真香', '属于是捡漏', '属于福利课', '白给', '纯赚', '血赚', '值回票价',
        '选就完了', '选就对了', '不后悔', '无脑冲', '无脑选', '必修课', '一定要选', '千万别错过', '相见恨晚', '幸运', '走运', '快乐源泉'
    ];

    // --- 强化版黑榜词库 (400+) ---
    const BLACK_WORDS = [
        '快跑', '快逃', '别选', '别来', '千万别选', '慎选', '避雷', '大雷', '巨坑', '大坑', '天坑', '坑', '后悔', '恶心', '吐了', '垃圾', '烂', '烂课',
        '依托答辩', '答辩', '史', '坐牢', '痛苦', '折磨', '煎熬', '浪费时间', '浪费生命', '劝退', '噩梦', '无语', '离谱', '狗都不选', '甚至', '不如自学',
        '不好', '很差', '极差', '太差', '糟糕', '无聊透顶', '不知所云', '莫名其妙', '不可理喻', '令人发指', '毁三观', '有病', '神经病', 'sb', 'nt',
        '给分差', '给分低', '分低', '压分', '低分', '杀手', '绩点杀手', 'GPA杀手', '卡绩', '卡人', '挂科', '挂人', '挂科率高', '不及格', '重修', '不捞', '不调分', '向下调',
        '随机给分', '乱给分', '看脸', '玄学', '吝啬', '小气', '扣分', '扣分狠', '严', '严格', '给分严', '给分恶心', '分低到哭',
        '不稳定', '看心情', '看老师脸色', '看助教', '看运气', '绩点炸裂', 'GPA噩梦', '血亏', '白忙', '做了也白做', '分数不透明', '没标准', '标准模糊', '随缘给分', '给分成谜', '分数离谱', '反向给分',
        '给分迷', '给分魔幻', '给分看人', '没有优秀', '优秀率低', '卡89', '卡84', '卡59', '均分低', '没人性', '不当人',
        '事多', '事儿多', '事儿逼', '作业多', '作业难', '作业繁琐', '任务重', '负担重', '累', '卷', '内卷', '很卷', '卷死', '压力大', '心累', '身心俱疲',
        '点名', '签到', '每节课', '花式点名', '拍照', '定位', '通报', '查重', '严查', '不准请假', '强制', '拖堂', '占用', '还要',
        'pre多', '很多pre', '每周pre', 'pre难', '论文多', '论文难', '考试难', '题目难', '闭卷', '默写', '背书', '死记硬背', '手写', '几千字', '没重点', '不划重点', '重点偏', '考细节', '超纲',
        '折腾人', '恶意满满', '纯纯恶心', '没意义作业', '无效努力', '形式主义', '表演型学习', '为难学生', '故意卡', '故意刁难', '任务叠任务', '套娃作业', '一堆细则', '要求巨多', '标准随改', '临时加任务', '临时改规则',
        '各种小测', '突击检查', '随堂考', '没完没了', '占用周末', '占用假期', '强制活动', '强制参与', '必须去', '不准不去', '扣平时分',
        '讲得差', '讲课差', '讲得烂', '听不懂', '不知所云', '催眠', '无聊', '枯燥', '水', '念ppt', '读ppt', '照本宣科', '照念',
        '水平低', '没水平', '混', '敷衍', '不负责', '不管', '态度差', '凶', '骂人', '阴阳怪气', '嘲讽', 'pua', '爹味', '说教', '装',
        '傲慢', '自大', '歧视', '针对', '双标', '偏心', '更年期', '老登', '变态', '奇葩', '极品', '独角戏', '自嗨', '各种要求', '各种规矩',
        '上课像受刑', '听了个寂寞', '浪费一学期', '纯念稿', '完全不讲', '自己都没准备', '逻辑混乱', '前后矛盾', '讲不清重点', '不知道考什么', '不知道学了啥', '内容过时', '老掉牙',
        '情绪不稳定', '爱发脾气', '爱针对人', '阴晴不定', '双标严重', '偏心严重', '控制欲强', '爹味十足', 'PUA重灾区', '爱说教', '爱上价值', '爱道德绑架', '自我感动型', '自嗨型老师', '把学生当工具人',
        '没师德', '不配当老师', '误人子弟', '毁人不倦', '自以为是', '高高在上', '看不起学生', '不尊重人', '随意更改', '出尔反尔', '说话不算话',
        '心态爆炸', '人麻了', '被恶心到了', '想退课', '想跑路', '想转专业', '想重开', '一整个崩溃', '纯纯坐牢', '精神折磨', '生理不适',
        '气死', '想骂人', '想打人', '想投诉', '举报', '真的无语', '大无语', '也是醉了', '服了', '绝望', '致郁', '怀疑人生', '避之不及', '谁选谁后悔'
    ];

    // ================== 2. 路由分发 (课表同步) ==================
    const currentURL = window.location.href;
    if (currentURL.includes('jwapp/sys/wdkb')) {
        const injectSyncBtn = () => {
            if(document.getElementById('nju-sync-btn')) return;
            const btn = document.createElement('div');
            btn.id = 'nju-sync-btn'; btn.innerHTML = '抓取课表至选课系统';
            btn.style.cssText = `position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 9999; padding: 8px 20px; background: ${THEME.PURPLE}; color: white; border-radius: 20px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: 0.2s ${APPLE_EASE};`;
            btn.onclick = () => {
                const rows = document.querySelectorAll('tr[id^="row"]');
                if (rows.length === 0) { alert('表格未加载'); return; }
                let data = [];
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td[role="gridcell"]');
                    if (cells.length > 6) {
                        const t = cells[6].getAttribute('title') || cells[6].innerText;
                        const n = cells[2].getAttribute('title') || cells[2].innerText;
                        if (t && t.length > 2) data.push({ name: n.replace(/\d+班$/, '').trim(), timeStr: t });
                    }
                });
                if (data.length > 0) { GM_setValue('NJU_SCHEDULE', data); alert(`成功抓取 ${data.length} 门课程。请前往选课系统查看冲突。`); }
            };
            document.body.appendChild(btn);
        };
        setInterval(injectSyncBtn, 2000);
        return;
    }

    if (!currentURL.includes('xsxkapp')) return;

    // ================== 3. 选课核心逻辑 ==================
    let config = {
        mode: GM_getValue('NJU_MODE', 'PRE'),
        autoConfirm: GM_getValue('NJU_AUTO', false),
        conflictCheck: GM_getValue('NJU_CONFLICT', true),
        enableRating: GM_getValue('NJU_RATING', true),
        myCampus: GM_getValue('NJU_CAMPUS', 'XL'),
        checkCampus: GM_getValue('NJU_CHECK_CAMPUS', true),
        pinFav: GM_getValue('NJU_PIN_FAV', true) // 置顶配置
    };
    let tempConfig = { ...config };
    window.pendingAITasks = window.pendingAITasks || [];

    // --- 智能置顶算法 ---
    const sortFavRows = () => {
        if (!config.pinFav) return;
        const tbody = document.querySelector('.course-body');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr.course-tr'));
        if (rows.length === 0) return;

        let isSorted = true;
        let foundNonFav = false;

        for (let row of rows) {
            const isFav = row.classList.contains('is-fav-row');
            if (!isFav) {
                foundNonFav = true;
            } else if (foundNonFav) {
                isSorted = false;
                break;
            }
        }

        if (!isSorted) {
            const fragment = document.createDocumentFragment();
            const favs = rows.filter(r => r.classList.contains('is-fav-row'));
            const nonFavs = rows.filter(r => !r.classList.contains('is-fav-row'));

            favs.forEach(r => fragment.appendChild(r));
            nonFavs.forEach(r => fragment.appendChild(r));

            tbody.appendChild(fragment);
        }
    };

    const checkConflict = (targetTimeStr) => {
        if (!config.conflictCheck) return false;
        const mySchedule = GM_getValue('NJU_SCHEDULE', []);
        const parse = (str) => {
            const segments = str.split(/,|，/); let slots = [];
            segments.forEach(seg => {
                const d = seg.match(/周([一二三四五六日])/), s = seg.match(/(\d+)-(\d+)节/), w = seg.match(/(\d+)-(\d+)周/);
                if (d && s && w) slots.push({ day: CN_NUM[d[1]], sS: parseInt(s[1]), eS: parseInt(s[2]), sW: parseInt(w[1]), eW: parseInt(w[2]) });
            }); return slots;
        };
        const targetSlots = parse(targetTimeStr);
        for (let my of mySchedule) {
            const mySlots = parse(my.timeStr);
            for (let tS of targetSlots) {
                for (let mS of mySlots) {
                    if (tS.day === mS.day) {
                        const wOv = Math.max(tS.sW, mS.sW) <= Math.min(tS.eW, mS.eW);
                        const sOv = Math.max(tS.sS, mS.sS) <= Math.min(tS.eS, mS.eS);
                        if (wOv && sOv) return { conflict: true, with: my.name };
                    }
                }
            }
        }
        return false;
    };

    const analyzeLocal = (comments) => {
        let r = 0, b = 0, txt = comments.join(' ').toLowerCase();
        RED_WORDS.forEach(w => { if (txt.includes(w)) r++; });
        BLACK_WORDS.forEach(w => { if (txt.includes(w)) b++; });
        if (/9\d|100/.test(txt)) r += 2;
        if (r + b === 0) return null;
        const ratio = (r / (r + b)) * 100;
        return { color: ratio > 50 ? THEME.GOOD : THEME.BAD, label: ratio > 50 ? "偏向推荐" : "偏向劝退", comments };
    };

    const calcProb = (text) => {
        const parts = text.split('/'); if (parts.length !== 2) return null;
        const enroll = parseInt(parts[0]), cap = parseInt(parts[1]);
        if (isNaN(enroll) || isNaN(cap)) return null;
        let prob = enroll === 0 ? 100 : (cap / enroll) * 100;
        if (prob > 100) prob = 100;
        let color = THEME.P0;
        if(prob>=100) color=THEME.P100; else if(prob>=80) color=THEME.P80; else if(prob>=60) color=THEME.P60; else if(prob>=40) color=THEME.P40; else if(prob>=20) color=THEME.P20;
        return { prob: Math.round(prob), color };
    };

    // ================== 4. UI 样式 ==================
    const injectStyles = () => {
        if (document.getElementById('xk-hub-style')) return;
        const style = document.createElement('style');
        style.id = 'xk-hub-style';
        style.innerHTML = `
            #xk-island-root { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 999999; font-family: sans-serif; pointer-events: none; }
            .xk-island {
                pointer-events: auto; background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(20px);
                border: 1px solid #eee; border-radius: 24px; width: 140px; height: 38px;
                display: flex; flex-direction: column; align-items: center; overflow: hidden;
                transition: width 0.5s ${APPLE_EASE}, height 0.5s ${APPLE_EASE}, transform 0.5s ${APPLE_EASE};
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            .xk-island.expanded { width: 420px; height: 580px; box-shadow: 0 25px 70px rgba(0,0,0,0.2); }
            .xk-island.expanded.mode-add { height: 580px; }
            .status-wrapper { width: 140px; height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; cursor: pointer; }
            .status-text { font-weight: 800; font-size: 14px; color: #333; }
            .status-dot { width: 8px; height: 8px; border-radius: 50%; transition: 0.3s; }
            .xk-panel { opacity: 0; width: 100%; padding: 0 20px; display: flex; flex-direction: column; gap: 13px; pointer-events: none; transition: 0.2s; margin-top: 5px; box-sizing: border-box; }
            .xk-island.expanded .xk-panel { opacity: 1; pointer-events: auto; transition-delay: 0.1s; }
            .hidden-row { display: none !important; }
            .help-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #eee; color: #666; font-size: 11px; font-weight: bold; cursor: default !important; margin-left: 6px; }
            
            /* 收藏高亮样式 */
            tr.course-tr.is-fav-row:not(.cv-has-selected) > td { background-color: #fffdf2 !important; }
            
            .nj-br { display: block; margin-top: 4px; content: ""; }
            .nj-badge {
                display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; color: #fff;
                margin: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: normal; line-height: 1.4; text-align: center; cursor: default !important; max-width: 160px; vertical-align: middle;
            }
            
            .fav-toggle-btn { display: table; margin: 0 auto 4px auto; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s; border: 1px solid #ddd; background: #f8f8f8; color: #666; white-space: nowrap; }
            .fav-toggle-btn.active { background: ${THEME.STAR_ON}; color: white; border-color: ${THEME.STAR_ON}; box-shadow: 0 2px 6px rgba(255, 149, 0, 0.3); }
            .fav-toggle-btn:hover { transform: scale(1.05); }

            /* Modal 独立显示层 */
            .xk-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); z-index: 2147483647; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.4s ${APPLE_EASE}; }
            .xk-modal-overlay.open { opacity: 1; pointer-events: auto; }
            .xk-modal { width: 450px; max-width: 90vw; max-height: 80vh; background: #fff; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; transform: scale(0.92); transition: transform 0.4s ${APPLE_EASE}; }
            .xk-modal-overlay.open .xk-modal { transform: scale(1); }
            .xk-header { padding: 18px 20px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 17px; background: #fff; }
            .xk-close { cursor: pointer; color: #888; font-size: 22px; line-height: 1; transition: 0.2s; }
            .xk-close:hover { color: #333; }
            .xk-body { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; background: #f2f2f7; }
            .xk-footer { padding: 15px 20px; border-top: 1px solid #f0f0f0; display: flex; gap: 10px; background: #fff; justify-content: space-between; flex-wrap: wrap; }
            
            .fav-row { display: flex; align-items: center; padding: 14px; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.2s; }
            .fav-row:hover { transform: scale(1.01); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
            .fav-check { margin-right: 14px; transform: scale(1.3); cursor: pointer; accent-color: ${THEME.ADD}; }
            .fav-info { flex: 1; display: flex; flex-direction: column; }
            .fav-name { font-weight: 600; color: #333; font-size: 14px; margin-bottom: 3px; }
            .fav-detail { color: #888; font-size: 12px; }

            /* Controls */
            .ios-seg-ctrl { position: relative; display: flex; background: #eee; border-radius: 9px; padding: 2px; width: 100%; height: 32px; box-sizing: border-box; }
            .seg-slider { position: absolute; top: 2px; left: 2px; height: 28px; background: #fff; border-radius: 7px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.3s ${APPLE_EASE}; z-index: 1; }
            .seg-btn { flex: 1; text-align: center; font-size: 12px; font-weight: 600; color: #666; z-index: 2; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.2s; }
            .seg-btn.active { color: #000; font-weight: 700; }
            .seg-campus .seg-slider { width: calc((100% - 4px) / 4); }
            .seg-campus[data-idx="0"] .seg-slider { transform: translateX(0%); }
            .seg-campus[data-idx="1"] .seg-slider { transform: translateX(100%); }
            .seg-campus[data-idx="2"] .seg-slider { transform: translateX(200%); }
            .seg-campus[data-idx="3"] .seg-slider { transform: translateX(300%); }
            .seg-mode .seg-slider { width: calc((100% - 4px) / 2); }
            .seg-mode[data-idx="PRE"] .seg-slider { transform: translateX(0%); }
            .seg-mode[data-idx="ADD"] .seg-slider { transform: translateX(100%); }
            .ios-sw { position: relative; width: 44px; height: 26px; background: #e3e3e4; border-radius: 13px; cursor: pointer; transition: 0.3s; }
            .ios-sw.on { background: #34C759; }
            .ios-sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; background: #fff; border-radius: 50%; transition: 0.3s; }
            .ios-sw.on::after { transform: translateX(18px); }
            .xk-btn { flex: 1; padding: 10px; border-radius: 10px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; transition: transform 0.1s; }
            .xk-btn:active { transform: scale(0.96); }
            .save-btn { width: 100%; padding: 12px; border-radius: 12px; border: none; font-size: 14px; font-weight: 800; cursor: pointer; background: #34C759; color: white; margin-top: 2px; transition: transform 0.1s; }

            #nj-popover { position: fixed; z-index: 2147483647; width: 360px; max-height: 400px; overflow-y: auto; background: rgba(255,255,255,0.98); border-radius: 16px; padding: 18px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); opacity: 0; pointer-events: none; transform: scale(0.96) translateY(5px); transition: 0.2s; }
            #nj-popover.visible { opacity: 1; pointer-events: auto; transform: scale(1) translateY(0); }
            .pop-item { font-size: 12px; color: #555; margin-bottom: 6px; border-bottom: 1px dashed #eee; padding-bottom: 6px; }
        `;
        document.head.appendChild(style);
    };

    // ================== 5. UI 及 AI 逻辑 ==================
    let popoverTimer = null;

    const injectModals = () => {
        // 恢复原版页面内收藏夹管理模态框
        if (!document.getElementById('fav-modal-wrapper')) {
            const div = document.createElement('div');
            div.id = 'fav-modal-wrapper';
            div.className = 'xk-modal-overlay';
            div.innerHTML = `
                <div class="xk-modal">
                    <div class="xk-header"><span>收藏夹管理</span><span class="xk-close" id="fav-close">✕</span></div>
                    <div class="xk-body" id="fav-container"></div>
                    <div class="xk-footer">
                        <div style="display:flex; gap:5px;">
                            <button class="xk-btn" id="fav-select-all" style="background:#eee; color:#333; padding:8px 12px;">全选</button>
                            <button class="xk-btn" id="fav-del-sel" style="background:#FF3B30; color:white; padding:8px 12px;">删除</button>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="xk-btn" id="fav-export" style="background:#007AFF; color:white; padding:8px 12px;">备份</button>
                            <button class="xk-btn" id="fav-import" style="background:#34C759; color:white; padding:8px 12px;">恢复</button>
                            <input type="file" id="fav-imp-file" style="display:none" accept=".json">
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(div);

            const favModal = document.getElementById('fav-modal-wrapper');
            document.getElementById('fav-close').onclick = () => favModal.classList.remove('open');
            favModal.onclick = (e) => { if(e.target === favModal) favModal.classList.remove('open'); };

            document.getElementById('fav-select-all').onclick = () => {
                const checks = document.getElementById('fav-container').querySelectorAll('.fav-check');
                const all = Array.from(checks).every(c => c.checked);
                checks.forEach(c => c.checked = !all);
            };

            // 彻底修复的删除逻辑
            document.getElementById('fav-del-sel').onclick = () => {
                const checked = document.getElementById('fav-container').querySelectorAll('.fav-check:checked');
                if(checked.length === 0) return;
                if(confirm('删除选中？')) {
                    let favs = GM_getValue('NJU_FAVORITES', {});
                    checked.forEach(c => {
                        delete favs[c.value];
                        // 同步取消选课表格上的状态
                        document.querySelectorAll('.fav-toggle-btn').forEach(btn => {
                            if(btn.dataset.favId === c.value) {
                                btn.classList.remove('active');
                    btn.innerHTML='收藏';
                                const tr = btn.closest('tr.course-tr');
                                if(tr) tr.classList.remove('is-fav-row');
                            }
                        });
                    });
                    GM_setValue('NJU_FAVORITES', favs);
                    updateFavList(favs);
                    document.getElementById('btn-open-fav').innerText = `收藏夹 (${Object.keys(favs).length})`;
                    sortFavRows(); // 删除后重新排序
                }
            };

            document.getElementById('fav-export').onclick = () => {
                const blob = new Blob([JSON.stringify(GM_getValue('NJU_FAVORITES', {}), null, 2)], {type:'application/json'});
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nju_favs.json'; a.click();
            };
            document.getElementById('fav-import').onclick = () => document.getElementById('fav-imp-file').click();
            document.getElementById('fav-imp-file').onchange = (e) => {
                const r = new FileReader(); r.onload = (ev) => {
                    try { Object.assign(GM_getValue('NJU_FAVORITES', {}), JSON.parse(ev.target.result)); GM_setValue('NJU_FAVORITES', GM_getValue('NJU_FAVORITES')); location.reload(); } catch(e){ alert('文件错误'); }
                }; r.readAsText(e.target.files[0]);
            };
        }
    };

    const updateFavList = (favs) => {
        const container = document.getElementById('fav-container');
        container.innerHTML = '';
        const list = Object.entries(favs);
        if(!list.length) { container.innerHTML = '<div style="text-align:center;color:#999;margin-top:20px;padding:20px;">暂无收藏</div>'; return; }
        list.forEach(([id, i]) => {
            const row = document.createElement('div'); row.className = 'fav-row';
            row.innerHTML = `<input type="checkbox" class="fav-check" value="${id}"><div class="fav-info"><div class="fav-name">${i.name}</div><div class="fav-detail">${i.teacher} | ${i.time}</div></div>`;
            container.appendChild(row);
        });
    };

    const setAITagState = (tag, data) => {
        const score = parseFloat(data['综合评分']);
        let label = '一般'; let color = THEME.P60;
        if (score >= 8.5) { label = '力荐'; color = THEME.GOOD; }
        else if (score >= 7.0) { label = '推荐'; color = THEME.P80; }
        else if (score >= 5.0) { label = '一般'; color = THEME.P40; }
        else { label = '劝退'; color = THEME.BAD; }

        tag.innerText = `${label} (${score})`;
        tag.style.background = color; tag.style.color = '#fff';
        tag.style.cursor = 'help';

        tag.onmouseenter = () => {
            clearTimeout(popoverTimer);
            const pop = document.getElementById('nj-popover');
            pop.innerHTML = `
                <div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">AI 深度解析报告</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>给分:</b> ${data['给分']}</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>任务:</b> ${data['事少']}</div>
                <div style="font-size:12px; margin-bottom:4px; color:#444;"><b>签到:</b> ${data['签到']}</div>
                <div style="font-size:12px; margin-top:8px; padding-top:8px; border-top:1px dashed #ccc; color:#1b5e20; font-weight:bold;">结论: ${data['总结']}</div>
            `;
            const r = tag.getBoundingClientRect();
            pop.style.left = Math.min(r.left, window.innerWidth - 360) + 'px';
            pop.style.top = (r.bottom + 8) + 'px';
            pop.classList.add('visible');
        };
        tag.onmouseleave = () => popoverTimer = setTimeout(() => document.getElementById('nj-popover').classList.remove('visible'), 300);
    };

    const renderIsland = () => {
        if (document.getElementById('xk-island-root')) return;
        const root = document.createElement('div');
        root.id = 'xk-island-root';
        let favorites = GM_getValue('NJU_FAVORITES', {});
        const isAddMode = tempConfig.mode === 'ADD';
        const autoRowStyle = isAddMode ? 'display: none !important;' : '';

        root.innerHTML = `
            <div id="xk-island-main" class="xk-island ${isAddMode ? 'mode-add' : ''}">
                <div class="status-wrapper"><div id="xk-dot" class="status-dot"></div><span class="status-text">Hub 智慧选课终端</span></div>
                <div class="xk-panel">
                    <div class="ios-seg-ctrl seg-mode" id="ctrl-mode" data-idx="${tempConfig.mode}">
                        <div class="seg-slider"></div>
                        <div class="seg-btn ${tempConfig.mode === 'PRE' ? 'active' : ''}" data-val="PRE">初选模式</div>
                        <div class="seg-btn ${tempConfig.mode === 'ADD' ? 'active' : ''}" data-val="ADD">补退选 (开发中)</div>
                    </div>
                    <div id="row-auto" style="display:flex; justify-content:space-between; align-items:center; ${autoRowStyle}">
                        <span style="font-size:13px; font-weight:700;">自动确认</span>
                        <div id="sw-auto" class="ios-sw ${tempConfig.autoConfirm ? 'on' : ''}"></div>
                    </div>
                    <div style="display:flex; gap:10px; width: 100%;">
                        <button id="btn-open-fav" class="xk-btn" style="background:#f0f0f5; color:#333; border:1px solid #ddd;">收藏夹 (${Object.keys(favorites).length})</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(root);
        injectModals(); // 注入模态框

        const island = document.getElementById('xk-island-main');
        const autoRow = document.getElementById('row-auto');
        if(tempConfig.mode === 'ADD') autoRow.classList.add('hidden-row');

        island.onmouseenter = () => island.classList.add('expanded');
        island.onmouseleave = () => island.classList.remove('expanded');
        document.getElementById('xk-dot').style.backgroundColor = config.mode === 'PRE' ? THEME.PRE : THEME.ADD;

        const modeCtrl = document.getElementById('ctrl-mode');
        modeCtrl.querySelectorAll('.seg-btn').forEach(b => b.onclick = (e) => {
            modeCtrl.dataset.idx = e.target.dataset.val;
            modeCtrl.querySelectorAll('.seg-btn').forEach(i=>i.classList.remove('active')); e.target.classList.add('active'); tempConfig.mode = e.target.dataset.val;
            if(tempConfig.mode==='ADD') autoRow.classList.add('hidden-row'); else autoRow.classList.remove('hidden-row');
        });

        // 自动确认保留在浮窗中，其他配置已迁移到 Options 页面
        document.getElementById('sw-auto').onclick = function() {
            tempConfig.autoConfirm = !tempConfig.autoConfirm;
            this.classList.toggle('on');
            GM_setValue('NJU_AUTO', tempConfig.autoConfirm);
        };

        // 点击打开页面内的收藏夹 Modal
        document.getElementById('btn-open-fav').onclick = () => {
            updateFavList(GM_getValue('NJU_FAVORITES', {}));
            document.getElementById('fav-modal-wrapper').classList.add('open');
        };

        // AI/评价/校区/冲突等配置已迁移到 Options 页面统一管理
    };

    const initPopover = () => {
        if(document.getElementById('nj-popover')) return;
        const pop = document.createElement('div'); pop.id = 'nj-popover'; document.body.appendChild(pop);
        pop.onmouseenter = () => clearTimeout(popoverTimer);
        pop.onmouseleave = () => popoverTimer = setTimeout(() => pop.classList.remove('visible'), 300);
    };

    const appendB = (cell, el) => {
        if(!cell.querySelector('.nj-br')) { const br=document.createElement('br'); br.className='nj-br'; cell.appendChild(br); }
        cell.appendChild(el);
    };

    const injectBadges = () => {
        const db = GM_getValue('NJU_DB', {});
        const aiCache = GM_getValue('NJU_AI_CACHE', {});
        let favs = GM_getValue('NJU_FAVORITES', {});

        document.querySelectorAll('tr.course-tr').forEach(row => {
            if(row.dataset.checkedHub) return;

            const name = row.querySelector('.kcmc')?.innerText || '未知';
            const teacher = row.querySelector('.jsmc')?.innerText || '未知';
            const time = row.querySelector('.sjdd')?.innerText || '';

            // 0. 精确收藏逻辑与置顶初始化
            const kchCell = row.querySelector('.kch');
            if (kchCell) {
                const compositeId = `${name}|${teacher}|${time}`;
                const isFav = !!favs[compositeId];
                if (isFav) row.classList.add('is-fav-row');

                if (compositeId && !kchCell.querySelector('.fav-toggle-btn')) {
                    const btn = document.createElement('span');
                    btn.className = `fav-toggle-btn ${isFav ? 'active' : ''}`;
                    btn.innerHTML = isFav ? '已收藏' : '收藏';
                    btn.dataset.favId = compositeId;

                    btn.onclick = (e) => {
                        e.stopPropagation();
                        favs = GM_getValue('NJU_FAVORITES', {});
                        if (favs[compositeId]) {
                            delete favs[compositeId];
                            btn.classList.remove('active'); btn.innerHTML = '收藏';
                            row.classList.remove('is-fav-row');
                        } else {
                            favs[compositeId] = { name, teacher, time, added: Date.now() };
                            btn.classList.add('active'); btn.innerHTML = '已收藏';
                            row.classList.add('is-fav-row');
                        }
                        GM_setValue('NJU_FAVORITES', favs);
                        const b = document.getElementById('btn-open-fav'); if(b) b.innerText = `收藏夹 (${Object.keys(favs).length})`;
                        sortFavRows();
                    };
                    kchCell.prepend(btn);
                }
            }

            // 1. 概率
            const numCell = row.querySelector('.yxrs');
            if (numCell) {
                const p = calcProb(numCell.innerText.trim());
                if(p) { const t = document.createElement('span'); t.className = 'nj-badge'; t.style.background = p.color; t.innerText = `选中概率: ${p.prob}%`; appendB(numCell, t); }
            }

            // 2. 双系统并存评价
            const jsmcCell = row.querySelector('.jsmc');
            if (jsmcCell && config.enableRating && Object.keys(db).length) {
                const rowText = row.innerText.replace(/\s/g, '');
                for(const k in db) {
                    const [c,t] = k.split('#');
                    if(rowText.includes(c.replace(/\s/g,''))) {
                        const ts = t.split(/[\s,，、]+/);
                        if(ts.some(n=>n&&rowText.includes(n))) {
                            let comms = db[k].comments || db[k];
                            if (!Array.isArray(comms) || comms.length === 0) break;

                            const localEval = analyzeLocal(comms);
                            const rawTag = document.createElement('span');
                            rawTag.className = 'nj-badge';
                            rawTag.style.background = localEval ? localEval.color : '#8e8e93';
                            rawTag.innerText = `${comms.length}条评价`;
                            rawTag.style.cursor='help';
                            rawTag.onmouseenter = () => {
                                clearTimeout(popoverTimer);
                                const pop=document.getElementById('nj-popover');
                                let h=`<div style="font-weight:800;color:${THEME.PURPLE};margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;">原始评价库 (本地判定: ${localEval ? localEval.label : '未知'})</div>`;
                                comms.forEach(x=>h+=`<div class="pop-item">● ${x}</div>`);
                                pop.innerHTML=h;
                                const r=rawTag.getBoundingClientRect();
                                pop.style.left=Math.min(r.left,window.innerWidth-360)+'px'; pop.style.top=(r.bottom+8)+'px';
                                pop.classList.add('visible');
                            };
                            rawTag.onmouseleave = () => popoverTimer=setTimeout(()=>document.getElementById('nj-popover').classList.remove('visible'),300);
                            appendB(jsmcCell, rawTag);

                            const cacheKey = `${c}#${t}`;
                            const cached = aiCache[cacheKey];

                            if (cached) {
                                const aiTag = document.createElement('span');
                                aiTag.className = 'nj-badge';
                                setAITagState(aiTag, cached);
                                appendB(jsmcCell, aiTag);
                            } else {
                                window.pendingAITasks.push({ course: c, teacher: t, comments: comms, cacheKey: cacheKey, cell: jsmcCell });
                            }
                            break;
                        }
                    }
                }
            }

            // 3. 冲突 / 跨校区
            const sjCell = row.querySelector('.sjdd'); const xqCell = row.querySelector('.xq');
            if(sjCell && config.conflictCheck) {
                const st = sjCell.innerText;
                if(st && checkConflict(st)) { const r = checkConflict(st); const tag = document.createElement('span'); tag.className='nj-badge'; tag.style.background=THEME.CONFLICT; tag.innerText=`冲突: ${r.with}`; appendB(sjCell, tag); }
            }
            if(xqCell && config.checkCampus && config.myCampus) {
                const xt = xqCell.innerText.trim();
                const myCampusName = CAMPUS_MAP[config.myCampus];
                if(xt && xt !== '全部' && !xt.includes(myCampusName)) {
                    const tag = document.createElement('span'); tag.className='nj-badge'; tag.style.background=THEME.CAMPUS; tag.innerText=`跨校区`; appendB(xqCell, tag);
                }
            }

            row.dataset.checkedHub = "true";
        });

        sortFavRows();
    };

    const startObserver = () => {
        const obs = new MutationObserver(() => {
            if (config.autoConfirm) { const btn = document.querySelector('.cv-sure, .cvBtnFlag[data-type="sure"]'); if (btn && btn.offsetParent) setTimeout(() => btn.click(), 50); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    };

    setInterval(() => { if(!document.getElementById('xk-island-root')) { injectStyles(); renderIsland(); initPopover(); } injectBadges(); }, 1000);
    startObserver();
})();