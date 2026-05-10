// Sidebar bileşeni; YouTube tarzı açılır/kapanır, SVG ikonlar, rol bazlı menü
const Sidebar = (() => {

    // Her menü öğesi için özel SVG ikon
    const ICONS = {
        home: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>`,

        scenarios: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,

        executions: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>`,

        reports: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,

        schedules: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 14.5"/></svg>`,

        chat: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,

        announcements: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,

        admin: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,

        chevron: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,

        hamburger: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,

        logo: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    };

    const NAV_ITEMS = [
        { label: 'Ana Sayfa',            href: 'pages/dashboard.html',         iconKey: 'home',          roles: null },
        { label: 'Senaryolar',           href: 'pages/scenarios.html',          iconKey: 'scenarios',     roles: null },
        { label: 'Çalıştırmalar',        href: 'pages/executions.html',         iconKey: 'executions',    roles: null },
        { label: 'Raporlar',             href: 'pages/reports.html',            iconKey: 'reports',       roles: null },
        { label: 'Zamanlanmış Görevler', href: 'pages/schedules.html',          iconKey: 'schedules',     roles: null },
        { label: 'Mesajlar',             href: 'pages/chat.html',               iconKey: 'chat',          roles: null, badge: 'msg' },
        { label: 'Duyurular',            href: 'pages/announcements.html',      iconKey: 'announcements', roles: null },
        {
            label: 'Yönetim', iconKey: 'admin', roles: ['ADMIN'],
            children: [
                { label: 'Kullanıcılar', href: 'pages/admin/users.html' },
                { label: 'Roller',       href: 'pages/admin/roles.html' },
                { label: 'Denetim',      href: 'pages/admin/audit.html' },
            ]
        },
    ];

    const STORAGE_KEY = 'zs_sidebar_collapsed';

    function _isCollapsed() {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    }

    function _setCollapsed(val) {
        localStorage.setItem(STORAGE_KEY, val ? 'true' : 'false');
    }

    function _currentPage() {
        return window.location.pathname.replace(/^.*\/frontend\//, '');
    }

    function _isActive(href) {
        const cur = _currentPage();
        return cur.endsWith(href) || cur.endsWith(href.replace('pages/', ''));
    }

    function _hasAccess(roles) {
        if (!roles) return true;
        const user = Store.getUser();
        if (!user) return false;
        return roles.some(r => (user.roles || []).includes(r) || (user.roles || []).includes('ROLE_' + r));
    }

    function _resolveHref(href) {
        const cur = window.location.pathname;
        if (cur.includes('/admin/')) return '../../' + href;
        if (cur.includes('/pages/')) return href.replace('pages/', '');
        return href;
    }

    function _dashboardHref() {
        const cur = window.location.pathname;
        if (cur.includes('/admin/')) return '../../pages/dashboard.html';
        if (cur.includes('/pages/')) return 'dashboard.html';
        return 'pages/dashboard.html';
    }

    function _renderItem(item) {
        if (!_hasAccess(item.roles)) return '';

        const svg = ICONS[item.iconKey] || '';

        if (item.children) {
            const hasActiveChild = item.children.some(c => _isActive(c.href));
            const open = hasActiveChild ? 'open' : '';
            const childrenHtml = item.children.map(c => `
                <a class="sidebar-child${_isActive(c.href) ? ' active' : ''}"
                   href="${_resolveHref(c.href)}">
                    <span class="sidebar-child-dot"></span>
                    ${c.label}
                </a>`).join('');

            return `
                <div class="sidebar-group ${open}">
                    <button class="sidebar-item sidebar-group-toggle" aria-expanded="${!!open}" title="${item.label}">
                        <span class="sidebar-icon">${svg}</span>
                        <span class="sidebar-label">${item.label}</span>
                        <span class="sidebar-chevron">${ICONS.chevron}</span>
                    </button>
                    <div class="sidebar-children">${childrenHtml}</div>
                </div>`;
        }

        const badgeHtml = item.badge
            ? `<span class="sidebar-badge" data-badge="${item.badge}" style="display:none">0</span>`
            : '';

        return `
            <a class="sidebar-item${_isActive(item.href) ? ' active' : ''}"
               href="${_resolveHref(item.href)}"
               title="${item.label}">
                <span class="sidebar-icon">${svg}</span>
                <span class="sidebar-label">${item.label}</span>
                ${badgeHtml}
            </a>`;
    }

    function render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="sidebar-header">
                <a class="sidebar-logo" href="${_dashboardHref()}" title="Ana Sayfaya Git">
                    <span class="sidebar-logo-icon">${ICONS.logo}</span>
                    <span class="sidebar-logo-text">Zero<em>Step</em></span>
                </a>
                <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" aria-label="Menüyü Aç/Kapat">
                    ${ICONS.hamburger}
                </button>
                <button class="sidebar-close-btn" id="sidebar-close" aria-label="Kapat">✕</button>
            </div>
            <nav class="sidebar-nav" role="navigation">
                ${NAV_ITEMS.map(_renderItem).join('')}
            </nav>`;

        _applyCollapsed(container, _isCollapsed());
        _bindEvents(container);
        _loadBadges();
    }

    function _applyCollapsed(container, collapsed) {
        const appShell = document.querySelector('.app-shell');
        if (!appShell) return;
        appShell.classList.toggle('sidebar-collapsed', collapsed);
        container.classList.toggle('collapsed', collapsed);
    }

    function _bindEvents(container) {
        const toggleBtn = container.querySelector('#sidebar-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const collapsed = !_isCollapsed();
                _setCollapsed(collapsed);
                _applyCollapsed(container, collapsed);
            });
        }

        const closeBtn = container.querySelector('#sidebar-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.querySelector('.app-shell')?.classList.remove('sidebar-open');
            });
        }

        container.querySelectorAll('.sidebar-group-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.sidebar-group');
                const expanded = group.classList.toggle('open');
                btn.setAttribute('aria-expanded', expanded);
            });
        });

        // Mobil overlay kapatma
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const appShell = document.querySelector('.app-shell');
                if (appShell?.classList.contains('sidebar-open') &&
                    !container.contains(e.target) &&
                    !e.target.closest('#topbar-hamburger')) {
                    appShell.classList.remove('sidebar-open');
                }
            }
        });
    }

    async function _loadBadges() {
        try {
            const notifCount = await Api.get('/notifications/unread-count');
            _setBadge('notif', notifCount?.count ?? 0);
            const msgCount = await Api.get('/chat/unread-count');
            _setBadge('msg', msgCount?.count ?? 0);
        } catch { /* sessiz hata */ }
    }

    function _setBadge(key, count) {
        document.querySelectorAll(`[data-badge="${key}"]`).forEach(el => {
            el.textContent = count > 99 ? '99+' : count;
            el.style.display = count > 0 ? 'inline-flex' : 'none';
        });
    }

    function updateBadge(key, count) { _setBadge(key, count); }

    return { render, updateBadge };
})();