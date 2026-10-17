/**
 * حماية أسماء قاعدة البيانات (Identifiers) — دوال نقية مختبَرة
 * ---------------------------------------------------------------------------
 * أي DDL/DML يُبنى من الواجهة يمر من هنا:
 *   • رفض أي اسم لا يطابق ^[a-z_][a-z0-9_]{0,62}$ (يمنع الحقن عبر الأسماء).
 *   • اقتباس مزدوج صارم عند البناء.
 *   • منع مخططات النظام.
 *   • قائمة جداول حرجة تتطلب تأكيداً إضافياً قبل الحذف.
 */

export const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

export const BLOCKED_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast'];

/** جداول حرجة: حذفها/تغييرها يتطلب كتابة اسم العملية كاملاً. */
export const PROTECTED_TABLES = [
  'journal_entries',
  'accounts',
  'tenants',
  'users',
  'parties',
  'accounting_posting_rules',
  'accounting_posting_documents',
  'accounting_journal_edits',
];

export const assertIdentifier = (value: string, labelAr = 'الاسم', labelEn = 'name'): string => {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(
      `${labelAr} غير صالح: «${value}» — يُسمح بحروف لاتينية صغيرة وأرقام و _ فقط (حتى 63 حرفاً). ` +
        `Invalid ${labelEn}: "${value}" — lowercase letters, digits and _ only.`
    );
  }
  return value;
};

export const assertSchema = (schema: string): string => {
  assertIdentifier(schema, 'اسم المخطط', 'schema');
  if (BLOCKED_SCHEMAS.includes(schema)) {
    throw new Error(`مخطط محمي لا يُعدَّل من الواجهة: ${schema}`);
  }
  return schema;
};

export const quoteIdentifier = (value: string): string => `"${assertIdentifier(value)}"`;

export const quoteTable = (schema: string, table: string): string =>
  `${quoteIdentifier(assertSchema(schema))}.${quoteIdentifier(table)}`;

export const isProtectedTable = (table: string): boolean => PROTECTED_TABLES.includes(table);

/** يتحقق من نص التأكيد المطلوب لعمليات الحذف. */
export const assertConfirmation = (confirm: string, expected: string): void => {
  if (confirm.trim() !== expected) {
    throw new Error(`نص التأكيد غير مطابق. اكتب بالضبط: ${expected}`);
  }
};
