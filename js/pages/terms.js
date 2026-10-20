/**
 * js/pages/terms.js
 * Controller for Terms & Conditions page (terms.html)
 * Dynamically loads store policies and contact details from /api/settings
 */

(function () {
    'use strict';

    let currentSettings = null;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderDynamicTerms(settings) {
        if (!settings) return;
        currentSettings = settings;

        // 1. Shipping Policy
        const shippingEl = document.getElementById('terms-shipping-content');
        if (shippingEl) {
            const shippingText = (settings.shipping_policy && String(settings.shipping_policy).trim())
                || (window.I18n ? window.I18n.t('terms.shipping_fallback') : '');
            shippingEl.textContent = shippingText;
        }

        // 2. Return Policy
        const returnEl = document.getElementById('terms-return-content');
        if (returnEl) {
            const returnText = (settings.return_policy && String(settings.return_policy).trim())
                || (window.I18n ? window.I18n.t('terms.return_fallback') : '');
            returnEl.textContent = returnText;
        }

        // 3. Warranty Policy
        const warrantyEl = document.getElementById('terms-warranty-content');
        if (warrantyEl) {
            const warrantyText = (settings.warranty_policy && String(settings.warranty_policy).trim())
                || (window.I18n ? window.I18n.t('terms.warranty_fallback') : '');
            warrantyEl.textContent = warrantyText;
        }

        // 4. Store Contact Details
        const storeName = settings.store_name || (window.I18n ? window.I18n.t('common.store_name', 'متجر رواق') : 'متجر رواق');
        document.querySelectorAll('.terms-store-name').forEach(el => {
            el.textContent = storeName;
        });

        if (settings.store_phone) {
            document.querySelectorAll('.terms-store-phone').forEach(el => {
                el.textContent = settings.store_phone;
                if (el.tagName === 'A') el.href = `tel:${encodeURIComponent(settings.store_phone)}`;
            });
        }

        if (settings.store_email) {
            document.querySelectorAll('.terms-store-email').forEach(el => {
                el.textContent = settings.store_email;
                if (el.tagName === 'A') el.href = `mailto:${encodeURIComponent(settings.store_email)}`;
            });
        }

        if (settings.store_address) {
            document.querySelectorAll('.terms-store-address').forEach(el => {
                el.textContent = settings.store_address;
            });
        }
    }

    async function fetchAndApplySettings() {
        // Fast render from window or local cache if available
        if (window.storeSettings) {
            renderDynamicTerms(window.storeSettings);
        } else {
            try {
                const cached = localStorage.getItem('store_settings_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    renderDynamicTerms(parsed);
                }
            } catch (e) {}
        }

        // Live fetch from /api/settings
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const settings = await res.json();
                if (settings) {
                    window.storeSettings = settings;
                    try { localStorage.setItem('store_settings_cache', JSON.stringify(settings)); } catch (e) {}
                    renderDynamicTerms(settings);
                }
            }
        } catch (err) {
            console.warn('Could not fetch /api/settings for terms page:', err);
        }
    }

    function initTocObserver() {
        const links = document.querySelectorAll('.legal-nav-link');
        const sections = document.querySelectorAll('.legal-section');
        if (!links.length || !sections.length) return;

        const observerOptions = {
            root: null,
            rootMargin: '-80px 0px -70% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    if (id) {
                        links.forEach(link => {
                            const href = link.getAttribute('href');
                            if (href === `#${id}`) {
                                link.classList.add('active');
                            } else {
                                link.classList.remove('active');
                            }
                        });
                    }
                }
            });
        }, observerOptions);

        sections.forEach(sec => observer.observe(sec));
    }

    function init() {
        fetchAndApplySettings();
        initTocObserver();

        // Re-render when language changes
        window.addEventListener('languageChanged', () => {
            if (currentSettings) {
                renderDynamicTerms(currentSettings);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
