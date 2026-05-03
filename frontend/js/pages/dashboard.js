// Dashboard sayfası — stat kartları, son çalıştırmalar, bildirimler
(async function () {
    // Auth guard
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    // Layout bileşenlerini render et
    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Dashboard');

    // Paralel veri çek
    await Promise.allSettled([
        loadStats(),
        loadRecentExecutions(),
        loadRecentNotifications(),
    ]);

    // Hızlı senaryo oluştur butonu
    document.getElementById('quick-create-btn')?.addEventListener('click', openCreateModal);
})();

// ── Stat Kartları ─────────────────────────────────────────────
async function loadStats() {
    try {
        // Raporlar endpoint'inden toplam/başarılı/başarısız
        const [reportsData, schedulesData] = await Promise.allSettled([
            Api.get('/reports', { size: 1 }),
            Api.get('/schedules', { size: 100 }),
        ]);

        // Tüm execution istatistiklerini hesapla (son 100 kayıt üzerinden özet)
        const allExecs = await Api.get('/reports', { size: 100 });
        const items = allExecs?.content ?? [];

        const total   = allExecs?.totalElements ?? items.length;
        const passed  = items.filter(e => e.status === 'COMPLETED').length;
        const failed  = items.filter(e => e.status === 'FAILED' || e.status === 'TIMEOUT').length;

        // Aktif schedule sayısı
        let activeSchedules = 0;
        if (schedulesData.status === 'fulfilled') {
            const sData = schedulesData.value;
            const sItems = sData?.content ?? [];
            activeSchedules = sItems.filter(s => s.enabled).length;
        }

        document.getElementById('stat-total').textContent    = total;
        document.getElementById('stat-passed').textContent   = passed;
        document.getElementById('stat-failed').textContent   = failed;
        document.getElementById('stat-schedule').textContent = activeSchedules;
    } catch (err) {
        console.error('Stat yüklenemedi:', err);
    }
}

// ── Son Çalıştırmalar ──────────────────────────────────────────
async function loadRecentExecutions() {
    const tbody = document.getElementById('executions-body');
    const wrapper = document.getElementById('executions-table-wrapper');

    try {
        const data = await Api.get('/reports', { size: 10 });
        const items = data?.content ?? [];

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

        tbody.innerHTML = items.map(exec => `
            <tr style="cursor:pointer" data-id="${Utils.escHtml(exec.executionPublicId)}">
                <td>${Utils.escHtml(exec.scenarioName ?? '—')}</td>
                <td>${statusBadge(exec.status)}</td>
                <td>${Utils.formatDuration(exec.durationMs)}</td>
                <td>${exec.totalSteps ?? 0} adım (${exec.passedSteps ?? 0} geçti)</td>
                <td>${Utils.formatDate(exec.startedAt)}</td>
            </tr>`).join('');

        // Satır tıklama → execution detay
        tbody.querySelectorAll('tr[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                window.location.href = `execution-detail.html?id=${row.dataset.id}`;
            });
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="padding:1rem">Veriler yüklenemedi.</td></tr>`;
    }
}

// ── Son Bildirimler ────────────────────────────────────────────
async function loadRecentNotifications() {
    const container = document.getElementById('notifications-list');

    try {
        const data = await Api.get('/notifications', { size: 5 });
        const items = data?.content ?? [];

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
                            <div style="font-size:.88rem;font-weight:${n.read ? 400 : 600};color:var(--clr-text)">
                                ${Utils.escHtml(n.title)}
                            </div>
                            <div style="font-size:.8rem;color:var(--clr-text-muted);margin-top:2px">
                                ${Utils.escHtml(n.message)}
                            </div>
                            <div style="font-size:.75rem;color:var(--clr-text-muted);margin-top:4px">
                                ${Utils.formatDate(n.createdAt)}
                            </div>
                        </div>
                        ${!n.read ? '<span class="badge badge-primary" style="flex-shrink:0">Yeni</span>' : ''}
                    </li>`).join('')}
            </ul>`;
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p class="empty-state-msg">Bildirimler yüklenemedi.</p></div>`;
    }
}

// ── Hızlı Senaryo Oluştur Modal ───────────────────────────────
function openCreateModal() {
    Modal.open({
        title: 'Yeni Senaryo Oluştur',
        contentHTML: `
            <div style="display:flex;flex-direction:column;gap:1rem">
                <div class="form-group">
                    <label class="form-label" for="qs-name">Senaryo Adı *</label>
                    <input class="form-input" type="text" id="qs-name" placeholder="Örn: Kullanıcı Giriş Testi" maxlength="255">
                    <span class="form-error" id="qs-name-error"></span>
                </div>
                <div class="form-group">
                    <label class="form-label" for="qs-url">Base URL</label>
                    <input class="form-input" type="url" id="qs-url" placeholder="https://example.com">
                    <span class="form-error" id="qs-url-error"></span>
                </div>
                <div id="qs-error" class="alert alert-danger hidden"></div>
            </div>`,
        confirmLabel: 'Oluştur',
        onConfirm: createScenario,
    });

    // Odaklan
    setTimeout(() => document.getElementById('qs-name')?.focus(), 60);
}

async function createScenario(modalEl) {
    const name    = (document.getElementById('qs-name')?.value ?? '').trim();
    const baseUrl = (document.getElementById('qs-url')?.value ?? '').trim();
    const errEl   = document.getElementById('qs-error');

    // Client-side validasyon
    document.getElementById('qs-name-error').textContent = '';
    document.getElementById('qs-url-error').textContent  = '';
    errEl.classList.add('hidden');

    if (Utils.isBlank(name)) {
        document.getElementById('qs-name-error').textContent = 'Senaryo adı zorunlu';
        document.getElementById('qs-name').classList.add('is-error');
        throw new Error('validation'); // Modal butonu disabled kalır
    }

    try {
        const created = await Api.post('/scenarios', {
            name,
            baseUrl: baseUrl || undefined,
        });
        Modal.close();
        Toast.success(`"${created.name}" senaryosu oluşturuldu.`);
        // Senaryo detayına yönlendir
        window.location.href = `scenario-detail.html?id=${created.publicId}`;
    } catch (err) {
        if (err instanceof ApiError) {
            // Field error varsa ilgili alana bağla
            if (err.fieldErrors?.name) {
                document.getElementById('qs-name-error').textContent = err.fieldErrors.name;
                document.getElementById('qs-name').classList.add('is-error');
            } else {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        } else if (err.message !== 'validation') {
            errEl.textContent = 'Senaryo oluşturulamadı. Tekrar deneyin.';
            errEl.classList.remove('hidden');
        }
        throw err; // Butonu disabled'dan kurtar
    }
}

// ── Yardımcı fonksiyonlar ──────────────────────────────────────
function statusBadge(status) {
    const map = {
        COMPLETED: 'badge-success',
        FAILED:    'badge-danger',
        CANCELLED: 'badge-neutral',
        TIMEOUT:   'badge-warning',
        RUNNING:   'badge-primary',
        QUEUED:    'badge-neutral',
    };
    const cls = map[status] ?? 'badge-neutral';
    const labels = {
        COMPLETED: 'Tamamlandı', FAILED: 'Başarısız', CANCELLED: 'İptal',
        TIMEOUT: 'Zaman Aşımı', RUNNING: 'Çalışıyor', QUEUED: 'Kuyrukta',
    };
    return `<span class="badge ${cls}">${labels[status] ?? status}</span>`;
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