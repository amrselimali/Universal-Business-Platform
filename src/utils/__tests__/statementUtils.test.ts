import { describe, expect, it } from 'vitest';
import { getPartyLookupCodes, normalizeArabicName } from '../statementUtils';
import type { Party } from '../../types';

describe('normalizeArabicName', () => {
  it('يرجع نصاً فارغاً للقيم الفارغة', () => {
    expect(normalizeArabicName(undefined)).toBe('');
    expect(normalizeArabicName('')).toBe('');
  });

  it('يوحّد الهمزات والتاء المربوطة والألف المقصورة', () => {
    expect(normalizeArabicName('أحمد')).toBe('احمد');
    expect(normalizeArabicName('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabicName('فاطمة')).toBe('فاطمه');
    expect(normalizeArabicName('مصطفى')).toBe('مصطفي');
  });

  it('يزيل التشكيل والتطويل', () => {
    expect(normalizeArabicName('مُحَمَّد')).toBe('محمد');
    expect(normalizeArabicName('مـــحمد')).toBe('محمد');
  });

  it('يزيل الألقاب في البداية', () => {
    expect(normalizeArabicName('د/ محمد')).toBe('محمد');
    expect(normalizeArabicName('السيد أحمد')).toBe('احمد');
    expect(normalizeArabicName('Mr John')).toBe('john');
  });

  it('يطبّع المسافات ويصغّر الحروف', () => {
    expect(normalizeArabicName('  علي   حسن  ')).toBe('علي حسن');
  });
});

const buildParty = (overrides: Partial<Party> = {}): Party =>
  ({
    id: 'party-1',
    tenantId: 'tenant-1',
    name: 'عميل تجريبي',
    nameEn: 'Test Customer',
    type: 'Customer',
    phone: '01000000000',
    balance: 0,
    ...overrides,
  }) as Party;

describe('getPartyLookupCodes', () => {
  it('يجمع كل أكواد العميل المعروفة', () => {
    const party = buildParty({
      customerCode: '1001',
      code: '1001',
      systemCode: 'SYS-1001',
      paperCode: 'P-1001',
      fileCode: '1001',
    });

    const codes = getPartyLookupCodes(party);

    // الأكواد تُخزَّن بحروف صغيرة (lowercase) لتطابق موحّد
    expect(codes.has('party-1')).toBe(true);
    expect(codes.has('1001')).toBe(true);
    expect(codes.has('sys-1001')).toBe(true);
    expect(codes.has('p-1001')).toBe(true);
  });

  it('يضيف نسخة بدون أصفار بادئة (توحيد أكواد المسلسل)', () => {
    const codes = getPartyLookupCodes(buildParty({ customerCode: '001001' }));
    expect(codes.has('001001')).toBe(true);
    expect(codes.has('1001')).toBe(true);
  });

  it('لا يخلط أكواد عميل بآخر (كل عميل له مجموعة مستقلة)', () => {
    const a = getPartyLookupCodes(buildParty({ id: 'party-a', customerCode: '2001' }));
    const b = getPartyLookupCodes(buildParty({ id: 'party-b', customerCode: '3001' }));

    expect(a.has('2001')).toBe(true);
    expect(a.has('3001')).toBe(false);
    expect(b.has('3001')).toBe(true);
    expect(b.has('2001')).toBe(false);
  });

  it('يتجاهل الأكواد الفارغة', () => {
    const codes = getPartyLookupCodes(buildParty({ customerCode: '', code: undefined }));
    expect(codes.has('')).toBe(false);
  });
});
