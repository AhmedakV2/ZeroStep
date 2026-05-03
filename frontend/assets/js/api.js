// Merkezi fetch wrapper; token ekleme, 401 refresh, hata yönetimi
const Api = (() => {
    const BASE = '/api/v1';

    // 401 sonrası refresh döngüsünü önlemek için flag
    let _refreshing = false;
    let _refreshQueue = [];

    async function _processQueue(error, token) {
        _refreshQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
        _refreshQueue = [];
    }

    async function request(method, path, body = null, skipAuth = false) {
        const headers = { 'Content-Type': 'application/json' };

        if (!skipAuth) {
            const token = Store.getAccessToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
        }

        const config = { method, headers };
        if (body !== null) config.body = JSON.stringify(body);

        let res = await fetch(BASE + path, config);

        // Token expire — refresh dene
        if (res.status === 401 && !skipAuth) {
            const refreshToken = Store.getRefreshToken();
            if (!refreshToken) {
                Auth.forceLogout();
                throw new ApiError(401, 'UNAUTHORIZED', 'Oturum sona erdi');
            }

            if (_refreshing) {
                // Diğer istekler yeni token gelene kadar bekler
                return new Promise((resolve, reject) => {
                    _refreshQueue.push({
                        resolve: token => { headers['Authorization'] = `Bearer ${token}`; resolve(fetch(BASE + path, { ...config, headers })); },
                        reject,
                    });
                });
            }

            _refreshing = true;
            try {
                const data = await Auth.refreshAccessToken();
                _processQueue(null, data.accessToken);
                headers['Authorization'] = `Bearer ${data.accessToken}`;
                res = await fetch(BASE + path, { ...config, headers });
            } catch (err) {
                _processQueue(err, null);
                Auth.forceLogout();
                throw new ApiError(401, 'UNAUTHORIZED', 'Oturum yenilenemedi');
            } finally {
                _refreshing = false;
            }
        }

        // Boş response (204 No Content gibi)
        if (res.status === 204) return null;

        const json = await res.json().catch(() => null);

        if (!res.ok) {
            const code = json?.code || 'UNKNOWN_ERROR';
            const msg  = json?.message || `HTTP ${res.status}`;
            throw new ApiError(res.status, code, msg, json?.fieldErrors);
        }

        return json?.data !== undefined ? json.data : json;
    }

    return {
        get:    (path, params)  => {
            const qs = params ? '?' + new URLSearchParams(params).toString() : '';
            return request('GET', path + qs);
        },
        post:   (path, body)    => request('POST',   path, body),
        put:    (path, body)    => request('PUT',    path, body),
        patch:  (path, body)    => request('PATCH',  path, body),
        del:    (path)          => request('DELETE', path),
        // skipAuth=true — login/refresh endpoint'leri için
        postPublic: (path, body) => request('POST', path, body, true),
    };
})();

// Özel hata sınıfı; status + code + fieldErrors taşır
class ApiError extends Error {
    constructor(status, code, message, fieldErrors = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors;
    }
}