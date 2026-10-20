const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

async function buildCover() {
  console.log('--- 🎨 Generating Pikalika Main Product Cover ---');

  // Load local assets as base64 for reliable, zero-latency rendering
  const watchImg = fs.readFileSync(path.join(__dirname, '../images/prod_classic_watch.jpg')).toString('base64');
  const shirtImg = fs.readFileSync(path.join(__dirname, '../images/prod_linen_shirt.jpg')).toString('base64');
  const perfumeImg = fs.readFileSync(path.join(__dirname, '../images/prod_perfume.jpg')).toString('base64');
  const sneakersImg = fs.readFileSync(path.join(__dirname, '../images/prod_sneakers.jpg')).toString('base64');
  const logoSvg = fs.readFileSync(path.join(__dirname, '../images/logo.svg'), 'utf8');
  const logoBase64 = Buffer.from(logoSvg).toString('base64');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Rewaq Pikalika Cover</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 1200px;
      height: 800px;
      overflow: hidden;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background: #080c16;
      color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    /* Canvas Root (1200x800 - Standard 3:2 Ratio) */
    .canvas {
      position: relative;
      width: 1200px;
      height: 800px;
      background: radial-gradient(circle at 85% 25%, #18223c 0%, transparent 55%),
                  radial-gradient(circle at 20% 70%, #1e1b4b 0%, transparent 60%),
                  radial-gradient(circle at 45% 45%, #0f172a 0%, #070a12 100%);
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 0 54px;
      overflow: hidden;
    }

    /* Ambient Glows */
    .glow-cyan {
      position: absolute;
      width: 500px;
      height: 500px;
      top: -100px;
      right: 150px;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.16) 0%, transparent 70%);
      pointer-events: none;
      filter: blur(50px);
    }
    .glow-indigo {
      position: absolute;
      width: 650px;
      height: 650px;
      bottom: -150px;
      left: 50px;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%);
      pointer-events: none;
      filter: blur(60px);
    }

    /* Subtle Architectural Grid */
    .grid-overlay {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    /* Right Column: Hero Typography & Info (Concise & High Impact) */
    .text-column {
      position: relative;
      z-index: 10;
      width: 480px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
      padding-right: 10px;
    }

    /* Single Optional Badge (Required: 1 badge max) */
    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(30, 41, 59, 0.85);
      border: 1.5px solid rgba(56, 189, 248, 0.45);
      padding: 8px 18px;
      border-radius: 999px;
      box-shadow: 0 4px 18px rgba(14, 165, 233, 0.18);
      backdrop-filter: blur(10px);
    }
    .badge-dot {
      width: 9px;
      height: 9px;
      background: #38bdf8;
      border-radius: 50%;
      box-shadow: 0 0 10px #38bdf8;
    }
    .badge-text {
      color: #e0f2fe;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }

    /* Main Title: Product Name (8-10% of 800px = 64px to 80px -> Set to 76px) */
    .main-title {
      font-size: 76px;
      font-weight: 900;
      line-height: 1.05;
      letter-spacing: -1.5px;
      color: #ffffff;
      margin: 4px 0 0 0;
      text-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .main-title .brand-gradient {
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Subtitle: Slogan <= 6 words (4-5% of 800px = 32px to 40px -> Set to 35px) */
    .subtitle {
      font-size: 35px;
      font-weight: 700;
      line-height: 1.35;
      color: #cbd5e1; /* High contrast: 10.5:1 ratio against #080c16 */
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      margin: 0;
      max-width: 460px;
    }

    /* Micro Trust Bar (No long feature lists - just 3 sleek micro-badges) */
    .micro-trust {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 14px;
    }
    .trust-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .trust-chip i {
      color: #38bdf8;
      font-size: 14px;
    }

    /* Left Column: Device Mockup (Real Store Showcase) */
    .mockup-column {
      position: relative;
      z-index: 10;
      width: 590px;
      height: 620px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Laptop Device Frame */
    .laptop-frame {
      position: relative;
      width: 580px;
      background: #0f172a;
      border-radius: 18px;
      border: 2px solid #334155;
      box-shadow: 
        0 30px 70px -15px rgba(0, 0, 0, 0.85),
        0 10px 30px -5px rgba(14, 165, 233, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      overflow: hidden;
      transform: perspective(1000px) rotateY(-4deg) rotateX(2deg);
      transition: transform 0.3s ease;
    }

    /* Browser Top Bar */
    .browser-header {
      background: #1e293b;
      height: 38px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .window-dots {
      display: flex;
      gap: 6px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #eab308; }
    .dot-green { background: #22c55e; }

    .browser-url {
      flex: 1;
      max-width: 280px;
      margin: 0 auto;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      font-family: 'Plus Jakarta Sans', sans-serif;
      direction: ltr;
    }
    .browser-url i {
      color: #22c55e;
      font-size: 10px;
    }

    /* Store Inner Screen */
    .store-screen {
      background: #f8fafc;
      color: #0f172a;
      padding: 14px 16px;
      height: 520px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }

    /* Store Header in Mockup */
    .store-navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      padding: 10px 14px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
    }
    .store-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }
    .store-logo-img {
      width: 28px;
      height: 28px;
    }
    .store-brand-text {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .mockup-search {
      flex: 1;
      max-width: 220px;
      margin: 0 12px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      height: 30px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #64748b;
    }
    .mockup-user-actions {
      display: flex;
      gap: 8px;
      color: #475569;
      font-size: 13px;
    }
    .mockup-badge-cart {
      position: relative;
    }
    .cart-dot {
      position: absolute;
      top: -4px;
      right: -6px;
      background: #4f46e5;
      color: #fff;
      font-size: 9px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }

    /* Category Pills */
    .mockup-pills {
      display: flex;
      gap: 8px;
      padding: 2px 0;
    }
    .pill {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .pill.active {
      background: #4f46e5;
      color: #ffffff;
      border-color: #4f46e5;
    }

    /* Clean Corrected Product Cards (2x2 Grid) */
    .mockup-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      flex: 1;
    }
    .mockup-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 9px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    }
    .card-thumb-wrap {
      position: relative;
      width: 100%;
      height: 118px;
      border-radius: 7px;
      overflow: hidden;
      background: #f1f5f9;
      margin-bottom: 7px;
    }
    .card-thumb-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .card-discount-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      background: #ef4444;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .card-heart-btn {
      position: absolute;
      top: 6px;
      left: 6px;
      width: 24px;
      height: 24px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ef4444;
      font-size: 11px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }

    .card-category {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    .card-stars {
      color: #f59e0b;
      font-size: 9px;
      display: flex;
      gap: 2px;
      margin-bottom: 5px;
    }

    .card-bottom-row {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .card-price-box {
      display: flex;
      flex-direction: column;
    }
    .card-current-price {
      font-size: 14px;
      font-weight: 800;
      color: #4f46e5;
      font-family: 'Cairo', 'Plus Jakarta Sans', sans-serif;
    }
    .card-old-price {
      font-size: 10px;
      color: #94a3b8;
      text-decoration: line-through;
    }
    .card-add-btn {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    /* Laptop Base Reflection */
    .laptop-reflection {
      position: absolute;
      bottom: 20px;
      left: 60px;
      width: 500px;
      height: 12px;
      background: radial-gradient(ellipse at center, rgba(56, 189, 248, 0.35) 0%, transparent 70%);
      filter: blur(10px);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="grid-overlay"></div>
    <div class="glow-cyan"></div>
    <div class="glow-indigo"></div>

    <!-- Right Side: Clean High-Contrast Typography (Concise & Bold) -->
    <div class="text-column">
      <!-- 1 Optional Badge Only -->
      <div class="badge-pill">
        <span class="badge-dot"></span>
        <span class="badge-text">النسخة الاحترافية • 2026</span>
      </div>

      <!-- Main Title (76px >= 8-10% of 800px) -->
      <h1 class="main-title">
        <span>متجر</span>
        <span class="brand-gradient">رواق</span>
      </h1>

      <!-- Short Slogan (35px >= 4-5% of 800px, 5 words <= 6 words) -->
      <p class="subtitle">
        سكربت متجر إلكتروني عربي احترافي
      </p>

      <!-- Clean Micro Trust Chips (No long feature lists) -->
      <div class="micro-trust">
        <div class="trust-chip">
          <i class="fas fa-bolt"></i>
          <span>سرعة فائقة</span>
        </div>
        <div class="trust-chip">
          <i class="fas fa-truck-fast"></i>
          <span>58 ولاية</span>
        </div>
        <div class="trust-chip">
          <i class="fas fa-credit-card"></i>
          <span>Chargily Pay</span>
        </div>
      </div>
    </div>

    <!-- Left Side: Real Clean Storefront in High-End Laptop Mockup Frame -->
    <div class="mockup-column">
      <div class="laptop-frame">
        <!-- Browser Header -->
        <div class="browser-header">
          <div class="window-dots">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
          </div>
          <div class="browser-url">
            <i class="fas fa-lock"></i>
            <span>https://rewaq.dz/</span>
          </div>
        </div>

        <!-- Store Inside Display -->
        <div class="store-screen">
          <!-- Top Store Bar -->
          <div class="store-navbar">
            <div class="store-brand">
              <img src="data:image/svg+xml;base64,${logoBase64}" class="store-logo-img" alt="رواق">
              <span class="store-brand-text">متجر رواق</span>
            </div>
            <div class="mockup-search">
              <i class="fas fa-magnifying-glass"></i>
              <span>ابحث عن منتج...</span>
            </div>
            <div class="mockup-user-actions">
              <i class="far fa-heart"></i>
              <div class="mockup-badge-cart">
                <i class="fas fa-bag-shopping"></i>
                <span class="cart-dot">2</span>
              </div>
            </div>
          </div>

          <!-- Category Filter Pills -->
          <div class="mockup-pills">
            <div class="pill active"><i class="fas fa-layer-group"></i> الكل</div>
            <div class="pill"><i class="fas fa-clock"></i> ساعات</div>
            <div class="pill"><i class="fas fa-shirt"></i> أزياء</div>
            <div class="pill"><i class="fas fa-spa"></i> عطور</div>
            <div class="pill"><i class="fas fa-shoe-prints"></i> أحذية</div>
          </div>

          <!-- 4 Real Product Cards (Corrected Design) -->
          <div class="mockup-grid">
            <!-- Card 1: Watch -->
            <div class="mockup-card">
              <div class="card-thumb-wrap">
                <img src="data:image/jpeg;base64,${watchImg}" alt="ساعة كلاسيكية">
                <span class="card-discount-badge">-25%</span>
                <span class="card-heart-btn"><i class="fas fa-heart"></i></span>
              </div>
              <span class="card-category">ساعات وإكسسوارات</span>
              <div class="card-title">ساعة يد كلاسيكية فاخرة</div>
              <div class="card-stars">
                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
              </div>
              <div class="card-bottom-row">
                <div class="card-price-box">
                  <span class="card-current-price">4,500 د.ج</span>
                  <span class="card-old-price">6,000 د.ج</span>
                </div>
                <button class="card-add-btn"><i class="fas fa-plus"></i> أضف للسلة</button>
              </div>
            </div>

            <!-- Card 2: Linen Shirt -->
            <div class="mockup-card">
              <div class="card-thumb-wrap">
                <img src="data:image/jpeg;base64,${shirtImg}" alt="قميص كتان">
                <span class="card-heart-btn"><i class="far fa-heart"></i></span>
              </div>
              <span class="card-category">أزياء وملابس</span>
              <div class="card-title">قميص كتان صيفي مريح</div>
              <div class="card-stars">
                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
              </div>
              <div class="card-bottom-row">
                <div class="card-price-box">
                  <span class="card-current-price">3,200 د.ج</span>
                </div>
                <button class="card-add-btn"><i class="fas fa-plus"></i> أضف للسلة</button>
              </div>
            </div>

            <!-- Card 3: Perfume -->
            <div class="mockup-card">
              <div class="card-thumb-wrap">
                <img src="data:image/jpeg;base64,${perfumeImg}" alt="عطر فاخر">
                <span class="card-discount-badge">-15%</span>
                <span class="card-heart-btn"><i class="far fa-heart"></i></span>
              </div>
              <span class="card-category">عطور وتجميل</span>
              <div class="card-title">عطر فاخر شرقي أصلي</div>
              <div class="card-stars">
                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
              </div>
              <div class="card-bottom-row">
                <div class="card-price-box">
                  <span class="card-current-price">6,800 د.ج</span>
                  <span class="card-old-price">8,000 د.ج</span>
                </div>
                <button class="card-add-btn"><i class="fas fa-plus"></i> أضف للسلة</button>
              </div>
            </div>

            <!-- Card 4: Sneakers -->
            <div class="mockup-card">
              <div class="card-thumb-wrap">
                <img src="data:image/jpeg;base64,${sneakersImg}" alt="حذاء رياضي">
                <span class="card-heart-btn"><i class="far fa-heart"></i></span>
              </div>
              <span class="card-category">أحذية ورياضة</span>
              <div class="card-title">حذاء رياضي عصري وخفيف</div>
              <div class="card-stars">
                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="far fa-star"></i>
              </div>
              <div class="card-bottom-row">
                <div class="card-price-box">
                  <span class="card-current-price">5,400 د.ج</span>
                </div>
                <button class="card-add-btn"><i class="fas fa-plus"></i> أضف للسلة</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="laptop-reflection"></div>
    </div>
  </div>
</body>
</html>`;

  // Save the HTML template for transparency and future editing
  const htmlPath = path.join(__dirname, '../pikalika-cover.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✔ HTML template saved to:', htmlPath);

  // Launch Playwright Chrome to capture pixel-perfect 1200x800 render
  console.log('--- 📸 Launching Chrome to render 1200x800 PNG ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2 // HiDPI 2x for ultra-sharp Retina rendering
  });

  await page.setContent(html, { waitUntil: 'networkidle' });
  // Wait for Cairo font and Google Fonts to settle
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1200));

  const rawBuffer = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 800 }
  });
  await browser.close();

  // Save full 1200x800 PNG and JPG using Sharp
  const outputPng = path.join(__dirname, '../pikalika-cover-1200x800.png');
  const outputJpg = path.join(__dirname, '../pikalika-cover-1200x800.jpg');
  const outputThumb300 = path.join(__dirname, '../pikalika-cover-300x200-thumbnail.png');

  await sharp(rawBuffer)
    .resize(1200, 800)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(outputPng);
  console.log('✔ Saved high-resolution 1200x800 PNG:', outputPng);

  await sharp(rawBuffer)
    .resize(1200, 800)
    .jpeg({ quality: 95, mozjpeg: true })
    .toFile(outputJpg);
  console.log('✔ Saved high-resolution 1200x800 JPG:', outputJpg);

  // Generate 300px thumbnail to test catalog legibility as requested
  await sharp(rawBuffer)
    .resize(300, 200, { fit: 'cover' })
    .png({ quality: 100 })
    .toFile(outputThumb300);
  console.log('✔ Generated 300px catalog thumbnail for legibility testing:', outputThumb300);

  console.log('--- ✅ Cover Generation and Legibility Test Completed Successfully ---');
}

buildCover().catch(err => {
  console.error('❌ Error generating cover:', err);
  process.exit(1);
});
