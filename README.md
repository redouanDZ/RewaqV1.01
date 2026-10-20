# متجر إلكتروني متكامل للإنتاج — متجر رواق E-Commerce Platform

[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Database](https://img.shields.io/badge/database-MySQL%208.0-blue.svg)](https://www.mysql.com)
[![Security Status](https://img.shields.io/badge/security-httpOnly%20cookies%20%7C%20CSRF%20%7C%20CSP%20%7C%20DB--Sessions-blue.svg)](#الأمان-وحماية-البيانات)
[![License: Commercial](https://img.shields.io/badge/License-Commercial%20Proprietary-red.svg)](LICENSE)

منصة متجر إلكتروني تجارية متكاملة وجاهزة للإنتاج، مصممة وفق أحدث معايير الأداء والأمان ومخصصة لأسواق التجارة الإلكترونية في الجزائر والوطن العربي، مع دعم كامل لثلاث لغات (العربية RTL، الفرنسية، الإنجليزية) ومعمارية برمجية صلبة تعتمد على Node.js و Express و MySQL 8.0.

---

## 🌟 الميزات الحقيقية للمشروع (Core Features)

### 🛒 واجهة المتجر وتجربة الشراء (Storefront & Checkout)
- **دعم 3 لغات كامل**: تبديل سلس ولحظي بين العربية (RTL)، الفرنسية (LTR)، والإنجليزية (LTR).
- **نموذج شراء سريع بضغطة زر (1-Click Direct COD)**: نموذج طلب فوري ومباشر في صفحة كل منتج لرفع معدل إتمام الطلبات (Conversion Rate).
- **سلة تسوق متكاملة**: تدعم سلة الزوار (Guest Cart) والمستخدمين المسجلين، مع إمكانية تطبيق كوبونات الخصم واختيار طريقة التوصيل.
- **توصيل مخصص لـ 58 ولاية جزائرية**: حساب تلقائي لأسعار التوصيل للمنزل أو المكتب (Stop Desk).
- **تتبع مباشر للطلبات**: صفحة مخصصة للعميل لتتبع حالة طلبه برقم التتبع والهاتف.
- **طباعة الفواتير وبوالص الشحن**: صفحة فاتورة رسمية متجاوبة ومهيأة للطباعة المباشرة والطباعة الحرارية (Thermal Printing).
- **بوابات وطرق الدفع المرنة**: الدفع عند الاستلام (COD)، الدفع الإلكتروني عبر بوابة **Chargily Pay V2** (البطاقة الذهبية وبطاقات CIB البنكية)، والدفع عبر **الحساب البريدي الجاري الجزائري (CCP / BaridiMob)** مع التحقق التلقائي من صحة أرقام الحساب والمفتاح (RIP / Clé).

### 📊 لوحة التحكم الإدارية المتكاملة (Admin Dashboard)
- **مؤشرات الأداء الرئيسية (KPIs)**: إحصائيات المبيعات، الطلبات، المنتجات الأكثر طلباً، وتنبيهات نفاد المخزون.
- **تتبع سعر التكلفة والأرباح الصافية**: إدخال سعر التكلفة (`cost_price`) لكل منتج واحتساب صافي الأرباح تلقائياً في لوحة الإدارة مع عزله التام عن الزوار.
- **إدارة الطلبات**: فلترة متقدمة حسب الحالة، تعديل الحالات، تصدير ملفات CSV لشركات الشحن والتوصيل، وإمكانية حذف الطلبات مع استرجاع تلقائي للمخزون.
- **إدارة المنتجات والمتغيرات**: إنشاء وتعديل وحذف المنتجات، مع دعم متغيرات الألوان والمقاسات وإدارة المخزون المستقل لكل متغير مع حجب المنتجات غير المنشورة (Drafts).
- **إدارة الأقسام**: تصنيف متعدد المستويات مع ترجمات مخصصة لكل لغة.
- **كوبونات الخصم الذكية**: قسائم خصم بنسبة مئوية أو مبلغ ثابت مع قيود الحد الأدنى للطلب والحد الأقصى للاستخدام.
- **نظام التقييمات والمراجعات**: لوحة لاعتماد ومراقبة مراجعات العملاء وتحديث معدل التقييم تلقائياً.
- **إدارة المستخدمين وصلاحيات الأدوار**: عرض العملاء، تعديل الأدوار (مدير / عميل)، مع حماية مدمجة تمنع قفل المدير لنفسه.
- **إعدادات المتجر والتسويق**: تعديل هوية المتجر ومعلومات الدفع (CCP و Chargily) وأرقام التواصل وأسعار الشحن، مع دعم حقن بكسلات التتبع (Meta Pixel, TikTok Pixel, Google Analytics 4).

### 🛡️ الأمان وحماية البيانات (Security & Architecture)
- **حماية خصوصية التكلفة وهوامش الربح**: عزل حقل سعر التكلفة (`cost_price`) تماماً عن كافة مسارات الـ API العامة، وحظر الوصول إلى مسودات المنتجات (Drafts) لغير المديرين.
- **تطهير وعزل أسرار المتجر (Settings Sanitization)**: حظر تسريب توكنات تيليجرام أو المعرفات الخاصة عبر قائمة بيضاء صارمة في مسار الإعدادات العامة للمتجر.
- **إدارة جلسات آمنة في قاعدة البيانات**: حفظ جلسات الدخول في MySQL مع دعم الإلغاء الفوري من الخادم (`revokeSession` / `revokeAllUserSessions`) وكاش ذاكرة سريع بـ TTL، مما يحافظ على تسجيل الدخول عبر عمليات إعادة تشغيل الخادم.
- **حماية التوكنات بكوكيز `httpOnly`**: تخزين التوكنات في كوكيز مشفرة ومحمية من هجمات XSS.
- **حماية CSRF**: عبر ترويسات `X-CSRF-Token` لكافة العمليات المغيرة للحالة.
- **سياسة أمان المحتوى الصارمة (Strict CSP)**: خالية من `'unsafe-inline'` في السكربتات والأحداث، ومحمية عبر Helmet.
- **حماية المخزون والسباق البرمجي (Race Conditions)**: قفل ذكي للأسطر في قاعدة البيانات (`SELECT ... FOR UPDATE`) أثناء معالجة الطلبات.
- **التحقق من توقيع الويب هوك (HMAC-SHA256)**: لمعاملات Chargily Pay مع منع التكرار (Idempotency).
- **حماية رفع الملفات**: فحص التوقيع الثنائي للملفات (Magic Bytes) والامتدادات المسموحة فقط للصور.
- **حماية بيئة الإنتاج**: منع تشغيل السكربتات التجريبية أو حقن البيانات الافتراضية في `NODE_ENV=production`.

### 📱 الإشعارات والتخزين السحابي
- **إشعارات تيليجرام اللحظية**: تنبيه فوري عبر بوت تيليجرام فور تسجيل أي طلب جديد مع تفاصيل العميل والمنتجات.
- **تأكيد الطلبات عبر واتساب بضغطة زر**: زر مباشر لفتح محادثة واتساب مع العميل برسالة جاهزة.
- **رسائل البريد الإلكتروني (SMTP)**: إرسال فواتير الطلبات إلكترونياً.
- **التخزين السحابي الدائم**: تكامل جاهز مع Cloudinary أو AWS S3 لحفظ صور المنتجات على الاستضافات السحابية.

---

## 🛠️ المتطلبات الأساسية (Prerequisites)

- **Node.js**: الإصدار 18.11 أو أحدث (للتطوير عبر `node --watch`)، أو 20.x LTS أو أحدث.
- **MySQL Server**: الإصدار 8.0 أو أحدث (بترميز `utf8mb4`).
- **Docker & Docker Compose**: (اختياري للتشغيل عبر الحاويات).

---

## 🚀 خطوات التثبيت والتشغيل (Installation & Setup)

### 1. تثبيت الاعتماديات
```bash
npm install
```

### 2. إعداد ملف متغيرات البيئة
انسخ ملف الإعدادات النموذجي:
```bash
cp .env.example .env
```
افتح ملف `.env` واملأ بيانات قاعدة البيانات والأسرار العشوائية:
```env
NODE_ENV=production
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=rewaq_db
DB_USER=rewaq_user
DB_PASSWORD=your_db_password
JWT_SECRET=your_long_random_64char_jwt_secret
COOKIE_SECRET=your_long_random_64char_cookie_secret
```

> 🔑 **لتوليد أسرار عشوائية آمنة:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 3. تشغيل الـ Migrations لإنشاء الجداول
```bash
npm run migrate
```
*يقوم هذا الأمر بإنشاء كافة الجداول والفهارس والعلاقات في قاعدة البيانات.*

### 4. إنشاء حساب المدير
- إما بتحديد `ADMIN_EMAIL` و `ADMIN_PASSWORD` في ملف `.env` قبل التشغيل الأول.
- أو بتشغيل الأمر التفاعلي:
  ```bash
  npm run create-admin
  ```

### 5. تشغيل الخادم
```bash
# للإنتاج
npm start

# لبيئة التطوير (مع التحديث التلقائي)
npm run dev
```
افتح المتصفح على: `http://localhost:3000`

---

## 🧪 أوامر الاختبار والتحقق من الجودة (Tests & Quality Gates)

```bash
# فحص جودة ومعايير الكود (ESLint)
npm run lint

# فحص توافق مفاتيح الترجمة في اللغات الثلاث وأكواد الأخطاء
npm run check:i18n

# بناء الملفات المصغرة والتحقق من سلامة الإنتاج
npm run build

# تشغيل حزمة الاختبارات الآلية الشاملة
npm test
```

> ⚠️ **تنبيه أمان الاختبارات (Database Test Guard):**
> لحماية قواعد بيانات الإنتاج من الحذف العرضي، ترفض حزمة الاختبارات الآلية (`npm test`) العمل إلا على قاعدة بيانات ينتهي اسمها بـ `_test` (مثال: `ecommerce_store_test` أو `rewaq_test`). يجب ضبط المتغير `DB_NAME` لقاعدة تجريبية مخصصة عند تشغيل الاختبارات.

---

## 🚢 النشر في بيئة الإنتاج (Production Deployment)

### التشغيل عبر Docker Compose:
```bash
docker compose up --build -d
```

### النشر على منصات السحاب (Render / VPS):
1. **أمر البناء:** `npm install && npm run build`
2. **أمر البدء:** `npm start`
3. **بيانات البيئة:** اضبط متغيرات الجدول الموجود في [HANDOVER.md](HANDOVER.md) في لوحة الاستضافة.
4. **رابط الـ Webhook لبوابة Chargily:**
   ```
   https://your-domain.com/api/payments/chargily/webhook
   ```
5. لمزيد من التفاصيل وخطوات التسليم الكاملة، راجع دليل التسليم: [HANDOVER.md](HANDOVER.md).

---

## 📄 الترخيص وحقوق الملكية (License & Assets Attribution)

- **كود المشروع**: هذا البرنامج مرخص بموجب **رخصة برمجية تجارية خاصة (Commercial Proprietary Software License)**. جميع الحقوق محفوظة © 2026 متجر رواق. يُحظر إعادة البيع أو إعادة التوزيع أو الاستخدام دون ترخيص مسبق. للاطلاع على الشروط الكاملة، يُرجى مراجعة ملف [LICENSE](LICENSE).
- **أصول الصور والوسائط والخطوط**: مصادر الصور والخطوط والأيقونات وتراخيصها موثقة في [ASSETS_LICENSE.md](ASSETS_LICENSE.md). صور المنتجات الحالية للبيانات التجريبية فقط؛ تراخيص الصور لا تمنح تلقائيًا حقوق العلامات التجارية أو الأشخاص الظاهرين فيها.

---

<div dir="ltr">

## English Summary

**Rewaq Store** is a production-grade, full-stack Arabic, French, and English e-commerce platform built with Node.js, Express, and MySQL 8.0.

### Highlights:
- **Trilingual Storefront**: Full RTL Arabic support, French, and English with instant locale switching and dark mode support.
- **Conversion-Optimized Checkout**: 1-Click Cash on Delivery (COD) express checkout, **Chargily Pay V2** (EDAHABIA / CIB cards), and Algerian postal accounts (**CCP / BaridiMob**) with RIP and Clé validation.
- **Robust Security & Privacy**: Cost prices isolated from public APIs; database-backed sessions with server-side revocation and TTL memory cache; httpOnly cookies; CSRF tokens; strict CSP (no inline scripts); SQL row-level locks on inventory; production safety guards against demo scripts.
- **Comprehensive Admin Panel**: Real-time sales KPIs, cost price and net profit margin tracking, order lifecycle management with CSV export, product variants (colors/sizes), thermal invoice printing, coupons, customer reviews, and granular role management.
- **Omnichannel Communication**: Instant Telegram notifications on new orders, 1-click WhatsApp customer contact, and SMTP email invoices.
- **Media Ready**: Local uploads or Cloudinary CDN / AWS S3 cloud media integration.

### Quick Start:
```bash
npm install
cp .env.example .env
npm run migrate
npm start
```

*Note: Automated tests (`npm test`) require a dedicated database ending with `_test` for data protection.*

**License**: Commercial Proprietary Software License. See [LICENSE](LICENSE) for details.

</div>
