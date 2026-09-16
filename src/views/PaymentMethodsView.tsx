import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { PaymentMethod, Account } from '../types';
import { autoTranslateArabic } from '../utils/translator';
import {
  CreditCard,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Sparkles,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Search,
  Building2,
  Info,
  BookOpen,
  Wallet,
  Landmark,
  Coins,
  ArrowUpRight,
  Filter,
  Check,
  Zap,
  Tag,
  SlidersHorizontal,
} from 'lucide-react';

interface QuickPreset {
  nameAr: string;
  nameEn: string;
  type: PaymentMethod['type'];
  code: string;
  accountCode: string;
  icon: string;
  instructionsAr: string;
  instructionsEn: string;
}

export const PaymentMethodsView: React.FC = () => {
  const {
    language,
    t,
    paymentMethods,
    addPaymentMethod,
    updatePaymentMethod,
    archivePaymentMethod,
    restorePaymentMethod,
    branches,
    accounts,
  } = usePlatform();

  const isRtl = language === 'ar';
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'linked' | 'unlinked' | 'archived'>('all');

  // Form State
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<PaymentMethod['type']>('Cash');
  const [feePercentage, setFeePercentage] = useState<number>(0);
  const [isDefault, setIsDefault] = useState(false);
  const [branchId, setBranchId] = useState<string>('');
  const [linkedAccountId, setLinkedAccountId] = useState<string>('');
  const [instructionsAr, setInstructionsAr] = useState('');
  const [instructionsEn, setInstructionsEn] = useState('');
  const [displayOnReceipt, setDisplayOnReceipt] = useState(true);
  const [accountFilterSearch, setAccountFilterSearch] = useState('');

  // Preset templates for quick addition
  const quickPresets: QuickPreset[] = [
    {
      nameAr: 'نقداً (كاش)',
      nameEn: 'Cash',
      type: 'Cash',
      code: 'CASH',
      accountCode: '1111',
      icon: 'Coins',
      instructionsAr: 'الدفع نقداً في خزينة الفرع',
      instructionsEn: 'Pay cash at reception desk',
    },
    {
      nameAr: 'بطاقة بنكية / فيزا وماستركارد (POS)',
      nameEn: 'Credit Card / Visa & Mastercard',
      type: 'Card',
      code: 'CARD_VISA',
      accountCode: '1112',
      icon: 'CreditCard',
      instructionsAr: 'الدفع عبر ماكينة الدفع الإلكتروني POS بالفرع',
      instructionsEn: 'Pay via POS bank terminal',
    },
    {
      nameAr: 'إنستاباي (InstaPay)',
      nameEn: 'InstaPay Instant Transfer',
      type: 'Transfer',
      code: 'INSTAPAY',
      accountCode: '1112',
      icon: 'Zap',
      instructionsAr: 'تحويل لحظي عبر شبكة إنستاباي الوطنية',
      instructionsEn: 'Instant transfer via InstaPay',
    },
    {
      nameAr: 'محفظة إلكترونية (فودافون كاش / أورنج / وي)',
      nameEn: 'E-Wallet / Vodafone Cash',
      type: 'Wallet',
      code: 'WALLET',
      accountCode: '1111',
      icon: 'Wallet',
      instructionsAr: 'تحويل على المحفظة الإلكترونية',
      instructionsEn: 'Transfer to mobile e-wallet',
    },
    {
      nameAr: 'آجل / حساب ائتماني (على الحساب)',
      nameEn: 'Credit / On Account',
      type: 'Credit',
      code: 'CREDIT',
      accountCode: '1120',
      icon: 'BookOpen',
      instructionsAr: 'ترحيل المبلغ على رصيد حساب العميل/الجهة',
      instructionsEn: 'Post to client credit ledger',
    },
    {
      nameAr: 'تحويل بنكي مباشر (حساب جاري)',
      nameEn: 'Bank Wire Transfer',
      type: 'Transfer',
      code: 'BANK_TRANSFER',
      accountCode: '1112',
      icon: 'Landmark',
      instructionsAr: 'تحويل بنكي مباشر على الحساب الجاري للشركة',
      instructionsEn: 'Direct wire transfer to company corporate bank account',
    },
  ];

  // Helper to find recommended account
  const getRecommendedAccountId = (targetType: PaymentMethod['type']): string => {
    switch (targetType) {
      case 'Cash':
        return accounts.find((a) => a.code === '1111')?.id || accounts.find((a) => a.code.startsWith('111'))?.id || '';
      case 'Card':
      case 'Transfer':
        return accounts.find((a) => a.code === '1112')?.id || accounts.find((a) => a.code.startsWith('111'))?.id || '';
      case 'Wallet':
        return accounts.find((a) => a.code === '1111' || a.code === '1112')?.id || '';
      case 'Credit':
        return accounts.find((a) => a.code === '1120')?.id || accounts.find((a) => a.type === 'Asset')?.id || '';
      default:
        return accounts.find((a) => a.code === '1111')?.id || '';
    }
  };

  // Group accounts for easy selection
  const categorizedAccounts = useMemo(() => {
    const cashAndBank = accounts.filter(
      (a) => a.type === 'Asset' && (a.code.startsWith('111') || a.nameAr.includes('خزينة') || a.nameAr.includes('بنك') || a.nameAr.includes('نقدية'))
    );
    const receivables = accounts.filter(
      (a) => a.type === 'Asset' && (a.code.startsWith('112') || a.nameAr.includes('عملاء') || a.nameAr.includes('مدين'))
    );
    const otherAssets = accounts.filter(
      (a) => a.type === 'Asset' && !cashAndBank.some((c) => c.id === a.id) && !receivables.some((r) => r.id === a.id)
    );
    const liabilities = accounts.filter((a) => a.type === 'Liability');
    const others = accounts.filter((a) => a.type !== 'Asset' && a.type !== 'Liability');

    return {
      cashAndBank,
      receivables,
      otherAssets,
      liabilities,
      others,
    };
  }, [accounts]);

  // Filtered accounts for dropdown search
  const filteredAccountsForSearch = useMemo(() => {
    if (!accountFilterSearch.trim()) return accounts;
    const q = accountFilterSearch.toLowerCase();
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.nameAr.toLowerCase().includes(q) ||
        a.nameEn.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
    );
  }, [accounts, accountFilterSearch]);

  // Filtered payment methods
  const filteredMethods = useMemo(() => {
    return paymentMethods.filter((pm) => {
      const matchesSearch =
        pm.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pm.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pm.code && pm.code.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesFilter = true;
      if (filterType === 'linked') {
        matchesFilter = !pm.isArchived && Boolean(pm.linkedAccountId);
      } else if (filterType === 'unlinked') {
        matchesFilter = !pm.isArchived && !pm.linkedAccountId;
      } else if (filterType === 'archived') {
        matchesFilter = Boolean(pm.isArchived);
      } else {
        matchesFilter = !pm.isArchived;
      }

      return matchesSearch && matchesFilter;
    });
  }, [paymentMethods, searchQuery, filterType]);

  // Statistics
  const totalCount = paymentMethods.filter((p) => !p.isArchived).length;
  const linkedCount = paymentMethods.filter((p) => !p.isArchived && p.linkedAccountId).length;
  const unlinkedCount = paymentMethods.filter((p) => !p.isArchived && !p.linkedAccountId).length;
  const archivedCount = paymentMethods.filter((p) => p.isArchived).length;

  const handleOpenAdd = () => {
    setEditingMethod(null);
    setNameAr('');
    setNameEn('');
    setCode(`PM-${(paymentMethods.length + 1).toString().padStart(2, '0')}`);
    setType('Cash');
    setFeePercentage(0);
    setIsDefault(false);
    setBranchId('');
    setLinkedAccountId(getRecommendedAccountId('Cash'));
    setInstructionsAr('');
    setInstructionsEn('');
    setDisplayOnReceipt(true);
    setAccountFilterSearch('');
    setShowModal(true);
  };

  const handleOpenEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setNameAr(method.nameAr);
    setNameEn(method.nameEn);
    setCode(method.code || '');
    setType(method.type || 'Cash');
    setFeePercentage(method.feePercentage || 0);
    setIsDefault(method.isDefault || false);
    setBranchId(method.branchId || '');
    setLinkedAccountId(method.linkedAccountId || '');
    setInstructionsAr(method.instructionsAr || '');
    setInstructionsEn(method.instructionsEn || '');
    setDisplayOnReceipt(method.displayOnReceipt !== false);
    setAccountFilterSearch('');
    setShowModal(true);
  };

  const handleApplyPreset = (preset: QuickPreset) => {
    setNameAr(preset.nameAr);
    setNameEn(preset.nameEn);
    setCode(preset.code);
    setType(preset.type);
    setInstructionsAr(preset.instructionsAr);
    setInstructionsEn(preset.instructionsEn);
    const targetAcc = accounts.find((a) => a.code === preset.accountCode);
    if (targetAcc) {
      setLinkedAccountId(targetAcc.id);
    } else {
      setLinkedAccountId(getRecommendedAccountId(preset.type));
    }
  };

  const handleAutoTranslate = () => {
    if (nameAr.trim()) {
      setNameEn(autoTranslateArabic(nameAr));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) return;

    const payload = {
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || autoTranslateArabic(nameAr),
      code: code.trim() || `PM-${Date.now().toString().slice(-4)}`,
      type,
      feePercentage: Number(feePercentage) || 0,
      isDefault,
      branchId: branchId || undefined,
      linkedAccountId: linkedAccountId || undefined,
      instructionsAr: instructionsAr.trim() || undefined,
      instructionsEn: instructionsEn.trim() || undefined,
      displayOnReceipt,
      orderIndex: editingMethod ? editingMethod.orderIndex : paymentMethods.length + 1,
    };

    if (editingMethod) {
      updatePaymentMethod(editingMethod.id, payload);
    } else {
      addPaymentMethod(payload);
    }
    setShowModal(false);
  };

  const selectedAccountDetails = accounts.find((a) => a.id === linkedAccountId);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                  {t('طرق التحصيل والسداد وشجرة الحسابات', 'Payment Methods & Chart of Accounts Link')}
                </h1>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {t('الربط المحاسبي التلقائي', 'Automated GL Posting')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t(
                  'ربط طرق الدفع والتحصيل (نقدي، فيزا، إنستاباي، آجل) بحسابات الخزينة والبنوك في شجرة الحسابات لتسجيل القيود آلياً',
                  'Map payment tenders (Cash, Card, InstaPay, Credit) directly to GL accounts for automated double-entry ledger posting'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة طريقة سداد وربطها بالحساب', 'Add Payment Method & Link GL')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats & Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t('إجمالي طرق السداد النشطة', 'Active Payment Methods')}
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              {t('مربوطة بشجرة الحسابات', 'Linked to GL Accounts')}
            </span>
            <div className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
              {linkedCount}
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 mx-1">
                ({totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0}%)
              </span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {t('غير مربوطة بحساب مالي', 'Unlinked to GL')}
            </span>
            <div className="text-xl font-black text-amber-800 dark:text-amber-300 mt-1">{unlinkedCount}</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t('وسائل الدفع المؤرشفة', 'Archived Methods')}
            </span>
            <div className="text-xl font-black text-slate-700 dark:text-slate-300 mt-1">{archivedCount}</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
            <Archive className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Info & Accounting Educational Banner */}
      <div className="bg-linear-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-slate-900/60 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white">
              {t('كيف يعمل الربط بين طرق التحصيل وشجرة الحسابات؟', 'How GL Account Mapping Operates')}
            </h4>
            <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              {t(
                'عندما يختار الكاشير أو موظف الاستقبال طريقة تحصيل معينة (كاش أو فيزا أو إنستاباي)، يُرحل النظام قيداً تلقائياً إلى دفتر الأستاذ يجعل الحساب المالي المرتبط مديناً (Debit) وحساب الإيرادات دائناً (Credit).',
                'Whenever a tender is selected at checkout or reception, an automatic journal entry debits the mapped GL account and credits the revenue account.'
              )}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
            {t('توازن محاسبي 100%', '100% Balanced Entries')}
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'بحث باسم طريقة السداد، الكود، أو الحساب المحاسبي المرتبط...',
              'Search payment method, code, or linked GL account...'
            )}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden placeholder:text-slate-400"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t('كافة الطرق النشطة', 'All Active')} ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('linked')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'linked'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t('مربوطة بالشجرة', 'Linked to GL')} ({linkedCount})
          </button>
          <button
            onClick={() => setFilterType('unlinked')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'unlinked'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t('غير مربوطة', 'Unlinked')} ({unlinkedCount})
          </button>
          <button
            onClick={() => setFilterType('archived')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'archived'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t('المؤرشفة', 'Archived')} ({archivedCount})
          </button>
        </div>
      </div>

      {/* Methods Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMethods.map((method) => {
          const linkedAccount = accounts.find((a) => a.id === method.linkedAccountId);
          const branch = branches.find((b) => b.id === method.branchId);

          // Select icon based on type
          const renderMethodIcon = () => {
            switch (method.type) {
              case 'Cash':
                return <Coins className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
              case 'Card':
                return <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
              case 'Transfer':
                return <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
              case 'Wallet':
                return <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
              case 'Credit':
                return <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
              default:
                return <CreditCard className="h-5 w-5 text-slate-600 dark:text-slate-400" />;
            }
          };

          return (
            <div
              key={method.id}
              className={`flex flex-col justify-between bg-white dark:bg-slate-900 rounded-2xl border transition-all p-5 shadow-xs ${
                method.isArchived
                  ? 'border-slate-300 dark:border-slate-800 opacity-65 bg-slate-100/40 dark:bg-slate-900/30'
                  : linkedAccount
                  ? 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                  : 'border-amber-200 dark:border-amber-800/60 bg-amber-50/10'
              }`}
            >
              <div>
                {/* Method Top Bar */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold shrink-0">
                      {renderMethodIcon()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">
                          {language === 'ar' ? method.nameAr : method.nameEn}
                        </h3>
                        {method.isDefault && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-md">
                            {t('افتراضي', 'Default')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <span>{language === 'ar' ? method.nameEn : method.nameAr}</span>
                        {method.code && (
                          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-500">
                            {method.code}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {method.isArchived && (
                    <span className="px-2 py-1 text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg shrink-0">
                      {t('مؤرشف', 'Archived')}
                    </span>
                  )}
                </div>

                {/* Primary Feature: Linked GL Account Card */}
                <div className="mt-3">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      {t('الحساب المرتبط في شجرة الحسابات:', 'Linked GL Account:')}
                    </span>
                    {linkedAccount && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {t('مربوط ونشط', 'Active Link')}
                      </span>
                    )}
                  </div>

                  {linkedAccount ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs">
                            {linkedAccount.code}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {language === 'ar' ? linkedAccount.nameAr : linkedAccount.nameEn}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400">
                          {linkedAccount.type === 'Asset' ? t('أصول', 'Asset') : linkedAccount.type}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">{t('الرصيد الحالي:', 'Balance:')}</span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {linkedAccount.balance?.toLocaleString()} {t('ج.م', 'EGP')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
                            {t('غير مربوط بحساب محاسبي', 'No GL Account Linked')}
                          </div>
                          <div className="text-[10px] text-amber-700 dark:text-amber-400">
                            {t('تُوجّه المبالغ للخزينة العامة كافتراضي', 'Routed to General Cashier by default')}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenEdit(method)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        {t('ربط الآن', 'Link Now')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Additional Method Metadata */}
                <div className="space-y-1.5 mt-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400">{t('نسبة العمولة / الرسوم:', 'Fee Rate:')}</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {method.feePercentage ? `${method.feePercentage}%` : '0%'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400">{t('نطاق الفروع:', 'Branch Scope:')}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {branch ? (language === 'ar' ? branch.name : branch.nameEn) : t('كافة الفروع (عام)', 'All Branches')}
                    </span>
                  </div>

                  {method.instructionsAr && (
                    <div className="py-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
                      &quot;{language === 'ar' ? method.instructionsAr : method.instructionsEn || method.instructionsAr}&quot;
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Receipt className="h-3.5 w-3.5 text-slate-400" />
                  <span>{method.displayOnReceipt ? t('تظهر بالإيصالات', 'On Receipts') : t('مخفية بالإيصال', 'Hidden')}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(method)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>{t('تعديل الحساب', 'Edit Account')}</span>
                  </button>

                  {method.isArchived ? (
                    <button
                      onClick={() => restorePaymentMethod(method.id)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer"
                      title={t('استعادة', 'Restore')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => archivePaymentMethod(method.id, 'أرشفة بواسطة المستخدم')}
                      className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors cursor-pointer"
                      title={t('أرشفة', 'Archive')}
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredMethods.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
          <CreditCard className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t('لا توجد طرق سداد تطابق شروط البحث', 'No payment methods match your criteria')}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {t('يمكنك إضافة طريقة سداد جديدة وربطها بالحساب المحاسبي فوراً', 'You can add a new payment method and map it to a GL account')}
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة طريقة سداد الآن', 'Add Method Now')}</span>
          </button>
        </div>
      )}

      {/* Live Receipt Preview Matrix */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              {t('معاينة فورية: مصفوفة طرق التحصيل وأكواد الحسابات في الإيصال والشيت', 'Live Preview: Receipt Payment Tender Matrix & GL Mapping')}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {t('متوافقة مع تسويات الشيفت وترحيل القيود', 'Compliant with Shift Balancing & GL Postings')}
          </span>
        </div>

        <div className="max-w-2xl mx-auto bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 p-4 rounded-xl font-mono text-xs">
          <div className="border-b border-dashed border-slate-300 dark:border-slate-800 pb-2 mb-3 text-center text-slate-500 font-bold">
            --- {t('طرق التحصيل المعتمدة والترحيل المحاسبي (GL Posting)', 'Approved Payment Channels & GL Postings')} ---
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {paymentMethods
              .filter((pm) => !pm.isArchived)
              .map((pm) => {
                const acc = accounts.find((a) => a.id === pm.linkedAccountId);
                return (
                  <div
                    key={pm.id}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {language === 'ar' ? pm.nameAr : pm.nameEn}
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>GL:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {acc ? `[${acc.code}] ${acc.nameAr.slice(0, 15)}...` : t('خزينة عامة', 'Cash')}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal with Enhanced GL Mapping */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    {editingMethod
                      ? t('تعديل طريقة التحصيل وربط الحساب', 'Edit Payment Method & Account Link')
                      : t('إنشاء طريقة تحصيل وربطها بشجرة الحسابات', 'Create Payment Method & Map to Chart of Accounts')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t(
                      'حدد الحساب المحاسبي الذي سيتم ترحيل المعاملات إليه تلقائياً',
                      'Specify the GL account for automatic double-entry posting'
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Quick Presets (Only when adding new) */}
              {!editingMethod && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    {t('💡 قوالب جاهزة سريعة (تعبئة تلقائية مع ربط الحساب المحاسبي):', '💡 Quick Presets (Auto-fills with linked GL Account):')}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {quickPresets.map((preset) => (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="text-left rtl:text-right p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 text-xs transition-all cursor-pointer group"
                      >
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {preset.nameAr}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          GL: {preset.accountCode}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Names & Codes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Arabic Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم طريقة السداد (عربي) *', 'Payment Method Name (Arabic) *')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="مثال: فيزا بنك مصر، فودافون كاش، خزينة فرع القاهرة"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={handleAutoTranslate}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer shrink-0"
                      title={t('ترجمة آلية إلى الإنجليزية', 'Auto Translate to English')}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{t('ترجمة', 'Translate')}</span>
                    </button>
                  </div>
                </div>

                {/* English Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم طريقة السداد (إنجليزي) *', 'Payment Method Name (English) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Visa Card, Cash Drawer, InstaPay Transfer"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Type and Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('نوع المعاملة المالي', 'Tender Classification Type')}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const newType = e.target.value as PaymentMethod['type'];
                      setType(newType);
                      // Auto-suggest account if not manually set
                      const recAcc = getRecommendedAccountId(newType);
                      if (recAcc) setLinkedAccountId(recAcc);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-indigo-600 font-medium"
                  >
                    <option value="Cash">{t('نقداً (كاش - خزينة)', 'Cash / Cash Drawer')}</option>
                    <option value="Card">{t('بطاقة بنكية / فيزا وماستركارد (POS)', 'Bank Card / Visa POS')}</option>
                    <option value="Transfer">{t('تحويل بنكي / إنستاباي (InstaPay)', 'Bank Transfer / InstaPay')}</option>
                    <option value="Wallet">{t('محفظة هاتف إلكترونية (E-Wallet)', 'Mobile E-Wallet')}</option>
                    <option value="Credit">{t('آجل / حساب ائتماني عملاء', 'Credit / Accounts Receivable')}</option>
                    <option value="Custom">{t('مخصص / أخرى', 'Custom / Other')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رمز الكود الداخلي (Code)', 'Internal Tender Code')}
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="مثال: CASH, VISA-01, INSTAPAY"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* MAIN SECTION: GL ACCOUNT LINKING */}
              <div className="p-4.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                        {t('الربط مع شجرة الحسابات (GL Account Mapping) *', 'Chart of Accounts (GL) Mapping *')}
                      </h4>
                      <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                        {t(
                          'اختر الحساب المالي الذي ستسجل عليه حركات التحصيل والسداد كمدين ودائن',
                          'Select the specific General Ledger account to be debited/credited upon collection or payout'
                        )}
                      </p>
                    </div>
                  </div>
                  {linkedAccountId && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 text-[10px] font-bold">
                      {t('تم الربط', 'Mapped')}
                    </span>
                  )}
                </div>

                {/* Quick Account Suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {t('حسابات شائعة:', 'Quick Picks:')}
                  </span>
                  {accounts
                    .filter((a) => a.code === '1111' || a.code === '1112' || a.code === '1120')
                    .map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setLinkedAccountId(acc.id)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          linkedAccountId === acc.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                        }`}
                      >
                        {acc.code} - {acc.nameAr}
                      </button>
                    ))}
                </div>

                {/* Search / Select Dropdown */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      {t('اختر من شجرة الحسابات:', 'Select from Chart of Accounts:')}
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {accounts.length} {t('حساب متاح بالشجرة', 'accounts in COA')}
                    </span>
                  </div>

                  <select
                    value={linkedAccountId}
                    onChange={(e) => setLinkedAccountId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-xs text-slate-900 dark:text-white focus:outline-indigo-600 font-bold shadow-xs"
                  >
                    <option value="">{t('-- اختر الحساب المحاسبي المرتبط بهذه الطريقة --', '-- Select GL Account --')}</option>

                    {/* Group: Cash and Banks */}
                    <optgroup label={t('--- النقدية بالصندوق والبنوك والمحافظ (الأصول المتداولة) ---', '--- Cash & Bank Accounts ---')}>
                      {categorizedAccounts.cashAndBank.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.nameAr} ({acc.balance?.toLocaleString()} ج.م)
                        </option>
                      ))}
                    </optgroup>

                    {/* Group: Receivables and Customers */}
                    <optgroup label={t('--- العملاء والمدينون التجاريون (للبيع الآجل) ---', '--- Accounts Receivable ---')}>
                      {categorizedAccounts.receivables.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.nameAr}
                        </option>
                      ))}
                    </optgroup>

                    {/* Group: Liabilities and Payables */}
                    <optgroup label={t('--- الالتزامات والدائنون والموردون ---', '--- Liabilities & Payables ---')}>
                      {categorizedAccounts.liabilities.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.nameAr}
                        </option>
                      ))}
                    </optgroup>

                    {/* Group: Other accounts */}
                    <optgroup label={t('--- كافة حسابات شجرة الحسابات الأخرى ---', '--- All Other Accounts ---')}>
                      {accounts
                        .filter(
                          (a) =>
                            !categorizedAccounts.cashAndBank.some((c) => c.id === a.id) &&
                            !categorizedAccounts.receivables.some((r) => r.id === a.id) &&
                            !categorizedAccounts.liabilities.some((l) => l.id === a.id)
                        )
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.nameAr} ({acc.type})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                {/* Selected Account Live Diagnostic Box */}
                {selectedAccountDetails && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-mono font-bold text-xs">
                          {selectedAccountDetails.code}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {selectedAccountDetails.nameAr}
                          </span>
                          <span className="text-slate-400 text-[11px] block">
                            {selectedAccountDetails.nameEn}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">{t('الرصيد المتاح:', 'Balance:')}</span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {selectedAccountDetails.balance?.toLocaleString()} {t('ج.م', 'EGP')}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      <strong>{t('📌 الأثر المحاسبي التلقائي:', 'Automated Ledger Effect:')}</strong>
                      <span className="mx-1">
                        {t(
                          `عند تحصيل فاتورة بهذه الطريقة، سيُرحل قيد مالي يجعل الحساب [${selectedAccountDetails.code} - ${selectedAccountDetails.nameAr}] مديناً (Debit) والإيرادات دائنة (Credit).`,
                          `Upon invoice collection, the entry will Debit [${selectedAccountDetails.code} - ${selectedAccountDetails.nameEn}] and Credit Revenue.`
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Commission Fee & Branch Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('نسبة عمولة البوابة / الرسوم (%)', 'Gateway / Interchange Fee (%)')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={feePercentage}
                    onChange={(e) => setFeePercentage(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('تخصيص لفرع محدد', 'Assign to Branch')}
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-indigo-600 font-medium"
                  >
                    <option value="">{t('كافة فروع الشركة (متاح للجميع)', 'All Branches (Global)')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {language === 'ar' ? b.name : b.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Instructions on Receipt */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('تعليمات السداد المطبوعة على الإيصال', 'Instructions Printed on Receipt Footer')}
                </label>
                <input
                  type="text"
                  value={instructionsAr}
                  onChange={(e) => setInstructionsAr(e.target.value)}
                  placeholder="مثال: تحويل لحظي على رقم المحفظة 01012345678 أو IPA: clinic@instapay"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-indigo-600"
                />
              </div>

              {/* Checkbox Options */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('تعيين كطريقة دفع افتراضية في شاشة الـ POS', 'Set as default in POS checkout')}
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={displayOnReceipt}
                    onChange={(e) => setDisplayOnReceipt(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('عرض في تذييل الإيصالات والفواتير الضريبية', 'Display in tax receipt footer')}
                  </span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-98"
                >
                  {editingMethod
                    ? t('حفظ التعديلات والربط المحاسبي', 'Save & Update Link')
                    : t('حفظ وإنشاء طريقة التحصيل', 'Save & Create Payment Method')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
