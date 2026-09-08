export type Language = 'ar' | 'en';

export interface Tenant {
  id: string;
  name: string;
  nameEn: string;
  code: string;
  plan: 'Starter' | 'Professional' | 'Enterprise';
  currency: string;
  currencySymbol: string;
  taxRate: number; // e.g. 0.14 for Egypt VAT
  activeModules: string[];
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  nameEn: string;
  code: string;
  city: string;
  phone: string;
  isMain: boolean;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  nameEn: string;
  code: string;
  location: string;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  minStockLevel: number;
  unit: string;
  isService?: boolean;
}

export interface StockLevel {
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  reservedQty?: number;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  warehouseId: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
  quantity: number;
  unitCost: number;
  referenceNo: string;
  createdAt: string;
  note?: string;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface Account {
  id: string;
  tenantId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: AccountType;
  parentId?: string;
  balance: number;
  isDebitNormal: boolean;
  level: number;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  accountNameEn: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  branchId: string;
  entryNumber: string;
  date: string;
  description: string;
  isPosted: boolean;
  sourceDocument?: string;
  lines: JournalLine[];
  createdAt: string;
}

export interface Party {
  id: string;
  tenantId: string;
  name: string;
  nameEn: string;
  type: 'Customer' | 'Supplier' | 'Both';
  phone: string;
  email?: string;
  taxNumber?: string;
  balance: number; // positive = debit, negative = credit
  creditLimit?: number;
}

export interface SalesInvoiceItem {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface SalesInvoice {
  id: string;
  tenantId: string;
  branchId: string;
  warehouseId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  items: SalesInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  paymentMethod: 'Cash' | 'Card' | 'Credit' | 'Split';
  cashPaid?: number;
  cardPaid?: number;
  status: 'Draft' | 'Posted' | 'Cancelled';
  createdAt: string;
  cashierName: string;
  journalEntryId?: string;
}

export interface PosShift {
  id: string;
  tenantId: string;
  branchId: string;
  cashierName: string;
  openingFloat: number;
  openedAt: string;
  closedAt?: string;
  status: 'Open' | 'Closed';
  totalCashSales: number;
  totalCardSales: number;
  expectedCash: number;
  actualCashCount?: number;
  difference?: number;
  notes?: string;
}

// Clinic Entities
export interface Patient {
  id: string;
  tenantId: string;
  fileNumber: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  bloodType?: string;
  chronicDiseases?: string[];
  allergies?: string[];
  createdAt: string;
}

export interface Appointment {
  id: string;
  tenantId: string;
  branchId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  serviceNameAr: string;
  serviceNameEn: string;
  price: number;
  date: string;
  time: string;
  status: 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled';
  notes?: string;
  treatmentPlanId?: string;
}

export interface TreatmentPlan {
  id: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  title: string;
  totalSessions: number;
  completedSessions: number;
  notes: string;
  status: 'Active' | 'Completed' | 'Suspended';
}

export interface ModuleDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: 'Core' | 'Operations' | 'Specialized' | 'Intelligence';
  icon: string;
  required?: boolean;
}

export interface NeonDbState {
  connected: boolean;
  connectionString: string;
  isSyncing: boolean;
  lastSync?: string;
  error?: string;
  tablesCount: number;
  recordsCount: number;
}
