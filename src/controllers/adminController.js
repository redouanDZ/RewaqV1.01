const db = require('../data/db-connection.js');
const storeConfig = require('../config/storeConfig');
const { revokeAllUserSessions } = require('../utils/tokenUtils');

async function getDashboardStats(req, res) {
    try {
        const stats = await db.getAdminDashboardStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'خطأ في جلب إحصائيات لوحة التحكم', message: 'خطأ في جلب إحصائيات لوحة التحكم', code: 'ADMIN_STATS_FAILED' });
    }
}

async function getPublicConfig(req, res) {
    try {
        res.json({
            storeName: storeConfig.storeName,
            storeTagline: storeConfig.storeTagline,
            storePhone: storeConfig.storePhone,
            storeEmail: storeConfig.storeEmail,
            storeAddress: storeConfig.storeAddress,
            currencySymbol: storeConfig.currencySymbol,
            currencyCode: storeConfig.currencyCode,
            chargilyEnabled: Boolean(storeConfig.chargily.publicKey),
            chargilyPublicKey: storeConfig.chargily.publicKey,
            chargilyMode: storeConfig.chargily.mode
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب إعدادات المتجر', message: 'خطأ في جلب إعدادات المتجر', code: 'STORE_CONFIG_FAILED' });
    }
}

// --- Customers Handlers ---
async function getAdminUsers(req, res) {
    try {
        const { search, role, page, limit } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const result = await db.getAdminUsers({ search, role, page: pageNum, limit: limitNum });
        res.json(result);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ error: 'خطأ في جلب قائمة العملاء', message: 'خطأ في جلب قائمة العملاء', code: 'CUSTOMERS_FETCH_FAILED' });
    }
}

async function getAdminUserById(req, res) {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) return res.status(400).json({ error: 'معرف المستخدم غير صالح', message: 'معرف المستخدم غير صالح', code: 'INVALID_USER_ID' });
        const user = await db.getAdminUserById(userId);
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود', message: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' });
        res.json(user);
    } catch (error) {
        console.error('Error fetching admin user details:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات العميل', message: 'خطأ في جلب بيانات العميل', code: 'CUSTOMER_FETCH_FAILED' });
    }
}

// --- Coupons Handlers ---
async function getAdminCoupons(req, res) {
    try {
        const { search, status } = req.query;
        const coupons = await db.getCoupons({ search, status });
        res.json(coupons);
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ error: 'خطأ في جلب قسائم الخصم', message: 'خطأ في جلب قسائم الخصم', code: 'COUPONS_FETCH_FAILED' });
    }
}

async function createCoupon(req, res) {
    try {
        const { code, discountPercent, discountAmount, minOrderAmount, maxUses, status, expiresAt } = req.body;
        if (!code || !String(code).trim()) {
            return res.status(400).json({ error: 'رمز الكوبون مطلوب', message: 'رمز الكوبون مطلوب', code: 'COUPON_CODE_REQUIRED' });
        }
        const cleanCode = String(code).trim().toUpperCase();
        const existing = await db.getCouponByCode(cleanCode);
        if (existing) {
            return res.status(400).json({ error: 'رمز الكوبون موجود بالفعل', message: 'رمز الكوبون موجود بالفعل', code: 'COUPON_ALREADY_EXISTS' });
        }

        const id = await db.createCoupon({
            code: cleanCode,
            discountPercent: Number(discountPercent) || 0,
            discountAmount: Number(discountAmount) || 0,
            minOrderAmount: Number(minOrderAmount) || 0,
            maxUses: Number(maxUses) || 100,
            status: status || 'active',
            expiresAt: expiresAt || null
        });

        res.status(201).json({ message: 'تم إنشاء قسيمة الخصم بنجاح', id });
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).json({ error: error.message || 'خطأ في إنشاء قسيمة الخصم', message: error.message || 'خطأ في إنشاء قسيمة الخصم', code: 'COUPON_CREATE_FAILED' });
    }
}

