const { describe } = require('node:test');

describe('Remediation Suite', () => {
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const db = require('../src/data/db-connection');
const { issueSession, createAccessToken } = require('../src/utils/tokenUtils');
const storeConfig = require('../src/config/storeConfig');

let server;
let baseUrl;
let userAToken;
let userBToken;
let adminToken;
let userAId;
let userBId;
let adminId;
let baselineOrders = [];

test.before(async () => {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    await db.initializeDatabase();
    if (db.pool && typeof db.pool.query === 'function') {
        const [rows] = await db.pool.query('SELECT id FROM orders');
        baselineOrders = rows.map(r => r.id);
    }

    // Setup User A
    const userA = await db.findUserByEmail('user@example.com') || { id: 1, email: 'user@example.com', role: 'customer' };
    userAId = userA.id;
    const sessionA = await issueSession(userA, { headers: {}, ip: '127.0.0.1' });
    userAToken = createAccessToken(userA, sessionA);

    // Setup User B
    let userB = await db.findUserByEmail('user_b@example.com');
    if (!userB) {
        const created = await db.createUser({
            username: 'مستخدم ب',
            email: 'user_b@example.com',
            phone: '0559998877',
            password: 'password123',
            role: 'customer'
        });
        userB = (created && typeof created === 'object') ? created : await db.findUserByEmail('user_b@example.com');
        userBId = userB.id;
    } else {
        userBId = userB.id;
    }
    const sessionB = await issueSession(userB, { headers: {}, ip: '127.0.0.1' });
    userBToken = createAccessToken(userB, sessionB);

    // Setup Admin
    const adminUser = await db.findUserByEmail('admin@example.com') || { id: 2, email: 'admin@example.com', role: 'admin' };
    adminId = adminUser.id;
    const sessionAdmin = await issueSession(adminUser, { headers: {}, ip: '127.0.0.1' });
    adminToken = createAccessToken(adminUser, sessionAdmin);

    // Replenish stock for tests
    await ensureStock();
});

async function ensureStock() {
    if (db.pool && typeof db.pool.query === 'function') {
        const [cats] = await db.pool.query('SELECT id FROM categories WHERE id = 1');
        if (cats.length === 0) {
            await db.pool.query('INSERT IGNORE INTO categories (id, name, slug) VALUES (1, "Test Category", "test-cat")');
        }
        const [prods] = await db.pool.query('SELECT id FROM products WHERE id = 1');
        if (prods.length === 0) {
            await db.pool.query('INSERT IGNORE INTO products (id, category_id, name, price, stock, status) VALUES (1, 1, "Test Product", 125000, 100, "active")');
        } else {
            await db.pool.query('UPDATE products SET stock = 100 WHERE id > 0');
        }
    }
}

test.beforeEach(async () => {
    await ensureStock();
});

test.after(async () => {
    try {
        if (db && db.pool && typeof db.pool.query === 'function') {
            if (baselineOrders.length > 0) {
                const [newOrders] = await db.pool.query('SELECT id FROM orders WHERE id NOT IN (?)', [baselineOrders]);
                const ids = newOrders.map(o => o.id);
                if (ids.length > 0) {
                    await db.pool.query('DELETE FROM order_items WHERE order_id IN (?)', [ids]);
                    await db.pool.query('DELETE FROM orders WHERE id IN (?)', [ids]);
                }
            } else {
                const [allOrders] = await db.pool.query('SELECT id FROM orders');
                const ids = allOrders.map(o => o.id);
                if (ids.length > 0) {
                    await db.pool.query('DELETE FROM order_items WHERE order_id IN (?)', [ids]);
                    await db.pool.query('DELETE FROM orders WHERE id IN (?)', [ids]);
                }
            }
        }
    } catch (e) {}

    if (server) {
        if (server.closeAllConnections) server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
    // Force exit after 2 seconds if dangling sockets (like fetch keep-alive) keep the process open.
    // Unref ensures this timer itself doesn't keep the process open if it can exit cleanly.
    setTimeout(() => {
        process.exit(0);
    }, 2000).unref();
});

// ==========================================
// PHASE 1 — CART SECURITY & ISOLATION TESTS
// ==========================================
test('Phase 1: Unauthenticated guest cannot add or view database cart directly without auth', async () => {
    // Adding without auth
    const addRes = await fetch(`${baseUrl}/api/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 1, quantity: 1 })
    });
    assert.strictEqual(addRes.status, 401, 'Unauthenticated add to cart must return 401');

    // Getting cart without auth
    const getRes = await fetch(`${baseUrl}/api/cart`);
    assert.strictEqual(getRes.status, 401, 'Unauthenticated get cart must return 401');
});

test('Phase 1: User A cannot inspect or modify User B cart (IDOR Protection)', async () => {
    // User A trying to view User B's cart
    const viewRes = await fetch(`${baseUrl}/api/cart/${userBId}`, {
        headers: { 'Authorization': `Bearer ${userAToken}` }
    });
    assert.strictEqual(viewRes.status, 403, 'User A viewing User B cart must return 403 Forbidden');

    // User A adding item to own cart
    const addRes = await fetch(`${baseUrl}/api/cart/add`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({ productId: 1, quantity: 2 })
    });
    assert.strictEqual(addRes.status, 201, 'User A should be able to add to their own cart');
    const addData = await addRes.json();

    // User B trying to modify User A's cart item
    const modifyRes = await fetch(`${baseUrl}/api/cart/${addData.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userBToken}`
        },
        body: JSON.stringify({ quantity: 5 })
    });
    assert.strictEqual(modifyRes.status, 403, 'User B modifying User A cart item must return 403');

    // User B trying to delete User A's cart item
    const deleteRes = await fetch(`${baseUrl}/api/cart/${addData.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${userBToken}` }
    });
    assert.strictEqual(deleteRes.status, 403, 'User B deleting User A cart item must return 403');
});

// ==========================================
// PHASE 2 — ORDER AUTHORIZATION & IDOR TESTS
// ==========================================
test('Phase 2: Order Authorization - Prevent unauthorized cross-user order access', async () => {
    // Create an order for User A
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({
            userId: userAId,
            shippingInfo: { fullName: 'المستخدم أ', phone: '0550000000', wilayaId: 16 },
            cart: [{ id: 1, quantity: 1 }]
        })
    });
    assert.strictEqual(orderRes.status, 201);
    const orderData = await orderRes.json();
    const orderAId = orderData.id;

    // 1. User B trying to access User A's order by ID alone
    const userBAccess = await fetch(`${baseUrl}/api/orders/${orderAId}`, {
        headers: { 'Authorization': `Bearer ${userBToken}` }
    });
    assert.strictEqual(userBAccess.status, 403, 'User B accessing User A order must return 403');

    // 2. User B trying to access User A's order items
    const userBItemsAccess = await fetch(`${baseUrl}/api/order-items/${orderAId}`, {
        headers: { 'Authorization': `Bearer ${userBToken}` }
    });
    assert.strictEqual(userBItemsAccess.status, 403, 'User B accessing User A order items must return 403');

    // 3. Guest trying to access User A's order without auth or token
    const guestAccess = await fetch(`${baseUrl}/api/orders/${orderAId}`);
    assert.strictEqual(guestAccess.status, 403, 'Guest accessing user order by ID alone must return 403');

    // 4. Admin accessing User A's order (should succeed)
    const adminAccess = await fetch(`${baseUrl}/api/orders/${orderAId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminAccess.status, 200, 'Admin should be able to view customer order');
});

test('Phase 2: Guest Order Authorization - Requires valid tracking token or phone', async () => {
    const guestOrderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shippingInfo: { fullName: 'ضيف مؤقت', phone: '0551239999', wilayaId: 31 },
            cart: [{ id: 1, quantity: 1 }]
        })
    });
    const guestOrderData = await guestOrderRes.json();
    const guestOrderId = guestOrderData.id;
    const trackingToken = guestOrderData.trackingToken;

    // 1. Accessing guest order without token or phone must fail
    const unauthFetch = await fetch(`${baseUrl}/api/orders/${guestOrderId}`);
    assert.strictEqual(unauthFetch.status, 403, 'Guest order access without token must return 403');

    // 2. Accessing with invalid token must fail
    const invalidTokenFetch = await fetch(`${baseUrl}/api/orders/${guestOrderId}?token=wrong_token_123`);
    assert.strictEqual(invalidTokenFetch.status, 403, 'Guest order access with invalid token must return 403');

    // 3. Accessing with correct tracking token must succeed
    const validTokenFetch = await fetch(`${baseUrl}/api/orders/${guestOrderId}?token=${trackingToken}`);
    assert.strictEqual(validTokenFetch.status, 200, 'Guest order access with valid token must return 200');

    // 4. Accessing with correct phone must now fail (requires tracking token)
    const validPhoneFetch = await fetch(`${baseUrl}/api/orders/${guestOrderId}?phone=0551239999`);
    assert.strictEqual(validPhoneFetch.status, 403, 'Guest order access with correct phone must return 403');
    
    // 5. Track order limits fields when using phone without token
    const url = `${baseUrl}/api/orders/status?orderId=${guestOrderId}&phone=0551239999`;
    const trackRes = await fetch(url);
    const trackData = await trackRes.json();
    assert.strictEqual(trackRes.status, 200, 'Should allow tracking with phone');
    assert.ok(!trackData.order.shipping_full_name, 'Should not return shipping_full_name');
    assert.ok(!trackData.order.phone, 'Should not return phone');
});

// ==========================================
// PHASE 3 — SERVER-SIDE PRICE CALCULATION
// ==========================================
test('Phase 3: Server-side Price Calculation - Tampered client prices & totals are ignored', async () => {
    const prod = await db.getProductById(1);
    const realDbPrice = Number(prod.price);
    assert.ok(realDbPrice > 1000, 'Product price in DB is genuine high value');

    // Client attempts to pay 1 DZD for a product that costs realDbPrice
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            total: 1, // Tampered client grand total
            paymentMethod: 'cod',
            shippingInfo: {
                fullName: 'عميل تلاعب الأسعار',
                phone: '0555001122',
                wilayaId: 16, // Alger home delivery is 400 DZD
                deliveryType: 'home',
                shippingCost: 0 // Tampered shipping cost
            },
            cart: [{
                id: 1,
                name: 'حاسوب بسعر مزور',
                price: 1, // Tampered item unit price
                quantity: 2
            }]
        })
    });
    assert.strictEqual(orderRes.status, 201);
    const orderData = await orderRes.json();

    // Fetch created order from DB
    const createdOrder = await db.getOrderById(orderData.id);
    const items = await db.getOrderItems(orderData.id);

    // Expected: (realDbPrice * 2) + 400 shipping
    const expectedItemSubtotal = realDbPrice * 2;
    const expectedGrandTotal = expectedItemSubtotal + 400;

    assert.strictEqual(Number(items[0].price), realDbPrice, 'Order item unit price must match DB price');
    assert.strictEqual(Number(createdOrder.total), expectedGrandTotal, 'Grand total must be calculated server-side');
});

