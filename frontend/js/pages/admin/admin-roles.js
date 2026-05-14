const AdminRolesPage = (() => {
    // Gelecekte gerekecek değişkenler için hazırlık
    let currentPage = 0;
    const pageSize = 15;

    async function init() {
        // 1. Güvenlik ve Yetki Kontrolü
        if (typeof Auth !== 'undefined') {
            if (!Auth.isLoggedIn()) {
                window.location.href = '../../../index.html';
                return;
            }

            if (!Auth.isAdmin()) {
                if (typeof Toast !== 'undefined') Toast.error('Bu sayfaya erişim izniniz yok.');
                window.location.href = '../dashboard.html';
                return;
            }
        }

        // 2. Layout Bileşenlerini Başlat (Sidebar ve Topbar)
        if (typeof Sidebar !== 'undefined') {
            Sidebar.render('sidebar');
        }

        if (typeof Topbar !== 'undefined') {
            Topbar.render('topbar', 'Rol Yönetimi');
        }

        // Sayfa içeriği "Üzerinde Çalışılıyor" modunda olduğu için
        // veri yükleme (loadRoles) fonksiyonunu şimdilik çağırmıyoruz.
        console.log("Admin Roles: Layout yüklendi, içerik geliştirme aşamasında.");
    }

    // Gelecekteki fonksiyonlar buraya eklenebilir (loadRoles, showDetails vb.)

    return { init };
})();

// Global erişim için window nesnesine bağla
window.AdminRolesPage = AdminRolesPage;

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', AdminRolesPage.init);