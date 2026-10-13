/**
 * Enterprise Relational Database Schema & Types
 * Universal Business Platform (ERP)
 */

export interface DbTenant {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface DbBranch {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  isMain: boolean;
  createdAt: string;
}

export interface DbAccount {
  id: string;
  tenantId: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  isDebitNormal: boolean;
  parentId?: string;
  level: number;
  balance: number;
  isActive: boolean;
}

export interface DbParty {
  id: string;
  tenantId: string;
  branchId?: string;
  customerCode: string; // The primary auto-serialized customer code
  systemCode?: string;
  paperCode?: string;
  name: string;
  phone?: string;
  type: 'Customer' | 'Supplier' | 'Both';
  accountId?: string;
  balance: number;
  isArchived: boolean;
  createdAt: string;
}

export interface DbJournalEntry {
  id: string;
  tenantId: string;
  branchId?: string;
  entryNumber: string;
  date: string;
  description?: string;
  sourceDocument?: string;
  isPosted: boolean;
  lines: DbJournalLine[];
}

export interface DbJournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  partyId?: string;
  debit: number;
  credit: number;
  memo?: string;
  lineOrder: number;
}

export interface DbCashReceipt {
  id: string;
  tenantId: string;
  branchId: string;
  voucherNumber: string;
  partyId: string;
  customerCode: string;
  date: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentMethodLabel?: string;
  bankOrSafeAccountId: string;
  journalEntryId?: string;
  referenceInvoiceNo?: string;
  description?: string;
  notes?: string;
  status: 'active' | 'cancelled';
  createdAt: string;
}

/**
 * Statement Statement Output from SQL Window Query
 */
export interface DbStatementLine {
  partyId: string;
  customerCode: string;
  customerName: string;
  transactionDate: string;
  documentNumber: string;
  documentType: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}
