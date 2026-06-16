// scripts/inject.js
// 运行在 Main World，专门负责拦截 XHR 并通过事件向外抛出数据
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