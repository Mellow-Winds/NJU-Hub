/**
 * main.js — 首页动画与交互逻辑
 *
 * 核心模式（借鉴 kedazi.top）：
 * 1. Hero 入场：Web Animations API 交错淡入
 * 2. 滚动触发：IntersectionObserver 监听 section 进入视口
 * 3. 卡片悬停：CSS transition + spring 缓动
 *
 * 零依赖，纯原生 JS
 */
(function () {
    'use strict';

    /* ==================== 缓动函数 ==================== */
    const Ease = {
        gentle: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        bounce: 'cubic-bezier(0.18, 1.25, 0.4, 1)',
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        decelerate: 'cubic-bezier(0, 0, 0, 1)',
        accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
    };

    /* ==================== 动画工具函数 ==================== */

    /**
     * 单元素淡入上移
     * @param {Element} el
     * @param {object} opts — { y, dur, delay, ease }
     */
    function animIn(el, opts) {
        opts = opts || {};
        const y = opts.y !== undefined ? opts.y : 24;
        const dur = opts.dur || 600;
        const delay = opts.delay || 0;
        const ease = opts.ease || Ease.bounce;

        el.style.opacity = '0';
        const anim = el.animate(
            [
                { opacity: 0, transform: `translateY(${y}px)` },
                { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: dur, delay: delay, easing: ease, fill: 'forwards' }
        );
        return anim;
    }

    /**
     * 交错淡入：子元素逐个入场
     * @param {Element[]} els
     * @param {object} opts — { y, dur, gap, ease }
     */
    function animStagger(els, opts) {
        opts = opts || {};
        const y = opts.y !== undefined ? opts.y : 20;
        const dur = opts.dur || 500;
        const gap = opts.gap || 60;
        const ease = opts.ease || Ease.bounce;

        els.forEach(function (el, i) {
            el.style.opacity = '0';
            el.animate(
                [
                    { opacity: 0, transform: `translateY(${y}px)` },
                    { opacity: 1, transform: 'translateY(0)' },
                ],
                { duration: dur, delay: i * gap, easing: ease, fill: 'forwards' }
            );
        });
    }

    /* ==================== Hero 入场动画 ==================== */

    function animateHero() {
        const heroContent = document.querySelector('.hero-content');
        if (!heroContent) return;

        const children = Array.from(heroContent.children);
        animStagger(children, { y: 36, dur: 900, gap: 150, ease: Ease.gentle });

        // 滚动提示延迟入场
        const scrollHint = document.querySelector('.hero-scroll-hint');
        if (scrollHint) {
            animIn(scrollHint, { y: 0, dur: 800, delay: 1200, ease: Ease.gentle });
        }
    }

    /* ==================== 滚动触发动画 ==================== */

    function observeSections() {
        const sections = document.querySelectorAll('.section');
        const compareBlocks = document.querySelectorAll('[data-compare]');
        const allTargets = Array.from(sections).concat(Array.from(compareBlocks));

        if (!allTargets.length) return;

        const observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');

                        // 对 section 内的卡片做交错动画
                        const cards = entry.target.querySelectorAll('.feature-card, .install-step');
                        if (cards.length) {
                            // CSS transition 已处理交错延迟，这里额外做 WAAPI 动画增强
                            // 但 CSS 的 .visible 触发已经足够，不需要重复
                        }

                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: '0px 0px -40px 0px',
            }
        );

        allTargets.forEach(function (target) {
            observer.observe(target);
        });
    }

    /* ==================== 导航栏滚动效果 ==================== */

    function initNavScroll() {
        const nav = document.querySelector('.nav');
        if (!nav) return;

        let lastScrollY = 0;

        window.addEventListener('scroll', function () {
            const scrollY = window.scrollY;

            // 滚动超过 10px 加阴影
            if (scrollY > 10) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }

            lastScrollY = scrollY;
        }, { passive: true });
    }

    /* ==================== 平滑滚动锚点 ==================== */

    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href === '#') return;

                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    const navHeight = 64;
                    const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
                    window.scrollTo({ top: top, behavior: 'smooth' });
                }
            });
        });
    }

    /* ==================== 主题切换 ==================== */

    function initThemeToggle() {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;

        // 读取本地存储的主题偏好
        const saved = localStorage.getItem('nju-hub-theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (saved === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        }

        toggle.addEventListener('click', function () {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
                || (document.documentElement.getAttribute('data-theme') !== 'light'
                    && window.matchMedia('(prefers-color-scheme: dark)').matches);

            if (isDark) {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('nju-hub-theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('nju-hub-theme', 'dark');
            }
        });
    }

    /* ==================== 初始化 ==================== */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        animateHero();
        observeSections();
        initNavScroll();
        initSmoothScroll();
        initThemeToggle();
    }
})();
