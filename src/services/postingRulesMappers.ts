/**
 * محوّلات صفوف قاعدة البيانات إلى أنواع TypeScript (Posting rules mappers)
 * ---------------------------------------------------------------------------
 * فُصلت من `postingRulesApi.ts` التزاماً بحد 300 سطر، وتُستخدم في الخدمة
 * وفي أي شاشة تحتاج تحويل صفوف `accounting_posting_*`.
 */

import type {
  PeriodLock,
  PostingDocument,
  PostingDocumentStatus,
  PostingRule,
} from '../types/postingRules';
import type { GeneratedJournalEntry } from '../types/accountingMapping';

export const num = (v: unknown, d = 0): number => (Number.isFinite(Number(v)) ? Number(v) : d);
export const str = (v: unknown, d = ''): string => (v === null || v === undefined ? d : String(v));
export const bool = (v: unknown, d = false): boolean => (v === null || v === undefined ? d : v === true);

export const toRule = (row: Record<string, unknown>): PostingRule => ({
  id: num(row.id),
  tenantId: str(row.tenant_id),
  transactionType: str(row.transaction_type),
  fieldKey: str(row.field_key),
  selectorKey: str(row.selector_key, 'default'),
  direction: str(row.direction, 'debit') === 'credit' ? 'credit' : 'debit',
  accountCode: str(row.account_code),
  accountName: str(row.account_name),
  autoPostEnabled: bool(row.auto_post_enabled, true),
  isActive: bool(row.is_active, true),
  strictExclusive: bool(row.strict_exclusive, true),
  version: num(row.version, 1),
  notes: str(row.notes) || undefined,
});

export const toDocument = (row: Record<string, unknown>): PostingDocument => ({
  id: num(row.id),
  tenantId: str(row.tenant_id),
  transactionType: str(row.transaction_type),
  sourceScreen: str(row.source_screen),
  sourceDocument: str(row.source_document),
  documentDate: str(row.document_date).slice(0, 10),
  branchId: str(row.branch_id) || undefined,
  totalAmount: num(row.total_amount),
  status: str(row.status, 'pending') as PostingDocumentStatus,
  journalEntryId: str(row.journal_entry_id) || undefined,
  idempotencyKey: str(row.idempotency_key),
  attempts: num(row.attempts),
  lastError: str(row.last_error) || undefined,
  postedAt: str(row.posted_at) || undefined,
  postedBy: str(row.posted_by) || undefined,
});

export const toLock = (row: Record<string, unknown>): PeriodLock => ({
  id: num(row.id),
  tenantId: str(row.tenant_id),
  lockDate: str(row.lock_date).slice(0, 10),
  status: str(row.status, 'locked') === 'open' ? 'open' : 'locked',
  reason: str(row.reason) || undefined,
  lockedBy: str(row.locked_by) || undefined,
  updatedAt: str(row.updated_at),
});

export const toGenerated = (row: Record<string, unknown>): GeneratedJournalEntry => ({
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
});
