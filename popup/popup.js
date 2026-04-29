document.addEventListener('DOMContentLoaded', () => {
    updateGreeting();
    loadDashboardData();
    bindEvents();
});

// 1. 动态问候语逻辑
function updateGreeting() {
    const hours = new Date().getHours();
    const greetingText = document.getElementById('greeting-text');
    let timeGreeting = "你好";

    if (hours >= 5 && hours < 12) timeGreeting = "上午好";
    else if (hours >= 12 && hours < 18) timeGreeting = "下午好";
    else timeGreeting = "晚上好";

    chrome.storage.local.get(['common-name', 'student_id'], (res) => {
        // 逻辑：姓名优先
        const displayName = res['common-name'] || res['student_id'] || "指挥官";
        greetingText.innerText = `${timeGreeting}，${displayName}`;
    });

    const options = { month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('zh-CN', options);
}

// 2. 加载仪表盘状态
function loadDashboardData() {
    const keys = [
        'toggle-login',
        'toggle-schedule',
        'toggle-eval',
        'toggle-lms',
        'toggle-seec-workpanel'
    ];
    chrome.storage.local.get(keys, (data) => {
        // 渲染 iOS 开关状态：只有明确写 false 才关闭；保持与现有脚本“默认开启”的习惯一致
        ['toggle-login', 'toggle-schedule', 'toggle-eval', 'toggle-lms', 'toggle-seec-workpanel'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = data[id] !== false;
        });
    });
}

// 3. 事件绑定
function bindEvents() {
    // 侧边栏跳转
    document.getElementById('btn-options').onclick = () => chrome.runtime.openOptionsPage();

    // 功能开关（iOS Switch）
    document.querySelectorAll('input[type="checkbox"][id^="toggle-"]').forEach((input) => {
        input.addEventListener('change', () => {
            const key = input.id;
            chrome.storage.local.set({ [key]: input.checked });
        });
    });

    // 快速查询：GPA
    document.getElementById('btn-gpa').onclick = () => {
        chrome.tabs.create({ url: 'http://elite.nju.edu.cn/exchangesystem/' });
    };
}