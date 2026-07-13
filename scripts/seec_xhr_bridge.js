/**
 * scripts/seec_xhr_bridge.js
 *
 * 运行环境: Main World（页面主执行环境，非扩展隔离沙箱）
 * 功能概述: 拦截 SEEC 门户的 XHR 请求，将 API 响应数据通过 DOM 事件传递给 Content Script
 * 触发方式: 由 seec_workpanel.js 通过动态创建 <script src> 标签注入到 Main World
 * 依赖模块: 无（纯 Main World 脚本，通过 window.dispatchEvent 通信）
 *
 * 详细说明:
 * 1. 重写 XMLHttpRequest.prototype.open 记录请求 URL
 * 2. 重写 XMLHttpRequest.prototype.send 在 load 事件中过滤目标请求
 * 3. 匹配含 "exam/student/course" 的 API 请求，提取作业/成绩数据
 * 4. 通过 CustomEvent('seec_data_leak') 将 JSON 数据传递给隔离世界的 seec_workpanel.js
 * 5. 解决 Chrome 扩展 Manifest V3 中 Content Script 无法直接访问页面 JS 变量的隔离限制
 */
(function() {
    const originalSend = XMLHttpRequest.prototype.send;
    const originalOpen = XMLHttpRequest.prototype.open;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            if (this._url && this._url.includes('exam/student/course')) {
                // 抓取到数据，触发自定义事件传给隔离世界的 Content Script
                window.dispatchEvent(new CustomEvent('seec_data_leak', { detail: this.responseText }));
            }
        });
        return originalSend.apply(this, arguments);
    };
})();