import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { DeviceMaintenancePart, LaserDevice } from '../types';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Search,
  Building2,
  Calendar,
  Clock,
  Wrench,
  CheckCircle2,
  Sparkles,
  Filter,
} from 'lucide-react';

interface PartWithContext extends DeviceMaintenancePart {
  deviceId: string;
  deviceName: string;
  deviceCode: string;
  deviceModel?: string;
  supplierName: string;
  maintenanceDate: string;
  currentDeviceTotalShots: number;
  shotsUsedSinceInstall: number;
  pulseUsagePercent: number;
  daysRemainingWarranty: number;
  warrantyStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
  lifespanWarning: boolean;
}

interface DeviceWarrantyTrackerTabProps {
  onOpenAddMaintenance: (dev?: LaserDevice) => void;
}

export const DeviceWarrantyTrackerTab: React.FC<DeviceWarrantyTrackerTabProps> = ({
  onOpenAddMaintenance,
}) => {
  const {
    t,
    formatMoney,
    language,
    laserDevices,
    deviceMaintenanceRecords,
  } = usePlatform();

  const isRtl = language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'LIFESPAN_ALERT'>('ALL');
  const [deviceFilter, setDeviceFilter] = useState<string>('ALL');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayDate = new Date(todayStr);

  // Aggregate all parts across all device maintenance records
  const allParts: PartWithContext[] = useMemo(() => {
    const list: PartWithContext[] = [];

    deviceMaintenanceRecords.forEach((maint) => {
      const targetDev = laserDevices.find((d) => d.id === maint.deviceId);
      const parts = maint.replacedParts || [];

      parts.forEach((part) => {
        // Calculate days remaining in warranty
        let daysLeft = 9999;
        let warrantyStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'ACTIVE';

        if (part.warrantyExpiryDate) {
          const expDate = new Date(part.warrantyExpiryDate);
          const diffTime = expDate.getTime() - todayDate.getTime();
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (daysLeft < 0) {
            warrantyStatus = 'EXPIRED';
          } else if (daysLeft <= 30) {
            warrantyStatus = 'EXPIRING_SOON';
          } else {
            warrantyStatus = 'ACTIVE';
          }
        }

        // Calculate lifespan pulses
        const currentDevShots = targetDev?.totalShotsCounter || 0;
        const startingShots = part.startingShotsCounter || 0;
        const shotsUsed = Math.max(0, currentDevShots - startingShots);

        let pulsePercent = 0;
        let lifespanWarning = false;

        if (part.expectedLifespanShots && part.expectedLifespanShots > 0) {
          pulsePercent = Math.min(100, Math.round((shotsUsed / part.expectedLifespanShots) * 100));
          if (pulsePercent >= 80) {
            lifespanWarning = true;
          }
        }

        list.push({
          ...part,
          deviceId: maint.deviceId,
          deviceName: maint.deviceName || targetDev?.name || 'جهاز ليزر',
          deviceCode: maint.deviceCode || targetDev?.code || 'LSR',
          deviceModel: targetDev?.model,
          supplierName: maint.supplierName,
          maintenanceDate: maint.maintenanceDate,
          currentDeviceTotalShots: currentDevShots,
          shotsUsedSinceInstall: shotsUsed,
          pulseUsagePercent: pulsePercent,
          daysRemainingWarranty: daysLeft,
          warrantyStatus,
          lifespanWarning,
        });
      });
    });

    return list;
  }, [deviceMaintenanceRecords, laserDevices, todayDate]);

  // Filtered Parts
  const filteredParts = useMemo(() => {
    return allParts.filter((item) => {
      if (deviceFilter !== 'ALL' && item.deviceId !== deviceFilter) return false;

      if (statusFilter === 'ACTIVE' && item.warrantyStatus !== 'ACTIVE') return false;
      if (statusFilter === 'EXPIRING_SOON' && item.warrantyStatus !== 'EXPIRING_SOON') return false;
      if (statusFilter === 'EXPIRED' && item.warrantyStatus !== 'EXPIRED') return false;
      if (statusFilter === 'LIFESPAN_ALERT' && !item.lifespanWarning) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.partName.toLowerCase().includes(q);
        const matchCode = item.partCode?.toLowerCase().includes(q);
        const matchDevice = item.deviceName.toLowerCase().includes(q) || item.deviceCode.toLowerCase().includes(q);
        const matchSupplier = item.supplierName.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDevice && !matchSupplier) return false;
      }

      return true;
    });
  }, [allParts, deviceFilter, statusFilter, searchQuery]);

  // Metric Counts
  const counts = useMemo(() => {
    return {
      total: allParts.length,
      active: allParts.filter((p) => p.warrantyStatus === 'ACTIVE').length,
      expiringSoon: allParts.filter((p) => p.warrantyStatus === 'EXPIRING_SOON').length,
      expired: allParts.filter((p) => p.warrantyStatus === 'EXPIRED').length,
      lifespanAlert: allParts.filter((p) => p.lifespanWarning).length,
    };
  }, [allParts]);

  return (
    <div className="space-y-4">
      {/* Top Banner if there are Warnings */}
      {(counts.expiringSoon > 0 || counts.lifespanAlert > 0) && (
        <div className="rounded-2xl border border-amber-300/80 bg-linear-to-r from-amber-50 to-orange-50 p-4 dark:border-amber-900/60 dark:from-amber-950/40 dark:to-orange-950/30 text-xs shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {t('تنبيهات الضمان والعمر الافتراضي لقطع أجهزة الليزر', 'Warranty & Lifespan Alert')}
                </h4>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  {t(
                    `يوجد (${counts.expiringSoon}) قطع يوشك ضمانها على الانتهاء خلال 30 يوماً، و(${counts.lifespanAlert}) قطع اقتربت من استهلاك 80% فأكثر من عمرها الافتراضي بالنبضات.`,
                    `${counts.expiringSoon} parts expiring soon, and ${counts.lifespanAlert} parts reaching 80%+ pulse lifespan.`
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStatusFilter('EXPIRING_SOON')}
                className="rounded-xl bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700 transition-all cursor-pointer shadow-xs"
              >
                {t('عرض القطع المنذرة', 'View Expiring Parts')}
              </button>
              <button
                onClick={() => setStatusFilter('LIFESPAN_ALERT')}
                className="rounded-xl bg-orange-600 px-3 py-1.5 font-bold text-white hover:bg-orange-700 transition-all cursor-pointer shadow-xs"
              >
                {t('إنذار النبضات', 'Lifespan Alerts')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('إجمالي القطع المتابعة', 'All Parts')}</span>
            <Shield className="h-4 w-4 text-indigo-500" />
          </div>
          <span className="block text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
            {counts.total}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('ACTIVE')}
          className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
            statusFilter === 'ACTIVE'
              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('ضمان ساري ونشط', 'Active Warranty')}</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="block text-xl font-black text-emerald-600 font-mono mt-1">
            {counts.active}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('EXPIRING_SOON')}
          className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
            statusFilter === 'EXPIRING_SOON'
              ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('إنذار: ينتهي قريباً (30 يوم)', 'Expiring Soon')}</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <span className="block text-xl font-black text-amber-600 font-mono mt-1">
            {counts.expiringSoon}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('EXPIRED')}
          className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
            statusFilter === 'EXPIRED'
              ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('ضمان منتهي', 'Expired Warranty')}</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <span className="block text-xl font-black text-rose-600 font-mono mt-1">
            {counts.expired}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('LIFESPAN_ALERT')}
          className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
            statusFilter === 'LIFESPAN_ALERT'
              ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 ring-2 ring-orange-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px]">{t('إنذار العمر الافتراضي (>80%)', 'Lifespan Warning')}</span>
            <Zap className="h-4 w-4 text-orange-500" />
          </div>
          <span className="block text-xl font-black text-orange-600 font-mono mt-1">
            {counts.lifespanAlert}
          </span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 rtl:right-3 ltr:left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('بحث عن قطعة، كود، جهاز، مورد...', 'Search part, code, device, supplier...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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

          <button
            onClick={() => onOpenAddMaintenance()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>{t('+ تسجيل صيانة وقطع جديدة', '+ Add Maintenance Part')}</span>
          </button>
        </div>
      </div>

      {/* Parts Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        {filteredParts.length === 0 ? (
          <div className="p-12 text-center text-xs">
            <Shield className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {t('لا توجد قطع مطابقة للبحث أو الفلتر المحدد', 'No parts match your filter')}
            </h4>
            <p className="text-slate-400 mt-1">
              {t('جرب تغيير خيارات الفلتر أو تسجيل عملية صيانة جديدة.', 'Try changing filter or register maintenance.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 font-extrabold text-[11px]">
                  <th className="p-3.5 text-start">{t('القطعة والكود', 'Part & Code')}</th>
                  <th className="p-3.5 text-start">{t('الجهاز والموقع', 'Installed On')}</th>
                  <th className="p-3.5 text-start">{t('المورد وتاريخ التركيب', 'Supplier & Date')}</th>
                  <th className="p-3.5 text-start">{t('حالة الضمان وتاريخ الانتهاء', 'Warranty Status')}</th>
                  <th className="p-3.5 text-start">{t('العمر الافتراضي ونبضات الاستهلاك', 'Lifespan & Pulses')}</th>
                  <th className="p-3.5 text-end">{t('التكلفة', 'Cost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredParts.map((part) => {
                  const isExpiringSoon = part.warrantyStatus === 'EXPIRING_SOON';
                  const isExpired = part.warrantyStatus === 'EXPIRED';
                  const isLifespanCritical = part.pulseUsagePercent >= 90;

                  return (
                    <tr
                      key={part.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                        isExpiringSoon || part.lifespanWarning
                          ? 'bg-amber-50/30 dark:bg-amber-950/10'
                          : ''
                      }`}
                    >
                      {/* Part Name & Code */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{part.partName}</span>
                        </div>
                        {part.partCode && (
                          <span className="mt-0.5 inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                            {part.partCode}
                          </span>
                        )}
                        {part.notes && (
                          <span className="block text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                            {part.notes}
                          </span>
                        )}
                      </td>

                      {/* Device & Location */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                          <span>{part.deviceName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {part.deviceCode} {part.deviceModel ? `• ${part.deviceModel}` : ''}
                        </div>
                      </td>

                      {/* Supplier & Install Date */}
                      <td className="p-3.5">
                        <div className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span>{part.supplierName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span>{part.installedDate || part.maintenanceDate}</span>
                        </div>
                      </td>

                      {/* Warranty Status */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                              <ShieldAlert className="h-3 w-3" />
                              <span>{t('منتهي الضمان', 'Expired')}</span>
                              <span className="font-mono">({Math.abs(part.daysRemainingWarranty)} {t('يوم', 'd')})</span>
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300 animate-pulse">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              <span>{t('إنذار: متبقي', 'Warning: ')}</span>
                              <span className="font-mono">{part.daysRemainingWarranty} {t('يوم', 'days')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <ShieldCheck className="h-3 w-3" />
                              <span>{t('ساري', 'Active')}</span>
                              <span className="font-mono">({part.daysRemainingWarranty} {t('يوم', 'd')})</span>
                            </span>
                          )}

                          <div className="text-[10px] text-slate-400">
                            {t('المدة:', 'Period:')} {part.warrantyMonths} {t('شهور', 'mo')} • {t('ينتهي:', 'Expires:')}{' '}
                            <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                              {part.warrantyExpiryDate}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Lifespan & Pulses Progress */}
                      <td className="p-3.5">
                        {part.expectedLifespanShots ? (
                          <div className="space-y-1 w-44">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">
                                {t('الاستهلاك:', 'Usage:')}{' '}
                                <strong className="font-mono text-slate-800 dark:text-slate-200">
                                  {part.shotsUsedSinceInstall.toLocaleString()}
                                </strong>
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  isLifespanCritical
                                    ? 'text-rose-600'
                                    : part.pulseUsagePercent >= 80
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {part.pulseUsagePercent}%
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isLifespanCritical
                                    ? 'bg-rose-500'
                                    : part.pulseUsagePercent >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, part.pulseUsagePercent)}%` }}
                              />
                            </div>

                            <div className="text-[9px] text-slate-400 font-mono">
                              {t('الحد الأقصى:', 'Max:')} {part.expectedLifespanShots.toLocaleString()} {t('نبضة', 'shots')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            {t('غير محدد بالنبضات', 'No pulse limit')}
                          </span>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="p-3.5 text-end font-mono font-bold text-slate-700 dark:text-slate-300">
                        {part.cost > 0 ? formatMoney(part.cost) : t('مشمولة بالصيانة', 'Included')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
