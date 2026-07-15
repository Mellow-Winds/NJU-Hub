/**
 * scripts/spoc_auto_redirect.js
 *
 * 目标页面: study.nju.edu.cn/home/index.mooc* (南京大学 SPOC 悦读平台首页)
 * 功能概述: 检测未登录状态，自动跳转到统一身份认证入口
 * 触发方式: 页面加载时自动注入
 * 依赖模块: 无（跳转后由 auth_auto_login.js 接管自动填充）
 *
 * 详细说明:
 * 1. 读取 toggle-spoc-redirect 开关，默认开启
 * 2. 通过检测页面是否存在指向 /home/login.mooc 的链接来判断登录状态
 *    （已登录时右上角显示用户名，不存在该链接）
 * 3. 检测到未登录则跳转到 /oauth/toMoocAuth.mooc
 *    该 URL 会携带 service 参数重定向到 authserver.nju.edu.cn
 *    与 auth_auto_login.js 无缝衔接，实现全自动登录
 */

(function() {
    'use strict';

    chrome.storage.local.get(['toggle-spoc-redirect'], (cfg) => {
        // 开关默认开启，显式关闭时才退出
        if (cfg['toggle-spoc-redirect'] === false) return;

        // 检测未登录：查找指向登录页的链接
        // 未登录时右上角显示"注册 / 登录"，登录链接指向 /home/login.mooc
        // 已登录时该链接不存在，显示用户名/退出
        const loginLink = document.querySelector('a[href*="login.mooc"]');
        if (!loginLink) return; // 已登录，无需跳转

        // 跳转到统一身份认证入口
        // /oauth/toMoocAuth.mooc 会携带 service 参数重定向到 authserver.nju.edu.cn
        window.location.href = '/oauth/toMoocAuth.mooc';
    });
})();
