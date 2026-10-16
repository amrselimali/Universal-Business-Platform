import { describe, expect, it } from 'vitest';
import {
  assertBalancedJournalLines,
  calculateItemCostAndDeductions,
  createJournalLine,
  resolveAccount,
} from '../accountingEngine';
import type { Account, Product } from '../../types';

const acc = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'acc-1',
    tenantId: 't1',
    code: '1111',
    nameAr: 'الخزينة',
    nameEn: 'Cash',
    type: 'Asset',
    balance: 0,
    isDebitNormal: true,
    level: 2,
    ...overrides,
  }) as Account;

const prod = (overrides: Partial<Product> = {}): Product =>
  ({
    id: 'p1',
    tenantId: 't1',
    sku: 'SKU1',
    barcode: '',
    nameAr: 'منتج',
    nameEn: 'Product',
    category: 'cat',
    purchasePrice: 10,
    sellingPrice: 20,
    minStockLevel: 1,
    unit: 'قطعة',
    ...overrides,
  }) as Product;

describe('createJournalLine', () => {
  it('ينسخ بيانات الحساب في السطر', () => {
    const line = createJournalLine(acc({ id: 'a9', code: '4100', nameAr: 'إيرادات' }), 100, 0, 'بيع', 0);
    expect(line.accountId).toBe('a9');
    expect(line.accountCode).toBe('4100');
    expect(line.accountNameAr).toBe('إيرادات');
    expect(line.debit).toBe(100);
    expect(line.credit).toBe(0);
    expect(line.memo).toBe('بيع');
  });

  it('يمنع القيم السالبة (يصفّرها)', () => {
    const line = createJournalLine(acc(), -50, -30, '', 0);
    expect(line.debit).toBe(0);
    expect(line.credit).toBe(0);
  });

  it('يقرّب إلى قرشين', () => {
    const line = createJournalLine(acc(), 10.005, 0, '', 0);
    expect(line.debit).toBe(10.01);
  });

  it('يولّد معرّفات فريدة للأسطر', () => {
    const ids = new Set(
      Array.from({ length: 50 }, (_, i) => createJournalLine(acc(), 1, 0, '', i).id)
    );
    expect(ids.size).toBe(50);
  });
});

describe('resolveAccount', () => {
  const accounts = [
    acc({ id: 'a1', code: '1111', type: 'Asset' }),
    acc({ id: 'a2', code: '4100', type: 'Revenue' }),
    acc({ id: 'a3', code: '5200', type: 'Expense' }),
  ];

  it('يرجّح المعرّف المحدد', () => {
    expect(resolveAccount(accounts, 'a3').id).toBe('a3');
  });

  it('يسقط لكود الاحتياطي عند غياب المعرّف', () => {
    expect(resolveAccount(accounts, 'غير-موجود', '4100').id).toBe('a2');
  });

  it('يطابق بداية الكود أيضاً', () => {
    expect(resolveAccount(accounts, undefined, '41').id).toBe('a2');
  });

  it('يسقط لنوع الاحتياطي عند غياب الكود', () => {
    expect(resolveAccount(accounts, undefined, undefined, 'Expense').id).toBe('a3');
  });

  it('يرجع أول حساب كملاذ أخير', () => {
    expect(resolveAccount(accounts, undefined, '9999', 'Liability').id).toBe('a1');
  });
});

describe('assertBalancedJournalLines — الحارس المالي', () => {
  it('يقبل القيد المتوازن', () => {
    expect(() =>
      assertBalancedJournalLines([{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }], 'JV-1')
    ).not.toThrow();
  });

  it('يرفض القيد غير المتوازن', () => {
    expect(() =>
      assertBalancedJournalLines([{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }], 'JV-2')
    ).toThrow(/غير متوازن/);
  });

  it('يرفض القيد الفارغ', () => {
    expect(() => assertBalancedJournalLines([], 'JV-3')).toThrow(/غير متوازن/);
  });

  it('يرفض سطراً فيه مدين ودائن معاً', () => {
    expect(() => assertBalancedJournalLines([{ debit: 50, credit: 50 }], 'JV-4')).toThrow(
      /لا يجوز/
    );
  });

  it('يرفض القيم السالبة', () => {
    expect(() => assertBalancedJournalLines([{ debit: -10, credit: 0 }], 'JV-5')).toThrow(
      /غير صالحة/
    );
  });

  it('يرفض القيم غير الرقمية', () => {
    expect(() =>
      assertBalancedJournalLines([{ debit: NaN, credit: 0 }], 'JV-6')
    ).toThrow(/غير صالحة/);
  });

  it('يتسامح مع فروق الفاصلة العائمة (يقارن بالقرش)', () => {
    // 0.1 + 0.2 = 0.30000000000000004 مقابل 0.3 ⇒ يجب أن يُقبل (فرق أقل من قرش)
    expect(() =>
      assertBalancedJournalLines(
        [
          { debit: 0.1, credit: 0 },
          { debit: 0.2, credit: 0 },
          { debit: 0, credit: 0.3 },
        ],
        'JV-7'
      )
    ).not.toThrow();
  });

  it('يقبل قيداً بأكثر من سطرين على كل جانب', () => {
    expect(() =>
      assertBalancedJournalLines(
        [
          { debit: 60, credit: 0 },
          { debit: 40, credit: 0 },
          { debit: 0, credit: 70 },
          { debit: 0, credit: 30 },
        ],
        'JV-8'
      )
    ).not.toThrow();
  });
});