// ==========================================
// PHASE 4 — QUANTITY VALIDATION
// ==========================================
test('Phase 4: Quantity Validation - Reject invalid quantities (negative, zero, NaN, floats, excessive)', async () => {
    const invalidQuantities = [-5, 0, 'abc', 1.5, 99999999, Infinity, -Infinity];

    for (const invalidQty of invalidQuantities) {
        const res = await fetch(`${baseUrl}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shippingInfo: { fullName: 'اختبار الكمية', phone: '0550000000', wilayaId: 16 },
                cart: [{ id: 1, quantity: invalidQty }]
            })
        });
        assert.strictEqual(res.status, 400, `Quantity "${invalidQty}" must be rejected with 400 Bad Request`);
    }
});

// ==========================================
// PHASE 6 — PAYMENT STATUS SECURITY
// ==========================================
test('Phase 6: Client cannot force paymentStatus = paid on order creation', async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            paymentStatus: 'paid', // Client trying to mark unpaid order as paid
            shippingInfo: { fullName: 'محاولة احتيال دفع', phone: '0550000000', wilayaId: 16 },
            cart: [{ id: 1, quantity: 1 }]
        })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();

    const order = await db.getOrderById(data.id);
    assert.strictEqual(order.payment_status, 'pending', 'Order payment status MUST remain pending on creation');
});

// ==========================================
// PHASE 7 & 8 — CHARGILY CHECKOUT & WEBHOOK
// ==========================================
test('Phase 7: Chargily Checkout Authorization - Unauthorized user cannot create checkout session', async () => {
    // Create order for User A
    const orderA = await db.createOrder({
        userId: userAId,
        shippingInfo: { fullName: 'المستخدم أ', phone: '0550000000', wilayaId: 16 },
        cart: [{ id: 1, quantity: 1 }]
    });

    // User B attempts to trigger checkout for User A's order
    const checkoutRes = await fetch(`${baseUrl}/api/payments/chargily/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userBToken}`
        },
        body: JSON.stringify({ orderId: orderA.id })
    });
    assert.strictEqual(checkoutRes.status, 403, 'Unauthorized checkout creation must return 403 Forbidden');
});

test('Phase 8: Chargily Webhook Signature Verification and Idempotency', async () => {
    await ensureStock();
    const order = await db.createOrder({
        userId: null,
        shippingInfo: { fullName: 'عميل ويبهوك', phone: '0550000000', wilayaId: 16 },
        cart: [{ id: 1, quantity: 1 }]
    });

    const webhookSecret = storeConfig.chargily.secretKey || 'test_secret_key';
    storeConfig.chargily.secretKey = webhookSecret;

    const payload = JSON.stringify({
        type: 'checkout.paid',
        data: {
            id: 'chk_12345',
            amount: Math.round(Number(order.total)),
            metadata: { order_id: String(order.id) }
        }
    });

    const validSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

    // 1. Invalid signature must return 403
    const badSigRes = await fetch(`${baseUrl}/api/payments/chargily/webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'signature': 'invalid_signature_hex'
        },
        body: payload
    });
    assert.strictEqual(badSigRes.status, 403, 'Invalid signature webhook must be rejected with 403');

    // 2. Valid signature must succeed
    const validSigRes = await fetch(`${baseUrl}/api/payments/chargily/webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'signature': validSignature
        },
        body: payload
    });
    assert.strictEqual(validSigRes.status, 200, 'Valid signature webhook must succeed with 200');

    // Verify order status updated to paid
    const updatedOrder = await db.getOrderById(order.id);
    assert.strictEqual(updatedOrder.payment_status, 'paid');
    assert.strictEqual(updatedOrder.status, 'processing');

    // 3. Duplicate Webhook must be idempotent (no error, acknowledged)
    const duplicateRes = await fetch(`${baseUrl}/api/payments/chargily/webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'signature': validSignature
        },
        body: payload
    });
    assert.strictEqual(duplicateRes.status, 200, 'Duplicate webhook must succeed idempotently');
});

