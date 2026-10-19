/**
 * js/pages/cart.js
 * Shopping Cart Page Logic & Interactions
 */

let cartItems = [];
let appliedPromo = getSavedPromo();

function getSavedPromo() {
  try {
    const p = localStorage.getItem('promoCode');
    return p ? JSON.parse(p) : null;
  } catch (e) {
    return null;
  }
}

function calculateDiscount(promo, subtotal) {
  if (!promo || subtotal <= 0) return 0;
  if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
    return 0;
  }
  if (promo.discountPercent && promo.discountPercent > 0) {
    return Math.round((subtotal * promo.discountPercent) / 100);
  }
  if (promo.discountAmount && promo.discountAmount > 0) {
    return Math.min(subtotal, Math.round(promo.discountAmount));
  }
  if (promo.discount && promo.discount > 0) {
    return Math.round(subtotal * promo.discount);
  }
  if (promo.calculatedDiscount && promo.calculatedDiscount > 0) {
    return Math.min(subtotal, promo.calculatedDiscount);
  }
  return 0;
}

// تحميل السلة من التخزين المحلي والـ API مع الدمج المتكامل
async function loadCart() {
  appliedPromo = getSavedPromo();

  // 1. تحميل السلة المحلية
  loadCartFromLocalStorage();

  // 2. إذا كان المستخدم مسجلاً، جلب سلة الحساب ومزامنتها
  const currentUser = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
  if (currentUser) {
    try {
      const response = await fetch('/api/cart', { credentials: 'include' });
      if (response.ok) {
        const apiItems = await response.json();
        if (Array.isArray(apiItems) && apiItems.length > 0) {
          const remoteMapped = apiItems.map(item => ({
            id: item.product_id || item.id,
            cart_item_id: item.id,
            product_id: item.product_id || item.id,
            variant_id: item.variant_id || null,
            cartKey: item.variant_id ? `${item.product_id || item.id}_v${item.variant_id}` : String(item.product_id || item.id),
            name: item.name || (window.I18n ? window.I18n.t('product.store_customer', 'منتج') : 'منتج'),
            category: item.category || item.category_name || '',
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            image_url: item.image_url || item.image || '/images/product-placeholder.jpg'
          }));

          const merged = [...remoteMapped];
          cartItems.forEach(localItem => {
            const exists = merged.some(r => String(r.cartKey || r.id) === String(localItem.cartKey || localItem.id));
            if (!exists) {
              merged.push(localItem);
            }
          });

          cartItems = merged;
          saveCartToLocalStorage();
        }
      }
    } catch (error) {
      console.warn('Could not fetch remote cart, using local cart:', error);
    }
  }

  saveCartToLocalStorage();
  renderCart();
  updateSummary();
  updateHeaderCount();
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => syncCartProductsMetadata(), { timeout: 3000 });
  } else {
    setTimeout(() => syncCartProductsMetadata(), 1200);
  }
}

function transformCartImage(url) {
  if (!url) return '/images/product-placeholder.jpg';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_180,h_180,c_fill,f_auto,q_auto/');
  }
  return url;
}

function loadCartFromLocalStorage() {
  const saved = localStorage.getItem('cart');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        cartItems = parsed.map(item => ({
          id: item.product_id || item.id,
          cart_item_id: item.cart_item_id || null,
          product_id: item.product_id || item.id,
          variant_id: item.variant_id || item.variantId || null,
          cartKey: item.cartKey || (item.variant_id ? `${item.product_id || item.id}_v${item.variant_id}` : String(item.product_id || item.id)),
          name: item.name || (window.I18n ? window.I18n.t('product.store_customer', 'منتج') : 'منتج'),
          category: item.category || item.category_name || '',
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          image_url: item.image_url || item.image || '/images/product-placeholder.jpg'
        }));
      } else {
        cartItems = [];
      }
    } catch (e) {
      cartItems = [];
    }
  } else {
    cartItems = [];
  }
}

