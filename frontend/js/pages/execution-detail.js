// ═══════════════════════════════════════════════════════════
// Çalıştırma Detayı + SSE Canlı Log
// ═══════════════════════════════════════════════════════════

const BACKEND_BASE = 'http://localhost:8080/api/v1';

let execPublicId  = null;
let execData      = null;
let eventSource   = null;
let pollingTimer  = null;
let lastLogId     = 0;

(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    const params = new URLSearchParams(window.location.search);
    execPublicId = params.get('id');

    if (!execPublicId) {
        Toast.error('Execution ID bulunamadı. URL parametresi eksik.');
        return;
    }

    const idDisplay = document.getElementById('exec-id-display');
    if (idDisplay) idDisplay.textContent = 'ID: ' + execPublicId;

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Çalıştırma Detayı');

    setupActions();
    await loadExecution();
    await loadSteps();

    if (execData?.status === 'QUEUED' || execData?.status === 'RUNNING') {
        tryOpenSSE();
    } else {
        appendLog('info', `Execution durumu: ${execData?.status || 'BİLİNMİYOR'}`);
        if (execData?.errorMessage) appendLog('error', 'Hata mesajı: ' + execData.errorMessage);
        updateSseStatus('closed');
    }
})();

// ─── Execution Ana Verisi ──────────────────────────────────
async function loadExecution() {
    try {
        const raw = await Api.get(`/executions/${execPublicId}`);
        execData = (raw?.publicId) ? raw : (raw?.data ?? raw);
        if (!execData?.publicId) throw new Error('Geçersiz execution verisi: publicId yok');
        renderHeader();
        renderSummary();
    } catch (err) {
        Toast.error('Execution yüklenemedi: ' + err.message);
        console.error('[execution-detail] loadExecution hatası:', err);
    }
}

function renderHeader() {
    document.getElementById('exec-title').textContent =
        execData.scenarioName || 'Çalıştırma Detayı';

    const statusStyle = {
        QUEUED:    { text: 'Kuyrukta',     color: '#ff9800', weight: 600 },
        RUNNING:   { text: 'Çalışıyor',    color: '#2196f3', weight: 700 },
        COMPLETED: { text: 'Tamamlandı',   color: '#4caf50', weight: 700 },
        FAILED:    { text: 'Başarısız',    color: '#f44336', weight: 700 },
        CANCELLED: { text: 'İptal Edildi', color: '#9e9e9e', weight: 600 },
        TIMEOUT:   { text: 'Zaman Aşımı', color: '#ff5722', weight: 700 },
    };
    const ss = statusStyle[execData.status] || { text: execData.status, color: '#9e9e9e', weight: 600 };
    const statusEl = document.getElementById('stat-status');
    statusEl.textContent      = ss.text;
    statusEl.style.color      = ss.color;
    statusEl.style.fontWeight = ss.weight;

    const isActive  = execData.status === 'QUEUED' || execData.status === 'RUNNING';
    const cancelBtn = document.getElementById('btn-cancel');
    if (cancelBtn) cancelBtn.style.display = isActive ? 'inline-flex' : 'none';
}

function renderSummary() {
    document.getElementById('stat-trigger').textContent =
        execData.triggeredByName || execData.createdBy || '—';
    document.getElementById('stat-started').textContent =
        execData.startedAt ? new Date(execData.startedAt).toLocaleString('tr-TR') : '—';
    document.getElementById('stat-duration').textContent =
        execData.durationMs != null ? (execData.durationMs / 1000).toFixed(2) + 's' : '—';

    const total  = execData.totalSteps  ?? 0;
    const passed = execData.passedSteps ?? 0;
    const failed = execData.failedSteps ?? 0;
    const successEl = document.getElementById('stat-success');
    successEl.textContent  = `${passed}/${total}`;
    successEl.style.color  = failed > 0 ? '#f44336' : (passed === total && total > 0 ? '#4caf50' : '');
}

