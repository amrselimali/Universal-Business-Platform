/**
 * نافذة ملف العميل 360 — مستخرجة من BookingsFollowUpView
 */

import React from 'react';
import type { Appointment, Party, TreatmentPlan } from '../../types';

interface Props {
  t: (ar: string, en: string) => string;
  open: boolean;
  patient: Party | null;
  appointments: Appointment[];
  treatmentPlans: TreatmentPlan[];
  invoices: { customerName?: string }[];
  formatMoney: (value: number) => string;
  onClose: () => void;
}

export const Patient360Modal: React.FC<Props> = ({
  t, open, patient, appointments, treatmentPlans, invoices, formatMoney, onClose,
}) => {
  if (!open || !patient) return null;

  const visits = appointments.filter((item) => item.patientName === patient.name);
  const plans = treatmentPlans.filter((item) => item.patientName === patient.name);
  const invoiceCount = invoices.filter((item) => item.customerName === patient.name).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-lg">
              {patient.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">{patient.name}</h3>
              <p className="text-xs text-slate-400">
                {t('كود العميل:', 'Customer Code:')} {patient.customerCode || patient.code || '—'} • {t('كود السيستم:', 'System Code:')} {patient.systemCode || patient.paperCode || '—'} • {patient.phone} • {t('تاريخ التكويد:', 'Created:')} {patient.createdAt?.split('T')[0] || '-'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer">&times;</button>
        </div>

        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
            <span className="text-[11px] text-slate-400 block">{t('إجمالي الزيارات', 'Total Visits')}</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">{visits.length}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
            <span className="text-[11px] text-slate-400 block">{t('خطط العلاج', 'Treatment Plans')}</span>
            <span className="text-lg font-bold text-indigo-600">{plans.length}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
            <span className="text-[11px] text-slate-400 block">{t('الفواتير المسجلة', 'Total Invoices')}</span>
            <span className="text-lg font-bold text-emerald-600">{invoiceCount}</span>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t('سجل الزيارات والحجوزات السابقة', 'Past Visits & Bookings')}
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
            {visits.map((appointment) => (
              <div key={appointment.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{appointment.serviceNameAr}</div>
                  <div className="text-[10px] text-slate-400">{appointment.date} • {appointment.time} • د. {appointment.doctorName || 'استشاري'}</div>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">{formatMoney(appointment.price)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-white bg-slate-800 rounded-xl cursor-pointer">
            {t('إغلاق', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
