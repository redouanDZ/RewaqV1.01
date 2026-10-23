
        document.addEventListener('DOMContentLoaded', async () => {
            // ---------- helpers ----------
            function t(key, fallback) {
                return (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(key, fallback) : fallback;
            }

            function applyUserData(user) {
                if (!user) return;
                const name  = user.username || user.name  || t('account.user_default', '...');
                const email = user.email || '';
                const phone = user.phone || '';
                const isAdmin = user.role === 'admin';

                const sidebarName  = document.getElementById('sidebar-user-name');
                const sidebarEmail = document.getElementById('sidebar-user-email');
                const profileName  = document.getElementById('profile-name');
                const profileEmail = document.getElementById('profile-email');
                const profilePhone = document.getElementById('profile-phone');
                const avatarIcon   = document.getElementById('avatar-icon');

                // Set text directly — NO data-i18n so i18n.js won't overwrite it
                if (sidebarName)  sidebarName.textContent  = isAdmin ? `${name} 👑` : name;
                if (sidebarEmail) sidebarEmail.textContent = email || t('account.not_logged_in', '...');
                if (profileName)  profileName.value  = name;
                if (profileEmail) profileEmail.value = email;
                if (profilePhone) profilePhone.value = phone;
                if (avatarIcon && name) {
                    if (isAdmin) {
                        avatarIcon.innerHTML = '<i class="fas fa-user-shield"></i>';
                    } else {
                        avatarIcon.textContent = name.charAt(0).toUpperCase();
                    }
                }
            }

            // ---------- load user ----------
            let currentUser = null;
            try {
                // Try regular user first, then admin session as fallback
                const rawUser  = localStorage.getItem('currentUser')  || sessionStorage.getItem('currentUser');
                const rawAdmin = localStorage.getItem('adminUser')     || sessionStorage.getItem('adminUser');
                if (rawUser)  currentUser = JSON.parse(rawUser);
                if (!currentUser && rawAdmin) currentUser = JSON.parse(rawAdmin);
            } catch (e) {}

            // Apply cached data immediately (avoids flash of placeholder)
            if (currentUser) applyUserData(currentUser);

            // Sync latest session from server (authoritative)
            try {
                const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
                if (sessionRes.ok) {
                    const sessionData = await sessionRes.json();
                    if (sessionData && sessionData.user) {
                        currentUser = sessionData.user;
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        applyUserData(currentUser);
                    }
                }
            } catch (e) {}

            if (!currentUser) {
                // Show placeholder text in the user's language
                const nameEl  = document.getElementById('sidebar-user-name');
                const emailEl = document.getElementById('sidebar-user-email');
                if (nameEl)  nameEl.textContent  = t('account.user_default', '...');
                if (emailEl) emailEl.textContent = t('account.not_logged_in', '...');
                if (window.showLoginForm) {
                    if ('requestIdleCallback' in window) {
                        window.requestIdleCallback(() => window.showLoginForm(), { timeout: 1000 });
                    } else {
                        setTimeout(() => window.showLoginForm(), 250);
                    }
                }
            }

            // Tab Switching Logic
            const navButtons = document.querySelectorAll('.account-nav-btn[data-tab]');
            const tabSections = document.querySelectorAll('.tab-section');

            function switchTab(tabId) {
                navButtons.forEach(btn => {
                    if (btn.getAttribute('data-tab') === tabId) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                tabSections.forEach(section => {
                    if (section.id === `tab-${tabId}`) {
                        section.classList.add('active');
                    } else {
                        section.classList.remove('active');
                    }
                });

                if (tabId === 'addresses') loadAddresses();
                if (tabId === 'orders') loadUserOrders();
                if (tabId === 'wishlist') {
                    if (typeof loadSecondaryModules === 'function') loadSecondaryModules();
                    loadUserWishlist();
                }
            }

            navButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabId = btn.getAttribute('data-tab');
                    switchTab(tabId);
                });
            });

            // Check URL query param e.g., ?tab=orders
            const urlParams = new URLSearchParams(window.location.search);
            const initialTab = urlParams.get('tab');
            if (initialTab) {
                switchTab(initialTab);
            }

            // Handle Profile Form Submission
            const profileForm = document.getElementById('profile-update-form');
            if (profileForm) {
                profileForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const username = document.getElementById('profile-name').value.trim();
                    const email = document.getElementById('profile-email').value.trim();
                    const phone = document.getElementById('profile-phone').value.trim();
                    const newPass = document.getElementById('profile-new-pass').value;
                    const confirmPass = document.getElementById('profile-confirm-pass').value;

                    if (newPass && newPass !== confirmPass) {
                        showToast(window.I18n ? window.I18n.t('messages.pass_mismatch', 'كلمتا المرور غير متطابقتين') : 'كلمتا المرور غير متطابقتين', 'error');
                        return;
                    }

                    try {
                        const payload = { username, email, phone };
                        if (newPass) payload.password = newPass;

                        const headers = { 'Content-Type': 'application/json' };
                        try {
                            const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
                            if (csrfRes.ok) {
                                const csrfData = await csrfRes.json();
                                if (csrfData && csrfData.csrfToken) headers['X-CSRF-Token'] = csrfData.csrfToken;
                            }
                        } catch (e) {}

                        const res = await fetch('/api/user/profile', {
                            method: 'PUT',
                            credentials: 'include',
                            headers,
                            body: JSON.stringify(payload)
                        });

                        const data = await res.json();
                        if (res.ok) {
                            showToast(window.I18n ? window.I18n.t('messages.data_update_success', 'تم تحديث البيانات بنجاح 🎉') : 'تم تحديث البيانات بنجاح 🎉', 'success');
                            if (data.user) {
                                localStorage.setItem('currentUser', JSON.stringify(data.user));
                                applyUserData(data.user);
                            }
                            document.getElementById('profile-new-pass').value = '';
                            document.getElementById('profile-confirm-pass').value = '';
                        } else {
                            showToast(getErrorMessage(data, 'messages.data_update_error'), 'error');
                        }
                    } catch (err) {
                        showToast(window.I18n ? window.I18n.t('messages.server_error', 'خطأ في الاتصال بالخادم') : 'خطأ في الاتصال بالخادم', 'error');
                    }
                });
            }

            // Load Saved Addresses
            async function loadAddresses() {
                const container = document.getElementById('addresses-container');
                if (!container) return;
                try {
                    const res = await fetch('/api/user/profile', { credentials: 'include' });
                    if (res.ok) {
                        const user = await res.json();
                        const addresses = user.addresses || [];

                        if (addresses.length === 0) {
                            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--light-text);"><i class="fas fa-map-marker-alt" style="font-size: 2.5rem; margin-bottom: 12px; display: block; color: var(--border-color);"></i><span data-i18n="account.no_addresses">${window.I18n ? window.I18n.t('account.no_addresses', 'لا توجد عناوين شحن محفوظة حتى الآن.') : 'لا توجد عناوين شحن محفوظة حتى الآن.'}</span></div>`;
                            return;
                        }

                        container.innerHTML = addresses.map(addr => `
                            <div class="address-card ${addr.isDefault ? 'default-address' : ''}">
                                ${addr.isDefault ? '<span class="address-badge">' + (window.I18n ? window.I18n.t('account.default_badge', 'العنوان الافتراضي') : 'العنوان الافتراضي') + '</span>' : ''}
                                <h4>${window.escapeHtml(addr.title || (window.I18n ? window.I18n.t('account.address_fallback', 'عنوان') : 'عنوان'))}</h4>
                                <p><strong>${window.I18n ? window.I18n.t('account.recipient_label', 'المستلم:') : 'المستلم:'}</strong> ${window.escapeHtml(addr.fullName)}</p>
                                <p><strong>${window.I18n ? window.I18n.t('account.phone_label', 'الهاتف:') : 'الهاتف:'}</strong> ${window.escapeHtml(addr.phone)}</p>
                                <p><strong>${window.I18n ? window.I18n.t('account.city_label', 'المدينة:') : 'المدينة:'}</strong> ${window.escapeHtml(addr.city)}</p>
                                <p><strong>${window.I18n ? window.I18n.t('account.address_label', 'العنوان:') : 'العنوان:'}</strong> ${window.escapeHtml(addr.address)}</p>
                                <div class="address-actions">
                                    <button class="btn-sm-danger" data-action="deleteAddress" data-args="${addr.id}">
                                        <i class="fas fa-trash"></i> <span>${window.I18n ? window.I18n.t('common.delete', 'حذف') : 'حذف'}</span>
                                    </button>
                                </div>
                            </div>
                        `).join('');
                    }
                } catch (e) {}
            }

            // Modal address handlers
            const addressModal = document.getElementById('add-address-modal');
            const openAddBtn = document.getElementById('open-add-address-btn');
            const closeAddBtn = document.getElementById('close-address-modal');
            const cancelAddBtn = document.getElementById('cancel-address-btn');

            if (openAddBtn) openAddBtn.addEventListener('click', () => addressModal && addressModal.classList.add('show'));
            if (closeAddBtn) closeAddBtn.addEventListener('click', () => addressModal && addressModal.classList.remove('show'));
            if (cancelAddBtn) cancelAddBtn.addEventListener('click', () => addressModal && addressModal.classList.remove('show'));
            if (addressModal) {
                addressModal.addEventListener('click', (e) => {
                    if (e.target === addressModal) addressModal.classList.remove('show');
                });
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && addressModal.classList.contains('show')) {
                        addressModal.classList.remove('show');
                    }
                });
            }

            const addAddressForm = document.getElementById('add-address-form');
            if (addAddressForm) {
                addAddressForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const payload = {
                        title: document.getElementById('addr-title').value.trim(),
                        fullName: document.getElementById('addr-fullname').value.trim(),
                        phone: document.getElementById('addr-phone').value.trim(),
                        city: document.getElementById('addr-city').value.trim(),
                        address: document.getElementById('addr-street').value.trim(),
                        isDefault: document.getElementById('addr-default').checked
                    };

                    try {
                        const headers = { 'Content-Type': 'application/json' };
                        try {
                            const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
                            if (csrfRes.ok) {
                                const csrfData = await csrfRes.json();
                                if (csrfData && csrfData.csrfToken) headers['X-CSRF-Token'] = csrfData.csrfToken;
                            }
                        } catch (e) {}

                        const res = await fetch('/api/user/addresses', {
                            method: 'POST',
                            credentials: 'include',
                            headers,
                            body: JSON.stringify(payload)
                        });
                        if (res.ok) {
                            showToast(window.I18n ? window.I18n.t('messages.address_saved', 'تم حفظ العنوان بنجاح') : 'تم حفظ العنوان بنجاح', 'success');
                            if (addressModal) addressModal.classList.remove('show');
                            document.getElementById('add-address-form').reset();
                            loadAddresses();
                        } else {
                            showToast(window.I18n ? window.I18n.t('messages.address_save_error', 'حدث خطأ أثناء حفظ العنوان') : 'حدث خطأ أثناء حفظ العنوان', 'error');
                        }
                    } catch (e) {
                        showToast(window.I18n ? window.I18n.t('messages.server_error', 'خطأ في الاتصال بالخادم') : 'خطأ في الاتصال بالخادم', 'error');
                    }
                });
            }

            window.deleteAddress = async function(id) {
                if (!confirm(window.I18n ? window.I18n.t('messages.confirm_delete_address', 'هل أنت متأكد من حذف هذا العنوان؟') : 'هل أنت متأكد من حذف هذا العنوان؟')) return;
                try {
                    const headers = {};
                    try {
                        const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
                        if (csrfRes.ok) {
                            const csrfData = await csrfRes.json();
                            if (csrfData && csrfData.csrfToken) headers['X-CSRF-Token'] = csrfData.csrfToken;
                        }
                    } catch (e) {}

                    const res = await fetch(`/api/user/addresses/${id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                        headers
                    });
                    if (res.ok) {
                        showToast(window.I18n ? window.I18n.t('messages.address_deleted', 'تم حذف العنوان بنجاح') : 'تم حذف العنوان بنجاح', 'info');
                        loadAddresses();
                    }
                } catch (e) {
                    showToast(window.I18n ? window.I18n.t('messages.server_error', 'حدث خطأ أثناء حذف العنوان') : 'حدث خطأ أثناء حذف العنوان', 'error');
                }
            };

            // Load Orders
            async function loadUserOrders() {
                const container = document.getElementById('orders-container');
                if (!container) return;
                try {
                    const res = await fetch('/api/orders', { credentials: 'include' });
                    if (res.ok) {
                        const orders = await res.json();
                        if (!Array.isArray(orders) || orders.length === 0) {
                            container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--light-text);"><i class="fas fa-box-open" style="font-size: 2.5rem; margin-bottom: 12px; display: block; color: var(--border-color);"></i><span>${window.I18n ? window.I18n.t('account.no_orders', 'لا توجد طلبات سابقة حتى الآن.') : 'لا توجد طلبات سابقة حتى الآن.'}</span></div>`;
                            return;
                        }

                        container.innerHTML = orders.map(ord => `
                            <div class="order-item-card">
                                <div class="order-header-row">
                                    <div>
                                        <span class="order-id-tag">${window.I18n ? window.I18n.t('account.order_id', 'طلب #{id}').replace('{id}', ord.id) : 'طلب #' + ord.id}</span>
                                        <span style="font-size: 0.85rem; color: var(--light-text); margin-right: 12px;">
                                            ${window.I18n ? window.I18n.formatDate(ord.created_at || Date.now()) : new Date(ord.created_at || Date.now()).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span class="order-status-badge status-${ord.status}">${getStatusLabel(ord.status)}</span>
                                        <strong style="margin-right: 15px; font-size: 1.1rem; color: var(--success-color); font-weight: 800;">${ord.total ? (window.I18n ? window.I18n.formatNumber(ord.total) : Number(ord.total).toLocaleString()) : '0'} ${window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج'}</strong>
                                    </div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                    <p style="margin: 0; font-size: 0.9rem; color: var(--light-text);">
                                        <strong>${window.I18n ? window.I18n.t('account.payment_method_label', 'طريقة الدفع:') : 'طريقة الدفع:'}</strong> ${ord.payment_method === 'chargily' ? (window.I18n ? window.I18n.t('conf.epay', 'دفع إلكتروني (بطاقة ذهبية / CIB)') : 'دفع إلكتروني') : (window.I18n ? window.I18n.t('features.cod_title', 'الدفع عند الاستلام') : 'الدفع عند الاستلام')}
                                    </p>
                                    <a href="order-confirmation.html?id=${ord.id}&phone=${encodeURIComponent(ord.phone || '')}&token=${encodeURIComponent(ord.tracking_token || '')}" class="order-details-btn">
                                        ${window.I18n ? window.I18n.t('account.view_details', 'عرض التفاصيل') : 'عرض التفاصيل'} <i class="fas fa-chevron-left" style="font-size: 0.75rem;"></i>
                                    </a>
                                </div>
                            </div>
                        `).join('');
                    } else {
                        container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--light-text);"><i class="fas fa-box-open" style="font-size: 2.5rem; margin-bottom: 12px; display: block; color: var(--border-color);"></i><span>${window.I18n ? window.I18n.t('account.no_orders', 'لا توجد طلبات سابقة حتى الآن.') : 'لا توجد طلبات سابقة حتى الآن.'}</span></div>`;
                    }
                } catch (e) {
                    container.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--danger-color);"><span>${window.I18n ? window.I18n.t('messages.server_error', 'حدث خطأ أثناء تحميل الطلبات') : 'حدث خطأ أثناء تحميل الطلبات'}</span></div>`;
                }
            }

            function getStatusLabel(status) {
                switch(status) {
                    case 'pending': return window.I18n ? window.I18n.t('account.status_pending_alt', 'قيد الانتظار') : 'قيد الانتظار';
                    case 'processing': return window.I18n ? window.I18n.t('account.status_processing_alt', 'جاري المعالجة') : 'جاري المعالجة';
                    case 'shipped': return window.I18n ? window.I18n.t('order_status.shipped', 'تم الشحن') : 'تم الشحن';
                    case 'delivered': return window.I18n ? window.I18n.t('order_status.delivered', 'تم التسليم') : 'تم التسليم';
                    case 'cancelled': return window.I18n ? window.I18n.t('order_status.cancelled', 'ملغي') : 'ملغي';
                    default: return status || (window.I18n ? window.I18n.t('account.status_pending_alt', 'قيد الانتظار') : 'قيد الانتظار');
                }
            }

            function transformProductImage(url) {
                if (!url) return '/images/product-placeholder.jpg';
                if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/w_')) {
                    return url.replace('/upload/', '/upload/w_400,h_400,c_fill,f_auto,q_auto/');
                }
                return url;
            }

            // Load Wishlist Items
            async function loadUserWishlist() {
                const container = document.getElementById('wishlist-container');
                if (!container) return;
                const wishlistIds = (window.getWishlist && typeof window.getWishlist === 'function')
                    ? window.getWishlist()
                    : (() => { try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); } catch(e) { return []; } })();

                if (wishlistIds.length === 0) {
                    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--light-text);"><i class="fas fa-heart-broken" style="font-size: 2.5rem; margin-bottom: 12px; display: block; color: var(--border-color);"></i><span>${window.I18n ? window.I18n.t('wishlist.empty_msg', 'قائمة المفضلة فارغة حالياً.') : 'قائمة المفضلة فارغة حالياً.'}</span></div>`;
                    return;
                }

                try {
                    const res = await fetch('/api/products');
                    if (res.ok) {
                        const data = await res.json();
                        const products = Array.isArray(data) ? data : (Array.isArray(data && data.products) ? data.products : []);
                        const favoritedProducts = products.filter(p => wishlistIds.includes(p.id));

                        if (favoritedProducts.length === 0) {
                            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--light-text);"><i class="fas fa-heart-broken" style="font-size: 2.5rem; margin-bottom: 12px; display: block; color: var(--border-color);"></i><span>${window.I18n ? window.I18n.t('wishlist.empty_msg', 'قائمة المفضلة فارغة حالياً.') : 'قائمة المفضلة فارغة حالياً.'}</span></div>`;
                            return;
                        }

                        window.accountWishlistProducts = favoritedProducts;
                        container.innerHTML = favoritedProducts.map((p, index) => {
                            const safeName = window.escapeHtml(p.name);
                            const safeCat = window.escapeHtml(p.category || 'عام');
                            const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
                            const addText = window.I18n ? window.I18n.t('common.add_to_cart', 'أضف للسلة') : 'أضف للسلة';
                            const removeText = window.I18n ? window.I18n.t('wishlist.remove_btn', 'حذف من المفضلة') : 'حذف';
                            const optImg = transformProductImage(p.image_url || '/images/product-placeholder.jpg');
                            return `
                            <div class="product-card" id="account-wishlist-${p.id}">
                                <a href="product.html?id=${p.id}" class="product-image">
                                    <img ${index === 0 ? '' : 'loading="lazy"'} src="${window.escapeHtml(optImg)}" alt="${safeName}" width="300" height="300">
                                </a>
                                <div class="product-info">
                                    <h3 class="product-name"><a href="product.html?id=${p.id}">${safeName}</a></h3>
                                    <div class="product-price-row">
                                        <div class="price-group">
                                            <span class="product-price">${Number(p.price).toLocaleString()} <small>${currency}</small></span>
                                        </div>
                                    </div>
                                    <div class="product-card-actions" style="gap: 8px;">
                                        <button class="btn btn-primary" style="flex: 1; min-height: 40px; font-size: 0.85rem;" data-action="accountAddToCart" data-args="${p.id}">
                                             <i class="fas fa-cart-plus"></i> <span>${addText}</span>
                                        </button>
                                        <button class="btn-sm-danger" style="width: 40px; min-height: 40px; border-radius: var(--radius-sm, 8px); border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); color: var(--danger-color); cursor: pointer; display: flex; align-items: center; justify-content: center;" data-action="removeFromWishlist" data-args="${p.id}" title="${removeText}" aria-label="${removeText}">
                                            <i class="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;}).join('');
                    }
                } catch (e) {}
            }

            window.accountAddToCart = function(productId) {
                const p = (window.accountWishlistProducts || []).find(item => item.id === productId);
                if (!p) return;
                if (window.addToCart) {
                    window.addToCart({ id: p.id, name: p.name, category: p.category || '', price: p.price, image: p.image_url });
                } else if (typeof loadSecondaryModules === 'function') {
                    loadSecondaryModules();
                    setTimeout(() => {
                        if (window.addToCart) {
                            window.addToCart({ id: p.id, name: p.name, category: p.category || '', price: p.price, image: p.image_url });
                        }
                    }, 200);
                }
            };

            window.removeFromWishlist = function(id, name) {
                const p = (window.accountWishlistProducts || []).find(item => item.id === id);
                const targetName = name || (p ? p.name : '');
                if (window.toggleWishlist) {
                    window.toggleWishlist(id, targetName);
                    loadUserWishlist();
                } else if (typeof loadSecondaryModules === 'function') {
                    loadSecondaryModules();
                    setTimeout(() => {
                        if (window.toggleWishlist) {
                            window.toggleWishlist(id, targetName);
                            loadUserWishlist();
                        }
                    }, 200);
                }
            };

            // Sidebar Logout button
            const logoutBtn = document.getElementById('logout-sidebar-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    if (window.logoutUser) {
                        window.logoutUser();
                    } else {
                        localStorage.removeItem('currentUser');
                        sessionStorage.removeItem('currentUser');
                        fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
                        window.location.href = 'index.html';
                    }
                });
            }
            // Expose functions to window
            window.t = t;
            window.applyUserData = applyUserData;
            window.switchTab = switchTab;
            window.loadAddresses = loadAddresses;
            window.loadUserOrders = loadUserOrders;
            window.getStatusLabel = getStatusLabel;
            window.loadUserWishlist = loadUserWishlist;
        });
    

// Event Delegation
document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'deleteAddress') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.deleteAddress === 'function') window.deleteAddress(...args);
    }
    if (action === 'accountAddToCart') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.accountAddToCart === 'function') window.accountAddToCart(...args);
    }
    if (action === 'removeFromWishlist') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.removeFromWishlist === 'function') window.removeFromWishlist(...args);
    }
});


// Capture image load errors
document.addEventListener('error', function(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
        if (e.target.src !== window.location.origin + '/images/product-placeholder.jpg') {
            e.target.onerror = null;
            e.target.src = '/images/product-placeholder.jpg';
        }
    }
}, true);

// Schedule loading of secondary interactive modules on idle or first interaction to minimize TBT
let secondaryModulesLoaded = false;
function loadSecondaryModules() {
    if (secondaryModulesLoaded) return;
    secondaryModulesLoaded = true;
    ['js/cart.js', 'js/wishlist.js'].forEach(src => {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const s = document.createElement('script');
            s.src = src;
            s.defer = true;
            document.body.appendChild(s);
        }
    });
}
window.loadSecondaryModules = loadSecondaryModules;

if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadSecondaryModules, { timeout: 2000 });
} else {
    setTimeout(loadSecondaryModules, 600);
}

['touchstart', 'mouseover', 'scroll', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, loadSecondaryModules, { once: true, passive: true });
});

