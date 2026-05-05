// Faz F6 — Çalıştırma Detayı + SSE Canlı Log
let execPublicId = null;
let execData = null;
let eventSource = null;

(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }
    const params = new URLSearchParams(window.location.search);
    execPublicId = params.get('id');
    if (!execPublicId) { Toast.error('ID bulunamadı'); return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Çalıştırma Detayı');

    setupActions();
    await loadExecution();
    await loadSteps();

    if (execData?.status === 'QUEUED' || execData?.status === 'RUNNING') {
        openSSE();
    } else {
        loadHistoricalLogs();
    }
})();

async function loadExecution() {
    try {
        const response = await Api.get(`/executions/${execPublicId}`);
        let data = response;
        if (!data || typeof data !== 'object') {
            if (response?.data) data = response.data;
            else throw new Error('Geçersiz veri');
        }
        execData = data;
        renderHeader();
        renderSummary();
    } catch (err) {
        Toast.error('Yükleme hatası: ' + err.message);
    }
}

function renderHeader() {
    document.getElementById('exec-title').textContent = execData.scenarioName || 'Çalıştırma Detayı';
    document.getElementById('stat-status').textContent = execData.status || '—';
    const cancelBtn = document.getElementById('btn-cancel');
    if (execData.status === 'QUEUED' || execData.status === 'RUNNING') {
        cancelBtn.style.display = 'block';
    } else {
        cancelBtn.style.display = 'none';
    }
}

function renderSummary() {
    document.getElementById('stat-trigger').textContent = execData.triggeredByName || execData.createdBy || '—';
    document.getElementById('stat-started').textContent = execData.startedAt ? new Date(execData.startedAt).toLocaleString('tr-TR') : '—';
    document.getElementById('stat-duration').textContent = execData.durationMs ? (execData.durationMs / 1000).toFixed(2) + 's' : '—';
    const total = execData.totalSteps || 0;
    const passed = execData.passedSteps || 0;
    const failed = execData.failedSteps || 0;
    document.getElementById('stat-success').textContent = `${passed}/${total}`;
}

async function loadSteps() {
    try {
        const response = await Api.get(`/executions/${execPublicId}/steps`);
        let steps = [];
        if (Array.isArray(response)) steps = response;
        else if (response?.content) steps = response.content;
        else if (response?.data) steps = Array.isArray(response.data) ? response.data : response.data.content || [];

        renderSteps(steps);
    } catch (err) {
        document.getElementById('steps-list').innerHTML = `<li style="padding: 1rem; color: var(--clr-danger);">Yükleme hatası: ${err.message}</li>`;
    }
}

function renderSteps(steps) {
    const list = document.getElementById('steps-list');
    if (steps.length === 0) {
        list.innerHTML = `<li style="padding: 1rem; color: var(--clr-text-muted);">Adım yok</li>`;
        return;
    }

    list.innerHTML = steps.map((step, idx) => {
        const icon = step.status === 'PASSED' ? '✓' : step.status === 'FAILED' ? '✗' : step.status === 'SKIPPED' ? '—' : '▶';
        const iconClass = step.status === 'PASSED' ? 'color: #4caf50;' : step.status === 'FAILED' ? 'color: #f44336;' : 'color: var(--clr-text-muted);';
        const hasError = step.status === 'FAILED' && step.errorMessage;

        return `
            <li class="step-item" ${hasError ? `onclick="this.classList.toggle('expanded')"` : ''}>
                <span class="step-icon" style="${iconClass}">${icon}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.85rem;">${Utils.escHtml(step.actionType || '—')}</div>
                    ${step.description ? `<div style="font-size: 0.75rem; color: var(--clr-text-muted);">${Utils.escHtml(step.description)}</div>` : ''}
                    ${step.screenshotPath ? `<button onclick="window.open('/api/v1/executions/${execPublicId}/screenshots/${step.id}', '_blank')" class="btn-link" style="font-size: 0.75rem;">📷 Screenshot</button>` : ''}
                </div>
                <span style="font-size: 0.75rem; color: var(--clr-text-muted);">${step.durationMs ? (step.durationMs / 1000).toFixed(2) + 's' : ''}</span>
            </li>
            ${hasError ? `<li style="padding: 0.75rem 1rem; background: rgba(244,67,54,.08); color: #f44336; font-family: monospace; font-size: 0.75rem; border-left: 2px solid #f44336; white-space: pre-wrap;">${Utils.escHtml(step.errorMessage)}</li>` : ''}
        `;
    }).join('');
}

