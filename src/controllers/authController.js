const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../data/db-connection.js');
const config = require('../config/database');
const mailService = require('../services/mailService');
const {
    randomToken,
    hashToken,
    setCookie,
    clearCookie,
    getCookie,
    sanitizeUser,
    markLoginFailure,
    clearLoginFailure,
    createAccessToken,
    createRefreshToken,
    refreshCookieOptions,
    issueSession,
    revokeSession,
    revokeAllUserSessions,
    activeSessions,
    getAccessTokenFromRequest,
    parseUserFromReq
} = require('../utils/tokenUtils');
const { sanitizeString } = require('../utils/helpers');

function getLoginAttemptKey(email, req) {
    return `${String(req.ip || 'unknown')}|${String(email || '').trim().toLowerCase()}`;
}

async function register(req, res) {
    try {
        const username = sanitizeString(req.body.username || req.body.name, 'مستخدم');
        const email = sanitizeString(req.body.email || '', '').toLowerCase();
        const phone = sanitizeString(req.body.phone || '', '');
        const password = typeof req.body.password === 'string' ? req.body.password : '';

        if (!email || !password) {
            return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبة', code: 'EMAIL_PASSWORD_REQUIRED' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', code: 'PASSWORD_TOO_SHORT' });
        }

        const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
        const user = await db.createUser({
            username,
            email,
            phone,
            password,
            is_verified: !requireVerification
        });

        if (requireVerification) {
            const verificationToken = randomToken();
            await db.updateUserVerificationToken(user.id, verificationToken, Date.now() + 24 * 60 * 60 * 1000);
            return res.status(201).json({
                message: 'تم إنشاء الحساب بنجاح! يرجى التحقق من البريد الإلكتروني.',
                code: 'REGISTRATION_VERIFICATION_REQUIRED',
                user: sanitizeUser(user),
                verificationRequired: true
            });
        }

        // Auto login on register when verification is not mandatory
        const sessionId = await issueSession(user, req);
        const accessToken = createAccessToken(user, sessionId);
        const refreshToken = await createRefreshToken(user, sessionId);
        const csrfToken = randomToken();

        setCookie(res, 'access_token', accessToken, { req, httpOnly: true, maxAge: 15 * 60 * 1000 });
        setCookie(res, 'refresh_token', refreshToken, { req, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        setCookie(res, 'csrf_token', csrfToken, { req, httpOnly: false, maxAge: 60 * 60 * 1000 });

        const isDemo = process.env.DEMO_MODE === 'true';
        res.status(201).json({
            message: 'تم إنشاء الحساب وتسجيل الدخول بنجاح! 🎉',
            code: 'REGISTRATION_SUCCESS',
            user: sanitizeUser(user),
            sessionId,
            ...(isDemo ? { demoToken: accessToken, csrfToken } : {})
        });
    } catch (error) {
        console.error('Registration error:', error);
        const isEmailExists = (error.message && (error.message.includes('مسجل مسبقاً') || error.message.includes('ER_DUP_ENTRY'))) || error.code === 'ER_DUP_ENTRY';
        if (isEmailExists) {
            return res.status(400).json({ message: error.message || 'البريد الإلكتروني مسجل بالفعل', code: 'EMAIL_EXISTS' });
        }
        res.status(400).json({ message: error.message || 'خطأ أثناء تسجيل الحساب', code: 'REGISTRATION_FAILED' });
    }
}

