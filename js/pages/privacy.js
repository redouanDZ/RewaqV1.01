/**
 * js/pages/privacy.js
 * Controller for Privacy Policy page (privacy.html)
 * Dynamically loads store contact details and marketing pixel status from /api/settings
 */

(function () {
    'use strict';

    let currentSettings = null;

    function renderDynamicPrivacy(settings) {
        if (!settings) return;
        currentSettings = settings;

        // Store Contact Details
        const storeName = settings.store_name || (window.I18n ? window.I18n.t('common.store_name', 'متجر رواق') : 'متجر رواق');
        document.querySelectorAll('.privacy-store-name').forEach(el => {
            el.textContent = storeName;
        });

        if (settings.store_phone) {
            document.querySelectorAll('.privacy-store-phone').forEach(el => {
                el.textContent = settings.store_phone;
                if (el.tagName === 'A') el.href = `tel:${encodeURIComponent(settings.store_phone)}`;
            });
        }

        if (settings.store_email) {
            document.querySelectorAll('.privacy-store-email').forEach(el => {
                el.textContent = settings.store_email;
                if (el.tagName === 'A') el.href = `mailto:${encodeURIComponent(settings.store_email)}`;
            });
        }

        if (settings.store_address) {
            document.querySelectorAll('.privacy-store-address').forEach(el => {
                el.textContent = settings.store_address;
            });
        }
    }

    async function fetchAndApplySettings() {
        if (window.storeSettings) {
            renderDynamicPrivacy(window.storeSettings);
        } else {
            try {
                const cached = localStorage.getItem('store_settings_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    renderDynamicPrivacy(parsed);
                }
            } catch (e) {}
        }

        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const settings = await res.json();
                if (settings) {
                    window.storeSettings = settings;
                    try { localStorage.setItem('store_settings_cache', JSON.stringify(settings)); } catch (e) {}
                    renderDynamicPrivacy(settings);
                }
            }
        } catch (err) {
            console.warn('Could not fetch /api/settings for privacy page:', err);
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

        window.addEventListener('languageChanged', () => {
            if (currentSettings) {
                renderDynamicPrivacy(currentSettings);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
