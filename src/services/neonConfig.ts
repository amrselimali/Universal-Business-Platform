/**
 * إعدادات اتصال قاعدة بيانات Neon PostgreSQL السحابية
 * ---------------------------------------------------------------------------
 * يوفر الرابط الافتراضي الفعّال ودوال فحص ومعالجة الروابط لضمان اتصال موثوق
 * بين واجهة التطبيق والـ Neon Database.
 */

export const DEFAULT_NEON_CONNECTION_STRING =
  'postgresql://neondb_owner:npg_rPVi0Rf4vuFB@ep-twilight-glitter-b9w0wh2i-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export function isNeonPlaceholder(conn?: string | null): boolean {
  if (!conn) return true;
  const trimmed = conn.trim();
  return (
    trimmed.length === 0 ||
    trimmed.includes('ep-cool-snowflake-12345') ||
    trimmed.includes('ep-cool-12345') ||
    trimmed.includes('user:pass@')
  );
}

export function getEffectiveNeonConnectionString(): string {
  try {
    const rawCfg = localStorage.getItem('erp_neon_cfg');
    if (rawCfg) {
      const parsed = JSON.parse(rawCfg);
      const conn = String(parsed?.connectionString || '').trim();
      if (
        (conn.startsWith('postgres://') || conn.startsWith('postgresql://')) &&
        !isNeonPlaceholder(conn)
      ) {
        return conn;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_NEON_CONNECTION_STRING;
}
