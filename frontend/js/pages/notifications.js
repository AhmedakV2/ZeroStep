// Bildirimler sayfası — liste, okundu işaretleme, arama, tercihler, WebSocket

let currentPage  = 0;
let currentFilter = 'all'; // 'all' | 'unread' | NotificationType
let currentSearch = '';    // ARAMA DEĞİŞKENİ EKLENDİ
let stompClient  = null;
let wsConnected  = false;

// Bildirimlerin lokal önbelleği (sayfa yenilemeden unread sayısını takip et)
let summaryCache = { total: 0, unread: 0, completed: 0, failed: 0 };

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Bildirimler');

    setupFilterTabs();
    setupSearch(); // ARAMA FONKSİYONU ÇAĞRILDI
    setupHeaderButtons();
    connectWebSocket();

    await loadNotifications();
    await loadSummary();
})();

// ═══════════════════════════════════════════════════════════
// VERİ YÜKLEME
// ═══════════════════════════════════════════════════════════
async function loadNotifications() {
    try {
        const params = { page: currentPage, size: 20 };

        // Filtre parametreleri (Backend'e gönderilir)
        if (currentFilter === 'unread') {
            params.unreadOnly = true;
        } else if (currentFilter !== 'all') {
            params.type = getMappedFilterType(currentFilter);
        }

        // Arama parametresi
        if (currentSearch) {
            params.search = currentSearch;
        }

        // GET /api/v1/notifications
        const raw = await Api.get('/notifications', params);
        let items    = [];
        let pageData = {};

        if (raw?.content) {
            items    = raw.content;
            pageData = raw;
        } else if (Array.isArray(raw)) {
            items    = raw;
            pageData = { totalPages: 1, totalElements: raw.length, number: 0 };
        } else {
            items    = [];
            pageData = { totalPages: 0, totalElements: 0, number: 0 };
        }

        // 🌟 FRONTEND FİLTRE KORUMASI (FALLBACK) 🌟
        // Eğer Spring Boot backend'deki endpoint henüz "type" veya "unreadOnly"
        // parametrelerine göre sorgu filtrelemesi yapmıyorsa, gelen veriyi burada eziyoruz.
        if (currentFilter === 'unread') {
            items = items.filter(n => !n.read);
        } else if (currentFilter !== 'all') {
            const expectedType = getMappedFilterType(currentFilter);
            items = items.filter(n => n.type === expectedType);
        }

        // Arama inputu için frontend filtre koruması
        if (currentSearch) {
            const s = currentSearch.toLowerCase();
            items = items.filter(n =>
                (n.title && n.title.toLowerCase().includes(s)) ||
                (n.message && n.message.toLowerCase().includes(s))
            );
        }

        renderList(items);
        renderPagination(pageData);
        hideSkeleton();
    } catch (err) {
        Toast.error('Bildirimler yüklenemedi: ' + err.message);
        hideSkeleton();
        renderError();
    }
}

