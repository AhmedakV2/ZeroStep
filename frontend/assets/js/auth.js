// Auth işlemleri: login, logout, refresh, JWT decode, rol kontrolü
const Auth = (() => {
    // JWT payload'u base64 decode ederek parse eder
    function decodeToken(token) {
        try {
            const payload = token.split('.')[1];
            const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
            return JSON.parse(atob(padded));
        } catch {
            return null;
        }
    }

    async function login(username, password) {
        const data = await Api.postPublic('/auth/login', { username, password });
        Store.setTokens(data.accessToken, data.refreshToken);
        // JWT'den kullanıcı bilgisini çıkar ve store'a yaz
        const payload = decodeToken(data.accessToken);
        const user = {
            publicId: data.userPublicId,
            username: data.username,
            email: data.email,
            displayName: data.displayName,
            roles: data.roles,
            passwordChangeRequired: data.passwordChangeRequired,
        };
        Store.setUser(user);
        return user;
    }

    async function logout() {
        try { await Api.post('/auth/logout', {}); } catch { /* sessiz hata */ }
        Store.clear();
        Router.go('/login');
    }

    // 401 geldiğinde auth modülü dışından da çağrılabilir
    function forceLogout() {
        Store.clear();
        window.location.hash = '#/login';
    }

    async function refreshAccessToken() {
        const refreshToken = Store.getRefreshToken();
        if (!refreshToken) throw new Error('Refresh token yok');

        const data = await Api.postPublic('/auth/refresh', { refreshToken });
        Store.setTokens(data.accessToken, data.refreshToken);
        return data;
    }

    function isLoggedIn() {
        const token = Store.getAccessToken();
        if (!token) return false;
        const payload = decodeToken(token);
        if (!payload) return false;
        // Token süresi bitmişse false; refresh henüz denenmedi
        return payload.exp * 1000 > Date.now();
    }

    function getCurrentUser() {
        return Store.getUser();
    }

    function hasRole(role) {
        const user = getCurrentUser();
        if (!user?.roles) return false;
        // Backend "ADMIN" döndürüyor, Spring "ROLE_ADMIN" da olabilir
        return user.roles.some(r => r === role || r === `ROLE_${role}`);
    }

    function isAdmin() { return hasRole('ADMIN'); }

    return { login, logout, forceLogout, refreshAccessToken, isLoggedIn, getCurrentUser, hasRole, isAdmin };
})();