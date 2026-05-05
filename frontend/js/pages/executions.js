// Çalıştırmalar Listesi
let currentPage = 0;
const pageSize  = 20;

async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    try {
        Sidebar.render('sidebar');
        Topbar.render('topbar', 'Çalıştırmalar');
    } catch (e) {
        console.warn('UI render hatası:', e);
    }

    setupEventListeners();
    await loadExecutions();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function setupEventListeners() {
    const searchInput  = document.getElementById('filter-scenario');
    const statusFilter = document.getElementById('filter-status');
    const btnFilter    = document.getElementById('btn-filter');
    const fromFilter   = document.getElementById('filter-from');
    const toFilter     = document.getElementById('filter-to');

    if (searchInput) {
        const debouncedSearch = typeof Utils.debounce === 'function'
            ? Utils.debounce(() => { currentPage = 0; loadExecutions(); }, 350)
            : () => { currentPage = 0; loadExecutions(); };
        searchInput.addEventListener('input', debouncedSearch);
    }

    statusFilter?.addEventListener('change', () => { currentPage = 0; loadExecutions(); });
    btnFilter?.addEventListener('click', () => { currentPage = 0; loadExecutions(); });

    [fromFilter, toFilter].forEach(el => {
        el?.addEventListener('change', () => { currentPage = 0; loadExecutions(); });
    });
}

// ─── Veri Yükleme ─────────────────────────────────────────────
async function loadExecutions() {
    const tbody = document.getElementById('executions-tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:2rem;text-align:center;color:var(--clr-text-muted);">
            <span class="mini-spinner" style="margin-right:8px;"></span> Yükleniyor...
        </td></tr>`;
    }

    try {
        const params = buildCleanParams();
        // GET /api/v1/reports → ApiResponse<Page<ReportListItemDto>>
        const raw = await Api.get('/reports', params);

        // api.js zaten .data unwrap ediyor;
        // raw = Page<ReportListItemDto> { content, totalPages, totalElements, number, size }
        let pageData = {};
        let items    = [];

        if (raw?.content) {
            // Direkt Page objesi
            pageData = raw;
            items    = raw.content;
        } else if (Array.isArray(raw)) {
            items    = raw;
            pageData = { content: raw, totalPages: 1, totalElements: raw.length, number: 0 };
        } else {
            // Beklenmedik format
            console.warn('Beklenmedik API response formatı:', raw);
            items    = [];
            pageData = { content: [], totalPages: 0, totalElements: 0, number: 0 };
        }

        renderTable(items);

        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
            if (typeof Pagination !== 'undefined' && Pagination.render) {
                Pagination.render(paginationContainer, pageData, (newPage) => {
                    currentPage = newPage;
                    loadExecutions();
                });
            } else {
                renderFallbackPagination(pageData);
            }
        }
    } catch (err) {
        Toast.error('Çalıştırmalar yüklenemedi: ' + (err.message || 'Bilinmeyen hata'));
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding:2rem;text-align:center;color:var(--clr-danger);">
                Veriler yüklenemedi.
            </td></tr>`;
        }
    }
}

function buildCleanParams() {
    // Backend: sort=startedAt,desc (id yerine; JPA için güvenli)
    const params = {
        page: currentPage,
        size: pageSize,
        sort: 'startedAt,desc',
    };

    const scenarioEl = document.getElementById('filter-scenario');
    const statusEl   = document.getElementById('filter-status');
    const fromEl     = document.getElementById('filter-from');
    const toEl       = document.getElementById('filter-to');

    if (scenarioEl?.value?.trim()) {
        params.scenarioName = scenarioEl.value.trim();
    }
    if (statusEl?.value && statusEl.value !== '' && statusEl.value !== 'Tümü') {
        params.status = statusEl.value;
    }
    if (fromEl?.value) {
        const dt = new Date(fromEl.value);
        if (!isNaN(dt.getTime())) params.fromDate = dt.toISOString();
    }
    if (toEl?.value) {
        const dt = new Date(toEl.value);
        if (!isNaN(dt.getTime())) {
            dt.setHours(23, 59, 59, 999);
            params.toDate = dt.toISOString();
        }
    }

    return params;
}

function renderTable(items) {
    const tbody = document.getElementById('executions-tbody');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">
            <div class="empty-state">
                <span class="empty-state-icon">▶</span>
                <p class="empty-state-msg">Kayıt bulunamadı</p>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const execId = item.executionPublicId || item.publicId || '';
        return `
            <tr style="cursor:pointer" data-id="${Utils.escHtml(execId)}">
                <td>${Utils.escHtml(item.scenarioName ?? '—')}</td>
                <td>${statusBadge(item.status)}</td>
                <td>${Utils.formatDuration(item.durationMs)}</td>
                <td>${item.totalSteps ?? 0} adım (${item.passedSteps ?? 0} geçti)</td>
                <td>${Utils.formatDate(item.startedAt)}</td>
            </tr>`;
    }).join('');

    // Satır tıklama → execution detay
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('click', () => {
            window.location.href = `execution-detail.html?id=${row.dataset.id}`;
        });
    });
}

function renderFallbackPagination(data) {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    if (!data || !data.totalPages || data.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="display:flex;gap:1rem;justify-content:center;margin-top:1.5rem;align-items:center;">
            <button ${currentPage === 0 ? 'disabled' : ''}
                onclick="currentPage--; loadExecutions();"
                class="btn btn-ghost btn-sm">← Önceki</button>
            <span style="font-size:.85rem;color:var(--clr-text-muted);">
                Sayfa ${currentPage + 1} / ${data.totalPages}
                (${data.totalElements ?? '?'} kayıt)
            </span>
            <button ${currentPage >= data.totalPages - 1 ? 'disabled' : ''}
                onclick="currentPage++; loadExecutions();"
                class="btn btn-ghost btn-sm">Sonraki →</button>
        </div>`;
}

// ── Yardımcı fonksiyonlar ────────────────────────────────────
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
