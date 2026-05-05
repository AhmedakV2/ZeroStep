// Faz F6 — Çalıştırmalar Listesi
let currentPage = 0;
const pageSize = 20;

// ═══════════════════════════════════════════════════════════ INITIALIZATION
async function init() {
    // Auth guard
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    // Layout bileşenlerini render et
    try {
        Sidebar.render('sidebar');
        Topbar.render('topbar', 'Çalıştırmalar');
    } catch (e) {
        console.warn("UI render hatası:", e);
    }

    setupEventListeners();
    await loadExecutions();
}

// DOM hazır olduğunda init çalıştır
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function setupEventListeners() {
    const searchInput = document.getElementById('filter-scenario');
    const statusFilter = document.getElementById('filter-status');
    const btnFilter = document.getElementById('btn-filter');
    const fromFilter = document.getElementById('filter-from');
    const toFilter = document.getElementById('filter-to');

    // Senaryo arama (Debounce ile)
    if (searchInput && typeof Utils.debounce === 'function') {
        searchInput.addEventListener('input', Utils.debounce(() => {
            currentPage = 0;
            loadExecutions();
        }, 300));
    } else if (searchInput) {
        searchInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') { currentPage = 0; loadExecutions(); }
        });
    }

    // Statüs değiştiğinde otomatik filtrele
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            currentPage = 0;
            loadExecutions();
        });
    }

    // Filtrele Butonu
    if (btnFilter) {
        btnFilter.addEventListener('click', () => {
            currentPage = 0;
            loadExecutions();
        });
    }

    // Tarih alanlarında Enter'a basılınca filtrele
    [fromFilter, toFilter].forEach(el => {
        if (el) {
            el.addEventListener('keypress', e => {
                if (e.key === 'Enter') { currentPage = 0; loadExecutions(); }
            });
        }
    });
}

// ═══════════════════════════════════════════════════════════ LOAD & RENDER
async function loadExecutions() {
    const tbody = document.getElementById('executions-tbody');

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8"><span class="mini-spinner" style="margin-right: 8px;"></span> Veriler yükleniyor...</td></tr>`;
    }

    try {
        const params = buildCleanParams();
        const response = await Api.get('/reports', params);

        // Spring Data ApiResponse ve Pagination veri kontrolü
        const data = (response && response.data && response.data.content !== undefined)
            ? response.data
            : (response || {});

        const items = data.content || (Array.isArray(data) ? data : []);

        renderTable(items);

        // Ortak Pagination bileşeni varsa kullan, yoksa fallback render yap
        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
            if (typeof Pagination !== 'undefined' && Pagination.render) {
                Pagination.render(paginationContainer, data, (newPage) => {
                    currentPage = newPage;
                    loadExecutions();
                });
            } else {
                renderFallbackPagination(data);
            }
        }
    } catch (err) {
        if (typeof Toast !== 'undefined') Toast.error("Çalıştırmalar yüklenemedi: " + (err.message || "Bilinmeyen hata"));
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-danger">Veriler yüklenemedi.</td></tr>`;
        }
    }
}

function buildCleanParams() {
    const params = {
        page: currentPage,
        size: pageSize,
        sort: 'startedAt,desc' // Veritabanı JPA sorgu hatasını önlemek için id yerine startedAt
    };

    const scenarioEl = document.getElementById('filter-scenario');
    const statusEl = document.getElementById('filter-status');
    const fromEl = document.getElementById('filter-from');
    const toEl = document.getElementById('filter-to');

    if (scenarioEl && scenarioEl.value.trim() !== '') {
        params.scenarioName = scenarioEl.value.trim();
    }
    if (statusEl && statusEl.value && statusEl.value !== 'Tümü') {
        params.status = statusEl.value;
    }

    if (fromEl && fromEl.value) {
        const dt = new Date(fromEl.value);
        if (!isNaN(dt.getTime())) params.fromDate = dt.toISOString();
    }
    if (toEl && toEl.value) {
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
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8" style="color: var(--clr-text-muted);">Kayıt bulunamadı.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const status = item.status || 'QUEUED';
        const statusClass = `badge-${status.toLowerCase()}`;
        const spinner = (status === 'QUEUED' || status === 'RUNNING')
            ? '<span class="mini-spinner" style="margin-right: 0.3rem;"></span>'
            : '';

        const id = item.executionPublicId || item.publicId || '';
        const owner = item.ownerUsername || item.createdBy || item.username || '—';
        const startedAt = item.startedAt ? new Date(item.startedAt).toLocaleString('tr-TR') : '—';
        const duration = item.durationMs ? (item.durationMs / 1000).toFixed(2) + 's' : '—';

        return `
            <tr onclick="window.location.href='execution-detail.html?id=${Utils.escHtml(id)}'" style="cursor: pointer;">
                <td>${Utils.escHtml(item.scenarioName || '—')}</td>
                <td><span class="badge badge-status ${statusClass}">${spinner}${Utils.escHtml(status)}</span></td>
                <td style="font-size: 0.85rem; color: var(--clr-text-muted);">${Utils.escHtml(owner)}</td>
                <td style="font-size: 0.82rem;">${startedAt}</td>
                <td style="font-size: 0.82rem;">${duration}</td>
                <td style="font-size: 0.82rem;">${item.passedSteps || 0}/${item.totalSteps || 0}</td>
                <td class="text-right"><a href="execution-detail.html?id=${Utils.escHtml(id)}" class="btn-link" onclick="event.stopPropagation();">Detay</a></td>
            </tr>
        `;
    }).join('');
}

// Global Pagination Component bulunmadığı durumlar için Fallback yedek fonksiyon
function renderFallbackPagination(data) {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    if (!data || data.totalPages === undefined || data.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const html = `
        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; align-items: center;">
            <button ${currentPage === 0 ? 'disabled' : ''} onclick="currentPage--; loadExecutions();" class="btn btn-ghost btn-sm">← Önceki</button>
            <span style="font-size: 0.85rem; color: var(--clr-text-muted);">Sayfa ${currentPage + 1} / ${data.totalPages}</span>
            <button ${currentPage >= data.totalPages - 1 ? 'disabled' : ''} onclick="currentPage++; loadExecutions();" class="btn btn-ghost btn-sm">Sonraki →</button>
        </div>
    `;
    container.innerHTML = html;
}