// Merkezi fetch wrapper; token ekleme, 401 refresh, hata yönetimi
const Api = (() => {
    const BASE = 'http://localhost:8080/api/v1';

    // 401 sonrası refresh döngüsünü önlemek için flag
    let _refreshing = false;
    let _refreshQueue = [];

    function _processQueue(error, token) {
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

        let res;
        try {
            res = await fetch(BASE + path, config);
        } catch (networkErr) {
            // Global Network Hatası Yönetimi (Sunucu kapalıysa)
            if (window.Toast) {
                Toast.error('Sunucuya bağlanılamadı. İnternet bağlantınızı veya sunucuyu kontrol edin.');
            }
            throw new ApiError(0, 'NETWORK_ERROR', 'Sunucuya bağlanılamadı. (' + networkErr.message + ')');
        }

        // Global 500 Sunucu Hatası Yönetimi
        if (res.status >= 500) {
            if (window.Toast) {
                Toast.error(`Sunucu tarafında bir hata oluştu (Hata: ${res.status}). Lütfen tekrar deneyin.`);
            }
        }

        // Token expire — refresh dene
        if (res.status === 401 && !skipAuth) {
            const refreshToken = Store.getRefreshToken();
            if (!refreshToken) {
                Auth.forceLogout();
                throw new ApiError(401, 'UNAUTHORIZED', 'Oturum sona erdi');
            }

            if (_refreshing) {
                return new Promise((resolve, reject) => {
                    _refreshQueue.push({
                        resolve: token => {
                            headers['Authorization'] = `Bearer ${token}`;
                            resolve(fetch(BASE + path, { ...config, headers })
                                .then(r => _parseResponse(r)));
                        },
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

        return _parseResponse(res);
    }

    async function _parseResponse(res) {
        if (res.status === 204) return null;

        let json = null;
        try {
            json = await res.json();
        } catch {
            if (!res.ok) {
                throw new ApiError(res.status, 'PARSE_ERROR', `HTTP ${res.status}`);
            }
            return null;
        }

        if (!res.ok) {
            const code    = json?.code    || 'UNKNOWN_ERROR';
            const msg     = json?.message || `HTTP ${res.status}`;
            const fields  = json?.fieldErrors || null;
            throw new ApiError(res.status, code, msg, fields);
        }

        return json?.data !== undefined ? json.data : json;
    }

    return {
        get(path, params) {
            const qs = params && Object.keys(params).length
                ? '?' + new URLSearchParams(
                Object.fromEntries(
                    Object.entries(params).filter(([, v]) => v != null)
                )
            ).toString()
                : '';
            return request('GET', path + qs);
        },
        post:       (path, body)  => request('POST',   path, body),
        put:        (path, body)  => request('PUT',     path, body),
        patch:      (path, body)  => request('PATCH',   path, body),
        del:        (path)        => request('DELETE',  path),
        postPublic: (path, body)  => request('POST', path, body, true),
    };
})();

class ApiError extends Error {
    constructor(status, code, message, fieldErrors = null) {
        super(message);
        this.name        = 'ApiError';
        this.status      = status;
        this.code        = code;
        this.fieldErrors = fieldErrors;
    }
}