// modules/portal.js — 网址导航：远程同步
// 由 options.js 在 DOMContentLoaded + 数据加载完成后调用 initPortalModule()

function initPortalModule() {

    const GITHUB_PORTAL_URL = 'https://raw.githubusercontent.com/Mellow-Winds/NJU-Hub/main/data/portal_data.json';

    const syncStatus = document.getElementById('portal-sync-status');

    function setSyncStatus(msg, isError) {
        if (!syncStatus) return;
        syncStatus.textContent = msg;
        syncStatus.style.color = isError ? 'var(--md-sys-color-error)' : '';
    }

    function githubFetch(url) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'fetchJson', payload: { url } }, (resp) => {
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                if (!resp || !resp.ok) { reject(new Error(resp?.error || resp?.rawText || 'HTTP ' + (resp?.status || 'error'))); return; }
                resolve(resp.data);
            });
        });
    }

    const syncPortalBtn = document.getElementById('portal-sync-btn');
    if (syncPortalBtn) {
        syncPortalBtn.onclick = async () => {
            syncPortalBtn.disabled = true;
            const origHTML = syncPortalBtn.innerHTML;
            syncPortalBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>同步中...';
            setSyncStatus('');

            try {
                setSyncStatus('正在从 GitHub 拉取网址导航数据...');
                const remote = await githubFetch(GITHUB_PORTAL_URL);

                if (!Array.isArray(remote) || remote.length === 0) {
                    throw new Error('远程数据为空或格式不正确');
                }

                await chrome.storage.local.set({
                    NJU_PORTAL: remote,
                    NJU_PORTAL_LAST_FETCH: Date.now()
                });

                const categoryCount = remote.length;
                const linkCount = remote.reduce((sum, cat) => {
                    return sum + (cat.subs || []).reduce((s, sub) => s + (sub.links || []).length, 0);
                }, 0);

                setSyncStatus('同步完成！' + categoryCount + ' 个分类，' + linkCount + ' 条链接');
            } catch (e) {
                console.warn('[NJU-Hub] 网址导航同步失败:', e);
                setSyncStatus('同步失败: ' + e.message, true);
            }

            syncPortalBtn.disabled = false;
            syncPortalBtn.innerHTML = origHTML;
        };
    }
}
