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
    if (selector) {
        selector.addEventListener('change', async (e) => {
            const scenarioId = e.target.value;
            const emptyState = document.getElementById('scenario-empty');
            const summaryView = document.getElementById('scenario-summary');

            if (!scenarioId) {
                emptyState.style.display = 'block';
                summaryView.style.display = 'none';
                return;
            }

            await loadScenarioSummary(scenarioId);
            emptyState.style.display = 'none';
            summaryView.style.display = 'block';
        });
    }
}

// ─── Senaryo Seçiciyi Doldurma ─────────────────────────────────
async function loadScenariosForSelector() {
    try {
        // GET /api/v1/scenarios?page=0&size=1000
        const raw = await Api.get('/scenarios', { page: 0, size: 1000 });
        let scenarios = [];

        if (raw?.content) scenarios = raw.content;
        else if (Array.isArray(raw)) scenarios = raw;
        else if (raw?.data?.content) scenarios = raw.data.content;

        const selector = document.getElementById('select-scenario');
        if (!selector) return;

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
    try {
        // GET /api/v1/reports/scenarios/{publicId}/summary
        const raw = await Api.get(`/reports/scenarios/${scenarioId}/summary`);
        const summary = raw?.totalRuns != null ? raw : (raw?.data ?? raw);

        const passRate = Math.round(summary.overallPassRate ?? 0);
        const avgDur = summary.avgDurationMs != null
            ? (summary.avgDurationMs / 1000).toFixed(2) + 's'
            : '—';

        // Metrikleri Güncelle
        document.getElementById('sum-total').textContent = summary.totalRuns ?? 0;
        document.getElementById('sum-avg-duration').textContent = avgDur;
        document.getElementById('sum-pass-rate').textContent = passRate + '%';

        // Başarı Oranı Progress Barını Güncelle
        const bar = document.getElementById('success-bar');
        if (bar) {
            bar.style.width = passRate + '%';
            bar.style.background = passRate >= 80 ? '#4caf50' : passRate >= 50 ? '#ff9800' : '#f44336';
        }

        const progressText = document.getElementById('progress-text');
        if (progressText) {
            progressText.textContent = passRate + '%';
        }

        // Son 10 Çalıştırma Trendini Güncelle
        const grid = document.getElementById('last-ten-grid');
        if (grid) {
            const executions = summary.last10Executions || [];

            if (executions.length === 0) {
                grid.innerHTML = '<span style="color: var(--clr-text-muted); font-size: 0.85rem;">Henüz çalıştırma verisi yok.</span>';
                return;
            }

            grid.innerHTML = executions.slice(0, 10).map(exec => {
                const isPass = exec.status === 'COMPLETED';
                const boxClass = isPass ? 'pass' : 'fail';
                const statusLabel = isPass ? 'Başarılı' : 'Başarısız';

                return `<div class="exec-box ${boxClass}" title="Durum: ${statusLabel}"></div>`;
            }).join('');
        }
    } catch (err) {
        Toast.error('Senaryo özeti yüklenemedi: ' + err.message);
    }
}