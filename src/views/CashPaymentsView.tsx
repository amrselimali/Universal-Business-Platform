import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { CreditCard, ArrowUpRight, Sparkles, Building2, Wallet } from 'lucide-react';
import { CashPaymentsTab } from './fiscal/CashPaymentsTab';
import { DocumentPrintModal, PrintableDocument } from './fiscal/DocumentPrintModal';

export const CashPaymentsView: React.FC = () => {
  const { cashPayments, formatMoney } = usePlatform();
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<PrintableDocument | null>(null);

  const totalPaid = cashPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-100 dark:border-rose-900/60 shadow-xs">
            <CreditCard className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                سندات وإيصالات الصرف النقدي (Cash Payments)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                شاشة مستقلة
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              إصدار سندات الصرف الرسمية، توثيق المصروفات التشغيلية وصيانة أجهزة الليزر مع دورة التوقيعات والاعتمادات
            </p>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي المصروفات بالسندات</span>
            <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
              {formatMoney(totalPaid)}
            </span>
          </div>
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">عدد السندات</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
              {cashPayments.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <CashPaymentsTab
        onPrintPayment={(payment) => setSelectedDocForPrint({ type: 'cash_payment', data: payment })}
      />

      {/* Print Modal */}
      <DocumentPrintModal
        document={selectedDocForPrint}
        onClose={() => setSelectedDocForPrint(null)}
      />
    </div>
  );
};
