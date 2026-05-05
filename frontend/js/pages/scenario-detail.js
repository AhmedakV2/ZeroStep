    // ╔══════════════════════════════════════════════════════════╗
    // ║  FAZ F5 — Senaryo Detay / Step Editor                   ║
    // ║  Diyagram + Tablo, D&D, auto-save, klavye kısayolları   ║
    // ╚══════════════════════════════════════════════════════════╝

    // ── Global Durum ──────────────────────────────────────────
    let scenarioPublicId  = null;
    let scenarioData      = null;
    let actionMetadata    = [];
    let steps             = [];
    let selectedStepId    = null;
    let viewMode          = 'diagram';

    // Diyagram transform
    let panX = 0, panY = 0, zoom = 1;
    let isPanning  = false, panStartX = 0, panStartY = 0;

    // Canvas içi node sürükleme
    let dragNodeId  = null, dragOffsetX = 0, dragOffsetY = 0;
    let nodePositions = {};

    // Auto-save
    let autoSaveTimer = null;

    // Panel görünürlük
    let paletteVisible    = true;
    let propertiesVisible = true;
    let fullscreenActive  = false;

    // Context menu — sadece bir kez bağlanır
    let ctxMenuBound = false;
    let ctxTargetId  = null;

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════
    (async function init() {
        if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

        const params = new URLSearchParams(window.location.search);
        scenarioPublicId = params.get('id');
        if (!scenarioPublicId) { Toast.error('Senaryo ID bulunamadı'); return; }

        Sidebar.render('sidebar');
        Topbar.render('topbar', 'Senaryo Detayı');

        setupViewToggle();
        setupCanvasInteraction();
        setupDropZone();
        setupPropsActions();
        bindContextMenuOnce();
        bindKeyboardShortcuts();

        await Promise.all([loadActionMetadata(), loadScenario()]);
        await loadSteps();
    })();

    // ═══════════════════════════════════════════════════════════
    // VERİ YÜKLEMELERİ
    // ═══════════════════════════════════════════════════════════

    async function loadScenario() {
        try {
            scenarioData = await Api.get(`/scenarios/${scenarioPublicId}`);
            document.getElementById('breadcrumb-name').textContent = scenarioData.name;
            document.title = `ZeroStep — ${scenarioData.name}`;

            const runBtn = document.getElementById('btn-run');
            runBtn.disabled = scenarioData.status !== 'READY';
            if (!runBtn._boundRun) {
                runBtn.addEventListener('click', runScenario);
                runBtn._boundRun = true;
            }
            document.getElementById('btn-save').addEventListener('click', () =>
                Toast.info('Değişiklikler otomatik kaydedilir.'));
        } catch (err) { Toast.error('Senaryo yüklenemedi: ' + err.message); }
    }

    async function loadActionMetadata() {
        try {
            actionMetadata = await Api.get('/steps/action-metadata');
            if (!Array.isArray(actionMetadata)) actionMetadata = [];
            renderToolPalette(actionMetadata);
        } catch (err) {
            Toast.error('Action metadata alınamadı: ' + (err.message || 'Bilinmeyen hata'));
            actionMetadata = [];
        }
    }

    async function loadSteps() {
        try {
            const raw = await Api.get(`/scenarios/${scenarioPublicId}/steps`);
            steps = Array.isArray(raw) ? raw : [];
            steps.sort((a, b) => a.stepOrder - b.stepOrder);
            renderAll();
        } catch (err) { Toast.error('Adımlar yüklenemedi: ' + err.message); }
    }

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    function renderAll() {
        if (viewMode === 'diagram') renderDiagram();
        else                        renderTable();
        updateEmptyState();
    }

    function updateEmptyState() {
        const el = document.getElementById('canvas-empty');
        if (el) el.style.display = steps.length === 0 ? 'flex' : 'none';
    }

    // ═══════════════════════════════════════════════════════════
    // ARAÇ PALETİ
    // ═══════════════════════════════════════════════════════════

    function renderToolPalette(metadata) {
        const palette = document.getElementById('action-palette');
        const catIcons = {
            'Navigation':'→','Mouse':'▶','Input':'✏','Scroll':'↕',
            'Wait':'⏱','Assert':'✓','Frame':'□','Storage':'⬡','Misc':'⚙',
        };

        const groups = {};
        metadata.forEach(m => { (groups[m.category] ??= []).push(m); });

        palette.innerHTML = Object.entries(groups).map(([cat, items]) => `
            <div class="tool-category">
                <div class="tool-category-label">${catIcons[cat]||'◆'} ${Utils.escHtml(cat)}</div>
                ${items.map(item => `
                    <div class="tool-card" draggable="true"
                         data-action="${Utils.escHtml(item.actionType)}"
                         title="${Utils.escHtml(item.description||'')}">
                        <span class="tool-card-icon">${catIcons[item.category]||'◆'}</span>
                        <span class="tool-card-name">${Utils.escHtml(item.displayName)}</span>
                    </div>`).join('')}
            </div>`).join('');

        palette.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('dragstart', e => {
                e.dataTransfer.setData('action-type', card.dataset.action);
                e.dataTransfer.effectAllowed = 'copy';
                card.classList.add('dragging');
            });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
        });

        const searchEl = document.getElementById('action-search');
        if (!searchEl._bound) {
            searchEl.addEventListener('input', e => {
                const q = e.target.value.toLowerCase();
                palette.querySelectorAll('.tool-card').forEach(c => {
                    c.style.display = (
                        c.dataset.action.toLowerCase().includes(q) ||
                        c.querySelector('.tool-card-name').textContent.toLowerCase().includes(q)
                    ) ? '' : 'none';
                });
                palette.querySelectorAll('.tool-category').forEach(cat => {
                    cat.style.display = [...cat.querySelectorAll('.tool-card')]
                        .some(c => c.style.display !== 'none') ? '' : 'none';
                });
            });
            searchEl._bound = true;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // GÖRÜNÜM GEÇİŞİ
    // ═══════════════════════════════════════════════════════════

    function setupViewToggle() {
        document.getElementById('btn-view-diagram').addEventListener('click', () => switchView('diagram'));
        document.getElementById('btn-view-table').addEventListener('click', () => switchView('table'));
    }

    function switchView(mode) {
        if (viewMode === mode) return;
        viewMode = mode;
        const isDiagram = mode === 'diagram';
        document.getElementById('btn-view-diagram').classList.toggle('active', isDiagram);
        document.getElementById('btn-view-table').classList.toggle('active', !isDiagram);
        document.getElementById('diagram-canvas').style.display = isDiagram ? '' : 'none';
        document.getElementById('table-canvas').style.display   = isDiagram ? 'none' : 'flex';
        renderAll();
    }

    // ═══════════════════════════════════════════════════════════
    // DİYAGRAM MODU
    // ═══════════════════════════════════════════════════════════

    function renderDiagram() {
        const viewport = document.getElementById('diagram-viewport');
        [...viewport.children].forEach(el => { if (el.id !== 'connections-svg') el.remove(); });

        steps.forEach((step, idx) => {
            if (!nodePositions[step.publicId])
                nodePositions[step.publicId] = { x: 60 + idx * 280, y: 80 };
            const { x, y } = nodePositions[step.publicId];
            viewport.appendChild(createNode(step, x, y, idx + 1));
        });

        renderConnections();
        applyTransform();
    }

    function createNode(step, x, y, orderNum) {
        const meta = actionMetadata.find(m => m.actionType === step.actionType) || {};
        const node = document.createElement('div');
        node.className = ['step-node',
            step.publicId === selectedStepId ? 'selected' : '',
            !step.enabled ? 'disabled-node' : '',
        ].filter(Boolean).join(' ');
        node.style.cssText = `left:${x}px;top:${y}px`;
        node.dataset.id = step.publicId;

        node.innerHTML = `
            <div class="node-port port-in"></div>
            <div class="node-header">
                <span class="node-order">${orderNum}</span>
                <span class="node-action">${Utils.escHtml(meta.displayName || step.actionType)}</span>
                <button class="node-menu-btn" title="Seçenekler">&#8942;</button>
            </div>
            <div class="node-body">
                <div class="node-desc">${Utils.escHtml(step.description||step.selectorValue||step.inputValue||'—')}</div>
                ${!step.enabled ? '<div class="node-disabled-badge">Pasif</div>' : ''}
            </div>
            <div class="node-port port-out"></div>`;

        node.addEventListener('click', e => {
            if (e.target.closest('.node-menu-btn')) return;
            selectStep(step.publicId);
        });
        node.querySelector('.node-menu-btn').addEventListener('click', e => {
            e.stopPropagation();
            showNodeContextMenu(e, step.publicId);
        });
        node.addEventListener('contextmenu', e => {
            e.preventDefault();
            showNodeContextMenu(e, step.publicId);
        });
        node.addEventListener('mousedown', e => {
            if (e.target.closest('.node-menu-btn') || e.button !== 0) return;
            dragNodeId = step.publicId;
            const sr = document.querySelector('.diagram-surface').getBoundingClientRect();
            dragOffsetX = e.clientX - (sr.left + x * zoom + panX);
            dragOffsetY = e.clientY - (sr.top  + y * zoom + panY);
            e.preventDefault();
        });

        return node;
    }

    function renderConnections() {
        const svg = document.getElementById('connections-svg');
        svg.innerHTML = '';
        for (let i = 0; i < steps.length - 1; i++) {
            const fp = nodePositions[steps[i].publicId];
            const tp = nodePositions[steps[i+1].publicId];
            if (!fp || !tp) continue;
            const x1=fp.x+220, y1=fp.y+38, x2=tp.x, y2=tp.y+38, cp=(x2-x1)/2;
            const path = document.createElementNS('http://www.w3.org/2000/svg','path');
            path.setAttribute('class','conn-path');
            path.setAttribute('d',`M${x1},${y1} C${x1+cp},${y1} ${x2-cp},${y2} ${x2},${y2}`);
            svg.appendChild(path);
        }
    }

    function setupCanvasInteraction() {
        const surface = document.querySelector('.diagram-surface');

        surface.addEventListener('mousedown', e => {
            if (e.button === 1 || (e.button === 0 && e.getModifierState('Space'))) {
                isPanning=true; panStartX=e.clientX-panX; panStartY=e.clientY-panY;
                surface.style.cursor='grabbing'; e.preventDefault();
            }
        });
        window.addEventListener('mousemove', e => {
            if (isPanning) { panX=e.clientX-panStartX; panY=e.clientY-panStartY; applyTransform(); }
            if (dragNodeId) {
                const sr = document.querySelector('.diagram-surface').getBoundingClientRect();
                const nx=(e.clientX-sr.left-dragOffsetX-panX)/zoom;
                const ny=(e.clientY-sr.top -dragOffsetY-panY)/zoom;
                nodePositions[dragNodeId]={x:nx,y:ny};
                const nd=document.querySelector(`[data-id="${dragNodeId}"]`);
                if (nd) { nd.style.left=nx+'px'; nd.style.top=ny+'px'; }
                renderConnections();
            }
        });
        window.addEventListener('mouseup', () => {
            if (isPanning) { isPanning=false; surface.style.cursor=''; }
            dragNodeId=null;
        });
        surface.addEventListener('wheel', e => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            zoom=Math.max(0.3,Math.min(2.5,zoom*(e.deltaY>0?0.9:1.1)));
            applyTransform();
        }, { passive:false });
    }

    function applyTransform() {
        document.getElementById('diagram-viewport').style.transform =
            `translate(${panX}px,${panY}px) scale(${zoom})`;
    }

    // ═══════════════════════════════════════════════════════════
    // DROP ZONE
    // ═══════════════════════════════════════════════════════════

    function setupDropZone() {
        // 1. DİYAGRAM (Orta Alan) Drop İşlemleri
        const overlay = document.getElementById('drop-overlay');
        const surface = document.querySelector('.diagram-surface');

        surface.addEventListener('dragover', e => {
            // Sadece araç paletinden geliyorsa izin ver
            if (e.dataTransfer.types.includes('action-type')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                overlay.classList.add('dragover');
            }
        });

        surface.addEventListener('dragleave', e => {
            if (!surface.contains(e.relatedTarget)) overlay.classList.remove('dragover');
        });

        surface.addEventListener('drop', async e => {
            const actionType = e.dataTransfer.getData('action-type');
            if (actionType) {
                e.preventDefault();
                e.stopPropagation();
                overlay.classList.remove('dragover');

                const rect = surface.getBoundingClientRect();
                const dropX = (e.clientX - rect.left - panX) / zoom;
                const dropY = (e.clientY - rect.top  - panY) / zoom;

                handleStepDrop(actionType, dropX, dropY);
            }
        });

        // 2. TABLO GÖRÜNÜMÜ Drop İşlemleri (Çakışmayı Önleyen Kesin Çözüm)
        const tc = document.getElementById('table-canvas');

        tc.addEventListener('dragover', e => {
            // Tablo içi satır sıralaması değil, PALETTEN yeni adım geliyorsa izin ver
            if (e.dataTransfer.types.includes('action-type')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        tc.addEventListener('drop', async e => {
            const actionType = e.dataTransfer.getData('action-type');
            // Eğer sürüklenen şey bir araç ise (action-type varsa) çalıştır
            if (actionType) {
                e.preventDefault();
                e.stopPropagation(); // Satırların kendi drop event'ine gitmesini engelle

                // Tabloya bırakılan adımın, diyagramdaki varsayılan konumunu hesapla
                const defaultX = 60 + steps.length * 280;
                const defaultY = 80;

                // Popup'ı aç veya direkt ekle
                handleStepDrop(actionType, defaultX, defaultY);
            }
        });
    }

    function handleStepDrop(actionType, dropX, dropY) {
        const meta = actionMetadata.find(m => m.actionType === actionType);
        const needsForm = meta && (meta.requiresInputValue || meta.requiresSelector || meta.requiresSecondaryValue);
        if (needsForm) openQuickAddModal(actionType, dropX, dropY);
        else doCreateStep({ actionType }, dropX, dropY);
    }

    // Zorunlu alan formu — selector/input gerektiren actionlar için
    function openQuickAddModal(actionType, dropX, dropY) {
        const meta = actionMetadata.find(m => m.actionType === actionType) || {};
        const isSensitive = meta.sensitive === true || actionType === 'TYPE_SECRET';

        let fields = `
            <div class="form-group" style="margin-bottom:.75rem;">
                <label class="form-label">Açıklama (İsteğe bağlı)</label>
                <input class="form-input" type="text" id="qa-desc" placeholder="Bu adımın ne yaptığını açıklayın...">
            </div>`;

        // 1. SADECE SELECTOR GEREKTİREN İŞLEMLERDE GÖSTER
        if (meta.requiresSelector) {
            fields += `
                <div class="form-group" style="margin-bottom:.5rem;">
                    <label class="form-label">Selector Tipi</label>
                    <select class="form-input" id="qa-sel-type">
                        <option value="XPATH">XPATH</option>
                        <option value="CSS">CSS</option>
                        <option value="ID">ID</option>
                        <option value="NAME">NAME</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:.75rem;">
                    <label class="form-label">Selector Değeri <span style="color:var(--clr-danger)">*</span></label>
                    <input class="form-input" type="text" id="qa-sel-val" placeholder="${Utils.escHtml(meta.inputValueHint || 'Örn: //button[@id=login]')}">
                </div>`;
        }

        // 2. EĞER BACKEND ÖZEL ALANLAR (FIELDS) GÖNDERDİYSE ONLARI ÇİZ
        if (meta.fields && meta.fields.length > 0) {
            meta.fields.forEach(field => {
                fields += `
                    <div class="form-group" style="margin-bottom:.75rem;">
                        <label class="form-label">${Utils.escHtml(field.label)} ${field.required ? '<span style="color:var(--clr-danger)">*</span>' : ''}</label>
                        <input class="form-input dynamic-field" data-name="${field.name}" 
                               type="${field.type === 'number' ? 'number' : 'text'}" 
                               placeholder="${Utils.escHtml(field.placeholder || '')}">
                    </div>`;
            });
        }
        // 3. ÖZEL ALAN YOK AMA GENEL BİR DEĞER (INPUT VALUE) İSTENİYORSA
        else if (meta.requiresInputValue) {
            fields += `
                <div class="form-group" style="margin-bottom:.75rem;">
                    <label class="form-label">${isSensitive ? '🔒 Değer (Gizli)' : 'Değer'} <span style="color:var(--clr-danger)">*</span></label>
                    <input class="form-input" type="${isSensitive ? 'password' : 'text'}" id="qa-inp-val" placeholder="${Utils.escHtml(meta.inputValueHint || 'Girilecek değer...')}">
                </div>`;
        }

        Modal.open({
            title: `Adım Ekle — ${meta.displayName || actionType}`,
            contentHTML: `<div style="margin-top:.75rem;">
                <div style="background:var(--clr-surface-2);border-radius:var(--radius-sm);padding:.5rem .75rem;margin-bottom:1rem;font-size:.75rem;color:var(--clr-text-muted);border-left: 3px solid var(--clr-primary);">
                    ${Utils.escHtml(meta.description || 'Bu işlem için gerekli parametreleri girin.')}
                </div>
                ${fields}
            </div>`,
            confirmLabel: 'Ekle',
            size: 'sm',
            onConfirm: async () => {
                const payload = {
                    actionType: actionType,
                    description: document.getElementById('qa-desc')?.value.trim() || undefined
                };

                // Selector validasyonu
                if (meta.requiresSelector) {
                    payload.selectorType = document.getElementById('qa-sel-type')?.value;
                    payload.selectorValue = document.getElementById('qa-sel-val')?.value.trim();
                    if (!payload.selectorValue) { Toast.warning('Selector değeri zorunlu!'); throw new Error('v'); }
                }

                // Dinamik alanları payload'a ekle
                if (meta.fields && meta.fields.length > 0) {
                    let hasError = false;
                    document.querySelectorAll('.dynamic-field').forEach(input => {
                        const val = input.type === 'number' ? Number(input.value) : input.value.trim();
                        const isRequired = meta.fields.find(f => f.name === input.dataset.name)?.required;
                        if (isRequired && !val && val !== 0) {
                            Toast.warning('Lütfen zorunlu alanları doldurun!');
                            hasError = true;
                        }
                        payload[input.dataset.name] = val;
                    });
                    if (hasError) throw new Error('v');
                } else if (meta.requiresInputValue) {
                    payload.inputValue = document.getElementById('qa-inp-val')?.value;
                    if (!meta.requiresSelector && !payload.inputValue) { Toast.warning('Değer alanı zorunlu!'); throw new Error('v'); }
                }

                await doCreateStep(payload, dropX, dropY);
                Modal.close();
            }
        });

        // Popup açıldığında ilk inputa otomatik focuslan
        setTimeout(() => {
            const firstInput = document.getElementById('qa-sel-val') || document.querySelector('.dynamic-field') || document.getElementById('qa-inp-val') || document.getElementById('qa-desc');
            if(firstInput) firstInput.focus();
        }, 100);
    }

    async function doCreateStep(body, dropX, dropY) {
        const tempId = 'temp_' + Date.now();
        if (viewMode === 'diagram') {
            const vp = document.getElementById('diagram-viewport');
            const tmp = document.createElement('div');
            tmp.id = tempId; tmp.className = 'step-node';
            tmp.style.cssText = `left:${dropX}px;top:${dropY}px;opacity:.4;pointer-events:none;`;
            tmp.innerHTML = `<div class="node-header">
                <span class="node-action">${Utils.escHtml(body.actionType)}</span>
                <span class="spinner" style="width:.7rem;height:.7rem;margin-left:.5rem;"></span>
            </div>`;
            vp.appendChild(tmp);
        }
        try {
            const newStep = await Api.post(`/scenarios/${scenarioPublicId}/steps`, body);
            nodePositions[newStep.publicId] = { x: dropX, y: dropY };
            steps.push(newStep);
            steps.sort((a,b) => a.stepOrder - b.stepOrder);
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

    // ═══════════════════════════════════════════════════════════
    // TABLO MODU
    // ═══════════════════════════════════════════════════════════

    function renderTable() {
        const tableEl = document.getElementById('table-canvas');

        if (steps.length === 0) {
            tableEl.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    height:100%;gap:.75rem;color:var(--clr-text-muted);">
                    <span style="font-size:2.5rem;opacity:.15;">◈</span>
                    <span style="font-size:.9rem;">Henüz adım yok. Sol panelden sürükleyin.</span>
                </div>`;
            return;
        }

        tableEl.innerHTML = `
            <div style="overflow-y:auto;height:100%;">
                <table class="step-table">
                    <thead>
                        <tr>
                            <th style="width:32px;"></th>
                            <th style="width:42px;text-align:center;">#</th>
                            <th>Aksiyon</th>
                            <th style="width:130px;">Selector</th>
                            <th style="width:130px;">Değer</th>
                            <th style="width:72px;">Durum</th>
                            <th style="width:80px;">İşlem</th>
                        </tr>
                    </thead>
                    <tbody id="step-tbody">
                        ${buildTableRows()}
                    </tbody>
                </table>
            </div>`;

        initTableDragSort();
    }

    function buildTableRows() {
        return steps.map((step, idx) => {
            const meta = actionMetadata.find(m => m.actionType === step.actionType) || {};
            const isSensitive = meta.sensitive === true || step.actionType === 'TYPE_SECRET';
            const isSelected  = step.publicId === selectedStepId;

            return `<tr class="${isSelected?'selected-row':''}${!step.enabled?' disabled-row':''}"
                data-id="${Utils.escHtml(step.publicId)}" draggable="true">
                <td style="text-align:center;color:var(--clr-text-muted);cursor:grab;user-select:none;font-size:1rem;">⠿</td>
                <td style="text-align:center;color:var(--clr-text-muted);font-size:.78rem;">${idx+1}</td>
                <td>
                    <div style="font-weight:600;font-size:.82rem;font-family:var(--font-ui);">
                        ${Utils.escHtml(meta.displayName||step.actionType)}
                    </div>
                    ${step.description?`<div style="font-size:.72rem;color:var(--clr-text-muted);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">
                        ${Utils.escHtml(step.description)}</div>`:''}
                </td>
                <td style="font-size:.75rem;">
                    ${step.selectorType?`<span style="background:var(--clr-surface-2);padding:.1rem .3rem;
                        border-radius:3px;font-family:var(--font-ui);font-size:.68rem;">
                        ${Utils.escHtml(step.selectorType)}</span>`:''}
                    ${step.selectorValue?`<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                        max-width:100px;color:var(--clr-text-muted);margin-top:.1rem;">
                        ${Utils.escHtml(step.selectorValue)}</div>`:'<span style="opacity:.35;">—</span>'}
                </td>
                <td style="font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px;">
                    ${isSensitive
                ?'<span style="letter-spacing:.1em;color:var(--clr-text-muted);">••••••</span>'
                :Utils.escHtml(step.inputValue||'—')}
                </td>
                <td>
                    <span class="badge ${step.enabled?'badge-success':'badge-neutral'}" style="font-size:.65rem;">
                        ${step.enabled?'Aktif':'Pasif'}
                    </span>
                </td>
                <td>
                    <div style="display:flex;gap:.2rem;">
                        <button class="btn-icon" data-action="duplicate" data-id="${Utils.escHtml(step.publicId)}" title="Kopyala">⧉</button>
                        <button class="btn-icon" style="color:var(--clr-danger);" data-action="delete" data-id="${Utils.escHtml(step.publicId)}" title="Sil (Delete)">✕</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    function initTableDragSort() {
        const tbody = document.getElementById('step-tbody');
        if (!tbody) return;

        let dragRow = null;

        // Tıklama — event delegation
        tbody.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action]');
            if (btn) {
                e.stopPropagation();
                if (btn.dataset.action === 'duplicate') duplicateStep(btn.dataset.id);
                else if (btn.dataset.action === 'delete')    deleteStep(btn.dataset.id);
                return;
            }
            const row = e.target.closest('tr[data-id]');
            if (row) selectStep(row.dataset.id);
        });

        // Drag & Drop sıralama
        tbody.querySelectorAll('tr[draggable]').forEach(row => {
            row.addEventListener('dragstart', e => {
                dragRow = row;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', row.dataset.id);
                setTimeout(() => row.classList.add('row-dragging'), 0);
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('row-dragging');
                tbody.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(r =>
                    r.classList.remove('drag-over-top','drag-over-bottom'));
                dragRow = null;
            });

            row.addEventListener('dragover', e => {
                e.preventDefault();
                if (!dragRow || dragRow === row) return;
                const isTop = e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
                tbody.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(r =>
                    r.classList.remove('drag-over-top','drag-over-bottom'));
                row.classList.add(isTop ? 'drag-over-top' : 'drag-over-bottom');
            });

            row.addEventListener('drop', async e => {
                e.preventDefault();
                if (!dragRow || dragRow === row) return;
                const isTop = e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
                if (isTop) row.before(dragRow);
                else       row.after(dragRow);
                tbody.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(r =>
                    r.classList.remove('drag-over-top','drag-over-bottom'));
                await reorderFromTable();
            });
        });
    }

    async function reorderFromTable() {
        const tbody = document.getElementById('step-tbody');
        if (!tbody) return;

        const newOrder = [...tbody.querySelectorAll('tr[data-id]')].map(r => r.dataset.id);
        const oldOrder = steps.map(s => s.publicId);

        let movedIdx = -1;
        for (let i = 0; i < newOrder.length; i++) {
            if (newOrder[i] !== oldOrder[i]) { movedIdx = i; break; }
        }
        if (movedIdx === -1) return;

        const movedId = newOrder[movedIdx];
        const payload = {};
        if (movedIdx > 0)
            payload.afterStepPublicId  = newOrder[movedIdx - 1];
        else if (newOrder.length > 1)
            payload.beforeStepPublicId = newOrder[1];

        if (!payload.afterStepPublicId && !payload.beforeStepPublicId) return;

        try {
            const updated = await Api.patch(`/steps/${movedId}/reorder`, payload);
            const idx = steps.findIndex(s => s.publicId === movedId);
            if (idx !== -1) steps[idx].stepOrder = updated.stepOrder;
            steps.sort((a,b) => a.stepOrder - b.stepOrder);
            renderAll();
            setAutosaveState('saved');
        } catch (err) {
            Toast.error('Sıralama kaydedilemedi: ' + err.message);
            await loadSteps();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ADIM SEÇME
    // ═══════════════════════════════════════════════════════════

    function selectStep(publicId) {
        selectedStepId = publicId;

        document.querySelectorAll('.step-node').forEach(n =>
            n.classList.toggle('selected', n.dataset.id === publicId));
        document.querySelectorAll('#step-tbody tr[data-id]').forEach(r =>
            r.classList.toggle('selected-row', r.dataset.id === publicId));

        const step = steps.find(s => s.publicId === publicId);
        if (!step) return;
        renderPropsPanel(step);

        if (!propertiesVisible) toggleProperties();
    }

    // ═══════════════════════════════════════════════════════════
    // SAĞ PANEL — ÖZELLİKLER
    // ═══════════════════════════════════════════════════════════

    function renderPropsPanel(step) {
        const meta = actionMetadata.find(m => m.actionType === step.actionType) || {};
        const propsBody = document.getElementById('props-body');
        document.getElementById('props-actions').style.display = 'flex';
        const isSensitive = meta.sensitive === true || step.actionType === 'TYPE_SECRET';
        const stepIdx = steps.findIndex(s => s.publicId === step.publicId);

        propsBody.innerHTML = `
            <div class="form-section">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;">
                    <span style="font-family:var(--font-ui);font-weight:700;font-size:.88rem;
                        color:var(--clr-primary-h);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${Utils.escHtml(meta.displayName||step.actionType)}
                    </span>
                    <span style="font-size:.68rem;color:var(--clr-text-muted);
                        background:var(--clr-surface-2);padding:.1rem .4rem;border-radius:3px;font-family:var(--font-ui);">
                        #${stepIdx+1}
                    </span>
                </div>
                ${meta.description?`<div style="font-size:.72rem;color:var(--clr-text-muted);line-height:1.5;">${Utils.escHtml(meta.description)}</div>`:''}
            </div>
    
            <div class="form-section">
                <label class="form-label">Açıklama</label>
                <textarea class="form-input" id="prop-description" rows="2"
                    style="resize:vertical;min-height:50px;"
                    placeholder="Bu adımın ne yaptığını açıklayın...">${Utils.escHtml(step.description||'')}</textarea>
            </div>
    
            ${meta.requiresSelector?`
            <div class="form-section">
                <label class="form-label">Selector Tipi</label>
                <select class="form-input" id="prop-selectorType" style="margin-bottom:.5rem;">
                    ${['CSS','XPATH','ID','NAME','CLASS_NAME','TAG_NAME','LINK_TEXT','PARTIAL_LINK_TEXT']
            .map(t=>`<option value="${t}" ${step.selectorType===t?'selected':''}>${t}</option>`).join('')}
                </select>
                <label class="form-label">Selector Değeri</label>
                <input class="form-input" type="text" id="prop-selectorValue"
                    placeholder="${Utils.escHtml(meta.inputValueHint||'Selector...')}"
                    value="${Utils.escHtml(step.selectorValue||'')}">
            </div>`:''}
    
            ${meta.requiresInputValue?`
            <div class="form-section">
                <label class="form-label">${isSensitive?'🔒 Değer (Gizli)':'Değer'}</label>
                <input class="form-input" type="${isSensitive?'password':'text'}" id="prop-inputValue"
                    placeholder="${Utils.escHtml(meta.inputValueHint||'Değer girin...')}"
                    value="${isSensitive?'':Utils.escHtml(step.inputValue||'')}">
                ${isSensitive?`<p style="font-size:.7rem;color:var(--clr-text-muted);margin-top:.2rem;">Mevcut değer güvenlik için gösterilmiyor.</p>`:''}
            </div>`:''}
    
            ${meta.requiresSecondaryValue?`
            <div class="form-section">
                <label class="form-label">${Utils.escHtml(meta.secondaryValueHint||'İkincil Değer')}</label>
                <input class="form-input" type="text" id="prop-secondaryValue"
                    placeholder="${Utils.escHtml(meta.secondaryValueHint||'')}"
                    value="${Utils.escHtml(step.secondaryValue||'')}">
            </div>`:''}
    
            <div class="form-section">
                <label class="form-label" style="margin-bottom:.5rem;">Gelişmiş Ayarlar</label>
                <div class="toggle-row">
                    <span class="toggle-label">Aktif</span>
                    <label class="toggle-switch">
                        <input type="checkbox" id="prop-enabled" ${step.enabled?'checked':''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="toggle-row">
                    <span class="toggle-label">Hata durumunda devam et</span>
                    <label class="toggle-switch">
                        <input type="checkbox" id="prop-continueOnFailure"
                            ${step.config?.continueOnFailure?'checked':''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
    
            <div class="form-section">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Timeout (sn)</label>
                        <input class="form-input" type="number" id="prop-timeout"
                            min="1" max="300" placeholder="10"
                            value="${step.config?.timeoutSeconds||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tekrar Dene</label>
                        <input class="form-input" type="number" id="prop-retry"
                            min="0" max="5" placeholder="0"
                            value="${step.config?.retryCount||''}">
                    </div>
                </div>
            </div>`;

        propsBody.querySelectorAll('input,textarea,select').forEach(el => {
            el.addEventListener('input',  () => scheduleAutoSave(step.publicId));
            el.addEventListener('change', () => scheduleAutoSave(step.publicId));
        });
    }

    // ── Auto-Save ──────────────────────────────────────────────
    function scheduleAutoSave(id) {
        setAutosaveState('saving');
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => saveStepProps(id), 600);
    }

    async function saveStepProps(id) {
        const body = buildPropsPayload();
        if (!body) return;
        try {
            const updated = await Api.patch(`/steps/${id}`, body);
            const idx = steps.findIndex(s => s.publicId === id);
            if (idx !== -1) steps[idx] = updated;

            const node = document.querySelector(`.step-node[data-id="${id}"]`);
            if (node) node.classList.toggle('disabled-node', !updated.enabled);

            const row = document.querySelector(`#step-tbody tr[data-id="${id}"]`);
            if (row) {
                row.classList.toggle('disabled-row', !updated.enabled);
                const badge = row.querySelector('.badge');
                if (badge) {
                    badge.className = `badge ${updated.enabled?'badge-success':'badge-neutral'}`;
                    badge.textContent = updated.enabled ? 'Aktif' : 'Pasif';
                }
            }
            setAutosaveState('saved');
        } catch (err) {
            setAutosaveState('error');
            Toast.error('Kayıt başarısız: ' + err.message);
        }
    }

    function buildPropsPayload() {
        const desc = document.getElementById('prop-description');
        if (!desc) return null;
        const payload = {
            description: desc.value.trim() || null,
            enabled:     document.getElementById('prop-enabled')?.checked ?? true,
            config: {
                continueOnFailure: document.getElementById('prop-continueOnFailure')?.checked ?? false,
                timeoutSeconds:    parseInt(document.getElementById('prop-timeout')?.value)  || null,
                retryCount:        parseInt(document.getElementById('prop-retry')?.value)    || null,
            },
        };
        const selType = document.getElementById('prop-selectorType');
        const selVal  = document.getElementById('prop-selectorValue');
        const inVal   = document.getElementById('prop-inputValue');
        const secVal  = document.getElementById('prop-secondaryValue');
        if (selType) payload.selectorType   = selType.value;
        if (selVal)  payload.selectorValue  = selVal.value.trim()  || null;
        if (inVal)   payload.inputValue     = inVal.value          || null;
        if (secVal)  payload.secondaryValue = secVal.value.trim()  || null;
        return payload;
    }

    function setAutosaveState(state) {
        const dot  = document.getElementById('autosave-dot');
        const text = document.getElementById('autosave-text');
        if (!dot || !text) return;
        if (state === 'saving') {
            dot.className = 'autosave-dot saving'; dot.style.background = '';
            text.textContent = 'Kaydediliyor...';
        } else if (state === 'saved') {
            dot.className = 'autosave-dot'; dot.style.background = '';
            const n = new Date();
            text.textContent = `Kaydedildi — ${n.getHours()}:${String(n.getMinutes()).padStart(2,'0')}`;
        } else {
            dot.className = 'autosave-dot'; dot.style.background = 'var(--clr-danger)';
            text.textContent = 'Kayıt hatası';
        }
    }

    function setupPropsActions() {
        document.getElementById('btn-duplicate')?.addEventListener('click', () => { if (selectedStepId) duplicateStep(selectedStepId); });
        document.getElementById('btn-delete')?.addEventListener('click',    () => { if (selectedStepId) deleteStep(selectedStepId); });
    }


    // ═══════════════════════════════════════════════════════════
    // ADIM İŞLEMLERİ
    // ═══════════════════════════════════════════════════════════

    window.duplicateStep = async function(publicId) {
        try {
            const ns = await Api.post(`/steps/${publicId}/duplicate`, {});
            const orig = nodePositions[publicId];
            nodePositions[ns.publicId] = orig ? {x:orig.x+30,y:orig.y+30} : {x:60+steps.length*280,y:80};
            steps.push(ns);
            steps.sort((a,b) => a.stepOrder - b.stepOrder);
            renderAll(); selectStep(ns.publicId); Toast.success('Adım kopyalandı');
        } catch (err) { Toast.error('Kopyalanamadı: ' + err.message); }
    };

    window.deleteStep = function(publicId) {
        const step = steps.find(s => s.publicId === publicId);
        const meta = actionMetadata.find(m => m.actionType === step?.actionType) || {};
        ConfirmDialog.show({
            title: 'Adımı Sil',
            message: `"${meta.displayName||step?.actionType}" adımını silmek istediğinize emin misiniz?`,
            confirmLabel: 'Sil',
            onConfirm: async () => {
                await Api.del(`/steps/${publicId}`);
                steps = steps.filter(s => s.publicId !== publicId);
                delete nodePositions[publicId];
                if (selectedStepId === publicId) {
                    selectedStepId = null;
                    document.getElementById('props-actions').style.display = 'none';
                    document.getElementById('props-body').innerHTML = `
                        <div class="props-empty">
                            <span class="props-empty-icon">◉</span>
                            <span class="props-empty-text">Henüz seçili adım yok.<br>Bir adıma tıklayın.</span>
                        </div>`;
                }
                Modal.close(); renderAll(); Toast.success('Adım silindi');
            },
        });
    };

    // ═══════════════════════════════════════════════════════════
    // CONTEXT MENU
    // ═══════════════════════════════════════════════════════════

    function showNodeContextMenu(e, publicId) {
        ctxTargetId = publicId;
        const menu = document.getElementById('node-context-menu');
        let left=e.clientX, top=e.clientY;
        if (left+160 > window.innerWidth)  left=window.innerWidth-168;
        if (top+148  > window.innerHeight) top=window.innerHeight-156;
        menu.style.left=left+'px'; menu.style.top=top+'px';
        menu.classList.remove('hidden');
    }

    function bindContextMenuOnce() {
        if (ctxMenuBound) return;
        ctxMenuBound = true;
        const hide = () => document.getElementById('node-context-menu').classList.add('hidden');

        document.getElementById('ctx-select').addEventListener('click', () => { if (ctxTargetId) selectStep(ctxTargetId); hide(); });
        document.getElementById('ctx-duplicate').addEventListener('click', () => { if (ctxTargetId) duplicateStep(ctxTargetId); hide(); });
        document.getElementById('ctx-delete').addEventListener('click', () => { const id=ctxTargetId; hide(); if(id) deleteStep(id); });

        document.getElementById('ctx-toggle').addEventListener('click', async () => {
            const step = steps.find(s => s.publicId === ctxTargetId);
            if (!step) return; hide();
            try {
                const updated = await Api.patch(`/steps/${ctxTargetId}`, { enabled: !step.enabled });
                const idx = steps.findIndex(s => s.publicId === ctxTargetId);
                if (idx !== -1) steps[idx] = updated;
                const nd = document.querySelector(`.step-node[data-id="${ctxTargetId}"]`);
                if (nd) nd.classList.toggle('disabled-node', !updated.enabled);
                if (selectedStepId === ctxTargetId) renderPropsPanel(updated);
                setAutosaveState('saved');
            } catch (err) { Toast.error(err.message); }
        });

        document.addEventListener('click', e => {
            const menu = document.getElementById('node-context-menu');
            if (!menu.classList.contains('hidden') &&
                !e.target.closest('#node-context-menu') &&
                !e.target.closest('.node-menu-btn')) hide();
        });
    }

    // ═══════════════════════════════════════════════════════════
    // KLAVYE KISAYOLLARI
    // ═══════════════════════════════════════════════════════════

    function bindKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            const tag = document.activeElement?.tagName;
            const editing = tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';

            // Ctrl+S — her zaman çalışır
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (selectedStepId) { clearTimeout(autoSaveTimer); saveStepProps(selectedStepId); }
                else Toast.info('Değişiklikler otomatik kaydedilir.');
                return;
            }

            if (e.key === 'Escape') {
                document.getElementById('node-context-menu').classList.add('hidden');
                return;
            }

            if (editing) return;

            switch (e.key) {
                case 't': case 'T': e.preventDefault(); togglePalette(); break;
                case 'p': case 'P': e.preventDefault(); toggleProperties(); break;
                case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
                case 'd': case 'D': e.preventDefault(); if (selectedStepId) duplicateStep(selectedStepId); break;
                case 'Delete':
                case 'Backspace': e.preventDefault(); if (selectedStepId) deleteStep(selectedStepId); break;
                default:
                    if (e.key>='1' && e.key<='9' && !e.ctrlKey && !e.altKey) {
                        const idx = parseInt(e.key) - 1;
                        if (idx < steps.length) { e.preventDefault(); jumpToStep(idx); }
                    }
            }
        });
    }

    // ── Panel Toggle Fonksiyonları ─────────────────────────────
    function togglePalette() {
        paletteVisible = !paletteVisible;
        updateShellGrid();
        showShortcutToast('T', paletteVisible ? 'Araç Paleti Açıldı' : 'Araç Paleti Kapatıldı');
    }

    function toggleProperties() {
        propertiesVisible = !propertiesVisible;
        updateShellGrid();
        showShortcutToast('P', propertiesVisible ? 'Özellikler Açıldı' : 'Özellikler Kapatıldı');
    }

    function updateShellGrid() {
        const shell = document.querySelector('.step-editor-shell');
        if (!shell) return;
        const left  = paletteVisible    ? '240px' : '0';
        const right = propertiesVisible ? '300px' : '0';
        shell.style.gridTemplateColumns = `${left} 1fr ${right}`;
    }

    function toggleFullscreen() {
        fullscreenActive = !fullscreenActive;
        const main = document.querySelector('main.main-content');
        if (!main) return;
        if (fullscreenActive) {
            main.style.cssText='position:fixed;inset:0;z-index:100;padding:0;overflow:hidden;background:var(--clr-bg);';
            document.querySelector('.step-editor-shell').style.height='100vh';
        } else {
            main.style.cssText='padding:0;overflow:hidden;';
            document.querySelector('.step-editor-shell').style.height='';
        }
        showShortcutToast('F', fullscreenActive ? 'Tam Ekran' : 'Normal Görünüm');
    }

    function jumpToStep(idx) {
        if (idx >= steps.length) return;
        const step = steps[idx];
        selectStep(step.publicId);

        if (viewMode === 'diagram') {
            const pos = nodePositions[step.publicId];
            if (pos) {
                const sr = document.querySelector('.diagram-surface').getBoundingClientRect();
                panX = sr.width/2  - pos.x * zoom - 110;
                panY = sr.height/2 - pos.y * zoom - 38;
                applyTransform();
            }
        } else {
            document.querySelector(`#step-tbody tr[data-id="${step.publicId}"]`)
                ?.scrollIntoView({ behavior:'smooth', block:'center' });
        }

        const meta = actionMetadata.find(m => m.actionType === step.actionType);
        showShortcutToast(String(idx+1), `${meta?.displayName||step.actionType}`);
    }

    function showShortcutToast(key, label) {
        document.getElementById('shortcut-toast')?.remove();
        const el = document.createElement('div');
        el.id = 'shortcut-toast';
        el.style.cssText = `
            position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
            background:var(--clr-surface);border:1px solid var(--clr-border);
            border-radius:var(--radius-md);padding:.4rem .9rem;
            display:flex;align-items:center;gap:.6rem;font-size:.82rem;
            color:var(--clr-text);box-shadow:var(--shadow-md);z-index:9999;
            pointer-events:none;animation:slideUp .16s ease;`;
        el.innerHTML = `
            <kbd style="background:var(--clr-surface-2);border:1px solid var(--clr-border);
                border-radius:3px;padding:.1rem .35rem;font-family:var(--font-ui);
                font-size:.72rem;color:var(--clr-primary-h);">${Utils.escHtml(key)}</kbd>
            <span>${Utils.escHtml(label)}</span>`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1600);
    }

    // ═══════════════════════════════════════════════════════════
    // SENARYOYU ÇALIŞTIR
    // ═══════════════════════════════════════════════════════════

    async function runScenario() {
        if (!steps.filter(s=>s.enabled).length) {
            Toast.warning('Çalıştırılacak aktif adım yok.'); return;
        }
        const btn = document.getElementById('btn-run');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Çalışıyor...';
        try {
            const exec = await Api.post(`/scenarios/${scenarioPublicId}/execute`, {});
            Toast.success('Senaryo kuyruğa alındı!');
            setTimeout(() => window.location.href = `execution-detail.html?id=${exec.publicId}`, 900);
        } catch (err) {
            Toast.error('Çalıştırılamadı: ' + err.message);
            btn.disabled = scenarioData?.status !== 'READY';
            btn.innerHTML = '&#9654; Çalıştır';
        }
    }