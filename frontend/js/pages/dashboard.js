// Dashboard sayfası — stat kartları, son çalıştırmalar, bildirimler
(async function () {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Dashboard');

    // Paralel veri çek
    await Promise.allSettled([
        loadStats(),
        loadRecentExecutions(),
        loadRecentNotifications() // Eger bu fonksiyon baska dosyada ise sorunsuz çalışmaya devam eder
    ]);

    // Fare hareketiyle arka plan ışıklarını (orbları) hareket ettirme (Parallax)
    initParallaxOrbs();
})();

// ── Stat Kartları ─────────────────────────────────────────────
async function loadStats() {
    try {
        const rawExecs = await Api.get('/reports', { size: 100 });
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
        const raw = await Api.get('/reports', { size: 10 });
        let items = [];

        if (raw?.content) items = raw.content;
        else if (Array.isArray(raw)) items = raw;
        else if (raw?.data?.content) items = raw.data.content;

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="5">
                    <div class="empty-state">
                        <span class="empty-state-icon">▶</span>
                        <p class="empty-state-title" style="color:white; margin-top:10px;">Henüz çalıştırma yok</p>
                        <p class="empty-state-msg" style="color:#a3a3a3;">Senaryo oluşturup çalıştırın.</p>
                    </div>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(exec => {
            const execId = exec.executionPublicId || exec.publicId || exec.id || '';
            if (!execId) console.warn('[dashboard] Execution ID bulunamadı, exec:', exec);

            return `
                <tr style="cursor:pointer;${!execId ? 'opacity:0.5' : ''}" data-id="${Utils.escHtml(execId)}">
                    <td style="font-weight:500;">${Utils.escHtml(exec.scenarioName ?? '—')}</td>
                    <td>${statusBadge(exec.status)}</td>
                    <td class="font-mono">${Utils.formatDuration(exec.durationMs)}</td>
                    <td class="font-mono">${exec.totalSteps ?? 0} adım (${exec.passedSteps ?? 0} geçti)</td>
                    <td class="font-mono" style="color:#a3a3a3;">${Utils.formatDate(exec.startedAt)}</td>
                </tr>`;
        }).join('');

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
        tbody.innerHTML = `<tr><td colspan="5" style="padding:1.5rem; text-align:center; color:#ff4d4d;">
            Veriler yüklenemedi: ${Utils.escHtml(err.message)}
        </td></tr>`;
    }
}

// ── Bildirimler Yedeği (Eğer varsa) ────────────────────────────
async function loadRecentNotifications() {
    // Eger loadRecentNotifications baska bir dosyada tanımlı değilse hata vermemesi için boş tanımlandı.
    // Projende varsa bu kısmı silebilir veya içeriğini doldurabilirsin.
}

// ── Yardımcı fonksiyonlar ──────────────────────────────────────
function statusBadge(status) {
    const map = {
        COMPLETED: 'badge-success',
        FAILED:    'badge-danger',
        CANCELLED: 'badge-warning',
        TIMEOUT:   'badge-warning',
        RUNNING:   'badge-primary',
        QUEUED:    'badge-primary',
        PENDING:   'badge-primary',
    };
    const cls = map[status] ?? 'badge-primary';
    const labels = {
        COMPLETED: 'Tamamlandı', FAILED: 'Başarısız', CANCELLED: 'İptal Edildi',
        TIMEOUT: 'Zaman Aşımı', RUNNING: 'Çalışıyor', QUEUED: 'Kuyrukta', PENDING: 'Beklemede',
    };
    const displayLabel = labels[status] ?? (status || 'Bilinmiyor');
    return `<span class="badge ${cls}">${displayLabel}</span>`;
}

// ── Parallax Etkileşimi (Mouse Takibi) ─────────────────────────
function initParallaxOrbs() {
    const orbWraps = [
        document.getElementById('orb1-wrap'),
        document.getElementById('orb2-wrap'),
        document.getElementById('orb3-wrap')
    ];

    document.addEventListener('mousemove', (e) => {
        orbWraps.forEach((wrap, index) => {
            if(!wrap) return;
            // Dashboard'da göz yormaması için farenin etkisini bölen sayıyı 30 yaptık (daha yavaş ve narin hareket)
            const factor = (index + 1) * 30;
            wrap.style.transform = `translate(${e.pageX / factor}px, ${e.pageY / factor}px)`;
        });
    });
}