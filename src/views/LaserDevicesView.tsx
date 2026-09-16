import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { LaserDevice } from '../types';
import { DeviceMaintenanceModal } from '../components/DeviceMaintenanceModal';
import { DeviceMaintenanceHistoryModal } from '../components/DeviceMaintenanceHistoryModal';
import { DeviceWarrantyTrackerTab } from '../components/DeviceWarrantyTrackerTab';
import { DeviceMaintenanceLogTab } from '../components/DeviceMaintenanceLogTab';
import {
  Zap,
  Plus,
  Search,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Trash2,
  Activity,
  Layers,
  Sparkles,
  MapPin,
  Cpu,
  User,
  Calendar,
  DollarSign,
  ArrowRight,
  RefreshCw,
  X,
  Sliders,
  Check,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Receipt,
  Building2,
  FileText,
  Clock,
} from 'lucide-react';

interface LaserDevicesViewProps {
  onNavigateToReception?: () => void;
}

export const LaserDevicesView: React.FC<LaserDevicesViewProps> = ({ onNavigateToReception }) => {
  const {
    t,
    formatMoney,
    laserDevices,
    allLaserDevices,
    addLaserDevice,
    updateLaserDevice,
    deleteLaserDevice,
    resetLaserLampCounter,
    deviceMaintenanceRecords,
    allDeviceMaintenance,
    language,
    tenant,
    activeBranch,
    branches,
    staffMembers,
  } = usePlatform();

  const isRtl = language === 'ar';

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'DEVICES' | 'MAINTENANCE_LOG' | 'WARRANTY_TRACKER'>('DEVICES');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Maintenance' | 'Out of Service'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<LaserDevice | null>(null);
  const [showResetLampModal, setShowResetLampModal] = useState<LaserDevice | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<LaserDevice | null>(null);

  // Maintenance Modals State
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedDeviceForMaint, setSelectedDeviceForMaint] = useState<LaserDevice | null>(null);
  const [selectedDeviceForHistory, setSelectedDeviceForHistory] = useState<LaserDevice | null>(null);
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<LaserDevice, 'id' | 'createdAt'>>({
    name: '',
    nameEn: '',
    code: `LSR-0${allLaserDevices.length + 1}`,
    model: '',
    serialNumber: '',
    room: '',
    branchId: activeBranch?.id || branches[0]?.id || 'branch-cairo',
    status: 'Active',
    totalShotsCounter: 0,
    currentLampShots: 0,
    warningLimitShots: 200000,
    maxCapacityShots: 500000,
    costPerShot: 0.12,
    pricePerShot: 0.50,
    assignedTechnician: '',
    lastMaintenanceDate: new Date().toISOString().split('T')[0],
    maintenanceNotes: '',
  });

  // Filtered List
  const filteredDevices = laserDevices.filter((dev) => {
    if (statusFilter !== 'ALL' && dev.status !== statusFilter) return false;
    if (branchFilter !== 'ALL' && dev.branchId !== branchFilter) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      dev.name.toLowerCase().includes(q) ||
      (dev.nameEn && dev.nameEn.toLowerCase().includes(q)) ||
      dev.code.toLowerCase().includes(q) ||
      dev.model.toLowerCase().includes(q) ||
      dev.serialNumber.toLowerCase().includes(q) ||
      dev.room.toLowerCase().includes(q) ||
      (dev.assignedTechnician && dev.assignedTechnician.toLowerCase().includes(q))
    );
  });

  // KPIs
  const totalDevicesCount = laserDevices.length;
  const activeCount = laserDevices.filter((d) => d.status === 'Active').length;
  const maintenanceCount = laserDevices.filter((d) => d.status === 'Maintenance').length;
  const totalShotsAll = laserDevices.reduce((sum, d) => sum + (d.totalShotsCounter || 0), 0);
  const nearWarningLamps = laserDevices.filter(
    (d) => d.warningLimitShots && d.currentLampShots >= d.warningLimitShots
  ).length;

  const totalTrackedPartsCount = useMemo(() => {
    return allDeviceMaintenance.reduce((sum, r) => sum + (r.replacedParts?.length || 0), 0);
  }, [allDeviceMaintenance]);

  const warrantyAlertCount = useMemo(() => {
    let count = 0;
    const now = new Date().getTime();
    allDeviceMaintenance.forEach((m) => {
      m.replacedParts?.forEach((p) => {
        if (p.warrantyExpiryDate) {
          const diffDays = Math.ceil((new Date(p.warrantyExpiryDate).getTime() - now) / (1000 * 3600 * 24));
          if (diffDays <= 30) count++;
        }
      });
    });
    return count;
  }, [allDeviceMaintenance]);

  const handleOpenAddModal = () => {
    setEditingDevice(null);
    setFormData({
      name: '',
      nameEn: '',
      code: `LSR-0${allLaserDevices.length + 1}`,
      model: 'Candela GentleMax Pro',
      serialNumber: '',
      room: 'غرفة ليزر 1',
      branchId: activeBranch?.id || branches[0]?.id || 'branch-cairo',
      status: 'Active',
      totalShotsCounter: 0,
      currentLampShots: 0,
      warningLimitShots: 200000,
      maxCapacityShots: 500000,
      costPerShot: 0.12,
      pricePerShot: 0.50,
      assignedTechnician: staffMembers[0]?.nameAr || 'فني ليزر معتمد',
      lastMaintenanceDate: new Date().toISOString().split('T')[0],
      maintenanceNotes: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (dev: LaserDevice) => {
    setEditingDevice(dev);
    setFormData({
      name: dev.name,
      nameEn: dev.nameEn || '',
      code: dev.code,
      model: dev.model,
      serialNumber: dev.serialNumber,
      room: dev.room,
      branchId: dev.branchId || activeBranch?.id || 'branch-cairo',
      status: dev.status,
      totalShotsCounter: dev.totalShotsCounter,
      currentLampShots: dev.currentLampShots,
      warningLimitShots: dev.warningLimitShots,
      maxCapacityShots: dev.maxCapacityShots,
      costPerShot: dev.costPerShot ?? 0.12,
      pricePerShot: dev.pricePerShot ?? 0.50,
      assignedTechnician: dev.assignedTechnician || '',
      lastMaintenanceDate: dev.lastMaintenanceDate || new Date().toISOString().split('T')[0],
      maintenanceNotes: dev.maintenanceNotes || '',
    });
    setShowAddModal(true);
  };

  const handleSaveDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) return;

    if (editingDevice) {
      updateLaserDevice(editingDevice.id, formData);
    } else {
      addLaserDevice(formData);
    }

    setShowAddModal(false);
    setEditingDevice(null);
  };

  const handleConfirmDelete = () => {
    if (deviceToDelete) {
      deleteLaserDevice(deviceToDelete.id);
      setDeviceToDelete(null);
    }
  };

  const handleConfirmResetLamp = () => {
    if (showResetLampModal) {
      resetLaserLampCounter(showResetLampModal.id);
      setShowResetLampModal(null);
    }
  };

  const handleOpenAddMaintenance = (dev?: LaserDevice) => {
    setSelectedDeviceForMaint(dev || null);
    setShowMaintenanceModal(true);
  };

  const handleOpenHistory = (dev: LaserDevice) => {
    setSelectedDeviceForHistory(dev);
  };

  const handleToggleStatus = (dev: LaserDevice) => {
    const nextStatus = dev.status === 'Active' ? 'Maintenance' : 'Active';
    updateLaserDevice(dev.id, { status: nextStatus });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                {t('إدارة وسجل أجهزة الليزر والمعدات', 'Laser Devices & Equipment Directory')}
              </h1>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                {totalDevicesCount} {t('جهاز مسجل', 'Devices')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                'إضافة وتعديل وحذف أجهزة الليزر، وتتبع نبضات اللمبة وتكاليف النبضة، ومزامنتها مع شاشة التشغيل والريسيبشن',
                'Add, edit, delete laser devices, monitor lamp pulses life, and link directly with Reception Run-Sheet'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToReception && (
            <button
              onClick={onNavigateToReception}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-all cursor-pointer"
            >
              <Activity className="h-4 w-4 text-indigo-600" />
              <span>{t('شاشة التشغيل (الريسيبشن)', 'Reception Run-Sheet')}</span>
            </button>
          )}

          <button
            onClick={() => handleOpenAddMaintenance()}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-all cursor-pointer"
          >
            <Wrench className="h-4 w-4 text-amber-600" />
            <span>{t('+ تسجيل صيانة', '+ Maintenance')}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة جهاز ليزر جديد', 'Add New Laser Device')}</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 flex items-center justify-between text-xs font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{toastFeedback}</span>
          </div>
          <button onClick={() => setToastFeedback(null)} className="p-1 hover:text-emerald-900 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top View Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('DEVICES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'DEVICES'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>{t('أجهزة ومعدات الليزر', 'Laser Devices')}</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              activeTab === 'DEVICES'
                ? 'bg-amber-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {totalDevicesCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('MAINTENANCE_LOG')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'MAINTENANCE_LOG'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Wrench className="h-4 w-4" />
          <span>{t('سجل عمليات الصيانة وفواتير الموردين', 'Maintenance Log & Invoices')}</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              activeTab === 'MAINTENANCE_LOG'
                ? 'bg-amber-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {deviceMaintenanceRecords.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('WARRANTY_TRACKER')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'WARRANTY_TRACKER'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>{t('متابعة الضمان والعمر الافتراضي والإنذارات', 'Parts Warranty & Alert Tracker')}</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              activeTab === 'WARRANTY_TRACKER'
                ? 'bg-amber-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {totalTrackedPartsCount}
          </span>
          {warrantyAlertCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <ShieldAlert className="h-3 w-3" />
              <span>{warrantyAlertCount} {t('تنبيه', 'Alerts')}</span>
            </span>
          )}
        </button>
      </div>

      {activeTab === 'MAINTENANCE_LOG' && (
        <DeviceMaintenanceLogTab onOpenAddMaintenance={handleOpenAddMaintenance} />
      )}

      {activeTab === 'WARRANTY_TRACKER' && (
        <DeviceWarrantyTrackerTab onOpenAddMaintenance={handleOpenAddMaintenance} />
      )}

      {activeTab === 'DEVICES' && (
        <>
          {/* 2. KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Devices */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('إجمالي الأجهزة', 'Total Devices')}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalDevicesCount}</span>
            <span className="text-[11px] font-bold text-slate-500">
              ({activeCount} {t('يعمل', 'Active')})
            </span>
          </div>
        </div>

        {/* Active In Operation */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('أجهزة قيد العمل', 'Active in Service')}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</span>
            <span className="text-[11px] font-bold text-emerald-600">
              {totalDevicesCount > 0 ? `${Math.round((activeCount / totalDevicesCount) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Maintenance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('أجهزة تحت الصيانة', 'In Maintenance')}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{maintenanceCount}</span>
            {nearWarningLamps > 0 && (
              <span className="text-[11px] font-bold text-rose-500">
                ({nearWarningLamps} {t('تنبيه لمبة', 'lamp alert')})
              </span>
            )}
          </div>
        </div>

        {/* Lifetime Pulses */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('إجمالي النبضات التراكمية', 'Total Pulses (All)')}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {totalShotsAll.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-400">{t('نبضة', 'shots')}</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('كافة الأجهزة', 'All Devices')} ({laserDevices.length})
          </button>
          <button
            onClick={() => setStatusFilter('Active')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'Active'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('يعمل (Active)', 'Active')} ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('Maintenance')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'Maintenance'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('قيد الصيانة (Maintenance)', 'Maintenance')} ({maintenanceCount})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 rtl:right-3 ltr:left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('بحث باسم الجهاز، الكود، الموديل، الغرفة...', 'Search device, code, model, room...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* 4. Devices Grid */}
      {filteredDevices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Zap className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
          <h3 className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">
            {t('لا توجد أجهزة ليزر مطابقة', 'No laser devices matched')}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {t('يمكنك إضافة جهاز ليزر جديد أو تعديل معايير البحث', 'Try adding a new device or changing filters')}
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة أول جهاز ليزر', 'Add First Laser Device')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDevices.map((dev) => {
            const lampMax = dev.maxCapacityShots || 500000;
            const lampUsed = dev.currentLampShots || 0;
            const lampPercent = Math.min(100, Math.round((lampUsed / lampMax) * 100));
            const isNearWarning = dev.warningLimitShots && lampUsed >= dev.warningLimitShots;
            const branchName = branches.find((b) => b.id === dev.branchId)?.name || 'الفرع الرئيسي';

            const devRecords = deviceMaintenanceRecords.filter((m) => m.deviceId === dev.id);
            const hasWarrantyAlert = devRecords.some((m) =>
              m.replacedParts?.some((p) => {
                if (!p.warrantyExpiryDate) return false;
                const diff = Math.ceil((new Date(p.warrantyExpiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                return diff <= 30;
              })
            );

            return (
              <div
                key={dev.id}
                className={`rounded-2xl border bg-white dark:bg-slate-900 p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                  hasWarrantyAlert
                    ? 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-400/30'
                    : isNearWarning
                    ? 'border-amber-400/80 dark:border-amber-600/50'
                    : dev.status === 'Maintenance'
                    ? 'border-amber-300 dark:border-amber-800'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  {/* Top Header & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${
                          dev.status === 'Active'
                            ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {dev.code}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              dev.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : dev.status === 'Maintenance'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}
                          >
                            {dev.status === 'Active'
                              ? t('يعمل (جاهز للتشغيل)', 'Active')
                              : dev.status === 'Maintenance'
                              ? t('قيد الصيانة', 'In Maintenance')
                              : t('معطل / متوقف', 'Out of Service')}
                          </span>
                          {hasWarrantyAlert && (
                            <span className="flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                              <ShieldAlert className="h-3 w-3" />
                              <span>{t('إنذار ضمان', 'Warranty alert')}</span>
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1 line-clamp-1">
                          {isRtl ? dev.name : dev.nameEn || dev.name}
                        </h3>
                      </div>
                    </div>

                    {/* Quick Menu / Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        title={t('تعديل الجهاز', 'Edit Device')}
                        onClick={() => handleOpenEditModal(dev)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title={t('حذف الجهاز', 'Delete Device')}
                        onClick={() => setDeviceToDelete(dev)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Device Specs & Location */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl mb-4 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{t('الموديل والفئة:', 'Model:')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{dev.model || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{t('الرقم التسلسلي (SN):', 'Serial No:')}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{dev.serialNumber || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {t('الغرفة والمقر:', 'Room & Location:')}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{dev.room}</span>
                    </div>
                    {dev.assignedTechnician && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          {t('التكنيشن المسؤول:', 'Technician:')}
                        </span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{dev.assignedTechnician}</span>
                      </div>
                    )}
                  </div>

                  {/* Total Shots & Pulse Economics */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">{t('عداد الجهاز التراكمي', 'Total Pulses')}</span>
                      <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {dev.totalShotsCounter.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">{t('سعر النبضة للعميل', 'Price / Pulse')}</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {dev.pricePerShot ? `${dev.pricePerShot} ج.م` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Lamp Pulse Lifespan Meter */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        {t('استهلاك نبضات اللمبة / الفلاش:', 'Lamp Pulse Life:')}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {lampUsed.toLocaleString()} / {lampMax.toLocaleString()} ({lampPercent}%)
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          lampPercent > 85
                            ? 'bg-rose-500'
                            : lampPercent > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${lampPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">
                        {t('الحد التحذيري:', 'Warning limit:')} {dev.warningLimitShots?.toLocaleString() || '200,000'}
                      </span>
                      {isNearWarning && (
                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('اقترب موعد صيانة اللمبة', 'Maintenance due soon')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Maintenance & Supplier summary */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <Wrench className="h-3.5 w-3.5 text-amber-500" />
                      <span>{t('عمليات الصيانة المسجلة:', 'Maintenances:')}</span>
                      <strong className="text-slate-900 dark:text-white font-mono">{devRecords.length}</strong>
                    </div>
                    {dev.lastMaintenanceDate || devRecords[0]?.maintenanceDate ? (
                      <span className="text-[10px] text-slate-500">
                        {t('آخر صيانة:', 'Last:')} {dev.lastMaintenanceDate || devRecords[0]?.maintenanceDate}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">{t('لا صيانة مسجلة', 'No records')}</span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenAddMaintenance(dev)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer border border-amber-200 dark:border-amber-800/60 shadow-2xs"
                      title={t('تسجيل عملية صيانة جديدة للجهاز وربطها بالمورد والحسابات', 'Record Maintenance')}
                    >
                      <Wrench className="h-3.5 w-3.5 text-amber-600" />
                      <span>{t('+ صيانة', '+ Maint')}</span>
                    </button>

                    <button
                      onClick={() => handleOpenHistory(dev)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      title={t('عرض سجل الصيانة وقطع الغيار والضمان لهذا الجهاز', 'View History')}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>{t('السجل', 'History')} ({devRecords.length})</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowResetLampModal(dev)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 cursor-pointer"
                      title={t('تصفير عداد اللمبة', 'Reset Lamp')}
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>{t('تصفير', 'Reset')}</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(dev)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                        dev.status === 'Active'
                          ? 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}
                    >
                      {dev.status === 'Active' ? t('تحويل للصيانة', 'Maintenance') : t('تفعيل', 'Activate')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  )}

      {/* 5. Add / Edit Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {editingDevice
                    ? t('تعديل بيانات جهاز الليزر', 'Edit Laser Device')
                    : t('إضافة جهاز ليزر جديد للمركز', 'Add New Laser Device')}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-4 text-xs">
              {/* Names Dual Language */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم الجهاز (عربي):', 'Device Name (Arabic):')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: جهاز كانديلا جنتل ماكس برو #1"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم الجهاز (إنجليزي):', 'Device Name (English):')}
                  </label>
                  <input
                    type="text"
                    value={formData.nameEn || ''}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="e.g. Candela GentleMax Pro Plus #1"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Code, Model, Serial */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الجهاز:', 'Device Code:')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="LSR-01"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الموديل / الشركة:', 'Model / Brand:')}
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="مثال: Candela GentleMax Pro"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الرقم التسلسلي (SN):', 'Serial Number:')}
                  </label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="SN-CAN-98210"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Room, Branch, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الغرفة المخصصة:', 'Assigned Room:')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    placeholder="مثال: غرفة ليزر 1 (الدور الأرضي)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الفرع:', 'Branch:')}
                  </label>
                  <select
                    value={formData.branchId || ''}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 font-bold"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('حالة الجهاز:', 'Device Status:')}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 font-bold"
                  >
                    <option value="Active">{t('يعمل (Active)', 'Active')}</option>
                    <option value="Maintenance">{t('قيد الصيانة (Maintenance)', 'Maintenance')}</option>
                    <option value="Out of Service">{t('معطل (Out of Service)', 'Out of Service')}</option>
                  </select>
                </div>
              </div>

              {/* Counters & Lamp Management */}
              <div className="bg-amber-50/50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-amber-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>{t('إدارة عدادات النبضات واللمبة (Flash & Pulse Counters)', 'Pulse & Lamp Counters')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('العداد الإجمالي للجهاز:', 'Total Device Shots:')}
                    </label>
                    <input
                      type="number"
                      value={formData.totalShotsCounter}
                      onChange={(e) => setFormData({ ...formData, totalShotsCounter: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 p-2.5 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('نبضات اللمبة الحالية:', 'Current Lamp Shots:')}
                    </label>
                    <input
                      type="number"
                      value={formData.currentLampShots}
                      onChange={(e) => setFormData({ ...formData, currentLampShots: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 p-2.5 font-mono font-bold text-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('حد تحذير اللمبة:', 'Lamp Warning Limit:')}
                    </label>
                    <input
                      type="number"
                      value={formData.warningLimitShots || 200000}
                      onChange={(e) => setFormData({ ...formData, warningLimitShots: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 p-2.5 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('سعر النبضة للعميل (ج.م):', 'Price per Shot (EGP):')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.pricePerShot || 0.5}
                      onChange={(e) => setFormData({ ...formData, pricePerShot: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 p-2.5 font-mono font-bold text-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('تكلفة النبضة (ج.م):', 'Cost per Shot (EGP):')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.costPerShot || 0.12}
                      onChange={(e) => setFormData({ ...formData, costPerShot: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 p-2.5 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Technician & Maintenance notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التكنيشن / الفني المعتمد:', 'Technician in charge:')}
                  </label>
                  <input
                    type="text"
                    value={formData.assignedTechnician || ''}
                    onChange={(e) => setFormData({ ...formData, assignedTechnician: e.target.value })}
                    placeholder="اسم الفني أو الأخصائي"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('تاريخ آخر صيانة:', 'Last Maintenance Date:')}
                  </label>
                  <input
                    type="date"
                    value={formData.lastMaintenanceDate || ''}
                    onChange={(e) => setFormData({ ...formData, lastMaintenanceDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات الصيانة والتشغيل:', 'Maintenance & Operation Notes:')}
                </label>
                <textarea
                  rows={2}
                  value={formData.maintenanceNotes || ''}
                  onChange={(e) => setFormData({ ...formData, maintenanceNotes: e.target.value })}
                  placeholder="ملاحظات حول الفايبر، التبريد، نوع الهاندبيس..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 cursor-pointer"
                >
                  {editingDevice ? t('حفظ التعديلات', 'Save Changes') : t('حفظ الجهاز الجديد', 'Create Device')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Reset Lamp Modal */}
      {showResetLampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 mb-3">
              <RotateCcw className="h-7 w-7" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {t('تصفير عداد اللمبة / استبدال الفلاش', 'Reset Lamp / Replace Flash')}
            </h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t(
                `هل تم استبدال لمبة الجهاز (${showResetLampModal.name})؟ سيتم تصفير عداد اللمبة الحالية (${showResetLampModal.currentLampShots.toLocaleString()} نبضة) إلى صفر وتسجيل تاريخ الصيانة اليوم. لن يتأثر العداد التراكمي للجهاز.`,
                `Are you replacing the lamp for (${showResetLampModal.name})? Current lamp pulses (${showResetLampModal.currentLampShots.toLocaleString()}) will be reset to 0.`
              )}
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowResetLampModal(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmResetLamp}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>{t('تأكيد استبدال وتصفير اللمبة', 'Confirm Lamp Reset')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Delete Device Confirmation Modal */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 mb-3">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {t('تأكيد حذف جهاز الليزر', 'Confirm Delete Laser Device')}
            </h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t(
                `هل أنت متأكد من رغبتك في حذف جهاز (${deviceToDelete.name})؟ لن يتمكن موظفو الاستقبال من اختياره في شاشات التشغيل بعد الآن.`,
                `Are you sure you want to delete (${deviceToDelete.name})?`
              )}
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeviceToDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('نعم، احذف الجهاز', 'Yes, Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Device Maintenance Modal */}
      {showMaintenanceModal && (
        <DeviceMaintenanceModal
          device={selectedDeviceForMaint}
          onClose={() => {
            setShowMaintenanceModal(false);
            setSelectedDeviceForMaint(null);
          }}
          onSuccess={(_recordId, jvNumber) => {
            setToastFeedback(
              t(
                `تم حفظ عملية الصيانة بنجاح وترحيل القيد المحاسبي (${jvNumber || ''}) وتحديث رصيد المورد وشجرة الحسابات.`,
                `Maintenance record created and journal entry (${jvNumber || ''}) posted to accounting.`
              )
            );
          }}
        />
      )}

      {/* 9. Device Maintenance History & Parts Modal */}
      {selectedDeviceForHistory && (
        <DeviceMaintenanceHistoryModal
          device={selectedDeviceForHistory}
          onClose={() => setSelectedDeviceForHistory(null)}
          onOpenAddMaintenance={handleOpenAddMaintenance}
        />
      )}
    </div>
  );
};
