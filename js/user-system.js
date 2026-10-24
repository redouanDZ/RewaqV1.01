
/**
 * User Account Management System
 * Provides functions for login, logout, and user profile management
 */

// API endpoint URLs
const API_BASE_URL = '/api';

// Notification helper
function showNotification(msg, type = 'success') {
    if (window.showToast) {
        window.showToast(msg, type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success');
    } else {
        alert(msg);
    }
}

// Helper to safely update cart UI if available
function updateCartUI() {
    if (window.loadCart) window.loadCart();
}

function readSessionUser() {
    try {
        const raw = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

// persist === true  -> "remember me": keep the user in localStorage (survives browser restarts)
// persist === false -> this tab/browser session only
// persist undefined -> keep the current mode (already remembered stays remembered)
function saveSessionUser(user, persist) {
    if (!user) {
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('rememberedUser');
        return;
    }
    const json = JSON.stringify(user);
    sessionStorage.setItem('currentUser', json);
    const keep = persist === undefined ? !!localStorage.getItem('rememberedUser') : persist;
    if (keep) {
        localStorage.setItem('currentUser', json);
        localStorage.setItem('rememberedUser', '1');
    } else {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('rememberedUser');
    }
}

function clearSessionAuthState() {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('rememberedUser');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('rewaq_demo_token');
    localStorage.removeItem('token');
    document.querySelectorAll('.user-icon').forEach(icon => {
        icon.innerHTML = '<i class="fas fa-user"></i>';
    });
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
}

async function getCsrfToken() {
    const cookieToken = getCookie('csrf_token');
    if (cookieToken) return cookieToken;

    try {
        const response = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) return '';
        const data = await response.json();
        return data.csrfToken || '';
    } catch (error) {
        return '';
    }
}

async function fetchJson(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const isMutatingRequest = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const csrfToken = isMutatingRequest ? await getCsrfToken() : '';

    const headers = {
        ...(options.headers || {})
    };

    if (!(headers['Content-Type'] || headers['content-type'])) {
        if (options.body && typeof options.body === 'string') {
            headers['Content-Type'] = 'application/json';
        }
    }

    if (csrfToken && !headers['X-CSRF-Token'] && !headers['x-csrf-token']) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    if (!headers['Authorization'] && !headers['authorization']) {
        try {
            const demoToken = sessionStorage.getItem('rewaq_demo_token') || sessionStorage.getItem('token');
            if (demoToken) {
                headers['Authorization'] = `Bearer ${demoToken}`;
            }
        } catch (e) {}
    }

    const doFetch = () => fetch(url, {
        credentials: 'include',
        ...options,
        headers
    });

    const response = await doFetch();
    // The access token lives 15 minutes: silently renew it with the refresh cookie and retry once.
    const isAuthCall = /\/(login|register|auth\/refresh|auth\/google|auth\/forgot-password|auth\/reset-password)(\?|$)/.test(String(url));
    if (response.status === 401 && !isAuthCall && !options._retried) {
        const renewed = await refreshAccessToken();
        if (renewed) {
            const retryHeaders = { ...headers };
            const freshCsrf = isMutatingRequest ? await getCsrfToken() : '';
            if (freshCsrf) retryHeaders['X-CSRF-Token'] = freshCsrf;
            return fetch(url, { credentials: 'include', ...options, headers: retryHeaders, _retried: true });
        }
    }
    return response;
}

let _refreshPromise = null;
function refreshAccessToken() {
    if (!_refreshPromise) {
        _refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
            .then(r => r.ok)
            .catch(() => false)
            .finally(() => { setTimeout(() => { _refreshPromise = null; }, 1000); });
    }
    return _refreshPromise;
}

/**
 * تحديث واجهة المستخدم بعد تسجيل الدخول
 * يُظهر قائمة منسدلة في أيقونة المستخدم مع رابط لوحة التحكم للأدمن
 */
function updateUIForLoggedInUser(user) {
    if (!user) return;
    const isAdmin = user.role === 'admin';
    const displayName = (user.username || user.name || user.email || '').split(' ')[0];
    const avatarLetter = displayName ? displayName[0].toUpperCase() : '?';

    document.querySelectorAll('.user-icon').forEach(icon => {
        // Create a div to replace the anchor tag and prevent invalid nested <a> tags
        const newIcon = document.createElement('div');
        newIcon.className = icon.className;
        newIcon.style.cursor = 'default';
        
        icon.parentNode.replaceChild(newIcon, icon);
        icon = newIcon;

        const adminBadge = window.I18n ? window.I18n.t('nav.admin_badge', '⚙️ مدير النظام') : '⚙️ مدير النظام';
        const customerBadge = window.I18n ? window.I18n.t('nav.customer_badge', 'عميل') : 'عميل';
        const adminDashboard = window.I18n ? window.I18n.t('nav.admin_panel', 'لوحة التحكم') : 'لوحة التحكم';
        const myProfile = window.I18n ? window.I18n.t('nav.my_profile', 'حسابي الشخصي') : 'حسابي الشخصي';
        const logoutText = window.I18n ? window.I18n.t('nav.logout', 'تسجيل الخروج') : 'تسجيل الخروج';

        const safeDisplayName = window.escapeHtml ? window.escapeHtml(displayName) : displayName;
        const safeAvatarLetter = window.escapeHtml ? window.escapeHtml(avatarLetter) : avatarLetter;

        icon.innerHTML = `
            <div class="user-menu-wrap" style="position:relative;display:inline-block;">
                <button class="user-avatar-btn" title="${safeDisplayName}" style="background:var(--primary-color,#6366f1);color:var(--bg-color, #fff);border:none;border-radius:50%;width:34px;height:34px;font-size:0.92rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    ${safeAvatarLetter}
                </button>
                <div class="user-dropdown" style="display:none;position:absolute;top:42px;inset-inline-end:0;background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:190px;z-index:9999;padding:8px 0;">
                    <div style="padding:10px 16px 8px;border-bottom:1px solid var(--border-color,#e2e8f0);">
                        <strong style="display:block;font-size:0.95rem;color:var(--text-color,#1e293b);">${safeDisplayName}</strong>
                        ${isAdmin ? `<span style="color:var(--primary-color,#6366f1);font-size:0.75rem;font-weight:700;" data-i18n="nav.admin_badge">${adminBadge}</span>` : `<span style="color:var(--light-text,#64748b);font-size:0.78rem;" data-i18n="nav.customer_badge">${customerBadge}</span>`}
                    </div>
                    ${isAdmin ? `<a href="admin/index.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--primary-color,#6366f1);font-weight:700;text-decoration:none;font-size:0.9rem;"><i class="fas fa-tachometer-alt"></i> <span data-i18n="nav.admin_panel">${adminDashboard}</span></a>` : ''}
                    <a href="account.html" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text-color,#1e293b);text-decoration:none;font-size:0.9rem;"><i class="fas fa-user-circle"></i> <span data-i18n="nav.my_profile">${myProfile}</span></a>
                    <div style="border-top:1px solid var(--border-color,#e2e8f0);margin:4px 0;"></div>
                    <button type="button" class="logout-btn-action" data-action="logoutUser" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--danger-color);background:none;border:none;cursor:pointer;width:100%;font-size:0.9rem;text-align:start;"><i class="fas fa-sign-out-alt"></i> <span data-i18n="nav.logout">${logoutText}</span></button>
                </div>
            </div>`;

        const wrap = icon.querySelector('.user-menu-wrap');
        const btn = icon.querySelector('.user-avatar-btn');
        const dropdown = icon.querySelector('.user-dropdown');
        const logoutBtn = icon.querySelector('[data-action="logoutUser"]');

        // إزالة رابط href حتى لا تنتقل الصفحة عند النقر
        icon.removeAttribute('href');
        icon.addEventListener('click', (e) => e.preventDefault());

        if (wrap && btn && dropdown) {
            // منع انتشار الحدث من الحاوية بالكامل لمنع إغلاق القائمة فوراً
            wrap.addEventListener('click', (e) => e.stopPropagation());

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isOpen = dropdown.style.display === 'block';
                // إغلاق جميع القوائم الأخرى
                document.querySelectorAll('.user-dropdown').forEach(d => { d.style.display = 'none'; });
                dropdown.style.display = isOpen ? 'none' : 'block';
            });

            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (typeof window.logoutUser === 'function') {
                        window.logoutUser();
                    }
                });
            }
        }
    });

    // مستمع واحد فقط على document لإغلاق القائمة عند النقر خارجها
    if (!window._userDropdownCloseHandler) {
        window._userDropdownCloseHandler = () => {
            document.querySelectorAll('.user-dropdown').forEach(d => { d.style.display = 'none'; });
        };
        document.addEventListener('click', window._userDropdownCloseHandler);
    }
}
window.updateUIForLoggedInUser = updateUIForLoggedInUser;

