/**
 * نافذة إلغاء موعد — مستخرجة من BookingsFollowUpView
 */

import React from 'react';
import type { Appointment } from '../../types';

interface Props {
  t: (ar: string, en: string) => string;
  open: boolean;
  appointment: Appointment | null;
  reason: string;
  setReason: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}

export const CancelAppointmentModal: React.FC<Props> = ({
  t, open, appointment, reason, setReason, onSubmit, onClose,
}) => {
  if (!open || !appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
        <h3 className="text-base font-bold text-rose-600 mb-2">{t('إلغاء موعد الحجز', 'Cancel Booking')}</h3>
        <p className="text-xs text-slate-500 mb-4">
          {t('المريض:', 'Patient:')} <span className="font-bold">{appointment.patientName}</span> • {appointment.serviceNameAr}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('سبب الإلغاء * (يتم حفظه في سجل الأوديت)', 'Cancellation Reason *')}
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="سبب إلغاء الحجز..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-rose-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
              {t('تراجع', 'Back')}
            </button>
            <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer">
              {t('تأكيد الإلغاء', 'Confirm Cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