// ==========================================
// MANDATORY SECOND-PASS REGRESSION TESTS (A - E)
// ==========================================
test('Test A: Create guest order, then GET /api/orders/{guestOrderId} without token or phone -> 403', async () => {
    await ensureStock();
    const guestOrderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shippingInfo: { fullName: 'اختبار أ', phone: '0551113344', wilayaId: 16 },
            cart: [{ id: 1, quantity: 1 }]
        })
    });
    assert.strictEqual(guestOrderRes.status, 201);
    const guestData = await guestOrderRes.json();
    const guestOrderId = guestData.id;

    // Fetching without token or phone must fail with 403
    const unauthorizedFetch = await fetch(`${baseUrl}/api/orders/${guestOrderId}`);
    assert.strictEqual(unauthorizedFetch.status, 403, 'Guest order access without credentials must return 403');
});

test('Test B: Create guest order, then GET /api/order-items/{guestOrderId} without token/phone -> 403', async () => {
    await ensureStock();
    const guestOrderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shippingInfo: { fullName: 'اختبار ب', phone: '0552224455', wilayaId: 16 },
            cart: [{ id: 1, quantity: 1 }]
        })
    });
    assert.strictEqual(guestOrderRes.status, 201);
    const guestData = await guestOrderRes.json();
    const guestOrderId = guestData.id;

    // Fetching order items without token or phone must fail with 403
    const unauthorizedItemsFetch = await fetch(`${baseUrl}/api/order-items/${guestOrderId}`);
    assert.strictEqual(unauthorizedItemsFetch.status, 403, 'Guest order items access without credentials must return 403');
});

test('Test C: Create User A order, User B requests GET /api/order-items/{userAOrderId} -> 403', async () => {
    await ensureStock();
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({
            userId: userAId,
            shippingInfo: { fullName: 'المستخدم أ', phone: '0550000000', wilayaId: 16 },
            cart: [{ id: 1, quantity: 1 }]
        })
    });
    assert.strictEqual(orderRes.status, 201);
    const orderData = await orderRes.json();
    const userAOrderId = orderData.id;

    // User B attempts to access User A's order items
    const userBItemsRes = await fetch(`${baseUrl}/api/order-items/${userAOrderId}`, {
        headers: { 'Authorization': `Bearer ${userBToken}` }
    });
    assert.strictEqual(userBItemsRes.status, 403, 'User B accessing User A order items must return 403');
});

test('Test D: Authenticated User A requests GET /api/order-items/{userAOrderId} -> 200', async () => {
    await ensureStock();
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({
            userId: userAId,
            shippingInfo: { fullName: 'المستخدم أ', phone: '0550000000', wilayaId: 16 },
            cart: [{ id: 1, quantity: 1 }]
        })
    });
    assert.strictEqual(orderRes.status, 201);
    const orderData = await orderRes.json();
    const userAOrderId = orderData.id;

    // Authenticated User A accesses their own order items
    const userAItemsRes = await fetch(`${baseUrl}/api/order-items/${userAOrderId}`, {
        headers: { 'Authorization': `Bearer ${userAToken}` }
    });
    assert.strictEqual(userAItemsRes.status, 200, 'Authenticated User A accessing own order items must return 200');
    const items = await userAItemsRes.json();
    assert.ok(Array.isArray(items) && items.length > 0);
});

test('Test E: Remove all Cart fallback behavior. Confirm no request can resolve to userId = 1', async () => {
    // 1. Unauthenticated request to /api/cart/add with or without { userId: 1 } must fail with 401
    const unauthAdd = await fetch(`${baseUrl}/api/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1, productId: 1, quantity: 1 })
    });
    assert.strictEqual(unauthAdd.status, 401, 'Unauthenticated add to cart must return 401');

    // 2. Unauthenticated request to /api/cart/1 must fail with 401
    const unauthGet = await fetch(`${baseUrl}/api/cart/1`);
    assert.strictEqual(unauthGet.status, 401, 'Unauthenticated get cart must return 401');

    // 3. Authenticated User B requesting /api/cart/1 must be rejected with 403 Forbidden
    const crossUserGet = await fetch(`${baseUrl}/api/cart/1`, {
        headers: { 'Authorization': `Bearer ${userBToken}` }
    });
    assert.strictEqual(crossUserGet.status, 403, 'User B requesting cart for user 1 must return 403');
});

test('Phase 11: Non-existent API route returns 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/non_existent_endpoint_123`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.message, 'المسار غير موجود');
});

test('Phase 2 — Commercial Readiness: Admin Customers Management', async () => {
    // 1. Unauthenticated /api/admin/users must return 401
    const unauthRes = await fetch(`${baseUrl}/api/admin/users`);
    assert.strictEqual(unauthRes.status, 401);

    // 2. Non-admin user /api/admin/users must return 403
    const forbiddenRes = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${userAToken}` }
    });
    assert.strictEqual(forbiddenRes.status, 403);

    // 3. Admin user /api/admin/users must return 200 with list of users
    const adminRes = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminRes.status, 200);
    const data = await adminRes.json();
    assert.ok(Array.isArray(data.users), 'Expected users array');
    assert.ok(data.users.length > 0);
    // Verify no password hash is exposed
    assert.strictEqual(data.users[0].password, undefined);

    // 4. Admin fetch user by ID
    const userDetailRes = await fetch(`${baseUrl}/api/admin/users/${userAId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(userDetailRes.status, 200);
    const userDetail = await userDetailRes.json();
    assert.strictEqual(userDetail.password, undefined);
    assert.ok(Array.isArray(userDetail.addresses));
});

test('Phase 2 — Commercial Readiness: Coupons Management & Public Validation', async () => {
    const testCode = 'SUMMERTEST' + Math.floor(Math.random() * 10000);

    // 1. Admin creates coupon
    const createRes = await fetch(`${baseUrl}/api/admin/coupons`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            code: testCode,
            discountPercent: 15,
            minOrderAmount: 1000,
            maxUses: 50,
            status: 'active'
        })
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    const couponId = created.id;

    // 2. Validate coupon with valid amount
    const valRes = await fetch(`${baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: testCode, orderAmount: 2000 })
    });
    assert.strictEqual(valRes.status, 200);
    const valData = await valRes.json();
    assert.strictEqual(valData.valid, true);
    assert.strictEqual(valData.calculatedDiscount, 300);

    // 3. Validate coupon below min order amount
    const minOrderRes = await fetch(`${baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: testCode, orderAmount: 500 })
    });
    assert.strictEqual(minOrderRes.status, 400);

    // 4. Admin toggles coupon status to inactive
    const toggleRes = await fetch(`${baseUrl}/api/admin/coupons/${couponId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'inactive' })
    });
    assert.strictEqual(toggleRes.status, 200);

    // 5. Inactive coupon should fail validation
    const inactiveVal = await fetch(`${baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: testCode, orderAmount: 2000 })
    });
    assert.strictEqual(inactiveVal.status, 400);
});

