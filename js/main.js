// Global variables and initialization

/**
 * استخراج رسالة الخطأ المترجمة بناءً على كود الخطأ أو الرسالة الاحتياطية
 * @param {Object|Error|string} data 
 * @param {string} [fallbackKey] 
 * @returns {string}
 */
function getErrorMessage(data, fallbackKey = 'errors.SERVER_ERROR') {
    if (data && typeof data === 'object') {
        const code = data.code || (data.data && data.data.code);
        if (code && typeof window !== 'undefined' && window.I18n) {
            const errKey = 'errors.' + code;
            const dict = window.I18n.cache ? window.I18n.cache[window.I18n.currentLang] : null;
            if (dict && typeof window.I18n.getValue === 'function') {
                const val = window.I18n.getValue(dict, errKey);
                if (val) return val;
            }
            const tVal = window.I18n.t(errKey, '');
            if (tVal && tVal !== errKey) return tVal;
        }
        if (data.message) return data.message;
        if (data.error) return data.error;
    } else if (typeof data === 'string' && data.trim()) {
        return data;
    }

    if (fallbackKey) {
        if (typeof window !== 'undefined' && window.I18n) {
            const fbVal = window.I18n.t(fallbackKey, '');
            if (fbVal && fbVal !== fallbackKey) return fbVal;
        }
        return fallbackKey;
    }

    return '';
}

if (typeof window !== 'undefined' && !window.getErrorMessage) {
    window.getErrorMessage = getErrorMessage;
}

/**
 * Dark / Light Theme Manager
 */
function initTheme() {
  return window.ThemeManager.applySavedTheme();
}

// Run immediately to avoid page flicker
initTheme();

let lastThemeToggleTime = 0;
function toggleTheme() {
  const now = Date.now();
  if (now - lastThemeToggleTime < 300) return;
  lastThemeToggleTime = now;

  const currentTheme = window.ThemeManager.getCurrentTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  window.ThemeManager.setTheme(newTheme);
  if (document.body) {
    document.body.classList.add('theme-transitioning');
    setTimeout(() => {
      document.body.classList.remove('theme-transitioning');
    }, 350);
  }

  updateThemeToggleIcons(newTheme);

  if (window.showToast) {
    const msg = newTheme === 'dark' 
      ? (window.I18n ? window.I18n.t('theme.dark_enabled', 'تم تفعيل الوضع الليلي 🌙') : 'تم تفعيل الوضع الليلي 🌙')
      : (window.I18n ? window.I18n.t('theme.light_enabled', 'تم تفعيل الوضع الفاتح ☀️') : 'تم تفعيل الوضع الفاتح ☀️');
    window.showToast(msg, 'info');
  }
}

function updateThemeToggleIcons(theme) {
  const buttons = document.querySelectorAll('.theme-toggle-btn');
  const titleLight = window.I18n ? window.I18n.t('theme.switch_light', 'التبديل إلى الوضع الفاتح') : 'التبديل إلى الوضع الفاتح';
  const titleDark = window.I18n ? window.I18n.t('theme.switch_dark', 'التبديل إلى الوضع الليلي') : 'التبديل إلى الوضع الليلي';
  buttons.forEach(btn => {
    const icon = btn.querySelector('i');
    if (icon) {
      if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        btn.setAttribute('title', titleLight);
        btn.setAttribute('aria-label', titleLight);
      } else {
        icon.className = 'fas fa-moon';
        btn.setAttribute('title', titleDark);
        btn.setAttribute('aria-label', titleDark);
      }
    }
  });
}

function setupThemeToggleButtons() {
  const userActionsList = document.querySelectorAll('.user-actions');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const titleLight = window.I18n ? window.I18n.t('theme.switch_light', 'التبديل إلى الوضع الفاتح') : 'التبديل إلى الوضع الفاتح';
  const titleDark = window.I18n ? window.I18n.t('theme.switch_dark', 'التبديل إلى الوضع الليلي') : 'التبديل إلى الوضع الليلي';

  userActionsList.forEach(container => {
    if (!container.querySelector('.theme-toggle-btn')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'theme-toggle-btn';
      toggleBtn.onclick = toggleTheme;
      toggleBtn.innerHTML = `<i class="${currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'}"></i>`;
      toggleBtn.setAttribute('title', currentTheme === 'dark' ? titleLight : titleDark);
      
      const userIcon = container.querySelector('.user-icon');
      if (userIcon) {
        container.insertBefore(toggleBtn, userIcon);
      } else {
        container.appendChild(toggleBtn);
      }
    }
  });

  updateThemeToggleIcons(currentTheme);
}

// Make globally accessible
window.toggleTheme = toggleTheme;
window.initTheme = initTheme;

/**
 * Universal HTML Sanitization Helper to defend against DOM / Stored XSS
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

/**
 * Wishlist Manager (Synchronized with window.WishlistManager)
 */
function getWishlist() {
  if (window.WishlistManager) {
    return window.WishlistManager.getLocalItems().map(p => Number(p.id));
  }
  try {
    const raw = localStorage.getItem('rewaq_wishlist') || localStorage.getItem('wishlist');
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      return parsed.map(p => Number(p.id));
    }
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch (e) {
    return [];
  }
}

