import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { ReceptionShift } from '../types';
import {
  FileText,
  Search,
  Calendar,
  DollarSign,
  Zap,
  Layers,
  Eye,
  Printer,
  Download,
  Building2,
  CheckCircle,
  Clock,
  Activity,
  Lock,
} from 'lucide-react';

export const ShiftReportsView: React.FC = () => {
  const { language, t, formatMoney, receptionShifts, activeBranch, branches } = usePlatform();
  const isRtl = language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<ReceptionShift | null>(null);
  const [showShiftDetailsModal, setShowShiftDetailsModal] = useState(false);

  const filteredShifts = receptionShifts.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.shiftNumber.toLowerCase().includes(q) ||
      s.receptionistName.toLowerCase().includes(q) ||
      s.shiftDate.includes(q) ||
      s.runRows.some((r) => (r.patientName || r.customerName || '').toLowerCase().includes(q) || (r.systemCode || '').toLowerCase().includes(q));
    return matchesSearch;
  });

  const handleOpenDetails = (shift: ReceptionShift) => {
    setSelectedShift(shift);
    setShowShiftDetailsModal(true);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                {t('تقارير شيتات التشغيل والورديات السابقة', 'Historical Reception Shift Reports')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'أرشيف شامل ومفصل لكافة الشيفتات المغلقة، الإيرادات، المصروفات، وعدادات الليزر',
                  'Archive of closed shifts, revenue reconciliation, expenses breakdown, and pulses logs'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('بحث برقم الشيفت أو الموظف...', 'Search shift # or staff...')}
              className="bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5">{t('رقم الشيفت', 'Shift #')}</th>
                <th className="p-3.5">{t('التاريخ والتوقيت', 'Date & Time')}</th>
                <th className="p-3.5">{t('المسؤول (الاستقبال)', 'Receptionist')}</th>
                <th className="p-3.5">{t('حركات التشغيل', 'Entries')}</th>
                <th className="p-3.5">{t('الإيراد الإجمالي', 'Gross Revenue')}</th>
                <th className="p-3.5">{t('المحصل الفعلي', 'Collected')}</th>
                <th className="p-3.5">{t('المصروفات', 'Expenses')}</th>
                <th className="p-3.5">{t('صافي الكاش', 'Net Cash')}</th>
                <th className="p-3.5">{t('الحالة', 'Status')}</th>
                <th className="p-3.5 text-center">{t('معاينة التقرير', 'View Report')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p>{t('لا توجد تقارير شيفتات مسجلة.', 'No shift reports recorded yet.')}</p>
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {shift.shiftNumber}
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{shift.shiftDate}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {shift.closedAt ? ` - ${new Date(shift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </div>
                    </td>

                    <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                      {shift.receptionistName}
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        {shift.runRows.length} {t('حركة', 'rows')}
                      </span>
                    </td>

                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {formatMoney(shift.totalRevenue)}
                    </td>

                    <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(shift.totalCollected)}
                    </td>

                    <td className="p-3.5 font-bold text-rose-600 dark:text-rose-400">
                      {formatMoney(shift.totalExpenses)}
                    </td>

                    <td className="p-3.5 font-black text-indigo-700 dark:text-indigo-300">
                      {formatMoney(shift.netShiftCash)}
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                          shift.status === 'Open'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {shift.status === 'Open' ? t('مفتوح حالياً', 'Open') : t('مغلق', 'Closed')}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleOpenDetails(shift)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400 rounded-xl transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>{t('تفاصيل التقرير', 'Details')}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift Detailed Report Modal */}
      {showShiftDetailsModal && selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  <span>{t('تقرير إغلاق شيت التشغيل', 'Shift Closeout Report')} ({selectedShift.shiftNumber})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedShift.shiftDate} • {t('المسؤول:', 'Staff:')} {selectedShift.receptionistName}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>{t('طباعة التقرير', 'Print Report')}</span>
                </button>
                <button
                  onClick={() => setShowShiftDetailsModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer p-1"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Shift Financial Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                <span className="text-[11px] text-slate-400 block">{t('إجمالي إيراد الخدمات', 'Gross Rev')}</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-1 block">
                  {formatMoney(selectedShift.totalRevenue)}
                </span>
              </div>
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-center border border-emerald-100 dark:border-emerald-900/50">
                <span className="text-[11px] text-emerald-600 block">{t('إجمالي المقبوضات', 'Total Collected')}</span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
                  {formatMoney(selectedShift.totalCollected)}
                </span>
              </div>
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-center border border-rose-100 dark:border-rose-900/50">
                <span className="text-[11px] text-rose-600 block">{t('المصروفات المنصرفة', 'Total Expenses')}</span>
                <span className="text-base font-black text-rose-700 dark:text-rose-300 mt-1 block">
                  {formatMoney(selectedShift.totalExpenses)}
                </span>
              </div>
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-center border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[11px] text-indigo-600 block">{t('صافي الكاش الختامي', 'Net Shift Cash')}</span>
                <span className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-1 block">
                  {formatMoney(selectedShift.netShiftCash)}
                </span>
              </div>
            </div>

            {/* Run-sheet Entries Table */}
            <div className="space-y-2 mb-6">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-indigo-600" />
                <span>{t('جدول حركات التشغيل والخدمات المنفذة للمرضى', 'Patient Run Movements & Services')}</span>
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left rtl:text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5 text-indigo-700 dark:text-indigo-300">{t('اسم المريض / العميل', 'Patient Name')}</th>
                      <th className="p-2.5">{t('الطبيب / التكنيشن', 'Doctor / Staff')}</th>
                      <th className="p-2.5">{t('الخدمة', 'Service')}</th>
                      <th className="p-2.5">{t('الإيراد', 'Total Rev')}</th>
                      <th className="p-2.5">{t('طريقة السداد', 'Payment Method')}</th>
                      <th className="p-2.5">{t('المحصل', 'Collected')}</th>
                      <th className="p-2.5">{t('النبضات', 'Pulses')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedShift.runRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          <div>{row.patientName || row.customerName || t('عميل / مريض نقدي', 'Cash Patient')}</div>
                          {(row.systemCode || row.patientPhone) && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {row.systemCode ? `${row.systemCode}` : ''}
                              {row.systemCode && row.patientPhone ? ' • ' : ''}
                              {row.patientPhone ? `${row.patientPhone}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          <div>{row.doctorName || '-'}</div>
                          {row.technicianName && <div className="text-[10px] text-slate-400">تك: {row.technicianName}</div>}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{row.serviceName}</td>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{formatMoney(row.totalRevenue)}</td>
                        <td className="p-2.5 text-indigo-600 font-semibold">{row.paymentMethod}</td>
                        <td className="p-2.5 font-bold text-emerald-600">{formatMoney(row.collectedAmount)}</td>
                        <td className="p-2.5 text-amber-600 font-bold">{row.pulsesCount ? `${row.pulsesCount} ن` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses List */}
            {selectedShift.expenses && selectedShift.expenses.length > 0 && (
              <div className="space-y-2 mb-6">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-rose-500" />
                  <span>{t('المصروفات المنصرفة بالشيفت', 'Expenses Disbursed')}</span>
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left rtl:text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">{t('البيان / السبب', 'Description')}</th>
                        <th className="p-2.5">{t('البند', 'Category')}</th>
                        <th className="p-2.5">{t('طريقة الصرف', 'Disbursement Method')}</th>
                        <th className="p-2.5">{t('المبلغ', 'Amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedShift.expenses.map((exp, idx) => (
                        <tr key={exp.id}>
                          <td className="p-2.5 text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{exp.description}</td>
                          <td className="p-2.5 text-slate-500">{exp.category || '-'}</td>
                          <td className="p-2.5 text-slate-500">{exp.disbursementMethod}</td>
                          <td className="p-2.5 font-bold text-rose-600">{formatMoney(exp.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Balancing & Laser Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">{t('تسوية وسائل الدفع', 'Payment Balancing')}</h4>
                <div className="space-y-1.5 text-xs">
                  {selectedShift.balancing.map((b) => (
                    <div key={b.paymentMethodId} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{b.paymentMethodName}</span>
                      <span className="font-bold text-indigo-600">{formatMoney(b.closingBalance)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">{t('عدادات الليزر', 'Laser Counters')}</h4>
                <div className="space-y-1.5 text-xs">
                  {selectedShift.deviceCounters.map((d) => (
                    <div key={d.deviceId} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{d.deviceName}</span>
                      <span className="font-bold text-amber-600">{d.consumedCounter} نبضة (الختامي: {d.closingCounter})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500">
                {selectedShift.closingNotes ? `${t('ملاحظات الإغلاق:', 'Notes:')} ${selectedShift.closingNotes}` : ''}
              </div>

              <button
                onClick={() => setShowShiftDetailsModal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                {t('إغلاق النافذة', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
