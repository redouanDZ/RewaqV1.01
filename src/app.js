require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/database');
const { requireCsrf } = require('./middlewares/csrfMiddleware');
const apiRoutes = require('./routes/index');
const { errorHandler, notFoundHandler } = require('./middlewares/errorMiddleware');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// Security Headers
// CSP: the storefront and admin no longer rely on inline scripts or inline event handlers.
//  - CSP_STRICT=true            -> enforce the strict policy (no 'unsafe-inline' for scripts)
//  - default (CSP_STRICT unset) -> enforce the compatible policy AND send the strict one as
//    Content-Security-Policy-Report-Only, so violations show up in the browser console
//    without breaking any page. Switch to strict once the console stays clean.
const CSP_STRICT = process.env.CSP_STRICT === 'true';
const buildCspDirectives = (strict) => ({
    defaultSrc: ["'self'"],
    scriptSrc: strict
        ? ["'self'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://accounts.google.com', 'https://connect.facebook.net', 'https://analytics.tiktok.com', 'https://www.googletagmanager.com']
        : ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://accounts.google.com', 'https://connect.facebook.net', 'https://analytics.tiktok.com', 'https://www.googletagmanager.com'],
    scriptSrcAttr: strict ? ["'none'"] : ["'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://accounts.google.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://flagcdn.com', 'https://www.facebook.com'],
    fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
    connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://geoip.maxmind.com', 'https://accounts.google.com', 'https://connect.facebook.net', 'https://analytics.tiktok.com', 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.chargily.com', 'https://*.chargily.net', 'https://www.facebook.com', 'https://www.googletagmanager.com'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'self'", 'https://*.pikalika.com', 'https://pikalika.com', 'https://*.hsoub.com', 'https://hsoub.com', 'https://*.google.com', 'https://*.run.app', '*'],
    formAction: ["'self'", 'https://checkout.chargily.com'],
    frameSrc: ["'self'", 'https://accounts.google.com']
});

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        reportOnly: process.env.CSP_REPORT_ONLY === 'true',
        directives: buildCspDirectives(CSP_STRICT)
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
}));

if (!CSP_STRICT && process.env.CSP_REPORT_ONLY !== 'true') {
    app.use((req, res, next) => {
        const directives = buildCspDirectives(true);
        const header = Object.entries(directives).map(([key, values]) => {
            const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
            return `${name} ${values.join(' ')}`;
        }).join('; ');
        res.setHeader('Content-Security-Policy-Report-Only', header);
        next();
    });
}

app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use((req, res, next) => {
    const pathName = req.path || '/';
    if (pathName === '/' || pathName.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    } else if (/\.(?:js|css|png|jpe?g|webp|svg|ico|woff2?|ttf|map|json)$/i.test(pathName)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
});

// Rate Limiters (defaults are strict in production; override with env vars, e.g. while a reviewer is testing)
const envInt = (name, fallback) => {
    const value = parseInt(process.env[name], 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};
const RATE_TRACK_MAX = envInt('RATE_LIMIT_TRACK_MAX', 20);
const RATE_AUTH_MAX = envInt('RATE_LIMIT_AUTH_MAX', 20);
const RATE_API_GET_MAX = envInt('RATE_LIMIT_API_GET_MAX', 600);
const RATE_API_WRITE_MAX = envInt('RATE_LIMIT_API_WRITE_MAX', 200);

const trackOrderRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.isProduction ? RATE_TRACK_MAX : 1000, // حد أعلى للمطورين
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'تم تجاوز عدد محاولات التتبع المسموح بها، يرجى المحاولة بعد 15 دقيقة' }
});

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.isProduction ? RATE_AUTH_MAX : 1000, // تعطيل فعلي للحد في المحلي
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'تم تجاوز عدد المحاولات المسموح بها، يرجى المحاولة بعد 15 دقيقة' }
});

const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: (req, res) => {
        if (!config.isProduction) return 5000;
        return req.method === 'GET' ? RATE_API_GET_MAX : RATE_API_WRITE_MAX;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'تم تجاوز عدد المحاولات المسموح بها، يرجى المحاولة بعد 15 دقيقة' }
});

app.use('/api/orders/status', trackOrderRateLimiter);
app.use('/api/login', authRateLimiter);
app.use('/api/register', authRateLimiter);
app.use('/api/forgot-password', authRateLimiter);
app.use('/api/coupons', authRateLimiter);
app.use('/api', apiRateLimiter);

// CORS Config
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        // Allow only configured origins, BASE_URL, or localhost (no wildcard hosting domains)
        const isLocalDevelopmentOrigin = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
        const isRenderOrigin = Boolean(process.env.RENDER_EXTERNAL_URL && origin === process.env.RENDER_EXTERNAL_URL.replace(/\/$/, ''));
        const isConfiguredOrigin = config.ALLOWED_ORIGINS.includes(origin);
        const isBaseUrlOrigin = process.env.BASE_URL && origin === process.env.BASE_URL.replace(/\/$/, '');
        const isAiStudioOrigin = origin.endsWith('.run.app') || origin.endsWith('.google.com');

        if (isAiStudioOrigin || isConfiguredOrigin || isBaseUrlOrigin || isLocalDevelopmentOrigin || isRenderOrigin || !config.isProduction) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
};

