// Genel yardımcı fonksiyonlar
const Utils = {
    escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    formatDate(iso) {
        if (!iso) return '-';
        return new Intl.DateTimeFormat('tr-TR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        }).format(new Date(iso));
    },

    formatDuration(ms) {
        if (ms == null) return '-';
        if (ms < 1000) return `${ms}ms`;
        const s = (ms / 1000).toFixed(1);
        return `${s}s`;
    },

    pageRange(current, total) {
        const range = [];
        const delta = 2;
        for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
            range.push(i);
        }
        return range;
    },

    isBlank(str) { return !str || !str.trim(); },

    formData(formEl) {
        const data = {};
        new FormData(formEl).forEach((v, k) => { data[k] = v; });
        return data;
    },

    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    clone(obj) { return JSON.parse(JSON.stringify(obj)); },

    parseParams(search) {
        return Object.fromEntries(new URLSearchParams(search));
    },
};

// ── TEMA YÖNETİMİ (Global) ──────────────────────────────────
const ThemeManager = {
    STORAGE_KEY: 'zs_theme',

    get() {
        // Eğer localStorage'da kayıt yoksa varsayılan olarak 'dark' döner.
        return localStorage.getItem(this.STORAGE_KEY) || 'dark';
    },

    set(theme) {
        localStorage.setItem(this.STORAGE_KEY, theme);
        this.apply(theme);
    },

    apply(theme) {
        const t = theme || this.get();
        // Eğer tema 'light' ise body ve html etiketlerine 'theme-light' class'ı ekler.
        const isLight = t === 'light';
        document.body.classList.toggle('theme-light', isLight);
        document.documentElement.classList.toggle('theme-light', isLight);
    }
};

// Diğer scriptlerden erişebilmek için window nesnesine atıyoruz
window.ThemeManager = ThemeManager;

// ── TEMA OTOMATIK TETİKLEME ─────────────────────────────────
// Sayfa DOM ağacı oluşturulduğu an bu kod çalışır.
document.addEventListener('DOMContentLoaded', () => {
    if (window.ThemeManager) {
        ThemeManager.apply();
    }
});