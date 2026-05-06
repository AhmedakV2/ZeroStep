let currentPage = 0;
const pageSize = 20;

// ═══════════════════════════════════════════════════════════ INITIALIZATION
async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    try {
        Sidebar.render('sidebar-container');
        Topbar.render('topbar-container', 'Senaryo Yönetimi');
    } catch (e) {
        console.warn("UI render hatası:", e);
    }

    setupEventListeners();
    checkPermissions();
    await loadScenarios();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function checkPermissions() {
    const newBtn = document.getElementById('btn-new-scenario');
    if (Auth.hasRole('VIEWER') && !Auth.hasRole('ADMIN') && !Auth.hasRole('TESTER')) {
        if (newBtn) newBtn.style.display = 'none';
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('filter-search');
    const statusFilter = document.getElementById('filter-status');
    const newBtn = document.getElementById('btn-new-scenario');

    if (searchInput && typeof Utils.debounce === 'function') {
        searchInput.addEventListener('input', Utils.debounce(() => {
            currentPage = 0;
            loadScenarios();
        }, 300));
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            currentPage = 0;
            loadScenarios();
        });
    }

    if (newBtn) {
        newBtn.addEventListener('click', () => openScenarioEditModal());
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-container')) {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
        }
    });
}

// ═══════════════════════════════════════════════════════════ LOAD & RENDER
async function loadScenarios() {
    const search = document.getElementById('filter-search')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const tbody = document.getElementById('scenarios-list');

    // Yükleniyor durumu
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8"><span class="mini-spinner" style="margin-right: 8px;"></span> Senaryolar yükleniyor...</td></tr>`;
    }

    try {
        const response = await Api.get('/scenarios', {
            search,
            status,
            page: currentPage,
            size: pageSize,
            sort: 'createdAt,desc'
        });

        // ApiResponse sarmalayıcısını (wrapper) GÜVENLİ AÇMA İŞLEMİ
        const data = (response && response.data && response.data.content !== undefined)
            ? response.data
            : (response || {});

        const items = data.content || (Array.isArray(data) ? data : []);

        renderTable(items);

        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer && typeof Pagination !== 'undefined' && Pagination.render) {
            Pagination.render(paginationContainer, data, (newPage) => {
                currentPage = newPage;
                loadScenarios();
            });
        }
    } catch (err) {
        if (typeof Toast !== 'undefined') Toast.error("Senaryolar yüklenemedi: " + (err.message || "Bilinmeyen hata"));
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-danger">Veriler yüklenemedi.</td></tr>`;
        }
    }
}

