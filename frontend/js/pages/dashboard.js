// Dashboard sayfası — stat kartları, son çalıştırmalar, bildirimler
(async function () {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Dashboard');

    // Paralel veri çek
    await Promise.allSettled([
        loadStats(),
        loadRecentExecutions(),
        loadRecentNotifications(),
    ]);
})();

// ── Stat Kartları ─────────────────────────────────────────────
async function loadStats() {
    try {
        // GET /api/v1/reports?size=100 → ApiResponse<Page<ReportListItemDto>>
        const rawExecs = await Api.get('/reports', { size: 100 });
        // api.js .data'yı unwrap ediyor; Page.content'e eriş
        let items = [];
        let totalElements = 0;

        if (rawExecs?.content) {
            items = rawExecs.content;
            totalElements = rawExecs.totalElements ?? items.length;
        } else if (Array.isArray(rawExecs)) {
            items = rawExecs;
            totalElements = items.length;
        } else if (rawExecs?.data?.content) {
            items = rawExecs.data.content;
            totalElements = rawExecs.data.totalElements ?? items.length;
        }

        const passed  = items.filter(e => e.status === 'COMPLETED').length;
        const failed  = items.filter(e => e.status === 'FAILED' || e.status === 'TIMEOUT').length;

        document.getElementById('stat-total').textContent  = totalElements;
        document.getElementById('stat-passed').textContent = passed;
        document.getElementById('stat-failed').textContent = failed;

        // Schedule sayısı — ayrı istek
        try {
            const rawSched = await Api.get('/schedules', { size: 100 });
            let schedItems = [];
            if (rawSched?.content) schedItems = rawSched.content;
            else if (Array.isArray(rawSched)) schedItems = rawSched;
            else if (rawSched?.data?.content) schedItems = rawSched.data.content;
            const activeSchedules = schedItems.filter(s => s.enabled).length;
            document.getElementById('stat-schedule').textContent = activeSchedules;
        } catch {
            document.getElementById('stat-schedule').textContent = '—';
        }

    } catch (err) {
        console.error('Stat yüklenemedi:', err);
        ['stat-total','stat-passed','stat-failed','stat-schedule'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
    }
}

// ── Son Çalıştırmalar ──────────────────────────────────────────
async function loadRecentExecutions() {
    const tbody = document.getElementById('executions-body');

    try {
        // GET /api/v1/reports?size=50 - sort=startedAt,desc
        const raw = await Api.get('/reports', {
            size: 50,
            sort: 'startedAt,desc'
        });
        let items = [];

        if (raw?.content) items = raw.content;
        else if (Array.isArray(raw)) items = raw;
        else if (raw?.data?.content) items = raw.data.content;


        if (items.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="5">
                    <div class="empty-state">
                        <span class="empty-state-icon">▶</span>
                        <p class="empty-state-title">Henüz çalıştırma yok</p>
                        <p class="empty-state-msg">Senaryo oluşturup çalıştırın.</p>
                    </div>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(exec => {
            // ReportListItemDto field isimleri: executionPublicId, scenarioName, status, durationMs, startedAt, passedSteps, totalSteps
            const execId = exec.executionPublicId || exec.publicId || exec.id || '';
            if (!execId) {
                console.warn('[dashboard] Execution ID bulunamadı, exec:', exec);
            }
            return `
                <tr style="cursor:pointer;${!execId ? 'opacity:0.5' : ''}" data-id="${Utils.escHtml(execId)}">
                    <td>${Utils.escHtml(exec.scenarioName ?? '—')}</td>
                    <td>${statusBadge(exec.status)}</td>
                    <td>${Utils.formatDuration(exec.durationMs)}</td>
                    <td>${exec.totalSteps ?? 0} adım (${exec.passedSteps ?? 0} geçti)</td>
                    <td>${Utils.formatDate(exec.startedAt)}</td>
                </tr>`;
        }).join('');

        // Satır tıklama → execution detay
        tbody.querySelectorAll('tr[data-id]').forEach(row => {
            if (!row.dataset.id) {
                row.style.cursor = 'default';
                row.addEventListener('click', (e) => {
                    e.preventDefault();
                    Toast.error('Çalıştırma ID\'si bulunamadı. Sayfayı yenileyin.');
                });
            } else {
                row.addEventListener('click', () => {
                    window.location.href = `execution-detail.html?id=${encodeURIComponent(row.dataset.id)}`;
                });
            }
        });

    } catch (err) {
        console.error('Son çalıştırmalar yüklenemedi:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="padding:1rem">
            Veriler yüklenemedi: ${Utils.escHtml(err.message)}
        </td></tr>`;
    }
}

// ── Son Bildirimler ────────────────────────────────────────────
async function loadRecentNotifications() {
    const container = document.getElementById('notifications-list');

    try {
        // GET /api/v1/notifications?size=5
        const raw = await Api.get('/notifications', { size: 5 });
        let items = [];

        if (raw?.content) items = raw.content;
        else if (Array.isArray(raw)) items = raw;
        else if (raw?.data?.content) items = raw.data.content;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">◉</span>
                    <p class="empty-state-msg">Okunmamış bildirim yok.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <ul style="list-style:none;padding:0;margin:0">
                ${items.map(n => `
                    <li style="
                        display:flex;gap:.75rem;align-items:flex-start;
                        padding:.75rem 1.25rem;
                        border-bottom:1px solid var(--clr-border);
                        ${!n.read ? 'background:rgba(61,122,237,.05)' : ''}
                    ">
                        <span style="font-size:1.1rem;opacity:.6">${notifIcon(n.type)}</span>
                        <div style="flex:1;min-width:0">
                            <div style="font-size:.88rem;font-weight:${n.read ? 400 : 600};color:var(--clr-text);">
                                ${Utils.escHtml(n.title)}
                            </div>
                            <div style="font-size:.8rem;color:var(--clr-text-muted);margin-top:2px;">
                                ${Utils.escHtml(n.message)}
                            </div>
                            <div style="font-size:.75rem;color:var(--clr-text-muted);margin-top:4px;">
                                ${Utils.formatDate(n.createdAt)}
                            </div>
                        </div>
                        ${!n.read ? '<span class="badge badge-primary" style="flex-shrink:0">Yeni</span>' : ''}
                    </li>`).join('')}
            </ul>`;
    } catch (err) {
        console.error('Bildirimler yüklenemedi:', err);
        container.innerHTML = `<div class="empty-state">
            <p class="empty-state-msg">Bildirimler yüklenemedi.</p>
        </div>`;
    }
}

// ── Hızlı Senaryo Oluştur Modal ───────────────────────────────
// Fonksiyon kaldırıldı

// ── Yardımcı fonksiyonlar ──────────────────────────────────────
function statusBadge(status) {
    const map = {
        COMPLETED: 'badge-success',
        FAILED:    'badge-danger',
        CANCELLED: 'badge-neutral',
        TIMEOUT:   'badge-warning',
        RUNNING:   'badge-primary',
        QUEUED:    'badge-neutral',
        PENDING:   'badge-neutral',
    };
    const cls = map[status] ?? 'badge-neutral';
    const labels = {
        COMPLETED: 'Tamamlandı',
        FAILED: 'Başarısız',
        CANCELLED: 'İptal Edildi',
        TIMEOUT: 'Zaman Aşımı',
        RUNNING: 'Çalışıyor',
        QUEUED: 'Kuyrukta',
        PENDING: 'Beklemede',
    };
    const displayLabel = labels[status] ?? (status || 'Bilinmiyor');
    return `<span class="badge ${cls}">${displayLabel}</span>`;
}

function notifIcon(type) {
    const icons = {
        EXECUTION_COMPLETED: '✓',
        EXECUTION_FAILED:    '✕',
        ADMIN_ANNOUNCEMENT:  '◎',
        NEW_MESSAGE:         '◈',
        SCHEDULE_TRIGGERED:  '◷',
        SCENARIO_SHARED:     '◫',
    };
    return icons[type] ?? 'ℹ';
}