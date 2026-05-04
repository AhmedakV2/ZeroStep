// Execution detay: SSE canlı log, adım sonuçları, iptal, PDF/Excel indirme
let execPublicId = null;
let execData     = null;
let eventSource  = null;
let pollingTimer = null;

// ── Init ─────────────────────────────────────────────────
(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    const params = new URLSearchParams(window.location.search);
    execPublicId = params.get('id');
    if (!execPublicId) { Toast.error('Execution ID bulunamadı'); return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Çalıştırma Detayı');

    setupActions();

    await loadExecution();
    await loadStepResults();

    // Aktif execution ise SSE aç, değilse mevcut logları çek
    if (isActive(execData?.status)) {
        openSSE();
    } else {
        loadHistoricalLogs();
        setSseState('closed');
    }
})();

// ── Execution yükle ───────────────────────────────────────
async function loadExecution() {
    try {
        execData = await Api.get(`/executions/${execPublicId}`);
        renderHeader();
        renderSummary();
    } catch (err) {
        Toast.error('Execution yüklenemedi: ' + err.message);
    }
}

function renderHeader() {
    document.title = `ZeroStep — ${execData.scenarioName ?? 'Çalıştırma'}`;
    document.getElementById('breadcrumb-scenario').textContent = execData.scenarioName ?? '—';
    document.getElementById('exec-title').textContent = `Çalıştırma Detayı`;
    document.getElementById('exec-status-badge').innerHTML = statusBadge(execData.status);

    // İptal butonu: sadece aktif durumlarda
    const cancelBtn = document.getElementById('btn-cancel');
    if (isActive(execData.status)) {
        cancelBtn.classList.remove('hidden');
    } else {
        cancelBtn.classList.add('hidden');
    }
}

function renderSummary() {
    const d = execData;
    document.getElementById('sum-trigger').textContent   = d.triggeredByName ?? '—';
    document.getElementById('sum-started').textContent   = d.startedAt  ? Utils.formatDate(d.startedAt)  : '—';
    document.getElementById('sum-finished').textContent  = d.finishedAt ? Utils.formatDate(d.finishedAt) : '—';
    document.getElementById('sum-duration').textContent  = d.durationMs != null ? Utils.formatDuration(d.durationMs) : '—';

    const total   = d.totalSteps ?? '?';
    const passed  = d.passedSteps  ?? 0;
    const failed  = d.failedSteps  ?? 0;
    const skipped = d.skippedSteps ?? 0;
    document.getElementById('sum-steps').textContent = `${total} toplam`;
    document.getElementById('sum-pass').innerHTML =
        `<span style="color:var(--clr-success)">${passed}</span>` +
        ` / <span style="color:var(--clr-danger)">${failed}</span>` +
        ` / <span style="color:var(--clr-text-muted)">${skipped}</span>`;
}

// ── Adım sonuçları ────────────────────────────────────────
async function loadStepResults() {
    try {
        const steps = await Api.get(`/executions/${execPublicId}/steps`);
        renderStepList(steps);
    } catch (err) {
        document.getElementById('steps-list').innerHTML =
            `<li style="padding:1.5rem;text-align:center;color:var(--clr-text-muted);">
                Adımlar yüklenemedi</li>`;
    }
}

