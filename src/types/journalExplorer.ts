/**
 * أنواع مستكشف القيود (Journal Explorer) — قراءة فقط
 * ---------------------------------------------------------------------------
 * الشاشة تعرض **كل قيد تم إنشاؤه فعلاً** في `journal_entries` مع سطوره،
 * ومصدره، وأي قاعدة ترحيل أنتجت السطور (عند توفر سجل التدقيق).
 */

export interface JournalLineView {
  accountCode: string;
  accountName: string;
  memo: string;
  debit: number;
  credit: number;
}

export interface JournalEntryView {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  branchId?: string;
  isPosted: boolean;
  version: number;
  updatedBy?: string;
  sourceDocument?: string;
  lines: JournalLineView[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  /** أكواد قواعد الترحيل التي أنتجت سطور هذا القيد (إن وُجد سجل التدقيق). */
  ruleCodes: string[];
}

export interface JournalFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
}

export interface JournalSummary {
  count: number;
  totalDebit: number;
  totalCredit: number;
  unbalanced: number;
  earliest?: string;
  latest?: string;
}