test('Phase 2 — Commercial Readiness: Product Reviews Management & Moderation', async () => {
    // 1. Unauthenticated add review returns 401
    const unauthRev = await fetch(`${baseUrl}/api/products/1/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, comment: 'Great product' })
    });
    assert.strictEqual(unauthRev.status, 401);

    // 2. Authenticated user adds review
    const authRev = await fetch(`${baseUrl}/api/products/1/reviews`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({ rating: 5, comment: 'تقييم ممتاز للمنتج رقم 1' })
    });
    assert.strictEqual(authRev.status, 201);
    const revData = await authRev.json();
    const reviewId = revData.id;

    // 3. Public get approved reviews for product 1
    const publicRevRes = await fetch(`${baseUrl}/api/products/1/reviews`);
    assert.strictEqual(publicRevRes.status, 200);
    const pubReviews = await publicRevRes.json();
    assert.ok(Array.isArray(pubReviews));

    // 4. Admin reviews list
    const adminRevRes = await fetch(`${baseUrl}/api/admin/reviews`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminRevRes.status, 200);
    const adminRevData = await adminRevRes.json();
    assert.ok(Array.isArray(adminRevData.reviews));

    // 5. Admin updates review status to rejected
    const rejectRes = await fetch(`${baseUrl}/api/admin/reviews/${reviewId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'rejected' })
    });
    assert.strictEqual(rejectRes.status, 200);
});

test('Phase 2 — Commercial Readiness: Chargily Checkout Authorization Protection', async () => {
    await ensureStock();

    // 1. User A creates an order
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userAToken}`
        },
        body: JSON.stringify({
            userId: userAId,
            shippingInfo: { fullName: 'المستخدم أ', phone: '0550000000', wilayaId: 16 },
            cart: [{ id: 1, quantity: 1 }]
        })
    });
    assert.strictEqual(orderRes.status, 201);
    const orderData = await orderRes.json();
    const userAOrderId = orderData.id;

    // 2. User B attempting to pay for User A's order must be rejected with 403
    const crossPayRes = await fetch(`${baseUrl}/api/payments/chargily/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userBToken}`
        },
        body: JSON.stringify({ orderId: userAOrderId })
    });
    assert.strictEqual(crossPayRes.status, 403, 'Cross-user payment attempt must be rejected with 403');
});

// =========================================================================
// SECURITY AUDIT: PAYMENT WEBHOOK AMOUNT VERIFICATION & FILE UPLOAD HARDENING
// =========================================================================

test('Security Audit: Chargily Webhook Amount Mismatch Rejection', async () => {
    await ensureStock();
    const order = await db.createOrder({
        userId: null,
        shippingInfo: { fullName: 'عميل تدقيق المبلغ', phone: '0551112233', wilayaId: 16 },
        cart: [{ id: 1, quantity: 1 }]
    });

    const webhookSecret = storeConfig.chargily.secretKey || 'test_secret_key';
    storeConfig.chargily.secretKey = webhookSecret;

    // 1. Webhook with mismatched amount (e.g. 100 DZD instead of true total)
    const mismatchedPayload = JSON.stringify({
        type: 'checkout.paid',
        data: {
            id: 'chk_fraud_test',
            amount: 100, // Forged lower amount!
            metadata: { order_id: String(order.id) }
        }
    });

    const mismatchedSig = crypto.createHmac('sha256', webhookSecret).update(mismatchedPayload).digest('hex');

    const mismatchRes = await fetch(`${baseUrl}/api/payments/chargily/webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'signature': mismatchedSig
        },
        body: mismatchedPayload
    });

    assert.strictEqual(mismatchRes.status, 400, 'Webhook with mismatched payment amount must be rejected with 400');
    const errBody = await mismatchRes.json();
    assert.strictEqual(errBody.error, 'المبلغ المدفوع لا يطابق قيمة الطلب');

    // Verify order payment_status remains 'pending'
    const orderAfterMismatch = await db.getOrderById(order.id);
    assert.strictEqual(orderAfterMismatch.payment_status, 'pending');
    assert.notStrictEqual(orderAfterMismatch.status, 'processing');
});

test('Security Audit: Product Image Upload Hardening (Extension Whitelist & Magic Bytes)', async () => {
    // 1. Upload attempt with forbidden extension (.php) disguised as image/jpeg
    const formPhp = new FormData();
    formPhp.append('name', 'منتج اختبار أمني PHP');
    formPhp.append('category', 'إلكترونيات');
    formPhp.append('price', '2500');
    formPhp.append('stock', '5');
    formPhp.append('image', new Blob(['<?php echo "malicious code"; ?>'], { type: 'image/jpeg' }), 'evil.php');

    const phpRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formPhp
    });
    assert.strictEqual(phpRes.status, 400, 'Uploading .php file must be rejected with 400');

    // 2. Upload attempt with allowed extension (.jpg) but forged / invalid magic bytes
    const formForged = new FormData();
    formForged.append('name', 'منتج اختبار أمني تزوير');
    formForged.append('category', 'إلكترونيات');
    formForged.append('price', '2500');
    formForged.append('stock', '5');
    formForged.append('image', new Blob(['Plain text disguised as JPEG file without magic bytes'], { type: 'image/jpeg' }), 'fake.jpg');

    const forgedRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formForged
    });
    assert.strictEqual(forgedRes.status, 400, 'Uploading file with invalid magic bytes must be rejected with 400');

    // 2b. Valid PNG signature but corrupt body: sharp cannot decode it -> must be rejected (400), never published raw
    const corruptPng = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('this is not a real png body at all'.repeat(3))]);
    const formCorrupt = new FormData();
    formCorrupt.append('name', 'corrupt image product');
    formCorrupt.append('category', 'إلكترونيات');
    formCorrupt.append('price', '1000');
    formCorrupt.append('stock', '1');
    formCorrupt.append('image', new Blob([corruptPng], { type: 'image/png' }), 'corrupt.png');
    const corruptRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formCorrupt
    });
    assert.strictEqual(corruptRes.status, 400, 'An undecodable image must be rejected with 400');

    // 3. Upload attempt with valid PNG image and correct magic bytes
    const validPngBuffer = Buffer.from('89504e470d0a1a0a0000000d494844520000000200000002080600000072b60d240000000970485973000003e8000003e801b57b526b0000001149444154089963382127f71f8419600c004734080d78251dcc0000000049454e44ae426082', 'hex');
    const formValid = new FormData();
    formValid.append('name', 'منتج اختبار أمني صالح');
    formValid.append('category', 'إلكترونيات');
    formValid.append('price', '3500');
    formValid.append('stock', '15');
    formValid.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'valid-image.png');

    const validRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formValid
    });
    assert.strictEqual(validRes.status, 201, 'Uploading valid PNG image must succeed with 201');
    const validData = await validRes.json();
    assert.ok(validData.product.image_url.startsWith('/images/'));

    // Cleanup created test product and uploaded test image
    if (validData.product && validData.product.id) {
        await db.deleteProduct(validData.product.id).catch(() => {});
        const relPath = String(validData.product.image_url).replace(/^\/+/, '');
        const uploadedFilePath = path.resolve(__dirname, '..', relPath);
        if (fs.existsSync(uploadedFilePath)) {
            try { fs.unlinkSync(uploadedFilePath); } catch (e) {}
        }
    }
});

