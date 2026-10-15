import React from 'react';
import type { Party, TreatmentPlan } from '../types';

/**
 * مودال إنشاء خطة علاج / باكدج جلسات
 * ---------------------------------------------------------------------------
 * فُصل من `BookingsFollowUpView.tsx` كخطوة في تقسيمه.
 *
 * المكوّن **بلا حالة داخلية** (Stateless): يستقبل القيم والتغييرات من الأب،
 * وهذا يجعله قابلاً لإعادة الاستخدام في أي شاشة أخرى (مثل ملف المريض).
 */

interface NewTreatmentPlanModalProps {
  t: (ar: string, en: string) => string;
  parties: Party[];
  /** اليوم بصيغة ISO — يُستخدم كتاريخ بدء الخطة وأول جلسة. */
  todayIso: string;
  planPatientId: string;
  planTitle: string;
  planTotalSessions: number;
  planTotalCost: number;
  planDoctorName: string;
  onPatientChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSessionsChange: (value: number) => void;
  onCostChange: (value: number) => void;
  onCreatePlan: (plan: Omit<TreatmentPlan, 'id' | 'tenantId'>) => void;
  onClose: () => void;
}

export const NewTreatmentPlanModal: React.FC<NewTreatmentPlanModalProps> = ({
  t,
  parties,
  todayIso,
  planPatientId,
  planTitle,
  planTotalSessions,
  planTotalCost,
  planDoctorName,
  onPatientChange,
  onTitleChange,
  onSessionsChange,
  onCostChange,
  onCreatePlan,
  onClose,
}) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          {t('إنشاء خطة علاج / باكدج جلسات', 'New Treatment Care Plan')}
        </h3>

        <form onSubmit={(e) => {
          e.preventDefault();
          const p = parties.find((party) => party.id === planPatientId);
          if (!p) return;
          onCreatePlan({
            patientId: p.id,
            patientName: p.name,
            doctorName: planDoctorName || 'د. الاستشاري',
            title: planTitle,
            totalSessions: planTotalSessions,
            completedSessions: 0,
            totalCost: planTotalCost,
            status: 'Active',
            startDate: todayIso,
            sessions: [
              {
                sessionNumber: 1,
                date: todayIso,
                notes: 'جلسة أولى - فحص وخطة علاج',
                status: 'Pending',
              },
            ],
          });
          onClose();
        }} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('المريض / العميل *', 'Patient *')}
            </label>
            <select
              required
              value={planPatientId}
              onChange={(e) => onPatientChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
            >
              <option value="">{t('اختر المريض...', 'Select Patient...')}</option>
              {parties.filter((party) => !party.isArchived && !party.mergedIntoPartyId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('عنوان الخطة / الباكدج *', 'Plan Title *')}
            </label>
            <input
              type="text"
              required
              value={planTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="مثال: باكدج 6 جلسات ليزر كانديلا فول بودي..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('إجمالي عدد الجلسات', 'Total Sessions')}
              </label>
              <input
                type="number"
                min="1"
                value={planTotalSessions}
                onChange={(e) => onSessionsChange(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('التكلفة الإجمالية (ج.م)', 'Total Cost (EGP)')}
              </label>
              <input
                type="number"
                min="0"
                value={planTotalCost}
                onChange={(e) => onCostChange(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
            >
              {t('إنشاء الخطة', 'Create Plan')}
            </button>
          </div>
        </form>
      </div>
    </div>
);
