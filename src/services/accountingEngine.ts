import {
  JournalEntry,
  JournalLine,
  Account,
  Product,
  Party,
  PaymentMethod,
  AccountingPeriodLock,
} from '../types';

/**
 * Creates balanced journal lines with full account metadata
 */
export function createJournalLine(
  acc: Account,
  debit: number,
  credit: number,
  memo: string,
  index: number
): JournalLine {
  return {
    id: `jl-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 10)}`,
    accountId: acc.id,
    accountCode: acc.code,
    accountNameAr: acc.nameAr,
    accountNameEn: acc.nameEn,
    debit: Math.max(0, Number(debit.toFixed(2))),
    credit: Math.max(0, Number(credit.toFixed(2))),
    memo,
  };
}

/**
 * Validates whether a transaction date falls into a locked/closed accounting period
 */
export function isDateLockedInPeriod(
  date: string,
  periodLocks: AccountingPeriodLock[],
  tenantId: string,
  branchId?: string
): { isLocked: boolean; lockInfo?: AccountingPeriodLock } {
  if (!date || !periodLocks || periodLocks.length === 0) {
    return { isLocked: false };
  }

  const activeLocks = periodLocks.filter(
    (l) =>
      l.status === 'locked' &&
      l.tenantId === tenantId &&
      (!l.branchId || l.branchId === 'all' || !branchId || l.branchId === branchId)
  );

  for (const lock of activeLocks) {
    // If transaction date is less than or equal to lockDate, it's inside closed period
    if (date <= lock.lockDate) {
      return { isLocked: true, lockInfo: lock };
    }
  }

  return { isLocked: false };
}

/**
 * Find the most suitable account in Chart of Accounts:
 * 1) Provided specific account ID
 * 2) Fallback to account matching code or fallback code
 * 3) Fallback to first matching account type
 */
export function resolveAccount(
  accounts: Account[],
  preferredAccountId?: string,
  fallbackCode?: string,
  fallbackType?: 'Asset' | 'Liability' | 'Revenue' | 'Expense'
): Account {
  if (preferredAccountId) {
    const found = accounts.find((a) => a.id === preferredAccountId);
    if (found) return found;
  }
  if (fallbackCode) {
    const foundCode = accounts.find((a) => a.code === fallbackCode || a.code.startsWith(fallbackCode));
    if (foundCode) return foundCode;
  }
  if (fallbackType) {
    const foundType = accounts.find((a) => a.type === fallbackType);
    if (foundType) return foundType;
  }
  return accounts[0];
}

/**
 * Helper to build a unique Journal Entry object
 */