async function syncCartProductsMetadata() {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return;
  let hasUpdates = false;
  await Promise.all(cartItems.map(async (item) => {
    const prodId = item.product_id || item.id;
    if (!prodId) return;
    try {
      const res = await fetch(`/api/products/${prodId}`);
      if (res.ok) {
        const prod = await res.json();
        if (prod) {
          if (prod.category && item.category !== prod.category) {
            item.category = prod.category;
            hasUpdates = true;
          }
          if (prod.name && item.name !== prod.name) {
            item.name = prod.name;
            hasUpdates = true;
          }
          if (prod.price && Number(prod.price) > 0 && Math.abs(Number(item.price) - Number(prod.price)) > 0.01) {
            item.price = Number(prod.price);
            hasUpdates = true;
          }
        }
      }
    } catch (e) {}
  }));

  if (hasUpdates) {
    saveCartToLocalStorage();
    renderCart();
    updateSummary();
  }
}

function saveCartToLocalStorage() {
  localStorage.setItem('cart', JSON.stringify(cartItems));
  window.cart = cartItems;
}

function updateHeaderCount() {
  const totalQty = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const countBadges = document.querySelectorAll('.cart-count');
  countBadges.forEach(badge => {
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? '' : 'none';
  });
}

// عرض عناصر السلة مع دعم الروابط والوضع الداكن
function renderCart() {
  const grid = document.getElementById('cart-items-grid');
  const emptyCart = document.getElementById('empty-cart');
  const summaryBox = document.getElementById('cart-summary');
  const cartHeader = document.getElementById('cart-items-header');

  if (cartItems.length === 0) {
    if (grid) grid.style.display = 'none';
    if (emptyCart) emptyCart.style.display = 'block';
    if (summaryBox) summaryBox.style.display = 'none';
    if (cartHeader) cartHeader.style.display = 'none';
    return;
  }

  if (grid) grid.style.display = 'flex';
  if (emptyCart) emptyCart.style.display = 'none';
  if (summaryBox) summaryBox.style.display = 'block';
  if (cartHeader) cartHeader.style.display = 'block';

  const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
  const removeTitle = window.I18n ? window.I18n.t('cart.remove_item', 'إزالة المنتج') : 'إزالة المنتج';

  grid.innerHTML = cartItems.map((item, index) => {
    const itemKey = item.cartKey || (item.variant_id ? `${item.product_id || item.id}_v${item.variant_id}` : String(item.product_id || item.id));
    const prodId = item.product_id || item.id;
    const safeName = window.escapeHtml ? window.escapeHtml(item.name) : item.name;
    const safeCat = window.escapeHtml ? window.escapeHtml(item.category || (window.I18n ? window.I18n.t('categories.general', 'عام') : 'عام')) : (item.category || 'عام');
    const safeImg = window.escapeHtml ? window.escapeHtml(item.image_url || '/images/product-placeholder.jpg') : (item.image_url || '/images/product-placeholder.jpg');
    const priceNum = Number(item.price) || 0;
    const qtyNum = Number(item.quantity) || 1;
    const lineTotal = (priceNum * qtyNum).toLocaleString();

    const optimizedImg = transformCartImage(safeImg);
    return `
    <div class="cart-item" id="cart-item-${itemKey}" data-id="${prodId}" data-key="${itemKey}">
      <a href="product.html?id=${prodId}" class="cart-item-img-wrap" title="${safeName}">
        <img ${index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="85" height="85" src="${optimizedImg}" alt="${safeName}">
      </a>
      <div class="item-details">
        <a href="product.html?id=${prodId}" class="item-title-link">
          <h3>${safeName}</h3>
        </a>
        <span class="item-category-tag">${safeCat}</span>
      </div>
      <div class="item-quantity">
        <button type="button" class="quantity-btn decrease" data-action="change-qty" data-key="${itemKey}" data-delta="-1" aria-label="Decrease quantity">-</button>
        <input type="number" id="input-qty-${itemKey}" class="cart-qty-input" value="${qtyNum}" min="1" max="99" data-action="qty-input" data-key="${itemKey}" aria-label="Quantity">
        <button type="button" class="quantity-btn increase" data-action="change-qty" data-key="${itemKey}" data-delta="1" aria-label="Increase quantity">+</button>
      </div>
      <div class="item-price-col">
        <div class="item-total" id="total-${itemKey}">${lineTotal} ${currency}</div>
        <div class="item-unit-subtext" id="unit-subtext-${itemKey}" style="${qtyNum > 1 ? '' : 'display: none;'}"><bdi>${priceNum.toLocaleString()} ${currency}</bdi> × ${qtyNum}</div>
      </div>
      <button type="button" class="remove-item" data-action="remove-item" data-key="${itemKey}" title="${removeTitle}" aria-label="${removeTitle}">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
    `;
  }).join('');

  if (window.I18n && typeof window.I18n.translatePage === 'function' && window.I18n.currentLang !== 'ar') {
    window.I18n.translatePage(grid);
  }
}

