const DEMO_COURSES = [
  { name: 'C语言程序设计基础', teacher: '曾哲妮', score: 91, reviews: ['作业和考试需要认真准备，但学会之后收获很大。老师不点名，适合愿意自学的同学。给分不错。', '课程节奏清楚，认真完成作业就能跟上，最后总评比预期高。'] },
  { name: '大学数学（一）', teacher: '李老师', score: 75, reviews: ['内容比较扎实，平时作业量中等，考试需要刷题。', '老师讲课认真，想拿高分需要投入时间。'] },
  { name: '“科学之光”——地球科学探索与实践创新之路', teacher: '汪恺 等', score: 94, reviews: ['每节课记笔记，期末只需要提交几百字感想，给分很好。还有一次地质博物馆参观。', '不同老师轮流讲课，内容轻松有趣，选到就是赚到。'] },
  { name: '英语语音、信息与有效的国际间交际', teacher: '陈桦', score: 42, reviews: ['事情很多，课堂节奏紧张，整体压力比较大。', '每周都有展示和听写，投入时间远超预期，谨慎选择。'] },
  { name: '批判哲学视野中的人与技术', teacher: '张老师', score: 88, reviews: ['课程讨论很有意思，作业形式比较灵活，适合喜欢思考和表达的同学。'] },
  { name: '程序设计基础（Python）', teacher: '王明', score: 51, reviews: ['作业量偏多，后半学期难度上升明显，时间安排需要很充足。', '考试题目不算偏，但平时任务容易堆在一起。'] }
];

const REMOTE_DATA_URL = 'https://raw.githubusercontent.com/Mellow-Winds/NJU-Hub/main/data/merged_ratings.json';
const CACHE_KEY = 'NJU_DB';
const LAST_SYNC_KEY = 'NJU_COURSE_RATINGS_LAST_SYNC';
const INITIALIZED_KEY = 'NJU_DB_INITIALIZED';
const RESULT_PAGE_SIZE = 90;
const SEARCH_ALIASES = {
  '线代': ['线性代数'],
  '高数': ['高等数学', '微积分'],
  '概率': ['概率论', '数理统计'],
  '离散': ['离散数学'],
  '程设': ['程序设计'],
  'c语言': ['c语言程序设计', '程序设计基础'],
  'cpl': ['c语言程序设计', '程序设计基础']
};

const state = {
  courses: [],
  results: [],
  renderedCount: 0,
  hasSearched: false,
  showingAll: false,
  lastDialogTrigger: null,
  loadedFrom: '示例数据',
  syncTimer: null
};

const $ = (selector) => document.querySelector(selector);
const normalize = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000·•，。、“”"'（）()【】[\]：:、/\\_—–-]/g, '').trim();
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(value);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  initRipples();
  initTheme();
  state.courses = addCourseKeys(DEMO_COURSES.map((course) => ({ ...course, reviewYears: course.reviews.map(() => '2025'), source: 'demo' })));
  updateStats();
  renderSearchIdle();
  await loadInitialData();
}

async function loadInitialData() {
  const stored = await storageGet([CACHE_KEY, LAST_SYNC_KEY, INITIALIZED_KEY]);
  const cachedCourses = parseRawCourses(stored[CACHE_KEY], '本地缓存');
  if (stored[INITIALIZED_KEY]) {
    replaceCourses(cachedCourses, '本地数据库');
    if (stored[LAST_SYNC_KEY]) setSourceLabel(`本地缓存 · ${formatDate(stored[LAST_SYNC_KEY])}`);
    return;
  }
  if (cachedCourses.length) {
    await storageSet({ [INITIALIZED_KEY]: true });
    replaceCourses(cachedCourses, '本地缓存');
    return;
  }

  try {
    const response = await fetch('../data/merged_ratings.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json();
    const bundled = parseRawCourses(raw, '内置数据');
    if (!bundled.length) throw new Error('内置数据为空');
    await storageSet({ [CACHE_KEY]: raw, [INITIALIZED_KEY]: true });
    replaceCourses(bundled, '内置数据');
  } catch (error) {
    setSourceLabel('示例数据');
  }
}

function bindEvents() {
  $('#search-form').addEventListener('submit', (event) => { event.preventDefault(); runSearch(); });
  $('#clear-button').addEventListener('click', () => { $('#search-form').reset(); runSearch(); $('#course-name').focus(); });
  $('#show-all-button').addEventListener('click', showAllCourses);
  $('#sync-button').addEventListener('click', syncCloudData);
  $('#theme-toggle').addEventListener('click', toggleTheme);
  window.addEventListener('scroll', maybeLoadMoreResults, { passive: true });
  $('#dialog-close').addEventListener('click', closeCourseDialog);
  $('#course-dialog-backdrop').addEventListener('click', closeCourseDialog);
  $('#course-dialog').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeCourseDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if ($('#course-dialog').classList.contains('open')) closeCourseDialog();
  });

  document.querySelectorAll('[data-view-link]').forEach((element) => element.addEventListener('click', (event) => {
    event.preventDefault();
    switchView(element.dataset.viewLink);
  }));

}

