// webportal/webportal.js — 网址导航交互逻辑

let currentFirstId = PORTAL_DATA[0].id;
let currentSecondId = '';

document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initTheme();
    initRipples();
});

// ===== 1. 初始化导航 =====
function initNav() {
    renderFirstLevel();
    switchFirstLevel(currentFirstId);
}

// ===== 2. 渲染左侧一级导航 =====
function renderFirstLevel() {
    const navUL = document.getElementById('first-level-nav');
    navUL.textContent = '';

    PORTAL_DATA.forEach(item => {
        const li = document.createElement('li');
        li.className = 'nav-item ripple-container';
        li.dataset.id = item.id;
        li.textContent = item.name;
        li.addEventListener('click', () => switchFirstLevel(item.id));
        li.addEventListener('pointerdown', (e) => navRipple(e, li));
        navUL.appendChild(li);
    });
}

// ===== 3. 切换一级分类 =====
function switchFirstLevel(firstId) {
    currentFirstId = firstId;

    // 更新左侧高亮
    document.querySelectorAll('#first-level-nav .nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === firstId);
    });

    // 找到对应一级数据
    const firstCategory = PORTAL_DATA.find(item => item.id === firstId);
    const subs = firstCategory ? firstCategory.subs : [];

    // 默认选中第一个二级分类
    currentSecondId = subs.length > 0 ? subs[0].id : '';

    renderSecondLevelTabs(subs);
    renderCards();
}

// ===== 4. 渲染顶部二级 Tab =====
function renderSecondLevelTabs(subs) {
    const tabsUL = document.getElementById('second-level-tabs');
    tabsUL.textContent = '';

    subs.forEach(sub => {
        const li = document.createElement('li');
        li.className = 'tab-item ripple-container';
        li.dataset.id = sub.id;
        if (sub.id === currentSecondId) {
            li.classList.add('active');
        }
        li.textContent = sub.name;
        li.addEventListener('click', () => {
            currentSecondId = sub.id;
            document.querySelectorAll('#second-level-tabs .tab-item').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.id === currentSecondId);
            });
            renderCards();
        });
        li.addEventListener('pointerdown', (e) => centerRipple(e, li));
        tabsUL.appendChild(li);
    });
}

// ===== 5. 渲染卡片网格 =====
function renderCards() {
    const grid = document.getElementById('card-grid');
    grid.textContent = '';

    // 先移除动画 class，以便重新触发
    grid.classList.remove('cards-revealed');

    const firstCategory = PORTAL_DATA.find(item => item.id === currentFirstId);
    const secondCategory = firstCategory?.subs.find(sub => sub.id === currentSecondId);
    const links = secondCategory ? secondCategory.links : [];

    if (links.length === 0) {
        const tip = document.createElement('div');
        tip.className = 'empty-tip';
        tip.textContent = '该分类下暂无网址';
        grid.appendChild(tip);
        return;
    }

    links.forEach(card => {
        const a = document.createElement('a');
        a.className = 'portal-card ripple-container';
        a.href = card.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        const title = document.createElement('h3');
        title.className = 'portal-card__title';
        title.textContent = card.name;

        const desc = document.createElement('p');
        desc.className = 'portal-card__desc';
        desc.textContent = card.desc;

        const urlSpan = document.createElement('span');
        urlSpan.className = 'portal-card__url';
        urlSpan.textContent = extractHost(card.url);

        a.appendChild(title);
        a.appendChild(desc);
        a.appendChild(urlSpan);

        a.addEventListener('pointerdown', (e) => cardRipple(e, a));
        grid.appendChild(a);
    });

    // 触发交错入场动画
    requestAnimationFrame(() => {
        grid.classList.add('cards-revealed');
    });
}

// ===== 6. 提取域名 =====
function extractHost(url) {
    try {
        const u = new URL(url);
        return u.hostname;
    } catch {
        return url;
    }
}

// ===== 7. Ripple Effects =====
function initRipples() {
    // Nav items already have individual listeners via renderFirstLevel
    // Tab items already have individual listeners via renderSecondLevelTabs
    // Cards already have individual listeners via renderCards
}

// Nav pill ripple — contained diffusion
function navRipple(e, el) {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = createRipple(size, x, y);
    ripple.classList.add('animate-nav');
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

// Center ripple — for tabs
function centerRipple(e, el) {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const x = rect.width / 2 - size / 2;
    const y = rect.height / 2 - size / 2;

    const ripple = createRipple(size, x, y);
    ripple.classList.add('animate-nav');
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

// Card ripple — expands far out
function cardRipple(e, el) {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = createRipple(size, x, y);
    ripple.classList.add('animate');
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

function createRipple(size, x, y) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    return ripple;
}

// ===== 8. 主题初始化 =====
function initTheme() {
    const MCU = window.MaterialColorUtils;
    if (!MCU) return;

    chrome.storage.sync.get(['ui_theme_color', 'ui_theme_mode'], (data) => {
        const color = data.ui_theme_color || '#0ea5e9';
        const isDark = data.ui_theme_mode === 'dark';

        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        MCU.applyTheme(color, isDark);
    });
}