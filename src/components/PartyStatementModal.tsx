import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Party } from '../types';
import {
  FileText,
  Printer,
  Calendar,
  Search,
  Filter,
  X,
  Phone,
  Hash,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  User,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface PartyStatementModalProps {
  initialPartyId?: string | null;
  onClose: () => void;
}

interface StatementLine {
  id: string;
  date: string;
  docNumber: string;
  docType: 'Invoice' | 'ShiftSession' | 'ExpensePayment' | 'JournalEntry';
  docTypeAr: string;
  description: string;
  debit: number; // مدين
  credit: number; // دائن
  paymentMethod?: string;
  runningBalance: number; // الرصيد التراكمي
}

export const PartyStatementModal: React.FC<PartyStatementModalProps> = ({
  initialPartyId,
  onClose,
}) => {
  const {
    t,
    formatMoney,
    language,
    tenant,
    activeBranch,
    parties,
    invoices,
    receptionShifts,
    journalEntries,
    deviceMaintenanceRecords,
  } = usePlatform();

  const [selectedPartyId, setSelectedPartyId] = useState<string>(
    initialPartyId || (parties.length > 0 ? parties[0].id : '')
  );
  const [partyTypeFilter, setPartyTypeFilter] = useState<'ALL' | 'Customer' | 'Supplier'>('ALL');
  const [partySearch, setPartySearch] = useState<string>('');

  // Date range filters
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const currentParty = parties.find((p) => p.id === selectedPartyId);

  // Available filtered parties for dropdown
  const availableParties = useMemo(() => {
    return parties.filter((p) => {
      const matchesType = partyTypeFilter === 'ALL' || p.type === partyTypeFilter || p.type === 'Both';
      const q = partySearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.phone.includes(q) ||
        (p.systemCode && p.systemCode.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [parties, partyTypeFilter, partySearch]);

  // Compute date range boundary dates
  const { filterStart, filterEnd } = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      return { filterStart: start, filterEnd: end };
    }
    if (dateFilter === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      return { filterStart: start, filterEnd: end };
    }
    if (dateFilter === 'THIS_YEAR') {
      const start = `${now.getFullYear()}-01-01`;
      const end = `${now.getFullYear()}-12-31`;
      return { filterStart: start, filterEnd: end };
    }
    if (dateFilter === 'CUSTOM') {
      return { filterStart: startDate || '1970-01-01', filterEnd: endDate || '2099-12-31' };
    }
    return { filterStart: '1970-01-01', filterEnd: '2099-12-31' };
  }, [dateFilter, startDate, endDate]);

  // Generate All Statement Movements for selected party
  const { openingBalance, periodMovements, closingBalance, totalDebits, totalCredits } = useMemo(() => {
    if (!currentParty) {
      return {
        openingBalance: 0,
        periodMovements: [] as StatementLine[],
        closingBalance: 0,
        totalDebits: 0,
        totalCredits: 0,
      };
    }

    const rawMovements: Array<{
      date: string;
      docNumber: string;
      docType: 'Invoice' | 'ShiftSession' | 'ExpensePayment' | 'JournalEntry';
      docTypeAr: string;
      description: string;
      debit: number;
      credit: number;
      paymentMethod?: string;
    }> = [];

    const pName = currentParty.name.toLowerCase().trim();
    const pPhone = currentParty.phone.trim();
    const pCode = currentParty.systemCode?.toLowerCase().trim();

    // 1. Gather Customer Movements
    if (currentParty.type === 'Customer' || currentParty.type === 'Both') {
      // Invoices
      invoices.forEach((inv) => {
        const matchCustomer =
          inv.customerId === currentParty.id ||
          (inv.customerName && inv.customerName.toLowerCase().trim() === pName);

        if (matchCustomer) {
          const invDate = inv.createdAt.slice(0, 10);
          const totalCharged = inv.netAmount || 0;
          const paid = (inv.cashPaid || 0) + (inv.cardPaid || 0);

          if (totalCharged > 0) {
            rawMovements.push({
              date: invDate,
              docNumber: inv.invoiceNumber || inv.id,
              docType: 'Invoice',
              docTypeAr: 'فاتورة مبيعات POS',
              description: inv.items?.map((i) => i.productNameAr).join('، ') || 'خدمات ومبيعات عيادة',
              debit: totalCharged,
              credit: 0,
              paymentMethod: inv.paymentMethod,
            });
          }

          if (paid > 0) {
            rawMovements.push({
              date: invDate,
              docNumber: `PAY-${inv.invoiceNumber || inv.id}`,
              docType: 'Invoice',
              docTypeAr: 'سداد دفعة فاتورة',
              description: `سداد قيمة الفاتورة (${inv.paymentMethod})`,
              debit: 0,
              credit: paid,
              paymentMethod: inv.paymentMethod,
            });
          }
        }
      });

      // Reception Shift Run Rows
      receptionShifts.forEach((shift) => {
        shift.runRows.forEach((row) => {
          const matchRow =
            row.customerId === currentParty.id ||
            row.patientId === currentParty.id ||
            (row.patientName && row.patientName.toLowerCase().trim() === pName) ||
            (row.customerName && row.customerName.toLowerCase().trim() === pName) ||
            (row.patientPhone && row.patientPhone.trim() === pPhone) ||
            (pCode && row.systemCode && row.systemCode.toLowerCase().trim() === pCode);

          if (matchRow) {
            const rowDate = row.date || shift.shiftDate || shift.openedAt.slice(0, 10);
            const revenue = row.totalRevenue || 0;
            const collected = row.collectedAmount || 0;

            if (revenue > 0) {
              rawMovements.push({
                date: rowDate,
                docNumber: `RUN-${shift.shiftNumber}-${row.id.slice(-4)}`,
                docType: 'ShiftSession',
                docTypeAr: 'جلسة / خدمة ريسيبشن',
                description: `${row.serviceName} (${row.doctorName || 'طبيب المركز'})`,
                debit: revenue,
                credit: 0,
                paymentMethod: row.paymentMethod,
              });
            }

            if (collected > 0) {
              rawMovements.push({
                date: rowDate,
                docNumber: `REC-${shift.shiftNumber}-${row.id.slice(-4)}`,
                docType: 'ShiftSession',
                docTypeAr: 'تحصيل جلسة ريسيبشن',
                description: `سداد تحصيل فوري (${row.paymentMethod})`,
                debit: 0,
                credit: collected,
                paymentMethod: row.paymentMethod,
              });
            }
          }
        });
      });
    }

    // 2. Gather Supplier Movements
    if (currentParty.type === 'Supplier' || currentParty.type === 'Both') {
      receptionShifts.forEach((shift) => {
        shift.expenses.forEach((exp) => {
          const matchSupplier =
            exp.supplierId === currentParty.id ||
            (exp.supplierName && exp.supplierName.toLowerCase().trim() === pName);

          if (matchSupplier) {
            const expDate = exp.date?.slice(0, 10) || shift.shiftDate || shift.openedAt.slice(0, 10);
            rawMovements.push({
              date: expDate,
              docNumber: exp.receiptNumber ? `RCP-${exp.receiptNumber}` : `EXP-${exp.id.slice(-5)}`,
              docType: 'ExpensePayment',
              docTypeAr: 'سند صرف وسداد لمورد',
              description: `${exp.description} (طريقة الصرف: ${exp.disbursementMethod})`,
              debit: exp.amount, // Payments reduce supplier debt
              credit: 0,
              paymentMethod: exp.disbursementMethod,
            });
          }
        });
      });

      // Laser Device Maintenance Claims & Invoices for this Supplier
      deviceMaintenanceRecords.forEach((maint) => {
        const matchSupplier =
          maint.supplierId === currentParty.id ||
          (maint.supplierName && maint.supplierName.toLowerCase().trim() === pName);

        if (matchSupplier) {
          // Maintenance invoice / claim (increases clinic payable to supplier)
          rawMovements.push({
            date: maint.maintenanceDate,
            docNumber: maint.invoiceNumber ? `INV-${maint.invoiceNumber}` : `MNT-${maint.id.slice(-5)}`,
            docType: 'ExpensePayment',
            docTypeAr: 'فاتورة صيانة جهاز ليزر',
            description: `صيانة جهاز ${maint.deviceName} (${maint.deviceCode || ''}) - ${maint.description}`,
            debit: 0,
            credit: maint.cost, // Credit = Payable to supplier
            paymentMethod: maint.paymentMethodName || (maint.paymentStatus === 'OnCredit' ? 'آجل على الحساب' : 'نقداً'),
          });

          // If paid cash or bank immediately, also record the payment voucher
          if (maint.paymentStatus !== 'OnCredit') {
            rawMovements.push({
              date: maint.maintenanceDate,
              docNumber: `PAY-MNT-${maint.id.slice(-5)}`,
              docType: 'ExpensePayment',
              docTypeAr: 'سداد فوري لصيانة جهاز',
              description: `سداد فوري لصيانة جهاز ${maint.deviceName} (${maint.paymentMethodName || 'نقداً'})`,
              debit: maint.cost, // Debit = Payment reduces payable
              credit: 0,
              paymentMethod: maint.paymentMethodName || 'نقدي',
            });
          }
        }
      });
    }

    // 3. Journal Entries mentioning this party
    journalEntries.forEach((entry) => {
      // Avoid duplicate listing of maintenance journal entries since they are added explicitly above
      if (entry.entryNumber?.startsWith('JV-MNT')) return;

      const matchesEntry =
        entry.description.toLowerCase().includes(pName) ||
        entry.lines.some((l) => l.memo?.toLowerCase().includes(pName));

      if (matchesEntry) {
        entry.lines.forEach((l) => {
          if (l.memo?.toLowerCase().includes(pName)) {
            rawMovements.push({
              date: entry.date,
              docNumber: entry.entryNumber,
              docType: 'JournalEntry',
              docTypeAr: 'تسوية قيد يومية',
              description: l.memo || entry.description,
              debit: l.debit,
              credit: l.credit,
            });
          }
        });
      }
    });

    // Sort chronologically
    rawMovements.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate opening balance before filterStart
    let openBal = 0;
    // Account for existing party balance if initial movements aren't tracked
    const totalPriorDebits = rawMovements
      .filter((m) => m.date < filterStart)
      .reduce((sum, m) => sum + m.debit, 0);
    const totalPriorCredits = rawMovements
      .filter((m) => m.date < filterStart)
      .reduce((sum, m) => sum + m.credit, 0);

    openBal = totalPriorDebits - totalPriorCredits;

    // Filter movements in date range
    const inRangeMovements = rawMovements.filter(
      (m) => m.date >= filterStart && m.date <= filterEnd
    );

    // Compute running balances
    let running = openBal;
    const finalMovements: StatementLine[] = inRangeMovements.map((m, idx) => {
      running += m.debit - m.credit;
      return {
        ...m,
        id: `stmt-${idx}-${m.docNumber}`,
        runningBalance: running,
      };
    });

    const sumDebits = inRangeMovements.reduce((s, m) => s + m.debit, 0);
    const sumCredits = inRangeMovements.reduce((s, m) => s + m.credit, 0);
    const closeBal = running;

    return {
      openingBalance: openBal,
      periodMovements: finalMovements,
      closingBalance: closeBal,
      totalDebits: sumDebits,
      totalCredits: sumCredits,
    };
  }, [currentParty, invoices, receptionShifts, journalEntries, filterStart, filterEnd]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-xs">
      <div className="flex flex-col w-full max-w-5xl h-[92vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white">
                {t('كشف حساب تفصيلي للعملاء والموردين', 'Detailed Account Statement')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tenant?.name} • {activeBranch?.nameAr} • {new Date().toLocaleDateString('ar-EG')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>{t('طباعة كشف الحساب', 'Print Statement')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters and Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          {/* Party Dropdown & Search */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {t('اختر العميل / المورد المطلوب:', 'Select Customer or Supplier:')}
            </label>
            <div className="flex gap-2">
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-600"
              >
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.type === 'Customer' ? 'عميل' : p.type === 'Supplier' ? 'مورد' : 'عميل/مورد'}]{' '}
                    {p.name} {p.systemCode ? `(${p.systemCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Period Buttons */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {t('فترة كشف الحساب:', 'Statement Period:')}
            </label>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              {[
                { id: 'ALL', label: t('الكل', 'All') },
                { id: 'THIS_MONTH', label: t('هذا الشهر', 'Month') },
                { id: 'LAST_MONTH', label: t('الشهر السابق', 'Prev') },
                { id: 'THIS_YEAR', label: t('هذا العام', 'Year') },
                { id: 'CUSTOM', label: t('مخصص', 'Custom') },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setDateFilter(item.id as any)}
                  className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    dateFilter === item.id
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs if CUSTOM is selected */}
          {dateFilter === 'CUSTOM' && (
            <div className="md:col-span-3 flex items-end gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Statement Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {currentParty && (
            <>
              {/* Party Info Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                        currentParty.type === 'Customer'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {currentParty.type === 'Customer' ? t('مريض / عميل', 'Patient / Client') : t('مورد معتمد', 'Supplier')}
                    </span>
                    {currentParty.systemCode && (
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {currentParty.systemCode}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {currentParty.name}
                  </h3>
                  {currentParty.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono font-semibold">{currentParty.phone}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  {currentParty.paperCode && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Hash className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t('الكود الورقي:', 'Paper File:')} {currentParty.paperCode}</span>
                    </div>
                  )}
                  {currentParty.creditLimit > 0 && (
                    <div className="text-slate-500">
                      {t('الحد الائتماني:', 'Credit Limit:')}{' '}
                      <span className="font-mono font-bold">{formatMoney(currentParty.creditLimit)}</span>
                    </div>
                  )}
                  {currentParty.address && (
                    <div className="text-slate-500 truncate">
                      {t('العنوان:', 'Address:')} {currentParty.address}
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center items-end border-s border-slate-200 dark:border-slate-800 ps-4">
                  <span className="text-[11px] font-bold text-slate-400">
                    {currentParty.type === 'Supplier'
                      ? t('الرصيد المستحق للمورد حالياً:', 'Current Payable Balance:')
                      : t('الرصيد المستحق على العميل:', 'Current Receivable Balance:')}
                  </span>
                  <span
                    className={`text-xl font-black font-mono mt-0.5 ${
                      closingBalance > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : closingBalance < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-600'
                    }`}
                  >
                    {formatMoney(Math.abs(closingBalance))}
                    <span className="text-xs font-normal ms-1">
                      {closingBalance > 0 ? t('(مدين)', '(Debit)') : closingBalance < 0 ? t('(دائن)', '(Credit)') : ''}
                    </span>
                  </span>
                </div>
              </div>

              {/* Financial KPI Banner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-[10px] font-bold text-slate-400 block">{t('رصيد أول المدة', 'Opening Balance')}</span>
                  <span className="text-sm font-black font-mono text-slate-800 dark:text-white mt-0.5 block">
                    {formatMoney(openingBalance)}
                  </span>
                </div>

                <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5 shadow-xs dark:border-rose-950/40 dark:bg-rose-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-600 block">{t('إجمالي المدين (+)', 'Total Debits (+)')}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
                  </div>
                  <span className="text-sm font-black font-mono text-rose-700 dark:text-rose-400 mt-0.5 block">
                    {formatMoney(totalDebits)}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 shadow-xs dark:border-emerald-950/40 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-600 block">{t('إجمالي الدائن (-)', 'Total Credits (-)')}</span>
                    <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                    {formatMoney(totalCredits)}
                  </span>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 shadow-xs dark:border-indigo-950/40 dark:bg-indigo-950/20">
                  <span className="text-[10px] font-bold text-indigo-600 block">{t('رصيد نهاية المدة', 'Closing Balance')}</span>
                  <span className="text-base font-black font-mono text-indigo-700 dark:text-indigo-300 mt-0.5 block">
                    {formatMoney(closingBalance)}
                  </span>
                </div>
              </div>

              {/* Statement Movements Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                    {t('جدول الحركات التفصيلي للفترة', 'Detailed Movements Ledger')}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {periodMovements.length} {t('حركة مسجلة', 'movements')}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                        <th className="py-2.5 px-3 font-bold text-start">{t('التاريخ', 'Date')}</th>
                        <th className="py-2.5 px-3 font-bold text-start">{t('رقم المستند', 'Doc #')}</th>
                        <th className="py-2.5 px-3 font-bold text-start">{t('نوع الحركة', 'Type')}</th>
                        <th className="py-2.5 px-3 font-bold text-start">{t('البيان والخدمات', 'Description')}</th>
                        <th className="py-2.5 px-3 font-bold text-end">{t('مدين (+)', 'Debit')}</th>
                        <th className="py-2.5 px-3 font-bold text-end">{t('دائن (-)', 'Credit')}</th>
                        <th className="py-2.5 px-3 font-bold text-end">{t('الرصيد التراكمي', 'Running Balance')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {/* Row for Opening Balance */}
                      <tr className="bg-slate-50/40 dark:bg-slate-800/20 text-slate-500 font-bold">
                        <td className="py-2.5 px-3 font-mono">{filterStart}</td>
                        <td className="py-2.5 px-3 font-mono">-</td>
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px]">
                            {t('رصيد منقول', 'Brought Forward')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{t('رصيد أول المدة المنقول', 'Opening Balance')}</td>
                        <td className="py-2.5 px-3 text-end font-mono">-</td>
                        <td className="py-2.5 px-3 text-end font-mono">-</td>
                        <td className="py-2.5 px-3 text-end font-mono font-black text-slate-800 dark:text-slate-200">
                          {formatMoney(openingBalance)}
                        </td>
                      </tr>

                      {periodMovements.map((move) => (
                        <tr key={move.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">{move.date}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {move.docNumber}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                move.docType === 'Invoice'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : move.docType === 'ShiftSession'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                  : move.docType === 'ExpensePayment'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {move.docTypeAr}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                            {move.description}
                          </td>
                          <td className="py-2.5 px-3 text-end font-mono font-bold text-rose-600">
                            {move.debit > 0 ? formatMoney(move.debit) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-end font-mono font-bold text-emerald-600">
                            {move.credit > 0 ? formatMoney(move.credit) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-end font-mono font-black text-slate-900 dark:text-white">
                            {formatMoney(move.runningBalance)}
                          </td>
                        </tr>
                      ))}

                      {periodMovements.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            {t('لا توجد حركات مالية مسجلة خلال هذه الفترة المختارة', 'No transactions found for this period')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-850">
                        <td className="py-3 px-3 font-bold" colSpan={4}>
                          {t('إجمالي حركة الفترة والرصيد الختامي:', 'Totals & Closing Balance:')}
                        </td>
                        <td className="py-3 px-3 text-end font-mono font-black text-rose-600">
                          {formatMoney(totalDebits)}
                        </td>
                        <td className="py-3 px-3 text-end font-mono font-black text-emerald-600">
                          {formatMoney(totalCredits)}
                        </td>
                        <td className="py-3 px-3 text-end font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm">
                          {formatMoney(closingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-xs text-slate-400 shrink-0">
          <span>{t('تم استخراج الكشف إلكترونياً من النظام المحاسبي الموحد', 'System generated statement')}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
          >
            {t('إغلاق', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