function renderStepList(steps) {
    const list  = document.getElementById('steps-list');
    const label = document.getElementById('step-count-label');
    label.textContent = `${steps.length} adım`;

    if (steps.length === 0) {
        list.innerHTML = `<li style="padding:2rem;text-align:center;color:var(--clr-text-muted);font-size:.85rem;">
            Henüz adım sonucu yok</li>`;
        return;
    }

    list.innerHTML = steps.map((step, idx) => {
        const { icon, cls } = stepIcon(step.status);
        const hasError  = step.status === 'FAILED' && step.errorMessage;
        const hasScreen = !!step.screenshotPath;
        const dur = step.durationMs != null ? Utils.formatDuration(step.durationMs) : '';

        return `
        <li class="step-item" data-idx="${idx}" ${hasError ? 'data-has-error="1"' : ''}>
            <span class="step-icon ${cls}">${icon}</span>
            <div class="step-info">
                <div class="step-action">${Utils.escHtml(step.actionType ?? '—')}</div>
                ${step.description
            ? `<div class="step-desc">${Utils.escHtml(step.description)}</div>` : ''}
                ${hasScreen
            ? `<button class="step-screenshot-btn" data-step-id="${Utils.escHtml(String(step.id))}">
                        Screenshot Görüntüle</button>` : ''}
            </div>
            <span class="step-duration">${dur}</span>
        </li>
        ${hasError
            ? `<div class="step-error-detail">${Utils.escHtml(step.errorMessage)}</div>`
            : ''}`;
    }).join('');

    // Hatalı adımlara tıklama → hata detay toggle
    list.querySelectorAll('.step-item[data-has-error]').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('step-screenshot-btn')) return;
            item.classList.toggle('expanded');
        });
    });

    // Screenshot butonu
    list.querySelectorAll('.step-screenshot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const stepId = btn.dataset.stepId;
            window.open(
                `http://localhost:8080/api/v1/executions/${execPublicId}/screenshots/${stepId}`,
                '_blank'
            );
        });
    });
}

function stepIcon(status) {
    const map = {
        PASSED:  { icon: '✓', cls: 'step-icon-pass' },
        FAILED:  { icon: '✗', cls: 'step-icon-fail' },
        SKIPPED: { icon: '—', cls: 'step-icon-skip' },
        RUNNING: { icon: '▶', cls: 'step-icon-run'  },
    };
    return map[status] ?? { icon: '?', cls: 'step-icon-skip' };
}

// ── SSE Canlı Log ─────────────────────────────────────────
function openSSE() {
    const token = Store.getAccessToken();
    const url   = `http://localhost:8080/api/v1/executions/${execPublicId}/stream?token=${token}`;

    setSseState('connecting');
    eventSource = new EventSource(url);

    eventSource.addEventListener('connected', () => {
        setSseState('connected');
    });

    eventSource.addEventListener('log', (e) => {
        try {
            const entry = JSON.parse(e.data);
            appendLog(entry);
        } catch { /* parse hatası sessiz geç */ }
    });

    eventSource.addEventListener('execution-finished', async (e) => {
        setSseState('closed');
        eventSource.close();
        eventSource = null;
        // Son durumu DB'den al ve UI'ı güncelle
        await loadExecution();
        await loadStepResults();
        Toast.success('Execution tamamlandı');
    });

    eventSource.onerror = () => {
        setSseState('closed');
        if (eventSource) eventSource.close();
        eventSource = null;
        // SSE düşerse polling ile dene
        startPolling();
    };
}

function startPolling() {
    if (pollingTimer) return;
    pollingTimer = setInterval(async () => {
        try {
            const data = await Api.get(`/executions/${execPublicId}`);
            execData = data;
            renderHeader();
            renderSummary();
            if (!isActive(data.status)) {
                clearInterval(pollingTimer);
                pollingTimer = null;
                await loadStepResults();
            }
        } catch { /* sessiz */ }
    }, 3000);
}

// Geçmiş logları sayfalı çek (terminal durum)
async function loadHistoricalLogs() {
    try {
        const data = await Api.get(`/executions/${execPublicId}/logs`, { size: 200, sort: 'occurredAt,asc' });
        const items = data?.content ?? [];
        items.forEach(l => appendLog(l));
        if (items.length === 0) {
            appendRawLog('info', 'Kayıt yok');
        }
    } catch {
        appendRawLog('warn', 'Loglar yüklenemedi');
    }
}

function appendLog(entry) {
    const level = (entry.logLevel ?? entry.level ?? 'INFO').toLowerCase();
    const msg   = entry.message ?? '';
    const ts    = entry.occurredAt ? new Date(entry.occurredAt).toLocaleTimeString('tr-TR') : '';
    appendRawLog(level, msg, ts);
}

function appendRawLog(level, msg, ts = '') {
    const container = document.getElementById('log-list');
    const el = document.createElement('div');
    el.className = 'log-entry';
    el.innerHTML = `
        <span class="log-time">${Utils.escHtml(ts)}</span>
        <span class="log-level log-level-${Utils.escHtml(level)}">${Utils.escHtml(level.toUpperCase())}</span>
        <span class="log-msg">${Utils.escHtml(msg)}</span>`;
    container.appendChild(el);
    // Otomatik scroll en alta
    container.scrollTop = container.scrollHeight;
}