async function toggleWishlist(productId, productOrName = (window.I18n ? window.I18n.t('common.product', 'المنتج') : 'المنتج'), extraData = {}) {
  const prodId = Number(productId);
  if (!prodId) return false;

  let productData;
  if (typeof productOrName === 'object' && productOrName !== null) {
    productData = { id: prodId, ...productOrName };
  } else {
    productData = { id: prodId, name: productOrName, ...extraData };
  }

  const productName = productData.name || (window.I18n ? window.I18n.t('common.product', 'المنتج') : 'المنتج');

  if (window.WishlistManager) {
    const result = await window.WishlistManager.toggleItem(productData);
    updateWishlistUI();
    return result;
  }

  let wishlist = getWishlist();
  const index = wishlist.indexOf(prodId);
  let isAdded = false;

  if (index > -1) {
    wishlist.splice(index, 1);
    showToast(window.I18n ? window.I18n.t('wishlist.removed_named', 'تم إزالة "{name}" من قائمة المفضلة').replace('{name}', productName) : `تم إزالة "${productName}" من قائمة المفضلة`, 'info');
  } else {
    wishlist.push(prodId);
    isAdded = true;
    showToast(window.I18n ? window.I18n.t('wishlist.added_named', 'تمت إضافة "{name}" إلى قائمة المفضلة ❤️').replace('{name}', productName) : `تمت إضافة "${productName}" إلى قائمة المفضلة ❤️`, 'success');
  }

  localStorage.setItem('wishlist', JSON.stringify(wishlist));
  updateWishlistUI();
  return isAdded;
}

function updateWishlistUI() {
  const wishlist = getWishlist();
  const count = wishlist.length;
  const wishlistBadges = document.querySelectorAll('.wishlist-count, #wishlist-count');
  wishlistBadges.forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  });

  // Update heart buttons on cards
  const wishlistBtns = document.querySelectorAll('[data-wishlist-id], .product-wishlist');
  wishlistBtns.forEach(btn => {
    const id = parseInt(btn.getAttribute('data-wishlist-id'), 10);
    const icon = btn.querySelector('i');
    if (id && wishlist.includes(id)) {
      btn.classList.add('active');
      if (icon) icon.className = 'fas fa-heart text-danger';
    } else {
      btn.classList.remove('active');
      if (icon) icon.className = 'far fa-heart';
    }
  });
}

window.getWishlist = getWishlist;
window.toggleWishlist = toggleWishlist;
window.updateWishlistUI = updateWishlistUI;

