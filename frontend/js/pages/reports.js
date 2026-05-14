// Raporlar sayfası — /reports/scenarios/{id}/summary yerine
// /reports endpoint'inden veri çekip frontend'de hesaplar

let scenariosCache = [];

(async function init() {
    if (!Auth.isLoggedIn()) {
        window.location.href = '../index.html';
        return;
    }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Raporlar');

    setupEventListeners();
    await loadGroupsForSelector();
    await loadScenariosForSelector();
})();

// ── Event Listeners ────────────────────────────────────────
function setupEventListeners() {
    const groupSelector = document.getElementById('select-group');

    groupSelector?.addEventListener('change', async (e) => {
        const groupId = e.target.value || '';
        await loadScenariosForSelector(groupId);
        resetScenarioSelection();
    });
}

async function loadGroupsForSelector() {
    const groupSelector = document.getElementById('select-group');
    if (!groupSelector) return;

    try {
        const raw = await Api.get('/scenario-groups', { page: 0, size: 200, sort: 'createdAt,desc' });
        const data = raw?.data || raw || {};
        const groups = data.content || [];

        groupSelector.innerHTML = ['<option value="">— Tümü —</option>'].concat(
            groups.map(g => `<option value="${Utils.escHtml(g.publicId)}">${Utils.escHtml(g.name)}</option>`)
        ).join('');
    } catch (err) {
        Toast.error('Modül listesi yüklenemedi: ' + err.message);
    }
}

function resetScenarioSelection() {
    const emptyState = document.getElementById('scenario-empty');
    const summaryView = document.getElementById('scenario-summary');

    if (emptyState) emptyState.style.display = 'block';
    if (summaryView) summaryView.style.display = 'none';
    resetSummaryUI();
}

// ── Senaryo Seçiciyi Doldur ────────────────────────────────
async function loadScenariosForSelector(groupPublicId = '') {
    try {
        const params = { page: 0, size: 1000 };
        if (groupPublicId) params.groupPublicId = groupPublicId;

        const raw = await Api.get('/scenarios', params);
        let scenarios = [];

        if (raw?.content)            scenarios = raw.content;
        else if (Array.isArray(raw)) scenarios = raw;
        else if (raw?.data?.content) scenarios = raw.data.content;

        scenariosCache = scenarios;
        renderScenarioTable(scenariosCache);
    } catch (err) {
        Toast.error('Senaryo listesi yüklenemedi: ' + err.message);
    }
}

