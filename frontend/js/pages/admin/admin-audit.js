const AdminAuditPage = (() => {
    let currentPage = 0;
    const pageSize = 15;

    async function init() {
        if (!Auth.isLoggedIn()) {
            window.location.href = '../../../index.html';
            return;
        }

        if (!Auth.isAdmin()) {
            Toast.error('Bu sayfaya erişim izniniz yok.');
            window.location.href = '../dashboard.html';
            return;
        }

        if (typeof Sidebar !== 'undefined') Sidebar.render('sidebar');
        if (typeof Topbar !== 'undefined') Topbar.render('topbar', 'Denetim Günlükleri');

        await loadAuditLogs();

        // Filtreleme Eventleri
        document.getElementById('apply-filters-btn')?.addEventListener('click', () => {
            currentPage = 0;
            loadAuditLogs();
        });

        // Enter tuşu ile arama
        document.getElementById('audit-search')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                currentPage = 0;
                loadAuditLogs();
            }
        });

        document.getElementById('export-audit-btn')?.addEventListener('click', () => {
            Toast.info('Dışa aktarma (CSV) özelliği üzerinde çalışılıyor.');
        });
    }

    async function loadAuditLogs() {
        const tbody = document.getElementById('audit-body');
        const search = document.getElementById('audit-search')?.value?.trim() || '';
        const action = document.getElementById('audit-action-filter')?.value || '';
        const date = document.getElementById('audit-date-filter')?.value || '';

        try {
            const queryParams = { page: currentPage, size: pageSize };

            // Backend Controller'da @RequestParam olarak beklenen isimlerle eşleştirme
            if (search) queryParams.search = search;
            if (action) queryParams.action = action; // 'eventType' sütunu için
            if (date) queryParams.date = date;

            const response = await Api.get('/admin/audit', queryParams);

            let items = [];
            // Farklı response yapılarını destekleme
            if (response?.content) items = response.content;
            else if (response?.data?.content) items = response.data.content;
            else if (Array.isArray(response)) items = response;

            if (!items || items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8">Kayıt bulunamadı.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map(log => {
                // Status kontrolü (Backend'den 'SUCCESS' veya 'FAILED' döndüğünü varsayıyoruz)
                const isSuccess = log.status === 'SUCCESS' || log.status === true;
                const detailsJsonStr = log.details ? Utils.escHtml(JSON.stringify(log.details)) : '{}';

                return `
                <tr>
                    <td><div style="font-family:var(--font-mono); font-size:0.85em;">${log.timestamp ? Utils.formatDate(log.timestamp) : '—'}</div></td>
                    <td style="font-weight:600">${Utils.escHtml(log.username || 'Sistem')}</td>
                    <td><span class="badge badge-outline">${Utils.escHtml(log.action || '—')}</span></td>
                    <td><small style="color:var(--clr-text-muted)">${Utils.escHtml(log.resourceName || '—')}</small></td>
                    <td><div style="font-family:var(--font-mono); font-size:0.85em;">${Utils.escHtml(log.ipAddress || '—')}</div></td>
                    <td>
                        <span class="status-pill ${isSuccess ? 'status-passed' : 'status-failed'}">
                            ${isSuccess ? 'Başarılı' : 'Hatalı'}
                        </span>
                    </td>
                    <td style="text-align: right;">
                        <button class="btn btn-ghost btn-sm" onclick="AdminAuditPage.showDetails('${detailsJsonStr}')" title="Detaylar">
                            <i class="fas fa-file-code"></i>
                        </button>
                    </td>
                </tr>
            `;
            }).join('');

            renderPagination(response);

        } catch (error) {
            console.error('Audit Yükleme Hatası:', error);
            Toast.error("Loglar yüklenemedi: " + (error.message || 'Bilinmeyen hata'));
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

    function showDetails(encodedJson) {
        let jsonObj = {};
        try {
            // Kaçış karakterlerini geri çevir ve parse et
            const decodedStr = String(encodedJson)
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');
            jsonObj = JSON.parse(decodedStr);
        } catch (e) {
            jsonObj = { error: "JSON formatı çözülemedi.", raw: encodedJson };
        }

        const prettyJson = JSON.stringify(jsonObj, null, 2);

        Modal.open({
            title: 'İşlem Detayları (Payload)',
            contentHTML: `
                <div style="background:#1e1e1e; color:#d4d4d4; padding:1.25rem; border-radius:var(--radius); overflow-x:auto; border: 1px solid var(--clr-border);">
                    <pre style="margin:0; font-family:var(--font-mono); font-size:0.85rem; line-height:1.5;"><code>${Utils.escHtml(prettyJson)}</code></pre>
                </div>
            `,
            confirmLabel: 'Kapat',
            showCancel: false
        });
    }

    return { init, showDetails };
})();

window.AdminAuditPage = AdminAuditPage;
document.addEventListener('DOMContentLoaded', AdminAuditPage.init);