/**
 * نافذة تفاصيل سجل التدقيق (Snapshots Before/After) — مستخرجة من AuditTrailView
 * (تفكيك بلا تغيير سلوك، وتقليل أسطر الشاشة).
 */

import React from 'react';
import { Edit3, Trash2, FileText, User, Clock, AlertTriangle } from 'lucide-react';
import type { AuditRecord } from '../../types';

interface Props {
  t: (ar: string, en: string) => string;
  open: boolean;
  record: AuditRecord | null;
  entityTypeLabel: string;
  onClose: () => void;
}

export const AuditSnapshotModal: React.FC<Props> = ({ t, open, record, entityTypeLabel, onClose }) => {
  if (!open || !record) return null;
  const selectedRecord = record;
  const setShowSnapshotModal = (_value: boolean) => onClose();

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${
                    selectedRecord.actionType === 'DELETE' || selectedRecord.actionType === 'CANCEL' ? 'bg-rose-600' : 'bg-amber-600'
                  }`}
                >
                  {selectedRecord.actionType === 'DELETE' || selectedRecord.actionType === 'CANCEL' ? <Trash2 className="h-5 w-5" /> : <Edit3 className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {t('كشف تفاصيل السجل والبيانات', 'Audit Record Snapshot & Diff')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedRecord.entityName} • {entityTypeLabel} • {new Date(selectedRecord.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSnapshotModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Reason & User Details Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">{t('المستخدم المنفذ:', 'Performed By:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedRecord.performedByName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">{t('السبب المذكور للعملية:', 'Recorded Reason:')}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{selectedRecord.reason || selectedRecord.details || t('غير محدد', 'Unspecified')}</span>
              </div>
              {selectedRecord.diffSummary && (
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-300">{t('ملخص التغيير:', 'Diff Summary:')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRecord.diffSummary}</span>
                </div>
              )}
            </div>

            {/* Data Snapshots Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Snapshot Before */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/40">
                <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t('البيانات السابقة (قبل التعديل أو الحذف)', 'Snapshot Before')}</span>
                </h4>
                <pre className="text-[11px] font-mono p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-60 text-slate-800 dark:text-slate-200">
                  {JSON.stringify(selectedRecord.previousState || {}, null, 2)}
                </pre>
              </div>

              {/* Snapshot After */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/40">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{t('البيانات الحالية (بعد التعديل)', 'Snapshot After')}</span>
                </h4>
                <pre className="text-[11px] font-mono p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-60 text-slate-800 dark:text-slate-200">
                  {selectedRecord.newState
                    ? JSON.stringify(selectedRecord.newState, null, 2)
                    : t('// تم الحذف بالكامل من النظام', '// Entity completely removed')}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowSnapshotModal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                {t('إغلاق النافذة', 'Close')}
              </button>
            </div>
          </div>
        </div>
  );
};