// تعديل الكمية
function changeQuantity(key, delta) {
  const target = String(key);
  const item = cartItems.find(i => String(i.cartKey || i.product_id || i.id) === target || String(i.id) === target);
  if (!item) return;

  const currentQty = Number(item.quantity) || 1;
  const newQty = Math.max(1, Math.min(99, currentQty + delta));
  if (newQty === currentQty) return;

  updateItemQuantityUI(item, newQty);
}

function handleQtyInputChange(key, val) {
  const target = String(key);
  const item = cartItems.find(i => String(i.cartKey || i.product_id || i.id) === target || String(i.id) === target);
  if (!item) return;

  let newQty = parseInt(val, 10);
  if (isNaN(newQty) || newQty < 1) newQty = 1;
  if (newQty > 99) newQty = 99;

  updateItemQuantityUI(item, newQty);
}

function updateItemQuantityUI(item, newQty) {
  item.quantity = newQty;
  const itemKey = item.cartKey || (item.variant_id ? `${item.product_id || item.id}_v${item.variant_id}` : String(item.product_id || item.id));

  const inputEl = document.getElementById(`input-qty-${itemKey}`);
  if (inputEl) inputEl.value = newQty;

  const totalEl = document.getElementById(`total-${itemKey}`);
  const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
  const priceNum = Number(item.price) || 0;
  if (totalEl) totalEl.textContent = `${(priceNum * newQty).toLocaleString()} ${currency}`;

  const unitSubEl = document.getElementById(`unit-subtext-${itemKey}`);
  if (unitSubEl) {
    if (newQty > 1) {
      unitSubEl.innerHTML = `<bdi>${priceNum.toLocaleString()} ${currency}</bdi> × ${newQty}`;
      unitSubEl.style.display = 'block';
    } else {
      unitSubEl.style.display = 'none';
    }
  }

  saveCartToLocalStorage();
  updateSummary();
  updateHeaderCount();

  const currentUser = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
  if (currentUser && item.cart_item_id) {
    fetch(`/api/cart/${item.cart_item_id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty })
    }).catch(() => {});
  }
}

// إزالة منتج مع حركة بصرية سلسة
function removeCartPageItem(key) {
  const target = String(key);
  const removedItem = cartItems.find(i => String(i.cartKey || i.product_id || i.id) === target || String(i.id) === target);
  
  const itemEl = document.getElementById(`cart-item-${target}`);
  if (itemEl) {
    itemEl.style.transition = 'all 0.25s ease';
    itemEl.style.opacity = '0';
    itemEl.style.transform = 'translateX(25px)';
  }

  setTimeout(() => {
    cartItems = cartItems.filter(i => String(i.cartKey || i.product_id || i.id) !== target && String(i.id) !== target);
    saveCartToLocalStorage();
    renderCart();
    updateSummary();
    updateHeaderCount();

    const currentUser = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
    if (currentUser && removedItem && removedItem.cart_item_id) {
      fetch(`/api/cart/${removedItem.cart_item_id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
    }
  }, 220);
}