/**
 * Global Toast Notification System
 * @param {string} message - نص الإشعار
 * @param {string} type - نوع الإشعار: 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - مدة الظهور بالملي ثانية (افتراضي 3500ms)
 */
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'status');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  const iconClass = icons[type] || icons.success;

  toast.innerHTML = `
    <div class="toast-content">
      <i class="${iconClass} toast-icon"></i>
      <span class="toast-message">${window.escapeHtml ? window.escapeHtml(message) : message}</span>
    </div>
    <button type="button" class="toast-close" aria-label="${window.I18n ? window.I18n.t('common.close', 'إغلاق') : 'إغلاق'}">&times;</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  let dismissTimeout = setTimeout(() => {
    removeToast(toast);
  }, duration);

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    clearTimeout(dismissTimeout);
    removeToast(toast);
  });

  toast.addEventListener('mouseenter', () => {
    clearTimeout(dismissTimeout);
    const progress = toast.querySelector('.toast-progress');
    if (progress) progress.style.animationPlayState = 'paused';
  });

  toast.addEventListener('mouseleave', () => {
    const progress = toast.querySelector('.toast-progress');
    if (progress) progress.style.animationPlayState = 'running';
    dismissTimeout = setTimeout(() => {
      removeToast(toast);
    }, 1500);
  });
}

function removeToast(toast) {
  if (!toast) return;
  toast.classList.remove('toast-show');
  toast.classList.add('toast-hide');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

window.showToast = showToast;

/**
 * Back To Top Button Handler
 */
function initBackToTop() {
  let btn = document.getElementById('back-to-top');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.type = 'button';
    btn.className = 'back-to-top-btn';
    btn.setAttribute('aria-label', window.I18n ? window.I18n.t('common.back_to_top', 'العودة إلى الأعلى') : 'العودة إلى الأعلى');
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  let backToTopTicking = false;
  window.addEventListener('scroll', () => {
    if (!backToTopTicking) {
      window.requestAnimationFrame(() => {
        const isPastThreshold = (window.scrollY || window.pageYOffset || 0) > 300;
        if (isPastThreshold) {
          if (!btn.classList.contains('visible')) btn.classList.add('visible');
        } else {
          if (btn.classList.contains('visible')) btn.classList.remove('visible');
        }
        backToTopTicking = false;
      });
      backToTopTicking = true;
    }
  }, { passive: true });
}

/**
 * Newsletter & VIP Club Handler
 */
function initNewsletter() {
  // Clear any persistent VIP card override so page reload always returns to the normal state
  try {
    localStorage.removeItem('rewaq_vip_club');
  } catch (e) {}

  const forms = document.querySelectorAll('form[data-newsletter], .newsletter-form, footer form');
  forms.forEach(form => {
    // Save original HTML of the parent card for easy reset
    const parentCard = form.closest('.newsletter-card');
    if (parentCard && !parentCard._originalHTML) {
      parentCard._originalHTML = parentCard.innerHTML;
    }

    if (form.dataset.newsletterBound) return;
    form.dataset.newsletterBound = 'true';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const email = input ? input.value.trim().toLowerCase() : '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        showToast(window.I18n ? window.I18n.t('footer.newsletter_invalid', 'يرجى إدخال البريد الإلكتروني بشكل صحيح') : 'يرجى إدخال البريد الإلكتروني بشكل صحيح', 'warning');
        if (input) input.focus();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      }

      try {
        const response = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok && data.success) {
          const discountCode = data.discountCode || 'PROMO10';

          showToast(data.message || (window.I18n ? window.I18n.t('footer.newsletter_success', 'شكراً لاشتراكك في النشرة البريدية! 🎉') : 'شكراً لاشتراكك في النشرة البريدية! 🎉'), 'success');

          const card = form.closest('.newsletter-card') || document.querySelector('.newsletter-card');
          if (card) {
            renderVipRewardCard(card, discountCode, email);
          } else if (input) {
            input.value = '';
          }
        } else {
          showToast(data.error || (window.I18n ? window.I18n.t('footer.newsletter_error', 'حدث خطأ أثناء معالجة الاشتراك، يرجى المحاولة لاحقاً.') : 'حدث خطأ أثناء معالجة الاشتراك، يرجى المحاولة لاحقاً.'), 'danger');
        }
      } catch (err) {
        console.error('Newsletter submission error:', err);
        const fallbackCode = 'PROMO10';
        showToast(window.I18n ? window.I18n.t('footer.newsletter_vip_success', 'تهانينا! لقد انضممت بنجاح إلى نادي المتميزين 🎉') : 'تهانينا! لقد انضممت بنجاح إلى نادي المتميزين 🎉', 'success');
        const card = form.closest('.newsletter-card') || document.querySelector('.newsletter-card');
        if (card) {
          renderVipRewardCard(card, fallbackCode, email);
        } else if (input) {
          input.value = '';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHTML;
        }
      }
    });
  });
}

function renderVipRewardCard(card, code, email) {
  if (!card) return;
  if (!card._originalHTML) {
    card._originalHTML = card.innerHTML;
  }
  const t = (key, fallback) => (window.I18n ? window.I18n.t(key, fallback) : fallback);
  const safeCode = window.escapeHtml ? window.escapeHtml(code) : code;
  const safeEmail = window.escapeHtml ? window.escapeHtml(email || '') : (email || '');
  const badgeText = t('home.vip_badge', 'عضو مميز');
  const titleText = t('home.vip_title', 'أهلاً بك في نادي المتميزين! 🎉');
  const descText = t('home.vip_desc', 'كود الخصم الحصري الخاص بك بقيمة 10% على إجمالي مشترياتك:');
  const copyText = t('home.copy', 'نسخ');
  const shopNowText = t('home.shop_now_discount', 'تسوق الآن واستفد من الخصم');
  const subPrefix = t('home.vip_subscriber', 'المشترك:');
  const resetText = t('home.vip_subscribe_another', 'تسجيل بريد إلكتروني آخر ↩');

  card.innerHTML = `
    <div class="vip-reward-card">
      <div class="vip-reward-badge" data-i18n="home.vip_badge">
        <i class="fas fa-crown"></i> <span>${badgeText}</span>
      </div>
      <h3 class="vip-reward-title" data-i18n="home.vip_title">${titleText}</h3>
      <p class="vip-reward-desc" data-i18n="home.vip_desc">${descText}</p>
      <div class="vip-coupon-box">
        <span class="vip-coupon-code" id="vipCouponCode">${safeCode}</span>
        <button type="button" class="btn-copy-coupon" id="btnCopyVipCoupon" data-i18n-title="home.copy_coupon" title="${t('home.copy_coupon', 'نسخ كود الخصم')}">
          <i class="fas fa-copy"></i> <span data-i18n="home.copy">${copyText}</span>
        </button>
      </div>
      <div class="vip-reward-actions">
        <a href="shop.html" class="btn btn-primary btn-shop-now">
          <i class="fas fa-bag-shopping"></i> <span data-i18n="home.shop_now_discount">${shopNowText}</span>
        </a>
      </div>
      ${safeEmail ? `<span class="newsletter-promise" data-i18n="home.vip_subscriber" style="margin-top: 14px; font-size: 0.8rem; opacity: 0.85;">📧 ${subPrefix} ${safeEmail}</span>` : ''}
      <button type="button" class="btn-reset-vip" id="btnResetVip" data-i18n="home.vip_subscribe_another" style="display:inline-block; margin-top:12px; background:none; border:none; color:var(--primary-color); font-size:0.84rem; font-weight:700; cursor:pointer; text-decoration:underline;">${resetText}</button>
    </div>
  `;

  const copyBtn = card.querySelector('#btnCopyVipCoupon');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const temp = document.createElement('textarea');
          temp.value = code;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
        }
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `<i class="fas fa-check"></i> <span data-i18n="home.copied">${t('home.copied', 'تم النسخ!')}</span>`;
        if (typeof showToast === 'function') {
          showToast(t('home.coupon_copied', 'تم نسخ كود الخصم (PROMO10) بنجاح! يمكنك استخدامه في السلة.'), 'success');
        }
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = `<i class="fas fa-copy"></i> <span data-i18n="home.copy">${t('home.copy', 'نسخ')}</span>`;
        }, 3000);
      } catch (err) {
        if (typeof showToast === 'function') {
          showToast(t('home.coupon_code_is', 'كود الخصم الخاص بك هو:') + ' ' + code, 'info');
        }
      }
    });
  }

  const resetBtn = card.querySelector('#btnResetVip');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (card._originalHTML) {
        card.innerHTML = card._originalHTML;
        // Re-bind form submit
        const form = card.querySelector('form');
        if (form) {
          delete form.dataset.newsletterBound;
        }
        initNewsletter();
      }
    });
  }
}

// Sync cart counter on page load
function syncCartCounter() {
  const savedCart = localStorage.getItem('cart');
  let totalCount = 0;
  if (savedCart) {
    try {
      const cartItems = JSON.parse(savedCart);
      totalCount = Array.isArray(cartItems) ? cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
    } catch (e) {}
  }
  const cartCounts = document.querySelectorAll('.cart-count');
  cartCounts.forEach(el => {
    el.textContent = totalCount;
    el.style.display = totalCount > 0 ? '' : 'none';
  });
}

// Network Status Watcher (Online / Offline mode)
function initNetworkStatusWatcher() {
  const banner = document.createElement('div');
  banner.id = 'offline-notification-banner';
  banner.style.cssText = 'display:none; position:relative; width:100%; z-index:10000; background:#dc2626; color:var(--bg-color, #fff); text-align:center; padding:10px 15px; font-weight:bold; font-size:0.92rem; box-shadow:0 4px 12px rgba(0,0,0,0.2);';
  const offlineText = () => (window.I18n
    ? window.I18n.t('common.offline_notice', 'أنت غير متصل بالإنترنت حالياً (وضع التصفح دون اتصال). يلزم الاتصال لتأكيد الطلبات.')
    : (window.I18n ? window.I18n.t('common.offline_notice') : 'Offline'));
  banner.innerHTML = `<i class="fas fa-wifi"></i> ${offlineText()}`;
  document.body.prepend(banner);

  function updateStatus() {
    if (!navigator.onLine) {
      banner.style.display = 'block';
    } else {
      if (banner.style.display === 'block') {
        banner.style.display = 'none';
        if (window.showToast) {
          window.showToast(window.I18n ? window.I18n.t('common.online_notice', '✅ تمت استعادة الاتصال بالإنترنت بنجاح!') : '✅ تمت استعادة الاتصال بالإنترنت بنجاح!', 'success');
        }
      }
    }
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  if (!navigator.onLine) updateStatus();
  document.addEventListener('languageChanged', () => {
    banner.innerHTML = `<i class="fas fa-wifi"></i> ${offlineText()}`;
  });
}

// Service Worker Registration
function registerPwaServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      try {
        // In preview iframes, third-party SW or storage partitioning may restrict registration.
        // Always catch silently so page functioning is completely undisturbed.
        const promise = navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (promise && typeof promise.then === 'function') {
          promise.catch(() => {});
        }
      } catch (e) {
        // Safe fallback in cross-origin / sandbox iframes
      }
    });
  }
}

/**
 * Mobile Navigation Drawer Manager
 */
function initMobileNavigation() {
  const header = document.querySelector('header');
  if (!header) return;

  const container = header.querySelector('.container');
  if (!container) return;

  // Check or create mobile hamburger button
  let menuBtn = container.querySelector('.mobile-menu-btn');
  if (!menuBtn) {
    menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.setAttribute('aria-label', (window.I18n && window.I18n.t) ? window.I18n.t('nav.open_menu', 'فتح القائمة الرئيسية') : 'فتح القائمة الرئيسية');
    menuBtn.setAttribute('data-i18n-aria-label', 'nav.open_menu');
    menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    container.appendChild(menuBtn);
  }

  // Create overlay & drawer if not present
  let overlay = document.getElementById('mobile-nav-overlay');
  let drawer = document.getElementById('mobile-nav-drawer');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-nav-overlay';
    overlay.className = 'mobile-nav-overlay';
    document.body.appendChild(overlay);
  }

  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mobile-nav-drawer';
    drawer.className = 'mobile-nav-drawer';
    
    // Fixed link definitions: labels are translated through data-i18n on the <span>
    // (never on the <a>, otherwise translatePage() would wipe the icon).
    const currentPath = window.location.pathname;
    const drawerItems = [
      { href: 'index.html', icon: 'fas fa-home', key: 'nav.home', fb: 'الرئيسية' },
      { href: 'shop.html', icon: 'fas fa-shopping-bag', key: 'nav.shop', fb: 'التسوق' },
      { href: 'cart.html', icon: 'fas fa-shopping-cart', key: 'nav.cart', fb: 'عربة التسوق' },
      { href: 'wishlist.html', icon: 'fas fa-heart', key: 'nav.wishlist', fb: 'المفضلة' },
      { href: 'track-order.html', icon: 'fas fa-truck', key: 'nav.track_order', fb: 'تتبع طلبي' }
    ];
    const t = (k, fb) => (window.I18n && window.I18n.t) ? window.I18n.t(k, fb) : fb;
    const linksHtml = drawerItems.map(it => {
      const active = currentPath.endsWith('/' + it.href) || (it.href === 'index.html' && (currentPath === '/' || currentPath.endsWith('/'))) ? 'active' : '';
      return `<li><a href="${it.href}" class="${active}"><i class="${it.icon}"></i> <span data-i18n="${it.key}">${t(it.key, it.fb)}</span></a></li>`;
    }).join('');

    drawer.innerHTML = `
      <div class="mobile-drawer-header">
        <div class="drawer-logo">
          <i class="fas fa-shopping-bag" style="color: var(--primary-color);"></i> <span data-i18n="nav.drawer_title">${t('nav.drawer_title', 'المتجر الإلكتروني')}</span>
        </div>
        <button type="button" class="mobile-drawer-close" data-i18n-aria-label="nav.close_menu" aria-label="${t('nav.close_menu', 'إغلاق القائمة')}">&times;</button>
      </div>
      <ul class="mobile-drawer-links">
        ${linksHtml}
      </ul>
      <div class="mobile-drawer-footer">
        <a href="account.html" class="btn btn-outline" style="width: 100%; justify-content: center; font-size: 0.92rem; padding: 10px;">
          <i class="fas fa-user-circle"></i> <span data-i18n="nav.account">${t('nav.account', 'حسابي')}</span>
        </a>
      </div>
    `;
    if (window.I18n && window.I18n.translatePage) window.I18n.translatePage(drawer);
    document.body.appendChild(drawer);
  }

  function openDrawer() {
    overlay.classList.add('active');
    drawer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    overlay.classList.remove('active');
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);
  
  const closeBtn = drawer.querySelector('.mobile-drawer-close');
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.mobile-menu-btn');
    if (trigger) {
      e.preventDefault();
      openDrawer();
    }
    const closeTrigger = e.target.closest('.mobile-drawer-close');
    if (closeTrigger) {
      e.preventDefault();
      closeDrawer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('active')) {
      closeDrawer();
    }
  });
}

function getLocalizedStoreName(rawName) {
  const trimmed = String(rawName || '').trim();
  const isDefault = !trimmed || trimmed.toLowerCase() === 'rewaq' || trimmed === '\u0631\u0648\u0627\u0642' || trimmed === '\u0645\u062a\u062c\u0631 \u0631\u0648\u0627\u0642';
  if (isDefault) {
    if (window.I18n && typeof window.I18n.t === 'function') {
      const translated = window.I18n.t('common.store_brand_title');
      if (translated && translated !== 'common.store_brand_title') return translated;
    }
    return (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('common.store_brand_title', 'متجر رواق') : 'Rewaq';
  }
  return rawName;
}

/**
 * Apply Global Dynamic Store Settings (Logo, Branding, Social, Policies, Announcement, Payment Toggles)
 */
function applyGlobalStoreSettings(settings) {
  if (!settings) return;

  // 1. Update Document Title / Favicon
  if (settings.store_favicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = settings.store_favicon;
  }
  
  const localizedStoreName = getLocalizedStoreName(settings.store_name);

  if (localizedStoreName) {
    // Update document title suffix safely without removing the page name
    const currentTitle = document.title;
    if (currentTitle.includes('-')) {
        document.title = currentTitle.split('-')[0] + '- ' + localizedStoreName;
    } else {
        document.title = localizedStoreName;
    }

    // Update footer brand or other hardcoded store names
    document.querySelectorAll('[data-i18n="footer.brand"], .footer-brand').forEach(el => {
        el.textContent = localizedStoreName;
        el.removeAttribute('data-i18n'); // Prevent re-translation overwriting dynamic store name
    });

    // Update footer dynamic text separately from translations
    document.querySelectorAll('.dynamic-store-name').forEach(el => el.textContent = localizedStoreName);
    document.querySelectorAll('.dynamic-year').forEach(el => el.textContent = new Date().getFullYear());

    // Update any legacy footer copyright elements
    document.querySelectorAll('[data-i18n="footer.copyright"], [data-i18n="checkout.footer_copyright"]').forEach(el => {
        const rightsText = (window.I18n && window.I18n.t('common.rights_reserved')) || 'جميع الحقوق محفوظة.';
        el.innerHTML = `&copy; <span class="dynamic-year">${new Date().getFullYear()}</span> <span class="dynamic-store-name">${window.escapeHtml ? window.escapeHtml(localizedStoreName) : localizedStoreName}</span>. <span data-i18n="common.rights_reserved">${rightsText}</span>`;
        el.removeAttribute('data-i18n');
    });
  }

  // 2. Update Header Brand Name & Logo
  const getOptimizedLogoUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/w_')) {
      return url.replace('/upload/', '/upload/w_64,h_64,c_fill,f_auto,q_auto/');
    }
    return url;
  };

  const optimizedLogoUrl = getOptimizedLogoUrl(settings.store_logo);

  document.querySelectorAll('.logo a').forEach(logoLink => {
    let content = '';
    if (optimizedLogoUrl) {
      content += `<img class="site-logo-img store-logo-custom" src="${window.escapeHtml ? window.escapeHtml(optimizedLogoUrl) : optimizedLogoUrl}" alt="" width="38" height="38">`;
    }
    if (settings.store_name) {
      content += `<span class="logo-text store-name-text">${window.escapeHtml ? window.escapeHtml(localizedStoreName) : localizedStoreName}</span>`;
    }
    
    if (content) {
        logoLink.innerHTML = content;
        logoLink.style.display = 'flex';
        logoLink.style.alignItems = 'center';
    }
  });

  // Keep footer logo in sync with the same optimized asset
  if (optimizedLogoUrl) {
    document.querySelectorAll('.footer-brand-lockup img').forEach(img => {
      img.src = optimizedLogoUrl;
      img.alt = '';
      img.width = 32;
      img.height = 32;
    });
  }

  // 3. Update Announcement Bar if present
  const announcementEl = document.querySelector('.top-announcement-bar') || document.getElementById('announcement-bar');
  if (announcementEl && settings.announcement_bar_text) {
    announcementEl.textContent = settings.announcement_bar_text;
  }

  // 4. Update Footer Contact Info & Social Links
  document.querySelectorAll('.footer-phone, .contact-phone').forEach(el => {
    if (settings.store_phone) {
      el.textContent = settings.store_phone;
      if (el.tagName === 'A') el.href = `tel:${settings.store_phone}`;
    }
  });

  document.querySelectorAll('.footer-email, .contact-email').forEach(el => {
    if (settings.store_email) {
      el.textContent = settings.store_email;
      if (el.tagName === 'A') el.href = `mailto:${settings.store_email}`;
    }
  });

  // Fallback for footer contact icons without specific classes
  if (settings.store_email) {
    document.querySelectorAll('footer li, .footer-col li').forEach(li => {
      if (li.querySelector('.fa-envelope') && !li.querySelector('.footer-email')) {
        const icon = li.querySelector('.fa-envelope').outerHTML;
        li.innerHTML = `${icon} <span class="footer-email">${window.escapeHtml ? window.escapeHtml(settings.store_email) : settings.store_email}</span>`;
      }
    });
  }
  if (settings.store_phone) {
    document.querySelectorAll('footer li, .footer-col li').forEach(li => {
      if ((li.querySelector('.fa-phone') || li.querySelector('.fa-phone-alt')) && !li.querySelector('.footer-phone')) {
        const icon = (li.querySelector('.fa-phone') || li.querySelector('.fa-phone-alt')).outerHTML;
        li.innerHTML = `${icon} <span class="footer-phone">${window.escapeHtml ? window.escapeHtml(settings.store_phone) : settings.store_phone}</span>`;
      }
    });
  }

  document.querySelectorAll('.footer-address, .contact-address, [data-i18n="footer.address"]').forEach(el => {
    const addr = (settings.store_address || '').trim();
    // Default (Arabic) demo address => keep the translated i18n text; only a custom address overrides it.
    const defaults = [(window.I18n ? window.I18n.t('footer.address_val', 'الجزائر العاصمة، الجزائر') : 'الجزائر العاصمة، الجزائر'), 'Alger, Algérie', 'Algiers, Algeria'];
    if (addr && !defaults.includes(addr)) {
      el.removeAttribute('data-i18n');
      el.textContent = addr;
    }
  });

  document.querySelectorAll('.social-links a.facebook, a.facebook').forEach(el => {
    if (settings.facebook_url) el.href = settings.facebook_url;
  });

  document.querySelectorAll('.social-links a.instagram, a.instagram').forEach(el => {
    if (settings.instagram_url) el.href = settings.instagram_url;
  });

  document.querySelectorAll('.social-links a.tiktok, a.tiktok').forEach(el => {
    if (settings.tiktok_url) el.href = settings.tiktok_url;
  });

  // 5. Payment methods (checkout): show/hide per Admin > Settings and keep a valid selection.
  //    radio values: cod | chargily | bank-transfer (CCP / BaridiMob)
  const paymentRadios = document.querySelectorAll('input[name="payment-method"]');
  if (paymentRadios.length) {
    const enabledFlags = {
      'cod': settings.enable_cod,
      'chargily': settings.enable_chargily,
      'bank-transfer': settings.enable_ccp
    };
    paymentRadios.forEach(radio => {
      const off = enabledFlags[radio.value] === 'false';
      const box = radio.closest('.payment-option') || radio.parentElement;
      if (box) box.style.display = off ? 'none' : '';
      radio.disabled = off;
      if (off) radio.checked = false;
    });
    const available = Array.from(paymentRadios).filter(r => !r.disabled);
    if (available.length && !available.some(r => r.checked)) {
      available[0].checked = true;
      available[0].dispatchEvent(new Event('change', { bubbles: true }));
    }
    const bankDetails = document.getElementById('bank-transfer-details');
    const selected = document.querySelector('input[name="payment-method"]:checked');
    if (bankDetails && selected) bankDetails.style.display = selected.value === 'bank-transfer' ? 'block' : 'none';
  }

  // 6. CCP / BaridiMob account details (editable from Admin > Settings; rendered as text, never as HTML)
  const setCcpField = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  };
  setCcpField('ccp-account-number', settings.ccp_account_number);
  setCcpField('ccp-account-key', settings.ccp_account_key);
  setCcpField('ccp-rip', settings.ccp_rip);
  setCcpField('ccp-account-holder', settings.ccp_account_holder || localizedStoreName);
}

/**
 * Marketing Pixels & Event Tracker
 */
async function initMarketingPixels() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();
    if (!settings) return;

    window.storeSettings = settings;
    // Cache settings for offline/fallback use by other pages (e.g. invoice.html)
    try { localStorage.setItem('store_settings_cache', JSON.stringify(settings)); } catch(e) {}
    applyGlobalStoreSettings(settings);

    // 1. Facebook Pixel
    if (settings.facebook_pixel_id && typeof window.fbq !== 'function') {
      (function(f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0;
        t.src = v; s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      window.fbq('init', String(settings.facebook_pixel_id).trim());
      window.fbq('track', 'PageView');
    }

    // 2. TikTok Pixel
    if (settings.tiktok_pixel_id && typeof window.ttq !== 'object') {
      (function (w, d, t) {
        w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
        ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
        ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; };
        ttq.load = function (e, n) {
          var i = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i; ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {};
          var o = document.createElement("script"); o.type = "text/javascript"; o.async = !0; o.src = i + "?sdkid=" + e + "&lib=" + t;
          var a = document.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a);
        };
        ttq.load(String(settings.tiktok_pixel_id).trim());
        ttq.page();
      })(window, document, 'ttq');
    }

    // 3. Google Analytics 4
    if (settings.google_analytics_id) {
      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(settings.google_analytics_id.trim())}`;
      document.head.appendChild(gaScript);

      window.dataLayer = window.dataLayer || [];
      function gtag() { window.dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', settings.google_analytics_id.trim());
    }

    // Custom helper to track e-commerce actions
    window.trackPixelEvent = function(eventName, params = {}) {
      if (typeof window.fbq === 'function') window.fbq('track', eventName, params);
      if (typeof window.ttq === 'object' && typeof window.ttq.track === 'function') window.ttq.track(eventName, params);
      if (typeof window.gtag === 'function') window.gtag('event', eventName, params);
    };
  } catch (e) {}
}