async function updateCoupon(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'معرف الكوبون غير صالح', message: 'معرف الكوبون غير صالح', code: 'INVALID_COUPON_ID' });
        const success = await db.updateCoupon(id, req.body);
        if (!success) return res.status(404).json({ error: 'الكوبون غير موجود', message: 'الكوبون غير موجود', code: 'COUPON_NOT_FOUND' });
        res.json({ message: 'تم تحديث الكوبون بنجاح' });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({ error: 'خطأ في تحديث الكوبون', message: 'خطأ في تحديث الكوبون', code: 'COUPON_UPDATE_FAILED' });
    }
}

async function deleteCoupon(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'معرف الكوبون غير صالح', message: 'معرف الكوبون غير صالح', code: 'INVALID_COUPON_ID' });
        const success = await db.deleteCoupon(id);
        if (!success) return res.status(404).json({ error: 'الكوبون غير موجود', message: 'الكوبون غير موجود', code: 'COUPON_NOT_FOUND' });
        res.json({ message: 'تم حذف الكوبون بنجاح' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ error: 'خطأ في حذف الكوبون', message: 'خطأ في حذف الكوبون', code: 'COUPON_DELETE_FAILED' });
    }
}

// --- Reviews Handlers ---
async function getAdminReviews(req, res) {
    try {
        const { status, rating, productId, search, page, limit } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const result = await db.getAdminReviews({ status, rating: rating ? Number(rating) : null, productId, search, page: pageNum, limit: limitNum });
        res.json(result);
    } catch (error) {
        console.error('Error fetching admin reviews:', error);
        res.status(500).json({ error: 'خطأ في جلب التقييمات', message: 'خطأ في جلب التقييمات', code: 'REVIEWS_FETCH_FAILED' });
    }
}

async function updateReviewStatus(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { status } = req.body;
        if (isNaN(id)) return res.status(400).json({ error: 'معرف التقييم غير صالح', message: 'معرف التقييم غير صالح', code: 'INVALID_REVIEW_ID' });
        if (!['approved', 'pending', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'حالة التقييم غير صالحة', message: 'حالة التقييم غير صالحة', code: 'INVALID_REVIEW_STATUS' });
        }
        const success = await db.updateReviewStatus(id, status);
        if (!success) return res.status(404).json({ error: 'التقييم غير موجود', message: 'التقييم غير موجود', code: 'REVIEW_NOT_FOUND' });
        res.json({ message: 'تم تحديث حالة التقييم بنجاح' });
    } catch (error) {
        console.error('Error updating review status:', error);
        res.status(500).json({ error: 'خطأ في تحديث حالة التقييم', message: 'خطأ في تحديث حالة التقييم', code: 'REVIEW_UPDATE_FAILED' });
    }
}

async function deleteReview(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'معرف التقييم غير صالح', message: 'معرف التقييم غير صالح', code: 'INVALID_REVIEW_ID' });
        const success = await db.deleteReview(id);
        if (!success) return res.status(404).json({ error: 'التقييم غير موجود', message: 'التقييم غير موجود', code: 'REVIEW_NOT_FOUND' });
        res.json({ message: 'تم حذف التقييم بنجاح' });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ error: 'خطأ في حذف التقييم', message: 'خطأ في حذف التقييم', code: 'REVIEW_DELETE_FAILED' });
    }
}

// Settings that may be exposed to anonymous visitors (storefront). Everything else
// (e.g. telegram_bot_token, telegram_chat_id) stays admin-only.
const PUBLIC_SETTING_KEYS = [
    'store_name', 'store_logo', 'store_favicon', 'store_tagline',
    'store_phone', 'store_whatsapp', 'store_email', 'store_address', 'store_currency',
    'facebook_url', 'instagram_url', 'tiktok_url',
    'shipping_policy', 'return_policy', 'warranty_policy',
    'enable_cod', 'enable_chargily', 'enable_ccp',
    'ccp_account_number', 'ccp_account_key', 'ccp_rip', 'ccp_account_holder',
    'announcement_bar_text',
    'facebook_pixel_id', 'tiktok_pixel_id', 'google_analytics_id', 'snapchat_pixel_id', 'google_client_id'
];

