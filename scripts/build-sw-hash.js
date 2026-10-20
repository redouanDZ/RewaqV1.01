/**
 * Service Worker Cache Version Hash Generator
 * Generates a cache version hash from precached assets and assets that are cache-versioned only.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateSwCacheHash() {
    const swPath = path.join(__dirname, '..', 'sw.js');
    if (!fs.existsSync(swPath)) {
        console.error('❌ sw.js not found');
        process.exit(1);
    }

    const swContent = fs.readFileSync(swPath, 'utf8');
    const isCrlf = swContent.includes('\r\n');
    const eol = isCrlf ? '\r\n' : '\n';

    const extractAssets = (name) => {
        const match = swContent.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
        if (!match) {
            console.error(`❌ Could not parse ${name} in sw.js`);
            process.exit(1);
        }

        return match[1]
            .split(',')
            .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(s => s.length > 0);
    };
    const assetEntries = [
        ...extractAssets('STATIC_ASSETS'),
        ...extractAssets('CACHE_VERSION_ASSETS')
    ];

    const hash = crypto.createHash('sha256');
    let hashedCount = 0;

    for (const asset of assetEntries) {
        let relPath = asset.replace(/^\/+/, '');
        if (relPath === '') relPath = 'index.html';

        const fullPath = path.join(__dirname, '..', relPath);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const fileData = fs.readFileSync(fullPath);
            hash.update(relPath);
            hash.update(fileData);
            hashedCount++;
        }
    }

    const shortHash = hash.digest('hex').slice(0, 10);
    const newCacheName = `rewaq-pwa-v${shortHash}`;

    const updatedContent = swContent.replace(
        /const\s+CACHE_NAME\s*=\s*['"][^'"]+['"];/,
        `const CACHE_NAME = '${newCacheName}';`
    );

    fs.writeFileSync(swPath, updatedContent.split(/\r?\n/).join(eol), 'utf8');
    console.log(`✔ Generated SW cache name: ${newCacheName} (hashed ${hashedCount} cache/version assets)`);
}

generateSwCacheHash();