async function login(req, res) {
    try {
        const email = sanitizeString(req.body.email || '', '').toLowerCase();
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const remember = req.body.remember === true || req.body.remember === 'true';

        if (!email || !password) {
            return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور', code: 'EMAIL_PASSWORD_REQUIRED' });
        }

        const lockKey = getLoginAttemptKey(email, req);
        const currentAttempt = await db.getLoginAttempt(lockKey);
        if (currentAttempt.lockedUntil && currentAttempt.lockedUntil > Date.now()) {
            return res.status(429).json({ message: 'تم قفل الحساب مؤقتاً بسبب محاولات تسجيل دخول متكررة. حاول مرة أخرى لاحقاً.', code: 'ACCOUNT_LOCKED' });
        }

        const user = await db.verifyUserCredentials(email, password);
        if (!user) {
            await markLoginFailure(lockKey);
            return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة', code: 'INVALID_CREDENTIALS' });
        }

        if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.is_verified) {
            return res.status(403).json({ message: 'يرجى التحقق من البريد الإلكتروني قبل تسجيل الدخول.', code: 'EMAIL_VERIFICATION_REQUIRED' });
        }

        await clearLoginFailure(lockKey);
        const sessionId = await issueSession(user, req);
        const accessToken = createAccessToken(user, sessionId);
        const refreshToken = await createRefreshToken(user, sessionId, remember);
        const csrfToken = randomToken();

        setCookie(res, 'access_token', accessToken, { req, httpOnly: true, maxAge: 15 * 60 * 1000 });
        setCookie(res, 'refresh_token', refreshToken, refreshCookieOptions(remember, req));
        setCookie(res, 'csrf_token', csrfToken, { req, httpOnly: false, maxAge: 60 * 60 * 1000 });

        const { password: _, ...userWithoutPass } = user;
        const isDemo = process.env.DEMO_MODE === 'true';
        res.json({
            message: 'تم تسجيل الدخول بنجاح!',
            code: 'LOGIN_SUCCESS',
            user: userWithoutPass,
            sessionId,
            ...(isDemo ? { demoToken: accessToken, csrfToken } : {})
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message || 'خطأ أثناء تسجيل الدخول', code: 'LOGIN_FAILED' });
    }
}

function getCsrfToken(req, res) {
    const csrfToken = randomToken();
    setCookie(res, 'csrf_token', csrfToken, { req, httpOnly: false, maxAge: 60 * 60 * 1000 });
    res.json({ csrfToken });
}

async function verifyEmail(req, res) {
    try {
        const token = (req.body && req.body.token) || (req.query && req.query.token) || '';
        if (!token) {
            return res.status(400).json({ message: 'رمز التحقق مطلوب', code: 'VERIFICATION_TOKEN_REQUIRED' });
        }

        const user = await db.findUserByVerificationToken(token);
        if (!user) {
            return res.status(400).json({ message: 'رمز التحقق غير صالح أو منتهي الصلاحية', code: 'INVALID_VERIFICATION_TOKEN' });
        }

        await db.verifyUserEmail(user.id);
        res.json({ message: 'تم التحقق من البريد الإلكتروني بنجاح.', code: 'EMAIL_VERIFIED_SUCCESS' });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ message: 'فشل التحقق من البريد الإلكتروني', code: 'EMAIL_VERIFICATION_FAILED' });
    }
}

async function forgotPassword(req, res) {
    try {
        const email = sanitizeString(req.body.email || '', '').toLowerCase();
        if (!email) {
            return res.status(400).json({ message: 'البريد الإلكتروني مطلوب', code: 'EMAIL_REQUIRED' });
        }

        const user = await db.findUserByEmail(email);
        if (!user) {
            return res.json({ message: 'إذا كان البريد الإلكتروني مسجلاً، تم إرسال تعليمات استعادة كلمة المرور.', code: 'PASSWORD_RESET_SENT' });
        }

        const resetToken = randomToken();
        await db.updatePasswordResetToken(email, resetToken, Date.now() + 60 * 60 * 1000);

        try {
            await mailService.sendPasswordResetEmail({
                email: user.email,
                resetToken,
                username: user.username || user.name
            });
        } catch (mailErr) {
            console.error('Password reset email error:', mailErr.message);
        }

        const payload = {
            message: 'تم إرسال تعليمات استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح.',
            code: 'PASSWORD_RESET_SENT'
        };
        if (!config.isProduction) {
            payload.resetToken = resetToken;
        }

        res.json(payload);
    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ message: 'فشل طلب استعادة كلمة المرور', code: 'PASSWORD_RESET_FAILED' });
    }
}

async function resetPassword(req, res) {
    try {
        const token = String(req.body.token || '');
        const password = typeof req.body.password === 'string' ? req.body.password : '';

        if (!token || !password || password.length < 6) {
            return res.status(400).json({ message: 'الرمز وكلمة المرور الجديدة مطلوبة ويجب أن تكون 6 أحرف على الأقل', code: 'INVALID_RESET_PARAMS' });
        }

        const user = await db.findUserByResetToken(token);
        if (!user) {
            return res.status(400).json({ message: 'رمز استعادة كلمة المرور غير صالح أو منتهي الصلاحية', code: 'INVALID_RESET_TOKEN' });
        }

        await db.updateUserProfile(user.id, { password });
        
        // Invalidate token and verify email
        await db.updatePasswordResetToken(user.email, null, null);
        await db.verifyUserEmail(user.id);
        
        // Revoke all sessions and refresh tokens on password change
        await revokeAllUserSessions(user.id);
        
        res.json({ message: 'تم تحديث كلمة المرور بنجاح.', code: 'PASSWORD_UPDATED_SUCCESS' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: 'فشل تحديث كلمة المرور', code: 'PASSWORD_UPDATE_FAILED' });
    }
}

