/**
 * Rewaq - نظام إدارة الدفع والولايات والطلبات
 */

let allWilayas = [];
let selectedWilaya = null;
let currentDeliveryType = 'home';
let currentShippingCost = 500;

document.addEventListener('DOMContentLoaded', async function() {
    await loadWilayas();
    loadCartData();
    initPaymentMethodListeners();
    prefillCustomerInfo();
});

/**
 * جلب قائمة الولايات الـ 58 من API
 */
async function loadWilayas() {
    const select = document.getElementById('wilayaSelect');
    if (!select) return;

    try {
        const response = await fetch('/api/wilayas');
        if (!response.ok) throw new Error(window.I18n.t('messages.fetch_wilayas_error', 'فشل جلب الولايات'));
        allWilayas = await response.json();

        select.innerHTML = '<option value="">' + window.I18n.t('checkout.select_wilaya_58', '-- اختر ولايتك (58 ولاية) --') + '</option>';
        allWilayas.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = `${w.code} - ${w.name_ar} (${w.name_fr})`;
            select.appendChild(opt);
        });

        // Set default to Alger (16) or first
        const defaultWilaya = allWilayas.find(w => w.code === '16') || allWilayas[0];
        if (defaultWilaya) {
            select.value = defaultWilaya.id;
            onWilayaChange();
        }
    } catch (error) {
        console.error('Error loading wilayas:', error);
        select.innerHTML = '<option value="16">' + window.I18n.t('wilayas.algiers_16', '16 - الجزائر العاصمة (Alger)') + '</option>';
        currentShippingCost = 400;
        updateOrderSummary();
    }
}

/**
 * عند تغيير الولاية
 */
function onWilayaChange() {
    const select = document.getElementById('wilayaSelect');
    const wilayaId = Number(select.value);
    selectedWilaya = allWilayas.find(w => Number(w.id) === wilayaId) || null;

    if (selectedWilaya) {
        document.getElementById('homeDeliveryPriceLabel').textContent = `${window.I18n.t('checkout.price_prefix', 'السعر:')} ${selectedWilaya.home_delivery_price.toLocaleString()} ${window.I18n.t('common.currency', 'دج')} (${selectedWilaya.delivery_time_days})`;
        document.getElementById('deskDeliveryPriceLabel').textContent = `${window.I18n.t('checkout.price_prefix', 'السعر:')} ${selectedWilaya.desk_delivery_price.toLocaleString()} ${window.I18n.t('common.currency', 'دج')} (${selectedWilaya.delivery_time_days})`;
        
        currentShippingCost = currentDeliveryType === 'home' 
            ? selectedWilaya.home_delivery_price 
            : selectedWilaya.desk_delivery_price;
    } else {
        currentShippingCost = 500;
    }

    updateOrderSummary();
}

/**
 * عند تغيير نوع التوصيل (منزل / مكتب)
 */
function onDeliveryTypeChange() {
    const homeRadio = document.querySelector('input[name="delivery-type"][value="home"]');
    const deskRadio = document.querySelector('input[name="delivery-type"][value="desk"]');
    const homeCard = document.getElementById('deliveryCardHome');
    const deskCard = document.getElementById('deliveryCardDesk');

    if (homeRadio && homeRadio.checked) {
        currentDeliveryType = 'home';
        homeCard.classList.add('active');
        deskCard.classList.remove('active');
    } else {
        currentDeliveryType = 'desk';
        deskCard.classList.add('active');
        homeCard.classList.remove('active');
    }

    if (selectedWilaya) {
        currentShippingCost = currentDeliveryType === 'home' 
            ? selectedWilaya.home_delivery_price 
            : selectedWilaya.desk_delivery_price;
    }

    updateOrderSummary();
}

/**
 * تهيئة الاستماع لطرق الدفع
 */
