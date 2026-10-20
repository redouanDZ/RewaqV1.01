/**
 * Demo Data Seeder for Rewaq Pro
 * Populates the database with realistic demo products, categories, reviews, coupons, and orders.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/data/db-connection');

async function seedDemoData() {
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ خطأ أمني: لا يمكن تشغيل سكريبت البيانات التجريبية (seed:demo) في بيئة الإنتاج (NODE_ENV=production)!');
        console.error('⚠️ لحماية المتجر الحقيقي من تلوث البيانات، يعمل هذا السكريبت في بيئات التطوير والتجربة فقط.');
        process.exit(1);
    }

    console.log('🌱 Starting Rewaq Pro Demo Data Seeding...');
    await db.initializeDatabase();

    const pool = db.pool;
    if (!pool) {
        console.error('❌ Database pool not available.');
        process.exit(1);
    }

    // 1. Ensure Demo Users
    console.log('👤 Seeding Demo Users...');
    const hashedAdminPass = await bcrypt.hash('reviewpass1234', 10);
    const hashedCustomerPass = await bcrypt.hash('reviewpass1234', 10);

    await pool.query(`
        INSERT INTO users (username, email, password, role, phone)
        VALUES 
            ('مدير المتجر', 'review-admin@rewaq.dz', ?, 'admin', '0550000001'),
            ('مستخدم مراجعة', 'review-customer@rewaq.dz', ?, 'customer', '0661234567')
        ON DUPLICATE KEY UPDATE 
            username = VALUES(username),
            password = VALUES(password),
            role = VALUES(role),
            phone = VALUES(phone)
    `, [hashedAdminPass, hashedCustomerPass]);

    // 2. Ensure Categories
    console.log('🏷️ Seeding Categories...');
    const categories = [
        { name: 'هواتف وإلكترونيات', slug: 'phones-electronics' },
        { name: 'ساعات وإكسسوارات', slug: 'watches-accessories' },
        { name: 'أزياء وملابس', slug: 'fashion-clothing' },
        { name: 'عطور ومستحضرات تجميل', slug: 'perfumes-beauty' },
        { name: 'منزل وديكور', slug: 'home-decor' }
    ];

    const categoryMap = {};
    for (const cat of categories) {
        const [existing] = await pool.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [cat.name]);
        if (existing.length > 0) {
            categoryMap[cat.name] = existing[0].id;
        } else {
            const [res] = await pool.query('INSERT INTO categories (name, slug) VALUES (?, ?)', [cat.name, cat.slug]);
            categoryMap[cat.name] = res.insertId;
        }
    }

    // 3. Demo Products (Curated 8 General E-Commerce Products)
    console.log('📦 Seeding 8 General Demo Products...');
    const demoProducts = [
        {
            id: 1,
            name: 'قميص رجالي كاجوال من الكتان الفاخر',
            category_id: categoryMap['أزياء وملابس'],
            price: 3800.00,
            old_price: 4900.00,
            cost_price: 2100.00,
            stock: 18,
            image_url: '/images/prod_linen_shirt.jpg',
            description: 'قميص رجالي صيفي أنيق مصنوع من الكتان الطبيعي 100% عالي الجودة، قصة مريحة تناسب الإطلالات اليومية والعمل والمناسبات مع تهوية ممتازة وأزرار متينة.',
            rating: 4.9
        },
        {
            id: 2,
            name: 'فستان صيفي أنيق بتصميم عصري ناعم',
            category_id: categoryMap['أزياء وملابس'],
            price: 4900.00,
            old_price: 5900.00,
            cost_price: 2700.00,
            stock: 3,
            image_url: '/images/prod_summer_dress.jpg',
            description: 'فستان ميدي نسائي بنقوش زهرية رقيقة وقماش شيفون ناعم وخفيف، مزود بحزام خصر أنيق وقصة جذابة توفر راحة تامة وإطلالة متألقة في مختلف المناسبات.',
            rating: 4.7
        },
        {
            id: 3,
            name: 'حذاء رياضي مريح للجري والمشي اليومي',
            category_id: categoryMap['أزياء وملابس'],
            price: 5500.00,
            old_price: null,
            cost_price: 3200.00,
            stock: 24,
            image_url: '/images/prod_sneakers.jpg',
            description: 'حذاء سنيكرز خفيف الوزن بتقنية النعل الهوائي الماص للصدمات وقماش شبكي مسامي للتهوية الفائقة، صُمم خصيصاً للراحة اليومية والتمارين الرياضية الطويلة.',
            rating: 4.4
        },
        {
            id: 4,
            name: 'ساعة يد رجالية كلاسيكية بسوار جلدي فاخر',
            category_id: categoryMap['ساعات وإكسسوارات'],
            price: 4200.00,
            old_price: 5400.00,
            cost_price: 2300.00,
            stock: 4,
            image_url: '/images/prod_classic_watch.jpg',
            description: 'ساعة يد كرونوغراف ميكانيكية فاخرة بهيكل ستانلس ستيل مصقول ومينا كحلي ملكي، سوار من الجلد الطبيعي وزجاج ياقوتي مقاوم للخدوش ومقاومة للماء.',
            rating: 4.8
        },
        {
            id: 5,
            name: 'عطر فاخر برائحة العود والعنبر الفواح 100ml',
            category_id: categoryMap['عطور ومستحضرات تجميل'],
            price: 6200.00,
            old_price: null,
            cost_price: 3500.00,
            stock: 15,
            image_url: '/images/prod_perfume.jpg',
            description: 'عطر شرقي فاخر بتركيز Eau de Parfum يدوم طويلاً لأكثر من 24 ساعة، تركيبة فريدة تجمع بين أخشاب العود المعتقة، العنبر الملكي، ولمسات الفانيليا المخملية.',
            rating: 4.2
        },
        {
            id: 6,
            name: 'طقم أواني ومقالي غرانيت غير لاصقة (4 قطع)',
            category_id: categoryMap['منزل وديكور'],
            price: 8900.00,
            old_price: 11500.00,
            cost_price: 5200.00,
            stock: 2,
            image_url: '/images/prod_cookware.jpg',
            description: 'طقم أواني طهي تركي فاخر مطلي بطبقات الغرانيت الصحي المقاوم للالتصاق والخدش (PFOA Free)، مزود بمقابض عازلة للحرارة وأغطية زجاجية بخارية.',
            rating: 4.9
        },
        {
            id: 100,
            name: 'حاسوب محمول فائق الأداء للأعمال والبرمجة',
            category_id: categoryMap['هواتف وإلكترونيات'],
            price: 3900.00,
            old_price: 5200.00,
            cost_price: 2100.00,
            stock: 16,
            image_url: '/images/christopher-gower-m_HRfLhgABo-unsplash.jpg',
            description: 'حاسوب محمول فائق السرعة بمعالج قوي وشاشة عالية الدقة مضادة للانعكاس، بطارية تدوم طويلاً وهيكل أنيق خفيف الوزن مثالي للعمل المكتبي والبرمجة والدراسة.',
            rating: 4.5
        },
        {
            id: 101,
            name: 'كاميرا رقمية احترافية بدقة 4K للتصوير الفوتوغرافي',
            category_id: categoryMap['هواتف وإلكترونيات'],
            price: 4200.00,
            old_price: 5800.00,
            cost_price: 2400.00,
            stock: 5,
            image_url: '/images/samsung-memory-RZM2cE0lx0Y-unsplash.jpg',
            description: 'كاميرا تصوير رقمية احترافية مزودة بمستشعر متطور وعدسة تصوير عالية الدقة، تدعم تصوير الفيديو بدقة 4K مع تركيز بؤري فائق السرعة وشاشة متحركة لإنتاج محتوى متميز.',
            rating: 4.8
        }
    ];

    // 3.1. Insert / Upsert 8 General Demo Products First
    const insertedProductIds = [];
    for (const p of demoProducts) {
        await pool.query(
            `INSERT INTO products (id, category_id, name, price, old_price, cost_price, stock, image_url, status, description, rating)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
             ON DUPLICATE KEY UPDATE 
                category_id = VALUES(category_id),
                name = VALUES(name),
                price = VALUES(price),
                old_price = VALUES(old_price),
                cost_price = VALUES(cost_price),
                stock = VALUES(stock),
                image_url = VALUES(image_url),
                status = 'active',
                description = VALUES(description),
                rating = VALUES(rating)`,
            [p.id, p.category_id, p.name, p.price, p.old_price || null, p.cost_price, p.stock, p.image_url, p.description, p.rating]
        );
        insertedProductIds.push(p.id);
    }

    // 3.2. Clean up test and obsolete products safely
    const allowedIds = demoProducts.map(p => p.id);
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
        await pool.query('UPDATE order_items SET product_id = 6 WHERE product_id NOT IN (?)', [allowedIds]);
        await pool.query('UPDATE cart_items SET product_id = 1 WHERE product_id NOT IN (?)', [allowedIds]);
        await pool.query('UPDATE wishlist_items SET product_id = 1 WHERE product_id NOT IN (?)', [allowedIds]);
        await pool.query('DELETE FROM product_variants WHERE product_id NOT IN (?)', [allowedIds]);
        await pool.query('DELETE FROM product_reviews WHERE product_id NOT IN (?)', [allowedIds]);
        await pool.query('DELETE FROM products WHERE id NOT IN (?)', [allowedIds]);
    } finally {
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    // 3.5. Seed Realistic Demo Variants (Colors, Sizes, Volumes)
    console.log('🎨 Seeding Product Variants...');
    await pool.query('DELETE FROM product_variants WHERE product_id IN (1, 2, 3, 5)');
    const demoVariants = [
        // Product 1: Linen Shirt (Linen beige matches prod_linen_shirt.jpg, white matches prod_linen_shirt_white.jpg, navy matches prod_linen_shirt_navy.jpg)
        { productId: 1, sku: 'SHIRT-BEIGE-M', name: 'المقاس: M / اللون: بيج كتاني', priceModifier: 0, stock: 6, imageUrl: '/images/prod_linen_shirt.jpg' },
        { productId: 1, sku: 'SHIRT-BEIGE-L', name: 'المقاس: L / اللون: بيج كتاني', priceModifier: 0, stock: 8, imageUrl: '/images/prod_linen_shirt.jpg' },
        { productId: 1, sku: 'SHIRT-BEIGE-XL', name: 'المقاس: XL / اللون: بيج كتاني', priceModifier: 0, stock: 4, imageUrl: '/images/prod_linen_shirt.jpg' },
        { productId: 1, sku: 'SHIRT-WHITE-L', name: 'المقاس: L / اللون: أبيض ملكي', priceModifier: 0, stock: 5, imageUrl: '/images/prod_linen_shirt_white.jpg' },
        { productId: 1, sku: 'SHIRT-NAVY-L', name: 'المقاس: L / اللون: كحلي داكن', priceModifier: 200, stock: 0, imageUrl: '/images/prod_linen_shirt_navy.jpg' },

        // Product 2: Summer Dress
        { productId: 2, sku: 'DRESS-S', name: 'المقاس: S / اللون: أخضر زمردي', priceModifier: 0, stock: 2, imageUrl: '/images/prod_summer_dress.jpg' },
        { productId: 2, sku: 'DRESS-M', name: 'المقاس: M / اللون: أخضر زمردي', priceModifier: 0, stock: 3, imageUrl: '/images/prod_summer_dress.jpg' },
        { productId: 2, sku: 'DRESS-CORAL-M', name: 'المقاس: M / اللون: مرجاني زهري', priceModifier: 150, stock: 4, imageUrl: '/images/prod_summer_dress_coral.jpg' },

        // Product 3: Sports Sneakers
        { productId: 3, sku: 'SNK-41', name: 'المقاس: 41 / اللون: رمادي رياضي', priceModifier: 0, stock: 8, imageUrl: '/images/prod_sneakers.jpg' },
        { productId: 3, sku: 'SNK-42', name: 'المقاس: 42 / اللون: رمادي رياضي', priceModifier: 0, stock: 10, imageUrl: '/images/prod_sneakers.jpg' },
        { productId: 3, sku: 'SNK-43', name: 'المقاس: 43 / اللون: رمادي رياضي', priceModifier: 0, stock: 6, imageUrl: '/images/prod_sneakers.jpg' },
        { productId: 3, sku: 'SNK-BLK-42', name: 'المقاس: 42 / اللون: أسود داكن', priceModifier: 200, stock: 5, imageUrl: '/images/prod_sneakers_black.jpg' },
        { productId: 3, sku: 'SNK-BLK-43', name: 'المقاس: 43 / اللون: أسود داكن', priceModifier: 200, stock: 3, imageUrl: '/images/prod_sneakers_black.jpg' },

        // Product 5: Luxury Oud Perfume
        { productId: 5, sku: 'PERF-50ML', name: 'الحجم: 50 مل (50ml)', priceModifier: -1500, stock: 8, imageUrl: '/images/prod_perfume.jpg' },
        { productId: 5, sku: 'PERF-100ML', name: 'الحجم: 100 مل (100ml)', priceModifier: 0, stock: 7, imageUrl: '/images/prod_perfume.jpg' }
    ];

    for (const v of demoVariants) {
        await pool.query(
            `INSERT INTO product_variants (product_id, sku, name, price_modifier, stock, image_url, status)
             VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            [v.productId, v.sku, v.name, v.priceModifier, v.stock, v.imageUrl]
        );
    }

    // 4. Seed Demo Coupons
    console.log('🎟️ Seeding Demo Coupons...');
    const demoCoupons = [
        { code: 'PROMO10', discount_percent: 10, discount_amount: 0, min_order_amount: 3000, max_uses: 500, uses_count: 34 },
        { code: 'WELCOME500', discount_percent: 0, discount_amount: 500, min_order_amount: 5000, max_uses: 200, uses_count: 18 }
    ];

    for (const c of demoCoupons) {
        await pool.query(`
            INSERT INTO coupons (code, discount_percent, discount_amount, min_order_amount, max_uses, uses_count, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
            ON DUPLICATE KEY UPDATE 
                discount_percent = VALUES(discount_percent),
                discount_amount = VALUES(discount_amount),
                min_order_amount = VALUES(min_order_amount)
        `, [c.code, c.discount_percent, c.discount_amount, c.min_order_amount, c.max_uses, c.uses_count]);
    }

    // 5. Seed Demo Orders
    console.log('🛒 Seeding Demo Orders...');
    const [existingOrders] = await pool.query('SELECT COUNT(*) AS total FROM orders');
    if (Number(existingOrders[0].total) < 5 && insertedProductIds.length >= 3) {
        const wilayas = [
            { id: 16, name: 'الجزائر العاصمة', city: 'باب الزوار', cost: 400 },
            { id: 31, name: 'وهران', city: 'السانية', cost: 600 },
            { id: 19, name: 'سطيف', city: 'العلمة', cost: 550 },
            { id: 25, name: 'قسنطينة', city: 'الخروب', cost: 550 },
            { id: 9, name: 'البليدة', city: 'أولاد يعيش', cost: 450 }
        ];

        const statuses = ['delivered', 'delivered', 'shipped', 'processing', 'pending'];
        const names = ['كريم بلحاج', 'ياسمين قادري', 'عمر منصوري', 'فاطمة الزهراء', 'سمير دراجي'];
        const phones = ['0551234567', '0662345678', '0773456789', '0554567890', '0665678901'];

        const [custRows] = await pool.query('SELECT id FROM users WHERE email = "review-customer@rewaq.dz" LIMIT 1');
        const customerId = custRows.length > 0 ? custRows[0].id : null;

        for (let i = 0; i < 5; i++) {
            const w = wilayas[i];
            const pId1 = insertedProductIds[i % insertedProductIds.length];
            const pId2 = insertedProductIds[(i + 1) % insertedProductIds.length];
            
            const [p1Rows] = await pool.query('SELECT * FROM products WHERE id = ?', [pId1]);
            const [p2Rows] = await pool.query('SELECT * FROM products WHERE id = ?', [pId2]);
            const prod1 = p1Rows[0];
            const prod2 = p2Rows[0];

            const subtotal = Number(prod1.price) + Number(prod2.price);
            const total = subtotal + w.cost;
            const orderNum = `DZ-2026-${10000 + i + 1}`;

            const [orderRes] = await pool.query(`
                INSERT INTO orders (
                    user_id, order_number, total, shipping_cost,
                    status, payment_method, payment_status,
                    shipping_full_name, phone, wilaya_id, wilaya_name, city, address, delivery_type,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, 'cod', ?, ?, ?, ?, ?, ?, ?, 'home', DATE_SUB(NOW(), INTERVAL ? DAY))
            `, [
                customerId, orderNum, total, w.cost,
                statuses[i], statuses[i] === 'delivered' ? 'paid' : 'pending',
                names[i], phones[i], w.id, w.name, w.city, `حي السلام، ${w.city}`,
                (5 - i) * 2
            ]);

            const orderId = orderRes.insertId;

            // Insert order items
            await pool.query(`
                INSERT INTO order_items (order_id, product_id, name, price, quantity)
                VALUES 
                    (?, ?, ?, ?, 1),
                    (?, ?, ?, ?, 1)
            `, [orderId, prod1.id, prod1.name, prod1.price, orderId, prod2.id, prod2.name, prod2.price]);
        }
    }

    // 6. Update Store Settings
    console.log('⚙️ Updating Demo Store Settings...');
    const demoSettings = {
        store_name: 'متجر رواق',
        store_currency: 'دج',
        store_phone: '0550 00 00 00',
        store_whatsapp: '213550000000',
        store_email: 'contact@rewaq.dz',
        store_address: 'الجزائر العاصمة، الجزائر',
        store_logo: '/images/logo.png',
        store_favicon: '/images/favicon.svg',
        enable_cod: 'true',
        enable_chargily: 'true',
        announcement_bar_text: '🎉 مرحباً بكم في متجر رواق — توصيل سريع لـ 58 ولاية والدفع عند الاستلام!'
    };

    for (const [key, value] of Object.entries(demoSettings)) {
        await pool.query(
            'INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, value, value]
        );
    }

    console.log('✅ Rewaq Pro Demo Seeding completed successfully!');
    console.log('----------------------------------------------------');
    console.log('🔑 Demo Admin Credentials:');
    console.log('   Email:    review-admin@rewaq.dz');
    console.log('   Password: reviewpass1234');
    console.log('----------------------------------------------------');
}

seedDemoData().then(async () => {
    if (db.pool) {
        await db.pool.end();
    }
    process.exit(0);
}).catch(async (err) => {
    console.error('❌ Error during demo data seeding:', err);
    if (db.pool) {
        await db.pool.end();
    }
    process.exit(1);
});
