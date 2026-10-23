
// Early health check ping to wake up sleeping server (e.g. Render free tier)
try {
  fetch('/health', { method: 'GET', keepalive: true }).catch(() => {});
} catch (e) {}

    let products = [];
    let filteredProducts = [];
    let currentPage = 1;
    const itemsPerPage = 8;

    function renderShopSkeletons(container, count = 8) {
      if (!container) return;
      const card = `
        <div class="product-card skeleton-card" aria-hidden="true" style="pointer-events:none;">
          <div class="product-image-container skeleton skeleton-image" style="width:100%; aspect-ratio:1/1; background:var(--border-color,#e2e8f0); border-radius:12px 12px 0 0;"></div>
          <div class="product-info" style="padding:16px;">
            <div class="skeleton" style="height:14px; width:40%; margin-bottom:10px; background:var(--border-color,#e2e8f0); border-radius:4px;"></div>
            <div class="skeleton" style="height:18px; width:80%; margin-bottom:12px; background:var(--border-color,#e2e8f0); border-radius:4px;"></div>
            <div class="skeleton" style="height:16px; width:50%; margin-bottom:16px; background:var(--border-color,#e2e8f0); border-radius:4px;"></div>
            <div class="skeleton" style="height:38px; width:100%; background:var(--border-color,#e2e8f0); border-radius:8px;"></div>
          </div>
        </div>
      `;
      container.innerHTML = card.repeat(count);
    }

    async function fetchWithRetry(url, options = {}, retries = 2, timeoutMs = 8000) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) {
            if (attempt < retries) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
              continue;
            }
            throw new Error(`HTTP ${res.status}`);
          }
          return res;
        } catch (err) {
          clearTimeout(timer);
          if (attempt >= retries) throw err;
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    
    function normalizeText(text) {
      if (!text) return '';
      return String(text)
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '');
    }

    // Multilingual Keywords for products (Arabic, French, English)
    const PRODUCT_KEYWORDS = {
      1: ['قميص', 'كتان', 'كاجوال', 'رجالي', 'ملابس', 'ازياء', 'ثياب', 'chemise', 'shirt', 'men shirt', 'chemise homme', 'lin', 'linen', 'vetement', 'vetements', 'clothes', 'clothing', 'fashion', 'mode', 'casual'],
      2: ['فستان', 'صيفي', 'نسائي', 'شيفون', 'زهرية', 'ملابس', 'ازياء', 'ثياب', 'robe', 'dress', 'summer dress', 'floral dress', 'robe ete', 'robe femme', 'vetement', 'vetements', 'clothes', 'clothing', 'fashion', 'mode'],
      3: ['حذاء', 'رياضي', 'سنيكرز', 'جري', 'مشي', 'ملابس', 'ازياء', 'احذية', 'chaussure', 'chaussures', 'basket', 'baskets', 'sneaker', 'sneakers', 'shoes', 'running', 'sport', 'vetement', 'clothes'],
      4: ['ساعة', 'ساعات', 'يد', 'كرونوغراف', 'جلد', 'اكسسوارات', 'montre', 'montres', 'watch', 'watches', 'chronograph', 'leather watch', 'accessoire', 'accessory', 'accessoires'],
      5: ['عطر', 'عطور', 'عود', 'عنبر', 'فانيليا', 'تجميل', 'مستحضرات', 'parfum', 'parfums', 'perfume', 'perfumes', 'fragrance', 'oud', 'ambre', 'amber', 'beaute', 'beauty', 'cosmetique'],
      6: ['طقم', 'اواني', 'مقالي', 'غرانيت', 'طهي', 'مطبخ', 'منزل', 'ديكور', 'طبخ', 'cuisine', 'kitchen', 'cookware', 'casserole', 'casseroles', 'poele', 'pots', 'pans', 'granite', 'cooking', 'maison', 'home'],
      100: ['حقيبة', 'ظهر', 'مطر', 'لابتوب', 'حاسوب', 'كمبيوتر', 'سفر', 'ملابس', 'ازياء', 'حقائب', 'sac', 'sac a dos', 'bag', 'backpack', 'laptop bag', 'antivol', 'usb', 'voyage', 'travel', 'vetement', 'clothes'],
      101: ['سماعات', 'لاسلكية', 'عزل', 'بلوتوث', 'صوت', 'هواتف', 'الكترونيات', 'casque', 'ecouteurs', 'headphones', 'earphones', 'headset', 'bluetooth', 'wireless', 'anc', 'audio', 'phone', 'telephone']
    };

    // Category multilingual cross-reference (bidirectional aliases)
    const CATEGORY_MAP = {
      'أزياء وملابس': ['أزياء وملابس', 'ملابس', 'ازياء', 'أزياء', 'ملابس وأحذية', 'fashion', 'fashion-clothing', 'mode', 'vetements', 'clothing', 'clothes'],
      'ملابس': ['أزياء وملابس', 'ملابس', 'ازياء', 'أزياء', 'ملابس وأحذية', 'fashion', 'fashion-clothing', 'mode', 'vetements', 'clothing', 'clothes'],
      'ازياء': ['أزياء وملابس', 'ملابس', 'ازياء', 'fashion', 'mode', 'vetements'],
      'ساعات وإكسسوارات': ['ساعات وإكسسوارات', 'ساعات', 'اكسسوارات', 'إكسسوارات', 'watches', 'watches-accessories', 'montres', 'accessories'],
      'ساعات': ['ساعات وإكسسوارات', 'ساعات', 'اكسسوارات', 'watches', 'montres'],
      'عطور ومستحضرات تجميل': ['عطور ومستحضرات تجميل', 'عطور وتجميل', 'عطور', 'تجميل', 'مستحضرات تجميل', 'perfumes', 'perfumes-beauty', 'parfums', 'beauty', 'beaute'],
      'عطور وتجميل': ['عطور ومستحضرات تجميل', 'عطور وتجميل', 'عطور', 'تجميل', 'perfumes', 'beauty', 'parfums'],
      'عطور': ['عطور ومستحضرات تجميل', 'عطور وتجميل', 'عطور', 'perfumes', 'parfums'],
      'منزل وديكور': ['منزل وديكور', 'منزل', 'ديكور', 'أدوات منزلية', 'ادوات منزلية', 'مطبخ', 'home', 'home-decor', 'maison', 'decor'],
      'منزل': ['منزل وديكور', 'منزل', 'ديكور', 'home', 'maison'],
      'هواتف وإلكترونيات': ['هواتف وإلكترونيات', 'إلكترونيات', 'الكترونيات', 'هواتف', 'صوتيات', 'سماعات', 'electronics', 'phones-electronics', 'phones', 'electronique', 'telephones', 'audio'],
      'إلكترونيات': ['هواتف وإلكترونيات', 'إلكترونيات', 'الكترونيات', 'هواتف', 'صوتيات', 'سماعات', 'electronics', 'phones-electronics', 'phones', 'electronique', 'telephones', 'audio'],
      'الكترونيات': ['هواتف وإلكترونيات', 'إلكترونيات', 'الكترونيات', 'هواتف', 'electronics', 'electronique']
    };

    function updateCategoryCounts() {
      const allCountEl = document.getElementById('count-all');
      if (allCountEl) allCountEl.textContent = `(${products.length})`;

      const map = {
        'count-fashion': 'أزياء وملابس',
        'count-watches': 'ساعات وإكسسوارات',
        'count-beauty': 'عطور ومستحضرات تجميل',
        'count-home': 'منزل وديكور',
        'count-electronics': 'هواتف وإلكترونيات'
      };

      Object.entries(map).forEach(([elId, catKey]) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const aliases = (CATEGORY_MAP[catKey] || [catKey]).map(normalizeText);
        const count = products.filter(p => {
          const prodCat = normalizeText(p.category);
          return aliases.some(alias => prodCat.includes(alias) || alias.includes(prodCat));
        }).length;
        el.textContent = `(${count})`;
      });

      // عدادات تقييمات النجوم
      const r0El = document.getElementById('count-rating-0');
      if (r0El) r0El.textContent = `(${products.length})`;
      const r45El = document.getElementById('count-rating-4-5');
      if (r45El) r45El.textContent = `(${products.filter(p => Number(p.rating || 5) >= 4.5).length})`;
      const r40El = document.getElementById('count-rating-4-0');
      if (r40El) r40El.textContent = `(${products.filter(p => Number(p.rating || 5) >= 4.0).length})`;
      const r30El = document.getElementById('count-rating-3-0');
      if (r30El) r30El.textContent = `(${products.filter(p => Number(p.rating || 5) >= 3.0).length})`;
    }

    function renderStars(rating) {
      const r = Number(rating) || 5;
      let html = '';
      for (let i = 1; i <= 5; i++) {
        if (r >= i) {
          html += '<i class="fas fa-star" aria-hidden="true"></i>';
        } else if (r >= i - 0.5) {
          html += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
        } else {
          html += '<i class="far fa-star" aria-hidden="true"></i>';
        }
      }
      return html;
    }

    function getStockBadge(stock) {
      const stockNum = Number(stock) || 0;
      if (stockNum <= 0) {
        return `<span class="product-stock-note is-out"><i class="fas fa-times-circle"></i> ${window.I18n ? window.I18n.t('product.out_of_stock', 'نفد المخزون') : 'نفد المخزون'}</span>`;
      }
      if (stockNum <= 5) {
        return `<span class="product-stock-note is-low"><i class="fas fa-fire-alt"></i> ${window.I18n ? window.I18n.t('product.few_left', 'متبقي {count} قطع فقط! ⚡').replace('{count}', stockNum) : `متبقي ${stockNum} قطع فقط! ⚡`}</span>`;
      }
      return `<span class="product-stock-note"><i class="fas fa-check-circle" style="color:var(--success-color, #10b981);"></i> ${window.I18n ? window.I18n.t('common.in_stock', 'متوفر في المخزون') : 'متوفر في المخزون'}</span>`;
    }

    let searchDebounceTimer = null;
    function onSearchInput() {
      const searchInput = document.getElementById('searchInput');
      const clearBtn = document.getElementById('clearSearchBtn');
      if (clearBtn && searchInput) {
        clearBtn.style.display = searchInput.value.trim() ? 'block' : 'none';
      }
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applyFilters();
      }, 200);
    }

    function clearSearch() {
      const searchInput = document.getElementById('searchInput');
      const clearBtn = document.getElementById('clearSearchBtn');
      if (searchInput) searchInput.value = '';
      if (clearBtn) clearBtn.style.display = 'none';

      const url = new URL(window.location);
      url.searchParams.delete('search');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      applyFilters();
    }

    function onCategoryChange() {
      const selectedCategoryRadio = document.querySelector('input[name="categoryFilter"]:checked');
      const categoryValue = selectedCategoryRadio ? selectedCategoryRadio.value : '';
      const searchInput = document.getElementById('searchInput');
      const clearBtn = document.getElementById('clearSearchBtn');

      if (categoryValue && searchInput && searchInput.value.trim()) {
        const normSearch = normalizeText(searchInput.value.trim());
        const allowedAliases = (CATEGORY_MAP[categoryValue] || [categoryValue]).map(normalizeText);
        
        // Check if the current search keyword matches ANY product in the newly selected category
        const matchesInCat = products.some(p => {
          const prodCat = normalizeText(p.category);
          const inCat = allowedAliases.some(alias => prodCat.includes(alias) || alias.includes(prodCat));
          if (!inCat) return false;

          const prodName = normalizeText(p.name);
          const prodDesc = normalizeText(p.description);
          const keywords = (PRODUCT_KEYWORDS[p.id] || []).map(normalizeText);
          return prodName.includes(normSearch) || prodDesc.includes(normSearch) || keywords.some(k => k.includes(normSearch) || normSearch.includes(k));
        });

        // If the active search term conflicts with the chosen category (produces 0 items), clear it gracefully
        if (!matchesInCat) {
          searchInput.value = '';
          if (clearBtn) clearBtn.style.display = 'none';
          const url = new URL(window.location);
          url.searchParams.delete('search');
          url.searchParams.set('category', categoryValue);
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }
      }

      applyFilters();
    }

    function initFiltersFromUrl() {
      const urlParams = new URLSearchParams(window.location.search);
      const searchParam = urlParams.get('search');
      const catParam = urlParams.get('category');

      if (searchParam) {
        const searchInput = document.getElementById('searchInput');
        const clearBtn = document.getElementById('clearSearchBtn');
        if (searchInput) {
          searchInput.value = searchParam;
          if (clearBtn) clearBtn.style.display = 'block';
        }
      }

      if (catParam) {
        const normCat = normalizeText(catParam);
        const radios = document.querySelectorAll('input[name="categoryFilter"]');
        radios.forEach(radio => {
          if (radio.value) {
            const canonicalCat = radio.value;
            const aliases = (CATEGORY_MAP[canonicalCat] || [canonicalCat]).map(normalizeText);
            if (aliases.some(a => a.includes(normCat) || normCat.includes(a))) {
              radio.checked = true;
            }
          }
        });
      }
    }

    async function loadProducts() {
      const container = document.getElementById('products-container');
      if (container && (!products.length || container.querySelector('.empty-state'))) {
        renderShopSkeletons(container, 8);
      }

      try {
        const response = await fetchWithRetry('/api/products', {}, 2, 8000);
        if (!response.ok) throw new Error(window.I18n ? window.I18n.t('messages.fetch_products_error', 'خطأ في جلب المنتجات') : 'خطأ في جلب المنتجات');
        const data = await response.json();
        products = Array.isArray(data) ? data : (Array.isArray(data && data.products) ? data.products : []);
        
        // تحديث عدادات الفئات ديناميكياً
        updateCategoryCounts();

        // إيجاد أعلى سعر ديناميكياً
        if (products.length > 0) {
          const maxProductPrice = Math.max(...products.map(p => Number(p.price) || 0));
          const priceSlider = document.getElementById('priceRange');
          if (priceSlider && maxProductPrice > 0) {
            priceSlider.max = Math.ceil(maxProductPrice / 10000) * 10000;
            priceSlider.value = priceSlider.max;
            updatePriceLabel();
          }
        }

        initFiltersFromUrl();
        applyFilters();
      } catch (error) {
        console.error('Error loading shop products:', error);
        if (container) {
          container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
              <i class="fas fa-exclamation-circle" style="font-size: 2.5rem; color: var(--danger-color, #ef4444); margin-bottom: 12px;"></i>
              <h3 style="margin-bottom: 8px;">${window.I18n ? window.I18n.t('shop.load_error', 'حدث خطأ في تحميل المنتجات') : 'حدث خطأ في تحميل المنتجات'}</h3>
              <p style="color: var(--text-muted, #64748b); margin-bottom: 16px;">${window.I18n ? window.I18n.t('shop.retry_desc', 'تعذر الاتصال بالخادم في الوقت المحدد. يرجى إعادة المحاولة.') : 'تعذر الاتصال بالخادم في الوقت المحدد. يرجى إعادة المحاولة.'}</p>
              <button type="button" class="btn btn-primary" data-action="loadShopProducts">
                <i class="fas fa-redo"></i> <span>${window.I18n ? window.I18n.t('shop.retry_btn', 'إعادة المحاولة') : 'إعادة المحاولة'}</span>
              </button>
            </div>
          `;
          if (window.I18n) window.I18n.translatePage(container);
        }
      }
    }

    function updatePriceLabel() {
      const priceSlider = document.getElementById('priceRange');
      const priceLabel = document.getElementById('priceRangeValue');
      if (priceSlider && priceLabel) {
        const curr = window.I18n ? window.I18n.t('common.currency', 'دج') : 'دج';
        priceLabel.innerHTML = Number(priceSlider.value).toLocaleString() + ' <span data-i18n="common.currency">' + curr + '</span>';
      }
    }

    function applyFilters() {
      const rawSearch = (document.getElementById('searchInput')?.value || '').trim();
      const normSearch = normalizeText(rawSearch);
      const searchWithoutAl = normSearch.startsWith('ال') && normSearch.length > 3 ? normSearch.slice(2) : normSearch;
      
      const selectedCategoryRadio = document.querySelector('input[name="categoryFilter"]:checked');
      const categoryValue = selectedCategoryRadio ? selectedCategoryRadio.value : '';

      const selectedRatingRadio = document.querySelector('input[name="ratingFilter"]:checked');
      const minRating = Number(selectedRatingRadio ? selectedRatingRadio.value : 0);

      const priceRange = document.getElementById('priceRange');
      const maxPrice = priceRange ? Number(priceRange.value) : 200000;
      const inStockOnly = document.getElementById('inStockOnly')?.checked || false;
      const sortFilter = document.getElementById('sortFilter')?.value || 'newest';

      filteredProducts = products.filter(product => {
        const price = Number(product.price);
        const stock = Number(product.stock);
        const rating = Number(product.rating || 5);

        // Smart Multilingual Search matching name, category, and keywords in AR, FR, EN
        let matchesSearch = true;
        if (normSearch) {
          const prodName = normalizeText(product.name);
          const prodCat = normalizeText(product.category);
          const prodDesc = normalizeText(product.description);
          const keywords = (PRODUCT_KEYWORDS[product.id] || []).map(normalizeText);

          matchesSearch = prodName.includes(normSearch) || 
                          prodCat.includes(normSearch) || 
                          prodDesc.includes(normSearch) ||
                          keywords.some(k => k.includes(normSearch) || normSearch.includes(k)) ||
                          prodName.includes(searchWithoutAl) ||
                          prodCat.includes(searchWithoutAl) ||
                          keywords.some(k => k.includes(searchWithoutAl) || searchWithoutAl.includes(k));
        }

        // Multilingual Category filter matching
        let matchesCategory = true;
        if (categoryValue) {
          const prodCat = normalizeText(product.category);
          const allowedAliases = (CATEGORY_MAP[categoryValue] || [categoryValue]).map(normalizeText);
          matchesCategory = allowedAliases.some(alias => prodCat.includes(alias) || alias.includes(prodCat));
        }

        const matchesPrice = price <= maxPrice;
        const matchesRating = rating >= minRating;
        const matchesStock = !inStockOnly || stock > 0;

        return matchesSearch && matchesCategory && matchesPrice && matchesRating && matchesStock;
      });

      filteredProducts.sort((a, b) => {
        switch (sortFilter) {
          case 'newest': return new Date(b.created_at) - new Date(a.created_at);
          case 'rating-desc': return (Number(b.rating) || 0) - (Number(a.rating) || 0);
          case 'price-asc': return Number(a.price) - Number(b.price);
          case 'price-desc': return Number(b.price) - Number(a.price);
          case 'name-asc': return a.name.localeCompare(b.name, 'ar');
          case 'name-desc': return b.name.localeCompare(a.name, 'ar');
          default: return 0;
        }
      });

      // تحديث عداد النتائج
      const countEl = document.getElementById('resultsCount');
      if (countEl) {
        countEl.textContent = window.I18n.t('shop.products_found', 'عُثر على ({count}) منتج').replace('{count}', filteredProducts.length);
      }

      currentPage = 1;
      renderProducts();
      renderPagination();
    }

    function resetFilters() {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      const clearBtn = document.getElementById('clearSearchBtn');
      if (clearBtn) clearBtn.style.display = 'none';
      
      const defaultCategoryRadio = document.querySelector('input[name="categoryFilter"][value=""]');
      if (defaultCategoryRadio) defaultCategoryRadio.checked = true;

      const defaultRatingRadio = document.querySelector('input[name="ratingFilter"][value="0"]');
      if (defaultRatingRadio) defaultRatingRadio.checked = true;

      const priceSlider = document.getElementById('priceRange');
      if (priceSlider) {
        priceSlider.value = priceSlider.max;
        updatePriceLabel();
      }

      if (document.getElementById('inStockOnly')) document.getElementById('inStockOnly').checked = false;
      if (document.getElementById('sortFilter')) document.getElementById('sortFilter').value = 'newest';

      const url = new URL(window.location);
      url.search = '';
      window.history.replaceState({}, '', url.pathname);

      applyFilters();
    }

    function renderProducts() {
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const pageProducts = filteredProducts.slice(start, end);

      const container = document.getElementById('products-container');
      if (pageProducts.length === 0) {
        const title = window.I18n ? window.I18n.t('shop.empty_title', 'لم نجد منتجات مطابقة لخيارات البحث') : 'لم نجد منتجات مطابقة لخيارات البحث';
        const desc = window.I18n ? window.I18n.t('shop.empty_desc', 'جرب استخدام كلمات بحث مختلفة أو قم بتوسيع نطاق السعر والتصنيفات المختارة.') : 'جرب استخدام كلمات بحث مختلفة أو قم بتوسيع نطاق السعر والتصنيفات المختارة.';
        const btnText = window.I18n ? window.I18n.t('shop.reset_filters_btn', 'إعادة تعيين الفلاتر') : 'إعادة تعيين الفلاتر';
        container.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">
              <i class="fas fa-search"></i>
            </div>
            <h3 class="empty-state-title"><span data-i18n="shop.empty_title">${title}</span></h3>
            <p class="empty-state-desc"><span data-i18n="shop.empty_desc">${desc}</span></p>
            <button type="button" class="btn btn-primary" data-action="resetFilters" data-args="">
              <i class="fas fa-redo-alt"></i> <span data-i18n="shop.reset_filters_btn">${btnText}</span>
            </button>
          </div>
        `;
        if (window.I18n) window.I18n.translatePage(container);
        return;
      }

      const wishlistIds = window.getWishlist ? window.getWishlist() : [];

      const transformProductImage = (url) => {
        if (!url) return '/images/product-placeholder.jpg';
        if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
          return url.replace('/upload/', '/upload/w_400,h_400,c_fill,f_auto,q_auto/');
        }
        if (typeof url === 'string' && url.startsWith('/images/')) {
          const clean = url.replace(/-(400|800)\.(jpg|jpeg|png|webp)$/i, '');
          const baseName = clean.endsWith('.webp') ? clean.slice(0, -5) : clean.replace(/\.[a-zA-Z0-9]+$/, '');
          return `${baseName}-400.webp`;
        }
        return url;
      };

      const getProductSrcset = (imgUrl) => {
        if (!imgUrl || typeof imgUrl !== 'string') return '';
        if (imgUrl.includes('res.cloudinary.com')) {
          const url400 = imgUrl.replace('/upload/', '/upload/w_400,c_fill,f_auto,q_auto/');
          const url800 = imgUrl.replace('/upload/', '/upload/w_800,c_fill,f_auto,q_auto/');
          const url1600 = imgUrl.replace('/upload/', '/upload/w_1600,c_fill,f_auto,q_auto/');
          return `${url400} 400w, ${url800} 800w, ${url1600} 1600w`;
        }
        const m = imgUrl.match(/^(\/images\/[^\/]+?)(\.[a-zA-Z0-9]+)$/);
        if (m) {
          const base = m[1].replace(/-(400|800)$/, '');
          return `${base}-400.webp 400w, ${base}-800.webp 800w, ${base}.webp 1600w`;
        }
        return '';
      };

      const buildShopProductCard = (product, index = 0) => {
        const isFav = wishlistIds.includes(product.id);
        const stockNum = Number(product.stock) || 0;
        const safeName = window.escapeHtml ? window.escapeHtml(product.name) : product.name;
        const safeCat = window.escapeHtml ? window.escapeHtml(product.category || product.category_name || '') : (product.category || product.category_name || '');
        const hasDiscount = product.old_price && Number(product.old_price) > Number(product.price);
        const discountPct = hasDiscount ? Math.round((1 - Number(product.price) / Number(product.old_price)) * 100) : null;
        const imgUrl = transformProductImage(product.image_url);
        const rating = Number(product.rating) || 5;
        const fullStars = Math.min(5, Math.max(1, Math.round(rating)));
        const starsHtml = '<i class="fas fa-star"></i>'.repeat(fullStars) + '<i class="far fa-star"></i>'.repeat(5 - fullStars);
        const isAboveFold = index < 2;
        const loadingVal = isAboveFold ? 'eager' : 'lazy';
        const fetchPriorityAttr = isAboveFold ? 'fetchpriority="high"' : '';
        const decodingVal = isAboveFold ? 'sync' : 'async';
        const fallbackPlaceholder = '/images/product-placeholder.jpg';
        const safeImg = imgUrl || fallbackPlaceholder;
        const realSrcset = getProductSrcset(safeImg);
        const srcsetAttr = realSrcset ? `srcset="${realSrcset}" sizes="(max-width: 480px) 168px, (max-width: 768px) 50vw, (max-width: 992px) 33vw, 280px"` : '';

        return `
        <div class="product-card" id="shop-product-${product.id}">
          <div class="product-image-container">
            ${hasDiscount ? `<span class="product-badge">-${discountPct}%</span>` : ''}
            <button type="button" class="product-wishlist ${isFav ? 'active' : ''}" data-wishlist-id="${product.id}" data-action="handleToggleWishlist" data-args="${product.id}" data-i18n-title="common.wishlist" aria-label="${window.I18n ? window.I18n.t('common.wishlist', 'المفضلة') : 'المفضلة'}" data-i18n-aria-label="common.wishlist">
              <i class="${isFav ? 'fas fa-heart text-danger' : 'far fa-heart'}"></i>
            </button>
            <a href="product.html?id=${product.id}" class="product-image">
              <picture>
                ${realSrcset ? `<source type="image/webp" srcset="${realSrcset}" sizes="(max-width: 480px) 168px, (max-width: 768px) 50vw, (max-width: 992px) 33vw, 280px">` : ''}
                <img src="${safeImg}" width="168" height="168" alt="${safeName}" loading="${loadingVal}" ${fetchPriorityAttr} decoding="${decodingVal}" onerror="this.onerror=null;this.src='${fallbackPlaceholder}';">
              </picture>
            </a>
          </div>
          <div class="product-info">
            ${safeCat ? `<span class="product-category">${safeCat}</span>` : ''}
            <h3 class="product-name">
              <a href="product.html?id=${product.id}" title="${safeName}">${safeName}</a>
            </h3>
            <div class="product-rating" aria-label="${rating} / 5">
              <div class="rating-stars">${starsHtml}</div>
              <span class="rating-count">(${rating.toFixed(1)})</span>
            </div>
            <div class="product-price-row">
              <div class="price-group">
                <span class="product-price">${window.I18n ? window.I18n.formatNumber(product.price) : Number(product.price).toLocaleString()} <small data-i18n="common.currency">دج</small></span>
                ${hasDiscount ? `<span class="product-old-price">${window.I18n ? window.I18n.formatNumber(product.old_price) : Number(product.old_price).toLocaleString()} <small data-i18n="common.currency">دج</small></span>` : ''}
              </div>
            </div>
            <div class="product-card-actions">
              <button type="button" data-action="handleAddToCart" data-args="${product.id}" class="btn btn-primary" ${stockNum <= 0 ? 'disabled' : ''}>
                <i class="fas fa-cart-plus"></i> <span data-i18n="product.add_to_cart">أضف للسلة</span>
              </button>
            </div>
          </div>
        </div>
      `;
      };

      // Chunk rendering: render first 4 immediately, then remainder to eliminate long tasks
      const firstBatch = pageProducts.slice(0, 4);
      container.innerHTML = firstBatch.map((p, i) => buildShopProductCard(p, i)).join('');

      if (pageProducts.length > 4) {
        const yieldToMain = () => {
          if ('scheduler' in window && typeof window.scheduler.yield === 'function') {
            return window.scheduler.yield();
          }
          return new Promise(resolve => setTimeout(resolve, 0));
        };
        yieldToMain().then(() => {
          const secondBatch = pageProducts.slice(4);
          const fragment = document.createRange().createContextualFragment(secondBatch.map((p, i) => buildShopProductCard(p, i + 4)).join(''));
          container.appendChild(fragment);
          if (window.I18n && window.I18n.currentLang !== 'ar') {
            window.I18n.translatePage(container);
          }
        });
      } else if (window.I18n && window.I18n.currentLang !== 'ar') {
        window.I18n.translatePage(container);
      }
    }

    function renderPagination() {
      const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
      const pagination = document.getElementById('pagination');
      if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
      }

      let paginationHTML = `
        <button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" data-action="changePage" data-args="${currentPage - 1}">
          <i class="fas fa-chevron-right"></i> <span data-i18n="shop.prev_page">السابق</span>
        </button>
      `;

      for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
          <button class="page-btn ${i === currentPage ? 'active' : ''}" data-action="changePage" data-args="${i}">${i}</button>
        `;
      }

      paginationHTML += `
        <button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" data-action="changePage" data-args="${currentPage + 1}">
          <span data-i18n="shop.next_page">التالي</span> <i class="fas fa-chevron-left"></i>
        </button>
      `;

      pagination.innerHTML = paginationHTML;
    }

    function changePage(page) {
      const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
      if (page < 1 || page > totalPages) return;
      currentPage = page;
      renderProducts();
      renderPagination();
    }

    async function handleAddToCart(productId) {
      try {
        let product = products.find(p => p.id === productId);
        if (!product) {
          const response = await fetch(`/api/products/${productId}`);
          if (response.ok) {
            product = await response.json();
          }
        }
        if (!product) {
          showNotification(window.I18n.t('messages.product_not_found', 'تعذر العثور على بيانات المنتج'), 'error');
          return;
        }

        if (typeof window.addToCart === 'function') {
          await window.addToCart(product, 1);
        } else {
          let cart = [];
          try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) {}
          const existing = cart.find(item => item.id === product.id);
          if (existing) {
            existing.quantity = Math.min(20, existing.quantity + 1);
          } else {
            cart.push({
              id: product.id,
              name: product.name,
              category: product.category || product.category_name || '',
              price: Number(product.price) || 0,
              image: product.image || product.image_url || '/images/product-placeholder.jpg',
              quantity: 1
            });
          }
          localStorage.setItem('cart', JSON.stringify(cart));
          window.cart = cart;
          const cartCount = document.getElementById('cart-count') || document.querySelector('.cart-count');
          if (cartCount) {
            const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
            cartCount.textContent = totalCount;
          }
          showNotification(window.I18n.t('messages.add_cart_success_name', 'تمت إضافة "{name}" إلى سلة التسوق 🛒').replace('{name}', product.name), 'success');
        }
      } catch (error) {
        showNotification(window.I18n.t('messages.add_cart_error', 'حدث خطأ أثناء إضافة المنتج إلى السلة'), 'error');
      }
    }

    function showNotification(message, type = 'success') {
      if (window.showToast) {
        window.showToast(message, type);
        return;
      }
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;
      const closeBtn = document.createElement('span');
      closeBtn.className = 'close-notification';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => notification.remove());
      notification.appendChild(closeBtn);
      document.body.appendChild(notification);
      setTimeout(() => notification.classList.add('show'), 10);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    async function handleToggleWishlist(productId) {
      const prod = products.find(p => p.id === productId);
      if (prod) {
        if (window.toggleWishlist) {
          await window.toggleWishlist(prod.id, prod);
        } else if (window.WishlistManager) {
          await window.WishlistManager.toggleItem(prod);
        }
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      if ('serviceWorker' in navigator) {
        try {
          navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) reg.update();
          }).catch(() => {});
        } catch (e) {}
      }
      loadProducts();
      const sortFilter = document.getElementById('sortFilter');
      if (sortFilter) sortFilter.addEventListener('change', applyFilters);
    });
    document.addEventListener('languageChanged', () => {
      updatePriceLabel();
      if (products.length) applyFilters();
    });
  

// Event Delegation
document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'resetFilters') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.resetFilters === 'function') window.resetFilters(...args);
    }
    if (action === 'clearSearch') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.clearSearch === 'function') window.clearSearch(...args);
    }
    if (action === 'handleToggleWishlist') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.handleToggleWishlist === 'function') window.handleToggleWishlist(...args);
    }
    if (action === 'handleAddToCart') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.handleAddToCart === 'function') window.handleAddToCart(...args);
    }
    if (action === 'changePage') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.changePage === 'function') window.changePage(...args);
    }
    if (action === 'loadShopProducts') {
        e.preventDefault();
        loadProducts();
    }
});

document.addEventListener('change', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'onCategoryChange') {
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.onCategoryChange === 'function') window.onCategoryChange(...args);
    }
    if (action === 'applyFilters') {
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.applyFilters === 'function') window.applyFilters(...args);
    }
});

document.addEventListener('input', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'updatePriceRange') {
        if (typeof window.updatePriceLabel === 'function') window.updatePriceLabel();
        if (typeof window.applyFilters === 'function') window.applyFilters();
    }
    if (action === 'onSearchInput') {
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.onSearchInput === 'function') window.onSearchInput(...args);
    }
});


// Capture image load errors
document.addEventListener('error', function(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
        if (e.target.src !== window.location.origin + '/images/product-placeholder.jpg') {
            e.target.onerror = null;
            e.target.src = '/images/product-placeholder.jpg';
        }
    }
}, true);

// Expose functions to window
window.normalizeText = normalizeText;
window.updateCategoryCounts = updateCategoryCounts;
window.renderStars = renderStars;
window.getStockBadge = getStockBadge;
window.onSearchInput = onSearchInput;
window.clearSearch = clearSearch;
window.onCategoryChange = onCategoryChange;
window.initFiltersFromUrl = initFiltersFromUrl;
window.loadProducts = loadProducts;
window.loadShopProducts = loadProducts;
window.updatePriceLabel = updatePriceLabel;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.renderProducts = renderProducts;
window.renderPagination = renderPagination;
window.changePage = changePage;
window.handleAddToCart = handleAddToCart;
window.showNotification = showNotification;
window.handleToggleWishlist = handleToggleWishlist;


// ===== Mobile filters bottom sheet (<= 992px) =====
(function initFiltersSheet() {
    const mq = window.matchMedia('(max-width: 992px)');
    let lastFocus = null;
    let portalPlaceholder = null;
    let portalParent = null;

    function els() {
        return {
            sidebar: document.getElementById('shopSidebar'),
            backdrop: document.getElementById('filtersBackdrop'),
            openBtn: document.getElementById('openFiltersBtn'),
            closeBtn: document.getElementById('closeFiltersBtn'),
            applyBtn: document.getElementById('applyFiltersBtn')
        };
    }

    function syncPortal() {
        const { sidebar, backdrop } = els();
        if (!sidebar || !backdrop || !portalPlaceholder || !portalParent) return;

        if (mq.matches) {
            document.body.append(backdrop, sidebar);
            return;
        }

        const insertionPoint = portalPlaceholder.nextSibling;
        portalParent.insertBefore(backdrop, insertionPoint);
        portalParent.insertBefore(sidebar, backdrop.nextSibling);
    }

    function setOpen(open) {
        const { sidebar, backdrop, openBtn, closeBtn } = els();
        if (!sidebar) return;
        if (open && !mq.matches) return;
        sidebar.classList.toggle('open', open);
        if (backdrop) backdrop.classList.toggle('open', open);
        document.body.classList.toggle('filters-open', open);
        if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
        if (open) {
            lastFocus = document.activeElement;
            if (closeBtn) closeBtn.focus({ preventScroll: true });
        } else if (lastFocus && typeof lastFocus.focus === 'function') {
            lastFocus.focus({ preventScroll: true });
            lastFocus = null;
        }
    }

    function updateBadge() {
        const badge = document.getElementById('filtersBadge');
        if (!badge) return;
        let n = 0;
        const cat = document.querySelector('input[name="categoryFilter"]:checked');
        if (cat && cat.value !== '') n++;
        const rating = document.querySelector('input[name="ratingFilter"]:checked');
        if (rating && Number(rating.value) > 0) n++;
        const price = document.getElementById('priceRange');
        if (price && Number(price.value) < Number(price.max)) n++;
        const stock = document.getElementById('inStockOnly');
        if (stock && stock.checked) n++;
        badge.textContent = String(n);
        badge.hidden = n === 0;
    }

    function updateApplyCount() {
        const countEl = document.getElementById('resultsCount');
        const target = document.getElementById('filtersApplyCount');
        if (!countEl || !target) return;
        const m = (countEl.textContent || '').match(/\d+/);
        target.textContent = m ? '(' + m[0] + ')' : '';
    }

    function refresh() { updateBadge(); updateApplyCount(); }

    document.addEventListener('DOMContentLoaded', () => {
        const { sidebar, backdrop, openBtn, closeBtn, applyBtn } = els();
        if (!sidebar) return;

        if (backdrop) {
            portalParent = backdrop.parentNode;
            portalPlaceholder = document.createComment('Mobile shop filters');
            portalParent.insertBefore(portalPlaceholder, backdrop);
            syncPortal();
        }

        if (openBtn) openBtn.addEventListener('click', () => setOpen(true));
        if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));
        if (applyBtn) applyBtn.addEventListener('click', () => setOpen(false));
        if (backdrop) backdrop.addEventListener('click', () => setOpen(false));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('open')) setOpen(false);
        });
        const onMq = () => {
            setOpen(false);
            syncPortal();
        };
        if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);

        sidebar.addEventListener('change', refresh);
        sidebar.addEventListener('input', refresh);
        sidebar.addEventListener('click', (e) => {
            if (e.target.closest('.reset-filters-btn')) setTimeout(refresh, 0);
        });

        const countEl = document.getElementById('resultsCount');
        if (countEl && 'MutationObserver' in window) {
            new MutationObserver(refresh).observe(countEl, { childList: true, characterData: true, subtree: true });
        }
        refresh();
    });
})();

// Schedule loading of secondary interactive modules on user interaction or idle to eliminate Main Thread contention
(function scheduleSecondaryModules() {
    let loaded = false;
    function loadModules() {
        if (loaded) return;
        loaded = true;
        ['js/cart.js', 'js/wishlist.js'].forEach(src => {
            if (document.querySelector(`script[src="${src}"]`)) return;
            const s = document.createElement('script');
            s.src = src;
            s.defer = true;
            document.body.appendChild(s);
        });
    }

    ['touchstart', 'click', 'keydown'].forEach(evt => {
        window.addEventListener(evt, loadModules, { once: true, passive: true });
    });

    if ('requestIdleCallback' in window) {
        window.addEventListener('load', () => {
            window.requestIdleCallback(loadModules, { timeout: 6000 });
        }, { once: true });
    }
})();
