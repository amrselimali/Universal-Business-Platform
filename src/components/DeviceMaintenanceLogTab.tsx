import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { DeviceMaintenanceRecord, LaserDevice } from '../types';
import {
  Wrench,
  Search,
  Building2,
  Calendar,
  Receipt,
  User,
  Zap,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle2,
  FileText,
  DollarSign,
  Plus,
} from 'lucide-react';

interface DeviceMaintenanceLogTabProps {
  onOpenAddMaintenance: (dev?: LaserDevice) => void;
}

export const DeviceMaintenanceLogTab: React.FC<DeviceMaintenanceLogTabProps> = ({
  onOpenAddMaintenance,
}) => {
  const {
    t,
    formatMoney,
    language,
    laserDevices,
    deviceMaintenanceRecords,
    deleteDeviceMaintenance,
  } = usePlatform();

  const isRtl = language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'OnCredit' | 'PaidCash' | 'PaidBank'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<DeviceMaintenanceRecord | null>(null);

  // Filtered maintenance list
  const filteredRecords = useMemo(() => {
    return deviceMaintenanceRecords.filter((rec) => {
      if (deviceFilter !== 'ALL' && rec.deviceId !== deviceFilter) return false;
      if (paymentFilter !== 'ALL' && rec.paymentStatus !== paymentFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDev = rec.deviceName.toLowerCase().includes(q) || (rec.deviceCode && rec.deviceCode.toLowerCase().includes(q));
        const matchSup = rec.supplierName.toLowerCase().includes(q);
        const matchInv = rec.invoiceNumber?.toLowerCase().includes(q);
        const matchJv = rec.journalEntryNumber?.toLowerCase().includes(q);
        const matchDesc = rec.description.toLowerCase().includes(q);
        const matchTech = rec.technicianName?.toLowerCase().includes(q);
        if (!matchDev && !matchSup && !matchInv && !matchJv && !matchDesc && !matchTech) return false;
      }

      return true;
    });
  }, [deviceMaintenanceRecords, deviceFilter, paymentFilter, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalCost = deviceMaintenanceRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    const onCreditCost = deviceMaintenanceRecords
      .filter((r) => r.paymentStatus === 'OnCredit')
      .reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    const paidCost = totalCost - onCreditCost;
    const totalParts = deviceMaintenanceRecords.reduce((sum, r) => sum + (r.replacedParts?.length || 0), 0);

    return {
      count: deviceMaintenanceRecords.length,
      totalCost,
      onCreditCost,
      paidCost,
      totalParts,
    };
  }, [deviceMaintenanceRecords]);

  const handleDelete = () => {
    if (!recordToDelete) return;
    deleteDeviceMaintenance(recordToDelete.id);
    setRecordToDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('عدد عمليات الصيانة', 'Total Maintenances')}</span>
            <Wrench className="h-4 w-4 text-amber-500" />
          </div>
          <span className="block text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
            {summary.count}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('إجمالي مصروفات الصيانة', 'Total Expenses')}</span>
            <Receipt className="h-4 w-4 text-indigo-500" />
          </div>
          <span className="block text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
            {formatMoney(summary.totalCost)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('آجل على حساب الموردين', 'On Credit (Payable)')}</span>
            <Building2 className="h-4 w-4 text-rose-500" />
          </div>
          <span className="block text-xl font-black text-rose-600 font-mono mt-1">
            {formatMoney(summary.onCreditCost)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('قطع الغيار المستبدلة', 'Replaced Parts')}</span>
            <Shield className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="block text-xl font-black text-emerald-600 font-mono mt-1">
            {summary.totalParts} {t('قطعة', 'parts')}
          </span>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 rtl:right-3 ltr:left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('بحث بجهاز، مورد، رقم فاتورة، قيد...', 'Search device, supplier, invoice, JV...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {/* Device Filter */}
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-700 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">{t('جميع الأجهزة', 'All Devices')}</option>
            {laserDevices.map((dev) => (
              <option key={dev.id} value={dev.id}>
                {dev.code} - {dev.name}
              </option>
            ))}
          </select>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-700 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">{t('كل طرق السداد', 'All Payments')}</option>
            <option value="OnCredit">{t('آجل على حساب المورد', 'On Credit')}</option>
            <option value="PaidCash">{t('نقداً من الخزينة', 'Paid Cash')}</option>
            <option value="PaidBank">{t('تحويل بنكي', 'Paid Bank')}</option>
          </select>

          <button
            onClick={() => onOpenAddMaintenance()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('+ تسجيل صيانة جديدة', '+ New Maintenance')}</span>
          </button>
        </div>
      </div>

      {/* Main Records List */}
      <div className="space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
            <Wrench className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {t('لا توجد سجلات صيانة مطابقة', 'No maintenance records found')}
            </h4>
            <p className="text-slate-400 mt-1">
              {t('ابدأ بتسجيل أول عملية صيانة لجهاز ليزر وربطها بالمورد والحسابات.', 'Register a maintenance record to see it here.')}
            </p>
          </div>
        ) : (
          filteredRecords.map((maint) => {
            const isExpanded = expandedId === maint.id;

            return (
              <div
                key={maint.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all text-xs"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : maint.id)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 font-black">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {maint.deviceName}
                        </span>
                        {maint.deviceCode && (
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold">
                            {maint.deviceCode}
                          </span>
                        )}
                        <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          {maint.maintenanceTypeAr || maint.maintenanceType}
                        </span>
                        {maint.journalEntryNumber && (
                          <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {maint.journalEntryNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {maint.maintenanceDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                          <strong className="text-slate-800 dark:text-slate-200">{maint.supplierName}</strong>
                        </span>
                        {maint.invoiceNumber && (
                          <span className="font-mono text-slate-400">
                            {t('فاتورة مورد:', 'Inv:')} #{maint.invoiceNumber}
                          </span>
                        )}
                        {maint.replacedParts && maint.replacedParts.length > 0 && (
                          <span className="flex items-center gap-1 text-emerald-600 font-bold">
                            <Shield className="h-3 w-3" />
                            <span>{maint.replacedParts.length} {t('قطع تحت الضمان', 'parts tracked')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-end">
                      <span className="block text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {formatMoney(maint.cost)}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          maint.paymentStatus === 'OnCredit' ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {maint.paymentMethodName || maint.paymentStatus}
                      </span>
                    </div>
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
                    {/* Description */}
                    <div>
                      <span className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        {t('بيان ووصف الصيانة:', 'Work Description:')}
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed">
                        {maint.description}
                      </p>
                    </div>

                    {/* Accounting & Ledger Impact Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 font-bold block">{t('شجرة الحسابات والقيود:', 'Ledger & Chart of Accounts:')}</span>
                        <div className="font-mono font-bold text-indigo-600 mt-0.5">
                          {maint.journalEntryNumber || 'JV-POSTED'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                          <div>• {t('مدين (Debit): حساب 5250 مصروفات صيانة أجهزة الليزر', 'Debit: 5250 Equipment Maintenance')}</div>
                          <div>
                            • {t('دائن (Credit): ', 'Credit: ')}
                            {maint.paymentStatus === 'OnCredit'
                              ? t('حساب 2110 الموردون والدائنون', '2110 Accounts Payable')
                              : t('حساب 1111 الخزينة الرئيسية / البنك', '1111 Safe / Bank Cash')}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 font-bold block">{t('كشف حساب المورد (شاشة الموردين):', 'Supplier Statement:')}</span>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {maint.supplierName}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {maint.paymentStatus === 'OnCredit'
                            ? t(`تم ترحيل مبلغ ${maint.cost} ج.م كاستحقاق آجل في كشف حساب المورد.`, `Added ${maint.cost} EGP to supplier balance.`)
                            : t(`تم سداد المبلغ فورياً وتسجيل سند الصرف.`, `Paid immediately.`)}
                        </p>
                      </div>
                    </div>

                    {/* Replaced Parts */}
                    {maint.replacedParts && maint.replacedParts.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-extrabold text-slate-700 dark:text-slate-300 block text-[11px]">
                          {t('القطع المستبدلة وفترة الضمان:', 'Replaced Parts & Warranty Period:')}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {maint.replacedParts.map((part) => (
                            <div
                              key={part.id}
                              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block">
                                  {part.partName}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {t('الضمان:', 'Warranty:')} {part.warrantyMonths} {t('شهور حتى', 'mo until')} {part.warrantyExpiryDate}
                                </span>
                              </div>
                              {part.cost > 0 && (
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {formatMoney(part.cost)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400">
                        {t('مسجل بواسطة النظام بتاريخ:', 'Recorded on:')}{' '}
                        {new Date(maint.createdAt).toLocaleString('ar-EG')}
                      </span>
                      <button
                        onClick={() => setRecordToDelete(maint)}
                        className="inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{t('حذف عملية الصيانة وعكس القيد', 'Delete & Reverse JV')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              {t('تأكيد حذف عملية الصيانة؟', 'Delete Maintenance Record?')}
            </h4>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              {t(
                `سيتم حذف العملية للجهاز (${recordToDelete.deviceName}) وإلغاء الاستحقاق وقيد اليومية (${recordToDelete.journalEntryNumber || ''}).`,
                `Will delete record and reverse journal entry.`
              )}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                onClick={() => setRecordToDelete(null)}
                className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="rounded-xl bg-rose-600 px-5 py-2 font-bold text-white hover:bg-rose-700"
              >
                {t('تأكيد الحذف', 'Confirm Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
