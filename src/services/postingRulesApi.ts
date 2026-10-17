/**
 * خدمة محرك قواعد الترحيل (Posting Rules API)
 * ---------------------------------------------------------------------------
 * المصدر الوحيد لتوجيه القيود: تقرأ/تكتب `accounting_posting_rules`، وتُرحّل
 * المستندات عبر `fn_post_document` (التي تبني القيد من القواعد فقط)، وتقفل
 * الفترات عبر `fn_lock_period` / `fn_open_period`.
 *
 * ملاحظة: تستخدم اتصال Neon المباشر مثل بقية طبقة الخدمات الحالية.
 * (نقلها لتمر عبر الـ API بند P1 في خطة الحوكمة — بلا تغيير في الواجهة.)
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import { num, toDocument, toGenerated, toLock, toRule } from './postingRulesMappers';
import type {
  PeriodLock,
  PostingComponent,
  PostingDocument,
  PostingDocumentStatus,
  PostingResult,
  PostingRule,
  PostingRulesSnapshot,
} from '../types/postingRules';

const client = () => {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return null;
  return { sql: neon(connection.connectionString.trim()), tenantId: connection.tenantId };
};

/** يحمّل القواعد + المستندات + أقفال الفترات. */
export async function loadPostingSnapshot(tenantId: string): Promise<PostingRulesSnapshot> {
  const ctx = client();
  if (!ctx) return { rules: [], documents: [], locks: [], generated: [], error: 'no_database_connection' };

  try {
    const [rules, documents, locks, generated] = await Promise.all([
      ctx.sql.query(
        `SELECT * FROM accounting_posting_rules
          WHERE tenant_id = $1 ORDER BY transaction_type, field_key, selector_key`,
        [tenantId]
      ),
      ctx.sql.query(
        `SELECT * FROM accounting_posting_documents
          WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [tenantId]
      ),
      ctx.sql.query(
        `SELECT * FROM accounting_period_locks
          WHERE tenant_id = $1 ORDER BY lock_date DESC`,
        [tenantId]
      ),
      ctx.sql.query(
        `SELECT id, rule_code, journal_entry_id, entry_number, source_screen, source_document,
                debit_account_code, credit_account_code, amount, is_balanced, posted_at
           FROM accounting_generated_entries
          WHERE tenant_id = $1 ORDER BY posted_at DESC LIMIT 100`,
        [tenantId]
      ),
    ]);

    return {
      rules: (Array.isArray(rules) ? rules : []).map((r) => toRule(r as Record<string, unknown>)),
      generated: (Array.isArray(generated) ? generated : []).map((row) =>
        toGenerated(row as Record<string, unknown>)
      ),
      documents: (Array.isArray(documents) ? documents : []).map((r) =>
        toDocument(r as Record<string, unknown>)
      ),
      locks: (Array.isArray(locks) ? locks : []).map((r) => toLock(r as Record<string, unknown>)),
    };
  } catch (error: any) {
    return { rules: [], documents: [], locks: [], generated: [], error: error?.message || 'load_failed' };
  }
}

export interface RuleDraft {
  tenantId: string;
  transactionType: string;
  fieldKey: string;
  selectorKey: string;
  direction: 'debit' | 'credit';
  accountCode: string;
  accountName: string;
  autoPostEnabled: boolean;
  isActive: boolean;
  strictExclusive: boolean;
  actor?: string;
}

/** يحفظ قاعدة (إدراج أو تعديل) — المفتاح: (منشأة، عملية، خلية، مُحدِّد). */
export async function savePostingRule(rule: RuleDraft): Promise<{ ok: boolean; error?: string }> {
  const ctx = client();
  if (!ctx) return { ok: false, error: 'no_database_connection' };
  if (!rule.accountCode) return { ok: false, error: 'missing_account' };

  try {
    await ctx.sql.query(
      `INSERT INTO accounting_posting_rules
         (tenant_id, transaction_type, field_key, selector_key, direction,
          account_code, account_name, auto_post_enabled, is_active, strict_exclusive, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (tenant_id, transaction_type, field_key, selector_key) DO UPDATE SET
         direction = EXCLUDED.direction,
         account_code = EXCLUDED.account_code,
         account_name = EXCLUDED.account_name,
         auto_post_enabled = EXCLUDED.auto_post_enabled,
         is_active = EXCLUDED.is_active,
         strict_exclusive = EXCLUDED.strict_exclusive,
         version = accounting_posting_rules.version + 1,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = EXCLUDED.updated_by`,
      [
        rule.tenantId, rule.transactionType, rule.fieldKey, rule.selectorKey, rule.direction,
        rule.accountCode, rule.accountName, rule.autoPostEnabled, rule.isActive,
        rule.strictExclusive, rule.actor ?? 'ui',
      ]
    );
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'save_failed' };
  }
}

/** يعطّل قاعدة (لا حذف: يبقى الأثر التدقيقي). */
export async function deactivatePostingRule(
  tenantId: string,
  transactionType: string,
  fieldKey: string,
  selectorKey: string,
  actor = 'ui'
): Promise<{ ok: boolean; error?: string }> {
  const ctx = client();
  if (!ctx) return { ok: false, error: 'no_database_connection' };
  try {
    await ctx.sql.query(
      `UPDATE accounting_posting_rules
          SET is_active = FALSE, version = version + 1,
              updated_at = CURRENT_TIMESTAMP, updated_by = $5
        WHERE tenant_id = $1 AND transaction_type = $2 AND field_key = $3 AND selector_key = $4`,
      [tenantId, transactionType, fieldKey, selectorKey, actor]
    );
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'deactivate_failed' };
  }
}

/**
 * يُرحّل مستنداً بضغطة زر: القيد يُبنى من القواعد فقط.
 * عند الفشل يُسجَّل المستند بحالة failed مع السبب ويُعاد في `error`.
 */
export async function postDocument(params: {
  tenantId: string;
  branchId?: string;
  transactionType: string;
  sourceScreen: string;
  sourceDocument: string;
  date: string;
  description: string;
  actor?: string;
  components: PostingComponent[];
  idempotencyKey?: string;
}): Promise<PostingResult> {
  const ctx = client();
  if (!ctx) return { status: 'failed', error: 'no_database_connection' };

  try {
    const rows: any = await ctx.sql.query(
      `SELECT fn_post_document($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) AS result`,
      [
        params.tenantId,
        params.branchId || null,
        params.transactionType,
        params.sourceScreen,
        params.sourceDocument,
        params.date,
        params.description,
        params.actor || 'ui',
        JSON.stringify(params.components),
        params.idempotencyKey || null,
      ]
    );

    const result = rows?.[0]?.result ?? rows?.result ?? {};
    return {
      status: result.status === 'already_posted' ? 'already_posted' : 'posted',
      journalId: result.journalId ? String(result.journalId) : undefined,
      debit: num(result.debit),
      credit: num(result.credit),
      lines: num(result.lines),
      documentId: num(result.documentId),
    };
  } catch (error: any) {
    return { status: 'failed', error: error?.message || String(error) };
  }
}

/** يقفل الفترة حتى تاريخ معيّن (يُمنع الترحيل فيه وما قبله). */
export async function lockPeriod(params: {
  tenantId: string;
  date: string;
  reason?: string;
  actor?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = client();
  if (!ctx) return { ok: false, error: 'no_database_connection' };
  try {
    await ctx.sql.query(`SELECT fn_lock_period($1, $2::date, $3, $4)`, [
      params.tenantId, params.date, params.reason || null, params.actor || 'ui',
    ]);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'lock_failed' };
  }
}

/** يفتح فترة مقفلة (يتطلب صلاحية منفصلة في الواجهة). */
export async function openPeriod(tenantId: string, date: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = client();
  if (!ctx) return { ok: false, error: 'no_database_connection' };
  try {
    await ctx.sql.query(`SELECT fn_open_period($1, $2::date)`, [tenantId, date]);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'open_failed' };
  }
}

/** يتحقق هل تاريخ معيّن مقفل (للاستخدام في الشاشات قبل أي ترحيل). */
export async function isPeriodLocked(tenantId: string, date: string): Promise<boolean> {
  const ctx = client();
  if (!ctx) return false;
  try {
    const rows: any = await ctx.sql.query(`SELECT fn_is_period_locked($1, $2::date) AS locked`, [
      tenantId, date,
    ]);
    return Boolean(rows?.[0]?.locked);
  } catch {
    return false;
  }
}