function setSseState(state) {
    const dot   = document.getElementById('sse-dot');
    const label = document.getElementById('sse-label');
    dot.className = `sse-dot ${state === 'connecting' ? 'connecting' : state === 'closed' ? 'closed' : ''}`;
    const labels = { connecting: 'Bağlanıyor…', connected: 'Canlı', closed: 'Bağlantı Kapalı' };
    label.textContent = labels[state] ?? state;
}

// ── Aksiyonlar (İptal, PDF, Excel) ───────────────────────
function setupActions() {
    // Log temizle
    document.getElementById('btn-log-clear').addEventListener('click', () => {
        document.getElementById('log-list').innerHTML = '';
    });

    // İptal Et
    document.getElementById('btn-cancel').addEventListener('click', () => {
        ConfirmDialog.show({
            title: 'Çalıştırmayı İptal Et',
            message: 'Bu çalıştırmayı iptal etmek istediğinize emin misiniz?',
            confirmLabel: 'İptal Et',
            onConfirm: cancelExecution,
        });
    });

    // PDF indir
    document.getElementById('btn-pdf').addEventListener('click', () => {
        downloadReport('pdf');
    });

    // Excel indir
    document.getElementById('btn-excel').addEventListener('click', () => {
        downloadReport('excel');
    });
}

async function cancelExecution() {
    try {
        await Api.post(`/executions/${execPublicId}/cancel`, {});
        Toast.success('İptal sinyali gönderildi');
        Modal.close();
        await loadExecution();
    } catch (err) {
        Toast.error('İptal başarısız: ' + err.message);
        throw err;
    }
}

async function downloadReport(type) {
    const btn = type === 'pdf'
        ? document.getElementById('btn-pdf')
        : document.getElementById('btn-excel');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>`;

    try {
        const token = Store.getAccessToken();
        const url   = `http://localhost:8080/api/v1/reports/executions/${execPublicId}/export/${type}`;
        const res   = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob     = await res.blob();
        const ext      = type === 'pdf' ? 'pdf' : 'xlsx';
        const filename = `report-${execPublicId}.${ext}`;
        const a        = document.createElement('a');
        a.href         = URL.createObjectURL(blob);
        a.download     = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    } catch (err) {
        Toast.error(`${type.toUpperCase()} indirme başarısız: ${err.message}`);
    } finally {
        btn.disabled    = false;
        btn.textContent = origText;
    }
}

// ── Yardımcı ─────────────────────────────────────────────
function isActive(status) {
    return status === 'QUEUED' || status === 'RUNNING';
}

function statusBadge(status) {
    const map = {
        QUEUED:    { cls: 'badge-warning',  label: 'Kuyrukta',     spin: true  },
        RUNNING:   { cls: 'badge-primary',  label: 'Çalışıyor',    spin: true  },
        COMPLETED: { cls: 'badge-success',  label: 'Tamamlandı',   spin: false },
        FAILED:    { cls: 'badge-danger',   label: 'Başarısız',    spin: false },
        CANCELLED: { cls: 'badge-neutral',  label: 'İptal',        spin: false },
        TIMEOUT:   { cls: 'badge-warning',  label: 'Zaman Aşımı', spin: false },
    };
    const s = map[status] ?? { cls: 'badge-neutral', label: status ?? '?', spin: false };
    const spinner = s.spin
        ? `<span class="mini-spin" style="border-top-color:currentColor;display:inline-block;
            width:.65rem;height:.65rem;border:1.5px solid rgba(255,255,255,.3);
            border-top-color:currentColor;border-radius:50%;animation:spin .65s linear infinite;
            vertical-align:middle;margin-right:.2rem;"></span>` : '';
    return `<span class="badge ${s.cls}">${spinner}${s.label}</span>`;
}

// Sayfa terk edilince SSE/polling kapat
window.addEventListener('beforeunload', () => {
    if (eventSource) { eventSource.close(); eventSource = null; }
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
});