// CCP / BaridiMob account fields: digits only, bounded length.
const CCP_DIGIT_FIELDS = { ccp_account_number: 20, ccp_account_key: 4, ccp_rip: 24 };

function validateSettingsPayload(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'INVALID_SETTINGS_PAYLOAD' };
    }
    for (const [key, maxLen] of Object.entries(CCP_DIGIT_FIELDS)) {
        if (body[key] === undefined || body[key] === null || body[key] === '') continue;
        const value = String(body[key]).replace(/\s+/g, '');
        if (!/^\d+$/.test(value) || value.length > maxLen) return { error: 'INVALID_CCP_FIELD' };
        body[key] = value;
    }
    if (body.ccp_account_holder !== undefined && body.ccp_account_holder !== null) {
        body.ccp_account_holder = String(body.ccp_account_holder).trim().slice(0, 80);
    }
    return {};
}

async function getPublicStoreSettings(req, res) {
    try {
        const all = await db.getStoreSettings();
        const publicSettings = {};
        for (const key of PUBLIC_SETTING_KEYS) {
            if (Object.prototype.hasOwnProperty.call(all, key)) publicSettings[key] = all[key];
        }
        publicSettings.demo_mode = process.env.DEMO_MODE === 'true';
        res.json(publicSettings);
    } catch (error) {
        console.error('Error fetching public store settings:', error);
        res.status(500).json({ error: 'خطأ في جلب إعدادات المتجر' });
    }
}

async function getStoreSettings(req, res) {
    try {
        const settings = await db.getStoreSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching store settings:', error);
        res.status(500).json({ error: 'خطأ في جلب إعدادات المتجر' });
    }
}

async function updateStoreSettings(req, res) {
    try {
        const check = validateSettingsPayload(req.body);
        if (check.error) {
            return res.status(400).json({ error: check.error, message: check.error, code: check.error });
        }
        const updated = await db.updateStoreSettings(req.body);
        res.json({ message: 'تم حفظ الإعدادات بنجاح', settings: updated });
    } catch (error) {
        console.error('Error updating store settings:', error);
        res.status(500).json({ error: 'خطأ في حفظ الإعدادات', message: 'خطأ في حفظ الإعدادات', code: 'SETTINGS_SAVE_FAILED' });
    }
}

async function uploadMedia(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'لم يتم رفع أي ملف', message: 'لم يتم رفع أي ملف', code: 'NO_FILE_UPLOADED' });
        }
        const fileUrl = req.file.url || `/images/${req.file.filename}`;
        res.status(201).json({
            message: 'تم رفع الملف بنجاح',
            url: fileUrl,
            storageProvider: req.file.storageProvider || 'local'
        });
    } catch (error) {
        console.error('Error uploading media:', error);
        res.status(500).json({ error: 'خطأ أثناء رفع الملف', message: 'خطأ أثناء رفع الملف', code: 'FILE_UPLOAD_FAILED' });
    }
}

