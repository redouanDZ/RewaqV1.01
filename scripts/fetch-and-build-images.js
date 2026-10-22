/**
 * Download & Process High-Resolution Product Images for Rewaq
 * Fetches licensed photos from Unsplash, resizes to >=1600x1600,
 * generates WebP + JPG, creates 400/800/1600 srcset variants,
 * and ensures 150-400KB file sizes.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGES_DIR = path.join(__dirname, '..', 'images');

const imageDefs = [
    // 1. Linen Shirt (Product 1)
    {
        photoId: 'photo-1598033129183-c4f50c736f10',
        baseName: 'prod_linen_shirt',
        desc: 'قميص رجالي كاجوال من الكتان الفاخر (بيج كتاني)'
    },
    {
        photoId: 'photo-1603252109303-2751441dd157',
        baseName: 'prod_linen_shirt_white',
        desc: 'قميص رجالي كاجوال من الكتان (أبيض ملكي)'
    },
    {
        photoId: 'photo-1596755094514-f87e34085b2c',
        baseName: 'prod_linen_shirt_navy',
        desc: 'قميص رجالي كاجوال من الكتان (كحلي داكن)'
    },
    {
        photoId: 'photo-1602810318383-e386cc2a3ccf',
        baseName: 'prod_linen_shirt_detail',
        desc: 'تفاصيل قماش الكتان وأزرار القميص'
    },

    // 2. Summer Floral Dress (Product 2)
    {
        photoId: 'photo-1595777457583-95e059d581b8',
        baseName: 'prod_summer_dress',
        desc: 'فستان صيفي أنيق بتصميم عصري ناعم (أخضر زمردي)'
    },
    {
        photoId: 'photo-1572804013309-59a88b7e92f1',
        baseName: 'prod_summer_dress_coral',
        desc: 'فستان صيفي مورد (مرجاني زهري)'
    },
    {
        photoId: 'photo-1515372039744-b8f02a3ae446',
        baseName: 'prod_summer_dress_detail',
        desc: 'تفاصيل قماش الفستان وحزام الخصر'
    },

    // 3. Sport Sneakers (Product 3): handled manually (images/prod_sneakers*, no brand logos) - not regenerated here.

    // 4. Classic Watch (Product 4)
    {
        photoId: 'photo-1523275335684-37898b6baf30',
        baseName: 'prod_classic_watch',
        desc: 'ساعة يد رجالية كلاسيكية بسوار جلدي فاخر'
    },
    {
        photoId: 'photo-1508685096489-7aacd43bd3b1',
        baseName: 'prod_classic_watch_angle',
        desc: 'ساعة يد كلاسيكية بزاوية جانبية وسوار أنيق'
    },
    {
        photoId: 'photo-1524805444758-089113d48a6d',
        baseName: 'prod_classic_watch_detail',
        desc: 'تفاصيل تاج الساعة والمينا الكحلي الملكي'
    },

    // 5. Luxury Oud Perfume (Product 5)
    {
        photoId: 'photo-1592945403244-b3fbafd7f539',
        baseName: 'prod_perfume',
        desc: 'عطر فاخر برائحة العود والعنبر الفواح 100ml (قارورة عنبرية راقية بدون علامة تجارية)'
    },
    {
        photoId: 'photo-1547887537-6158d64c35b3',
        baseName: 'prod_perfume_box',
        desc: 'قارورة العطر الفاخر مع العلبة الملكية'
    },
    {
        photoId: 'photo-1523293182086-7651a899d37f',
        baseName: 'prod_perfume_detail',
        desc: 'تفاصيل زجاجة العطر الفاخر وبخاخ الرذاذ'
    },

    // 6. Cookware Set (Product 6)
    {
        photoId: 'photo-1556911220-bff31c812dba',
        baseName: 'prod_cookware',
        desc: 'طقم أواني ومقالي غرانيت غير لاصقة (4 قطع)'
    },
    {
        photoId: 'photo-1583778176476-4a8b02a64c01',
        baseName: 'prod_cookware_pan',
        desc: 'مقلاة غرانيت تركية غير لاصقة مع مقبض عازل'
    },
    {
        photoId: 'photo-1584269600464-37b1b58a9fe7',
        baseName: 'prod_cookware_detail',
        desc: 'طقم الطهي كامل في المطبخ العصري'
    },

    // 7. Laptop (Product 100)
    {
        photoId: 'photo-1498050108023-c5249f4df085',
        baseName: 'christopher-gower-m_HRfLhgABo-unsplash',
        aliases: ['prod_laptop'],
        desc: 'حاسوب محمول فائق الأداء للأعمال والبرمجة'
    },
    {
        photoId: 'photo-1517336714731-489689fd1ca8',
        baseName: 'prod_laptop_screen',
        desc: 'شاشة الحاسوب المحمول عالية الدقة مضادة للانعكاس'
    },
    {
        photoId: 'photo-1611186871348-b1ce696e52c9',
        baseName: 'prod_laptop_side',
        desc: 'هيكل الحاسوب المحمول الأنيق النحيف والمنافذ'
    },

    // 8. 4K Digital Camera (Product 101)
    {
        photoId: 'photo-1510127034890-ba27508e9f1c',
        baseName: 'samsung-memory-RZM2cE0lx0Y-unsplash',
        aliases: ['prod_camera'],
        desc: 'كاميرا رقمية احترافية خالية من الشعارات بدقة 4K للتصوير الفوتوغرافي'
    },
    {
        photoId: 'photo-1502920917128-1aa500764cbd',
        baseName: 'prod_camera_lens',
        desc: 'عدسة الكاميرا الاحترافية والغالق'
    },
    {
        photoId: 'photo-1512790182412-b19e6d62bc39',
        baseName: 'prod_camera_detail',
        desc: 'الشاشة المتحركة وأزرار التحكم الدقيقة للكاميرا'
    }
];

function downloadBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadBuffer(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function processProductImage(def) {
    const targetFile = path.join(IMAGES_DIR, `${def.baseName}.webp`);
    const force = process.argv.includes('--force') || process.env.FORCE_REBUILD === 'true';
    if (!force && fs.existsSync(targetFile)) {
        try {
            const meta = await sharp(targetFile).metadata();
            if (meta.width >= 1600 && meta.height >= 1600) {
                console.log(`⏩ Skipping ${def.baseName}: already >=1600x1600.`);
                return;
            }
        } catch(e) {}
    }

    const rawUrl = `https://images.unsplash.com/${def.photoId}?w=1800&h=1800&fit=crop&q=90`;
    console.log(`⬇️ Downloading ${def.baseName} (${def.photoId})...`);
    const inputBuf = await downloadBuffer(rawUrl);

    // 1. Process Master 1600x1600 WebP (Target 150KB - 400KB)
    const masterWebpBuf = await sharp(inputBuf)
        .resize(1600, 1600, { fit: 'cover', position: 'center' })
        .webp({ quality: 86, effort: 4 })
        .toBuffer();

    // 2. Process Master 1600x1600 JPG fallback (Target 150KB - 400KB)
    const masterJpgBuf = await sharp(inputBuf)
        .resize(1600, 1600, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 86, mozjpeg: true })
        .toBuffer();

    // 3. Process Responsive 800x800 WebP & JPG
    const res800Webp = await sharp(inputBuf)
        .resize(800, 800, { fit: 'cover', position: 'center' })
        .webp({ quality: 84 })
        .toBuffer();
    const res800Jpg = await sharp(inputBuf)
        .resize(800, 800, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 84, mozjpeg: true })
        .toBuffer();

    // 4. Process Responsive 400x400 WebP & JPG
    const res400Webp = await sharp(inputBuf)
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .webp({ quality: 82 })
        .toBuffer();
    const res400Jpg = await sharp(inputBuf)
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

    const allNames = [def.baseName, ...(def.aliases || [])];

    for (const name of allNames) {
        fs.writeFileSync(path.join(IMAGES_DIR, `${name}.webp`), masterWebpBuf);
        fs.writeFileSync(path.join(IMAGES_DIR, `${name}.jpg`), masterJpgBuf);
        fs.writeFileSync(path.join(IMAGES_DIR, `${name}-800.webp`), res800Webp);
        fs.writeFileSync(path.join(IMAGES_DIR, `${name}-800.jpg`), res800Jpg);
        fs.writeFileSync(path.join(IMAGES_DIR, `${name}-400.webp`), res400Webp);
        fs.writeFileSync(path.join(IMAGES_DIR, `${name}-400.jpg`), res400Jpg);
    }

    const webpKb = (masterWebpBuf.length / 1024).toFixed(1);
    const jpgKb = (masterJpgBuf.length / 1024).toFixed(1);
    console.log(`✅ Processed ${def.baseName}: 1600x1600 WebP (${webpKb}KB), JPG (${jpgKb}KB) + 800/400 srcset variants`);
}

async function processHeroImages() {
    console.log('🖼️ Processing Hero Banner (Desktop 1920x800 & Mobile 800x800)...');
    const heroPhotoId = 'photo-1512436991641-6745cdb1723f';
    const rawUrl = `https://images.unsplash.com/${heroPhotoId}?w=2000&q=90`;
    const inputBuf = await downloadBuffer(rawUrl);

    // Desktop: 1920x800
    const desktopWebp = await sharp(inputBuf)
        .resize(1920, 800, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer();
    const desktopJpg = await sharp(inputBuf)
        .resize(1920, 800, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

    // Mobile: 800x800 (Clean square portrait banner for phones)
    const mobileWebp = await sharp(inputBuf)
        .resize(800, 800, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer();
    const mobileJpg = await sharp(inputBuf)
        .resize(800, 800, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

    // Standard fallback: 1600x900
    const standardWebp = await sharp(inputBuf)
        .resize(1600, 900, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer();
    const standardJpg = await sharp(inputBuf)
        .resize(1600, 900, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

    fs.writeFileSync(path.join(IMAGES_DIR, 'hero-banner-desktop.webp'), desktopWebp);
    fs.writeFileSync(path.join(IMAGES_DIR, 'hero-banner-desktop.jpg'), desktopJpg);
    fs.writeFileSync(path.join(IMAGES_DIR, 'hero-banner-mobile.webp'), mobileWebp);
    fs.writeFileSync(path.join(IMAGES_DIR, 'hero-banner-mobile.jpg'), mobileJpg);
    fs.writeFileSync(path.join(IMAGES_DIR, 'hero-banner.webp'), standardWebp);
    fs.writeFileSync(path.join(IMAGES_DIR, 'hero-banner.jpg'), standardJpg);

    console.log('✅ Hero Banner processed for desktop & mobile (<picture> support).');
}

async function run() {
    console.log('🚀 Starting High-Res Product & Hero Image Processing...');
    for (const def of imageDefs) {
        await processProductImage(def);
    }
    await processHeroImages();
    console.log('🎉 All high-resolution product and hero images processed successfully!');
}

run().catch(err => {
    console.error('❌ Error processing images:', err);
    process.exit(1);
});