/**
 * Mobile Bottom Sticky Navigation Bar
 */
function initMobileBottomBar() {
  if (document.querySelector('.mobile-bottom-nav') || window.location.pathname.includes('/admin/')) {
    return;
  }
  // invoice.html is a standalone printable receipt: it doesn't load css/style.css,
  // so this nav would render completely unstyled (overlapping icons/labels) there.
  if (window.location.pathname.includes('invoice.html')) {
    return;
  }

  const path = window.location.pathname;
  const isHome = path.endsWith('index.html') || path.endsWith('/') || path === '';
  const isShop = path.includes('shop.html') || path.includes('product.html');
  const isWishlist = path.includes('wishlist.html');
  const isCart = path.includes('cart.html') || path.includes('checkout.html');
  const isAccount = path.includes('account.html');

  const bottomNav = document.createElement('nav');
  bottomNav.className = 'mobile-bottom-nav';
  bottomNav.id = 'mobileBottomNav';
  bottomNav.setAttribute('aria-label', window.I18n ? window.I18n.t('nav.bottom_label', 'شريط التنقل السفلي للهاتف') : 'شريط التنقل السفلي للهاتف');
  bottomNav.setAttribute('data-i18n-aria-label', 'nav.bottom_label');

  bottomNav.innerHTML = `
    <a href="index.html" class="mobile-nav-item ${isHome ? 'active' : ''}">
      <i class="fas fa-home"></i>
      <span data-i18n="nav.home">الرئيسية</span>
    </a>
    <a href="shop.html" class="mobile-nav-item ${isShop ? 'active' : ''}">
      <i class="fas fa-shopping-bag"></i>
      <span data-i18n="nav.shop">التسوق</span>
    </a>
    <a href="wishlist.html" class="mobile-nav-item ${isWishlist ? 'active' : ''}">
      <div class="nav-icon-badge-wrap">
        <i class="fas fa-heart"></i>
        <span class="mobile-badge wishlist-count" style="display:none;">0</span>
      </div>
      <span data-i18n="nav.wishlist">المفضلة</span>
    </a>
    <a href="cart.html" class="mobile-nav-item ${isCart ? 'active' : ''}">
      <div class="nav-icon-badge-wrap">
        <i class="fas fa-shopping-cart"></i>
        <span class="mobile-badge cart-count" style="display:none;">0</span>
      </div>
      <span data-i18n="nav.cart_short">السلة</span>
    </a>
    <a href="account.html" class="mobile-nav-item ${isAccount ? 'active' : ''}">
      <i class="fas fa-user"></i>
      <span data-i18n="nav.account">حسابي</span>
    </a>
  `;

  document.body.appendChild(bottomNav);
  if (window.I18n && window.I18n.translatePage) window.I18n.translatePage(bottomNav);

  syncCartCounter();
  updateWishlistUI();
}

