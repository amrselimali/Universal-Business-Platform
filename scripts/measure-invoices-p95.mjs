#!/usr/bin/env node
/**
 * قياس p95 لشريحة الفواتير (List / Summary / Detail)
 * ---------------------------------------------------------------------------
 * يشغّل الدوال الحقيقية عدة مرات ويحسب p50/p95/p99 ويقارنها بميزانية 200ms.
 *
 *   NEON_DATABASE_URL="postgresql://..." \
 *   node scripts/measure-invoices-p95.mjs --tenant tenant-eg-001 --iterations 60 --confirm
 *
 * الخروج بكود 1 إذا تجاوز p95 الميزانية (ليصلح للاستخدام في CI على staging).
 */

import { neon } from '@neondatabase/serverless';

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? String(args[index + 1] ?? fallback) : fallback;
};

const connectionString = process.env.NEON_DATABASE_URL || '';
const tenantId = arg('tenant');
const iterations = Math.min(Math.max(Number(arg('iterations', '60')) || 60, 5), 500);
const budget = Number(arg('budget', '200'));
const confirm = args.includes('--confirm');

if (!connectionString) { console.error('❌ مرّر NEON_DATABASE_URL'); process.exit(1); }
if (!tenantId) { console.error('❌ استخدم --tenant <id>'); process.exit(1); }
if (!confirm) { console.error('⚠️ القياس يقرأ من قاعدة البيانات. أضف --confirm للتشغيل.'); process.exit(1); }

const sql = neon(connectionString.trim());
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const time = async (label, run) => {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    try { await run(i); } catch (error) { console.error(`\n  ✗ ${label}: ${error?.message || error}`); process.exit(1); }
    samples.push(performance.now() - started);
  }
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const p99 = percentile(samples, 99);
  const ok = p95 <= budget;
  console.log(`  ${ok ? '✅' : '❌'} ${label.padEnd(26)} p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms  p99=${p99.toFixed(1)}ms`);
  return { label, p50, p95, p99, ok };
};

const main = async () => {
  console.log(`قياس شريحة الفواتير (${iterations} تكراراً لكل عملية) — الميزانية p95 ≤ ${budget}ms`);
  const summary = await sql.query(`SELECT fn_invoice_summary($1, NULL, NULL, NULL, NULL) AS s`, [tenantId]);
  const total = Number(summary?.[0]?.s?.count ?? 0);
  console.log(`  إجمالي الفواتير: ${total.toLocaleString('en-GB')}`);

  const listPlain = await time('list (بلا فلاتر)', () =>
    sql.query(`SELECT fn_invoice_list($1, NULL, NULL, NULL, NULL, 50, NULL, NULL) AS page`, [tenantId]));
  const listSearch = await time('list (بحث نصي)', (i) =>
    sql.query(`SELECT fn_invoice_list($1, $2, NULL, NULL, NULL, 50, NULL, NULL) AS page`, [tenantId, `INV-${String(100 + i).padStart(8, '0')}`]));
  const listStatus = await time('list (حالة + تاريخ)', () =>
    sql.query(`SELECT fn_invoice_list($1, NULL, CURRENT_DATE - 365, CURRENT_DATE, 'Paid', 50, NULL, NULL) AS page`, [tenantId]));
  const listSummary = await time('summary (عدّاد + مجاميع)', () =>
    sql.query(`SELECT fn_invoice_summary($1, NULL, CURRENT_DATE - 365, CURRENT_DATE, NULL) AS s`, [tenantId]));
  const detail = await time('detail (رأس + سطور)', (i) =>
    sql.query(`SELECT fn_invoice_detail($1, $2) AS d`, [tenantId, `seed-inv-${(i % 1000) + 1}`]));

  const results = [listPlain, listSearch, listStatus, listSummary, detail];
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${failed.length === 0 ? '✅ كل العمليات داخل الميزانية' : `❌ ${failed.length} عملية تجاوزت ${budget}ms`}`);
  process.exit(failed.length === 0 ? 0 : 1);
};

main().catch((error) => { console.error('❌ فشل القياس:', error?.message || error); process.exit(1); });
