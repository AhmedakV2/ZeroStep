// Execution listesi: filtreleme, pagination, detay yönlendirme
let currentPage = 0;
const PAGE_SIZE = 20;

(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Çalıştırmalar');

    setupFilters();
    await loadExecutions();
})();

function setupFilters() {
    const search  = document.getElementById('filter-search');
    const status  = document.getElementById('filter-status');
    const from    = document.getElementById('filter-from');
    const to      = document.getElementById('filter-to');
    const clearBtn = document.getElementById('btn-clear-filters');

    // Debounce'lu arama
    search.addEventListener('input', Utils.debounce(() => {
        currentPage = 0;
        loadExecutions();
    }, 300));

    [status, from, to].forEach(el => {
        el.addEventListener('change', () => { currentPage = 0; loadExecutions(); });
    });

    clearBtn.addEventListener('click', () => {
        search.value = '';
        status.value = '';
        from.value   = '';
        to.value     = '';
        currentPage  = 0;
        loadExecutions();
    });
}

async function loadExecutions() {
    const tbody   = document.getElementById('executions-body');
    const search  = document.getElementById('filter-search').value.trim();
    const status  = document.getElementById('filter-status').value;
    const from    = document.getElementById('filter-from').value;
    const to      = document.getElementById('filter-to').value;

    tbody.innerHTML = `<tr><td colspan="7">
        <div class="empty-state"><span class="spinner" style="width:1.2rem;height:1.2rem;
            border-color:var(--clr-border);border-top-color:var(--clr-primary);"></span>
        </div></td></tr>`;

    try {
        const params = {
            page: currentPage,
            size: PAGE_SIZE,
            sort: 'queuedAt,desc',
        };
        // Backend /api/v1/reports endpoint'i filtreli execution listesi döner
        if (search)  params.search = search;
        if (status)  params.status = status;
        if (from)    params.fromDate = new Date(from).toISOString();
        if (to)      params.toDate   = new Date(to).toISOString();

        const data = await Api.get('/reports', params);
        renderTable(data?.content ?? []);
        renderPagination(data);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="padding:2rem;text-align:center;">
            Veriler yüklenemedi: ${Utils.escHtml(err.message)}</td></tr>`;
    }
}

function renderTable(items) {
    const tbody = document.getElementById('executions-body');

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">
            <div class="empty-state">
                <span class="empty-state-icon">▶</span>
                <p class="empty-state-title">Çalıştırma bulunamadı</p>
                <p class="empty-state-msg">Filtrelerinizi değiştirmeyi deneyin.</p>
            </div></td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(e => {
        const isActive = e.status === 'QUEUED' || e.status === 'RUNNING';
        return `
        <tr class="clickable-row" data-id="${Utils.escHtml(e.executionPublicId)}">
            <td>
                <div style="font-weight:600;font-size:.88rem;">${Utils.escHtml(e.scenarioName ?? '—')}</div>
            </td>
            <td>${statusBadge(e.status)}</td>
            <td style="font-size:.85rem;color:var(--clr-text-muted);">${Utils.escHtml(e.ownerUsername ?? '—')}</td>
            <td style="font-size:.82rem;">${Utils.formatDate(e.startedAt)}</td>
            <td style="font-size:.82rem;">${Utils.formatDuration(e.durationMs)}</td>
            <td style="font-size:.82rem;">
                ${e.totalSteps != null
            ? `<span style="color:var(--clr-success)">${e.passedSteps}</span>/<span style="color:var(--clr-danger)">${e.failedSteps}</span>/${e.totalSteps}`
            : '—'}
            </td>
            <td>
                <a href="execution-detail.html?id=${Utils.escHtml(e.executionPublicId)}"
                   class="btn btn-ghost btn-sm"
                   onclick="event.stopPropagation()">Detay</a>
            </td>
        </tr>`;
    }).join('');

    // Satır tıklama → detay
    tbody.querySelectorAll('tr.clickable-row').forEach(row => {
        row.addEventListener('click', () => {
            window.location.href = `execution-detail.html?id=${row.dataset.id}`;
        });
    });
}

function renderPagination(data) {
    const container = document.getElementById('pagination');
    if (!data || data.totalPages <= 1) { container.innerHTML = ''; return; }
    Pagination.render(container, data, (page) => {
        currentPage = page;
        loadExecutions();
    });
}

// Durum badge; spinner'lı aktif durumlar için
function statusBadge(status) {
    const map = {
        QUEUED:    { cls: 'badge-warning',  label: 'Kuyrukta',     spin: true  },
        RUNNING:   { cls: 'badge-primary',  label: 'Çalışıyor',    spin: true  },
        COMPLETED: { cls: 'badge-success',  label: 'Tamamlandı',   spin: false },
        FAILED:    { cls: 'badge-danger',   label: 'Başarısız',    spin: false },
        CANCELLED: { cls: 'badge-neutral',  label: 'İptal',        spin: false },
        TIMEOUT:   { cls: 'badge-warning',  label: 'Zaman Aşımı', spin: false },
    };
    const s = map[status] ?? { cls: 'badge-neutral', label: status, spin: false };
    const spinner = s.spin
        ? `<span class="mini-spin" style="border-top-color:currentColor;"></span>` : '';
    return `<span class="badge ${s.cls}">${spinner}${s.label}</span>`;
}