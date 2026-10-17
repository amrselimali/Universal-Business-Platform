/**
 * كتابة صفوف قاعدة البيانات (Rows CRUD) — محكومة ومُدقَّقة
 * ---------------------------------------------------------------------------
 * فُصلت من databaseExplorerApi التزاماً بحد 300 سطر: إدراج/تعديل/حذف عبر
 * المفتاح الأساسي + تسجيل كل عملية في db_admin_audit.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import { quoteIdentifier, quoteTable } from './databaseIdentifiers';
import type { DbOperationResult } from '../types/databaseExplorer';

const client = () => {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return null;
  return { sql: neon(connection.connectionString.trim()), tenantId: connection.tenantId };
};

/** تسجيل العملية في سجل التدقيق (أفضل جهد، لا يُفشل العملية). */
const audit = async (
  action: string,
  target: string,
  statement: string,
  payload?: Record<string, unknown>
): Promise<void> => {
  const ctx = client();
  if (!ctx) return;
  try {
    await ctx.sql.query(
      `INSERT INTO db_admin_audit (tenant_id, actor, action, target, statement, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [ctx.tenantId, 'db-explorer', action, target, statement.slice(0, 4000), JSON.stringify(payload ?? {})]
    );
  } catch {
    /* السجل غير موجود بعد — لا نُفشل العملية */
  }
};

const buildValues = (
  allowed: Set<string>,
  values: Record<string, unknown>
): { columns: string[]; params: unknown[] } => {
  const columns = Object.keys(values).filter((key) => allowed.has(key));
  return { columns, params: columns.map((column) => values[column]) };
};

/** إضافة صف. */
export async function insertRow(params: {
  schema: string;
  table: string;
  values: Record<string, unknown>;
  columns: string[];
}): Promise<DbOperationResult> {
  const ctx = client();
  if (!ctx) return { ok: false, message: 'no_database_connection' };
  try {
    const { columns, params: values } = buildValues(new Set(params.columns), params.values);
    if (columns.length === 0) return { ok: false, message: 'لا توجد أعمدة صالحة للإدخال.' };
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const statement = `INSERT INTO ${quoteTable(params.schema, params.table)} (${columns
      .map(quoteIdentifier)
      .join(', ')}) VALUES (${placeholders})`;
    const rows: any = await ctx.sql.query(`${statement} RETURNING *`, values);
    await audit('insert', `${params.schema}.${params.table}`, statement, { values: params.values });
    return { ok: true, affected: Array.isArray(rows) ? rows.length : 1 };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'insert_failed' };
  }
}

/** تعديل صف عبر المفتاح الأساسي. */
export async function updateRow(params: {
  schema: string;
  table: string;
  values: Record<string, unknown>;
  columns: string[];
  pk: Record<string, unknown>;
}): Promise<DbOperationResult> {
  const ctx = client();
  if (!ctx) return { ok: false, message: 'no_database_connection' };
  const pkColumns = Object.keys(params.pk);
  if (pkColumns.length === 0) return { ok: false, message: 'لا يوجد مفتاح أساسي لهذا الجدول — التعديل مرفوض.' };
  try {
    const { columns, params: values } = buildValues(new Set(params.columns), params.values);
    const assignments = columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`);
    if (assignments.length === 0) return { ok: false, message: 'لا توجد أعمدة صالحة للتعديل.' };
    const where = pkColumns
      .map((column, index) => `${quoteIdentifier(column)} = $${columns.length + index + 1}`)
      .join(' AND ');
    const statement = `UPDATE ${quoteTable(params.schema, params.table)} SET ${assignments.join(', ')} WHERE ${where}`;
    const rows: any = await ctx.sql.query(`${statement} RETURNING *`, [
      ...values,
      ...pkColumns.map((column) => params.pk[column]),
    ]);
    await audit('update', `${params.schema}.${params.table}`, statement, { pk: params.pk, values: params.values });
    return { ok: true, affected: Array.isArray(rows) ? rows.length : 1 };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'update_failed' };
  }
}

/** حذف صف عبر المفتاح الأساسي. */
export async function deleteRow(params: {
  schema: string;
  table: string;
  pk: Record<string, unknown>;
}): Promise<DbOperationResult> {
  const ctx = client();
  if (!ctx) return { ok: false, message: 'no_database_connection' };
  const pkColumns = Object.keys(params.pk);
  if (pkColumns.length === 0) return { ok: false, message: 'لا يوجد مفتاح أساسي — الحذف مرفوض (قد يحذف الجدول كاملاً).' };
  try {
    const where = pkColumns
      .map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`)
      .join(' AND ');
    const statement = `DELETE FROM ${quoteTable(params.schema, params.table)} WHERE ${where}`;
    const rows: any = await ctx.sql.query(`${statement} RETURNING *`, pkColumns.map((column) => params.pk[column]));
    await audit('delete', `${params.schema}.${params.table}`, statement, { pk: params.pk });
    return { ok: true, affected: Array.isArray(rows) ? rows.length : 1 };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'delete_failed' };
  }
}
