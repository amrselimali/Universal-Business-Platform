import { describe, expect, it } from 'vitest';
import { formatEgyptianPhone, generateAppointmentWhatsAppText } from '../exportUtils';

/**
 * اختبارات صياغة أرقام الهاتف المصرية.
 *
 * الأهمية: الرقم الخاطئ يعني رسالة واتساب لا تصل للعميل، أو تكرار عميل
 * موجود في قاعدة البيانات بسبب اختلاف صيغة الرقم.
 */

describe('formatEgyptianPhone', () => {
  it('يحذف كل الرموز غير الرقمية', () => {
    expect(formatEgyptianPhone('010-1234-5678')).toBe('201012345678');
    expect(formatEgyptianPhone('(010) 1234 5678')).toBe('201012345678');
    expect(formatEgyptianPhone('010 1234 5678')).toBe('201012345678');
  });

  it('يزيل بادئة 00 الدولية', () => {
    expect(formatEgyptianPhone('00201012345678')).toBe('201012345678');
  });

  it('يضيف كود مصر 2 للأرقام المحلية (11 رقماً تبدأ بـ 01)', () => {
    expect(formatEgyptianPhone('01012345678')).toBe('201012345678');
    expect(formatEgyptianPhone('01112345678')).toBe('201112345678');
    expect(formatEgyptianPhone('01212345678')).toBe('201212345678');
  });

  it('لا يعدّل الأرقام الدولية الجاهزة (تبدأ بـ 20)', () => {
    expect(formatEgyptianPhone('201012345678')).toBe('201012345678');
  });

  it('لا يضيف البادئة لرقم محلي بطول غير 11', () => {
    expect(formatEgyptianPhone('0101234567')).toBe('0101234567');
  });

  it('يتعامل مع نص فارغ', () => {
    expect(formatEgyptianPhone('')).toBe('');
  });

  it('ينتج نفس الناتج لصيغ مختلفة لنفس الرقم (يمنع تكرار العملاء)', () => {
    const formats = ['01012345678', '010 1234 5678', '010-1234-5678', '+20 10 1234 5678', '00201012345678'];
    const normalized = new Set(formats.map(formatEgyptianPhone));
    expect(normalized.size).toBe(1);
  });
});

describe('generateAppointmentWhatsAppText', () => {
  const appointment = {
    patientName: 'أحمد محمد',
    doctorName: 'د. سارة',
    serviceName: 'جلسة ليزر',
    price: 1500,
    date: '2026-10-20',
    time: '14:30',
  } as Parameters<typeof generateAppointmentWhatsAppText>[0];

  it('يولّد نصاً غير فارغ', () => {
    expect(generateAppointmentWhatsAppText(appointment).length).toBeGreaterThan(0);
  });

  it('يضمّن اسم المريض في الرسالة', () => {
    expect(generateAppointmentWhatsAppText(appointment)).toContain('أحمد محمد');
  });

  it('يضمّن اسم الطبيب والخدمة والتاريخ', () => {
    const text = generateAppointmentWhatsAppText(appointment);
    expect(text).toContain('د. سارة');
    expect(text).toContain('جلسة ليزر');
    expect(text).toContain('2026-10-20');
    expect(text).toContain('14:30');
  });

  it('يستخدم اسم المركز الافتراضي عند غيابه', () => {
    expect(generateAppointmentWhatsAppText(appointment)).toContain('المركز الطبي');
  });

  it('يستخدم اسم المركز المُمرَّر', () => {
    const text = generateAppointmentWhatsAppText({ ...appointment, clinicName: 'عيادات النور' });
    expect(text).toContain('عيادات النور');
  });
});
