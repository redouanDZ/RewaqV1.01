/**
 * Rewaq API Client
 * مشغّل طلبات الشبكة الموحد للـ Frontend مع إدارة التوكنات وCSRF والأخطاء
 */
/**
 * استخراج رسالة الخطأ المترجمة بناءً على كود الخطأ أو الرسالة الاحتياطية
 * @param {Object|Error|string} data 
 * @param {string} [fallbackKey] 
 * @returns {string}
 */
function getErrorMessage(data, fallbackKey = 'errors.SERVER_ERROR') {
    if (data && typeof data === 'object') {
        const code = data.code || (data.data && data.data.code);
        if (code && typeof window !== 'undefined' && window.I18n) {
            const errKey = 'errors.' + code;
            const dict = window.I18n.cache ? window.I18n.cache[window.I18n.currentLang] : null;
            if (dict && typeof window.I18n.getValue === 'function') {
                const val = window.I18n.getValue(dict, errKey);
                if (val) return val;
            }
            const tVal = window.I18n.t(errKey, '');
            if (tVal && tVal !== errKey) return tVal;
        }
        if (data.message) return data.message;
        if (data.error) return data.error;
    } else if (typeof data === 'string' && data.trim()) {
        return data;
    }

    if (fallbackKey) {
        if (typeof window !== 'undefined' && window.I18n) {
            const fbVal = window.I18n.t(fallbackKey, '');
            if (fbVal && fbVal !== fallbackKey) return fbVal;
        }
        return fallbackKey;
    }

    return '';
}

if (typeof window !== 'undefined') {
    window.getErrorMessage = getErrorMessage;
}

class ApiClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.csrfToken = null;
    }

    async getCsrfToken() {
        if (this.csrfToken) return this.csrfToken;
        try {
            const response = await fetch(`${this.baseURL}/csrf-token`, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                this.csrfToken = data.csrfToken;
            }
        } catch (e) {
            console.warn('Could not fetch CSRF token:', e);
        }
        return this.csrfToken;
    }

    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const method = (options.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            const token = await this.getCsrfToken();
            if (token) {
                headers['X-CSRF-Token'] = token;
            }
        }

        if (!headers['Authorization'] && !headers['authorization']) {
            try {
                const demoToken = sessionStorage.getItem('rewaq_demo_token') || sessionStorage.getItem('token');
                if (demoToken) {
                    headers['Authorization'] = `Bearer ${demoToken}`;
                }
            } catch (e) {}
        }

        const config = {
            credentials: 'include',
            ...options,
            headers,
            method
        };

        try {
            const response = await fetch(url, config);

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const errorMessage = getErrorMessage(data, 'errors.SERVER_ERROR');
                const err = new Error(errorMessage);
                err.data = data;
                err.status = response.status;
                throw err;
            }

            return data;
        } catch (error) {
            console.error(`API Client Error [${method} ${url}]:`, error.message);
            throw error;
        }
    }

    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: typeof body === 'string' ? body : JSON.stringify(body)
        });
    }

    put(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: typeof body === 'string' ? body : JSON.stringify(body)
        });
    }

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
}

window.ApiClient = ApiClient;
ApiClient.getErrorMessage = getErrorMessage;
window.apiClient = new ApiClient();
