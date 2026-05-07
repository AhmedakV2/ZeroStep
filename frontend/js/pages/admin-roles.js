const AdminRolesPage = (() => {
    let currentPage = 0;
    const pageSize = 10;

    async function init() {
        // Auth kontrolü
        if (!Auth.isLoggedIn()) {
            window.location.href = '../../index.html';
            return;
        }

        // Admin kontrol
        if (!Auth.isAdmin()) {
            Toast.error('Bu sayfaya erişim izniniz yok.');
            window.location.href = '../dashboard.html';
            return;
        }

        // Bileşenleri Başlat
        if (typeof Sidebar !== 'undefined') Sidebar.render('sidebar');
        if (typeof Topbar !== 'undefined') Topbar.render('topbar', 'Rol Yönetimi');

        // Veriyi Yükle
        await loadRoles();

        // Event Listeners
        document.getElementById('role-search')?.addEventListener('input', Utils.debounce(() => {
            currentPage = 0;
            loadRoles();
        }, 500));

        document.getElementById('create-role-btn')?.addEventListener('click', openCreateModal);
    }

    async function loadRoles() {
        const tbody = document.getElementById('roles-body');
        const search = document.getElementById('role-search')?.value || '';

        try {
            // Backend endpoint varsayımı: GET /api/v1/admin/roles
            const response = await Api.get('/admin/roles', {
                page: currentPage,
                size: pageSize,
                search: search
            });

            let items = [];
            if (response?.content) {
                items = response.content;
            } else if (Array.isArray(response)) {
                items = response;
            } else if (response?.data?.content) {
                items = response.data.content;
            }

            if (!items || items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8">Rol bulunamadı.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map(role => {
                const roleId = role.id || role.publicId || '';

                return `
                <tr>
                    <td>
                        <div style="font-weight:600">${Utils.escHtml(role.name || '—')}</div>
                    </td>
                    <td>${Utils.escHtml(role.description || '—')}</td>
                    <td><span class="badge badge-outline">${role.userCount || 0} Kullanıcı</span></td>
                    <td>${role.createdAt ? Utils.formatDate(role.createdAt) : '—'}</td>
                    <td style="text-align: right;">
                        <button class="btn btn-ghost btn-sm" onclick="AdminRolesPage.editRole('${Utils.escHtml(roleId)}')" title="Düzenle">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm text-danger" onclick="AdminRolesPage.deleteRole('${Utils.escHtml(roleId)}', '${Utils.escHtml(role.name)}')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `}).join('');

            renderPagination(response);

        } catch (error) {
            console.error(error);
            Toast.error("Roller yüklenirken bir hata oluştu: " + error.message);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-8">Hata: Veri alınamadı.</td></tr>`;
        }
    }

    function renderPagination(data) {
        if (typeof Pagination === 'undefined') return;

        const paginationEl = document.getElementById('pagination-container');
        if (!paginationEl) return;

        if (!data || data.totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        Pagination.render(paginationEl, {
            totalPages: data.totalPages,
            number: data.number || 0,
            totalElements: data.totalElements || 0,
            size: data.size || pageSize
        }, (page) => {
            currentPage = page;
            loadRoles();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function openCreateModal() {
        if (typeof Modal === 'undefined') {
            console.error('Modal bileşeni bulunamadı!');
            return;
        }

        const contentHTML = `
            <div style="display:flex;flex-direction:column;gap:1rem;margin-top:.5rem;">
                <div class="form-group">
                    <label class="form-label">Rol Adı <span style="color:var(--clr-danger)">*</span></label>
                    <input type="text" id="create-role-name" class="form-input" placeholder="Örn: MANAGER" maxlength="50" style="text-transform: uppercase;">
                    <span class="form-error" id="role-name-error"></span>
                </div>
                <div class="form-group">
                    <label class="form-label">Açıklama</label>
                    <textarea id="create-role-desc" class="form-input" placeholder="Rolün yetkilerini kısaca açıklayın..." rows="3"></textarea>
                </div>
                <div id="create-error" class="alert alert-danger hidden"></div>
            </div>
        `;

        Modal.open({
            title: 'Yeni Rol Oluştur',
            contentHTML: contentHTML,
            confirmLabel: 'Oluştur',
            size: 'md',
            onConfirm: async () => {
                await saveNewRole();
            }
        });
    }

    async function saveNewRole() {
        const nameInput = document.getElementById('create-role-name');
        const name = nameInput?.value?.trim().toUpperCase() || '';
        const description = document.getElementById('create-role-desc')?.value?.trim() || '';
        const errorEl = document.getElementById('create-error');

        // Validasyon
        if (!name) {
            document.getElementById('role-name-error').textContent = 'Rol adı zorunludur.';
            errorEl.classList.remove('hidden');
            errorEl.textContent = 'Lütfen zorunlu alanları doldurun.';
            return;
        }

        const payload = { name, description };

        try {
            // POST /api/v1/admin/roles
            await Api.post('/admin/roles', payload);

            Toast.success(`${name} rolü başarıyla oluşturuldu.`);
            Modal.close();
            currentPage = 0;
            loadRoles();
        } catch (err) {
            console.error('Rol oluşturma hatası:', err);
            errorEl.classList.remove('hidden');
            errorEl.textContent = err.message || 'Rol oluşturulamadı';
        }
    }

    function editRole(id) {
        if (!id || id === 'undefined') return;
        Toast.info('Rol düzenleme özelliği yakında eklenecek.');
    }

    async function deleteRole(id, roleName) {
        if (!id || id === 'undefined') return;

        ConfirmDialog.show({
            title: 'Rolü Sil',
            message: `<strong>${Utils.escHtml(roleName)}</strong> rolünü silmek istediğinize emin misiniz? Bu role sahip kullanıcılar etkilenebilir.`,
            confirmLabel: 'Evet, Sil',
            onConfirm: async () => {
                try {
                    // DELETE /api/v1/admin/roles/{id}
                    await Api.del(`/admin/roles/${id}`);
                    Toast.success('Rol başarıyla silindi.');
                    ConfirmDialog.close();
                    loadRoles();
                } catch (err) {
                    console.error('Silme hatası:', err);
                    Toast.error('Silme işlemi başarısız: ' + err.message);
                }
            }
        });
    }

    return { init, editRole, deleteRole };
})();

window.AdminRolesPage = AdminRolesPage;
document.addEventListener('DOMContentLoaded', AdminRolesPage.init);