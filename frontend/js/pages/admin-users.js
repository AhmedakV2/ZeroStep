const AdminUsersPage = (() => {
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
        if (typeof Topbar !== 'undefined') Topbar.render('topbar', 'Kullanıcı Yönetimi');

        // Veriyi Yükle
        await loadUsers();

        // Event Listeners
        document.getElementById('user-search')?.addEventListener('input', Utils.debounce(() => {
            currentPage = 0;
            loadUsers();
        }, 500));

        document.getElementById('create-user-btn')?.addEventListener('click', openCreateModal);
    }

    async function loadUsers() {
        const tbody = document.getElementById('users-body');
        const search = document.getElementById('user-search')?.value || '';

        try {
            // Backend endpoint: GET /api/v1/admin/users
            const response = await Api.get('/admin/users', {
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
                tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8">Kullanıcı bulunamadı.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map(user => {
                // Backend'den id mi publicId mi döndüğünü kontrol edip güvene alıyoruz
                const uid = user.publicId || user.id || user.userId || '';

                return `
                <tr>
                    <td>
                        <div style="font-weight:600">${Utils.escHtml(user.username || '—')}</div>
                        <small style="color:var(--clr-text-muted)">ID: ${Utils.escHtml(uid || '—')}</small>
                    </td>
                    <td>${Utils.escHtml(user.email || '—')}</td>
                    <td>${user.roles && user.roles.length ? user.roles.map(r => `<span class="badge badge-outline">${Utils.escHtml(r)}</span>`).join(' ') : '—'}</td>
                    <td>
                        <span class="status-pill ${user.enabled ? 'status-passed' : 'status-failed'}">
                            ${user.enabled ? 'Aktif' : 'Pasif'}
                        </span>
                    </td>
                    <td>${user.createdAt ? Utils.formatDate(user.createdAt) : '—'}</td>
                    <td style="text-align: right;">
                        <button class="btn btn-ghost btn-sm" onclick="AdminUsersPage.editUser('${Utils.escHtml(uid)}')" title="Düzenle">
                            ✎
                        </button>
                        <button class="btn btn-ghost btn-sm text-danger" onclick="AdminUsersPage.deleteUser('${Utils.escHtml(uid)}')" title="Sil">
                            ✕
                        </button>
                    </td>
                </tr>
            `}).join('');

            renderPagination(response);

        } catch (error) {
            console.error(error);
            Toast.error("Kullanıcılar yüklenirken bir hata oluştu: " + error.message);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger p-8">Hata: Veri alınamadı.</td></tr>`;
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
            loadUsers();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function openCreateModal() {
        if (typeof Modal === 'undefined') {
            console.error('Modal bileşeni bulunamadı!');
            Toast.error('Modal yüklenemedi');
            return;
        }

        const contentHTML = `
            <div style="display:flex;flex-direction:column;gap:1rem;margin-top:.5rem;">
                <div class="form-group">
                    <label class="form-label">Kullanıcı Adı <span style="color:var(--clr-danger)">*</span></label>
                    <input type="text" id="create-username" class="form-input" placeholder="Örn: ahmet123" maxlength="50">
                    <span class="form-error" id="username-error"></span>
                </div>
                <div class="form-group">
                    <label class="form-label">E-posta <span style="color:var(--clr-danger)">*</span></label>
                    <input type="email" id="create-email" class="form-input" placeholder="Örn: ahmet@example.com">
                    <span class="form-error" id="email-error"></span>
                </div>
                <div class="form-group">
                    <label class="form-label" style="color:var(--clr-text-muted);font-size:.85rem;">Geçici Şifre</label>
                    <div style="padding:.75rem;background:var(--clr-bg-secondary);border-radius:var(--radius);font-size:.85rem;color:var(--clr-text-muted);">
                        ℹ Sistem otomatik güvenli bir geçici şifre oluşturacak. Kullanıcı ilk girişte şifresini değiştirmek zorunda kalacak.
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Roller</label>
                    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:.5rem;">
                        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
                            <input type="checkbox" value="ADMIN" id="role-admin"> ADMIN
                        </label>
                        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
                            <input type="checkbox" value="TESTER" id="role-tester"> TESTER
                        </label>
                        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
                            <input type="checkbox" value="VIEWER" id="role-viewer"> VIEWER
                        </label>
                    </div>
                </div>
                <div id="create-error" class="alert alert-danger hidden"></div>
            </div>
        `;

        Modal.open({
            title: 'Yeni Kullanıcı Oluştur',
            contentHTML: contentHTML,
            confirmLabel: 'Oluştur',
            size: 'md',
            onConfirm: async () => {
                await saveNewUser();
            }
        });
    }

    async function saveNewUser() {
        const username = document.getElementById('create-username')?.value?.trim() || '';
        const email = document.getElementById('create-email')?.value?.trim() || '';
        const errorEl = document.getElementById('create-error');

        // Validasyon
        let hasError = false;
        if (!username) {
            document.getElementById('username-error').textContent = 'Kullanıcı adı zorunlu';
            hasError = true;
        }
        if (!email) {
            document.getElementById('email-error').textContent = 'E-posta zorunlu';
            hasError = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            document.getElementById('email-error').textContent = 'Geçerli bir e-posta girin';
            hasError = true;
        }

        if (hasError) {
            errorEl.classList.remove('hidden');
            errorEl.textContent = 'Lütfen tüm zorunlu alanları doldurun.';
            return;
        }

        // Seçili rolleri al
        const selectedRoles = [];
        if (document.getElementById('role-admin')?.checked) selectedRoles.push('ADMIN');
        if (document.getElementById('role-tester')?.checked) selectedRoles.push('TESTER');
        if (document.getElementById('role-viewer')?.checked) selectedRoles.push('VIEWER');

        if (selectedRoles.length === 0) {
            document.getElementById('create-error').classList.remove('hidden');
            document.getElementById('create-error').textContent = 'En az bir rol seçilmeli';
            return;
        }

        const payload = {
            username,
            email,
            roles: selectedRoles
        };

        try {
            // POST /api/v1/admin/users
            const response = await Api.post('/admin/users', payload);
            const tempPassword = response?.temporaryPassword || '(bilinmiyor)';
            const username = response?.username || payload.username;

            // Şifreyi modal'da büyük göster
            Modal.open({
                title: '✓ Kullanıcı Oluşturuldu',
                contentHTML: `
                    <div style="text-align:center;padding:1.5rem;">
                        <p style="color:var(--clr-text-muted);margin-bottom:1.5rem;font-size:.9rem;">
                            ${Utils.escHtml(username)} kullanıcısı başarıyla oluşturuldu.
                        </p>
                        <div style="background:var(--clr-bg-secondary);border-radius:var(--radius);padding:1.5rem;margin-bottom:1.5rem;border:2px solid var(--clr-primary);">
                            <div style="font-size:.75rem;color:var(--clr-text-muted);margin-bottom:.5rem;letter-spacing:.05em;text-transform:uppercase;">Geçici Şifre</div>
                            <div style="font-size:1.4rem;font-weight:700;font-family:var(--font-mono);word-break:break-all;color:var(--clr-primary);user-select:all;" id="temp-pwd-display">${Utils.escHtml(tempPassword)}</div>
                        </div>
                        <p style="color:var(--clr-text-muted);font-size:.8rem;line-height:1.6;margin-bottom:1.5rem;">
                            <strong>⚠ Önemli:</strong><br>
                            Bu şifreyi güvenli bir yere kaydedin.<br>
                            Kullanıcı ilk girişte şifresini değiştirmek zorunda kalacak.
                        </p>
                        <button class="btn btn-primary" onclick="AdminUsersPage.copyPassword()" style="margin-right:.5rem;">
                            📋 Şifreyi Kopyala
                        </button>
                    </div>
                `,
                confirmLabel: 'Tamam',
                showCancel: false,
                onConfirm: async () => {
                    Modal.close();
                    currentPage = 0;
                    loadUsers();
                }
            });
        } catch (err) {
            console.error('Kullanıcı oluşturma hatası:', err);
            errorEl.classList.remove('hidden');
            errorEl.textContent = err.message || 'Kullanıcı oluşturulamadı';
        }
    }

    function editUser(id) {
        if (!id || id === 'undefined') {
            Toast.error('Kullanıcı kimliği bulunamadı.');
            return;
        }
        Toast.info('Düzenleme özelliği yakında eklenecek.');
        // TODO: Düzenleme modal'ı
    }

    function copyPassword() {
        const pwdEl = document.getElementById('temp-pwd-display');
        if (pwdEl) {
            const text = pwdEl.textContent;
            navigator.clipboard.writeText(text).then(() => {
                Toast.success('Şifre kopyalandı!');
            }).catch(() => {
                Toast.error('Kopyalanamadı. Manuel kopyala.');
            });
        }
    }

    async function deleteUser(id) {
        if (!id || id === 'undefined') {
            Toast.error('Kullanıcı kimliği bulunamadı.');
            return;
        }

        ConfirmDialog.show({
            title: 'Kullanıcıyı Sil',
            message: 'Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            confirmLabel: 'Evet, Sil',
            onConfirm: async () => {
                try {
                    // DELETE /api/v1/admin/users/{id}
                    await Api.del(`/admin/users/${id}`);
                    Toast.success('Kullanıcı başarıyla silindi.');
                    ConfirmDialog.close();
                    loadUsers();
                } catch (err) {
                    console.error('Silme hatası:', err);
                    Toast.error('Silme işlemi başarısız: ' + err.message);
                }
            }
        });
    }

    return { init, editUser, deleteUser, copyPassword };
})();

// DİKKAT: Tablo içindeki satıriçi (inline) HTML onclick olaylarının bu dosyaya erişebilmesi için
// modülü global window objesine atamamız GEREKİYOR.
window.AdminUsersPage = AdminUsersPage;

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', AdminUsersPage.init);