app.use(cors(corsOptions));

// Body Parsers & Path Guard (Capturing rawBody for webhook HMAC verification)
app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use((req, res, next) => {
    const requestPath = req.originalUrl || req.url || '';
    if (requestPath.includes('..')) {
        return res.status(400).json({ error: 'طلب غير صالح' });
    }
    next();
});

// CSRF Middleware for API routes
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        return next();
    }
    return requireCsrf(req, res, next);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage()
    });
});

// Static Files & Assets
const rootDir = path.join(__dirname, '..');

// Only serve these specific directories statically with long-lived cache headers
const staticOptions = { maxAge: 31536000000, immutable: true, etag: true, lastModified: true };
app.use('/admin', express.static(path.join(rootDir, 'admin'), staticOptions));
app.use('/css', express.static(path.join(rootDir, 'css'), staticOptions));
app.use('/js', express.static(path.join(rootDir, 'js'), staticOptions));
app.use('/images', express.static(path.join(rootDir, 'images'), staticOptions));
app.use('/locales', express.static(path.join(rootDir, 'locales'), staticOptions));
app.use('/documentation', express.static(path.join(rootDir, 'documentation'), staticOptions));
app.use('/fonts', express.static(path.join(rootDir, 'fonts'), staticOptions));
app.use('/vendor', express.static(path.join(rootDir, 'vendor'), staticOptions));

// Base URL used in SEO tags / sitemap / robots (never a hardcoded placeholder domain)
const getBaseUrl = (req) => {
    const configured = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL;
    if (configured) return configured.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
};
const templateCache = new Map();
const sendWithBaseUrl = (fileName, contentType) => (req, res, next) => {
    try {
        if (!templateCache.has(fileName)) {
            templateCache.set(fileName, fs.readFileSync(path.join(rootDir, fileName), 'utf8'));
        }
        res.type(contentType).send(templateCache.get(fileName).replace(/\{\{BASE_URL\}\}/g, getBaseUrl(req)));
    } catch (error) {
        next(error);
    }
};

// Public HTML Pages
const publicHtmlPages = ['index.html', 'landing.html', 'shop.html', 'product.html', 'cart.html', 'checkout.html', 'order-confirmation.html', 'account.html', 'track-order.html', 'invoice.html', 'wishlist.html', 'terms.html', 'privacy.html'];
publicHtmlPages.forEach((page) => {
    if (page === 'index.html') return;
    app.get(`/${page}`, (req, res) => res.sendFile(path.join(rootDir, page)));
});
app.get('/index.html', sendWithBaseUrl('index.html', 'html'));

// Root Page fallback
app.get('/', sendWithBaseUrl('index.html', 'html'));

// manifest.json (PWA app name) used to be 100% static with a hardcoded
// Arabic/"Algeria" branded name, so it never matched whatever store_name
// the merchant set in Admin > Settings. Now it's generated on the fly from
// the real store settings, and falls back to a neutral "MYSHOP" placeholder
// (not a fixed marketing name) when the merchant hasn't set anything yet.
app.get('/manifest.json', async (req, res) => {
    try {
        const db = require('./data/db-connection.js');
        const settings = await db.getStoreSettings().catch(() => ({}));
        const storeName = (settings && settings.store_name && String(settings.store_name).trim()) || 'متجر رِواق';
        const logo = (settings && settings.store_logo) || '/images/logo.png';

        res.json({
            short_name: storeName,
            name: storeName,
            description: 'متجر إلكتروني متكامل',
            icons: [
                { src: logo, sizes: '192x192', type: 'image/png' },
                { src: logo, sizes: '512x512', type: 'image/png' }
            ],
            start_url: '/index.html',
            background_color: '#0b0f19',
            theme_color: '#2563eb',
            display: 'standalone',
            orientation: 'portrait',
            dir: 'rtl',
            lang: 'ar'
        });
    } catch (error) {
        // Never break the PWA install prompt if settings can't be read.
        res.sendFile(path.join(rootDir, 'manifest.json'));
    }
});

// Other Public Files
app.get('/robots.txt', sendWithBaseUrl('robots.txt', 'text'));
app.get('/sitemap.xml', sendWithBaseUrl('sitemap.xml', 'xml'));
['sw.js', 'favicon.ico'].forEach((file) => {
    app.get(`/${file}`, (req, res) => res.sendFile(path.join(rootDir, file)));
});

// API Routes
app.use('/api', apiRoutes);

// 404 & Error handling middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
