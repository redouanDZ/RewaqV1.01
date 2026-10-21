/**
 * Shared Layout Injection Module (Header & Footer) for Rewaq
 * Dynamically provides the canonical header, navigation, and footer templates
 * while preserving active navigation states, data-i18n translation bindings,
 * theme controls, and cart/wishlist badge counters.
 */
(function () {
  'use strict';

  function getActivePageKey() {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.endsWith('shop.html')) return 'shop';
    if (pathname.endsWith('cart.html')) return 'cart';
    if (pathname.endsWith('wishlist.html')) return 'wishlist';
    if (pathname.endsWith('track-order.html')) return 'track';
    if (pathname.endsWith('account.html')) return 'account';
    if (pathname.endsWith('checkout.html')) return 'cart';
    if (pathname.endsWith('order-confirmation.html')) return 'cart';
    if (pathname.endsWith('product.html')) return 'shop';
    if (pathname.endsWith('terms.html')) return 'terms';
    if (pathname.endsWith('privacy.html')) return 'privacy';
    return 'home';
  }

  function getHeaderTemplate() {
    const active = getActivePageKey();

    return `
    <!-- Top Announcement Bar -->
    <div class="top-announcement-bar">
      <div class="container top-announcement-container">
        <div class="announcement-text">
          <i class="fas fa-truck-fast"></i>
          <span data-i18n="home.trusted_badge">🇩🇿 توصيل سريع وموثوق لـ 58 ولاية مع إمكانية الدفع عند الاستلام</span>
        </div>
        <div class="top-bar-actions">
          <a href="track-order.html" class="top-track-link">
            <i class="fas fa-location-dot"></i> <span data-i18n="nav.track_order">تتبع طلبي</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Main Navigation Header -->
    <header id="main-header">
      <div class="container header-main-container">
        <!-- Logo Zone -->
        <div class="logo">
          <a href="index.html" class="logo-link">
            <img src="/images/logo-32.webp" srcset="/images/logo-32.webp 1x, /images/logo-64.webp 2x" alt="" class="site-logo-img" width="38" height="38" fetchpriority="high">
            <span class="logo-text" data-i18n="common.store_name">متجر رواق</span>
          </a>
        </div>

        <!-- Integrated Center Search Bar -->
        <div class="header-search">
          <form action="shop.html" method="GET" class="header-search-form">
            <i class="fas fa-search header-search-icon"></i>
            <input type="text" name="search" data-i18n-placeholder="common.search_placeholder" placeholder="ابحث عن أزياء، إلكترونيات، عطور، مستلزمات المنزل..." autocomplete="off">
            <button type="submit" class="header-search-btn" data-i18n="common.search">بحث</button>
          </form>
        </div>

        <!-- Header Actions -->
        <div class="user-actions">
          <button type="button" class="action-btn theme-toggle-btn" data-action="toggleTheme" data-i18n-title="common.toggle_theme" title="تبديل الوضع">
            <i class="fas fa-moon"></i>
          </button>
          <!-- Wishlist -->
          <a href="wishlist.html" class="action-btn wishlist-icon ${active === 'wishlist' ? 'active' : ''}" data-i18n-title="common.wishlist" title="المفضلة">
            <i class="fas fa-heart text-danger"></i>
            <span class="badge-count wishlist-count" id="wishlist-count" style="display:none;">0</span>
          </a>
          <!-- Shopping Cart -->
          <a href="cart.html" class="action-btn cart-icon ${active === 'cart' ? 'active' : ''}" data-i18n-title="common.cart_title" title="السلة">
            <i class="fas fa-bag-shopping"></i>
            <span class="badge-count cart-count" style="display:none;">0</span>
          </a>
          <!-- User Profile -->
          <a href="account.html" class="action-btn user-icon ${active === 'account' ? 'active' : ''}" data-i18n-title="common.my_account" title="حسابي">
            <i class="fas fa-user"></i>
          </a>
          <!-- Mobile Menu Trigger -->
          <button type="button" class="mobile-menu-btn" data-i18n-title="common.menu" data-i18n-aria-label="common.menu" aria-label="القائمة">
            <i class="fas fa-bars"></i>
          </button>
        </div>
      </div>

      <!-- Categories Sub-navigation Bar -->
      <nav class="sub-nav">
        <div class="container sub-nav-container">
          <ul class="nav-links">
            <li><a href="index.html" class="${active === 'home' ? 'active' : ''}"><i class="fas fa-house"></i> <span data-i18n="nav.home">الرئيسية</span></a></li>
            <li><a href="shop.html" class="${active === 'shop' ? 'active' : ''}"><i class="fas fa-th-large"></i> <span data-i18n="categories.all">جميع المنتجات</span></a></li>
            <li><a href="shop.html?category=أزياء وملابس"><span data-i18n="categories.fashion">أزياء وملابس</span></a></li>
            <li><a href="shop.html?category=ساعات وإكسسوارات"><span data-i18n="categories.watches">ساعات وإكسسوارات</span></a></li>
            <li><a href="shop.html?category=عطور ومستحضرات تجميل"><span data-i18n="categories.beauty">عطور وتجميل</span></a></li>
            <li><a href="shop.html?category=منزل وديكور"><span data-i18n="categories.home">منزل وديكور</span></a></li>
            <li><a href="shop.html?category=هواتف وإلكترونيات"><span data-i18n="categories.electronics">إلكترونيات</span></a></li>
          </ul>
        </div>
      </nav>
    </header>
    `;
  }

  function getFooterTemplate() {
    return `
    <footer id="main-footer" class="site-footer" data-layout-rendered="true">
      <div class="container">
        <div class="footer-grid">
          <!-- Store Description -->
          <div class="footer-col">
            <div class="footer-brand-lockup">
              <img src="/images/logo-32.webp" srcset="/images/logo-32.webp 1x, /images/logo-64.webp 2x" alt="" class="site-logo-img" width="32" height="32" style="border-radius: 8px; vertical-align: middle;" loading="lazy">
              <span class="footer-brand dynamic-store-name" data-i18n="footer.brand">المتجر الإلكتروني</span>
            </div>
            <p class="footer-tagline" data-i18n="footer.tagline">وجهتك الموثوقة للتسوق الإلكتروني في الجزائر، منتجات عالية الجودة، شحن سريع لـ 58 ولاية، وضمان الدفع عند الاستلام.</p>
            <div class="footer-badges">
              <span class="footer-trust-tag"><i class="fas fa-shield-halved text-success"></i> <span data-i18n="footer.genuine_products">100% منتجات أصلية</span></span>
              <span class="footer-trust-tag"><i class="fas fa-box-open text-primary"></i> <span data-i18n="footer.inspect_on_delivery">فحص عند الاستلام</span></span>
            </div>
          </div>

          <!-- Quick Links -->
          <div class="footer-col">
            <h3 data-i18n="footer.quick_links">روابط سريعة</h3>
            <ul class="footer-links">
              <li><a href="index.html"><i class="fas fa-angle-left"></i> <span data-i18n="footer.link_home">الرئيسية</span></a></li>
              <li><a href="shop.html"><i class="fas fa-angle-left"></i> <span data-i18n="footer.link_shop">متجر المنتجات</span></a></li>
              <li><a href="cart.html"><i class="fas fa-angle-left"></i> <span data-i18n="footer.link_cart">سلة التسوق</span></a></li>
              <li><a href="wishlist.html"><i class="fas fa-angle-left"></i> <span data-i18n="footer.link_wishlist">قائمة المفضلة</span></a></li>
              <li><a href="track-order.html"><i class="fas fa-angle-left"></i> <span data-i18n="footer.link_track">تتبع طلبيتك</span></a></li>
              <li><a href="terms.html"><i class="fas fa-angle-left"></i> <span data-i18n="footer.link_terms">الشروط والأحكام</span></a></li>
              <li><a href="privacy.html"><i class="fas fa-angle-left"></i> <span data-i18n="footer.link_privacy">سياسة الخصوصية</span></a></li>
            </ul>
          </div>

          <!-- Customer Support -->
          <div class="footer-col">
            <h3 data-i18n="footer.contact">خدمة العملاء والتواصل</h3>
            <ul class="footer-contact-list">
              <li><i class="fas fa-map-pin text-primary"></i> <span data-i18n="footer.address" class="footer-address">الجزائر العاصمة، الجزائر</span></li>
              <li><i class="fas fa-envelope text-primary"></i> <span class="footer-email">contact@rewaq.dz</span></li>
              <li><i class="fas fa-clock text-primary"></i> <span data-i18n="footer.hours">السبت - الخميس: 9:00 ص - 6:00 م</span></li>
              <li><i class="fas fa-headset text-primary"></i> <span data-i18n="footer.tech_support">دعم فني واستفسارات مستمرة</span></li>
            </ul>
          </div>

          <!-- Payment Methods & Social -->
          <div class="footer-col">
            <h3 data-i18n="footer.payment_shipping">طرق الدفع والشحن</h3>
            <p class="footer-payment-desc" data-i18n="footer.payment_desc">نقبل الدفع الآمن عند الاستلام أو عبر البطاقات الإلكترونية الجزائرية:</p>
            <div class="payment-badges-row">
              <span class="payment-badge"><i class="fas fa-money-bill-wave text-success"></i> <span data-i18n="footer.cod_cash">COD نقداً عند الاستلام</span></span>
              <span class="payment-badge"><i class="fas fa-credit-card text-secondary"></i> EDAHABIA / CIB</span>
            </div>
            <h4 class="footer-sub-heading" data-i18n="footer.follow">تابعنا على الشبكات</h4>
            <div class="social-links">
              <a href="#" title="Facebook" class="social-btn facebook" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
              <a href="#" title="Instagram" class="social-btn instagram" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
              <a href="#" title="TikTok" class="social-btn tiktok" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <p class="copyright-text">&copy; <span class="dynamic-year">2026</span> <span class="dynamic-store-name">متجر رواق</span>. <span data-i18n="common.rights_reserved">جميع الحقوق محفوظة.</span></p>
          <div class="footer-bottom-trust">
            <span data-i18n="footer.made_in">صُمم بأعلى معايير الأمان والتجارة الإلكترونية في الجزائر 🇩🇿</span>
          </div>
        </div>
      </div>
    </footer>
    `;
  }

  function getMobileBottomNavTemplate() {
    const active = getActivePageKey();
    return `
    <nav class="mobile-bottom-nav" aria-label="Mobile Navigation">
      <a href="index.html" class="mobile-nav-item ${active === 'home' ? 'active' : ''}">
        <i class="fas fa-house"></i>
        <span data-i18n="nav.home">الرئيسية</span>
      </a>
      <a href="shop.html" class="mobile-nav-item ${active === 'shop' ? 'active' : ''}">
        <i class="fas fa-th-large"></i>
        <span data-i18n="nav.shop">التسوق</span>
      </a>
      <a href="wishlist.html" class="mobile-nav-item ${active === 'wishlist' ? 'active' : ''}">
        <div class="nav-icon-badge-wrap">
          <i class="fas fa-heart"></i>
          <span class="mobile-badge wishlist-count" id="mobile-wishlist-count" style="display:none;">0</span>
        </div>
        <span data-i18n="common.wishlist">المفضلة</span>
      </a>
      <a href="cart.html" class="mobile-nav-item ${active === 'cart' ? 'active' : ''}">
        <div class="nav-icon-badge-wrap">
          <i class="fas fa-bag-shopping"></i>
          <span class="mobile-badge cart-count" id="mobile-cart-count" style="display:none;">0</span>
        </div>
        <span data-i18n="common.cart_title">السلة</span>
      </a>
      <a href="account.html" class="mobile-nav-item ${active === 'account' ? 'active' : ''}">
        <i class="fas fa-user"></i>
        <span data-i18n="common.my_account">حسابي</span>
      </a>
    </nav>
    `;
  }

  function syncCounters() {
    // 1. Sync Cart Count
    try {
      const savedCart = localStorage.getItem('cart');
      const items = savedCart ? JSON.parse(savedCart) : [];
      const count = Array.isArray(items) ? items.reduce((s, it) => s + (it.quantity || 1), 0) : 0;
      document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? '' : 'none';
      });
    } catch (e) {}

    // 2. Sync Wishlist Count
    try {
      const savedWish = localStorage.getItem('wishlist');
      const ids = savedWish ? JSON.parse(savedWish) : [];
      const count = Array.isArray(ids) ? ids.length : 0;
      document.querySelectorAll('#wishlist-count, .wishlist-count').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? '' : 'none';
      });
    } catch (e) {}
  }

  function updateSearchPlaceholders() {
    const isMobile = window.matchMedia('(max-width: 480px)').matches;
    const targetKey = isMobile ? 'common.search_placeholder_short' : 'common.search_placeholder';
    const shortText = window.I18n && typeof window.I18n.t === 'function' ? window.I18n.t('common.search_placeholder_short', 'ابحث عن منتج...') : 'Search...';
    const fullText = window.I18n && typeof window.I18n.t === 'function' ? window.I18n.t('common.search_placeholder', 'ابحث عن ملابس، إلكترونيات، عطور، أدوات منزلية...') : 'Search...';
    const text = isMobile ? shortText : fullText;

    document.querySelectorAll('.header-search input[name="search"], .header-search-form input[type="text"]').forEach(input => {
      input.setAttribute('data-i18n-placeholder', targetKey);
      input.placeholder = text;
    });
  }

  function initLayout() {
    // Target element: #site-header or <header data-layout="auto"> or first <header>
    const headerPlaceholder = document.getElementById('site-header') || document.querySelector('header[data-layout="auto"]');
    if (headerPlaceholder) {
      headerPlaceholder.outerHTML = getHeaderTemplate();
    }

    // Target element: #site-footer or #main-footer or <footer data-layout="auto"> or first <footer>
    const footerPlaceholder = document.getElementById('site-footer') 
      || document.querySelector('footer[data-layout="auto"]') 
      || (!document.querySelector('footer[data-layout-rendered="true"]') ? (document.getElementById('main-footer') || document.querySelector('footer')) : null);
    if (footerPlaceholder && !footerPlaceholder.hasAttribute('data-layout-rendered')) {
      footerPlaceholder.outerHTML = getFooterTemplate();
    } else if (!document.querySelector('footer')) {
      const footerWrapper = document.createElement('div');
      footerWrapper.innerHTML = getFooterTemplate();
      if (footerWrapper.firstElementChild) {
        document.body.appendChild(footerWrapper.firstElementChild);
      }
    }

    // Target element: mobile bottom nav
    if (!document.querySelector('.mobile-bottom-nav')) {
      const bottomNavWrapper = document.createElement('div');
      bottomNavWrapper.innerHTML = getMobileBottomNavTemplate();
      if (bottomNavWrapper.firstElementChild) {
        document.body.appendChild(bottomNavWrapper.firstElementChild);
      }
    }

    // Dynamic current year sync
    document.querySelectorAll('.dynamic-year').forEach(el => {
      el.textContent = new Date().getFullYear();
    });

    // Sync counters
    syncCounters();

    // Sync responsive search placeholder
    updateSearchPlaceholders();

    // Trigger i18n translation on newly injected layout elements only if language is not Arabic
    if (window.I18n && typeof window.I18n.translatePage === 'function' && window.I18n.currentLang !== 'ar') {
      window.I18n.translatePage();
    }
  }

  // Setup responsive search placeholder listeners
  try {
    const mql = window.matchMedia('(max-width: 480px)');
    if (mql.addEventListener) {
      mql.addEventListener('change', updateSearchPlaceholders);
    } else if (mql.addListener) {
      mql.addListener(updateSearchPlaceholders);
    }
  } catch (e) {}

  window.addEventListener('languageChanged', updateSearchPlaceholders);

  // Auto-init on DOMContentLoaded or immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayout);
  } else {
    initLayout();
  }

  window.ShopLayout = {
    init: initLayout,
    getHeaderTemplate,
    getFooterTemplate,
    getMobileBottomNavTemplate,
    syncCounters,
    updateSearchPlaceholders
  };
})();

document.addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl && actionEl.dataset.action === 'toggleTheme') {
        if (typeof window.toggleTheme === 'function') window.toggleTheme();
    }
});
