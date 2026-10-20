/**
 * Automated Responsive & Quality Check Script (Playwright)
 * Tests all store & admin pages across viewports, languages, and themes.
 * Validates: No horizontal overflow, no pageerror, no console.error, and checks touch targets.
 */

const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3100';
const VIEWPORTS = [
    { width: 360, height: 740, name: '360px (Android Mobile)' },
    { width: 390, height: 844, name: '390px (iPhone 12/13/14)' },
    { width: 768, height: 1024, name: '768px (Tablet)' },
    { width: 1024, height: 768, name: '1024px (Small Desktop/Tablet Landscape)' },
    { width: 1440, height: 900, name: '1440px (Desktop HD)' }
];

const LANGUAGES = ['ar', 'fr', 'en'];
const THEMES = ['light', 'dark'];

const STORE_PAGES = [
    'index.html',
    'shop.html',
    'product.html?id=1',
    'cart.html',
    'checkout.html',
    'account.html',
    'wishlist.html',
    'track-order.html',
    'order-confirmation.html',
    'invoice.html',
    'landing.html',
    'terms.html',
    'privacy.html'
];

const ADMIN_PAGES = [
    'admin/index.html',
    'admin/products.html',
    'admin/orders.html',
    'admin/users.html',
    'admin/coupons.html',
    'admin/reviews.html',
    'admin/settings.html'
];

// CLI arguments parsing
const args = process.argv.slice(2);
const singlePageArg = args.find(a => a.startsWith('--page='))?.replace('--page=', '');
const quickMode = args.includes('--quick'); // Quick tests: only 320, 768, 1280 and 'ar'

