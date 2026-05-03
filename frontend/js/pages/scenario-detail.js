// ╔══════════════════════════════════════════════════════╗
// ║  F5 — Senaryo Detay / Step Editor                   ║
// ║  Diyagram + Tablo modları, sürükle-bırak, auto-save ║
// ╚══════════════════════════════════════════════════════╝

// ── Durum ────────────────────────────────────────────────
let scenarioPublicId = null;
let scenarioData = null;
let actionMetadata = [];   // GET /steps/action-metadata
let steps = [];            // Mevcut adım listesi (ortak state)
let selectedStepId = null; // Seçili adımın publicId'si
let viewMode = 'diagram';  // 'diagram' | 'table'

// Diyagram için transform
let panX = 0, panY = 0, zoom = 1;
let isPanning = false, panStartX = 0, panStartY = 0;

// Sürükle-bırak
let dragNodeId = null;      // Canvas içi node sürükleme
let dragOffsetX = 0, dragOffsetY = 0;
let nodePositions = {};     // { publicId: { x, y } } — sadece UI, DB'de yok

// Auto-save debounce
let autoSaveTimer = null;

// ── Init ─────────────────────────────────────────────────
(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    // URL'den publicId al: scenario-detail.html?id=xxx
    const params = new URLSearchParams(window.location.search);
    scenarioPublicId = params.get('id');
    if (!scenarioPublicId) { Toast.error('Senaryo ID bulunamadı'); return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Senaryo Detayı');

    setupViewToggle();
    setupCanvasInteraction();
    setupDropZone();
    setupPropsActions();

    await Promise.all([
        loadActionMetadata(),
        loadScenario(),
    ]);
    await loadSteps();
})();

// ── Senaryo Yükle ─────────────────────────────────────────
async function loadScenario() {
    try {
        scenarioData = await Api.get(`/scenarios/${scenarioPublicId}`);
        document.getElementById('breadcrumb-name').textContent = scenarioData.name;
        document.title = `ZeroStep — ${scenarioData.name}`;

        // Çalıştır butonu: sadece READY durumunda aktif
        const runBtn = document.getElementById('btn-run');
        runBtn.disabled = scenarioData.status !== 'READY';
        runBtn.addEventListener('click', runScenario);

        // Kaydet butonu
        document.getElementById('btn-save').addEventListener('click', () => {
            Toast.info('Değişiklikler otomatik kaydedilir.');
        });
    } catch (err) {
        Toast.error('Senaryo yüklenemedi: ' + err.message);
    }
}

// ── Action Metadata ───────────────────────────────────────
async function loadActionMetadata() {
    try {
        actionMetadata = await Api.get('/steps/action-metadata');
        renderToolPalette(actionMetadata);
    } catch (err) {
        Toast.error('Action metadata alınamadı');
    }
}

// ── Adımları Yükle ────────────────────────────────────────
async function loadSteps() {
    try {
        steps = await Api.get(`/scenarios/${scenarioPublicId}/steps`);
        steps.sort((a, b) => a.stepOrder - b.stepOrder);
        renderAll();
    } catch (err) {
        Toast.error('Adımlar yüklenemedi: ' + err.message);
    }
}

// ── Görünüm Senkronizasyonu ───────────────────────────────
function renderAll() {
    if (viewMode === 'diagram') {
        renderDiagram();
    } else {
        renderTable();
    }
    updateEmptyState();
}

// ── Araç Paleti ───────────────────────────────────────────
function renderToolPalette(metadata) {
    const palette = document.getElementById('action-palette');

    // Kategoriye göre grupla
    const groups = {};
    metadata.forEach(m => {
        if (!groups[m.category]) groups[m.category] = [];
        groups[m.category].push(m);
    });

    const categoryIcons = {
        'Navigation': '&#8594;', 'Mouse': '&#9654;', 'Input': '&#9998;',
        'Scroll': '&#8645;', 'Wait': '&#9719;', 'Assert': '&#10003;',
        'Frame': '&#9633;', 'Storage': '&#9781;', 'Misc': '&#9881;',
    };

    palette.innerHTML = Object.entries(groups).map(([cat, items]) => `
        <div class="tool-category" data-category="${Utils.escHtml(cat)}">
            <div class="tool-category-label">${categoryIcons[cat] || '◆'} ${Utils.escHtml(cat)}</div>
            ${items.map(item => `
                <div class="tool-card"
                     draggable="true"
                     data-action="${Utils.escHtml(item.actionType)}"
                     title="${Utils.escHtml(item.description)}">
                    <span class="tool-card-icon">${categoryIcons[item.category] || '◆'}</span>
                    <span class="tool-card-name">${Utils.escHtml(item.displayName)}</span>
                </div>
            `).join('')}
        </div>
    `).join('');

    // Sürüklemeyi başlat
    palette.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('action-type', card.dataset.action);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    // Arama
    document.getElementById('action-search').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        palette.querySelectorAll('.tool-card').forEach(card => {
            card.style.display = card.dataset.action.toLowerCase().includes(q) ||
            card.querySelector('.tool-card-name').textContent.toLowerCase().includes(q)
                ? '' : 'none';
        });
        palette.querySelectorAll('.tool-category').forEach(cat => {
            const visible = [...cat.querySelectorAll('.tool-card')].some(c => c.style.display !== 'none');
            cat.style.display = visible ? '' : 'none';
        });
    });
}

