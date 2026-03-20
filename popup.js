document.addEventListener('DOMContentLoaded', () => {
    // --- TAB SWITCHING ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    let whitelistLoaded = false;
    let blockedLoaded = false;

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

            if (btn.dataset.tab === 'whitelist' && !whitelistLoaded) {
                loadWhitelist();
                whitelistLoaded = true;
            }
            if (btn.dataset.tab === 'blocked' && !blockedLoaded) {
                loadFullBlocked();
                blockedLoaded = true;
            }
        });
    });

    // --- LOAD STATS + RECENT HISTORY (Stats tab) ---
    chrome.storage.local.get(['overallBlocked', 'whitelist', 'blockedHistory'], (data) => {
        document.getElementById('overall').innerText = data.overallBlocked || 0;
        document.getElementById('whitelist-count').innerText = (data.whitelist || []).length;
        renderHistoryItems(document.getElementById('history-list'), (data.blockedHistory || []).slice(0, 5));
    });

    // --- SESSION COUNT ---
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('facebook.com')) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, (response) => {
                if (response) document.getElementById('session').innerText = response.sessionBlocked;
            });
        }
    });

    // --- CLEAR DATA ---
    document.getElementById('clear-data').addEventListener('click', () => {
        if (confirm('Clear your whitelist, blocked history, and all-time counter?')) {
            chrome.storage.local.set({ whitelist: [], blockedHistory: [], overallBlocked: 0 }, () => {
                document.getElementById('whitelist-count').innerText = 0;
                document.getElementById('overall').innerText = 0;
                renderHistoryItems(document.getElementById('history-list'), []);
                // Refresh already-opened list tabs
                if (whitelistLoaded) renderWhitelistItems([]);
                if (blockedLoaded) renderHistoryItems(document.getElementById('blocked-list'), []);
            });
        }
    });

    // --- WHITELIST TAB ---
    function loadWhitelist() {
        chrome.storage.local.get(['whitelist'], (data) => {
            renderWhitelistItems(data.whitelist || []);
        });
    }

    function renderWhitelistItems(list) {
        const container = document.getElementById('whitelist-list');
        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = '<div class="empty-msg">No whitelisted pages yet.</div>';
            return;
        }
        list.forEach(name => {
            const row = document.createElement('div');
            row.className = 'list-item';

            const nameEl = document.createElement('span');
            nameEl.className = 'item-name';
            nameEl.title = name;
            nameEl.textContent = name;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = '✕ Remove';
            removeBtn.addEventListener('click', () => {
                chrome.storage.local.get(['whitelist'], (data) => {
                    const updated = (data.whitelist || []).filter(n => n !== name);
                    chrome.storage.local.set({ whitelist: updated }, () => {
                        document.getElementById('whitelist-count').innerText = updated.length;
                        renderWhitelistItems(updated);
                    });
                });
            });

            row.appendChild(nameEl);
            row.appendChild(removeBtn);
            container.appendChild(row);
        });
    }

    // --- BLOCKED HISTORY TAB ---
    function loadFullBlocked() {
        chrome.storage.local.get(['blockedHistory'], (data) => {
            renderHistoryItems(document.getElementById('blocked-list'), data.blockedHistory || []);
        });
    }

    // --- SHARED RENDERER ---
    function renderHistoryItems(container, history) {
        container.innerHTML = '';
        if (history.length === 0) {
            container.innerHTML = '<div class="empty-msg">No blocked posts yet.</div>';
            return;
        }
        history.forEach(item => {
            const row = document.createElement('div');
            row.className = 'list-item';

            const a = document.createElement('a');
            a.href = item.link;
            a.target = '_blank';
            a.className = 'item-name';
            a.title = item.name;
            a.textContent = item.name;

            const span = document.createElement('span');
            span.className = 'item-time';
            span.textContent = item.time;

            row.appendChild(a);
            row.appendChild(span);
            container.appendChild(row);
        });
    }
});
