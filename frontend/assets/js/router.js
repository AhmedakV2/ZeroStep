// Hash-based SPA router; guard mekanizması ile korunan sayfalar
const Router = (() => {
    const routes = [];
    let _beforeEach = null;
    let _initialized = false; // YENİ: Race condition engellemek için bayrak

    // SSE bağlantılarını globalde takip etmek ve sayfa değişiminde kapatmak için referans
    window.currentSSE = null;

    function define(path, handler) {
        const pattern = new RegExp(
            '^' + path.replace(/:([^/]+)/g, '(?<$1>[^/]+)') + '$'
        );
        routes.push({ path, pattern, handler });
    }

    function beforeEach(guard) {
        _beforeEach = guard;
    }

    function go(path, replace = false) {
        const hash = '#' + path;
        if (replace) {
            history.replaceState(null, '', hash);
            dispatch();
        } else {
            window.location.hash = hash;
        }
    }

    function current() {
        return window.location.hash.slice(1) || '/';
    }

    async function dispatch() {
        // YENİ: Eğer sistem henüz başlatılmadıysa (HTML'in en altındaki init çağrılmadıysa) çalışmayı durdur!
        if (!_initialized) return;

        // Yeni sayfaya geçerken açık SSE bağlantısı varsa temizle
        if (window.currentSSE) {
            window.currentSSE.close();
            window.currentSSE = null;
        }

        const path = current();

        // Kök dizin kontrolü
        if (path === '/' || path === '') {
            go('/dashboard', true);
            return;
        }

        let matched = null;
        let params = {};
        for (const route of routes) {
            const m = path.match(route.pattern);
            if (m) {
                matched = route;
                params = m.groups ?? {};
                break;
            }
        }

        if (!matched) {
            if (path !== '/404') go('/404', true);
            return;
        }

        // Guard kontrolü
        if (_beforeEach) {
            const next = await _beforeEach(path, params);
            if (typeof next === 'string' && next !== path) {
                go(next, true);
                return;
            }
            if (next === false) return;
        }

        matched.handler(params);
    }

    // YENİ: Sistemi manuel olarak başlatan fonksiyon
    function init() {
        _initialized = true;
        dispatch();
    }

    // Hash değişikliklerini dinle (Artık window load dinlemiyoruz, init() bekliyoruz)
    window.addEventListener('hashchange', dispatch);

    // Dışarıya init fonksiyonunu da açıyoruz
    return { define, beforeEach, go, current, init };
})();

// Kapsam (Scope) hatasını çözmek için Router'ı global window objesine atıyoruz
window.Router = Router;

// -- VARSAYILAN 404 SAYFASI --
Router.define('/404', () => {
    const appContent = document.getElementById('app-content') || document.querySelector('.main-content');
    if (appContent) {
        appContent.innerHTML = `
            <div class="empty-state" style="border: none; margin-top: 10vh;">
                <i class="fas fa-ghost" style="font-size: 4rem; color: var(--clr-primary); opacity: 0.8; margin-bottom: 1.5rem;"></i>
                <h2 style="color: var(--clr-text); font-size: 1.5rem; margin-bottom: 0.5rem;">404 - Sayfa Bulunamadı</h2>
                <p style="color: var(--clr-text-muted); margin-bottom: 1.5rem; font-size: 1.05rem;">Aradığınız sayfa silinmiş, taşınmış veya hiç var olmamış olabilir.</p>
                <button onclick="Router.go('/dashboard')" class="btn btn-primary">
                    <i class="fas fa-arrow-left"></i> Dashboard'a Dön
                </button>
            </div>
        `;
    }
});