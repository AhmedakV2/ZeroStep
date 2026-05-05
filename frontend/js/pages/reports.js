// Faz F7 — Raporlar
let currentPage = 0;
const PAGE_SIZE = 20;

(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }
    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Raporlar');
    setupTabs();
    setupFilters();
    await loadExecutionsReport();
    await loadScenariosForSelector();
})();

function switchTab(tab, e) {
    e.preventDefault();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(btn.textContent.includes('Çalış') ? 'executions' : 'scenarios', e));
    });
}

function setupFilters() {
    document.getElementById('btn-filter').addEventListener('click', () => {
        currentPage = 0;
        loadExecutionsReport();
    });

    document.getElementById('select-scenario').addEventListener('change', async (e) => {
        if (!e.target.value) {
            document.getElementById('scenario-empty').style.display = 'block';
            document.getElementById('scenario-summary').style.display = 'none';
            return;
        }
        await loadScenarioSummary(e.target.value);
        document.getElementById('scenario-empty').style.display = 'none';
        document.getElementById('scenario-summary').style.display = 'block';
    });
}

async function loadExecutionsReport() {
    try {
        const params = buildCleanParams();

        const response = await Api.get('/reports', params);
        let items = [];
        if (Array.isArray(response)) items = response;
        else if (response?.content) items = response.content;
        else if (response?.data?.content) items = response.data.content;

        renderExecutions(items);
        renderPagination(response);
    } catch (err) {
        Toast.error('Yükleme hatası: ' + err.message);
    }
}

function buildCleanParams() {
    const params = { page: currentPage, size: PAGE_SIZE, sort: 'id,desc' };
    const scenarioEl = document.getElementById('filter-scenario');
    const statusEl = document.getElementById('filter-status');

    if (scenarioEl && scenarioEl.value.trim() !== '') params.scenarioName = scenarioEl.value.trim();
    if (statusEl && statusEl.value && statusEl.value !== 'Tümü') params.status = statusEl.value;

    return params;
}

function renderExecutions(items) {
    const tbody = document.getElementById('executions-tbody');
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--clr-text-muted);">Kayıt bulunamadı</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const passRate = item.totalSteps > 0 ? Math.round((item.passedSteps || 0) / item.totalSteps * 100) : 0;
        const statusText = item.status === 'COMPLETED' ? '✓' : item.status === 'FAILED' ? '✗' : '—';
        const statusColor = item.status === 'COMPLETED' ? '#4caf50' : item.status === 'FAILED' ? '#f44336' : '#666';

        return `
            <tr onclick="window.location.href='execution-detail.html?id=${Utils.escHtml(item.executionPublicId || item.publicId)}'">
                <td>${Utils.escHtml(item.scenarioName || '—')}</td>
                <td><span style="color: ${statusColor};">${statusText}</span></td>
                <td>
                    <div style="width: 80px; height: 6px; background: var(--clr-surface-2); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${passRate}%; height: 100%; background: ${passRate === 100 ? '#4caf50' : passRate >= 50 ? '#ff9800' : '#f44336'};"></div>
                    </div>
                    <span style="font-size: 0.7rem;">${passRate}%</span>
                </td>
                <td style="font-size: 0.82rem;">${item.durationMs ? (item.durationMs / 1000).toFixed(2) + 's' : '—'}</td>
                <td style="font-size: 0.82rem; color: var(--clr-text-muted);">${Utils.escHtml(item.ownerUsername || item.createdBy || item.username || '—')}</td>
                <td><a href="execution-detail.html?id=${Utils.escHtml(item.executionPublicId || item.publicId)}" class="btn-link" onclick="event.stopPropagation();">Detay</a></td>
            </tr>
        `;
    }).join('');
}

function renderPagination(data) {
    const container = document.getElementById('pagination-container');
    if (!container || !data || data.totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }
    const html = `
        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; align-items: center;">
            <button ${currentPage === 0 ? 'disabled' : ''} onclick="currentPage--; loadExecutionsReport();" class="btn btn-ghost btn-sm">← Önceki</button>
            <span style="font-size: 0.85rem; color: var(--clr-text-muted);">Sayfa ${currentPage + 1} / ${data.totalPages}</span>
            <button ${currentPage >= data.totalPages - 1 ? 'disabled' : ''} onclick="currentPage++; loadExecutionsReport();" class="btn btn-ghost btn-sm">Sonraki →</button>
        </div>
    `;
    container.innerHTML = html;
}

async function loadScenariosForSelector() {
    try {
        const response = await Api.get('/scenarios', { page: 0, size: 1000 });
        let scenarios = [];
        if (Array.isArray(response)) scenarios = response;
        else if (response?.content) scenarios = response.content;
        else if (response?.data?.content) scenarios = response.data.content;

        const selector = document.getElementById('select-scenario');
        const options = scenarios.map(s => `<option value="${Utils.escHtml(s.publicId)}">${Utils.escHtml(s.name)}</option>`).join('');
        selector.innerHTML = '<option value="">— Seçin —</option>' + options;
    } catch (err) {
        Toast.error('Yükleme hatası: ' + err.message);
    }
}

async function loadScenarioSummary(scenarioId) {
    try {
        const response = await Api.get(`/reports/scenarios/${scenarioId}/summary`);
        let summary = response;
        if (!summary || typeof summary !== 'object') {
            if (response?.data) summary = response.data;
        }

        const passRate = summary.totalExecutions > 0 ? Math.round((summary.passedExecutions || 0) / summary.totalExecutions * 100) : 0;
        const avgDuration = summary.totalExecutions > 0 ? ((summary.totalDurationMs || 0) / summary.totalExecutions).toFixed(2) : 0;

        document.getElementById('sum-total').textContent = summary.totalExecutions || 0;
        document.getElementById('sum-avg-duration').textContent = avgDuration + 's';
        document.getElementById('sum-pass-rate').textContent = passRate + '%';

        const bar = document.getElementById('success-bar');
        bar.style.width = passRate + '%';
        document.getElementById('progress-text').textContent = passRate + '%';

        // Son 10 kutu
        const grid = document.getElementById('last-ten-grid');
        const executions = summary.lastExecutions || [];
        grid.innerHTML = executions.slice(0, 10).map(exec => {
            const status = exec.status === 'COMPLETED' ? 'pass' : 'fail';
            return `<div class="exec-box ${status}" title="${Utils.escHtml(exec.status)}"></div>`;
        }).join('');
    } catch (err) {
        Toast.error('Yükleme hatası: ' + err.message);
    }
}