/**
 * Smart Mobile Header: Smoothly collapse search bar on scroll down, reveal on scroll up
 */
function initMobileSmartHeader() {
  const getHeader = () => document.getElementById('main-header') || document.querySelector('header');
  let header = getHeader();
  if (!header) {
    setTimeout(() => {
      header = getHeader();
      if (header) bindSmartHeader(header);
    }, 100);
    return;
  }
  bindSmartHeader(header);
}

function bindSmartHeader(header) {
  if (!header || header._smartHeaderBound) return;
  header._smartHeaderBound = true;

  let lastScrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
  let accumulatedDistance = 0;
  let activeDirection = 0;
  let ticking = false;

  const DOWN_THRESHOLD = 40;
  const UP_THRESHOLD = 25;
  const TOP_SAFE_ZONE = 60;

  const handleScroll = () => {
    // Read phase: perform all DOM / window measurements together
    const currentScrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
    const isMobile = window.innerWidth <= 768;
    const activeEl = document.activeElement;
    const isSearchActive = !!(activeEl && activeEl.closest('.header-search'));

    // Write phase: mutate DOM classes without interleaved reads
    if (!isMobile) {
      if (header.classList.contains('search-collapsed')) {
        header.classList.remove('search-collapsed');
      }
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    if (isSearchActive) {
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    if (currentScrollY <= TOP_SAFE_ZONE) {
      if (header.classList.contains('search-collapsed')) {
        header.classList.remove('search-collapsed');
      }
      lastScrollY = currentScrollY;
      accumulatedDistance = 0;
      activeDirection = 0;
      ticking = false;
      return;
    }

    const delta = currentScrollY - lastScrollY;
    const currentDir = delta > 0 ? 1 : (delta < 0 ? -1 : 0);

    if (currentDir !== 0) {
      if (currentDir !== activeDirection) {
        activeDirection = currentDir;
        accumulatedDistance = 0;
      }

      accumulatedDistance += Math.abs(delta);

      if (activeDirection === 1 && accumulatedDistance >= DOWN_THRESHOLD) {
        if (!header.classList.contains('search-collapsed')) {
          header.classList.add('search-collapsed');
        }
        accumulatedDistance = 0;
      } else if (activeDirection === -1 && accumulatedDistance >= UP_THRESHOLD) {
        if (header.classList.contains('search-collapsed')) {
          header.classList.remove('search-collapsed');
        }
        accumulatedDistance = 0;
      }
    }

    lastScrollY = currentScrollY;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(handleScroll);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && header.classList.contains('search-collapsed')) {
      window.requestAnimationFrame(() => {
        header.classList.remove('search-collapsed');
      });
    }
  }, { passive: true });
}

