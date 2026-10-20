/**
 * Store & White-Label Configuration
 * Centralized settings for branding, contact info, currency, and integrations.
 */
require('dotenv').config();

const storeConfig = {
    storeName: process.env.STORE_NAME || 'متجر رواق',
    storeTagline: process.env.STORE_TAGLINE || 'متجرك الموثوق للتسوق في الجزائر',
    storePhone: process.env.STORE_PHONE || '0550 00 00 00',
    storeEmail: process.env.STORE_EMAIL || 'contact@rewaq.dz',
    storeAddress: process.env.STORE_ADDRESS || 'الجزائر العاصمة، الجزائر',
    storeLogoUrl: process.env.STORE_LOGO_URL || '/images/logo.png',
    currencySymbol: process.env.CURRENCY_SYMBOL || 'دج',
    currencyCode: process.env.CURRENCY_CODE || 'DZD',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    
    // Email (SMTP)
    email: {
        host: process.env.EMAIL_HOST || '',
        port: Number(process.env.EMAIL_PORT) || 587,
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        from: process.env.EMAIL_FROM || `"${process.env.STORE_NAME || 'متجر رواق'}" <${process.env.STORE_EMAIL || 'contact@rewaq.dz'}>`
    },
    
    // Chargily Pay V2 Configuration
    chargily: {
        publicKey: process.env.CHARGILY_PUBLIC_KEY || '',
        secretKey: process.env.CHARGILY_SECRET_KEY || '',
        mode: process.env.CHARGILY_MODE || 'test', // 'test' or 'live'
        endpoint: process.env.CHARGILY_MODE === 'live' 
            ? 'https://pay.chargily.net/api/v2' 
            : 'https://pay.chargily.net/test/api/v2'
    }
};

module.exports = storeConfig;
