# Rewaq — Production Release & Deployment Checklist

---

## 🔒 1. Security & Secrets Management
- [x] Sensitive files (`.env`, `secrets.txt`, `*.pem`, `*.key`) excluded from Git (`.gitignore` verified).
- [ ] **MANDATORY**: Rotate `JWT_SECRET` with a cryptographically strong 64-char random key on production server.
- [ ] **MANDATORY**: Rotate `COOKIE_SECRET` on production server.
- [ ] **MANDATORY**: Set real production MySQL credentials (`DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`).
- [ ] **MANDATORY**: Set production Chargily Pay V2 credentials (`CHARGILY_PUBLIC_KEY`, `CHARGILY_SECRET_KEY`, `CHARGILY_MODE=live`).
- [x] No hardcoded production passwords or credentials in source code.
- [x] CSP and Helmet security headers verified and active.
- [x] Rate limiting active on authentication, tracking, and general API endpoints.
- [x] CSRF protection enforced for state-changing customer requests.

---

## 💾 2. Database & Migrations
- [x] Database migrations verified for idempotent fresh runs & upgrades (`npm run migrate`).
- [x] Migration runner `database/migrate.js` handles statements and rollbacks safely.
- [x] Production backup command (`mysqldump`) and restore instructions documented in `SETUP.md`.
- [x] Scheduled cron job for database backups configured on production host.

---

## 🐳 3. Docker & Infrastructure
- [x] Production `Dockerfile` configured with multi-stage build, healthcheck, and non-root options.
- [x] `docker-compose.yml` configured with persistent `mysql_data` volume and healthcheck dependencies.
- [x] `.dockerignore` excludes secrets, node_modules, and git history.
- [ ] Production domain DNS pointing to server IP.
- [ ] SSL / TLS Certificate (HTTPS) configured with automated renewal (Certbot / Cloudflare).

---

## 🛒 4. E-Commerce & Business Logic
- [x] Server-side price calculation enforced (client prices & totals ignored).
- [x] Atomic inventory decrement with `SELECT ... FOR UPDATE` row locking.
- [x] Guest checkout and order tracking with cryptographic tokens verified.
- [x] Algerian 58 Wilayas shipping calculation verified.
- [x] Chargily Pay V2 Webhook signature verification (HMAC-SHA256) & idempotency verified.
- [x] Algerian Postal Account (CCP / BaridiMob) RIP & Clé validation and display verified.
- [x] Discount coupons validation and usage limits verified.
- [x] Customer reviews moderation workflow verified.
- [x] Product cost price privacy enforced (never exposed on public APIs).

---

## 🌐 5. Frontend, Localization & UI/UX
- [x] Multi-language support (Arabic RTL, French LTR, English LTR) with 100% key parity (979 keys).
- [x] Dynamic language switching with localStorage persistence verified.
- [x] Dark mode dropdown menus (`color-scheme: dark`) and autofill normalization verified.
- [x] Zero horizontal overflow across Mobile (360px, 390px), Tablet (768px), and Desktop breakpoints.
- [x] Public SEO metadata, clean `robots.txt`, and canonical `sitemap.xml` verified.
- [x] Admin dashboard (Products, Orders, Customers, Coupons, Reviews, Settings) authenticated and secured.

---

## 🧪 6. Quality Assurance & Tests
- [x] `npm test`: **72/72 automated tests passing across 9 suites (0 failures)**.
- [x] `npm run lint`: **0 ESLint errors/warnings**.
- [x] `npm run check:i18n`: **100% parity across AR/FR/EN (0 missing keys, 157 error codes)**.
- [x] `npm run build`: **Production integrity validation PASSED**.
- [x] `npm audit`: **0 vulnerabilities**.
- [x] Proprietary Commercial `LICENSE` added.