function initPaymentMethodListeners() {
    const radios = document.querySelectorAll('input[name="payment-method"]');
    const bankDetails = document.getElementById('bank-transfer-details');

    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('active'));
            this.closest('.payment-option').classList.add('active');

            if (bankDetails) {
                bankDetails.style.display = this.value === 'bank-transfer' ? 'block' : 'none';
            }
        });
    });
}

/**
 * التنقل بين الخطوات
 */
function goToShippingStep() {
    switchStep(1);
}

function proceedToPayment() {
    const fullname = document.getElementById('fullname').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const wilaya = document.getElementById('wilayaSelect').value;

    if (!fullname) { showNotification(window.I18n.t('messages.enter_full_name', 'يرجى إدخال الاسم الكامل'), 'error'); return; }
    if (!phone || phone.length < 8) { showNotification(window.I18n.t('messages.enter_valid_phone', 'يرجى إدخال رقم هاتف صحيح'), 'error'); return; }
    if (!wilaya) { showNotification(window.I18n.t('messages.select_wilaya', 'يرجى اختيار الولاية'), 'error'); return; }
    if (!address) { showNotification(window.I18n.t('messages.enter_address', 'يرجى إدخال العنوان بالتفصيل'), 'error'); return; }

    switchStep(2);
}

function goToPaymentStep() {
    switchStep(2);
}

function proceedToReview() {
    renderReviewItems();
    updateOrderSummary();
    switchStep(3);
}

function switchStep(stepNumber) {
    document.querySelectorAll('.checkout-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.checkout-steps .step').forEach(el => el.classList.remove('active'));

    if (stepNumber === 1) {
        document.getElementById('shipping-info').classList.add('active');
        document.getElementById('stepIndicator1').classList.add('active');
    } else if (stepNumber === 2) {
        document.getElementById('payment-method').classList.add('active');
        document.getElementById('stepIndicator2').classList.add('active');
    } else if (stepNumber === 3) {
        document.getElementById('order-review').classList.add('active');
        document.getElementById('stepIndicator3').classList.add('active');
    }
}

/**
 * تحميل السلة وتحديث الملخص
 */
function loadCartData() {
    const saved = localStorage.getItem('cart');
    let cart = [];
    try { cart = saved ? JSON.parse(saved) : []; } catch (e) { cart = []; }

    if (cart.length === 0) {
        showNotification(window.I18n.t('messages.cart_empty_redirect', 'عربة التسوق فارغة، جاري تحويلك للمتجر...'), 'error');
        setTimeout(() => { window.location.href = 'shop.html'; }, 1500);
        return;
    }

    updateOrderSummary();
}

function renderReviewItems() {
    const container = document.getElementById('reviewOrderItems');
    if (!container) return;

    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}

    container.innerHTML = cart.map((item, index) => {
        const safeName = window.escapeHtml ? window.escapeHtml(item.name) : item.name;
        const safeImg = window.escapeHtml ? window.escapeHtml(item.image || item.image_url || '/images/product-placeholder.jpg') : (item.image || item.image_url || '/images/product-placeholder.jpg');
        return `
        <div class="order-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 10px;">
                <img ${index === 0 ? '' : 'loading="lazy"'} src="${safeImg}" alt="${safeName}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">
                <div>
                    <strong style="display: block; font-size: 0.95rem; color: var(--text-color);">${safeName}</strong>
                    <span style="font-size: 0.85rem; color: var(--light-text);">${window.I18n.t('cart.item_qty', 'الكمية: {qty}').replace('{qty}', item.quantity)}</span>
                </div>
            </div>
            <strong style="color: var(--primary-color);">${(Number(item.price) * Number(item.quantity)).toLocaleString()} ${window.I18n.t('common.currency', 'دج')}</strong>
        </div>
    `;}).join('');
}