/**
 * تفعيل أيقونة إظهار/إخفاء كلمة المرور لكل حقول .toggle-password-btn داخل container
 */
function initPasswordToggles(container) {
    (container || document).querySelectorAll('.toggle-password-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const input = (container || document).querySelector('#' + targetId);
            if (!input) return;
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            const icon = this.querySelector('i');
            if (icon) {
                icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
            }
        });
    });
}

/**
 * تهيئة نموذج تسجيل الدخول
 */
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }
}

/**
 * تهيئة نموذج إنشاء حساب
 */
function initSignupForm() {
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSignup();
        });
    }
}

/**
 * إظهار نافذة التوثيق المنبثقة
 */
function openAuthModalElement(modal) {
    if (!modal) modal = document.getElementById('auth-modal');
    if (!modal) return;
    if (window.I18n && typeof window.I18n.translatePage === 'function' && window.I18n.currentLang !== 'ar') {
        window.I18n.translatePage(modal);
    }
    modal.classList.add('active');
    modal.style.display = 'flex';
}

/**
 * إغلاق نافذة التوثيق المنبثقة
 */
function closeAuthModalElement(modal) {
    if (!modal) modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
}

if (typeof document !== 'undefined' && !window._authModalEscBound) {
    window._authModalEscBound = true;
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAuthModalElement();
        }
    });
}

