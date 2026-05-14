let currentView = 'GROUPS'; // 'GROUPS' veya 'SCENARIOS'
let currentGroupId = null;
let currentGroupName = "";

let groupPage = 0;
let scenarioPage = 0;
const pageSize = 20;

let allAvailableGroups = []; // Yeni senaryo eklerken dropdown için grupları tutarız

// ═══════════════════════════════════════════════════════════ INITIALIZATION
async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    try {
        Sidebar.render('sidebar-container');
        Topbar.render('topbar-container', 'Test Modülleri');
    } catch (e) { console.warn("UI render hatası:", e); }

    setupEventListeners();
    checkPermissions();

    // Uygulama ilk açıldığında grupları (kartları) yükle
    await fetchAllGroupsForDropdown();
    await loadGroups();
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
else { init(); }

function checkPermissions() {
    const newGroupBtn = document.getElementById('btn-new-group');
    const newScenBtn  = document.getElementById('btn-new-scenario');

    if (Auth.hasRole('VIEWER') && !Auth.hasRole('ADMIN') && !Auth.hasRole('TESTER')) {
        if (newGroupBtn) newGroupBtn.style.display = 'none';
        if (newScenBtn)  newScenBtn.style.display = 'none';
    }
}

function setupEventListeners() {
    const searchInput  = document.getElementById('filter-search');
    const statusFilter = document.getElementById('filter-status');
    const newGroupBtn  = document.getElementById('btn-new-group');
    const newScenBtn   = document.getElementById('btn-new-scenario');

    if (searchInput && typeof Utils.debounce === 'function') {
        searchInput.addEventListener('input', Utils.debounce(() => {
            scenarioPage = 0; loadScenarios();
        }, 300));
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            scenarioPage = 0; loadScenarios();
        });
    }

    if (newGroupBtn) newGroupBtn.addEventListener('click', () => openGroupCreateModal());
    if (newScenBtn)  newScenBtn.addEventListener('click', () => openScenarioEditModal());

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-container')) {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
        }
    });
}

// ═══════════════════════════════════════════════════════════ VIEW MANAGER
function switchView(view) {
    currentView = view;
    const viewGroups = document.getElementById('view-groups');
    const viewScenarios = document.getElementById('view-scenarios');
    const btnGroup = document.getElementById('btn-new-group');
    const btnScenario = document.getElementById('btn-new-scenario');

    if (view === 'GROUPS') {
        viewGroups.style.display = 'block';
        viewScenarios.style.display = 'none';
        btnGroup.style.display = 'block';
        btnScenario.style.display = 'none';
        checkPermissions(); // Yetkiye göre tekrar gizle/göster
        document.getElementById('topbar-container').innerHTML = '';
        Topbar.render('topbar-container', 'Test Modülleri');
    } else {
        viewGroups.style.display = 'none';
        viewScenarios.style.display = 'block';
        btnGroup.style.display = 'none';
        btnScenario.style.display = 'block';
        checkPermissions();
        document.getElementById('topbar-container').innerHTML = '';
        Topbar.render('topbar-container', 'Senaryolar');
    }
}

// ═══════════════════════════════════════════════════════════ GROUPS (KARTLAR)
async function fetchAllGroupsForDropdown() {
    try {
        const response = await Api.get('/scenario-groups', { size: 100 });
        allAvailableGroups = (response && response.data && response.data.content) ? response.data.content : [];
    } catch (e) { console.warn("Gruplar dropdown için alınamadı"); }
}

async function loadGroups() {
    const grid = document.getElementById('groups-list');
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem;"><span class="mini-spinner"></span> Modüller yükleniyor...</div>`;

    try {
        const response = await Api.get('/scenario-groups', { page: groupPage, size: pageSize, sort: 'createdAt,desc' });
        const data = response?.data || response || {};
        const items = data.content || [];

        renderGroupsGrid(items);

        const paginationContainer = document.getElementById('groups-pagination-container');
        if (paginationContainer && typeof Pagination !== 'undefined' && Pagination.render) {
            Pagination.render(paginationContainer, data, (newPage) => {
                groupPage = newPage; loadGroups();
            });
        }
    } catch (err) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--clr-danger);">Gruplar yüklenemedi.</div>`;
    }
}