// ── Görünüm Geçişi ────────────────────────────────────────
function setupViewToggle() {
    document.getElementById('btn-view-diagram').addEventListener('click', () => {
        if (viewMode === 'diagram') return;
        viewMode = 'diagram';
        document.getElementById('btn-view-diagram').classList.add('active');
        document.getElementById('btn-view-table').classList.remove('active');
        document.getElementById('diagram-canvas').style.display = '';
        document.getElementById('table-canvas').style.display = 'none';
        renderDiagram();
    });

    document.getElementById('btn-view-table').addEventListener('click', () => {
        if (viewMode === 'table') return;
        viewMode = 'table';
        document.getElementById('btn-view-table').classList.add('active');
        document.getElementById('btn-view-diagram').classList.remove('active');
        document.getElementById('diagram-canvas').style.display = 'none';
        document.getElementById('table-canvas').style.display = '';
        renderTable();
    });
}

// ── Empty State ───────────────────────────────────────────
function updateEmptyState() {
    document.getElementById('canvas-empty').style.display = steps.length === 0 ? 'flex' : 'none';
}

// ══════════════════════════════════════════════════════════
// DİYAGRAM MODU
// ══════════════════════════════════════════════════════════

function renderDiagram() {
    const viewport = document.getElementById('diagram-viewport');

    // Mevcut nodeları temizle (SVG hariç)
    [...viewport.children].forEach(el => {
        if (el.id !== 'connections-svg') el.remove();
    });

    const GAP_X = 280;
    const START_X = 60;
    const START_Y = 80;

    steps.forEach((step, idx) => {
        // Pozisyon: önceden kaydedildiyse onu kullan, yoksa hesapla
        if (!nodePositions[step.publicId]) {
            nodePositions[step.publicId] = {
                x: START_X + idx * GAP_X,
                y: START_Y,
            };
        }
        const pos = nodePositions[step.publicId];
        const node = createNode(step, pos.x, pos.y, idx + 1);
        viewport.appendChild(node);
    });

    renderConnections();
    applyTransform();
}

function createNode(step, x, y, orderNum) {
    const meta = actionMetadata.find(m => m.actionType === step.actionType) || {};
    const isSelected = step.publicId === selectedStepId;

    const node = document.createElement('div');
    node.className = `step-node${isSelected ? ' selected' : ''}${!step.enabled ? ' disabled-node' : ''}`;
    node.style.left = x + 'px';
    node.style.top  = y + 'px';
    node.dataset.id = step.publicId;

    node.innerHTML = `
        <div class="node-port port-in"></div>
        <div class="node-header">
            <span class="node-order">${orderNum}</span>
            <span class="node-action">${Utils.escHtml(meta.displayName || step.actionType)}</span>
            <button class="node-menu-btn" data-node-id="${Utils.escHtml(step.publicId)}">&#8942;</button>
        </div>
        <div class="node-body">
            <div class="node-desc">${Utils.escHtml(step.description || step.selectorValue || step.inputValue || '—')}</div>
        </div>
        <div class="node-port port-out"></div>
    `;

    // Node seçimi
    node.addEventListener('click', e => {
        if (e.target.closest('.node-menu-btn')) return;
        selectStep(step.publicId);
    });

    // Sağ tık / üç nokta menü
    node.querySelector('.node-menu-btn').addEventListener('click', e => {
        e.stopPropagation();
        showNodeContextMenu(e, step.publicId);
    });
    node.addEventListener('contextmenu', e => {
        e.preventDefault();
        showNodeContextMenu(e, step.publicId);
    });

    // Node sürükleme (canvas içi yeniden konumlandırma)
    node.addEventListener('mousedown', e => {
        if (e.target.closest('.node-menu-btn') || e.button !== 0) return;
        dragNodeId = step.publicId;
        const rect = node.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        e.preventDefault();
    });

    return node;
}

