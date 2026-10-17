/**
 * نافذة تعديل موعد الحجز — مستخرجة من BookingsFollowUpView
 * (تشمل فحص التعارض اللحظي للطبيب)
 */

import React from 'react';
import { AlertTriangle, Check, Clock } from 'lucide-react';
import { checkDoctorAppointmentConflict, formatMinutesTo24h, parseTimeToMinutes } from '../../utils/bookingTimeUtils';
import type { Appointment } from '../../types';

interface Props {
  t: (ar: string, en: string) => string;
  open: boolean;
  appointment: Appointment | null;
  appointments: Appointment[];
  isRtl: boolean;
  todayIso: string;
  date: string;
  setDate: (value: string) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}

const fieldClass =
  'w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold';

export const RescheduleModal: React.FC<Props> = ({
  t, open, appointment, appointments, isRtl, todayIso,
  date, setDate, startTime, setStartTime, endTime, setEndTime, notes, setNotes, onSubmit, onClose,
}) => {
  if (!open || !appointment) return null;

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const invalidInterval = startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes;
  const conflict = checkDoctorAppointmentConflict(
    date, appointment.doctorId, appointment.doctorName,
    startTime, endTime, appointments, appointment.id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
          {t('تعديل موعد الحجز (Reschedule)', 'Reschedule Appointment')}
        </h3>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('التاريخ الجديد * (تاريخ اليوم أو تاريخ مستقبلي)', 'New Date * (Today or Future)')}
            </label>
            <input type="date" required min={todayIso} value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                <span>{t('وقت البدء (من) *', 'Start Time (From) *')}</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(event) => {
                  const next = event.target.value;
                  setStartTime(next);
                  const minutes = parseTimeToMinutes(next);
                  if (minutes !== null) {
                    const currentEnd = parseTimeToMinutes(endTime);
                    if (currentEnd === null || currentEnd <= minutes) setEndTime(formatMinutesTo24h(minutes + 45));
                  }
                }}
                className={`${fieldClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                <span>{t('وقت الانتهاء (إلى) *', 'End Time (To) *')}</span>
              </label>
              <input type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className={`${fieldClass} font-mono`} />
            </div>
          </div>

          {invalidInterval ? (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{t('وقت نهاية الجلسة (إلى) يجب أن يكون بعد وقت بدايتها (من)', 'End time must be after start time')}</span>
            </div>
          ) : conflict.hasConflict ? (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-xl text-xs text-rose-900 dark:text-rose-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{t('تعارض موعد محجوز لنفس الطبيب!', 'Doctor Conflict!')}</span>
              </div>
              <p className="text-[11px] leading-relaxed">{isRtl ? conflict.reasonAr : conflict.reasonEn}</p>
            </div>
          ) : startMinutes !== null && endMinutes !== null ? (
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span className="flex items-center gap-1 font-bold">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>{t('الموعد متاح بدون تعارض', 'Slot is available')}</span>
              </span>
              <span className="font-mono text-[10px] font-bold">{endMinutes - startMinutes} {t('دقيقة', 'min')}</span>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('ملاحظات سبب التأجيل', 'Reschedule Notes')}</label>
            <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="طلب العميل التأجيل بسبب العمل..." className={fieldClass} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
              {t('إلغاء', 'Cancel')}
            </button>
            <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer">
              {t('تحديث الموعد', 'Save New Date')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