function openSSE() {
    const token = Store.getAccessToken();
    const url = `/api/v1/executions/${execPublicId}/stream?token=${token}`;

    eventSource = new EventSource(url);
    updateSseStatus('connected');

    eventSource.addEventListener('log', (e) => {
        try {
            const entry = JSON.parse(e.data);
            const level = (entry.logLevel || entry.level || 'INFO').toLowerCase();
            const msg = entry.message || '';
            appendLog(level, msg);
        } catch {}
    });

    eventSource.addEventListener('execution-finished', async () => {
        if (eventSource) eventSource.close();
        updateSseStatus('closed');
        await loadExecution();
        await loadSteps();
        Toast.success('Tamamlandı');
    });

    eventSource.onerror = () => {
        if (eventSource) eventSource.close();
        updateSseStatus('closed');
    };
}

function loadHistoricalLogs() {
    appendLog('info', 'Çalıştırma tamamlandı');
}

function appendLog(level, msg) {
    const panel = document.getElementById('log-panel');
    const line = document.createElement('div');
    const levelClass = `log-${level}`;
    line.innerHTML = `<span style="color: var(--clr-text-muted); font-size: 0.75rem;">${new Date().toLocaleTimeString()}</span> <span style="color: ${level === 'error' ? '#f44336' : level === 'warn' ? '#ffc107' : level === 'debug' ? '#90caf9' : '#e0e0e0'};">[${level.toUpperCase()}]</span> ${Utils.escHtml(msg)}`;
    line.style.marginBottom = '0.25rem';
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
}

function updateSseStatus(status) {
    const dot = document.getElementById('sse-dot') || document.querySelector('.sse-dot');
    if (!dot) return;
    dot.className = 'sse-dot';
    if (status === 'connecting') {
        dot.classList.add('connecting');
        document.getElementById('sse-label').textContent = 'Bağlanıyor…';
    } else if (status === 'connected') {
        document.getElementById('sse-label').textContent = 'Canlı';
    } else {
        dot.classList.add('closed');
        document.getElementById('sse-label').textContent = 'Bağlantı Kapalı';
    }
}

function setupActions() {
    document.getElementById('btn-cancel')?.addEventListener('click', async () => {
        if (!confirm('Çalıştırmayı iptal etmek istediğinize emin misiniz?')) return;
        try {
            await Api.post(`/executions/${execPublicId}/cancel`, {});
            Toast.success('İptal sinyali gönderildi');
            await loadExecution();
        } catch (err) {
            Toast.error('İptal hatası: ' + err.message);
        }
    });

    document.getElementById('btn-pdf')?.addEventListener('click', () => downloadReport('pdf'));
    document.getElementById('btn-excel')?.addEventListener('click', () => downloadReport('excel'));
}

async function downloadReport(type) {
    const btn = type === 'pdf' ? document.getElementById('btn-pdf') : document.getElementById('btn-excel');
    const orig = btn.textContent;
    btn.disabled = true;

    try {
        const token = Store.getAccessToken();
        const url = `/api/v1/reports/executions/${execPublicId}/export/${type}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `report-${execPublicId}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        Toast.success('İndirildi');
    } catch (err) {
        Toast.error(`İndirme hatası: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = orig;
    }
}

window.addEventListener('beforeunload', () => {
    if (eventSource) eventSource.close();
});

