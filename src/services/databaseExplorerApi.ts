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
        `SELECT n.nspname AS schema, c.relname AS name, c.relkind,
                c.relrowsecurity AS rls, c.reltuples::bigint AS rows
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
        rlsEnabled: Boolean(row.rls),
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

/**
 * يقرأ صفوف جدول/عرض بسرعة.
 * ---------------------------------------------------------------------------
 * تحسينات الأداء (بناءً على ملاحظة المالك «كل الأعمدة وكل الصفوف بسرعة»):
 *   • «كل الصفوف» يقرأ حتى 5000 صف **بلا `count(*)`** (المسح الكامل هو سبب البطء).
 *   • لا استعلامات أعمدة/مفاتيح مع كل صفحة: الكتالوج محمّل مسبقاً من pg_attribute.
 *   • الصفحات العادية تقرأ الصفوف والعدد بالتوازي.
 */
const ALL_ROWS_CAP = 5000;

export async function fetchTableRows(params: {
  schema: string;
  table: string;
  limit?: number;
  offset?: number;
  /** تجاوز RLS لعرض كل الصفوف — يتطلب دوراً مالكاً أو BYPASSRLS. */
  bypassRls?: boolean;
}): Promise<DbRowPage> {
  const ctx = client();
  if (!ctx) return { rows: [], total: 0, limit: 0, offset: 0, error: 'no_database_connection' };

  const isAll = params.limit === 0 || params.limit === -1;
  const limit = isAll ? ALL_ROWS_CAP : Math.min(Math.max(params.limit ?? 100, 1), ALL_ROWS_CAP);
  const offset = isAll ? 0 : Math.max(params.offset ?? 0, 0);
  const table = quoteTable(params.schema, params.table);
  const select = isAll
    ? `SELECT * FROM ${table} LIMIT ${ALL_ROWS_CAP}`
    : `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`;

  if (params.bypassRls) {
    try {
      const [rowsResult, countResult] = await ctx.sql.transaction((tx) => [
        tx.query('SET LOCAL row_security = off'),
        tx.query(select),
        ...(isAll ? [] : [tx.query(`SELECT count(*)::bigint AS total FROM ${table}`)]),
      ]);
      const rows = Array.isArray(rowsResult) ? rowsResult : [];
      const totalRow: any = Array.isArray(countResult) ? countResult[0] : countResult;
      return {
        rows,
        total: isAll ? rows.length : num(totalRow?.total),
        limit: isAll ? 0 : limit,
        offset,
        bypassed: true,
        truncated: isAll && rows.length >= ALL_ROWS_CAP,
      };
    } catch (error: any) {
      return {
        rows: [], total: 0, limit, offset,
        bypassed: false,
        bypassError: error?.message || 'rls_bypass_failed',
        error: error?.message || 'rls_bypass_failed',
      };
    }
  }

  try {
    if (isAll) {
      // استعلام واحد فقط: أسرع مسار لعرض كل الصفوف
      const rows: any = await ctx.sql.query(select);
      const list = Array.isArray(rows) ? rows : [];
      return {
        rows: list,
        total: list.length,
        limit: 0,
        offset,
        truncated: list.length >= ALL_ROWS_CAP,
      };
    }

    const [rows, totalRows]: [any, any] = await Promise.all([
      ctx.sql.query(select),
      ctx.sql.query(`SELECT count(*)::bigint AS total FROM ${table}`),
    ]);
    const list = Array.isArray(rows) ? rows : [];
    return { rows: list, total: num(totalRows?.[0]?.total), limit, offset };
  } catch (error: any) {
    return { rows: [], total: 0, limit, offset, error: error?.message || 'rows_failed' };
  }
}
