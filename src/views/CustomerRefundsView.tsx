import React, { useMemo, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Party, ClientOffer } from '../types';
import { exportRowsToExcel } from '../utils/excelExport';
import {
  Undo2,
  Plus,
  Search,
  X,
  Building2,
  Calendar,
  Download,
  Upload,
  Trash2,
} from 'lucide-react';

import {
  ExcelDataTransferModal,
  ExcelColumnConfig,
  CellValidationError,
  ExcelValidationResult,
} from '../components/ExcelDataTransferModal';

const refundExcelColumns: ExcelColumnConfig[] = [
  { key: 'customerCode', labelAr: 'كود العميل', labelEn: 'Customer Code', required: true, type: 'text', sampleValue: '1', instructions: 'الكود المسلسل الآلي للعميل من شاشة إدارة العملاء' },
  { key: 'customerName', labelAr: 'اسم العميل', labelEn: 'Customer Name', required: true, type: 'text', sampleValue: 'أحمد محمود', instructions: 'الاسم الكامل للعميل' },
  { key: 'amount', labelAr: 'القيمة المستردة', labelEn: 'Refund Value', required: true, type: 'number', sampleValue: 500, instructions: 'القيمة المستردة بالجنيه (رقم موجب أكبر من صفر)' },
  { key: 'units', labelAr: 'عدد الوحدات', labelEn: 'Units', required: false, type: 'number', sampleValue: 2, instructions: 'عدد الوحدات المستردة (اختياري)' },
  { key: 'unitPrice', labelAr: 'سعر الوحدة', labelEn: 'Unit Price', required: false, type: 'number', sampleValue: 250, instructions: 'سعر الوحدة (اختياري)' },
  { key: 'serviceName', labelAr: 'الخدمة', labelEn: 'Service', required: false, type: 'text', sampleValue: 'استرداد جلسة ليزر', instructions: 'اسم الخدمة أو البند (اختياري)' },
  { key: 'date', labelAr: 'تاريخ الاسترداد', labelEn: 'Refund Date', required: false, type: 'date', sampleValue: '2026-10-11', instructions: 'تاريخ الاسترداد بصيغة YYYY-MM-DD (افتراضيًا تاريخ اليوم)' },
  { key: 'paymentMethodCode', labelAr: 'كود طريقة الصرف', labelEn: 'Payment Method Code', required: false, type: 'text', sampleValue: 'PM-01', instructions: 'كود طريقة الصرف (اختياري، افتراضيًا أول طريقة)' },
  { key: 'notes', labelAr: 'ملاحظات', labelEn: 'Notes', required: false, type: 'text', sampleValue: '', instructions: 'ملاحظات إضافية (اختياري)' },
];

