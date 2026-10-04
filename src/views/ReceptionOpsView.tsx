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
  CheckCircle2,
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
  ShoppingBag,
} from 'lucide-react';
import {
  ExcelDataTransferModal,
  ExcelColumnConfig,
  CellValidationError,
  ExcelValidationResult,
} from '../components/ExcelDataTransferModal';

const sessionPulsesExcelColumns: ExcelColumnConfig[] = [
  {
    key: 'customerName',
    labelAr: 'اسم العميل / المريض',
    labelEn: 'Customer / Patient Name',
    required: true,
    type: 'text',
    sampleValue: 'ندى عادل مصطفى',
    instructions: 'الاسم الكامل للعميل أو المريض متلقي الجلسة',
  },
  {
    key: 'patientPhone',
    labelAr: 'رقم الهاتف',
    labelEn: 'Phone',
    required: false,
    type: 'phone',
    sampleValue: '01123456789',
    instructions: 'رقم هاتف العميل لمطابقة ملف المريض والتواصل',
  },
  {
    key: 'serviceName',
    labelAr: 'الخدمة / الجلسة',
    labelEn: 'Service / Session Name',
    required: true,
    type: 'text',
    sampleValue: 'جلسة ليزر ساقين وبكيني',
    instructions: 'نوع الجلسة أو الخدمة المؤداة في الشيفت',
  },
  {
    key: 'laserDevice',
    labelAr: 'جهاز الليزر المستخدم',
    labelEn: 'Laser Device Used',
    required: false,
    type: 'text',
    sampleValue: 'كانديلا برو ماكس GentleMax',
    instructions: 'اسم جهاز الليزر المستخدم لتحديث عداد نبضاته',
  },
  {
    key: 'pulsesCount',
    labelAr: 'عدد البلصات المستهلكة (النبضات)',
    labelEn: 'Consumed Pulses Count',
    required: true,
    type: 'number',
    sampleValue: 850,
    instructions: 'عدد نبضات الليزر المستهلكة في هذه الجلسة (رقم موجب أو 0)',
  },
  {
    key: 'totalRevenue',
    labelAr: 'المبلغ المطلوب / الإيراد',
    labelEn: 'Total Revenue',
    required: true,
    type: 'number',
    sampleValue: 750,
    instructions: 'إجمالي قيمة الجلسة بالجنيه (رقم موجب أكبر من 0)',
  },
  {
    key: 'collectedAmount',
    labelAr: 'المبلغ المحصل نقداً / إلكترونياً',
    labelEn: 'Collected Amount',
    required: true,
    type: 'number',
    sampleValue: 750,
    instructions: 'المبلغ المحصل بالفعل وتوريده لخزينة الشيفت',
  },
  {
    key: 'paymentMethod',
    labelAr: 'طريقة السداد',
    labelEn: 'Payment Method',
    required: true,
    type: 'select',
    options: ['نقداً (كاش)', 'فيزا / بطاقة بنكية', 'فودافون كاش', 'إنستاباي', 'تحويل بنكي'],
    sampleValue: 'نقداً (كاش)',
    instructions: 'طريقة السداد المتبعة في تحصيل قيمة الجلسة',
  },
  {
    key: 'doctorName',
    labelAr: 'الطبيب / الإخصائي المعالج',
    labelEn: 'Doctor / Specialist',
    required: false,
    type: 'text',
    sampleValue: 'د. ياسمين خالد',
    instructions: 'اسم الطبيب أو الإخصائية المنفذة للجلسة',
  },
  {
    key: 'date',
    labelAr: 'تاريخ الجلسة',
    labelEn: 'Session Date',
    required: true,
    type: 'date',
    sampleValue: '2026-10-01',
    instructions: 'تاريخ تنفيذ الجلسة واستهلاك البلصات (YYYY-MM-DD)',
  },
  {
    key: 'notes',
    labelAr: 'ملاحظات الجلسة والنبضات',
    labelEn: 'Notes',
    required: false,
    type: 'text',
    sampleValue: 'جلسة إعادة ليزر سريعة',
    instructions: 'أي ملاحظات تشغيلية أو طبية مدونة مع الجلسة',
  },
];

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
    canPerformAction,
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
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Open Shift Form
  const [openShiftReceptionist, setOpenShiftReceptionist] = useState(currentUser?.name || '');
  const [openShiftNotes, setOpenShiftNotes] = useState('');

  // Close Shift Form & Z-Report Reconciliation
  const [closeShiftNotes, setCloseShiftNotes] = useState('');
  const [actualCashCount, setActualCashCount] = useState<number>(0);
  const [transferredToMainTreasury, setTransferredToMainTreasury] = useState<boolean>(true);

  // Add Run Row Form
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [roomNumber, setRoomNumber] = useState('غرفة 1 (الليزر)');
  const [serviceId, setServiceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [pulsesCount, setPulsesCount] = useState<number>(0);
  const [consumedQty, setConsumedQty] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [paymentMethodName, setPaymentMethodName] = useState(paymentMethods[0]?.nameAr || 'نقداً (كاش)');
  const [collectedAmount, setCollectedAmount] = useState(0);
  const [laserDevice, setLaserDevice] = useState(laserDevices[0]?.name || '');
  const [notes, setNotes] = useState('');

  // Inline Editing State for Shift Run Table
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<Partial<ShiftRunRow>>({});

  // Expense Form State
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseTransactionType, setExpenseTransactionType] = useState<'receipt_and_payment' | 'receipt_only' | 'balance_payment'>('receipt_and_payment');
  const [expenseItemId, setExpenseItemId] = useState('');
  const [expenseItemName, setExpenseItemName] = useState('');
  const [expenseQty, setExpenseQty] = useState<number>(1);
  const [expenseUnitPrice, setExpenseUnitPrice] = useState<number>(0);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseMethod, setExpenseMethod] = useState('الخزينة الرئيسية (نقداً)');
  const [expenseDate, setExpenseDate] = useState(todayIso);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [expenseItemRows, setExpenseItemRows] = useState<Array<{
    id: string;
    itemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>>([]);

  // Filter warehouse/stock items only (البنود المخزنية المضافة للمخزن فقط)
  const stockItems = React.useMemo(() => {
    return products.filter(
      (p) => p.isStockItem || p.itemType === 'stock_raw' || p.itemType === 'consumable' || p.itemType === 'medical_supply'
    );
  }, [products]);

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

  // Filter customers only (without suppliers) and strictly coded in the active branch
  const branchCustomers = React.useMemo(() => {
    const currentBranchId = activeBranch?.id || activeShift?.branchId || (branches.length > 0 ? branches[0].id : 'branch-cairo');
    return parties.filter((p) => {
      // 1. Must be a Customer (not Supplier only)
      const isCustomer = p.type === 'Customer' || p.type === 'Both';
      if (!isCustomer) return false;

      // 2. Must be coded in active branch
      if (currentBranchId) {
        const matchesBranch =
          p.branchId === currentBranchId ||
          (activeBranch?.name && p.branchId === activeBranch.name) ||
          (activeBranch?.code && p.branchId === activeBranch.code) ||
          (Array.isArray(p.branchIds) && (p.branchIds.includes(currentBranchId) || (activeBranch?.name && p.branchIds.includes(activeBranch.name)))) ||
          (!p.branchId && (!p.branchIds || p.branchIds.length === 0) && currentBranchId === (branches[0]?.id || 'branch-cairo'));
        return Boolean(matchesBranch);
      }
      return true;
    });
  }, [parties, activeBranch?.id, activeBranch?.name, activeBranch?.code, activeShift?.branchId, branches]);

  // Filter Service Providers strictly: active branch and isServiceProvider === true (مؤدى الخدمة للفرع المفعل فقط)
  const branchServiceProviders = React.useMemo(() => {
    const currentBranchId = activeBranch?.id || activeShift?.branchId || (branches.length > 0 ? branches[0].id : 'branch-cairo');
    return staffMembers.filter((s) => {
      if (!s.isActive || s.isArchived) return false;
      // Must be marked as service provider (مؤدى خدمة فقط)
      if (s.isServiceProvider !== true) return false;

      // Must be linked to active branch
      if (currentBranchId) {
        const matchesBranch =
          s.branchId === currentBranchId ||
          (activeBranch?.name && s.branchId === activeBranch.name) ||
          (activeBranch?.code && s.branchId === activeBranch.code) ||
          (Array.isArray(s.branchIds) && (s.branchIds.includes(currentBranchId) || (activeBranch?.name && s.branchIds.includes(activeBranch.name))));
        return Boolean(matchesBranch);
      }
      return true;
    });
  }, [staffMembers, activeBranch, activeShift?.branchId, branches]);

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

    setExpenseTransactionType('receipt_and_payment');
    const firstStockItem = stockItems[0];
    if (firstStockItem) {
      const name = language === 'ar' ? firstStockItem.nameAr : firstStockItem.nameEn;
      const cost = firstStockItem.purchasePrice || 0;
      setExpenseItemId(firstStockItem.id);
      setExpenseItemName(name);
      setExpenseCategory(name);
      setExpenseUnitPrice(cost);
      setExpenseQty(1);
      setExpenseAmount(cost * 1);
      setExpenseItemRows([
        {
          id: `exp-row-${Date.now()}-1`,
          itemId: firstStockItem.id,
          itemName: name,
          quantity: 1,
          unitPrice: cost,
          amount: cost,
        },
      ]);
    } else {
      setExpenseItemId('');
      setExpenseItemName('');
      setExpenseCategory('مستلزمات وبنود مخزنية');
      setExpenseUnitPrice(0);
      setExpenseQty(1);
      setExpenseAmount(0);
      setExpenseItemRows([
        {
          id: `exp-row-${Date.now()}-1`,
          itemId: '',
          itemName: '',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
        },
      ]);
    }

    setExpenseReason('');
    setExpenseDate(todayIso);
    setShowAddExpenseModal(true);
  };

  const handleAddExpenseItemRow = () => {
    const firstStockItem = stockItems[0];
    const name = firstStockItem ? (language === 'ar' ? firstStockItem.nameAr : firstStockItem.nameEn) : '';
    const cost = firstStockItem ? (firstStockItem.purchasePrice || 0) : 0;
    setExpenseItemRows((prev) => [
      ...prev,
      {
        id: `exp-row-${Date.now()}-${prev.length + 1}`,
        itemId: firstStockItem ? firstStockItem.id : '',
        itemName: name,
        quantity: 1,
        unitPrice: cost,
        amount: cost,
      },
    ]);
  };

  const handleUpdateExpenseItemRow = (
    rowId: string,
    updates: Partial<{ itemId: string; itemName: string; quantity: number; unitPrice: number; amount: number }>
  ) => {
    setExpenseItemRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const next = { ...r, ...updates };
        if (updates.itemId !== undefined) {
          const itm = stockItems.find((p) => p.id === updates.itemId);
          if (itm) {
            next.itemName = language === 'ar' ? itm.nameAr : itm.nameEn;
            next.unitPrice = itm.purchasePrice || 0;
            next.amount = (next.quantity || 1) * (itm.purchasePrice || 0);
          } else {
            next.itemName = '';
            next.unitPrice = 0;
            next.amount = 0;
          }
        }
        if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
          const q = next.quantity ?? 1;
          const p = next.unitPrice ?? 0;
          next.amount = q * p;
        }
        return next;
      })
    );
  };

  const handleRemoveExpenseItemRow = (rowId: string) => {
    if (expenseItemRows.length <= 1) return;
    setExpenseItemRows((prev) => prev.filter((r) => r.id !== rowId));
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

  const cashAccount = (accounts || []).find((a) => a && a.code === '1111') || (accounts || []).find((a) => a && ((a.nameAr || '').includes('الخزينة') || (a.nameAr || '').includes('النقدية')));
  const cashAccountBalance = cashAccount ? (Number(cashAccount.balance) || 0) : 0;
  const [openShiftOpeningFloat, setOpenShiftOpeningFloat] = useState<number>(0);

  const handleOpenShiftSubmit = (e?: React.FormEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    try {
      openReceptionShift(
        openShiftReceptionist.trim() || currentUser?.name || 'موظف الاستقبال',
        openShiftNotes.trim(),
        activeBranch?.id,
        cashAccountBalance || 0
      );
      setShowOpenShiftModal(false);
      setOpenShiftNotes('');
    } catch (err) {
      console.error('Failed to open shift:', err);
      setShowOpenShiftModal(false);
    }
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeShift) {
      const cashBal = activeShift.balancing?.find(
        (b) =>
          b.paymentMethodName.includes('نقد') ||
          b.paymentMethodName.toLowerCase().includes('cash') ||
          b.paymentMethodId.toLowerCase().includes('cash') ||
          b.paymentMethodId === 'pm-01' ||
          b.paymentMethodId === 'pm-cash-1'
      ) || activeShift.balancing?.[0];

      const openFloat = activeShift.openingFloat ?? activeShift.initialBalance ?? (cashBal?.openingBalance || 0);
      const expected = activeShift.expectedCashInDrawer !== undefined
        ? activeShift.expectedCashInDrawer
        : cashBal?.closingBalance !== undefined
        ? cashBal.closingBalance
        : openFloat + (activeShift.cashCollected ?? cashBal?.totalCollected ?? 0) - (activeShift.cashExpenses ?? cashBal?.totalDisbursed ?? 0);

      closeReceptionShift(activeShift.id, {
        notes: closeShiftNotes,
        actualCashCount: Number(actualCashCount) || 0,
        openingFloat: openFloat,
        expectedCash: expected,
        transferredToMainTreasury,
      });
      setShowCloseShiftModal(false);
    }
  };

  const handleSelectService = (id: string) => {
    setServiceId(id);
    if (!id) {
      setServiceName('');
      setUnitPrice(0);
      setCollectedAmount(0);
      return;
    }
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setServiceName(language === 'ar' ? prod.nameAr : prod.nameEn);
      setUnitPrice(prod.sellingPrice);
      setCollectedAmount(prod.sellingPrice * (consumedQty ?? 0));
    } else {
      setServiceName('');
      setUnitPrice(0);
      setCollectedAmount(0);
    }
  };

  const handleSelectPatient = (id: string) => {
    setPatientId(id);
    const p = parties.find((party) => party.id === id);
    if (p) {
      setPatientName(p.name);
    } else {
      setPatientName('');
    }
  };

  const handleAddRunRowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    if (!patientId) {
      alert(t('يرجى اختيار العميل من القائمة أولاً!', 'Please select a client from the list first!'));
      return;
    }

    const selectedParty = parties.find((p) => p.id === patientId);
    const finalPatientName = selectedParty?.name || patientName.trim() || 'عميل نقدي';
    const doc = staffMembers.find((s) => s.id === doctorId);

    const qty = Number(consumedQty) > 0 ? Number(consumedQty) : 1;
    const price = Number(unitPrice) || 0;
    const rev = qty * price;
    const coll = collectedAmount !== undefined && collectedAmount !== null ? Number(collectedAmount) : rev;

    addShiftRunRow(activeShift.id, {
      customerId: selectedParty?.id || patientId,
      patientId: selectedParty?.id || patientId,
      systemCode: selectedParty?.systemCode,
      customerName: finalPatientName,
      patientName: finalPatientName,
      patientPhone: selectedParty?.phone,
      doctorId: doctorId || undefined,
      doctorName: doc ? doc.nameAr : undefined,
      serviceName: (serviceName && serviceName.trim()) ? serviceName.trim() : (pulsesCount > 0 ? 'جلسة ليزر' : 'جلسة تشغيل'),
      pulsesCount: pulsesCount > 0 ? pulsesCount : undefined,
      consumedQuantity: qty,
      unitPrice: price,
      totalRevenue: rev,
      paymentMethod: paymentMethodName,
      collectedAmount: coll,
      laserDevice: laserDevice || undefined,
      notes: notes.trim() || undefined,
    });

    // Reset Form
    setPatientId('');
    setPatientName('');
    setDoctorId('');
    setTechnicianId('');
    setServiceId('');
    setServiceName('');
    setConsumedQty(0);
    setUnitPrice(0);
    setCollectedAmount(0);
    setPulsesCount(0);
    setNotes('');
    setShowAddRowModal(false);
  };

  // Start inline editing of a run row
  const handleStartEditRow = (row: ShiftRunRow) => {
    setEditingRowId(row.id);
    setEditRowData({
      patientName: row.patientName || row.customerName || '',
      serviceName: row.serviceName || '',
      pulsesCount: row.pulsesCount,
      consumedQuantity: row.consumedQuantity ?? 0,
      unitPrice: row.unitPrice,
      laserDevice: row.laserDevice,
      paymentMethod: row.paymentMethod,
      collectedAmount: row.collectedAmount,
      notes: row.notes || '',
    });
  };

  // Save inline edit of run row
  const handleSaveEditRow = (rowId: string) => {
    if (!activeShift) return;
    const qty = editRowData.consumedQuantity ?? 0;
    const price = editRowData.unitPrice ?? 0;
    const rev = qty * price;
    const pName = editRowData.patientName || editRowData.customerName || 'عميل / مريض نقدي';

    updateShiftRunRow(activeShift.id, rowId, {
      ...editRowData,
      patientName: pName,
      customerName: pName,
      serviceName: editRowData.serviceName || '',
      consumedQuantity: qty,
      totalRevenue: rev,
      collectedAmount: editRowData.collectedAmount !== undefined ? editRowData.collectedAmount : rev,
      notes: editRowData.notes,
    });
    setEditingRowId(null);
    setEditRowData({});
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    if (!supplierName.trim()) {
      alert(t('برجاء اختيار اسم المورد أولاً (إجباري)', 'Please select a supplier name (mandatory)'));
      return;
    }

    const isBalancePay = expenseTransactionType === 'balance_payment';
    const isCreditReceipt = expenseTransactionType === 'receipt_only';

    const activePMs = paymentMethods.filter((pm) => !pm.isArchived);
    const resolvedMethod =
      expenseMethod ||
      activePMs.find((pm) => pm.isDefault)?.nameAr ||
      activePMs[0]?.nameAr ||
      'الخزينة الرئيسية (نقداً)';

    if (isBalancePay) {
      if (expenseAmount <= 0) {
        alert(t('يرجى إدخال مبلغ صحيح أكبر من الصفر لسداد المورد', 'Please enter a valid amount'));
        return;
      }
      const finalCategory = 'سداد دفعات ومستلزمات موردين';
      const defaultReason = `سداد دفعة للمورد: ${supplierName}`;
      const finalDesc = expenseReason.trim() || defaultReason;

      addShiftExpense(activeShift.id, {
        category: finalCategory,
        expenseType: 'balance_payment',
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
    } else {
      // Multi-item rows submission: save each item line as a separate expense
      const validRows = expenseItemRows.filter((r) => r.itemId && (r.amount > 0 || r.quantity > 0));
      if (validRows.length === 0) {
        alert(t('يرجى اختيار صنف واحد على الأقل وتحديد كمية وسعر صحيحين', 'Please select at least one item with valid quantity and price'));
        return;
      }

      validRows.forEach((row) => {
        const itemDesc = expenseReason.trim()
          ? `${expenseReason.trim()} (${row.itemName})`
          : isCreditReceipt
          ? `استلام أصناف آجل: ${row.itemName} (${supplierName})`
          : `استلام وسداد: ${row.itemName} (${supplierName})`;

        addShiftExpense(activeShift.id, {
          category: row.itemName || 'مستلزمات وبنود مخزنية',
          itemId: row.itemId,
          itemName: row.itemName,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          expenseType: expenseTransactionType,
          amount: row.amount,
          reason: itemDesc,
          description: itemDesc,
          disbursementMethod: isCreditReceipt ? 'آجل (حساب المورد)' : resolvedMethod,
          disbursedBy: currentUser?.name || 'الريسيبشن',
          date: expenseDate,
          timestamp: expenseDate
            ? `${expenseDate}T${new Date().toTimeString().split(' ')[0]}`
            : new Date().toISOString(),
          supplierId: supplierId || undefined,
          supplierName: supplierName || undefined,
        });
      });
    }

    setExpenseAmount(0);
    setExpenseReason('');
    setSupplierId('');
    setSupplierName('');
    setSupplierSearchTerm('');
    setIsSupplierDropdownOpen(false);
    setShowAddExpenseModal(false);
  };

  const handleSaveManualNotes = () => {
    if (activeShift && manualNotes.trim()) {
      updateShiftNotes(activeShift.id, manualNotes.trim(), activeShift.receptionistName);
      setManualNotes('');
      setNotesSavedAlert(true);
      setTimeout(() => setNotesSavedAlert(false), 3000);
    }
  };

  // Calculate Table Aggregate Totals for Run-Sheet
  const totalPulsesCount = activeShift?.runRows.reduce((sum, r) => sum + (r.pulsesCount || 0), 0) || 0;
  const totalConsumedQty = activeShift?.runRows.reduce((sum, r) => sum + (r.consumedQuantity || 0), 0) || 0;
  const totalRunRevenue = activeShift?.runRows.reduce((sum, r) => sum + (r.totalRevenue || 0), 0) || 0;
  const totalRunCollected = activeShift?.runRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0) || 0;

  // Excel Import Validator & Handler for Shift Sessions & Consumed Pulses
  const validateSessionPulsesRows = (rawRows: any[]): ExcelValidationResult<any> => {
    const errors: CellValidationError[] = [];
    const validRows: any[] = [];
    const allowedPaymentMethods = [
      'نقداً (كاش)',
      'فيزا / بطاقة بنكية',
      'فودافون كاش',
      'إنستاباي',
      'تحويل بنكي',
    ];

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2;

      const customerName = String(
        row['اسم العميل / المريض'] || row['اسم العميل'] || row['المريض'] || row.customerName || ''
      ).trim();

      const patientPhone = String(
        row['رقم الهاتف'] || row['الهاتف'] || row['الموبايل'] || row.patientPhone || row.phone || ''
      ).trim();

      const serviceName = String(
        row['الخدمة / الجلسة'] || row['الخدمة'] || row['نوع الجلسة'] || row.serviceName || ''
      ).trim();

      const laserDeviceUsed = String(
        row['جهاز الليزر المستخدم'] || row['جهاز الليزر'] || row['الجهاز'] || row.laserDevice || ''
      ).trim();

      const pulsesRaw =
        row['عدد البلصات المستهلكة (النبضات)'] ??
        row['عدد البلصات'] ??
        row['البلصات'] ??
        row.pulsesCount ??
        0;
      const pulsesNum = Number(pulsesRaw);

      const totalRevenueRaw =
        row['المبلغ المطلوب / الإيراد'] ??
        row['المبلغ المطلوب'] ??
        row['الإيراد'] ??
        row.totalRevenue ??
        0;
      const totalRevenueNum = Number(totalRevenueRaw);

      const collectedRaw =
        row['المبلغ المحصل نقداً / إلكترونياً'] ??
        row['المبلغ المحصل'] ??
        row.collectedAmount ??
        totalRevenueNum;
      const collectedNum = Number(collectedRaw);

      const paymentMethodRaw = String(
        row['طريقة السداد'] || row['طريقة الدفع'] || row.paymentMethod || 'نقداً (كاش)'
      ).trim();

      const doctorName = String(
        row['الطبيب / الإخصائي المعالج'] || row['الطبيب'] || row['الإخصائي'] || row.doctorName || ''
      ).trim();

      const dateRaw = String(
        row['تاريخ الجلسة'] || row['التاريخ'] || row.date || ''
      ).trim();

      const notes = String(
        row['ملاحظات الجلسة والنبضات'] || row['ملاحظات'] || row.notes || ''
      ).trim();

      // 1. Validation for Customer Name
      if (!customerName) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'customerName',
          columnLabelAr: 'اسم العميل / المريض',
          enteredValue: row['اسم العميل / المريض'] || '',
          reasonAr: 'اسم العميل أو المريض إلزامي في قاعدة البيانات ولا يمكن تركه فارغاً',
        });
      }

      // 2. Validation for Service Name
      if (!serviceName) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'serviceName',
          columnLabelAr: 'الخدمة / الجلسة',
          enteredValue: row['الخدمة / الجلسة'] || '',
          reasonAr: 'بيان الخدمة أو الجلسة إلزامي لتسجيل حركة التشغيل',
        });
      }

      // 3. Validation for Pulses Count
      if (isNaN(pulsesNum) || pulsesNum < 0) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'pulsesCount',
          columnLabelAr: 'عدد البلصات المستهلكة (النبضات)',
          enteredValue: pulsesRaw,
          reasonAr: 'عدد البلصات يجب أن يكون رقماً صحيحاً يساوي 0 أو أكثر',
        });
      }

      // 4. Validation for Total Revenue
      if (isNaN(totalRevenueNum) || totalRevenueNum <= 0) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'totalRevenue',
          columnLabelAr: 'المبلغ المطلوب / الإيراد',
          enteredValue: totalRevenueRaw,
          reasonAr: 'قيمة الإيراد يجب أن تكون رقماً موجباً أكبر من الصفر (بالجنيه)',
        });
      }

      // 5. Validation for Date
      let cleanDate = dateRaw;
      if (!cleanDate) {
        cleanDate = todayIso;
      } else {
        const parsed = new Date(cleanDate);
        if (isNaN(parsed.getTime())) {
          errors.push({
            rowNumber: rowNum,
            columnKey: 'date',
            columnLabelAr: 'تاريخ الجلسة',
            enteredValue: dateRaw,
            reasonAr: 'تاريخ الجلسة غير صالح. الصيغة المعتمدة بالداتا بيز هي YYYY-MM-DD',
          });
        } else {
          cleanDate = parsed.toISOString().split('T')[0];
        }
      }

      const matchedMethod = allowedPaymentMethods.find(
        (m) => m === paymentMethodRaw || paymentMethodRaw.includes(m) || m.includes(paymentMethodRaw)
      );

      validRows.push({
        customerName,
        patientPhone,
        serviceName,
        laserDevice: laserDeviceUsed || (laserDevices[0]?.name || 'جهاز ليزر رئيسي'),
        pulsesCount: isNaN(pulsesNum) ? 0 : pulsesNum,
        totalRevenue: isNaN(totalRevenueNum) ? 0 : totalRevenueNum,
        collectedAmount: isNaN(collectedNum) ? totalRevenueNum : collectedNum,
        paymentMethod: matchedMethod || 'نقداً (كاش)',
        doctorName: doctorName || (currentUser?.name || 'الاستقبال'),
        date: cleanDate,
        notes,
      });
    });

    return {
      totalRows: rawRows.length,
      errors,
      validRows: errors.length === 0 ? validRows : [],
    };
  };

  const handleConfirmSessionPulsesImport = (validRows: any[]) => {
    if (!activeShift) {
      alert(t('يجب فتح شيفت تشغيل أولاً لإدراج حركات الجلسات والبلصات فيه لحظياً!', 'Please open an active shift first to append session run rows!'));
      return;
    }

    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = dayNames[new Date().getDay()] || 'اليوم';

    validRows.forEach((row, idx) => {
      addShiftRunRow(activeShift.id, {
        date: row.date,
        dayName,
        customerId: `cust-imp-${Date.now()}-${idx}`,
        patientId: `cust-imp-${Date.now()}-${idx}`,
        systemCode: `CUST-IMP-${idx + 1}`,
        customerName: row.customerName,
        patientName: row.customerName,
        patientPhone: row.patientPhone,
        roomNumber: 'غرفة 1 (الليزر)',
        serviceName: row.serviceName,
        pulsesCount: row.pulsesCount > 0 ? row.pulsesCount : undefined,
        consumedQuantity: 1,
        unitPrice: row.totalRevenue,
        totalRevenue: row.totalRevenue,
        paymentMethod: row.paymentMethod,
        collectedAmount: row.collectedAmount,
        laserDevice: row.laserDevice,
        doctorName: row.doctorName,
        notes: row.notes ? `استيراد إكسيل - ${row.notes}` : 'استيراد جلسات وبلصات من إكسيل',
      });
    });

    alert(t(`تم استيراد ${validRows.length} جلسة بنجاح وتحديث عدادات البلصات وخزينة الشيفت!`, `Imported ${validRows.length} sessions successfully!`));
  };

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
                  {t('شاشة التشغيل', 'Operations Run-Sheet')}
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowExcelModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all cursor-pointer shadow-xs"
              title={t('استيراد وتصدير بيانات الجلسات والبلصات المستهلكة وفحص الأخطاء', 'Import & Export Shift Sessions & Pulses Excel')}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>{t('استيراد وتصدير الجلسات والبلصات (إكسل)', 'Sessions & Pulses Excel')}</span>
            </button>

            {!activeShift ? (
              canPerformAction('reception_ops.open_shift') && (
                <button
                  onClick={() => {
                    setOpenShiftReceptionist(currentUser?.name || 'موظف الاستقبال');
                    setOpenShiftNotes('');
                    setShowOpenShiftModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>{t('فتح شيفت تشغيل جديد', 'Open New Shift')}</span>
                </button>
              )
            ) : (
              <>
                {canPerformAction('reception_ops.add_run_row') && (
                  <button
                    onClick={() => {
                      setPatientId('');
                      setPatientName('');
                      setDoctorId('');
                      setTechnicianId('');
                      setConsumedQty(1);
                      setServiceId('');
                      setServiceName('');
                      setUnitPrice(0);
                      setCollectedAmount(0);
                      setPulsesCount(0);
                      setNotes('');
                      setShowAddRowModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('إضافة حركة تشغيل', 'Add Operation Entry')}</span>
                  </button>
                )}

                {canPerformAction('reception_ops.print_shift') && (
                  <button
                    onClick={() => setShowPrintShiftModal(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                    title={t('طباعة ومعاينة تقرير الشيفت', 'Print Shift Report')}
                  >
                    <Printer className="h-4 w-4 text-indigo-600" />
                    <span>{t('طباعة تقرير الشيفت', 'Print Shift')}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const cashBal = activeShift.balancing?.find(
                      (b) =>
                        b.paymentMethodName.includes('نقد') ||
                        b.paymentMethodName.toLowerCase().includes('cash') ||
                        b.paymentMethodId.toLowerCase().includes('cash') ||
                        b.paymentMethodId === 'pm-01' ||
                        b.paymentMethodId === 'pm-cash-1'
                    ) || activeShift.balancing?.[0];

                    const openFloat = activeShift.openingFloat ?? activeShift.initialBalance ?? (cashBal?.openingBalance || 0);
                    const expected = activeShift.expectedCashInDrawer !== undefined
                      ? activeShift.expectedCashInDrawer
                      : cashBal?.closingBalance !== undefined
                      ? cashBal.closingBalance
                      : openFloat + (activeShift.cashCollected ?? cashBal?.totalCollected ?? 0) - (activeShift.cashExpenses ?? cashBal?.totalDisbursed ?? 0);

                    setActualCashCount(expected);
                    setShowCloseShiftModal(true);
                  }}
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

      {/* 2. Shift Operating Totals & Summary Cards (Placed ABOVE the Run-Sheet Table as Requested) */}
      {activeShift && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 block">{t('إجمالي إيراد الخدمات', 'Gross Revenue')}</span>
            <span className="text-base font-black text-slate-900 dark:text-white mt-1 block">
              {formatMoney(activeShift.totalRevenue)}
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800/40 shadow-xs">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">{t('إجمالي المحصل الفعلي', 'Total Collected')}</span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
              {formatMoney(activeShift.totalCollected)}
            </span>
          </div>

          <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-800/40 shadow-xs">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">{t('المصروفات المنصرفة', 'Total Expenses')}</span>
            <span className="text-base font-black text-rose-700 dark:text-rose-300 mt-1 block">
              {formatMoney(activeShift.totalExpenses)}
            </span>
          </div>

          <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 shadow-xs">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block">{t('صافي نقدية الشيفت', 'Net Cash in Shift')}</span>
            <span className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-1 block">
              {formatMoney(activeShift.netShiftCash)}
            </span>
          </div>

          <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-800/40 shadow-xs">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">{t('إجمالي النبضات', 'Total Pulses')}</span>
            <span className="text-base font-black text-amber-700 dark:text-amber-300 mt-1 block">
              {totalPulsesCount.toLocaleString()} {t('نبضة', 'p')}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">{t('عدد الحركات المنفذة', 'Total Entries')}</span>
            <span className="text-base font-black text-slate-900 dark:text-white mt-1 block">
              {activeShift.runRows.length} {t('حركة', 'rows')}
            </span>
          </div>
        </div>
      )}

      {/* 3. Main Shift Run-Sheet Table (With Inline Editing & Room Column Removed) */}
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{t('المريض / العميل', 'Patient / Client')}</th>
                  <th className="p-3">{t('الطبيب / التكنيشن', 'Doctor / Technician')}</th>
                  <th className="p-3">{t('الخدمة / الجلسة', 'Service / Session')}</th>
                  {/* Pulse Count Column BEFORE Quantity */}
                  <th className="p-3">{t('عدد النبضات', 'Pulse Count')}</th>
                  <th className="p-3">{t('الكمية', 'Qty')}</th>
                  <th className="p-3">{t('السعر', 'Unit Price')}</th>
                  <th className="p-3">{t('الإيراد', 'Total Revenue')}</th>
                  <th className="p-3">{t('طريقة السداد', 'Payment Method')}</th>
                  <th className="p-3">{t('المحصل', 'Collected')}</th>
                  <th className="p-3">{t('جهاز الليزر', 'Laser Device')}</th>
                  <th className="p-3">{t('الملاحظات', 'Notes')}</th>
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
                        + {t('إضافة حركة تشغيل', 'Add Operation Entry')}
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

                        {/* Service Name (Editable) */}
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRowData.serviceName || ''}
                              onChange={(e) => setEditRowData({ ...editRowData, serviceName: e.target.value })}
                              placeholder={t('بدون خدمة (فارغ)', 'Empty')}
                              className="w-36 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800"
                            />
                          ) : (
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {row.serviceName && row.serviceName.trim() ? row.serviceName : ''}
                            </span>
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
                              min="0"
                              value={editRowData.consumedQuantity ?? 0}
                              onChange={(e) => setEditRowData({ ...editRowData, consumedQuantity: Number(e.target.value) })}
                              className="w-16 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800 font-bold"
                            />
                          ) : (
                            <span className="font-bold">{row.consumedQuantity ?? 0}</span>
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

                        {/* Laser Device (Editable - only coded laser devices allowed) */}
                        <td className="p-3">
                          {(() => {
                            const matchedDevice = laserDevices.find(
                              (d) =>
                                row.laserDevice &&
                                (d.name.trim().toLowerCase() === row.laserDevice.trim().toLowerCase() || d.id === row.laserDevice)
                            );
                            if (isEditing) {
                              return (
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
                              );
                            }
                            if (matchedDevice) {
                              return (
                                <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                  <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  <span>{matchedDevice.name}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>

                        {/* Notes Column */}
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editRowData.notes || ''}
                              onChange={(e) => setEditRowData({ ...editRowData, notes: e.target.value })}
                              placeholder={t('ملاحظات...', 'Notes...')}
                              className="w-28 px-2 py-1 text-xs rounded-lg border border-indigo-300 bg-white dark:bg-slate-800"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[120px] truncate block" title={row.notes}>
                              {row.notes || '-'}
                            </span>
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

              {/* 3. Totals Aggregates Placed at the Bottom of Table (Totals) */}
              {activeShift.runRows.length > 0 && (
                <tfoot className="bg-slate-100/80 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                  <tr>
                    <td colSpan={4} className="p-3 text-right rtl:text-left font-black uppercase text-xs">
                      {t('إجمالي حركات الشيفت (Totals):', 'Shift Table Totals:')}
                    </td>
                    <td className="p-3 text-amber-600 font-black">
                      {totalPulsesCount.toLocaleString()} {t('نبضة', 'pulses')}
                    </td>
                    <td className="p-3 font-black">
                      -
                    </td>
                    <td className="p-3">-</td>
                    <td className="p-3 text-slate-900 dark:text-white font-black">
                      {formatMoney(totalRunRevenue)}
                    </td>
                    <td className="p-3">-</td>
                    <td className="p-3 text-emerald-600 dark:text-emerald-400 font-black">
                      {formatMoney(totalRunCollected)}
                    </td>
                    <td className="p-3">-</td>
                    <td colSpan={2} className="p-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
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
                    <th className="p-2.5 text-amber-600 font-bold">{t('التسويات (الفرق)', 'Adjustments')}</th>
                    <th className="p-2.5 font-black text-slate-900 dark:text-white">{t('الرصيد الختامي', 'Closing Bal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeShift.balancing.map((row) => {
                    const openingBal = row.openingBalance ?? 0;
                    const pmObj = paymentMethods.find((p) => p.id === row.paymentMethodId || p.nameAr === row.paymentMethodName);
                    const linkedAcc = accounts.find((a) => {
                      if (pmObj?.linkedAccountId) return a.id === pmObj.linkedAccountId;
                      if (pmObj?.code) return a.code === pmObj.code || a.id === pmObj.id;
                      if (row.paymentMethodName.includes('نقد') || row.paymentMethodId.includes('cash')) return a.code === '1111';
                      if (row.paymentMethodName.includes('فيزا') || row.paymentMethodName.includes('بطاقة') || row.paymentMethodName.includes('إنستاباي')) return a.code === '1112';
                      return false;
                    });
                    const expected = Number(((row.openingBalance || 0) + (row.totalCollected || 0) - (row.totalDisbursed || 0)).toFixed(2));
                    const closing = Number(row.closingBalance) || 0;
                    const diff = row.adjustments !== undefined ? Number(row.adjustments) : Number((closing - expected).toFixed(2));

                    return (
                      <tr key={row.paymentMethodId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          <div>{row.paymentMethodName}</div>
                          {linkedAcc && (
                            <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                              <span className="font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-slate-600 dark:text-slate-400 font-bold">{linkedAcc.code}</span>
                              <span>{language === 'ar' ? linkedAcc.nameAr : (linkedAcc.nameEn || linkedAcc.nameAr)}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                          <div
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50"
                            title={t('الرصيد الافتتاحي مسجل من شجرة الحسابات للحساب المرتبط وقت فتح الشيفت (إجباري وغير قابل للتعديل)', 'Opening balance registered from Chart of Accounts at shift opening (Mandatory & Non-editable)')}
                          >
                            <span>{formatMoney(openingBal)}</span>
                            <span className="text-[10px] text-indigo-400 dark:text-indigo-500 font-bold" title={t('غير قابل للتعديل - مستند من شجرة الحسابات', 'Non-editable - fixed from Chart of Accounts')}>
                              🔒
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 font-semibold text-emerald-600 font-mono">{formatMoney(row.totalCollected)}</td>
                        <td className="p-2.5 font-semibold text-rose-600 font-mono">{formatMoney(row.totalDisbursed)}</td>
                        <td className="p-2.5 font-bold font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs inline-block font-mono ${
                              diff > 0
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold'
                                : diff < 0
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 font-bold'
                                : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                            }`}
                            title={
                              diff === 0
                                ? t('مطابق تماماً بدون فروق', 'Balanced - No variance')
                                : diff > 0
                                ? t(`فائض بمقدار: +${formatMoney(diff)}`, `Surplus: +${formatMoney(diff)}`)
                                : t(`عجز بمقدار: ${formatMoney(diff)}`, `Deficit: ${formatMoney(diff)}`)
                            }
                          >
                            {diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="any"
                            value={row.closingBalance}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const val = raw === '' ? 0 : parseFloat(raw);
                              updateShiftBalancing(
                                activeShift.id,
                                row.paymentMethodId,
                                {
                                  closingBalance: isNaN(val) ? 0 : val,
                                }
                              );
                            }}
                            className="w-24 px-2 py-1 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 font-mono font-bold text-indigo-700 dark:text-indigo-300 text-center focus:ring-2 focus:ring-indigo-500"
                          />
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
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">{t('الجهاز والموقع', 'Device & Location')}</th>
                    <th className="p-2.5">{t('الافتتاحي', 'Opening')}</th>
                    <th className="p-2.5 text-indigo-600 font-bold">{t('المستهلك بالشيفت', 'Consumed')}</th>
                    {/* Adjustments Column (Difference) */}
                    <th className="p-2.5 text-amber-600 font-bold">{t('التسويات (الفرق)', 'Adjustments')}</th>
                    <th className="p-2.5 font-black text-emerald-700 dark:text-emerald-400">{t('الرصيد الختامي', 'Closing Bal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {laserDevices.map((masterDev) => {
                    const devCounter = activeShift.deviceCounters?.find(
                      (d) => d.deviceId === masterDev.id || d.deviceName === masterDev.name
                    );

                    // Find last closed shift for this branch to carry forward opening balances
                    const closedShifts = receptionShifts
                      .filter((s) => s.status === 'Closed' && s.id !== activeShift.id && (!activeShift.branchId || s.branchId === activeShift.branchId))
                      .sort((a, b) => new Date(b.openedAt || b.shiftDate).getTime() - new Date(a.openedAt || a.shiftDate).getTime());
                    const lastClosed = closedShifts[0];
                    const lastClosedCounter = lastClosed?.deviceCounters?.find(
                      (dc) => dc.deviceId === masterDev.id || dc.deviceName === masterDev.name
                    );

                    const openingCounter = lastClosedCounter?.closingCounter !== undefined
                      ? lastClosedCounter.closingCounter
                      : (devCounter?.openingCounter !== undefined ? devCounter.openingCounter : (masterDev.totalShotsCounter || 0));

                    const consumed = devCounter?.consumedCounter ?? 0;
                    const adj = devCounter?.adjustments ?? 0;
                    const closing = devCounter?.closingCounter !== undefined
                      ? devCounter.closingCounter
                      : (openingCounter + consumed + adj);

                    return (
                      <tr key={masterDev.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                masterDev.status === 'Maintenance'
                                  ? 'bg-amber-500 animate-pulse'
                                  : 'bg-emerald-500'
                              }`}
                              title={masterDev.status || 'Active'}
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{masterDev.name}</span>
                                {masterDev.code && (
                                  <span className="font-mono text-[10px] px-1 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600">
                                    {masterDev.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {masterDev.room || t('غرفة ليزر', 'Laser Room')} {masterDev.model ? `• ${masterDev.model}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-2.5 text-slate-600 dark:text-slate-300 font-mono font-medium">
                          {openingCounter.toLocaleString()}
                        </td>

                        <td className="p-2.5 font-black text-indigo-600 dark:text-indigo-400 font-mono">
                          +{consumed.toLocaleString()}
                        </td>

                        {/* Adjustments (Difference auto-calculated when closing balance edited) */}
                        <td className="p-2.5 font-bold font-mono">
                          <span className={`px-2 py-0.5 rounded-md text-xs inline-block ${
                            adj > 0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : adj < 0
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                              : 'text-slate-400'
                          }`}>
                            {adj > 0 ? `+${adj.toLocaleString()}` : adj.toLocaleString()}
                          </span>
                        </td>

                        {/* Closing Balance */}
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={closing}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const val = raw === '' ? 0 : parseFloat(raw);
                              updateDeviceCounter(
                                activeShift.id,
                                masterDev.id,
                                {
                                  closingCounter: isNaN(val) ? 0 : val,
                                }
                              );
                            }}
                            className="w-24 px-2 py-1 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 font-mono text-center font-bold text-emerald-700 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                          />
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

      {/* 6. Manual Notes Table & Operational Logs Section (جدول وسجلات الملاحظات اليدوية للشيفت) */}
      {activeShift && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('جدول وسجلات الملاحظات اليدوية والتشغيلية للشيفت', 'Manual Shift Notes & Operational Logs')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t(
                    '* الملاحظات المسجلة هنا تُحفظ تلقائياً وتظهر في تقارير شيتات التشغيل عند استدعاء الشيفت مستقبلاً',
                    '* All notes recorded here are archived and appear in shift run-sheet reports when recalled'
                  )}
                </p>
              </div>
            </div>
            {notesSavedAlert && (
              <span className="px-3 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-lg animate-fade-in flex items-center gap-1 self-start">
                <Check className="h-3.5 w-3.5" />
                {t('تم تسجيل وحفظ الملاحظة بنجاح', 'Note saved to shift log')}
              </span>
            )}
          </div>

          {/* Table of Recorded Manual Notes */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2.5 w-12">#</th>
                  <th className="p-2.5 w-28">{t('التوقيت', 'Time')}</th>
                  <th className="p-2.5 w-36">{t('المسؤول / الكاتب', 'Author')}</th>
                  <th className="p-2.5">{t('نص الملاحظة اليدوية المسجلة', 'Note Content')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeShift.manualNotesHistory && activeShift.manualNotesHistory.length > 0 ? (
                  activeShift.manualNotesHistory.map((noteItem, idx) => (
                    <tr key={noteItem.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                        {new Date(noteItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                        {noteItem.author}
                      </td>
                      <td className="p-2.5 text-slate-700 dark:text-slate-300 font-medium">
                        {noteItem.note}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      {t('لا توجد ملاحظات مسجلة في سجل الشيفت حتى الآن. يمكنك إضافة ملاحظة جديدة أدناه.', 'No shift log notes recorded yet.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add Note Entry Input and General Shift Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('إضافة ملاحظة جديدة لسجل شيت التشغيل:', 'Add New Note to Shift Log:')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveManualNotes();
                    }
                  }}
                  placeholder={t('اكتب هنا ملاحظة يدوية (تسليم وردية، ملاحظات دكاترة، أمانات مرضى...) ثم اضغط تسجيل...', 'Write manual note...')}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-medium"
                />
                <button
                  type="button"
                  onClick={handleSaveManualNotes}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer shrink-0"
                >
                  <Save className="h-4 w-4" />
                  <span>{t('تسجيل في السجل', 'Record Note')}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-xs font-bold text-slate-500">
                {t('المسؤول المسجل:', 'Author in Log:')}
              </span>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                {activeShift.receptionistName || t('موظف الاستقبال', 'Receptionist')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* If No Active Shift for Current Branch */}
      {!activeShift && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-4 shadow-xs">
            <Building2 className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {t('لا يوجد شيفت تشغيل مفتوح لفرع:', 'No Open Reception Shift for Branch:')}{' '}
            <span className="text-indigo-600 dark:text-indigo-400">
              {language === 'ar' ? activeBranch?.name : activeBranch?.nameEn}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto mt-2 leading-relaxed">
            {t(
              'كل فرع له شيفته المستقل والمنفصل تماماً. يمكنك فتح شيفت جديد لهذا الفرع لمباشرة تسجيل حركات المرضى، تحصيل الإيرادات، ومراقبة أجهزة الليزر دون التأثير على شفتات الفروع الأخرى.',
              'Each branch operates with its own independent shift. Open a new shift for this branch to start logging patient runs and revenues independently.'
            )}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                setOpenShiftReceptionist(currentUser?.name || '');
                setShowOpenShiftModal(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>
                {t('فتح شيفت تشغيل لـ', 'Open Shift for')}{' '}
                {language === 'ar' ? activeBranch?.name : activeBranch?.nameEn}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {t('فتح شيفت تشغيل ريسيبشن جديد', 'Open Reception Shift')}
            </h3>

            {/* Target Branch Badge */}
            <div className="flex items-center gap-2 mb-4 bg-indigo-50 dark:bg-indigo-950/50 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500 font-bold">{t('الفرع المستهدف:', 'Target Branch:')} </span>
                <span className="font-black text-indigo-700 dark:text-indigo-300">
                  {language === 'ar' ? activeBranch?.name : activeBranch?.nameEn}
                </span>
              </div>
            </div>

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
                  onClick={handleOpenShiftSubmit}
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

            {/* Z-Report Financial Breakdown */}
            {(() => {
              const cashBal = activeShift.balancing?.find(
                (b) =>
                  b.paymentMethodName.includes('نقد') ||
                  b.paymentMethodName.toLowerCase().includes('cash') ||
                  b.paymentMethodId.toLowerCase().includes('cash') ||
                  b.paymentMethodId === 'pm-01' ||
                  b.paymentMethodId === 'pm-cash-1'
              ) || activeShift.balancing?.[0];

              const openFloat = activeShift.openingFloat ?? activeShift.initialBalance ?? (cashBal?.openingBalance || 0);

              const cashColl = activeShift.cashCollected !== undefined
                ? activeShift.cashCollected
                : cashBal?.totalCollected !== undefined
                ? cashBal.totalCollected
                : activeShift.runRows
                    .filter((r) => (r.paymentMethod || '').includes('نقد') || (r.paymentMethod || '').toLowerCase().includes('cash'))
                    .reduce((sum, r) => sum + (r.collectedAmount || 0), 0);

              const cashExp = activeShift.cashExpenses !== undefined
                ? activeShift.cashExpenses
                : cashBal?.totalDisbursed !== undefined
                ? cashBal.totalDisbursed
                : activeShift.expenses
                    .filter((e) => (e.disbursementMethod || '').includes('نقد') || (e.disbursementMethod || '').toLowerCase().includes('cash'))
                    .reduce((sum, e) => sum + (e.amount || 0), 0);

              const adjustments = cashBal?.adjustments || 0;

              const expectedCashInDrawer = activeShift.expectedCashInDrawer !== undefined
                ? activeShift.expectedCashInDrawer
                : cashBal?.closingBalance !== undefined
                ? cashBal.closingBalance
                : openFloat + cashColl - cashExp + adjustments;

              const cashDiff = actualCashCount - expectedCashInDrawer;

              return (
                <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-2">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>{t('عهدة ورصيد بداية الشيفت:', 'Opening Float / Initial:')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {formatMoney(openFloat)}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>{t('+ المقبوضات النقدية المسجلة:', '+ Cash Collected:')}</span>
                      <span className="font-bold font-mono">
                        +{formatMoney(cashColl)}
                      </span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>{t('- المصروفات النقدية من الدرج:', '- Cash Expenses:')}</span>
                      <span className="font-bold font-mono">
                        -{formatMoney(cashExp)}
                      </span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between font-bold text-slate-900 dark:text-white">
                      <span>{t('النقدية الدفترية المتوقعة بالدرج:', 'Expected Cash in Drawer:')}</span>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {formatMoney(expectedCashInDrawer)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      <span className="text-rose-600 font-black ml-1">*</span>
                      {t('النقدية الفعلية المحصاة في الدرج (ج.م) *', 'Actual Physical Cash Counted (EGP) *')}
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={actualCashCount}
                      onChange={(e) => setActualCashCount(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm font-black rounded-xl bg-white dark:bg-slate-800 border-2 border-indigo-500 text-slate-900 dark:text-white outline-none"
                    />
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-500">{t('فارق الجرد:', 'Reconciliation Diff:')}</span>
                      {cashDiff === 0 ? (
                        <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                          {t('مطابقة تماماً بدون عجز أو زيادة', 'Perfect Match')}
                        </span>
                      ) : cashDiff < 0 ? (
                        <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                          {t('عجز بالدرج:', 'Shortage:')} {formatMoney(Math.abs(cashDiff))}
                        </span>
                      ) : (
                        <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                          {t('فائض بالدرج:', 'Surplus:')} +{formatMoney(cashDiff)}
                        </span>
                      )}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferredToMainTreasury}
                      onChange={(e) => setTransferredToMainTreasury(e.target.checked)}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t(
                        'توريد النقدية الفعلية للخزينة الرئيسية آلياً (توليد سند قبض رسمي)',
                        'Auto-transfer cash to main treasury (generates cash voucher)'
                      )}
                    </span>
                  </label>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('ملاحظات تقفيل الشيفت والتسليم', 'Closing & Handover Notes')}
                    </label>
                    <textarea
                      rows={2}
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
                      {t('تأكيد إغلاق الشيفت وترحيل Z-Report', 'Confirm Close & Post Z-Report')}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add Run-sheet Row Modal */}
      {showAddRowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('تسجيل حركة تشغيل', 'Add Operation Entry')}
              </h3>
              <button
                onClick={() => setShowAddRowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddRunRowSubmit} className="space-y-4">
              {/* Select Client (اختيار العميل) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-rose-500 font-bold ml-1">*</span>
                    {t('اختيار العميل', 'Select Client')}
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold mr-1.5">
                      ({t('عملاء فرع:', 'Branch Customers:')} {language === 'ar' ? (activeBranch?.name || 'الفرع المفعل') : (activeBranch?.nameEn || 'Active Branch')})
                    </span>
                  </label>
                  <span className="text-[11px] font-medium text-slate-500">
                    {branchCustomers.length} {t('عميل متاح', 'available')}
                  </span>
                </div>
                <select
                  required
                  value={patientId}
                  onChange={(e) => handleSelectPatient(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-800 dark:text-white rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 cursor-pointer"
                >
                  <option value="">{t('اختر العميل من السجل (عملاء هذا الفرع فقط)...', 'Select client (branch customers only)...')}</option>
                  {branchCustomers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.systemCode ? `(${p.systemCode})` : ''} {p.phone ? `- ${p.phone}` : ''}
                    </option>
                  ))}
                </select>

                {branchCustomers.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                    {t(
                      'تنبيه: لا يوجد عملاء مكودين لهذا الفرع حتى الآن. يرجى إضافة عملاء لهذا الفرع أولاً من شاشة إدارة العملاء.',
                      'Notice: No customers found for this branch yet. Please add customers from the Customer Management screen first.'
                    )}
                  </p>
                )}

                {patientName && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{t('تم تحديد العميل:', 'Selected Client:')} {patientName}</span>
                  </p>
                )}
              </div>

              {/* Service Provider / Doctor (مقدم الخدمة / الطبيب المعالج) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الطبيب المعالج / مقدم الخدمة', 'Service Provider / Doctor')}
                </label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                >
                  <option value="">{t('اختر مقدم الخدمة المكود بالفرع...', 'Select Service Provider...')}</option>
                  {branchServiceProviders.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nameAr} {d.jobTitleAr ? `(${d.jobTitleAr})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service & Pulse Count BEFORE Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الخدمة أو الجلسة (اختياري)', 'Service (Optional)')}
                  </label>
                  <select
                    value={serviceId}
                    onChange={(e) => handleSelectService(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('-- بدون خدمة / جلسة (فارغ) --', '-- None / Empty --')}</option>
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
                    min="0"
                    step="any"
                    value={consumedQty}
                    onChange={(e) => {
                      const q = Number(e.target.value) || 0;
                      setConsumedQty(q);
                      setCollectedAmount(q * unitPrice);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        {d.name} {d.room ? `(${d.room})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الملاحظات', 'Notes')}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('ملاحظات اختيارية عن الحركة...', 'Optional notes...')}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
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
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('تسجيل مصروف جديد', 'Add Expense')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t('إدراج أصناف المشتريات والمصروفات - يدعم إضافة عدة أصناف في عملية واحدة', 'Multi-item expense registration in a single voucher')}
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
              {/* Transaction Type with Supplier (نوع المعاملة بجوار المورد) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('نوع المعاملة مع المورد', 'Transaction Type with Supplier')}
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseTransactionType('receipt_and_payment');
                      if (stockItems.length > 0) {
                        const itm = stockItems.find((s) => s.id === expenseItemId) || stockItems[0];
                        setExpenseItemId(itm.id);
                        const name = language === 'ar' ? itm.nameAr : itm.nameEn;
                        setExpenseItemName(name);
                        setExpenseCategory(name);
                        const cost = itm.purchasePrice || 0;
                        setExpenseUnitPrice(cost);
                        setExpenseAmount(expenseQty * cost);
                      }
                    }}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      expenseTransactionType === 'receipt_and_payment'
                        ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-xs border border-rose-200 dark:border-rose-800'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {t('استلام وسداد', 'Receipt & Pay')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExpenseTransactionType('receipt_only');
                      if (stockItems.length > 0) {
                        const itm = stockItems.find((s) => s.id === expenseItemId) || stockItems[0];
                        setExpenseItemId(itm.id);
                        const name = language === 'ar' ? itm.nameAr : itm.nameEn;
                        setExpenseItemName(name);
                        setExpenseCategory(name);
                        const cost = itm.purchasePrice || 0;
                        setExpenseUnitPrice(cost);
                        setExpenseAmount(expenseQty * cost);
                      }
                    }}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      expenseTransactionType === 'receipt_only'
                        ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs border border-amber-200 dark:border-amber-800'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {t('استلام فقط (آجل)', 'Receipt Only (Credit)')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExpenseTransactionType('balance_payment');
                      setExpenseCategory('سداد دفعات ومستلزمات موردين');
                    }}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      expenseTransactionType === 'balance_payment'
                        ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs border border-indigo-200 dark:border-indigo-800'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {t('سداد من الرصيد', 'Pay from Balance')}
                  </button>
                </div>
              </div>

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

                {/* وفى حالة سداد من الرصيد يظهر الرصيد الخاص بالمورد بالحسابات */}
                {expenseTransactionType === 'balance_payment' && supplierId && (() => {
                  const selSup = suppliersList.find((p) => p.id === supplierId);
                  return (
                    <div className="flex justify-between items-center text-xs bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-bold">
                      <span>{t('الرصيد الخاص بالمورد بالحسابات:', 'Supplier Account Balance:')}</span>
                      <span className="font-black text-sm text-indigo-600 dark:text-indigo-400 font-mono">
                        {formatMoney(selSup?.balance || 0)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* أصناف وبنود المصروف - دعم أكثر من صنف في عملية واحدة كل صنف في سطر منفصل */}
              {expenseTransactionType !== 'balance_payment' ? (
                <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShoppingBag className="h-4 w-4 text-indigo-600" />
                        <span>{t('أصناف وبنود المصروف (أكثر من صنف في عملية واحدة)', 'Expense Items (Multi-Item Lines)')}</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('يمكنك إدراج عدة أصناف في نفس العملية، وسيتم تسجيل كل صنف في سطر منفصل بسجل المصروفات', 'Add multiple items; each item will be recorded on a separate row')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddExpenseItemRow}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl border border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t('إضافة صنف آخر +', 'Add Another Item +')}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {expenseItemRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-300">
                            {t('سطر الصنف #', 'Item Line #')}{idx + 1}
                          </span>
                          {expenseItemRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveExpenseItemRow(row.id)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                              title={t('حذف هذا السطر', 'Delete Line')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                          <div className="md:col-span-6">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              {t('الصنف المخزني / البند *', 'Stock Item *')}
                            </label>
                            <select
                              value={row.itemId}
                              required
                              onChange={(e) => handleUpdateExpenseItemRow(row.id, { itemId: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 focus:outline-indigo-600 text-slate-900 dark:text-white"
                            >
                              <option value="">{t('-- اختر الصنف المخزني --', '-- Select Stock Item --')}</option>
                              {stockItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {language === 'ar' ? item.nameAr : item.nameEn} ({item.sku || item.category}) - {formatMoney(item.purchasePrice || 0)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              {t('الكمية', 'Qty')}
                            </label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={row.quantity}
                              onChange={(e) => handleUpdateExpenseItemRow(row.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                              className="w-full px-2 py-1.5 text-xs font-bold rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono text-center"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              {t('سعر الوحدة', 'Price')}
                            </label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="any"
                              value={row.unitPrice}
                              onChange={(e) => handleUpdateExpenseItemRow(row.id, { unitPrice: Number(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 text-xs font-bold rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono text-center"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              {t('الإجمالي', 'Total')}
                            </label>
                            <div className="w-full px-2.5 py-1.5 text-xs font-black text-rose-600 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center font-mono">
                              {formatMoney(row.amount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Bar */}
                  <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {t('عدد الأصناف في المعاملة:', 'Items Count:')}
                      </span>
                      <span className="font-black text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-mono">
                        {expenseItemRows.length} {t('أصناف', 'items')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-800 dark:text-rose-300">
                        {t('إجمالي قيمة المصروف:', 'Total Expense:')}
                      </span>
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                        {formatMoney(expenseItemRows.reduce((sum, r) => sum + (r.amount || 0), 0))}
                      </span>
                    </div>
                  </div>

                  {expenseTransactionType === 'receipt_only' && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      {t('📌 استلام فقط (آجل): سيتم إضافة إجمالي الأصناف لحساب المورد في شجرة الحسابات دون خصمها من نقدية أو عهدة الشيفت.', '📌 Credit receipt: Value added to supplier account and NOT deducted from shift cash/expenses.')}
                    </div>
                  )}
                </div>
              ) : (
                /* سداد من الرصيد: عدم اشتراط وجود الصنف أو الكمية، والمبلغ قابل للإدخال بالقيمة المسددة */
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span className="text-rose-600 font-black ml-1">*</span>
                    {t('القيمة المسددة للمورد (ج.م) *', 'Payment Amount (EGP) *')}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={expenseAmount || ''}
                    onChange={(e) => setExpenseAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs font-bold text-rose-600 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono"
                  />
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('تاريخ الحركة', 'Date')}
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              {/* Reason / Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('البيان وسبب الصرف', 'Reason & Description')}
                </label>
                <input
                  type="text"
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  placeholder={
                    expenseTransactionType === 'balance_payment'
                      ? `سداد دفعة للمورد: ${supplierName || ''}`
                      : expenseTransactionType === 'receipt_only'
                      ? `استلام أصناف آجل: ${expenseItemName || ''}`
                      : `استلام وسداد أصناف: ${expenseItemName || ''}`
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              {/* Disbursement Method (Only if paying cash out of shift: receipt_and_payment or balance_payment) */}
              {expenseTransactionType !== 'receipt_only' && (
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
                </div>
              )}

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
                  {expenseTransactionType === 'receipt_only'
                    ? t('تسجيل الاستلام الآجل', 'Record Credit Receipt')
                    : expenseTransactionType === 'balance_payment'
                    ? t('سداد وسحب من الشيفت', 'Pay from Shift')
                    : t('صرف وسداد المصروف', 'Disburse & Pay')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL DATA TRANSFER & VALIDATION MODAL FOR SHIFT SESSIONS & CONSUMED PULSES */}
      <ExcelDataTransferModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        entityTitleAr="حركات التشغيل وجلسات الليزر والبلصات"
        entityTitleEn="Shift Sessions & Consumed Pulses"
        descriptionAr="استيراد وتصدير حركات التشغيل وجلسات الليزر مع الفحص الخلوي الذكي لمطابقة أعداد النبضات والعملاء والمبالغ"
        columns={sessionPulsesExcelColumns}
        currentDataForExport={(activeShift?.runRows || []).map((row) => ({
          customerName: row.customerName || row.patientName,
          patientPhone: row.patientPhone || '',
          serviceName: row.serviceName,
          laserDevice: row.laserDevice || '',
          pulsesCount: row.pulsesCount || 0,
          totalRevenue: row.totalRevenue,
          collectedAmount: row.collectedAmount || row.totalRevenue,
          paymentMethod: row.paymentMethod,
          doctorName: row.doctorName || '',
          date: row.date,
          notes: row.notes || row.description || '',
        }))}
        exportFileNamePrefix="سجل_حركات_التشغيل_والبلصات_المستهلكة"
        validator={validateSessionPulsesRows}
        onConfirmImport={handleConfirmSessionPulsesImport}
        branchName={activeBranch?.name || 'الفرع الحالي'}
      />
    </div>
  );
};
