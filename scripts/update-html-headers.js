const fs = require('fs');
const path = require('path');

const titles = {
  'index.html': {
    title: '<title data-i18n="home.meta.title">متجر رواق - متجر إلكتروني عربي احترافي متعدد الأقسام</title>',
    desc: '<meta name="description" data-i18n="home.meta.description" content="سكربت متجر إلكتروني عربي حديث ومتكامل يدعم الدفع عند الاستلام، السلة، المفضلة، وتتبع الشحنات.">'
  },
  'shop.html': {
    title: '<title data-i18n="shop.meta_title">التسوق | متجر رواق - تصفح المنتجات والتصنيفات</title>'
  },
  'product.html': {
    title: '<title data-i18n="product.meta_title">تفاصيل المنتج | متجر رواق</title>'
  },
  'cart.html': {
    title: '<title data-i18n="cart.meta_title">سلة التسوق | متجر رواق</title>'
  },
  'checkout.html': {
    title: '<title data-i18n="checkout.meta_title">إتمام الطلب | متجر رواق - شراء آمن ودفع عند الاستلام</title>'
  },
  'wishlist.html': {
    title: '<title data-i18n="wishlist.meta_title">قائمة الرغبات | متجر رواق - منتجاتك المفضلة</title>'
  },
  'track-order.html': {
    title: '<title data-i18n="track.meta_title">تتبع الطلب | متجر رواق - متابعة حالة شحنتك خطوة بخطوة</title>'
  },
  'account.html': {
    title: '<title data-i18n="account.title">حسابي | متجر رواق - إدارة الحساب والطلبات</title>'
  },
  'order-confirmation.html': {
    title: '<title data-i18n="conf.meta_title">تأكيد الطلب | متجر رواق</title>'
  },
  'invoice.html': {
    title: '<title data-i18n="invoice.title">فاتورة الشراء | متجر رواق</title>'
  },
  'terms.html': {
    title: '<title data-i18n="terms.meta_title">الشروط والأحكام | متجر رواق</title>'
  },
  'privacy.html': {
    title: '<title data-i18n="privacy.meta_title">سياسة الخصوصية | متجر رواق</title>'
  }
};

const inlineThemeScript = `    <!-- Theme Anti-Flicker (Executes synchronously before stylesheets load) -->
    <script>
      (function() {
        try {
          var t = localStorage.getItem('theme');
          if (!t) {
            t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
          }
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.classList.toggle('dark', t === 'dark');
        } catch (e) {}
      })();
    </script>`;

const allHtmlFiles = [
  'index.html',
  'shop.html',
  'product.html',
  'cart.html',
  'checkout.html',
  'wishlist.html',
  'track-order.html',
  'account.html',
  'order-confirmation.html',
  'invoice.html',
  'landing.html',
  'terms.html',
  'privacy.html',
  'admin/coupons.html',
  'admin/index.html',
  'admin/orders.html',
  'admin/products.html',
  'admin/reviews.html',
  'admin/settings.html',
  'admin/users.html',
  'documentation/index.html'
];

allHtmlFiles.forEach(relPath => {
  const fullPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) return;
  let html = fs.readFileSync(fullPath, 'utf8');

  // 1. Update title & desc if in titles mapping
  const base = path.basename(relPath);
  if (titles[base]) {
    html = html.replace(/<title[^>]*>.*?<\/title>/i, titles[base].title);
    if (titles[base].desc) {
      html = html.replace(/<meta name=["']description["'][^>]*>/i, titles[base].desc);
    }
  }

  // 2. Remove old external theme-init scripts to prevent double execution / blocking
  html = html.replace(/[ \t]*<!--\s*Theme Anti-Flicker\s*-->\s*/gi, '');
  html = html.replace(/[ \t]*<script[^>]*theme-init\.js[^>]*><\/script>\s*/gi, '');

  // 3. Insert inline anti-flicker script immediately after <meta charset="..."> if not already inline
  if (!html.includes("localStorage.getItem('theme')")) {
    html = html.replace(/(<meta\s+charset=["'][^"']+["'][^>]*>)/i, `$1\n${inlineThemeScript}`);
  }

  fs.writeFileSync(fullPath, html, 'utf8');
  console.log(`✔ Processed ${relPath}`);
});
