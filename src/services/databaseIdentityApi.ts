/**
 * هوية اتصال قاعدة البيانات — تشخيص «لماذا البيانات مختلفة عن نيون؟»
 * ---------------------------------------------------------------------------
 * تُظهر المستخدم وقاعدة البيانات والمضيف الفعليين. كثير من حالات «الجداول لا
 * تعرض نفس البيانات» سببها اتصال بدور محدود (RLS) أو قاعدة بيانات أخرى.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import type { DbConnectionIdentity } from '../types/databaseExplorer';

export async function loadConnectionIdentity(): Promise<DbConnectionIdentity | null> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return null;
  const sql = neon(connection.connectionString.trim());
  try {
    const rows: any = await sql.query(
      `SELECT current_user AS user, current_database() AS database,
              COALESCE(inet_server_addr()::text, '') AS host,
              current_setting('search_path') AS search_path`
    );
    const row = rows?.[0] ?? {};
    return {
      user: String(row.user ?? ''),
      database: String(row.database ?? ''),
      host: String(row.host ?? ''),
      searchPath: String(row.search_path ?? ''),
    };
  } catch {
    return null;
  }
}
