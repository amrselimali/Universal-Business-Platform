/**
 * خدمة مستكشف قاعدة البيانات — قراءة البنية والبيانات + كتابة محكومة
 * ---------------------------------------------------------------------------
 * كل شيء يمر عبر `getActiveDbConnection` (نفس اتصال التطبيق)، وكل اسم يُتحقق
 * منه عبر `databaseIdentifiers` قبل أي بناء SQL. الأخطاء تُعاد كنص واضح.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import {
  assertConfirmation,
  assertIdentifier,
  isProtectedTable,
  quoteIdentifier,
  quoteTable,
} from './databaseIdentifiers';
import type {
  DbCatalog,
  DbColumn,
  DbColumnDraft,
  DbOperationResult,
  DbRowPage,
  DbTable,
} from '../types/databaseExplorer';

const client = () => {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return null;
  return { sql: neon(connection.connectionString.trim()), tenantId: connection.tenantId };
};

const num = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0);
const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const EXCLUDED_SCHEMAS = "('pg_catalog','information_schema','pg_toast')";

/** يحمّل المخططات والجداول والأعمدة والمفاتيح وتقدير عدد الصفوف. */
export async function loadDatabaseCatalog(): Promise<DbCatalog> {
  const ctx = client();
  if (!ctx) return { tables: [], schemas: [], error: 'no_database_connection' };

  try {
    const [tableRows, columnRows, pkRows] = await Promise.all([
      ctx.sql.query(
        `SELECT n.nspname AS schema, c.relname AS name, c.relkind, c.reltuples::bigint AS rows
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r','p','v','m')
            AND n.nspname NOT IN ${EXCLUDED_SCHEMAS}
          ORDER BY n.nspname, c.relname`
      ),
      ctx.sql.query(
        `SELECT n.nspname AS schema, c.relname AS name, a.attname AS column_name,
                format_type(a.atttypid, a.atttypmod) AS data_type,
                NOT a.attnotnull AS is_nullable,
                pg_get_expr(d.adbin, d.adrelid) AS column_default,
                a.attidentity != '' AS is_identity,
                a.attnum AS ordinal_position
           FROM pg_attribute a
           JOIN pg_class c ON c.oid = a.attrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attnum > 0 AND NOT a.attisdropped
            AND n.nspname NOT IN ${EXCLUDED_SCHEMAS}
          ORDER BY n.nspname, c.relname, a.attnum`
      ),
      ctx.sql.query(
        `SELECT tc.table_schema AS schema, tc.table_name AS name, kcu.column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON kcu.constraint_name = tc.constraint_name
            AND kcu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema NOT IN ${EXCLUDED_SCHEMAS}`
      ),
    ]);

    const tables = new Map<string, DbTable>();
    (Array.isArray(tableRows) ? tableRows : []).forEach((row: any) => {
      const key = `${row.schema}.${row.name}`;
      tables.set(key, {
        schema: str(row.schema),
        name: str(row.name),
        kind: row.relkind === 'v' || row.relkind === 'm' ? 'view' : 'table',
        estimatedRows: Math.max(num(row.rows), 0),
        columns: [],
        primaryKey: [],
      });
    });

    (Array.isArray(columnRows) ? columnRows : []).forEach((row: any) => {
      const table = tables.get(`${row.schema}.${row.name}`);
      if (!table) return;
      table.columns.push({
        name: str(row.column_name),
        dataType: str(row.data_type),
        nullable: Boolean(row.is_nullable),
        defaultValue: str(row.column_default) || undefined,
        isPrimaryKey: false,
        isIdentity: Boolean(row.is_identity),
        ordinal: num(row.ordinal_position),
      } as DbColumn);
    });

    (Array.isArray(pkRows) ? pkRows : []).forEach((row: any) => {
      const table = tables.get(`${row.schema}.${row.name}`);
      if (!table) return;
      const column = str(row.column_name);
      table.primaryKey.push(column);
      const target = table.columns.find((item) => item.name === column);
      if (target) target.isPrimaryKey = true;
    });

    const list = [...tables.values()];
    return {
      tables: list,
      schemas: [...new Set(list.map((table) => table.schema))].sort(),
    };
  } catch (error: any) {
    return { tables: [], schemas: [], error: error?.message || 'catalog_failed' };
  }
}

/** يقرأ صفحة صفوف من جدول/عرض مع العدد الكلي وكافة الأعمدة والمفاتيح الحية. */
export async function fetchTableRows(params: {
  schema: string;
  table: string;
  limit?: number;
  offset?: number;
}): Promise<DbRowPage> {
  const ctx = client();
  if (!ctx) return { rows: [], total: 0, limit: 0, offset: 0, error: 'no_database_connection' };

  const isAll = params.limit === 0 || params.limit === -1;
  const limit = isAll ? 50000 : Math.min(Math.max(params.limit ?? 50, 1), 50000);
  const offset = isAll ? 0 : Math.max(params.offset ?? 0, 0);

  try {
    const table = quoteTable(params.schema, params.table);
    const query = isAll
      ? `SELECT * FROM ${table} LIMIT 50000`
      : `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`;

    const [rows, totalRows, colRows, pkRows]: [any, any, any, any] = await Promise.all([
      ctx.sql.query(query),
      ctx.sql.query(`SELECT count(*)::bigint AS total FROM ${table}`),
      ctx.sql.query(
        `SELECT a.attname AS column_name,
                format_type(a.atttypid, a.atttypmod) AS data_type,
                NOT a.attnotnull AS is_nullable,
                pg_get_expr(d.adbin, d.adrelid) AS column_default,
                a.attidentity != '' AS is_identity,
                a.attnum AS ordinal_position
           FROM pg_attribute a
           JOIN pg_class c ON c.oid = a.attrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum`,
        [params.schema, params.table]
      ),
      ctx.sql.query(
        `SELECT kcu.column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2`,
        [params.schema, params.table]
      ),
    ]);

    const primaryKey: string[] = (Array.isArray(pkRows) ? pkRows : []).map((r: any) => str(r.column_name)).filter(Boolean);
    const colMap = new Map<string, DbColumn>();

    (Array.isArray(colRows) ? colRows : []).forEach((r: any) => {
      const name = str(r.column_name);
      colMap.set(name, {
        name,
        dataType: str(r.data_type),
        nullable: Boolean(r.is_nullable),
        defaultValue: str(r.column_default) || undefined,
        isPrimaryKey: primaryKey.includes(name),
        isIdentity: Boolean(r.is_identity),
        ordinal: num(r.ordinal_position),
      });
    });

    // كشف أي أعمدة إضافية في الصفوف الناتجة (للجداول أو العروض الديناميكية)
    const rowList = Array.isArray(rows) ? rows : [];
    rowList.forEach((row) => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach((k) => {
          if (!colMap.has(k)) {
            const val = (row as any)[k];
            colMap.set(k, {
              name: k,
              dataType: typeof val === 'number' ? 'numeric' : typeof val === 'boolean' ? 'boolean' : typeof val === 'object' ? 'jsonb' : 'text',
              nullable: true,
              isPrimaryKey: k === 'id' || primaryKey.includes(k),
              isIdentity: false,
              ordinal: colMap.size + 1,
            });
          }
        });
      }
    });

    const columns = [...colMap.values()];

    return {
      rows: rowList,
      total: num(totalRows?.[0]?.total),
      limit: isAll ? rowList.length : limit,
      offset,
      columns,
      primaryKey,
    };
  } catch (error: any) {
    return { rows: [], total: 0, limit, offset, error: error?.message || 'rows_failed' };
  }
}

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
