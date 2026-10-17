/**
 * منطق مستكشف القيود — دوال نقية قابلة للاختبار
 * ---------------------------------------------------------------------------
 * تفصل قراءة "شكل" السطر القادم من الداتابيز (camelCase أو snake_case) عن العرض،
 * وتحسب الإجماليات وحالة التوازن والتصفية محلياً بلا أي تعديل على البيانات.
 */

import type {
  JournalEntryView,
  JournalFilters,
  JournalLineView,
  JournalSummary,
} from '../types/journalExplorer';

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pick = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
  }
  return '';
};

/** يحوّل سطراً من payload (بأي تسمية) إلى شكل العرض. */
export const toLineView = (raw: unknown): JournalLineView => {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    accountCode: pick(row, 'accountCode', 'account_code', 'code'),
    accountName: pick(row, 'accountNameAr', 'account_name_ar', 'accountName', 'account_name'),
    memo: pick(row, 'memo', 'description'),
    debit: num(row.debit),
    credit: num(row.credit),
  };
};

/** يبني قيداً كاملاً من صف قاعدة البيانات (مستقل عن وجود الـ View). */
export const toJournalEntryView = (
  row: Record<string, unknown>,
  ruleCodes: string[] = []
): JournalEntryView => {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const rawLines = Array.isArray(payload.lines)
    ? payload.lines
    : Array.isArray(row.lines)
      ? row.lines
      : [];

  const lines = rawLines.map(toLineView);
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  return {
    id: pick(row, 'id'),
    entryNumber: pick(row, 'entry_number', 'entryNumber'),
    entryDate: pick(row, 'entry_date', 'entryDate', 'date').slice(0, 10),
    description: pick(row, 'description'),
    branchId: pick(row, 'branch_id', 'branchId') || undefined,
    isPosted: row.is_posted === undefined ? true : Boolean(row.is_posted),
    version: num(row.version) || 1,
    updatedBy: pick(row, 'updated_by', 'updatedBy') || undefined,
    sourceDocument: pick(payload, 'sourceDocument') || undefined,
    lines,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.005,
    ruleCodes: [...new Set(ruleCodes)],
  };
};

/** تصفية محلية (بحث نصي + تاريخ). */
export const filterJournals = (
  entries: JournalEntryView[],
  filters: JournalFilters
): JournalEntryView[] => {
  const search = filters.search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.dateFrom && entry.entryDate && entry.entryDate < filters.dateFrom) return false;
    if (filters.dateTo && entry.entryDate && entry.entryDate > filters.dateTo) return false;
    if (!search) return true;
    const haystack = [
      entry.entryNumber,
      entry.description,
      entry.sourceDocument ?? '',
      entry.ruleCodes.join(' '),
      ...entry.lines.map((line) => `${line.accountCode} ${line.accountName} ${line.memo}`),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });
};

/** ملخص رقمي للعرض (لا يعدّل شيئاً). */
export const summarizeJournals = (entries: JournalEntryView[]): JournalSummary => {
  const totalDebit = entries.reduce((sum, entry) => sum + entry.totalDebit, 0);
  const totalCredit = entries.reduce((sum, entry) => sum + entry.totalCredit, 0);
  const dates = entries.map((entry) => entry.entryDate).filter(Boolean).sort();
  return {
    count: entries.length,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    unbalanced: entries.filter((entry) => !entry.isBalanced).length,
    earliest: dates[0],
    latest: dates[dates.length - 1],
  };
};