// ─── Adım Sonuçları ────────────────────────────────────────
async function loadSteps() {
    try {
        const raw = await Api.get(`/executions/${execPublicId}/steps`);
        let stepsList = [];
        if (Array.isArray(raw))            stepsList = raw;
        else if (Array.isArray(raw?.data)) stepsList = raw.data;
        else if (raw?.content)             stepsList = raw.content;
        else if (raw?.data?.content)       stepsList = raw.data.content;
        renderSteps(stepsList);
        const countEl = document.getElementById('step-count');
        if (countEl) countEl.textContent = stepsList.length + ' adım';
    } catch (err) {
        const list = document.getElementById('steps-list');
        if (list) list.innerHTML = `<li style="padding:1rem;color:var(--clr-danger);font-size:.85rem;">
            Adım sonuçları yüklenemedi: ${Utils.escHtml(err.message)}</li>`;
        console.error('[execution-detail] loadSteps hatası:', err);
    }
}

function renderSteps(stepsList) {
    const list = document.getElementById('steps-list');
    if (!list) return;

    if (!stepsList || stepsList.length === 0) {
        const isActive = execData?.status === 'QUEUED' || execData?.status === 'RUNNING';
        list.innerHTML = `<li style="padding:1.5rem;text-align:center;color:var(--clr-text-muted);font-size:.85rem;">
            ${isActive ? '<span class="mini-spinner" style="margin-right:.5rem;"></span>Çalıştırma devam ediyor...' : 'Adım sonucu bulunamadı.'}</li>`;
        return;
    }

    list.innerHTML = stepsList.map(step => {
        const si = {
            PASSED:  { icon: '✓', color: '#4caf50' },
            FAILED:  { icon: '✗', color: '#f44336' },
            SKIPPED: { icon: '—', color: '#9e9e9e' },
            RUNNING: { icon: '▶', color: '#2196f3' },
        }[step.status] || { icon: '?', color: '#9e9e9e' };

        const dur     = step.durationMs != null ? (step.durationMs / 1000).toFixed(2) + 's' : '';
        const hasError = step.status === 'FAILED' && step.errorMessage;

        // Description: uzun URL/metin satıra sığmayınca alt satıra geçsin,
        // taşma olmasın — word-break + overflow-wrap ile çözüldü.
        // ellipsis kaldırıldı; yerine max 2 satır + title tooltip eklendi.
        const descHtml = step.description ? `
            <div title="${Utils.escHtml(step.description)}"
                 style="font-size:.72rem;color:var(--clr-text-muted);margin-top:1px;
                        overflow:hidden;display:-webkit-box;
                        -webkit-line-clamp:2;-webkit-box-orient:vertical;
                        word-break:break-all;overflow-wrap:anywhere;">
                ${Utils.escHtml(step.description)}
            </div>` : '';

        const errHtml = hasError ? `
            <div class="step-err" style="display:none;margin-top:.4rem;
                 padding:.35rem .5rem;background:rgba(244,67,54,.08);
                 border-left:2px solid #f44336;border-radius:3px;
                 font-family:var(--font-ui);font-size:.7rem;color:#f44336;
                 white-space:pre-wrap;word-break:break-all;overflow-wrap:anywhere;">
                ${Utils.escHtml(step.errorMessage)}
            </div>` : '';

        const ssHtml = step.screenshotPath ? `
            <button onclick="event.stopPropagation();openScreenshot(${step.id})"
                style="margin-top:.3rem;background:none;border:none;
                       color:var(--clr-primary);font-size:.7rem;cursor:pointer;
                       padding:0;font-family:var(--font-body);">
                Screenshot
            </button>` : '';

        return `
            <li class="step-item" style="cursor:${hasError ? 'pointer' : 'default'};"
                onclick="${hasError ? `this.querySelector('.step-err').style.display=this.querySelector('.step-err').style.display==='none'?'block':'none'` : ''}">
                <span style="font-size:1rem;color:${si.color};flex-shrink:0;margin-top:.05rem;">${si.icon}</span>
                <div style="flex:1;min-width:0;overflow:hidden;">
                    <div style="font-weight:600;font-size:.8rem;font-family:var(--font-ui);color:var(--clr-text);">
                        ${Utils.escHtml(step.actionType || '—')}
                    </div>
                    ${descHtml}${errHtml}${ssHtml}
                </div>
                <span style="font-size:.7rem;color:var(--clr-text-muted);flex-shrink:0;margin-top:.1rem;">${dur}</span>
            </li>`;
    }).join('');
}