function renderTable(scenarios) {
    const tbody = document.getElementById('scenarios-list');
    if (!tbody) return;

    if (!scenarios || scenarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8" style="color: var(--clr-text-muted);">Senaryo bulunamadı.</td></tr>`;
        return;
    }

    tbody.innerHTML = scenarios.map(s => {
        const canEdit = !Auth.hasRole('VIEWER') || Auth.hasRole('ADMIN') || Auth.hasRole('TESTER');
        const status = s.status || 'DRAFT';

        return `
            <tr>
                <td>
                    <div class="text-bold">${Utils.escHtml(s.name)}</div>
                    <div class="text-muted small">${Utils.escHtml(s.baseUrl || 'URL Tanımlanmamış')}</div>
                </td>
                <td><span class="badge badge-${status.toLowerCase()}">${Utils.escHtml(status)}</span></td>
                <td>${Utils.escHtml(s.ownerUsername || 'Bilinmiyor')}</td>
                <td>${s.createdAt ? Utils.formatDate(s.createdAt) : '—'}</td>
                <td class="text-right actions-cell">
                    <button class="btn btn-icon" onclick="window.openScenarioDetail('${Utils.escHtml(s.publicId)}')" title="Detay">👁</button>
                    ${canEdit ? `
                        <div class="dropdown-container" style="position:relative;display:inline-block">
                            <button class="btn btn-icon" onclick="window.toggleActionsMenu(this)" title="Daha Fazla">⋯</button>
                            <div class="dropdown-menu" style="display:none">
                                <button onclick="window.editScenario('${Utils.escHtml(s.publicId)}')">Düzenle</button>
                                <button onclick="window.changeScenarioStatus('${Utils.escHtml(s.publicId)}')">Durumu Değiştir</button>
                                <button class="text-danger" onclick="window.deleteScenario('${Utils.escHtml(s.publicId)}')">Sil</button>
                            </div>
                        </div>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// ═══════════════════════════════════════════════════════════ DROPDOWN
window.toggleActionsMenu = (btn) => {
    const menu = btn.nextElementSibling;
    const isOpen = menu.style.display === 'flex' || menu.style.display === 'grid';
    document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
    if (!isOpen && menu) menu.style.display = 'flex';
};

// ═══════════════════════════════════════════════════════════ DETAIL
window.openScenarioDetail = (publicId) => {
    if (!publicId || publicId.trim() === '') {
        Toast.error('Senaryo ID bulunamadı');
        return;
    }
    window.location.href = 'scenario-detail.html?id=' + encodeURIComponent(publicId);
};

// ═══════════════════════════════════════════════════════════ EDIT/CREATE
window.editScenario = async (publicId) => {
    try {
        const response = await Api.get(`/scenarios/${publicId}`);
        // Backend'den gelen cevabı güvenli aç
        const scenario = response.data ? response.data : response;
        openScenarioEditModal(scenario);
    } catch (err) {
        Toast.error("Senaryo detayları alınamadı.");
    }
};

function openScenarioEditModal(scenario = null) {
    const isEdit = !!scenario;
    const tagsValue = scenario?.tags?.join(',') || '';

    const content = `
        <form id="scenario-form" class="mt-3">
            <div class="form-group mb-4">
                <label class="form-label">Senaryo Adı *</label>
                <input type="text" name="name" class="form-input" value="${Utils.escHtml(scenario?.name || '')}" 
                    required minlength="3" maxlength="255">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div class="form-group">
                    <label class="form-label">Durum</label>
                    <select name="status" class="form-input">
                        <option value="DRAFT" ${scenario?.status === 'DRAFT' ? 'selected' : ''}>Taslak (DRAFT)</option>
                        <option value="READY" ${scenario?.status === 'READY' || !scenario ? 'selected' : ''}>Hazır (READY)</option>
                        <option value="ARCHIVED" ${scenario?.status === 'ARCHIVED' ? 'selected' : ''}>Arşivli (ARCHIVED)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Base URL</label>
                    <input type="url" name="baseUrl" class="form-input" value="${Utils.escHtml(scenario?.baseUrl || '')}" 
                        placeholder="https://example.com">
                </div>
            </div>

            <div class="form-group mb-4">
                <label class="form-label">Açıklama</label>
                <textarea name="description" class="form-input" rows="2" maxlength="500">${Utils.escHtml(scenario?.description || '')}</textarea>
            </div>

            <div class="form-group mb-4">
                <label class="form-label">Etiketler</label>
                <div id="tag-input" class="tag-input-container" data-tags="${Utils.escHtml(tagsValue)}"></div>
            </div>

            <div class="divider"></div>

            <h4 class="mb-3" style="margin-top: 1.5rem;">Browser Ayarları</h4>
            
            <div class="form-group mb-3">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="checkbox" name="headless" ${scenario?.browserConfig?.headless ? 'checked' : ''}>
                    <span>Headless Mode</span>
                </label>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div class="form-group">
                    <label class="form-label">Viewport Genişliği</label>
                    <input type="number" name="viewportWidth" class="form-input" 
                        value="${scenario?.browserConfig?.viewportWidth || 1920}" min="800" max="3840">
                </div>
                <div class="form-group">
                    <label class="form-label">Viewport Yüksekliği</label>
                    <input type="number" name="viewportHeight" class="form-input" 
                        value="${scenario?.browserConfig?.viewportHeight || 1080}" min="600" max="2160">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Bekleme Süresi (saniye)</label>
                <input type="number" name="waitSeconds" class="form-input" 
                    value="${scenario?.browserConfig?.defaultWaitSeconds || 5}" min="1" max="60">
            </div>
        </form>
    `;

    Modal.open({
        title: isEdit ? 'Senaryoyu Düzenle' : 'Yeni Senaryo Oluştur',
        contentHTML: content,
        confirmLabel: 'Kaydet',
        size: 'md',
        onConfirm: async () => {
            await saveScenario(scenario?.publicId || null);
        }
    });

    setupTagInput();
}

function setupTagInput() {
    const container = Modal.getElement('#tag-input');
    if (!container) return;

    const tagsStr = container.getAttribute('data-tags') || '';
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
    window._currentTags = tags;

    function render() {
        container.innerHTML = tags.map(tag => `
            <div class="tag">
                ${Utils.escHtml(tag)}
                <button type="button" onclick="window.removeTag('${Utils.escHtml(tag)}')" title="Sil">✕</button>
            </div>
        `).join('') + `
            <input type="text" placeholder="Etiket ekle ve Enter'a bas..." 
                onkeydown="window.handleTagKeydown(event)" 
                autocomplete="off">
        `;
    }

    render();
}

window.removeTag = (tag) => {
    if (window._currentTags) {
        window._currentTags = window._currentTags.filter(t => t !== tag);
        setupTagInput();
    }
};

window.handleTagKeydown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = e.target;
        const tag = input.value.trim();
        if (tag && !window._currentTags.includes(tag)) {
            window._currentTags.push(tag);
            setupTagInput();
        }
    }
};

async function saveScenario(publicId) {
    const form = Modal.getElement('#scenario-form');
    if (!form) return;

    const formData = new FormData(form);

    // Checkbox değerini güvenli şekilde al
    const isHeadless = form.querySelector('input[name="headless"]')?.checked || false;

    const payload = {
        name: formData.get('name'),
        description: formData.get('description'),
        baseUrl: formData.get('baseUrl'),
        status: formData.get('status'),
        tags: window._currentTags || [],
        browserConfig: {
            headless: isHeadless,
            viewportWidth: parseInt(formData.get('viewportWidth')) || 1920,
            viewportHeight: parseInt(formData.get('viewportHeight')) || 1080,
            defaultWaitSeconds: parseInt(formData.get('waitSeconds')) || 5
        }
    };

    try {
        if (publicId) {
            await Api.patch(`/scenarios/${publicId}`, payload);
            Toast.success("Senaryo güncellendi");
        } else {
            await Api.post('/scenarios', payload);
            Toast.success("Senaryo oluşturuldu");
        }
        Modal.close();
        loadScenarios();
    } catch (err) {
        Toast.error(err.message || "İşlem başarısız");
    }
}

// ═══════════════════════════════════════════════════════════ STATUS CHANGE
window.changeScenarioStatus = async (publicId) => {
    const content = `
        <div style="margin-top:1.5rem">
            <p class="mb-3">Senaryonun yeni durumunu seçin:</p>
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="radio" name="new-status" value="DRAFT"> <span>Taslak (DRAFT)</span>
                </label>
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="radio" name="new-status" value="READY"> <span>Hazır (READY)</span>
                </label>
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="radio" name="new-status" value="ARCHIVED"> <span>Arşivli (ARCHIVED)</span>
                </label>
            </div>
        </div>
    `;

    Modal.open({
        title: 'Durum Değiştir',
        contentHTML: content,
        confirmLabel: 'Değiştir',
        size: 'sm',
        onConfirm: async () => {
            const status = Modal.getElement('input[name="new-status"]:checked')?.value;
            if (!status) {
                Toast.warning("Lütfen bir durum seçin");
                return;
            }
            try {
                await Api.patch(`/scenarios/${publicId}/status`, { status });
                Toast.success("Durum değiştirildi");
                Modal.close();
                loadScenarios();
            } catch (err) {
                Toast.error(err.message || "Durum değiştirilemedi");
            }
        }
    });
};

// ═══════════════════════════════════════════════════════════ DELETE
window.deleteScenario = async (publicId) => {
    const content = `
        <p class="mb-3">Bu senaryoyu silmek istediğinize emin misiniz?</p>
        <div class="alert alert-danger">
            <strong>⚠ Bu işlem geri alınamaz!</strong>
        </div>
    `;

    Modal.open({
        title: 'Senaryoyu Sil',
        contentHTML: content,
        confirmLabel: 'Sil',
        cancelLabel: 'Vazgeç',
        size: 'sm',
        danger: true,
        onConfirm: async () => {
            try {
                await Api.del(`/scenarios/${publicId}`);
                Toast.success("Senaryo silindi");
                Modal.close();
                loadScenarios();
            } catch (err) {
                Toast.error(err.message || "Silme işlemi başarısız");
            }
        }
    });
};