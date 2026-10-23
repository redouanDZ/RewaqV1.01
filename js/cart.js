/**
 * Client-Side Shopping Cart System
 */

var cart = window.cart || [];

document.addEventListener('DOMContentLoaded', function() {
    // If we are on cart.html, the specialized cart.html script handles the view
    if (window.location.pathname.endsWith('cart.html') || window.location.pathname.endsWith('/cart')) {
        return;
    }
    initCart();
    const savedPromo = getSavedPromoCode();
    if (savedPromo) updateOrderSummary();
});

async function initCart() {
    try {
        const savedCart = localStorage.getItem('cart');
        cart = savedCart ? JSON.parse(savedCart) : [];
        window.cart = cart;
        updateCartUI();
    } catch (error) {

        cart = [];
        window.cart = cart;
        updateCartUI();
    }
}

async function addToCart(product, quantity = 1) {
    if (!product || quantity <= 0) return false;

    const productId = product.id || product.product_id;
    if (!productId) return false;

    const variantId = product.variant_id || product.variantId || null;
    const cartKey = product.cartKey || (variantId ? `${productId}_v${variantId}` : String(productId));

    try {
        const existingIndex = cart.findIndex(item => {
            const itemKey = item.cartKey || (item.variant_id ? `${item.id}_v${item.variant_id}` : String(item.id));
            return itemKey === cartKey;
        });

        if (existingIndex !== -1) {
            const newQty = cart[existingIndex].quantity + quantity;
            if (newQty > 20) {
                showNotification(window.I18n.t('messages.cart_limit', 'لا يمكن إضافة أكثر من 20 قطعة من نفس المنتج'), 'error');
                return false;
            }
            cart[existingIndex].quantity = newQty;
            if (product.category || product.category_name) {
                cart[existingIndex].category = product.category || product.category_name;
            }
        } else {
            cart.push({ 
                cartKey: cartKey,
                id: productId, 
                variant_id: variantId,
                variantId: variantId,
                name: product.name || window.I18n.t('product.store_customer', 'منتج'), 
                category: product.category || product.category_name || '',
                price: Number(product.price) || 0, 
                image: product.image || product.image_url || '/images/product-placeholder.jpg', 
                image_url: product.image || product.image_url || '/images/product-placeholder.jpg', 
                quantity: quantity 
            });
        }

        window.cart = cart;
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartUI();
        
        showNotification(`تمت إضافة "${product.name || window.I18n.t('product.store_customer', 'المنتج')}" إلى سلة التسوق 🛒`, 'success');
        return true;
    } catch (error) {

        showNotification(window.I18n.t('messages.add_cart_error_2', 'حدث خطأ أثناء إضافة المنتج إلى عربة التسوق'), 'error');
        return false;
    }
}

async function updateCartItemQuantity(productIdOrKey, quantity) {
    if (quantity <= 0) { 
        removeFromCart(productIdOrKey); 
        return; 
    }
    if (quantity > 20) {
        showNotification(window.I18n.t('messages.qty_limit', 'لا يمكن أن تتجاوز الكمية 20 قطعة'), 'error');
        return;
    }

    try {
        const target = String(productIdOrKey);
        const index = cart.findIndex(item => String(item.cartKey || item.id) === target || String(item.id) === target);
        if (index !== -1) {
            cart[index].quantity = quantity;
            window.cart = cart;
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartUI();
        }
    } catch (error) {

        showNotification(window.I18n.t('messages.update_qty_error', 'حدث خطأ أثناء تحديث كمية المنتج'), 'error');
    }
}

async function removeFromCart(productIdOrKey) {
    try {
        const target = String(productIdOrKey);
        cart = cart.filter(item => String(item.cartKey || item.id) !== target && String(item.id) !== target);
        window.cart = cart;
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartUI();
        showNotification(window.I18n.t('messages.item_removed', 'تمت إزالة المنتج من السلة'), 'info');
    } catch (error) {

        showNotification(window.I18n.t('messages.remove_error', 'حدث خطأ أثناء إزالة المنتج من عربة التسوق'), 'error');
    }
}