// إفراغ سلة التسوق بالكامل
async function clearCart() {
  if (!cartItems || cartItems.length === 0) {
    const emptyMsg = window.I18n ? window.I18n.t('messages.cart_empty', 'عربة التسوق فارغة بالفعل') : 'عربة التسوق فارغة بالفعل';
    if (window.showToast) window.showToast(emptyMsg, 'info');
    else if (window.showNotification) window.showNotification(emptyMsg, 'info');
    return;
  }

  const confirmMsg = window.I18n ? window.I18n.t('cart.clear_confirm', 'هل أنت متأكد من رغبتك في إفراغ سلة التسوق بالكامل؟') : 'هل أنت متأكد من رغبتك في إفراغ سلة التسوق بالكامل؟';
  if (!window.confirm(confirmMsg)) return;

  const previousItems = [...cartItems];
  cartItems = [];
  saveCartToLocalStorage();
  localStorage.removeItem('promoCode');
  appliedPromo = null;

  renderCart();
  updateSummary();
  updateHeaderCount();

  const successMsg = window.I18n ? window.I18n.t('cart.cart_cleared', 'تم إفراغ سلة التسوق بنجاح') : 'تم إفراغ سلة التسوق بنجاح';
  if (window.showToast) window.showToast(successMsg, 'success');
  else if (window.showNotification) window.showNotification(successMsg, 'success');

  const currentUser = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
  if (currentUser) {
    try {
      await fetch('/api/cart/clear', { method: 'POST', credentials: 'include' });
    } catch (e) {
      previousItems.forEach(item => {
        if (item.cart_item_id) {
          fetch(`/api/cart/${item.cart_item_id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
        }
      });
    }
  }
}

// تحديث ملخص السلة والحسابات
function updateSummary() {
  const summaryBox = document.getElementById('cart-summary');
  if (!summaryBox) return;

  if (cartItems.length === 0) {
    summaryBox.style.display = 'none';
    return;
  }
  summaryBox.style.display = 'block';

  const subtotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  appliedPromo = getSavedPromo();
  const currentCode = appliedPromo ? (appliedPromo.code || '') : '';
  const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
  
  const discount = calculateDiscount(appliedPromo, subtotal);
  const estimatedTotal = Math.max(0, subtotal - discount);

  let promoWarning = '';
  if (appliedPromo && appliedPromo.minOrderAmount && subtotal < appliedPromo.minOrderAmount) {
    const minMsg = `الحد الأدنى لتطبيق الكوبون هو ${appliedPromo.minOrderAmount.toLocaleString()} ${currency}`;
    promoWarning = `<p style="font-size: 0.8rem; color: var(--danger-color, #ef4444); margin: 4px 0 0;">${minMsg}</p>`;
  }

  const safeCode = window.escapeHtml ? window.escapeHtml(currentCode) : currentCode;
  const promoPlaceholder = window.I18n ? window.I18n.t('cart.promo_placeholder', 'أدخل كود الخصم (مثل: SAVE10)') : 'أدخل كود الخصم (مثل: SAVE10)';

  summaryBox.innerHTML = `
    <h2 data-i18n="cart.summary">ملخص الطلب</h2>
    
    <div class="summary-item">
      <span><span data-i18n="checkout.subtotal">المجموع الفرعي</span></span>
      <strong style="color:var(--dark-color, #1e293b);">${subtotal.toLocaleString()} ${currency}</strong>
    </div>
    
    <div class="summary-item" style="border-bottom: 1px dashed var(--border-color, #e2e8f0); padding-bottom: 10px;">
      <span><span data-i18n="checkout.shipping_cost">مصاريف الشحن</span></span>
      <span style="font-size: 0.88rem; color: var(--primary-color); font-weight: bold; display: inline-flex; align-items: center; gap: 6px;">
        <i class="fas fa-truck"></i> <span data-i18n="cart.shipping_calc">تُحسب حسب الولاية عند الدفع</span>
      </span>
    </div>
    
    ${discount > 0 ? `
      <div class="summary-item discount" style="color:var(--success-color, #10b981); font-weight: bold;">
        <span>
          <span data-i18n="checkout.discount">الخصم</span> 
          ${safeCode ? `(${safeCode})` : ''}
        </span>
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <span>-${discount.toLocaleString()} ${currency}</span>
          <button type="button" data-action="remove-promo" style="background:transparent; border:none; color:var(--danger-color, #ef4444); cursor:pointer; font-size:0.95rem; min-width:32px; min-height:32px; display:inline-flex; align-items:center; justify-content:center; padding:0;" title="${window.I18n ? window.I18n.t('cart.remove_promo', 'إلغاء الخصم') : 'إلغاء الخصم'}" aria-label="${window.I18n ? window.I18n.t('cart.remove_promo', 'إلغاء الخصم') : 'إلغاء الخصم'}">
            <i class="fas fa-times-circle"></i>
          </button>
        </span>
      </div>
    ` : ''}
    ${promoWarning}
    
    <div class="summary-total">
      <span><span data-i18n="cart.total_pre_shipping">المجموع (قبل الشحن)</span></span>
      <strong style="color: var(--primary-color); font-size: 1.25rem;">${estimatedTotal.toLocaleString()} ${currency}</strong>
    </div>
    
    <p style="font-size: 0.82rem; color: var(--light-text, #64748b); margin: 8px 0 16px; line-height: 1.45;">
      <span data-i18n="cart.shipping_note">* سيتم احتساب تكلفة التوصيل الدقيقة (400 - 900 دج) وإضافتها للإجمالي النهائي بعد اختيار ولايتك في صفحة الدفع.</span>
    </p>
    
    <div class="promo-code">
      <input type="text" id="promo-code" data-action="promo-input" placeholder="${promoPlaceholder}" value="${safeCode}">
      ${discount > 0 ? `
        <button type="button" class="apply-promo" data-action="remove-promo" style="background: var(--danger-color, #ef4444); color: white; border: none;"><span data-i18n="cart.remove_promo">إلغاء الخصم</span></button>
      ` : `
        <button type="button" class="apply-promo" data-action="apply-promo"><span data-i18n="cart.apply_promo">تطبيق</span></button>
      `}
    </div>
    
    <button type="button" class="checkout-btn" data-action="checkout">
      <span data-i18n="cart.checkout_btn">متابعة إلى الدفع</span> 
      <i class="fas fa-arrow-left"></i>
    </button>
    
    <a href="shop.html" class="continue-shopping">
      <span data-i18n="cart.continue_shopping">متابعة التسوق</span>
    </a>
  `;

  if (window.I18n && typeof window.I18n.translatePage === 'function' && window.I18n.currentLang !== 'ar') {
    window.I18n.translatePage(summaryBox);
  }
}

// تطبيق كود الخصم عبر الـ API
async function applyPromoCode(codeArg) {
  let code = codeArg;
  if (typeof code !== 'string') {
    const input = document.getElementById('promo-code');
    code = input ? input.value : '';
  }
  code = String(code || '').trim().toUpperCase();

  if (!code) {
    removePromoCode();
    return;
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  try {
    const response = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, orderAmount: subtotal })
    });
    const data = await response.json();

    if (response.ok && data.valid) {
      appliedPromo = {
        code: data.code || code,
        discountPercent: Number(data.discountPercent) || 0,
        discountAmount: Number(data.discountAmount) || 0,
        minOrderAmount: Number(data.minOrderAmount) || 0,
        calculatedDiscount: Number(data.calculatedDiscount) || 0
      };
      localStorage.setItem('promoCode', JSON.stringify(appliedPromo));
      
      const successMsg = data.message || (window.I18n ? window.I18n.t('messages.promo_success', 'تم تطبيق الخصم بنجاح!') : 'تم تطبيق الخصم بنجاح!');
      if (window.showToast) window.showToast(successMsg, 'success');
      else if (window.showNotification) window.showNotification(successMsg, 'success');
    } else {
      removePromoCode();
      const errMsg = (window.getErrorMessage && typeof window.getErrorMessage === 'function')
        ? window.getErrorMessage(data, 'messages.promo_invalid')
        : (data.message || data.error || (window.I18n ? window.I18n.t('messages.promo_invalid', 'كود الخصم غير صالح أو منتهي الصلاحية') : 'كود الخصم غير صالح أو منتهي الصلاحية'));
      if (window.showToast) window.showToast(errMsg, 'error');
      else if (window.showNotification) window.showNotification(errMsg, 'error');
    }
  } catch (err) {
    removePromoCode();
    const errMsg = window.I18n ? window.I18n.t('messages.server_error', 'خطأ في الاتصال بالخادم') : 'خطأ في الاتصال بالخادم';
    if (window.showToast) window.showToast(errMsg, 'error');
    else if (window.showNotification) window.showNotification(errMsg, 'error');
  }
  updateSummary();
}

function removePromoCode() {
  localStorage.removeItem('promoCode');
  appliedPromo = null;
  const cancelMsg = window.I18n ? window.I18n.t('messages.promo_canceled', 'تم إلغاء كود الخصم') : 'تم إلغاء كود الخصم';
  if (window.showToast) window.showToast(cancelMsg, 'info');
  else if (window.showNotification) window.showNotification(cancelMsg, 'info');
  updateSummary();
}

// التوجه إلى صفحة الدفع
function proceedToCheckout() {
  if (cartItems.length === 0) {
    const emptyMsg = window.I18n ? window.I18n.t('messages.cart_empty', 'عربة التسوق فارغة') : 'عربة التسوق فارغة';
    if (window.showToast) window.showToast(emptyMsg, 'warning');
    else if (window.showNotification) window.showNotification(emptyMsg, 'warning');
    return;
  }
  window.location.href = 'checkout.html';
}

// Event Delegation Central Handler
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.getAttribute('data-action');
  if (action === 'change-qty') {
    const key = actionEl.getAttribute('data-key');
    const delta = parseInt(actionEl.getAttribute('data-delta'), 10) || 0;
    changeQuantity(key, delta);
  } else if (action === 'remove-item') {
    const key = actionEl.getAttribute('data-key');
    removeCartPageItem(key);
  } else if (action === 'apply-promo') {
    applyPromoCode();
  } else if (action === 'remove-promo') {
    removePromoCode();
  } else if (action === 'clear-cart') {
    clearCart();
  } else if (action === 'checkout') {
    proceedToCheckout();
  }
});

document.addEventListener('change', (e) => {
  const qtyInput = e.target.closest('[data-action="qty-input"]');
  if (qtyInput) {
    const key = qtyInput.getAttribute('data-key');
    handleQtyInputChange(key, qtyInput.value);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const promoInput = e.target.closest('#promo-code, [data-action="promo-input"]');
    if (promoInput) {
      e.preventDefault();
      applyPromoCode();
    }
  }
});

// تهيئة عند بدء تحميل الصفحة
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCart);
} else {
  loadCart();
}

// تصدير الدوال على window لضمان التوافق الكامل مع أي استدعاءات خارجية
window.loadCart = loadCart;
window.changeQuantity = changeQuantity;
window.handleQtyInputChange = handleQtyInputChange;
window.updateItemQuantityUI = updateItemQuantityUI;
window.removeCartPageItem = removeCartPageItem;
window.clearCart = clearCart;
window.updateSummary = updateSummary;
window.applyPromoCode = applyPromoCode;
window.removePromoCode = removePromoCode;
window.proceedToCheckout = proceedToCheckout;

// Schedule loading of secondary interactive modules on idle or first interaction to minimize TBT
(function scheduleSecondaryModules() {
    let loaded = false;
    function loadModules() {
        if (loaded) return;
        loaded = true;
        ['js/user-system.js', 'js/wishlist.js'].forEach(src => {
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