test('Security Audit: Exclusive httpOnly Cookie Authentication (No Token in JSON Body)', async () => {
    // 1. Log in via POST /api/login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
    });

    assert.strictEqual(loginRes.status, 200, 'Login must succeed with 200');
    const loginBody = await loginRes.json();

    // 2. Assert token is NOT present in response JSON body
    assert.strictEqual(loginBody.token, undefined, 'Access token must NOT be returned in response JSON body (XSS protection)');
    assert.ok(loginBody.user, 'User object should be returned');
    assert.strictEqual(loginBody.user.email, 'user@example.com');

    // 3. Assert access_token and refresh_token are set as httpOnly cookies
    const setCookieHeaders = loginRes.headers.get('set-cookie') || '';
    assert.ok(setCookieHeaders.includes('access_token='), 'access_token cookie must be set');
    assert.ok(setCookieHeaders.includes('HttpOnly'), 'access_token cookie must be HttpOnly');

    // Extract access_token cookie
    const match = setCookieHeaders.match(/access_token=([^;]+)/);
    assert.ok(match, 'access_token cookie must match regex');
    const accessTokenCookie = match[1];

    // 4. Test authenticated request using cookie alone (no Authorization header)
    const profileRes = await fetch(`${baseUrl}/api/user/profile`, {
        headers: {
            'Cookie': `access_token=${accessTokenCookie}`
        }
    });
    assert.strictEqual(profileRes.status, 200, 'Profile request with httpOnly cookie alone must succeed with 200');
    const profileData = await profileRes.json();
    assert.strictEqual(profileData.email, 'user@example.com');
});

test('Backend Audit: Long Product Description Preservation (> 500 chars)', async () => {
    const longDesc = 'هذا وصف تفصيلي طويل جداً للمنتج للتأكد من عدم اقتطاعه أو حذفه بالخطأ عند التعقيم البرمجي. '.repeat(10);
    assert.ok(longDesc.length > 500);

    const createRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            name: 'منتج تجريبي بوصف طويل جداً',
            category: 'إلكترونيات',
            price: 5000,
            stock: 20,
            description: longDesc
        })
    });

    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    assert.strictEqual(created.product.description.length, longDesc.trim().length);

    // Fetch by ID to confirm persistence
    const fetchRes = await fetch(`${baseUrl}/api/products/${created.id}`);
    assert.strictEqual(fetchRes.status, 200);
    const fetched = await fetchRes.json();
    assert.strictEqual(fetched.description.length, longDesc.trim().length);

    // Cleanup
    await db.deleteProduct(created.id).catch(() => {});
});

test('Backend Audit: Server-Side Coupon Discount Calculation & Usage Increment in createOrder', async () => {
    const couponCode = 'DISCOUNT' + Math.floor(Math.random() * 10000);

    // 1. Create a 20% discount coupon
    await db.createCoupon({
        code: couponCode,
        discountPercent: 20,
        minOrderAmount: 1000,
        maxUses: 10,
        status: 'active'
    });

    // 2. Create product for testing
    const prodId = await db.createProduct({
        name: 'منتج اختبار الكوبون',
        category: 'إلكترونيات',
        price: 10000,
        stock: 50,
        status: 'active'
    });

    // 3. Create order with coupon applied
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cart: [{ id: prodId, quantity: 1 }],
            couponCode: couponCode,
            shippingInfo: {
                fullName: 'عميل اختبار الكوبون',
                phone: '0555123456',
                wilayaId: 16,
                wilayaName: 'الجزائر',
                deliveryType: 'home'
            }
        })
    });

    assert.strictEqual(orderRes.status, 201);
    const orderData = await orderRes.json();

    // 10,000 DZD item price - 20% coupon (2,000 DZD) + 400 DZD Wilaya 16 home shipping = 8,400 DZD total
    assert.strictEqual(orderData.total, 8400, 'Grand total must accurately reflect the 20% server-computed coupon discount and wilaya 16 shipping');

    // 4. Verify coupon uses_count incremented
    const updatedCoupon = await db.getCouponByCode(couponCode);
    assert.strictEqual(updatedCoupon.uses_count, 1, 'Coupon uses_count must be incremented by 1');

    // Cleanup
    if (orderData && orderData.id) {
        await db.deleteOrder(orderData.id).catch(() => {});
    }
    await db.deleteProduct(prodId).catch(() => {});
    if (couponCode) {
        await db.pool.query('DELETE FROM coupons WHERE code = ?', [couponCode]).catch(() => {});
    }
});

