/**
 * أنواع محرك قواعد الترحيل المحاسبي (Posting Rules Engine)
 * ---------------------------------------------------------------------------
 * القاعدة = خلية رقمية واحدة داخل عملية واحدة ↦ اتجاه واحد ↦ حساب واحد.
 * لا يوجد أي مصدر آخر للحساب: من لا قاعدة له لا يُرحَّل (Default-Deny محاسبي).
 */

export type PostingDirection = 'debit' | 'credit';

/** قاعدة ترحيل واحدة كما تُقرأ من `accounting_posting_rules`. */
export interface PostingRule {
  id: number;
  tenantId: string;
  transactionType: string;
  fieldKey: string;
  selectorKey: string;
  direction: PostingDirection;
  accountCode: string;
  accountName: string;
  autoPostEnabled: boolean;
  isActive: boolean;
  strictExclusive: boolean;
  version: number;
  notes?: string;
}

/** خلية رقميّة واحدة تُرسَل للترحيل. */
export interface PostingComponent {
  field_key: string;
  amount: number;
  selector?: string;
  memo?: string;
  /** إن كان الحقل اختيارياً ولا قاعدة له: يُتجاهل بدل إفشال الترحيل. */
  optional?: boolean;
}

export type PostingDocumentStatus = 'pending' | 'posted' | 'failed' | 'cancelled';

/** مستند ترحيل (يمثل عملية واحدة: فاتورة/سند/جلسة). */
export interface PostingDocument {
  id: number;
  tenantId: string;
  transactionType: string;
  sourceScreen: string;
  sourceDocument: string;
  documentDate: string;
  branchId?: string;
  totalAmount: number;
  status: PostingDocumentStatus;
  journalEntryId?: string;
  idempotencyKey: string;
  attempts: number;
  lastError?: string;
  /** مكوّنات المستند كما أُرسلت للترحيل — تُستخدم لإعادة المحاولة. */
  payload?: { field_key: string; amount: number; selector?: string; memo?: string }[];
  postedAt?: string;
  postedBy?: string;
}

/** إقفال فترة محاسبية. */
export interface PeriodLock {
  id: number;
  tenantId: string;
  lockDate: string;
  status: 'locked' | 'open';
  reason?: string;
  lockedBy?: string;
  updatedAt: string;
}

/** نتيجة الترحيل كما ترجعها `fn_post_document`. */
export interface PostingResult {
  status: 'posted' | 'already_posted' | 'failed';
  journalId?: string;
  debit?: number;
  credit?: number;
  lines?: number;
  documentId?: number;
  error?: string;
}

export interface PostingRulesSnapshot {
  rules: PostingRule[];
  documents: PostingDocument[];
  locks: PeriodLock[];
  error?: string;
}
