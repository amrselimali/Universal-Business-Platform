/**
 * خدمة قواعد ربط العمليات بالحسابات — المصدر الوحيد للقيود المحاسبية
 * ---------------------------------------------------------------------------
 * القراءة والكتابة في جدولي:
 *   • `accounting_mapping_rules`        — القواعد
 *   • `accounting_generated_entries`    — سجل القيود المولَّدة (للتدقيق)
 *
 * تعمل عبر الاتصال المباشر بقاعدة البيانات.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import type {
  AccountingMappingRule,
  AccountingTransactionType,
  GeneratedJournalEntry,
  MappingCoverageGap,
} from '../types/accountingMapping';

const num = (v: unknown, d = 0): number => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, d = ''): string => (v === null || v === undefined ? d : String(v));
const bool = (v: unknown, d = false): boolean => (v === null || v === undefined ? d : v === true);

/** يحوّل صف قاعدة البيانات إلى كائن القاعدة. */
const toRule = (row: Record<string, unknown>): AccountingMappingRule => ({
  id: num(row.id),
  tenantId: str(row.tenant_id),
  code: str(row.code),
  nameAr: str(row.name_ar),
  nameEn: str(row.name_en, str(row.name_ar)),
  transactionType: str(row.transaction_type) as AccountingTransactionType,
  sourceScreen: str(row.source_screen),
  debitAccountId: str(row.debit_account_id) || undefined,
  debitAccountCode: str(row.debit_account_code),
  debitAccountName: str(row.debit_account_name),
  creditAccountId: str(row.credit_account_id) || undefined,
  creditAccountCode: str(row.credit_account_code),
  creditAccountName: str(row.credit_account_name),
  isStrictExclusive: bool(row.is_strict_exclusive, true),
  autoPostEnabled: bool(row.auto_post_enabled, true),
  isActive: bool(row.is_active, true),
  description: str(row.description) || undefined,
});

export interface MappingLoadResult {
  rules: AccountingMappingRule[];
  gaps: MappingCoverageGap[];
  generated: GeneratedJournalEntry[];
  error?: string;
}

/** يحمّل القواعد + الفجوات + سجل القيود المولَّدة. */
export async function loadAccountingMapping(tenantId: string): Promise<MappingLoadResult> {
  const empty: MappingLoadResult = { rules: [], gaps: [], generated: [] };

  const connection = getActiveDbConnection();
  if (!connection?.connectionString) {
    return { ...empty, error: 'no_database_connection' };
  }

  try {
    const sql = neon(connection.connectionString.trim());

    const [ruleRows, gapRows, entryRows] = await Promise.all([
      sql.query(
        `SELECT * FROM accounting_mapping_rules
          WHERE tenant_id = $1 ORDER BY transaction_type, code`,
        [tenantId]
      ),
      sql.query(`SELECT transaction_type, reason FROM fn_mapping_coverage_gaps($1)`, [tenantId]),
      sql.query(
        `SELECT id, rule_code, journal_entry_id, entry_number, source_screen,
                source_document, debit_account_code, credit_account_code,
                amount, is_balanced, posted_at
           FROM accounting_generated_entries
          WHERE tenant_id = $1 ORDER BY posted_at DESC LIMIT 100`,
        [tenantId]
      ),
    ]);

    return {
      rules: (Array.isArray(ruleRows) ? ruleRows : []).map((r) =>
        toRule(r as Record<string, unknown>)
      ),
      gaps: (Array.isArray(gapRows) ? gapRows : []).map((g) => ({
        transactionType: str((g as Record<string, unknown>).transaction_type),
        reason: str((g as Record<string, unknown>).reason),
      })),
      generated: (Array.isArray(entryRows) ? entryRows : []).map((e) => {
        const row = e as Record<string, unknown>;
        return {
          id: num(row.id),
          ruleCode: str(row.rule_code) || null,
          journalEntryId: str(row.journal_entry_id) || null,
          entryNumber: str(row.entry_number) || null,
          sourceScreen: str(row.source_screen) || null,
          sourceDocument: str(row.source_document) || null,
          debitAccountCode: str(row.debit_account_code) || null,
          creditAccountCode: str(row.credit_account_code) || null,
          amount: num(row.amount),
          isBalanced: bool(row.is_balanced, true),
          postedAt: str(row.posted_at),
        };
      }),
    };
  } catch (error: any) {
    return { ...empty, error: error?.message || 'load_failed' };
  }
}

