document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('message-settings-btn')?.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('message/settings.html') });
    });
});
