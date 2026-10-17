#!/usr/bin/env node
/**
 * توليد فواتير تجريبية للقياس (Seed demo invoices)
 * ---------------------------------------------------------------------------
 * الغرض: قياس شاشة «الفواتير — عرض سريع» على أحجام حقيقية (10k / 50k صف).
 *
 * ⚠️ يكتب بيانات في قاعدة البيانات — لذلك يتطلب تأكيداً صريحاً:
 *   NEON_DATABASE_URL="postgresql://..." node scripts/seed-demo-invoices.mjs \
 *     --tenant tenant-eg-001 --rows 10000 --confirm
 *
 * اختياري: --clean  لحذف الصفوف الموسومة بـ demo_seed=true قبل/بعد القياس.
 */

import { neon } from '@neondatabase/serverless';

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? String(args[index + 1] ?? fallback) : fallback;
};

const connectionString = process.env.NEON_DATABASE_URL || '';
const tenantId = getArg('tenant');
const rows = Number(getArg('rows', '0'));
const confirmed = args.includes('--confirm');
const clean = args.includes('--clean');

if (!connectionString) {
  console.error('❌ مرّر NEON_DATABASE_URL');
  process.exit(1);
}
if (!tenantId || !Number.isFinite(rows) || rows <= 0) {
  console.error('❌ استخدم: --tenant <id> --rows <n> --confirm');
  process.exit(1);
}
if (!confirmed) {
  console.error(`⚠️ سيتم إدخال ${rows} فاتورة تجريبية في المنشأة ${tenantId}. أضف --confirm للمتابعة.`);
  process.exit(1);
}

const sql = neon(connectionString.trim());
const BATCH = 500;

const cleanDemo = async () => {
  const result = await sql.query(
    `DELETE FROM sales_invoices WHERE tenant_id = $1 AND payload->>'demo_seed' = 'true'`,
    [tenantId]
  );
  console.log(`🧹 حُذف ${Array.isArray(result) ? result.length : 0} صفاً تجريبياً سابقاً.`);
};

const insertBatch = async (start, count) => {
  const values = [];
  const params = [];
  let p = 1;
  for (let i = 0; i < count; i += 1) {
    const index = start + i;
    const id = `demo-inv-${String(index).padStart(8, '0')}`;
    const date = new Date(Date.now() - index * 60_000).toISOString();
    const payload = {
      id,
      invoiceNumber: `INV-DEMO-${String(index).padStart(7, '0')}`,
      customerName: `عميل تجريبي ${index % 2000}`,
      createdAt: date,
      invoiceDate: date.slice(0, 10),
      total: 100 + (index % 900),
      taxAmount: 14,
      status: index % 97 === 0 ? 'Cancelled' : 'Paid',
      demo_seed: true,
    };
    values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}::jsonb)`);
    params.push(id, tenantId, `INV-DEMO-${String(index).padStart(7, '0')}`, payload.total, JSON.stringify(payload));
  }

  await sql.query(
    `INSERT INTO sales_invoices (id, tenant_id, invoice_number, net_amount, payload)
     VALUES ${values.join(', ')}
     ON CONFLICT (id) DO NOTHING`,
    params
  );
};

const main = async () => {
  if (clean) {
    await cleanDemo();
    if (args.indexOf('--clean') === args.length - 1) return;
  }

  const started = Date.now();
  for (let done = 0; done < rows; done += BATCH) {
    const count = Math.min(BATCH, rows - done);
    await insertBatch(done, count);
    process.stdout.write(`\r  أُدرج ${done + count}/${rows}`);
  }
  console.log(`\n✅ ${rows} فاتورة تجريبية في ${Date.now() - started}ms`);
  console.log('   للقياس: افتح «الفواتير — عرض سريع» ثم «قياس التحميل».');
};

main().catch((error) => {
  console.error('❌ فشل التوليد:', error?.message || error);
  process.exit(1);
});