async function updateUserRole(req, res) {
    try {
        const userId = parseInt(req.params.id, 10);
        const { role } = req.body;
        if (isNaN(userId)) return res.status(400).json({ error: 'معرف المستخدم غير صالح', message: 'معرف المستخدم غير صالح', code: 'INVALID_USER_ID' });
        if (!['customer', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'نوع الدور غير صالح (customer أو admin)', message: 'نوع الدور غير صالح (customer أو admin)', code: 'INVALID_ROLE' });
        }

        // Safety: Prevent admin from changing their own role to prevent lockout
        if (req.userId && Number(req.userId) === userId && role !== 'admin') {
            return res.status(400).json({ error: 'لا يمكنك تغيير صلاحيات حسابك الخاص كمسؤول', message: 'لا يمكنك تغيير صلاحيات حسابك الخاص كمسؤول', code: 'CANNOT_CHANGE_OWN_ROLE' });
        }

        const success = await db.updateUserRole(userId, role);
        if (!success) return res.status(404).json({ error: 'المستخدم غير موجود', message: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' });
        await revokeAllUserSessions(userId);
        res.json({ message: 'تم تحديث دور المستخدم بنجاح' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'خطأ في تحديث دور المستخدم', message: 'خطأ في تحديث دور المستخدم', code: 'ROLE_UPDATE_FAILED' });
    }
}

async function updateUserStatus(req, res) {
    try {
        const userId = parseInt(req.params.id, 10);
        const { status, is_disabled } = req.body;
        if (isNaN(userId)) return res.status(400).json({ error: 'معرف المستخدم غير صالح', message: 'معرف المستخدم غير صالح', code: 'INVALID_USER_ID' });

        if (req.userId && Number(req.userId) === userId && (status === 'disabled' || is_disabled === true)) {
            return res.status(400).json({ error: 'لا يمكنك تغيير صلاحيات حسابك الخاص كمسؤول', message: 'لا يمكنك تغيير صلاحيات حسابك الخاص كمسؤول', code: 'CANNOT_CHANGE_OWN_ROLE' });
        }

        if (typeof db.updateUserStatus === 'function') {
            await db.updateUserStatus(userId, status || (is_disabled ? 'disabled' : 'active'));
        }
        if (status === 'disabled' || is_disabled === true) {
            await revokeAllUserSessions(userId);
        }
        res.json({ message: 'تم تحديث دور المستخدم بنجاح' });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'خطأ في تحديث دور المستخدم', message: 'خطأ في تحديث دور المستخدم', code: 'ROLE_UPDATE_FAILED' });
    }
}

async function deleteUser(req, res) {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) return res.status(400).json({ error: 'معرف المستخدم غير صالح', message: 'معرف المستخدم غير صالح', code: 'INVALID_USER_ID' });

        // Safety: Prevent admin from deleting their own account
        if (req.userId && Number(req.userId) === userId) {
            return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص كمسؤول', message: 'لا يمكنك حذف حسابك الخاص كمسؤول', code: 'CANNOT_DELETE_OWN_ACCOUNT' });
        }

        const success = await db.deleteUser(userId);
        if (!success) return res.status(404).json({ error: 'المستخدم غير موجود', message: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' });
        await revokeAllUserSessions(userId);
        res.json({ message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'خطأ في حذف المستخدم', message: 'خطأ في حذف المستخدم', code: 'USER_DELETE_FAILED' });
    }
}

// --- Categories Handlers ---
async function getCategories(req, res) {
    try {
        const lang = req.query.lang || (req.headers['accept-language'] ? req.headers['accept-language'].slice(0, 2).toLowerCase() : null);
        const categories = await db.getCategories(lang);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'خطأ في جلب الأقسام', message: 'خطأ في جلب الأقسام', code: 'CATEGORIES_FETCH_FAILED' });
    }
}

async function getCategoryById(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'معرف القسم غير صالح', message: 'معرف القسم غير صالح', code: 'INVALID_CATEGORY_ID' });
        const lang = req.query.lang || (req.headers['accept-language'] ? req.headers['accept-language'].slice(0, 2).toLowerCase() : null);
        const category = await db.getCategoryById(id, lang);
        if (!category) return res.status(404).json({ error: 'القسم غير موجود', message: 'القسم غير موجود', code: 'CATEGORY_NOT_FOUND' });
        res.json(category);
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات القسم', message: 'خطأ في جلب بيانات القسم', code: 'CATEGORY_FETCH_FAILED' });
    }
}