function openScreenshot(stepId) {
    const token = Store.getAccessToken();
    window.open(
        `${BACKEND_BASE}/executions/${execPublicId}/screenshots/${stepId}?token=${encodeURIComponent(token)}`,
        '_blank'
    );
}

// ─── SSE Canlı Log ────────────────────────────────────────
function tryOpenSSE() {
    const token = Store.getAccessToken();
    if (!token) {
        appendLog('warn', 'Access token bulunamadı.');
        updateSseStatus('closed');
        startPolling();
        return;
    }

    const sseUrl = `${BACKEND_BASE}/executions/${execPublicId}/stream?token=${encodeURIComponent(token)}`;
    updateSseStatus('connecting');
    appendLog('info', 'Canlı log bağlantısı kuruluyor...');

    try {
        eventSource = new EventSource(sseUrl);
        window.currentSSE = eventSource;
    } catch (e) {
        appendLog('error', 'EventSource açılamadı: ' + e.message);
        updateSseStatus('closed');
        startPolling();
        return;
    }

    eventSource.addEventListener('connected', () => {
        updateSseStatus('connected');
        appendLog('info', 'Bağlantı kuruldu. Loglar akıyor...');
    });

    eventSource.addEventListener('log', (e) => {
        try {
            const entry = JSON.parse(e.data);
            const level = (entry.logLevel || entry.level || 'INFO').toLowerCase();
            if (entry.id) lastLogId = Math.max(lastLogId, entry.id);
            appendLog(level, entry.message || '');
        } catch {
            appendLog('info', String(e.data));
        }
    });

    eventSource.addEventListener('execution-finished', async (e) => {
        try {
            const data = JSON.parse(e.data);
            appendLog('info', `Çalıştırma tamamlandı — Durum: ${data.status || '?'}`);
        } catch {}
        closeSSE();
        stopPolling();
        updateSseStatus('closed');
        await loadExecution();
        await loadSteps();
        Toast.success('Çalıştırma tamamlandı!');
    });

    eventSource.onerror = async () => {
        closeSSE();
        if (!execData || execData.status === 'QUEUED' || execData.status === 'RUNNING') {
            appendLog('warn', 'SSE bağlantısı kesildi. Polling moduna geçiliyor...');
            updateSseStatus('polling');
            startPolling();
        } else {
            appendLog('info', 'Bağlantı kapatıldı (execution tamamlandı).');
            updateSseStatus('closed');
        }
    };
}

function closeSSE() {
    if (eventSource) { eventSource.close(); eventSource = null; }
    window.currentSSE = null;
}

// ─── Polling Fallback ──────────────────────────────────────
function startPolling() {
    if (pollingTimer) return;
    appendLog('info', 'Polling modu aktif (3sn)...');

    pollingTimer = setInterval(async () => {
        try {
            const raw  = await Api.get(`/executions/${execPublicId}`);
            const exec = raw?.publicId ? raw : (raw?.data ?? raw);

            if (exec?.status !== execData?.status) {
                execData = exec;
                renderHeader();
                renderSummary();
            }

            const logsRaw = await Api.get(`/executions/${execPublicId}/logs`, { size: 50, sort: 'occurredAt,asc' });
            let logItems = [];
            if (logsRaw?.content)           logItems = logsRaw.content;
            else if (Array.isArray(logsRaw)) logItems = logsRaw;
            else if (logsRaw?.data?.content) logItems = logsRaw.data.content;

            logItems.filter(l => l.id > lastLogId).forEach(l => {
                lastLogId = Math.max(lastLogId, l.id);
                appendLog((l.logLevel || 'INFO').toLowerCase(), l.message || '');
            });

            if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(exec?.status)) {
                stopPolling();
                updateSseStatus('closed');
                await loadSteps();
                Toast.success('Çalıştırma tamamlandı.');
            }
        } catch (err) {
            console.warn('[polling] hata:', err.message);
        }
    }, 3000);
}