function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCounts = document.querySelectorAll('.cart-count');
    cartCounts.forEach(el => {
        el.textContent = totalCount;
        el.style.display = totalCount > 0 ? '' : 'none';
    });

    const container = document.querySelector('.cart-items .products-grid');
    if (!container) return;
    
    container.innerHTML = '';
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart-state" style="text-align: center; padding: 50px 20px; background: white; border-radius: 16px; border: 1px solid var(--border-color); grid-column: 1 / -1;">
                <i class="fas fa-shopping-basket" style="font-size: 3rem; color: var(--light-text); margin-bottom: 15px;"></i>
                <h3 style="font-size: 1.25rem; margin-bottom: 10px; color: var(--dark-color);">${window.I18n.t('cart.empty_title', 'عربة التسوق فارغة حالياً')}</h3>
                <p style="color: var(--light-text); margin-bottom: 20px;">${window.I18n.t('cart.empty_desc', 'استكشف تشكيلتنا الواسعة وأضف منتجاتك المفضلة للسلة!')}</p>
                <a href="shop.html" class="btn btn-primary"><i class="fas fa-store"></i> ${window.I18n.t('cart.browse_shop', 'تصفح المنتجات')}</a>
            </div>
        `;
        updateOrderSummary(0);
        return;
    }

    cart.forEach(item => container.innerHTML += createCartItemHTML(item));
    initCartControls();
    updateOrderSummary();
}

function createCartItemHTML(item) {
    const safeName = window.escapeHtml ? window.escapeHtml(item.name) : item.name;
    const safeImg = window.escapeHtml ? window.escapeHtml(item.image || '/images/product-placeholder.jpg') : (item.image || '/images/product-placeholder.jpg');
    const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
    const priceNum = Number(item.price) || 0;
    const qtyNum = Number(item.quantity) || 1;
    const lineTotal = (priceNum * qtyNum).toLocaleString();
    return `
        <div class="cart-item" data-id="${item.id}">
            <div class="item-image"><img src="${safeImg}" alt="${safeName}" width="85" height="85" loading="lazy"></div>
            <div class="item-details">
                <h3>${safeName}</h3>
            </div>
            <div class="item-quantity">
                <button class="quantity-btn decrease" data-id="${item.id}">-</button>
                <input type="number" value="${qtyNum}" min="1" max="20" data-id="${item.id}">
                <button class="quantity-btn increase" data-id="${item.id}">+</button>
            </div>
            <div class="item-price-col">
                <div class="item-total">${lineTotal} ${currency}</div>
                <div class="item-unit-subtext" style="${qtyNum > 1 ? '' : 'display: none;'}"><bdi>${priceNum.toLocaleString()} ${currency}</bdi> × ${qtyNum}</div>
            </div>
            <button class="remove-item" data-id="${item.id}" title="${window.I18n.t('cart.remove_item', 'إزالة العنصر')}"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
}

function initCartControls() {
    document.querySelectorAll('.quantity-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id, 10);
            const isIncrease = this.classList.contains('increase');
            const item = cart.find(i => i.id === id);
            if (!item) return;
            const newQty = isIncrease ? Math.min(item.quantity + 1, 20) : Math.max(item.quantity - 1, 1);
            updateCartItemQuantity(id, newQty);
        });
    });

    document.querySelectorAll('.item-quantity input').forEach(input => {
        input.addEventListener('change', function() {
            const val = parseInt(this.value, 10);
            const id = parseInt(this.dataset.id, 10);
            if (!isNaN(val) && val > 0) {
                updateCartItemQuantity(id, val);
            }
        });
    });

    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id, 10);
            removeFromCart(id);
        });
    });
}

