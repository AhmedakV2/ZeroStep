// ── CSP NONCE İNİSYALİZASYONU ─────────────────────────────────
// Server tarafından gönderilen nonce'u meta tag'dan oku ve window'a ekle
// Sonra inline script'ler bu nonce'u kullanabilir
(function() {
    const nonceEl = document.querySelector('meta[id="csp-nonce"]');
    if (nonceEl && nonceEl.content) {
        window._cspNonce = nonceEl.content;
        // Debug: CSP nonce başarıyla yüklendiğini logla
        console.log('[CSP] Nonce initialized:', window._cspNonce.substring(0, 8) + '...');
    } else {
        console.warn('[CSP] Nonce meta tag not found or empty');
    }
})();

// ── TEMA FLASH ÖNLEME (Erken İnisiyalizasyon) ────────────────
// Bu script main.css hemen sonrasında yüklenir ve DOM yüklenmeyi beklemez.
// Amaç: body rendering başlamadan önce tema class'ını ekleyerek FOUC'u önlemek.
(function() {
    // localStorage'dan kaydedilmiş temayı al, varsayılan 'dark'
    const theme = localStorage.getItem('zs_theme') || 'dark';
    
    // Eğer tema 'light' ise class ekle
    if (theme === 'light') {
        // document.documentElement'e ekle (html tag'i, çok erken stage)
        document.documentElement.classList.add('theme-light');
        
        // Body'ye de ekle (eğer ready ise, değilse DOMContentLoaded'de yapacak)
        if (document.body) {
            document.body.classList.add('theme-light');
        } else {
            // Body hazır değilse, hemen ekekelim (bu nadir ama güvenli olsun)
            document.addEventListener('DOMContentLoaded', () => {
                if (!document.body.classList.contains('theme-light')) {
                    document.body.classList.add('theme-light');
                }
            }, { once: true });
        }
    }
})();

