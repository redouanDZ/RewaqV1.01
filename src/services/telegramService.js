/**
 * Telegram Notification Service for Rewaq Admin
 * Sends instant rich alerts on new customer orders
 */
const https = require('https');
const db = require('../data/db-connection');

class TelegramService {
    /**
     * Send a formatted notification message via Telegram Bot API
     * @param {string} token Telegram Bot Token
     * @param {string|number} chatId Telegram Chat ID
     * @param {string} text HTML-formatted message
     */
    async sendMessage(token, chatId, text) {
        if (!token || !chatId || !text) {
            return { success: false, error: 'Token, Chat ID, and message text are required' };
        }

        return new Promise((resolve) => {
            const payload = JSON.stringify({
                chat_id: String(chatId).trim(),
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });

            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${String(token).trim()}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 8000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.ok) {
                            resolve({ success: true, result: parsed.result });
                        } else {
                            resolve({ success: false, error: parsed.description || 'Telegram API error' });
                        }
                    } catch (e) {
                        resolve({ success: false, error: 'Invalid response from Telegram API' });
                    }
                });
            });

            req.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, error: 'Telegram request timeout' });
            });

            req.write(payload);
            req.end();
        });
    }

    /**
     * Notify Admin when a new order is placed
     */
    async notifyNewOrder(order, items = []) {
        try {
            const settings = await db.getStoreSettings().catch(() => ({}));
            const botToken = settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
            const chatId = settings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
            const isEnabled = settings.telegram_notifications_enabled !== false && settings.telegram_notifications_enabled !== '0';

            if (!isEnabled || !botToken || !chatId) {
                return; // Telegram notifications not configured or disabled
            }

            const orderNum = order.order_number || ('DZ-' + order.id);
            const customerName = order.shipping_full_name || 'عميل';
            const phone = order.phone || '-';
            const wilaya = order.wilaya_name || order.city || 'الجزائر';
            const deliveryType = order.delivery_type === 'desk' ? '🏢 مكتب (Stop Desk)' : '🏠 منزلي';
            const paymentMethod = order.payment_method === 'chargily' ? '💳 بطاقة بنكية (Chargily)' : '💵 عند الاستلام (COD)';
            const total = Number(order.total || 0).toLocaleString();

            let itemsSummary = '';
            if (Array.isArray(items) && items.length > 0) {
                itemsSummary = items.map(item => `  • <b>${item.name}</b> (×${item.quantity}) - ${Number(item.price * item.quantity).toLocaleString()} دج`).join('\n');
            }

            const message = 
`🛍️ <b>طلب جديد في المتجر!</b> 🛍️
━━━━━━━━━━━━━━━━━━
📦 <b>رقم الطلب:</b> <code>${orderNum}</code>
👤 <b>العميل:</b> ${customerName}
📞 <b>الهاتف:</b> <code>${phone}</code>
📍 <b>الولاية والتوصيل:</b> ${wilaya} (${deliveryType})
💰 <b>طريقة الدفع:</b> ${paymentMethod}
💵 <b>المجموع الكلي:</b> <b>${total} دج</b>

📋 <b>عناصر الطلب:</b>
${itemsSummary || '  • تفاصيل الطلب مسجلة في لوحة التحكم'}

🕒 <b>الوقت:</b> ${new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
━━━━━━━━━━━━━━━━━━
👉 <i>يمكنك إدارة وتأكيد الطلب مباشرة من لوحة التحكم.</i>`;

            const result = await this.sendMessage(botToken, chatId, message);
            if (!result.success) {
                console.warn('⚠️ Telegram notification failed:', result.error);
            }
        } catch (error) {
            console.error('Error in notifyNewOrder:', error.message);
        }
    }

    /**
     * Send a test message to verify Telegram Bot configuration
     */
    async sendTestAlert(token, chatId) {
        // Get the real store name from settings
        let storeName = 'متجر رواق';
        try {
            const settings = await db.getStoreSettings().catch(() => ({}));
            if (settings && settings.store_name) storeName = String(settings.store_name).trim();
        } catch(e) {}

        const testMessage = 
`✅ <b>اختبار ربط إشعارات ${storeName}</b>
━━━━━━━━━━━━━━━━━━
🎉 <b>تهانينا!</b> تم ربط بوت التيليجرام بمتجرك الإلكتروني بنجاح.
ستصلك الآن إشعارات فورية مع كل طلب شراء جديد فور تسجيله من الزبائن!

🕒 <b>التاريخ:</b> ${new Date().toLocaleString('ar-DZ')}`;

        return this.sendMessage(token, chatId, testMessage);
    }
}

module.exports = new TelegramService();
