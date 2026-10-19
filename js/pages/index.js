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
                const yieldToMain = () => new Promise(resolve => {
                    if (window.scheduler && typeof window.scheduler.yield === 'function') {
                        window.scheduler.yield().then(resolve);
                    } else {
                        setTimeout(resolve, 0);
                    }
                });

                const buildProductCardHtml = (p, wishlistIds, isOffer = false) => {
                    const isFav = wishlistIds.includes(p.id);
                    const safeName = window.escapeHtml ? window.escapeHtml(p.name) : p.name;
                    const hasDiscount = p.old_price && Number(p.old_price) > Number(p.price);
                    const discountPct = hasDiscount ? Math.round((1 - Number(p.price) / Number(p.old_price)) * 100) : null;
                    const cardClass = isOffer ? 'product-card offer-card' : 'product-card';
                    const cardId = isOffer ? `offer-card-${p.id}` : `product-card-${p.id}`;
                    const btnTextKey = isOffer ? 'product.order_now_offer' : 'product.add_to_cart';
                    const btnDefaultText = isOffer ? 'أضف للسلة الآن' : 'أضف للسلة';
                    const btnAria = window.escapeHtml ? window.escapeHtml(window.I18n ? window.I18n.t(btnTextKey, btnDefaultText) : btnDefaultText) : btnDefaultText;

                    return `
                    <div class="${cardClass}" id="${cardId}">
                        ${hasDiscount ? `<span class="product-badge">-${discountPct}%</span>` : ''}
                        <button type="button" class="product-wishlist ${isFav ? 'active' : ''}" data-wishlist-id="${p.id}" data-action="handleHomeToggleWishlist" data-id="${p.id}" data-i18n-title="common.wishlist" data-i18n-aria-label="common.wishlist" aria-label="المفضلة">
                            <i class="${isFav ? 'fas fa-heart text-danger' : 'far fa-heart'}"></i>
                        </button>
                        <a href="product.html?id=${p.id}" class="product-image">
                            <img src="${p.image_url || '/images/product-placeholder.jpg'}" srcset="${p.image_url || '/images/product-placeholder.jpg'} 1x, ${p.image_url || '/images/product-placeholder.jpg'} 2x" width="400" height="400" alt="${safeName}" loading="lazy" decoding="async">
                        </a>
                        <div class="product-info">
                            <h3 class="product-name">
                                <a href="product.html?id=${p.id}" title="${safeName}">${safeName}</a>
                            </h3>
                            <div class="product-price-row">
                                <div class="price-group">
                                    <span class="product-price">${Number(p.price).toLocaleString()} <small data-i18n="common.currency">دج</small></span>
                                    ${hasDiscount ? `<span class="product-old-price">${Number(p.old_price).toLocaleString()} <small data-i18n="common.currency">دج</small></span>` : ''}
                                </div>
                            </div>
                            <div class="product-card-actions">
                                <button type="button" data-action="quickAddToCart" data-id="${p.id}" aria-label="${btnAria} ${safeName}" class="btn btn-primary" ${p.stock <= 0 ? 'disabled' : ''}>
                                    <i class="fas fa-cart-plus"></i> <span data-i18n="${btnTextKey}">${btnDefaultText}</span>
                                </button>
                            </div>
                        </div>
                    </div>`;
                };

                if (featuredContainer && Array.isArray(products) && products.length > 0) {
                    const wishlistIds = window.getWishlist ? window.getWishlist() : [];
                    // Render first 4 products immediately to satisfy first contentful viewport
                    const initialBatch = products.slice(0, 4);
                    featuredContainer.innerHTML = initialBatch.map(p => buildProductCardHtml(p, wishlistIds, false)).join('');

                    if (products.length > 4) {
                        // Yield to main thread to prevent Long Tasks (TBT)
                        yieldToMain().then(() => {
                            const remaining = products.slice(4);
                            const fragment = document.createRange().createContextualFragment(remaining.map(p => buildProductCardHtml(p, wishlistIds, false)).join(''));
                            featuredContainer.appendChild(fragment);
                            if (window.I18n && window.I18n.currentLang !== 'ar') window.I18n.translatePage(featuredContainer);
                        });
                    }
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
                    yieldToMain().then(() => {
                        const wishlistIds = window.getWishlist ? window.getWishlist() : [];
                        offersContainer.innerHTML = discountedProducts.slice(0, 8).map(p => buildProductCardHtml(p, wishlistIds, true)).join('');
                        if (window.I18n && window.I18n.currentLang !== 'ar') window.I18n.translatePage(offersContainer);
                    });
                }
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

// Schedule loading of secondary interactive modules on idle or first interaction to minimize TBT
(function scheduleSecondaryModules() {
    let loaded = false;
    function loadModules() {
        if (loaded) return;
        loaded = true;
        ['js/user-system.js', 'js/cart.js', 'js/wishlist.js'].forEach(src => {
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
