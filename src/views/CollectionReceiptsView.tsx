import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  User,
  CreditCard,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Edit2,
  Ban,
  FileText,
  DollarSign,
  Wallet,
  ShieldAlert,
  X,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  Download,
  Archive,
} from 'lucide-react';
import {
  ExcelDataTransferModal,
  ExcelColumnConfig,
  CellValidationError,
  ExcelValidationResult,
} from '../components/ExcelDataTransferModal';

const collectionExcelColumns: ExcelColumnConfig[] = [
  {
    key: 'customerCode',
    labelAr: 'كود العميل',
    labelEn: 'Customer Code',
    required: true,
    type: 'text',
    sampleValue: '1',
    instructions: 'الكود المسلسل للعميل من شاشة إدارة العملاء',
  },
  {
    key: 'customerName',
    labelAr: 'اسم العميل / المسدد',
    labelEn: 'Customer Name',
    required: true,
    type: 'text',
    sampleValue: 'أحمد محمود سليمان',
    instructions: 'الاسم الكامل للعميل المسدد',
  },
  {
    key: 'patientPhone',
    labelAr: 'رقم الهاتف',
    labelEn: 'Phone Number',
    required: false,
    type: 'phone',
    sampleValue: '01099887766',
    instructions: 'رقم هاتف العميل للتواصل والمطابقة',
  },
  {
    key: 'date',
    labelAr: 'تاريخ التحصيل',
    labelEn: 'Collection Date',
    required: true,
    type: 'date',
    sampleValue: '2026-10-01',
    instructions: 'تاريخ استلام النقدية أو التحويل (YYYY-MM-DD)',
  },
  {
    key: 'collectedAmount',
    labelAr: 'المبلغ المحصل',
    labelEn: 'Collected Amount',
    required: true,
    type: 'number',
    sampleValue: 1200,
    instructions: 'قيمة المبلغ المحصل بالجنيه (رقم موجب أكبر من 0)',
  },
  {
    key: 'paymentMethod',
    labelAr: 'طريقة السداد',
    labelEn: 'Payment Method',
    required: true,
    type: 'select',
    options: ['نقداً (كاش)', 'فيزا / بطاقة بنكية', 'فودافون كاش', 'إنستاباي', 'تحويل بنكي'],
    sampleValue: 'نقداً (كاش)',
    instructions: 'طريقة الدفع (نقداً (كاش)، فيزا / بطاقة بنكية، إنستاباي، فودافون كاش...)',
  },
  {
    key: 'paymentMethodCode',
    labelAr: 'كود طريقة التحصيل',
    labelEn: 'Payment Method Code',
    required: true,
    type: 'text',
    sampleValue: 'PM-01',
    instructions: 'الكود المسجل لطريقة التحصيل في شاشة إدارة طرق التحصيل والسداد',
  },
  {
    key: 'serviceName',
    labelAr: 'الخدمة / البيان',
    labelEn: 'Service / Purpose',
    required: true,
    type: 'text',
    sampleValue: 'سداد دفعة جلسات ليزر',
    instructions: 'البيان أو الجلسة المحصل عنها المبلغ',
  },
  {
    key: 'receiptNumber',
    labelAr: 'رقم الإيصال الدفتري',
    labelEn: 'Receipt Number',
    required: false,
    type: 'text',
    sampleValue: 'REC-1045',
    instructions: 'رقم الإيصال اليدوي أو المرجعي السابق إن وجد',
  },
  {
    key: 'notes',
    labelAr: 'ملاحظات التحصيل',
    labelEn: 'Notes',
    required: false,
    type: 'text',
    sampleValue: 'تحصيل دفعة مسبقة',
    instructions: 'أي ملاحظات إضافية على الإيصال',
  },
];

interface ReceiptDisplayItem {
  id: string; // row.id
  receiptNumber: string;
  sourceShiftId: string;
  shiftNumber: string;
  shiftStatus: 'Open' | 'Closed';
  branchId: string;
  branchName: string;
  shiftDate: string;
  date: string;
  dayName?: string;
  customerId?: string;
  customerCode?: string;
  customerName: string;
  patientPhone?: string;
  systemCode?: string;
  collectedAmount: number; // قيمة التحصيل
  totalRevenue: number;
  paymentMethod: string;
  serviceName: string;
  description?: string;
  notes?: string;
  source: 'pos' | 'reception_ops' | 'cash_receipt';
  sourceLabelAr: string;
  isCancelled: boolean;
  isModified: boolean;
  isRefund: boolean;
  isArchived: boolean;
}