test('Backend Audit: Stock Restoration upon Order Cancellation', async () => {
    // 1. Create product with 10 stock
    const prodId = await db.createProduct({
        name: 'منتج اختبار استرجاع المخزون',
        category: 'إلكترونيات',
        price: 4000,
        stock: 10,
        status: 'active'
    });

    // 2. Create order buying 4 items
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cart: [{ id: prodId, quantity: 4 }],
            shippingInfo: {
                fullName: 'مشتري الاختبار',
                phone: '0666778899',
                city: 'الجزائر'
            }
        })
    });
    assert.strictEqual(orderRes.status, 201);
    const orderData = await orderRes.json();

    // Stock should now be 10 - 4 = 6
    let prod = await db.getProductById(prodId);
    assert.strictEqual(Number(prod.stock), 6);

    // 3. Admin cancels order
    const cancelRes = await fetch(`${baseUrl}/api/orders/${orderData.id}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'cancelled' })
    });
    assert.strictEqual(cancelRes.status, 200);

    // Stock should be restored back to 6 + 4 = 10
    prod = await db.getProductById(prodId);
    assert.strictEqual(Number(prod.stock), 10, 'Product stock must be restored to 10 when order is cancelled');

    // Cleanup
    if (orderData && orderData.id) {
        await db.deleteOrder(orderData.id).catch(() => {});
    }
    await db.deleteProduct(prodId).catch(() => {});
});

test('Backend Audit: Automatic Product Rating Recalculation on Review Submission', async () => {
    // 1. Create product
    const prodId = await db.createProduct({
        name: 'منتج اختبار التقييم التلقائي',
        category: 'إلكترونيات',
        price: 3000,
        stock: 15,
        rating: 5,
        reviews_count: 0,
        status: 'active'
    });

    // 2. Login to get token for user
    const loginRes = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
    });
    const setCookieHeaders = loginRes.headers.get('set-cookie') || '';
    const match = setCookieHeaders.match(/access_token=([^;]+)/);
    const userCookie = match ? match[1] : '';

    // 3. Submit a 4-star review
    const reviewRes = await fetch(`${baseUrl}/api/products/${prodId}/reviews`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `access_token=${userCookie}`
        },
        body: JSON.stringify({
            rating: 4,
            comment: 'منتج جيد يستحق 4 نجوم'
        })
    });
    assert.strictEqual(reviewRes.status, 201);

    // 4. Verify product rating is automatically updated to 4.0
    const prod = await db.getProductById(prodId);
    assert.strictEqual(Math.round(Number(prod.rating)), 4, 'Product rating must be recalculated to 4');

    // Cleanup
    await db.deleteProduct(prodId).catch(() => {});
});

test('Phase 1 — Commercial Readiness: 1-Click COD Direct Checkout from Product Page', async () => {
    // 1. Create product for testing express checkout
    const prodId = await db.createProduct({
        name: 'منتج اختبار الشراء المباشر',
        category: 'إلكترونيات',
        price: 4500,
        stock: 25,
        status: 'active'
    });

    // 2. Submit express direct COD order
    const expressOrderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cart: [{
                id: prodId,
                name: 'منتج اختبار الشراء المباشر',
                price: 4500,
                quantity: 2,
                image_url: '/images/product-placeholder.jpg'
            }],
            paymentMethod: 'cod',
            shippingInfo: {
                fullName: 'كريم بلحاج',
                phone: '0770123456',
                address: 'شارع ديدوش مراد',
                city: 'الجزائر الوسطى',
                wilayaId: 16,
                wilayaName: 'الجزائر',
                deliveryType: 'home',
                shippingCost: 400
            }
        })
    });

    assert.strictEqual(expressOrderRes.status, 201, 'Express checkout order must be created with 201');
    const orderData = await expressOrderRes.json();
    assert.ok(orderData.id, 'Order ID must be returned');
    assert.ok(orderData.orderNumber, 'Order Number must be generated');
    assert.ok(orderData.trackingToken, 'Tracking Token must be generated');

    // (4500 * 2) + 400 = 9400 DZD
    assert.strictEqual(orderData.total, 9400, 'Calculated total must be (4500 * 2) + 400 = 9400 DZD');

    // Verify stock decreased by 2 (25 - 2 = 23)
    const prodAfter = await db.getProductById(prodId);
    assert.strictEqual(Number(prodAfter.stock), 23, 'Stock must decrease by ordered quantity (2)');

    // Cleanup
    if (orderData && orderData.id) {
        await db.deleteOrder(orderData.id).catch(() => {});
    }
    await db.deleteProduct(prodId).catch(() => {});
});

test('Phase 2 — Commercial Readiness: Store Settings & Marketing Pixels Configuration', async () => {
    // 1. Public GET /api/settings
    const publicSettingsRes = await fetch(`${baseUrl}/api/settings`);
    assert.strictEqual(publicSettingsRes.status, 200, 'Public settings endpoint must return 200');
    const publicSettings = await publicSettingsRes.json();
    assert.ok(publicSettings.store_name, 'store_name must be present');
    assert.ok(publicSettings.store_phone, 'store_phone must be present');

    // 2. Unauthenticated PUT /api/admin/settings must return 401
    const unauthPut = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebook_pixel_id: '9999999999' })
    });
    assert.strictEqual(unauthPut.status, 401, 'Non-admin update must be rejected with 401');

    // 3. Admin authenticated PUT /api/admin/settings
    const adminPut = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            store_name: 'متجر الجزائر الحديث',
            facebook_pixel_id: '123456789012345',
            tiktok_pixel_id: 'C6TIKTOKTEST',
            google_analytics_id: 'G-TEST123456'
        })
    });
    assert.strictEqual(adminPut.status, 200, 'Admin update must succeed with 200');
    const updateResult = await adminPut.json();
    assert.strictEqual(updateResult.settings.store_name, 'متجر الجزائر الحديث');
    assert.strictEqual(updateResult.settings.facebook_pixel_id, '123456789012345');

    // 4. Verify updated settings are immediately reflected on public endpoint
    const verifyPublic = await fetch(`${baseUrl}/api/settings`);
    const verifiedData = await verifyPublic.json();
    assert.strictEqual(verifiedData.facebook_pixel_id, '123456789012345');
    assert.strictEqual(verifiedData.tiktok_pixel_id, 'C6TIKTOKTEST');
});

test('Phase 3 — Commercial Readiness: Product Variants Management (Colors, Sizes, Options)', async () => {
    // 1. Create a base product
    const prodId = await db.createProduct({
        name: 'حذاء رياضي أصلي',
        category: 'ملابس وأحذية',
        price: 8000,
        stock: 30,
        status: 'active'
    });

    // 2. Admin creates variants (Size 42 and Size 43)
    const var1Res = await fetch(`${baseUrl}/api/products/${prodId}/variants`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            name: 'المقاس 42 / أسود',
            sku: 'SHOE-42-BLK',
            priceModifier: 0,
            stock: 12
        })
    });
    assert.strictEqual(var1Res.status, 201, 'Creating variant 1 must succeed with 201');
    const var1Data = await var1Res.json();
    const var1Id = var1Data.id;

    const var2Res = await fetch(`${baseUrl}/api/products/${prodId}/variants`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            name: 'المقاس 43 / أبيض خاص',
            sku: 'SHOE-43-WHT',
            priceModifier: 500,
            stock: 8
        })
    });
    assert.strictEqual(var2Res.status, 201, 'Creating variant 2 must succeed with 201');

    // 3. Fetch product details and assert variants are included
    const getProdRes = await fetch(`${baseUrl}/api/products/${prodId}`);
    assert.strictEqual(getProdRes.status, 200);
    const prodDetails = await getProdRes.json();
    assert.ok(Array.isArray(prodDetails.variants), 'Product must have variants array');
    assert.strictEqual(prodDetails.variants.length, 2, 'Product must have 2 variants');
    assert.strictEqual(prodDetails.variants[0].name, 'المقاس 42 / أسود');
    assert.strictEqual(prodDetails.variants[1].priceModifier, 500);

    // 4. Update variant 1
    const updateVarRes = await fetch(`${baseUrl}/api/products/variants/${var1Id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ stock: 20 })
    });
    assert.strictEqual(updateVarRes.status, 200);

    // 5. Delete variant 1
    const delVarRes = await fetch(`${baseUrl}/api/products/variants/${var1Id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(delVarRes.status, 200);

    // Verify 1 variant remains
    const varsAfter = await db.getProductVariants(prodId);
    assert.strictEqual(varsAfter.length, 1);

    // Cleanup
    await db.deleteProduct(prodId).catch(() => {});
});

test('Phase 4 — Commercial Readiness: Shipping Label Printing & Order CSV Export for Logistics', async () => {
    // 1. Unauthenticated request to export orders must return 401
    const unauthRes = await fetch(`${baseUrl}/api/admin/orders/export`);
    assert.strictEqual(unauthRes.status, 401, 'Export orders must require admin authentication');

    // 2. Admin request to export orders
    const exportRes = await fetch(`${baseUrl}/api/admin/orders/export`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(exportRes.status, 200, 'Admin export must return 200 OK');
    assert.ok(exportRes.headers.get('content-type').includes('text/csv'), 'Content-Type must be text/csv');
    assert.ok(exportRes.headers.get('content-disposition').includes('orders-export'), 'Disposition must include filename');

    const arrayBuf = await exportRes.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuf);
    // Verify UTF-8 BOM (0xEF, 0xBB, 0xBF) is present at the start of raw byte stream for Excel Arabic compatibility
    assert.strictEqual(rawBuffer[0], 0xEF, 'Byte 0 must be 0xEF');
    assert.strictEqual(rawBuffer[1], 0xBB, 'Byte 1 must be 0xBB');
    assert.strictEqual(rawBuffer[2], 0xBF, 'Byte 2 must be 0xBF');

    const csvBody = rawBuffer.toString('utf8');
    assert.ok(csvBody.includes('رقم الطلب'), 'CSV header must include order number in Arabic');
    assert.ok(csvBody.includes('اسم العميل'), 'CSV header must include customer name in Arabic');
    assert.ok(csvBody.includes('المجموع الكلي (دج)'), 'CSV header must include total in Arabic');
});

test('Phase 5 — General Store Customization (Branding, Policies, Social Links, Payment Toggles)', async () => {
    // 0. Save existing settings to restore after test
    const initialRes = await fetch(`${baseUrl}/api/settings`);
    const initialSettings = await initialRes.json();

    // 1. Admin updates comprehensive general settings
    const updateRes = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            store_name: 'متجر الجزائر بريميوم',
            store_logo: 'https://res.cloudinary.com/rewaq/image/upload/logo.png',
            store_favicon: 'https://res.cloudinary.com/rewaq/image/upload/favicon.ico',
            store_phone: '0555123456',
            store_whatsapp: '213555123456',
            store_email: 'support@algeria-shop.dz',
            store_address: 'حي الرياض، وهران',
            facebook_url: 'https://facebook.com/rewaqdz',
            instagram_url: 'https://instagram.com/rewaqdz',
            tiktok_url: 'https://tiktok.com/@rewaqdz',
            shipping_policy: 'شحن مضمون خلال 24 ساعة لـ 58 ولاية',
            return_policy: 'إرجاع مجاني خلال 3 أيام',
            warranty_policy: 'ضمان سنة كاملة ضد عيوب الصناعة',
            enable_cod: 'true',
            enable_chargily: 'false',
            announcement_bar_text: 'تخفيضات كبرى بمناسبة الافتتاح!'
        })
    });
    assert.strictEqual(updateRes.status, 200);

    // 2. Verify all settings are served on the public endpoint
    const publicRes = await fetch(`${baseUrl}/api/settings`);
    assert.strictEqual(publicRes.status, 200);
    const settings = await publicRes.json();

    assert.strictEqual(settings.store_name, 'متجر الجزائر بريميوم');
    assert.strictEqual(settings.store_logo, 'https://res.cloudinary.com/rewaq/image/upload/logo.png');
    assert.strictEqual(settings.facebook_url, 'https://facebook.com/rewaqdz');
    assert.strictEqual(settings.enable_chargily, 'false');
    assert.strictEqual(settings.shipping_policy, 'شحن مضمون خلال 24 ساعة لـ 58 ولاية');

    // 3. Restore initial settings so live store is not left with placeholder URLs
    if (initialSettings && Object.keys(initialSettings).length > 0) {
        await fetch(`${baseUrl}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(initialSettings)
        });
    }
});

