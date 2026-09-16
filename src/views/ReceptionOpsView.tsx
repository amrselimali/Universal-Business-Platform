import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { ShiftRunRow, ShiftExpense, ReceptionShift, ShiftDeviceCounter } from '../types';
import {
  Play,
  Square,
  Plus,
  Trash2,
  Edit3,
  DollarSign,
  Activity,
  Layers,
  Sparkles,
  Zap,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Search,
  UserCheck,
  Stethoscope,
  Calendar,
  Clock,
  FileSpreadsheet,
  FileText,
  Lock,
  ShieldCheck,
  Check,
  Save,
  MessageSquare,
  ArrowUpDown,
  History,
  Info,
  Printer,
  Download,
  Building2,
  ChevronDown,
  X,
} from 'lucide-react';

interface ReceptionOpsViewProps {
  onNavigateToLaserDevices?: () => void;
}

export const ReceptionOpsView: React.FC<ReceptionOpsViewProps> = ({ onNavigateToLaserDevices }) => {
  const {
    language,
    t,
    formatMoney,
    tenant,
    activeBranch,
    branches,
    currentUser,
    parties,
    staffMembers,
    products,
    paymentMethods,
    accounts,
    receptionShifts,
    activeReceptionShift,
    openReceptionShift,
    closeReceptionShift,
    addShiftRunRow,
    updateShiftRunRow,
    removeShiftRunRow,
    addShiftExpense,
    removeShiftExpense,
    updateShiftBalancing,
    updateDeviceCounter,
    updateShiftNotes,
    appointments,
    laserDevices,
  } = usePlatform();

  const isRtl = language === 'ar';
  const activeShift = activeReceptionShift;

  // Date of Today
  const todayIso = new Date().toISOString().split('T')[0];

  // Today's Bookings for Reception Preview (Strictly Bookings, No Follow-ups)
  const todayBookings = appointments.filter(
    (a) => a.date === todayIso && a.status !== 'Cancelled'
  );

  // Modal States
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showPrintShiftModal, setShowPrintShiftModal] = useState(false);

  // Open Shift Form
  const [openShiftReceptionist, setOpenShiftReceptionist] = useState(currentUser?.name || '');
  const [openShiftNotes, setOpenShiftNotes] = useState('');

  // Close Shift Form
  const [closeShiftNotes, setCloseShiftNotes] = useState('');

  // Add Run Row Form
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [roomNumber, setRoomNumber] = useState('غرفة 1 (الليزر)');
  const [serviceId, setServiceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [pulsesCount, setPulsesCount] = useState<number>(0);
  const [consumedQty, setConsumedQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [paymentMethodName, setPaymentMethodName] = useState(paymentMethods[0]?.nameAr || 'نقداً (كاش)');
  const [collectedAmount, setCollectedAmount] = useState(0);
  const [laserDevice, setLaserDevice] = useState(laserDevices[0]?.name || '');
  const [notes, setNotes] = useState('');

  // Inline Editing State for Shift Run Table
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<Partial<ShiftRunRow>>({});

  // Expense Form
  const [expenseCategory, setExpenseCategory] = useState('مشتريات ضيافة وعيادة');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseMethod, setExpenseMethod] = useState('الخزينة الرئيسية (نقداً)');
  const [expenseDate, setExpenseDate] = useState(todayIso);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

  // List of coded suppliers (Supplier or Both)
  const suppliersList = React.useMemo(() => {
    const list = parties.filter((p) => p.type === 'Supplier' || p.type === 'Both');
    const hasCash = list.some((p) => p.name.includes('كاش') || p.name.includes('نقدي'));
    if (!hasCash) {
      return [
        {
          id: 'party-s-cash',
          tenantId: tenant?.id || 'tenant-eg-001',
          name: 'مورد كاش (نقدي)',
          nameEn: 'Cash Supplier (General)',
          type: 'Supplier' as const,
          phone: '01000000000',
          balance: 0,
          createdAt: new Date().toISOString(),
        },
        ...list,
      ];
    }
    return list;
  }, [parties, tenant?.id]);

  const defaultCashSupplier = React.useMemo(() => {
    return (
      suppliersList.find((s) => s.name.includes('كاش') || s.name.includes('نقدي')) ||
      suppliersList[0]
    );
  }, [suppliersList]);

  // Filtered suppliers based on search query
  const filteredSuppliers = React.useMemo(() => {
    if (!supplierSearchTerm.trim()) return suppliersList;
    const term = supplierSearchTerm.toLowerCase().trim();
    return suppliersList.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.nameEn && s.nameEn.toLowerCase().includes(term)) ||
        (s.phone && s.phone.includes(term)) ||
        (s.systemCode && s.systemCode.toLowerCase().includes(term))
    );
  }, [suppliersList, supplierSearchTerm]);

  // Open Expense Modal with Default Cash Supplier & Default Payment Method
  const handleOpenAddExpenseModal = () => {
    const cashSup = defaultCashSupplier || {
      id: 'party-s-cash',
      name: 'مورد كاش (نقدي)',
    };
    setSupplierId(cashSup.id);
    setSupplierName(cashSup.name);
    setSupplierSearchTerm('');
    setIsSupplierDropdownOpen(false);

    const activePMs = paymentMethods.filter((pm) => !pm.isArchived);
    const defPM =
      activePMs.find((pm) => pm.isDefault)?.nameAr ||
      activePMs[0]?.nameAr ||
      'الخزينة الرئيسية (نقداً)';
    setExpenseMethod(defPM);

    setExpenseCategory('مشتريات ضيافة وعيادة');
    setExpenseAmount(0);
    setExpenseReason('');
    setExpenseDate(todayIso);
    setShowAddExpenseModal(true);
  };

  // Manual Shift Notes State
  const [manualNotes, setManualNotes] = useState(activeShift?.notes || '');
  const [notesSavedAlert, setNotesSavedAlert] = useState(false);

  // Update local notes when active shift changes
  React.useEffect(() => {
    if (activeShift) {
      setManualNotes(activeShift.notes || '');
    }
  }, [activeShift?.id, activeShift?.notes]);

  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    openReceptionShift(openShiftReceptionist, openShiftNotes);
    setShowOpenShiftModal(false);
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeShift) {
      closeReceptionShift(activeShift.id, closeShiftNotes);
      setShowCloseShiftModal(false);
    }
  };

  const handleSelectService = (id: string) => {
    setServiceId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setServiceName(language === 'ar' ? prod.nameAr : prod.nameEn);
      setUnitPrice(prod.sellingPrice);
      setCollectedAmount(prod.sellingPrice * consumedQty);
    }
  };

  const handleSelectPatient = (id: string) => {
    setPatientId(id);
    const p = parties.find((party) => party.id === id);
    if (p) {
      setPatientName(p.name);
    }
  };

  const handleAddRunRowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const doc = staffMembers.find((s) => s.id === doctorId);
    const tech = staffMembers.find((s) => s.id === technicianId);

    addShiftRunRow(activeShift.id, {
      patientId: patientId || undefined,
      patientName: patientName || 'عميل / مريض نقدي',
      doctorId: doctorId || undefined,
      doctorName: doc ? doc.nameAr : 'د. استشاري',
      technicianId: technicianId || undefined,
      technicianName: tech ? tech.nameAr : undefined,
      roomNumber,
      serviceName: serviceName || 'جلسة علاجية / خدمة',
      pulsesCount: pulsesCount > 0 ? pulsesCount : undefined,
      consumedQuantity: consumedQty,
      unitPrice,
      totalRevenue: consumedQty * unitPrice,
      paymentMethod: paymentMethodName,
      collectedAmount,
      laserDevice: laserDevice || undefined,
      notes,
    });

    // Reset Form
    setPatientId('');
    setPatientName('');
    setPulsesCount(0);
    setNotes('');
    setShowAddRowModal(false);
  };

  // Start inline editing of a run row
  const handleStartEditRow = (row: ShiftRunRow) => {
    setEditingRowId(row.id);
    setEditRowData({
      patientName: row.patientName || row.customerName || '',
      roomNumber: row.roomNumber,
      serviceName: row.serviceName,
      pulsesCount: row.pulsesCount,
      consumedQuantity: row.consumedQuantity,
      unitPrice: row.unitPrice,
      laserDevice: row.laserDevice,
      paymentMethod: row.paymentMethod,
      collectedAmount: row.collectedAmount,
    });
  };

  // Save inline edit of run row
  const handleSaveEditRow = (rowId: string) => {
    if (!activeShift) return;
    const qty = editRowData.consumedQuantity ?? 1;
    const price = editRowData.unitPrice ?? 0;
    const rev = qty * price;
    const pName = editRowData.patientName || editRowData.customerName || 'عميل / مريض نقدي';

    updateShiftRunRow(activeShift.id, rowId, {
      ...editRowData,
      patientName: pName,
      customerName: pName,
      totalRevenue: rev,
      collectedAmount: editRowData.collectedAmount !== undefined ? editRowData.collectedAmount : rev,
    });
    setEditingRowId(null);
    setEditRowData({});
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || expenseAmount <= 0) return;
    if (!supplierName.trim()) {
      alert(t('برجاء اختيار اسم المورد أولاً (إجباري)', 'Please select a supplier name (mandatory)'));
      return;
    }

    const isDirectSupplierPayment = expenseCategory === 'سداد دفعات ومستلزمات موردين';
    const finalDesc =
      expenseReason.trim() ||
      (isDirectSupplierPayment
        ? `سداد دفعة للمورد: ${supplierName}`
        : `مصروف: ${expenseCategory} (${supplierName})`);

    const activePMs = paymentMethods.filter((pm) => !pm.isArchived);
    const resolvedMethod =
      expenseMethod ||
      activePMs.find((pm) => pm.isDefault)?.nameAr ||
      activePMs[0]?.nameAr ||
      'الخزينة الرئيسية (نقداً)';

    addShiftExpense(activeShift.id, {
      category: expenseCategory,
      amount: expenseAmount,
      reason: finalDesc,
      description: finalDesc,
      disbursementMethod: resolvedMethod,
      disbursedBy: currentUser?.name || 'الريسيبشن',
      date: expenseDate,
      timestamp: expenseDate
        ? `${expenseDate}T${new Date().toTimeString().split(' ')[0]}`
        : new Date().toISOString(),
      supplierId: supplierId || undefined,
      supplierName: supplierName || undefined,
    });

    setExpenseAmount(0);
    setExpenseReason('');
    setSupplierId('');
    setSupplierName('');
    setSupplierSearchTerm('');
    setIsSupplierDropdownOpen(false);
    setShowAddExpenseModal(false);
  };

  const handleSaveManualNotes = () => {
    if (activeShift) {
      updateShiftNotes(activeShift.id, manualNotes);
      setNotesSavedAlert(true);
      setTimeout(() => setNotesSavedAlert(false), 3000);
    }
  };

  // Calculate Table Aggregate Totals for Run-Sheet
  const totalPulsesCount = activeShift?.runRows.reduce((sum, r) => sum + (r.pulsesCount || 0), 0) || 0;
  const totalConsumedQty = activeShift?.runRows.reduce((sum, r) => sum + (r.consumedQuantity || 0), 0) || 0;
  const totalRunRevenue = activeShift?.runRows.reduce((sum, r) => sum + (r.totalRevenue || 0), 0) || 0;
  const totalRunCollected = activeShift?.runRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0) || 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* 1. Active Shift Header (No Heavy Top Cards, Direct Actions) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${
                activeShift
                  ? 'bg-emerald-600 shadow-emerald-600/20'
                  : 'bg-slate-700 shadow-slate-700/20'
              }`}
            >
              <Activity className="h-6 w-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                  {t('شاشة التشغيل اليومي (الريسيبشن)', 'Reception Operating Shift Run-Sheet')}
                </h1>
                {activeShift ? (
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-full flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                    {t('الشيفت مفتوح ونشط', 'Active Shift Open')} ({activeShift.shiftNumber})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-full">
                    {t('لا يوجد شيفت مفتوح حالياً', 'No Active Shift')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeShift
                  ? `${t('تاريخ الشيفت:', 'Shift Date:')} ${activeShift.shiftDate} • ${t('المسؤول:', 'Staff:')} ${activeShift.receptionistName} • ${t('الفرع:', 'Branch:')} ${activeBranch?.name || tenant.name}`
                  : `${t('تاريخ اليوم:', "Today's Date:")} ${todayIso} • ${t('حجوزات اليوم:', "Today's Bookings:")} ${todayBookings.length} ${t('حجز جاهز للتشغيل', 'bookings ready')}`}
              </p>
            </div>
          </div>

          {/* Shift Actions */}
          <div className="flex items-center gap-2">
            {!activeShift ? (
              <button
                onClick={() => {
                  setOpenShiftReceptionist(currentUser?.name || '');
                  setShowOpenShiftModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{t('فتح شيفت تشغيل جديد', 'Open New Shift')}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowAddRowModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('إضافة حركة تشغيل / مريض', 'Add Patient Run Entry')}</span>
                </button>

                <button
                  onClick={() => setShowPrintShiftModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                  title={t('طباعة ومعاينة تقرير الشيفت', 'Print Shift Report')}
                >
                  <Printer className="h-4 w-4 text-indigo-600" />
                  <span>{t('طباعة تقرير الشيفت', 'Print Shift')}</span>
                </button>

                <button
                  onClick={() => setShowCloseShiftModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>{t('تقفيل وإغلاق الشيفت', 'Close Shift')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Shift Run-Sheet Table (With Inline Editing & Pulses before Qty & Bottom Totals) */}
      {activeShift ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('جدول حركات التشغيل والخدمات المنفذة خلال الشيفت', 'Shift Operating Run-Sheet')}
              </h2>
              <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md font-bold">
                {activeShift.runRows.length} {t('حركة منفذة', 'Entries')}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {t('* يمكنك تعديل الغرفة والخدمة والنبضات والكمية والسعر والجهاز مباشرة أثناء فتح الشيفت', '* Editable columns enabled while shift is open')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{t('المريض / العميل', 'Patient / Client')}</th>
                  <th className="p-3">{t('الطبيب / التكنيشن', 'Doctor / Technician')}</th>
                  <th className="p-3">{t('الغرفة (قابل للتعديل)', 'Room')}</th>
                  <th className="p-3">{t('الخدمة / الجلسة', 'Service / Session')}</th>
                  {/* Pulse Count Column BEFORE Quantity */}
                  <th className="p-3">{t('عدد النبضات', 'Pulse Count')}</th>
                  <th className="p-3">{t('الكمية', 'Qty')}</th>
                  <th className="p-3">{t('السعر', 'Unit Price')}</th>
                  <th className="p-3">{t('الإيراد', 'Total Revenue')}</th>
                  <th className="p-3">{t('طريقة السداد', 'Payment Method')}</th>
                  <th className="p-3">{t('المحصل', 'Collected')}</th>
                  <th className="p-3">{t('جهاز الليزر', 'Laser Device')}</th>
                  <th className="p-3 text-center">{t('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeShift.runRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      <Activity className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p>{t('لم يتم تسجيل أي حركة تشغيل في هذا الشيفت حتى الآن.', 'No run-sheet entries yet.')}</p>
                      <button
                        onClick={() => setShowAddRowModal(true)}
                        className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                      >
                        + {t('إضافة أول حركة للشيفت', 'Add First Entry')}
                      </button>
                    </td>
                  </tr>
                ) : (
                  activeShift.runRows.map((row, idx) => {
                    const isEditing = editingRowId === row.id;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>

                        {/* Patient Name (Editable) */}
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRowData.patientName || ''}
                              onChange={(e) => setEditRowData({ ...editRowData, patientName: e.target.value, customerName: e.target.value })}
                              placeholder="اسم المريض..."
                              className="w-36 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800 font-bold"
                            />
                          ) : (
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {row.patientName || row.customerName || t('عميل / مريض نقدي', 'Cash Patient')}
                              </div>
                              {(row.systemCode || row.patientPhone) && (
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {row.systemCode ? `${row.systemCode}` : ''}
                                  {row.systemCode && row.patientPhone ? ' • ' : ''}
                                  {row.patientPhone ? `${row.patientPhone}` : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Doctor / Tech */}
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          <div>{row.doctorName || '-'}</div>
                          {row.technicianName && (
                            <div className="text-[10px] text-slate-400">تك: {row.technicianName}</div>
                          )}
                        </td>

                        {/* Room (Editable) */}
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRowData.roomNumber || ''}
                              onChange={(e) => setEditRowData({ ...editRowData, roomNumber: e.target.value })}
                              className="w-24 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800"
                            />
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300">{row.roomNumber || '-'}</span>
                          )}
                        </td>

                        {/* Service Name (Editable) */}
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRowData.serviceName || ''}
                              onChange={(e) => setEditRowData({ ...editRowData, serviceName: e.target.value })}
                              className="w-36 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800"
                            />
                          ) : (
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{row.serviceName}</span>
                          )}
                        </td>

                        {/* Pulses Count BEFORE QTY (Editable) */}
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              value={editRowData.pulsesCount ?? 0}
                              onChange={(e) => setEditRowData({ ...editRowData, pulsesCount: Number(e.target.value) })}
                              className="w-20 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800 font-mono"
                            />
                          ) : row.pulsesCount ? (
                            <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                              {row.pulsesCount.toLocaleString()} {t('ن', 'p')}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Consumed Quantity (Editable) */}
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              value={editRowData.consumedQuantity ?? 1}
                              onChange={(e) => setEditRowData({ ...editRowData, consumedQuantity: Number(e.target.value) })}
                              className="w-16 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800 font-bold"
                            />
                          ) : (
                            <span className="font-bold">{row.consumedQuantity}</span>
                          )}
                        </td>

                        {/* Unit Price (Editable) */}
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              value={editRowData.unitPrice ?? 0}
                              onChange={(e) => setEditRowData({ ...editRowData, unitPrice: Number(e.target.value) })}
                              className="w-24 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800 font-bold"
                            />
                          ) : (
                            formatMoney(row.unitPrice)
                          )}
                        </td>

                        {/* Total Revenue */}
                        <td className="p-3 font-black text-slate-900 dark:text-white">
                          {formatMoney(row.totalRevenue)}
                        </td>

                        {/* Payment Method */}
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {row.paymentMethod}
                          </span>
                        </td>

                        {/* Collected Amount */}
                        <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(row.collectedAmount)}
                        </td>

                        {/* Laser Device (Editable) */}
                        <td className="p-3">
                          {isEditing ? (
                            <select
                              value={editRowData.laserDevice || ''}
                              onChange={(e) => setEditRowData({ ...editRowData, laserDevice: e.target.value })}
                              className="w-40 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800"
                            >
                              <option value="">{t('بدون جهاز', 'None')}</option>
                              {laserDevices.map((d) => (
                                <option key={d.id} value={d.name}>
                                  {d.name} {d.room ? `(${d.room})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : row.laserDevice ? (
                            <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span>{row.laserDevice}</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <button
                                onClick={() => handleSaveEditRow(row.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer font-bold"
                                title={t('حفظ التعديل', 'Save')}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartEditRow(row)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md transition-colors cursor-pointer"
                                title={t('تعديل السطر', 'Edit row')}
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              onClick={() => removeShiftRunRow(activeShift.id, row.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                              title={t('حذف السطر', 'Delete row')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* 3. Totals Aggregates Placed at the Bottom of Table (الإجماليات أسفل الجدول) */}
              {activeShift.runRows.length > 0 && (
                <tfoot className="bg-slate-100/80 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                  <tr>
                    <td colSpan={5} className="p-3 text-right rtl:text-left font-black uppercase text-xs">
                      {t('إجمالي حركات الشيفت (Totals):', 'Shift Table Totals:')}
                    </td>
                    <td className="p-3 text-amber-600 font-black">
                      {totalPulsesCount.toLocaleString()} {t('نبضة', 'pulses')}
                    </td>
                    <td className="p-3 font-black">
                      {totalConsumedQty}
                    </td>
                    <td className="p-3">-</td>
                    <td className="p-3 text-slate-900 dark:text-white font-black">
                      {formatMoney(totalRunRevenue)}
                    </td>
                    <td className="p-3">-</td>
                    <td className="p-3 text-emerald-600 dark:text-emerald-400 font-black">
                      {formatMoney(totalRunCollected)}
                    </td>
                    <td colSpan={2} className="p-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Quick Bottom Summary Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block">{t('إجمالي إيراد الخدمات', 'Gross Revenue')}</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                {formatMoney(activeShift.totalRevenue)}
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">{t('إجمالي المحصل الفعلي', 'Total Collected')}</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                {formatMoney(activeShift.totalCollected)}
              </span>
            </div>

            <div className="p-2.5 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-800/40">
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">{t('إجمالي المصروفات المنصرفة', 'Total Expenses')}</span>
              <span className="text-base font-black text-rose-700 dark:text-rose-300 mt-0.5 block">
                {formatMoney(activeShift.totalExpenses)}
              </span>
            </div>

            <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-800/40">
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block">{t('صافي نقدية الشيفت', 'Net Cash in Shift')}</span>
              <span className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-0.5 block">
                {formatMoney(activeShift.netShiftCash)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Closed State: Default View of Today's Bookings (No Follow-ups) */
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <Lock className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('شاشة التشغيل مغلقة - جاهزة لافتتاح شيفت جديد', 'Operating Shift is Closed')}
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              {t(
                'يمكنك مراجعة حجوزات اليوم أدناه، والضغط على فتح الشيفت لبدء تسجيل حركات التشغيل والنبضات والمصروفات تلقائياً.',
                'Review today bookings below and open shift to start operations.'
              )}
            </p>
            <button
              onClick={() => setShowOpenShiftModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{t('افتتاح وبدء شيفت التشغيل اليومي', 'Open Today Shift')}</span>
            </button>
          </div>

          {/* Today's Bookings Agenda Preview (No Follow-ups) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('جدول حجوزات اليوم المقررة (حجوزات فقط)', "Today's Scheduled Bookings (Bookings Only)")}
                </h3>
                <span className="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-md">
                  {todayBookings.length} {t('حجز لليوم', 'bookings')}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">{t('المريض / العميل', 'Patient')}</th>
                    <th className="p-3">{t('رقم الهاتف', 'Phone')}</th>
                    <th className="p-3">{t('الخدمة / الجلسة', 'Service')}</th>
                    <th className="p-3">{t('الطبيب المعالج', 'Doctor')}</th>
                    <th className="p-3">{t('التوقيت والغرفة', 'Time & Room')}</th>
                    <th className="p-3">{t('حالة الحجز', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {todayBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {t('لا توجد حجوزات مسجلة لتاريخ اليوم حتى الآن.', 'No bookings scheduled for today.')}
                      </td>
                    </tr>
                  ) : (
                    todayBookings.map((apt, idx) => (
                      <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{apt.patientName}</td>
                        <td className="p-3 text-slate-500 font-mono">{apt.patientPhone || '-'}</td>
                        <td className="p-3 font-semibold text-indigo-600">{apt.serviceNameAr}</td>
                        <td className="p-3 font-medium">{apt.doctorName || 'د. استشاري'}</td>
                        <td className="p-3">{apt.time} • {apt.roomNumber || 'عيادة 1'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700">
                            {apt.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Expenses Table: Positioned DIRECTLY AFTER Shift Run Table, with Full Detailed Columns + Date */}
      {activeShift && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('جدول مصروفات الشيفت التفصيلي', 'Shift Expenses Detailed Table')}
              </h3>
              <span className="px-2 py-0.5 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 rounded-md font-bold">
                {activeShift.expenses.length} {t('مصروف', 'Entries')}
              </span>
            </div>

            <button
              onClick={handleOpenAddExpenseModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 rounded-xl cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('تسجيل مصروف جديد', 'Add Expense')}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-rose-50/60 dark:bg-rose-950/30 text-rose-900 dark:text-rose-300 font-bold uppercase border-b border-rose-100 dark:border-rose-900/40">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{t('التاريخ والوقت', 'Date & Time')}</th>
                  <th className="p-3">{t('بند المصروف', 'Category')}</th>
                  <th className="p-3">{t('المبلغ (ج.م)', 'Amount')}</th>
                  <th className="p-3">{t('البيان وسبب الصرف', 'Reason & Description')}</th>
                  <th className="p-3">{t('جهة وطريقة الصرف', 'Disbursement Method')}</th>
                  <th className="p-3">{t('المسؤول عن الصرف', 'Disbursed By')}</th>
                  <th className="p-3 text-center">{t('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeShift.expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      {t('لم يتم صرف أي مبالغ من الشيفت حتى الآن.', 'No expenses recorded in this shift.')}
                    </td>
                  </tr>
                ) : (
                  activeShift.expenses.map((exp, idx) => (
                    <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                        {exp.timestamp ? exp.timestamp.replace('T', ' ').slice(0, 16) : todayIso}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{exp.category}</td>
                      <td className="p-3 font-black text-rose-600 dark:text-rose-400">
                        {formatMoney(exp.amount)}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        <div className="font-medium">{exp.reason || exp.description}</div>
                        {exp.supplierName && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3 inline" />
                            <span>{t('المورد:', 'Supplier:')}</span>
                            <span>{exp.supplierName}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          {exp.disbursementMethod}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{exp.disbursedBy}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => removeShiftExpense(activeShift.id, exp.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md cursor-pointer"
                          title={t('حذف المصروف', 'Delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {activeShift.expenses.length > 0 && (
                <tfoot className="bg-rose-50/40 dark:bg-rose-950/20 font-bold border-t border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-300">
                  <tr>
                    <td colSpan={3} className="p-3 text-right rtl:text-left font-black">
                      {t('إجمالي مصروفات الشيفت:', 'Total Shift Expenses:')}
                    </td>
                    <td className="p-3 font-black text-rose-700 dark:text-rose-400">
                      {formatMoney(activeShift.totalExpenses)}
                    </td>
                    <td colSpan={4} className="p-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 5. Balancing Matrix (with Auto-Calculated Opening Balance) & Laser Tracker (with Adjustments) */}
      {activeShift && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shift Balancing Matrix (with Opening Balance Column) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('جدول تسوية طرق السداد (مع الرصيد الافتتاحي)', 'Payment Methods Balancing Matrix')}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">{t('وسيلة الدفع', 'Payment Method')}</th>
                    {/* Auto Calculated Opening Balance Column */}
                    <th className="p-2.5 text-indigo-700 dark:text-indigo-400 font-black">{t('الرصيد الافتتاحي', 'Opening Bal')}</th>
                    <th className="p-2.5">{t('المقبوضات', 'Collected')}</th>
                    <th className="p-2.5">{t('المصروفات', 'Disbursed')}</th>
                    <th className="p-2.5">{t('التسويات', 'Adjustments')}</th>
                    <th className="p-2.5 font-black text-slate-900 dark:text-white">{t('الرصيد الختامي', 'Closing Bal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeShift.balancing.map((row) => {
                    const openingBal = row.openingBalance ?? 0;
                    return (
                      <tr key={row.paymentMethodId}>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          {row.paymentMethodName}
                        </td>
                        <td className="p-2.5 font-bold text-indigo-600 dark:text-indigo-400">
                          {formatMoney(openingBal)}
                        </td>
                        <td className="p-2.5 font-semibold text-emerald-600">{formatMoney(row.totalCollected)}</td>
                        <td className="p-2.5 font-semibold text-rose-600">{formatMoney(row.totalDisbursed)}</td>
                        <td className="p-2.5">{formatMoney(row.adjustments)}</td>
                        <td className="p-2.5 font-black text-indigo-700 dark:text-indigo-300">
                          {formatMoney(row.closingBalance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Laser Devices Pulses Tracker & Operation Monitor (مراقبة أجهزة الليزر في أسفل شاشة التشغيل) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {t('مراقبة وتشغيل أجهزة الليزر والعدادات (الشيفت الحالي)', 'Laser Devices Operation & Pulses Monitor')}
                    </h3>
                    <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                      {activeShift.deviceCounters.reduce((s, d) => s + (d.consumedCounter || 0), 0).toLocaleString()} {t('نبضة مستهلكة بالشيفت', 'shift pulses')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t(
                      'مراقبة فورية للنبضات المستهلكة، وحالة اللمبات، وتأثير حركات الشيفت على عدادات الأجهزة',
                      'Real-time pulse consumption tracking, lamp health, and shift counters reconciliation'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onNavigateToLaserDevices && (
                  <button
                    onClick={onNavigateToLaserDevices}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-all cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-600" />
                    <span>{t('إدارة وتكويد الأجهزة (إضافة / تعديل / حذف)', 'Manage Laser Devices')}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">{t('الجهاز والموقع', 'Device & Location')}</th>
                    <th className="p-2.5">{t('صحة اللمبة / الفلاش', 'Lamp Health')}</th>
                    <th className="p-2.5">{t('الافتتاحي', 'Opening')}</th>
                    <th className="p-2.5 text-indigo-600 font-bold">{t('المستهلك بالشيفت', 'Consumed')}</th>
                    {/* Adjustments Column */}
                    <th className="p-2.5 text-amber-600 font-bold">{t('التسويات (+ أو -)', 'Adjustments')}</th>
                    <th className="p-2.5 font-black text-emerald-700 dark:text-emerald-400">{t('الختامي المحسوب', 'Closing')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeShift.deviceCounters.map((dev) => {
                    const adj = dev.adjustments ?? 0;
                    const masterDev = laserDevices.find(
                      (d) => d.id === dev.deviceId || d.name === dev.deviceName
                    );
                    const lampMax = masterDev?.maxCapacityShots || 500000;
                    const lampUsed = masterDev?.currentLampShots || 0;
                    const lampPct = Math.min(100, Math.round((lampUsed / lampMax) * 100));
                    const isNearWarning = masterDev?.warningLimitShots && lampUsed >= masterDev.warningLimitShots;

                    return (
                      <tr key={dev.deviceId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                masterDev?.status === 'Maintenance'
                                  ? 'bg-amber-500 animate-pulse'
                                  : 'bg-emerald-500'
                              }`}
                              title={masterDev?.status || 'Active'}
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{dev.deviceName}</span>
                                {masterDev?.code && (
                                  <span className="font-mono text-[10px] px-1 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600">
                                    {masterDev.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {masterDev?.room || t('غرفة ليزر', 'Laser Room')} {masterDev?.model ? `• ${masterDev.model}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Lamp Health Progress */}
                        <td className="p-2.5 min-w-[140px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-mono text-slate-600 dark:text-slate-300">
                                {lampUsed.toLocaleString()} / {lampMax.toLocaleString()}
                              </span>
                              <span className={`font-bold ${isNearWarning ? 'text-rose-500' : 'text-slate-500'}`}>
                                {lampPct}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  lampPct > 80 ? 'bg-rose-500' : lampPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${lampPct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="p-2.5 text-slate-600 dark:text-slate-300 font-mono font-medium">
                          {dev.openingCounter.toLocaleString()}
                        </td>

                        <td className="p-2.5 font-black text-indigo-600 dark:text-indigo-400 font-mono">
                          +{dev.consumedCounter.toLocaleString()}
                        </td>

                        <td className="p-2.5">
                          <input
                            type="number"
                            value={adj}
                            onChange={(e) =>
                              updateDeviceCounter(
                                activeShift.id,
                                dev.deviceId,
                                dev.consumedCounter,
                                Number(e.target.value)
                              )
                            }
                            className="w-20 px-2 py-1 text-xs rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-slate-800 font-mono text-center font-bold"
                          />
                        </td>

                        <td className="p-2.5 font-black text-emerald-700 dark:text-emerald-300 font-mono">
                          {dev.closingCounter.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Manual Notes Table / Section at the Bottom of Screen (جدول الملاحظات اليدوية في أسفل الشاشة) */}
      {activeShift && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('جدول وسجل الملاحظات اليدوية للشيفت (التسليم والملاحظات الخاصة)', 'Manual Shift Notes & Handover Log')}
              </h3>
            </div>
            {notesSavedAlert && (
              <span className="px-3 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-lg animate-fade-in flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                {t('تم حفظ الملاحظات بنجاح', 'Notes saved successfully')}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <textarea
              rows={3}
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="اكتب هنا أي ملاحظات يدوية خاصة بحركات الشيفت، تسليم الوردية التالية، أمانات المرضى، أو تعليمات الدكاترة..."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveManualNotes}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{t('حفظ الملاحظات اليدوية', 'Save Manual Notes')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {t('فتح شيفت تشغيل ريسيبشن جديد', 'Open Reception Shift')}
            </h3>

            <form onSubmit={handleOpenShiftSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم موظف الاستقبال المسؤول', 'Receptionist In-Charge')}
                </label>
                <input
                  type="text"
                  required
                  value={openShiftReceptionist}
                  onChange={(e) => setOpenShiftReceptionist(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات افتتاح الشيفت', 'Opening Notes')}
                </label>
                <textarea
                  rows={2}
                  value={openShiftNotes}
                  onChange={(e) => setOpenShiftNotes(e.target.value)}
                  placeholder="ملاحظات تسليم الوردية والرصيد المستلم..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  {t('تأكيد فتح الشيفت', 'Confirm Open')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShiftModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {t('تقفيل وإغلاق شيفت التشغيل', 'Close Reception Shift')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t(
                'عند إغلاق الشيفت سيتم حفظ كافة الحركات والمقبوضات والمصروفات، وترحيل الأرصدة الختامية للشيفت التالي.',
                'Closing shift will lock rows and carry forward closing balances.'
              )}
            </p>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات تقفيل الشيفت والتسليم', 'Closing & Handover Notes')}
                </label>
                <textarea
                  rows={3}
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  placeholder="ملاحظات التسليم والمتبقيات..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                >
                  {t('تأكيد إغلاق الشيفت', 'Confirm Close')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Run-sheet Row Modal */}
      {showAddRowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('تسجيل حركة تشغيل / خدمة لمريض', 'Add Patient Service Run Entry')}
              </h3>
              <button
                onClick={() => setShowAddRowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddRunRowSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اختيار العميل / المريض من السجل', 'Select Patient')}
                  </label>
                  <select
                    value={patientId}
                    onChange={(e) => handleSelectPatient(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('اختر مريض مسجل أو اكتب اسمه...', 'Select patient...')}</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.systemCode || p.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم المريض *', 'Patient Name *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="اسم المريض..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الطبيب المعالج', 'Doctor')}
                  </label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('اختر الطبيب...', 'Select Doctor...')}</option>
                    {staffMembers
                      .filter((s) => s.roleType === 'Doctor')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التكنيشن / المساعد', 'Technician')}
                  </label>
                  <select
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('اختر التكنيشن...', 'Select Technician...')}</option>
                    {staffMembers
                      .filter((s) => s.roleType === 'Technician' || s.roleType === 'Employee')
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nameAr}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الغرفة / العيادة', 'Room')}
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Service & Pulse Count BEFORE Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الخدمة أو الجلسة *', 'Service *')}
                  </label>
                  <select
                    value={serviceId}
                    onChange={(e) => handleSelectService(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('اختر الخدمة...', 'Select...')}</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {language === 'ar' ? prod.nameAr : prod.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pulses Count BEFORE QTY */}
                <div>
                  <label className="block text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
                    {t('عدد النبضات', 'Pulses')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pulsesCount}
                    onChange={(e) => setPulsesCount(Number(e.target.value))}
                    placeholder="1500"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الكمية', 'Qty')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={consumedQty}
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      setConsumedQty(q);
                      setCollectedAmount(q * unitPrice);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('سعر الوحدة', 'Unit Price')}
                  </label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setUnitPrice(p);
                      setCollectedAmount(consumedQty * p);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('طريقة السداد', 'Payment Method')}
                  </label>
                  <select
                    value={paymentMethodName}
                    onChange={(e) => setPaymentMethodName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    {paymentMethods
                      .filter((pm) => !pm.isArchived)
                      .map((pm) => (
                        <option key={pm.id} value={pm.nameAr}>
                          {pm.nameAr}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('المبلغ المحصل الفعلي', 'Collected')}
                  </label>
                  <input
                    type="number"
                    value={collectedAmount}
                    onChange={(e) => setCollectedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold text-emerald-600 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('جهاز الليزر (إن وجد)', 'Laser Device')}
                </label>
                <select
                  value={laserDevice}
                  onChange={(e) => setLaserDevice(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="">{t('بدون جهاز ليزر', 'None')}</option>
                  {laserDevices.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} {d.room ? `(${d.room})` : ''} - {d.status === 'Active' ? 'جاهز' : 'صيانة'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  {t('إضافة الحركة للشيفت', 'Add Entry')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Shift Report Modal */}
      {showPrintShiftModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                  <Printer className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {t('تقرير وحركات شيفت التشغيل', 'Shift Run-sheet & Operations Report')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeShift.shiftNumber} • {activeShift.shiftDate} • {activeShift.receptionistName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>{t('طباعة الآن', 'Print Now')}</span>
                </button>
                <button
                  onClick={() => setShowPrintShiftModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('إغلاق', 'Close')}
                </button>
              </div>
            </div>

            {/* Shift Financial Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-[11px] text-slate-500 block">{t('إجمالي إيراد الخدمات', 'Gross Revenue')}</span>
                <span className="text-sm font-black text-slate-900 dark:text-white mt-1 block">
                  {formatMoney(activeShift.totalRevenue)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                <span className="text-[11px] text-emerald-600 block">{t('المحصل الفعلي', 'Total Collected')}</span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
                  {formatMoney(activeShift.totalCollected)}
                </span>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                <span className="text-[11px] text-rose-600 block">{t('المصروفات المنصرفة', 'Total Expenses')}</span>
                <span className="text-sm font-black text-rose-700 dark:text-rose-300 mt-1 block">
                  {formatMoney(activeShift.totalExpenses)}
                </span>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center">
                <span className="text-[11px] text-indigo-600 block">{t('صافي الكاش المتبقي', 'Net Shift Cash')}</span>
                <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-1 block">
                  {formatMoney(activeShift.netShiftCash)}
                </span>
              </div>
            </div>

            {/* Run-sheet Table */}
            <div className="space-y-2 mb-6">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                <span>{t('جدول حركات التشغيل والخدمات المنفذة للمرضى', 'Patient Run Movements & Services')}</span>
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left rtl:text-right">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5 text-indigo-700 dark:text-indigo-300">{t('اسم المريض / العميل', 'Patient Name')}</th>
                      <th className="p-2.5">{t('الطبيب / التكنيشن', 'Doctor / Staff')}</th>
                      <th className="p-2.5">{t('الخدمة / الجلسة', 'Service')}</th>
                      <th className="p-2.5">{t('النبضات', 'Pulses')}</th>
                      <th className="p-2.5">{t('الكمية', 'Qty')}</th>
                      <th className="p-2.5">{t('الإيراد', 'Total Rev')}</th>
                      <th className="p-2.5">{t('طريقة السداد', 'Payment Method')}</th>
                      <th className="p-2.5">{t('المحصل', 'Collected')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeShift.runRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          <div>{row.patientName || row.customerName || t('عميل / مريض نقدي', 'Cash Patient')}</div>
                          {row.systemCode && (
                            <div className="text-[10px] text-slate-400 font-mono">{row.systemCode}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          <div>{row.doctorName || '-'}</div>
                          {row.technicianName && <div className="text-[10px] text-slate-400">تك: {row.technicianName}</div>}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{row.serviceName}</td>
                        <td className="p-2.5 text-amber-600 font-bold">{row.pulsesCount ? `${row.pulsesCount} ن` : '-'}</td>
                        <td className="p-2.5">{row.consumedQuantity}</td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{formatMoney(row.totalRevenue)}</td>
                        <td className="p-2.5 text-indigo-600 font-semibold">{row.paymentMethod}</td>
                        <td className="p-2.5 font-bold text-emerald-600">{formatMoney(row.collectedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses & Balancing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-rose-500" />
                  <span>{t('المصروفات المنصرفة بالشيفت', 'Shift Expenses')}</span>
                </h4>
                {activeShift.expenses.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('لا توجد مصروفات مسجلة بالشيفت', 'No expenses recorded.')}</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {activeShift.expenses.map((exp) => (
                      <div key={exp.id} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                            <span>{exp.description || exp.reason}</span>
                            {exp.supplierName && (
                              <span className="rounded bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                🏷️ مورد: {exp.supplierName}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{exp.category} • {exp.disbursementMethod}</div>
                        </div>
                        <span className="font-bold text-rose-600">{formatMoney(exp.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" />
                  <span>{t('تسوية وسائل الدفع والأرصدة الختامية', 'Payment Balancing')}</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  {activeShift.balancing.map((b) => (
                    <div key={b.paymentMethodId} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{b.paymentMethodName}</span>
                      <span className="font-bold text-indigo-600">{formatMoney(b.closingBalance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('تسجيل مصروف جديد من نقدية الشيفت', 'Add Shift Expense')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t('خصم المصروف من نقدية الشيفت وربطه بحسابات المورد وشجرة الحسابات', 'Disburse from shift float and link to supplier & GL')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddExpenseModal(false);
                  setIsSupplierDropdownOpen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4">
              {/* Supplier Selection (Mandatory Searchable Dropdown - Default: Cash Supplier) */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span className="text-rose-600 font-black ml-1">*</span>
                    {t('اسم المورد المكود (إجباري)', 'Coded Supplier Name (Mandatory)')}
                  </label>
                  {supplierName !== 'مورد كاش (نقدي)' && (
                    <button
                      type="button"
                      onClick={() => {
                        const cashSup = defaultCashSupplier || { id: 'party-s-cash', name: 'مورد كاش (نقدي)' };
                        setSupplierId(cashSup.id);
                        setSupplierName(cashSup.name);
                        setSupplierSearchTerm('');
                        setIsSupplierDropdownOpen(false);
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      {t('إعادة تعيين إلى مورد كاش (نقدي)', 'Reset to Cash Supplier')}
                    </button>
                  )}
                </div>

                {/* Selected Supplier Display / Trigger */}
                <div className="relative">
                  <div
                    onClick={() => setIsSupplierDropdownOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-500 transition-colors"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {supplierName || t('-- اضغط للبحث واختيار المورد --', '-- Click to select supplier --')}
                      </span>
                      {supplierName.includes('كاش') && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded">
                          {t('افتراضي (كاش)', 'Default (Cash)')}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isSupplierDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Dropdown Menu with Search */}
                  {isSupplierDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          autoFocus
                          value={supplierSearchTerm}
                          onChange={(e) => setSupplierSearchTerm(e.target.value)}
                          placeholder={t('ابحث بالاسم، الكود، أو رقم الهاتف...', 'Search by name, code or phone...')}
                          className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 text-slate-900 dark:text-white"
                        />
                        {supplierSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setSupplierSearchTerm('')}
                            className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/50">
                        {filteredSuppliers.length === 0 ? (
                          <div className="py-3 text-center text-xs text-slate-400">
                            {t('لا توجد نتائج مطابقة لبحثك', 'No matching suppliers found')}
                          </div>
                        ) : (
                          filteredSuppliers.map((sup) => {
                            const isSelected = sup.id === supplierId || sup.name === supplierName;
                            return (
                              <button
                                key={sup.id}
                                type="button"
                                onClick={() => {
                                  setSupplierId(sup.id);
                                  setSupplierName(sup.name);
                                  setIsSupplierDropdownOpen(false);
                                  setSupplierSearchTerm('');
                                  if (!expenseReason || expenseReason.startsWith('سداد دفعة للمورد:')) {
                                    if (sup.name !== 'مورد كاش (نقدي)') {
                                      setExpenseReason(`سداد دفعة للمورد: ${sup.name}`);
                                    } else {
                                      setExpenseReason('');
                                    }
                                  }
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-right rtl:text-right ltr:text-left transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                                    {sup.name}
                                    {sup.phone ? <span className="text-[10px] text-slate-400 font-normal mr-1.5">({sup.phone})</span> : null}
                                  </div>
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500">
                                  {t('الرصيد:', 'Bal:')} <span className={sup.balance > 0 ? 'text-amber-600 font-bold' : 'text-slate-600'}>{formatMoney(sup.balance)}</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Supplier Balance Info */}
                {supplierId && (() => {
                  const selSup = suppliersList.find((p) => p.id === supplierId);
                  if (!selSup) return null;
                  return (
                    <div className="flex justify-between items-center text-[11px] bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      <span>{t('الرصيد الدفتري الحالي للمورد:', 'Current balance:')}</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatMoney(selSup.balance)}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Category and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('بند المصروف', 'Category')}
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold focus:outline-indigo-600"
                  >
                    <option value="مشتريات ضيافة وعيادة">مشتريات ضيافة وعيادة</option>
                    <option value="مستلزمات طبية سريعة">مستلزمات طبية سريعة</option>
                    <option value="سداد دفعات ومستلزمات موردين">سداد دفعات ومستلزمات موردين</option>
                    <option value="صيانة ونظافة">صيانة ونظافة</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('تاريخ المصروف', 'Date')}
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-rose-600 font-black ml-1">*</span>
                  {t('المبلغ (ج.م) *', 'Amount (EGP) *')}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={expenseAmount || ''}
                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs font-bold text-rose-600 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              {/* Reason / Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-rose-600 font-black ml-1">*</span>
                  {t('البيان وسبب الصرف *', 'Reason & Description *')}
                </label>
                <input
                  type="text"
                  required
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  placeholder={
                    supplierName && supplierName !== 'مورد كاش (نقدي)'
                      ? `سداد دفعة للمورد: ${supplierName}`
                      : 'مثال: شراء شاي وسكر ومستلزمات نظافة...'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              {/* Disbursement Method (Dropdown from Registered Payment Methods) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-rose-600 font-black ml-1">*</span>
                  {t('جهة وطريقة الصرف (من طرق التحصيل والسداد المسجلة)', 'Disbursement Method (Registered Payment Methods)')}
                </label>
                <select
                  value={expenseMethod}
                  required
                  onChange={(e) => setExpenseMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 text-slate-900 dark:text-white"
                >
                  {paymentMethods
                    .filter((pm) => !pm.isArchived)
                    .map((pm) => {
                      const linkedAcc = accounts.find((a) => a.id === pm.linkedAccountId);
                      const accLabel = linkedAcc ? ` (${linkedAcc.code} - ${linkedAcc.nameAr})` : '';
                      return (
                        <option key={pm.id} value={pm.nameAr}>
                          {pm.nameAr}
                          {pm.isDefault ? ` [${t('افتراضي', 'Default')}]` : ''}
                          {accLabel}
                        </option>
                      );
                    })}
                </select>
                {/* Visual indicator of the linked GL account */}
                {(() => {
                  const selPM = paymentMethods.find((pm) => pm.nameAr === expenseMethod);
                  const linkedAcc = selPM ? accounts.find((a) => a.id === selPM.linkedAccountId) : null;
                  if (linkedAcc) {
                    return (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <span>{t('الحساب الدائن المتأثر في شجرة الحسابات:', 'Linked Credit GL Account:')}</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                          {linkedAcc.code} - {linkedAcc.nameAr}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExpenseModal(false);
                    setIsSupplierDropdownOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-md shadow-rose-600/20"
                >
                  {t('صرف المصروف', 'Disburse Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
