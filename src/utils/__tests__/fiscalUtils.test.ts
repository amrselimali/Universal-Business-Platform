import { describe, expect, it } from 'vitest';
import { generateZatcaTlvBase64, tafqeetArabic } from '../fiscalUtils';

describe('tafqeetArabic', () => {
  it('يرجع "صفر" للصفر والقيم غير الرقمية', () => {
    expect(tafqeetArabic(0)).toBe('صفر');
    expect(tafqeetArabic(NaN)).toBe('صفر');
  });

  it('يفقّط الآلاف بصيغة صحيحة', () => {
    expect(tafqeetArabic(1000)).toBe('فقط ألف جنيه مصري لا غير');
    expect(tafqeetArabic(2000)).toBe('فقط ألفان جنيه مصري لا غير');
    expect(tafqeetArabic(3000)).toContain('آلاف');
    expect(tafqeetArabic(11000)).toContain('ألف');
  });

  it('يفقّط الملايين بصيغة صحيحة', () => {
    expect(tafqeetArabic(1000000)).toContain('مليون');
    expect(tafqeetArabic(2000000)).toContain('مليونان');
    expect(tafqeetArabic(5000000)).toContain('ملايين');
    expect(tafqeetArabic(11000000)).toContain('مليون');
  });

  it('يضيف القروش عند وجود كسور', () => {
    const text = tafqeetArabic(100.25);
    expect(text).toContain('جنيه مصري');
    expect(text).toContain('قرش');
  });

  it('يغلّف الناتج بـ "فقط" و"لا غير"', () => {
    const text = tafqeetArabic(1500);
    expect(text.startsWith('فقط ')).toBe(true);
    expect(text.endsWith(' لا غير')).toBe(true);
  });

  it('يتعامل مع القيم السالبة بنفس قيمة المبلغ', () => {
    expect(tafqeetArabic(-1000)).toBe(tafqeetArabic(1000));
  });
});

describe('generateZatcaTlvBase64', () => {
  const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

  it('ينتج سلسلة Base64 صحيحة', () => {
    const tlv = generateZatcaTlvBase64(
      'عيادات ومجمع طبي',
      '300000000000003',
      '2026-10-14T12:00:00Z',
      1150,
      150
    );

    expect(typeof tlv).toBe('string');
    expect(tlv.length).toBeGreaterThan(0);
    expect(base64Pattern.test(tlv)).toBe(true);
  });

  it('يضمّن الحقول الخمسة المطلوبة (اسم البائع، الرقم الضريبي، التاريخ، الإجمالي، الضريبة)', () => {
    const tlv = generateZatcaTlvBase64(
      'Seller Name',
      '300000000000003',
      '2026-10-14T12:00:00Z',
      1150,
      150
    );

    const decoded = Buffer.from(tlv, 'base64').toString('utf8');
    expect(decoded).toContain('Seller Name');
    expect(decoded).toContain('300000000000003');
    expect(decoded).toContain('2026-10-14T12:00:00Z');
    expect(decoded).toContain('1150');
    expect(decoded).toContain('150');
  });
});