async function refreshSession(req, res) {
    try {
        const refreshTokenValue = getCookie(req, 'refresh_token');
        if (!refreshTokenValue) {
            return res.status(401).json({ message: 'جلسة المستخدم غير موجودة', code: 'SESSION_NOT_FOUND' });
        }

        const tokenRecord = await db.getRefreshToken(hashToken(refreshTokenValue));
        if (!tokenRecord) {
            clearCookie(res, 'refresh_token', { req });
            clearCookie(res, 'access_token', { req });
            return res.status(401).json({ message: 'جلسة المستخدم غير موجودة', code: 'SESSION_NOT_FOUND' });
        }

        // Token reuse detection!
        if (tokenRecord.revokedAt) {
            await revokeAllUserSessions(tokenRecord.userId);
            clearCookie(res, 'refresh_token', { req });
            clearCookie(res, 'access_token', { req });
            return res.status(401).json({ message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى', code: 'SESSION_EXPIRED' });
        }

        if (tokenRecord.expiresAt <= Date.now()) {
            clearCookie(res, 'refresh_token', { req });
            clearCookie(res, 'access_token', { req });
            return res.status(401).json({ message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى', code: 'SESSION_EXPIRED' });
        }

        const user = await db.findUserById(tokenRecord.userId);
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' });
        }

        const newSessionId = await issueSession(user, req);
        const newAccessToken = createAccessToken(user, newSessionId);
        const newRefreshToken = await createRefreshToken(user, newSessionId, tokenRecord.remember);
        const csrfToken = randomToken();

        await db.revokeRefreshToken(tokenRecord.tokenHash);
        await revokeSession(tokenRecord.sessionId);

        setCookie(res, 'access_token', newAccessToken, { req, httpOnly: true, maxAge: 15 * 60 * 1000 });
        setCookie(res, 'refresh_token', newRefreshToken, refreshCookieOptions(tokenRecord.remember, req));
        setCookie(res, 'csrf_token', csrfToken, { req, httpOnly: false, maxAge: 60 * 60 * 1000 });

        const isDemo = process.env.DEMO_MODE === 'true';
        res.json({
            message: 'تم تجديد الجلسة بنجاح',
            code: 'SESSION_REFRESHED',
            user: sanitizeUser(user),
            ...(isDemo ? { demoToken: newAccessToken, csrfToken } : {})
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ message: 'فشل في تحديث الجلسة', code: 'SESSION_REFRESH_FAILED' });
    }
}

async function getSession(req, res) {
    try {
        const userId = await parseUserFromReq(req);
        if (!userId) {
            return res.json({ user: null });
        }

        const user = await db.findUserById(userId);
        if (!user || user.is_disabled || user.status === 'disabled') {
            return res.json({ user: null });
        }
        res.json({ user: sanitizeUser(user) });
    } catch (error) {
        res.json({ user: null });
    }
}

async function listSessions(req, res) {
    try {
        const sessions = await db.getUserSessions(req.userId);
        res.json({ sessions });
    } catch (error) {
        console.error('Session listing error:', error);
        res.status(500).json({ message: 'فشل في جلب جلسات المستخدم', code: 'SESSIONS_FETCH_FAILED' });
    }
}

async function revokeUserSession(req, res) {
    try {
        const session = await db.getSession(req.params.sessionId);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ message: 'الجلسة غير موجودة', code: 'SESSION_NOT_FOUND' });
        }
        await revokeSession(req.params.sessionId);
        res.json({ message: 'تم إلغاء الجلسة بنجاح.', code: 'SESSION_REVOKED' });
    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({ message: 'فشل في إلغاء الجلسة', code: 'SESSION_REVOKE_FAILED' });
    }
}

