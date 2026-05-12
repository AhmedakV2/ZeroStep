// Raporlar sayfası (Yalnızca Senaryo Özeti)

(async function init() {
    if (!Auth.isLoggedIn()) {
        window.location.href = '../index.html';
        return;
    }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Raporlar');

    setupEventListeners();
    await loadScenariosForSelector();
})();

function setupEventListeners() {
    const selector = document.getElementById('select-scenario');
    if (!selector) return;

    selector.addEventListener('change', async (e) => {
        const scenarioId = e.target.value;
        const emptyState  = document.getElementById('scenario-empty');
        const summaryView = document.getElementById('scenario-summary');

        if (!scenarioId) {
            emptyState.style.display  = 'block';
            summaryView.style.display = 'none';
            return;
        }

        // Yükleniyor göstergesi
        emptyState.style.display  = 'none';
        summaryView.style.display = 'block';

        await loadScenarioSummary(scenarioId);
    });
}

// ─── Senaryo Seçiciyi Doldurma ─────────────────────────────────
async function loadScenariosForSelector() {
    try {
        // GET /api/v1/scenarios?page=0&size=1000
        const raw = await Api.get('/scenarios', { page: 0, size: 1000 });
        let scenarios = [];

        if (raw?.content)            scenarios = raw.content;
        else if (Array.isArray(raw)) scenarios = raw;
        else if (raw?.data?.content) scenarios = raw.data.content;

        const selector = document.getElementById('select-scenario');
        if (!selector) return;

        if (scenarios.length === 0) {
            selector.innerHTML = '<option value="">— Henüz senaryo yok —</option>';
            return;
        }

        const options = scenarios.map(s =>
            `<option value="${Utils.escHtml(s.publicId)}">${Utils.escHtml(s.name)}</option>`
        ).join('');

        selector.innerHTML = '<option value="">— Senaryo Seçin —</option>' + options;
    } catch (err) {
        Toast.error('Senaryo listesi yüklenemedi: ' + err.message);
    }
}

// ─── Seçilen Senaryonun Özet Verilerini Çekme ve Render Etme ───
async function loadScenarioSummary(scenarioId) {
    // Sıfırla
    resetSummaryUI();

    try {
        // GET /api/v1/reports/scenarios/{publicId}/summary
        const raw = await Api.get(`/reports/scenarios/${scenarioId}/summary`);

        // api.js .data unwrap ediyor; her iki format da desteklenir
        const summary = (raw && raw.totalRuns != null)
            ? raw
            : (raw?.data ?? raw ?? {});

        // Null-safe değerler
        const totalRuns  = summary.totalRuns  ?? 0;
        const avgDurMs   = summary.avgDurationMs != null ? Number(summary.avgDurationMs) : null;
        const passRate   = Math.round(summary.overallPassRate ?? 0);
        const last10     = Array.isArray(summary.last10Executions) ? summary.last10Executions : [];

        // Metrikleri güncelle
        const elTotal = document.getElementById('sum-total');
        if (elTotal) elTotal.textContent = totalRuns;

        const elAvg = document.getElementById('sum-avg-duration');
        if (elAvg) {
            elAvg.textContent = (avgDurMs != null && avgDurMs > 0)
                ? (avgDurMs / 1000).toFixed(2) + 's'
                : '—';
        }

        const elRate = document.getElementById('sum-pass-rate');
        if (elRate) elRate.textContent = passRate + '%';

        // Progress bar
        const bar = document.getElementById('success-bar');
        if (bar) {
            bar.style.width      = passRate + '%';
            bar.style.background = passRate >= 80
                ? '#4caf50'
                : passRate >= 50 ? '#ff9800' : '#f44336';
        }

        const progressText = document.getElementById('progress-text');
        if (progressText) progressText.textContent = passRate + '%';

        // Son 10 çalıştırma trend grid
        renderTrendGrid(last10);

    } catch (err) {
        Toast.error('Senaryo özeti yüklenemedi: ' + err.message);
        resetSummaryUI();
    }
}

// ─── Trend Grid ────────────────────────────────────────────────
function renderTrendGrid(executions) {
    const grid = document.getElementById('last-ten-grid');
    if (!grid) return;

    if (!executions || executions.length === 0) {
        grid.innerHTML = '<span style="color: var(--clr-text-muted); font-size: 0.85rem;">Henüz çalıştırma verisi yok.</span>';
        return;
    }

    grid.innerHTML = executions.slice(0, 10).map(exec => {
        const isPass     = exec.status === 'COMPLETED';
        const boxClass   = isPass ? 'pass' : 'fail';
        const statusLabel = isPass ? 'Başarılı' : 'Başarısız';
        const dateStr    = exec.startedAt
            ? new Date(exec.startedAt).toLocaleString('tr-TR')
            : '';
        const title = `${statusLabel}${dateStr ? ' · ' + dateStr : ''}`;
        return `<div class="exec-box ${boxClass}" title="${Utils.escHtml(title)}"></div>`;
    }).join('');
}

// ─── UI Sıfırlama ──────────────────────────────────────────────
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
    if (bar)      { bar.style.width = '0%'; bar.style.background = '#4caf50'; }
    if (progTxt)  progTxt.textContent  = '0%';
    if (grid)     grid.innerHTML = '';
}