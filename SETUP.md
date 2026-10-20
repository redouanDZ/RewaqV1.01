# دليل التثبيت والنشر والتشغيل للإنتاج (SETUP & DEPLOYMENT GUIDE)

---

## 1. 📋 المتطلبات الأساسية (Requirements)

* **Node.js**: الإصدار 18.x أو 20.x LTS
* **MySQL Server**: الإصدار 8.0+
* **Docker & Docker Compose**: (اختياري للتشغيل بالحاويات)
* **OpenSSL / Crypto**: لتوليد المفاتيح السرية

---

## 2. ⚙️ متغيرات البيئة (Environment Variables)

انسخ ملف القالب وأنشئ `.env` الخاص بك:
```bash
cp .env.example .env
```

| المتغير | الوصف | مثال لقيمة الإنتاج |
|---|---|---|
| `NODE_ENV` | بيئة التشغيل | `production` |
| `PORT` | منفذ الخادم | `3000` |
| `DB_HOST` | مضيف قاعدة البيانات | `127.0.0.1` أو `mysql` |
| `DB_PORT` | منفذ MySQL | `3306` |
| `DB_NAME` | اسم قاعدة البيانات | `rewaq_db` |
| `DB_USER` | اسم المستخدم | `rewaq_user` |
| `DB_PASSWORD` | كلمة مرور قوية لقاعدة البيانات | *كلمة مرور فريدة ومعقدة* |
| `JWT_SECRET` | مفتاح توثيق JWT (64 حرفاً عشوائياً) | *مفتاح سري مشفر* |
| `COOKIE_SECRET` | مفتاح تشفير الجلسات والكوكيز | *مفتاح سري مشفر* |
| `CHARGILY_PUBLIC_KEY` | المفتاح العام لبوابة Chargily Pay V2 | `live_pk_...` |
| `CHARGILY_SECRET_KEY` | المفتاح السري لبوابة Chargily Pay V2 | `live_sk_...` |
| `CHARGILY_MODE` | وضع الدفع (`live` للإنتاج أو `test`) | `live` |
| `TELEGRAM_BOT_TOKEN` | توكن بوت تيليجرام للإشعارات الفورية | `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ` |
| `TELEGRAM_CHAT_ID` | معرّف المحادثة أو القناة المستلمة | `123456789` |
| `CLOUDINARY_CLOUD_NAME` | اسم سحابة Cloudinary لتخزين الصور | `your-cloud-name` |
| `CLOUDINARY_API_KEY` | المفتاح العام لـ Cloudinary | `your-api-key` |
| `CLOUDINARY_API_SECRET` | المفتاح السري لـ Cloudinary | `your-api-secret` |
| `BASE_URL` | النطاق الرسمي للإنتاج | `https://rewaq.dz` |

> 🔑 **توليد مفاتيح سرية قوية**:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## 3. 💾 إعداد قاعدة البيانات والـ Migrations

1. قم بإنشاء قاعدة البيانات في MySQL 8:
```sql
CREATE DATABASE rewaq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. تشغيل الـ Migrations الآلية لإنشاء الجداول والبيانات الأولية:
```bash
npm run migrate
```

---

## 4. 📱 إعداد إشعارات تيليجرام الفورية (Telegram Alerts Setup)

1. افتح تطبيق تيليجرام وابحث عن `@BotFather`.
2. أرسل الأمر `/newbot` واتبع التعليمات لإنشاء البوت والحصول على `Bot Token`.
3. لمعرفة معرّف حسابك (`Chat ID`)، راسل `@userinfobot` وانسخ رقم الـ ID.
4. ادخل إلى **لوحة التحكم > الإعدادات والبكسلات** وضع التوكن والـ ID، ثم اضغط على **"اختبار الإرسال الفوري للتيليجرام"** للتأكد من وصول التنبيهات.

---

## 5. 🚀 خيارات النشر والتشغيل (Deployment)

### الخيار أ: التشغيل عبر Docker Compose (موصى به)

```bash
# بناء وتشغيل الحاويات في الخلفية
docker compose up --build -d

# فحص صحة التطبيق
curl http://localhost:3000/health
# {"status":"UP"}
```

### الخيار ب: التشغيل المباشر عبر Node.js / PM2

```bash
# 1. تثبيت الحزم للإنتاج
npm ci --only=production

# 2. تشغيل الخادم عبر PM2 للإدارة وإعادة التشغيل التلقائي
npm install -g pm2
pm2 start server.js --name "rewaq" --env production
pm2 save
```

---

## 6. 📦 النسخ الاحتياطي والاستعادة في الإنتاج (Production Backup & Recovery)

### 1. أخذ نسخة احتياطية كاملة (Backup with Schema, Data & Triggers):
```bash
# استخراج نسخة احتياطية مضغوطة وآمنة
mysqldump -h 127.0.0.1 -P 3306 -u rewaq_user -p --single-transaction --quick --routines --triggers rewaq_db > backup_rewaq_$(date +%Y%m%d_%H%M%S).sql
```

### 2. استعادة النسخة الاحتياطية (Restore):
```bash
mysql -h 127.0.0.1 -P 3306 -u rewaq_user -p rewaq_db < backup_file.sql
```

### 3. جدولة النسخ الاحتياطي التلقائي (Cron Job):
```bash
# تشغيل النسخ الاحتياطي يومياً في الساعة 02:00 صباحاً
0 2 * * * mysqldump -u rewaq_user -p'YOUR_PASSWORD' rewaq_db | gzip > /backups/rewaq_$(date +\%F).sql.gz
```

---

## 7. 🧪 التحقق من الجودة والاختبارات

```bash
# 1. تشغيل الاختبارات الآلية الشاملة (52/52)
npm test

# 2. فحص جودة الكود
npm run lint

# 3. فحص ملفات الإنتاج والـ Migrations
npm run build

# 4. تدقيق أمان الحزم
npm audit
```

---

## 8. 🛠️ حل المشاكل الشائعة (Troubleshooting)

- **خطأ الاتصال بقاعدة البيانات (`ECONNREFUSED`)**: تأكد من أن خدمة MySQL تعمل على المنفذ المحدد وأن بيانات الاتصال في `.env` متطابقة.
- **خطأ CSRF Token**: تأكد من تمرير ترويسة `x-csrf-token` أو استخدام كوكي الجلسة الصحيح.
- **تحديثات الـ Migrations**: نظام الترحيل متوافق و idempotent؛ يمكنك إعادة تشغيل `npm run migrate` في أي وقت دون فقدان البيانات.
