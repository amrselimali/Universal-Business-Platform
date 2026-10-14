# مواصفة: شاشة ربط العمليات بالحسابات — مصدر القيود الوحيد

> **الحالة:** مطلوب تنفيذ (لم يبدأ)
> **الأولوية:** 🔴 عالية — يحل مشكلة معمارية جوهرية
> **مصدر الطلب:** صاحب المشروع — 2026-10-14

---

## 1. الهدف

بناء **شاشة واحدة** تربط كل عملية في النظام (بيع، شراء، تحصيل، صرف، مرتب، حركة مخزن، جلسة، إهلاك…)
بالحسابات المحاسبية المناسبة (مدين / دائن)، بحيث تصبح هذه الشاشة
**المصدر الوحيد والحصري للقيود المحاسبية**.

**المعنى العملي:** لا يوجد أي حساب مكتوب يدوياً في الكود. كل قيد يُبنى من قاعدة الربط.

---

## 2. المشكلة الحالية (مقيسة)

### 🔴 42 موضعًا فيه حساب مكتوب يدوياً

```
src/data/initialData.ts                    42 موضع  ← 'acc-5000', 'acc-1130', 'acc-1100' …
src/context/PlatformContext.tsx             7 مواضع
src/views/InventoryManagementView.tsx       4 مواضع
src/views/ProductManagementView.tsx         3 مواضع
```

### النتائج المترتبة

| المشكلة | الأثر |
|---|---|
| **حساب الثابت في الكود** | لو العميل غيّر دليل الحسابات، القيود تروح لحسابات غلط |
| **لا يوجد ربط موحّد** | كل شاشة تبني القيد بطريقتها (`buildXJournalLines` لكل حالة) |
| **صعب التدقيق** | المحاسب لا يستطيع معرفة «ليه القيد راح للحساب ده؟» |
| **لا يصلح لتعدد الشركات** | كل شركة لها دليل حسابات مختلف — الكود واحد للجميع |

### ما هو موجود جزئياً ✅

حقول الربط موجودة في الأنواع لكن استخدامها متفرّق:
- `Product.salesAccountId` · `cogsAccountId` · `expenseAccountId` · `inventoryAccountId`
- `PaymentMethod.linkedAccountId`
- `Party.accountId` · `supplierAccountId`
- `StaffMember` / `ExpenseVoucher.expenseAccountId`

**الفجوة:** لا يوجد **جدول مركزي** يربط «نوع العملية» بالحسابات، ولا شاشة لإدارته.

---

## 3. التصميم المقترح

### 3.1 جداول قاعدة البيانات

