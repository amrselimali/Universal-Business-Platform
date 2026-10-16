/**
 * مولّد Migration الجداول المنمّطة الكاملة
 * ---------------------------------------------------------------------------
 * المصدر: `src/services/neonSchema.ts` (NEON_SCHEMA_TABLES) — 34 جدولاً.
 * المخرج: `scripts/neon_typed_tables.sql`
 *
 * ⚠️ سبب وجود هذا الملف:
 *   دالة `buildCreateTableSql` الحالية تُنشئ الأعمدة المنمّطة + `payload` +
 *   `synced_at` فقط، **بدون**:
 *     • PRIMARY KEY على `id`  ⇒ فشل `ON CONFLICT (id)` في `tableStore`
 *     • `updated_at`          ⇒ فشل المزامنة التزايدية (`WHERE updated_at > $1`)
 *     • `deleted_at`          ⇒ فشل الحذف الناعم (`WHERE deleted_at IS NULL`)
 *     • `updated_by`          ⇒ لا أثر لِمن عدّل
 *
 *   بدون هذه الأعمدة لا يمكن للجداول المنمّطة أن تكون المصدر الوحيد للحقيقة.
 *
 * التشغيل: npx tsx scripts/generate_tables_migration.ts
 */

import { writeFileSync } from 'node:fs';
import { NEON_SCHEMA_TABLES } from '../src/services/neonSchema';

/** جداول عامّة (غير تابعة لمنشأة) — لا تحتوي عمود tenant_id. */
const GLOBAL_TABLES = new Set(['tenants']);

/** الأعمدة المُدارة — تُضاف لكل جدول بلا استثناء. */
const MANAGED_COLUMNS = [
  '  payload     JSONB',
  '  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()',
  '  updated_by  VARCHAR(150)',
  '  deleted_at  TIMESTAMPTZ',
  '  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()',
];

const lines: string[] = [];

lines.push(`-- ============================================================================
-- الجداول المنمّطة الكاملة — المصدر الوحيد للحقيقة
-- ============================================================================
-- ⚠️ مولَّد آلياً — لا تُحرّره يدوياً.
--    المصدر: src/services/neonSchema.ts (NEON_SCHEMA_TABLES)
--    التوليد: npx tsx scripts/generate_tables_migration.ts
--
-- الهدف: إنهاء الازدواجية — التطبيق يقرأ ويكتب **الجداول المنمّطة فقط**،
--        ويُلغى الاعتماد على مخزن المستندات (app_records / app_documents).
--
-- كل جدول يحتوي:
--   • الأعمدة المنمّطة (للاستعلام والفهرسة والتقارير)
--   • payload JSONB (السجل كامل — يمنع فقدان أي حقل متشعّب مثل journal lines)
--   • updated_at / deleted_at (للمزامنة التزايدية والحذف الناعم)
--   • updated_by (أثر رقابي)
--
-- متكرر بأمان (Idempotent) — لا يحذف أي بيانات.
-- ============================================================================

`);

let tableCount = 0;
let columnCount = 0;

for (const schema of NEON_SCHEMA_TABLES) {
  const table = schema.table;
  const isGlobal = GLOBAL_TABLES.has(table);
  const created = schema.columns.filter((c) => c.create);

  // لا نُكرّر أعمدة النظام إن وُجدت في التعريف
  // id يُذكر مرة واحدة كمفتاح أساسي — نستبعده من الأعمدة المنمّطة لتجنّب التكرار
  // أعمدة مُدارة تُضاف صراحةً — نستبعدها من التعريف لتجنّب التكرار
  const managed = new Set([
    'id', 'tenant_id', 'payload', 'updated_at', 'updated_by', 'deleted_at', 'synced_at',
  ]);
  const typed = created.filter((c) => !managed.has(c.name));

  const body: string[] = ['  id VARCHAR(200) PRIMARY KEY'];
  if (!isGlobal) body.push('  tenant_id VARCHAR(100) NOT NULL');
  typed.forEach((c) => body.push(`  ${c.name} ${c.type}`));
  MANAGED_COLUMNS.forEach((c) => body.push(c));

  lines.push(`-- ── ${table}${isGlobal ? ' (جدول عام)' : ''} ── ${schema.sourceKey}`);
  lines.push(`CREATE TABLE IF NOT EXISTS ${table} (\n${body.join(',\n')}\n);`);
  lines.push('');

  // الجداول الموجودة مسبقاً: نُكمل الأعمدة الناقصة بدل تجاهلها
  const alter: string[] = [];
  if (!isGlobal) {
    alter.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);`);
  }
  alter.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS payload JSONB;`);
  alter.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
  alter.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);`);
  alter.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`);
  alter.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
  lines.push(alter.join('\n'));

  // فهارس المزامنة: بدونها تتحول كل قراءة إلى Seq Scan
  lines.push(`CREATE INDEX IF NOT EXISTS ${table}_sync_idx ON ${table} (updated_at DESC) WHERE deleted_at IS NULL;`);
  if (!isGlobal) {
    lines.push(`CREATE INDEX IF NOT EXISTS ${table}_tenant_idx ON ${table} (tenant_id) WHERE deleted_at IS NULL;`);
  }
  lines.push(`CREATE INDEX IF NOT EXISTS ${table}_keyset_idx ON ${table} (id) WHERE deleted_at IS NULL;`);
  lines.push('');

  tableCount += 1;
  columnCount += body.length;
}

lines.push(`-- ============================================================================
-- تم بنجاح: ${tableCount} جدولاً · ${columnCount} عموداً.
--
-- الخطوة التالية: التطبيق يقرأ ويكتب هذه الجداول فقط.
-- ============================================================================
`);

writeFileSync('scripts/neon_typed_tables.sql', lines.join('\n'), 'utf8');
console.log(`تم التوليد: scripts/neon_typed_tables.sql`);
console.log(`  الجداول: ${tableCount}`);
console.log(`  إجمالي الأعمدة: ${columnCount}`);