async function createCategory(req, res) {
    try {
        const { name, name_fr, name_en, slug } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'اسم القسم مطلوب', message: 'اسم القسم مطلوب', code: 'CATEGORY_NAME_REQUIRED' });
        }
        const id = await db.createCategory({ name: String(name).trim(), name_fr, name_en, slug });
        res.status(201).json({ message: 'تم إنشاء القسم بنجاح', id });
    } catch (error) {
        console.error('Error creating category:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'اسم القسم أو الرابط المرجعي موجود بالفعل', message: 'اسم القسم أو الرابط المرجعي موجود بالفعل', code: 'CATEGORY_ALREADY_EXISTS' });
        }
        res.status(500).json({ error: error.message || 'خطأ في إنشاء القسم', message: error.message || 'خطأ في إنشاء القسم', code: 'CATEGORY_CREATE_FAILED' });
    }
}

async function updateCategory(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'معرف القسم غير صالح', message: 'معرف القسم غير صالح', code: 'INVALID_CATEGORY_ID' });
        const success = await db.updateCategory(id, req.body);
        if (!success) return res.status(404).json({ error: 'القسم غير موجود', message: 'القسم غير موجود', code: 'CATEGORY_NOT_FOUND' });
        res.json({ message: 'تم تحديث القسم بنجاح' });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'خطأ في تحديث القسم', message: 'خطأ في تحديث القسم', code: 'CATEGORY_UPDATE_FAILED' });
    }
}

async function deleteCategory(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'معرف القسم غير صالح', message: 'معرف القسم غير صالح', code: 'INVALID_CATEGORY_ID' });
        const success = await db.deleteCategory(id);
        if (!success) return res.status(404).json({ error: 'القسم غير موجود', message: 'القسم غير موجود', code: 'CATEGORY_NOT_FOUND' });
        res.json({ message: 'تم حذف القسم بنجاح' });
    } catch (error) {
        console.error('Error deleting category:', error);
        if (error.code === 'CATEGORY_HAS_PRODUCTS') {
            return res.status(409).json({ error: error.message, message: error.message, code: 'CATEGORY_HAS_PRODUCTS' });
        }
        res.status(500).json({ error: 'خطأ في حذف القسم', message: 'خطأ في حذف القسم', code: 'CATEGORY_DELETE_FAILED' });
    }
}

async function testTelegramAlert(req, res) {
    try {
        const { botToken, chatId } = req.body || {};
        const telegramService = require('../services/telegramService');
        const settings = await db.getStoreSettings().catch(() => ({}));
        const token = botToken || settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
        const id = chatId || settings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

        if (!token || !id) {
            return res.status(400).json({ error: 'يرجى تقديم رمز البوت (Bot Token) ومعرّف المحادثة (Chat ID)', message: 'يرجى تقديم رمز البوت (Bot Token) ومعرّف المحادثة (Chat ID)', code: 'TELEGRAM_CONFIG_REQUIRED' });
        }

        const result = await telegramService.sendTestAlert(token, id);
        if (!result.success) {
            return res.status(400).json({ error: result.error || 'فشل إرسال رسالة الاختبار إلى تيليجرام', message: result.error || 'فشل إرسال رسالة الاختبار إلى تيليجرام', code: 'TELEGRAM_TEST_FAILED' });
        }

        res.json({ message: 'تم إرسال رسالة الاختبار بنجاح إلى حساب التيليجرام الخاص بك!' });
    } catch (error) {
        console.error('Error sending test Telegram message:', error);
        res.status(500).json({ error: error.message || 'خطأ أثناء اختبار إشعارات تيليجرام', message: error.message || 'خطأ أثناء اختبار إشعارات تيليجرام', code: 'TELEGRAM_TEST_FAILED' });
    }
}

module.exports = {
    getDashboardStats,
    getPublicConfig,
    getAdminUsers,
    getAdminUserById,
    updateUserRole,
    updateUserStatus,
    deleteUser,
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getAdminCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    getAdminReviews,
    updateReviewStatus,
    deleteReview,
    getStoreSettings,
    getPublicStoreSettings,
    PUBLIC_SETTING_KEYS,
    updateStoreSettings,
    uploadMedia,
    testTelegramAlert
};