function renderGroupsGrid(groups) {
    const grid = document.getElementById('groups-list');
    if (!groups || groups.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--clr-text-muted); background: var(--clr-surface-2); border-radius: var(--radius-md);">Henüz bir modül oluşturulmamış. "Yeni Modül" butonuna tıklayarak başlayabilirsiniz.</div>`;
        return;
    }

    const canEdit = !Auth.hasRole('VIEWER') || Auth.hasRole('ADMIN') || Auth.hasRole('TESTER');

    grid.innerHTML = groups.map(g => {
        const canPlay = (g.readyScenarios || 0) > 0;
        return `
            <div class="group-card" onclick="window.openGroup('${g.publicId}', '${Utils.escHtml(g.name).replace(/'/g, "\\'")}')">
                ${canPlay ? `<button class="play-group-btn" onclick="event.stopPropagation(); window.playGroup(this, '${g.publicId}', '${Utils.escHtml(g.name).replace(/'/g, "\\'")}')" title="Hazır senaryoları çalıştır">Play</button>` : ''}
                ${canEdit ? `<button class="delete-group-btn" onclick="event.stopPropagation(); window.deleteGroup('${g.publicId}')" title="Modülü Sil">✕</button>` : ''}
                <div class="group-card-header">
                    <div class="group-card-title">📁 ${Utils.escHtml(g.name)}</div>
                </div>
                <div class="group-card-desc">${Utils.escHtml(g.description || 'Açıklama bulunmuyor.')}</div>
                
                <div class="group-stats">
                    <span class="stat-badge">Toplam: ${g.totalScenarios || 0}</span>
                    ${g.readyScenarios > 0 ? `<span class="stat-badge stat-ready">Hazır: ${g.readyScenarios}</span>` : ''}
                    ${g.draftScenarios > 0 ? `<span class="stat-badge stat-draft">Taslak: ${g.draftScenarios}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

window.openGroup = (groupId, groupName) => {
    currentGroupId = groupId;
    currentGroupName = groupName;
    document.getElementById('current-group-title').innerText = groupName;

    // Tabloya geçerken filtreleri sıfırla
    if (document.getElementById('filter-search')) document.getElementById('filter-search').value = '';
    if (document.getElementById('filter-status')) document.getElementById('filter-status').value = '';
    scenarioPage = 0;

    switchView('SCENARIOS');
    loadScenarios();
};

window.backToGroups = () => {
    currentGroupId = null;
    currentGroupName = "";
    switchView('GROUPS');
    loadGroups(); // İstatistiklerin güncellenmesi için tekrar yükle
};

window.openGroupCreateModal = () => {
    const content = `
        <form id="group-form" class="mt-3">
            <div class="form-group mb-4">
                <label class="form-label">Modül Adı *</label>
                <input type="text" name="name" class="form-input" placeholder="Örn: YouTube Testleri" required minlength="3" maxlength="255">
            </div>
            <div class="form-group mb-4">
                <label class="form-label">Açıklama</label>
                <textarea name="description" class="form-input" rows="3" placeholder="Bu modülde ne tür senaryolar bulunacak?"></textarea>
            </div>
        </form>
    `;

    Modal.open({
        title: 'Yeni Modül Oluştur',
        contentHTML: content,
        confirmLabel: 'Oluştur',
        size: 'md',
        onConfirm: async () => {
            const form = Modal.getElement('#group-form');
            if (!form.checkValidity()) { form.reportValidity(); return false; }

            const formData = new FormData(form);
            try {
                await Api.post('/scenario-groups', {
                    name: formData.get('name'),
                    description: formData.get('description')
                });
                Toast.success("Modül başarıyla oluşturuldu");
                Modal.close();
                await fetchAllGroupsForDropdown(); // Dropdown listesini güncelle
                loadGroups(); // Kartları yenile
            } catch (e) {
                Toast.error(e.message || "Modül oluşturulamadı");
                return false; // Modal kapanmasın
            }
        }
    });
};

window.deleteGroup = (publicId) => {
    const content = `
        <p class="mb-3">Bu modülü silmek istediğinize emin misiniz?</p>
        <div class="alert alert-warning">
            İçindeki senaryolar silinmez, sadece <strong>"Modülsüz"</strong> duruma düşerler.
        </div>
    `;

    Modal.open({
        title: 'Modülü Sil',
        contentHTML: content,
        confirmLabel: 'Sil',
        cancelLabel: 'Vazgeç',
        size: 'sm',
        danger: true,
        onConfirm: async () => {
            try {
                await Api.del(`/scenario-groups/${publicId}`);
                Toast.success("Modül silindi");
                Modal.close();
                await fetchAllGroupsForDropdown();
                loadGroups();
            } catch (err) {
                Toast.error(err.message || "Silme işlemi başarısız");
            }
        }
    });
};

// ═══════════════════════════════════════════════════════════ SCENARIOS (TABLO)
async function loadScenarios() {
    const search = document.getElementById('filter-search')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const tbody  = document.getElementById('scenarios-list');

    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8"><span class="mini-spinner"></span> Senaryolar yükleniyor...</td></tr>`;

    try {
        // YENİ: groupPublicId parametresi ekleniyor
        const response = await Api.get('/scenarios', {
            search, status,
            groupPublicId: currentGroupId,
            page: scenarioPage, size: pageSize, sort: 'createdAt,desc'
        });

        const data  = response?.data?.content !== undefined ? response.data : response;
        renderScenariosTable(data.content || []);

        const paginationContainer = document.getElementById('scenarios-pagination-container');
        if (paginationContainer && typeof Pagination !== 'undefined' && Pagination.render) {
            Pagination.render(paginationContainer, data, (newPage) => {
                scenarioPage = newPage; loadScenarios();
            });
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-danger">Senaryolar yüklenemedi.</td></tr>`;
    }
}

function renderScenariosTable(scenarios) {
    const tbody = document.getElementById('scenarios-list');
    if (!scenarios || scenarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-muted">Bu modülde henüz senaryo bulunmuyor.</td></tr>`;
        return;
    }

    const canEdit = !Auth.hasRole('VIEWER') || Auth.hasRole('ADMIN') || Auth.hasRole('TESTER');

    tbody.innerHTML = scenarios.map(s => {
        const status = s.status || 'DRAFT';
        return `
            <tr>
                <td>
                    <div class="text-bold">${Utils.escHtml(s.name)}</div>
                    <div class="text-muted small">${Utils.escHtml(s.baseUrl || 'URL Tanımlanmamış')}</div>
                </td>
                <td><span class="badge badge-${status.toLowerCase()}">${Utils.escHtml(status)}</span></td>
                <td>${Utils.escHtml(s.owner?.username || s.ownerUsername || 'Bilinmiyor')}</td>
                <td>${s.createdAt ? Utils.formatDate(s.createdAt) : '—'}</td>
                <td class="text-right actions-cell">
                    <button class="btn btn-icon" onclick="window.openScenarioDetail('${Utils.escHtml(s.publicId)}')" title="Detaya Git" style="font-size:1.05rem; color:var(--clr-primary);">&#8599;</button>
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

window.toggleActionsMenu = (btn) => {
    const menu = btn.nextElementSibling;
    const isOpen = menu.style.display === 'flex' || menu.style.display === 'grid';
    document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
    if (!isOpen && menu) menu.style.display = 'flex';
};

window.openScenarioDetail = (publicId) => {
    window.location.href = 'scenario-detail.html?id=' + encodeURIComponent(publicId);
};

// ═══════════════════════════════════════════════════════════ SENARYO OLUŞTUR / DÜZENLE
window.editScenario = async (publicId) => {
    try {
        const response = await Api.get(`/scenarios/${publicId}`);
        openScenarioEditModal(response.data || response);
    } catch (err) { Toast.error("Detaylar alınamadı."); }
};

function openScenarioEditModal(scenario = null) {
    const isEdit = !!scenario;
    const tagsValue = scenario?.tags?.join(',') || '';
    const curStatus = scenario?.status || 'DRAFT';

    // Düzenlemede var olan grubu, yenide bulunduğumuz grubu otomatik seç
    const preSelectedGroupId = scenario?.groupPublicId || currentGroupId;

    let groupOptions = `<option value="">-- Modül Seçilmedi (Bağımsız) --</option>`;
    allAvailableGroups.forEach(g => {
        const selected = g.publicId === preSelectedGroupId ? 'selected' : '';
        groupOptions += `<option value="${g.publicId}" ${selected}>${Utils.escHtml(g.name)}</option>`;
    });

    const groupField = isEdit ? `
            <div class="form-group mb-4">
                <label class="form-label">Ait Olduğu Modül</label>
                <select name="groupPublicId" class="form-input">
                    ${groupOptions}
                </select>
            </div>
        ` : '';

    const content = `
        <form id="scenario-form" class="mt-3">
            <div class="form-group mb-4">
                <label class="form-label">Senaryo Adı *</label>
                <input type="text" name="name" class="form-input" value="${Utils.escHtml(scenario?.name || '')}" required minlength="3">
            </div>

            ${groupField}

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div class="form-group">
                    <label class="form-label">Durum</label>
                    <select name="status" class="form-input">
                        <option value="DRAFT" ${curStatus === 'DRAFT' ? 'selected' : ''}>Taslak</option>
                        <option value="READY" ${curStatus === 'READY' ? 'selected' : ''}>Hazır</option>
                        <option value="ARCHIVED" ${curStatus === 'ARCHIVED' ? 'selected' : ''}>Arşivli</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Base URL</label>
                    <input type="url" name="baseUrl" class="form-input" value="${Utils.escHtml(scenario?.baseUrl || '')}" placeholder="https://example.com">
                </div>
            </div>

            <div class="form-group mb-4">
                <label class="form-label">Açıklama</label>
                <textarea name="description" class="form-input" rows="2">${Utils.escHtml(scenario?.description || '')}</textarea>
            </div>
            <div class="form-group mb-4">
                <label class="form-label">Etiketler</label>
                <div id="tag-input" class="tag-input-container" data-tags="${Utils.escHtml(tagsValue)}"></div>
            </div>

            <div class="divider"></div><h4 class="mb-3 mt-3">Browser Ayarları</h4>
            <div class="form-group mb-3">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="checkbox" name="headless" ${scenario?.browserConfig?.headless ? 'checked' : ''}> <span>Headless Mode</span>
                </label>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div class="form-group">
                    <label class="form-label">Viewport Genişliği</label>
                    <input type="number" name="viewportWidth" class="form-input" value="${scenario?.browserConfig?.viewportWidth || 1920}">
                </div>
                <div class="form-group">
                    <label class="form-label">Viewport Yüksekliği</label>
                    <input type="number" name="viewportHeight" class="form-input" value="${scenario?.browserConfig?.viewportHeight || 1080}">
                </div>
            </div>
        </form>
    `;

    Modal.open({
        title: isEdit ? 'Senaryoyu Düzenle' : 'Yeni Senaryo Oluştur',
        contentHTML: content,
        confirmLabel: 'Kaydet',
        size: 'md',
        onConfirm: async () => await saveScenario(scenario?.publicId || null, isEdit)
    });
    setupTagInput();
}

function setupTagInput() {
    const container = Modal.getElement('#tag-input');
    if (!container) return;
    const tagsStr = container.getAttribute('data-tags') || '';
    window._currentTags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

    function render() {
        container.innerHTML = window._currentTags.map(tag => `
            <div class="tag">${Utils.escHtml(tag)} <button type="button" onclick="window.removeTag('${Utils.escHtml(tag)}')">✕</button></div>
        `).join('') + `<input type="text" placeholder="Etiket ekle + Enter" onkeydown="window.handleTagKeydown(event)">`;
    }
    render();
    window.removeTag = (tag) => { window._currentTags = window._currentTags.filter(t => t !== tag); render(); };
    window.handleTagKeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); const t = e.target.value.trim(); if (t && !window._currentTags.includes(t)) { window._currentTags.push(t); render(); } }
    };
}

async function saveScenario(publicId, isEdit) {
    const form = Modal.getElement('#scenario-form');
    if (!form.checkValidity()) { form.reportValidity(); return false; }
    const formData = new FormData(form);

    const groupPublicId = isEdit ? formData.get('groupPublicId') : currentGroupId;
    const payload = {
        name: formData.get('name'),
        description: formData.get('description'),
        baseUrl: formData.get('baseUrl') || null,
        status: formData.get('status'),
        groupPublicId: groupPublicId && groupPublicId.trim() !== "" ? groupPublicId : null,
        tags: window._currentTags || [],
        browserConfig: {
            headless: form.querySelector('input[name="headless"]')?.checked || false,
            viewportWidth: parseInt(formData.get('viewportWidth')) || 1920,
            viewportHeight: parseInt(formData.get('viewportHeight')) || 1080
        }
    };

    try {
        if (isEdit) {
            await Api.patch(`/scenarios/${publicId}`, payload);
            await Api.patch(`/scenarios/${publicId}/status`, { status: payload.status });
            Toast.success("Senaryo güncellendi");
        } else {
            await Api.post('/scenarios', payload);
            Toast.success("Senaryo oluşturuldu");
        }
        Modal.close();
        loadScenarios(); // Mevcut grubun tablosunu yenile
    } catch (err) { Toast.error(err.message || "İşlem başarısız"); return false; }
}

window.changeScenarioStatus = async (publicId) => {
    // Mevcut kod değişmeden durabilir, kısaltıyorum:
    Modal.open({
        title: 'Durum Değiştir', size: 'sm', confirmLabel: 'Değiştir',
        contentHTML: `<div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem;">
            <label><input type="radio" name="ns" value="DRAFT"> Taslak</label>
            <label><input type="radio" name="ns" value="READY"> Hazır</label>
            <label><input type="radio" name="ns" value="ARCHIVED"> Arşivli</label>
        </div>`,
        onConfirm: async () => {
            const st = Modal.getElement('input[name="ns"]:checked')?.value;
            if (!st) { Toast.warning("Seçim yapın"); return false; }
            try { await Api.patch(`/scenarios/${publicId}/status`, { status: st }); Toast.success("Değiştirildi"); Modal.close(); loadScenarios(); }
            catch (err) { Toast.error("Hata!"); return false; }
        }
    });
}

window.deleteScenario = async (publicId) => {
    Modal.open({
        title: 'Senaryoyu Sil', size: 'sm', confirmLabel: 'Sil', danger: true,
        contentHTML: `<p>Silmek istediğinize emin misiniz?</p>`,
        onConfirm: async () => {
            try { await Api.del(`/scenarios/${publicId}`); Toast.success("Silindi"); Modal.close(); loadScenarios(); }
            catch (err) { Toast.error("Hata!"); return false; }
        }
    });
};

function showYesNoModal({
    title = 'Onay',
    message = '',
    confirmLabel = 'Evet',
    cancelLabel = 'Hayır',
} = {}) {
    return new Promise((resolve) => {
        Modal.open({
            title,
            contentHTML: `<p style="color:var(--clr-text-muted);font-size:.9rem;line-height:1.6">${Utils.escHtml(message)}</p>`,
            confirmLabel,
            cancelLabel,
            showCancel: true,
            onConfirm: async () => {
                Modal.close();
                resolve(true);
            },
            onCancel: () => {
                resolve(false);
            },
        });
    });
}

window.playGroup = async (btn, groupPublicId, groupName) => {
    if (!btn || btn.dataset.running === '1') return;
    const confirmRun = await showYesNoModal({
        title: 'Senaryoları Çalıştır',
        message: `${groupName} modülündeki hazır senaryolar sırayla çalıştırılacak. Onaylıyor musunuz?`,
        confirmLabel: 'Evet',
        cancelLabel: 'Hayır',
    });
    if (!confirmRun) return;

    btn.dataset.running = '1';
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Çalışıyor...';

    try {
        const response = await Api.get('/scenarios', {
            groupPublicId,
            status: 'READY',
            page: 0,
            size: 1000,
            sort: 'createdAt,desc'
        });
        const data = response?.data || response || {};
        const items = data.content || [];

        if (!items.length) {
            Toast.warning('Hazır senaryo bulunamadı.');
            return;
        }

        let successCount = 0;
        for (let i = 0; i < items.length; i++) {
            btn.textContent = `Çalışıyor ${i + 1}/${items.length}`;
            try {
                await Api.post(`/scenarios/${items[i].publicId}/execute`, {});
                successCount += 1;
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                Toast.error('Çalıştırma sırasında hata: ' + (err.message || 'Bilinmeyen hata'));
                break;
            }
        }

        Toast.success(`${successCount}/${items.length} senaryo kuyruğa alındı.`);
    } catch (err) {
        Toast.error('Hazır senaryolar getirilemedi: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
        btn.dataset.running = '0';
    }
};
