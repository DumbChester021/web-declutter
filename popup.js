document.addEventListener('DOMContentLoaded', () => {
    // 1. Get All-Time stats and History from browser storage
    chrome.storage.local.get(['overallBlocked', 'whitelist', 'blockedHistory'], (data) => {
        document.getElementById('overall').innerText = data.overallBlocked || 0;
        document.getElementById('whitelist-count').innerText = (data.whitelist ||[]).length;

        // Render History List
        const historyList = document.getElementById('history-list');
        const history = data.blockedHistory ||[];

        if (history.length === 0) {
            historyList.innerHTML = '<div style="padding: 10px; color:#888; text-align:center;">No blocked posts yet.</div>';
        } else {
            historyList.innerHTML = ''; // Clear loading text
            history.forEach(item => {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.innerHTML = `
                    <a href="${item.link}" target="_blank" class="history-name" title="${item.name}">${item.name}</a>
                    <span class="history-time">${item.time}</span>
                `;
                historyList.appendChild(div);
            });
        }
    });

    // 2. Ask the active Facebook tab for the current Session stats
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0] && tabs[0].url.includes("facebook.com")) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "getStats"}, (response) => {
                if (response) {
                    document.getElementById('session').innerText = response.sessionBlocked;
                }
            });
        }
    });

    // 3. Clear Data Button
    document.getElementById('clear-data').addEventListener('click', () => {
        if(confirm("Are you sure you want to clear your whitelist and history?")) {
            chrome.storage.local.set({ whitelist: [], blockedHistory: [] }, () => {
                document.getElementById('whitelist-count').innerText = 0;
                document.getElementById('history-list').innerHTML = '<div style="padding: 10px; color:#888; text-align:center;">No blocked posts yet.</div>';
            });
        }
    });
});