function renderScenarioTable(scenarios) {
    const tbody = document.getElementById('scenarios-tbody');
    if (!tbody) return;

    if (!scenarios || scenarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3">
            <div class="empty-state">
                <span class="empty-state-icon">▶</span>
                <p class="empty-state-msg">Senaryo bulunamadı</p>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = scenarios.map(s => {
        const ownerName = s.owner?.username || s.ownerUsername || '—';
        const status = s.status || 'DRAFT';
        return `
            <tr style="cursor:pointer" data-id="${Utils.escHtml(s.publicId)}" data-name="${Utils.escHtml(s.name)}">
                <td>${Utils.escHtml(s.name)}</td>
                <td>${scenarioStatusBadge(status)}</td>
                <td>${Utils.escHtml(ownerName)}</td>
            </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('click', async () => {
            const scenarioId = row.dataset.id;
            const scenarioName = row.dataset.name || '';
            const emptyState = document.getElementById('scenario-empty');
            const summaryView = document.getElementById('scenario-summary');

            tbody.querySelectorAll('tr.is-selected').forEach(r => r.classList.remove('is-selected'));
            row.classList.add('is-selected');

            if (emptyState) emptyState.style.display = 'none';
            if (summaryView) summaryView.style.display = 'block';
            resetSummaryUI();

            await loadScenarioSummary(scenarioId, scenarioName);
        });
    });
}

function scenarioStatusBadge(status) {
    const map = {
        READY: 'badge-success',
        DRAFT: 'badge-warning',
        ARCHIVED: 'badge-neutral',
    };
    const cls = map[status] ?? 'badge-neutral';
    const labels = {
        READY: 'Hazır',
        DRAFT: 'Taslak',
        ARCHIVED: 'Arşivli',
    };
    const label = labels[status] ?? status;
    return `<span class="badge ${cls}">${label}</span>`;
}

// ── Senaryo Özet — /reports endpoint'ini kullanır ─────────
async function loadScenarioSummary(scenarioPublicId, scenarioName) {
    try {
        // Tüm execution'ları çek; size büyük tutuldu
        const raw = await Api.get('/reports', { page: 0, size: 200 });

        let allItems = [];
        if (raw?.content)            allItems = raw.content;
        else if (Array.isArray(raw)) allItems = raw;
        else if (raw?.data?.content) allItems = raw.data.content;

        // Bu senaryoya ait olanları publicId veya isimle filtrele
        const items = allItems.filter(item =>
            item.scenarioPublicId === scenarioPublicId ||
            item.scenarioName === scenarioName
        );

        const totalRuns = items.length;

        // Terminal statüdeki execution'lar
        const terminal = items.filter(e =>
            ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(e.status)
        );

        // Ortalama süre
        const durations = terminal
            .map(e => e.durationMs)
            .filter(d => d != null && d > 0);
        const avgDurationMs = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : null;

        // Başarı oranı: COMPLETED / terminal toplam
        const passedCount = terminal.filter(e => e.status === 'COMPLETED').length;
        const passRate = terminal.length > 0
            ? Math.round((passedCount / terminal.length) * 100)
            : 0;

        // Son 10 — en yeni üstte
        const last10 = [...items]
            .sort((a, b) => {
                const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
                const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
                return tb - ta;
            })
            .slice(0, 10);

        renderSummary(totalRuns, avgDurationMs, passRate, last10);

    } catch (err) {
        Toast.error('Senaryo raporu yüklenemedi: ' + err.message);
        resetSummaryUI();
    }
}

// ── UI Render ──────────────────────────────────────────────
function renderSummary(totalRuns, avgDurationMs, passRate, last10) {
    const elTotal = document.getElementById('sum-total');
    const elAvg   = document.getElementById('sum-avg-duration');
    const elRate  = document.getElementById('sum-pass-rate');
    const bar     = document.getElementById('success-bar');
    const progTxt = document.getElementById('progress-text');

    if (elTotal) elTotal.textContent = totalRuns;

    if (elAvg) {
        elAvg.textContent = (avgDurationMs != null && avgDurationMs > 0)
            ? (avgDurationMs / 1000).toFixed(2) + 's'
            : '—';
    }

    if (elRate) elRate.textContent = passRate + '%';

    if (bar) {
        bar.style.width      = passRate + '%';
        bar.style.background = passRate >= 80
            ? '#4caf50'
            : passRate >= 50 ? '#ff9800' : '#f44336';
    }

    if (progTxt) progTxt.textContent = passRate + '%';

    renderTrendGrid(last10);
}

function renderTrendGrid(executions) {
    const grid = document.getElementById('last-ten-grid');
    if (!grid) return;

    if (!executions || executions.length === 0) {
        grid.innerHTML =
            '<span style="color: var(--clr-text-muted); font-size: 0.85rem;">' +
            'Henüz çalıştırma verisi yok.</span>';
        return;
    }

    grid.innerHTML = executions.map(exec => {
        const isPass      = exec.status === 'COMPLETED';
        const boxClass    = isPass ? 'pass' : 'fail';
        const statusLabel = isPass ? 'Başarılı' : exec.status;
        const dateStr     = exec.startedAt
            ? new Date(exec.startedAt).toLocaleString('tr-TR')
            : '';
        const durStr = exec.durationMs
            ? ' · ' + (exec.durationMs / 1000).toFixed(1) + 's'
            : '';
        const title = `${statusLabel}${dateStr ? ' · ' + dateStr : ''}${durStr}`;

        return `<div class="exec-box ${boxClass}" title="${Utils.escHtml(title)}"></div>`;
    }).join('');
}

function resetSummaryUI() {
    const elTotal = document.getElementById('sum-total');
    const elAvg   = document.getElementById('sum-avg-duration');
    const elRate  = document.getElementById('sum-pass-rate');
    const bar     = document.getElementById('success-bar');
    const progTxt = document.getElementById('progress-text');
    const grid    = document.getElementById('last-ten-grid');

    if (elTotal)  elTotal.textContent  = '0';
    if (elAvg)    elAvg.textContent    = '—';
    if (elRate)   elRate.textContent   = '—';
    if (bar)    { bar.style.width = '0%'; bar.style.background = '#4caf50'; }
    if (progTxt)  progTxt.textContent  = '0%';
    if (grid)     grid.innerHTML = '';
}