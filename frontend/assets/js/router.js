// Hash-based SPA router; guard mekanizması ile korunan sayfalar
const Router = (() => {
    const routes = [];
    let _beforeEach = null;

    function define(path, handler) {
        // path: '/dashboard' veya '/scenarios/:id'
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
        if (replace) history.replaceState(null, '', hash);
        else window.location.hash = hash;
    }

    function current() {
        return window.location.hash.slice(1) || '/';
    }

    async function dispatch() {
        const path = current();

        // Path'i route pattern'larına karşılaştır
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
            // 404 — fallback
            go('/dashboard', true);
            return;
        }

        // Guard kontrolü
        if (_beforeEach) {
            const next = await _beforeEach(path, params);
            // Guard string döndürürse oraya yönlendir
            if (typeof next === 'string' && next !== path) {
                go(next, true);
                return;
            }
            if (next === false) return;
        }

        matched.handler(params);
    }

    // Hash değişikliklerini dinle
    window.addEventListener('hashchange', dispatch);
    window.addEventListener('load', dispatch);

    return { define, beforeEach, go, current, dispatch };
})();