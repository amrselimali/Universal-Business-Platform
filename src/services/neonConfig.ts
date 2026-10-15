/**
 * إعدادات اتصال قاعدة بيانات Neon PostgreSQL السحابية
 * ---------------------------------------------------------------------------
 * ⚠️ تحذير أمني مهم:
 *   لا يجوز كتابة رابط اتصال قاعدة البيانات (فيه المستخدم وكلمة المرور) داخل
 *   الكود المصدري إطلاقاً. المستودع عام، وأي رابط مكتوب هنا يُصبح مرئياً
 *   للعالم، ويُحزَّم أيضاً داخل ملفات الموقع المنشور.
 *
 *   المصدر الوحيد المسموح لرابط الاتصال هو:
 *     1. إعدادات المستخدم داخل التطبيق (`localStorage['erp_neon_cfg']`)
 *     2. أو متغيّر بيئة وقت البناء (`VITE_NEON_URL`) للبيئات المطوَّرة
 *
 *   يجب أن يُستخدم دائماً دور التطبيق المحدود (`app_api`) وليس المالك.
 */

/** رابط الاتصال من متغيّر بيئة وقت البناء (اختياري، للتطوير فقط). */
const ENV_CONNECTION_STRING = (import.meta as { env?: Record<string, string> }).env
  ?.VITE_NEON_URL;

/** هل الرابط قيمة وهمية أو غير صالحة؟ */
export function isNeonPlaceholder(conn?: string | null): boolean {
  if (!conn) return true;
  const trimmed = conn.trim();
  return (
    trimmed.length === 0 ||
    trimmed.includes('ep-cool-snowflake-12345') ||
    trimmed.includes('ep-cool-12345') ||
    trimmed.includes('user:pass@') ||
    trimmed.includes('MY_NEON') ||
    trimmed.includes('CHANGE_ME')
  );
}

/**
 * يُرجع رابط الاتصال الفعّال — أو **نصاً فارغاً** إن لم يُضبط.
 *
 * الأولوية:
 *   1. إعدادات المستخدم المحفوظة في المتصفح
 *   2. متغيّر البيئة (للتطوير)
 *
 * ⚠️ لا توجد قيمة افتراضية مكتوبة في الكود — عن قصد.
 */
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
    /* تجاهل: التخزين غير متاح */
  }

  if (ENV_CONNECTION_STRING && !isNeonPlaceholder(ENV_CONNECTION_STRING)) {
    return ENV_CONNECTION_STRING;
  }

  return '';
}

/** هل يوجد اتصال فعّال مضبوط؟ */
export const hasNeonConnection = (): boolean =>
  getEffectiveNeonConnectionString().length > 0;

