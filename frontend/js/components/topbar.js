// Topbar bileşeni; sayfa başlığı, bildirim zili, kullanıcı menüsü
const Topbar = (() => {

    function render(containerId, pageTitle = '') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const user = Store.getUser();
        const initials = user
            ? (user.displayName || user.username || '?').slice(0, 2).toUpperCase()
            : '?';

        container.innerHTML = `
            <div class="topbar-left">
                <button class="btn-icon topbar-hamburger" id="topbar-hamburger" aria-label="Menüyü aç">
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
                <h1 class="topbar-title">${Utils.escHtml(pageTitle)}</h1>
            </div>
            <div class="topbar-right">
                <button class="topbar-icon-btn" id="notif-btn" aria-label="Bildirimler" title="Bildirimler">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <span class="topbar-badge" id="topbar-notif-badge" style="display:none">0</span>
                </button>
                <div class="topbar-user" id="topbar-user-menu-trigger">
                    <div class="topbar-avatar">${initials}</div>
                    <span class="topbar-username">${user?.username || ''}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>
                <div class="topbar-dropdown" id="topbar-dropdown">
                    <a class="topbar-dropdown-item" href="${_resolveRoot()}pages/settings.html">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        Ayarlar
                    </a>
                    <hr class="topbar-dropdown-divider">
                    <button class="topbar-dropdown-item topbar-dropdown-danger" id="topbar-logout-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Çıkış Yap
                    </button>
                </div>
            </div>`;

        _bindEvents(container);
        _loadNotifCount();
    }

    function _resolveRoot() {
        return window.location.pathname.includes('/admin/') ? '../../' : '../';
    }

    function _bindEvents(container) {
        // Hamburger menü (mobil sidebar aç)
        container.querySelector('#topbar-hamburger')?.addEventListener('click', () => {
            document.querySelector('.app-shell')?.classList.toggle('sidebar-open');
        });

        // Bildirimler butonu
        container.querySelector('#notif-btn')?.addEventListener('click', () => {
            window.location.href = _resolveRoot() + 'pages/notifications.html';
        });

        // Kullanıcı dropdown toggle
        const trigger = container.querySelector('#topbar-user-menu-trigger');
        const dropdown = container.querySelector('#topbar-dropdown');
        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown?.classList.toggle('open');
        });

        // Dışarı tıkla kapat
        document.addEventListener('click', () => {
            dropdown?.classList.remove('open');
        });

        // Logout
        container.querySelector('#topbar-logout-btn')?.addEventListener('click', async () => {
            try {
                await Auth.logout();
                // Giriş sayfasına yönlendir
                window.location.href = _resolveRoot() + 'index.html';
            } catch (error) {
                console.error('Logout hatası:', error);
                Toast.error('Çıkış yapılırken bir hata oluştu');
            }
        });
    }

    async function _loadNotifCount() {
        try {
            const data = await Api.get('/notifications/unread-count');
            const count = data?.count ?? 0;
            const badge = document.getElementById('topbar-notif-badge');
            if (badge) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        } catch { /* sessiz hata */ }
    }

    function setTitle(title) {
        const el = document.querySelector('.topbar-title');
        if (el) el.textContent = title;
    }

    function updateNotifBadge(count) {
        const badge = document.getElementById('topbar-notif-badge');
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    }

    return { render, setTitle, updateNotifBadge };
})();