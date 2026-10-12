import { neon } from '@neondatabase/serverless';

/**
 * Database access layer.
 *
 * The API is the ONLY component that talks to Postgres. Every write runs inside a
 * single transaction that first sets `app.tenant_id` (so Row-Level Security applies)
 * and uses the limited `app_api` role (no DDL, cannot bypass RLS).
 */

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  throw new Error('NEON_DATABASE_URL is required (use the limited app_api role, never the owner)');
}

const sql: any = neon(connectionString);

export interface Statement {
  text: string;
  params?: unknown[];
}

/**
 * Executes several statements atomically with the tenant set for RLS.
 * Returns the results of the supplied statements (the SET is not returned).
 */
export async function withTenant(tenantId: string, statements: Statement[]): Promise<any[]> {
  if (!tenantId) throw new Error('A tenant id is required for every database operation');
  if (statements.length === 0) return [];
  const queries = [
    sql.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]),
    ...statements.map((statement) => sql.query(statement.text, statement.params ?? [])),
  ];
  const results = await sql.transaction(queries);
  return results.slice(1);
}

/** Single statement with the tenant set (most endpoints need exactly one). */
export async function one<T = any>(tenantId: string, text: string, params: unknown[] = []): Promise<T> {
  const results = await withTenant(tenantId, [{ text, params }]);
  const rows = results[0];
  return rows as T;
}

/** Read-only helper for statements that do not depend on the tenant (health checks). */
export async function rawQuery<T = any>(text: string, params: unknown[] = []): Promise<T> {
  return (await sql.query(text, params)) as T;
}

export { sql };
