# محرك قواعد الترحيل المحاسبي — المصدر الوحيد لتوجيه القيود

> **الحالة:** المرحلة 1 مكتملة في الكود (المخطط + الدوال + الشاشة + الإقفال + الاختبارات).
> **المتبقي (المرحلة 2):** تحويل شاشات العمليات لتُرحّل "مستنداً" عبر هذا المحرك بدل بناء القيد محلياً، وإزالة حقول الحسابات من الملفات نهائياً.

## 1. المبدأ

| قبل | بعد |
|---|---|
| القيد يُبنى من `Product.salesAccountId` و`PaymentMethod.linkedAccountId` و`Party.accountId` + أكواد ثابتة في الكود (`1111`, `1120`, `4100`) | القيد يُبنى **من قاعدة واحدة لكل خلية رقمية**: `accounting_posting_rules` |
| شاشة ربط لا يقرأها أي كود ترحيل | الشاشة هي المصدر الوحيد؛ لا يوجد أي مصدر آخر |
| الترحيل يحدث داخل أكواد الشاشات (مخفي) | الترحيل **بزر ظاهر** في تبويب «الترحيل» + طابور مستندات (معلّق/فاشل/مُرحَّل) |
| إقفال الفترات في الواجهة فقط | الإقفال في `accounting_period_locks` وتفحصه الداتابيز داخل `fn_post_document` |
| لا سجل لما وُلد فعلاً | `accounting_generated_entries` تُكتب داخل نفس معاملة الترحيل |

## 2. المخطط (SQL)

- `scripts/neon_posting_rules_engine.sql`
  - `accounting_posting_rules` — المفتاح: `(tenant_id, transaction_type, field_key, selector_key)`.
  - `accounting_posting_documents` — منع الازدواج + حالات `pending/posted/failed` + `last_error` + `payload`.
  - `accounting_period_locks` — `lock_date` + `status`.
  - `fn_resolve_posting_rule(tenant, type, field, selector)`.
  - `fn_post_document(tenant, branch, type, screen, document, date, desc, actor, components, idempotency)`.
  - `fn_lock_period` / `fn_open_period` / `fn_is_period_locked`.
- `scripts/neon_posting_rules_seed.sql` — 33 قاعدة تعكس **السلوك الحالي حرفياً** (بلا تغيير محاسبي عند التطبيق).
- مُسجَّلة في `scripts/apply-neon-migrations.mjs` و`scripts/build-full-schema.mjs`.

### التطبيق

```bash
NEON_DATABASE_URL="postgresql://..." node scripts/apply-neon-migrations.mjs
# أو وضع المعاينة أولاً:
NEON_DATABASE_URL="..." node scripts/apply-neon-migrations.mjs --dry-run
```

## 3. كيف يعمل الترحيل

```
زر «ترحيل القيد» (صلاحية accounting.post_journal)
  → fn_post_document(components = [ {field_key, amount, selector, optional} ])
      1. إقفال الفترة؟ → رفض بسبب واضح
      2. المستند مُرحَّل سابقاً؟ → إرجاع نفس القيد (Idempotency)
      3. لكل خلية: fn_resolve_posting_rule → اتجاه + حساب
         • لا قاعدة للخلية الإلزامية → failed + سبب صريح
         • الحساب غير موجود في الدليل → failed برسالة
      4. توازن المدين/الدائن → رفض إن اختل
      5. fn_post_journal (نفس دالة النظام: قيد + أرصدة)
      6. accounting_generated_entries: أي قاعدة أنتجت أي سطر
      7. المستند → posted + رقم القيد
```

كل خطوات 3–7 داخل كتلة ذرية: أي فشل يتراجع كاملاً، ويُسجَّل المستند `failed` مع السبب لإعادة المحاولة من الزر.

## 4. الشاشة (`ربط العمليات بالقيود`)

| التبويب | الوظيفة |
|---|---|
| قواعد الترحيل | كل عملية × كل خلية رقمية: الاتجاه (مدين/دائن) + الحساب + فعّالة/موقوفة. الحقول الإلزامية معلّمة، وكل مُحدِّد (نقدي/بنك) له قاعدة مستقلة. |
| الترحيل | نموذج ترحيل مستند (اختيار العملية ← إدخال المبالغ ← زر ترحيل) + طابور المستندات مع زر «ترحيل القيد» وسبب الفشل. |
| إقفال الفترات | إقفال حتى تاريخ بسبب + فتح القفل (صلاحية `accounting.open_period`). |
| التغطية | نسبة الخلايا الإلزامية المربوطة + قائمة الفجوات + إحصاء المُرحَّل/الفاشل/المعلّق. |

الأفعال المسجّلة (Default-Deny): `accounting.post_journal` · `accounting.lock_period` · `accounting.open_period`.

## 5. الكتالوج

`src/data/accountingOperations.ts` — 12 عملية و**كل خلية رقمية** فيها (الاسم، الإلزامية، المُحدِّد).
أي عملية جديدة في التطبيق يجب أن تُضاف هنا، وإلا لا يمكن ربط خلاياها (والاختبار `accountingPostingRules.test.ts` يحرس اتساق الكتالوج).

## 6. ما تغيّر في الكود القديم

- `resolveAccount` لم يعد يسقط إلى `accounts[0]` (كان يسمح بقيد على حساب عشوائي). نُقل إلى `src/services/accountingAccounts.ts` (لحد الأسطر) ويرمي خطأً صريحاً.
- شاشة الربط القديمة (قواعد `accounting_mapping_rules`) استُبدلت كلياً؛ الجدول القديم للقراءة التاريخية فقط.

## 7. المرحلة 2 (المتبقي)

1. كل شاشة تُنشئ **مستنداً** (`field_key`/مبلغ/مُحدِّد) بدل بناء القيد → زر ترحيل واحد مشترك.
2. تحويل محرك القيود per-operation إلى استدعاء `fn_post_document` فقط.
3. إزالة حقول الحسابات من الملفات (`Product.salesAccountId`, `PaymentMethod.linkedAccountId`, `Party.accountId` كـ"مصدر قيد"): بعد نقل كل عملية، تُخفى من النماذج وتُحذف تدريجياً بعد ترحيل البيانات.
4. نقل الترحيل إلى الـ API (RLS + `journal.post`) بدل اتصال المتصفح المباشر.
5. اختبار تكامل على Postgres: توازن/إقفال/ازدواج/RLS.
