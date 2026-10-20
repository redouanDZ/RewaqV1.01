/**
 * Rewaq Admin Dashboard Centralized Architecture
 * Unifies Security Guards, Shared Utilities, UI Notifications & Modals
 */

const AdminAuth = {
    csrfToken: null,

    getCsrfToken() {
        if (this.csrfToken) return this.csrfToken;
        const cookieMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
        if (cookieMatch) {
            this.csrfToken = decodeURIComponent(cookieMatch[1]);
            return this.csrfToken;
        }
        return '';
    },

    async fetchCsrfToken() {
        try {
            const res = await fetch('/api/csrf-token', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data && data.csrfToken) {
                    this.csrfToken = data.csrfToken;
                    return this.csrfToken;
                }
            }
        } catch (e) {}
        return this.getCsrfToken();
    },

    getHeaders(isJson = true) {
        const headers = {};
        if (isJson) {
            headers['Content-Type'] = 'application/json';
        }
        const token = this.getCsrfToken();
        if (token) {
            headers['X-CSRF-Token'] = token;
        }
        return headers;
    },

    async verifyAdmin() {
        try {
            await this.fetchCsrfToken();
            const res = await fetch('/api/user/profile', {
                credentials: 'include',
                headers: this.getHeaders(false)
            });

            if (!res.ok) {
                throw new Error('Unauthorized');
            }

            const user = await res.json();
            if (!user || user.role !== 'admin') {
                this.clearAuth();
                window.location.href = '../index.html';
                return null;
            }

            const userTag = document.getElementById('adminUserTag');
            if (userTag) {
                userTag.textContent = user.username || 'مدير النظام';
            }

            return user;
        } catch (e) {
            this.clearAuth();
            window.location.href = '../index.html';
            return null;
        }
    },

    _refreshPromise: null,

    async refreshToken() {
        if (!this._refreshPromise) {
            this._refreshPromise = _originalFetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include'
            })
            .then(res => res.ok)
            .catch(() => false)
            .finally(() => {
                setTimeout(() => {
                    this._refreshPromise = null;
                }, 1000);
            });
        }
        return this._refreshPromise;
    },

    clearAuth() {
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
    },

    async logout() {
        const confirmed = await AdminUI.confirm('هل ترغب في تسجيل الخروج من لوحة الإدارة؟', 'تسجيل الخروج');
        if (!confirmed) return;

        try {
            await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include',
                headers: this.getHeaders(true)
            }).catch(() => {});
        } catch (e) {}

        this.clearAuth();
        window.location.href = '../index.html';
    }
};

/**
 * Intercept /api/ calls in admin to silently refresh expired 15-minute access tokens
 * and replay the original request transparently without interrupting the admin.
 */
const _originalFetch = window.fetch.bind(window);
window.fetch = async function(resource, init = {}) {
    const response = await _originalFetch(resource, init);
    const urlStr = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');

    const isApiCall = urlStr.includes('/api/');
    const isAuthEndpoint = urlStr.includes('/api/auth/') || urlStr.includes('/api/login');

    if (response.status === 401 && isApiCall && !isAuthEndpoint && !init._retried) {
        const renewed = await AdminAuth.refreshToken();
        if (renewed) {
            const method = (init.method || 'GET').toUpperCase();
            let freshHeaders = init.headers;
            const freshCsrf = await AdminAuth.fetchCsrfToken();

            if (freshHeaders instanceof Headers) {
                if (freshCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                    freshHeaders.set('X-CSRF-Token', freshCsrf);
                }
            } else if (Array.isArray(freshHeaders)) {
                freshHeaders = freshHeaders.filter(([k]) => k.toLowerCase() !== 'x-csrf-token');
                if (freshCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                    freshHeaders.push(['X-CSRF-Token', freshCsrf]);
                }
            } else if (freshHeaders && typeof freshHeaders === 'object') {
                freshHeaders = { ...freshHeaders };
                if (freshCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                    freshHeaders['X-CSRF-Token'] = freshCsrf;
                }
            } else {
                freshHeaders = {};
                if (freshCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                    freshHeaders['X-CSRF-Token'] = freshCsrf;
                }
            }

            return _originalFetch(resource, {
                ...init,
                headers: freshHeaders,
                credentials: 'include',
                _retried: true
            });
        } else {
            AdminAuth.clearAuth();
            window.location.href = '../index.html';
        }
    }
    return response;
};