function updateOrderSummary(subtotal = null) {
    const summaryContainer = document.querySelector('.cart-summary');
    if (!summaryContainer) return;

    if (subtotal === null) subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingCost = subtotal > 50000 || subtotal === 0 ? 0 : 800;
    const savedPromo = getSavedPromoCode();
    const discount = savedPromo ? savedPromo.discount : 0;
    const discountAmount = subtotal * discount;
    const total = subtotal + shippingCost - discountAmount;

    summaryContainer.innerHTML = `
        <h2>${window.I18n.t('cart.summary', 'ملخص الطلب')}</h2>
        <div class="summary-item"><span>${window.I18n.t('cart.total_products', 'إجمالي المنتجات')}</span><span>${subtotal.toLocaleString()} ${window.I18n.t('common.currency', 'دج')}</span></div>
        <div class="summary-item"><span>${window.I18n.t('cart.shipping', 'الشحن والتوصيل')}</span><span>${shippingCost === 0 ? window.I18n.t('cart.free', 'مجاني') : shippingCost.toLocaleString() + ' دج'}</span></div>
        ${discount > 0 ? `<div class="summary-item discount" style="color: var(--success-color); font-weight: 700;"><span>${window.I18n.t('cart.discount_code', 'كود خصم').replace('{discount}', discount*100)}</span><span>-${discountAmount.toLocaleString()} ${window.I18n.t('common.currency', 'دج')}</span></div>` : ''}
        <div class="summary-total" style="font-size: 1.2rem; font-weight: 800; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px; display: flex; justify-content: space-between;"><span>${window.I18n.t('cart.total', 'المبلغ الإجمالي')}</span><span style="color: var(--primary-color);">${total.toLocaleString()} ${window.I18n.t('common.currency', 'دج')}</span></div>
        <div class="promo-code" style="margin: 15px 0; display: flex; gap: 8px;"><input type="text" placeholder="${window.I18n.t('cart.promo_placeholder', 'أدخل كود الخصم (مثل: SAVE10)')}" value="${savedPromo ? (window.escapeHtml ? window.escapeHtml(savedPromo.code) : savedPromo.code) : ''}" style="flex:1; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;"><button class="apply-promo btn btn-outline" style="padding: 10px 16px;">${window.I18n.t('cart.apply_promo', 'تطبيق')}</button></div>
        <button class="checkout-btn btn btn-primary w-full" style="width: 100%; margin-top: 10px; padding: 14px;"><i class="fas fa-credit-card"></i> ${window.I18n.t('cart.checkout_btn', 'إتمام الشراء')}</button>
        <a href="shop.html" class="continue-shopping" style="display: block; text-align: center; margin-top: 15px; color: var(--light-text);"><i class="fas fa-arrow-right"></i> ${window.I18n.t('cart.continue_shopping', 'متابعة التسوق')}</a>
    `;

    const promoInput = summaryContainer.querySelector('.promo-code input');
    const applyBtn = summaryContainer.querySelector('.apply-promo');
    if (applyBtn && promoInput) {
        applyBtn.addEventListener('click', () => applyPromoCode(promoInput.value.trim()));
    }

    const checkoutBtn = summaryContainer.querySelector('.checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showNotification(window.I18n.t('messages.cart_empty', 'عربة التسوق فارغة'), 'error');
            } else {
                window.location.href = 'checkout.html';
            }
        });
    }
}

async function applyPromoCode(code) {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) {
        localStorage.removeItem('promoCode');
        showNotification(window.I18n ? window.I18n.t('messages.promo_canceled', 'تم إلغاء كود الخصم') : 'تم إلغاء كود الخصم', 'info');
        updateOrderSummary();
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
        const response = await fetch('/api/coupons/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: cleanCode, orderAmount: subtotal })
        });
        const data = await response.json();

        if (response.ok && data.valid) {
            let discRate = 0;
            if (data.discountPercent > 0) {
                discRate = data.discountPercent / 100;
            } else if (data.calculatedDiscount > 0 && subtotal > 0) {
                discRate = data.calculatedDiscount / subtotal;
            } else {
                discRate = 0.1;
            }
            const savedPromo = {
                code: data.code || cleanCode,
                discount: discRate,
                calculatedDiscount: data.calculatedDiscount || Math.round(subtotal * discRate)
            };
            localStorage.setItem('promoCode', JSON.stringify(savedPromo));
            const msg = data.message || (window.I18n ? window.I18n.t('messages.promo_success', 'تم تطبيق الخصم بنجاح! ({discount}%)').replace('{discount}', Math.round(discRate * 100)) : 'تم تطبيق الخصم بنجاح!');
            showNotification(msg, 'success');
            updateOrderSummary();
        } else {
            localStorage.removeItem('promoCode');
            const errMsg = getErrorMessage(data, 'messages.promo_invalid');
            showNotification(errMsg, 'error');
            updateOrderSummary();
        }
    } catch (err) {
        console.error('Coupon validation error:', err);
        showNotification(window.I18n ? window.I18n.t('messages.server_error', 'خطأ في الاتصال بالخادم') : 'خطأ في الاتصال بالخادم', 'error');
    }
}

function getSavedPromoCode() {
    const saved = localStorage.getItem('promoCode');
    if (!saved) return null;
    try { return JSON.parse(saved); } catch { return null; }
}

function showNotification(message, type='success') {
    if (window.showToast) {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}

function clearCart() {
    cart = [];
    window.cart = cart;
    localStorage.removeItem('cart');
    localStorage.removeItem('promoCode');
    updateCartUI();
    const summaryContainer = document.querySelector('.cart-summary');
    if (summaryContainer) updateOrderSummary();
}

// Global Exports
window.cart = cart;
window.initCart = initCart;
window.addToCart = addToCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.updateCartUI = updateCartUI;