/** يحفظ تعديلات قاعدة (الحساب المدين/الدائن + الخصائص). */
export async function saveAccountingMappingRule(
  rule: AccountingMappingRule
): Promise<{ ok: boolean; error?: string }> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return { ok: false, error: 'no_database_connection' };
  if (rule.id === undefined) return { ok: false, error: 'missing_rule_id' };

  try {
    const sql = neon(connection.connectionString.trim());
    await sql.query(
      `UPDATE accounting_mapping_rules SET
         name_ar = $3, name_en = $4,
         debit_account_code = $5, debit_account_name = $6,
         credit_account_code = $7, credit_account_name = $8,
         is_strict_exclusive = $9, auto_post_enabled = $10,
         is_active = $11, description = $12,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [
        rule.id, rule.tenantId, rule.nameAr, rule.nameEn,
        rule.debitAccountCode, rule.debitAccountName,
        rule.creditAccountCode, rule.creditAccountName,
        rule.isStrictExclusive, rule.autoPostEnabled,
        rule.isActive, rule.description ?? null,
      ]
    );
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'save_failed' };
  }
}

/**
 * يتحقق أن كل نوع عملية له قاعدة ربط.
 * يُستخدم كفحص رقابي قبل الاعتماد على وضع «المصدر الحصري».
 */
export async function fetchMappingGaps(tenantId: string): Promise<MappingCoverageGap[]> {
  const loaded = await loadAccountingMapping(tenantId);
  return loaded.gaps;
}

/**
 * يُنشئ قاعدة ربط جديدة في النظام.
 */
export async function createAccountingMappingRule(
  rule: Omit<AccountingMappingRule, 'id'>
): Promise<{ ok: boolean; error?: string }> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return { ok: false, error: 'no_database_connection' };

  try {
    const sql = neon(connection.connectionString.trim());
    await sql.query(
      `INSERT INTO accounting_mapping_rules (
         tenant_id, code, name_ar, name_en, transaction_type, source_screen,
         debit_account_code, debit_account_name,
         credit_account_code, credit_account_name,
         is_strict_exclusive, auto_post_enabled, is_active, description
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (tenant_id, code) DO UPDATE SET
         name_ar = EXCLUDED.name_ar,
         debit_account_code = EXCLUDED.debit_account_code,
         debit_account_name = EXCLUDED.debit_account_name,
         credit_account_code = EXCLUDED.credit_account_code,
         credit_account_name = EXCLUDED.credit_account_name,
         is_strict_exclusive = EXCLUDED.is_strict_exclusive,
         auto_post_enabled = EXCLUDED.auto_post_enabled,
         is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP`,
      [
        rule.tenantId, rule.code, rule.nameAr, rule.nameEn, rule.transactionType, rule.sourceScreen,
        rule.debitAccountCode, rule.debitAccountName,
        rule.creditAccountCode, rule.creditAccountName,
        rule.isStrictExclusive, rule.autoPostEnabled, rule.isActive, rule.description ?? null,
      ]
    );
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'create_failed' };
  }
}

/**
 * تهيئة القواعد القياسية لكيان معين إن لم تكن موجودة.
 */
export async function seedDefaultMappingRules(tenantId: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return { ok: false, count: 0, error: 'no_database_connection' };
  try {
    const sql = neon(connection.connectionString.trim());
    await sql.query(
      `INSERT INTO accounting_mapping_rules (tenant_id, code, name_ar, name_en, transaction_type, source_screen, debit_account_code, debit_account_name, credit_account_code, credit_account_name, is_strict_exclusive, auto_post_enabled, is_active, description) VALUES
       ($1, 'RULE-POS-CASH', 'مبيعات الكاشير النقدية', 'POS Cash Sales', 'pos_sale', 'شاشة الكاشير (POS)', '1111', 'الخزينة الرئيسية', '4100', 'إيرادات المبيعات', TRUE, TRUE, TRUE, 'إيصال كاشير نقدي'),
       ($1, 'RULE-POS-CARD', 'مبيعات الكاشير بالبطاقة والتحويل', 'POS Card Sales', 'pos_sale', 'شاشة الكاشير (POS)', '1112', 'البنك الأهلي المصري', '4100', 'إيرادات المبيعات', TRUE, TRUE, TRUE, 'مبيعات بطاقة وتحويل بنكي'),
       ($1, 'RULE-SESSION-RUN', 'إيراد جلسة تشغيل يومية', 'Daily Session Revenue', 'session', 'شاشة التشغيل (الريسيبشن)', '1111', 'الخزينة الرئيسية', '4200', 'إيرادات الخدمات والعيادات', TRUE, TRUE, TRUE, 'كشف تشغيل الوردية'),
       ($1, 'RULE-EXP-VOUCHER', 'سند صرف مصروف تشغيلي', 'Operating Expense Voucher', 'expense', 'شاشة المصروفات / الوردية', '5200', 'مصروفات تشغيلية', '1111', 'الخزينة الرئيسية', TRUE, TRUE, TRUE, 'مصروفات تشغيلية عامة'),
       ($1, 'RULE-SUPP-PAY', 'سند سداد مديونية مورد', 'Supplier Payment', 'supplier_payment', 'شاشة المشتريات / الموردين', '2100', 'الموردون والدائنون التجاريون', '1112', 'البنك الأهلي المصري', TRUE, TRUE, TRUE, 'سداد مديونية مورد'),
       ($1, 'RULE-PURCHASE-RECEIPT', 'استلام بضاعة من مورد', 'Purchase Receipt', 'purchase_receipt', 'شاشة المشتريات', '1130', 'مخزون البضائع ومستلزمات العيادة', '2100', 'الموردون والدائنون التجاريون', TRUE, TRUE, TRUE, 'استلام فاتورة توريد'),
       ($1, 'RULE-CUSTOMER-COLLECTION', 'تحصيل نقدية من عميل', 'Customer Collection', 'customer_collection', 'شاشة التحصيلات', '1111', 'الخزينة الرئيسية', '1120', 'العملاء والمدينون التجاريون', TRUE, TRUE, TRUE, 'سند قبض وتحصيل عميل'),
       ($1, 'RULE-PAYROLL', 'صرف مسير الرواتب', 'Payroll Disbursement', 'payroll', 'شاشة الرواتب', '5300', 'الرواتب والأجور', '1112', 'البنك الأهلي المصري', TRUE, TRUE, TRUE, 'مسير رواتب الكادر الطبي والموظفين'),
       ($1, 'RULE-GOODS-ISSUE', 'صرف مخزني للاستهلاك', 'Goods Issue', 'goods_issue', 'شاشة المخازن', '5100', 'تكلفة البضاعة المباعة', '1130', 'مخزون البضائع', TRUE, TRUE, TRUE, 'صرف مستلزمات للجلسات'),
       ($1, 'RULE-INVENTORY-ADJ', 'تسوية عجز الجرد المخزني', 'Inventory Adjustment', 'inventory_adjustment', 'شاشة الجرد', '5100', 'تكلفة البضاعة المباعة', '1130', 'مخزون البضائع', TRUE, TRUE, TRUE, 'تسوية فروقات الجرد'),
       ($1, 'RULE-ASSET-DEP', 'إهلاك الأصول الثابتة والأجهزة', 'Asset Depreciation', 'asset_depreciation', 'شاشة الأصول والأجهزة', '5250', 'مصروف إهلاك أصول وأجهزة', '1150', 'مجمع إهلاك الأصول', TRUE, TRUE, TRUE, 'إهلاك أجهزة الليزر والمعدات')
       ON CONFLICT (tenant_id, code) DO NOTHING`,
      [tenantId]
    );
    const countRows: any = await sql.query(`SELECT count(*)::int as c FROM accounting_mapping_rules WHERE tenant_id = $1`, [tenantId]);
    return { ok: true, count: Number(countRows?.[0]?.c || 0) };
  } catch (error: any) {
    return { ok: false, count: 0, error: error?.message || 'seed_failed' };
  }
}

/**
 * تسجيل قيد مولَّد في سجل التدقيق accounting_generated_entries.
 */
export async function logGeneratedAccountingEntry(params: {
  tenantId: string;
  ruleCode: string;
  journalEntryId: string;
  entryNumber: string;
  sourceScreen: string;
  sourceDocument: string;
  debitAccountCode: string;
  creditAccountCode: string;
  amount: number;
}): Promise<void> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return;

  try {
    const sql = neon(connection.connectionString.trim());
    await sql.query(
      `INSERT INTO accounting_generated_entries (
         tenant_id, rule_code, journal_entry_id, entry_number,
         source_screen, source_document, debit_account_code, credit_account_code,
         amount, is_balanced, posted_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, CURRENT_TIMESTAMP)`,
      [
        params.tenantId, params.ruleCode, params.journalEntryId, params.entryNumber,
        params.sourceScreen, params.sourceDocument, params.debitAccountCode, params.creditAccountCode,
        params.amount,
      ]
    );
  } catch (e) {
    console.warn('Failed to log generated accounting entry:', e);
  }
}

/**
 * استخراج قاعدة الربط المناسبة للعملية.
 */
export function resolveMappingRule(
  rules: AccountingMappingRule[],
  transactionType: AccountingTransactionType,
  subtype?: string
): AccountingMappingRule | undefined {
  const matching = rules.filter((r) => r.transactionType === transactionType && r.isActive);
  if (matching.length === 0) return undefined;
  if (subtype) {
    const bySubtype = matching.find(
      (r) => r.code.toLowerCase().includes(subtype.toLowerCase()) || r.nameEn.toLowerCase().includes(subtype.toLowerCase())
    );
    if (bySubtype) return bySubtype;
  }
  return matching[0];
}

/** أسماء أنواع العمليات بالعربية — للعرض في الشاشة. */
export const TRANSACTION_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  pos_sale: { ar: 'مبيعات الكاشير (POS)', en: 'POS Sales' },
  expense: { ar: 'تسجيل مصروف', en: 'Expense' },
  session: { ar: 'جلسة تشغيل يومية', en: 'Daily Session' },
  supplier_payment: { ar: 'سداد مورد', en: 'Supplier Payment' },
  asset_depreciation: { ar: 'إهلاك أصول شهري', en: 'Asset Depreciation' },
  purchase_receipt: { ar: 'استلام بضاعة', en: 'Purchase Receipt' },
  customer_collection: { ar: 'تحصيل من عميل', en: 'Customer Collection' },
  payroll: { ar: 'مسير رواتب', en: 'Payroll' },
  inventory_adjustment: { ar: 'تسوية جرد مخزني', en: 'Inventory Adjustment' },
  goods_issue: { ar: 'صرف مخزني', en: 'Goods Issue' },
};

