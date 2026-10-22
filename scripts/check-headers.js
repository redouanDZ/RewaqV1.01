/**
 * check-headers.js
 * 
 * Iframe Compatibility & Security Headers Verification Script:
 * 1. Checks that main pages serve Content-Security-Policy with frame-ancestors
 *    including Pikalika and Hsoub domains.
 * 2. Checks that X-Frame-Options header is absent on all pages.
 * 3. Checks that HTTPS requests receive Set-Cookie headers with SameSite=None; Secure.
 */

const http = require('http');
const app = require('../src/app');

const TARGET_PAGES = [
    '/',
    '/shop.html',
    '/product.html?id=1',
    '/cart.html',
    '/checkout.html',
    '/track-order.html'
];

async function runHeaderChecks() {
    console.log('🔍 Starting Iframe & Security Headers Verification...');
    let hasErrors = false;

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        for (const pagePath of TARGET_PAGES) {
            const url = `${baseUrl}${pagePath}`;
            const res = await fetch(url);
            const headers = res.headers;

            // 1. Check absence of X-Frame-Options
            const xFrameOptions = headers.get('x-frame-options');
            if (xFrameOptions) {
                console.error(`❌ [${pagePath}] Found forbidden X-Frame-Options: "${xFrameOptions}"`);
                hasErrors = true;
            } else {
                console.log(`✅ [${pagePath}] X-Frame-Options absent (allowed in iframe)`);
            }

            // 2. Check Content-Security-Policy frame-ancestors
            const csp = headers.get('content-security-policy') || headers.get('content-security-policy-report-only') || '';
            const hasFrameAncestors = csp.includes('frame-ancestors');
            const hasPikalika = csp.includes('pikalika.com');
            const hasHsoub = csp.includes('hsoub.com');

            if (!hasFrameAncestors) {
                console.error(`❌ [${pagePath}] CSP frame-ancestors directive missing!`);
                hasErrors = true;
            } else if (!hasPikalika || !hasHsoub) {
                console.error(`❌ [${pagePath}] CSP frame-ancestors does not include Pikalika or Hsoub domains!`);
                hasErrors = true;
            } else {
                console.log(`✅ [${pagePath}] CSP frame-ancestors configured with Pikalika & Hsoub`);
            }
        }

        // 3. Check Set-Cookie with SameSite=None; Secure in HTTPS mode (simulated via x-forwarded-proto)
        console.log('\n🔍 Checking Cookie Security in HTTPS Context (Third-party iframe)...');
        const httpsCookieRes = await fetch(`${baseUrl}/api/csrf-token`, {
            headers: {
                'x-forwarded-proto': 'https',
                'x-forwarded-ssl': 'on'
            }
        });

        const rawSetCookie = httpsCookieRes.headers.get('set-cookie') || '';
        const isSameSiteNone = /samesite=none/i.test(rawSetCookie);
        const isSecure = /;\s*secure/i.test(rawSetCookie);

        if (!isSameSiteNone || !isSecure) {
            console.error(`❌ Set-Cookie header does not satisfy SameSite=None; Secure in HTTPS context: "${rawSetCookie}"`);
            hasErrors = true;
        } else {
            console.log(`✅ Set-Cookie verified: SameSite=None; Secure in HTTPS context`);
        }

    } finally {
        await new Promise((resolve) => server.close(resolve));
    }

    if (hasErrors) {
        console.error('\n❌ check:headers failed! Please review the errors above.');
        process.exit(1);
    } else {
        console.log('\n✅ check:headers passed! All pages support Pikalika iframe preview safely.');
        process.exit(0);
    }
}

runHeaderChecks().catch((err) => {
    console.error('Fatal error during check-headers:', err);
    process.exit(1);
});
