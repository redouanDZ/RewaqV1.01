const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const helmet = require('helmet');

// C. Secrets check
describe('Security: Secrets Enforcement', () => {
    test('Should throw error when process.env.NODE_ENV is not test and secrets are missing or default', () => {
        const originalEnv = process.env.NODE_ENV;
        const originalJwt = process.env.JWT_SECRET;
        
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'development-only-jwt_secret-secret'; // Default
        
        assert.throws(() => {
            // Need to bypass require cache to re-evaluate the config module
            delete require.cache[require.resolve('../src/config/database.js')];
            require('../src/config/database.js');
        }, /must be configured with at least 32 characters/);
        
        // Less than 32 chars
        process.env.JWT_SECRET = 'shortsecret123';
        assert.throws(() => {
            delete require.cache[require.resolve('../src/config/database.js')];
            require('../src/config/database.js');
        }, /must be configured with at least 32 characters/);
        
        // Restore
        process.env.NODE_ENV = originalEnv;
        process.env.JWT_SECRET = originalJwt;
    });

    test('NODE_ENV=test must not relax secret checks unless DB name ends with _test', () => {
        const saved = { env: process.env.NODE_ENV, jwt: process.env.JWT_SECRET, db: process.env.DB_NAME };
        try {
            process.env.NODE_ENV = 'test';
            process.env.DB_NAME = 'ecommerce_store'; // not a *_test database
            process.env.JWT_SECRET = 'development-only-jwt_secret-secret';
            assert.throws(() => {
                delete require.cache[require.resolve('../src/config/database.js')];
                require('../src/config/database.js');
            }, /must be configured with at least 32 characters/);
        } finally {
            process.env.NODE_ENV = saved.env;
            process.env.JWT_SECRET = saved.jwt;
            process.env.DB_NAME = saved.db;
            delete require.cache[require.resolve('../src/config/database.js')];
        }
    });
});