const AdminUI = {
    init() {
        this.ensureArabicRtl();
        this.fetchStoreName();
        this.initTheme();
        this.initThemeToggle();
        this.initMobileNav();
        this.initLogoutHandler();
    },

    async fetchStoreName() {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                if (data && data.store_name) {
                    const logos = document.querySelectorAll('.logo a');
                    logos.forEach(logo => {
                        logo.textContent = data.store_name;
                    });
                }
            }
        } catch(e) {}
    },

    initTheme() {
        return window.ThemeManager.applySavedTheme();
    },

    initThemeToggle() {
        const containers = document.querySelectorAll('.user-actions');
        containers.forEach(container => {
            if (container.querySelector('.admin-theme-toggle')) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'admin-theme-toggle';
            button.addEventListener('click', () => {
                const nextTheme = window.ThemeManager.getCurrentTheme() === 'dark' ? 'light' : 'dark';
                window.ThemeManager.setTheme(nextTheme);
                this.updateThemeToggle(button);
            });
            container.insertBefore(button, container.firstChild);
            this.updateThemeToggle(button);
        });
    },

    updateThemeToggle(button) {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        button.innerHTML = `<i class="fas ${dark ? 'fa-sun' : 'fa-moon'}"></i>`;
        button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
        button.setAttribute('aria-label', button.title);
    },

    ensureArabicRtl() {
        document.documentElement.lang = 'ar';
        document.documentElement.dir = 'rtl';
    },

    initMobileNav() {
        const sidebar = document.querySelector('.sidebar');
        const dashboardHeader = document.querySelector('.dashboard-header, .page-header');
        if (!sidebar || !dashboardHeader) return;

        // Add toggle button if not exists
        let toggleBtn = document.getElementById('adminSidebarToggle');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'adminSidebarToggle';
            toggleBtn.className = 'admin-menu-toggle';
            toggleBtn.setAttribute('aria-label', 'تبديل القائمة الجانبية');
            toggleBtn.style.marginInlineEnd = '15px';
            toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
            
            // Wrap the title and button in a div to preserve flex space-between layout
            const titleElement = dashboardHeader.querySelector('h1, h2, h3');
            if (titleElement) {
                const wrapper = document.createElement('div');
                wrapper.className = 'admin-page-heading';
                wrapper.style.display = 'flex';
                wrapper.style.alignItems = 'center';
                dashboardHeader.insertBefore(wrapper, titleElement);
                wrapper.appendChild(toggleBtn);
                wrapper.appendChild(titleElement);
                titleElement.style.margin = '0';
            } else {
                dashboardHeader.insertBefore(toggleBtn, dashboardHeader.firstChild);
            }
        }

        // Overlay
        let overlay = document.getElementById('adminSidebarOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'adminSidebarOverlay';
            overlay.className = 'admin-sidebar-overlay';
            document.body.appendChild(overlay);
        }

        const closeSidebar = () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        };

        toggleBtn.addEventListener('click', () => {
            const isOpen = sidebar.classList.toggle('open');
            overlay.classList.toggle('active', isOpen);
            document.body.classList.toggle('sidebar-open', isOpen);
        });

        overlay.addEventListener('click', closeSidebar);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('open')) {
                closeSidebar();
            }
        });
    },

    initLogoutHandler() {
        // Sidebar logout button
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                AdminAuth.logout();
            });
        }
        
        // Header logout buttons
        const headerLogoutBtns = document.querySelectorAll('.admin-logout-btn');
        headerLogoutBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                AdminAuth.logout();
            });
        });
    },

    showToast(message, type = 'info', duration = 3500) {
        let container = document.getElementById('adminToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'adminToastContainer';
            container.className = 'admin-toast-container';
            document.body.appendChild(container);
        }

        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `admin-toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${iconMap[type] || 'fa-info-circle'}"></i>
            <span>${AdminTable.escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    confirm(message, title = 'تأكيد الإجراء') {
        return new Promise((resolve) => {
            let modal = document.getElementById('adminConfirmModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'adminConfirmModal';
                modal.className = 'admin-modal-backdrop';
                modal.innerHTML = `
                    <div class="admin-confirm-card">
                        <h3 id="adminConfirmTitle"></h3>
                        <p id="adminConfirmMessage"></p>
                        <div class="admin-confirm-actions">
                            <button id="adminConfirmCancel" class="btn-secondary">إلغاء</button>
                            <button id="adminConfirmOk" class="btn-primary">تأكيد</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            const titleEl = document.getElementById('adminConfirmTitle');
            const msgEl = document.getElementById('adminConfirmMessage');
            const okBtn = document.getElementById('adminConfirmOk');
            const cancelBtn = document.getElementById('adminConfirmCancel');

            titleEl.textContent = title;
            msgEl.textContent = message;
            modal.style.display = 'flex';

            const cleanup = (result) => {
                modal.style.display = 'none';
                okBtn.onclick = null;
                cancelBtn.onclick = null;
                resolve(result);
            };

            okBtn.onclick = () => cleanup(true);
            cancelBtn.onclick = () => cleanup(false);
        });
    },

    setButtonLoading(btn, isLoading, loadingText = 'جاري الحفظ...') {
        if (!btn) return;
        if (isLoading) {
            btn.dataset.originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        } else {
            btn.disabled = false;
            if (btn.dataset.originalHtml) {
                btn.innerHTML = btn.dataset.originalHtml;
                delete btn.dataset.originalHtml;
            }
        }
    }
};

