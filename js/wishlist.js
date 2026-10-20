/**
 * Rewaq - إدارة قائمة الأمنيات والرغبات (Wishlist)
 */

window.WishlistManager = {
    /**
     * التحقق مما إذا كان المستخدم مسجلاً
     */
    isUserLoggedIn() {
        try {
            const user = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || 'null');
            return Boolean(user && user.id);
        } catch (e) {
            return false;
        }
    },

    /**
     * جلب عناصر المفضلة (من الخادم أو التخزين المحلي)
     */
    async getItems() {
        if (this.isUserLoggedIn()) {
            try {
                const res = await fetch('/api/wishlist', { credentials: 'include' });
                if (res.ok) {
                    const items = await res.json();
                    return items;
                } else if (res.status === 401) {
                    localStorage.removeItem('currentUser');
                    sessionStorage.removeItem('currentUser');
                }
            } catch (err) {
                console.warn('Could not fetch server wishlist, falling back to local:', err.message);
            }
        }

        let local = this.getLocalItems();
        if (local.length > 0) {
            const hasZeroPrice = local.some(p => !p.price || Number(p.price) === 0);
            if (hasZeroPrice) {
                try {
                    const res = await fetch('/api/products');
                    if (res.ok) {
                        const data = await res.json();
                        const products = Array.isArray(data) ? data : (Array.isArray(data && data.products) ? data.products : []);
                        if (products.length > 0) {
                            const map = new Map(products.map(p => [Number(p.id), p]));
                            let changed = false;
                            local = local.map(item => {
                                const prod = map.get(Number(item.id));
                                if (prod) {
                                    changed = true;
                                    return {
                                        ...item,
                                        name: prod.name || item.name,
                                        price: Number(prod.price !== undefined ? prod.price : item.price),
                                        stock: prod.stock !== undefined ? Number(prod.stock) : item.stock,
                                        image_url: prod.image_url || prod.image || item.image_url,
                                        category: prod.category || prod.category_name || item.category
                                    };
                                }
                                return item;
                            });
                            if (changed) {
                                this.saveLocalItems(local);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Could not refresh local wishlist prices:', e.message);
                }
            }
        }
        return local;
    },

    /**
     * جلب العناصر من LocalStorage
     */
    getLocalItems() {
        try {
            return JSON.parse(localStorage.getItem('rewaq_wishlist') || localStorage.getItem('wishlist') || '[]');
        } catch (e) {
            return [];
        }
    },

    /**
     * حفظ العناصر في LocalStorage
     */
    saveLocalItems(items) {
        localStorage.setItem('rewaq_wishlist', JSON.stringify(items));
        this.updateBadgeCount();
    },

    /**
     * إضافة أو إزالة منتج (تبديل الحالة)
     */
    async toggleItem(product) {
        if (!product || !product.id) return false;
        const prodId = Number(product.id);

        if (this.isUserLoggedIn()) {
            const inList = await this.isInWishlist(prodId);
            const method = inList ? 'DELETE' : 'POST';
            try {
                let csrfToken = '';
                try {
                    const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
                    if (csrfRes.ok) {
                        const csrfData = await csrfRes.json();
                        csrfToken = csrfData.csrfToken || '';
                    }
                } catch (e) {}

                const headers = { 'Content-Type': 'application/json' };
                if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

                const res = await fetch(`/api/wishlist/${prodId}`, {
                    method: method,
                    credentials: 'include',
                    headers
                });
                if (res.ok) {
                    const data = await res.json();
                    this.showToast(data.message || (inList ? window.I18n.t('messages.removed_wishlist', 'تم الحذف من المفضلة') : window.I18n.t('messages.added_wishlist', 'تمت الإضافة للمفضلة ❤️')), 'success');
                    this.updateBadgeCount();
                    return !inList;
                }
            } catch (err) {
                console.error('Error toggling server wishlist:', err);
            }
        }

        // Local Storage for guests
        let local = this.getLocalItems();
        const index = local.findIndex(p => Number(p.id) === prodId);
        let nowInList = false;

        if (index > -1) {
            local.splice(index, 1);
            this.showToast(window.I18n ? window.I18n.t('messages.removed_wishlist_alt', 'تمت إزالة المنتج من قائمة الرغبات') : 'تمت إزالة المنتج من قائمة الرغبات', 'info');
        } else {
            local.push({
                id: prodId,
                name: product.name || (window.I18n ? window.I18n.t('product.store_customer', 'منتج') : 'منتج'),
                price: Number(product.price || 0),
                stock: Number(product.stock !== undefined ? product.stock : 10),
                image_url: product.image_url || product.image || '/images/product-placeholder.jpg',
                category: product.category || product.category_name || (window.I18n ? window.I18n.t('categories.general', 'عام') : 'عام'),
                added_at: new Date().toISOString()
            });
            nowInList = true;
            this.showToast(window.I18n ? window.I18n.t('messages.added_wishlist_alt', 'تمت إضافة المنتج إلى قائمة الرغبات ❤️') : 'تمت إضافة المنتج إلى قائمة الرغبات ❤️', 'success');
        }

        this.saveLocalItems(local);
        return nowInList;
    },

    /**
     * فحص هل المنتج موجود في المفضلة
     */
    async isInWishlist(productId) {
        const prodId = Number(productId);
        if (this.isUserLoggedIn()) {
            try {
                const res = await fetch(`/api/wishlist/check/${prodId}`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    return Boolean(data.inWishlist);
                }
            } catch (e) {}
        }
        const local = this.getLocalItems();
        return local.some(p => Number(p.id) === prodId);
    },

    /**
     * إزالة منتج بالمعرف
     */
    async removeItem(productId) {
        const prodId = Number(productId);
        if (this.isUserLoggedIn()) {
            try {
                let csrfToken = '';
                try {
                    const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
                    if (csrfRes.ok) {
                        const csrfData = await csrfRes.json();
                        csrfToken = csrfData.csrfToken || '';
                    }
                } catch (e) {}

                const headers = { 'Content-Type': 'application/json' };
                if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

                await fetch(`/api/wishlist/${prodId}`, { 
                    method: 'DELETE', 
                    credentials: 'include',
                    headers
                });
            } catch (e) {}
        }
        let local = this.getLocalItems();
        local = local.filter(p => Number(p.id) !== prodId);
        this.saveLocalItems(local);
        this.updateBadgeCount();
    },

    /**
     * تحديث عداد الشارة في الهيدر
     */
    async updateBadgeCount() {
        const badges = document.querySelectorAll('.wishlist-count, #wishlist-count');

        let count = 0;
        if (this.isUserLoggedIn()) {
            try {
                const res = await fetch('/api/wishlist', { credentials: 'include' });
                if (res.ok) {
                    const items = await res.json();
                    count = items.length;
                } else {
                    if (res.status === 401) {
                        localStorage.removeItem('currentUser');
                        sessionStorage.removeItem('currentUser');
                    }
                    count = this.getLocalItems().length;
                }
            } catch (e) {
                count = this.getLocalItems().length;
            }
        } else {
            count = this.getLocalItems().length;
        }

        badges.forEach(b => {
            b.textContent = count;
            b.style.display = count > 0 ? '' : 'none';
        });

        // Synchronize heart button states in DOM
        const wishlistBtns = document.querySelectorAll('[data-wishlist-id], .product-wishlist');
        if (wishlistBtns.length > 0) {
            const local = this.getLocalItems().map(p => Number(p.id));
            wishlistBtns.forEach(btn => {
                const id = parseInt(btn.getAttribute('data-wishlist-id'), 10);
                const icon = btn.querySelector('i');
                if (id && local.includes(id)) {
                    btn.classList.add('active');
                    if (icon) icon.className = 'fas fa-heart text-danger';
                } else {
                    btn.classList.remove('active');
                    if (icon) icon.className = 'far fa-heart';
                }
            });
        }
    },

    showToast(message, type = 'success') {
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `notification ${type} show`;
        toast.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999; background:var(--primary-solid, #4f46e5); color:var(--bg-color, #fff); padding:12px 20px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-weight:bold;';
        if (type === 'info') toast.style.background = '#0284c7';
        if (type === 'error') toast.style.background = '#ef4444';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// Auto update badge on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.WishlistManager.updateBadgeCount();
});
