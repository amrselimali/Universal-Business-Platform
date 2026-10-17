/**
 * قراءة القيود من قاعدة البيانات (قائمة Keyset + ملخص)
 * ---------------------------------------------------------------------------
 * تُستخدم لإخراج `erp_journals` من حِزمة الإقلاع: الشاشة تجلب صفحة قيود عند
 * الفتح بدل تحميل كل الدفتر، والفلاتر/العدّادات تُحسب في SQL.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import type { JournalEntry, JournalLine } from '../types';

export interface JournalFilters {
  from?: string;
  to?: string;
  search?: string;
}

export interface JournalPage {
  entries: JournalEntry[];
  nextAfterDate: string | null;
  nextAfterId: string | null;
  error?: string;
}

export interface JournalSummaryResult {
  count: number;
  totalDebit: number;
  totalCredit: number;
  error?: string;
}

const client = () => {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return null;
  return neon(connection.connectionString.trim());
};

const toLine = (raw: Record<string, unknown>, index: number): JournalLine => ({
  id: String(raw.id ?? `line-${index}`),
  accountId: String(raw.account_id ?? raw.accountId ?? ''),
  accountCode: String(raw.account_code ?? raw.accountCode ?? ''),
  accountNameAr: String(raw.account_name_ar ?? raw.accountNameAr ?? ''),
  accountNameEn: String(raw.account_name_en ?? raw.accountNameEn ?? ''),
  memo: String(raw.memo ?? ''),
  debit: Number(raw.debit ?? 0),
  credit: Number(raw.credit ?? 0),
  lineNumber: Number(raw.lineNumber ?? index + 1),
} as unknown as JournalLine);

const toEntry = (row: Record<string, any>): JournalEntry => {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const rawLines = Array.isArray(payload.lines) ? (payload.lines as Record<string, unknown>[]) : [];
  return {
    ...(payload as unknown as JournalEntry),
    id: String(row.id ?? payload.id ?? ''),
    entryNumber: String(row.entry_number ?? payload.entryNumber ?? ''),
    date: String(row.entry_date ?? payload.date ?? '').slice(0, 10),
    description: String(row.description ?? payload.description ?? ''),
    isPosted: row.is_posted === undefined ? true : Boolean(row.is_posted),
    sourceDocument: String(payload.sourceDocument ?? '') || undefined,
    branchId: row.branch_id ?? (payload.branchId as string | undefined),
    lines: rawLines.map(toLine),
  } as JournalEntry;
};

export async function loadJournalPage(params: {
  tenantId: string;
  filters: JournalFilters;
  limit?: number;
  afterDate?: string | null;
  afterId?: string | null;
}): Promise<JournalPage> {
  const sql = client();
  if (!sql || !params.tenantId) return { entries: [], nextAfterDate: null, nextAfterId: null, error: 'no_database_connection' };
  try {
    const rows: any = await sql.query(
      `SELECT fn_journal_list($1,$2::date,$3::date,$4,$5,$6::date,$7) AS page`,
      [params.tenantId, params.filters.from ?? null, params.filters.to ?? null,
       params.filters.search || null, params.limit ?? 100,
       params.afterDate ?? null, params.afterId ?? null]
    );
    const page = rows?.[0]?.page ?? {};
    const items = Array.isArray(page.items) ? page.items : [];
    return {
      entries: items.map((item: Record<string, unknown>) => toEntry(item)),
      nextAfterDate: page.nextAfterDate ? String(page.nextAfterDate).slice(0, 10) : null,
      nextAfterId: page.nextAfterId ? String(page.nextAfterId) : null,
    };
  } catch (error: any) {
    return { entries: [], nextAfterDate: null, nextAfterId: null, error: error?.message || 'journal_page_failed' };
  }
}

export async function loadJournalSummary(params: {
  tenantId: string;
  filters: JournalFilters;
}): Promise<JournalSummaryResult> {
  const sql = client();
  if (!sql || !params.tenantId) return { count: 0, totalDebit: 0, totalCredit: 0, error: 'no_database_connection' };
  try {
    const rows: any = await sql.query(
      `SELECT fn_journal_summary($1,$2::date,$3::date,$4) AS summary`,
      [params.tenantId, params.filters.from ?? null, params.filters.to ?? null, params.filters.search || null]
    );
    const summary = rows?.[0]?.summary ?? {};
    return {
      count: Number(summary.count ?? 0),
      totalDebit: Number(summary.totalDebit ?? 0),
      totalCredit: Number(summary.totalCredit ?? 0),
    };
  } catch (error: any) {
    return { count: 0, totalDebit: 0, totalCredit: 0, error: error?.message || 'journal_summary_failed' };
  }
}
