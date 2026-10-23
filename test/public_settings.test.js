const { describe, test } = require('node:test');
const assert = require('node:assert');
const db = require('../src/data/db-connection');
const adminController = require('../src/controllers/adminController');

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

describe('Public store settings: allow-list & CCP details', () => {
    test.before(async () => {
        await db.initializeDatabase();
    });

    test('public settings never expose Telegram secrets', async () => {
        await db.updateStoreSettings({
            telegram_bot_token: '123456:SECRET-TEST-TOKEN',
            telegram_chat_id: '-100999',
            telegram_notifications_enabled: 'true',
            some_future_private_key: 'private'
        });
        const res = mockRes();
        await adminController.getPublicStoreSettings({}, res);

        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.body.store_name, 'store_name must stay public');
        for (const secret of ['telegram_bot_token', 'telegram_chat_id', 'telegram_notifications_enabled', 'some_future_private_key']) {
            assert.ok(!(secret in res.body), `${secret} must not be public`);
        }
        // Only allow-listed keys may ever be returned
        for (const key of Object.keys(res.body)) {
            // demo_mode is a runtime flag (derived from the DEMO_MODE env var, not from the settings table)
            assert.ok(adminController.PUBLIC_SETTING_KEYS.includes(key) || key === 'demo_mode', `unexpected public key: ${key}`);
        }

        await db.updateStoreSettings({ telegram_bot_token: '', telegram_chat_id: '', telegram_notifications_enabled: 'false', some_future_private_key: '' });
    });

    test('admin settings endpoint still returns everything', async () => {
        await db.updateStoreSettings({ telegram_chat_id: '-100999' });
        const res = mockRes();
        await adminController.getStoreSettings({}, res);
        assert.strictEqual(res.body.telegram_chat_id, '-100999');
        await db.updateStoreSettings({ telegram_chat_id: '' });
    });

    test('CCP details are saved (digits normalised) and become public', async () => {
        const res = mockRes();
        await adminController.updateStoreSettings({
            body: { ccp_account_number: '0012 3456 78', ccp_account_key: '12', ccp_rip: '00799999 0012345678 90', ccp_account_holder: '  Ahmed Store  ', enable_ccp: 'true' }
        }, res);
        assert.strictEqual(res.statusCode, 200);

        const pub = mockRes();
        await adminController.getPublicStoreSettings({}, pub);
        assert.strictEqual(pub.body.ccp_account_number, '0012345678');
        assert.strictEqual(pub.body.ccp_account_key, '12');
        assert.strictEqual(pub.body.ccp_rip, '007999990012345678' + '90');
        assert.strictEqual(pub.body.ccp_account_holder, 'Ahmed Store');
        assert.strictEqual(pub.body.enable_ccp, 'true');
    });

    test('invalid CCP values are rejected with 400', async () => {
        for (const bad of [
            { ccp_account_number: '12ab34' },
            { ccp_account_key: '123456' },
            { ccp_rip: '<script>alert(1)</script>' },
            { ccp_account_number: '1'.repeat(21) }
        ]) {
            const res = mockRes();
            await adminController.updateStoreSettings({ body: bad }, res);
            assert.strictEqual(res.statusCode, 400, JSON.stringify(bad));
            assert.strictEqual(res.body.code, 'INVALID_CCP_FIELD');
        }
    });
});
