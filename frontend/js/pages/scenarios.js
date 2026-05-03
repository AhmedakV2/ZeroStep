let currentPage = 0;
const pageSize = 20;

// ═══════════════════════════════════════════════════════════ INITIALIZATION
async function init() {
    // Auth guard
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    // Layout bileşenlerini render et
    Sidebar.render('sidebar-container');
    Topbar.render('topbar-container', 'Senaryo Yönetimi');

    setupEventListeners();
    checkPermissions();
    await loadScenarios();
}

// DOM hazır olduğunda init çalıştır
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

    if (searchInput) {
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

    // Dropdown kapatma (sayfa düzeyinde)
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

    try {
        const data = await Api.get('/scenarios', {
            search,
            status,
            page: currentPage,
            size: pageSize,
            sort: 'createdAt,desc'
        });

        renderTable(data.content);
        Pagination.render(document.getElementById('pagination-container'), data, (newPage) => {
            currentPage = newPage;
            loadScenarios();
        });
    } catch (err) {
        Toast.error("Senaryolar yüklenemedi: " + (err.message || "Bilinmeyen hata"));
    }
}

function renderTable(scenarios) {
    const tbody = document.getElementById('scenarios-list');
    if (!tbody) return;

    if (scenarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8">Senaryo bulunamadı.</td></tr>`;
        return;
    }

    tbody.innerHTML = scenarios.map(s => {
        const canEdit = !Auth.hasRole('VIEWER') || Auth.hasRole('ADMIN') || Auth.hasRole('TESTER');
        return `
            <tr>
                <td>
                    <div class="text-bold">${Utils.escHtml(s.name)}</div>
                    <div class="text-muted small">${Utils.escHtml(s.baseUrl || 'URL Tanımlanmamış')}</div>
                </td>
                <td><span class="badge badge-${s.status.toLowerCase()}">${s.status}</span></td>
                <td>${Utils.escHtml(s.ownerUsername)}</td>
                <td>${Utils.formatDate(s.createdAt)}</td>
                <td class="text-right actions-cell">
                    <button class="btn btn-icon" onclick="window.openScenarioDetail('${s.publicId}')" title="Detay">👁</button>
                    ${canEdit ? `
                        <div class="dropdown-container" style="position:relative;display:inline-block">
                            <button class="btn btn-icon" onclick="window.toggleActionsMenu(this)" title="Daha Fazla">⋯</button>
                            <div class="dropdown-menu" style="display:none">
                                <button onclick="window.editScenario('${s.publicId}')">Düzenle</button>
                                <button onclick="window.changeScenarioStatus('${s.publicId}')">Durumu Değiştir</button>
                                <button class="text-danger" onclick="window.deleteScenario('${s.publicId}')">Sil</button>
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
    if (!isOpen) menu.style.display = 'flex';
};

// ═══════════════════════════════════════════════════════════ DETAIL
window.openScenarioDetail = (publicId) => {
    window.location.hash = `#/scenarios/${publicId}`;
};

// ═══════════════════════════════════════════════════════════ EDIT/CREATE
window.editScenario = async (publicId) => {
    try {
        const scenario = await Api.get(`/scenarios/${publicId}`);
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

            <div class="form-group mb-4">
                <label class="form-label">Açıklama</label>
                <textarea name="description" class="form-input" rows="2" maxlength="500">${Utils.escHtml(scenario?.description || '')}</textarea>
            </div>

            <div class="form-group mb-4">
                <label class="form-label">Base URL</label>
                <input type="url" name="baseUrl" class="form-input" value="${Utils.escHtml(scenario?.baseUrl || '')}" 
                    placeholder="https://example.com">
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
        title: isEdit ? 'Senaryoyu Düzenle' : 'Yeni Senaryo',
        contentHTML: content,
        confirmLabel: 'Kaydet',
        size: 'md',
        onConfirm: async () => {
            await saveScenario(scenario?.publicId || null);
        }
    });

    // Tag input'u setup et
    setupTagInput();
}

function setupTagInput() {
    const container = Modal.getElement('#tag-input');
    if (!container) return;

    // Başlangıç tag'lerini al
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

    const payload = {
        name: formData.get('name'),
        description: formData.get('description'),
        baseUrl: formData.get('baseUrl'),
        tags: window._currentTags || [],
        browserConfig: {
            headless: form.headless.checked,
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