async function run() {
    const launchOptions = { headless: true };
    if (process.platform === 'win32') {
        launchOptions.channel = 'chrome';
    }
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext();
    const page = await context.newPage();

    let totalChecks = 0;
    let failedChecks = 0;
    const failures = [];

    // Authenticate as Admin first
    try {
        console.log('🔑 Logging in as Admin for admin dashboard testing...');
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
        
        await page.goto(`${BASE_URL}/index.html`);
        const loginRes = await page.request.post(`${BASE_URL}/api/login`, {
            data: { email: adminEmail, password: adminPassword }
        });
        if (!loginRes.ok()) {
            console.warn('⚠️ Admin login HTTP status:', loginRes.status(), await loginRes.text());
        } else {
            console.log('✅ Admin login succeeded');
        }
    } catch (e) {
        console.warn('⚠️ Admin login failed or skipped:', e.message);
    }

    const pagesToTest = singlePageArg ? [singlePageArg] : [...STORE_PAGES, ...ADMIN_PAGES];
    const viewportsToTest = quickMode ? [VIEWPORTS[0], VIEWPORTS[3], VIEWPORTS[4]] : VIEWPORTS;
    const languagesToTest = quickMode ? ['ar'] : LANGUAGES;
    const themesToTest = quickMode ? ['light'] : THEMES;

    for (const pagePath of pagesToTest) {
        console.log(`\n==================================================`);
        console.log(`📄 Testing Page: ${pagePath}`);
        console.log(`==================================================`);

        for (const lang of languagesToTest) {
            for (const theme of themesToTest) {
                for (const vp of viewportsToTest) {
                    totalChecks++;
                    const pageErrors = [];
                    const consoleErrors = [];

                    const onPageError = (err) => pageErrors.push(err.message || String(err));
                    const onConsole = (msg) => {
                        if (msg.type() === 'error') {
                            const text = msg.text();
                            // Filter non-fatal 404 assets or known non-blocking warnings
                            if (!text.includes('favicon') && !text.includes('net::ERR_') && !text.includes('Failed to load resource: the server responded with a status of 404')) {
                                consoleErrors.push(text);
                            }
                        }
                    };

                    page.on('pageerror', onPageError);
                    page.on('console', onConsole);

                    await page.setViewportSize({ width: vp.width, height: vp.height });

                    // Set language & theme in localStorage before navigating
                    await page.addInitScript(({ l, t }) => {
                        localStorage.setItem('myshop_lang', l);
                        localStorage.setItem('theme', t);
                    }, { l: lang, t: theme });

                    const url = `${BASE_URL}/${pagePath}`;
                    let navError = null;
                    try {
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await page.waitForTimeout(300); // Allow render & layout script execution
                    } catch (err) {
                        navError = err.message;
                    }

                    if (navError) {
                        failedChecks++;
                        failures.push({
                            page: pagePath,
                            lang,
                            theme,
                            viewport: vp.name,
                            issue: `Navigation failed: ${navError}`
                        });
                        page.off('pageerror', onPageError);
                        page.off('console', onConsole);
                        continue;
                    }

                    // 1. Check Horizontal Overflow (scrollWidth > clientWidth)
                    const overflowInfo = await page.evaluate(() => {
                        const html = document.documentElement;
                        const body = document.body;
                        const clientWidth = html.clientWidth;
                        const scrollWidth = Math.max(html.scrollWidth, body ? body.scrollWidth : 0);

                        // Find overflowing elements
                        const overflowingElements = [];
                        if (scrollWidth > clientWidth + 1) { // 1px tolerance for sub-pixel rendering
                            const allElements = document.querySelectorAll('*');
                            allElements.forEach(el => {
                                // Skip elements that are supposed to have horizontal scroll
                                if (
                                    el.closest('.category-pills-wrap') ||
                                    el.closest('.category-pills') ||
                                    el.closest('.tabs') ||
                                    el.closest('.sub-nav') ||
                                    el.closest('.nav-links') ||
                                    el.closest('.table-responsive') ||
                                    el.closest('.admin-table-container') ||
                                    el.closest('.overflow-x-auto') ||
                                    el.classList.contains('category-pills-wrap') ||
                                    el.classList.contains('category-pills')
                                ) {
                                    return;
                                }

                                const rect = el.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0) {
                                    if (rect.right > clientWidth + 2 || rect.left < -2) {
                                        overflowingElements.push({
                                            tag: el.tagName.toLowerCase(),
                                            id: el.id,
                                            class: el.className,
                                            right: Math.round(rect.right),
                                            left: Math.round(rect.left),
                                            width: Math.round(rect.width)
                                        });
                                    }
                                }
                            });
                        }

                        return {
                            hasOverflow: scrollWidth > clientWidth + 1,
                            scrollWidth,
                            clientWidth,
                            diff: scrollWidth - clientWidth,
                            overflowingElements: overflowingElements.slice(0, 5) // top 5 culprits
                        };
                    });

                    // 2. Measure Touch Targets (a, button, input, select)
                    const touchTargets = await page.evaluate(() => {
                        const interactives = document.querySelectorAll('a, button, input, select');
                        let under44 = 0;
                        let under36 = 0;
                        const smallList = [];

                        interactives.forEach(el => {
                            // Check if element is visible
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            if (
                                style.display === 'none' ||
                                style.visibility === 'hidden' ||
                                style.opacity === '0' ||
                                rect.width === 0 ||
                                rect.height === 0 ||
                                el.type === 'hidden'
                            ) {
                                return;
                            }

                            // Exclude radio/checkbox inputs themselves if wrapped in label or stylized
                            if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
                                return;
                            }

                            if (rect.width < 44 || rect.height < 44) {
                                under44++;
                                if (rect.width < 36 || rect.height < 36) {
                                    under36++;
                                    if (smallList.length < 8) {
                                        smallList.push({
                                            tag: el.tagName.toLowerCase(),
                                            id: el.id,
                                            class: el.className,
                                            text: (el.textContent || el.value || el.placeholder || '').trim().slice(0, 25),
                                            w: Math.round(rect.width),
                                            h: Math.round(rect.height)
                                        });
                                    }
                                }
                            }
                        });

                        return { under44, under36, smallList };
                    });

                    // 3. Check Cart and Wishlist Badge covering icon
                    const badgeCheck = await page.evaluate(() => {
                        const cartCountEl = document.querySelector('.cart-count');
                        const cartIcon = document.querySelector('.cart-icon i, .fa-shopping-cart, .fa-bag-shopping');
                        const isHiddenWhenZero = cartCountEl ? (cartCountEl.textContent === '0' ? window.getComputedStyle(cartCountEl).display === 'none' : true) : true;
                        
                        return {
                            isHiddenWhenZero
                        };
                    });

                    // Process results for this check
                    let hasIssue = false;
                    let errorMessages = [];

                    if (overflowInfo.hasOverflow) {
                        hasIssue = true;
                        const culprits = overflowInfo.overflowingElements.map(e => `<${e.tag} class="${e.class}"> (${e.width}px)`).join(', ');
                        errorMessages.push(`Overflow: scrollWidth=${overflowInfo.scrollWidth}px > clientWidth=${overflowInfo.clientWidth}px (+${overflowInfo.diff}px). Culprits: ${culprits}`);
                    }

                    if (pageErrors.length > 0) {
                        hasIssue = true;
                        errorMessages.push(`PageError: ${pageErrors.join(' | ')}`);
                    }

                    if (consoleErrors.length > 0) {
                        hasIssue = true;
                        errorMessages.push(`ConsoleError: ${consoleErrors.join(' | ')}`);
                    }

                    if (!badgeCheck.isHiddenWhenZero) {
                        hasIssue = true;
                        errorMessages.push(`Badge issue: cart-count is '0' but not hidden!`);
                    }

                    if (hasIssue) {
                        failedChecks++;
                        failures.push({
                            page: pagePath,
                            lang,
                            theme,
                            viewport: vp.name,
                            issues: errorMessages
                        });
                        console.log(`  ❌ [FAIL] ${vp.name} | ${lang} | ${theme}`);
                        errorMessages.forEach(msg => console.log(`      -> ${msg}`));
                    } else {
                        const touchNote = touchTargets.under36 > 0 ? ` [Touch <36px: ${touchTargets.under36}, <44px: ${touchTargets.under44}]` : '';
                        console.log(`  ✅ [PASS] ${vp.name} | ${lang} | ${theme}${touchNote}`);
                    }

                    page.off('pageerror', onPageError);
                    page.off('console', onConsole);
                }
            }
        }
    }

    await browser.close();

    console.log(`\n==================================================`);
    console.log(`📊 SUMMARY OF RESPONSIVE AUDIT`);
    console.log(`==================================================`);
    console.log(`Total Scenarios Tested: ${totalChecks}`);
    console.log(`Passed: ${totalChecks - failedChecks}`);
    console.log(`Failed: ${failedChecks}`);

    if (failures.length > 0) {
        console.log(`\n❌ Failed Scenarios (${failures.length}):`);
        failures.slice(0, 20).forEach((f, idx) => {
            console.log(`${idx + 1}. Page: ${f.page} (${f.viewport}, ${f.lang}, ${f.theme})`);
            if (f.issues) f.issues.forEach(i => console.log(`   - ${i}`));
            if (f.issue) console.log(`   - ${f.issue}`);
        });
        process.exit(1);
    } else {
        console.log(`\n🎉 ALL RESPONSIVE SCENARIOS PASSED WITH ZERO OVERFLOW AND ZERO ERRORS!`);
        process.exit(0);
    }
}

run().catch(err => {
    console.error('Fatal error during responsive check:', err);
    process.exit(1);
});