```sql
-- 1) أنواع العمليات المحاسبية (Event Types)
CREATE TABLE accounting_event_types (
  code           VARCHAR(100) PRIMARY KEY,   -- sale.cash, sale.credit, purchase.receive …
  name_ar        VARCHAR(255) NOT NULL,
  name_en        VARCHAR(255) NOT NULL,
  module_code    VARCHAR(50)  NOT NULL,      -- sales / purchasing / inventory / hr …
  category       VARCHAR(50)  NOT NULL,      -- revenue / expense / asset / liability
  description_ar TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2) قواعد الربط: لكل نوع عملية → سطور القيد
CREATE TABLE accounting_mapping_rules (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         VARCHAR(100) NOT NULL,
  event_code        VARCHAR(100) NOT NULL REFERENCES accounting_event_types(code),
  line_no           INTEGER NOT NULL,
  side              VARCHAR(10)  NOT NULL CHECK (side IN ('debit','credit')),
  account_source    VARCHAR(30)  NOT NULL CHECK (account_source IN
                      ('fixed','product','category','party','payment_method',
                       'staff','warehouse','branch','event_field')),
  account_id        VARCHAR(150),   -- عند account_source = 'fixed'
  fallback_account_id VARCHAR(150), -- حساب احتياطي إن لم يُعرَّف الحساب المصدر
  amount_source     VARCHAR(100) NOT NULL, -- net / tax / total / cost / quantity_x_cost …
  memo_template     TEXT,           -- قالب الوصف مع رموز {customer} {invoice_no}
  is_required       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 10,
  UNIQUE (tenant_id, event_code, line_no)
);

-- 3) سجل القيود المولَّدة (تتبّع: أي قاعدة ولّدت أي قيد)
CREATE TABLE accounting_generated_entries (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       VARCHAR(100) NOT NULL,
  journal_entry_id VARCHAR(150) NOT NULL,
  event_code      VARCHAR(100) NOT NULL,
  source_document VARCHAR(150),
  rule_id         BIGINT REFERENCES accounting_mapping_rules(id),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 الشاشة (Accounting Mapping Studio)

| القسم | الوظيفة |
|---|---|
| **قائمة أنواع العمليات** | مجمّعة حسب الموديول (مبيعات / مشتريات / مخازن / موارد بشرية / تصنيع) |
| **محرر سطور القيد** | لكل نوع: سطر مدين + سطر دائن (قابل للإضافة لأكثر من سطرين) |
| **مصدر الحساب** | قائمة منسدلة: ثابت / من الصنف / من العميل / من طريقة السداد / … |
| **مصدر المبلغ** | قائمة منسدلة: الصافي / الضريبة / الإجمالي / التكلفة / (الكمية × التكلفة) |
| **قالب الوصف** | مع رموز `{customer}` `{invoice_no}` `{date}` |
| **معاينة حية** | يختار مستنداً حقيقياً ويعرض القيد الذي سيُولَّد |
| **فحص التغطية** | تحذير من أي نوع عملية **بدون قاعدة ربط** |
| **التحقق من التوازن** | يمنع حفظ قاعدة قيدها غير متوازن |

### 3.3 المحرك

```
حدث (بيع/شراء/تحصيل/…)
      ↓
يبحث عن قاعدة الربط لهذا النوع
      ↓
يحل «مصدر الحساب» لكل سطر (من الصنف / العميل / طريقة السداد / ثابت)
      ↓
يحل «مصدر المبلغ» (صافي / ضريبة / تكلفة / …)
      ↓
يتحقق من التوازن (مدين = دائن)
      ↓
ينشئ القيد + يسجّله في accounting_generated_entries
```

---

## 4. الفوائد

| الفائدة | التفصيل |
|---|---|
| **صفر حساب في الكود** | تغيير الدليل = تعديل صف واحد في الشاشة |
| **تعدد الشركات** | كل شركة لها قواعد ربط خاصة (مربوطة بـ `tenant_id`) |
| **قابلية التدقيق** | المحاسب يرى بالضبط أي قاعدة ولّدت أي قيد |
| **تغطية مضمونة** | الشاشة تحذّر من أي عملية بلا قاعدة |
| **إضافة عمليات جديدة** | بلا كود — صف جديد في الشاشة |

---

## 5. نطاق العمل المقترح

| المرحلة | المحتوى | التقدير |
|---|---|---|
| **1** | جداول الـ SQL + الـ seed (استخراج الحسابات الحالية من الكود) | 2–3 أيام |
| **2** | محرك توليد القيود من القواعد | 3–5 أيام |
| **3** | الشاشة (محرر + معاينة + فحص تغطية) | 4–6 أيام |
| **4** | ربط الشاشات الحالية بالمحرك وإزالة الحسابات المكتوبة يدوياً | 5–7 أيام |
| **الإجمالي** | | **~3 أسابيع** |

---

## 6. قرارات مطلوبة من صاحب المشروع

1. **هل نبدأ التنفيذ؟** ومتى؟
2. **هل نحتفظ بالحسابات المكتوبة يدوياً كاحتياطي** أثناء الانتقال، أم نُلزم بالربط من أول يوم؟
3. **هل الربط على مستوى المنشأة فقط**، أم ممكن يختلف **لكل فرع** كمان؟
4. **هل تحتاج موافقة (Approval)** قبل تفعيل قاعدة ربط جديدة؟
