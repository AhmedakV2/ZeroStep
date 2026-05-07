// Toast bildirimleri; success / error / info / warning
const Toast = (() => {
    // Container DOM'da yoksa oluştur
    function getContainer() {
        let c = document.getElementById('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            document.body.appendChild(c);
        }
        return c;
    }

    const ICONS = {
        success: '✓',
        error:   '✕',
        info:    'ℹ',
        warning: '⚠',
    };

    function show(message, type = 'info', duration = 3500) {
        const container = getContainer();
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.innerHTML = `
      <span class="toast-icon">${ICONS[type] ?? 'ℹ'}</span>
      <span class="toast-msg">${Utils.escHtml(message)}</span>
    `;
        container.appendChild(el);

        // Otomatik kaldır
        const remove = () => {
            el.classList.add('removing');
            el.addEventListener('animationend', () => el.remove(), { once: true });
        };
        const timer = setTimeout(remove, duration);
        el.addEventListener('click', () => { clearTimeout(timer); remove(); });
    }

    return {
        success: (msg, d) => show(msg, 'success', d),
        error:   (msg, d) => show(msg, 'error',   d ?? 5000), // Hata mesajları biraz daha uzun kalır
        info:    (msg, d) => show(msg, 'info',    d),
        warning: (msg, d) => show(msg, 'warning', d),
    };
})();