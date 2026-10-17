/**
 * عميل واجهة القيود (Journals API client)
 * ---------------------------------------------------------------------------
 * **لا يتصل بقاعدة البيانات.** القراءة عبر:
 *   GET /journals            → صفحة Keyset
 *   GET /journals/summary    → عدّاد + إجمالي مدين/دائن
 * والـ tenant من التوكن داخل السيرفر مع RLS.
 */

import { apiRequest } from './apiClient';
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

const query = (filters: JournalFilters): string => {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  return params.toString();
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
  const search = query(params.filters);
  const tail = [
    `limit=${encodeURIComponent(String(params.limit ?? 100))}`,
    params.afterDate ? `afterDate=${encodeURIComponent(params.afterDate)}` : '',
    params.afterId ? `afterId=${encodeURIComponent(params.afterId)}` : '',
  ].filter(Boolean).join('&');

  const result = await apiRequest<{ items?: Record<string, any>[]; nextAfterDate?: string; nextAfterId?: string }>(
    `/journals?${[search, tail].filter(Boolean).join('&')}`
  );
  if (!result.ok) return { entries: [], nextAfterDate: null, nextAfterId: null, error: result.error };

  const items = Array.isArray(result.data?.items) ? result.data!.items! : [];
  return {
    entries: items.map(toEntry),
    nextAfterDate: result.data?.nextAfterDate ? String(result.data.nextAfterDate).slice(0, 10) : null,
    nextAfterId: result.data?.nextAfterId ? String(result.data.nextAfterId) : null,
  };
}

export async function loadJournalSummary(params: {
  tenantId: string;
  filters: JournalFilters;
}): Promise<JournalSummaryResult> {
  const result = await apiRequest<{ count?: number; totalDebit?: number; totalCredit?: number }>(
    `/journals/summary?${query(params.filters)}`
  );
  if (!result.ok) return { count: 0, totalDebit: 0, totalCredit: 0, error: result.error };
  return {
    count: Number(result.data?.count ?? 0),
    totalDebit: Number(result.data?.totalDebit ?? 0),
    totalCredit: Number(result.data?.totalCredit ?? 0),
  };
}