function updateOrderSummary() {
    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}

    const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const wilayaName = selectedWilaya ? selectedWilaya.name_ar : window.I18n.t('checkout.wilaya_fallback', 'الولاية');
    
    // Promo discount if applicable
    const promo = getSavedPromo();
    let discount = 0;
    if (promo) {
        if (promo.discountPercent && promo.discountPercent > 0) {
            discount = Math.round((subtotal * promo.discountPercent) / 100);
        } else if (promo.discountAmount && promo.discountAmount > 0) {
            discount = Math.min(subtotal, Math.round(promo.discountAmount));
        } else if (promo.calculatedDiscount && promo.calculatedDiscount > 0) {
            discount = Math.min(subtotal, promo.calculatedDiscount);
        } else if (promo.discount && promo.discount > 0) {
            discount = Math.round(subtotal * promo.discount);
        }
    }
    const grandTotal = Math.max(0, subtotal + currentShippingCost - discount);

    const subtotalEl = document.getElementById('reviewSubtotal');
    const shippingEl = document.getElementById('reviewShippingCost');
    const wilayaNameEl = document.getElementById('reviewWilayaName');
    const grandTotalEl = document.getElementById('reviewGrandTotal');
    const discountRow = document.getElementById('reviewDiscountRow');
    const discountEl = document.getElementById('reviewDiscount');

    if (subtotalEl) subtotalEl.textContent = `${subtotal.toLocaleString()} ${window.I18n.t('common.currency', 'دج')}`;
    if (shippingEl) shippingEl.textContent = `${currentShippingCost.toLocaleString()} ${window.I18n.t('common.currency', 'دج')}`;
    if (wilayaNameEl) wilayaNameEl.textContent = wilayaName;
    if (grandTotalEl) grandTotalEl.textContent = `${grandTotal.toLocaleString()} ${window.I18n.t('common.currency', 'دج')}`;

    if (discount > 0 && discountRow && discountEl) {
        discountRow.style.display = 'flex';
        discountEl.textContent = `-${discount.toLocaleString()} ${window.I18n.t('common.currency', 'دج')}`;
    } else if (discountRow) {
        discountRow.style.display = 'none';
    }
}

function getSavedPromo() {
    try {
        const p = localStorage.getItem('promoCode');
        return p ? JSON.parse(p) : null;
    } catch (e) {
        return null;
    }
}

/**
 * إرسال وإنشاء الطلب
 */
