// Pagination bileşeni; Spring Page<T> response'unu alır, butonları render eder
const Pagination = (() => {

    /**
     * @param {HTMLElement|string} container - DOM element veya ID
     * @param {Object} pageData - Spring Page response { number, totalPages, totalElements, size }
     * @param {Function} onPageChange - (pageNumber: number) => void
     */
    function render(container, pageData, onPageChange) {
        const el = typeof container === 'string'
            ? document.getElementById(container)
            : container;
        if (!el) return;

        const { number: current, totalPages, totalElements, size } = pageData;

        if (totalPages <= 1) {
            el.innerHTML = '';
            return;
        }

        const pages = Utils.pageRange(current, totalPages - 1);

        const btn = (label, page, extra = '') => `
            <button class="page-btn ${extra}" data-page="${page}"
                ${page < 0 || page >= totalPages ? 'disabled' : ''}>
                ${label}
            </button>`;

        let html = `<div class="pagination-info text-muted">${totalElements} kayıt</div>`;
        html += `<div class="pagination">`;
        html += btn('‹', current - 1, current === 0 ? 'disabled' : '');

        // İlk sayfa + ...
        if (pages[0] > 0) {
            html += btn('1', 0);
            if (pages[0] > 1) html += `<span class="page-ellipsis">…</span>`;
        }

        pages.forEach(p => {
            html += btn(p + 1, p, p === current ? 'active' : '');
        });

        // ... + son sayfa
        if (pages[pages.length - 1] < totalPages - 1) {
            if (pages[pages.length - 1] < totalPages - 2) html += `<span class="page-ellipsis">…</span>`;
            html += btn(totalPages, totalPages - 1);
        }

        html += btn('›', current + 1, current === totalPages - 1 ? 'disabled' : '');
        html += `</div>`;

        el.innerHTML = html;

        // Event delegation
        el.querySelectorAll('.page-btn:not(:disabled)').forEach(b => {
            b.addEventListener('click', () => {
                const page = parseInt(b.dataset.page);
                if (!isNaN(page) && page !== current) {
                    onPageChange(page);
                }
            });
        });
    }

    return { render };
})();