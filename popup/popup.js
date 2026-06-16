document.addEventListener('DOMContentLoaded', () => {
    updateGreeting();
    loadDashboardData();
    bindEvents();
    initRipples();
    loadTheme();
});

// ── MD3 Ripple Effect ──────────────────────────────────────────────

function initRipples() {
    const targets = document.querySelectorAll('.primary-btn, .settings-trigger');
    targets.forEach(el => {
        el.style.position = el.style.position || 'relative';
        el.style.overflow = 'hidden';
        el.addEventListener('pointerdown', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const size = Math.max(el.clientWidth, el.clientHeight) * 2;
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (x - size / 2) + 'px';
            ripple.style.top = (y - size / 2) + 'px';
            el.appendChild(ripple);
            ripple.offsetHeight; // force reflow
            ripple.classList.add('animate');
            ripple.addEventListener('animationend', () => ripple.remove());
        });
    });
}

// ── Material Color Utilities — Theme ───────────────────────────────

function loadTheme() {
    const MCU = window.MaterialColorUtils;
    if (!MCU) return;

    chrome.storage.sync.get(['ui_theme_color', 'ui_theme_mode'], (uiData) => {
        const color = uiData.ui_theme_color || '#0ea5e9';
        const isDark = uiData.ui_theme_mode === 'dark';
        MCU.applyTheme(color, isDark);
    });
}

// ── Dynamic Greeting ───────────────────────────────────────────────

function updateGreeting() {
    const hours = new Date().getHours();
    const greetingText = document.getElementById('greeting-text');
    let timeGreeting = "你好";

    if (hours >= 5 && hours < 12) timeGreeting = "上午好";
    else if (hours >= 12 && hours < 18) timeGreeting = "下午好";
    else timeGreeting = "晚上好";

    chrome.storage.local.get(['common-name', 'student_id'], (res) => {
        const displayName = res['common-name'] || res['student_id'] || "指挥官";
        greetingText.innerText = `${timeGreeting}，${displayName}`;
    });

    const options = { month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('zh-CN', options);
}

// ── Dashboard State ────────────────────────────────────────────────

function loadDashboardData() {
    const keys = [
        'toggle-login',
        'toggle-schedule',
        'toggle-eval',
        'toggle-lms',
        'toggle-seec-workpanel'
    ];
    chrome.storage.local.get(keys, (data) => {
        ['toggle-login', 'toggle-schedule', 'toggle-eval', 'toggle-lms', 'toggle-seec-workpanel'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = data[id] !== false;
        });
    });
}

// ── Event Bindings ─────────────────────────────────────────────────

function bindEvents() {
    // Settings page
    document.getElementById('btn-options').onclick = () => chrome.runtime.openOptionsPage();

    // Feature toggles
    document.querySelectorAll('input[type="checkbox"][id^="toggle-"]').forEach((input) => {
        input.addEventListener('change', () => {
            chrome.storage.local.set({ [input.id]: input.checked });
        });
    });

    // GPA quick access
    document.getElementById('btn-gpa').onclick = () => {
        chrome.tabs.create({ url: 'http://elite.nju.edu.cn/exchangesystem/' });
    };
}