function renderConnections() {
    const svg = document.getElementById('connections-svg');
    svg.innerHTML = '';

    for (let i = 0; i < steps.length - 1; i++) {
        const from = steps[i];
        const to   = steps[i + 1];
        const fPos = nodePositions[from.publicId];
        const tPos = nodePositions[to.publicId];
        if (!fPos || !tPos) continue;

        // Çıkış: node sağ ortası (220px genişlik)
        const x1 = fPos.x + 220;
        const y1 = fPos.y + 38;
        // Giriş: node sol ortası
        const x2 = tPos.x;
        const y2 = tPos.y + 38;

        const cp = (x2 - x1) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'conn-path');
        path.setAttribute('d', `M${x1},${y1} C${x1+cp},${y1} ${x2-cp},${y2} ${x2},${y2}`);
        svg.appendChild(path);
    }
}

// ── Canvas Pan + Zoom ─────────────────────────────────────
function setupCanvasInteraction() {
    const surface = document.querySelector('.diagram-surface');

    // Pan: Space + Sol Tık
    surface.addEventListener('mousedown', e => {
        if (e.button === 1 || (e.button === 0 && e.getModifierState('Space'))) {
            isPanning = true;
            panStartX = e.clientX - panX;
            panStartY = e.clientY - panY;
            surface.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', e => {
        if (isPanning) {
            panX = e.clientX - panStartX;
            panY = e.clientY - panStartY;
            applyTransform();
        }

        // Node sürükleme
        if (dragNodeId) {
            const viewport = document.getElementById('diagram-viewport');
            const rect = viewport.getBoundingClientRect();
            const newX = (e.clientX - rect.left - dragOffsetX) / zoom;
            const newY = (e.clientY - rect.top  - dragOffsetY) / zoom;
            nodePositions[dragNodeId] = { x: newX, y: newY };
            const node = viewport.querySelector(`[data-id="${dragNodeId}"]`);
            if (node) { node.style.left = newX + 'px'; node.style.top = newY + 'px'; }
            renderConnections();
        }
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        dragNodeId = null;
        surface.style.cursor = '';
    });

    // Zoom: Ctrl + Tekerlek
    surface.addEventListener('wheel', e => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoom = Math.max(0.3, Math.min(2, zoom * delta));
        applyTransform();
    }, { passive: false });
}