function switchView(viewId) {
  closeCourseDialog();
  document.querySelectorAll('.view').forEach((view) => {
    const active = view.id === viewId;
    view.hidden = !active;
    view.classList.toggle('active', active);
  });
  document.querySelectorAll('[data-view-link]').forEach((link) => link.classList.toggle('active', link.dataset.viewLink === viewId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function parseRawCourses(raw, source) {
  if (!raw || typeof raw !== 'object') return [];
  const entries = Array.isArray(raw) ? raw.map((item) => [item.key || item.name || '', item]) : Object.entries(raw);
  return addCourseKeys(entries.map(([key, value]) => parseCourse(key, value, source)).filter((course) => course.name));
}

function parseCourse(key, value, source) {
  const divider = key.indexOf('#');
  const name = value?.courseName || (divider > -1 ? key.slice(0, divider) : key);
  const teacher = Array.isArray(value?.teachers) ? value.teachers.join('、') : (divider > -1 ? key.slice(divider + 1) : value?.teacher || '未知教师');
  const reviewDetails = collectReviewDetails(value);
  const reviews = reviewDetails.map((item) => item.text);
  const reviewYears = reviewDetails.map((item) => item.year);
  const rating = scoreReviews(reviews);
  return { name, teacher, reviews, reviewYears, rawKey: key, ...rating, source };
}

function collectReviewDetails(value, fieldName = '', inheritedYear = '') {
  const metadataFields = new Set(['teacher', 'teachers', 'courseName', 'name']);
  const year = getReviewYear(fieldName) || inheritedYear;
  if (typeof value === 'string') return value.trim() && !metadataFields.has(fieldName) ? [{ text: value.trim(), year }] : [];
  if (Array.isArray(value)) return value.flatMap((item) => collectReviewDetails(item, '', year));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => collectReviewDetails(item, key, year));
  }
  return [];
}

function getReviewYear(fieldName) {
  const value = String(fieldName || '').trim();
  return /^(20\d{2})(?:[春夏秋冬]|[-_/]20\d{2})?$/.test(value) ? value : '';
}

function formatReviewYear(year) {
  return year ? String(year) : '年份未标注';
}

function addCourseKeys(courses) {
  return courses.map((course) => ({ ...course, key: course.key || course.rawKey || `${course.name}#${course.teacher}` }));
}

function scoreReviews(reviews) {
  const text = reviews.join(' ');
  const redWords = ['推荐', '给分高', '给分好', '给分不错', '轻松', '简单', '事少', '好课', '赚到', '友好', '不卷', '舒服', '红'];
  const blackWords = ['快跑', '不推荐', '压力大', '事多', '很累', '困难', '极难', '很差', '不负责', '地狱', '慎选', '黑'];
  const redHits = redWords.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
  const blackHits = blackWords.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
  const score = Math.max(18, Math.min(98, Math.round(72 + (redHits - blackHits) * 6 + Math.min(reviews.length, 8))));
  return { score };
}

function replaceCourses(courses, source) {
  state.courses = addCourseKeys(courses);
  state.loadedFrom = source;
  updateStats();
  setSourceLabel(source);
  if (state.showingAll) showAllCourses();
  else if (state.hasSearched) runSearch();
  else renderSearchIdle();
}

function runSearch() {
  const query = { name: normalize($('#course-name').value), teacher: normalize($('#teacher').value) };
  const hasQuery = Object.values(query).some(Boolean);
  state.showingAll = false;
  if (!hasQuery) {
    state.hasSearched = false;
    state.results = [];
    renderSearchIdle();
    return;
  }

  state.hasSearched = true;
  state.results = state.courses.filter((course) => {
    return (!query.name || matchesText(course.name, query.name)) &&
      (!query.teacher || matchesText(course.teacher, query.teacher));
  }).sort((a, b) => b.score - a.score);
  $('#results-title').textContent = '搜索结果';
  paintResults();
}

function showAllCourses() {
  $('#search-form').reset();
  state.hasSearched = true;
  state.showingAll = true;
  state.results = [...state.courses].sort((a, b) => b.score - a.score);
  $('#results-title').textContent = '全部课程';
  paintResults();
}

function renderSearchIdle() {
  const section = $('.results-section');
  section.hidden = true;
  state.renderedCount = 0;
  $('#results-title').textContent = '搜索结果';
  $('#result-summary').textContent = '请输入搜索条件';
  $('#results-grid').innerHTML = '';
}

function matchesText(value, query) {
  const haystack = normalize(value);
  return expandQuery(query).some((term) => haystack.includes(term) || isOrderedFuzzyMatch(haystack, term));
}

function isOrderedFuzzyMatch(value, query) {
  if (!query || query.length < 2) return false;
  let cursor = 0;
  for (const character of Array.from(query)) {
    const matchIndex = value.indexOf(character, cursor);
    if (matchIndex === -1) return false;
    cursor = matchIndex + character.length;
  }
  return true;
}

function expandQuery(query) {
  const normalized = normalize(query);
  const aliases = Object.entries(SEARCH_ALIASES).find(([alias]) => normalized === alias || normalized.includes(alias));
  return [normalized, ...(aliases ? aliases[1] : [])].filter(Boolean).map(normalize);
}

function paintResults() {
  if (!state.hasSearched) {
    renderSearchIdle();
    return;
  }
  $('.results-section').hidden = false;
  const visible = state.results;
  $('#result-summary').textContent = `${formatNumber(visible.length)} 门课程`;
  const grid = $('#results-grid');
  grid.innerHTML = '';
  state.renderedCount = 0;
  if (!visible.length) {
    grid.innerHTML = '<div class="empty-state"><strong>没有找到匹配的课程</strong><span>换个关键词试试，支持简称和模糊搜索。</span></div>';
    return;
  }
  appendResultPage();
}

function appendResultPage() {
  if (!state.hasSearched || state.renderedCount >= state.results.length) return;
  const start = state.renderedCount;
  const end = Math.min(start + RESULT_PAGE_SIZE, state.results.length);
  const grid = $('#results-grid');
  state.results.slice(start, end).forEach((course, index) => grid.appendChild(createCourseCard(course, start + index)));
  state.renderedCount = end;
}

function maybeLoadMoreResults() {
  if (!state.hasSearched || state.renderedCount >= state.results.length) return;
  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 360;
  if (nearBottom) appendResultPage();
}

function createCourseCard(course, index) {
  const card = document.createElement('article');
  card.className = 'course-card ripple-container';
  card.style.animationDelay = `${Math.min(index, 12) * 28}ms`;
  card.innerHTML = `<div class="card-top"><span class="course-type">课程</span></div><h3 title="${escapeHtml(course.name)}">${escapeHtml(course.name)}</h3><p class="teacher">${escapeHtml(course.teacher)}</p><div class="card-spacer"></div><div class="score-row"><strong class="score-number">${course.score}<small>/100</small></strong><span class="review-count">${course.reviews.length} 条评价</span></div><p class="course-summary">点击查看全部评价</p>`;
  card.addEventListener('click', () => openCourseDialog(course, card));
  attachRipple(card);
  return card;
}

function openCourseDialog(course, trigger = null) {
  const reviewItems = course.reviews.map((text, index) => ({
    text,
    year: course.reviewYears?.[index] || ''
  }));
  const reviewMarkup = reviewItems.length
    ? reviewItems.map((item) => `<li><div class="dialog-review-head"><span class="review-year">${escapeHtml(formatReviewYear(item.year))}</span></div><span>${escapeHtml(item.text)}</span></li>`).join('')
    : '<li class="dialog-empty-review">暂时没有评价原文。</li>';
  $('#dialog-content').innerHTML = `<div class="dialog-title-row"><div><h2 id="dialog-course-title">${escapeHtml(course.name)}</h2><p class="dialog-meta">${escapeHtml(course.teacher)}</p></div></div><div class="dialog-score-row"><strong class="dialog-score">${course.score}<small>/100</small></strong><span>${formatNumber(course.reviews.length)} 条评价</span></div><div class="dialog-reviews-heading">全部评价</div><ul class="dialog-reviews">${reviewMarkup}</ul>`;
  state.lastDialogTrigger = trigger;
  $('#course-dialog').classList.add('open');
  $('#course-dialog').setAttribute('aria-hidden', 'false');
  $('#course-dialog-backdrop').classList.add('open');
  document.body.classList.add('dialog-open');
  window.setTimeout(() => $('#dialog-close').focus(), 0);
}

function closeCourseDialog() {
  const dialog = $('#course-dialog');
  if (!dialog || !dialog.classList.contains('open')) return;
  dialog.classList.remove('open');
  dialog.setAttribute('aria-hidden', 'true');
  $('#course-dialog-backdrop').classList.remove('open');
  document.body.classList.remove('dialog-open');
  if (state.lastDialogTrigger && document.contains(state.lastDialogTrigger)) state.lastDialogTrigger.focus();
  state.lastDialogTrigger = null;
}

async function syncCloudData() {
  const button = $('#sync-button');
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add('syncing');
  showSyncMessage('正在同步云端数据…');
  try {
    const raw = await fetchCloudJson();
    const courses = parseRawCourses(raw, '云端数据');
    if (!courses.length) throw new Error('云端数据为空或格式不正确');
    await storageSet({ [CACHE_KEY]: raw, [INITIALIZED_KEY]: true, [LAST_SYNC_KEY]: Date.now() });
    replaceCourses(courses, '云端数据');
    setSourceLabel(`云端数据 · ${formatDate(Date.now())}`);
    showSyncMessage(`同步完成：${formatNumber(courses.length)} 门课程`, 'success');
  } catch (error) {
    showSyncMessage(`同步失败：${error.message || '网络请求失败'}`, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('syncing');
  }
}

function fetchCloudJson() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'fetchJson', payload: { url: REMOTE_DATA_URL } }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok || !response.data) return reject(new Error(response?.error || `HTTP ${response?.status || 0}`));
        resolve(response.data);
      });
    });
  }
  return fetch(REMOTE_DATA_URL, { cache: 'no-cache' }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

function initTheme() {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.get(['ui_theme_color', 'ui_theme_mode'], (data) => applyTheme(data.ui_theme_color || '#0ea5e9', data.ui_theme_mode === 'dark'));
    return;
  }
  applyTheme('#0ea5e9', localStorage.getItem('nju-hub-theme') === 'dark');
}