/**
 * عرض نموذج تسجيل الدخول
 */
function showLoginForm() {
    let modal = document.getElementById('auth-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 data-i18n="auth.login_title">تسجيل الدخول</h2>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="login-form">
                    <div class="form-group">
                        <label for="login-email" data-i18n="auth.email">البريد الإلكتروني</label>
                        <input type="email" id="login-email" required placeholder="name@example.com">
                    </div>
                    <div class="form-group">
                        <label for="login-password" data-i18n="auth.password">كلمة المرور</label>
                        <div class="password-input-wrap" style="position:relative;display:flex;align-items:center;">
                            <input type="password" id="login-password" required placeholder="******" style="flex:1;padding-inline-end:42px;">
                            <button type="button" class="toggle-password-btn" data-target="login-password" data-i18n-title="auth.toggle_password" title="إظهار/إخفاء كلمة المرور" style="position:absolute;inset-inline-end:10px;background:none;border:none;cursor:pointer;color:var(--light-text,#94a3b8);font-size:1rem;padding:4px;"><i class="fas fa-eye"></i></button>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 14px;">
                        <label for="remember-me" style="display: inline-flex; align-items: center; gap: 9px; font-size: 0.9rem; font-weight: 500; color: var(--text-color); cursor: pointer; user-select: none; padding: 4px 0;">
                            <input type="checkbox" id="remember-me" class="custom-checkbox-input">
                            <span data-i18n="auth.remember_me">تذكرني</span>
                        </label>
                    </div>
                    <button type="submit" class="btn" style="width: 100%;"><span data-i18n="auth.login_btn">تسجيل الدخول</span></button>

                    <div style="display: flex; align-items: center; margin: 14px 0; text-align: center; color: var(--light-text, #94a3b8); font-size: 0.85rem;">
                        <div style="flex: 1; height: 1px; background: var(--border-color, #e2e8f0);"></div>
                        <span style="padding: 0 12px; font-weight: 600;" data-i18n="auth.or">أو</span>
                        <div style="flex: 1; height: 1px; background: var(--border-color, #e2e8f0);"></div>
                    </div>

                    <button type="button" class="google-btn" data-action="initiateGoogleLogin" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--card-bg, #fff); color: var(--text-color); font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                        <span data-i18n="auth.continue_google">متابعة باستخدام Google</span>
                    </button>

                    <div class="auth-links" style="margin-top: 14px;">
                        <a href="#" id="show-signup" data-i18n="auth.create_account">إنشاء حساب جديد</a>
                        <a href="#" id="show-forgot-password" data-i18n="auth.forgot_password">نسيت كلمة المرور؟</a>
                    </div>

                </form>
            </div>
        </div>
    `;

    // إظهار النافذة في الوسط بمرونة
    openAuthModalElement(modal);

    modal.onclick = function(e) {
        if (e.target === modal) {
            closeAuthModalElement(modal);
        }
    };


    // إضافة مستمعي الأحداث
    const closeModalBtn = modal.querySelector('.close-modal');
    const showSignupLink = modal.querySelector('#show-signup');
    const showForgotLink = modal.querySelector('#show-forgot-password');
    const loginForm = modal.querySelector('#login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }

    initPasswordToggles(modal);

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            closeAuthModalElement(modal);
        });
    }

    if (showSignupLink) {
        showSignupLink.addEventListener('click', function(e) {
            e.preventDefault();
            showSignupForm();
        });
    }

    if (showForgotLink) {
        showForgotLink.addEventListener('click', function(e) {
            e.preventDefault();
            showForgotPasswordForm();
        });
    }
}

/**
 * عرض نموذج إنشاء حساب
 */
function showSignupForm() {
    let modal = document.getElementById('auth-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 data-i18n="auth.register_title">إنشاء حساب جديد</h2>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="signup-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="signup-name" data-i18n="auth.username">الاسم الكامل</label>
                            <input type="text" id="signup-name" required data-i18n-placeholder="auth.username" placeholder="الاسم الكامل">
                        </div>
                        <div class="form-group">
                            <label for="signup-phone" data-i18n="auth.phone">رقم الهاتف</label>
                            <input type="tel" id="signup-phone" required placeholder="05/06/07...">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="signup-email" data-i18n="auth.email">البريد الإلكتروني</label>
                        <input type="email" id="signup-email" required placeholder="name@example.com">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="signup-password" data-i18n="auth.password">كلمة المرور</label>
                            <div class="password-input-wrap" style="position:relative;display:flex;align-items:center;">
                                <input type="password" id="signup-password" required minlength="6" placeholder="******" style="flex:1;padding-inline-end:42px;">
                                <button type="button" class="toggle-password-btn" data-target="signup-password" data-i18n-title="auth.toggle_password" title="إظهار/إخفاء" style="position:absolute;inset-inline-end:10px;background:none;border:none;cursor:pointer;color:var(--light-text,#94a3b8);font-size:1rem;padding:4px;"><i class="fas fa-eye"></i></button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="signup-confirm-password" data-i18n="auth.confirm_new_password">تأكيد كلمة المرور</label>
                            <div class="password-input-wrap" style="position:relative;display:flex;align-items:center;">
                                <input type="password" id="signup-confirm-password" required minlength="6" placeholder="******" style="flex:1;padding-inline-end:42px;">
                                <button type="button" class="toggle-password-btn" data-target="signup-confirm-password" data-i18n-title="auth.toggle_password" title="إظهار/إخفاء" style="position:absolute;inset-inline-end:10px;background:none;border:none;cursor:pointer;color:var(--light-text,#94a3b8);font-size:1rem;padding:4px;"><i class="fas fa-eye"></i></button>
                            </div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 14px;">
                        <label for="agree-terms" style="display: inline-flex; align-items: center; gap: 9px; font-size: 0.85rem; font-weight: normal; color: var(--text-color); cursor: pointer; user-select: none; padding: 4px 0;">
                            <input type="checkbox" id="agree-terms" required class="custom-checkbox-input">
                            <span><span data-i18n="auth.agree_prefix">أوافق على</span> <a href="terms.html" target="_blank" rel="noopener" style="color: var(--primary-color); text-decoration: underline;"><span data-i18n="auth.terms_and_conditions">الشروط والأحكام</span></a> <span data-i18n="auth.and">و</span> <a href="privacy.html" target="_blank" rel="noopener" style="color: var(--primary-color); text-decoration: underline;"><span data-i18n="auth.privacy_policy">سياسة الخصوصية</span></a></span>
                        </label>
                    </div>
                    <button type="submit" class="btn" style="width: 100%;"><span data-i18n="auth.register_btn">إنشاء الحساب</span></button>

                    <div style="display: flex; align-items: center; margin: 14px 0; text-align: center; color: var(--light-text, #94a3b8); font-size: 0.85rem;">
                        <div style="flex: 1; height: 1px; background: var(--border-color, #e2e8f0);"></div>
                        <span style="padding: 0 12px; font-weight: 600;" data-i18n="auth.or">أو</span>
                        <div style="flex: 1; height: 1px; background: var(--border-color, #e2e8f0);"></div>
                    </div>

                    <button type="button" class="google-btn" data-action="initiateGoogleLogin" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--card-bg, #fff); color: var(--text-color); font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                        <span data-i18n="auth.signup_google">التسجيل باستخدام Google</span>
                    </button>

                    <div class="auth-links" style="margin-top: 14px; justify-content: center;">
                        <a href="#" id="show-login" data-i18n="auth.have_account">لديك حساب بالفعل؟ سجل الدخول</a>
                    </div>
                </form>
            </div>
        </div>
    `;

    openAuthModalElement(modal);

    modal.onclick = function(e) {
        if (e.target === modal) {
            closeAuthModalElement(modal);
        }
    };


    const closeModalBtn = modal.querySelector('.close-modal');
    const showLoginLink = modal.querySelector('#show-login');
    const signupForm = modal.querySelector('#signup-form');

    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSignup();
        });
    }

    initPasswordToggles(modal);

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            closeAuthModalElement(modal);
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            showLoginForm();
        });
    }
}
/**
 * عرض نموذج استعادة كلمة المرور
 */
