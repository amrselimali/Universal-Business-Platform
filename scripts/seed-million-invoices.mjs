#!/usr/bin/env node
/**
 * توليد فواتير وسطور للقياس على مليون صف (Seed 1M invoices)
 * ---------------------------------------------------------------------------
 * ينفّذ الإدخال داخل قاعدة البيانات بـ generate_series (سريع جداً، بلا نقل صفوف
 * عبر الشبكة). يتطلب نيّة صريحة:
 *
 *   NEON_DATABASE_URL="postgresql://..." \
 *   node scripts/seed-million-invoices.mjs --tenant tenant-eg-001 --rows 1000000 --confirm
 *
 * اختياري: --lines 2 (عدد السطور لكل فاتورة) · --batch 100000 · --clean
 */

import { neon } from '@neondatabase/serverless';

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? String(args[index + 1] ?? fallback) : fallback;
};

const connectionString = process.env.NEON_DATABASE_URL || '';
const tenantId = arg('tenant');
const rows = Number(arg('rows', '0'));
const linesPerInvoice = Math.max(Number(arg('lines', '2')) || 2, 1);
const batch = Math.min(Math.max(Number(arg('batch', '100000')) || 100000, 1000), 200000);
const confirm = args.includes('--confirm');
const clean = args.includes('--clean');

if (!connectionString) { console.error('❌ مرّر NEON_DATABASE_URL'); process.exit(1); }
if (!tenantId || !Number.isFinite(rows) || rows <= 0) { console.error('❌ استخدم --tenant <id> --rows <n> --confirm'); process.exit(1); }
if (!confirm) { console.error(`⚠️ سيتم إدخال ${rows} فاتورة في ${tenantId}. أضف --confirm.`); process.exit(1); }

const sql = neon(connectionString.trim());
const started = Date.now();

const cleanDemo = async () => {
  await sql.query("DELETE FROM invoice_lines WHERE tenant_id = $1 AND invoice_id LIKE 'seed-inv-%'", [tenantId]);
  await sql.query("DELETE FROM sales_invoices WHERE tenant_id = $1 AND id LIKE 'seed-inv-%'", [tenantId]);
  console.log('🧹 حُذفت بيانات القياس السابقة');
};

const insertInvoices = async (from, to) => sql.query(
  `INSERT INTO sales_invoices
     (id, tenant_id, invoice_number, net_amount, invoice_date, status, customer_id, customer_name, tax_amount, created_at, payload)
   SELECT 'seed-inv-' || g,
          $1,
          'INV-' || lpad(g::text, 8, '0'),
          round((100 + (g % 9000))::numeric, 2),
          (CURRENT_DATE - ((g % 1095))::int),
          (ARRAY['Paid','PartiallyPaid','Cancelled'])[1 + (g % 3)],
          'cust-' || (g % 20000),
          'عميل تجريبي ' || (g % 20000),
          round(((g % 500))::numeric, 2),
          NOW() - ((g % 500000) || ' minutes')::interval,
          jsonb_build_object('demo_seed', true, 'invoiceNumber', 'INV-' || lpad(g::text, 8, '0'))
     FROM generate_series($2::bigint, $3::bigint) AS g
   ON CONFLICT (id) DO NOTHING`,
  [tenantId, from, to]
);

const insertLines = async (from, to) => sql.query(
  `INSERT INTO invoice_lines
     (tenant_id, invoice_id, line_no, product_id, product_name, quantity, unit_price, discount, tax, line_total)
   SELECT $1,
          'seed-inv-' || g,
          l.n,
          'prod-' || ((g + l.n) % 500),
          'صنف تجريبي ' || ((g + l.n) % 500),
          (1 + ((g + l.n) % 3)),
          round((50 + ((g + l.n) % 400))::numeric, 2),
          0,
          round(((g % 50))::numeric, 2),
          round((50 + ((g + l.n) % 400))::numeric * (1 + ((g + l.n) % 3)), 2)
     FROM generate_series($2::bigint, $3::bigint) AS g
     CROSS JOIN generate_series(1, $4::int) AS l(n)
   ON CONFLICT (tenant_id, invoice_id, line_no) DO NOTHING`,
  [tenantId, from, to, linesPerInvoice]
);

const main = async () => {
  if (clean) await cleanDemo();
  for (let done = 0; done < rows; done += batch) {
    const from = done + 1;
    const to = Math.min(done + batch, rows);
    const t0 = Date.now();
    await insertInvoices(from, to);
    await insertLines(from, to);
    const rate = Math.round((to - from + 1) / Math.max((Date.now() - t0) / 1000, 0.001));
    process.stdout.write(`\r  ${to}/${rows} فاتورة (${rate}/ث)   `);
  }
  console.log(`\n✅ ${rows} فاتورة + ${rows * linesPerInvoice} سطراً في ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log('   التالي: node scripts/measure-invoices-p95.mjs --tenant ' + tenantId + ' --confirm');
};

main().catch((error) => { console.error('\n❌ فشل التوليد:', error?.message || error); process.exit(1); });
