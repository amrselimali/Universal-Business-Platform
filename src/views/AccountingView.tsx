import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Account, AccountType } from '../types';
import {
  Calculator,
  BookOpen,
  Scale,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Layers,
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export const AccountingView: React.FC = () => {
  const { t, formatMoney, accounts, journalEntries, createManualJournalEntry, language } = usePlatform();

  const [activeTab, setActiveTab] = useState<'coa' | 'journal' | 'trial_balance'>('coa');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Filtered accounts
  const filteredAccounts = accounts.filter((acc) => {
    const matchesType = selectedType === 'ALL' || acc.type === selectedType;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      acc.code.includes(q) ||
      acc.nameAr.toLowerCase().includes(q) ||
      acc.nameEn.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

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
            {t('المحاسبة العامة والشجرة (General Ledger & COA)', 'Accounting & General Ledger')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'نظام القيد المزدوج المتوازن ومحرك التوجيه المحاسبي الآلي المعتمد بالمعايير المصرية والدولية.',
              'Double-entry balanced accounting engine with automated posting rules.'
            )}
          </p>
        </div>

        <button
          onClick={() => setShowManualModal(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>{t('إنشاء قيد يومية يدوي', 'Create Journal Entry')}</span>
        </button>
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
          <span className="text-xs text-slate-500">{t('المصروفات والتكاليف (Expenses):', 'Total Expenses:')}</span>
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
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('coa')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors ${
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
          onClick={() => setActiveTab('journal')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors ${
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
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors ${
            activeTab === 'trial_balance'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>{t('ميزان المراجعة التقديري (Trial Balance)', 'Trial Balance')}</span>
        </button>
      </div>

      {/* TAB 1: CHART OF ACCOUNTS */}
      {activeTab === 'coa' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          {/* Filters Bar */}
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

          {/* Accounts Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('كود الحساب', 'Code')}</th>
                  <th className="pb-3 font-bold text-start">{t('اسم الحساب', 'Account Name')}</th>
                  <th className="pb-3 font-bold text-start">{t('النوع', 'Type')}</th>
                  <th className="pb-3 font-bold text-start">{t('طبيعة الحساب', 'Normal')}</th>
                  <th className="pb-3 font-bold text-end">{t('الرصيد الحالي', 'Balance')}</th>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL JOURNAL */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          {journalEntries.map((entry) => {
            const entryDebitTotal = entry.lines.reduce((s, l) => s + l.debit, 0);
            const entryCreditTotal = entry.lines.reduce((s, l) => s + l.credit, 0);

            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {entry.entryNumber}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {entry.description}
                    </span>
                    {entry.sourceDocument && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {t('آلي من:', 'Auto from:')} {entry.sourceDocument}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-[11px] mt-1 sm:mt-0">{entry.date}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[11px]">
                        <th className="pb-1 font-semibold text-start">{t('كود الحساب', 'Code')}</th>
                        <th className="pb-1 font-semibold text-start">{t('اسم الحساب في الدفتر', 'Account')}</th>
                        <th className="pb-1 font-semibold text-end">{t('مدين (Debit)', 'Debit')}</th>
                        <th className="pb-1 font-semibold text-end">{t('دائن (Credit)', 'Credit')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      {entry.lines.map((line) => (
                        <tr key={line.id} className="text-slate-700 dark:text-slate-300">
                          <td className="py-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                            {line.accountCode}
                          </td>
                          <td className="py-1.5 font-sans">
                            {language === 'ar' ? line.accountNameAr : line.accountNameEn}
                            {line.memo && <span className="text-slate-400 text-[11px] ps-2">({line.memo})</span>}
                          </td>
                          <td className="py-1.5 text-end font-bold text-slate-900 dark:text-white">
                            {line.debit > 0 ? formatMoney(line.debit) : '-'}
                          </td>
                          <td className="py-1.5 text-end font-bold text-slate-900 dark:text-white">
                            {line.credit > 0 ? formatMoney(line.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                        <td colSpan={2} className="py-1.5 font-sans text-slate-500">
                          {t('إجمالي القيد (Balanced):', 'Total Entry Balanced:')}
                        </td>
                        <td className="py-1.5 text-end text-emerald-600 dark:text-emerald-400">
                          {formatMoney(entryDebitTotal)}
                        </td>
                        <td className="py-1.5 text-end text-emerald-600 dark:text-emerald-400">
                          {formatMoney(entryCreditTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: TRIAL BALANCE */}
      {activeTab === 'trial_balance' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('ميزان المراجعة بالأرصدة (Trial Balance Summary)', 'Trial Balance Summary')}
            </h3>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('دفاتر اليومية متوازنة محاسبياً', 'All Ledgers Strictly Balanced')}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('كود', 'Code')}</th>
                  <th className="pb-3 font-bold text-start">{t('الحساب', 'Account')}</th>
                  <th className="pb-3 font-bold text-end">{t('أرصدة مدينة', 'Debit Balance')}</th>
                  <th className="pb-3 font-bold text-end">{t('أرصدة دائنة', 'Credit Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {accounts
                  .filter((a) => a.balance > 0)
                  .map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono text-indigo-600 dark:text-indigo-400">{acc.code}</td>
                      <td className="py-2.5 text-slate-800 dark:text-slate-200">
                        {language === 'ar' ? acc.nameAr : acc.nameEn}
                      </td>
                      <td className="py-2.5 text-end font-mono">
                        {acc.isDebitNormal ? formatMoney(acc.balance) : '-'}
                      </td>
                      <td className="py-2.5 text-end font-mono">
                        {!acc.isDebitNormal ? formatMoney(acc.balance) : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE MANUAL JOURNAL ENTRY MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
              {t('تسجيل قيد يومية يدوي (Manual Journal Entry)', 'Record Manual Journal Entry')}
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('شرح وبيان القيد المحاسبي:', 'Description / Memo:')}
                </label>
                <input
                  type="text"
                  value={entryDesc}
                  onChange={(e) => setEntryDesc(e.target.value)}
                  placeholder={t('مثال: سداد إيجار مقر الشركة الشهري بشيك', 'e.g. Monthly headquarters rental')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Journal Lines Inputs */}
              <div className="space-y-2">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>{t('أطراف القيد (المدين والدائن):', 'Journal Lines (Debit / Credit):')}</span>
                  <button
                    onClick={() =>
                      setLines((prev) => [
                        ...prev,
                        { accountId: accounts[0].id, debit: 0, credit: 0, memo: '' },
                      ])
                    }
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
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
