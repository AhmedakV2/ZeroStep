// Topbar bileşeni; sayfa başlığı, bildirim zili, kullanıcı menüsü
const Topbar = (() => {

    const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;
    const HAMBURGER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;

    function _dashboardHref() {
        const cur = window.location.pathname;
        if (cur.includes('/admin/')) return '../../pages/dashboard.html';
        if (cur.includes('/pages/')) return 'dashboard.html';
        return 'pages/dashboard.html';
    }

    function render(containerId, pageTitle = '') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const user = Store.getUser();
        const initials = user
            ? (user.displayName || user.username || '?').slice(0, 2).toUpperCase()
            : '?';

        container.innerHTML = `
            <div class="topbar-left" style="display: flex; align-items: center;">
                
                <button class="topbar-hamburger" id="topbar-hamburger" aria-label="Menüyü aç" style="background: none; border: none; color: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-right: 16px; padding: 4px;">
                    ${HAMBURGER_SVG}
                </button>
                
                <a class="topbar-logo" href="${_dashboardHref()}" title="Ana Sayfaya Git" style="display: flex; align-items: center; text-decoration: none; margin-right: 24px;">
                    <span class="topbar-logo-text" style="font-family: 'Impact', 'Arial Black', sans-serif; font-weight: 900; font-size: 1.7rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--clr-primary, #6a4ec2); line-height: 1; filter: drop-shadow(2.5px 2.5px 0px rgba(0,0,0,1));">ZEROSTEP</span>
                </a>

                <h1 class="topbar-title" style="margin: 0; padding-left: 16px; border-left: 1px solid rgba(255,255,255,0.1);">${Utils.escHtml(pageTitle)}</h1>
            </div>
            <div class="topbar-right">
                <button class="topbar-icon-btn" id="notif-btn" aria-label="Bildirimler" title="Bildirimler">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <span class="topbar-badge" id="topbar-notif-badge" style="display:none">0</span>
                </button>
                
                <div style="position:relative;">
                    <div class="topbar-user" id="topbar-user-menu-trigger">
                        <div class="topbar-avatar">${initials}</div>
                        <span class="topbar-username">${user?.username || ''}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </div>
                    
                    <div class="topbar-dropdown" id="topbar-dropdown">
                        <a class="topbar-dropdown-item" href="${_resolveRoot()}pages/settings.html">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                            Ayarlar
                        </a>
                        <hr class="topbar-dropdown-divider">
                        <button class="topbar-dropdown-item topbar-dropdown-danger" id="topbar-logout-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                            Çıkış Yap
                        </button>
                    </div>
                </div>
            </div>`;

        _bindEvents(container);
        _loadNotifCount();
    }

    function _resolveRoot() {
        return window.location.pathname.includes('/admin/') ? '../../' : '../';
    }

    function _bindEvents(container) {
        container.querySelector('#topbar-hamburger')?.addEventListener('click', () => {
            const appShell = document.querySelector('.app-shell');

            if (window.innerWidth <= 768) {
                appShell?.classList.toggle('sidebar-open');
            } else {
                const STORAGE_KEY = 'zs_sidebar_collapsed';
                const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
                const newState = !isCollapsed;

                localStorage.setItem(STORAGE_KEY, newState ? 'true' : 'false');
                appShell?.classList.toggle('sidebar-collapsed', newState);

                const sidebarContainer = document.querySelector('.sidebar') || document.getElementById('sidebar-container');
                if (sidebarContainer) {
                    sidebarContainer.classList.toggle('collapsed', newState);
                }
            }
        });

        container.querySelector('#notif-btn')?.addEventListener('click', () => {
            window.location.href = _resolveRoot() + 'pages/notifications.html';
        });

        const trigger = container.querySelector('#topbar-user-menu-trigger');
        const dropdown = container.querySelector('#topbar-dropdown');
        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown?.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            dropdown?.classList.remove('open');
        });

        container.querySelector('#topbar-logout-btn')?.addEventListener('click', async () => {
            try {
                await Auth.logout();
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