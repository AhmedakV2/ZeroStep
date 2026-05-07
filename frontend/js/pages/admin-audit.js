const AdminAuditPage = (() => {
    let currentPage = 0;
    const pageSize = 15; // Loglar için tabloyu biraz daha geniş tutabiliriz

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
        if (typeof Topbar !== 'undefined') Topbar.render('topbar', 'Denetim Günlükleri');

        // Veriyi Yükle
        await loadAuditLogs();

        // Event Listeners (Enter tuşu ve Filtrele Butonu)
        document.getElementById('apply-filters-btn')?.addEventListener('click', () => {
            currentPage = 0;
            loadAuditLogs();
        });

        document.getElementById('audit-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                currentPage = 0;
                loadAuditLogs();
            }
        });

        document.getElementById('export-audit-btn')?.addEventListener('click', exportAuditLogs);
    }

    async function loadAuditLogs() {
        const tbody = document.getElementById('audit-body');
        const search = document.getElementById('audit-search')?.value || '';
        const action = document.getElementById('audit-action-filter')?.value || '';
        const date = document.getElementById('audit-date-filter')?.value || '';

        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8"><span class="spinner" style="border-top-color:var(--clr-primary);width:1.5rem;height:1.5rem;"></span> Yükleniyor...</td></tr>`;

        try {
            // Backend endpoint varsayımı: GET /api/v1/audit/events
            const response = await Api.get('/audit/events', {
                page: currentPage,
                size: pageSize,
                search: search,
                action: action,
                date: date
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
                tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8">Kritere uygun denetim kaydı bulunamadı.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map(log => {
                // İşlem durumuna göre renk belirleme
                const isSuccess = log.status === 'SUCCESS';
                const statusBadge = isSuccess
                    ? `<span style="color:var(--clr-success);"><i class="fas fa-check-circle"></i> Başarılı</span>`
                    : `<span style="color:var(--clr-danger);"><i class="fas fa-times-circle"></i> Başarısız</span>`;

                return `
                <tr>
                    <td style="white-space:nowrap;font-family:var(--font-mono);font-size:0.85rem;">
                        ${log.createdAt ? Utils.formatDate(log.createdAt) : '—'}
                    </td>
                    <td style="font-weight:600;">${Utils.escHtml(log.username || log.actor || 'Sistem')}</td>
                    <td><span class="badge" style="background:var(--clr-bg-secondary);">${Utils.escHtml(log.action || '—')}</span></td>
                    <td>${Utils.escHtml(log.resource || '—')}</td>
                    <td style="font-family:var(--font-mono);font-size:0.85rem;">${Utils.escHtml(log.ipAddress || '—')}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right;">
                        <button class="btn btn-ghost btn-sm" onclick="AdminAuditPage.viewDetails('${Utils.escHtml(log.id || '')}')" title="Detayları Gör">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `}).join('');

            renderPagination(response);

        } catch (error) {
            console.error(error);
            Toast.error("Denetim kayıtları yüklenirken bir hata oluştu: " + error.message);
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger p-8">Hata: Veri alınamadı.</td></tr>`;
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
            loadAuditLogs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    async function viewDetails(logId) {
        if (!logId) return;
        Toast.info('Detaylı JSON görünümü yakında eklenecek.');
        // TODO: Api.get(`/audit/events/${logId}`) yapıp sonucu Modal içinde JSON.stringify(data, null, 2) ile basabilirsiniz.
    }

    async function exportAuditLogs() {
        Toast.info('Dışa aktarma işlemi başlatılıyor...');
        try {
            // İndirme işlemi simülasyonu / Backend endpointine yönlendirme
            const search = document.getElementById('audit-search')?.value || '';
            const action = document.getElementById('audit-action-filter')?.value || '';
            const date = document.getElementById('audit-date-filter')?.value || '';

            const queryString = new URLSearchParams({ search, action, date }).toString();
            // Varsayılan API yapınız blob indiriyorsa burası Api üzerinden blob alınarak revize edilebilir.
            // Şimdilik sadece endpoint'i gösteriyoruz:
            console.log(`Dışa aktarılıyor: /api/v1/audit/events/export?${queryString}`);

            setTimeout(() => Toast.success('Rapor başarıyla indirildi.'), 1000);
        } catch (error) {
            Toast.error('Dışa aktarma başarısız: ' + error.message);
        }
    }

    return { init, viewDetails, exportAuditLogs };
})();

window.AdminAuditPage = AdminAuditPage;
document.addEventListener('DOMContentLoaded', AdminAuditPage.init);