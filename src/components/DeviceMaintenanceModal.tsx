import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { LaserDevice, DeviceMaintenancePart, DeviceMaintenanceRecord } from '../types';
import {
  Wrench,
  X,
  Plus,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  User,
  Zap,
  CheckCircle2,
  Receipt,
  HelpCircle,
} from 'lucide-react';

interface DeviceMaintenanceModalProps {
  device?: LaserDevice | null;
  onClose: () => void;
  onSuccess?: (maintId: string, jvNumber?: string) => void;
}

export const DeviceMaintenanceModal: React.FC<DeviceMaintenanceModalProps> = ({
  device,
  onClose,
  onSuccess,
}) => {
  const {
    t,
    formatMoney,
    language,
    parties,
    laserDevices,
    addDeviceMaintenance,
  } = usePlatform();

  const isRtl = language === 'ar';

  // Registered suppliers from Parties
  const registeredSuppliers = useMemo(() => {
    return parties.filter((p) => (p.type === 'Supplier' || p.type === 'Both') && !p.isArchived);
  }, [parties]);

  // Selected target device
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(device?.id || (laserDevices[0]?.id || ''));
  const currentDevice = useMemo(() => {
    return laserDevices.find((d) => d.id === selectedDeviceId) || device || null;
  }, [laserDevices, selectedDeviceId, device]);

  // Form Fields
  const [supplierId, setSupplierId] = useState<string>(registeredSuppliers[0]?.id || '');
  const [maintenanceDate, setMaintenanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [maintenanceType, setMaintenanceType] = useState<DeviceMaintenanceRecord['maintenanceType']>('Routine');
  const [totalCost, setTotalCost] = useState<number>(1500);
  const [paymentStatus, setPaymentStatus] = useState<'OnCredit' | 'PaidCash' | 'PaidBank'>('OnCredit');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [technicianName, setTechnicianName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [deviceStatusAfter, setDeviceStatusAfter] = useState<'Active' | 'Maintenance' | 'Out of Service'>('Active');
  const [resetLampShots, setResetLampShots] = useState<boolean>(false);
  const [generalWarrantyMonths, setGeneralWarrantyMonths] = useState<number>(3);

  // Replaced parts list with warranty tracking
  const [parts, setParts] = useState<DeviceMaintenancePart[]>([]);

  // Sub-form for adding a part
  const [newPartName, setNewPartName] = useState<string>('');
  const [newPartCode, setNewPartCode] = useState<string>('');
  const [newPartCost, setNewPartCost] = useState<number>(0);
  const [newPartWarrantyMonths, setNewPartWarrantyMonths] = useState<number>(6);
  const [newPartLifespanShots, setNewPartLifespanShots] = useState<number>(300000);
  const [newPartNotes, setNewPartNotes] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Selected supplier details
  const selectedSupplier = useMemo(() => {
    return registeredSuppliers.find((s) => s.id === supplierId);
  }, [registeredSuppliers, supplierId]);

  // Calculate warranty expiry date helper
  const calculateExpiryDate = (startDate: string, months: number): string => {
    const d = new Date(startDate || new Date());
    d.setMonth(d.getMonth() + (months || 0));
    return d.toISOString().split('T')[0];
  };

  // Add Part to list
  const handleAddPart = () => {
    if (!newPartName.trim()) {
      alert(t('يرجى كتابة اسم القطعة أولاً', 'Please enter part name'));
      return;
    }

    const expiryDate = calculateExpiryDate(maintenanceDate, newPartWarrantyMonths);

    const partObj: DeviceMaintenancePart = {
      id: `part-${Date.now()}-${parts.length + 1}`,
      partName: newPartName.trim(),
      partCode: newPartCode.trim() || undefined,
      cost: Number(newPartCost) || 0,
      warrantyMonths: Number(newPartWarrantyMonths) || 0,
      warrantyExpiryDate: expiryDate,
      installedDate: maintenanceDate,
      expectedLifespanShots: Number(newPartLifespanShots) || undefined,
      startingShotsCounter: currentDevice?.totalShotsCounter || 0,
      notes: newPartNotes.trim() || undefined,
    };

    setParts([...parts, partObj]);

    // Reset part inputs
    setNewPartName('');
    setNewPartCode('');
    setNewPartCost(0);
    setNewPartWarrantyMonths(6);
    setNewPartLifespanShots(300000);
    setNewPartNotes('');
  };

  const handleRemovePart = (partId: string) => {
    setParts(parts.filter((p) => p.id !== partId));
  };

  // Pre-fill quick template for maintenance type
  const handleTypeChange = (type: DeviceMaintenanceRecord['maintenanceType']) => {
    setMaintenanceType(type);
    if (type === 'LampReplacement') {
      setDescription(t('استبدال لمبة الفلاش الأصلية ومعايرة نظام التبريد والعدسة', 'Lamp replacement & calibration'));
      setResetLampShots(true);
      if (parts.length === 0) {
        setNewPartName('لمبة فلاش أصلية (Flashlamp)');
        setNewPartWarrantyMonths(6);
        setNewPartLifespanShots(500000);
      }
    } else if (type === 'FiberRepair') {
      setDescription(t('فحص واستبدال كابل الفايبر والألياف الضوئية المتضررة', 'Fiber cable check & replacement'));
      setResetLampShots(false);
      if (parts.length === 0) {
        setNewPartName('كابل ألياف بصرية Delivery Fiber');
        setNewPartWarrantyMonths(3);
        setNewPartLifespanShots(200000);
      }
    } else if (type === 'CoolingSystem') {
      setDescription(t('صيانة دورية لنظام التبريد وتعبئة الغاز وفحص الحساسات', 'Cooling system maintenance'));
      setResetLampShots(false);
    } else if (type === 'Routine') {
      setDescription(t('صيانة دورية شاملة، تنظيف الفلاتر، ومعايرة مخرجات الطاقة', 'Routine general maintenance & checkup'));
      setResetLampShots(false);
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentDevice) {
      setErrorMessage(t('يرجى اختيار الجهاز المراد صيانته', 'Please select a device'));
      return;
    }

    if (!supplierId) {
      setErrorMessage(t('يرجى اختيار المورد من قائمة الموردين المسجلين', 'Please select a supplier'));
      return;
    }

    if (!selectedSupplier) {
      setErrorMessage(t('المورد المحدد غير موجود بالنظام', 'Selected supplier not found'));
      return;
    }

    if (totalCost <= 0) {
      setErrorMessage(t('يرجى إدخال تكلفة صيانة صحيحة أكبر من صفر', 'Please enter a valid cost'));
      return;
    }

    if (!description.trim()) {
      setErrorMessage(t('يرجى كتابة وصف وتفاصيل الصيانة', 'Please enter maintenance details'));
      return;
    }

    setIsSubmitting(true);

    const typeArMap: Record<string, string> = {
      Routine: 'صيانة دورية عامة',
      LampReplacement: 'استبدال لمبة الفلاش',
      FiberRepair: 'إصلاح / استبدال ألياف ضوئية',
      HandpieceCalibration: 'معايرة مقبض الليزر Handpiece',
      CoolingSystem: 'صيانة نظام التبريد والفريون',
      EmergencyFix: 'إصلاح عطل طارئ وتوقف مفاجئ',
      GeneralOverhaul: 'عمرة وتجديد شامل للجهاز',
      Other: 'صيانة وتوريد قطع أخرى',
    };

    const paymentMethodNames: Record<string, string> = {
      OnCredit: 'آجل على حساب المورد',
      PaidCash: 'نقداً من الخزينة الرئيسية',
      PaidBank: 'تحويل بنكي',
    };

    const overallWarrantyExpiry = calculateExpiryDate(maintenanceDate, generalWarrantyMonths);

    const result = addDeviceMaintenance({
      deviceId: currentDevice.id,
      deviceName: currentDevice.name,
      deviceCode: currentDevice.code,
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      maintenanceDate,
      maintenanceType,
      maintenanceTypeAr: typeArMap[maintenanceType] || maintenanceType,
      cost: Number(totalCost),
      paymentStatus,
      paymentMethodName: paymentMethodNames[paymentStatus],
      invoiceNumber: invoiceNumber.trim() || undefined,
      technicianName: technicianName.trim() || undefined,
      description: description.trim(),
      deviceStatusAfter,
      resetLampShots,
      replacedParts: parts,
      warrantyExpiryDate: overallWarrantyExpiry,
    });

    setIsSubmitting(false);

    if (result.success) {
      if (onSuccess) {
        onSuccess(result.maintenanceId || '', result.journalEntryNumber);
      }
      onClose();
    } else {
      setErrorMessage(result.error || t('حدث خطأ أثناء حفظ عملية الصيانة', 'Failed to save maintenance'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('تسجيل عملية صيانة وقطع غيار لجهاز الليزر', 'Register Device Maintenance')}</span>
                {currentDevice && (
                  <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    {currentDevice.code}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'ربط الصيانة بحساب المورد، وشجرة الحسابات، وتتبع الضمان والعمر الافتراضي',
                  'Link maintenance to supplier balance, accounting ledger & warranty'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Device & Supplier Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Device */}
            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>{t('الجهاز المستهدف بالصيانة:', 'Target Device:')}</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {laserDevices.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.code} - {isRtl ? dev.name : dev.nameEn || dev.name} ({dev.room})
                  </option>
                ))}
              </select>
              {currentDevice && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>
                    {t('عداد النبضات الحالي:', 'Current Pulses:')}{' '}
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">
                      {currentDevice.totalShotsCounter.toLocaleString()}
                    </strong>
                  </span>
                  <span>
                    {t('نبضات اللمبة:', 'Lamp Pulses:')}{' '}
                    <strong className="text-amber-600 font-mono">
                      {currentDevice.currentLampShots.toLocaleString()}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* Supplier Selection from Registered Suppliers */}
            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                <span>{t('المورد القائم بالصيانة (من شاشة الموردين):', 'Supplier (From Directory):')}</span>
                <span className="text-rose-500">*</span>
              </label>
              {registeredSuppliers.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                  {t('لا يوجد موردون مسجلون. يمكنك إضافة مورد في شاشة الموردين.', 'No suppliers found.')}
                </div>
              ) : (
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {registeredSuppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} {sup.phone ? `(${sup.phone})` : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedSupplier && (
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-slate-500">
                    {t('رصيد المورد الحالي:', 'Supplier Balance:')}
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      selectedSupplier.balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatMoney(selectedSupplier.balance)}{' '}
                    {selectedSupplier.balance > 0
                      ? t('(مستحق له)', '(Payable)')
                      : t('(مسدد)', '(Cleared)')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Maintenance Date, Type & Quick Templates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('تاريخ عملية الصيانة:', 'Maintenance Date:')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute right-3 rtl:right-3 ltr:left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={maintenanceDate}
                  onChange={(e) => setMaintenanceDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('نوع الصيانة:', 'Maintenance Type:')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={maintenanceType}
                onChange={(e) => handleTypeChange(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="Routine">{t('صيانة دورية عامة', 'Routine General')}</option>
                <option value="LampReplacement">{t('استبدال لمبة فلاش (Flashlamp)', 'Lamp Replacement')}</option>
                <option value="FiberRepair">{t('إصلاح واستبدال كابل فايبر', 'Fiber Cable Repair')}</option>
                <option value="HandpieceCalibration">{t('معايرة المقبض Handpiece', 'Handpiece Calibration')}</option>
                <option value="CoolingSystem">{t('صيانة نظام التبريد وفريون DCD', 'Cooling System')}</option>
                <option value="EmergencyFix">{t('إصلاح عطل طارئ وتوقف', 'Emergency Fix')}</option>
                <option value="GeneralOverhaul">{t('عمرة وتجديد شامل للجهاز', 'General Overhaul')}</option>
                <option value="Other">{t('أخرى', 'Other')}</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('حالة الجهاز بعد الصيانة:', 'Status After Fix:')}
              </label>
              <select
                value={deviceStatusAfter}
                onChange={(e) => setDeviceStatusAfter(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold"
              >
                <option value="Active">{t('يعمل وجاهز للتشغيل (Active)', 'Active & Ready')}</option>
                <option value="Maintenance">{t('ما زال قيد الصيانة (Maintenance)', 'In Maintenance')}</option>
                <option value="Out of Service">{t('معطل / خارج الخدمة (Out of Service)', 'Out of Service')}</option>
              </select>
            </div>
          </div>

          {/* Section 3: Accounting, Cost & Payment Terms */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 text-xs">
                <Receipt className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t('المحاسبة المالية وشجرة الحسابات:', 'Financial & Ledger Impact:')}</span>
              </span>
              <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                {t('قيد آلي: حساب 5250 صيانة أجهزة', 'Auto JV: 5250 Maintenance')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('إجمالي تكلفة الصيانة:', 'Total Cost:')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 rtl:left-3 ltr:right-3 top-2 text-[10px] font-bold text-slate-400">
                    ج.م
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={totalCost}
                    onChange={(e) => setTotalCost(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 rtl:pr-3 rtl:pl-10 ltr:pl-3 ltr:pr-10 text-xs font-mono font-black text-indigo-600 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('طريقة المحاسبة والسداد:', 'Accounting Method:')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="OnCredit">
                    {t('آجل على حساب المورد (زيادة مديونية المورد)', 'On Credit (Add to Supplier Balance)')}
                  </option>
                  <option value="PaidCash">
                    {t('نقداً مسدد فوراً من الخزينة الرئيسية', 'Cash Paid from Main Safe')}
                  </option>
                  <option value="PaidBank">
                    {t('تحويل بنكي مسدد من الحساب البنكي', 'Bank Transfer')}
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('رقم فاتورة / أمر صيانة المورد:', 'Supplier Invoice / WO #:')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-9024"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-950 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
              <div>
                {paymentStatus === 'OnCredit' ? (
                  <span>
                    {t(
                      `سيتم تحميل مبلغ (${totalCost} ج.م) كاستحقاق للمورد (${selectedSupplier?.name || ''}) في شاشة الموردين، وإصدار قيد يومية متوازن: مدين [مصروفات صيانة الأجهزة] ودائن [الموردون والدائنون].`,
                      `Will add ${totalCost} EGP to supplier payable balance and post balanced journal entry to COA.`
                    )}
                  </span>
                ) : paymentStatus === 'PaidCash' ? (
                  <span>
                    {t(
                      `سيتم تسجيل صرف فوري لمبلغ (${totalCost} ج.م) من الخزينة الرئيسية وقيد يومية متوازن: مدين [مصروفات صيانة الأجهزة] ودائن [الخزينة الرئيسية].`,
                      `Will record cash payment of ${totalCost} EGP from safe and post balanced JV.`
                    )}
                  </span>
                ) : (
                  <span>
                    {t(
                      `سيتم تسجيل تحويل بنكي لمبلغ (${totalCost} ج.م) وقيد يومية متوازن: مدين [مصروفات صيانة الأجهزة] ودائن [البنك الأهلي].`,
                      `Will record bank transfer of ${totalCost} EGP and post balanced JV.`
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Maintenance Details, Tech & Lamp Reset */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('مهندس أو فني الصيانة القائم بالعمل:', 'Engineer / Technician Name:')}
              </label>
              <div className="relative">
                <User className="absolute right-3 rtl:right-3 ltr:left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('اسم المهندس أو شركة التوكيل...', 'e.g. Eng. Hany (Nile Co.)')}
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('مدة ضمان الصيانة العامة (شهور):', 'General Warranty (Months):')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={generalWarrantyMonths}
                  onChange={(e) => setGeneralWarrantyMonths(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <span className="text-slate-500 text-[11px]">
                  {t('ينتهي في:', 'Expires:')}{' '}
                  <strong className="text-slate-800 dark:text-slate-200 font-mono">
                    {calculateExpiryDate(maintenanceDate, generalWarrantyMonths)}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('تفاصيل وبنود الصيانة والأعطال:', 'Maintenance Description & Notes:')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder={t('اكتب تفاصيل الصيانة، ما تم استبداله، وضبط المعايرة والتبريد...', 'Details of repair, replaced parts, calibration...')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Lamp Reset Checkbox */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20 flex items-start gap-3">
            <input
              id="resetLampCheckbox"
              type="checkbox"
              checked={resetLampShots}
              onChange={(e) => setResetLampShots(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-md border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="resetLampCheckbox" className="cursor-pointer">
              <span className="font-black text-amber-900 dark:text-amber-300 block">
                {t('تصفير عداد نبضات اللمبة الحالية (تم تركيب لمبة جديدة)', 'Reset Lamp Pulse Counter (New Lamp Installed)')}
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 block mt-0.5">
                {t(
                  `سيتم إعادة تعيين عداد اللمبة إلى 0 مع الحفاظ التام على العداد التراكمي للجهاز (${currentDevice?.totalShotsCounter.toLocaleString()} نبضة).`,
                  `Current lamp counter will be reset to 0 while keeping total lifetime shots intact.`
                )}
              </span>
            </label>
          </div>

          {/* Section 5: Replaced Parts & Warranty Tracking (متابعة الضمان وقطع الغيار) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                  {t('القطع المستبدلة وتتبع الضمان والعمر الافتراضي:', 'Replaced Parts & Warranty Tracking:')}
                </span>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.2 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  {parts.length} {t('قطع', 'parts')}
                </span>
              </div>
            </div>

            {/* List of Replaced Parts */}
            {parts.length > 0 && (
              <div className="space-y-2">
                {parts.map((p, idx) => {
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 font-black">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{p.partName}</span>
                            {p.partCode && (
                              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                                {p.partCode}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                            <span>
                              {t('الضمان:', 'Warranty:')}{' '}
                              <strong className="text-emerald-600">{p.warrantyMonths} {t('شهور', 'mo')}</strong>{' '}
                              ({t('حتى', 'until')} {p.warrantyExpiryDate})
                            </span>
                            {p.expectedLifespanShots && (
                              <span>
                                {t('العمر الافتراضي:', 'Lifespan:')}{' '}
                                <strong className="font-mono text-indigo-600">
                                  {p.expectedLifespanShots.toLocaleString()} {t('نبضة', 'shots')}
                                </strong>
                              </span>
                            )}
                            {p.cost > 0 && (
                              <span>
                                {t('التكلفة:', 'Cost:')} <strong>{formatMoney(p.cost)}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePart(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Part Sub-form */}
            <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 space-y-2.5">
              <span className="block font-extrabold text-[11px] text-slate-600 dark:text-slate-300">
                {t('+ إضافة قطعة غيار مستبدلة لتتبع ضمانها:', '+ Add Replaced Part for Warranty Tracking:')}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <input
                    type="text"
                    placeholder={t('اسم القطعة (لمبة، ألياف، عدسة، شيلر)...', 'Part name...')}
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder={t('كود القطعة (Part No)...', 'Part code/number...')}
                    value={newPartCode}
                    onChange={(e) => setNewPartCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    placeholder={t('تكلفة القطعة (ج.م)...', 'Cost (EGP)...')}
                    value={newPartCost || ''}
                    onChange={(e) => setNewPartCost(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                    {t('فترة الضمان (بالشهور):', 'Warranty (Months):')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={newPartWarrantyMonths}
                    onChange={(e) => setNewPartWarrantyMonths(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                    {t('العمر الافتراضي الأقصى (نبضات):', 'Lifespan (Max Shots):')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={newPartLifespanShots}
                    onChange={(e) => setNewPartLifespanShots(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddPart}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t('إدراج القطعة وتتبع الضمان', 'Add Part to Warranty')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-black text-white hover:bg-amber-700 shadow-md shadow-amber-600/20 cursor-pointer transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? t('جاري الحفظ والترحيل...', 'Posting...')
                  : t('حفظ عملية الصيانة وترحيل القيود', 'Save Maintenance & Post JV')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
