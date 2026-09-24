import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { FileText, Sparkles, ShieldCheck, QrCode } from 'lucide-react';
import { SpecializedTaxInvoicesTab } from './fiscal/SpecializedTaxInvoicesTab';
import { DocumentPrintModal, PrintableDocument } from './fiscal/DocumentPrintModal';

export const SpecializedTaxInvoicesView: React.FC = () => {
  const { specializedTaxInvoices, formatMoney } = usePlatform();
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<PrintableDocument | null>(null);

  const totalInvoiced = specializedTaxInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalVat = specializedTaxInvoices.reduce((sum, inv) => sum + (inv.totalVat || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-2xl border border-sky-100 dark:border-sky-900/60 shadow-xs">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                الفواتير الضريبية المتخصصة للعملاء (Specialized Tax Invoices)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                شاشة مستقلة
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              إصدار فواتير ضريبية معتمدة للشركات والأفراد (B2B / B2C) متوافقة مع متطلبات ZATCA وتوليد كود QR المشفر
            </p>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي الفواتير شامل الضريبة</span>
            <span className="text-sm font-black text-sky-600 dark:text-sky-400 font-mono">
              {formatMoney(totalInvoiced)}
            </span>
          </div>
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">ضريبة القيمة المضافة (14%)</span>
            <span className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono">
              {formatMoney(totalVat)}
            </span>
          </div>
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">عدد الفواتير</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
              {specializedTaxInvoices.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <SpecializedTaxInvoicesTab
        onPrintInvoice={(invoice) => setSelectedDocForPrint({ type: 'tax_invoice', data: invoice })}
      />

      {/* Print Modal */}
      <DocumentPrintModal
        document={selectedDocForPrint}
        onClose={() => setSelectedDocForPrint(null)}
      />
    </div>
  );
};
