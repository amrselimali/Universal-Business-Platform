/**
 * نافذة تسجيل موعد دوام موظف — مستخرجة من BookingsFollowUpView
 * (تفكيك هيكلي بلا تغيير سلوك).
 */

import React from 'react';
import { Users } from 'lucide-react';
import type { StaffMember } from '../../types';

interface Props {
  t: (ar: string, en: string) => string;
  open: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  branchStaffMembers: StaffMember[];
  staffId: string;
  setStaffId: (value: string) => void;
  staffName: string;
  setStaffName: (value: string) => void;
  jobTitle: string;
  setJobTitle: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  todayIso: string;
}

const fieldClass =
  'w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold';

export const AddStaffScheduleModal: React.FC<Props> = ({
  t, open, onClose, onSubmit, branchStaffMembers,
  staffId, setStaffId, staffName, setStaffName, jobTitle, setJobTitle,
  date, setDate, startTime, setStartTime, endTime, setEndTime, notes, setNotes, todayIso,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              {t('تسجيل موعد دوام موظف بالفرع', 'Add Staff Work Schedule')}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer">
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('اسم الموظف *', 'Employee Name *')}
            </label>
            <select
              required
              value={staffId}
              onChange={(event) => {
                const id = event.target.value;
                setStaffId(id);
                const selected = branchStaffMembers.find((item) => item.id === id);
                if (selected) {
                  setStaffName(selected.nameAr);
                  setJobTitle(selected.jobTitleAr || selected.specialtyAr || selected.role || 'مقدم خدمة');
                } else {
                  setStaffName('');
                  setJobTitle('');
                }
              }}
              className="w-full px-3 py-2.5 text-xs rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white font-bold focus:outline-indigo-600"
            >
              <option value="">{t('-- اختر اسم الموظف * --', '-- Select Staff Member * --')}</option>
              {branchStaffMembers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nameAr} {item.jobTitleAr ? `[${item.jobTitleAr}]` : item.specialtyAr ? `[${item.specialtyAr}]` : ''}
                </option>
              ))}
            </select>
            {branchStaffMembers.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                {t('لا يوجد موظفون مكودون بهذا الفرع في إدارة الموظفين.', 'No staff found for this branch in Staff Management.')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('الوظيفة', 'Job Title')}</label>
            <input type="text" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder={t('الوظيفة...', 'Job Title...')} className={fieldClass} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('تاريخ الدوام *', 'Duty Date *')}</label>
            <input type="date" required min={todayIso} value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('وقت بداية العمل *', 'Start Time *')}</label>
              <input type="text" required value={startTime} onChange={(event) => setStartTime(event.target.value)} placeholder="09:00 AM" className={fieldClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('وقت انتهاء العمل *', 'End Time *')}</label>
              <input type="text" required value={endTime} onChange={(event) => setEndTime(event.target.value)} placeholder="05:00 PM" className={fieldClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('ملاحظات', 'Notes')}</label>
            <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ملاحظات العيادة، الغرفة، الشفت..." className={fieldClass} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
              {t('إلغاء', 'Cancel')}
            </button>
            <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20">
              {t('حفظ موعد الدوام', 'Save Schedule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
