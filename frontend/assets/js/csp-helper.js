// ── CSP Nonce Helper ─────────────────────────────────────────
// Inline style'lar için nonce attribute'u ekler
// (Script tags zaten external'a taşınmıştır)

(function() {
    const nonce = window._cspNonce;
    if (!nonce) {
        console.warn('[CSP Helper] Nonce not available');
        return;
    }

    // Tüm inline style'lara nonce ekle
    const styles = document.querySelectorAll('style:not([nonce])');
    styles.forEach(style => {
        style.setAttribute('nonce', nonce);
    });

    // Eğer JavaScript tarafından style ekleniyorsa, bu işlevi expose et
    window.addStyledElement = function(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        const styles = div.querySelectorAll('style');
        styles.forEach(style => {
            style.setAttribute('nonce', nonce);
            document.head.appendChild(style);
        });
    };
})();

