/**
 * نافذة تسجيل حضور/عدم حضور المريض — مستخرجة من BookingsFollowUpView
 */

import React from 'react';
import type { Appointment } from '../../types';

interface Props {
  t: (ar: string, en: string) => string;
  open: boolean;
  appointment: Appointment | null;
  status: 'Attended' | 'NotAttended';
  setStatus: (value: 'Attended' | 'NotAttended') => void;
  reason: string;
  setReason: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}

export const AttendanceModal: React.FC<Props> = ({
  t, open, appointment, status, setStatus, reason, setReason, onSubmit, onClose,
}) => {
  if (!open || !appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
          {t('تسجيل حضور / عدم حضور المريض', 'Mark Patient Attendance')}
        </h3>

        <p className="text-xs text-slate-500 mb-4">
          {t('المريض:', 'Patient:')} <span className="font-bold text-slate-800 dark:text-slate-200">{appointment.patientName}</span> • {appointment.time}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus('Attended')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                status === 'Attended'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              ✓ {t('حضر وتم تقديم الخدمة', 'Attended')}
            </button>
            <button
              type="button"
              onClick={() => setStatus('NotAttended')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                status === 'NotAttended'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              ✕ {t('لم يحضر (اعتذار / تأجيل)', 'Not Attended')}
            </button>
          </div>

          {status === 'NotAttended' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('سبب عدم الحضور *', 'Reason for Non-Attendance *')}
              </label>
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600">
                <option value="الهاتف مغلق / لم يرد">الهاتف مغلق / لم يرد</option>
                <option value="اعتذر لظروف طارئة وطلب تأجيل الموعد">اعتذر لظروف طارئة وطلب تأجيل الموعد</option>
                <option value="مسافر خارج المدينة">مسافر خارج المدينة</option>
                <option value="عدم توفر المبلغ حالياً">عدم توفر المبلغ حالياً</option>
                <option value="لم يحضر بدون إبداء أسباب">لم يحضر بدون إبداء أسباب</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
              {t('إلغاء', 'Cancel')}
            </button>
            <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer">
              {t('تحديث الحالة', 'Update Status')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
