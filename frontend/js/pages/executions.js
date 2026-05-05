// Faz F6 — Çalıştırmalar Listesi
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
    document.getElementById('btn-filter').addEventListener('click', () => {
        currentPage = 0;
        loadExecutions();
    });
    ['filter-scenario', 'filter-from', 'filter-to'].forEach(id => {
        document.getElementById(id)?.addEventListener('keypress', e => {
            if (e.key === 'Enter') { currentPage = 0; loadExecutions(); }
        });
    });
}

async function loadExecutions() {
    try {
        const params = buildCleanParams();

        const response = await Api.get('/reports', params);
        let items = [];
        if (Array.isArray(response)) items = response;
        else if (response && Array.isArray(response.content)) items = response.content;
        else if (response?.data?.content) items = response.data.content;
        
        renderExecutions(items);
        renderPagination(response);
    } catch (err) {
        Toast.error('Yükleme hatası: ' + err.message);
        document.getElementById('executions-tbody').innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--clr-danger);">Veriler yüklenemedi</td></tr>`;
    }
}

function buildCleanParams() {
    const params = {
        page: currentPage,
        size: PAGE_SIZE,
        sort: 'id,desc'
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
        // datetime-local'ı ISO 8601 formatına çevir
        const dt = new Date(fromEl.value);
        params.fromDate = dt.toISOString();
    }
    if (toEl && toEl.value) {
        // datetime-local'ı ISO 8601 formatına çevir ve gün sonuna ata
        const dt = new Date(toEl.value);
        dt.setHours(23, 59, 59, 999);
        params.toDate = dt.toISOString();
    }

    return params;
}

function renderExecutions(items) {
    const tbody = document.getElementById('executions-tbody');
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--clr-text-muted);">Kayıt bulunamadı</td></tr>`;
        return;
    }
     tbody.innerHTML = items.map(item => {
        const statusClass = `badge-${item.status?.toLowerCase() || 'queued'}`;
        const spinner = (item.status === 'QUEUED' || item.status === 'RUNNING') ? '<span class="mini-spinner" style="margin-right: 0.3rem;"></span>' : '';
        return `
            <tr onclick="window.location.href='execution-detail.html?id=${Utils.escHtml(item.executionPublicId || item.publicId)}'">
                <td>${Utils.escHtml(item.scenarioName || '—')}</td>
                <td><span class="badge-status ${statusClass}">${spinner}${item.status}</span></td>
                <td style="font-size: 0.85rem; color: var(--clr-text-muted);">${Utils.escHtml(item.ownerUsername || item.createdBy || item.username || '—')}</td>
                <td style="font-size: 0.82rem;">${item.startedAt ? new Date(item.startedAt).toLocaleString('tr-TR') : '—'}</td>
                <td style="font-size: 0.82rem;">${item.durationMs ? (item.durationMs / 1000).toFixed(2) + 's' : '—'}</td>
                <td style="font-size: 0.82rem;">${item.passedSteps || 0}/${item.totalSteps || 0}</td>
                <td><a href="execution-detail.html?id=${Utils.escHtml(item.executionPublicId || item.publicId)}" class="btn-link" onclick="event.stopPropagation();">Detay</a></td>
            </tr>
        `;
    }).join('');
}

function renderPagination(data) {
    const container = document.getElementById('pagination-container');
    if (!data || data.totalPages <= 1) { container.innerHTML = ''; return; }
    const html = `
        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; align-items: center;">
            <button ${currentPage === 0 ? 'disabled' : ''} onclick="currentPage--; loadExecutions();" class="btn btn-ghost btn-sm">← Önceki</button>
            <span style="font-size: 0.85rem; color: var(--clr-text-muted);">Sayfa ${currentPage + 1} / ${data.totalPages}</span>
            <button ${currentPage >= data.totalPages - 1 ? 'disabled' : ''} onclick="currentPage++; loadExecutions();" class="btn btn-ghost btn-sm">Sonraki →</button>
        </div>
    `;
    container.innerHTML = html;
}
