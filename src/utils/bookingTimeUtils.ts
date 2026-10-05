// Utilities for Appointment Time Parsing, Overlap Conflict Detection, and Sorting

import { Appointment } from '../types';

/**
 * Parses any time string (12-hour or 24-hour) into minutes from midnight (0 to 1439).
 * Supports: "14:30", "02:30 PM", "10:00 AM", "10:00", "02:30 م", "10:00 ص"
 */
export const parseTimeToMinutes = (timeStr?: string | null): number | null => {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  if (!clean) return null;

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
 * Sorts appointments according to user requirement:
 * 1. By Date (chronological ascending)
 * 2. By Doctor Name (alphabetical)
 * 3. By Booking Start Time (earliest first)
 */
export const sortAppointments = (list: Appointment[]): Appointment[] => {
  return [...list].sort((a, b) => {
    // 1. Date (earliest first)
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp !== 0) return dateCmp;

    // 2. Doctor Name (alphabetical in Arabic)
    const docA = (a.doctorName || '').trim();
    const docB = (b.doctorName || '').trim();
    const docCmp = docA.localeCompare(docB, 'ar');
    if (docCmp !== 0) return docCmp;

    // 3. Booking Start Time (earliest first)
    const { startMin: startA } = getAppointmentTimeRange(a);
    const { startMin: startB } = getAppointmentTimeRange(b);
    const tA = startA !== null ? startA : 9999;
    const tB = startB !== null ? startB : 9999;
    return tA - tB;
  });
};