export const CustomerRefundsView: React.FC = () => {
  const {
    t,
    formatMoney,
    language,
    tenant,
    activeBranch,
    branches,
    parties,
    paymentMethods,
    customerRefunds,
    addCustomerRefund,
    cancelCustomerRefund,
  } = usePlatform();

  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showAllBranches, setShowAllBranches] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [search, setSearch] = useState<string>('');

  // New refund modal state
  const [showModal, setShowModal] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [units, setUnits] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [refundDate, setRefundDate] = useState(today);
  const [serviceName, setServiceName] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Excel import modal
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const activeBranchId = activeBranch?.id;

  // Filter refunds by branch (supports showing all branches or active branch)
  const branchRefunds = useMemo(() => {
    if (showAllBranches || !activeBranchId) return customerRefunds;
    return customerRefunds.filter((refund) => refund.branchId === activeBranchId);
  }, [customerRefunds, activeBranchId, showAllBranches]);

  const filteredRefunds = useMemo(() => {
    const q = search.toLowerCase().trim();
    return branchRefunds
      .filter((refund) => {
        if (dateFrom && refund.date < dateFrom) return false;
        if (dateTo && refund.date > dateTo) return false;
        if (statusFilter !== 'all' && refund.status !== statusFilter) return false;
        if (!q) return true;
        return (
          refund.customerName.toLowerCase().includes(q) ||
          (refund.customerCode && refund.customerCode.toLowerCase().includes(q)) ||
          (refund.systemCode && refund.systemCode.toLowerCase().includes(q)) ||
          (refund.voucherNumber && refund.voucherNumber.toLowerCase().includes(q)) ||
          (refund.serviceName && refund.serviceName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [branchRefunds, dateFrom, dateTo, statusFilter, search]);

  const totalRefundValue = useMemo(
    () => filteredRefunds.filter((r) => r.status === 'active').reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [filteredRefunds]
  );
  const totalRefundUnits = useMemo(
    () => filteredRefunds.filter((r) => r.status === 'active').reduce((sum, r) => sum + Number(r.units || 0), 0),
    [filteredRefunds]
  );

  // Customer search (name / customer code / system code / file code / paper code / phone)
  const matchedParties = useMemo(() => {
    const q = customerQuery.toLowerCase().trim();
    const customers = parties.filter((p) => p.type === 'Customer' || p.type === 'Both');
    if (!q) return customers.slice(0, 50);
    return customers
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (p.customerCode && p.customerCode.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.systemCode && p.systemCode.toLowerCase().includes(q)) ||
        (p.paperCode && p.paperCode.toLowerCase().includes(q)) ||
        (p.fileCode && p.fileCode.toLowerCase().includes(q)) ||
        (p.fileNumber && p.fileNumber.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q)) ||
        (p.altPhone && p.altPhone.includes(q))
      )
      .slice(0, 50);
  }, [parties, customerQuery]);

  const selectedParty: Party | undefined = useMemo(
    () => parties.find((p) => p.id === selectedPartyId),
    [parties, selectedPartyId]
  );

  const selectedPartyRemainingUnits = useMemo(() => {
    if (!selectedParty?.offers) return 0;
    return selectedParty.offers.reduce((sum: number, offer: ClientOffer) => sum + Number(offer.remainingQuantity || 0), 0);
  }, [selectedParty]);

  const computedAmount = useMemo(() => {
    const u = Number(units) || 0;
    const p = Number(unitPrice) || 0;
    return Number((u * p).toFixed(2));
  }, [units, unitPrice]);

  const effectiveAmount = amountTouched ? amount : String(computedAmount || '');

  const openModal = () => {
    setCustomerQuery('');
    setSelectedPartyId('');
    setUnits('1');
    setUnitPrice('');
    setAmount('');
    setAmountTouched(false);
    setPaymentMethodId(paymentMethods[0]?.id || '');
    setRefundDate(today);
    setServiceName('');
    setNotes('');
    setFormError(null);
    setShowModal(true);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedParty) {
      setFormError(t('يرجى اختيار العميل.', 'Please select the customer.'));
      return;
    }
    const unitsNum = Number(units) || 0;
    const unitPriceNum = Number(unitPrice) || 0;
    const amountNum = Number(effectiveAmount) || 0;
    if (!serviceName.trim()) {
      setFormError(t('يرجى إدخال الخدمة.', 'Please enter the service.'));
      return;
    }
    if (unitsNum <= 0) {
      setFormError(t('عدد الوحدات المستردة يجب أن يكون أكبر من صفر.', 'Refunded units must be greater than zero.'));
      return;
    }
    if (amountNum <= 0) {
      setFormError(t('القيمة المستردة يجب أن تكون أكبر من صفر.', 'Refund value must be greater than zero.'));
      return;
    }
    const matchedMethod = paymentMethods.find((m) => m.id === paymentMethodId) || paymentMethods[0];
    const result = addCustomerRefund({
      tenantId: tenant?.id || 'tenant-eg-001',
      branchId: activeBranchId || branches[0]?.id || '',
      partyId: selectedParty.id,
      units: unitsNum,
      unitPrice: unitPriceNum,
      amount: amountNum,
      date: refundDate,
      paymentMethodId: matchedMethod?.id,
      paymentMethodLabel: matchedMethod?.nameAr || matchedMethod?.nameEn || t('نقداً (كاش)', 'Cash'),
      paymentAccountId: matchedMethod?.linkedAccountId,
      serviceName: serviceName.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (!result.success) {
      setFormError(result.error || t('تعذر تسجيل الاسترداد.', 'Could not record the refund.'));
      return;
    }
    setShowModal(false);
    setNotice(t(
      `تم تسجيل سند الاسترداد ${result.refund?.voucherNumber} بقيمة ${formatMoney(amountNum)} و${unitsNum} وحدة، وترحيله في كشف حساب العميل والحسابات.`,
      `Refund ${result.refund?.voucherNumber} recorded for ${formatMoney(amountNum)} and ${unitsNum} units, posted to the customer account and ledgers.`
    ));
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    setCancelError(null);
    const result = cancelCustomerRefund(cancelTarget, cancelReason);
    if (!result.success) {
      setCancelError(result.error || t('تعذر إلغاء الاسترداد.', 'Could not cancel the refund.'));
      return;
    }
    setCancelTarget(null);
    setCancelReason('');
    setNotice(t('تم إلغاء سند الاسترداد وعكس أثره المحاسبي.', 'Refund voucher cancelled and its accounting effect reversed.'));
  };

  const exportRefunds = () => {
    exportRowsToExcel({
      filename: 'تسوية_مستحقات_عملاء',
      sheetName: 'Customer Refunds',
      headers: ['رقم السند', 'التاريخ', 'العميل', 'كود العميل', 'كود السيستم', 'الخدمة', 'عدد الوحدات', 'سعر الوحدة', 'القيمة', 'طريقة الصرف', 'الحالة'],
      rows: filteredRefunds.map((r) => [
        r.voucherNumber,
        r.date,
        r.customerName,
        r.customerCode || '',
        r.systemCode || '',
        r.serviceName || '',
        Number(r.units || 0),
        Number(r.unitPrice || 0),
        Number(r.amount || 0),
        r.paymentMethodLabel,
        r.status === 'active' ? t('نشط', 'Active') : t('ملغي', 'Cancelled'),
      ]),
    });
  };

  const validateRefundRows = (rawRows: any[]): ExcelValidationResult<any> => {
    const errors: CellValidationError[] = [];
    const validRows: any[] = [];
    const allRowsAsIs: any[] = [];
    rawRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errorsBefore = errors.length;
      const customerCode = String(row['كود العميل'] || row['Customer Code'] || '').trim();
      const normCustomerCode = customerCode.replace(/^0+/, '');
      const customerName = String(row['اسم العميل'] || row['Customer Name'] || row['العميل'] || '').trim();
      const amountRaw = row['القيمة المستردة'] ?? row['Refund Value'] ?? row['القيمة'] ?? '';
      const amountNum = Number(amountRaw);
      const matchedCustomer = parties.find((p) => {
        if (p.type !== 'Customer' && p.type !== 'Both') return false;
        const pCustCode = String(p.customerCode || '').trim();
        const pCode = String(p.code || '').trim();
        const pSysCode = String(p.systemCode || '').trim();
        return (
          (customerCode && (
            pCustCode === customerCode ||
            pCustCode.replace(/^0+/, '') === normCustomerCode ||
            pCode === customerCode ||
            pCode.replace(/^0+/, '') === normCustomerCode ||
            pSysCode.toLowerCase() === customerCode.toLowerCase()
          )) ||
          (customerName && p.name.trim().toLowerCase() === customerName.toLowerCase())
        );
      });
      if (!customerCode && !matchedCustomer) {
        errors.push({ rowNumber, columnKey: 'customerCode', columnLabelAr: 'كود العميل', enteredValue: customerCode, reasonAr: 'كود العميل المسلسل مطلوب ويجب أن يكون موجودًا في إدارة العملاء.' });
      }
      if (!customerName || customerName.length < 2) {
        errors.push({ rowNumber, columnKey: 'customerName', columnLabelAr: 'اسم العميل', enteredValue: customerName, reasonAr: 'اسم العميل مطلوب.' });
      }
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        errors.push({ rowNumber, columnKey: 'amount', columnLabelAr: 'القيمة المستردة', enteredValue: amountRaw, reasonAr: 'القيمة المستردة يجب أن تكون رقمًا أكبر من صفر.' });
      }
      // Date is optional during import: the posted date is the upload date and the
      // value written in the file is preserved in the notes.
      const dateRaw = String(row['تاريخ الاسترداد'] ?? row['Refund Date'] ?? '').trim();
      let cleanDate = dateRaw;
      if (dateRaw.includes('T')) cleanDate = dateRaw.split('T')[0];
      const parsed = {
        customerId: matchedCustomer?.id,
        customerCode: matchedCustomer?.customerCode || matchedCustomer?.code || customerCode,
        customerName: matchedCustomer?.name || customerName,
        amount: Number.isFinite(amountNum) ? amountNum : 0,
        units: Number(row['عدد الوحدات'] ?? row['Units'] ?? '') || 0,
        unitPrice: Number(row['سعر الوحدة'] ?? row['Unit Price'] ?? '') || 0,
        serviceName: String(row['الخدمة'] ?? row['Service'] ?? '').trim(),
        date: cleanDate,
        fileDate: cleanDate,
        paymentMethodCode: String(row['كود طريقة الصرف'] ?? row['Payment Method Code'] ?? '').trim(),
        notes: String(row['ملاحظات'] ?? row['Notes'] ?? '').trim(),
      };
      allRowsAsIs.push(parsed);
      if (errors.length === errorsBefore) validRows.push(parsed);
    });
    return { totalRows: rawRows.length, errors, totalErrorsCount: errors.length, validRows, allRowsAsIs };
  };

  const handleConfirmRefundImport = (rows: any[]): boolean => {
    let successCount = 0;
    const failures: string[] = [];
    rows.forEach((row, index) => {
      const matchedMethod = paymentMethods.find((m) => String(m.code || '').trim().toLowerCase() === String(row.paymentMethodCode || '').trim().toLowerCase()) || paymentMethods[0];
      const units = Number(row.units) > 0 ? Number(row.units) : 1;
      const unitPrice = Number(row.unitPrice) > 0 ? Number(row.unitPrice) : Number((Number(row.amount) / units).toFixed(2));
      const actualFileDate = row.fileDate || row.date;
      const result = addCustomerRefund({
        tenantId: tenant?.id || 'tenant-eg-001',
        branchId: activeBranchId || branches[0]?.id || '',
        partyId: row.customerId,
        units,
        unitPrice,
        amount: Number(row.amount),
        date: today,
        paymentMethodId: matchedMethod?.id,
        paymentMethodLabel: matchedMethod?.nameAr || matchedMethod?.nameEn || t('نقداً (كاش)', 'Cash'),
        paymentAccountId: matchedMethod?.linkedAccountId,
        serviceName: row.serviceName || undefined,
        notes: [row.notes, actualFileDate ? `تاريخ المستند: ${actualFileDate}` : ''].filter(Boolean).join(' - ') || undefined,
      });
      if (result.success) successCount += 1;
      else failures.push(`${index + 2}: ${result.error}`);
    });
    setNotice(t(
      `تم استيراد ${successCount} سند استرداد بنجاح.${failures.length ? ` فشل ${failures.length} سطر.` : ''}`,
      `Imported ${successCount} refund voucher(s).${failures.length ? ` ${failures.length} row(s) failed.` : ''}`
    ));
    return successCount > 0;
  };

  return (
    <div className="space-y-5 p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/25">
            <Undo2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">
              {t('تسوية مستحقات عميل', 'Customer Dues Settlement')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('استردادات العملاء بالقيمة والكمية، مرحلة مباشرة في كشف الحساب والحسابات.', 'Customer refunds by value and quantity, posted directly to the statement and ledgers.')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAllBranches(!showAllBranches)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
              showAllBranches
                ? 'border-indigo-300 bg-indigo-600 text-white shadow-xs'
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
            title={t('التبديل بين عرض حركات الفرع الحالي أو كافة فروع الشركة', 'Toggle between active branch and all branches')}
          >
            <Building2 className="h-3.5 w-3.5" />
            {showAllBranches ? t('كافة الفروع', 'All Branches') : (activeBranch?.name || t('الفرع المفعّل', 'Active branch'))}
          </button>
          <button
            type="button"
            onClick={() => setShowExcelModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
          >
            <Upload className="h-3.5 w-3.5" />
            {t('استيراد Excel', 'Import Excel')}
          </button>
          <button
            type="button"
            onClick={exportRefunds}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <Download className="h-3.5 w-3.5" />
            {t('تصدير Excel', 'Export Excel')}
          </button>
          <button
            type="button"
            onClick={openModal}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
          >
            <Plus className="h-4 w-4" />
            {t('تسجيل استرداد', 'Record Refund')}
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
          {notice}
        </p>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('إجمالي قيمة الاستردادات (نشطة):', 'Total refunded value (active):')}</span>
          <p className="mt-1 text-lg font-black font-mono text-rose-600">{formatMoney(totalRefundValue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('إجمالي الوحدات المستردة (نشطة):', 'Total refunded units (active):')}</span>
          <p className="mt-1 text-lg font-black font-mono text-blue-600">{totalRefundUnits}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('عدد السندات المعروضة:', 'Vouchers shown:')}</span>
          <p className="mt-1 text-lg font-black font-mono text-slate-800 dark:text-white">{filteredRefunds.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <span className="text-xs text-slate-400">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button type="button" onClick={() => { setDateFrom(today); setDateTo(today); }} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            {t('اليوم', 'Today')}
          </button>
          <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            {t('الكل', 'All')}
          </button>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'cancelled')}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">{t('كل الحالات', 'All statuses')}</option>
            <option value="active">{t('نشط', 'Active')}</option>
            <option value="cancelled">{t('ملغي', 'Cancelled')}</option>
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('ابحث برقم السند أو العميل أو الكود...', 'Search by voucher, customer or code...')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {filteredRefunds.length === 0 && customerRefunds.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="font-bold">
              {t(`تنبيه: يوجد ${customerRefunds.length} حركة تسوية مسجلة في النظام غير ظاهرة حالياً بسبب فلتر التاريخ أو الفرع.`, `Notice: There are ${customerRefunds.length} recorded refund movements in the system currently filtered out by date or branch.`)}
            </span>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
              {t('انقر على الزر المجاور لعرض كل الحركات لكافة الفروع وكافة التواريخ فوراً.', 'Click the button to show all transactions across all branches and all dates immediately.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setDateFrom(''); setDateTo(''); setShowAllBranches(true); setSearch(''); setStatusFilter('all'); }}
            className="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs cursor-pointer"
          >
            {t('عرض كافة الحركات والفروع والتواريخ الآن', 'Show All Movements & Dates Now')}
          </button>
        </div>
      )}

      {/* Refunds table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                <th className="py-3 px-3 font-bold text-start">{t('رقم السند', 'Voucher')}</th>
                <th className="py-3 px-3 font-bold text-start">{t('التاريخ', 'Date')}</th>
                <th className="py-3 px-3 font-bold text-start">{t('العميل', 'Customer')}</th>
                <th className="py-3 px-3 font-bold text-start">{t('الخدمة', 'Service')}</th>
                <th className="py-3 px-3 font-bold text-center">{t('الوحدات', 'Units')}</th>
                <th className="py-3 px-3 font-bold text-end">{t('سعر الوحدة', 'Unit Price')}</th>
                <th className="py-3 px-3 font-bold text-end">{t('القيمة المستردة', 'Refund Value')}</th>
                <th className="py-3 px-3 font-bold text-start">{t('طريقة الصرف', 'Method')}</th>
                <th className="py-3 px-3 font-bold text-center">{t('الحالة', 'Status')}</th>
                <th className="py-3 px-3 font-bold text-center">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRefunds.map((refund) => (
                <tr key={refund.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-mono font-bold text-rose-600">{refund.voucherNumber}</td>
                  <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">{refund.date}</td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-800 dark:text-slate-200">{refund.customerName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {[refund.customerCode, refund.systemCode].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{refund.serviceName || '—'}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-blue-600">{refund.units}</td>
                  <td className="py-3 px-3 text-end font-mono text-slate-600 dark:text-slate-300">{formatMoney(refund.unitPrice)}</td>
                  <td className="py-3 px-3 text-end font-mono font-black text-rose-600">{formatMoney(refund.amount)}</td>
                  <td className="py-3 px-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {refund.paymentMethodLabel}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {refund.status === 'active' ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{t('نشط', 'Active')}</span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{t('ملغي', 'Cancelled')}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {refund.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => { setCancelTarget(refund.id); setCancelReason(''); setCancelError(null); }}
                        title={t('إلغاء الاسترداد', 'Cancel refund')}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRefunds.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    {t('لا توجد استردادات مطابقة للفلاتر المحددة.', 'No refunds match the selected filters.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New refund modal */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {t('تسجيل استرداد عميل', 'Record Customer Refund')}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer search */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('ابحث عن العميل (الاسم / كود العميل / كود السيستم / كود الملف / الهاتف)', 'Search customer (name / customer code / system code / file code / phone)')}
                </label>
                <div className="relative">
                  <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder={t('اكتب للبحث...', 'Type to search...')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  {matchedParties.map((party) => (
                    <button
                      key={party.id}
                      type="button"
                      onClick={() => setSelectedPartyId(party.id)}
                      className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-start text-xs last:border-b-0 dark:border-slate-800 ${
                        selectedPartyId === party.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200">{party.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {[party.customerCode || party.code, party.systemCode, party.fileCode, party.phone].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  ))}
                  {matchedParties.length === 0 && (
                    <p className="p-3 text-center text-xs text-slate-400">{t('لا يوجد عملاء مطابقون.', 'No matching customers.')}</p>
                  )}
                </div>
              </div>

              {selectedParty && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500">{t('الرصيد بالقيمة:', 'Balance (value):')}</span>
                    <span className="font-mono text-sm font-black text-slate-800 dark:text-white">{formatMoney(selectedParty.balance)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500">{t('الرصيد بالكمية (وحدات متبقية):', 'Balance (units remaining):')}</span>
                    <span className="font-mono text-sm font-black text-purple-600">{selectedPartyRemainingUnits}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{t('عدد الوحدات المستردة *', 'Refunded units *')}</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{t('سعر الوحدة *', 'Unit price *')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{t('القيمة المستردة *', 'Refund value *')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={effectiveAmount}
                    onChange={(e) => { setAmount(e.target.value); setAmountTouched(true); }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black font-mono text-rose-600 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{t('طريقة الصرف *', 'Payment method *')}</label>
                  <select
                    value={paymentMethodId}
                    onChange={(e) => setPaymentMethodId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>{m.nameAr || m.nameEn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{t('تاريخ الاسترداد *', 'Refund date *')}</label>
                  <input
                    type="date"
                    value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{t('الخدمة / البند *', 'Service / Item *')}</label>
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{t('ملاحظات', 'Notes')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                {t('سيتم ترحيل: حساب العميل مدين / الحساب المربوط بطريقة الصرف دائن، وتحديث كشف الحساب بالقيمة والكمية.', 'Posting: customer account debit / payment-method account credit, updating the statement in value and quantity.')}
              </p>

              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                  {t('إلغاء', 'Cancel')}
                </button>
                <button type="submit" className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">
                  {t('حفظ وترحيل', 'Save & Post')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel refund modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-base font-black text-slate-900 dark:text-white">{t('إلغاء سند الاسترداد', 'Cancel Refund Voucher')}</h2>
            {cancelError && (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">{cancelError}</p>
            )}
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{t('سبب الإلغاء *', 'Cancellation reason *')}</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setCancelTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                {t('رجوع', 'Back')}
              </button>
              <button type="button" onClick={handleCancel} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">
                {t('تأكيد الإلغاء', 'Confirm cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ExcelDataTransferModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        entityTitleAr="تسوية مستحقات عميل (استردادات)"
        entityTitleEn="Customer Refunds"
        descriptionAr="استيراد سندات الاسترداد: الشروط اللازمة كود العميل المسلسل + اسم العميل + القيمة، وباقي الأعمدة اختيارية."
        columns={refundExcelColumns}
        currentDataForExport={filteredRefunds.map((r) => ({
          customerCode: r.customerCode || '',
          customerName: r.customerName,
          amount: r.amount,
          units: r.units,
          unitPrice: r.unitPrice,
          serviceName: r.serviceName || '',
          date: r.date,
          paymentMethodCode: paymentMethods.find((m) => m.nameAr === r.paymentMethodLabel || m.nameEn === r.paymentMethodLabel)?.code || '',
          notes: r.notes || '',
        }))}
        exportFileNamePrefix="سجل_استردادات_العملاء"
        validator={validateRefundRows}
        onConfirmImport={handleConfirmRefundImport}
        branchName={activeBranch?.name || 'الفرع الحالي'}
      />
    </div>
  );
};
