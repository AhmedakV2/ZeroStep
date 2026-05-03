// Genel yardımcı fonksiyonlar
const Utils = {
    // XSS koruması için HTML escape
    escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Timestamp'ı okunabilir formata çevir
    formatDate(iso) {
        if (!iso) return '-';
        return new Intl.DateTimeFormat('tr-TR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        }).format(new Date(iso));
    },

    // ms cinsinden süreyi okunabilir yap
    formatDuration(ms) {
        if (ms == null) return '-';
        if (ms < 1000) return `${ms}ms`;
        const s = (ms / 1000).toFixed(1);
        return `${s}s`;
    },

    // Sayfalama için sayfa listesi üret
    pageRange(current, total) {
        const range = [];
        const delta = 2;
        for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
            range.push(i);
        }
        return range;
    },

    // Boş string kontrolü
    isBlank(str) { return !str || !str.trim(); },

    // Form'dan data object üret
    formData(formEl) {
        const data = {};
        new FormData(formEl).forEach((v, k) => { data[k] = v; });
        return data;
    },

    // Debounce — arama input'ları için
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    // Deep clone
    clone(obj) { return JSON.parse(JSON.stringify(obj)); },

    // Query param parse
    parseParams(search) {
        return Object.fromEntries(new URLSearchParams(search));
    },
};