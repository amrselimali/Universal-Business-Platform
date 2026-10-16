import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DATASET_TABLE_MAP,
  GLOBAL_DATASETS,
  MANAGED_COLUMNS,
  isTenantScoped,
  resolveTable,
} from '../datasetTables.js';

/**
 * اختبارات خريطة مجموعات البيانات → الجداول المنمّطة.
 *
 * الأهمية:
 *   • `docKey` غير معروف ⇒ 404 (لا جدول عشوائي).
 *   • `resolveTable` هي **خط الدفاع ضد SQL Injection** لأسماء الجداول
 *     (لا يمكن تمريرها كمعاملات SQL عادية).
 *   • الخريطة نسخة من `src/services/neonSchema.ts` — الاختبار يقارنها بالأصل
 *     ويكشف أي انحراف فوراً.
 */

const UI_SCHEMA_PATH = join(process.cwd(), '..', 'src', 'services', 'neonSchema.ts');

describe('resolveTable — الأمان', () => {
  it('يُرجع الجدول الصحيح لمجموعة معروفة', () => {
    expect(resolveTable('erp_parties_backup')).toBe('parties');
    expect(resolveTable('erp_branches')).toBe('branches');
    expect(resolveTable('erp_tenants')).toBe('tenants');
    expect(resolveTable('clinic_laser_devices')).toBe('laser_devices');
  });

  it('يرفض مجموعة غير معروفة (404 لا جدول عشوائي)', () => {
    expect(resolveTable('erp_unknown')).toBeNull();
    expect(resolveTable('')).toBeNull();
    expect(resolveTable('users')).toBeNull(); // اسم جدول لا doc_key
  });

  it('يرفض محاولات حقن SQL', () => {
    const attacks = [
      "erp_parties_backup; DROP TABLE parties; --",
      "parties WHERE 1=1",
      "parties'--",
      'parties"',
      'erp_x UNION SELECT password FROM users',
    ];
    attacks.forEach((attack) => expect(resolveTable(attack)).toBeNull());
  });

  it('كل الجداول المُرجَعة مطابقة لصيغة معرّف صالح', () => {
    Object.keys(DATASET_TABLE_MAP).forEach((docKey) => {
      const table = resolveTable(docKey);
      expect(table, docKey).not.toBeNull();
      expect(/^[a-z_][a-z0-9_]*$/.test(table!), `${docKey} → ${table}`).toBe(true);
    });
  });
});

describe('عزل المستأجرين', () => {
  it('tenants جدول عام (بلا tenant_id)', () => {
    expect(isTenantScoped('erp_tenants')).toBe(false);
    expect(GLOBAL_DATASETS.has('erp_tenants')).toBe(true);
  });

  it('كل بقية المجموعات تابعة لمنشأة', () => {
    const nonGlobal = Object.keys(DATASET_TABLE_MAP).filter((k) => k !== 'erp_tenants');
    nonGlobal.forEach((k) => expect(isTenantScoped(k), k).toBe(true));
  });
});

describe('اتساق الخريطة مع الواجهة', () => {
  it('عدد المجموعات لا يقل عن 34', () => {
    expect(Object.keys(DATASET_TABLE_MAP).length).toBeGreaterThanOrEqual(34);
  });

  it('لا يوجد doc_key مكرر', () => {
    const keys = Object.keys(DATASET_TABLE_MAP);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('لا يوجد جدول مرتبط بمجموعتين مختلفتين', () => {
    const tables = Object.values(DATASET_TABLE_MAP);
    const duplicates = tables.filter((t, i) => tables.indexOf(t) !== i);
    expect(duplicates, `جداول مكررة: ${duplicates.join(', ')}`).toEqual([]);
  });
});

describe('تطابق الخريطة مع الخريطة المصدرية في الواجهة', () => {
  it('كل docKey في الواجهة موجود في خريطة السيرفر (وإن لم يكن، يُوثَّق)', () => {
    const source = readFileSync(UI_SCHEMA_PATH, 'utf8');
    const pairs = [...source.matchAll(/\{\s*table:\s*'([a-z_]+)',\s*sourceKey:\s*'([a-z_]+)'/g)].map(
      (m) => ({ table: m[1], sourceKey: m[2] })
    );

    expect(pairs.length).toBeGreaterThanOrEqual(34);

    const mismatches = pairs
      .filter(({ table, sourceKey }) => DATASET_TABLE_MAP[sourceKey] !== table)
      .map(({ table, sourceKey }) => `${sourceKey} → ${DATASET_TABLE_MAP[sourceKey] ?? 'غير موجود'} (المتوقع ${table})`);

    expect(
      mismatches,
      `انحراف بين خريطة السيرفر والواجهة:\n${mismatches.join('\n')}`
    ).toEqual([]);
  });
});

describe('MANAGED_COLUMNS', () => {
  it('تحتوي كل أعمدة النظام التي لا يجوز للعميل كتابتها', () => {
    ['id', 'tenant_id', 'payload', 'updated_at', 'updated_by', 'deleted_at', 'synced_at'].forEach(
      (col) => expect(MANAGED_COLUMNS.has(col), col).toBe(true)
    );
  });
});

describe('ملف مصادقة الدوال', () => {
  it('يحتوي تعريف الدالة الجديدة وأوامر قابلة للتنفيذ', () => {
    const sql = readFileSync(join(process.cwd(), '..', 'scripts', 'neon_auth_functions.sql'), 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION fn_authenticate_user');
    expect(sql).toContain('RETURNS TABLE');
    expect(sql.split(';').filter((part) => part.trim().length > 0).length).toBeGreaterThan(2);
  });

  it('الدالة SECURITY DEFINER وتُعيد حقولاً محدّدة فقط (لا SELECT *)', () => {
    const sql = readFileSync(join(process.cwd(), '..', 'scripts', 'neon_auth_functions.sql'), 'utf8');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path');
    // لا SELECT * في الأوامر الفعلية (نتجاهل التعليقات)
    const executable = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(executable).not.toMatch(/SELECT\s+\*/i);
  });

  it('تحذف الدالة القديمة fn_login التي كانت تقرأ من مخزن المستندات', () => {
    const sql = readFileSync(join(process.cwd(), '..', 'scripts', 'neon_auth_functions.sql'), 'utf8');
    expect(sql).toContain('DROP FUNCTION IF EXISTS fn_login');
  });
});