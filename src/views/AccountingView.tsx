import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Account, AccountType } from '../types';
import { autoTranslateArabic } from '../utils/translator';
import {
  BookOpen,
  Scale,
  Plus,
  AlertCircle,
  FileText,
  Search,
  Printer,
  Edit3,
  Trash2,
  FolderPlus,
  History,
  TrendingDown,
  TrendingUp,
  Layers,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import { PartyStatementModal } from '../components/PartyStatementModal';

export const AccountingView: React.FC = () => {
  const {
    t,
    formatMoney,
    accounts,
    journalEntries,
    addAccount,
    updateAccount,
    deleteAccount,
    createManualJournalEntry,
    language,
    tenant,
    activeBranch,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'coa' | 'general_ledger' | 'journal' | 'trial_balance' | 'statements'>('coa');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Account Modal State (Add / Edit)
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<{
    code: string;
    nameAr: string;
    nameEn: string;
    type: AccountType;
    parentId: string;
    isDebitNormal: boolean;
    balance: number;
  }>({
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'Asset',
    parentId: '',
    isDebitNormal: true,
    balance: 0,
  });
  const [accountModalError, setAccountModalError] = useState<string | null>(null);

  // General Ledger State
  const [selectedGLAccountId, setSelectedGLAccountId] = useState<string>(() => {
    return accounts.find((a) => a.code === '1111')?.id || accounts[0]?.id || '';
  });
  const [glDateFrom, setGlDateFrom] = useState<string>('');
  const [glDateTo, setGlDateTo] = useState<string>('');
  const [glPeriodFilter, setGlPeriodFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('all');
  const [showPrintGL, setShowPrintGL] = useState<boolean>(false);

  // Manual Journal Modal State
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [entryDesc, setEntryDesc] = useState<string>('');
  const [lines, setLines] = useState<
    { accountId: string; debit: number; credit: number; memo: string }[]
  >([
    { accountId: accounts[0]?.id || '', debit: 1000, credit: 0, memo: '' },
    { accountId: accounts[1]?.id || '', debit: 0, credit: 1000, memo: '' },
  ]);
  const [modalError, setModalError] = useState<string | null>(null);

  // Totals for Trial Balance
  const totalDebits = accounts
    .filter((a) => a.isDebitNormal)
    .reduce((sum, a) => sum + a.balance, 0);
  const totalCredits = accounts
    .filter((a) => !a.isDebitNormal)
    .reduce((sum, a) => sum + a.balance, 0);

  // Total Revenue & Expense for Net Profit
  const totalRevenue = accounts
    .filter((a) => a.type === 'Revenue')
    .reduce((sum, a) => sum + a.balance, 0);
  const totalExpense = accounts
    .filter((a) => a.type === 'Expense')
    .reduce((sum, a) => sum + a.balance, 0);
  const netIncome = totalRevenue - totalExpense;

  // Sorted accounts by account code (ترتيب شجرة الحسابات بكود الحساب)
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [accounts]);

  // Filtered accounts for COA table (ordered by account code)
  const filteredAccounts = useMemo(() => {
    return sortedAccounts.filter((acc) => {
      const matchesType = selectedType === 'ALL' || acc.type === selectedType;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.code.includes(q) ||
        acc.nameAr.toLowerCase().includes(q) ||
        acc.nameEn.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [sortedAccounts, selectedType, searchQuery]);

  // Open Add Account modal (optionally with parent preset)
  const handleOpenAddAccount = (parentId: string = '') => {
    setModalMode('add');
    setEditingAccountId(null);
    setAccountModalError(null);

    let nextCode = '';
    let accountType: AccountType = 'Asset';
    let isDebit = true;

    if (parentId) {
      const parentAcc = accounts.find((a) => a.id === parentId);
      if (parentAcc) {
        accountType = parentAcc.type;
        isDebit = parentAcc.isDebitNormal;
        // Count existing siblings
        const siblings = accounts.filter((a) => a.parentId === parentId);
        const subIndex = siblings.length + 1;
        nextCode = `${parentAcc.code}${subIndex < 10 ? subIndex : subIndex}`;
      }
    } else {
      nextCode = `${accounts.length + 1}000`;
    }

    setAccountForm({
      code: nextCode,
      nameAr: '',
      nameEn: '',
      type: accountType,
      parentId,
      isDebitNormal: isDebit,
      balance: 0,
    });
    setShowAccountModal(true);
  };

  // Open Edit Account modal
  const handleOpenEditAccount = (acc: Account) => {
    setModalMode('edit');
    setEditingAccountId(acc.id);
    setAccountModalError(null);
    setAccountForm({
      code: acc.code,
      nameAr: acc.nameAr,
      nameEn: acc.nameEn,
      type: acc.type,
      parentId: acc.parentId || '',
      isDebitNormal: acc.isDebitNormal,
      balance: acc.balance,
    });
    setShowAccountModal(true);
  };

  // Save Account (Add or Edit)
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountModalError(null);

    if (!accountForm.code.trim() || !accountForm.nameAr.trim()) {
      setAccountModalError(t('يرجى كتابة كود واسم الحساب!', 'Please provide account code and Arabic name!'));
      return;
    }

    const nameEn = accountForm.nameEn.trim() || autoTranslateArabic(accountForm.nameAr);
    const parent = accounts.find((a) => a.id === accountForm.parentId);
    const level = parent ? (parent.level || 1) + 1 : 1;

    if (modalMode === 'add') {
      // Check code uniqueness
      if (accounts.some((a) => a.code === accountForm.code.trim())) {
        setAccountModalError(t('كود الحساب مسجل مسبقاً! يرجى اختيار كود فريد.', 'Account code already exists!'));
        return;
      }

      addAccount({
        code: accountForm.code.trim(),
        nameAr: accountForm.nameAr.trim(),
        nameEn,
        type: accountForm.type,
        parentId: accountForm.parentId || undefined,
        level,
        isDebitNormal: accountForm.isDebitNormal,
        balance: Number(accountForm.balance) || 0,
      });
    } else if (editingAccountId) {
      updateAccount(editingAccountId, {
        code: accountForm.code.trim(),
        nameAr: accountForm.nameAr.trim(),
        nameEn,
        type: accountForm.type,
        parentId: accountForm.parentId || undefined,
        level,
        isDebitNormal: accountForm.isDebitNormal,
        balance: Number(accountForm.balance) || 0,
      });
    }

    setShowAccountModal(false);
  };

  // Delete Account
  const handleDeleteAccount = (acc: Account) => {
    if (
      !confirm(
        t(
          `هل أنت متأكد من حذف الحساب "${acc.code} - ${acc.nameAr}"؟`,
          `Are you sure you want to delete account "${acc.code} - ${acc.nameAr}"?`
        )
      )
    ) {
      return;
    }

    const res = deleteAccount(acc.id);
    if (!res.success) {
      alert(res.error || t('فشل حذف الحساب', 'Failed to delete account'));
    }
  };

  // Switch to General Ledger for a specific account
  const handleViewGL = (accountId: string) => {
    setSelectedGLAccountId(accountId);
    setActiveTab('general_ledger');
  };

  // Quick GL Date Filter
  const handleGLPeriodChange = (filter: 'all' | 'this_month' | 'last_month' | 'this_year') => {
    setGlPeriodFilter(filter);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (filter === 'all') {
      setGlDateFrom('');
      setGlDateTo('');
    } else if (filter === 'this_month') {
      const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setGlDateFrom(firstDay);
      setGlDateTo(lastDay);
    } else if (filter === 'last_month') {
      const firstDay = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m, 0).toISOString().split('T')[0];
      setGlDateFrom(firstDay);
      setGlDateTo(lastDay);
    } else if (filter === 'this_year') {
      const firstDay = `${y}-01-01`;
      const lastDay = `${y}-12-31`;
      setGlDateFrom(firstDay);
      setGlDateTo(lastDay);
    }
  };

  // Active GL Account object
  const activeGLAccount = accounts.find((a) => a.id === selectedGLAccountId) || accounts[0];

  // General Ledger Movements calculation
  const glData = useMemo(() => {
    if (!activeGLAccount) {
      return { movements: [], openingBalance: 0, totalDebits: 0, totalCredits: 0, endingBalance: 0 };
    }

    const isDebitNormal = activeGLAccount.isDebitNormal;

    // Collect all journal lines referencing this account
    const allMatchingLines: {
      journalId: string;
      entryNumber: string;
      date: string;
      description: string;
      sourceDocument?: string;
      lineId: string;
      debit: number;
      credit: number;
      memo?: string;
    }[] = [];

    journalEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.accountId === activeGLAccount.id) {
          allMatchingLines.push({
            journalId: entry.id,
            entryNumber: entry.entryNumber,
            date: entry.date,
            description: entry.description,
            sourceDocument: entry.sourceDocument,
            lineId: line.id,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
          });
        }
      });
    });

    // Sort chronologically
    allMatchingLines.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    // Calculate opening balance before `glDateFrom`
    let opening = 0;
    const periodMovements: typeof allMatchingLines = [];

    allMatchingLines.forEach((m) => {
      const isBeforePeriod = glDateFrom && m.date < glDateFrom;
      const isAfterPeriod = glDateTo && m.date > glDateTo;

      if (isBeforePeriod) {
        if (isDebitNormal) {
          opening += m.debit - m.credit;
        } else {
          opening += m.credit - m.debit;
        }
      } else if (!isAfterPeriod) {
        periodMovements.push(m);
      }
    });

    // If no date filters, include initial account balance if it exceeds journal lines
    if (!glDateFrom) {
      const sumDebits = allMatchingLines.reduce((s, m) => s + m.debit, 0);
      const sumCredits = allMatchingLines.reduce((s, m) => s + m.credit, 0);
      const netJournals = isDebitNormal ? sumDebits - sumCredits : sumCredits - sumDebits;
      if (activeGLAccount.balance > netJournals) {
        opening = activeGLAccount.balance - netJournals;
      }
    }

    let running = opening;
    let periodDebits = 0;
    let periodCredits = 0;

    const enrichedMovements = periodMovements.map((mov) => {
      periodDebits += mov.debit;
      periodCredits += mov.credit;

      if (isDebitNormal) {
        running += mov.debit - mov.credit;
      } else {
        running += mov.credit - mov.debit;
      }

      return {
        ...mov,
        runningBalance: running,
      };
    });

    return {
      movements: enrichedMovements,
      openingBalance: opening,
      totalDebits: periodDebits,
      totalCredits: periodCredits,
      endingBalance: running,
    };
  }, [activeGLAccount, journalEntries, glDateFrom, glDateTo]);

  // Save manual journal
  const handleSaveManualEntry = () => {
    setModalError(null);
    if (!entryDesc.trim()) {
      setModalError(t('يرجى إدخال وصف القيد', 'Please provide an entry description'));
      return;
    }

    const res = createManualJournalEntry({
      description: entryDesc,
      lines,
    });

    if (res.success) {
      setShowManualModal(false);
      setEntryDesc('');
      setLines([
        { accountId: accounts[0]?.id || '', debit: 0, credit: 0, memo: '' },
        { accountId: accounts[1]?.id || '', debit: 0, credit: 0, memo: '' },
      ]);
    } else {
      setModalError(res.error || t('حدث خطأ في حفظ القيد', 'Error saving journal entry'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {t('المحاسبة العامة والشجرة ودليل الأستاذ (GL & COA)', 'Accounting, Chart of Accounts & General Ledger')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'شجرة الحسابات المتكاملة، دفتر الأستاذ التفصيلي، قيود اليومية الآلية والمزدوجة، وميزان المراجعة.',
              'Double-entry balanced accounting engine with automated posting rules and comprehensive ledger.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddAccount('')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة حساب بالشجرة', 'Add Account')}</span>
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 dark:bg-slate-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-900 transition-all active:scale-95"
          >
            <FileText className="h-4 w-4" />
            <span>{t('قيد يومية يدوي', 'Manual Entry')}</span>
          </button>
        </div>
      </div>

      {/* Financial Health Ribbon */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('إجمالي إيرادات النشاط (Revenues):', 'Total Revenues:')}</span>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(totalRevenue)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('إجمالي المصروفات (Expenses):', 'Total Expenses:')}</span>
          <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatMoney(totalExpense)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('صافي الأرباح التشغيلية (Net Income):', 'Net Operating Income:')}</span>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {formatMoney(netIncome)}
          </p>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('coa')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'coa'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>{t('شجرة الحسابات (Chart of Accounts)', 'Chart of Accounts')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {accounts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('general_ledger')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'general_ledger'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <History className="h-4 w-4" />
          <span>{t('حساب الأستاذ العام (General Ledger)', 'General Ledger')}</span>
          {activeGLAccount && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-mono text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              {activeGLAccount.code}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('journal')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'journal'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{t('دفتر اليومية العامة والقيود الآلية', 'General Journal Entries')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {journalEntries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trial_balance')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'trial_balance'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>{t('ميزان المراجعة (Trial Balance)', 'Trial Balance')}</span>
        </button>

        <button
          onClick={() => setActiveTab('statements')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'statements'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4 text-emerald-600" />
          <span>{t('كشوف حسابات العملاء والموردين', 'Customer & Supplier Statements')}</span>
        </button>
      </div>

      {/* TAB: CUSTOMER & SUPPLIER STATEMENTS */}
      {activeTab === 'statements' && (
        <PartyStatementModal
          onClose={() => setActiveTab('coa')}
        />
      )}

      {/* TAB 1: CHART OF ACCOUNTS */}
      {activeTab === 'coa' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          {/* Filters & Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('ابحث بكود الحساب أو الاسم...', 'Search by account code or name...')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-4 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {(['ALL', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {type === 'ALL'
                    ? t('الكل', 'All')
                    : type === 'Asset'
                    ? t('الأصول', 'Assets')
                    : type === 'Liability'
                    ? t('الالتزامات', 'Liabilities')
                    : type === 'Equity'
                    ? t('حقوق الملكية', 'Equity')
                    : type === 'Revenue'
                    ? t('الإيرادات', 'Revenues')
                    : t('المصروفات', 'Expenses')}
                </button>
              ))}
            </div>
          </div>

          {/* Accounts Table with Action Buttons */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('كود الحساب', 'Code')}</th>
                  <th className="pb-3 font-bold text-start">{t('اسم الحساب', 'Account Name')}</th>
                  <th className="pb-3 font-bold text-start">{t('النوع', 'Type')}</th>
                  <th className="pb-3 font-bold text-start">{t('طبيعة الحساب', 'Normal')}</th>
                  <th className="pb-3 font-bold text-end">{t('الرصيد الحالي', 'Balance')}</th>
                  <th className="pb-3 font-bold text-center">{t('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredAccounts.map((acc) => {
                  const paddingClass = acc.level === 1 ? '' : acc.level === 2 ? 'ps-4' : 'ps-8';
                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${
                        acc.level === 1 ? 'font-bold bg-slate-50/40 dark:bg-slate-800/20' : ''
                      }`}
                    >
                      <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {acc.code}
                      </td>
                      <td className={`py-3 ${paddingClass}`}>
                        <div className="flex items-center gap-2">
                          {acc.level > 1 && <span className="text-slate-300 dark:text-slate-600">└─</span>}
                          <span className="text-slate-900 dark:text-white">
                            {language === 'ar' ? acc.nameAr : acc.nameEn}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            acc.type === 'Asset'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              : acc.type === 'Liability'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : acc.type === 'Equity'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                              : acc.type === 'Revenue'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          }`}
                        >
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">
                        {acc.isDebitNormal ? t('مدين (Debit)', 'Debit') : t('دائن (Credit)', 'Credit')}
                      </td>
                      <td className="py-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(acc.balance)}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Jump to General Ledger */}
                          <button
                            onClick={() => handleViewGL(acc.id)}
                            title={t('عرض دفتر الأستاذ', 'View General Ledger')}
                            className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 transition-colors"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>

                          {/* Add Sub-account */}
                          <button
                            onClick={() => handleOpenAddAccount(acc.id)}
                            title={t('إضافة حساب فرعي', 'Add Sub-account')}
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 transition-colors"
                          >
                            <FolderPlus className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Account */}
                          <button
                            onClick={() => handleOpenEditAccount(acc)}
                            title={t('تعديل الحساب', 'Edit Account')}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => handleDeleteAccount(acc)}
                            title={t('حذف الحساب', 'Delete Account')}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL LEDGER (حساب الأستاذ العام) */}
      {activeTab === 'general_ledger' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Account Selector */}
            <div className="w-full md:w-80">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('اختر حساب الأستاذ المطلوب استعراضه *', 'Select GL Account *')}
              </label>
              <select
                value={selectedGLAccountId}
                onChange={(e) => setSelectedGLAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.nameAr} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['all', 'this_month', 'last_month', 'this_year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleGLPeriodChange(p)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      glPeriodFilter === p
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p === 'all'
                      ? t('كل المدة', 'All Time')
                      : p === 'this_month'
                      ? t('هذا الشهر', 'This Month')
                      : p === 'last_month'
                      ? t('الشهر السابق', 'Last Month')
                      : t('هذا العام', 'This Year')}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={glDateFrom}
                  onChange={(e) => {
                    setGlDateFrom(e.target.value);
                    setGlPeriodFilter('all');
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium dark:text-white"
                />
                <span className="text-xs text-slate-400">إلى</span>
                <input
                  type="date"
                  value={glDateTo}
                  onChange={(e) => {
                    setGlDateTo(e.target.value);
                    setGlPeriodFilter('all');
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium dark:text-white"
                />
              </div>

              <button
                onClick={() => setShowPrintGL(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Printer className="h-4 w-4 text-indigo-600" />
                <span>{t('طباعة كشف الأستاذ', 'Print Ledger')}</span>
              </button>
            </div>
          </div>

          {/* Account Profile & Financial Metrics */}
          {activeGLAccount && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                      {activeGLAccount.code}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {language === 'ar' ? activeGLAccount.nameAr : activeGLAccount.nameEn}
                    </h2>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {activeGLAccount.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('طبيعة الحساب الأصلية:', 'Normal Nature:')}{' '}
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {activeGLAccount.isDebitNormal ? t('مدين بطبيعته (Debit)', 'Debit') : t('دائن بطبيعته (Credit)', 'Credit')}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-end">
                    <span className="text-[11px] text-slate-400 block">{t('رصيد نهاية الفترة / الحالي', 'Closing Balance')}</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {formatMoney(glData.endingBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Financial KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">{t('رصيد أول المدة', 'Opening Balance')}</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 block font-mono">
                    {formatMoney(glData.openingBalance)}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center dark:border-emerald-950/50 dark:bg-emerald-950/30">
                  <span className="text-[11px] text-emerald-600 block">{t('إجمالي حركات المدين (+)', 'Total Debits')}</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1 block font-mono">
                    {formatMoney(glData.totalDebits)}
                  </span>
                </div>

                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-center dark:border-rose-950/50 dark:bg-rose-950/30">
                  <span className="text-[11px] text-rose-600 block">{t('إجمالي حركات الدائن (-)', 'Total Credits')}</span>
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-400 mt-1 block font-mono">
                    {formatMoney(glData.totalCredits)}
                  </span>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-center dark:border-indigo-950/50 dark:bg-indigo-950/30">
                  <span className="text-[11px] text-indigo-600 block">{t('صافي رصيد الحساب', 'Current Balance')}</span>
                  <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-1 block font-mono">
                    {formatMoney(glData.endingBalance)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Movements Ledger Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
              <span>{t('حركات دفتر الأستاذ التفصيلية', 'General Ledger Transaction Lines')}</span>
              <span className="text-[11px] font-normal text-slate-400">
                {glData.movements.length} {t('حركة مقيدة', 'posted movements')}
              </span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                    <th className="pb-3 font-bold text-start">{t('التاريخ', 'Date')}</th>
                    <th className="pb-3 font-bold text-start">{t('رقم القيد', 'JV No.')}</th>
                    <th className="pb-3 font-bold text-start">{t('المستند المرجعي', 'Source Doc')}</th>
                    <th className="pb-3 font-bold text-start">{t('البيان والشرح', 'Description & Memo')}</th>
                    <th className="pb-3 font-bold text-end">{t('مدين (Debit)', 'Debit')}</th>
                    <th className="pb-3 font-bold text-end">{t('دائن (Credit)', 'Credit')}</th>
                    <th className="pb-3 font-bold text-end">{t('الرصيد التراكمي', 'Running Balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {/* Row: Opening Balance */}
                  <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300">
                    <td className="py-2.5 font-bold" colSpan={4}>
                      {t('--- رصيد بداية الفترة المنقول ---', '--- Opening Balance Carried Forward ---')}
                    </td>
                    <td className="py-2.5 text-end font-mono">-</td>
                    <td className="py-2.5 text-end font-mono">-</td>
                    <td className="py-2.5 text-end font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {formatMoney(glData.openingBalance)}
                    </td>
                  </tr>

                  {glData.movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {t('لا توجد حركات مقيدة لهذا الحساب خلال الفترة المحددة', 'No transactions found for this account in the selected period.')}
                      </td>
                    </tr>
                  ) : (
                    glData.movements.map((m) => (
                      <tr key={m.lineId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-mono text-slate-500 whitespace-nowrap">{m.date}</td>
                        <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {m.entryNumber}
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {m.sourceDocument || t('قيد يومية عام', 'General JV')}
                        </td>
                        <td className="py-3">
                          <div className="text-slate-900 dark:text-white font-semibold">{m.description}</div>
                          {m.memo && <div className="text-[11px] text-slate-400 mt-0.5">{m.memo}</div>}
                        </td>
                        <td className="py-3 text-end font-mono font-bold text-emerald-600">
                          {m.debit > 0 ? formatMoney(m.debit) : '-'}
                        </td>
                        <td className="py-3 text-end font-mono font-bold text-rose-600">
                          {m.credit > 0 ? formatMoney(m.credit) : '-'}
                        </td>
                        <td className="py-3 text-end font-mono font-black text-slate-900 dark:text-white">
                          {formatMoney(m.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50/50 dark:bg-slate-800/30">
                    <td className="py-3" colSpan={4}>
                      {t('إجمالي حركات الفترة والرصيد الختامي:', 'Total Period Movements & Closing Balance:')}
                    </td>
                    <td className="py-3 text-end font-mono text-emerald-600 font-black">
                      {formatMoney(glData.totalDebits)}
                    </td>
                    <td className="py-3 text-end font-mono text-rose-600 font-black">
                      {formatMoney(glData.totalCredits)}
                    </td>
                    <td className="py-3 text-end font-mono text-indigo-600 dark:text-indigo-400 font-black text-sm">
                      {formatMoney(glData.endingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GENERAL JOURNAL */}
      {activeTab === 'journal' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t('سجل قيود اليومية العامة (Journal Entries)', 'General Journal')}
            </h3>
            <span className="text-xs text-slate-400">{journalEntries.length} {t('قيد مقيد', 'entries')}</span>
          </div>

          <div className="space-y-4">
            {journalEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
                      {entry.entryNumber}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{entry.description}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{entry.date}</span>
                    {entry.sourceDocument && (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {entry.sourceDocument}
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="pb-1 text-start">{t('كود واسم الحساب', 'Account')}</th>
                        <th className="pb-1 text-start">{t('البيان / الشرح', 'Memo')}</th>
                        <th className="pb-1 text-end">{t('مدين', 'Debit')}</th>
                        <th className="pb-1 text-end">{t('دائن', 'Credit')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium">
                      {entry.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-2 text-slate-900 dark:text-white">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 me-2">
                              {l.accountCode}
                            </span>
                            {language === 'ar' ? l.accountNameAr : l.accountNameEn}
                          </td>
                          <td className="py-2 text-slate-500">{l.memo || '-'}</td>
                          <td className="py-2 text-end font-mono font-bold text-emerald-600">
                            {l.debit > 0 ? formatMoney(l.debit) : '-'}
                          </td>
                          <td className="py-2 text-end font-mono font-bold text-rose-600">
                            {l.credit > 0 ? formatMoney(l.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TRIAL BALANCE */}
      {activeTab === 'trial_balance' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {t('ميزان المراجعة التقديري بالأرصدة', 'Trial Balance (Balances)')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('توازن إجمالي الأرصدة المدينة مع الأرصدة الدائنة لتأكيد صحة الدفاتر.', 'Verification of double-entry equality.')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {t('الميزان متوازن', 'Balanced')}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('كود الحساب', 'Code')}</th>
                  <th className="pb-3 font-bold text-start">{t('اسم الحساب', 'Account Name')}</th>
                  <th className="pb-3 font-bold text-start">{t('النوع', 'Type')}</th>
                  <th className="pb-3 font-bold text-end">{t('رصيد مدين', 'Debit Balance')}</th>
                  <th className="pb-3 font-bold text-end">{t('رصيد دائن', 'Credit Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{acc.code}</td>
                    <td className="py-2.5 text-slate-900 dark:text-white">
                      {language === 'ar' ? acc.nameAr : acc.nameEn}
                    </td>
                    <td className="py-2.5 text-slate-500">{acc.type}</td>
                    <td className="py-2.5 text-end font-mono font-bold text-emerald-600">
                      {acc.isDebitNormal ? formatMoney(acc.balance) : '-'}
                    </td>
                    <td className="py-2.5 text-end font-mono font-bold text-rose-600">
                      {!acc.isDebitNormal ? formatMoney(acc.balance) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800/50">
                  <td className="py-3" colSpan={3}>
                    {t('الإجمالي العام لميزان المراجعة:', 'Trial Balance Total:')}
                  </td>
                  <td className="py-3 text-end font-mono font-black text-emerald-600 text-sm">
                    {formatMoney(totalDebits)}
                  </td>
                  <td className="py-3 text-end font-mono font-black text-rose-600 text-sm">
                    {formatMoney(totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT ACCOUNT MODAL */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {modalMode === 'add'
                  ? t('إضافة حساب جديد إلى شجرة الحسابات', 'Add New Account to COA')
                  : t('تعديل بيانات الحساب المحاسبي', 'Edit Account Details')}
              </h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الحساب *', 'Account Code *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.code}
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold focus:outline-indigo-600"
                    placeholder="e.g. 1113"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('النوع الرئيسي *', 'Account Type *')}
                  </label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => {
                      const newType = e.target.value as AccountType;
                      const isDebit = newType === 'Asset' || newType === 'Expense';
                      setAccountForm({ ...accountForm, type: newType, isDebitNormal: isDebit });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold focus:outline-indigo-600"
                  >
                    <option value="Asset">{t('أصول (Asset)', 'Asset')}</option>
                    <option value="Liability">{t('خصوم والتزامات (Liability)', 'Liability')}</option>
                    <option value="Equity">{t('حقوق ملكية (Equity)', 'Equity')}</option>
                    <option value="Revenue">{t('إيرادات (Revenue)', 'Revenue')}</option>
                    <option value="Expense">{t('مصروفات (Expense)', 'Expense')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الحساب بالعربية *', 'Arabic Account Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={accountForm.nameAr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAccountForm({
                      ...accountForm,
                      nameAr: val,
                      nameEn: autoTranslateArabic(val),
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                  placeholder="مثال: الخزينة الفرعية - عهدة الاستقبال"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الحساب بالإنجليزية (مترجم تلقائياً)', 'English Account Name')}
                </label>
                <input
                  type="text"
                  value={accountForm.nameEn}
                  onChange={(e) => setAccountForm({ ...accountForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono"
                  placeholder="e.g. Reception Cash Box"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الحساب الرئيسي (الأب)', 'Parent Account')}
                  </label>
                  <select
                    value={accountForm.parentId}
                    onChange={(e) => setAccountForm({ ...accountForm, parentId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('-- حساب رئيسي مستقل (بدون أب) --', '-- Root Account --')}</option>
                    {accounts
                      .filter((a) => a.id !== editingAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.nameAr}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('طبيعة الحساب', 'Normal Balance')}
                  </label>
                  <select
                    value={accountForm.isDebitNormal ? 'true' : 'false'}
                    onChange={(e) => setAccountForm({ ...accountForm, isDebitNormal: e.target.value === 'true' })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="true">{t('مدين (Debit)', 'Debit')}</option>
                    <option value="false">{t('دائن (Credit)', 'Credit')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الرصيد الافتتاحي (ج.م)', 'Opening Balance')}
                </label>
                <input
                  type="number"
                  value={accountForm.balance}
                  onChange={(e) => setAccountForm({ ...accountForm, balance: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs font-bold text-indigo-600 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono"
                />
              </div>

              {accountModalError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{accountModalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-sm"
                >
                  {modalMode === 'add' ? t('حفظ الحساب الجديد', 'Save Account') : t('تحديث البيانات', 'Update Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT GENERAL LEDGER MODAL */}
      {showPrintGL && activeGLAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('كشف حساب الأستاذ العام المعتمد', 'Official General Ledger Statement')}
                </h3>
                <p className="text-xs text-slate-400">
                  {tenant?.name} • {activeBranch?.nameAr}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  <span>{t('طباعة الآن', 'Print Now')}</span>
                </button>
                <button
                  onClick={() => setShowPrintGL(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Dossier Header */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block">{t('كود الحساب:', 'Code:')}</span>
                <span className="font-mono font-bold text-indigo-600">{activeGLAccount.code}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('اسم الحساب:', 'Name:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{activeGLAccount.nameAr}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('النوع والطبيعة:', 'Type & Nature:')}</span>
                <span className="font-bold">{activeGLAccount.type} ({activeGLAccount.isDebitNormal ? 'مدين' : 'دائن'})</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('الرصيد الختامي:', 'Closing Balance:')}</span>
                <span className="font-mono font-black text-indigo-700 dark:text-indigo-400">{formatMoney(glData.endingBalance)}</span>
              </div>
            </div>

            {/* Printable Table */}
            <table className="w-full text-xs border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                <tr>
                  <th className="p-2 text-start border-b">{t('التاريخ', 'Date')}</th>
                  <th className="p-2 text-start border-b">{t('رقم القيد', 'JV No.')}</th>
                  <th className="p-2 text-start border-b">{t('البيان والشرح', 'Description')}</th>
                  <th className="p-2 text-end border-b">{t('مدين', 'Debit')}</th>
                  <th className="p-2 text-end border-b">{t('دائن', 'Credit')}</th>
                  <th className="p-2 text-end border-b">{t('الرصيد', 'Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr className="bg-slate-50/50">
                  <td className="p-2 font-bold" colSpan={3}>{t('رصيد أول المدة المنقول', 'Opening Balance')}</td>
                  <td className="p-2 text-end font-mono">-</td>
                  <td className="p-2 text-end font-mono">-</td>
                  <td className="p-2 text-end font-mono font-bold text-indigo-600">{formatMoney(glData.openingBalance)}</td>
                </tr>
                {glData.movements.map((m) => (
                  <tr key={m.lineId}>
                    <td className="p-2 font-mono">{m.date}</td>
                    <td className="p-2 font-mono font-bold">{m.entryNumber}</td>
                    <td className="p-2">{m.description}</td>
                    <td className="p-2 text-end font-mono text-emerald-600">{m.debit > 0 ? formatMoney(m.debit) : '-'}</td>
                    <td className="p-2 text-end font-mono text-rose-600">{m.credit > 0 ? formatMoney(m.credit) : '-'}</td>
                    <td className="p-2 text-end font-mono font-bold">{formatMoney(m.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MANUAL JOURNAL MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('إنشاء قيد يومية يدوي جديد', 'Create Manual Journal Entry')}
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('البيان وشرح القيد *', 'Entry Description *')}
                </label>
                <input
                  type="text"
                  value={entryDesc}
                  onChange={(e) => setEntryDesc(e.target.value)}
                  placeholder="مثال: تسوية إيجار الفرع، سداد مصروفات عهدة..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Journal Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{t('أطراف القيد (المدين والدائن)', 'Journal Lines')}</span>
                  <button
                    onClick={() =>
                      setLines([...lines, { accountId: accounts[0]?.id || '', debit: 0, credit: 0, memo: '' }])
                    }
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                  >
                    + {t('إضافة طرف قيد', 'Add Line')}
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={line.accountId}
                      onChange={(e) => {
                        const copy = [...lines];
                        copy[idx].accountId = e.target.value;
                        setLines(copy);
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 font-medium text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.nameAr}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder={t('مدين', 'Debit')}
                      value={line.debit || ''}
                      onChange={(e) => {
                        const copy = [...lines];
                        copy[idx].debit = Number(e.target.value) || 0;
                        if (copy[idx].debit > 0) copy[idx].credit = 0;
                        setLines(copy);
                      }}
                      className="w-28 rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-end outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />

                    <input
                      type="number"
                      placeholder={t('دائن', 'Credit')}
                      value={line.credit || ''}
                      onChange={(e) => {
                        const copy = [...lines];
                        copy[idx].credit = Number(e.target.value) || 0;
                        if (copy[idx].credit > 0) copy[idx].debit = 0;
                        setLines(copy);
                      }}
                      className="w-28 rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-end outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                ))}
              </div>

              {modalError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSaveManualEntry}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('ترحيل وحفظ القيد في اليومية', 'Post & Balance Entry')}
                </button>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
