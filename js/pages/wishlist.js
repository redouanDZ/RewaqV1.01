
let wishlistProducts = [];

function transformProductImage(url) {
    if (!url) return '/images/product-placeholder.jpg';
    if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/w_')) {
        return url.replace('/upload/', '/upload/w_400,h_400,c_fill,f_auto,q_auto/');
    }
    return url;
}

async function renderWishlist() {
    const container = document.getElementById('wishlistContainer');
    const headerCount = document.getElementById('wishlistHeaderCount');

    // Ensure dictionary is loaded only if current language is not Arabic
    if (window.I18n && typeof window.I18n.loadDictionary === 'function' && window.I18n.currentLang !== 'ar') {
        await window.I18n.loadDictionary(window.I18n.currentLang);
    }

    wishlistProducts = await window.WishlistManager.getItems();

    const countText = window.I18n ? window.I18n.t('wishlist.products_count', 'منتجات') : 'منتجات';
    if (headerCount) {
        headerCount.innerHTML = `<span id="wishlistCountNum">${wishlistProducts.length}</span> <span data-i18n="wishlist.products_count">${countText}</span>`;
    }

    if (!wishlistProducts.length) {
        const emptyTitle = window.I18n ? window.I18n.t('wishlist.empty_title', 'قائمة الرغبات فارغة') : 'قائمة الرغبات فارغة';
        const emptyMsg = window.I18n ? window.I18n.t('wishlist.empty_msg_alt', 'لم تقم بحفظ أي منتجات في المفضلة بعد. استكشف متجرنا وأضف المنتجات التي تنال إعجابك!') : 'لم تقم بحفظ أي منتجات في المفضلة بعد. استكشف متجرنا وأضف المنتجات التي تنال إعجابك!';
        const emptyBtn = window.I18n ? window.I18n.t('wishlist.empty_btn', 'تصفح المنتجات الآن') : 'تصفح المنتجات الآن';

        container.innerHTML = `
            <div class="empty-wishlist">
                <i class="far fa-heart"></i>
                <h3><span data-i18n="wishlist.empty_title">${emptyTitle}</span></h3>
                <p><span data-i18n="wishlist.empty_msg_alt">${emptyMsg}</span></p>
                <a href="shop.html" class="btn-explore"><i class="fas fa-shopping-bag"></i> <span data-i18n="wishlist.empty_btn">${emptyBtn}</span></a>
            </div>
        `;
        if (window.I18n && typeof window.I18n.translatePage === 'function' && window.I18n.currentLang !== 'ar') {
            window.I18n.translatePage(container);
        }
        return;
    }

    const currencyText = window.I18n ? window.I18n.t("common.currency", "دج") : "دج";
    const removeTitle = window.I18n ? window.I18n.t("wishlist.remove_btn", "حذف من المفضلة") : "حذف من المفضلة";
    const generalCat = window.I18n ? window.I18n.t('categories.general', 'عام') : 'عام';
    const outOfStockText = window.I18n ? window.I18n.t('product.out_of_stock', 'نفد المخزون') : 'نفد المخزون';
    const addToCartText = window.I18n ? window.I18n.t('product.add_to_cart', 'أضف للسلة') : 'أضف للسلة';

    container.innerHTML = `
        <div class="wishlist-grid">
            ${wishlistProducts.map((p, index) => {
                const isOutOfStock = Number(p.stock) === 0;
                const safeName = window.escapeHtml ? window.escapeHtml(p.name) : p.name;
                const safeCat = window.escapeHtml ? window.escapeHtml(p.category || generalCat) : (p.category || generalCat);
                const optimizedImg = transformProductImage(p.image_url || p.image);
                return `
                    <div class="wishlist-card" id="wishlist-card-${p.id}">
                        <div class="card-img-wrapper">
                            <img ${index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="300" height="300" src="${optimizedImg}" alt="${safeName}">
                            <button class="btn-remove-wishlist" data-action="removeItem" data-args="${p.id}" data-i18n-title="wishlist.remove_btn" title="${removeTitle}" aria-label="${removeTitle}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="card-body">
                            <span class="card-category">${safeCat}</span>
                            <a href="product.html?id=${p.id}" style="text-decoration: none;">
                                <h3 class="card-title">${safeName}</h3>
                            </a>
                            <div class="card-price">${Number(p.price).toLocaleString()} <span data-i18n="common.currency">${currencyText}</span></div>
                            <div class="card-actions">
                                <button class="btn-add-cart-card" ${isOutOfStock ? 'disabled' : ''} data-action="addToCartFromWishlist" data-args="${p.id}">
                                    <i class="fas fa-cart-plus"></i> <span data-i18n="${isOutOfStock ? 'product.out_of_stock' : 'product.add_to_cart'}">${isOutOfStock ? outOfStockText : addToCartText}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    if (window.I18n && typeof window.I18n.translatePage === 'function' && window.I18n.currentLang !== 'ar') {
        window.I18n.translatePage(container);
    }
}

        async function removeItem(productId) {
            await window.WishlistManager.removeItem(productId);
            renderWishlist();
        }

        async function addToCartFromWishlist(id) {
            const p = wishlistProducts.find(item => Number(item.id) === Number(id));
            if (!p) return;

            if (window.addToCart) {
                await window.addToCart(p, 1);
            } else {
                let cart = JSON.parse(localStorage.getItem('cart') || '[]');
                const existing = cart.find(item => item.id === id);
                if (existing) {
                    existing.quantity += 1;
                } else {
                    cart.push({ id: p.id, name: p.name, price: p.price, quantity: 1, image: p.image_url || p.image });
                }
                localStorage.setItem('cart', JSON.stringify(cart));
                if (window.showToast) window.showToast(window.I18n ? window.I18n.t('messages.add_cart_success', 'تمت إضافة المنتج إلى سلة التسوق 🛒') : 'تمت إضافة المنتج إلى سلة التسوق 🛒', 'success');
            }
        }

        document.addEventListener('DOMContentLoaded', renderWishlist);
        document.addEventListener('languageChanged', renderWishlist);
    

// Event Delegation
document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'removeItem') {
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
        if (typeof window.removeItem === 'function') window.removeItem(...args);
    }
    if (action === 'addToCartFromWishlist') {
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
        if (typeof window.addToCartFromWishlist === 'function') window.addToCartFromWishlist(...args);
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

// Expose functions to window
window.renderWishlist = renderWishlist;
window.removeItem = removeItem;
window.addToCartFromWishlist = addToCartFromWishlist;

// Schedule loading of secondary interactive modules on idle or first interaction to minimize TBT
(function scheduleSecondaryModules() {
    let loaded = false;
    function loadModules() {
        if (loaded) return;
        loaded = true;
        ['js/user-system.js', 'js/cart.js'].forEach(src => {
            const s = document.createElement('script');
            s.src = src;
            s.defer = true;
            document.body.appendChild(s);
        });
    }

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadModules, { timeout: 2000 });
    } else {
        setTimeout(loadModules, 600);
    }

    ['touchstart', 'mouseover', 'scroll', 'click', 'keydown'].forEach(evt => {
        window.addEventListener(evt, loadModules, { once: true, passive: true });
    });
})();
