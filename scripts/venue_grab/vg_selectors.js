/**
 * scripts/venue_grab/vg_selectors.js
 * 场馆抢票 — DOM 选择器/文本常量
 * 值来源：2026-08-29 11:20 采集会话（snap_002/003，方肇周体育馆-羽毛球预约页实测）
 */
(function () {
    'use strict';
    window.__VG_SEL__ = {
        // 格子网格：#scrollTable 表格（行=场地，列=时段，表头 span 为 "09:00-10:00"）
        gridTable: '#scrollTable',
        slotBlock: '.reserveBlock',
        // 空闲/已预约/不开放 直接由 class 区分
        freeClass: 'free',
        // 须知勾选（勾选态多一个 ivu-checkbox-wrapper-checked）
        agreeWrapper: '.xieyi .ivu-checkbox-wrapper',
        agreeCheckedClass: 'ivu-checkbox-wrapper-checked',
        // 提交按钮（取消为 .btn.cancel，需排除）
        submitBtn: '.submit_order_box .action .btn:not(.cancel)',
        // 同伴行（选中态 .active）
        buddyRow: '.companion_box .buddy-row',
        buddyActiveClass: 'active',
        // 验证码浮层（AJ-Captcha clickWord）出现 = 交接人工
        captchaBox: '.verifybox',
        // 登录状态条（页面头部，登录后存在；token 失效时 SPA 整页跳 CAS）。
        // 兜底：预约页格子表渲染成功必然已登录（Android 移动版布局无 .isLogin 时依赖此判定）
        isLogin: '.isLogin, #scrollTable',
        // 失败提示容器 + 关键词（成功 toast 未采到，关键词待实战补正）
        toast: ['.ivu-message-notice-content', '.ivu-message'],
        failKeywords: ['失败', '冲突', '已满', '名额', '不可', '错误']
    };
})();