function stopPolling() {
    if (pollingTimer !== null && pollingTimer !== undefined) {
        clearInterval(pollingTimer);
        pollingTimer = null;
    }
}

// ─── Log Paneli ───────────────────────────────────────────
// Uzun URL/mesajlar satıra sığmazsa alt satıra geçer — log panel bozulmaz.
function appendLog(level, msg) {
    const panel = document.getElementById('log-panel');
    if (!panel) return;

    const colorMap = {
        error: '#ef5350',
        warn:  '#ffa726',
        debug: '#64b5f6',
        info:  '#b0bec5',
    };
    const levelColor = colorMap[level] || '#b0bec5';
    const msgColor   = level === 'error' ? '#ef5350' : level === 'warn' ? '#ffa726' : '#cfd8dc';
    const ts = new Date().toLocaleTimeString('tr-TR');

    const line = document.createElement('div');
    // word-break:break-all + overflow-wrap:anywhere → uzun URL'ler container'ı taşırmaz
    line.style.cssText = `
        margin-bottom: .15rem;
        line-height: 1.55;
        word-break: break-all;
        overflow-wrap: anywhere;
        max-width: 100%;
    `;
    line.innerHTML =
        `<span style="color:#424242;font-size:.68rem;">${ts}</span> ` +
        `<span style="color:${levelColor};font-size:.72rem;font-weight:600;">[${level.toUpperCase()}]</span> ` +
        `<span style="font-size:.76rem;color:${msgColor};">${Utils.escHtml(msg)}</span>`;

    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
}

// ─── SSE Durum Göstergesi ─────────────────────────────────
function updateSseStatus(status) {
    const dot   = document.getElementById('sse-dot');
    const label = document.getElementById('sse-label');
    const cfg = {
        connecting: { color: '#ff9800', text: 'Bağlanıyor...', anim: false },
        connected:  { color: '#4caf50', text: 'Canlı',         anim: true  },
        polling:    { color: '#2196f3', text: 'Polling',        anim: false },
        closed:     { color: '#616161', text: 'Bağlantı Kapalı', anim: false },
    };
    const c = cfg[status] || cfg.closed;
    if (dot)   { dot.style.background = c.color; dot.style.animation = c.anim ? 'pulse-green 1.5s ease infinite' : 'none'; }
    if (label) label.textContent = c.text;
}

// ─── Aksiyonlar ───────────────────────────────────────────
function setupActions() {
    document.getElementById('btn-cancel')?.addEventListener('click', async () => {
        if (!confirm('Çalıştırmayı iptal etmek istediğinize emin misiniz?')) return;
        try {
            await Api.post(`/executions/${execPublicId}/cancel`, {});
            Toast.success('İptal sinyali gönderildi');
            closeSSE();
            stopPolling();
            await loadExecution();
        } catch (err) {
            Toast.error('İptal hatası: ' + err.message);
        }
    });

    document.getElementById('btn-pdf')?.addEventListener('click', () => downloadReport('pdf'));
    document.getElementById('btn-excel')?.addEventListener('click', () => downloadReport('excel'));
}

async function downloadReport(type) {
    const btn = document.getElementById(type === 'pdf' ? 'btn-pdf' : 'btn-excel');
    if (!btn) return;
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:.8rem;height:.8rem;"></span>';

    try {
        const token = Store.getAccessToken();
        const res = await fetch(
            `${BACKEND_BASE}/reports/executions/${execPublicId}/export/${type}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `report-${execPublicId}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        Toast.success('Rapor indirildi');
    } catch (err) {
        Toast.error('İndirme hatası: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = orig;
    }
}

window.addEventListener('beforeunload', () => {
    closeSSE();
    stopPolling();
});