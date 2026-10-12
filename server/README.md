# Universal Business Platform — API

الطبقة الوحيدة المسموح لها بالاتصال بـ Postgres. المتصفح لا يعرف رابط قاعدة البيانات بعد الآن.

## لماذا هذه الطبقة

| قبل | بعد |
|---|---|
| المتصفح → Postgres مباشرة (بصلاحيات المالك!) | المتصفح → **API** → Postgres (بصلاحيات `app_api` المحدودة) |
| أي مستخدم يستطيع قراءة/حذف كل الشركات من أدوات المطور | **مستحيل** — الـ API يفرض الكيان والصلاحيات |
| منطق الأعمال في الواجهة | **في قاعدة البيانات** (دوال ذرّية) |

## البنية

```
Browser/PWA  →  API (Fastify)  →  Pooled connection  →  Neon Postgres
                     │
                     ├─ Auth (JWT) + Permissions
                     ├─ tenant_id من التوكن (لا يُقبل من الطلب أبدًا)
                     └─ set_config('app.tenant_id') → RLS يعزل كل شركة
```

## التشغيل

```bash
cd server
cp .env.example .env      # املأ القيم
npm install
npm run dev               # أو: npm run build && npm start
```

## متغيرات البيئة

| المتغير | الوصف |
|---|---|
| `NEON_DATABASE_URL` | رابط الاتصال بـ **مستخدم `app_api` المحدود** — **لا تستخدم المالك أبدًا** |
| `JWT_SECRET` | سر طويل عشوائي (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | مدة التوكن (افتراضي `12h`) |
| `CORS_ORIGINS` | النطاقات المسموح لها (مفصولة بفاصلة) |
| `PORT` | منفذ التشغيل |

## نقاط النهاية

| الطريقة | المسار | الوظيفة |
|---|---|---|
| GET | `/health` | حالة الخدمة + قاعدة البيانات |
| POST | `/auth/login` | `{username, password}` → **JWT** |
| GET | `/me` | بيانات التوكن الحالي |
| GET | `/records/:docKey` | السجلات الحية (مرقّمة، بلا محذوف) |
| GET | `/records/:docKey/changes?since=` | التغييرات منذ مؤشر (للمزامنة) |
| POST | `/records/:docKey` | إدراج/تحديث سجلات (transaction واحد) |
| POST | `/records/:docKey/delete` | **حذف ناعم** (`deleted_at`) |
| POST | `/accounting/journal` | ترحيل قيد **ذرّي** (يرفض غير المتوازن) |
| POST | `/accounting/journal/:id/reverse` | عكس قيد مع الاحتفاظ بالأصل |
| POST | `/accounting/receipt` | إيصال تحصيل (خزينة مدين / عميل دائن) |
| GET | `/accounting/balances` | الأرصدة المرجعية من الدفتر |

## الأمان المُطبَّق

1. **JWT** لكل طلب عدا `/health` و `/auth/login`.
2. **الكيان من التوكن فقط** — `assertTenant` يرفض أي كيان خارج صلاحيات المستخدم.
3. **RLS** مفعّل على 39 جدولًا و`app.tenant_id` يُضبط داخل نفس المعاملة.
4. **`app_api`** بلا صلاحيات DDL ولا يتخطى RLS.
5. **كلمات المرور**: يُدعم `passwordHash` (SHA-256)؛ النص الصريح مدعوم مؤقتًا مع تحذير في السجل.
6. `helmet` + `@fastify/rate-limit` (300 طلب/دقيقة) + CORS محدود بالنطاقات.

## نتائج الاختبار الفعلي

```
GET  /health              → {"status":"ok","database":"up"}
POST /auth/login          → JWT (tenant-eg-003 / SuperAdmin)
GET  /records/erp_users   → السجلات (معزولة بـ RLS)
GET  /accounting/balances  → 37 حسابًا من الدفتر
POST /accounting/journal  → قيد غير متوازن ⇒ HTTP 400 "unbalanced journal: debit 100 vs credit 90"
POST /accounting/journal  → قيد سليم ⇒ HTTP 200 {journalId}
GET  (بدون توكن)          → HTTP 401
```

## الدوال المطلوبة في قاعدة البيانات

شغّل قبل التشغيل:

- `scripts/neon_accounting_functions.sql` (المحاسبة الذرّية)
- `scripts/neon_security_rls.sql` (RLS + الفهارس + مستخدم `app_api`)

## الخطوة التالية: ربط التطبيق

واجهة `src/services/` يجب أن تستدعي هذه النقاط بدل `@neondatabase/serverless` مباشرة،
ثم يُحذف رابط الاتصال من إعدادات المتصفح نهائيًا (`erp_neon_cfg`).