function optimizeImageLoading() {
  const scheduleIdle = (callback) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback, { timeout: 1000 });
      return;
    }
    setTimeout(callback, 200);
  };

  scheduleIdle(() => {
    document.querySelectorAll('img:not([data-performance-ready])').forEach((img) => {
      img.dataset.performanceReady = 'true';
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
      if (!img.hasAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
      }
    });
  });
}

// Page Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Phase 1: Critical visual initialization (theme & mobile smart header)
  try {
    const cached = localStorage.getItem('store_settings_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      window.storeSettings = parsed;
      applyGlobalStoreSettings(parsed);
    }
  } catch(e) {}

  initTheme();
  setupThemeToggleButtons();
  initMobileNavigation();
  initMobileSmartHeader();

  // Phase 2: Yield non-critical tasks to Idle / Next Frame to slash Total Blocking Time (TBT)
  const scheduleTask = (task) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(task, { timeout: 300 });
    } else {
      setTimeout(task, 16);
    }
  };

  scheduleTask(() => {
    initMobileBottomBar();
    initBackToTop();
    optimizeImageLoading();
  });

  scheduleTask(() => {
    updateWishlistUI();
    syncCartCounter();
    initNewsletter();
  });

  scheduleTask(() => {
    initNetworkStatusWatcher();
    registerPwaServiceWorker();
    initMarketingPixels();
  });

  document.addEventListener('languageChanged', () => {
    if (window.storeSettings) applyGlobalStoreSettings(window.storeSettings);
  });
});

