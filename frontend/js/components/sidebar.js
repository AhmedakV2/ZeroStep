// Sidebar bileşeni v2 — collapsible (daraltılabilir) + logo tıklama yönlendirmesi
// DEĞİŞTİR: frontend/js/components/sidebar.js
const Sidebar = (() => {

    const NAV_ITEMS = [
        { label: 'Dashboard',            href: 'pages/dashboard.html',         icon: '⬡', roles: null },
        { label: 'Senaryolar',           href: 'pages/scenarios.html',          icon: '▤', roles: null },
        { label: 'Çalıştırmalar',        href: 'pages/executions.html',         icon: '▶', roles: null },
        { label: 'Raporlar',             href: 'pages/reports.html',            icon: '◫', roles: null },
        { label: 'Zamanlanmış Görevler', href: 'pages/schedules.html',          icon: '◷', roles: null },
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

    // localStorage'dan collapse durumunu oku
    const STORAGE_KEY = 'zs_sidebar_collapsed';

    function isCollapsed() {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    }

    function setCollapsed(val) {
        localStorage.setItem(STORAGE_KEY, val ? 'true' : 'false');
    }

    function _currentPage() {
        const path = window.location.pathname;
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
                .map(c => `<a class="sidebar-child${_isActive(c.href) ? ' active' : ''}" href="${_resolveHref(c.href)}" title="${c.label}">${c.label}</a>`)
                .join('');
            return `
                <div class="sidebar-group ${open}">
                    <button class="sidebar-item sidebar-group-toggle" aria-expanded="${!!open}" title="${item.label}">
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
            <a class="sidebar-item${_isActive(item.href) ? ' active' : ''}" href="${_resolveHref(item.href)}" title="${item.label}">
                <span class="sidebar-icon">${item.icon}</span>
                <span class="sidebar-label">${item.label}</span>
                ${badgeHtml}
            </a>`;
    }

    function _resolveHref(href) {
        const cur = window.location.pathname;
        if (cur.includes('/admin/')) return '../../' + href;
        if (cur.includes('/pages/')) return href.replace('pages/', '');
        return href;
    }

    // Dashboard ana sayfa linki çöz
    function _resolveDashboardHref() {
        const cur = window.location.pathname;
        if (cur.includes('/admin/')) return '../../pages/dashboard.html';
        if (cur.includes('/pages/')) return 'dashboard.html';
        return 'pages/dashboard.html';
    }

    function render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const user = Store.getUser();
        const initials = user
            ? (user.displayName || user.username || '?').slice(0, 2).toUpperCase()
            : '?';

        const collapsed = isCollapsed();
        if (collapsed) {
            document.querySelector('.app-shell')?.classList.add('sidebar-collapsed');
        }

        container.innerHTML = `
            <div class="sidebar-header">
                <a href="${_resolveDashboardHref()}" class="sidebar-logo-link" title="Dashboard'a git">
                    <span class="sidebar-logo">Zero<em>Step</em></span>
                </a>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <button class="sidebar-close-btn" id="sidebar-close" aria-label="Kapat">✕</button>
                    <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" aria-label="Daralt" title="Menüyü daralt">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                    </button>
                </div>
            </div>
            <nav class="sidebar-nav" role="navigation">
                ${NAV_ITEMS.map(_renderItem).join('')}
            </nav>
            <div class="sidebar-footer">
                <div class="sidebar-avatar" title="${user?.username || ''}">${initials}</div>
                <div class="sidebar-user-info">
                    <span class="sidebar-username">${user?.username || ''}</span>
                    <span class="sidebar-role">${(user?.roles || []).map(r => r.replace('ROLE_', '')).join(', ')}</span>
                </div>
            </div>`;

        _bindEvents(container);
        _loadBadges();
    }

    function _bindEvents(container) {
        container.querySelectorAll('.sidebar-group-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.sidebar-group');
                const expanded = group.classList.toggle('open');
                btn.setAttribute('aria-expanded', expanded);
            });
        });

        // Mobil kapat butonu
        const closeBtn = container.querySelector('#sidebar-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.querySelector('.app-shell')?.classList.remove('sidebar-open');
            });
        }

        // Collapse toggle butonu
        const collapseBtn = container.querySelector('#sidebar-collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                const shell = document.querySelector('.app-shell');
                const nowCollapsed = shell?.classList.toggle('sidebar-collapsed');
                setCollapsed(nowCollapsed);

                // İkon yönü güncelle
                const icon = collapseBtn.querySelector('svg polyline');
                if (icon) {
                    icon.setAttribute('points', nowCollapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6');
                }
            });

            // Başlangıç ikonunu duruma göre ayarla
            if (isCollapsed()) {
                const icon = collapseBtn.querySelector('svg polyline');
                if (icon) icon.setAttribute('points', '9 18 15 12 9 6');
            }
        }
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

    function updateBadge(key, count) {
        _setBadge(key, count);
    }

    return { render, updateBadge };
})();