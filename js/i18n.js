/**
 * Rewaq - نظام الترجمة خفيف الوزن (Lightweight i18n - Vanilla JS)
 */

window.I18n = {
    currentLang: localStorage.getItem('rewaq_lang') || 'ar',
    cache: {},

    /**
     * جلب ملف الترجمة
     */
    async loadDictionary(lang) {
        const targetLang = lang || this.currentLang || 'ar';
        if (this.cache[targetLang]) return this.cache[targetLang];
        if (this._loadingPromises && this._loadingPromises[targetLang]) {
            return this._loadingPromises[targetLang];
        }
        if (!this._loadingPromises) this._loadingPromises = {};

        this._loadingPromises[targetLang] = (async () => {
            try {
                const res = await fetch(`/locales/${targetLang}.json`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const dict = await res.json();
                this.cache[targetLang] = dict;
                return dict;
            } catch (err) {
                console.warn(`Could not load /locales/${targetLang}.json:`, err);
                return null;
            } finally {
                delete this._loadingPromises[targetLang];
            }
        })();

        return this._loadingPromises[targetLang];
    },

    /**
     * استخراج القيمة من مسار مفاتيح متداخلة (e.g. 'nav.home')
     */
    getValue(dict, keyPath) {
        if (!dict || !keyPath) return null;
        const keys = String(keyPath).split('.');
        let val = dict;
        for (const k of keys) {
            if (val && typeof val === 'object' && val[k] !== undefined) {
                val = val[k];
            } else {
                return null;
            }
        }
        return val;
    },

    /**
     * ترجمة فورية لمفتاح معين مع نص بديل افتراضي
     */
    t(keyPath, defaultValue = '') {
        const dict = this.cache[this.currentLang];
        if (!dict) return defaultValue || keyPath;
        const val = this.getValue(dict, keyPath);
        return val !== null && val !== undefined ? val : (defaultValue || keyPath);
    },

    /**
     * الحصول على معرف التوطين (Locale code) المناسب للغة الحالية
     */
    getLocale() {
        const lang = this.currentLang || 'ar';
        if (lang === 'fr') return 'fr-FR';
        if (lang === 'en') return 'en-US';
        return 'ar-DZ';
    },

    /**
     * تنسيق التاريخ حسب اللغة الحالية
     */
    formatDate(date, options) {
        if (!date) return '';
        const d = (date instanceof Date) ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(this.getLocale(), options);
    },

    /**
     * تنسيق الأرقام حسب اللغة الحالية
     */
    formatNumber(num, options) {
        const n = Number(num);
        if (isNaN(n)) return '';
        return n.toLocaleString(this.getLocale(), options);
    },

    /**
     * ترجمة عناصر الصفحة أو حاوية محددة (data-i18n, data-i18n-placeholder, data-i18n-title)
     */
    async translatePage(targetRoot) {
        const root = (targetRoot && targetRoot.querySelectorAll) ? targetRoot : document;
        const dict = await this.loadDictionary(this.currentLang);
        if (!dict) return;

        // تحديث النصوص ذات سمة data-i18n
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const val = this.getValue(dict, key);
                if (val !== null && val !== undefined) {
                    if (el.tagName === 'META') {
                        if (el.getAttribute('content') !== val) el.setAttribute('content', val);
                    } else if (el.tagName === 'INPUT' && ('value' in el) && ['button', 'submit'].includes(el.type)) {
                        if (el.value !== val) el.value = val;
                    } else if (el.tagName === 'IMG') {
                        if (el.alt !== val) el.alt = val;
                    } else {
                        const strVal = String(val);
                        // تجنب إعادة كتابة innerHTML إذا لم تتغير القيمة لمنع Layout Thrashing و Style recalculations
                        if (strVal.includes('<')) {
                            if (el.innerHTML !== strVal) el.innerHTML = strVal;
                        } else {
                            if (el.textContent !== strVal) el.textContent = strVal;
                        }
                    }
                }
            }
        });

        // تحديث النصوص ذات سمة data-i18n-placeholder
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                const val = this.getValue(dict, key);
                if (val !== null && val !== undefined && el.placeholder !== val) {
                    el.placeholder = val;
                }
            }
        });

        // تحديث النصوص ذات سمة data-i18n-title
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                const val = this.getValue(dict, key);
                if (val !== null && val !== undefined && el.title !== val) {
                    el.title = val;
                }
            }
        });

        root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria-label');
            const val = key ? this.getValue(dict, key) : null;
            if (val !== null && val !== undefined && el.getAttribute('aria-label') !== val) {
                el.setAttribute('aria-label', val);
            }
        });
    },

    /**
     * تغيير لغة المتجر وتحديث كافة النصوص والاتجاه (RTL / LTR)
     */
    async setLanguage(lang) {
        if (!['ar', 'fr', 'en'].includes(lang)) lang = 'ar';
        this.currentLang = lang;
        localStorage.setItem('rewaq_lang', lang);

        const dict = await this.loadDictionary(lang);
        if (!dict) return;

        // ضبط الاتجاه واللغة
        const dir = dict.dir || (lang === 'ar' ? 'rtl' : 'ltr');
        document.documentElement.lang = lang;
        document.documentElement.dir = dir;
        if (document.body) document.body.dir = dir;

        // ترجمة كافة العناصر في الصفحة
        await this.translatePage(document);

        // مزامنة محدد اللغة
        const langData = {
            'ar': { name: 'العربية', flag: 'dz' },
            'fr': { name: 'Français', flag: 'fr' },
            'en': { name: 'English', flag: 'gb' }
        };
        const current = langData[lang] || langData['ar'];
        
        document.querySelectorAll('.custom-lang-dropdown').forEach(dropdown => {
            const currentEl = dropdown.querySelector('.lang-current');
            if (currentEl) {
                currentEl.innerHTML = `
                    <img src="/images/flags/${current.flag}.svg" alt="${current.name} flag" width="20" height="15" style="border-radius:2px; object-fit:cover;">
                    <span>${current.name}</span>
                    <i class="fas fa-chevron-down" style="font-size: 0.7em; margin-inline-start: 4px;"></i>
                `;
            }
            dropdown.querySelectorAll('li').forEach(li => {
                li.classList.remove('active');
                li.setAttribute('aria-selected', 'false');
                if (li.getAttribute('data-lang') === lang) {
                    li.classList.add('active');
                    li.setAttribute('aria-selected', 'true');
                }
            });
        });

        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang, dir, dict } }));
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang, dir, dict } }));
        if (window.ShopLayout && typeof window.ShopLayout.updateSearchPlaceholders === 'function') {
            window.ShopLayout.updateSearchPlaceholders();
        }
    },

    /**
     * إدراج أداة اختيار اللغة في الهيدر تلقائياً
     */
    setupLanguageSwitchers() {
        const userActionsList = document.querySelectorAll('.user-actions');
        
        const langData = {
            'ar': { name: 'العربية', flag: 'dz' },
            'fr': { name: 'Français', flag: 'fr' },
            'en': { name: 'English', flag: 'gb' }
        };

        userActionsList.forEach(container => {
            if (!container.querySelector('.lang-switcher-wrap')) {
                const wrap = document.createElement('div');
                wrap.className = 'lang-switcher-wrap custom-lang-dropdown';
                
                const current = langData[this.currentLang] || langData['ar'];
                
                wrap.innerHTML = `
                    <div class="lang-current" tabindex="0" role="button" aria-haspopup="listbox" aria-expanded="false" data-i18n-aria-label="nav.select_language" aria-label="${this.t('nav.select_language', 'اختر اللغة')}">
                        <img src="/images/flags/${current.flag}.svg" alt="${current.name} flag" width="20" height="15" style="border-radius:2px; object-fit:cover;">
                        <span>${current.name}</span>
                        <i class="fas fa-chevron-down" style="font-size: 0.7em; margin-inline-start: 4px;"></i>
                    </div>
                    <ul class="lang-options" role="listbox">
                        ${Object.keys(langData).map(code => `
                            <li data-lang="${code}" class="${code === this.currentLang ? 'active' : ''}" role="option" aria-selected="${code === this.currentLang}">
                                <img src="/images/flags/${langData[code].flag}.svg" alt="${langData[code].name} flag" width="20" height="15" style="border-radius:2px; object-fit:cover;">
                                <span>${langData[code].name}</span>
                            </li>
                        `).join('')}
                    </ul>
                `;

                // Add event listeners
                const currentEl = wrap.querySelector('.lang-current');
                const optionsEl = wrap.querySelector('.lang-options');
                const optionItems = wrap.querySelectorAll('li');

                currentEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = optionsEl.classList.contains('show');
                    document.querySelectorAll('.lang-options').forEach(opt => {
                        opt.classList.remove('show');
                        opt.previousElementSibling.setAttribute('aria-expanded', 'false');
                    });
                    if (!isOpen) {
                        optionsEl.classList.add('show');
                        currentEl.setAttribute('aria-expanded', 'true');
                    }
                });

                optionItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const langCode = item.getAttribute('data-lang');
                        this.setLanguage(langCode);
                        optionsEl.classList.remove('show');
                        currentEl.setAttribute('aria-expanded', 'false');
                    });
                });

                document.addEventListener('click', () => {
                    optionsEl.classList.remove('show');
                    currentEl.setAttribute('aria-expanded', 'false');
                });

                container.insertBefore(wrap, container.firstChild);
            }
        });
    }
};

// تشغيل التهيئة فور تحميل الـ DOM
document.addEventListener('DOMContentLoaded', async () => {
    window.I18n.setupLanguageSwitchers();
    if (window.I18n.currentLang && window.I18n.currentLang !== 'ar') {
        await window.I18n.setLanguage(window.I18n.currentLang);
    } else {
        await window.I18n.loadDictionary('ar');
        document.dispatchEvent(new CustomEvent('i18nLoaded', { detail: { lang: 'ar' } }));
        window.dispatchEvent(new CustomEvent('i18nLoaded', { detail: { lang: 'ar' } }));
    }
});
