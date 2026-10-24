const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const rootDir = path.join(__dirname, '..');
const filesToMinify = [
    'js/main.js',
    'js/user-system.js',
    'js/theme-init.js',
    'js/layout.js',
    'js/api-client.js',
    'js/i18n.js',
    'js/pages/index.js',
    'js/pages/product.js',
    'js/pages/cart.js',
    'js/cart.js',
    'js/wishlist.js',
    'js/pages/wishlist.js',
    'js/pages/track-order.js',
    'js/checkout.js',
    'js/pages/shop.js',
    'js/pages/account.js',
    'js/pages/invoice.js',
    'js/pages/order-confirmation.js',
    'js/pages/landing.js',
    'js/pages/terms.js',
    'js/pages/privacy.js'
];

// Per-file terser overrides. layout.js contains large HTML template functions
// (header, footer, mobile nav) that terser's inline optimizer would inline at
// every call site, tripling the output and inflating layout.min.js to 157% of
// source. Disabling inline for that file keeps it at ~85% of source size.
const FILE_OPTIONS = {
    'js/layout.js': { compress: { inline: 0 } }
};

async function buildJs() {
    console.log('--- ⚡ Minifying Client JavaScript Assets ---');
    for (const file of filesToMinify) {
        const srcPath = path.join(rootDir, file);
        if (!fs.existsSync(srcPath)) continue;
        const code = fs.readFileSync(srcPath, 'utf8');
        const fileOverrides = FILE_OPTIONS[file] || {};
        const minResult = await minify(code, {
            compress: {
                drop_console: false,
                passes: 2,
                ...(fileOverrides.compress || {})
            },
            mangle: {
                toplevel: false
            },
            output: {
                ascii_only: false
            }
        });
        const minPath = srcPath.replace(/\.js$/, '.min.js');
        fs.writeFileSync(minPath, minResult.code, 'utf8');
        const origKb = (code.length / 1024).toFixed(1);
        const minKb = (minResult.code.length / 1024).toFixed(1);
        console.log(`✔ Minified ${file} (${origKb} KB -> ${minKb} KB) -> ${path.relative(rootDir, minPath)}`);
    }
    console.log('--- ✅ JavaScript Minification Completed ---');
}

buildJs().catch(err => {
    console.error('JS minification error:', err);
    process.exit(1);
});