export function buildJournalEntry(params: {
  tenantId: string;
  branchId?: string;
  prefix: string;
  date: string;
  description: string;
  sourceDocument: string;
  lines: JournalLine[];
}): JournalEntry {
  const entryNumber = `${params.prefix}-${Date.now().toString().slice(-6)}`;
  return {
    id: `je-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenantId: params.tenantId,
    branchId: params.branchId,
    entryNumber,
    date: params.date,
    description: params.description,
    isPosted: true,
    sourceDocument: params.sourceDocument,
    lines: params.lines,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Combined Reversal & New Adjusting Journal Entry in ONE entry (قيد عكس وتعديل مركب واحد)
 * User requirement: "يسيب العملية القديمة ويعكسها فى الحسابات ويعمل عملية جديدة كله فى قيد واحد"
 */
export function buildCombinedReversalAndNewEntry(params: {
  tenantId: string;
  branchId?: string;
  date: string;
  sourceDocument: string;
  oldReferenceNumber: string;
  oldLines: JournalLine[];
  newLines: JournalLine[];
  description: string;
}): JournalEntry {
  let lineIdx = 0;

  // 1) Reversal lines: Exact opposite of old lines (credit becomes debit, debit becomes credit)
  const reversalLines: JournalLine[] = params.oldLines.map((oldLine) => {
    lineIdx++;
    return {
      id: `jl-rev-${Date.now()}-${lineIdx}`,
      accountId: oldLine.accountId,
      accountCode: oldLine.accountCode,
      accountNameAr: oldLine.accountNameAr,
      accountNameEn: oldLine.accountNameEn,
      debit: oldLine.credit, // Invert
      credit: oldLine.debit, // Invert
      memo: `[عكس وإلغاء القيد السابق] ${oldLine.memo || params.oldReferenceNumber}`,
    };
  });

  // 2) New lines: The updated new state
  const updatedLines: JournalLine[] = params.newLines.map((newLine) => {
    lineIdx++;
    return {
      id: `jl-new-${Date.now()}-${lineIdx}`,
      accountId: newLine.accountId,
      accountCode: newLine.accountCode,
      accountNameAr: newLine.accountNameAr,
      accountNameEn: newLine.accountNameEn,
      debit: newLine.debit,
      credit: newLine.credit,
      memo: `[القيد المعدل الجديد] ${newLine.memo || params.sourceDocument}`,
    };
  });

  const allLines = [...reversalLines, ...updatedLines];

  return buildJournalEntry({
    tenantId: params.tenantId,
    branchId: params.branchId,
    prefix: 'JV-REV-ADJ',
    date: params.date,
    description: `[تسوية وتعديل مركب] ${params.description} (عكس ${params.oldReferenceNumber} وإثبات العملية المعدلة)`,
    sourceDocument: params.sourceDocument,
    lines: allLines,
  });
}

/**
 * Build Revenue Journal Lines for an operation, POS invoice, or sales invoice
 */
export function buildRevenueJournalLines(params: {
  accounts: Account[];
  paymentMethod?: PaymentMethod;
  customer?: Party;
  productOrService?: Product;
  totalRevenue: number;
  collectedAmount: number;
  memo: string;
}): JournalLine[] {
  const lines: JournalLine[] = [];
  // Values may originate from Excel/JSON storage, where numeric fields can be strings.
  const totalRevenue = Number(params.totalRevenue);
  const collectedAmount = Number(params.collectedAmount);
  const total = Number((Number.isFinite(totalRevenue) ? totalRevenue : 0).toFixed(2));
  const collected = Number((Number.isFinite(collectedAmount) ? collectedAmount : 0).toFixed(2));
  const receivable = Number(Math.max(0, total - collected).toFixed(2));

  let lineIdx = 1;

  // 1. Debit Cash / Safe / Bank Account for collected amount
  if (collected > 0) {
    const cashOrBankAcc = resolveAccount(
      params.accounts,
      params.paymentMethod?.linkedAccountId,
      params.paymentMethod?.type === 'Card' || params.paymentMethod?.type === 'Transfer' ? '1112' : '1111',
      'Asset'
    );
    lines.push(createJournalLine(cashOrBankAcc, collected, 0, `${params.memo} - تحصيل (${params.paymentMethod?.nameAr || 'نقدي'})`, lineIdx++));
  }

  // 2. Debit Accounts Receivable for remaining balance (if any)
  if (receivable > 0) {
    const receivableAcc = resolveAccount(
      params.accounts,
      params.customer?.accountId,
      '1120',
      'Asset'
    );
    lines.push(createJournalLine(receivableAcc, receivable, 0, `${params.memo} - متبقي آجل على العميل (${params.customer?.name || 'عميل'})`, lineIdx++));
  }

  // 3. Credit Revenue / Sales Account for total revenue
  const revenueAcc = resolveAccount(
    params.accounts,
    params.productOrService?.salesAccountId,
    params.productOrService?.isService ? '4200' : '4100',
    'Revenue'
  );
  lines.push(createJournalLine(revenueAcc, 0, total, `${params.memo} - إيراد (${params.productOrService?.nameAr || 'الخدمة/المبيعات'})`, lineIdx++));

  return lines;
}

/**
 * Build Direct Cost & Inventory Depletion Journal Lines
 */
export function buildCostJournalLines(params: {
  accounts: Account[];
  productOrService?: Product;
  quantity: number;
  totalCost: number;
  memo: string;
}): JournalLine[] {
  if (params.totalCost <= 0) return [];

  const cost = Number(params.totalCost.toFixed(2));
  let lineIdx = 1;

  // 1. Debit COGS / Cost of Services
  const cogsAcc = resolveAccount(
    params.accounts,
    params.productOrService?.cogsAccountId || params.productOrService?.expenseAccountId,
    '5100',
    'Expense'
  );

  // 2. Credit Inventory
  const inventoryAcc = resolveAccount(
    params.accounts,
    params.productOrService?.inventoryAccountId,
    '1130',
    'Asset'
  );

  return [
    createJournalLine(cogsAcc, cost, 0, `${params.memo} - تكلفة التشغيل والمستلزمات`, lineIdx++),
    createJournalLine(inventoryAcc, 0, cost, `${params.memo} - صرف مخزون مستهلك`, lineIdx++),
  ];
}

/**
 * Calculates direct cost and specific warehouse inventory deductions
 * for a service/product based on its linked raw materials/recipe components or purchase cost.
 */
export function calculateItemCostAndDeductions(
  product: Product | undefined,
  quantity: number,
  allProducts: Product[]
): {
  totalCost: number;
  stockDeductions: { productId: string; productNameAr: string; quantity: number; unitCost: number }[];
} {
  if (!product || quantity <= 0) {
    return { totalCost: 0, stockDeductions: [] };
  }

  const stockDeductions: { productId: string; productNameAr: string; quantity: number; unitCost: number }[] = [];
  let totalCost = 0;

  // Case 1: Service or Package with defined recipe / linked raw materials (BOM)
  if (product.linkedComponents && product.linkedComponents.length > 0) {
    product.linkedComponents.forEach((comp) => {
      const stockProd = allProducts.find((p) => p.id === comp.productId);
      const unitCost = Number(comp.unitCost ?? stockProd?.purchasePrice ?? 0);
      const neededQty = Number((comp.quantity * quantity).toFixed(3));
      const lineCost = Number((neededQty * unitCost).toFixed(2));
      totalCost += lineCost;
      stockDeductions.push({
        productId: comp.productId,
        productNameAr: comp.productNameAr || stockProd?.nameAr || 'صنف مخزني مستهلك',
        quantity: neededQty,
        unitCost,
      });
    });
  } else if (product.purchasePrice && product.purchasePrice > 0) {
    // Case 2: Direct sale of stock item or service with standard unit cost
    const unitCost = product.purchasePrice;
    totalCost = Number((quantity * unitCost).toFixed(2));
    if (product.isStockItem || product.itemType === 'product' || product.itemType === 'stock_raw' || product.itemType === 'consumable') {
      stockDeductions.push({
        productId: product.id,
        productNameAr: product.nameAr,
        quantity,
        unitCost,
      });
    }
  }

  return { totalCost, stockDeductions };
}

/**
 * Cash Receipt Voucher Journal Lines
 */
export function buildCashReceiptJournalLines(params: {
  accounts: Account[];
  amount: number;
  cashOrBankAccountId?: string;
  party?: Party;
  memo: string;
}): JournalLine[] {
  let lineIdx = 1;
  const cashAcc = resolveAccount(params.accounts, params.cashOrBankAccountId, '1111', 'Asset');
  const creditAcc = resolveAccount(params.accounts, params.party?.accountId, params.party ? '1120' : '4200', params.party ? 'Asset' : 'Revenue');

  return [
    createJournalLine(cashAcc, params.amount, 0, `${params.memo} - قبض ونقدية واردة`, lineIdx++),
    createJournalLine(creditAcc, 0, params.amount, `${params.memo} - سداد ذمم / إيراد`, lineIdx++),
  ];
}

/**
 * Cash Payment Voucher Journal Lines
 */
export function buildCashPaymentJournalLines(params: {
  accounts: Account[];
  amount: number;
  expenseOrSupplierAccountId?: string;
  paidFromAccountId?: string;
  party?: Party;
  memo: string;
}): JournalLine[] {
  let lineIdx = 1;
  const debitAcc = resolveAccount(
    params.accounts,
    params.expenseOrSupplierAccountId || params.party?.accountId,
    params.party ? '2100' : '5200',
    params.party ? 'Liability' : 'Expense'
  );
  const creditAcc = resolveAccount(params.accounts, params.paidFromAccountId, '1111', 'Asset');

  return [
    createJournalLine(debitAcc, params.amount, 0, `${params.memo} - سداد مستحق / مصروف`, lineIdx++),
    createJournalLine(creditAcc, 0, params.amount, `${params.memo} - منصرف من الخزينة/البنك`, lineIdx++),
  ];
}

/**
 * Goods Receipt (GRN) Journal Lines
 */
export function buildGoodsReceiptJournalLines(params: {
  accounts: Account[];
  totalCost: number;
  supplier?: Party;
  inventoryAccountId?: string;
  memo: string;
}): JournalLine[] {
  let lineIdx = 1;
  const invAcc = resolveAccount(params.accounts, params.inventoryAccountId, '1130', 'Asset');
  const supplierAcc = resolveAccount(params.accounts, params.supplier?.accountId, '2100', 'Liability');

  return [
    createJournalLine(invAcc, params.totalCost, 0, `${params.memo} - استلام بضاعة للمخزن`, lineIdx++),
    createJournalLine(supplierAcc, 0, params.totalCost, `${params.memo} - مستحق للمورد`, lineIdx++),
  ];
}

/**
 * Goods Issue (GIN) Journal Lines
 */
export function buildGoodsIssueJournalLines(params: {
  accounts: Account[];
  totalCost: number;
  expenseAccountId?: string;
  inventoryAccountId?: string;
  memo: string;
}): JournalLine[] {
  let lineIdx = 1;
  const expenseAcc = resolveAccount(params.accounts, params.expenseAccountId, '5100', 'Expense');
  const invAcc = resolveAccount(params.accounts, params.inventoryAccountId, '1130', 'Asset');

  return [
    createJournalLine(expenseAcc, params.totalCost, 0, `${params.memo} - تكلفة خامات ومستهلكات منصرفة`, lineIdx++),
    createJournalLine(invAcc, 0, params.totalCost, `${params.memo} - صرف أصناف من المخزن`, lineIdx++),
  ];
}