function applyTransform() {
    document.getElementById('diagram-viewport').style.transform =
        `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

// ── Drop Zone (Araç paletinden canvas'a sürükleme) ────────
function setupDropZone() {
    const overlay = document.getElementById('drop-overlay');
    const surface = document.querySelector('.diagram-surface');

    surface.addEventListener('dragover', e => {
        e.preventDefault();
        overlay.classList.add('dragover');
    });

    surface.addEventListener('dragleave', () => {
        overlay.classList.remove('dragover');
    });

    surface.addEventListener('drop', async e => {
        e.preventDefault();
        overlay.classList.remove('dragover');
        const actionType = e.dataTransfer.getData('action-type');
        if (!actionType) return;

        // Bırakma konumunu viewport koordinatına çevir
        const rect = document.getElementById('diagram-viewport').getBoundingClientRect();
        const dropX = (e.clientX - rect.left) / zoom;
        const dropY = (e.clientY - rect.top) / zoom;

        await createStepFromDrop(actionType, dropX, dropY);
    });

    // Tablo modu drop
    document.getElementById('table-canvas').addEventListener('dragover', e => e.preventDefault());
    document.getElementById('table-canvas').addEventListener('drop', async e => {
        e.preventDefault();
        const actionType = e.dataTransfer.getData('action-type');
        if (!actionType) return;
        await createStepFromDrop(actionType, 0, 0);
    });
}

async function createStepFromDrop(actionType, dropX, dropY) {
    // Geçici loading node göster
    const tempId = 'temp_' + Date.now();
    const viewport = document.getElementById('diagram-viewport');
    const tempNode = document.createElement('div');
    tempNode.className = 'step-node';
    tempNode.id = tempId;
    tempNode.style.cssText = `left:${dropX}px;top:${dropY}px;opacity:.5;`;
    tempNode.innerHTML = `<div class="node-loading"><span class="spinner"></span></div>
        <div class="node-header"><span class="node-action">${Utils.escHtml(actionType)}</span></div>`;
    if (viewMode === 'diagram') viewport.appendChild(tempNode);

    try {
        const newStep = await Api.post(`/scenarios/${scenarioPublicId}/steps`, {
            actionType,
        });

        // Pozisyonu kaydet
        nodePositions[newStep.publicId] = { x: dropX, y: dropY };

        // State güncelle
        steps.push(newStep);
        steps.sort((a, b) => a.stepOrder - b.stepOrder);

        renderAll();
        selectStep(newStep.publicId);
        setAutosaveState('saved');
        Toast.success('Adım eklendi');
    } catch (err) {
        Toast.error('Adım eklenemedi: ' + err.message);
    } finally {
        document.getElementById(tempId)?.remove();
    }
}

// ══════════════════════════════════════════════════════════
// TABLO MODU
// ══════════════════════════════════════════════════════════

function renderTable() {
    const tbody = document.getElementById('step-tbody');

    if (steps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--clr-text-muted)">
            Henüz adım yok. Sol panelden sürükleyin.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = steps.map((step, idx) => {
        const meta = actionMetadata.find(m => m.actionType === step.actionType) || {};
        const isSelected = step.publicId === selectedStepId;

        return `
        <tr class="${isSelected ? 'selected-row' : ''}${!step.enabled ? ' disabled-row' : ''}"
            data-id="${Utils.escHtml(step.publicId)}"
            draggable="true">
            <td><span class="drag-handle" title="Sürükle">&#8597;</span></td>
            <td style="color:var(--clr-text-muted);font-size:.8rem;">${idx + 1}</td>
            <td>
                <div style="font-weight:600;font-size:.82rem;font-family:var(--font-ui)">
                    ${Utils.escHtml(meta.displayName || step.actionType)}
                </div>
                ${step.description ? `<div style="font-size:.75rem;color:var(--clr-text-muted)">${Utils.escHtml(step.description)}</div>` : ''}
            </td>
            <td style="font-size:.78rem;font-family:var(--font-ui);color:var(--clr-text-muted)">
                ${step.selectorType ? `<span>${Utils.escHtml(step.selectorType)}</span>` : ''}
                ${step.selectorValue ? `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px">${Utils.escHtml(step.selectorValue)}</div>` : '—'}
            </td>
            <td style="font-size:.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${step.sensitive || step.actionType === 'TYPE_SECRET'
            ? '<span style="color:var(--clr-text-muted)">••••••</span>'
            : Utils.escHtml(step.inputValue || '—')}
            </td>
            <td>
                <span class="badge ${step.enabled ? 'badge-success' : 'badge-neutral'}">
                    ${step.enabled ? 'Aktif' : 'Pasif'}
                </span>
            </td>
            <td>
                <div class="flex gap-1">
                    <button class="btn-icon" onclick="duplicateStep('${Utils.escHtml(step.publicId)}')" title="Kopyala">&#10064;</button>
                    <button class="btn-icon" style="color:var(--clr-danger)" onclick="deleteStep('${Utils.escHtml(step.publicId)}')" title="Sil">&#10005;</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Satır tıklama -> seç
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.closest('button')) return;
            selectStep(row.dataset.id);
        });
    });

    // Tablo D&D sıralama
    setupTableDragSort();
}

function setupTableDragSort() {
    const tbody = document.getElementById('step-tbody');
    let dragRow = null;

    tbody.querySelectorAll('tr[draggable]').forEach(row => {
        row.addEventListener('dragstart', () => {
            dragRow = row;
            setTimeout(() => row.classList.add('row-dragging'), 0);
        });

        row.addEventListener('dragend', () => {
            row.classList.remove('row-dragging');
            dragRow = null;
        });

        row.addEventListener('dragover', e => {
            e.preventDefault();
            if (!dragRow || dragRow === row) return;
            const rows = [...tbody.querySelectorAll('tr')];
            const dragIdx = rows.indexOf(dragRow);
            const targetIdx = rows.indexOf(row);
            if (dragIdx < targetIdx) row.after(dragRow);
            else row.before(dragRow);
        });

        row.addEventListener('drop', async e => {
            e.preventDefault();
            if (!dragRow || dragRow === row) return;
            await reorderFromTable();
        });
    });
}

