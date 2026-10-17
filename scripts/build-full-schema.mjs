#!/usr/bin/env node
/**
 * يولّد ملف الهيكل الكامل من ملفات الـ Migrations الفردية
 * ---------------------------------------------------------------------------
 * المخرج: `scripts/neon_full_schema.sql` — ملف واحد يبني قاعدة بيانات كاملة
 * من الصفر، **بلا أي بيانات مستخدم** (جداول + دوال + أمان + إعدادات فقط).
 *
 * التشغيل: node scripts/build-full-schema.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** ترتيب التطبيق إلزامي: كل ملف يبني على الذي قبله. */
const SOURCES = [
  ['scripts/neon_schema_migrations.sql', 'المخطط الأساسي + مخزن السجلات app_records'],
  ['scripts/neon_typed_tables.sql', 'الجداول المنمّطة الكاملة'],
  ['scripts/neon_auth_functions.sql', 'دوال المصادقة'],
  ['scripts/neon_security_rls.sql', 'الأمان: RLS + مستخدم app_api + الفهارس'],
  ['scripts/neon_accounting_functions.sql', 'الدوال المحاسبية الذرّية'],
  ['scripts/neon_optimistic_concurrency.sql', 'التزامن المتفاوت: عمود version + Triggers'],
  ['scripts/neon_metadata_engine.sql', 'محرك الشاشات: المخطط'],
  ['scripts/neon_metadata_seed.sql', 'محرك الشاشات: التعريفات (إعدادات، ليست بيانات مستخدم)'],
  ['scripts/neon_phase4_infrastructure.sql', 'Outbox + التسلسل الرقمي بلا فجوات'],
  ['scripts/neon_phase4_missing_tables.sql', 'المرفقات والعملات و ETA + الفهارس'],
  ['scripts/neon_retention_policy.sql', 'سياسة تنظيف السجلات المحذوفة ناعماً'],
  ['scripts/neon_accounting_mapping.sql', 'ربط العمليات بالحسابات: المخطط'],
  ['scripts/neon_accounting_mapping_seed.sql', 'ربط العمليات بالحسابات: القواعد الأساسية'],
  ['scripts/neon_posting_rules_engine.sql', 'محرك قواعد الترحيل: المخطط والدوال'],
  ['scripts/neon_posting_rules_seed.sql', 'محرك قواعد الترحيل: بذور تعكس السلوك الحالي'],
  ['scripts/neon_journal_edit.sql', 'تعديل القيود الموثّق + مزامنة المصدر'],
  ['scripts/neon_db_admin_audit.sql', 'تدقيق إدارة قاعدة البيانات من الواجهة'],
  ['scripts/neon_parties_performance_indexes.sql', 'فهارس أداء العملاء (trgm + أكواد + حالة)'],
  ['scripts/neon_invoice_slice.sql', 'شريحة الفواتير: أعمدة/سطور/فهارس/دوال'],
  ['scripts/neon_revenue_invoices_view.sql', 'توحيد مصدر الفواتير: View موحّد + دوال محدّثة'],
  ['scripts/neon_invoice_source_filter.sql', 'فواتير: فلتر المصدر في الدوال'],
  ['scripts/neon_invoice_rows_payload.sql', 'فواتير: حمولة الصف الكاملة في القائمة'],
];

const HEADER = `-- ============================================================================
-- Universal Business Platform — الهيكل الكامل (بدون أي بيانات مستخدم)
-- ============================================================================
--
-- هذا ملف واحد يبني قاعدة بيانات كاملة من الصفر:
--   • كل الجداول والفهارس والدوال والـ Triggers وسياسات الأمان (RLS)
--   • التعريفات فقط (شاشات، أفعال، عملات، سياسات تنظيف)
--   • لا يحتوي أي بيانات مستخدم (لا عملاء، لا فواتير، لا قيود)
--
-- ✅ آمن تماماً: كل الأوامر متكررة (Idempotent) — تشغيله مرتين لا يضر،
--    ولا يحذف أي بيانات موجودة مسبقاً.
--
-- طرق التشغيل:
--   1. Neon Console → SQL Editor → الصق الملف كاملاً → Run
--   2. node scripts/apply-neon-migrations.mjs
--   3. psql "postgresql://..." -f scripts/neon_full_schema.sql
--
-- ⚠️ مولَّد آلياً — لا تُحرّره يدوياً.
--    المصدر: الملفات الفردية في scripts/*.sql
--    التوليد: node scripts/build-full-schema.mjs
-- ============================================================================

`;

const FOOTER = `-- ============================================================================
-- ✅ انتهى. القاعدة الآن كاملة وجاهزة.
--
-- الخطوة التالية — ربط التطبيق:
--   داخل التطبيق → شاشة «قاعدة بيانات Neon» → أدخل رابط الاتصال → حفظ
--   ثم اضغط «مزامنة» لإنشاء الجداول ومزامنة البيانات.
-- ============================================================================
`;

let output = HEADER;
let totalLines = 0;
let missing = 0;

for (const [file, title] of SOURCES) {
  const path = join(ROOT, file);
  if (!existsSync(path)) {
    console.log(`  ⚠️  مفقود: ${file}`);
    missing++;
    continue;
  }

  const body = readFileSync(path, 'utf8').trimEnd();
  const lines = body.split('\n').length;
  totalLines += lines;

  output +=
    '-- ============================================================================\n' +
    `-- [${title}]\n` +
    `-- المصدر: ${file}\n` +
    '-- ============================================================================\n\n' +
    body +
    '\n\n\n';

  console.log(`  ✅ ${file.padEnd(46)} ${String(lines).padStart(4)} سطر`);
}

output += FOOTER;

const outPath = join(ROOT, 'scripts/neon_full_schema.sql');
writeFileSync(outPath, output, 'utf8');

console.log(`\nتم التوليد: scripts/neon_full_schema.sql`);
console.log(`  الملفات: ${SOURCES.length - missing}/${SOURCES.length}`);
console.log(`  الأسطر : ${totalLines + HEADER.split('\n').length + FOOTER.split('\n').length}`);
