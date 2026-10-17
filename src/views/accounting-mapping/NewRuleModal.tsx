import React, { useState } from 'react';
import { X, Plus, Save } from 'lucide-react';
import type { AccountingMappingRule, AccountingTransactionType } from '../../types/accountingMapping';
import { TRANSACTION_TYPE_LABELS } from '../../services/accountingMappingApi';
import type { Account } from '../../types';

interface Props {
  isOpen: boolean;
  tenantId: string;
  accounts: Account[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (rule: Omit<AccountingMappingRule, 'id'>) => Promise<void>;
  t: (ar: string, en?: string) => string;
}

export const NewRuleModal: React.FC<Props> = ({
  isOpen,
  tenantId,
  accounts,
  busy,
  onClose,
  onSubmit,
  t,
}) => {
  const [transactionType, setTransactionType] = useState<AccountingTransactionType>('pos_sale');
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sourceScreen, setSourceScreen] = useState('');
  const [debitCode, setDebitCode] = useState('1111');
  const [creditCode, setCreditCode] = useState('4100');
  const [isStrictExclusive, setIsStrictExclusive] = useState(true);
  const [autoPostEnabled, setAutoPostEnabled] = useState(true);
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const debitAcc = accounts.find((a) => a.code === debitCode);
    const creditAcc = accounts.find((a) => a.code === creditCode);

    await onSubmit({
      tenantId,
      code: code.trim() || `RULE-${transactionType.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      nameAr: nameAr.trim() || (TRANSACTION_TYPE_LABELS[transactionType]?.ar ?? transactionType),
      nameEn: nameEn.trim() || (TRANSACTION_TYPE_LABELS[transactionType]?.en ?? transactionType),
      transactionType,
      sourceScreen: sourceScreen.trim() || 'النظام العام',
      debitAccountCode: debitCode,
      debitAccountName: debitAcc?.nameAr || 'حساب مدين',
      debitAccountId: debitAcc?.id,
      creditAccountCode: creditCode,
      creditAccountName: creditAcc?.nameAr || 'حساب دائن',
      isStrictExclusive,
      autoPostEnabled,
      isActive: true,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-slate-100">
            <Plus className="h-4 w-4 text-indigo-600" />
            {t('إضافة قاعدة ربط محاسبي جديدة', 'Add New Mapping Rule')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
              {t('نوع العملية', 'Transaction Type')}
            </label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as AccountingTransactionType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label.ar} ({label.en})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                {t('اسم القاعدة (عربي)', 'Name (Ar)')}
              </label>
              <input
                required
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: مبيعات الكاشير النقدية"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                {t('كود القاعدة (فريد)', 'Rule Code')}
              </label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="RULE-POS-CASH"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                {t('كود الحساب المدين', 'Debit Account Code')}
              </label>
              <input
                required
                value={debitCode}
                onChange={(e) => setDebitCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-emerald-600 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                {t('كود الحساب الدائن', 'Credit Account Code')}
              </label>
              <input
                required
                value={creditCode}
                onChange={(e) => setCreditCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-amber-600 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
              {t('الشاشة المصدر', 'Source Screen')}
            </label>
            <input
              value={sourceScreen}
              onChange={(e) => setSourceScreen(e.target.value)}
              placeholder="شاشة الكاشير / نقطة البيع"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isStrictExclusive}
                onChange={(e) => setIsStrictExclusive(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {t('مصدر حصري (يمنع القيود اليدوية)', 'Strict Exclusive')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPostEnabled}
                onChange={(e) => setAutoPostEnabled(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {t('ترحيل آلي فوري', 'Auto-Post')}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {t('حفظ القاعدة', 'Save Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
