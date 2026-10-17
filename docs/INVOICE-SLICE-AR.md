# شريحة الفواتير (Vertical Slice) — مليون فاتورة، p95 < 200ms

> **القرار المعماري:** تجميد `PlatformContext` — ممنوع إضافة dataset جديد. الشاشات
> تقرأ من السيرفر عند الطلب، وكل شاشة تُنقل تُزيل dataset من حِزمة الإقلاع.
> ثم تنتقل الأرصدة والقيود للـ DB فقط، وأخيراً يُزال مسار الاتصال المباشر والكاش المحلي.

## الملفات
| الملف | الوظيفة |
|---|---|
| `scripts/neon_invoice_slice.sql` | أعمدة فلترة حقيقية + جدول `invoice_lines` + فهارس Keyset/فلاتر/trgm + دوال `fn_invoice_list` / `fn_invoice_summary` / `fn_invoice_detail` |
| `scripts/seed-million-invoices.mjs` | توليد N فاتورة + سطورها داخل القاعدة بـ `generate_series` (بلا نقل صفوف) |
| `scripts/measure-invoices-p95.mjs` | قياس p50/p95/p99 للقائمة/الملخص/التفاصيل ومقارنتها بـ 200ms |
| `scripts/neon_revenue_invoices_view.sql` | **View موحّد `v_revenue_invoices`**: فواتير `sales_invoices` + إيرادات الورديات المشتقة بنفس قواعد الاستثناء، مع إعادة تعريف دوال القائمة/الملخص/التفاصيل لتقرأ منه |
| `scripts/check-context-freeze.mjs` | بوابة CI: تفشل عند أي dataset جديد في `neonSchema.ts` (34 dataset مجمّدة) |

## طبقة الـ API (تحديث مهم)
كل قراءة/كتابة الفواتير تمرّ الآن عبر **Fastify** (`server/src/routes/invoices.ts`):

| المسار | الوظيفة | الصلاحية |
|---|---|---|
| `GET /sales/invoices` | قائمة Keyset بفلاتر | `generic.record.read` |
| `GET /sales/invoices/summary` | عدّاد + صافي + ضريبة | `generic.record.read` |
| `GET /sales/invoices/:id` | رأس + سطور `invoice_lines` | `generic.record.read` |
| `PUT /sales/invoices/:id` | تعديل (سبب إلزامي) | `record.save` |
| `POST /sales/invoices/:id/cancel` | إلغاء (سبب إلزامي) | `record.save` |

- **tenant_id من التوكن فقط** ولا يُقبل من الجسم/الاستعلام (مُختبَر).
- كل استدعاء يمرّ بـ `db.one(tenantId, ...)` الذي يضبط `app.tenant_id` داخل نفس
  المعاملة فتسري سياسات RLS.
- `src/services/invoiceQueryApi.ts` أصبح **عميل API فعلياً** (بلا أي اتصال مباشر
  بقاعدة البيانات من المتصفح)؛ وإن لم يُضبط عنوان الـ API تُعاد رسالة صريحة بلا
  مسار بديل.
- اختبارات: `server/src/__tests__/invoices.test.ts` (8 اختبارات: 401/403، تجاهل
  `tenantId` القادم من العميل، فرض سبب التعديل/الإلغاء).

## خطوات التشغيل
```bash
# 1) طبّق المخطط (أعمدة/سطور/فهارس/دوال) — متكرر بأمان
NEON_DATABASE_URL="postgresql://..." node scripts/apply-neon-migrations.mjs

# 2) ولّد مليون فاتورة (2 مليون سطر افتراضياً)
NEON_DATABASE_URL="..." node scripts/seed-million-invoices.mjs \
  --tenant tenant-eg-001 --rows 1000000 --confirm

# 3) قِس p95 (يفشل إن تجاوز 200ms)
NEON_DATABASE_URL="..." node scripts/measure-invoices-p95.mjs \
  --tenant tenant-eg-001 --iterations 60 --confirm
```

## معايير القبول
- `list` بلا فلاتر: p95 ≤ 200ms
- `list` ببحث نصي: p95 ≤ 200ms (trgm على `customer_name` + `invoice_number`)
- `list` بحالة + مدى تاريخ: p95 ≤ 200ms (فهرس `tenant,status,invoice_date`)
- `summary` (عدّاد + مجاميع): p95 ≤ 200ms
- `detail` (رأس + سطور): p95 ≤ 200ms

**لو تحققت المعايير:** يُعمَّم الأسلوب على الشاشات الأخرى واحدة واحدة، وكل شاشة
تُزال من `buildAllDatasetDocuments` مع تحديث بوابة التجميد (`--update`).

## نتائج القياس (تُملأ بعد التشغيل)
| العملية | p50 | p95 | p99 | الحالة |
|---|---|---|---|---|
| list (بلا فلاتر) | | | | |
| list (بحث) | | | | |
| list (حالة+تاريخ) | | | | |
| summary | | | | |
| detail | | | | |

## ملاحظات
- `invoice_lines` هي المصدر الحقيقي للسطور؛ `payload.items` يبقى للتوافق أثناء الانتقال.
- الفهارس تُنشأ `IF NOT EXISTS`، ولا تحذف أي بيانات.
- بيانات القياس مُوسمة (`demo_seed`) ويمكن حذفها بإعادة السكربت مع `--clean`.
