/**
 * schedule/schedule_exporter.js
 *
 * 导出单文件 HTML：与 schedule-check 技能 build_schedule.py 的输出结构一致
 *   （标题/内联 CSS/图例/节次轴/5天列/底部清单，无 JavaScript）
 * 下载优先 Blob + a[download]，失败回退 chrome.downloads
 * 依赖：window.__SCHED__（gridCssFor/buildGridHtml）
 */

(function () {
    'use strict';

    window.__SCHED__ = window.__SCHED__ || {};

    /**
     * 生成独立的单文件课表 HTML（内联 <style>，无 JS，可在任意浏览器打开）
     * @param {object} meta  @param {Array} courses
     * @returns {string}
     */
    const buildStandaloneHtml = (meta, courses) => {
        const css = window.__SCHED__.gridCssFor(meta.h || 44, true);
        const body = window.__SCHED__.buildGridHtml(meta, courses);
        return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
            '<title>' + (meta.season || '课表') + ' 已选+预选 课表</title><style>' + css + '</style></head>' +
            '<body><div class="wrap">' + body + '</div></body></html>';
    };

    /**
     * 触发下载
     * @param {object} meta
     * @param {Array} courses
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    const downloadHtml = async (meta, courses) => {
        const html = buildStandaloneHtml(meta, courses);
        const filename = '课表_' + (meta.season || '课程') + '_已选加预选.html';
        try {
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return { ok: true };
        } catch (e) {
            console.warn('[NJU-Hub] 课表: Blob 下载失败，回退 chrome.downloads', e);
            try {
                const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
                await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
                return { ok: true };
            } catch (e2) {
                console.warn('[NJU-Hub] 课表: chrome.downloads 下载也失败', e2);
                return { ok: false, error: String(e2 && e2.message || e2) };
            }
        }
    };

    Object.assign(window.__SCHED__, { buildStandaloneHtml, downloadHtml });
})();
