const { getCookie, secureCompare } = require('../utils/tokenUtils');
const authController = require('../controllers/authController');

function getCsrfTokenFromRequest(req) {
    if (!req || typeof req !== 'object') return '';
    const headerValue = req.get ? req.get('x-csrf-token') : undefined;
    if (headerValue) return headerValue;
    return (req.body && req.body.csrfToken) || '';
}

function requireCsrf(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }

    const exemptPaths = [
        '/api/login',
        '/api/register',
        '/api/auth/google',
        '/api/auth/refresh',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/auth/verify-email',
        '/api/payments/chargily/webhook',
        '/api/coupons/validate',
        '/coupons/validate',
        '/api/newsletter/subscribe',
        '/newsletter/subscribe'
    ];

    const currentPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
    if (exemptPaths.some(p => currentPath === p || req.path === p || currentPath.endsWith(p))) {
        return next();
    }

    const cookieToken = getCookie(req, 'csrf_token');
    const headerToken = getCsrfTokenFromRequest(req);
    const isDemo = process.env.DEMO_MODE === 'true';

    // Bearer-authenticated requests are not vulnerable to browser cookie CSRF
    const authHeader = req.get ? req.get('authorization') : null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        return next();
    }

    // 1. If cookieToken is present, it must match headerToken
    if (cookieToken) {
        if (!headerToken || !secureCompare(cookieToken, headerToken)) {
            return res.status(403).json({ message: 'CSRF token missing or invalid' });
        }
        return next();
    }

    // 2. If cookieToken is absent:
    // In DEMO_MODE: allow verifying against memory-backed demoCsrfTokens
    if (isDemo) {
        if (headerToken && authController.demoCsrfTokens && authController.demoCsrfTokens.has(headerToken)) {
            const exp = authController.demoCsrfTokens.get(headerToken);
            if (exp > Date.now()) {
                return next();
            }
            authController.demoCsrfTokens.delete(headerToken);
            return res.status(403).json({ message: 'CSRF token expired' });
        }
        // Guest checkout in demo mode is also supported for iframe previews
        if (currentPath === '/api/orders' || req.path === '/api/orders') {
            return next();
        }
        return res.status(403).json({ message: 'CSRF token missing or invalid' });
    }

    // In Production mode (DEMO_MODE !== 'true'):
    // Browser cookie sessions must present the CSRF cookie
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'CSRF cookie missing' });
    }

    next();
}

module.exports = {
    requireCsrf
};
