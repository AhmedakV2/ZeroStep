// Sidebar bileşeni; role bazlı menü render + aktif sayfa highlight
const Sidebar = (() => {

    const NAV_ITEMS = [
        { label: 'Dashboard',            href: 'pages/dashboard.html',         icon: '⬡', roles: null },
        { label: 'Senaryolar',           href: 'pages/scenarios.html',          icon: '▤', roles: null },
        { label: 'Çalıştırmalar',        href: 'pages/executions.html',         icon: '▶', roles: null },
        { label: 'Raporlar',             href: 'pages/reports.html',            icon: '◫', roles: null },
        { label: 'Zamanlanmış Görevler', href: 'pages/schedules.html',          icon: '◷', roles: null },
        { label: 'Mesajlar',             href: 'pages/chat.html',               icon: '◈', roles: null, badge: 'msg' },
        { label: 'Bildirimler',          href: 'pages/notifications.html',      icon: '◉', roles: null, badge: 'notif' },
        { label: 'Duyurular',            href: 'pages/announcements.html',      icon: '◎', roles: null },
        {
            label: 'Yönetim', icon: '◰', roles: ['ADMIN'],
            children: [
                { label: 'Kullanıcılar', href: 'pages/admin/users.html' },
                { label: 'Roller',       href: 'pages/admin/roles.html' },
                { label: 'Denetim',      href: 'pages/admin/audit.html' },
            ]
        },
    ];

    // Geçerli sayfa URL'ini normalize et
    function _currentPage() {
        const path = window.location.pathname;
        // Hem /pages/X.html hem de pages/X.html şeklinde çalışsın
        return path.replace(/^.*\/frontend\//, '');
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

    function _renderItem(item) {
        if (!_hasAccess(item.roles)) return '';

        if (item.children) {
            const hasActiveChild = item.children.some(c => _isActive(c.href));
            const open = hasActiveChild ? 'open' : '';
            const childrenHtml = item.children
                .map(c => `<a class="sidebar-child${_isActive(c.href) ? ' active' : ''}" href="${_resolveHref(c.href)}">${c.label}</a>`)
                .join('');
            return `
                <div class="sidebar-group ${open}">
                    <button class="sidebar-item sidebar-group-toggle" aria-expanded="${!!open}">
                        <span class="sidebar-icon">${item.icon}</span>
                        <span class="sidebar-label">${item.label}</span>
                        <span class="sidebar-chevron">›</span>
                    </button>
                    <div class="sidebar-children">${childrenHtml}</div>
                </div>`;
        }

        const badgeHtml = item.badge
            ? `<span class="sidebar-badge" data-badge="${item.badge}" style="display:none">0</span>`
            : '';

        return `
            <a class="sidebar-item${_isActive(item.href) ? ' active' : ''}" href="${_resolveHref(item.href)}">
                <span class="sidebar-icon">${item.icon}</span>
                <span class="sidebar-label">${item.label}</span>
                ${badgeHtml}
            </a>`;
    }

    // pages/X.html → doğru relative path hesapla
    function _resolveHref(href) {
        const cur = window.location.pathname;
        // Admin alt dizininde isek üst dizine çık
        if (cur.includes('/admin/')) return '../' + href;
        if (cur.includes('/pages/')) return href.replace('pages/', '');
        return href;
    }

    function render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const user = Store.getUser();
        const initials = user
            ? (user.displayName || user.username || '?').slice(0, 2).toUpperCase()
            : '?';

        container.innerHTML = `
            <div class="sidebar-header">
                <span class="sidebar-logo">Zero<em>Step</em></span>
                <button class="sidebar-close-btn btn-icon" id="sidebar-close" aria-label="Kapat">✕</button>
            </div>
            <nav class="sidebar-nav" role="navigation">
                ${NAV_ITEMS.map(_renderItem).join('')}
            </nav>
            <div class="sidebar-footer">
                <div class="sidebar-avatar">${initials}</div>
                <div class="sidebar-user-info">
                    <span class="sidebar-username">${user?.username || ''}</span>
                    <span class="sidebar-role">${(user?.roles || []).map(r => r.replace('ROLE_', '')).join(', ')}</span>
                </div>
            </div>`;

        _bindEvents(container);
        _loadBadges();
    }

    function _bindEvents(container) {
        // Grup toggle
        container.querySelectorAll('.sidebar-group-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.sidebar-group');
                const expanded = group.classList.toggle('open');
                btn.setAttribute('aria-expanded', expanded);
            });
        });

        // Mobil kapatma
        const closeBtn = container.querySelector('#sidebar-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.querySelector('.app-shell')?.classList.remove('sidebar-open');
            });
        }
    }

    // Okunmamış badge sayılarını çek
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

    // Dışarıdan badge güncellemek için
    function updateBadge(key, count) {
        _setBadge(key, count);
    }

    return { render, updateBadge };
})();