async function placeOrderNow() {
    const terms = document.getElementById('terms');
    if (terms && !terms.checked) {
        showNotification(window.I18n.t('messages.agree_tos', 'يرجى الموافقة على شروط الخدمة لتأكيد الطلب'), 'error');
        return;
    }

    if (!navigator.onLine) {
        showNotification(window.I18n.t('messages.offline_error', 'عذراً، أنت غير متصل بالإنترنت حالياً. يلزم توفر اتصال فعلي لتأكيد الطلب والدفع.'), 'error');
        return;
    }

    const btn = document.getElementById('confirmOrderBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + window.I18n.t('messages.confirming_order_full', 'جاري تأكيد وتسجيل الطلب...');
    }

    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
    if (cart.length === 0) {
        showNotification(window.I18n.t('messages.cart_empty', 'السلة فارغة!'), 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '' + window.I18n.t('checkout.final_confirm', 'تأكيد الطلب نهائياً') + ' <i class="fas fa-check"></i>';
        }
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const promo = getSavedPromo();
    const discount = promo ? (promo.calculatedDiscount && promo.calculatedDiscount > 0 ? Math.min(subtotal, promo.calculatedDiscount) : (promo.discount ? Math.round(subtotal * promo.discount) : 0)) : 0;
    const grandTotal = Math.max(0, subtotal + currentShippingCost - discount);

    const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'cod';
    const fullname = document.getElementById('fullname').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const address = document.getElementById('address').value.trim();
    const notes = document.getElementById('notes').value.trim();

    // Check if user is logged in
    let currentUser = null;
    try { currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) {}

    const orderPayload = {
        userId: currentUser && currentUser.id ? currentUser.id : null,
        paymentMethod: paymentMethod,
        couponCode: promo ? promo.code : null,
        discountAmount: discount,
        total: grandTotal,
        cart: cart.map(item => ({
            id: item.product_id || item.id,
            name: item.name,
            price: Number(item.price),
            quantity: Number(item.quantity),
            image_url: item.image || item.image_url || '/images/product-placeholder.jpg'
        })),
        shippingInfo: {
            fullName: fullname,
            phone: phone,
            email: email,
            address: address,
            city: selectedWilaya ? selectedWilaya.name_ar : window.I18n.t('wilayas.algiers', 'الجزائر'),
            wilayaId: selectedWilaya ? selectedWilaya.id : 16,
            wilayaName: selectedWilaya ? selectedWilaya.name_ar : window.I18n.t('checkout.algiers_fallback', 'الجزائر العاصمة'),
            deliveryType: currentDeliveryType,
            shippingCost: currentShippingCost,
            paymentMethod: paymentMethod,
            couponCode: promo ? promo.code : null,
            notes: notes
        }
    };

    try {
        const headers = { 'Content-Type': 'application/json' };

        try {
            const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
            if (csrfRes.ok) {
                const csrfData = await csrfRes.json();
                if (csrfData && csrfData.csrfToken) {
                    headers['X-CSRF-Token'] = csrfData.csrfToken;
                }
            }
        } catch (e) {}

        const response = await fetch('/api/orders', {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify(orderPayload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(getErrorMessage(data, 'messages.create_order_fail'));
        }

        const orderId = data.id;
        const orderNumber = data.orderNumber || `DZ-${orderId}`;
        const trackingToken = data.trackingToken || '';

        // Clear cart
        localStorage.removeItem('cart');
        localStorage.removeItem('promoCode');
        localStorage.setItem('lastOrderId', orderId);
        localStorage.setItem('lastOrderPhone', phone);
        localStorage.setItem('lastOrderToken', trackingToken);

        // If Chargily Pay selected: Redirect to payment gateway
        if (paymentMethod === 'chargily') {
            try {
                const payHeaders = { 'Content-Type': 'application/json' };
                if (trackingToken) payHeaders['X-Tracking-Token'] = trackingToken;

                const payRes = await fetch('/api/payments/chargily/checkout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: payHeaders,
                    body: JSON.stringify({ 
                        orderId,
                        token: trackingToken,
                        phone
                    })
                });
                const payData = await payRes.json();
                if (payRes.ok && payData.checkoutUrl) {
                    window.location.href = payData.checkoutUrl;
                    return;
                } else if (!payRes.ok) {
                    console.error('Chargily checkout creation failed:', payData.error);
                }
            } catch (payErr) {
                console.error('Chargily redirect error:', payErr);
            }
        }

        // Direct Confirmation
        window.location.href = `order-confirmation.html?id=${orderId}&token=${trackingToken}&phone=${encodeURIComponent(phone)}`;
    } catch (error) {
        showNotification(getErrorMessage(error, 'messages.create_order_fail'), 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> ' + window.I18n.t('checkout.confirm_btn', 'تأكيد الطلب الآن');
        }
    }
}

function prefillCustomerInfo() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (user) {
            if (user.username && document.getElementById('fullname')) document.getElementById('fullname').value = user.username;
            if (user.phone && document.getElementById('phone')) document.getElementById('phone').value = user.phone;
            if (user.email && document.getElementById('email')) document.getElementById('email').value = user.email;
        }
    } catch (e) {}
}

function showNotification(message, type = 'success') {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 300);
    }, 3500);
}

document.addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (typeof window[action] === 'function') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try { args = actionEl.dataset.args.split(',').map(s=>s.trim().replace(/^['"]|['"]$/g, '')); } catch(e){}
        }
        window[action](...args);
    }
});
document.addEventListener('change', e => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (typeof window[action] === 'function') window[action]();
});
