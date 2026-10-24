// Early health check ping to wake up sleeping server (e.g. Render free tier)
try {
    fetch('/health', { method: 'GET', keepalive: true }).catch(() => {});
} catch (e) {}

let currentProduct = null;
let selectedVariant = null;

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id') || 1;
let preloadedProduct = null;
try {
    const dataEl = document.getElementById('initial-product-data');
    if (dataEl && dataEl.textContent) {
        preloadedProduct = JSON.parse(dataEl.textContent);
    }
} catch (e) {}

const initialProductFetch = preloadedProduct
    ? Promise.resolve(preloadedProduct)
    : fetch(`/api/products/${productId}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);

function transformProductImage(url, width = 800, height = 800) {
    if (!url) return '/images/product-placeholder.jpg';
    if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/w_')) {
        return url.replace('/upload/', `/upload/w_${width},h_${height},c_fill,f_auto,q_auto/`);
    }
    const m = url.match(/^(\/images\/[^\/]+?)(\.[a-zA-Z0-9]+)$/);
    if (m) {
        const base = m[1].replace(/-(150|200|400|800)$/, '');
        const ext = m[2];
        if (width <= 150) return `${base}-150${ext}`;
        if (width <= 200) return `${base}-200${ext}`;
        if (width <= 400) return `${base}-400${ext}`;
        return `${base}-800${ext}`;
    }
    return url;
}

function getProductSrcset(imgUrl) {
    if (!imgUrl || typeof imgUrl !== 'string') return '';
    if (imgUrl.includes('res.cloudinary.com')) {
        const url400 = imgUrl.replace('/upload/', '/upload/w_400,c_fill,f_auto,q_auto/');
        const url800 = imgUrl.replace('/upload/', '/upload/w_800,c_fill,f_auto,q_auto/');
        return `${url400} 400w, ${url800} 800w`;
    }
    const m = imgUrl.match(/^(\/images\/[^\/]+?)(\.[a-zA-Z0-9]+)$/);
    if (m) {
        const base = m[1].replace(/-(150|200|400|800)$/, '');
        const ext = m[2];
        return `${base}-400${ext} 400w, ${base}-800${ext} 800w`;
    }
    return '';
}

function getThumbSrcset(imgUrl) {
    if (!imgUrl || typeof imgUrl !== 'string') return '';
    const m = imgUrl.match(/^(\/images\/[^\/]+?)(\.[a-zA-Z0-9]+)$/);
    if (m) {
        const base = m[1].replace(/-(150|200|400|800)$/, '');
        const ext = m[2];
        return `${base}-200${ext} 200w, ${base}-400${ext} 400w`;
    }
    return '';
}

        const demoProductTranslations = {
            1: {
                fr: {
                    name: "Chemise homme décontractée en lin haut de gamme",
                    description: "Chemise d'été élégante pour homme, confectionnée en lin 100% naturel de haute qualité. Coupe confortable idéale pour le travail, les sorties et les occasions spéciales, avec une excellente aération et des boutons résistants."
                },
                en: {
                    name: "Men's Casual Premium Linen Shirt",
                    description: "Elegant summer men's shirt made of 100% natural high-quality linen. Comfortable fit suitable for everyday wear, work, and events, featuring excellent breathability and durable buttons."
                }
            },
            2: {
                fr: {
                    name: "Robe d'été élégante au design moderne et fluide",
                    description: "Robe midi pour femme avec de délicats motifs floraux et un tissu en mousseline doux et léger. Dotée d'une ceinture élégante et d'une coupe attrayante offrant un confort absolu pour toutes vos occasions."
                },
                en: {
                    name: "Elegant Summer Floral Midi Dress",
                    description: "Women's midi dress with delicate floral prints in soft, lightweight chiffon fabric. Features an elegant waist belt and flattering cut for absolute comfort and a radiant look on any occasion."
                }
            },
            3: {
                fr: {
                    name: "Chaussures de sport confortables pour la course et la marche",
                    description: "Sneakers légères dotées de la technologie d'amorti à coussin d'air et d'un tissu en maille respirant, spécialement conçues pour un confort quotidien optimal et de longues séances de marche."
                },
                en: {
                    name: "Comfortable Running & Walking Sneakers",
                    description: "Lightweight sneakers featuring shock-absorbing air cushion technology and breathable mesh fabric, designed for daily comfort and long athletic sessions."
                }
            },
            4: {
                fr: {
                    name: "Montre pour homme classique avec bracelet en cuir véritable",
                    description: "Montre chronographe mécanique de luxe avec boîtier en acier inoxydable poli, cadran bleu marine royal, bracelet en cuir véritable, verre saphir inrayable et étanchéité."
                },
                en: {
                    name: "Men's Classic Chronograph Leather Watch",
                    description: "Luxury mechanical chronograph watch with polished stainless steel case, royal navy blue dial, genuine leather strap, scratch-resistant sapphire crystal, and water resistance."
                }
            },
            5: {
                fr: {
                    name: "Parfum de luxe aux notes d'Oud et d'Ambre 100ml",
                    description: "Parfum oriental d'exception en concentration Eau de Parfum longue tenue (+24h). Une formule unique associant bois d'oud noble, ambre royal et touches délicates de vanille veloutée."
                },
                en: {
                    name: "Luxury Oud & Amber Royal Perfume 100ml",
                    description: "Premium oriental Eau de Parfum with lasting power over 24 hours. A unique blend of aged oud wood, royal amber, and soft velvety vanilla accents."
                }
            },
            6: {
                fr: {
                    name: "Batterie de cuisine en granit antiadhésif (4 pièces)",
                    description: "Ensemble d'ustensiles de cuisine turcs haut de gamme avec revêtement en granit sain antiadhésif et inrayable (sans PFOA), poignées isolantes et couvercles en verre à vapeur."
                },
                en: {
                    name: "Non-Stick Granite Cookware Set (4 Pieces)",
                    description: "Premium Turkish granite cookware set with scratch-resistant, PFOA-free non-stick coating, heat-insulated handles, and tempered steam-vented glass lids."
                }
            },
            100: {
                fr: {
                    name: "Ordinateur portable haute performance pour professionnels et développeurs",
                    description: "Ordinateur portable ultra-rapide avec processeur puissant, écran antireflet haute définition, autonomie longue durée et châssis fin et élégant, idéal pour le travail et la programmation."
                },
                en: {
                    name: "High-Performance Business & Coding Laptop",
                    description: "Ultra-fast laptop featuring a powerful processor, anti-glare high-resolution display, extended battery life, and sleek lightweight chassis perfect for office work, coding, and study."
                }
            },
            101: {
                fr: {
                    name: "Appareil photo numérique professionnel 4K pour photographie",
                    description: "Appareil photo numérique professionnel avec capteur avancé et objectif haute résolution, enregistrement vidéo 4K, autofocus ultra-rapide et écran orientable pour la création de contenu."
                },
                en: {
                    name: "Professional 4K Digital Camera for Photography",
                    description: "Professional digital camera equipped with advanced sensor, high-resolution lens, 4K video recording, ultra-fast autofocus, and articulating screen for superior content creation."
                }
            }
        };

        function getLocalizedProduct(prod, lang) {
            if (!prod) return { name: '', description: '' };
            const currentLang = lang || (window.I18n ? window.I18n.currentLang : 'ar');
            if (currentLang === 'ar') {
                return {
                    name: prod.name || '',
                    description: prod.description || ''
                };
            }
            const trans = demoProductTranslations[Number(prod.id)]?.[currentLang];
            return {
                name: (trans && trans.name) ? trans.name : (prod.name || ''),
                description: (trans && trans.description) ? trans.description : (prod.description || '')
            };
        }

        function formatVariantName(rawName, lang) {
            if (!rawName) return '';
            const currentLang = lang || (window.I18n ? window.I18n.currentLang : 'ar');
            if (currentLang === 'ar') return rawName;

            const colorMap = {
                fr: {
                    'بيج كتاني': 'Beige lin',
                    'بيج': 'Beige',
                    'أبيض ملكي': 'Blanc royal',
                    'أبيض': 'Blanc',
                    'كحلي داكن': 'Bleu marine foncé',
                    'كحلي': 'Bleu marine',
                    'أخضر زمردي': 'Vert émeraude',
                    'أخضر': 'Vert',
                    'مرجاني زهري': 'Corail floral',
                    'مرجاني': 'Corail',
                    'وردي': 'Rose',
                    'زهري': 'Rose',
                    'أسود ملكي': 'Noir royal',
                    'أسود داكن': 'Noir profond',
                    'أسود': 'Noir',
                    'أزرق ملكي': 'Bleu royal',
                    'أزرق': 'Bleu',
                    'رمادي رياضي': 'Gris sport',
                    'رمادي': 'Gris',
                    'بني': 'Marron',
                    'أحمر': 'Rouge',
                    'أصفر': 'Jaune',
                    'فضي': 'Argent',
                    'ذهبي': 'Or'
                },
                en: {
                    'بيج كتاني': 'Linen Beige',
                    'بيج': 'Beige',
                    'أبيض ملكي': 'Royal White',
                    'أبيض': 'White',
                    'كحلي داكن': 'Dark Navy',
                    'كحلي': 'Navy',
                    'أخضر زمردي': 'Emerald Green',
                    'أخضر': 'Green',
                    'مرجاني زهري': 'Floral Coral',
                    'مرجاني': 'Coral',
                    'وردي': 'Pink',
                    'زهري': 'Pink',
                    'أسود ملكي': 'Royal Black',
                    'أسود داكن': 'Deep Black',
                    'أسود': 'Black',
                    'أزرق ملكي': 'Royal Blue',
                    'أزرق': 'Blue',
                    'رمادي رياضي': 'Sport Grey',
                    'رمادي': 'Grey',
                    'بني': 'Brown',
                    'أحمر': 'Red',
                    'أصفر': 'Yellow',
                    'فضي': 'Silver',
                    'ذهبي': 'Gold'
                }
            };

            let text = rawName;
            const sizeLabel = currentLang === 'fr' ? 'Taille' : 'Size';
            const colorLabel = currentLang === 'fr' ? 'Couleur' : 'Color';
            const volumeLabel = currentLang === 'fr' ? 'Volume' : 'Size';

            text = text.replace(/المقاس\s*:\s*/gi, `${sizeLabel}: `)
                       .replace(/مقاس\s*:\s*/gi, `${sizeLabel}: `);

            text = text.replace(/اللون\s*:\s*/gi, `${colorLabel}: `)
                       .replace(/لون\s*:\s*/gi, `${colorLabel}: `);

            text = text.replace(/الحجم\s*:\s*/gi, `${volumeLabel}: `)
                       .replace(/حجم\s*:\s*/gi, `${volumeLabel}: `);

            text = text.replace(/مل/g, 'ml');

            const dict = colorMap[currentLang] || colorMap.fr;
            for (const [arColor, translatedColor] of Object.entries(dict)) {
                if (text.includes(arColor)) {
                    text = text.replace(new RegExp(arColor, 'g'), translatedColor);
                }
            }

            return text;
        }

        function renderProductUI(product, lang) {
            if (!product) return;
            const currentLang = lang || (window.I18n ? window.I18n.currentLang : 'ar');
            const locP = getLocalizedProduct(product, currentLang);
            const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';

            const breadcrumbEl = document.getElementById('product-breadcrumb');
            if (breadcrumbEl) breadcrumbEl.textContent = locP.name;

            const nameEl = document.getElementById('product-name');
            if (nameEl) { nameEl.removeAttribute('data-i18n'); nameEl.textContent = locP.name; }

            const cur = Number(product.price) || 0;
            const unitPrice = cur + (selectedVariant ? Number(selectedVariant.priceModifier || 0) : 0);
            const priceEl = document.getElementById('product-price');
            if (priceEl) priceEl.textContent = `${unitPrice.toLocaleString()} ${currency}`;

            const oldP = Number(product.old_price || product.compare_at_price || 0);
            const oldEl = document.getElementById('old-price');
            const discEl = document.getElementById('discount');
            if (oldEl && discEl) {
                if (oldP > cur && cur > 0) {
                    oldEl.textContent = `${oldP.toLocaleString()} ${currency}`;
                    discEl.textContent = `-${Math.round((1 - cur / oldP) * 100)}%`;
                    oldEl.hidden = false;
                    discEl.hidden = false;
                } else {
                    oldEl.hidden = true;
                    discEl.hidden = true;
                }
            }

            const safeDescription = locP.description ? (window.escapeHtml ? window.escapeHtml(locP.description).replace(/\n/g, '<br>') : locP.description) : `<span data-i18n="product.no_description">${window.I18n ? window.I18n.t('product.no_description', 'وصف غير متوفر') : 'وصف غير متوفر'}</span>`;
            const descEl = document.getElementById('product-description');
            if (descEl) descEl.innerHTML = `<p>${safeDescription}</p>`;
            const dc = document.getElementById('description-content');
            if (dc) dc.innerHTML = `<p>${safeDescription}</p>`;

            const storeName = window.I18n ? window.I18n.t('common.store_name', 'متجر رواق') : 'متجر رواق';
            document.title = `${locP.name} - ${storeName}`;

            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc && locP.description) metaDesc.content = locP.description.substring(0, 160);

            // Stock badge update
            const stockNum = Number(product.stock || 0);
            const addBtn = document.querySelector('.add-to-cart');
            const badgeWrap = document.getElementById('product-stock-badge-wrap');
            if (badgeWrap && !selectedVariant) {
                if (stockNum <= 0) {
                    badgeWrap.innerHTML = '<span class="product-stock-note is-out" style="display:inline-flex; align-items:center; gap:6px; background:#fef2f2; color:#dc2626; padding:6px 14px; border-radius:20px; font-size:0.88rem; font-weight:600;"><i class="fas fa-times-circle"></i> ' + (window.I18n ? window.I18n.t('product.out_of_stock', 'نفد المخزون') : 'نفد المخزون') + '</span>';
                } else if (stockNum <= 5) {
                    badgeWrap.innerHTML = '<span class="product-stock-note is-low" style="display:inline-flex; align-items:center; gap:6px; background:#fffbeb; color:#b45309; padding:6px 14px; border-radius:20px; font-size:0.88rem; font-weight:600;"><i class="fas fa-fire-alt"></i> ' + (window.I18n ? window.I18n.t('product.few_left', 'متبقي {count} قطع فقط! ⚡').replace('{count}', stockNum) : ('متبقي ' + stockNum + ' قطع فقط! ⚡')) + '</span>';
                } else {
                    badgeWrap.innerHTML = '<span class="product-stock-note" style="display:inline-flex; align-items:center; gap:6px; background:#ecfdf5; color:#059669; padding:6px 14px; border-radius:20px; font-size:0.88rem; font-weight:600;"><i class="fas fa-check-circle"></i> ' + (window.I18n ? window.I18n.t('common.in_stock', 'متوفر في المخزون') : 'متوفر في المخزون') + '</span>';
                }
            }
            if (stockNum <= 0 && addBtn && !selectedVariant) {
                addBtn.disabled = true;
                addBtn.style.background = '#94a3b8';
                addBtn.style.cursor = 'not-allowed';
                addBtn.textContent = window.I18n ? window.I18n.t('product.out_of_stock_now', 'نفد المخزون حالياً') : 'نفد المخزون حالياً';
            }

            loadProductOptions(product);
            loadExpressWilayas();
            updateExpressCalculations();
            if (window.I18n && typeof window.I18n.translatePage === 'function' && window.I18n.currentLang !== 'ar') {
                window.I18n.translatePage();
            }
        }

        async function loadProductDetails() {
            try {
                let product = await initialProductFetch;
                if (!product) {
                    const response = await fetch(`/api/products/${productId}`);
                    if (!response.ok) throw new Error(window.I18n ? window.I18n.t('messages.fetch_product_error', 'خطأ في جلب المنتج') : 'خطأ في جلب المنتج');
                    product = await response.json();
                }
                currentProduct = product;

                const thumbnails = document.getElementById('thumbnail-images');
                const mainImage = document.getElementById('main-image');
                
                // Collect strictly distinct images from main product and variants (normalized deduplication)
                const normalizeImgKey = (u) => {
                    if (!u || typeof u !== 'string') return '';
                    let clean = u.trim().split('?')[0].split('#')[0];
                    clean = clean.replace(/^\/+/, '');
                    clean = clean.replace(/-(?:400|800)\.[a-zA-Z0-9]+$/, '');
                    clean = clean.replace(/\.[a-zA-Z0-9]+$/, '');
                    return clean.toLowerCase();
                };

                const images = [];
                const seenKeys = new Set();
                const addDistinctImage = (img, prepend = false) => {
                    if (!img || typeof img !== 'string') return;
                    const key = normalizeImgKey(img);
                    if (!key || seenKeys.has(key)) return;
                    seenKeys.add(key);
                    if (prepend) {
                        images.unshift(img);
                    } else {
                        images.push(img);
                    }
                };

                if (currentProduct.image_url) {
                    addDistinctImage(currentProduct.image_url);
                }
                if (Array.isArray(currentProduct.images)) {
                    currentProduct.images.forEach(img => addDistinctImage(img));
                }
                if (Array.isArray(currentProduct.variants)) {
                    currentProduct.variants.forEach(v => {
                        const vImg = v.imageUrl || v.image_url;
                        addDistinctImage(vImg);
                    });
                }
                if (images.length === 0) images.push('/images/product-placeholder.jpg');

                if (thumbnails) {
                    thumbnails.innerHTML = images.map((img, index) => {
                        const altText = window.I18n ? window.I18n.t('product.image_alt', 'صورة {index}').replace('{index}', index + 1) : `Image ${index + 1}`;
                        const thumbImg = transformProductImage(img, 150, 150);
                        return `<img src="${thumbImg}" data-full="${img}" width="150" height="150" alt="${altText}" class="thumbnail ${index === 0 ? 'active' : ''}" data-action="switchImage" data-index="${index}" loading="lazy">`;
                    }).join('');
                }
                if (mainImage) {
                    const wrap = document.getElementById('main-image-wrap') || mainImage.parentElement;
                    const revealImage = () => {
                        mainImage.style.opacity = '1';
                        if (wrap) wrap.classList.remove('skeleton');
                    };

                    mainImage.onload = revealImage;
                    mainImage.onerror = () => {
                        mainImage.src = '/images/product-placeholder.jpg';
                        mainImage.removeAttribute('srcset');
                        revealImage();
                    };

                    const mainImgSrc = transformProductImage(images[0], 400, 400);
                    if (!mainImage.src.includes(mainImgSrc)) {
                        mainImage.src = mainImgSrc;
                    }
                    mainImage.setAttribute('width', '800');
                    mainImage.setAttribute('height', '800');
                    const realSrcset = getProductSrcset(images[0]);
                    if (realSrcset) {
                        mainImage.srcset = realSrcset;
                        mainImage.sizes = '(max-width: 768px) 100vw, 500px';
                    } else {
                        mainImage.removeAttribute('srcset');
                    }

                    if (mainImage.complete && mainImage.naturalWidth > 0) {
                        revealImage();
                    }
                }

                renderProductUI(currentProduct, window.I18n ? window.I18n.currentLang : 'ar');
                updateProductRating(currentProduct.rating || 5.0);

                if ('requestIdleCallback' in window) {
                    window.requestIdleCallback(() => loadSimilarProducts(currentProduct.category), { timeout: 2000 });
                } else {
                    setTimeout(() => loadSimilarProducts(currentProduct.category), 300);
                }
            } catch (error) {
                console.error('Error loading product:', error);
                const container = document.querySelector('.product-details .container');
                if (container) {
                    container.innerHTML = `
                        <div class="empty-state" style="text-align: center; padding: 60px 20px; max-width: 500px; margin: 40px auto; background: var(--card-bg, #fff); border-radius: var(--radius-md, 12px); border: 1px solid var(--border-color, #e2e8f0); box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.05));">
                            <i class="fas fa-box-open" style="font-size: 3.5rem; color: var(--text-muted, #94a3b8); margin-bottom: 18px;"></i>
                            <h2 style="font-size: 1.4rem; margin-bottom: 10px; color: var(--text-main, #1e293b);">${window.I18n ? window.I18n.t('product.not_found', 'المنتج غير متوفر') : 'المنتج غير متوفر'}</h2>
                            <p style="color: var(--text-muted, #64748b); margin-bottom: 24px; font-size: 0.95rem; line-height: 1.6;">${window.I18n ? window.I18n.t('product.not_found_desc', 'عذراً، هذا المنتج غير متوفر حالياً أو ربما تم حذفه.') : 'عذراً، هذا المنتج غير متوفر حالياً أو ربما تم حذفه.'}</p>
                            <a href="shop.html" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 99px; text-decoration: none; font-weight: 600;">
                                <i class="fas fa-shopping-bag"></i>
                                <span>${window.I18n ? window.I18n.t('shop.title', 'تصفح منتجات المتجر') : 'تصفح منتجات المتجر'}</span>
                            </a>
                        </div>
                    `;
                }
            }
        }

        async function loadProductReviews(productId) {
            const container = document.getElementById('reviews-container');
            if (!container) return;
            try {
                const res = await fetch(`/api/products/${productId}/reviews`);
                if (!res.ok) return;
                const reviews = await res.json();
                if (!reviews || !reviews.length) {
                    container.innerHTML = '<p style="color:var(--light-text); padding:15px;">' + window.I18n.t('product.no_reviews_yet', 'لا توجد تقييمات لهذا المنتج بعد. كن أول من يقيّم هذا المنتج!') + '</p>';
                    return;
                }
                const currentLang = window.I18n ? window.I18n.currentLang : 'ar';
                const currentLocale = currentLang === 'fr' ? 'fr-FR' : (currentLang === 'en' ? 'en-US' : 'ar-DZ');
                const defaultCustomerText = window.I18n ? window.I18n.t('product.store_customer', 'عميل المتجر') : 'عميل المتجر';

                container.innerHTML = reviews.map(r => {
                    const safeUser = window.escapeHtml ? window.escapeHtml(r.username || defaultCustomerText) : (r.username || defaultCustomerText);
                    const safeComment = window.escapeHtml ? window.escapeHtml(r.comment || '') : (r.comment || '');
                    return `
                    <div class="review-item" style="border-bottom: 1px solid var(--border-color); padding: 12px 0;">
                        <div class="review-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <div class="reviewer-info">
                                <strong class="reviewer-name">${safeUser}</strong>
                                <span class="review-date" style="color: var(--light-text, #64748b); font-size: 0.85rem; margin-inline-start: 8px;">${window.I18n ? window.I18n.formatDate(r.created_at || Date.now()) : new Date(r.created_at || Date.now()).toLocaleDateString()}</span>
                            </div>
                            <div class="review-rating" style="color: #f59e0b;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                        </div>
                        <div class="review-content"><p style="margin: 0; color: var(--text-color, #334155);">${safeComment}</p></div>
                    </div>
                `}).join('');
            } catch (e) {}
        }

        function switchImage(index) {
            const thumbnails = document.querySelectorAll('.thumbnail-images img, #thumbnail-images img');
            const mainImage = document.getElementById('main-image');
            if (!thumbnails[index] || !mainImage) return;

            thumbnails.forEach((thumb, i) => thumb.classList.toggle('active', i === index));
            const fullImg = thumbnails[index].getAttribute('data-full') || thumbnails[index].getAttribute('src');
            const newSrc = transformProductImage(fullImg, 800, 800);

            mainImage.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            mainImage.style.opacity = '0.3';
            setTimeout(() => {
                mainImage.src = newSrc;
                const realSrcset = getProductSrcset(fullImg);
                if (realSrcset) {
                    mainImage.srcset = realSrcset;
                    mainImage.sizes = '(max-width: 768px) 100vw, 800px';
                } else {
                    mainImage.removeAttribute('srcset');
                }
                mainImage.style.opacity = '1';
            }, 120);

            // If a variant corresponds to this image, select it
            if (currentProduct && Array.isArray(currentProduct.variants)) {
                const matchingVariant = currentProduct.variants.find(v => {
                    const vImg = v.imageUrl || v.image_url;
                    return vImg && (vImg === fullImg || vImg === newSrc || (fullImg && fullImg.endsWith(vImg)));
                });
                if (matchingVariant && (!selectedVariant || Number(selectedVariant.id) !== Number(matchingVariant.id))) {
                    selectedVariant = matchingVariant;
                    document.querySelectorAll('.variant-btn').forEach(b => {
                        b.classList.toggle('active', Number(b.dataset.id) === Number(matchingVariant.id));
                    });
                    const activeNameEl = document.getElementById('active-variant-name');
                    if (activeNameEl) activeNameEl.textContent = formatVariantName(matchingVariant.name);
                    updateVariantDisplay(currentProduct, matchingVariant, false);
                }
            }
        }

        function openLightbox() {
            const mainImage = document.getElementById('main-image');
            const lightbox = document.getElementById('product-lightbox');
            const lightboxImg = document.getElementById('lightbox-image');
            if (!lightbox || !lightboxImg || !mainImage) return;

            const activeThumb = document.querySelector('.thumbnail-images img.active, #thumbnail-images img.active');
            let fullSrc = activeThumb ? (activeThumb.getAttribute('data-full') || activeThumb.getAttribute('src')) : mainImage.getAttribute('src');
            if (fullSrc && fullSrc.includes('w_')) {
                fullSrc = fullSrc.replace(/w_\d+,h_\d+[^/]*\//, '');
            }
            lightboxImg.src = fullSrc;
            const fullSrcset = getProductSrcset(fullSrc);
            if (fullSrcset) {
                lightboxImg.srcset = fullSrcset;
                lightboxImg.sizes = '100vw';
            } else {
                lightboxImg.removeAttribute('srcset');
            }
            lightbox.hidden = false;
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            const lightbox = document.getElementById('product-lightbox');
            if (!lightbox) return;
            lightbox.hidden = true;
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
            }
        });

        function renderStars(rating) {
            const r = Number(rating) || 5;
            let html = '';
            for (let i = 1; i <= 5; i++) {
                if (r >= i) {
                    html += '<i class="fas fa-star"></i>';
                } else if (r >= i - 0.5) {
                    html += '<i class="fas fa-star-half-alt"></i>';
                } else {
                    html += '<i class="far fa-star"></i>';
                }
            }
            return html;
        }

        function updateProductRating(rating) {
            const r = Number(rating) || 5;
            const starsEl = document.getElementById('product-rating-stars');
            const scoreEl = document.getElementById('rating-score');
            if (starsEl) starsEl.innerHTML = renderStars(r);
            if (scoreEl) scoreEl.textContent = '(' + r.toFixed(1) + ')';
        }

        function updateReviewStars(rating) {
            const stars = document.querySelectorAll('#review-stars i');
            stars.forEach((star, index) => {
                if (index < rating) {
                    star.className = 'fas fa-star';
                    star.style.color = '#f59e0b';
                } else {
                    star.className = 'far fa-star';
                    star.style.color = '';
                }
            });
        }

        function updateStars(rating) {
            updateReviewStars(rating);
        }

        function updateVariantDisplay(product, variant, shouldSyncThumbnail = true) {
            if (!variant) return;

            // 1. Update Unit Price
            const unitPrice = Number(product.price) + Number(variant.priceModifier || 0);
            const priceEl = document.getElementById('product-price');
            if (priceEl) {
                const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
                priceEl.textContent = `${unitPrice.toLocaleString()} ${currency}`;
            }

            // 2. Switch Main Image smoothly if variant has image
            const targetImg = variant.imageUrl || variant.image_url || product.image_url || product.image;
            if (targetImg) {
                const mainImage = document.getElementById('main-image');
                if (mainImage && !mainImage.src.endsWith(targetImg)) {
                    mainImage.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                    mainImage.style.opacity = '0.3';
                    setTimeout(() => {
                        mainImage.src = targetImg;
                        mainImage.style.opacity = '1';
                    }, 120);
                }

                if (shouldSyncThumbnail) {
                    const thumbs = document.querySelectorAll('.thumbnail-images img, #thumbnail-images img');
                    thumbs.forEach(t => {
                        const src = t.getAttribute('src');
                        if (src === targetImg || (t.src && t.src.endsWith(targetImg))) {
                            t.classList.add('active');
                        } else {
                            t.classList.remove('active');
                        }
                    });
                }
            }

            // 3. Update Stock Badge & Buttons
            const badgeWrap = document.getElementById('product-stock-badge-wrap');
            const addBtn = document.querySelector('.add-to-cart');
            const expressSubmitBtn = document.getElementById('express-submit-btn');
            const isOutOfStock = (variant.stock !== null && variant.stock !== undefined && Number(variant.stock) <= 0);

            if (badgeWrap) {
                if (isOutOfStock) {
                    badgeWrap.innerHTML = '<span class="product-stock-note" style="display:inline-flex; align-items:center; gap:6px; background:rgba(239, 68, 68, 0.12); color:#ef4444; padding:6px 14px; border-radius:20px; font-size:0.88rem; font-weight:600;"><i class="fas fa-times-circle"></i> ' + (window.I18n ? window.I18n.t('product.variant_out_of_stock', 'نفد من المخزون') : 'نفد من المخزون') + '</span>';
                } else if (Number(variant.stock) <= 3) {
                    badgeWrap.innerHTML = '<span class="product-stock-note" style="display:inline-flex; align-items:center; gap:6px; background:rgba(245, 158, 11, 0.12); color:#f59e0b; padding:6px 14px; border-radius:20px; font-size:0.88rem; font-weight:600;"><i class="fas fa-exclamation-triangle"></i> ' + (window.I18n ? window.I18n.t('product.hurry_stock', `⚠️ سارع بالطلب! متبقي ${variant.stock} قطع فقط في المخزون`).replace('{count}', variant.stock) : `⚠️ سارع بالطلب! متبقي ${variant.stock} قطع فقط في المخزون`) + '</span>';
                } else {
                    badgeWrap.innerHTML = '<span class="product-stock-note" style="display:inline-flex; align-items:center; gap:6px; background:#ecfdf5; color:#059669; padding:6px 14px; border-radius:20px; font-size:0.88rem; font-weight:600;"><i class="fas fa-check-circle"></i> ' + (window.I18n ? window.I18n.t('common.in_stock', 'متوفر في المخزون') : 'متوفر في المخزون') + ` (${variant.stock})` + '</span>';
                }
            }

            if (addBtn) {
                if (isOutOfStock) {
                    addBtn.disabled = true;
                    addBtn.style.opacity = '0.5';
                    addBtn.style.cursor = 'not-allowed';
                    addBtn.innerHTML = '<i class="fas fa-ban"></i> ' + (window.I18n ? window.I18n.t('product.variant_out_of_stock', 'نفد من المخزون') : 'نفد من المخزون');
                } else {
                    addBtn.disabled = false;
                    addBtn.style.opacity = '1';
                    addBtn.style.cursor = 'pointer';
                    addBtn.innerHTML = '<i class="fas fa-cart-plus"></i> ' + (window.I18n ? window.I18n.t('common.add_to_cart', 'أضف إلى السلة') : 'أضف إلى السلة');
                }
            }

            if (expressSubmitBtn) {
                expressSubmitBtn.disabled = isOutOfStock;
            }

            // 4. Update Express Order Calculations
            updateExpressCalculations();
        }

        function loadProductOptions(product) {
            const optionsContainer = document.getElementById('product-options') || document.querySelector('.product-options');
            if (!optionsContainer) return;

            if (product.variants && product.variants.length > 0) {
                optionsContainer.style.display = 'block';
                const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
                const availableText = window.I18n ? window.I18n.t('product.available_options', 'الخيارات المتاحة (المقاس / اللون / السعة):') : 'الخيارات المتاحة (المقاس / اللون / السعة):';
                const selectedText = window.I18n ? window.I18n.t('product.selected_option', 'الخيار المحدد:') : 'الخيار المحدد:';

                // Preserve selected variant if valid, or default to first in-stock variant
                let inStockVariant = null;
                if (selectedVariant && product.variants.some(v => Number(v.id) === Number(selectedVariant.id))) {
                    inStockVariant = product.variants.find(v => Number(v.id) === Number(selectedVariant.id));
                }
                if (!inStockVariant) {
                    inStockVariant = product.variants.find(v => (v.stock === null || v.stock === undefined || Number(v.stock) > 0));
                }
                selectedVariant = inStockVariant || product.variants[0];

                optionsContainer.innerHTML = `
                    <div class="variant-options">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                            <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-color, #1e293b); margin: 0; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-layer-group" style="color: var(--primary-color);"></i>
                                <span>${availableText}</span>
                            </h3>
                            <span style="font-size: 0.85rem; color: var(--light-text, #64748b);">
                                ${selectedText} <strong id="active-variant-name" style="color: var(--primary-color);">${selectedVariant ? (window.escapeHtml ? window.escapeHtml(formatVariantName(selectedVariant.name)) : formatVariantName(selectedVariant.name)) : ''}</strong>
                            </span>
                        </div>
                        <div class="variant-select">
                            ${product.variants.map((v) => {
                                const isSelected = selectedVariant && Number(selectedVariant.id) === Number(v.id);
                                const isOutOfStock = (v.stock !== null && v.stock !== undefined && Number(v.stock) <= 0);
                                const hasPriceMod = Number(v.priceModifier) !== 0;
                                const priceModSign = Number(v.priceModifier) > 0 ? '+' : '';
                                const translatedName = formatVariantName(v.name);
                                const safeTranslatedName = window.escapeHtml ? window.escapeHtml(translatedName) : translatedName;

                                return `
                                    <button type="button" 
                                        class="variant-btn ${isSelected ? 'active' : ''} ${isOutOfStock ? 'out-of-stock' : ''}" 
                                        data-id="${v.id}" 
                                        data-price-mod="${v.priceModifier || 0}"
                                        data-stock="${v.stock}"
                                        data-name="${safeTranslatedName}"
                                        ${isOutOfStock ? 'title="' + (window.I18n ? window.I18n.t('product.variant_out_of_stock', 'نفد من المخزون') : 'نفد من المخزون') + '"' : ''}>
                                        <span class="variant-name">${safeTranslatedName}</span>
                                        ${hasPriceMod ? `<span class="variant-price-mod">${priceModSign}${Number(v.priceModifier).toLocaleString()} ${currency}</span>` : ''}
                                        ${isOutOfStock ? `<span class="variant-badge out">${window.I18n ? window.I18n.t('product.variant_out_of_stock', 'نفد') : 'نفد'}</span>` : ''}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;

                // Update active variant display & stock
                updateVariantDisplay(product, selectedVariant);

                document.querySelectorAll('.variant-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const target = e.currentTarget;
                        const vId = Number(target.dataset.id);
                        const v = product.variants.find(item => Number(item.id) === vId);
                        if (!v) return;

                        document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                        target.classList.add('active');

                        selectedVariant = v;
                        const activeNameEl = document.getElementById('active-variant-name');
                        if (activeNameEl) activeNameEl.textContent = formatVariantName(v.name);

                        updateVariantDisplay(product, v);
                    });
                });
            } else {
                // If product has no variants, do not display dummy options
                optionsContainer.innerHTML = '';
                optionsContainer.style.display = 'none';
                selectedVariant = null;
            }
        }

        function changeQuantity(change) {
            let quantity = parseInt(document.getElementById('quantity').value);
            quantity = Math.max(1, Math.min(10, quantity + change));
            document.getElementById('quantity').value = quantity;
            updateExpressCalculations();
        }

        async function addToCartFromProduct() {
            if (!currentProduct) return;
            const quantity = parseInt(document.getElementById('quantity').value, 10) || 1;

            let itemName = currentProduct.name;
            let unitPrice = Number(currentProduct.price) || 0;
            let itemImage = currentProduct.image || currentProduct.image_url || '/images/product-placeholder.jpg';
            let variantId = null;

            if (selectedVariant) {
                variantId = selectedVariant.id;
                itemName = `${currentProduct.name} (${selectedVariant.name})`;
                unitPrice += Number(selectedVariant.priceModifier || 0);
                if (selectedVariant.imageUrl) itemImage = selectedVariant.imageUrl;
            }

            const cartItem = {
                id: currentProduct.id,
                product_id: currentProduct.id,
                variant_id: variantId,
                variantId: variantId,
                name: itemName,
                category: currentProduct.category || currentProduct.category_name || '',
                price: unitPrice,
                image: itemImage,
                image_url: itemImage,
                quantity
            };
            
            if (typeof window.addToCart === 'function') {
                await window.addToCart(cartItem, quantity);
            } else {
                try {
                    let cart = [];
                    try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
                    const cartKey = variantId ? `${currentProduct.id}_v${variantId}` : String(currentProduct.id);
                    const existingIndex = cart.findIndex(item => {
                        const itemKey = item.cartKey || (item.variant_id ? `${item.id}_v${item.variant_id}` : String(item.id));
                        return itemKey === cartKey;
                    });
                    if (existingIndex !== -1) {
                        cart[existingIndex].quantity = Math.min(20, cart[existingIndex].quantity + quantity);
                    } else {
                        cart.push({
                            cartKey,
                            id: currentProduct.id,
                            variant_id: variantId,
                            variantId: variantId,
                            name: itemName,
                            category: currentProduct.category || currentProduct.category_name || '',
                            price: unitPrice,
                            image: itemImage,
                            image_url: itemImage,
                            quantity
                        });
                    }
                    localStorage.setItem('cart', JSON.stringify(cart));
                    window.cart = cart;
                    if (window.showToast) {
                        window.showToast(window.I18n ? window.I18n.t('messages.add_cart_success', 'تمت إضافة المنتج إلى السلة بنجاح! 🛒') : 'تمت إضافة المنتج إلى السلة بنجاح! 🛒', 'success');
                    }
                } catch (error) {
                    if (window.showToast) {
                        window.showToast(window.I18n ? window.I18n.t('messages.add_cart_error', 'حدث خطأ أثناء إضافة المنتج') : 'حدث خطأ أثناء إضافة المنتج', 'error');
                    }
                }
            }
            
            setTimeout(() => {
                window.location.href = 'cart.html';
            }, 600);
        }

        async function addToWishlist() {
            if (!currentProduct) return;
            if (typeof loadSecondaryModules === 'function' && !window.WishlistManager) {
                loadSecondaryModules();
            }
            if (window.WishlistManager) {
                const added = await window.WishlistManager.toggleItem(currentProduct);
                const heartBtn = document.querySelector('.add-to-wishlist i');
                if (heartBtn) {
                    heartBtn.className = added ? 'fas fa-heart' : 'far fa-heart';
                    heartBtn.style.color = added ? '#ef4444' : '';
                }
            } else {
                if (window.showToast) window.showToast(window.I18n ? window.I18n.t('messages.add_wishlist_success', 'تمت إضافة المنتج إلى قائمة الرغبات') : 'تمت إضافة المنتج إلى قائمة الرغبات', 'success');
                else alert(window.I18n.t('messages.add_wishlist_success', 'تمت إضافة المنتج إلى قائمة الرغبات'));
            }
        }

        function initTabs() {
            const tabBtns = document.querySelectorAll('.tab-btn');
            const tabPanels = document.querySelectorAll('.tab-panel');
            tabBtns.forEach(btn => btn.addEventListener('click', e => {
                const tab = e.target.dataset.tab;
                tabBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                tabPanels.forEach(p => p.classList.remove('active'));
                document.getElementById(tab).classList.add('active');
            }));
        }

        async function submitReview() {
            if (!currentProduct) return;
            const rating = parseInt(document.getElementById('review-rating').value, 10);
            const comment = document.getElementById('review-comment').value.trim();
            if (isNaN(rating) || rating < 1 || !comment) {
                if (window.showToast) window.showToast(window.I18n.t('messages.review_validation', 'يرجى اختيار التقييم بالنجوم وكتابة تعليقك'), 'warning');
                else alert(window.I18n.t('messages.review_validation', 'يرجى اختيار التقييم بالنجوم وكتابة تعليقك'));
                return;
            }

            const submitBtn = document.querySelector('#add-review button[type="button"], #add-review .btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.origText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + window.I18n.t('common.sending', 'جاري الإرسال...');
            }

            try {
                let csrfToken = '';
                try {
                    const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
                    if (csrfRes.ok) {
                        const csrfData = await csrfRes.json();
                        csrfToken = csrfData.csrfToken || '';
                    }
                } catch (e) {}

                const headers = { 'Content-Type': 'application/json' };
                if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

                const res = await fetch(`/api/products/${currentProduct.id}/reviews`, {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: JSON.stringify({ rating, comment })
                });

                if (res.status === 401 || res.status === 403) {
                    if (window.showToast) window.showToast(window.I18n.t('messages.login_to_review', 'يرجى تسجيل الدخول أولاً لإضافة تقييمك ⭐'), 'warning');
                    else alert(window.I18n.t('messages.login_to_review_alt', 'يرجى تسجيل الدخول أولاً لإضافة تقييمك'));
                    return;
                }

                const data = await res.json();
                if (!res.ok) throw new Error(getErrorMessage(data, 'messages.submit_review_fail'));

                const successMsg = (data && data.code && window.I18n ? window.I18n.t('errors.' + data.code) : null) || data.message || window.I18n.t('messages.submit_review_success', 'تمت إضافة تقييمك بنجاح! ⭐');
                if (window.showToast) window.showToast(successMsg, 'success');
                else alert(successMsg);

                document.getElementById('review-comment').value = '';
                document.getElementById('review-rating').value = 0;
                updateReviewStars(0);
                loadProductReviews(currentProduct.id);
            } catch (err) {
                if (window.showToast) window.showToast(getErrorMessage(err, 'messages.submit_review_fail'), 'error');
                else alert(getErrorMessage(err, 'messages.submit_review_fail'));
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = submitBtn.dataset.origText || window.I18n.t('product.submit_review', 'إرسال التقييم');
                }
            }
        }

        document.getElementById('review-stars').addEventListener('click', e => {
            if (e.target.classList.contains('fa-star')) {
                const rating = parseInt(e.target.dataset.rating);
                document.getElementById('review-rating').value = rating;
                updateReviewStars(rating);
            }
        });

        async function loadSimilarProducts(category) {
            try {
                const response = await fetch(`/api/products?category=${encodeURIComponent(category || '')}`);
                if (!response.ok) throw new Error(window.I18n ? window.I18n.t('messages.fetch_products_error', 'خطأ في جلب المنتجات') : 'خطأ في جلب المنتجات');
                const data = await response.json();
                const allProducts = Array.isArray(data) ? data : (Array.isArray(data && data.products) ? data.products : []);
                const similar = allProducts.filter(p => p.id !== (currentProduct ? currentProduct.id : 0)).slice(0, 4);
                const container = document.getElementById('similar-products');
                if (!container) return;
                if (!similar.length) {
                    container.innerHTML = '<p style="color: var(--light-text, #64748b); padding: 15px;">' + (window.I18n ? window.I18n.t('product.no_similar_products', 'لا توجد منتجات مشابهة حالياً') : 'لا توجد منتجات مشابهة حالياً') + '</p>';
                    return;
                }
                const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
                const viewDetailsText = window.I18n ? window.I18n.t('product.view_details', 'عرض التفاصيل') : 'عرض التفاصيل';

                const wishlistIds = (window.getWishlist && typeof window.getWishlist === 'function')
                    ? window.getWishlist()
                    : (() => { try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); } catch(e) { return []; } })();
                container.innerHTML = similar.map(p => {
                    const locP = getLocalizedProduct(p);
                    const safeName = window.escapeHtml ? window.escapeHtml(locP.name) : locP.name;
                    const simCatRaw = (locP.category && locP.category !== 'عام') ? locP.category : (p.category_name || category || '');
                    const safeCat = window.escapeHtml ? window.escapeHtml(simCatRaw) : simCatRaw;
                    const hasDiscount = p.old_price && Number(p.old_price) > Number(p.price);
                    const discountPct = hasDiscount ? Math.round((1 - Number(p.price) / Number(p.old_price)) * 100) : null;
                    const stockNum = Number(p.stock) || 0;
                    const isFav = wishlistIds.includes(p.id);
                    const simImg = transformProductImage(p.image_url || '/images/product-placeholder.jpg', 200, 200);
                    const thumbSrcset = getThumbSrcset(p.image_url);
                    const rating = Number(p.rating) || 5;
                    const fullStars = Math.min(5, Math.max(1, Math.round(rating)));
                    const starsHtml = '<i class="fas fa-star"></i>'.repeat(fullStars) + '<i class="far fa-star"></i>'.repeat(5 - fullStars);

                    return `
                    <div class="product-card similar-product" id="similar-product-${p.id}">
                        <div class="product-image-container">
                            ${hasDiscount ? `<span class="product-badge">-${discountPct}%</span>` : ''}
                            <button type="button" class="product-wishlist ${isFav ? 'active' : ''}" data-wishlist-id="${p.id}" data-action="toggleWishlist" data-args="${p.id}" data-i18n-title="common.wishlist" aria-label="${window.I18n ? window.I18n.t('common.wishlist', 'المفضلة') : 'المفضلة'}">
                                <i class="${isFav ? 'fas fa-heart text-danger' : 'far fa-heart'}"></i>
                            </button>
                            <a href="product.html?id=${p.id}" class="product-image">
                                <img src="${simImg}" ${thumbSrcset ? `srcset="${thumbSrcset}" sizes="(max-width: 768px) 170px, 280px"` : ''} width="200" height="200" alt="${safeName}" loading="lazy" decoding="async">
                            </a>
                        </div>
                        <div class="product-info">
                            ${safeCat ? `<span class="product-category">${safeCat}</span>` : ''}
                            <h3 class="product-name"><a href="product.html?id=${p.id}" title="${safeName}">${safeName}</a></h3>
                            <div class="product-rating" aria-label="${rating} / 5">
                                <div class="rating-stars">${starsHtml}</div>
                                <span class="rating-count">(${rating.toFixed(1)})</span>
                            </div>
                            <div class="product-price-row">
                                <div class="price-group">
                                    <span class="product-price">${Number(p.price).toLocaleString()} <small>${currency}</small></span>
                                    ${hasDiscount ? `<span class="product-old-price">${Number(p.old_price).toLocaleString()} <small>${currency}</small></span>` : ''}
                                </div>
                            </div>
                            <div class="product-card-actions">
                                <a href="product.html?id=${p.id}" class="btn btn-primary"><i class="fas fa-eye"></i> <span data-i18n="product.view_details">${viewDetailsText}</span></a>
                            </div>
                        </div>
                    </div>`;
                }).join('');
                if (window.I18n && typeof window.I18n.translatePage === 'function' && window.I18n.currentLang !== 'ar') {
                    window.I18n.translatePage(container);
                }
            } catch (error) {
                const container = document.getElementById('similar-products');
                if (container) {
                    container.innerHTML = '<p style="color: var(--light-text, #64748b); padding: 15px;">' + (window.I18n ? window.I18n.t('product.no_similar_products_alt', 'لا توجد منتجات مشابهة') : 'لا توجد منتجات مشابهة') + '</p>';
                }
            }
        }

        let wilayasList = [];

        async function loadExpressWilayas() {
            const select = document.getElementById('express-wilaya');
            if (!select) return;
            const prevValue = select.value;

            if (!wilayasList || !wilayasList.length) {
                try {
                    const res = await fetch('/api/wilayas');
                    if (res.ok) {
                        wilayasList = await res.json();
                    }
                } catch (e) {}
            }

            if (!wilayasList || !wilayasList.length) {
                wilayasList = [
                    { id: 16, name_ar: 'الجزائر', name_fr: 'Alger', home_delivery_price: 400, desk_delivery_price: 250 },
                    { id: 31, name_ar: 'وهران', name_fr: 'Oran', home_delivery_price: 500, desk_delivery_price: 350 },
                    { id: 25, name_ar: 'قسنطينة', name_fr: 'Constantine', home_delivery_price: 500, desk_delivery_price: 350 },
                    { id: 19, name_ar: 'سطيف', name_fr: 'Sétif', home_delivery_price: 500, desk_delivery_price: 350 },
                    { id: 9, name_ar: 'البليدة', name_fr: 'Blida', home_delivery_price: 450, desk_delivery_price: 300 }
                ];
            }

            const currentLang = window.I18n ? window.I18n.currentLang : 'ar';
            const isFrEn = currentLang === 'fr' || currentLang === 'en';
            const selectWilayaText = window.I18n ? window.I18n.t('product.select_wilaya', '-- اختر الولاية --') : '-- اختر الولاية --';

            select.innerHTML = `<option value="" data-i18n="product.select_wilaya">${selectWilayaText}</option>` + wilayasList.map(w => {
                const displayName = (isFrEn && w.name_fr) ? w.name_fr : (w.name_ar || w.name);
                return `<option value="${w.id}" data-name="${displayName}" data-home="${w.home_delivery_price || 500}" data-desk="${w.desk_delivery_price || 350}">
                    ${w.id} - ${displayName}
                </option>`;
            }).join('');

            if (prevValue && select.querySelector(`option[value="${prevValue}"]`)) {
                select.value = prevValue;
                onExpressWilayaChange();
            } else {
                const defaultWilaya = wilayasList.find(w => Number(w.id) === 16);
                if (defaultWilaya) {
                    select.value = String(defaultWilaya.id);
                    onExpressWilayaChange();
                } else {
                    updateExpressCalculations();
                }
            }
        }

        function onExpressWilayaChange() {
            const select = document.getElementById('express-wilaya');
            if (!select) return;
            const selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt && selectedOpt.dataset.home) {
                const homeEl = document.getElementById('express-home-price');
                const deskEl = document.getElementById('express-desk-price');
                if (homeEl) homeEl.textContent = Number(selectedOpt.dataset.home).toLocaleString();
                if (deskEl) deskEl.textContent = Number(selectedOpt.dataset.desk).toLocaleString();
            }
            updateExpressCalculations();
        }

        function updateExpressCalculations() {
            if (!currentProduct) return;
            const qty = parseInt(document.getElementById('quantity').value, 10) || 1;
            const unitPrice = (Number(currentProduct.price) || 0) + (selectedVariant ? Number(selectedVariant.priceModifier || 0) : 0);
            const subtotal = unitPrice * qty;

            const select = document.getElementById('express-wilaya');
            const selectedOpt = select ? select.options[select.selectedIndex] : null;
            const deliveryType = document.querySelector('input[name="express-delivery"]:checked')?.value || 'home';

            let shipping = 500;
            if (selectedOpt && selectedOpt.dataset.home) {
                shipping = deliveryType === 'desk' ? Number(selectedOpt.dataset.desk || 350) : Number(selectedOpt.dataset.home || 500);
            }

            const total = subtotal + shipping;
            const currency = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';

            const qtyEl = document.getElementById('express-qty-display');
            const subEl = document.getElementById('express-subtotal-display');
            const shipEl = document.getElementById('express-shipping-display');
            const totalEl = document.getElementById('express-total-display');

            if (qtyEl) qtyEl.textContent = qty;
            if (subEl) subEl.textContent = `${subtotal.toLocaleString()} ${currency}`;
            if (shipEl) shipEl.textContent = `${shipping.toLocaleString()} ${currency}`;
            if (totalEl) totalEl.textContent = `${total.toLocaleString()} ${currency}`;
        }

        async function handleExpressOrder(event) {
            event.preventDefault();
            if (!currentProduct) return;

            const name = document.getElementById('express-name').value.trim();
            const phone = document.getElementById('express-phone').value.trim();
            const wilayaSelect = document.getElementById('express-wilaya');
            const wilayaId = wilayaSelect.value;
            const selectedOpt = wilayaSelect.options[wilayaSelect.selectedIndex];
            const wilayaName = selectedOpt ? (selectedOpt.dataset.name || selectedOpt.text) : (window.I18n ? window.I18n.t('wilayas.algiers', 'الجزائر') : 'الجزائر');
            const address = document.getElementById('express-address').value.trim();
            const deliveryType = document.querySelector('input[name="express-delivery"]:checked')?.value || 'home';
            const quantity = parseInt(document.getElementById('quantity').value, 10) || 1;

            if (!name) {
                alert(window.I18n ? window.I18n.t('messages.enter_full_name', 'يرجى إدخال الاسم الكامل') : 'يرجى إدخال الاسم الكامل');
                return;
            }

            const cleanPhone = phone.replace(/[\s-]/g, '');
            if (!/^(0[567][0-9]{8}|0[2-49][0-9]{7}|\+213[567][0-9]{8})$/.test(cleanPhone)) {
                alert(window.I18n ? window.I18n.t('messages.enter_valid_phone', 'يرجى إدخال رقم هاتف جزائري صحيح') : 'يرجى إدخال رقم هاتف جزائري صحيح');
                return;
            }

            if (!wilayaId) {
                alert(window.I18n ? window.I18n.t('messages.select_wilaya', 'يرجى اختيار الولاية') : 'يرجى اختيار الولاية');
                return;
            }

            const submitBtn = document.getElementById('express-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (window.I18n ? window.I18n.t('messages.confirming_order', 'جاري تأكيد طلبك...') : 'جاري تأكيد طلبك...');
            }

            try {
                let csrfToken = '';
                try {
                    const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
                    if (csrfRes.ok) {
                        const csrfData = await csrfRes.json();
                        csrfToken = csrfData.csrfToken || '';
                    }
                } catch (e) {}

                const headers = { 'Content-Type': 'application/json' };
                if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

                let itemName = currentProduct.name;
                let unitPrice = Number(currentProduct.price) || 0;
                let itemImage = currentProduct.image_url || '/images/product-placeholder.jpg';
                let variantId = null;

                if (selectedVariant) {
                    variantId = selectedVariant.id;
                    itemName = `${currentProduct.name} (${selectedVariant.name})`;
                    unitPrice += Number(selectedVariant.priceModifier || 0);
                    if (selectedVariant.imageUrl) itemImage = selectedVariant.imageUrl;
                }

                const payload = {
                    cart: [{
                        id: currentProduct.id,
                        product_id: currentProduct.id,
                        variant_id: variantId,
                        variantId: variantId,
                        name: itemName,
                        price: unitPrice,
                        quantity,
                        image_url: itemImage
                    }],
                    paymentMethod: 'cod',
                    shippingInfo: {
                        fullName: name,
                        phone: cleanPhone,
                        address: address || wilayaName,
                        city: address || wilayaName,
                        wilayaId: Number(wilayaId),
                        wilayaName: wilayaName,
                        deliveryType: deliveryType,
                        paymentMethod: 'cod',
                        shippingCost: deliveryType === 'desk' ? Number(selectedOpt.dataset.desk || 350) : Number(selectedOpt.dataset.home || 500)
                    }
                };

                const res = await fetch('/api/orders', {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(getErrorMessage(data, 'messages.order_confirm_fail'));
                }

                window.location.href = `order-confirmation.html?id=${data.id}&orderNumber=${encodeURIComponent(data.orderNumber || '')}&token=${encodeURIComponent(data.trackingToken || '')}&phone=${encodeURIComponent(cleanPhone)}`;
            } catch (err) {
                alert(getErrorMessage(err, 'messages.order_error'));
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> <span data-i18n="product.confirm_order_now">' + (window.I18n ? window.I18n.t('product.confirm_order_now', 'اضغط هنا لتأكيد الطلب الآن ⚡') : 'اضغط هنا لتأكيد الطلب الآن ⚡') + '</span>';
                }
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            loadProductDetails();
            initTabs();
        });

        document.addEventListener('languageChanged', (e) => {
            const lang = e.detail?.lang || (window.I18n ? window.I18n.currentLang : 'ar');
            if (currentProduct) {
                renderProductUI(currentProduct, lang);
                loadSimilarProducts(currentProduct.category);
                loadProductReviews(currentProduct.id);
            }
        });

// Event Delegation
document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    
    const action = actionEl.dataset.action;
    if (action === 'changeQuantity') {
        e.preventDefault();
        window.changeQuantity(Number(actionEl.dataset.change));
    } else if (action === 'addToCartFromProduct') {
        e.preventDefault();
        window.addToCartFromProduct();
    } else if (action === 'addToWishlist') {
        e.preventDefault();
        window.addToWishlist();
    } else if (action === 'submitReview') {
        e.preventDefault();
        window.submitReview();
    } else if (action === 'switchImage') {
        e.preventDefault();
        window.switchImage(Number(actionEl.dataset.index));
    } else if (action === 'openLightbox') {
        e.preventDefault();
        window.openLightbox();
    } else if (action === 'closeLightbox') {
        e.preventDefault();
        window.closeLightbox();
    }
});

document.addEventListener('change', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    
    const action = actionEl.dataset.action;
    if (action === 'updateExpressCalculations') {
        window.updateExpressCalculations();
    } else if (action === 'onExpressWilayaChange') {
        window.onExpressWilayaChange();
    }
});

document.addEventListener('submit', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    
    const action = actionEl.dataset.action;
    if (action === 'handleExpressOrder') {
        window.handleExpressOrder(e);
    }
});

// Expose functions to window
window.changeQuantity = changeQuantity;
window.addToCartFromProduct = addToCartFromProduct;
window.addToWishlist = addToWishlist;
window.submitReview = submitReview;
window.switchImage = switchImage;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.updateExpressCalculations = updateExpressCalculations;
window.onExpressWilayaChange = onExpressWilayaChange;
window.handleExpressOrder = handleExpressOrder;
window.loadProductDetails = loadProductDetails;

// Capture image load errors
document.addEventListener('error', function(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
        if (e.target.src !== window.location.origin + '/images/product-placeholder.jpg') {
            e.target.onerror = null;
            e.target.src = '/images/product-placeholder.jpg';
        }
    }
}, true);

// Schedule loading of secondary interactive modules on idle or first interaction to minimize TBT
let secondaryModulesLoaded = false;
function loadSecondaryModules() {
    if (secondaryModulesLoaded) return;
    secondaryModulesLoaded = true;
    ['js/user-system.js', 'js/cart.js', 'js/wishlist.js'].forEach(src => {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const s = document.createElement('script');
            s.src = src;
            s.defer = true;
            document.body.appendChild(s);
        }
    });
}
window.loadSecondaryModules = loadSecondaryModules;

if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadSecondaryModules, { timeout: 2000 });
} else {
    setTimeout(loadSecondaryModules, 600);
}

['touchstart', 'mouseover', 'scroll', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, loadSecondaryModules, { once: true, passive: true });
});

