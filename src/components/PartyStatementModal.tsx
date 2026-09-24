import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Party, ClientOffer } from '../types';
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
  Layers,
  Package,
  Coins,
  Percent,
  AlertCircle,
  Plus,
  MessageCircle,
  Share2,
  Activity,
  Check,
  ChevronDown,
  Info,
} from 'lucide-react';

interface PartyStatementModalProps {
  initialPartyId?: string | null;
  initialMode?: 'VALUE' | 'QUANTITY';
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
  initialMode = 'VALUE',
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
    consumeClientOfferSession,
    addClientOffer,
  } = usePlatform();

  // Mode Selection: By Monetary Value (بالقيمة) or By Quantities / Sessions (بالكمية)
  const [statementMode, setStatementMode] = useState<'VALUE' | 'QUANTITY'>(initialMode);

  const [selectedPartyId, setSelectedPartyId] = useState<string>(
    initialPartyId || (parties.length > 0 ? parties[0].id : '')
  );
  const [partyTypeFilter, setPartyTypeFilter] = useState<'ALL' | 'Customer' | 'Supplier'>('ALL');
  const [partySearch, setPartySearch] = useState<string>('');

  // Date range filters
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Quick New Package modal state within statement
  const [showAddPackageModal, setShowAddPackageModal] = useState<boolean>(false);
  const [newPkgName, setNewPkgName] = useState<string>('');
  const [newPkgSessions, setNewPkgSessions] = useState<number>(6);
  const [newPkgPrice, setNewPkgPrice] = useState<number>(1500);
  const [newPkgValidityDays, setNewPkgValidityDays] = useState<number>(90);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

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

  // Generate All Monetary Statement Movements for selected party
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
          rawMovements.push({
            date: maint.maintenanceDate,
            docNumber: maint.invoiceNumber ? `INV-${maint.invoiceNumber}` : `MNT-${maint.id.slice(-5)}`,
            docType: 'ExpensePayment',
            docTypeAr: 'فاتورة صيانة جهاز ليزر',
            description: `صيانة جهاز ${maint.deviceName} (${maint.deviceCode || ''}) - ${maint.description}`,
            debit: 0,
            credit: maint.cost,
            paymentMethod: maint.paymentMethodName || (maint.paymentStatus === 'OnCredit' ? 'آجل على الحساب' : 'نقداً'),
          });

          if (maint.paymentStatus !== 'OnCredit') {
            rawMovements.push({
              date: maint.maintenanceDate,
              docNumber: `PAY-MNT-${maint.id.slice(-5)}`,
              docType: 'ExpensePayment',
              docTypeAr: 'سداد فوري لصيانة جهاز',
              description: `سداد فوري لصيانة جهاز ${maint.deviceName} (${maint.paymentMethodName || 'نقداً'})`,
              debit: maint.cost,
              credit: 0,
              paymentMethod: maint.paymentMethodName || 'نقدي',
            });
          }
        }
      });
    }

    // 3. Journal Entries mentioning this party
    journalEntries.forEach((entry) => {
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

    rawMovements.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate opening balance before filterStart
    let openBal = 0;
    const totalPriorDebits = rawMovements
      .filter((m) => m.date < filterStart)
      .reduce((sum, m) => sum + m.debit, 0);
    const totalPriorCredits = rawMovements
      .filter((m) => m.date < filterStart)
      .reduce((sum, m) => sum + m.credit, 0);

    openBal = totalPriorDebits - totalPriorCredits;

    const inRangeMovements = rawMovements.filter(
      (m) => m.date >= filterStart && m.date <= filterEnd
    );

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
  }, [currentParty, invoices, receptionShifts, journalEntries, deviceMaintenanceRecords, filterStart, filterEnd]);

  // QUANTITY & SESSIONS ANALYSIS (كشف حساب الكميات والباقات)
  const clientOffers = useMemo(() => {
    return currentParty?.offers || [];
  }, [currentParty]);

  const {
    totalBookedSessions,
    totalConsumedSessions,
    totalRemainingSessions,
    totalOffersValue,
    activeOffersCount,
    overallCompletionPercent,
  } = useMemo(() => {
    const booked = clientOffers.reduce((sum, o) => sum + (Number(o.totalQuantity) || 0), 0);
    const consumed = clientOffers.reduce((sum, o) => sum + (Number(o.consumedQuantity) || 0), 0);
    const remaining = clientOffers.reduce((sum, o) => sum + (Number(o.remainingQuantity) || 0), 0);
    const val = clientOffers.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
    const activeCount = clientOffers.filter((o) => (o.remainingQuantity || 0) > 0 && o.status !== 'Expired').length;
    const percent = booked > 0 ? Math.round((consumed / booked) * 100) : 0;

    return {
      totalBookedSessions: booked,
      totalConsumedSessions: consumed,
      totalRemainingSessions: remaining,
      totalOffersValue: val,
      activeOffersCount: activeCount,
      overallCompletionPercent: percent,
    };
  }, [clientOffers]);

  // Client's session attendance & consumption run rows from reception shifts
  const clientShiftSessions = useMemo(() => {
    if (!currentParty) return [];
    const rows: Array<{
      id: string;
      date: string;
      shiftNumber: string;
      serviceName: string;
      doctorName?: string;
      pulses?: number;
      collectedAmount?: number;
      paymentMethod?: string;
    }> = [];

    const pName = currentParty.name.toLowerCase().trim();
    const pPhone = currentParty.phone.trim();
    const pCode = currentParty.systemCode?.toLowerCase().trim();

    receptionShifts.forEach((shift) => {
      shift.runRows.forEach((row) => {
        const match =
          row.customerId === currentParty.id ||
          row.patientId === currentParty.id ||
          (row.patientName && row.patientName.toLowerCase().trim() === pName) ||
          (row.customerName && row.customerName.toLowerCase().trim() === pName) ||
          (row.patientPhone && row.patientPhone.trim() === pPhone) ||
          (pCode && row.systemCode && row.systemCode.toLowerCase().trim() === pCode);

        if (match) {
          rows.push({
            id: row.id,
            date: row.date || shift.shiftDate || shift.openedAt.slice(0, 10),
            shiftNumber: shift.shiftNumber,
            serviceName: row.serviceName,
            doctorName: row.doctorName,
            pulses: row.totalPulses,
            collectedAmount: row.collectedAmount,
            paymentMethod: row.paymentMethod,
          });
        }
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [currentParty, receptionShifts]);

  // Handle direct session consumption from statement
  const handleConsumeSession = (offerId: string, offerName: string) => {
    if (!currentParty) return;
    const res = consumeClientOfferSession(currentParty.id, offerId, 1);
    if (res.success) {
      setActionNotice(`تم تسجيل استهلاك جلسة واحدة بنجاح من باقة: ${offerName}`);
      setTimeout(() => setActionNotice(null), 4000);
    } else {
      alert(res.message || 'تعذر استهلاك الجلسة، الرصيد غير كافٍ');
    }
  };

  // Handle Quick Add Package directly from statement
  const handleQuickAddPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParty) return;
    if (!newPkgName.trim()) {
      alert('يرجى تحديد اسم الباقة أو العرض');
      return;
    }
    const expiry = new Date(Date.now() + newPkgValidityDays * 86400000).toISOString().split('T')[0];

    addClientOffer(currentParty.id, {
      offerNameAr: newPkgName.trim(),
      offerNameEn: newPkgName.trim(),
      totalQuantity: newPkgSessions,
      consumedQuantity: 0,
      remainingQuantity: newPkgSessions,
      totalPrice: newPkgPrice,
      expiryDate: expiry,
      serviceType: 'جلسات ليزر وتجميل',
      notes: `تم الإسناد مباشرة من كشف حساب العميل بتاريخ ${new Date().toLocaleDateString('ar-EG')}`,
    });

    setShowAddPackageModal(false);
    setNewPkgName('');
    setActionNotice(`تم إسناد باقة (${newPkgName.trim()}) بنجاح للعميل برصيد ${newPkgSessions} جلسة.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // WhatsApp Share statement summary
  const handleShareWhatsApp = () => {
    if (!currentParty || !currentParty.phone) {
      alert('لا يتوفر رقم هاتف مسجل لهذا العميل');
      return;
    }

    let text = '';
    if (statementMode === 'QUANTITY') {
      text = `*كشف حساب رصيد الجلسات والباقات* 📋%0A` +
        `المركز: ${tenant?.name || 'المركز الطبي'}%0A` +
        `العميل: ${currentParty.name}%0A` +
        `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}%0A` +
        `--------------------------------%0A` +
        `🔢 *إجمالي الجلسات المحجوزة:* ${totalBookedSessions} جلسة%0A` +
        `✅ *الجلسات المستهلكة المنفذة:* ${totalConsumedSessions} جلسة%0A` +
        `✨ *رصيد الجلسات المتبقي لك:* ${totalRemainingSessions} جلسة%0A` +
        `📊 *نسبة الإنجاز:* ${overallCompletionPercent}%%0A` +
        `--------------------------------%0A` +
        `*تفاصيل العروض والاشتراكات:*%0A` +
        (clientOffers.length > 0
          ? clientOffers.map((o) => `• ${o.offerNameAr}: محجوز (${o.totalQuantity}) | مستهلك (${o.consumedQuantity}) | متبقي (${o.remainingQuantity}) جلسة`).join('%0A')
          : 'لا توجد باقات مفعلة حالياً') +
        `%0A%0Aنتشرف دائماً بزيارتكم! 🌸`;
    } else {
      text = `*كشف الحساب المالي* 💼%0A` +
        `المركز: ${tenant?.name || 'المركز الطبي'}%0A` +
        `العميل: ${currentParty.name}%0A` +
        `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}%0A` +
        `--------------------------------%0A` +
        `💰 *رصيد أول المدة:* ${formatMoney(openingBalance)}%0A` +
        `🔺 *إجمالي الرسوم (مدين):* ${formatMoney(totalDebits)}%0A` +
        `🔻 *إجمالي المسدد (دائن):* ${formatMoney(totalCredits)}%0A` +
        `⚖️ *صافي الرصيد الحالي:* ${formatMoney(Math.abs(closingBalance))} (${closingBalance > 0 ? 'مستحق على العميل' : 'رصيد دائن للعميل'})%0A` +
        `--------------------------------%0A` +
        `نتشرف دائماً بخدمتكم! 🌸`;
    }

    const cleanPhone = currentParty.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs">
      <div className="flex flex-col w-full max-w-5xl h-[94vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden print:m-0 print:h-auto print:max-w-none print:border-none print:shadow-none">
        
        {/* Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md ${
              statementMode === 'QUANTITY'
                ? 'bg-purple-600 shadow-purple-600/25'
                : 'bg-indigo-600 shadow-indigo-600/25'
            }`}>
              {statementMode === 'QUANTITY' ? <Package className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white">
                  {statementMode === 'QUANTITY'
                    ? t('كشف حساب كميات الجلسات وعروض العميل', 'Customer Sessions & Quantities Statement')
                    : t('كشف حساب تفصيلي بالقيمة المالية', 'Customer Monetary Account Statement')}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  statementMode === 'QUANTITY'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                }`}>
                  {statementMode === 'QUANTITY' ? 'عرض بالكمية (جلسات)' : 'عرض بالقيمة (ج.م)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tenant?.name} • {activeBranch?.nameAr} • {new Date().toLocaleDateString('ar-EG')}
              </p>
            </div>
          </div>

          {/* Action Buttons & Close */}
          <div className="flex items-center gap-2">
            {currentParty?.phone && (
              <button
                id="btn-whatsapp-share"
                onClick={handleShareWhatsApp}
                title={t('مشاركة الكشف مع العميل عبر واتساب', 'Share Statement via WhatsApp')}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{t('واتساب', 'WhatsApp')}</span>
              </button>
            )}

            <button
              id="btn-print-statement"
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

        {/* PRIMARY MODE SWITCHER TABS (العرض بالقيمة أو بالكمية) */}
        <div className="bg-slate-100/80 dark:bg-slate-800/80 px-6 py-2.5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">
              {t('نمط العرض المطلوب:', 'View Statement By:')}
            </span>
            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <button
                id="btn-mode-value"
                onClick={() => setStatementMode('VALUE')}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  statementMode === 'VALUE'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                }`}
              >
                <Coins className="h-3.5 w-3.5" />
                <span>{t('العرض بالقيمة المالية (ج.م)', 'View By Monetary Value')}</span>
              </button>

              <button
                id="btn-mode-quantity"
                onClick={() => setStatementMode('QUANTITY')}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  statementMode === 'QUANTITY'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                    : 'text-slate-600 dark:text-slate-300 hover:text-purple-600'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{t('العرض بالكمية (المحجوز والمستهلك والرصيد)', 'View By Quantities & Sessions')}</span>
                {totalRemainingSessions > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statementMode === 'QUANTITY' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {totalRemainingSessions}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Quick Notice if any */}
          {actionNotice && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* If in quantity mode, add Quick Package Top-Up Button */}
          {statementMode === 'QUANTITY' && currentParty && (
            <button
              id="btn-assign-quick-package"
              onClick={() => setShowAddPackageModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('إسناد / شحن باقة جديدة للعميل', 'Top-up New Package')}</span>
            </button>
          )}
        </div>

        {/* Filters and Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 print:hidden">
          {/* Party Dropdown & Search */}
          <div className="md:col-span-6 space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {t('اختر العميل / المريض المطلوب:', 'Select Customer / Patient:')}
            </label>
            <div className="flex gap-2">
              <select
                id="select-statement-party"
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-600"
              >
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.type === 'Customer' ? 'عميل' : p.type === 'Supplier' ? 'مورد' : 'عميل/مورد'}]{' '}
                    {p.name} {p.systemCode ? `(${p.systemCode})` : ''} - رصيد: {formatMoney(p.balance)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Period Buttons (Only relevant in Value mode or for date filtering) */}
          <div className="md:col-span-6 space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {t('نطاق الفترة الزمنية:', 'Date Range Filter:')}
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
                  className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
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
            <div className="md:col-span-12 flex items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Statement Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {currentParty ? (
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

                {/* Right Highlight Box (Switches based on mode) */}
                <div className="flex flex-col justify-center items-end border-s border-slate-200 dark:border-slate-800 ps-4">
                  {statementMode === 'QUANTITY' ? (
                    <>
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        <span>{t('رصيد الجلسات المتبقي للعميل:', 'Current Remaining Sessions:')}</span>
                      </span>
                      <span className="text-2xl font-black font-mono text-purple-700 dark:text-purple-300 mt-0.5">
                        {totalRemainingSessions}
                        <span className="text-xs font-bold ms-1 text-slate-500">جلسة</span>
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        من إجمالي {totalBookedSessions} جلسة محجوزة ({overallCompletionPercent}% استهلاك)
                      </span>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* VIEW 1: QUANTITY STATEMENT VIEW (العرض بالكميات وباقات الجلسات) */}
              {/* ========================================================================= */}
              {statementMode === 'QUANTITY' && (
                <div className="space-y-5">
                  {/* Quantity KPI Ribbons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 1. Booked Quantity */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 block">
                          {t('الجلسات المحجوزة (الإجمالي)', 'Total Booked Sessions')}
                        </span>
                        <Package className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                          {totalBookedSessions}
                        </span>
                        <span className="text-xs font-bold text-slate-400">جلسة</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        عبر {clientOffers.length} باقة واشتراك
                      </span>
                    </div>

                    {/* 2. Consumed Quantity */}
                    <div className="rounded-2xl border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                          {t('الجلسات المستهلكة (المنفذة)', 'Consumed Sessions')}
                        </span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                          {totalConsumedSessions}
                        </span>
                        <span className="text-xs font-bold text-emerald-600">جلسة</span>
                      </div>
                      <span className="text-[10px] text-emerald-600/80 mt-1 block">
                        تمت زيارتها وحضورها
                      </span>
                    </div>

                    {/* 3. Remaining Balance Quantity */}
                    <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 block">
                          {t('رصيد الجلسات المتبقي', 'Remaining Balance')}
                        </span>
                        <Layers className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black font-mono text-purple-700 dark:text-purple-300">
                          {totalRemainingSessions}
                        </span>
                        <span className="text-xs font-bold text-purple-600">جلسة</span>
                      </div>
                      <span className="text-[10px] text-purple-600/80 mt-1 block">
                        متاحة للاستخدام المباشر
                      </span>
                    </div>

                    {/* 4. Completion Rate & Investment */}
                    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 block">
                          {t('معدل إنجاز الباقات', 'Completion Rate')}
                        </span>
                        <Percent className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-black font-mono text-indigo-700 dark:text-indigo-300">
                          {overallCompletionPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-indigo-200/60 dark:bg-indigo-950 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, overallCompletionPercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* MAIN OFFERS BREAKDOWN TABLE (المحجوز والمستهلك والرصيد لكل عرض) */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/30">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-purple-600" />
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">
                          {t(
                            'كشف حساب تفصيلي لعروض وباقات العميل بالكميات (المحجوز والمستهلك والرصيد)',
                            'Client Offers Statement by Quantity (Booked, Consumed, Balance)'
                          )}
                        </h4>
                      </div>
                      <span className="text-[11px] text-purple-700 dark:text-purple-300 font-bold bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full">
                        {clientOffers.length} {t('باقات مقيدة', 'packages')}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                            <th className="py-3 px-3 font-bold text-start">{t('اسم العرض / الباقة', 'Offer / Package')}</th>
                            <th className="py-3 px-3 font-bold text-start">{t('تاريخ الشراء', 'Purchase Date')}</th>
                            <th className="py-3 px-3 font-bold text-start">{t('تاريخ الانتهاء', 'Expiry Date')}</th>
                            <th className="py-3 px-3 font-bold text-center bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                              {t('الكمية المحجوزة', 'Booked Qty')}
                            </th>
                            <th className="py-3 px-3 font-bold text-center bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300">
                              {t('المستهلك (المنفذ)', 'Consumed Qty')}
                            </th>
                            <th className="py-3 px-3 font-bold text-center bg-purple-50/60 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300">
                              {t('الرصيد المتبقي', 'Remaining Balance')}
                            </th>
                            <th className="py-3 px-3 font-bold text-center">{t('نسبة الإنجاز', 'Progress')}</th>
                            <th className="py-3 px-3 font-bold text-end">{t('قيمة الباقة', 'Price')}</th>
                            <th className="py-3 px-3 font-bold text-center print:hidden">{t('إجراء سريع', 'Action')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {clientOffers.map((offer) => {
                            const isFinished = (offer.remainingQuantity || 0) <= 0;
                            const percent =
                              offer.totalQuantity > 0
                                ? Math.round(((offer.consumedQuantity || 0) / offer.totalQuantity) * 100)
                                : 0;
                            const isExpired = offer.expiryDate && new Date(offer.expiryDate) < new Date();

                            return (
                              <tr key={offer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                {/* Offer Name */}
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {offer.offerNameAr}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {offer.offerNameEn || offer.serviceType || 'باقة جلسات علاجية'}
                                  </div>
                                  {offer.notes && (
                                    <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                                      {offer.notes}
                                    </div>
                                  )}
                                </td>

                                {/* Purchase Date */}
                                <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                                  {offer.purchaseDate || '-'}
                                </td>

                                {/* Expiry Date & Status */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="font-mono text-slate-600 dark:text-slate-300">
                                    {offer.expiryDate || t('مفتوحة الصلاحية', 'No Expiry')}
                                  </div>
                                  {isExpired ? (
                                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                                      منتهية الصلاحية
                                    </span>
                                  ) : isFinished ? (
                                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                                      مستهلكة بالكامل
                                    </span>
                                  ) : (
                                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                                      سارية ونشطة
                                    </span>
                                  )}
                                </td>

                                {/* Booked Quantity */}
                                <td className="py-3 px-3 text-center font-mono font-black text-blue-700 dark:text-blue-300 bg-blue-50/20 dark:bg-blue-950/10">
                                  <span className="text-sm">{offer.totalQuantity}</span>
                                  <span className="text-[10px] text-slate-400 ms-1 font-sans">جلسة</span>
                                </td>

                                {/* Consumed Quantity */}
                                <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50/20 dark:bg-emerald-950/10">
                                  <span className="text-sm">{offer.consumedQuantity}</span>
                                  <span className="text-[10px] text-slate-400 ms-1 font-sans">جلسة</span>
                                </td>

                                {/* Remaining Balance Quantity */}
                                <td className="py-3 px-3 text-center font-mono font-black bg-purple-50/40 dark:bg-purple-950/20">
                                  <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-xl text-xs font-black ${
                                    (offer.remainingQuantity || 0) > 0
                                      ? 'bg-purple-600 text-white shadow-xs'
                                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                  }`}>
                                    {offer.remainingQuantity} جلسة
                                  </span>
                                </td>

                                {/* Progress */}
                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className="bg-purple-600 h-full rounded-full"
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-[10px] text-slate-500">{percent}%</span>
                                  </div>
                                </td>

                                {/* Price */}
                                <td className="py-3 px-3 text-end font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {formatMoney(offer.totalPrice)}
                                  {offer.totalQuantity > 0 && (
                                    <div className="text-[9px] text-slate-400 font-sans">
                                      ({formatMoney(Math.round(offer.totalPrice / offer.totalQuantity))}/جلسة)
                                    </div>
                                  )}
                                </td>

                                {/* Action: Quick Session Consume */}
                                <td className="py-3 px-3 text-center print:hidden">
                                  {!isFinished ? (
                                    <button
                                      onClick={() => handleConsumeSession(offer.id, offer.offerNameAr)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-[11px] font-bold cursor-pointer transition-colors"
                                      title="خصم جلسة واحدة منفذة من رصيد هذه الباقة"
                                    >
                                      <Check className="h-3 w-3" />
                                      <span>استهلاك جلسة</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-bold">مكتملة</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {clientOffers.length === 0 && (
                            <tr>
                              <td colSpan={9} className="py-12 text-center text-slate-400">
                                <Package className="h-8 w-8 mx-auto mb-2 opacity-30 text-purple-600" />
                                <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                  {t('لا توجد عروض أو باقات جلسات مسجلة لهذا العميل حالياً', 'No packages found for this client')}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                  يمكنك الضغط على زر "إسناد / شحن باقة جديدة" بالأعلى لتسجيل باقة وعرض جلسات للعميل
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>

                        {/* Table Footer Summary */}
                        {clientOffers.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-850">
                              <td className="py-3 px-3 font-bold" colSpan={3}>
                                {t('إجمالي كميات الجلسات المحجوزة والمتبقية:', 'Total Sessions & Remaining Balance:')}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-black text-blue-700 dark:text-blue-300 text-sm">
                                {totalBookedSessions} جلسة
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm">
                                {totalConsumedSessions} جلسة
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-black text-purple-700 dark:text-purple-300 text-sm">
                                {totalRemainingSessions} جلسة
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-black text-indigo-700 text-xs">
                                {overallCompletionPercent}%
                              </td>
                              <td className="py-3 px-3 text-end font-mono font-black text-slate-900 dark:text-white text-xs">
                                {formatMoney(totalOffersValue)}
                              </td>
                              <td className="py-3 px-3 print:hidden"></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* SESSIONS CONSUMPTION HISTORY LOG (سجل الجلسات المنفذة وحضور العميل) */}
                  {clientShiftSessions.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                            {t('سجل حضور الجلسات والخدمات المنفذة بالريسيبشن', 'Executed Sessions Reception Log')}
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {clientShiftSessions.length} {t('زيارة مسجلة', 'visits')}
                        </span>
                      </div>

                      <div className="overflow-x-auto max-h-56">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 sticky top-0">
                              <th className="py-2 px-3 font-bold text-start">{t('التاريخ', 'Date')}</th>
                              <th className="py-2 px-3 font-bold text-start">{t('الخدمة / الجلسة', 'Service')}</th>
                              <th className="py-2 px-3 font-bold text-start">{t('الطبيب / الأخصائي', 'Doctor / Specialist')}</th>
                              <th className="py-2 px-3 font-bold text-center">{t('النبضات', 'Pulses')}</th>
                              <th className="py-2 px-3 font-bold text-end">{t('المسدد', 'Paid')}</th>
                              <th className="py-2 px-3 font-bold text-center">{t('طريقة الدفع', 'Payment Method')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {clientShiftSessions.map((session) => (
                              <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{session.date}</td>
                                <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{session.serviceName}</td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{session.doctorName || 'المركز'}</td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-purple-600">
                                  {session.pulses ? `${session.pulses} نبضة` : '-'}
                                </td>
                                <td className="py-2 px-3 text-end font-mono font-bold text-emerald-600">
                                  {session.collectedAmount ? formatMoney(session.collectedAmount) : '-'}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {session.paymentMethod || 'نقداً'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* VIEW 2: MONETARY STATEMENT VIEW (العرض بالقيمة المالية التقليدي) */}
              {/* ========================================================================= */}
              {statementMode === 'VALUE' && (
                <div className="space-y-5">
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
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-400">
              {t('يرجى اختيار عميل أو مورد لعرض كشف الحساب', 'Please select a customer or supplier')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-xs text-slate-400 shrink-0 print:hidden">
          <span>{t('تم استخراج الكشف إلكترونياً من منصة الأعمال والعيادات', 'System generated statement')}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              {t('إغلاق', 'Close')}
            </button>
          </div>
        </div>

      </div>

      {/* QUICK ASSIGN PACKAGE MODAL */}
      {showAddPackageModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('إسناد باقة جلسات جديدة للعميل', 'Top-up Package for Client')}
                </h3>
              </div>
              <button
                onClick={() => setShowAddPackageModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddPackage} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الباقة أو العرض *
                </label>
                <input
                  type="text"
                  required
                  value={newPkgName}
                  onChange={(e) => setNewPkgName(e.target.value)}
                  placeholder="مثال: باقة إزالة الشعر كامل الجسم (6 جلسات)"
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عدد الجلسات المحجوزة
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPkgSessions}
                    onChange={(e) => setNewPkgSessions(Number(e.target.value) || 1)}
                    className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    السعر الإجمالي (ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPkgPrice}
                    onChange={(e) => setNewPkgPrice(Number(e.target.value) || 0)}
                    className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  صلاحية الباقة (بالأيام)
                </label>
                <select
                  value={newPkgValidityDays}
                  onChange={(e) => setNewPkgValidityDays(Number(e.target.value))}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value={30}>30 يوم (شهر واحد)</option>
                  <option value={60}>60 يوم (شهران)</option>
                  <option value={90}>90 يوم (3 شهور)</option>
                  <option value={180}>180 يوم (6 شهور)</option>
                  <option value={365}>365 يوم (سنة كاملة)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPackageModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/25"
                >
                  تأكيد شحن الباقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
