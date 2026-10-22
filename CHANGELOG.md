# Changelog

All notable changes to the Rewaq e-commerce platform are documented in this file.

## [Unreleased] - Review round fixes
- Checkout: payment methods now render full-width, one per row.
- Home: featured products use 2 columns on phones and 4 from 700px (no orphan row).
- Product page: similar products show their category instead of a generic label.
- Demo data: removed irrelevant gallery images (watch, cookware); migration 018 cleans live data and removes brand names from the demo camera text.

## [1.1.1] - 2026-10-16

### Marketplace Review & UX Optimizations (Beekalia Compliance)
- **Eliminated Dark Mode Flicker (FOUC)**: Added zero-latency inline theme-resolution script at the very top of `<head>` across all 21 HTML documents before stylesheet parsing. Removed body background transition on page load so dark mode renders instantaneously without any white flash or delayed color transition during page navigation. Added dynamic `.theme-transitioning` class only during user-initiated toggles.
- **Search Component Layout & Spacing**: Resolved the search button sticking issue across all viewports. Added a unified rounded pill container (`border-radius: 999px`), responsive internal gaps (`gap: 8px` to `gap: 10px`), separated button margins (`margin: 2px`), and comfortable input padding (`padding-inline: 4px 8px`) ensuring the search button never contacts the input edge or container boundary.
- **Titles & SEO Standardization**: Standardized main product and page titles across the entire store adhering strictly to the Beekalia format (`متجر رواق - متجر إلكتروني عربي احترافي متعدد الأقسام`) without repeating keywords. Updated `title` and `meta description` tags across HTML files and synchronized all 3 locale dictionaries (`ar.json`, `en.json`, `fr.json`).
- **Comprehensive Assets Licensing Documentation**: Added [`ASSETS_LICENSE.md`](ASSETS_LICENSE.md) providing direct source URLs, authors, and commercial usage licenses for all demo images (Unsplash Commercial License), icons (Font Awesome 6 Free), typography (Google Fonts SIL OFL 1.1), flags, and branding assets.
- **Mobile Touch Usability (WCAG 2.5.5/2.5.8)**: Raised `.mobile-nav-item` touch targets to a minimum of 48px × 48px to meet AAA accessibility standards on touchscreen devices.
- **Hero CTA & Visual Contrast**: Re-engineered `.btn-hero-primary` with elevated contrast, warm orange gradient, 3D shadow, and pill border-radius. Raised card price contrast to 6.68:1 (light) and 8.21:1 (dark).
- **Dark Mode Skeleton Shimmer**: Added dark-mode aware `@keyframes skeleton-shimmer-dark` animation for product card skeletons.
- **Real-Time Input Validation**: Added live validation feedback to phone and order input fields in order tracking.
- **Rebuilt CSS Distribution**: Recompiled and minified all stylesheets (`css/style.min.css` and `admin/css/dashboard.min.css`) with LightningCSS.

## [1.1.0] - 2026-10-14

### New Features & Payments
- **Algerian CCP & BaridiMob Payment Support**: Integrated postal account configuration in the store settings with automated validation and digit normalization for CCP account numbers and keys (RIP / Clé).
- **Public Product Privacy & Margin Protection**: Completely removed `cost_price` from all public API responses (product lists, details, related recommendations), reserving profitability metrics exclusively for authenticated administrators.
- **Draft Products Access Control**: Draft products are strictly invisible to storefront visitors and return a clean 404 response even if accessed directly by ID.

### Security & Hardening
- **Public Store Settings Sanitization**: Enforced a strict key allow-list on the public `/api/settings` endpoint, ensuring operational secrets (such as Telegram bot tokens and chat IDs) are never exposed to clients.
- **Strict Content Security Policy (CSP)**: Enhanced CSP headers with report-only mode and full external script compliance; all inline scripts eliminated.
- **CORS & Rate Limiting Hardening**: Removed wildcard origin rules for Render domains and added granular `RATE_LIMIT_*` environment variables.

### UI & Dark Mode Usability
- **Select Dropdown Dark Mode Fix**: Added `color-scheme: dark` and explicit `<option>` background/color styles to prevent native browser dropdown popups from rendering blank/white-on-white text in dark mode.
- **Autofill Dark Mode Normalization**: Standardized `:-webkit-autofill` styling across form inputs to blend seamlessly with dark themes.
- **Admin Settings & UI Polish**: Fixed duplicate click handlers on settings actions, Telegram test alerts, and image pickers.

### Quality Assurance & Testing
- **Comprehensive Test Suite Expansion**: Expanded automated test coverage to **72 automated tests across 9 suites** (including product privacy, store settings sanitation, database sessions, and checkout flows), running cleanly in-process.

## [1.0.1] - 2026-09-30

### Storefront & Checkout
- **Product Cards**: Removed legacy conflicting CSS in `css/style.css`; unified home, shop, and related product cards with one-line action buttons, clamped titles, and aligned price/stock rows.
- **Responsive Layout**: Cart and checkout layouts rebuilt with responsive CSS Grid (`minmax(0, 1fr)`) to prevent horizontal overflow on mobile viewports.
- **Invoice & Confirmation**: Standalone printable invoice (`invoice.html`) adapted for mobile devices with responsive customer info and horizontally scrollable line-item tables; excluded global storefront bottom navigation bar from print view.
- **Touch Targets**: Raised touch targets on mobile (buttons to min 36px, wishlist icons to 34px) for better usability.
- **Localization (i18n)**: Fixed input and textarea placeholder localization using `data-i18n-placeholder` across Arabic, French, and English; removed hardcoded strings; added parity checking script (`npm run check:i18n`).
- **Asset Optimization**: Local self-hosted Font Awesome and Google Fonts (`/fonts`, `/vendor/fontawesome`); automated CSS minification (`css/style.min.css`); automated Service Worker cache version hashing (`scripts/build-sw-hash.js`).

### Admin Dashboard
- **Responsive KPI Cards**: Dashboard KPI cards dynamically adapt to fill each row without orphan cards; numbers maintain currency symbol on a single line.
- **Minification**: Admin dashboard CSS minified via automated build pipeline (`admin/css/dashboard.min.css`).
- **Touch Usability**: Pagination controls updated with minimum 36px touch targets.

### Security & Authentication
- **Database-Backed Sessions**: Transitioned session management to MySQL (`sessions` table) with server-side revocation (`revokeSession`, `revokeAllUserSessions`) and in-memory TTL caching (`SESSION_CACHE_TTL_MS`), ensuring user sessions survive server restarts while retaining instant invalidation capabilities.
- **Strict Content Security Policy (CSP)**: Completely eliminated inline scripts and event handlers across public and admin pages; enforced strict CSP via Helmet with conditional `CSP_REPORT_ONLY` support and dynamic pixel loader for Facebook, TikTok, and Google Analytics.
- **Production Guardrails**: Prevented demo seeding (`scripts/seedDemoData.js`) and demo product auto-injection from running when `NODE_ENV=production`.
- **Database Test Guard**: Enforced `*_test` naming requirement on database connections during automated test runs (`test/all.test.js`) to safeguard production databases.
- **Container Hardening**: Dockerfile updated with non-root `node` user, `--omit=dev` production installation, and native Docker `HEALTHCHECK`.

## [1.0.0] - Initial Release
- Complete Arabic (RTL), French, and English e-commerce store with Express and MySQL 8.
- Chargily Pay V2 (EDAHABIA / CIB) and Cash on Delivery (COD) payment integrations.
- Role-based admin dashboard for orders, products, variants, reviews, coupons, and customers.
- Direct 1-Click order checkout, order tracking, and thermal invoice printing.