test('Phase 5 — Cloud Media Storage & Image Upload Pipeline (Magic Bytes & Provider Processing)', async () => {
    const { getStorageProvider, processUploadedFile } = require('../src/utils/cloudStorage');

    // 1. Storage provider detection
    const provider = getStorageProvider();
    assert.ok(['local', 'cloudinary', 's3'].includes(provider), 'Provider must be local, cloudinary, or s3');

    // 2. Test valid PNG upload to /api/admin/upload-media
    const validPngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG Magic bytes
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
    ]);

    const formData = new FormData();
    const blob = new Blob([validPngBuffer], { type: 'image/png' });
    formData.append('file', blob, 'store-logo.png');

    const uploadRes = await fetch(`${baseUrl}/api/admin/upload-media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formData
    });

    assert.strictEqual(uploadRes.status, 201, 'Valid PNG upload must succeed with 201');
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.url, 'Uploaded file URL must be returned');
    assert.ok(uploadData.storageProvider, 'Storage provider must be returned');

    // Cleanup uploaded media
    if (uploadData && uploadData.url) {
        const relPath = String(uploadData.url).replace(/^\/+/, '');
        const uploadedFilePath = path.resolve(__dirname, '..', relPath);
        if (fs.existsSync(uploadedFilePath)) {
            try { fs.unlinkSync(uploadedFilePath); } catch (e) {}
        }
    }
});

test('Phase 6 — Google Authentication Security & Account Takeover Prevention', async () => {
    // 1. When GOOGLE_CLIENT_ID is not configured, endpoint returns 503
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    const unconfiguredRes = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: 'any_token' })
    });
    assert.strictEqual(unconfiguredRes.status, 503, 'Unconfigured Google login should return 503');
    const unconfigData = await unconfiguredRes.json();
    assert.ok(unconfigData.message.includes('غير مُفعَّل'));

    // Enable test Google Client ID
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

    try {
        // 2. Missing credential in body (e.g. attempting to send raw email/googleId) -> Must return 400
        const noCredRes = await fetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@rewaq.dz',
                googleId: `spoofed_admin_${Date.now()}`
            })
        });
        assert.strictEqual(noCredRes.status, 400, 'Direct body with missing credential must return 400');

        // 3. Forged JWT with base64 payload (Unsigned/Spoofed token) -> Must return 401
        const fakeHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
        const fakePayload = Buffer.from(JSON.stringify({
            sub: '1234567890',
            email: 'admin@rewaq.dz',
            email_verified: true,
            name: 'Hacked Admin'
        })).toString('base64');
        const fakeSignature = Buffer.from('invalid_signature').toString('base64');
        const forgedToken = `${fakeHeader}.${fakePayload}.${fakeSignature}`;

        const fakeTokenRes = await fetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: forgedToken })
        });
        assert.strictEqual(fakeTokenRes.status, 401, 'Forged/Unverified Google credential must return 401');

        // 4. Verify no authentication cookies or valid sessions were issued
        const setCookieHeader = fakeTokenRes.headers.get('set-cookie') || '';
        assert.ok(!setCookieHeader.includes('access_token='), 'Must not issue access_token on failed Google auth');
    } finally {
        // Restore original env
        if (originalClientId) {
            process.env.GOOGLE_CLIENT_ID = originalClientId;
        } else {
            delete process.env.GOOGLE_CLIENT_ID;
        }
    }
});

test('Phase 7 — Admin Dashboard CRUD: Category Management Lifecycle & Authorization', async () => {
    const uniqueSlug = `cat_${Date.now()}`;
    const uniqueName = `قسم تجريبي ${Date.now()}`;

    // 1. Unauthorized Guest cannot create category (401)
    const guestRes = await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: uniqueName, slug: uniqueSlug })
    });
    assert.strictEqual(guestRes.status, 401, 'Guest cannot create category');

    // 2. Normal Customer cannot create category (403)
    const userRes = await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userAToken}` },
        body: JSON.stringify({ name: uniqueName, slug: uniqueSlug })
    });
    assert.strictEqual(userRes.status, 403, 'Normal customer cannot create category');

    // 3. Admin can create category (201)
    const createRes = await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ name: uniqueName, slug: uniqueSlug })
    });
    assert.strictEqual(createRes.status, 201, 'Admin should create category with 201');
    const createdCat = await createRes.json();
    assert.ok(createdCat.id, 'Created category must return ID');

    // 4. Duplicate Category creation should be rejected (400)
    const dupRes = await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ name: uniqueName, slug: uniqueSlug })
    });
    assert.strictEqual(dupRes.status, 400, 'Duplicate category name/slug must be rejected');

    // 5. Read Category list
    const listRes = await fetch(`${baseUrl}/api/categories`);
    assert.strictEqual(listRes.status, 200, 'Category list should be public');
    const categories = await listRes.json();
    assert.ok(Array.isArray(categories), 'Categories must be an array');
    const found = categories.find(c => Number(c.id) === Number(createdCat.id));
    assert.ok(found, 'Created category should exist in categories list');

    // 6. Update Category as Admin
    const updateRes = await fetch(`${baseUrl}/api/admin/categories/${createdCat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ name: `${uniqueName} محدث` })
    });
    assert.strictEqual(updateRes.status, 200, 'Category update must succeed');

    // 7. Delete Category as Admin
    const deleteRes = await fetch(`${baseUrl}/api/admin/categories/${createdCat.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(deleteRes.status, 200, 'Category deletion must succeed');
});