export const CollectionReceiptsView: React.FC = () => {
  const {
    tenant,
    activeBranch,
    branches,
    receptionShifts,
    allReceptionShifts,
    cashReceipts,
    activeReceptionShift,
    parties,
    paymentMethods,
    formatMoney,
    language,
    t,
    editCollectionReceipt,
    cancelCollectionReceipt,
    archiveCollectionReceipts,
    postUnpostedCollectionReceipts,
    addCollectionReceiptsBulk,
  } = usePlatform();

  // Search & Filter States
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'pos' | 'reception_ops'>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedShiftStatus, setSelectedShiftStatus] = useState<'all' | 'Open' | 'Closed'>('all');
  const [receiptArchiveView, setReceiptArchiveView] = useState<'active' | 'archived' | 'all'>('active');
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(() => new Set());

  // Date Range Filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals state
  const [selectedReceiptForEdit, setSelectedReceiptForEdit] = useState<ReceiptDisplayItem | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  const [selectedReceiptForCancel, setSelectedReceiptForCancel] = useState<ReceiptDisplayItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Active branch open shift check
  const currentBranchId = activeBranch?.id;
  const currentOpenShift = useMemo(() => {
    return (
      allReceptionShifts.find(
        (s) => s.status === 'Open' && s.tenantId === tenant?.id && (!currentBranchId || s.branchId === currentBranchId)
      ) || null
    );
  }, [allReceptionShifts, tenant?.id, currentBranchId]);

  // Branch customers list for filter dropdown
  const branchCustomers = useMemo(() => {
    return parties.filter((p) => {
      const isCust = p.type === 'Customer' || p.type === 'Both';
      if (!isCust) return false;
      if (currentBranchId) {
        return (
          p.branchId === currentBranchId ||
          (Array.isArray(p.branchIds) && p.branchIds.includes(currentBranchId))
        );
      }
      return true;
    });
  }, [parties, currentBranchId]);

  // Extract all collection receipts for the active branch from receptionShifts
  const allReceipts = useMemo<ReceiptDisplayItem[]>(() => {
    const list: ReceiptDisplayItem[] = [];

    // Filter shifts for the active branch
    const branchShifts = allReceptionShifts.filter((s) => {
      if (s.tenantId !== tenant?.id) return false;
      if (currentBranchId && s.branchId && s.branchId !== currentBranchId) return false;
      return true;
    });

    branchShifts.forEach((shift) => {
      if (!shift.runRows || !Array.isArray(shift.runRows)) return;

      shift.runRows.forEach((row) => {
        // Collect rows that have a collection amount or are marked as receipts
        const collected = Number(row.collectedAmount) || 0;
        const isPos =
          row.roomNumber === 'نقطة البيع (POS)' ||
          row.id.includes('pos') ||
          row.laserDevice === 'نقطة البيع (POS)';

        // Include all rows that represent a customer collection (even if modified or refunded)
        // User insisted: "الايصالات مش المبيعات يعنى قيمة التحصيل مش قيمة الايراد"
        const isReceiptRow =
          collected !== 0 ||
          (row.totalRevenue > 0 && row.paymentMethod) ||
          row.serviceName?.includes('تحصيل') ||
          row.serviceName?.includes('فاتورة') ||
          row.description?.includes('فاتورة');

        if (!isReceiptRow) return;

        const isCancelled =
          Boolean(row.notes?.includes('ملغي')) ||
          row.serviceName?.includes('(ملغي)') ||
          (collected === 0 && row.description?.includes('ملغي'));

        const isModified =
          Boolean(row.notes?.includes('تعديل')) ||
          Boolean(row.notes?.includes('معدل')) ||
          row.serviceName?.includes('تعديل إيصال');

        const isRefund = collected < 0;

        const receiptNum =
          (row as any).receiptNumber ||
          (isPos
            ? `REC-POS-${row.id.replace(/\D/g, '').slice(-5) || row.id.slice(-5)}`
            : `REC-OPS-${row.id.replace(/\D/g, '').slice(-5) || row.id.slice(-5)}`);

        list.push({
          id: row.id,
          receiptNumber: receiptNum,
          sourceShiftId: shift.id,
          shiftNumber: shift.shiftNumber,
          shiftStatus: shift.status,
          branchId: shift.branchId,
          branchName: branches.find((branch) => branch.id === shift.branchId)?.name || shift.branchId || '—',
          shiftDate: shift.openedAt ? shift.openedAt.split('T')[0] : shift.shiftDate,
          date: row.date || (shift.openedAt ? shift.openedAt.split('T')[0] : shift.shiftDate),
          dayName: row.dayName,
          customerId: row.customerId,
          customerCode: (row as any).customerCode || parties.find((p) => p.id === (row.customerId || row.patientId))?.customerCode || parties.find((p) => p.id === (row.customerId || row.patientId))?.code,
          customerName: row.customerName || row.patientName || 'عميل نقدي عام',
          patientPhone: row.patientPhone,
          systemCode: row.systemCode,
          collectedAmount: collected,
          totalRevenue: row.totalRevenue || 0,
          paymentMethod: row.paymentMethod || 'نقداً',
          serviceName: row.serviceName,
          description: row.description,
          notes: row.notes,
          source: isPos ? 'pos' : 'reception_ops',
          sourceLabelAr: isPos ? 'نقطة البيع السريعة (POS)' : 'شاشة التشغيل (الاستقبال)',
          isCancelled,
          isModified,
          isRefund,
          isArchived: Boolean(row.receiptArchivedAt),
        });
      });
    });

    const shiftReceiptVoucherIds = new Set(branchShifts.flatMap((shift) => shift.runRows.map((row) => row.receiptVoucherId).filter(Boolean) as string[]));
    cashReceipts.forEach((receipt) => {
      if (!receipt.partyId || (currentBranchId && receipt.branchId !== currentBranchId)) return;
      if (shiftReceiptVoucherIds.has(receipt.id)) return;
      const matchingLegacyRunRow = branchShifts.some((shift) => shift.runRows.some((row) =>
        (row.customerId === receipt.partyId || row.patientId === receipt.partyId) &&
        (row.date || shift.shiftDate) === receipt.date &&
        Math.abs(Number(row.collectedAmount || 0) - Number(receipt.amount || 0)) < 0.01 &&
        (row.notes?.includes('استيراد تحصيل إكسيل') || receipt.description.startsWith(row.serviceName))
      ));
      if (matchingLegacyRunRow) return;
      const linkedParty = parties.find((party) => party.id === receipt.partyId);
      const receiptMethodLabel = receipt.paymentMethodLabel || (receipt.paymentMethod === 'Cash' ? t('نقداً (كاش)', 'Cash')
        : receipt.paymentMethod === 'Card' ? t('بطاقة', 'Card')
          : receipt.paymentMethod === 'Check' ? t('شيك', 'Check') : t('تحويل', 'Transfer'));
      list.push({
        id: receipt.id,
        receiptNumber: receipt.voucherNumber,
        sourceShiftId: '',
        shiftNumber: '—',
        shiftStatus: 'Closed',
        branchId: receipt.branchId,
        branchName: branches.find((branch) => branch.id === receipt.branchId)?.name || receipt.branchId || '—',
        shiftDate: receipt.date,
        date: receipt.date,
        customerId: receipt.partyId,
        customerCode: linkedParty?.customerCode || linkedParty?.code,
        customerName: receipt.receivedFrom,
        patientPhone: linkedParty?.phone,
        systemCode: linkedParty?.systemCode,
        collectedAmount: Number(receipt.amount) || 0,
        totalRevenue: 0,
        paymentMethod: receiptMethodLabel,
        serviceName: receipt.description,
        description: receipt.referenceInvoiceNo,
        notes: receipt.journalEntryId ? t('مرحل محاسبياً', 'Posted to accounts') : t('غير مرحل محاسبياً', 'Not posted to accounts'),
        source: 'cash_receipt',
        sourceLabelAr: t('سند قبض', 'Cash receipt voucher'),
        isCancelled: receipt.status === 'cancelled',
        isModified: Boolean(receipt.isReplaced),
        isRefund: false,
        isArchived: Boolean(receipt.isArchived),
      });
    });

    // Sort newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allReceptionShifts, tenant?.id, currentBranchId, parties, branches, cashReceipts, t]);

  // Apply Search & Filters
  const filteredReceipts = useMemo(() => {
    return allReceipts.filter((item) => {
      if (receiptArchiveView === 'active' && item.isArchived) return false;
      if (receiptArchiveView === 'archived' && !item.isArchived) return false;
      // 1. Customer Filter
      if (selectedCustomerId !== 'all') {
        if (item.customerId !== selectedCustomerId) return false;
      }

      // 2. Source Filter
      if (selectedSource !== 'all') {
        if (item.source !== selectedSource) return false;
      }

      // 3. Payment Method Filter
      if (selectedPaymentMethod !== 'all') {
        if (!item.paymentMethod.includes(selectedPaymentMethod)) return false;
      }

      // 4. Shift Status Filter
      if (selectedShiftStatus !== 'all') {
        if (item.shiftStatus !== selectedShiftStatus) return false;
      }

      // 5. Date Range Filter
      if (startDate) {
        if (item.date < startDate) return false;
      }
      if (endDate) {
        if (item.date > endDate) return false;
      }

      // 6. Free text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesText =
          item.receiptNumber.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          (item.systemCode && item.systemCode.toLowerCase().includes(q)) ||
          (item.patientPhone && item.patientPhone.includes(q)) ||
          item.shiftNumber.toLowerCase().includes(q) ||
          item.serviceName.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q));

        if (!matchesText) return false;
      }

      const matchesColumn = (key: string, value: unknown) => {
        const query = (columnFilters[key] || '').trim().toLocaleLowerCase();
        return !query || String(value ?? '').toLocaleLowerCase().includes(query);
      };
      const columnValues: Record<string, unknown> = {
        receiptNumber: item.receiptNumber,
        date: item.date,
        customer: `${item.customerCode || ''} ${item.customerName} ${item.systemCode || ''} ${item.patientPhone || ''}`,
        branch: item.branchName,
        source: item.sourceLabelAr,
        shift: `${item.shiftNumber} ${item.shiftStatus === 'Open' ? 'مفتوح' : 'مغلق'}`,
        amount: item.collectedAmount,
        paymentMethod: item.paymentMethod,
        service: `${item.serviceName} ${item.description || ''} ${item.notes || ''}`,
        receiptStatus: `${item.isArchived ? 'مؤرشف archived' : 'نشط active'} ${item.isCancelled ? 'ملغي cancelled' : ''} ${item.isModified ? 'معدل modified' : ''} ${item.isRefund ? 'استرداد refund' : ''}`,
      };
      if (Object.entries(columnValues).some(([key, value]) => !matchesColumn(key, value))) return false;

      return true;
    });
  }, [
    allReceipts,
    selectedCustomerId,
    selectedSource,
    selectedPaymentMethod,
    selectedShiftStatus,
    startDate,
    endDate,
    searchTerm,
    columnFilters,
    receiptArchiveView,
  ]);

  const allVisibleSelected = filteredReceipts.length > 0 && filteredReceipts.every((receipt) => selectedReceiptIds.has(receipt.id));
  const handleToggleSelectAll = () => {
    setSelectedReceiptIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredReceipts.forEach((receipt) => next.delete(receipt.id));
      else filteredReceipts.forEach((receipt) => next.add(receipt.id));
      return next;
    });
  };
  const handleArchiveSelected = () => {
    const idsToArchive = filteredReceipts
      .filter((receipt) => selectedReceiptIds.has(receipt.id) && !receipt.isArchived)
      .map((receipt) => receipt.id);
    if (!idsToArchive.length) return;
    if (!window.confirm(t(`هل تريد أرشفة ${idsToArchive.length} إيصال محدد؟ لن تتغير أي بيانات مالية أو تشغيلية.`, `Archive ${idsToArchive.length} selected receipts? No financial or operational data will change.`))) return;
    archiveCollectionReceipts(idsToArchive);
    setSelectedReceiptIds((current) => {
      const next = new Set(current);
      idsToArchive.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handlePostUnpostedReceipts = () => {
    const result = postUnpostedCollectionReceipts(activeBranch?.id);
    alert(t(
      `تم ترحيل ${result.posted} سند، وتم تخطي ${result.skipped} سند لوجود قيد مرتبط به مسبقاً.`,
      `Posted ${result.posted} receipts; skipped ${result.skipped} because a related shift journal already exists.`
    ));
  };

  // KPI Calculations (Based exclusively on collected receipts, not total revenue!)
  const stats = useMemo(() => {
    const activeItems = filteredReceipts.filter((r) => !r.isCancelled);
    const totalCollected = activeItems.reduce((sum, r) => sum + r.collectedAmount, 0);
    const count = activeItems.length;

    const cashCollected = activeItems
      .filter((r) => r.paymentMethod.includes('نقداً') || r.paymentMethod.includes('كاش') || r.paymentMethod.includes('Cash'))
      .reduce((sum, r) => sum + r.collectedAmount, 0);

    const electronicCollected = activeItems
      .filter((r) => !r.paymentMethod.includes('نقداً') && !r.paymentMethod.includes('كاش') && !r.paymentMethod.includes('Cash'))
      .reduce((sum, r) => sum + r.collectedAmount, 0);

    const cancelledCount = filteredReceipts.filter((r) => r.isCancelled).length;

    return {
      totalCollected,
      count,
      cashCollected,
      electronicCollected,
      cancelledCount,
    };
  }, [filteredReceipts]);

  // Quick Date Helpers
  const handleSetDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'week') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      setStartDate(past7.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstOfMonth.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Handlers for Edit
  const handleOpenEdit = (receipt: ReceiptDisplayItem) => {
    if (!currentOpenShift) {
      alert(
        t(
          'لا يمكن تعديل الإيصال! يجب أن يكون هناك شيفت تشغيل مفتوح حالياً للفرع لتسجيل أثر التعديل في الخزينة.',
          'Cannot edit receipt! An active open reception shift is required for this branch.'
        )
      );
      return;
    }
    setSelectedReceiptForEdit(receipt);
    setEditAmount(receipt.collectedAmount);
    setEditPaymentMethod(receipt.paymentMethod);
    setEditReason('');
    setEditError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiptForEdit) return;

    if (!currentOpenShift) {
      setEditError(
        t(
          'تم رفض التعديل! لا يوجد شيفت تشغيل مفتوح حالياً للفرع لتسجيل أثر المعاملة.',
          'Operation rejected! No open shift found for the active branch.'
        )
      );
      return;
    }

    if (!editReason.trim()) {
      setEditError(t('يرجى توضيح سبب تعديل الإيصال لإثباته في سجل الرقابة!', 'Please specify reason for editing receipt!'));
      return;
    }

    const result = editCollectionReceipt({
      receiptId: selectedReceiptForEdit.id,
      sourceShiftId: selectedReceiptForEdit.sourceShiftId,
      newCollectedAmount: Number(editAmount),
      newPaymentMethod: editPaymentMethod || selectedReceiptForEdit.paymentMethod,
      reason: editReason.trim(),
    });

    if (result.success) {
      setSelectedReceiptForEdit(null);
      alert(
        selectedReceiptForEdit.shiftStatus === 'Open'
          ? t('تم تعديل الإيصال بنجاح في الشيفت المفتوح الحالي!', 'Receipt updated directly in current open shift!')
          : t(
              `تم حفظ التعديل بنجاح! نظراً لأن الشيفت الصادر منه الإيصال مغلق، تم ترحيل أثر الفرق إلى سطر منفصل في الشيفت المفتوح (${currentOpenShift.shiftNumber}).`,
              'Receipt edit adjustment posted to active open shift successfully!'
            )
      );
    } else {
      setEditError(result.error || t('حدث خطأ أثناء حفظ التعديل!', 'Error saving receipt edit!'));
    }
  };

  // Handlers for Cancel
  const handleOpenCancel = (receipt: ReceiptDisplayItem) => {
    if (!currentOpenShift) {
      alert(
        t(
          'لا يمكن إلغاء الإيصال! يجب أن يكون هناك شيفت تشغيل مفتوح حالياً للفرع لتسجيل أثر الإلغاء في الخزينة.',
          'Cannot cancel receipt! An active open reception shift is required for this branch.'
        )
      );
      return;
    }
    setSelectedReceiptForCancel(receipt);
    setCancelReason('');
    setCancelError(null);
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiptForCancel) return;

    if (!currentOpenShift) {
      setCancelError(
        t(
          'تم رفض الإلغاء! لا يوجد شيفت تشغيل مفتوح حالياً للفرع لتسجيل أثر المعاملة.',
          'Operation rejected! No open shift found for the active branch.'
        )
      );
      return;
    }

    if (!cancelReason.trim()) {
      setCancelError(t('يرجى كتابة سبب الإلغاء أو الاسترداد!', 'Please provide cancellation reason!'));
      return;
    }

    const result = cancelCollectionReceipt({
      receiptId: selectedReceiptForCancel.id,
      sourceShiftId: selectedReceiptForCancel.sourceShiftId,
      reason: cancelReason.trim(),
    });

    if (result.success) {
      setSelectedReceiptForCancel(null);
      alert(
        selectedReceiptForCancel.shiftStatus === 'Open'
          ? t('تم إلغاء الإيصال وتصفير تحصيله في الشيفت المفتوح بنجاح!', 'Receipt cancelled in open shift successfully!')
          : t(
              `تم إلغاء الإيصال بنجاح! نظراً لأن الشيفت الصادر منه مغلق، تم ترحيل استرداد التحصيل بالسالب كسطر منفصل في الشيفت المفتوح (${currentOpenShift.shiftNumber}).`,
              'Receipt cancellation posted as a negative reversal row in current open shift!'
            )
      );
    } else {
      setCancelError(result.error || t('حدث خطأ أثناء إلغاء الإيصال!', 'Error cancelling receipt!'));
    }
  };

  // Validator for Collections Excel
  const validateCollectionRows = (rawRows: any[]): ExcelValidationResult<any> => {
    const errors: CellValidationError[] = [];
    const validRows: any[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;

      const customerCode = String(row['كود العميل'] || row['Customer Code'] || '').trim();
      const matchedCustomer = parties.find((p) => (p.type === 'Customer' || p.type === 'Both' || !p.type) && [p.customerCode, p.code].some((code) => String(code || '').trim() === customerCode));
      const customerName = String(row['اسم العميل / المسدد'] || row['العميل'] || row['اسم العميل'] || row['Customer Name'] || '').trim();
      const patientPhone = String(row['رقم الهاتف'] || row['الموبايل'] || row['الهاتف'] || row['Phone Number'] || '').trim();
      const rawDate = String(row['تاريخ التحصيل'] || row['التاريخ'] || row['Collection Date'] || row['Date'] || '').trim();
      const rawAmount = row['المبلغ المحصل'] !== undefined && row['المبلغ المحصل'] !== '' ? row['المبلغ المحصل'] : (row['Collected Amount'] || row['المبلغ'] || 0);
      const paymentMethodCode = String(row['كود طريقة التحصيل'] || row['كود طريقة السداد'] || row['Payment Method Code'] || '').trim();
      const matchedPaymentMethod = paymentMethods.find((method) => String(method.code || '').trim().toLowerCase() === paymentMethodCode.toLowerCase());
      const paymentMethod = String(row['طريقة السداد'] || row['طريقة الدفع'] || row['Payment Method'] || '').trim();
      const serviceName = String(row['الخدمة / البيان'] || row['البيان'] || row['الخدمة'] || row['Service / Purpose'] || 'تحصيل نقدية').trim();
      const receiptNumber = String(row['رقم الإيصال الدفتري'] || row['رقم الإيصال'] || row['Receipt Number'] || '').trim();
      const notes = String(row['ملاحظات التحصيل'] || row['ملاحظات'] || row['Notes'] || '').trim();

      // Validate Customer Name
      if (!customerName || customerName.length < 2) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'customerName',
          columnLabelAr: 'اسم العميل / المسدد',
          enteredValue: customerName,
          reasonAr: 'اسم العميل أو المسدد إلزامي ولا يمكن تركه فارغاً',
        });
      }

      if (!customerCode || !matchedCustomer) {
        errors.push({ rowNumber: rowNum, columnKey: 'customerCode', columnLabelAr: 'كود العميل', enteredValue: customerCode, reasonAr: 'كود العميل غير موجود في إدارة العملاء. يتم التحقق من العملاء النشطين وغير النشطين.' });
      }

      // Validate Date
      let cleanDate = rawDate;
      if (rawDate.includes('T')) cleanDate = rawDate.split('T')[0];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!cleanDate || !dateRegex.test(cleanDate)) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'date',
          columnLabelAr: 'تاريخ التحصيل',
          enteredValue: rawDate,
          reasonAr: 'تاريخ التحصيل غير صحيح، يجب أن يكون بصيغة YYYY-MM-DD (مثال: 2026-10-01)',
        });
      }
      else if (cleanDate > new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)) {
        errors.push({ rowNumber: rowNum, columnKey: 'date', columnLabelAr: 'تاريخ التحصيل', enteredValue: cleanDate, reasonAr: 'تاريخ التحصيل لا يجوز أن يتجاوز تاريخ اليوم.' });
      }

      // Validate Collected Amount
      const amountNum = Number(rawAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'collectedAmount',
          columnLabelAr: 'المبلغ المحصل',
          enteredValue: rawAmount,
          reasonAr: 'المبلغ المحصل يجب أن يكون قيمة رقمية أكبر من صفر',
        });
      }

      // Validate Payment Method
      if (!paymentMethodCode || !matchedPaymentMethod) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'paymentMethod',
          columnLabelAr: 'كود طريقة التحصيل',
          enteredValue: paymentMethodCode,
          reasonAr: 'يجب إدخال كود طريقة تحصيل موجود في شاشة إدارة طرق التحصيل والسداد.',
        });
      }

      validRows.push({
        customerCode,
        customerId: matchedCustomer?.id,
        customerName,
        patientPhone,
        date: cleanDate,
        collectedAmount: Number.isFinite(amountNum) ? amountNum : 0,
        paymentMethod: matchedPaymentMethod?.nameAr || paymentMethod,
        paymentMethodCode,
        serviceName,
        receiptNumber,
        notes,
      });
    });

    const allRowsAsIs = rawRows.map((row) => {
      const customerCode = String(row['كود العميل'] || row['Customer Code'] || '').trim();
      const customer = parties.find((p) => (p.type === 'Customer' || p.type === 'Both') && [p.customerCode, p.code].some((code) => String(code || '').trim() === customerCode));
      const methodCode = String(row['كود طريقة التحصيل'] || row['كود طريقة السداد'] || row['Payment Method Code'] || '').trim();
      const method = paymentMethods.find((pm) => String(pm.code || '').trim().toLowerCase() === methodCode.toLowerCase());
      return {
        customerCode,
        customerId: customer?.id,
        customerName: String(row['اسم العميل / المسدد'] || row['العميل'] || row['اسم العميل'] || row['Customer Name'] || ''),
        patientPhone: String(row['رقم الهاتف'] || row['الموبايل'] || row['الهاتف'] || row['Phone Number'] || ''),
        date: String(row['تاريخ التحصيل'] || row['التاريخ'] || row['Collection Date'] || row['Date'] || ''),
        collectedAmount: row['المبلغ المحصل'] ?? row['Collected Amount'] ?? row['المبلغ'] ?? '',
        paymentMethod: String(row['طريقة السداد'] || row['طريقة الدفع'] || row['Payment Method'] || methodCode),
        paymentMethodCode: methodCode,
        serviceName: String(row['الخدمة / البيان'] || row['البيان'] || row['الخدمة'] || row['Service / Purpose'] || ''),
        receiptNumber: String(row['رقم الإيصال الدفتري'] || row['رقم الإيصال'] || row['Receipt Number'] || ''),
        notes: String(row['ملاحظات التحصيل'] || row['ملاحظات'] || row['Notes'] || ''),
      };
    });

    return {
      totalRows: rawRows.length,
      errors,
      validRows: errors.length === 0 ? validRows : [],
      allRowsAsIs,
    };
  };

  const handleConfirmCollectionImport = (validRows: any[]) => {
    const branchToUse = activeBranch?.id || (branches[0]?.id || 'branch-cairo');
    const result = addCollectionReceiptsBulk(validRows.map((row) => {
      const linkedPaymentMethod = paymentMethods.find((pm) => pm.code === row.paymentMethodCode);
      const paymentType = linkedPaymentMethod?.type === 'Cash' ? 'Cash' : linkedPaymentMethod?.type === 'Card' ? 'Card' : 'Transfer';
      return {
        tenantId: tenant?.id || 'tenant-eg-001',
        branchId: branchToUse,
        partyId: row.customerId,
        receivedFrom: row.customerName,
        amount: Number(row.collectedAmount),
        date: row.date,
        paymentMethod: paymentType,
        paymentMethodLabel: linkedPaymentMethod?.nameAr || row.paymentMethod,
        paymentAccountId: linkedPaymentMethod?.linkedAccountId,
        serviceName: row.serviceName,
        receiptNumber: row.receiptNumber,
        notes: row.notes,
        patientPhone: row.patientPhone,
        customerCode: row.customerCode,
        systemCode: parties.find((party) => party.id === row.customerId)?.systemCode,
      };
    }), currentOpenShift?.id);
    if (!result.success) {
      alert(result.error || t('تعذر ترحيل إيصالات التحصيل.', 'Could not post collection receipts.'));
      return;
    }
    alert(t(`تم استيراد وترحيل ${result.created} إيصال بنجاح.`, `Imported and posted ${result.created} receipts successfully.`));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/60 shadow-xs">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {t('إيصالات التحصيل', 'Collection Receipts')}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {activeBranch ? (language === 'ar' ? activeBranch.name : activeBranch.nameEn) : t('الفرع الحالي', 'Current Branch')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                'عرض ومتابعة كافة الإيصالات المحصلة من العملاء (شاشة نقطة البيع POS وشاشة التشغيل) مع إمكانية البحث والتعديل والإلغاء مع مطابقة الشيفتات المفتوحة والمغلقة.',
                'View all customer collected receipts across POS & Clinic Ops, with shift reconciliation for edits and cancellations.'
              )}
            </p>
          </div>
        </div>

        {/* Current Active Shift Status Badge */}
        <div className="flex items-center gap-2">
          {currentOpenShift ? (
            <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold block">
                  {t('شيفت التشغيل المفتوح حالياً:', 'Active Open Shift:')} {currentOpenShift.shiftNumber}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {currentOpenShift.receptionistName || t('الاستقبال', 'Reception')} • {t('متاح للتعديل والإلغاء الفوري', 'Ready for live edits/reversals')}
                </span>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold block">
                  {t('لا يوجد شيفت تشغيل مفتوح للفرع حالياً', 'No Active Open Shift for Branch')}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  {t('يجب فتح شيفت لتعديل أو إلغاء أي إيصال تحصيل', 'Open shift required to edit/cancel receipts')}
                </span>
              </div>
            </div>
          )}

          {/* Excel Import / Export Button */}
          <button
            onClick={() => setShowExcelModal(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all cursor-pointer shadow-xs"
            title={t('استيراد وتصدير التحصيلات السابقة وفحص الأخطاء', 'Import & Export Collections Excel')}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>{t('استيراد وتصدير التحصيلات (إكسل)', 'Collections Excel')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Focus strictly on Receipts Collected (قيمة التحصيل) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('إجمالي المبالغ المحصلة (قيمة التحصيل)', 'Total Collected Receipts')}
            </p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {formatMoney(stats.totalCollected)}
            </h3>
            <span className="text-[11px] text-slate-400 mt-0.5 inline-block">
              {t('قيمة المقبوضات الفعلية المسددة بالخزينة', 'Actual cash & card money received')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Count of Receipts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('عدد إيصالات التحصيل', 'Total Receipts Count')}
            </p>
            <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
              {stats.count}
            </h3>
            <span className="text-[11px] text-slate-400 mt-0.5 inline-block">
              {stats.cancelledCount > 0
                ? `${stats.cancelledCount} ${t('إيصال ملغي مستبعد', 'cancelled receipts excluded')}`
                : t('إيصالات سارية ونشطة', 'active valid receipts')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Cash Collections */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('التحصيل النقدي (كاش الخزينة)', 'Cash Collections')}
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1 font-mono">
              {formatMoney(stats.cashCollected)}
            </h3>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 inline-block font-semibold">
              {stats.totalCollected > 0
                ? `${((stats.cashCollected / stats.totalCollected) * 100).toFixed(0)}% ${t('من إجمالي التحصيل', 'of collections')}`
                : '0%'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Electronic Collections */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('التحصيل الإلكتروني (فيزا / شبكة)', 'Card & Electronic')}
            </p>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
              {formatMoney(stats.electronicCollected)}
            </h3>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 inline-block font-semibold">
              {stats.totalCollected > 0
                ? `${((stats.electronicCollected / stats.totalCollected) * 100).toFixed(0)}% ${t('من إجمالي التحصيل', 'of collections')}`
                : '0%'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        {/* Quick Date Presets */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">
              {t('الفترة الزمنية:', 'Time Period:')}
            </span>
            <button
              type="button"
              onClick={() => handleSetDatePreset('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                startDate && startDate === endDate && startDate === new Date().toISOString().split('T')[0]
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {t('اليوم', 'Today')}
            </button>
            <button
              type="button"
              onClick={() => handleSetDatePreset('yesterday')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
            >
              {t('أمس', 'Yesterday')}
            </button>
            <button
              type="button"
              onClick={() => handleSetDatePreset('week')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
            >
              {t('آخر 7 أيام', 'Last 7 Days')}
            </button>
            <button
              type="button"
              onClick={() => handleSetDatePreset('month')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
            >
              {t('هذا الشهر', 'This Month')}
            </button>
            <button
              type="button"
              onClick={() => handleSetDatePreset('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                !startDate && !endDate
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {t('كافة الفترات', 'All Time')}
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-400 font-bold">{t('من:', 'From:')}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 dark:text-white outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-400 font-bold">{t('إلى:', 'To:')}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent font-medium text-slate-800 dark:text-white outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('بحث برقم الإيصال، اسم العميل، الهاتف، أو الكود...', 'Search receipt #, customer name, phone...')}
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-blue-600 text-slate-800 dark:text-white"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-blue-600 text-slate-800 dark:text-white"
            >
              <option value="all">{t('جميع العملاء', 'All Customers')}</option>
              {branchCustomers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.name} {cust.phone ? `(${cust.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-blue-600 text-slate-800 dark:text-white"
            >
              <option value="all">{t('كافة المصادر (POS والتشغيل)', 'All Sources (POS & Ops)')}</option>
              <option value="pos">{t('نقطة البيع السريعة (POS)', 'Point of Sale (POS)')}</option>
              <option value="reception_ops">{t('شاشة التشغيل (الاستقبال)', 'Reception Ops')}</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-blue-600 text-slate-800 dark:text-white"
            >
              <option value="all">{t('كافة طرق السداد', 'All Payment Methods')}</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.nameAr}>
                  {pm.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowColumnFilters((shown) => !shown)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Filter className="h-4 w-4" />
            {showColumnFilters ? t('إخفاء فلاتر الأعمدة', 'Hide column filters') : t('فلترة حسب الأعمدة', 'Filter by columns')}
          </button>
          <select
            value={receiptArchiveView}
            onChange={(event) => setReceiptArchiveView(event.target.value as typeof receiptArchiveView)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="active">{t('الإيصالات النشطة', 'Active receipts')}</option>
            <option value="archived">{t('الإيصالات المؤرشفة', 'Archived receipts')}</option>
            <option value="all">{t('كل الإيصالات', 'All receipts')}</option>
          </select>
        </div>
        {showColumnFilters && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
            {[
              ['receiptNumber', t('رقم الإيصال', 'Receipt number')],
              ['receiptStatus', t('حالة الإيصال', 'Receipt status')],
              ['date', t('التاريخ', 'Date')],
              ['customer', t('العميل / الكود / الهاتف', 'Customer / code / phone')],
              ['branch', t('الفرع', 'Branch')],
              ['source', t('المصدر', 'Source')],
              ['shift', t('رقم الشيفت / حالته', 'Shift / status')],
              ['amount', t('قيمة التحصيل', 'Collected amount')],
              ['paymentMethod', t('طريقة التحصيل', 'Payment method')],
              ['service', t('البيان / الخدمة / الملاحظات', 'Service / description / notes')],
            ].map(([key, label]) => (
              <label key={key} className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>{label}</span>
                <input
                  value={columnFilters[key] || ''}
                  onChange={(event) => setColumnFilters((current) => ({ ...current, [key]: event.target.value }))}
                  placeholder={t('اكتب للفلترة...', 'Type to filter...')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-normal text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => setColumnFilters({})}
              className="self-end rounded-lg px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              {t('مسح فلاتر الأعمدة', 'Clear column filters')}
            </button>
          </div>
        )}
      </div>

      {/* Receipts Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-800 dark:text-white">
              {t('سجل إيصالات التحصيل المسددة للفرع', 'Recorded Customer Collection Receipts')}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filteredReceipts.length} {t('إيصال', 'receipts')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">
              {t('عرض قيمة التحصيل الفعلي المودع بالخزينة', 'Displaying actual money collected')}
            </span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {selectedReceiptIds.size ? `${selectedReceiptIds.size} ${t('محدد', 'selected')}` : ''}
            </span>
            <button
              type="button"
              onClick={handlePostUnpostedReceipts}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              <RefreshCw className="h-4 w-4" />
              {t('ترحيل غير المرحل', 'Post unposted')}
            </button>
            <button
              type="button"
              disabled={!filteredReceipts.some((receipt) => selectedReceiptIds.has(receipt.id) && !receipt.isArchived)}
              onClick={handleArchiveSelected}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-amber-700"
            >
              <Archive className="h-4 w-4" />
              {t('أرشفة المحدد', 'Archive selected')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700/60">
              <tr>
                <th className="p-3.5 px-4 text-center">
                  <input type="checkbox" aria-label={t('تحديد كل النتائج', 'Select all results')} checked={allVisibleSelected} onChange={handleToggleSelectAll} />
                </th>
                <th className="p-3.5 px-4">{t('رقم الإيصال', 'Receipt No.')}</th>
                <th className="p-3.5 px-4">{t('التاريخ', 'Date')}</th>
                <th className="p-3.5 px-4">{t('العميل', 'Customer')}</th>
                <th className="p-3.5 px-4">{t('الفرع', 'Branch')}</th>
                <th className="p-3.5 px-4">{t('المصدر', 'Source')}</th>
                <th className="p-3.5 px-4">{t('شيفت الإصدار', 'Issued Shift')}</th>
                <th className="p-3.5 px-4 text-emerald-700 dark:text-emerald-400 font-black">
                  {t('قيمة التحصيل المسددة', 'Collected Amount')}
                </th>
                <th className="p-3.5 px-4">{t('طريقة التحصيل', 'Payment Method')}</th>
                <th className="p-3.5 px-4">{t('البيان / الخدمة', 'Service / Description')}</th>
                <th className="p-3.5 px-4 text-center">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2 opacity-50" />
                    <p className="font-bold text-sm">{t('لا توجد إيصالات تحصيل مطابقة للشروط المحددة', 'No matching collection receipts found')}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {t('جرّب تغيير الفترة الزمنية أو إزالة فلاتر البحث', 'Try adjusting date range or clear search filters')}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((item) => {
                  const isCurrentShiftOpen = currentOpenShift && currentOpenShift.id === item.sourceShiftId;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                        item.isCancelled ? 'opacity-50 bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="p-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${t('تحديد الإيصال', 'Select receipt')} ${item.receiptNumber}`}
                          checked={selectedReceiptIds.has(item.id)}
                          onChange={(event) => setSelectedReceiptIds((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            return next;
                          })}
                        />
                      </td>
                      {/* Receipt Number */}
                      <td className="p-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{item.receiptNumber}</span>
                          {item.isArchived && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                              {t('مؤرشف', 'Archived')}
                            </span>
                          )}
                          {item.isCancelled && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              {t('ملغي', 'Cancelled')}
                            </span>
                          )}
                          {item.isModified && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              {t('معدل', 'Modified')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div>{item.date}</div>
                        {item.dayName && <span className="text-[10px] text-slate-400">{item.dayName}</span>}
                      </td>

                      {/* Customer */}
                      <td className="p-3.5 px-4">
                        <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{t('كود العميل', 'Customer Code')}: {item.customerCode || '—'}</div>
                        <div className="font-bold text-slate-900 dark:text-white">{item.customerName}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          {item.systemCode && <span>{item.systemCode}</span>}
                          {item.patientPhone && <span>{item.patientPhone}</span>}
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="p-3.5 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">{item.branchName}</td>

                      {/* Source */}
                      <td className="p-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.source === 'pos'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {item.sourceLabelAr}
                        </span>
                      </td>

                      {/* Shift Number & Status */}
                      <td className="p-3.5 px-4">
                        <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {item.shiftNumber}
                        </div>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            item.shiftStatus === 'Open'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.shiftStatus === 'Open' ? t('شيفت مفتوح حالياً', 'Open') : t('شيفت مغلق', 'Closed')}
                        </span>
                      </td>

                      {/* Collected Amount (التحصيل وليس الإيراد) */}
                      <td className="p-3.5 px-4 font-mono font-black text-sm">
                        <span
                          className={
                            item.collectedAmount < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : item.isCancelled
                              ? 'line-through text-slate-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {formatMoney(item.collectedAmount)}
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="p-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          {item.paymentMethod}
                        </span>
                      </td>

                      {/* Description & Service */}
                      <td className="p-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.serviceName}>
                          {item.serviceName}
                        </div>
                        {item.description && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5" title={item.description}>
                            {item.description}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 truncate mt-0.5" title={item.notes}>
                            {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Actions: Edit & Cancel */}
                      <td className="p-3.5 px-4 text-center whitespace-nowrap">
                        {item.source === 'cash_receipt' ? (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            {item.notes?.includes('Not posted') || item.notes?.includes('غير مرحل')
                              ? t('بانتظار الترحيل', 'Awaiting posting')
                              : t('سند قبض', 'Cash receipt voucher')}
                          </span>
                        ) : !item.isCancelled ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              title={
                                item.shiftStatus === 'Open'
                                  ? t('تعديل الإيصال مباشرة في الشيفت المفتوح', 'Edit directly in open shift')
                                  : t('تعديل الإيصال وترحيل الفرق للشيفت المفتوح الحالي', 'Edit and post diff to active open shift')
                              }
                              className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Cancel Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenCancel(item)}
                              title={
                                item.shiftStatus === 'Open'
                                  ? t('إلغاء الإيصال وتصفير التحصيل في الشيفت المفتوح', 'Cancel receipt in open shift')
                                  : t('إلغاء الإيصال واسترداد القيمة في الشيفت المفتوح الحالي', 'Cancel and refund in active open shift')
                              }
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">
                            {t('ملغي ومسترد', 'Cancelled')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Edit Receipt (تعديل الإيصال) */}
      {selectedReceiptForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {t('تعديل إيصال التحصيل', 'Edit Collection Receipt')}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedReceiptForEdit.receiptNumber}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptForEdit(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shift Context Notice */}
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
                selectedReceiptForEdit.shiftStatus === 'Open'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <InfoIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                {selectedReceiptForEdit.shiftStatus === 'Open' ? (
                  <>
                    <span className="font-bold block">
                      {t('الشيفت المصدر ما زال مفتوحاً', 'Source shift is currently OPEN')}: {selectedReceiptForEdit.shiftNumber}
                    </span>
                    <p className="mt-0.5 text-[11px] leading-relaxed">
                      {t(
                        'سيتم تعديل قيمة التحصيل مباشرة في نفس الشيفت المفتوح وتحديث إجماليات الخزينة ومطابقة الدرج آلياً.',
                        'The collected amount will update directly in this open shift, updating balancing totals live.'
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="font-bold block">
                      {t('الشيفت المصدر مغلق!', 'Source shift is CLOSED!')}: {selectedReceiptForEdit.shiftNumber}
                    </span>
                    <p className="mt-0.5 text-[11px] leading-relaxed">
                      {t(
                        `نظراً لإغلاق الشيفت الأصلي، سيتم الحفاظ على بياناته التاريخية، وسيظهر أثر التعديل (فرق التحصيل) كسطر تسوية منفصل في الشيفت الحالي المفتوح (${currentOpenShift?.shiftNumber}).`,
                        `Original shift history remains intact. The adjustment difference will appear as a separate line in the currently active open shift (${currentOpenShift?.shiftNumber}).`
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Error Message */}
            {editError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              {/* Customer and original data */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>{t('العميل:', 'Customer:')}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedReceiptForEdit.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('قيمة التحصيل الأصلية:', 'Original Collected Amount:')}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatMoney(selectedReceiptForEdit.collectedAmount)}
                  </span>
                </div>
              </div>

              {/* New Collected Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('قيمة التحصيل الجديدة (ج.م) *', 'New Collected Amount *')}
                </label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-black font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-blue-600 text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  {t('الفرق الناتج عن التعديل:', 'Difference:')}{' '}
                  <span className="font-mono font-bold">
                    {formatMoney(Number(editAmount) - selectedReceiptForEdit.collectedAmount)}
                  </span>
                </span>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('طريقة التحصيل *', 'Payment Method *')}
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-blue-600 text-slate-800 dark:text-white"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.nameAr}>
                      {pm.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason for Edit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('سبب التعديل (إلزامي للرقابة والتدقيق) *', 'Reason for Edit *')}
                </label>
                <textarea
                  rows={2}
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder={t('اكتب سبب تعديل قيمة الإيصال أو وسيلة السداد...', 'Write reason for modifying this receipt...')}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-blue-600 text-slate-800 dark:text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedReceiptForEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  {t('إلغاء التراجع', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer shadow-xs"
                >
                  {t('حفظ التعديل وترحيل الأثر', 'Save & Post Adjustment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Cancel Receipt (إلغاء الإيصال) */}
      {selectedReceiptForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-600 dark:text-rose-400">
                    {t('إلغاء إيصال التحصيل', 'Cancel Collection Receipt')}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedReceiptForCancel.receiptNumber}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptForCancel(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Details */}
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
              <span className="font-bold block">
                {t('تنبيه هام بشأن إلغاء واسترداد التحصيل:', 'Important notice regarding receipt cancellation:')}
              </span>
              <p className="leading-relaxed text-[11px]">
                {selectedReceiptForCancel.shiftStatus === 'Open'
                  ? t(
                      `هذا الإيصال تابع لشيفت تشغيل مفتوح حالياً (${selectedReceiptForCancel.shiftNumber}). سيتم إلغاؤه فوراً وتصفير قيمته المحصلة (${formatMoney(selectedReceiptForCancel.collectedAmount)}) من رصيد الخزينة.`,
                      'This receipt belongs to an OPEN shift. It will be cancelled and zeroed out directly.'
                    )
                  : t(
                      `هذا الإيصال صادر من شيفت تشغيل مغلق (${selectedReceiptForCancel.shiftNumber}). سيتم ترحيل استرداد كامل التحصيل بالسالب (-${formatMoney(selectedReceiptForCancel.collectedAmount)}) كسطر استرداد منفصل في الشيفت المفتوح حالياً (${currentOpenShift?.shiftNumber}).`,
                      'Issued from a CLOSED shift. A negative refund line will be posted to the active open shift.'
                    )}
              </p>
            </div>

            {/* Error Message */}
            {cancelError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-3.5">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>{t('العميل:', 'Customer:')}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedReceiptForCancel.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('المبلغ المراد إلغاؤه واسترداده:', 'Amount to be Cancelled & Refunded:')}</span>
                  <span className="font-mono font-black text-rose-600">
                    {formatMoney(selectedReceiptForCancel.collectedAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('سبب إلغاء الإيصال (إلزامي للرقابة المالية) *', 'Cancellation Reason *')}
                </label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t('اكتب سبب الإلغاء أو الاسترداد بالتفصيل...', 'Write detailed cancellation/refund reason...')}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-rose-600 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedReceiptForCancel(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  {t('تراجع', 'Back')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer shadow-xs"
                >
                  {t('تأكيد إلغاء الإيصال وترحيل الأثر', 'Confirm Cancellation & Post Reversal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL DATA TRANSFER & VALIDATION MODAL FOR COLLECTIONS */}
      <ExcelDataTransferModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        entityTitleAr="سندات وإيصالات التحصيل"
        entityTitleEn="Collection Receipts & Inflows"
        descriptionAr="استيراد وتصدير إيصالات التحصيل السابقة مع الفحص الخلوي الذكي لمطابقة المبالغ والعملاء"
        columns={collectionExcelColumns}
        currentDataForExport={filteredReceipts.map((r) => ({
          customerCode: r.customerCode || parties.find((p) => p.id === r.customerId)?.customerCode || parties.find((p) => p.id === r.customerId)?.code || '',
          paymentMethodCode: paymentMethods.find((pm) => pm.nameAr === r.paymentMethod || pm.nameEn === r.paymentMethod)?.code || '',
          customerName: r.customerName,
          patientPhone: r.patientPhone || '',
          date: r.date,
          collectedAmount: r.collectedAmount,
          paymentMethod: r.paymentMethod,
          serviceName: r.serviceName,
          receiptNumber: r.receiptNumber,
          notes: r.notes || '',
        }))}
        exportFileNamePrefix="سجل_إيصالات_التحصيل"
        validator={validateCollectionRows}
        onConfirmImport={handleConfirmCollectionImport}
        branchName={activeBranch?.name || 'الفرع الحالي'}
      />
    </div>
  );
};

// Internal icon helper
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);
