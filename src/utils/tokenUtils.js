const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/database');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_TTL = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const REMEMBER_REFRESH_TTL = 30 * 24 * 60 * 60 * 1000; // "Remember me" checked
const SHORT_REFRESH_TTL = 24 * 60 * 60 * 1000;        // not checked: session cookie + 24h server cap
const SESSION_CACHE_TTL = Number(process.env.SESSION_CACHE_TTL_MS) || (30 * 1000); // 30s cache TTL

const activeSessions = new Map();
const emailVerificationStatus = new Map();

function randomToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function secureCompare(a, b) {
    if (!a || !b) return false;
    const bufferA = Buffer.from(String(a));
    const bufferB = Buffer.from(String(b));
    if (bufferA.length !== bufferB.length) return false;
    return crypto.timingSafeEqual(bufferA, bufferB);
}

function getCookie(req, name) {
    if (!req || !req.headers || typeof req.headers !== 'object') return null;
    const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
    if (!cookieHeader) return null;
    const match = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
    if (!match) return null;
    const rawValue = match.substring(name.length + 1);
    try {
        return decodeURIComponent(rawValue);
    } catch (_) {
        return rawValue;
    }
}

function setCookie(res, name, value, options = {}) {
    const cookieOptions = {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
        path: '/',
        ...options
    };
    res.cookie(name, value, cookieOptions);
}

function clearCookie(res, name) {
    res.clearCookie(name, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.isProduction });
}

function sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
}

const db = require('../data/db-connection.js');

async function markLoginFailure(identifier) {
    const key = String(identifier || 'unknown').trim().toLowerCase();
    const current = await db.getLoginAttempt(key);
    const nextCount = (current.count || 0) + 1;
    const nextLocked = nextCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_WINDOW_MS : 0;
    await db.setLoginAttempt(key, nextCount, nextLocked);
    return nextLocked;
}

async function clearLoginFailure(identifier) {
    await db.clearLoginAttempt(String(identifier || '').trim().toLowerCase());
}

function createAccessToken(user, sessionId) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role || 'customer', sessionId, type: 'access' },
        config.JWT_SECRET,
        { expiresIn: '15m', issuer: 'rewaq' }
    );
}

// remember: true => 30 days | false => browser-session only (24h max) | undefined => legacy 7 days
function getRefreshTtl(remember) {
    if (remember === true) return REMEMBER_REFRESH_TTL;
    if (remember === false) return SHORT_REFRESH_TTL;
    return REFRESH_TOKEN_TTL;
}

// Cookie options for the refresh token. Without "remember" no maxAge is set,
// so the browser drops the cookie when it is closed.
function refreshCookieOptions(remember) {
    const opts = { httpOnly: true, sameSite: 'lax', secure: config.isProduction };
    if (remember !== false) opts.maxAge = getRefreshTtl(remember);
    return opts;
}

async function createRefreshToken(user, sessionId, remember) {
    const tokenValue = randomToken();
    const tokenHash = hashToken(tokenValue);
    const expiresAt = Date.now() + getRefreshTtl(remember);
    await db.storeRefreshToken({
        tokenHash,
        userId: Number(user.id),
        sessionId,
        remember,
        expiresAt
    });
    return tokenValue;
}


async function issueSession(user, req) {
    const userId = Number(user && (user.id || user.userId));
    if (!userId) throw new Error('معرف المستخدم غير صالح للجلسة');

    const sessionId = randomToken();
    const userAgent = (req.headers && req.headers['user-agent']) || 'unknown';
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    const now = Date.now();
    const expiresAt = now + SESSION_TTL;

    const sessionRecord = {
        userId,
        sessionId,
        userAgent: String(userAgent).substring(0, 255),
        ip: String(ip).substring(0, 64),
        createdAt: new Date().toISOString(),
        lastSeen: now,
        revoked: false,
        expiresAt,
        cachedAt: now,
        role: user.role || 'customer'
    };
    activeSessions.set(sessionId, sessionRecord);

    try {
        await db.createSession({
            sessionId,
            userId,
            userAgent,
            ip,
            expiresAt,
            lastSeen: now
        });
    } catch (err) {
        activeSessions.delete(sessionId);
        throw new Error('تعذر إنشاء جلسة آمنة للمستخدم');
    }

    return sessionId;
}

