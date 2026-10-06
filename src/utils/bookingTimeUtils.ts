// Utilities for Appointment Time Parsing, Overlap Conflict Detection, and Sorting

import { Appointment } from '../types';

/**
 * Universally normalizes any date input from Excel / user into a clean ISO string "YYYY-MM-DD".
 * Handles:
 * 1. JavaScript Date objects (e.g. from XLSX cellDates: true)
 * 2. Excel numeric serial dates (e.g. 44298 -> "2021-04-12")
 * 3. Text in "YYYY-MM-DD", "YYYY/MM/DD", "YYYY.MM.DD"
 * 4. Text in "DD-MM-YYYY", "DD/MM/YYYY", "DD.MM.YYYY"
 * 5. ISO strings like "2021-04-12T00:00:00.000Z"
 * 6. Date strings like "Mon Apr 12 2021 ..."
 * 7. Eastern Arabic numerals (٠-٩)
 * 8. Hidden unicode directional marks (\u200E, \u200F, \uFEFF)
 */
export const parseExcelDate = (val: any): string | null => {
  if (val === null || val === undefined || val === '') return null;

  // 1. If it's already a Date instance
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. If it's a number (Excel serial date, e.g. 46300 -> 2026-10-05, with or without time decimals)
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    // Excel epoch: Dec 30, 1899
    const utcDays = Math.floor(val - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (isNaN(dateObj.getTime())) return null;
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let str = String(val);

  // 3. Normalize Eastern Arabic numerals: ٠-٩ -> 0-9
  str = str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  // 4. Strip hidden unicode formatting characters, quotes, and trim
  str = str
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
    .replace(/^['"`]+|['"`]+$/g, '')
    .trim();
  if (!str) return null;

  // 5. If it's a numeric string like "46300" or "46300.41666"
  if (/^\d{4,6}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    const utcDays = Math.floor(num - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 6. Direct Regex Match for YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (at beginning of string)
  const ymdMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 7. Regex Match for DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 8. Try Date.parse fallback (e.g. "Mon Oct 05 2026 ...")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
};

/**
 * Parses any time string (12-hour or 24-hour) or Excel fractional number into minutes from midnight (0 to 1439).
 * Supports: "14:30", "02:30 PM", "10:00 AM", "10:00", "02:30 م", "10:00 ص", 0.4166667
 */
export const parseTimeToMinutes = (timeVal?: any): number | null => {
  if (timeVal === null || timeVal === undefined || timeVal === '') return null;

  // If number between 0 and 1 (Excel fractional time)
  if (typeof timeVal === 'number' && timeVal >= 0 && timeVal < 1) {
    return Math.round(timeVal * 1440) % 1440;
  }

  let clean = String(timeVal)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
    .trim();
  if (!clean) return null;

  // Decimal string e.g. "0.4166667"
  if (/^0\.\d+$/.test(clean)) {
    const num = parseFloat(clean);
    if (!isNaN(num) && num >= 0 && num < 1) {
      return Math.round(num * 1440) % 1440;
    }
  }

  // 12-hour format e.g. "02:30 PM", "10:00 AM", "2:30pm", "02:30 م", "10:00 ص"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|ص|م)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' || period === 'م') {
      if (hours < 12) hours += 12;
    } else if (period === 'AM' || period === 'ص') {
      if (hours === 12) hours = 0;
    }
    return hours * 60 + minutes;
  }

  // 24-hour format e.g. "14:30", "09:15", "9:15"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  // Fallback: check if time string contains a time like "10:00"
  const partialMatch = clean.match(/(\d{1,2}):(\d{2})/);
  if (partialMatch) {
    let hours = parseInt(partialMatch[1], 10);
    const minutes = parseInt(partialMatch[2], 10);
    if (/PM|م/i.test(clean) && hours < 12) hours += 12;
    if (/AM|ص/i.test(clean) && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  return null;
};

/**
 * Formats minutes from midnight into 24h format "HH:mm"
 */
export const formatMinutesTo24h = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Formats minutes from midnight into 12h display string e.g. "10:00 AM" or "02:30 PM"
 */
export const formatMinutesTo12h = (minutes: number, lang: 'ar' | 'en' = 'ar'): string => {
  let h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const isPm = h >= 12;
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;

  const suffix = lang === 'ar' ? (isPm ? 'م' : 'ص') : (isPm ? 'PM' : 'AM');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
};

/**
 * Extracts start and end minutes for an appointment.
 * Defaults to 30 min duration if end time is missing.
 */
export const getAppointmentTimeRange = (
  apt: Pick<Appointment, 'startTime' | 'endTime' | 'time'>
): { startMin: number | null; endMin: number | null } => {
  let startMin: number | null = null;
  let endMin: number | null = null;

  if (apt.startTime) {
    startMin = parseTimeToMinutes(apt.startTime);
  }
  if (apt.endTime) {
    endMin = parseTimeToMinutes(apt.endTime);
  }

  // If time string has a range like "10:00 - 10:45"
  if ((startMin === null || endMin === null) && apt.time && apt.time.includes(' - ')) {
    const parts = apt.time.split(' - ');
    if (startMin === null) startMin = parseTimeToMinutes(parts[0]);
    if (endMin === null) endMin = parseTimeToMinutes(parts[1]);
  }

  // If only apt.time exists (single time)
  if (startMin === null && apt.time) {
    startMin = parseTimeToMinutes(apt.time);
  }

  // If startMin exists but no endMin, default to 30 minutes duration
  if (startMin !== null && endMin === null) {
    endMin = startMin + 30;
  }

  return { startMin, endMin };
};

export interface DoctorConflictResult {
  hasConflict: boolean;
  conflictingAppointment?: Appointment;
  reasonAr?: string;
  reasonEn?: string;
}

/**
 * Checks if a proposed appointment time interval overlaps with an existing appointment
 * for the SAME doctor on the SAME date.
 *
 * Rules:
 * 1. Two intervals [S1, E1] and [S2, E2] overlap iff: S1 < E2 AND S2 < E1.
 * 2. Touching borders (e.g. 10:00-10:30 and 10:30-11:00) is NOT an overlap and IS ALLOWED.
 * 3. Overlap is checked ONLY for the SAME doctor (by doctorId or doctorName).
 * 4. Different doctors at the exact same date & time are completely permitted.
 * 5. Cancelled appointments are excluded.
 */
export const checkDoctorAppointmentConflict = (
  targetDate: string,
  targetDoctorId: string | undefined,
  targetDoctorName: string,
  startTime: string,
  endTime: string,
  allAppointments: Appointment[],
  excludeAppointmentId?: string
): DoctorConflictResult => {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);

  if (startMin === null || endMin === null) {
    return { hasConflict: false };
  }

  if (endMin <= startMin) {
    return {
      hasConflict: true,
      reasonAr: 'وقت نهاية الجلسة (إلى) يجب أن يكون بعد وقت بدايتها (من).',
      reasonEn: 'Session end time must be strictly after start time.',
    };
  }

  const cleanTargetDoc = (targetDoctorName || '').trim().toLowerCase();

  for (const apt of allAppointments) {
    // Exclude the current appointment if editing / rescheduling
    if (excludeAppointmentId && apt.id === excludeAppointmentId) continue;

    // Exclude cancelled appointments
    if (apt.status === 'Cancelled') continue;

    // Must be on the exact same date
    if (apt.date !== targetDate) continue;

    // Must be the same doctor (by doctorId or by doctorName)
    const isSameDoctor =
      (targetDoctorId && apt.doctorId && targetDoctorId === apt.doctorId) ||
      (cleanTargetDoc && (apt.doctorName || '').trim().toLowerCase() === cleanTargetDoc);

    if (!isSameDoctor) continue;

    // Doctor and Date match! Now check interval overlap
    const { startMin: otherStart, endMin: otherEnd } = getAppointmentTimeRange(apt);
    if (otherStart === null || otherEnd === null) continue;

    // Overlap condition: startMin < otherEnd && otherStart < endMin
    if (startMin < otherEnd && otherStart < endMin) {
      const confStart = apt.startTime || formatMinutesTo24h(otherStart);
      const confEnd = apt.endTime || formatMinutesTo24h(otherEnd);

      return {
        hasConflict: true,
        conflictingAppointment: apt,
        reasonAr: `⚠️ تعارض في وقت الجلسة: الطبيب المعالج (${apt.doctorName}) لديه حجز بالفعل للمريض (${apt.patientName}) في نفس اليوم (${apt.date}) من الساعة [${confStart}] إلى [${confEnd}]. هذا الوقت محجوز ولا يمكن استخدامه مرة أخرى لنفس الطبيب. (ملاحظة: يجوز تسجيل نفس التوقيت لطبيب آخر).`,
        reasonEn: `⚠️ Scheduling Conflict: Doctor (${apt.doctorName}) already has a booked session for patient (${apt.patientName}) on ${apt.date} from [${confStart}] to [${confEnd}]. Overlapping sessions for the same doctor are not allowed.`,
      };
    }
  }

  return { hasConflict: false };
};

/**
 * High-performance O(N log N) sorting for appointments:
 * Pre-extracts sort keys to avoid re-parsing times and regex inside the comparison loop.
 * 1. By Date (chronological ascending)
 * 2. By Doctor Name (alphabetical)
 * 3. By Booking Start Time (earliest first)
 */
export const sortAppointments = (list: Appointment[]): Appointment[] => {
  if (!list || list.length <= 1) return list;

  // Decorate appointments with pre-computed keys to ensure O(N) extraction instead of O(N log N) regexes
  const decorated = list.map((apt) => {
    const { startMin } = getAppointmentTimeRange(apt);
    return {
      apt,
      date: apt.date || '',
      doc: (apt.doctorName || '').trim(),
      startMin: startMin !== null ? startMin : 9999,
    };
  });

  decorated.sort((a, b) => {
    // 1. Date (earliest first)
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }

    // 2. Doctor Name
    if (a.doc !== b.doc) {
      return a.doc.localeCompare(b.doc, 'ar');
    }

    // 3. Start time minutes
    return a.startMin - b.startMin;
  });

  return decorated.map((d) => d.apt);
};