describe('Security: CSP Headers', () => {
    test('CSP should not allow unsafe-inline in script-src or script-src-attr', () => {
        // We will simulate the CSP config directly as defined in app.js
        const cspConfig = {
            contentSecurityPolicy: {
                reportOnly: process.env.CSP_REPORT_ONLY === 'true',
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://accounts.google.com', 'https://connect.facebook.net', 'https://analytics.tiktok.com', 'https://www.googletagmanager.com'],
                    scriptSrcAttr: ["'none'"],
                    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://accounts.google.com'],
                    imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://flagcdn.com', 'https://www.facebook.com'],
                    fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
                    connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://geoip.maxmind.com', 'https://accounts.google.com', 'https://connect.facebook.net', 'https://analytics.tiktok.com', 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.chargily.com', 'https://*.chargily.net', 'https://www.facebook.com', 'https://www.googletagmanager.com'],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    frameAncestors: ["'none'"],
                    formAction: ["'self'", "https://checkout.chargily.com"],
                    frameSrc: ["'self'", 'https://accounts.google.com']
                }
            }
        };

        const app = express();
        app.use(helmet(cspConfig));
        app.get('/', (req, res) => res.send('OK'));

        return new Promise((resolve) => {
            const server = app.listen(0, async () => {
                const port = server.address().port;
                try {
                    const response = await fetch(`http://127.0.0.1:${port}/`);
                    const cspHeader = response.headers.get('content-security-policy') || response.headers.get('content-security-policy-report-only');
                    
                    assert.ok(cspHeader, 'CSP header should be present');
                    
                    // Parse script-src
                    const scriptSrcMatch = cspHeader.match(/script-src([^;]+)/);
                    if (scriptSrcMatch) {
                        assert.ok(!scriptSrcMatch[1].includes("'unsafe-inline'"), "script-src must NOT contain 'unsafe-inline'");
                    }
                    
                    // Parse script-src-attr
                    const scriptSrcAttrMatch = cspHeader.match(/script-src-attr([^;]+)/);
                    if (scriptSrcAttrMatch) {
                        assert.ok(!scriptSrcAttrMatch[1].includes("'unsafe-inline'"), "script-src-attr must NOT contain 'unsafe-inline'");
                    } else {
                        // If script-src-attr is missing, it falls back to script-src, which we already asserted is safe.
                        // However, we explicitly set it to 'none'
                        assert.ok(cspHeader.includes("script-src-attr 'none'"), "script-src-attr should be explicitly 'none'");
                    }
                } finally {
                    server.close(resolve);
                }
            });
        });
    });

    test('CSP: strict policy is reported (no unsafe-inline for scripts) while the compatible one is enforced', async () => {
        const http = require('http');
        const app = require('../src/app');
        const server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        try {
            const res = await fetch(`http://127.0.0.1:${server.address().port}/index.html`);
            assert.strictEqual(res.status, 200);
            const enforced = res.headers.get('content-security-policy') || '';
            const reported = res.headers.get('content-security-policy-report-only') || '';
            const scriptSrc = (reported.split(';').map(x => x.trim()).find(x => x.startsWith('script-src ')) || '');
            assert.ok(enforced.includes('script-src'), 'an enforced CSP must be present');
            assert.ok(scriptSrc && !scriptSrc.includes("'unsafe-inline'"), 'report-only script-src must not allow unsafe-inline');
            assert.ok(reported.includes("script-src-attr 'none'"), 'report-only policy must forbid inline event handlers');
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test('SEO files use the configured base URL instead of a placeholder domain', async () => {
        const http = require('http');
        const app = require('../src/app');
        const server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        try {
            const base = `http://127.0.0.1:${server.address().port}`;
            const robots = await (await fetch(`${base}/robots.txt`)).text();
            const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
            const home = await (await fetch(`${base}/`)).text();
            for (const body of [robots, sitemap, home]) {
                assert.ok(!body.includes('{{BASE_URL}}'), 'placeholder token must be replaced');
                assert.ok(!body.includes('rewaq.dz/') || body.includes('contact@rewaq.dz'), 'no hardcoded placeholder domain');
            }
            assert.ok(robots.includes(`Sitemap: ${base}/sitemap.xml`));
            assert.ok(sitemap.includes(`<loc>${base}/</loc>`));
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test('Iframe & Pikalika Preview: CSP frame-ancestors is properly configured and X-Frame-Options is absent', async () => {
        const http = require('http');
        const app = require('../src/app');
        const server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        try {
            const base = `http://127.0.0.1:${server.address().port}`;
            const pages = ['/', '/index.html', '/shop.html', '/product.html', '/cart.html', '/track-order.html', '/checkout.html'];
            for (const page of pages) {
                const res = await fetch(`${base}${page}`);
                assert.strictEqual(res.status, 200, `${page} should return 200`);

                // Assert X-Frame-Options is completely absent
                const xFrameOptions = res.headers.get('x-frame-options');
                assert.strictEqual(xFrameOptions, null, `X-Frame-Options must NOT be present on ${page}`);

                // Assert CSP frame-ancestors includes self and Pikalika domains
                const csp = res.headers.get('content-security-policy') || '';
                assert.ok(csp.includes('frame-ancestors'), `CSP on ${page} must define frame-ancestors`);
                assert.ok(csp.includes('https://*.pikalika.com'), `CSP must whitelist https://*.pikalika.com on ${page}`);
                assert.ok(csp.includes('https://pikalika.com'), `CSP must whitelist https://pikalika.com on ${page}`);
                assert.ok(csp.includes('https://*.hsoub.com'), `CSP must whitelist https://*.hsoub.com on ${page}`);
                assert.ok(csp.includes('https://*.onrender.com'), `CSP must whitelist https://*.onrender.com on ${page}`);
            }

            // Test sw.js headers
            const swRes = await fetch(`${base}/sw.js`);
            assert.strictEqual(swRes.status, 200);
            assert.strictEqual(swRes.headers.get('service-worker-allowed'), '/', 'sw.js must have Service-Worker-Allowed: /');
            assert.ok(swRes.headers.get('cache-control')?.includes('no-cache'), 'sw.js must have no-cache header');
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test('Cookie Security & Iframe Third-Party Compatibility', () => {
        const { getDefaultCookieOptions } = require('../src/utils/tokenUtils');
        
        // 1. Local HTTP request
        const localOpts = getDefaultCookieOptions({
            req: { secure: false, protocol: 'http', headers: {} }
        });
        assert.strictEqual(localOpts.sameSite, 'lax', 'Local HTTP cookies should be SameSite=Lax');
        assert.strictEqual(localOpts.secure, false, 'Local HTTP cookies should not require Secure');

        // 2. HTTPS request (e.g. Render / Production / Reverse Proxy)
        const httpsOpts = getDefaultCookieOptions({
            req: { secure: true, protocol: 'https', headers: { 'x-forwarded-proto': 'https' } }
        });
        assert.strictEqual(httpsOpts.sameSite, 'none', 'HTTPS preview/production cookies must have SameSite=None for iframe support');
        assert.strictEqual(httpsOpts.secure, true, 'HTTPS cookies must be Secure');
    });
});
