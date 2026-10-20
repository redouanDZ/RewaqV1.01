const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/data/db-connection.js');
const { subscribe } = require('../src/controllers/newsletterController.js');
const { validateCoupon } = require('../src/controllers/couponController.js');

test('Newsletter VIP Club Feature Suite', async (t) => {
    await t.test('1. Subscribe with valid email returns 200 and PROMO10 coupon', async () => {
        const req = {
            body: { email: 'vip_customer@rewaq.dz' },
            ip: '127.0.0.1'
        };
        let statusCode = 200;
        let responseData = null;
        const res = {
            status(code) { statusCode = code; return this; },
            json(data) { responseData = data; return this; }
        };

        await subscribe(req, res);

        assert.strictEqual(statusCode, 200);
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.alreadySubscribed, false);
        assert.strictEqual(responseData.discountCode, 'PROMO10');
        assert.strictEqual(responseData.discountPercent, 10);
        assert.ok(responseData.coupon);
        assert.strictEqual(responseData.coupon.code, 'PROMO10');
    });

    await t.test('2. Subscribing again with the same email handles duplicate gracefully', async () => {
        const req = {
            body: { email: 'vip_customer@rewaq.dz' },
            ip: '127.0.0.1'
        };
        let statusCode = 200;
        let responseData = null;
        const res = {
            status(code) { statusCode = code; return this; },
            json(data) { responseData = data; return this; }
        };

        await subscribe(req, res);

        assert.strictEqual(statusCode, 200);
        assert.strictEqual(responseData.success, true);
        assert.strictEqual(responseData.alreadySubscribed, true);
        assert.strictEqual(responseData.discountCode, 'PROMO10');
    });

    await t.test('3. Subscribing with invalid email returns 400 INVALID_EMAIL', async () => {
        const req = {
            body: { email: 'invalid-email-format' },
            ip: '127.0.0.1'
        };
        let statusCode = 200;
        let responseData = null;
        const res = {
            status(code) { statusCode = code; return this; },
            json(data) { responseData = data; return this; }
        };

        await subscribe(req, res);

        assert.strictEqual(statusCode, 400);
        assert.strictEqual(responseData.success, false);
        assert.strictEqual(responseData.code, 'INVALID_EMAIL');
    });

    await t.test('4. PROMO10 coupon validates successfully in cart checkout system', async () => {
        const req = {
            body: { code: 'PROMO10', orderAmount: 5000 }
        };
        let statusCode = 200;
        let responseData = null;
        const res = {
            status(code) { statusCode = code; return this; },
            json(data) { responseData = data; return this; }
        };

        await validateCoupon(req, res);

        assert.strictEqual(statusCode, 200);
        assert.strictEqual(responseData.valid, true);
        assert.strictEqual(responseData.code, 'PROMO10');
        assert.strictEqual(responseData.discountPercent, 10);
        assert.strictEqual(responseData.calculatedDiscount, 500); // 10% of 5000 = 500 DZD
    });

    await t.test('5. Repository lists and deletes subscribers', async () => {
        const list = await db.getNewsletterSubscribers({ limit: 10 });
        assert.ok(Array.isArray(list.subscribers));
        assert.ok(list.total >= 1);

        const sub = list.subscribers.find(s => s.email === 'vip_customer@rewaq.dz');
        assert.ok(sub);

        const deleted = await db.deleteNewsletterSubscriber(sub.id);
        assert.strictEqual(deleted, true);
    });
});
