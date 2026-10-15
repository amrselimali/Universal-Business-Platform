/**
 * قاعدة ربط عملية محاسبية بالحسابات
 * ---------------------------------------------------------------------------
 * هذه هي **المصدر الوحيد والحصري** لتوليد قيود اليومية. لا يُنشأ قيد يدوي
 * لنوع عملية له قاعدة فعّالة — التوليد تلقائي وحصري من هنا.
 */
export interface AccountingMappingRule {
  id?: number;
  tenantId: string;
  /** كود القاعدة — مثال: RULE-POS-CASH */
  code: string;
  nameAr: string;
  nameEn: string;
  /** نوع العملية — مفتاح الربط بين الشاشة والقاعدة */
  transactionType: AccountingTransactionType;
  /** الشاشة التي تُنتج هذا النوع من العمليات */
  sourceScreen: string;
  debitAccountId?: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountId?: string;
  creditAccountCode: string;
  creditAccountName: string;
  /** مصدر حصري: يمنع إنشاء قيد يدوي لهذا النوع من خارج القاعدة */
  isStrictExclusive: boolean;
  /** ترحيل آلي فوري بلا تدخل بشري */
  autoPostEnabled: boolean;
  isActive: boolean;
  description?: string;
}

/** أنواع العمليات المحاسبية المعروفة في النظام. */
export type AccountingTransactionType =
  | 'pos_sale'
  | 'expense'
  | 'session'
  | 'supplier_payment'
  | 'asset_depreciation'
  | 'purchase_receipt'
  | 'customer_collection'
  | 'payroll'
  | 'inventory_adjustment'
  | 'goods_issue';

/** فجوة تغطية: نوع عملية بلا قاعدة ربط فعّالة. */
export interface MappingCoverageGap {
  transactionType: string;
  reason: string;
}

/** سجل قيد مولَّد آلياً — للأثر الرقابي. */
export interface GeneratedJournalEntry {
  id: number;
  ruleCode: string | null;
  journalEntryId: string | null;
  entryNumber: string | null;
  sourceScreen: string | null;
  sourceDocument: string | null;
  debitAccountCode: string | null;
  creditAccountCode: string | null;
  amount: number;
  isBalanced: boolean;
  postedAt: string;
}
