// Uygulama genelinde paylaşılan state; localStorage senkronizasyonu
const Store = (() => {
    const KEYS = {
        ACCESS_TOKEN: 'zs_access_token',
        REFRESH_TOKEN: 'zs_refresh_token',
        USER: 'zs_user',
    };

    // localStorage okuma/yazma yardımcıları
    function get(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }
    function set(key, val) {
        if (val === null || val === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(val));
    }

    return {
        getAccessToken()  { return get(KEYS.ACCESS_TOKEN); },
        getRefreshToken() { return get(KEYS.REFRESH_TOKEN); },
        getUser()         { return get(KEYS.USER); },

        setTokens(access, refresh) {
            set(KEYS.ACCESS_TOKEN, access);
            set(KEYS.REFRESH_TOKEN, refresh);
        },

        setUser(user) { set(KEYS.USER, user); },

        clear() {
            Object.values(KEYS).forEach(k => localStorage.removeItem(k));
        },
    };
})();