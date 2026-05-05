// Raporlar sayfası
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
    e.target.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const isExec = btn.textContent.includes('Çalış') || btn.textContent.includes('Liste');
            switchTab(isExec ? 'executions' : 'scenarios', e);
        });
    });
}

function setupFilters() {
    document.getElementById('btn-filter')?.addEventListener('click', () => {
        currentPage = 0;
        loadExecutionsReport();
    });

    document.getElementById('select-scenario')?.addEventListener('change', async (e) => {
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

// ─── Execution Rapor Listesi ───────────────────────────────────
async function loadExecutionsReport() {
    const tbody = document.getElementById('executions-tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--clr-text-muted);">
            Yükleniyor...
        </td></tr>`;
    }

    try {
        const params = buildCleanParams();
        // GET /api/v1/reports → ApiResponse<Page<ReportListItemDto>>
        const raw = await Api.get('/reports', params);

        let items    = [];
        let pageData = {};

        if (raw?.content) {
            items    = raw.content;
            pageData = raw;
        } else if (Array.isArray(raw)) {
            items    = raw;
            pageData = { totalPages: 1, totalElements: raw.length, number: 0 };
        } else {
            items    = [];
            pageData = { totalPages: 0, totalElements: 0, number: 0 };
        }

        renderExecutions(items);
        renderPagination(pageData);
    } catch (err) {
        Toast.error('Yükleme hatası: ' + err.message);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--clr-danger);">
                Veriler yüklenemedi.
            </td></tr>`;
        }
    }
}

function buildCleanParams() {
    const params = { page: currentPage, size: PAGE_SIZE, sort: 'startedAt,desc' };
    const scenarioEl = document.getElementById('filter-scenario');
    const statusEl   = document.getElementById('filter-status');

    if (scenarioEl?.value?.trim()) params.scenarioName = scenarioEl.value.trim();
    if (statusEl?.value && statusEl.value !== 'Tümü' && statusEl.value !== '') {
        params.status = statusEl.value;
    }

    return params;
}

function renderExecutions(items) {
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
                <td>${Utils.escHtml(item.scenarioName || '—')}</td>
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

function renderPagination(data) {
    const container = document.getElementById('pagination-container');
    if (!container || !data || data.totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;align-items:center;">
            <button ${currentPage === 0 ? 'disabled' : ''}
                onclick="currentPage--; loadExecutionsReport();"
                class="btn btn-ghost btn-sm">← Önceki</button>
            <span style="font-size:.85rem;color:var(--clr-text-muted);">
                Sayfa ${currentPage + 1} / ${data.totalPages}
            </span>
            <button ${currentPage >= data.totalPages - 1 ? 'disabled' : ''}
                onclick="currentPage++; loadExecutionsReport();"
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

// ─── Senaryo Selector ─────────────────────────────────────────
async function loadScenariosForSelector() {
    try {
        // GET /api/v1/scenarios?page=0&size=1000 → ApiResponse<Page<ScenarioResponse>>
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

// ─── Senaryo Özeti ─────────────────────────────────────────────
async function loadScenarioSummary(scenarioId) {
    try {
        // GET /api/v1/reports/scenarios/{publicId}/summary → ApiResponse<ScenarioSummaryDto>
        const raw = await Api.get(`/reports/scenarios/${scenarioId}/summary`);
        // ScenarioSummaryDto: totalRuns, avgDurationMs, overallPassRate, last10Executions
        const summary = raw?.totalRuns != null ? raw : (raw?.data ?? raw);

        const passRate   = Math.round(summary.overallPassRate ?? 0);
        const avgDur     = summary.avgDurationMs != null
            ? (summary.avgDurationMs / 1000).toFixed(2) + 's'
            : '—';

        document.getElementById('sum-total').textContent        = summary.totalRuns ?? 0;
        document.getElementById('sum-avg-duration').textContent = avgDur;
        document.getElementById('sum-pass-rate').textContent    = passRate + '%';

        // Progress bar
        const bar = document.getElementById('success-bar');
        if (bar) {
            bar.style.width = passRate + '%';
            bar.style.background = passRate >= 80 ? '#4caf50' : passRate >= 50 ? '#ff9800' : '#f44336';
        }
        const progressText = document.getElementById('progress-text');
        if (progressText) progressText.textContent = passRate + '%';

        // Son 10 execution
        const grid = document.getElementById('last-ten-grid');
        if (grid) {
            // last10Executions: List<ReportListItemDto>
            const executions = summary.last10Executions || [];
            grid.innerHTML = executions.slice(0, 10).map(exec => {
                const isPass = exec.status === 'COMPLETED';
                const color  = isPass ? '#4caf50' : '#f44336';
                return `<div title="${Utils.escHtml(exec.status)}" style="
                    display:inline-block;width:22px;height:22px;
                    border-radius:4px;margin:0 3px 4px 0;
                    background:${color};opacity:.85;cursor:default;
                    transition:opacity .15s;" onmouseenter="this.style.opacity=1"
                    onmouseleave="this.style.opacity=.85"></div>`;
            }).join('');
        }
    } catch (err) {
        Toast.error('Senaryo özeti yüklenemedi: ' + err.message);
    }
}