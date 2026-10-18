const CACHE_NAME = 'myshop-pwa-v35f90f94ea';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/shop.html',
  '/product.html',
  '/cart.html',
  '/checkout.html',
  '/account.html',
  '/wishlist.html',
  '/track-order.html',
  '/order-confirmation.html',
  '/invoice.html',
  '/terms.html',
  '/privacy.html',
  '/css/style.min.css',
  '/css/invoice.css',
  '/css/order-confirmation.css',
  '/fonts/fonts.css',
  '/vendor/fontawesome/css/all.min.css',
  '/vendor/fontawesome/webfonts/fa-solid-900.woff2',
  '/vendor/fontawesome/webfonts/fa-regular-400.woff2',
  '/vendor/fontawesome/webfonts/fa-brands-400.woff2',
  '/fonts/font-1.woff2',
  '/fonts/font-2.woff2',
  '/fonts/font-3.woff2',
  '/js/layout.js',
  '/js/theme-init.js',
  '/js/api-client.js',
  '/js/main.js',
  '/js/cart.js',
  '/js/wishlist.js',
  '/js/checkout.js',
  '/js/user-system.js',
  '/js/i18n.js',
  '/js/pages/terms.js',
  '/js/pages/privacy.js',
  '/locales/ar.json',
  '/locales/fr.json',
  '/locales/en.json',
  '/manifest.json'
];
const CACHE_VERSION_ASSETS = [
  '/js/pages/index.js',
  '/js/pages/shop.js',
  '/js/pages/product.js',
  '/js/pages/cart.js',
  '/js/pages/checkout.js',
  '/js/pages/account.js',
  '/js/pages/wishlist.js',
  '/js/pages/track-order.js',
  '/images/hero-banner.jpg',
  '/images/hero-banner.webp',
  '/images/prod_classic_watch.jpg',
  '/images/prod_cookware.jpg',
  '/images/prod_linen_shirt.jpg',
  '/images/prod_linen_shirt_navy.jpg',
  '/images/prod_linen_shirt_white.jpg',
  '/images/prod_perfume.jpg',
  '/images/prod_sneakers.jpg',
  '/images/prod_sneakers_black.jpg',
  '/images/prod_summer_dress.jpg',
  '/images/prod_summer_dress_coral.jpg',
  '/images/christopher-gower-m_HRfLhgABo-unsplash.jpg',
  '/images/samsung-memory-RZM2cE0lx0Y-unsplash.jpg',
  '/images/product-placeholder.jpg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - purge all old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 2. Only intercept same-origin requests!
  // Cross-origin requests (Google Fonts, cdnjs, external analytics, antivirus like Kaspersky, etc.)
  // must NOT be intercepted by the service worker to prevent cross-world preload mismatches and CSP blocks.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. For modifying API requests (POST/PUT/DELETE) -> strictly Network Only
  if (event.request.method !== 'GET') {
    return;
  }

  // 4. Bypass Service Worker completely for admin pages and admin assets
  if (url.pathname.startsWith('/admin')) {
    return;
  }

  // 4. For GET API requests (e.g. /api/products, /api/wilayas) -> Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 5. For HTML navigation and page requests -> Network First, fallback to cache if offline
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 6. For JS, CSS, and JSON assets -> Network First to ensure instant updates, fallback to cache
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 7. For Static Media Assets (images, fonts) -> Cache-first with background revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately, fetch update in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
          })
          .catch(() => {
            // Background update failure is safe to ignore
          });
        return cachedResponse;
      }

      // Not in cache yet: fetch from network
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    })
  );
});