test('Phase 8 — Admin Dashboard CRUD: User Role Management & Lockout Protection', async () => {
    // 1. Customer cannot update user role (403)
    const forbidRes = await fetch(`${baseUrl}/api/admin/users/${userBId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userAToken}` },
        body: JSON.stringify({ role: 'admin' })
    });
    assert.strictEqual(forbidRes.status, 403, 'Customer cannot update user role');

    // 2. Admin can promote customer to admin (200)
    const promoteRes = await fetch(`${baseUrl}/api/admin/users/${userBId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ role: 'admin' })
    });
    assert.strictEqual(promoteRes.status, 200, 'Admin can promote user');

    // 3. Admin can demote user back to customer (200)
    const demoteRes = await fetch(`${baseUrl}/api/admin/users/${userBId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ role: 'customer' })
    });
    assert.strictEqual(demoteRes.status, 200, 'Admin can demote user');

    // 4. Admin cannot demote themselves (Lockout protection 400)
    const selfDemoteRes = await fetch(`${baseUrl}/api/admin/users/${adminId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ role: 'customer' })
    });
    assert.strictEqual(selfDemoteRes.status, 400, 'Admin cannot demote own account');

    // 5. Admin cannot delete themselves (Lockout protection 400)
    const selfDeleteRes = await fetch(`${baseUrl}/api/admin/users/${adminId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(selfDeleteRes.status, 400, 'Admin cannot delete own account');
});

test('Phase 9 — Admin Dashboard CRUD: Product Deletion Protection & Error Handling', async () => {
    // 1. Create a standalone test product
    const createProdRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            name: `منتج اختبار الحذف ${Date.now()}`,
            category: 'إلكترونيات',
            price: 4500,
            stock: 10,
            status: 'active',
            description: 'وصف تجريبي'
        })
    });
    assert.strictEqual(createProdRes.status, 201, 'Product creation should succeed');
    const prodData = await createProdRes.json();

    // 2. Delete standalone product as Admin (200)
    const delProdRes = await fetch(`${baseUrl}/api/products/${prodData.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(delProdRes.status, 200, 'Standalone product deletion should succeed with 200');

    // 3. Deleting non-existent product should return 404
    const delNonExistent = await fetch(`${baseUrl}/api/products/999999`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(delNonExistent.status, 404, 'Deleting non-existent product returns 404');
});

test('Phase 10 — Admin Dashboard CRUD: Product Variants CRUD & Coupon Lifecycle', async () => {
    // 1. Create a base product
    const createProdRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            name: `منتج تجربة المتغيرات ${Date.now()}`,
            category: 'ملابس',
            price: 3200,
            stock: 20,
            status: 'active',
            description: 'وصف المنتج'
        })
    });
    assert.strictEqual(createProdRes.status, 201);
    const prod = await createProdRes.json();

    // 2. Add variant to product
    const createVariantRes = await fetch(`${baseUrl}/api/products/${prod.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            name: 'المقاس: XL - اللون: أسود',
            sku: `SKU-XL-BLK-${Date.now()}`,
            priceModifier: 300,
            stock: 8
        })
    });
    assert.strictEqual(createVariantRes.status, 201, 'Variant creation should succeed');
    const variantData = await createVariantRes.json();
    assert.ok(variantData.id, 'Variant ID must be returned');

    // 3. Get product variants
    const listVariantsRes = await fetch(`${baseUrl}/api/products/${prod.id}/variants`);
    assert.strictEqual(listVariantsRes.status, 200);
    const variants = await listVariantsRes.json();
    assert.ok(variants.length > 0, 'Variants list must not be empty');

    // 4. Update variant
    const updateVariantRes = await fetch(`${baseUrl}/api/products/variants/${variantData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            name: 'المقاس: XXL - اللون: أسود',
            priceModifier: 500,
            stock: 12
        })
    });
    assert.strictEqual(updateVariantRes.status, 200, 'Variant update must succeed');

    // 5. Delete variant
    const delVariantRes = await fetch(`${baseUrl}/api/products/variants/${variantData.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(delVariantRes.status, 200, 'Variant deletion must succeed');

    // 6. Clean up base product
    await fetch(`${baseUrl}/api/products/${prod.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    // 7. Coupon Lifecycle: Create coupon
    const couponCode = `E2ECOUPON_${Date.now()}`;
    const createCouponRes = await fetch(`${baseUrl}/api/admin/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            code: couponCode,
            discountPercent: 15,
            minOrderAmount: 2000,
            maxUses: 50,
            status: 'active'
        })
    });
    assert.strictEqual(createCouponRes.status, 201, 'Coupon creation should return 201');
    const couponData = await createCouponRes.json();

    // 8. Validate coupon via public endpoint
    const validateRes = await fetch(`${baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, orderTotal: 5000 })
    });
    assert.strictEqual(validateRes.status, 200, 'Coupon validation should succeed');
    const valData = await validateRes.json();
    assert.strictEqual(valData.discountPercent, 15);
    assert.strictEqual(valData.calculatedDiscount, 750);

    // 9. Update Coupon discount
    const updateCouponRes = await fetch(`${baseUrl}/api/admin/coupons/${couponData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            discountPercent: 25
        })
    });
    assert.strictEqual(updateCouponRes.status, 200, 'Coupon update should succeed');

    // 10. Delete Coupon
    const delCouponRes = await fetch(`${baseUrl}/api/admin/coupons/${couponData.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(delCouponRes.status, 200, 'Coupon deletion should succeed');
});












test('Auth Flow: Login, Refresh, Logout, Token Reuse, Account Lock', async () => {
    // 1. Account Lock
    for (let i = 0; i < 5; i++) {
        await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@example.com', password: 'wrongpassword' })
        });
    }
    const lockedRes = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
    });
    assert.strictEqual(lockedRes.status, 429);

    // clear lockout manually for next test
    await db.pool.query('DELETE FROM login_attempts WHERE identifier LIKE ?', [`%user@example.com%`]);

    // 2. Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
    });
    assert.strictEqual(loginRes.status, 200);
    const setCookieHeaders = loginRes.headers.get('set-cookie');
    const refreshTokenMatch = setCookieHeaders.match(/refresh_token=([^;]+)/);
    const oldRefreshToken = refreshTokenMatch[1];

    // 3. Refresh
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `refresh_token=${oldRefreshToken}`
        }
    });
    assert.strictEqual(refreshRes.status, 200);
    const newSetCookieHeaders = refreshRes.headers.get('set-cookie');
    const newRefreshTokenMatch = newSetCookieHeaders.match(/refresh_token=([^;]+)/);
    const newRefreshToken = newRefreshTokenMatch[1];

    // 4. Token Reuse (use oldRefreshToken again)
    const reuseRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `refresh_token=${oldRefreshToken}`
        }
    });
    assert.strictEqual(reuseRes.status, 401);
    
    // Now the new session should also be invalid
    const refreshRes2 = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `refresh_token=${newRefreshToken}`
        }
    });
    assert.strictEqual(refreshRes2.status, 401);
});
});
