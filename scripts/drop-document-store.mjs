#!/usr/bin/env node
/**
 * إزالة مخزن المستندات — خطوة يدوية واعية
 * ---------------------------------------------------------------------------
 * ⚠️ هذا السكربت **يحذف جداول ودوال**، ولا يعمل إلا بموافقة صريحة:
 *
 *     node scripts/drop-document-store.mjs --i-have-a-backup
 *
 * بلا العلَم أعلاه: يعرض تقريراً بما سيُحذف ثم يتوقف.
 *
 * التحقق التلقائي قبل الحذف:
 *   1. كل سجل في `app_records` له نظير في جدوله المنمّط (مقارنة المعرّفات).
 *   2. أي سجل بلا نظير يوقف العملية ويُطبع للمراجعة.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSqlStatements } from './sqlSplitter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIRM_FLAG = '--i-have-a-backup';

/** خريطة doc_key → جدول (نسخة من server/src/datasetTables.ts). */
const DATASET_TABLE_MAP = {
  erp_tenants: 'tenants',
  erp_users: 'users',
  erp_branches: 'branches',
  erp_warehouses: 'warehouses',
  erp_categories: 'categories',
  erp_products: 'products',
  erp_stock_movements: 'stock_movements',
  erp_stock_levels: 'stock_levels',
  erp_accounts: 'accounts',
  erp_journals: 'journal_entries',
  erp_parties_backup: 'parties',
  erp_invoices: 'sales_invoices',
  erp_appointments: 'appointments',
  erp_patient_followups: 'patient_follow_ups',
  erp_treatment_plans: 'treatment_plans',
  erp_cash_receipts: 'cash_receipts',
  erp_customer_refunds: 'customer_refunds',
  erp_cash_payments: 'cash_payments',
  erp_reception_shifts: 'reception_shifts',
  erp_pos_shifts: 'pos_shifts',
  erp_payment_methods: 'payment_methods',
  erp_tax_invoices: 'specialized_tax_invoices',
  erp_goods_receipts: 'goods_receipts',
  erp_goods_issues: 'goods_issues',
  erp_staff_members: 'staff_members',
  erp_payroll_runs: 'payroll_runs',
  erp_attendance_records: 'attendance_records',
  erp_inventory_audits: 'inventory_audits',
  erp_device_maintenance: 'device_maintenance',
  clinic_laser_devices: 'laser_devices',
  erp_period_locks: 'period_locks',
  erp_audit_records: 'audit_records',
  erp_activity_logs: 'activity_logs',
  erp_notifications_history: 'notifications_history',
};

const connectionString =
  process.argv.find((a) => a.startsWith('postgres')) ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ مرّر رابط قاعدة البيانات كوسيط أو عبر NEON_DATABASE_URL.');
  process.exit(1);
}

const confirmed = process.argv.includes(CONFIRM_FLAG);

const main = async () => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString.trim());

  // ---------- 1) نسخة احتياطية إلزامية ----------
  console.log('=== 1) نسخة احتياطية ===');
  const backupDir = join(ROOT, 'docs', 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 10);
  let rows = [];
  try {
    rows = (await sql.query('SELECT * FROM app_records')) ?? [];
    const file = join(backupDir, `app_records-backup-${stamp}.json`);
    writeFileSync(file, JSON.stringify(rows, null, 1), 'utf8');
    console.log(`  ✅ ${rows.length} صف → ${file.replace(ROOT + '/', '')}`);
  } catch (error) {
    console.log(`  ℹ️  app_records غير موجود (${error.message.slice(0, 50)})`);
  }

  // ---------- 2) التحقق: كل سجل له نظير في الجدول المنمّط ----------
  console.log('\n=== 2) التحقق قبل الحذف ===');
  const orphans = [];

  for (const row of rows) {
    const table = DATASET_TABLE_MAP[row.doc_key];
    if (!table) {
      orphans.push(`${row.doc_key}/${row.record_id} — لا جدول معروف لهذه المجموعة`);
      continue;
    }
    const found = await sql.query(`SELECT 1 FROM ${table} WHERE id = $1`, [row.record_id]);
    if (!found || found.length === 0) {
      orphans.push(`${row.doc_key}/${row.record_id} — مفقود من جدول ${table}`);
    }
  }

  if (orphans.length > 0) {
    console.error(`\n⛔ توقّف: ${orphans.length} سجل بلا نظير في الجداول المنمّطة:`);
    orphans.forEach((o) => console.error(`   ✗ ${o}`));
    console.error('\nانقله أولاً، ثم أعد المحاولة. لم يُحذف أي شيء.');
    process.exit(1);
  }
  console.log(`  ✅ كل السجلات (${rows.length}) لها نظير في الجداول المنمّطة`);

  // ---------- 3) الحذف ----------
  if (!confirmed) {
    console.log('\n=== 3) جاهز للحذف — لم يُنفَّذ ===');
    console.log('  سيُحذف: app_records · app_documents · app_documents_history');
    console.log('  و: fn_login · fn_upsert_records · fn_soft_delete_records · fn_changed_records');
    console.log(`\n  للتنفيذ الفعلي:\n    node scripts/drop-document-store.mjs ${CONFIRM_FLAG}`);
    return;
  }

  console.log('\n=== 3) الحذف ===');
  const file = join(ROOT, 'scripts', 'neon_drop_document_store.sql');
  for (const statement of splitSqlStatements(readFileSync(file, 'utf8'))) {
    try {
      await sql.query(statement);
    } catch (error) {
      console.log(`  ⚠️  ${error.message.slice(0, 70)}`);
    }
  }
  console.log('  ✅ تم');

  // ---------- 4) تأكيد ----------
  console.log('\n=== 4) التأكيد ===');
  for (const name of ['app_records', 'app_documents', 'app_documents_history']) {
    const check = await sql.query(`SELECT to_regclass($1) AS t`, [`public.${name}`]);
    console.log(`  ${name.padEnd(24)} ${check?.[0]?.t ? '❌ لسه موجود' : '✅ محذوف'}`);
  }
  const users = await sql.query('SELECT count(*)::int c FROM users WHERE deleted_at IS NULL');
  console.log(`  جدول users (المصدر الجديد)  ${users?.[0]?.c} مستخدم ✅`);
};

main().catch((error) => {
  console.error('\n❌ فشل:', error.message);
  process.exit(1);
});