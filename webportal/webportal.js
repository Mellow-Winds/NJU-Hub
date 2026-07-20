// webportal/webportal.js — 网址导航交互逻辑

let portalData = PORTAL_DATA;  // 默认内置数据，异步加载后可替换
let currentFirstId = '';
let currentSecondId = '';

const GITHUB_PORTAL_URL = 'https://raw.githubusercontent.com/Mellow-Winds/NJU-Hub/main/data/portal_data.json';
const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24小时

document.addEventListener('DOMContentLoaded', async () => {
    await loadPortalData();
    if (!currentFirstId && portalData.length > 0) {
        currentFirstId = portalData[0].id;
    }
    initNav();
    initTheme();
    initRipples();
});

// ===== 0. 加载导航数据（三层策略：storage → GitHub → 内置回退） =====
async function loadPortalData() {
    // Layer 1: chrome.storage.local（已同步过的数据，最快）
    try {
        const stored = await chrome.storage.local.get(['NJU_PORTAL', 'NJU_PORTAL_LAST_FETCH']);
        if (stored.NJU_PORTAL && Array.isArray(stored.NJU_PORTAL) && stored.NJU_PORTAL.length > 0) {
            portalData = stored.NJU_PORTAL;
            console.log('[NJU-Hub] 网址导航: 使用本地同步数据 (' + portalData.length + ' 分类)');

            // 超过24小时后台静默刷新（不阻塞渲染）
            const now = Date.now();
            if (!stored.NJU_PORTAL_LAST_FETCH || (now - stored.NJU_PORTAL_LAST_FETCH) > REFRESH_INTERVAL) {
                refreshPortalInBackground();
            }
            return;
        }
    } catch (e) {
        // 静默回退，不影响用户体验
        console.warn('[NJU-Hub] 网址导航: 读取本地存储失败，尝试在线拉取', e);
    }

    // Layer 2: 从 GitHub 在线拉取（首次使用或 storage 为空时）
    try {
        console.log('[NJU-Hub] 网址导航: 尝试从 GitHub 拉取...');
        const remote = await fetchPortalFromGitHub();
        if (remote && Array.isArray(remote) && remote.length > 0) {
            portalData = remote;
            await chrome.storage.local.set({
                NJU_PORTAL: remote,
                NJU_PORTAL_LAST_FETCH: Date.now()
            });
            console.log('[NJU-Hub] 网址导航: GitHub 拉取成功 (' + remote.length + ' 分类)');
            return;
        }
    } catch (e) {
        // 静默回退到内置数据
        console.warn('[NJU-Hub] 网址导航: GitHub 拉取失败，使用内置数据', e);
    }

    // Layer 3: 内置 PORTAL_DATA（已在模块顶部赋值，无需额外操作）
    console.log('[NJU-Hub] 网址导航: 使用内置数据');
}

function fetchPortalFromGitHub() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: 'fetchJson',
            payload: { url: GITHUB_PORTAL_URL }
        }, (resp) => {
            if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
            if (!resp || !resp.ok) { reject(new Error(resp?.error || 'HTTP ' + (resp?.status || 'error'))); return; }
            resolve(resp.data);
        });
    });
}

function refreshPortalInBackground() {
    fetchPortalFromGitHub().then(remote => {
        if (remote && Array.isArray(remote) && remote.length > 0) {
            chrome.storage.local.set({
                NJU_PORTAL: remote,
                NJU_PORTAL_LAST_FETCH: Date.now()
            });
            console.log('[NJU-Hub] 网址导航: 后台刷新成功 (' + remote.length + ' 分类)');
        }
    }).catch(e => {
        console.warn('[NJU-Hub] 网址导航: 后台刷新失败', e);
    });
}

// ===== 1. 初始化导航 =====
function initNav() {
    renderFirstLevel();
    switchFirstLevel(currentFirstId);
}

// ===== 2. 渲染左侧一级导航 =====
function renderFirstLevel() {
    const navUL = document.getElementById('first-level-nav');
    navUL.textContent = '';

    portalData.forEach(item => {
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
    const firstCategory = portalData.find(item => item.id === firstId);
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

    const firstCategory = portalData.find(item => item.id === currentFirstId);
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