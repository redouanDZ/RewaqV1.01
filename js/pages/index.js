let homeProductsList = [];

        function renderStars(rating) {
            const r = Number(rating) || 5;
            let html = '';
            for (let i = 1; i <= 5; i++) {
                if (r >= i) {
                    html += '<i class="fas fa-star" aria-hidden="true"></i>';
                } else if (r >= i - 0.5) {
                    html += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
                } else {
                    html += '<i class="far fa-star" aria-hidden="true"></i>';
                }
            }
            return html;
        }

        function getStockBadge(stock) {
            const stockNum = Number(stock) || 0;
            if (stockNum <= 0) {
                return `<span class="product-stock-note is-out"><i class="fas fa-times-circle"></i> ${window.I18n ? window.I18n.t('product.out_of_stock', 'نفد المخزون') : 'نفد المخزون'}</span>`;
            }
            if (stockNum <= 5) {
                return `<span class="product-stock-note is-low"><i class="fas fa-fire-alt"></i> ${window.I18n ? window.I18n.t('product.few_left', 'متبقي {count} قطع فقط! ⚡').replace('{count}', stockNum) : `متبقي ${stockNum} قطع فقط! ⚡`}</span>`;
            }
            return `<span class="product-stock-note"><i class="fas fa-check-circle" style="color:var(--success-color, #10b981);"></i> ${window.I18n ? window.I18n.t('common.in_stock', 'متوفر في المخزون') : 'متوفر في المخزون'}</span>`;
        }

        async function loadHomeProducts() {
            try {
                const response = await fetch('/api/products');
                if (!response.ok) return;
                const data = await response.json();
                const products = Array.isArray(data) ? data : (Array.isArray(data && data.products) ? data.products : []);
                homeProductsList = products;
                
                const featuredContainer = document.getElementById('featured-products');
                const offersContainer = document.getElementById('special-offers');

                if (featuredContainer && Array.isArray(products) && products.length > 0) {
                    const wishlistIds = window.getWishlist ? window.getWishlist() : [];
                    featuredContainer.innerHTML = products.map(p => {
                        const isFav = wishlistIds.includes(p.id);
                        const safeName = window.escapeHtml ? window.escapeHtml(p.name) : p.name;
                        const safeCat = window.escapeHtml ? window.escapeHtml(p.category || 'عام') : (p.category || 'عام');
                        const hasDiscount = p.old_price && Number(p.old_price) > Number(p.price);
                        const discountPct = hasDiscount ? Math.round((1 - Number(p.price) / Number(p.old_price)) * 100) : null;
                        return `
                        <div class="product-card" id="product-card-${p.id}">
                            ${hasDiscount ? `<span class="product-badge">-${discountPct}%</span>` : ''}
                            <button type="button" class="product-wishlist ${isFav ? 'active' : ''}" data-wishlist-id="${p.id}" data-action="handleHomeToggleWishlist" data-id="${p.id}" data-i18n-title="common.wishlist" data-i18n-aria-label="common.wishlist" aria-label="المفضلة">
                                <i class="${isFav ? 'fas fa-heart text-danger' : 'far fa-heart'}"></i>
                            </button>
                            <a href="product.html?id=${p.id}" class="product-image">
                                <img src="${p.image_url || '/images/product-placeholder.jpg'}" srcset="${p.image_url || '/images/product-placeholder.jpg'} 1x, ${p.image_url || '/images/product-placeholder.jpg'} 2x" width="400" height="400" alt="${safeName}" loading="lazy">
                            </a>
                            <div class="product-info">
                                <span class="product-category">${safeCat}</span>
                                <h3 class="product-name">
                                    <a href="product.html?id=${p.id}" title="${safeName}">${safeName}</a>
                                </h3>
                                <div class="product-rating">
                                    <div class="rating-stars" aria-label="${Number(p.rating || 5).toFixed(1)} من 5 نجوم" title="${Number(p.rating || 5).toFixed(1)} من 5 نجوم">
                                        ${renderStars(p.rating)}
                                    </div>
                                    <span class="rating-count">(${Number(p.rating || 5).toFixed(1)})</span>
                                </div>
                                <div class="product-price-row">
                                    <div class="price-group">
                                        <span class="product-price">${Number(p.price).toLocaleString()} <small data-i18n="common.currency">دج</small></span>
                                        ${hasDiscount ? `<span class="product-old-price">${Number(p.old_price).toLocaleString()} <small data-i18n="common.currency">دج</small></span>` : ''}
                                    </div>
                                    ${getStockBadge(p.stock)}
                                </div>
                                <div class="product-card-actions">
                                    <button type="button" data-action="quickAddToCart" data-id="${p.id}" aria-label="${window.escapeHtml ? window.escapeHtml(window.I18n.t('product.add_to_cart', 'أضف للسلة')) : 'أضف للسلة'} ${safeName}" class="btn btn-primary" ${p.stock <= 0 ? 'disabled' : ''}>
                                        <i class="fas fa-cart-plus"></i> <span data-i18n="product.add_to_cart">أضف للسلة</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `}).join('');
                }

                const discountedProducts = products.filter(p => p.old_price && Number(p.old_price) > Number(p.price));
                const offersSection = offersContainer ? offersContainer.closest('.special-offers') : null;

                if (offersSection) {
                    if (discountedProducts.length < 2) {
                        offersSection.style.display = 'none';
                    } else {
                        offersSection.style.display = '';
                    }
                }

                if (offersContainer && discountedProducts.length >= 2) {
                    const wishlistIds = window.getWishlist ? window.getWishlist() : [];
                    offersContainer.innerHTML = discountedProducts.slice(0, 8).map(p => {
                        const isFav = wishlistIds.includes(p.id);
                        const safeName = window.escapeHtml ? window.escapeHtml(p.name) : p.name;
                        const safeCat = window.escapeHtml ? window.escapeHtml(p.category || 'عرض خاص') : (p.category || 'عرض خاص');
                        const discountPct = Math.round((1 - Number(p.price) / Number(p.old_price)) * 100);
                        return `
                        <div class="product-card offer-card" id="offer-card-${p.id}">
                            <span class="product-badge">-${discountPct}%</span>
                            <button type="button" class="product-wishlist ${isFav ? 'active' : ''}" data-wishlist-id="${p.id}" data-action="handleHomeToggleWishlist" data-id="${p.id}" data-i18n-title="common.wishlist" data-i18n-aria-label="common.wishlist" aria-label="المفضلة">
                                <i class="${isFav ? 'fas fa-heart text-danger' : 'far fa-heart'}"></i>
                            </button>
                            <a href="product.html?id=${p.id}" class="product-image">
                                <img src="${p.image_url || '/images/product-placeholder.jpg'}" srcset="${p.image_url || '/images/product-placeholder.jpg'} 1x, ${p.image_url || '/images/product-placeholder.jpg'} 2x" width="400" height="400" alt="${safeName}" loading="lazy">
                            </a>
                            <div class="product-info">
                                <span class="product-category">${safeCat}</span>
                                <h3 class="product-name">
                                    <a href="product.html?id=${p.id}" title="${safeName}">${safeName}</a>
                                </h3>
                                <div class="product-rating">
                                    <div class="rating-stars" aria-label="${Number(p.rating || 5).toFixed(1)} من 5 نجوم" title="${Number(p.rating || 5).toFixed(1)} من 5 نجوم">
                                        ${renderStars(p.rating)}
                                    </div>
                                    <span class="rating-count">(${Number(p.rating || 5).toFixed(1)})</span>
                                </div>
                                <div class="product-price-row">
                                    <div class="price-group">
                                        <span class="product-price">${Number(p.price).toLocaleString()} <small data-i18n="common.currency">دج</small></span>
                                        <span class="product-old-price">${Number(p.old_price).toLocaleString()} <small data-i18n="common.currency">دج</small></span>
                                    </div>
                                    ${getStockBadge(p.stock)}
                                </div>
                                <div class="product-card-actions">
                                    <button type="button" data-action="quickAddToCart" data-id="${p.id}" class="btn btn-primary" ${p.stock <= 0 ? 'disabled' : ''}>
                                        <i class="fas fa-cart-plus"></i> <span data-i18n="product.order_now_offer">أضف للسلة الآن</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `}).join('');
                }
                if (window.I18n) window.I18n.translatePage();
            } catch (error) {
                // Silent error handling
            }
        }

        async function handleHomeToggleWishlist(id) {
            const p = homeProductsList.find(item => Number(item.id) === Number(id));
            if (p) {
                if (window.toggleWishlist) {
                    await window.toggleWishlist(p.id, p);
                } else if (window.WishlistManager) {
                    await window.WishlistManager.toggleItem(p);
                }
            }
        }

        async function quickAddToCart(productId) {
            try {
                const response = await fetch(`/api/products/${productId}`);
                if (response.ok) {
                    const product = await response.json();
                    if (window.addToCart) {
                        await window.addToCart(product, 1);
                    } else if (window.showToast) {
                        window.showToast(window.I18n.t('messages.add_cart_success', 'تمت إضافة المنتج إلى السلة بنجاح! 🛒'), 'success');
                    }
                }
            } catch (err) {
                if (window.showToast) {
                    window.showToast(window.I18n.t('messages.add_cart_error', 'حدث خطأ أثناء إضافة المنتج'), 'error');
                }
            }
        }

        function initCountdownTimer() {
            const daysEl = document.getElementById('deal-days');
            const hoursEl = document.getElementById('deal-hours');
            const minutesEl = document.getElementById('deal-minutes');
            const secondsEl = document.getElementById('deal-seconds');
            if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

            let totalSeconds = 2 * 86400 + 14 * 3600 + 35 * 60 + 20;

            function update() {
                if (totalSeconds > 0) totalSeconds--;
                const d = Math.floor(totalSeconds / 86400);
                const h = Math.floor((totalSeconds % 86400) / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = totalSeconds % 60;
                daysEl.textContent = String(d).padStart(2, '0');
                hoursEl.textContent = String(h).padStart(2, '0');
                minutesEl.textContent = String(m).padStart(2, '0');
                secondsEl.textContent = String(s).padStart(2, '0');
            }

            setInterval(update, 1000);
        }

        document.addEventListener('DOMContentLoaded', () => {
            loadHomeProducts();
            initCountdownTimer();
        });

// Event Delegation
document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    
    const action = actionEl.dataset.action;
    if (action === 'handleHomeToggleWishlist') {
        e.preventDefault();
        window.handleHomeToggleWishlist(Number(actionEl.dataset.id));
    } else if (action === 'quickAddToCart') {
        e.preventDefault();
        window.quickAddToCart(Number(actionEl.dataset.id));
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
window.handleHomeToggleWishlist = handleHomeToggleWishlist;
window.quickAddToCart = quickAddToCart;
window.loadHomeProducts = loadHomeProducts;