async function loadSummary() {
    try {
        // Okunmamış sayısı
        const unread = await Api.get('/notifications/unread-count');
        summaryCache.unread = unread?.count ?? 0;

        // Toplam sayı için tüm bildirimleri çek (küçük bir istek)
        const all = await Api.get('/notifications', { page: 0, size: 1 });
        summaryCache.total = all?.totalElements ?? 0;

        // Completed ve Failed için tip bazlı count — backend'de ayrı endpoint yoksa
        // pagination'dan tahmin ediyoruz; burada ayrı sorgular atılabilir
        const completed = await Api.get('/notifications', { page: 0, size: 1, type: 'EXECUTION_COMPLETED' });
        const failed    = await Api.get('/notifications', { page: 0, size: 1, type: 'EXECUTION_FAILED' });

        summaryCache.completed = completed?.totalElements ?? 0;
        summaryCache.failed    = failed?.totalElements    ?? 0;

        updateSummaryUI();
    } catch (err) {
        console.warn('Summary yüklenemedi:', err.message);
    }
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderList(items) {
    const container = document.getElementById('notif-list');

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="notif-empty">
                <span class="notif-empty-icon">◉</span>
                <div class="notif-empty-title">Bildirim yok</div>
                <p style="font-size:.85rem;">Seçili filtre için bildirim bulunamadı.</p>
            </div>`;
        return;
    }

    container.innerHTML = `<div class="notif-list">
        ${items.map(n => renderNotifItem(n)).join('')}
    </div>`;

    // Satır tıklama — link'e yönlendir + okundu işaretle
    container.querySelectorAll('.notif-item[data-id]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.notif-action-btn')) return;
            handleNotifClick(el.dataset.id, el.dataset.link, el.classList.contains('unread'), el.dataset.type);
        });
    });

    // Okundu butonu
    container.querySelectorAll('[data-action="read"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            markRead(btn.dataset.id, btn.closest('.notif-item'));
        });
    });

    // Sil butonu
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNotif(btn.dataset.id, btn.closest('.notif-item'));
        });
    });
}

function renderNotifItem(n) {
    const { icon, iconClass, label } = typeConfig(n.type);
    const timeStr = Utils.formatDate(n.createdAt);
    const isUnread = !n.read;

    return `
        <div class="notif-item${isUnread ? ' unread' : ''}"
             data-id="${Utils.escHtml(n.publicId)}"
             data-type="${Utils.escHtml(n.type)}"
             data-link="${Utils.escHtml(n.link || '')}">
            <div class="notif-icon ${iconClass}">${icon}</div>
            <div class="notif-content">
                <div class="notif-title">${Utils.escHtml(n.title)}</div>
                <div class="notif-message">${Utils.escHtml(n.message)}</div>
                <div class="notif-meta">
                    <span class="notif-time">${timeStr}</span>
                    ${isUnread ? '<span class="badge badge-primary" style="font-size:.65rem;">Yeni</span>' : ''}
                    ${n.link || n.type ? `<span style="font-size:.7rem;color:var(--clr-primary);font-family:var(--font-ui);">→ ${Utils.escHtml(label)}</span>` : ''}
                </div>
            </div>
            <div class="notif-actions">
                ${isUnread ? `<button class="notif-action-btn" data-action="read" data-id="${Utils.escHtml(n.publicId)}" title="Okundu İşaretle">✓</button>` : ''}
                <button class="notif-action-btn danger" data-action="delete" data-id="${Utils.escHtml(n.publicId)}" title="Sil">✕</button>
            </div>
        </div>`;
}

function renderPagination(pageData) {
    const container = document.getElementById('pagination-container');
    if (!container) return;
    if (!pageData || pageData.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    Pagination.render(container, pageData, (newPage) => {
        currentPage = newPage;
        loadNotifications();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function renderError() {
    document.getElementById('notif-list').innerHTML = `
        <div class="notif-empty">
            <span class="notif-empty-icon">✕</span>
            <div class="notif-empty-title">Yüklenemedi</div>
            <p style="font-size:.85rem;">Bildirimler alınamadı. Sayfayı yenileyin.</p>
            <button class="btn btn-ghost btn-sm" style="margin-top:.75rem;" onclick="location.reload()">Yenile</button>
        </div>`;
}

function hideSkeleton() {
    const sk = document.getElementById('notif-skeleton');
    if (sk) sk.remove();
}

function updateSummaryUI() {
    document.getElementById('sum-total').textContent     = summaryCache.total;
    document.getElementById('sum-unread').textContent    = summaryCache.unread;
    document.getElementById('sum-completed').textContent = summaryCache.completed;
    document.getElementById('sum-failed').textContent    = summaryCache.failed;
}

// ═══════════════════════════════════════════════════════════
// AKSIYONLAR
// ═══════════════════════════════════════════════════════════
async function handleNotifClick(id, link, wasUnread, notifType) {
    if (wasUnread) await markRead(id);

    let resolved = null;

    // Eğer backend'den gelen link varsa onu kullan
    if (link && link !== '' && link !== 'null') {
        resolved = parseNotificationLink(link);
    }
    // Eğer notif tipi tanımlandıysa, tip bazlı yönlendirme yap
    else if (notifType) {
        resolved = resolveNotificationPage(notifType, id);
    }

    if (resolved) {
        window.location.href = resolved;
    }
}

function parseNotificationLink(link) {
    let resolved = link.trim();
    const cleanLink = resolved.startsWith('/') ? resolved.substring(1) : resolved;

    if (cleanLink.includes('/') && !cleanLink.endsWith('.html') && !cleanLink.includes('?')) {
        const parts = cleanLink.split('/');
        if (parts[0] === 'executions' && parts.length >= 2) {
            const id = parts[1];
            return `../pages/execution-detail.html?id=${encodeURIComponent(id)}`;
        }
        else if (parts[0] === 'scenarios' && parts.length >= 2) {
            const id = parts[1];
            return `../pages/scenario-detail.html?id=${encodeURIComponent(id)}`;
        }
    }

    if (resolved.startsWith('/')) {
        resolved = '..' + resolved;
    }
    else if (!resolved.startsWith('../') && !resolved.startsWith('./') && !resolved.startsWith('pages/')) {
        resolved = '../pages/' + resolved;
    }

    return resolved;
}

function resolveNotificationPage(notifType, resourceId) {
    const config = typeConfig(notifType);
    if (!config.page) return null;

    if (config.page === 'execution-detail' || config.page === 'scenario-detail') {
        return `../pages/${config.page}.html?id=${encodeURIComponent(resourceId)}`;
    }

    return `../pages/${config.page}.html`;
}

async function markRead(id, rowEl) {
    try {
        await Api.post(`/notifications/${id}/read`, {});
        if (rowEl) {
            rowEl.classList.remove('unread');
            rowEl.style.removeProperty('background');
            const badge  = rowEl.querySelector('.badge-primary');
            const readBtn = rowEl.querySelector('[data-action="read"]');
            if (badge)   badge.remove();
            if (readBtn) readBtn.remove();
            rowEl.style.borderLeft = 'none';
            rowEl.style.paddingLeft = '1.25rem';
        }
        summaryCache.unread = Math.max(0, summaryCache.unread - 1);
        updateSummaryUI();
        Topbar.updateNotifBadge(summaryCache.unread);
        Sidebar.updateBadge('notif', summaryCache.unread);
    } catch (err) {
        Toast.error('İşaretlenemedi: ' + err.message);
    }
}

async function deleteNotif(id, rowEl) {
    try {
        await Api.del(`/notifications/${id}`);
        if (rowEl) {
            rowEl.style.transition = 'opacity .2s, max-height .25s';
            rowEl.style.opacity = '0';
            rowEl.style.maxHeight = rowEl.offsetHeight + 'px';
            setTimeout(() => {
                rowEl.style.maxHeight = '0';
                rowEl.style.padding = '0';
                rowEl.style.borderBottom = 'none';
                setTimeout(() => rowEl.remove(), 250);
            }, 200);
        }
        summaryCache.total = Math.max(0, summaryCache.total - 1);
        updateSummaryUI();
    } catch (err) {
        Toast.error('Silinemedi: ' + err.message);
    }
}

async function readAll() {
    try {
        await Api.post('/notifications/read-all', {});
        Toast.success('Tüm bildirimler okundu olarak işaretlendi.');
        summaryCache.unread = 0;
        updateSummaryUI();
        Topbar.updateNotifBadge(0);
        Sidebar.updateBadge('notif', 0);
        await loadNotifications();
    } catch (err) {
        Toast.error('İşlem başarısız: ' + err.message);
    }
}

// ═══════════════════════════════════════════════════════════
// FİLTRE VE ARAMA
// ═══════════════════════════════════════════════════════════
function setupFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            currentPage   = 0;
            showLoadingSkeleton();
            loadNotifications();
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('notif-search');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            currentPage = 0;
            showLoadingSkeleton();
            loadNotifications();
        }, 400); // 400ms bekleme süresi
    });
}

function showLoadingSkeleton() {
    const list = document.getElementById('notif-list');
    if (list) {
        list.innerHTML = `<div id="notif-skeleton">
            ${Array(4).fill(0).map(() => `
            <div class="skeleton-notif">
                <div class="skeleton skeleton-circle"></div>
                <div class="skeleton-lines">
                    <div class="skeleton skeleton-line" style="width:50%"></div>
                    <div class="skeleton skeleton-line" style="width:80%"></div>
                </div>
            </div>`).join('')}
        </div>`;
    }
}

// ═══════════════════════════════════════════════════════════
// HEADER BUTONLARI
// ═══════════════════════════════════════════════════════════
function setupHeaderButtons() {
    document.getElementById('btn-read-all')?.addEventListener('click', readAll);
    document.getElementById('btn-prefs')?.addEventListener('click', openPreferencesModal);
}

// ═══════════════════════════════════════════════════════════
// TERCİHLER MODALİ
// ═══════════════════════════════════════════════════════════
async function openPreferencesModal() {
    let prefs = [];
    try {
        prefs = await Api.get('/notifications/preferences');
    } catch (err) {
        Toast.error('Tercihler yüklenemedi: ' + err.message);
        return;
    }

    const prefRows = prefs.map(p => {
        const cfg = typeConfig(p.type);
        const checked = p.enabled ? 'checked' : '';
        const hasInApp  = (p.channels || []).includes('IN_APP');
        const hasEmail  = (p.channels || []).includes('EMAIL');

        return `
            <div class="pref-row" data-type="${Utils.escHtml(p.type)}">
                <div class="pref-label">
                    <div class="pref-icon ${cfg.iconClass}">${cfg.icon}</div>
                    <span>${Utils.escHtml(cfg.displayName)}</span>
                </div>
                <div class="pref-toggle">
                    <div class="pref-channels">
                        <button class="channel-chip ${hasInApp ? 'active' : ''}" data-channel="IN_APP">
                            ◉ Uygulama
                        </button>
                        <button class="channel-chip ${hasEmail ? 'active' : ''}" data-channel="EMAIL">
                            ✉ E-posta
                        </button>
                    </div>
                    <label class="notif-toggle-switch" title="${p.enabled ? 'Aktif' : 'Pasif'}">
                        <input type="checkbox" ${checked} data-pref-type="${Utils.escHtml(p.type)}">
                        <span class="notif-toggle-slider"></span>
                    </label>
                </div>
            </div>`;
    }).join('');

    Modal.open({
        title: 'Bildirim Tercihleri',
        contentHTML: `
            <p style="font-size:.82rem;color:var(--clr-text-muted);margin-bottom:1.25rem;">
                Her bildirim tipi için kanalları ve aktiflik durumunu ayarlayın.
            </p>
            <div style="margin:-1rem 0;">${prefRows}</div>`,
        confirmLabel: 'Kaydet',
        size: 'lg',
        onConfirm: async (backdrop) => {
            await savePreferences(backdrop);
        }
    });

    document.querySelectorAll('.channel-chip').forEach(chip => {
        chip.addEventListener('click', () => chip.classList.toggle('active'));
    });
}

async function savePreferences(backdrop) {
    const rows = backdrop.querySelectorAll('.pref-row[data-type]');
    const saves = [];

    rows.forEach(row => {
        const type    = row.dataset.type;
        const enabled = row.querySelector('input[type="checkbox"]').checked;
        const channels = [...row.querySelectorAll('.channel-chip.active')]
            .map(c => c.dataset.channel);
        saves.push({ type, enabled, channels: channels.length ? channels : ['IN_APP'] });
    });

    let hasError = false;
    for (const pref of saves) {
        try {
            await Api.put('/notifications/preferences', pref);
        } catch (err) {
            console.error('Tercih kaydedilemedi:', pref.type, err.message);
            hasError = true;
        }
    }

    if (hasError) {
        Toast.warning('Bazı tercihler kaydedilemedi.');
    } else {
        Toast.success('Tercihler kaydedildi.');
        Modal.close();
    }
}

// ═══════════════════════════════════════════════════════════
// WEBSOCKET
// ═══════════════════════════════════════════════════════════
function connectWebSocket() {
    const token = Store.getAccessToken();
    if (!token) return;

    try {
        const socket = new SockJS('http://localhost:8080/ws');
        stompClient = Stomp.over(socket);

        stompClient.debug = null;

        stompClient.connect(
            { Authorization: `Bearer ${token}` },
            () => {
                wsConnected = true;
                setWsStatus('connected');

                stompClient.subscribe('/user/queue/notifications', (msg) => {
                    try {
                        const notif = JSON.parse(msg.body);
                        handleIncomingNotification(notif);
                    } catch (e) {
                        console.warn('Bildirim parse hatası', e);
                    }
                });

                stompClient.subscribe('/topic/announcements', (msg) => {
                    try {
                        const ann = JSON.parse(msg.body);
                        Toast.info('Yeni duyuru: ' + ann.title, 6000);
                    } catch (e) {}
                });
            },
            (err) => {
                wsConnected = false;
                setWsStatus('disconnected');
                console.warn('WebSocket bağlantı hatası:', err);
                setTimeout(connectWebSocket, 10_000);
            }
        );
    } catch (e) {
        setWsStatus('disconnected');
    }
}

function handleIncomingNotification(notif) {
    summaryCache.unread++;
    summaryCache.total++;
    updateSummaryUI();
    Topbar.updateNotifBadge(summaryCache.unread);
    Sidebar.updateBadge('notif', summaryCache.unread);

    const cfg = typeConfig(notif.type);
    Toast.info(`${cfg.icon} ${notif.title}: ${notif.message}`, 5000);

    const mappedFilter = getMappedFilterType(currentFilter);
    const shouldShow = currentFilter === 'all'
        || currentFilter === 'unread'
        || mappedFilter === notif.type;

    if (shouldShow && currentPage === 0 && !currentSearch) { // Eğer arama yapılıyorsa websocket yeni bildirim listesini hemen ezmesin
        const listEl = document.querySelector('.notif-list');
        if (listEl) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderNotifItem({ ...notif, read: false });
            const newItem = tempDiv.firstElementChild;
            newItem.style.opacity = '0';
            newItem.style.transform = 'translateX(-8px)';
            newItem.style.transition = 'opacity .25s ease, transform .25s ease';
            listEl.prepend(newItem);
            requestAnimationFrame(() => {
                newItem.style.opacity = '1';
                newItem.style.transform = 'none';
            });

            newItem.addEventListener('click', (e) => {
                if (e.target.closest('.notif-action-btn')) return;
                handleNotifClick(newItem.dataset.id, newItem.dataset.link, true, newItem.dataset.type);
            });
            newItem.querySelector('[data-action="read"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                markRead(newItem.dataset.id, newItem);
            });
            newItem.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNotif(newItem.dataset.id, newItem);
            });
        }
    }
}

function setWsStatus(status) {
    const dot   = document.getElementById('ws-dot');
    const label = document.getElementById('ws-label');
    if (!dot || !label) return;

    if (status === 'connected') {
        dot.className   = 'ws-dot';
        label.textContent = 'Canlı';
    } else {
        dot.className   = 'ws-dot disconnected';
        label.textContent = 'Çevrimdışı';
    }
}

// ═══════════════════════════════════════════════════════════
// YARDIMCI — Bildirim Tipi ve Filtre Konfigürasyonu
// ═══════════════════════════════════════════════════════════

function getMappedFilterType(filter) {
    const map = {
        'completed': 'EXECUTION_COMPLETED',
        'tamamlandi': 'EXECUTION_COMPLETED',
        'tamamlandı': 'EXECUTION_COMPLETED',
        'failed': 'EXECUTION_FAILED',
        'basarisiz': 'EXECUTION_FAILED',
        'başarısız': 'EXECUTION_FAILED',
        'announcements': 'ADMIN_ANNOUNCEMENT',
        'duyurular': 'ADMIN_ANNOUNCEMENT',
        'messages': 'NEW_MESSAGE',
        'mesajlar': 'NEW_MESSAGE'
    };
    return map[filter.toLowerCase()] || filter;
}

function typeConfig(type) {
    const map = {
        EXECUTION_COMPLETED: {
            icon: '✓', iconClass: 'notif-icon-completed',
            displayName: 'Çalıştırma Tamamlandı', label: 'Detaya git',
            page: 'execution-detail'
        },
        EXECUTION_FAILED: {
            icon: '✗', iconClass: 'notif-icon-failed',
            displayName: 'Çalıştırma Başarısız', label: 'Hatayı gör',
            page: 'execution-detail'
        },
        ADMIN_ANNOUNCEMENT: {
            icon: '◎', iconClass: 'notif-icon-announce',
            displayName: 'Admin Duyurusu', label: 'Duyuruya git',
            page: 'announcements'
        },
        NEW_MESSAGE: {
            icon: '◈', iconClass: 'notif-icon-message',
            displayName: 'Yeni Mesaj', label: 'Sohbete git',
            page: 'chat'
        },
        SCHEDULE_TRIGGERED: {
            icon: '◷', iconClass: 'notif-icon-schedule',
            displayName: 'Zamanlı Görev', label: 'Çalıştırmaya git',
            page: 'execution-detail'
        },
        SCENARIO_SHARED: {
            icon: '◫', iconClass: 'notif-icon-share',
            displayName: 'Senaryo Paylaşıldı', label: 'Senaryoya git',
            page: 'scenario-detail'
        },
    };
    return map[type] ?? {
        icon: 'ℹ', iconClass: 'notif-icon-announce',
        displayName: type || 'Bildirim', label: 'Git',
        page: null
    };
}

window.addEventListener('beforeunload', () => {
    if (stompClient?.connected) {
        stompClient.disconnect();
    }
});