async function revokeSession(sessionId) {
    if (!sessionId) return false;
    const session = activeSessions.get(sessionId);
    if (session) {
        session.revoked = true;
    }
    activeSessions.delete(sessionId);
    try {
        await db.revokeSession(sessionId);
    } catch (err) {
        console.error('Failed to revoke session in database:', err.message);
    }
    return true;
}

async function revokeAllUserSessions(userId) {
    const uid = Number(userId);
    if (!uid) return false;
    for (const [sessionId, session] of activeSessions.entries()) {
        if (session.userId === uid) {
            session.revoked = true;
            activeSessions.delete(sessionId);
        }
    }
    try {
        await db.revokeAllUserSessions(uid);
    } catch (err) {
        console.error('Failed to revoke all user sessions in DB:', err.message);
    }
    try {
        await db.revokeAllUserRefreshTokens(uid);
    } catch (err) {
        console.error('Failed to revoke all user refresh tokens in DB:', err.message);
    }
    return true;
}

function getAccessTokenFromRequest(req) {
    const cookieToken = getCookie(req, 'access_token');
    if (cookieToken) return cookieToken;

    const headers = req && req.headers ? req.headers : {};
    const authHeader = Array.isArray(headers.authorization)
        ? headers.authorization.find(value => typeof value === 'string' && value.trim()) || ''
        : (typeof headers.authorization === 'string' ? headers.authorization : '');
    const value = String(authHeader || '').trim();
    if (!value) return null;
    if (value.toLowerCase().startsWith('bearer ')) {
        return value.substring(7).trim();
    }
    return null;
}

async function parseUserFromReq(req) {
    const token = getAccessTokenFromRequest(req);
    if (!token || typeof token !== 'string') return null;

    const normalizedToken = token.trim();
    if (!normalizedToken || /^token_user_/i.test(normalizedToken)) return null;

    try {
        const decoded = jwt.verify(normalizedToken, config.JWT_SECRET);
        if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.sessionId) return null;

        const now = Date.now();
        let session = activeSessions.get(decoded.sessionId);

        // If missing from cache or cached entry is older than SESSION_CACHE_TTL, re-verify from database
        if (!session || !session.cachedAt || (now - session.cachedAt) > SESSION_CACHE_TTL) {
            try {
                session = await db.getSession(decoded.sessionId);
                if (session) {
                    if (session.revoked || session.expiresAt <= now) {
                        activeSessions.delete(decoded.sessionId);
                        return null;
                    }
                    const user = await db.findUserById(session.userId);
                    if (!user || user.is_disabled || user.status === 'disabled') {
                        activeSessions.delete(decoded.sessionId);
                        await db.revokeSession(decoded.sessionId).catch(() => {});
                        return null;
                    }
                    session.cachedAt = now;
                    session.role = user.role || 'customer';
                    activeSessions.set(decoded.sessionId, session);
                } else {
                    activeSessions.delete(decoded.sessionId);
                }
            } catch (err) {
                console.error('Failed to fetch session from database:', err.message);
            }
        }

        // Strict session check: session must exist, match user, not revoked, and not expired
        if (!session || session.userId !== Number(decoded.id) || session.revoked || session.expiresAt <= now) {
            if (session && (session.revoked || session.expiresAt <= now)) {
                activeSessions.delete(decoded.sessionId);
            }
            return null;
        }

        session.lastSeen = now;
        db.touchSession(decoded.sessionId, session.lastSeen).catch(() => {});

        return Number(decoded.id);
    } catch (error) {
        return null;
    }
}

async function purgeExpiredRecords() {
    const now = Date.now();
    for (const [key, val] of activeSessions.entries()) {
        if (val.expiresAt && val.expiresAt < now) {
            activeSessions.delete(key);
        }
    }
    try {
        await db.purgeExpiredSessionsAndTokens();
    } catch (err) {}
}

const purgeTimer = setInterval(purgeExpiredRecords, 30 * 60 * 1000);
if (purgeTimer && typeof purgeTimer.unref === 'function') {
    purgeTimer.unref();
}

module.exports = {
    randomToken,
    hashToken,
    secureCompare,
    getCookie,
    setCookie,
    clearCookie,
    sanitizeUser,
    markLoginFailure,
    clearLoginFailure,
    createAccessToken,
    createRefreshToken,
    refreshCookieOptions,
    issueSession,
    revokeSession,
    revokeAllUserSessions,
    getAccessTokenFromRequest,
    parseUserFromReq,
    purgeExpiredRecords,
    activeSessions,
    SESSION_CACHE_TTL
};
