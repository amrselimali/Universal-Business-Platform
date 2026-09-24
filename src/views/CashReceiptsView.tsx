import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Receipt, ArrowDownLeft, Sparkles, Building2, Wallet } from 'lucide-react';
import { CashReceiptsTab } from './fiscal/CashReceiptsTab';
import { DocumentPrintModal, PrintableDocument } from './fiscal/DocumentPrintModal';

export const CashReceiptsView: React.FC = () => {
  const { cashReceipts, formatMoney, activeBranch } = usePlatform();
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<PrintableDocument | null>(null);

  const totalCollected = cashReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/60 shadow-xs">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                سندات وإيصالات القبض النقدي (Cash Receipts)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                شاشة مستقلة
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              إصدار وتوثيق مقبوضات الخزينة وسندات القبض الرسمية للعملاء مع التفقيط المالي العربي وربط الفواتير
            </p>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي المقبوضات الموثقة</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatMoney(totalCollected)}
            </span>
          </div>
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">عدد السندات</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
              {cashReceipts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <CashReceiptsTab
        onPrintReceipt={(receipt) => setSelectedDocForPrint({ type: 'cash_receipt', data: receipt })}
      />

      {/* Print Modal */}
      <DocumentPrintModal
        document={selectedDocForPrint}
        onClose={() => setSelectedDocForPrint(null)}
      />
    </div>
  );
};