async function reorderFromTable() {
    // Tablodaki sırayı okuyup reorder API'sini çağır
    const rows = [...document.querySelectorAll('#step-tbody tr[data-id]')];
    const newOrder = rows.map(r => r.dataset.id);

    // Hangi step hangi konuma geçti? Sadece değişenler için PATCH at
    const originalOrder = steps.map(s => s.publicId);
    let firstChanged = -1;
    for (let i = 0; i < newOrder.length; i++) {
        if (newOrder[i] !== originalOrder[i]) { firstChanged = i; break; }
    }
    if (firstChanged === -1) return;

    const movedId = newOrder[firstChanged];
    const afterId = firstChanged > 0 ? newOrder[firstChanged - 1] : null;
    const beforeId = firstChanged < newOrder.length - 1 ? newOrder[firstChanged + 1] : null;

    try {
        const updated = await Api.patch(`/steps/${movedId}/reorder`, {
            afterStepPublicId: afterId,
            beforeStepPublicId: afterId ? null : beforeId,
        });

        // State güncelle
        const stepIdx = steps.findIndex(s => s.publicId === movedId);
        if (stepIdx !== -1) steps[stepIdx].stepOrder = updated.stepOrder;
        steps.sort((a, b) => a.stepOrder - b.stepOrder);

        renderAll();
        setAutosaveState('saved');
    } catch (err) {
        Toast.error('Sıralama kaydedilemedi: ' + err.message);
        await loadSteps();
    }
}

// ══════════════════════════════════════════════════════════
// ADIM SEÇME & SAĞ PANEL
// ══════════════════════════════════════════════════════════

function selectStep(publicId) {
    selectedStepId = publicId;
    renderAll(); // Node'u selected olarak yeniden çiz

    const step = steps.find(s => s.publicId === publicId);
    if (!step) return;

    renderPropsPanel(step);
}

