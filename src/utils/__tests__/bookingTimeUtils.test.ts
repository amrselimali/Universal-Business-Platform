import { describe, expect, it } from 'vitest';
import {
  formatMinutesTo12h,
  formatMinutesTo24h,
  parseTimeToMinutes,
} from '../bookingTimeUtils';

describe('parseTimeToMinutes', () => {
  it('يرجع null للقيم الفارغة', () => {
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
  });

  it('يحوّل الوقت بنظام 24 ساعة', () => {
    expect(parseTimeToMinutes('10:00')).toBe(600);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('يحوّل الوقت بنظام 12 ساعة (عربي وإنجليزي)', () => {
    expect(parseTimeToMinutes('02:30 PM')).toBe(870);
    expect(parseTimeToMinutes('10:00 AM')).toBe(600);
    expect(parseTimeToMinutes('02:30 م')).toBe(870);
    expect(parseTimeToMinutes('10:00 ص')).toBe(600);
    expect(parseTimeToMinutes('12:00 PM')).toBe(720);
  });

  it('يحوّل كسر الوقت القادم من Excel', () => {
    expect(parseTimeToMinutes(0.5)).toBe(720);
    expect(parseTimeToMinutes('0.5')).toBe(720);
  });

  it('يتعامل مع الأرقام العربية', () => {
    expect(parseTimeToMinutes('١٠:٠٠')).toBe(600);
  });
});

describe('formatMinutesTo24h', () => {
  it('ينسّق بالصيغة 24 ساعة مع أصفار بادئة', () => {
    expect(formatMinutesTo24h(0)).toBe('00:00');
    expect(formatMinutesTo24h(600)).toBe('10:00');
    expect(formatMinutesTo24h(1439)).toBe('23:59');
  });
});

describe('formatMinutesTo12h', () => {
  it('ينسّق بالعربية افتراضياً', () => {
    expect(formatMinutesTo12h(0)).toBe('12:00 ص');
    expect(formatMinutesTo12h(600)).toBe('10:00 ص');
    expect(formatMinutesTo12h(870)).toBe('02:30 م');
    expect(formatMinutesTo12h(720)).toBe('12:00 م');
  });

  it('ينسّق بالإنجليزية عند الطلب', () => {
    expect(formatMinutesTo12h(870, 'en')).toBe('02:30 PM');
    expect(formatMinutesTo12h(600, 'en')).toBe('10:00 AM');
  });
});