describe('calculateItemCostAndDeductions — محرك التكلفة (BOM)', () => {
  it('يرجع صفراً عند غياب المنتج أو كمية غير موجبة', () => {
    expect(calculateItemCostAndDeductions(undefined, 5, [])).toEqual({
      totalCost: 0,
      stockDeductions: [],
    });
    expect(calculateItemCostAndDeductions(prod(), 0, []).totalCost).toBe(0);
    expect(calculateItemCostAndDeductions(prod(), -3, []).totalCost).toBe(0);
  });

  it('يحسب التكلفة المباشرة من سعر الشراء', () => {
    const result = calculateItemCostAndDeductions(prod({ purchasePrice: 12.5 }), 4, []);
    expect(result.totalCost).toBe(50);
  });

  it('يحسب تكلفة الوصفة (BOM) بجمع مكوناتها', () => {
    const component1 = prod({ id: 'c1', purchasePrice: 3 });
    const component2 = prod({ id: 'c2', purchasePrice: 7 });
    const service = prod({
      id: 's1',
      purchasePrice: 0,
      linkedComponents: [
        { productId: 'c1', quantity: 2, unitCost: 3 },
        { productId: 'c2', quantity: 5, unitCost: 7 },
      ],
    });

    const result = calculateItemCostAndDeductions(service, 1, [component1, component2]);
    // 2×3 + 5×7 = 41
    expect(result.totalCost).toBe(41);
    expect(result.stockDeductions).toHaveLength(2);
  });

  it('يضاعف كميات المكونات بعدد الوحدات المباعة', () => {
    const component = prod({ id: 'c1', purchasePrice: 5 });
    const service = prod({
      id: 's1',
      linkedComponents: [{ productId: 'c1', quantity: 3, unitCost: 5 }],
    });

    const result = calculateItemCostAndDeductions(service, 4, [component]);
    // 3 × 4 = 12 وحدة × 5 = 60
    expect(result.totalCost).toBe(60);
    expect(result.stockDeductions[0].quantity).toBe(12);
  });

  it('يستخدم اسم المكوّن من قائمة المنتجات إن لم يُحدَّد في الوصفة', () => {
    const component = prod({ id: 'c1', nameAr: 'أمبولات ليزر', purchasePrice: 2 });
    const service = prod({
      id: 's1',
      linkedComponents: [{ productId: 'c1', quantity: 1, unitCost: 2 }],
    });

    const result = calculateItemCostAndDeductions(service, 1, [component]);
    expect(result.stockDeductions[0].productNameAr).toBe('أمبولات ليزر');
  });

  it('لا يخصم من المخزون صنفاً بيعياً غير مخزني (خدمة)', () => {
    const service = prod({
      id: 's2',
      purchasePrice: 10,
      isStockItem: false,
      itemType: 'sales_service',
    });

    const result = calculateItemCostAndDeductions(service, 2, []);
    expect(result.totalCost).toBe(20);
    expect(result.stockDeductions).toHaveLength(0); // لا خصم مخزني
  });

  it('يخصم من المخزون الصنف المخزني', () => {
    const stockItem = prod({ isStockItem: true, itemType: 'stock_raw', purchasePrice: 4 });
    const result = calculateItemCostAndDeductions(stockItem, 3, []);
    expect(result.totalCost).toBe(12);
    expect(result.stockDeductions).toHaveLength(1);
    expect(result.stockDeductions[0].quantity).toBe(3);
  });
});