function renderPropsPanel(step) {
    const meta = actionMetadata.find(m => m.actionType === step.actionType) || {};
    const propsBody = document.getElementById('props-body');
    document.getElementById('props-actions').style.display = 'flex';

    propsBody.innerHTML = `
        <!-- Temel bilgi -->
        <div class="form-section">
            <div class="form-section-label">Aksiyon</div>
            <div style="font-family:var(--font-ui);font-weight:700;font-size:.9rem;color:var(--clr-primary-h)">
                ${Utils.escHtml(meta.displayName || step.actionType)}
            </div>
            <div style="font-size:.75rem;color:var(--clr-text-muted);margin-top:.25rem">
                ${Utils.escHtml(meta.description || '')}
            </div>
        </div>

        <!-- Açıklama -->
        <div class="form-section">
            <div class="form-section-label">Açıklama</div>
            <textarea class="form-input" id="prop-description" rows="2"
                placeholder="Bu adımın ne yaptığını açıklayın...">${Utils.escHtml(step.description || '')}</textarea>
        </div>

        ${meta.requiresSelector ? `
        <!-- Selector -->
        <div class="form-section">
            <div class="form-section-label">Selector</div>
            <div class="form-group" style="margin-bottom:.5rem">
                <select class="form-input" id="prop-selectorType">
                    ${['CSS','XPATH','ID','NAME','CLASS_NAME','TAG_NAME','LINK_TEXT','PARTIAL_LINK_TEXT']
        .map(t => `<option value="${t}" ${step.selectorType === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <input class="form-input" type="text" id="prop-selectorValue"
                    placeholder="${Utils.escHtml(meta.inputValueHint || 'Selector değeri')}"
                    value="${Utils.escHtml(step.selectorValue || '')}">
            </div>
        </div>
        ` : ''}

        ${meta.requiresInputValue ? `
        <!-- Input Value -->
        <div class="form-section">
            <div class="form-section-label">
                ${meta.isSensitive ? '&#128274; Değer (Gizli)' : 'Değer'}
            </div>
            <input class="form-input" type="${meta.sensitive ? 'password' : 'text'}"
                id="prop-inputValue"
                placeholder="${Utils.escHtml(meta.inputValueHint || 'Değer girin')}"
                value="${meta.sensitive ? '' : Utils.escHtml(step.inputValue || '')}">
            ${meta.sensitive ? `<p style="font-size:.72rem;color:var(--clr-text-muted);margin-top:.3rem">Güvenlik için mevcut değer gösterilmiyor.</p>` : ''}
        </div>
        ` : ''}

        ${meta.requiresSecondaryValue ? `
        <!-- Secondary Value -->
        <div class="form-section">
            <div class="form-section-label">${Utils.escHtml(meta.secondaryValueHint || 'İkincil Değer')}</div>
            <input class="form-input" type="text" id="prop-secondaryValue"
                placeholder="${Utils.escHtml(meta.secondaryValueHint || '')}"
                value="${Utils.escHtml(step.secondaryValue || '')}">
        </div>
        ` : ''}

        <!-- Gelişmiş Ayarlar -->
        <div class="form-section">
            <div class="form-section-label">Gelişmiş Ayarlar</div>

            <div class="toggle-row">
                <span class="toggle-label">Aktif</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="prop-enabled" ${step.enabled ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>

            <div class="toggle-row">
                <span class="toggle-label">Hata durumunda devam et</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="prop-continueOnFailure"
                        ${step.config?.continueOnFailure ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>

        <div class="form-section">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Timeout (sn)</label>
                    <input class="form-input" type="number" id="prop-timeout" min="1" max="300"
                        placeholder="10"
                        value="${step.config?.timeoutSeconds || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Yeniden Deneme</label>
                    <input class="form-input" type="number" id="prop-retry" min="0" max="5"
                        placeholder="0"
                        value="${step.config?.retryCount || ''}">
                </div>
            </div>
        </div>
    `;

    // Tüm değişiklikler auto-save tetikler
    propsBody.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('change', () => scheduleAutoSave(step.publicId));
        el.addEventListener('blur', () => scheduleAutoSave(step.publicId));
    });
}

// ── Auto-Save ────────────────────────────────────────────
function scheduleAutoSave(stepPublicId) {
    setAutosaveState('saving');
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveStepProps(stepPublicId), 600);
}

async function saveStepProps(stepPublicId) {
    const body = buildPropsPayload();
    if (!body) return;

    try {
        const updated = await Api.patch(`/steps/${stepPublicId}`, body);
        // State güncelle
        const idx = steps.findIndex(s => s.publicId === stepPublicId);
        if (idx !== -1) steps[idx] = updated;

        setAutosaveState('saved');
        renderAll();
    } catch (err) {
        setAutosaveState('error');
        Toast.error('Kayıt başarısız: ' + err.message);
    }
}

function buildPropsPayload() {
    // Alanlar eksikse null dön
    const desc = document.getElementById('prop-description');
    if (!desc) return null;

    const payload = {
        description: desc.value || null,
        enabled: document.getElementById('prop-enabled')?.checked ?? true,
        config: {
            continueOnFailure: document.getElementById('prop-continueOnFailure')?.checked,
            timeoutSeconds: parseInt(document.getElementById('prop-timeout')?.value) || null,
            retryCount: parseInt(document.getElementById('prop-retry')?.value) || null,
        },
    };

    const selType = document.getElementById('prop-selectorType');
    const selVal  = document.getElementById('prop-selectorValue');
    const inVal   = document.getElementById('prop-inputValue');
    const secVal  = document.getElementById('prop-secondaryValue');

    if (selType)  payload.selectorType  = selType.value;
    if (selVal)   payload.selectorValue = selVal.value || null;
    if (inVal && inVal.value)    payload.inputValue = inVal.value;
    if (secVal && secVal.value)  payload.secondaryValue = secVal.value;

    return payload;
}

function setAutosaveState(state) {
    const dot  = document.getElementById('autosave-dot');
    const text = document.getElementById('autosave-text');
    if (!dot || !text) return;

    if (state === 'saving') {
        dot.className = 'autosave-dot saving';
        text.textContent = 'Kaydediliyor...';
    } else if (state === 'saved') {
        dot.className = 'autosave-dot';
        const now = new Date();
        text.textContent = `Kaydedildi — ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    } else {
        dot.style.background = 'var(--clr-danger)';
        text.textContent = 'Kayıt hatası';
    }
}

// ── Props Panel Butonları ─────────────────────────────────
function setupPropsActions() {
    document.getElementById('btn-duplicate').addEventListener('click', () => {
        if (selectedStepId) duplicateStep(selectedStepId);
    });

    document.getElementById('btn-delete').addEventListener('click', () => {
        if (selectedStepId) deleteStep(selectedStepId);
    });
}

// ── Adım Kopyala ──────────────────────────────────────────
window.duplicateStep = async function(publicId) {
    try {
        const newStep = await Api.post(`/steps/${publicId}/duplicate`, {});
        // Yeni node pozisyonu: orijinalin biraz sağına/aşağısına
        const orig = nodePositions[publicId];
        if (orig) nodePositions[newStep.publicId] = { x: orig.x + 30, y: orig.y + 30 };
        steps.push(newStep);
        steps.sort((a, b) => a.stepOrder - b.stepOrder);
        renderAll();
        selectStep(newStep.publicId);
        Toast.success('Adım kopyalandı');
    } catch (err) {
        Toast.error('Kopyalanamadı: ' + err.message);
    }
};

// ── Adım Sil ─────────────────────────────────────────────
window.deleteStep = function(publicId) {
    const step = steps.find(s => s.publicId === publicId);
    const meta = actionMetadata.find(m => m.actionType === step?.actionType) || {};
    ConfirmDialog.show({
        title: 'Adımı Sil',
        message: `"${meta.displayName || step?.actionType}" adımını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
        confirmLabel: 'Sil',
        onConfirm: async () => {
            await Api.del(`/steps/${publicId}`);
            steps = steps.filter(s => s.publicId !== publicId);
            if (selectedStepId === publicId) {
                selectedStepId = null;
                document.getElementById('props-actions').style.display = 'none';
                document.getElementById('props-body').innerHTML = `
                    <div class="props-empty">
                        <span class="props-empty-icon">◉</span>
                        <span class="props-empty-text">Henüz seçili adım yok.</span>
                    </div>`;
            }
            delete nodePositions[publicId];
            renderAll();
            Toast.success('Adım silindi');
        },
    });
};

// ── Node Context Menu ─────────────────────────────────────
let ctxTargetId = null;

function showNodeContextMenu(e, publicId) {
    e.preventDefault();
    ctxTargetId = publicId;
    const menu = document.getElementById('node-context-menu');
    menu.style.left = e.clientX + 'px';
    menu.style.top  = e.clientY + 'px';
    menu.classList.remove('hidden');
}

document.getElementById('ctx-select').addEventListener('click', () => {
    if (ctxTargetId) selectStep(ctxTargetId);
    document.getElementById('node-context-menu').classList.add('hidden');
});

document.getElementById('ctx-duplicate').addEventListener('click', () => {
    if (ctxTargetId) duplicateStep(ctxTargetId);
    document.getElementById('node-context-menu').classList.add('hidden');
});

document.getElementById('ctx-toggle').addEventListener('click', async () => {
    const step = steps.find(s => s.publicId === ctxTargetId);
    if (!step) return;
    try {
        const updated = await Api.patch(`/steps/${ctxTargetId}`, { enabled: !step.enabled });
        const idx = steps.findIndex(s => s.publicId === ctxTargetId);
        if (idx !== -1) steps[idx] = updated;
        renderAll();
        if (selectedStepId === ctxTargetId) renderPropsPanel(updated);
    } catch (err) { Toast.error(err.message); }
    document.getElementById('node-context-menu').classList.add('hidden');
});

document.getElementById('ctx-delete').addEventListener('click', () => {
    if (ctxTargetId) deleteStep(ctxTargetId);
    document.getElementById('node-context-menu').classList.add('hidden');
});

// Menüyü dışarı tıklayınca kapat
document.addEventListener('click', e => {
    if (!e.target.closest('#node-context-menu') && !e.target.closest('.node-menu-btn')) {
        document.getElementById('node-context-menu').classList.add('hidden');
    }
});

// ── Senaryoyu Çalıştır ────────────────────────────────────
async function runScenario() {
    const btn = document.getElementById('btn-run');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Çalışıyor...';
    try {
        const exec = await Api.post(`/scenarios/${scenarioPublicId}/execute`, {});
        Toast.success('Senaryo çalıştırıldı! Execution ID: ' + exec.publicId);
        setTimeout(() => {
            window.location.href = `execution-detail.html?id=${exec.publicId}`;
        }, 1200);
    } catch (err) {
        Toast.error('Çalıştırılamadı: ' + err.message);
    } finally {
        btn.disabled = scenarioData?.status !== 'READY';
        btn.innerHTML = '&#9654; Çalıştır';
    }
}