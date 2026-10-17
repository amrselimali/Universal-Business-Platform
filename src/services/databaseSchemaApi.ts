/**
 * عمليات البنية (DDL) لمستكشف قاعدة البيانات
 * ---------------------------------------------------------------------------
 * فُصلت من `databaseExplorerApi.ts` التزاماً بحد 300 سطر. كل عملية:
 *   • تتحقق من الأسماء عبر databaseIdentifiers،
 *   • تتطلب تأكيداً نصياً للحذف (عمود/جدول)،
 *   • تُسجَّل في db_admin_audit.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import { assertConfirmation, assertIdentifier, isProtectedTable, quoteIdentifier, quoteTable } from './databaseIdentifiers';
import type { DbColumnDraft, DbOperationResult } from '../types/databaseExplorer';

const client = () => {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return null;
  return { sql: neon(connection.connectionString.trim()), tenantId: connection.tenantId };
};

const audit = async (action: string, target: string, statement: string, payload?: Record<string, unknown>): Promise<void> => {
  const ctx = client();
  if (!ctx) return;
  try {
    await ctx.sql.query(
      `INSERT INTO db_admin_audit (tenant_id, actor, action, target, statement, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [ctx.tenantId, 'db-explorer', action, target, statement.slice(0, 4000), JSON.stringify(payload ?? {})]
    );
  } catch { /* السجل غير موجود بعد */ }
};

const SQL_TYPES: Record<string, string> = {
  text: 'text',
  varchar: 'varchar',
  integer: 'integer',
  bigint: 'bigint',
  numeric: 'numeric(18,2)',
  boolean: 'boolean',
  date: 'date',
  timestamptz: 'timestamptz',
  uuid: 'uuid',
  jsonb: 'jsonb',
};

const columnSql = (column: DbColumnDraft): string => {
  const name = quoteIdentifier(column.name);
  let type = SQL_TYPES[column.type] ?? 'text';
  if (column.type === 'varchar' && column.length && column.length > 0) {
    type = `varchar(${Math.min(Math.max(Math.trunc(column.length), 1), 4000)})`;
  }
  const parts = [name, type];
  if (column.primaryKey) parts.push('PRIMARY KEY');
  if (!column.nullable && !column.primaryKey) parts.push('NOT NULL');
  if (column.defaultValue && column.defaultValue.trim()) {
    // القيم الافتراضية تُمرَّر كنص فقط (لا HTML/دوال) لتفادي الحقن
    if (!/^[\w\s.\-:()'"]{1,200}$/.test(column.defaultValue)) {
      throw new Error(`قيمة افتراضية غير صالحة: ${column.defaultValue}`);
    }
    parts.push(`DEFAULT ${column.defaultValue}`);
  }
  return parts.join(' ');
};

/** إنشاء جدول جديد (DDL). */
export async function createTable(params: {
  schema: string;
  table: string;
  columns: DbColumnDraft[];
}): Promise<DbOperationResult> {
  const ctx = client();
  if (!ctx) return { ok: false, message: 'no_database_connection' };
  try {
    if (params.columns.length === 0) return { ok: false, message: 'أضف عموداً واحداً على الأقل.' };
    const names = new Set<string>();
    params.columns.forEach((column) => {
      assertIdentifier(column.name, 'اسم العمود', 'column');
      if (names.has(column.name)) throw new Error(`عمود مكرر: ${column.name}`);
      names.add(column.name);
    });
    const statement = `CREATE TABLE ${quoteTable(params.schema, params.table)} (${params.columns
      .map(columnSql)
      .join(', ')})`;
    await ctx.sql.query(statement);
    await audit('ddl', `${params.schema}.${params.table}`, statement, { columns: params.columns });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'create_table_failed' };
  }
}

/** إضافة عمود لجدول قائم (DDL). */
export async function addColumn(params: {
  schema: string;
  table: string;
  column: DbColumnDraft;
}): Promise<DbOperationResult> {
  const ctx = client();
  if (!ctx) return { ok: false, message: 'no_database_connection' };
  try {
    const statement = `ALTER TABLE ${quoteTable(params.schema, params.table)} ADD COLUMN ${columnSql({
      ...params.column,
      primaryKey: false,
    })}`;
    await ctx.sql.query(statement);
    await audit('ddl', `${params.schema}.${params.table}.${params.column.name}`, statement, params.column as any);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'add_column_failed' };
  }
}

/** حذف عمود — يتطلب كتابة `table.column` للتأكيد. */
export async function dropColumn(params: {
  schema: string;
  table: string;
  column: string;
  confirm: string;
}): Promise<DbOperationResult> {
  const ctx = client();
  if (!ctx) return { ok: false, message: 'no_database_connection' };
  try {
    assertConfirmation(params.confirm, `${params.table}.${params.column}`);
    const statement = `ALTER TABLE ${quoteTable(params.schema, params.table)} DROP COLUMN ${quoteIdentifier(params.column)}`;
    await ctx.sql.query(statement);
    await audit('ddl', `${params.schema}.${params.table}.${params.column}`, statement);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'drop_column_failed' };
  }
}

/** حذف جدول — يتطلب كتابة `schema.table` (وإلا `DROP table` للجداول الحرجة). */
export async function dropTable(params: {
  schema: string;
  table: string;
  confirm: string;
}): Promise<DbOperationResult> {
  const ctx = client();
  if (!ctx) return { ok: false, message: 'no_database_connection' };
  try {
    const expected = isProtectedTable(params.table)
      ? `DROP ${params.table}`
      : `${params.schema}.${params.table}`;
    assertConfirmation(params.confirm, expected);
    const statement = `DROP TABLE ${quoteTable(params.schema, params.table)}`;
    await ctx.sql.query(statement);
    await audit('ddl', `${params.schema}.${params.table}`, statement);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'drop_table_failed' };
  }
}