function showForgotPasswordForm() {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 data-i18n="auth.forgot_password_title">استعادة كلمة المرور</h2>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color: var(--light-text, #64748b); font-size: 0.9rem; margin-bottom: 18px; line-height: 1.5;" data-i18n="auth.forgot_password_desc">أدخل بريدك الإلكتروني المسجل وسنرسل لك تعليمات استعادة كلمة المرور.</p>
                <form id="forgot-password-form">
                    <div class="form-group">
                        <label for="forgot-email" data-i18n="auth.email">البريد الإلكتروني</label>
                        <input type="email" id="forgot-email" required placeholder="name@example.com">
                    </div>
                    <button type="submit" id="forgot-submit-btn" class="btn" style="width: 100%; margin-top: 10px;">
                        <span data-i18n="auth.send_reset_btn">إرسال رابط الاستعادة</span>
                    </button>
                    <div class="auth-links" style="margin-top: 18px; text-align: center;">
                        <a href="#" id="forgot-back-to-login" data-i18n="auth.back_to_login">العودة لتسجيل الدخول</a>
                    </div>
                </form>
            </div>
        </div>
    `;

    openAuthModalElement(modal);

    modal.onclick = function(e) {
        if (e.target === modal) {
            closeAuthModalElement(modal);
        }
    };


    const closeModalBtn = modal.querySelector('.close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => closeAuthModalElement(modal));

    const backToLogin = modal.querySelector('#forgot-back-to-login');
    if (backToLogin) backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    const form = modal.querySelector('#forgot-password-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const emailInput = document.getElementById('forgot-email');
            const submitBtn = document.getElementById('forgot-submit-btn');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (window.I18n ? window.I18n.t('common.sending', 'جاري الإرسال...') : 'جاري الإرسال...');

            try {
                const res = await fetchJson(`${API_BASE_URL}/auth/forgot-password`, {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok) {
                    showNotification(window.I18n ? window.I18n.t('errors.' + data.code, data.message || 'تم إرسال تعليمات الاستعادة بنجاح!') : (data.message || 'تم إرسال تعليمات الاستعادة بنجاح!'), 'success');
                    if (data.resetToken) {
                        setTimeout(() => {
                            showResetPasswordForm(data.resetToken, email);
                        }, 1200);
                    }
                } else {
                    showNotification(getErrorMessage(data, 'auth.password_reset_fail'), 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = window.I18n ? window.I18n.t('auth.send_reset_btn', 'إرسال رابط الاستعادة') : 'إرسال رابط الاستعادة';
                }
            } catch (err) {
                showNotification(window.I18n ? window.I18n.t('errors.SERVER_ERROR', 'حدث خطأ في الاتصال بالخادم') : 'حدث خطأ في الاتصال بالخادم', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = window.I18n ? window.I18n.t('auth.send_reset_btn', 'إرسال رابط الاستعادة') : 'إرسال رابط الاستعادة';
            }
        });
    }
}

/**
 * عرض نموذج تعيين كلمة المرور الجديدة
 */
function showResetPasswordForm(prefilledToken = '', userEmail = '') {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 data-i18n="auth.reset_password_title">تعيين كلمة مرور جديدة</h2>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="reset-password-form">
                    <div class="form-group">
                        <label for="reset-token" data-i18n="auth.reset_token">رمز الاستعادة / Token</label>
                        <input type="text" id="reset-token" required value="${prefilledToken || ''}" data-i18n-placeholder="auth.enter_token" placeholder="أدخل الرمز المستلم...">
                    </div>
                    <div class="form-group">
                        <label for="reset-password" data-i18n="auth.new_password">كلمة المرور الجديدة</label>
                        <div class="password-input-wrap" style="position:relative;display:flex;align-items:center;">
                            <input type="password" id="reset-password" required minlength="6" placeholder="******" style="flex:1;padding-inline-end:42px;">
                            <button type="button" class="toggle-password-btn" data-target="reset-password" data-i18n-title="auth.toggle_password" title="إظهار/إخفاء" style="position:absolute;inset-inline-end:10px;background:none;border:none;cursor:pointer;color:var(--light-text,#94a3b8);font-size:1rem;padding:4px;"><i class="fas fa-eye"></i></button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="reset-confirm-password" data-i18n="auth.confirm_new_password">تأكيد كلمة المرور</label>
                        <div class="password-input-wrap" style="position:relative;display:flex;align-items:center;">
                            <input type="password" id="reset-confirm-password" required minlength="6" placeholder="******" style="flex:1;padding-inline-end:42px;">
                            <button type="button" class="toggle-password-btn" data-target="reset-confirm-password" data-i18n-title="auth.toggle_password" title="إظهار/إخفاء" style="position:absolute;inset-inline-end:10px;background:none;border:none;cursor:pointer;color:var(--light-text,#94a3b8);font-size:1rem;padding:4px;"><i class="fas fa-eye"></i></button>
                        </div>
                    </div>
                    <button type="submit" id="reset-submit-btn" class="btn" style="width: 100%; margin-top: 10px;">
                        <span data-i18n="auth.reset_password_btn">حفظ كلمة المرور الجديدة</span>
                    </button>
                    <div class="auth-links" style="margin-top: 18px; text-align: center;">
                        <a href="#" id="reset-back-to-login" data-i18n="auth.back_to_login">العودة لتسجيل الدخول</a>
                    </div>
                </form>
            </div>
        </div>
    `;

    openAuthModalElement(modal);

    modal.onclick = function(e) {
        if (e.target === modal) {
            closeAuthModalElement(modal);
        }
    };


    const closeModalBtn = modal.querySelector('.close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => closeAuthModalElement(modal));

    initPasswordToggles(modal);

    const backToLogin = modal.querySelector('#reset-back-to-login');
    if (backToLogin) backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    const form = modal.querySelector('#reset-password-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const token = document.getElementById('reset-token').value.trim();
            const password = document.getElementById('reset-password').value;
            const confirmPassword = document.getElementById('reset-confirm-password').value;
            const submitBtn = document.getElementById('reset-submit-btn');

            if (!token) {
                showNotification(window.I18n ? window.I18n.t('auth.enter_token_error', 'يرجى إدخال رمز التحقق المستلم') : 'يرجى إدخال رمز التحقق المستلم', 'error');
                return;
            }
            if (!password || password.length < 6) {
                showNotification(window.I18n ? window.I18n.t('errors.PASSWORD_TOO_SHORT', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل') : 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
                return;
            }
            if (password !== confirmPassword) {
                showNotification(window.I18n ? window.I18n.t('auth.password_mismatch', 'كلمتا المرور غير متطابقتين') : 'كلمتا المرور غير متطابقتين', 'error');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (window.I18n ? window.I18n.t('common.sending', 'جاري التحديث...') : 'جاري التحديث...');

            try {
                const res = await fetchJson(`${API_BASE_URL}/auth/reset-password`, {
                    method: 'POST',
                    body: JSON.stringify({ token, password })
                });
                const data = await res.json();
                if (res.ok) {
                    const okMsg = (data.code && window.I18n ? window.I18n.t('errors.' + data.code) : null) || data.message || (window.I18n ? window.I18n.t('auth.password_reset_success', 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.') : 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.');
                    showNotification(okMsg, 'success');
                    setTimeout(() => {
                        showLoginForm();
                    }, 1000);
                } else {
                    const errMsg = getErrorMessage(data, 'auth.password_reset_fail');
                    showNotification(errMsg, 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = window.I18n ? window.I18n.t('auth.reset_password_btn', 'حفظ كلمة المرور الجديدة') : 'حفظ كلمة المرور الجديدة';
                }
            } catch (err) {
                showNotification(window.I18n ? window.I18n.t('messages.server_error', 'حدث خطأ في الاتصال بالخادم') : 'حدث خطأ في الاتصال بالخادم', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = window.I18n ? window.I18n.t('auth.reset_password_btn', 'حفظ كلمة المرور الجديدة') : 'حفظ كلمة المرور الجديدة';
            }
        });
    }
}


/**
 * Handle Google Sign-In authentication flow
 */
window.initiateGoogleLogin = async function() {
    try {
        let clientId = '';
        try {
            const settingsRes = await fetch('/api/settings');
            if (settingsRes.ok) {
                const settings = await settingsRes.json();
                clientId = settings.google_client_id || '';
            }
        } catch (e) {}

        if (clientId && window.google && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: window.handleGoogleCredentialResponse
            });
            window.google.accounts.id.prompt();
            return;
        }

        showNotification(window.I18n ? window.I18n.t('errors.GOOGLE_AUTH_DISABLED', 'تسجيل الدخول عبر Google غير مُفعَّل حالياً على هذا المتجر') : 'تسجيل الدخول عبر Google غير مُفعَّل حالياً على هذا المتجر', 'warning');
    } catch (err) {
        showNotification(getErrorMessage(err, 'errors.GOOGLE_LOGIN_FAILED'), 'error');
    }
};

window.handleGoogleCredentialResponse = async function(response) {
    try {
        const res = await fetchJson('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(getErrorMessage(data, 'errors.GOOGLE_LOGIN_FAILED'));

        saveSessionUser(data.user);
        updateUIForLoggedInUser(data.user);
        closeAuthModalElement();
        showNotification(window.I18n ? window.I18n.t('errors.GOOGLE_LOGIN_SUCCESS', 'تم تسجيل الدخول بنجاح عبر Google! 🎉') : 'تم تسجيل الدخول بنجاح عبر Google! 🎉', 'success');
        if (window.location.pathname.includes('account.html')) {
            window.location.reload();
        }
    } catch (err) {
        showNotification(getErrorMessage(err, 'errors.GOOGLE_LOGIN_FAILED'), 'error');
    }
};

/**
 * Handle login process
 */
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    // Validate input data
    if (!email || !password) {
        showNotification('Please enter email and password', 'error');
        return;
    }

    try {
        const response = await fetchJson(`${API_BASE_URL}/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password, remember: rememberMe })
        });

        const data = await response.json();

        if (response.ok) {
            saveSessionUser(data.user, rememberMe);
            if (data.demoToken) {
                sessionStorage.setItem('rewaq_demo_token', data.demoToken);
            }

            closeAuthModalElement();
            updateUIForLoggedInUser(data.user);
            const okMsg = (data.code && window.I18n ? window.I18n.t('errors.' + data.code) : null) || data.message || (window.I18n ? window.I18n.t('auth.login_success', 'تم تسجيل الدخول بنجاح! 🎉') : 'تم تسجيل الدخول بنجاح! 🎉');
            showNotification(okMsg, 'success');
            updateCartUI();

            setTimeout(() => {
                const savedRedirect = localStorage.getItem('redirectAfterLogin');
                const isSafeLocalUrl = (url) => {
                    if (!url || typeof url !== 'string') return false;
                    const trimmed = url.trim();
                    if (/^(?:[a-z]+:|\/\/)/i.test(trimmed)) return false;
                    return !trimmed.toLowerCase().includes('javascript:') && !trimmed.toLowerCase().includes('data:');
                };

                if (savedRedirect && isSafeLocalUrl(savedRedirect)) {
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = savedRedirect;
                } else if (data.user && data.user.role === 'admin') {
                    window.location.href = 'admin/index.html';
                } else {
                    window.location.href = 'account.html';
                }
            }, 800);
        } else {
            const errorMsg = getErrorMessage(data, 'errors.INVALID_CREDENTIALS');
            showNotification(errorMsg, 'error');
        }
    } catch (error) {
        showNotification(window.I18n ? window.I18n.t('messages.server_error', 'حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة لاحقاً.') : 'حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة لاحقاً.', 'error');
    }
}

/**
 * Handle new account creation
 */
async function handleSignup() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const agreeTerms = document.getElementById('agree-terms').checked;

    // Validate input data
    if (!name || !email || !phone || !password || !confirmPassword) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Password and confirmation do not match', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    if (!agreeTerms) {
        showNotification(window.I18n ? window.I18n.t('auth.agree_terms_required', 'You must agree to the terms and privacy policy') : 'You must agree to the terms and privacy policy', 'error');
        return;
    }

        try {
        const response = await fetchJson(`${API_BASE_URL}/register`, {
            method: 'POST',
            body: JSON.stringify({ username: name, email, phone, password })
        });

        const data = await response.json();

        if (response.ok) {
            if (data.demoToken) {
                sessionStorage.setItem('rewaq_demo_token', data.demoToken);
            }
            if (data.user) {
                saveSessionUser(data.user);
                updateUIForLoggedInUser(data.user);
            }
            closeAuthModalElement();

            showNotification(data.message || (window.I18n ? window.I18n.t('auth.register_success', 'تم إنشاء الحساب بنجاح!') : 'تم إنشاء الحساب بنجاح!'));

            setTimeout(() => {
                const redirectUrl = localStorage.getItem('redirectAfterLogin') || 'index.html';
                localStorage.removeItem('redirectAfterLogin');
                window.location.href = redirectUrl;
            }, 800);
        } else {
            showNotification(getErrorMessage(data, 'messages.server_error'), 'error');
        }
    } catch (error) {
        showNotification(window.I18n ? window.I18n.t('messages.server_error', 'حدث خطأ في الاتصال بالخادم') : 'حدث خطأ في الاتصال بالخادم', 'error');
    }
}

/**
 * User logout
 */
async function logoutUser() {
    try {
        await fetchJson(`${API_BASE_URL}/logout`, {
            method: 'POST'
        });
    } catch (error) {
        // Ignore server-side logout failures and clear the UI state anyway.
    }

    clearSessionAuthState();

    showNotification(window.I18n ? window.I18n.t('messages.logout_success', 'تم تسجيل الخروج بنجاح') : 'تم تسجيل الخروج بنجاح');
    updateCartUI();

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 600);
}

/**
 * الحصول على بيانات المستخدم الحالي بشكل متزامن من التخزين المحلي
 * @returns {Object|null}
 */
function getCurrentUserSync() {
    return readSessionUser();
}

/**
 * الحصول على بيانات المستخدم الحالي والتحقق من التوكن عبر السيرفر
 * @returns {Promise<Object|null>} - كائن بيانات المستخدم أو null إذا لم يكن مسجلاً
 */
async function getCurrentUser() {
    const savedUser = getCurrentUserSync();
    try {
        const response = await fetchJson(`${API_BASE_URL}/auth/session`);
        if (response.ok) {
            const userData = await response.json();
            saveSessionUser(userData.user);
            return userData.user;
        }

        clearSessionAuthState();
        return null;
    } catch (error) {
        return savedUser;
    }
}

/**
 * التحقق من ما إذا كان المستخدم مسجلاً
 * @returns {boolean} - true إذا كان مسجلاً، false إذا لم يكن
 */
function isLoggedIn() {
    return getCurrentUserSync() !== null;
}

/**
 * إضافة عنوان شحن جديد للمستخدم
 * @param {Object} address - كائن العنوان
 */
function addShippingAddress(address) {
    const user = getCurrentUserSync();
    if (!user) {
        showNotification(window.I18n ? window.I18n.t('auth.address_login_required', 'يجب تسجيل الدخول لإضافة العنوان') : 'يجب تسجيل الدخول لإضافة العنوان', 'error');
        return false;
    }

    // الحصول على قائمة المستخدمين
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);

    if (userIndex === -1) {
        showNotification(window.I18n ? window.I18n.t('errors.USER_NOT_FOUND', 'لم يتم العثور على حساب المستخدم') : 'لم يتم العثور على حساب المستخدم', 'error');
        return false;
    }

    // إضافة العنوان
    if (!users[userIndex].addresses) {
        users[userIndex].addresses = [];
    }

    address.id = Date.now(); // استخدام الطابع الزمني كـ ID
    address.createdAt = new Date().toISOString();
    users[userIndex].addresses.push(address);

    // حفظ القائمة المحدثة
    localStorage.setItem('users', JSON.stringify(users));

    // تحديث بيانات المستخدم في الجلسة
    const updatedUser = {
        ...user,
        addresses: users[userIndex].addresses
    };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    showNotification(window.I18n ? window.I18n.t('auth.address_added', 'تمت إضافة العنوان بنجاح') : 'تمت إضافة العنوان بنجاح');
    return true;
}

/**
 * الحصول على عناوين الشحن للمستخدم
 * @returns {Array} - قائمة العناوين
 */
function getUserAddresses() {
    const user = getCurrentUserSync();
    if (!user) {
        return [];
    }

    // الحصول على قائمة المستخدمين
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userData = users.find(u => u.id === user.id);

    return userData ? userData.addresses || [] : [];
}

/**
 * Create new order
 * @param {Object} orderData - Order data
 * @returns {number|null} - Order ID or null in case of error
 */
async function createOrder(orderData) {
    const user = getCurrentUserSync();

    try {
        // Get shopping cart
        const savedCart = localStorage.getItem('cart');
        if (!savedCart) {
            showNotification('Shopping cart is empty', 'error');
            return null;
        }

        const cart = JSON.parse(savedCart);

        // Create order object
        const order = {
            userId: user ? user.id : 1,
            total: orderData.total,
            shippingInfo: orderData.shippingInfo || {},
            cart: cart
        };

        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(order)
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.removeItem('cart');
            localStorage.setItem('lastOrderId', data.id);
            showNotification('Order created successfully');
            return data.id;
        } else {
            const errData = await response.json();
            showNotification(getErrorMessage(errData, 'messages.create_order_fail'), 'error');
            return null;
        }
    } catch (e) {

        showNotification('An error occurred while creating the order', 'error');
        return null;
    }
}

/**
 * Get user orders
 * @returns {Array} - List of orders
 */
function getUserOrders() {
    const user = getCurrentUserSync();
    if (!user) {
        return [];
    }

    // Get user list
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userData = users.find(u => u.id === user.id);

    return userData ? userData.orders || [] : [];
}

/**
 * Get details of a specific order
 * @param {number} orderId - Order ID
 * @returns {Object|null} - Order data object or null if not found
 */
function getOrderDetails(orderId) {
    const user = getCurrentUserSync();
    if (!user) {
        return null;
    }

    // Get user list
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userData = users.find(u => u.id === user.id);

    if (!userData || !userData.orders) {
        return null;
    }

    return userData.orders.find(order => order.id === orderId) || null;
}

/**
 * Update order status
 * @param {number} orderId - Order ID
 * @param {string} status - New status
 * @returns {boolean} - true if update was successful, false in case of error
 */
function updateOrderStatus(orderId, status) {
    const user = getCurrentUserSync();
    if (!user) {
        showNotification('You must be logged in to update order status', 'error');
        return false;
    }

    // Get user list
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);

    if (userIndex === -1) {
        showNotification('User account not found', 'error');
        return false;
    }

    // Find the order and update its status
    const orderIndex = users[userIndex].orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) {
        showNotification('Order not found', 'error');
        return false;
    }

    users[userIndex].orders[orderIndex].status = status;
    users[userIndex].orders[orderIndex].updatedAt = new Date().toISOString();

    // Save the updated list
    localStorage.setItem('users', JSON.stringify(users));

    // Update user data in session
    const updatedUser = {
        ...user,
        orders: users[userIndex].orders
    };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    showNotification('Order status updated successfully');
    return true;
}

// Make functions available globally
window.getCurrentUserSync = getCurrentUserSync;
window.getCurrentUser = getCurrentUser;
window.isLoggedIn = isLoggedIn;
window.showLoginForm = showLoginForm;
window.showSignupForm = showSignupForm;
window.logoutUser = logoutUser;

// عند تحميل الصفحة: استعادة حالة المستخدم أو ربط نافذة الدخول بالأيقونة
document.addEventListener('DOMContentLoaded', () => {
    let savedUser = readSessionUser();
    if (savedUser) {
        updateUIForLoggedInUser(savedUser);

        // التحقق من صلاحية الجلسة مع الخادم في الخلفية
        fetchJson(`${API_BASE_URL}/auth/session`).then(res => {
            if (res && res.ok) {
                res.json().then(data => {
                    if (data && data.user) {
                        saveSessionUser(data.user);
                        updateUIForLoggedInUser(data.user);
                    }
                }).catch(() => {});
            } else if (res && res.status === 401) {
                clearSessionAuthState();
            }
        }).catch(() => {});
    } else {
        // لم يسجل دخول — اجعل أيقونة المستخدم تفتح نافذة الدخول
        document.querySelectorAll('.user-icon').forEach(icon => {
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', (e) => {
                e.preventDefault();
                showLoginForm();
            });
        });
    }
});



document.addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.dataset.action === 'logoutUser') {
        if (typeof window.logoutUser === 'function') window.logoutUser();
    } else if (actionEl.dataset.action === 'initiateGoogleLogin') {
        if (typeof window.initiateGoogleLogin === 'function') window.initiateGoogleLogin();
    }
});
