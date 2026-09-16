import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { LaserDevice, DeviceMaintenanceRecord } from '../types';
import {
  Wrench,
  X,
  Calendar,
  Building2,
  Receipt,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  User,
  Zap,
  Trash2,
  CheckCircle2,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DeviceMaintenanceHistoryModalProps {
  device: LaserDevice;
  onClose: () => void;
  onOpenAddMaintenance: (dev: LaserDevice) => void;
}

export const DeviceMaintenanceHistoryModal: React.FC<DeviceMaintenanceHistoryModalProps> = ({
  device,
  onClose,
  onOpenAddMaintenance,
}) => {
  const {
    t,
    formatMoney,
    language,
    deviceMaintenanceRecords,
    deleteDeviceMaintenance,
  } = usePlatform();

  const isRtl = language === 'ar';

  // Get all maintenance records for this device
  const deviceRecords = deviceMaintenanceRecords.filter((m) => m.deviceId === device.id);

  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(
    deviceRecords[0]?.id || null
  );
  const [recordToDelete, setRecordToDelete] = useState<DeviceMaintenanceRecord | null>(null);

  const totalMaintenanceCost = deviceRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

  const handleDeleteConfirm = () => {
    if (!recordToDelete) return;
    deleteDeviceMaintenance(recordToDelete.id);
    setRecordToDelete(null);
  };

  // Helper to evaluate warranty status
  const getWarrantyStatus = (expiryDate?: string) => {
    if (!expiryDate) return { label: t('غير محدد', 'N/A'), color: 'text-slate-400 bg-slate-100', icon: Shield };
    const today = new Date().toISOString().split('T')[0];
    const exp = new Date(expiryDate);
    const now = new Date(today);
    const diffTime = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: t(`منتهي (${Math.abs(diffDays)} يوم مضت)`, `Expired (${Math.abs(diffDays)}d ago)`),
        color: 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
        icon: ShieldAlert,
        isExpired: true,
      };
    }
    if (diffDays <= 30) {
      return {
        label: t(`إنذار: ينتهي خلال ${diffDays} يوم`, `Warning: ${diffDays}d left`),
        color: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
        icon: AlertTriangle,
        isExpiringSoon: true,
      };
    }
    return {
      label: t(`ساري (${diffDays} يوم متبقية)`, `Active (${diffDays}d left)`),
      color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      icon: ShieldCheck,
      isActive: true,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('سجل صيانة جهاز:', 'Maintenance History:')}{' '}
                  <span>{isRtl ? device.name : device.nameEn || device.name}</span>
                </h3>
                <span className="rounded-md bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  {device.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {device.model} • {device.room} • {t('الموقع:', 'SN:')} {device.serialNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary Metric Ribbon */}
        <div className="grid grid-cols-3 gap-2 px-6 py-3 bg-slate-100/60 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="block text-[10px] text-slate-400 font-bold">{t('عدد عمليات الصيانة', 'Total Operations')}</span>
            <span className="text-base font-black text-slate-900 dark:text-white font-mono">
              {deviceRecords.length}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="block text-[10px] text-slate-400 font-bold">{t('إجمالي تكاليف الصيانة', 'Total Cost')}</span>
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {formatMoney(totalMaintenanceCost)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="block text-[10px] text-slate-400 font-bold">{t('آخر صيانة مسجلة', 'Last Maintenance')}</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {device.lastMaintenanceDate || t('لا يوجد', 'None')}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {deviceRecords.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <Wrench className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-2" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t('لا توجد عمليات صيانة مسجلة لهذا الجهاز حتى الآن', 'No maintenance records yet for this device')}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {t(
                  'يمكنك تسجيل أول عملية صيانة، وربطها بالمورد وشجرة الحسابات وتتبع الضمان للقطع المستبدلة.',
                  'Add a maintenance record to track supplier invoice, COA journal entry and parts warranty.'
                )}
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenAddMaintenance(device);
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer shadow-xs"
              >
                <Wrench className="h-4 w-4" />
                <span>{t('تسجيل أول عملية صيانة الآن', 'Add First Maintenance')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {deviceRecords.map((maint) => {
                const isExpanded = expandedRecordId === maint.id;
                const warrantyStatus = getWarrantyStatus(maint.warrantyExpiryDate);
                const WarrantyIcon = warrantyStatus.icon;

                return (
                  <div
                    key={maint.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Record Main Row */}
                    <div
                      onClick={() => setExpandedRecordId(isExpanded ? null : maint.id)}
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 font-bold">
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              {maint.maintenanceTypeAr || maint.maintenanceType}
                            </span>
                            {maint.invoiceNumber && (
                              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                                #{maint.invoiceNumber}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border flex items-center gap-1 ${warrantyStatus.color}`}
                            >
                              <WarrantyIcon className="h-3 w-3" />
                              <span>{warrantyStatus.label}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {maint.maintenanceDate}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-indigo-500" />
                              <strong className="text-slate-700 dark:text-slate-300">{maint.supplierName}</strong>
                            </span>
                            {maint.technicianName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {maint.technicianName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <span className="block text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            {formatMoney(maint.cost)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {maint.paymentMethodName || maint.paymentStatus}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
                        {/* Description */}
                        <div>
                          <span className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                            {t('الوصف وتفاصيل العمل:', 'Details & Work Done:')}
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed">
                            {maint.description}
                          </p>
                        </div>

                        {/* Accounting & Ledger Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block">{t('القيد المحاسبي في شجرة الحسابات:', 'Journal Entry:')}</span>
                            <span className="font-mono font-bold text-indigo-600">
                              {maint.journalEntryNumber || maint.journalEntryId || 'JV-AUTO'}
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              {t('مدين: 5250 صيانة ليزر | دائن: ', 'Debit: 5250 Laser Maint | Credit: ')}
                              {maint.paymentStatus === 'OnCredit' ? t('حساب المورد', 'Supplier A/P') : t('الخزينة/البنك', 'Cash/Bank')}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block">{t('حساب المورد المسجل:', 'Supplier Movement:')}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {maint.supplierName}
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              {maint.paymentStatus === 'OnCredit'
                                ? t('تم تسجيل استحقاق آجل في كشف حساب المورد', 'Recorded on supplier credit balance')
                                : t('تم السداد الفوري وإغلاق القيمة', 'Paid immediately')}
                            </span>
                          </div>
                        </div>

                        {/* Replaced Parts & Warranty List */}
                        {maint.replacedParts && maint.replacedParts.length > 0 && (
                          <div>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
                              <Shield className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{t('قطع الغيار المستبدلة وتتبع الضمان:', 'Replaced Parts & Warranty:')}</span>
                            </span>

                            <div className="space-y-1.5">
                              {maint.replacedParts.map((part) => {
                                const partWarranty = getWarrantyStatus(part.warrantyExpiryDate);
                                const PartIcon = partWarranty.icon;
                                return (
                                  <div
                                    key={part.id}
                                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between text-[11px]"
                                  >
                                    <div>
                                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>{part.partName}</span>
                                        {part.partCode && (
                                          <span className="font-mono text-slate-400 text-[10px]">
                                            ({part.partCode})
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-3">
                                        <span>
                                          {t('تاريخ التركيب:', 'Installed:')} {part.installedDate}
                                        </span>
                                        {part.expectedLifespanShots && (
                                          <span>
                                            {t('العمر الافتراضي:', 'Lifespan:')}{' '}
                                            <strong className="font-mono text-indigo-600">
                                              {part.expectedLifespanShots.toLocaleString()} {t('نبضة', 'shots')}
                                            </strong>
                                          </span>
                                        )}
                                        {part.cost > 0 && (
                                          <span>
                                            {t('التكلفة:', 'Cost:')} {formatMoney(part.cost)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-end">
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border inline-flex items-center gap-1 ${partWarranty.color}`}
                                      >
                                        <PartIcon className="h-3 w-3" />
                                        <span>{partWarranty.label}</span>
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Actions Row */}
                        <div className="pt-2 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {t('تاريخ الإدخال:', 'Created:')} {new Date(maint.createdAt).toLocaleString('ar-EG')}
                          </span>
                          <button
                            onClick={() => setRecordToDelete(maint)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>{t('حذف عملية الصيانة', 'Delete Record')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenAddMaintenance(device);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer shadow-xs"
          >
            <Wrench className="h-4 w-4" />
            <span>{t('+ تسجيل صيانة جديدة لهذا الجهاز', '+ Add Maintenance for this Device')}</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            {t('إغلاق', 'Close')}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              {t('تأكيد حذف عملية الصيانة؟', 'Delete Maintenance Record?')}
            </h4>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t(
                `سيتم حذف العملية (${recordToDelete.maintenanceTypeAr || recordToDelete.maintenanceType}) وإلغاء استحقاق المورد (${recordToDelete.cost} ج.م) وقيد اليومية المحاسبي المرتبط بها.`,
                `This will delete the maintenance record and reverse supplier payable & journal entry.`
              )}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                onClick={() => setRecordToDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700"
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