async function logout(req, res) {
    try {
        let sessionId = req.sessionId || null;
        if (!sessionId) {
            const token = getAccessTokenFromRequest(req);
            if (token) {
                try {
                    const decoded = jwt.verify(token, config.JWT_SECRET, { ignoreExpiration: true });
                    if (decoded && decoded.sessionId) {
                        sessionId = decoded.sessionId;
                    }
                } catch (e) {}
            }
        }

        if (sessionId) {
            await revokeSession(sessionId);
        }

        const refreshTokenValue = getCookie(req, 'refresh_token');
        if (refreshTokenValue) {
            await db.revokeRefreshToken(hashToken(refreshTokenValue));
        }

        clearCookie(res, 'access_token', { req });
        clearCookie(res, 'refresh_token', { req });
        clearCookie(res, 'csrf_token', { req });
        res.json({ message: 'تم تسجيل الخروج بنجاح', code: 'LOGOUT_SUCCESS' });
    } catch (err) {
        console.error('Logout error:', err);
        clearCookie(res, 'access_token', { req });
        clearCookie(res, 'refresh_token', { req });
        clearCookie(res, 'csrf_token', { req });
        res.json({ message: 'تم تسجيل الخروج بنجاح', code: 'LOGOUT_SUCCESS' });
    }
}

async function googleLogin(req, res) {
    try {
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            return res.status(503).json({ message: 'تسجيل الدخول عبر Google غير مُفعَّل على هذا الخادم', code: 'GOOGLE_AUTH_DISABLED' });
        }

        const { credential } = req.body || {};
        if (!credential || typeof credential !== 'string') {
            return res.status(400).json({ message: 'رمز اعتماد Google مفقود أو غير صالح', code: 'INVALID_GOOGLE_CREDENTIAL' });
        }

        const googleClient = new OAuth2Client(googleClientId);
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: googleClientId
            });
            payload = ticket.getPayload();
        } catch (err) {
            return res.status(401).json({ message: 'رمز اعتماد Google غير صالح', code: 'INVALID_GOOGLE_CREDENTIAL' });
        }

        if (!payload || !payload.sub || !payload.email || !payload.email_verified) {
            return res.status(401).json({ message: 'بيانات حساب Google غير صالحة أو غير مؤكَّدة', code: 'INVALID_GOOGLE_ACCOUNT' });
        }

        const googleId = String(payload.sub);
        const email = String(payload.email).toLowerCase().trim();
        const name = String(payload.name || payload.given_name || 'مستخدم Google').trim();
        const avatarUrl = String(payload.picture || '').trim();

        let user = null;
        if (typeof db.findUserByGoogleId === 'function') {
            user = await db.findUserByGoogleId(googleId);
        }

        if (!user) {
            user = await db.findUserByEmail(email);
            if (user) {
                if (typeof db.linkGoogleId === 'function') {
                    user = await db.linkGoogleId(user.id, googleId, avatarUrl);
                }
            } else {
                if (typeof db.createUserFromGoogle === 'function') {
                    user = await db.createUserFromGoogle({ googleId, email, name, avatarUrl });
                } else {
                    user = await db.createUser({ username: name, email, password: randomToken() });
                }
            }
        }

        if (!user) {
            return res.status(500).json({ message: 'فشل في إنشاء أو تسجيل حساب Google', code: 'GOOGLE_ACCOUNT_CREATION_FAILED' });
        }


        const sessionId = await issueSession(user, req);
        const accessToken = createAccessToken(user, sessionId);
        const refreshToken = await createRefreshToken(user, sessionId);
        const csrfToken = randomToken();

        setCookie(res, 'access_token', accessToken, { req, httpOnly: true, maxAge: 15 * 60 * 1000 });
        setCookie(res, 'refresh_token', refreshToken, { req, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        setCookie(res, 'csrf_token', csrfToken, { req, httpOnly: false, maxAge: 60 * 60 * 1000 });

        const { password: _, ...userWithoutPass } = user;
        const isDemo = process.env.DEMO_MODE === 'true';
        res.json({
            message: 'تم تسجيل الدخول بنجاح عبر حساب Google! 🎉',
            code: 'GOOGLE_LOGIN_SUCCESS',
            user: userWithoutPass,
            sessionId,
            ...(isDemo ? { demoToken: accessToken, csrfToken } : {})
        });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'خطأ أثناء تسجيل الدخول عبر Google', code: 'GOOGLE_LOGIN_FAILED' });
    }
}

module.exports = {
    register,
    login,
    googleLogin,
    getCsrfToken,
    verifyEmail,
    forgotPassword,
    resetPassword,
    refreshSession,
    getSession,
    listSessions,
    revokeUserSession,
    logout
};