function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
  const color = '#0ea5e9';
  applyTheme(color, dark);
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) chrome.storage.sync.set({ ui_theme_color: color, ui_theme_mode: dark ? 'dark' : 'light' });
  else localStorage.setItem('nju-hub-theme', dark ? 'dark' : 'light');
}

function applyTheme(color, dark) {
  document.documentElement.toggleAttribute('data-theme', dark);
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  if (window.MaterialColorUtils) window.MaterialColorUtils.applyTheme(color, dark);
  $('#theme-toggle').setAttribute('aria-label', dark ? '切换日间模式' : '切换夜间模式');
}

function updateStats() {
  $('#data-source-label').textContent = state.loadedFrom;
}

function setSourceLabel(source) {
  state.loadedFrom = source;
  $('#data-source-label').textContent = source;
}

function showSyncMessage(message, type = '') {
  const element = $('#sync-message');
  clearTimeout(state.syncTimer);
  element.textContent = message;
  element.className = `sync-message visible ${type}`.trim();
  state.syncTimer = setTimeout(() => { element.textContent = ''; element.className = 'sync-message'; }, 3000);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function storageGet(keys) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return Promise.resolve({});
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return Promise.resolve();
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function initRipples() { document.querySelectorAll('.ripple-container').forEach(attachRipple); }

function attachRipple(element) {
  element.addEventListener('pointerdown', (event) => {
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    element.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