const AdminTable = {
    escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    renderPagination({ containerId, current, total, onPageClickName }) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (total <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= total; i++) {
            if (i === current) {
                html += `<button class="page-btn active" class="page-btn active">${i}</button>`;
            } else if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
                html += `<button class="page-btn" data-action="${onPageClickName}" data-args="${i}" class="page-btn">${i}</button>`;
            } else if (i === current - 2 || i === current + 2) {
                html += `<span class="page-dots">...</span>`;
            }
        }
        container.innerHTML = html;
    }
};

// Global Exposure
window.AdminAuth = AdminAuth;
window.AdminUI = AdminUI;
window.AdminTable = AdminTable;

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    AdminUI.init();
});

function handleAdminGenericAction(e, type) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    
    // Forms must ONLY be triggered by the submit event
    if (actionEl.tagName === 'FORM' && type !== 'submit') {
        return;
    }
    
    // Select & file inputs should never trigger their action on click (only on change)
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION' || (e.target.tagName === 'INPUT' && e.target.type === 'file')) {
        if (type === 'click') return;
    }

    // Change events should only trigger if the changed element is the action element itself
    if (type === 'change' && actionEl !== e.target) {
        return;
    }

    // Clicks inside form controls (inputs, textareas) should not trigger a parent element's action
    if (type === 'click') {
        const isControl = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
        if (isControl && actionEl !== e.target) return;
    }
    
    const action = actionEl.dataset.action;
    if (typeof window[action] === 'function') {
        if (type === 'click' || type === 'submit') e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try { 
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s === 'event') return e;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(e){}
        }
        if (type === 'submit') { window[action](e); } else { window[action](...args); }
    }
}
document.addEventListener('click', e => handleAdminGenericAction(e, 'click'));
document.addEventListener('change', e => handleAdminGenericAction(e, 'change'));
document.addEventListener('submit', e => handleAdminGenericAction(e, 'submit'));
