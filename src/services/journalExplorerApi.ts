/**
 * قراءة القيود المحاسبية المنشأة (Journal Explorer API) — قراءة فقط
 * ---------------------------------------------------------------------------
 * لا تكتب شيئاً إطلاقاً. تقرأ من `journal_entries` مباشرة (لا تعتمد على وجود
 * View) وتجلب أكواد قواعد الترحيل من `accounting_generated_entries` إن وُجدت،
 * فتعمل الشاشة حتى قبل تطبيق أحدث الترحيلات.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import { toJournalEntryView } from './journalExplorerHelpers';
import type { JournalEntryView } from '../types/journalExplorer';
import type { JournalEditResult } from './journalEditHelpers';

export interface JournalLoadResult {
  entries: JournalEntryView[];
  error?: string;
  /** true إذا تعذّر جلب أكواد القواعد (جدول التدقيق غير موجود بعد). */
  rulesUnavailable?: boolean;
}

const MAX_ROWS = 500;

/** يحمّل أحدث القيود (حتى 500) مع سطورها وأكواد قواعدها. */
export async function loadJournalEntries(tenantId: string): Promise<JournalLoadResult> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) {
    return { entries: [], error: 'no_database_connection' };
  }

  const sql = neon(connection.connectionString.trim());

  try {
    const rows: any = await sql.query(
      `SELECT id, entry_number, COALESCE(entry_date, date) AS entry_date, description,
              is_posted, version, updated_by, branch_id, payload
         FROM journal_entries
        WHERE tenant_id = $1 AND deleted_at IS NULL
        ORDER BY COALESCE(entry_date, date) DESC, updated_at DESC
        LIMIT ${MAX_ROWS}`,
      [tenantId]
    );

    const list = Array.isArray(rows) ? rows : [];
    const journalIds = list.map((row: any) => String(row.id)).filter(Boolean);
    const ruleMap = new Map<string, string[]>();
    let rulesUnavailable = false;

    if (journalIds.length > 0) {
      try {
        const rules: any = await sql.query(
          `SELECT journal_entry_id, rule_code
             FROM accounting_generated_entries
            WHERE tenant_id = $1 AND journal_entry_id = ANY($2::text[])`,
          [tenantId, journalIds]
        );
        (Array.isArray(rules) ? rules : []).forEach((row: any) => {
          const journalId = String(row.journal_entry_id ?? '');
          const code = String(row.rule_code ?? '');
          if (!journalId || !code) return;
          ruleMap.set(journalId, [...(ruleMap.get(journalId) ?? []), code]);
        });
      } catch {
        rulesUnavailable = true;
      }
    }

    return {
      entries: list.map((row: any) =>
        toJournalEntryView(row as Record<string, unknown>, ruleMap.get(String(row.id)) ?? [])
      ),
      rulesUnavailable,
    };
  } catch (error: any) {
    return { entries: [], error: error?.message || 'load_failed' };
  }
}

/**
 * تعديل قيد محاسبي من الشاشة (يُطبّق الفرق على الأرصدة ويزامن المصدر).
 * يُرجع الإصدار الجديد وما تمت مزامنته؛ ويرفض إن كانت الفترة مقفلة أو القيد
 * غير متوازن أو الحساب غير موجود (كل ذلك داخل الدالة في قاعدة البيانات).
 */
export async function updateJournalEntry(params: {
  tenantId: string;
  journalId: string;
  date: string;
  description: string;
  reason: string;
  actor?: string;
  lines: { accountCode: string; accountName?: string; memo: string; debit: number; credit: number }[];
}): Promise<JournalEditResult> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return { ok: false, error: 'no_database_connection' };

  const sql = neon(connection.connectionString.trim());

  try {
    const payload = params.lines.map((line) => ({
      account_code: line.accountCode,
      accountCode: line.accountCode,
      account_name_ar: line.accountName ?? line.accountCode,
      memo: line.memo,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
    }));

    const rows: any = await sql.query(
      `SELECT fn_update_journal($1,$2,$3,$4,$5,$6::jsonb,$7) AS result`,
      [params.tenantId, params.actor ?? 'ui', params.journalId, params.date,
       params.description, JSON.stringify(payload), params.reason]
    );

    const result = rows?.[0]?.result ?? rows?.result ?? {};
    return {
      ok: true,
      version: Number(result.version) || undefined,
      debit: Number(result.debit) || undefined,
      credit: Number(result.credit) || undefined,
      sourceSync: Array.isArray(result.sourceSync) ? result.sourceSync : [],
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}
