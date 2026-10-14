import { describe, expect, it } from 'vitest';
import {
  differsFromSystemCode,
  getHighestCustomerCode,
  hasValidIndependentSerial,
  isCustomerParty,
  normalizeCustomerPartyCodes,
} from '../customerCodes';
import type { Party } from '../../../types';

const buildParty = (overrides: Partial<Party> = {}): Party =>
  ({
    id: 'p1',
    tenantId: 't1',
    name: 'عميل',
    nameEn: 'Customer',
    type: 'Customer',
    phone: '01000000000',
    balance: 0,
    ...overrides,
  }) as Party;

describe('isCustomerParty', () => {
  it('يميّز العملاء عن الموردين', () => {
    expect(isCustomerParty(buildParty({ type: 'Customer' }))).toBe(true);
    expect(isCustomerParty(buildParty({ type: 'Both' }))).toBe(true);
    expect(isCustomerParty(buildParty({ type: 'Supplier' }))).toBe(false);
  });
});

describe('differsFromSystemCode', () => {
  it('يعتبر الكود مطابقاً لكود السيستم (غير مستقل)', () => {
    const party = buildParty({ systemCode: '1001' });
    expect(differsFromSystemCode(party, '1001')).toBe(false);
  });

  it('يعتبر الكود مطابقاً حتى باختلاف الأصفار البادئة', () => {
    const party = buildParty({ systemCode: '1001' });
    expect(differsFromSystemCode(party, '01001')).toBe(false);
  });

  it('يقبل كوداً مختلفاً فعلاً', () => {
    const party = buildParty({ systemCode: '1001' });
    expect(differsFromSystemCode(party, '2002')).toBe(true);
  });

  it('يقبل أي كود عندما لا يوجد كود سيستم', () => {
    const party = buildParty({ systemCode: undefined, paperCode: undefined });
    expect(differsFromSystemCode(party, '5000')).toBe(true);
  });
});

describe('hasValidIndependentSerial', () => {
  it('يرفض القيم غير الرقمية أو الصفر أو السالبة', () => {
    const party = buildParty();
    expect(hasValidIndependentSerial(party, undefined)).toBe(false);
    expect(hasValidIndependentSerial(party, '')).toBe(false);
    expect(hasValidIndependentSerial(party, 'abc')).toBe(false);
    expect(hasValidIndependentSerial(party, '0')).toBe(false);
    expect(hasValidIndependentSerial(party, '-5')).toBe(false);
  });

  it('يقبل المسلسل الرقمي الصحيح المستقل', () => {
    expect(hasValidIndependentSerial(buildParty(), '1500')).toBe(true);
  });
});

describe('normalizeCustomerPartyCodes', () => {
  it('يُسنِد الفرع الافتراضي لأي عميل بلا فرع', () => {
    const result = normalizeCustomerPartyCodes([buildParty({ branchId: undefined })], {
      defaultBranchId: 'branch-cairo',
    });
    expect(result[0].branchId).toBe('branch-cairo');
  });

  it('يحتفظ بالكود الصالح المستقل كما هو', () => {
    const result = normalizeCustomerPartyCodes(
      [buildParty({ customerCode: '5000', code: '5000', systemCode: 'SYS-1' })],
      { defaultBranchId: 'b1' }
    );
    expect(result[0].customerCode).toBe('5000');
  });

  it('يولّد كوداً جديداً عندما يكون الكود مساوياً لكود السيستم', () => {
    const result = normalizeCustomerPartyCodes(
      [buildParty({ customerCode: '1001', code: '1001', systemCode: '1001' })],
      { defaultBranchId: 'b1' }
    );
    // 1001 مرفوض لأنه كود سيستم ⇒ يُولَّد مسلسل جديد
    expect(result[0].customerCode).not.toBe('1001');
    expect(Number(result[0].customerCode)).toBeGreaterThan(0);
  });

  it('يمنع تكرار الأكواد بين عميلين', () => {
    const result = normalizeCustomerPartyCodes(
      [
        buildParty({ id: 'a', customerCode: '7000', code: '7000', systemCode: 'S-1' }),
        buildParty({ id: 'b', customerCode: '7000', code: '7000', systemCode: 'S-2' }),
      ],
      { defaultBranchId: 'b1' }
    );

    const codes = result.map((p) => p.customerCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('لا يمنح مسلسل عميل لسجل مورد', () => {
    const result = normalizeCustomerPartyCodes(
      [buildParty({ id: 'sup', type: 'Supplier', customerCode: undefined, code: undefined })],
      { defaultBranchId: 'b1' }
    );
    expect(result[0].customerCode).toBeUndefined();
  });

  it('يضيف مورد الكاش إذا كان مفقوداً (حتى لا يستهلك مسلسل عميل)', () => {
    const cashSupplier = buildParty({ id: 'party-s-cash', type: 'Supplier', name: 'مورد كاش' });
    const result = normalizeCustomerPartyCodes([buildParty({ id: 'a' })], {
      cashSupplier,
      defaultBranchId: 'b1',
    });
    expect(result.some((p) => p.id === 'party-s-cash')).toBe(true);
  });

  it('لا يكرر مورد الكاش إذا كان موجوداً بالفعل', () => {
    const cashSupplier = buildParty({ id: 'party-s-cash', type: 'Supplier', name: 'مورد كاش' });
    const result = normalizeCustomerPartyCodes([cashSupplier], {
      cashSupplier,
      defaultBranchId: 'b1',
    });
    expect(result.filter((p) => p.id === 'party-s-cash')).toHaveLength(1);
  });
});

describe('getHighestCustomerCode', () => {
  it('يرجع أعلى كود عميل صالح', () => {
    const highest = getHighestCustomerCode([
      buildParty({ id: 'a', customerCode: '1500', systemCode: 'S-1' }),
      buildParty({ id: 'b', customerCode: '3200', systemCode: 'S-2' }),
      buildParty({ id: 'c', customerCode: '900', systemCode: 'S-3' }),
    ]);
    expect(highest).toBe(3200);
  });

  it('يرجع صفراً عند عدم وجود عملاء', () => {
    expect(getHighestCustomerCode([buildParty({ type: 'Supplier' })])).toBe(0);
  });
});
