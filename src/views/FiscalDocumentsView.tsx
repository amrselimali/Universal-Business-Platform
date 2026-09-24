import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  Receipt,
  FileText,
  CreditCard,
  PackagePlus,
  PackageMinus,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Building2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { CashReceiptsTab } from './fiscal/CashReceiptsTab';
import { CashPaymentsTab } from './fiscal/CashPaymentsTab';
import { SpecializedTaxInvoicesTab } from './fiscal/SpecializedTaxInvoicesTab';
import { GoodsReceiptsTab } from './fiscal/GoodsReceiptsTab';
import { GoodsIssuesTab } from './fiscal/GoodsIssuesTab';
import { DocumentPrintModal, PrintableDocument } from './fiscal/DocumentPrintModal';

export type FiscalTab = 'receipts' | 'payments' | 'tax_invoices' | 'goods_receipts' | 'goods_issues';

interface FiscalDocumentsViewProps {
  initialTab?: FiscalTab;
}

export const FiscalDocumentsView: React.FC<FiscalDocumentsViewProps> = ({ initialTab = 'receipts' }) => {
  const {
    cashReceipts,
    cashPayments,
    specializedTaxInvoices,
    goodsReceipts,
    goodsIssues,
    formatMoney,
    tenant,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<FiscalTab>(initialTab);
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<PrintableDocument | null>(null);

  const tabs = [
    {
      id: 'receipts' as FiscalTab,
      name: 'إيصالات استلام نقدية (سندات قبض)',
      count: cashReceipts.length,
      icon: Receipt,
      color: 'emerald',
      badge: 'الخزينة والمقبوضات',
    },
    {
      id: 'payments' as FiscalTab,
      name: 'إيصالات صرف نقدية (سندات صرف)',
      count: cashPayments.length,
      icon: CreditCard,
      color: 'rose',
      badge: 'المدفوعات والمصروفات',
    },
    {
      id: 'tax_invoices' as FiscalTab,
      name: 'فواتير ضريبية متخصصة للعملاء',
      count: specializedTaxInvoices.length,
      icon: FileText,
      color: 'sky',
      badge: 'B2B/B2C ZATCA',
    },
    {
      id: 'goods_receipts' as FiscalTab,
      name: 'إيصالات استلام أصناف مخزنية (GRN)',
      count: goodsReceipts.length,
      icon: PackagePlus,
      color: 'amber',
      badge: 'الواردات للمخزن',
    },
    {
      id: 'goods_issues' as FiscalTab,
      name: 'إيصالات صرف أصناف مخزنية (GIN)',
      count: goodsIssues.length,
      icon: PackageMinus,
      color: 'orange',
      badge: 'المنصرف للعيادات',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/60">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                مركز السندات المالية والمستندات المخزنية والضريبية
              </h1>
              <p className="text-xs text-slate-500">
                منظومة متكاملة للمحاسبين لإصدار سندات القبض والصرف، الفواتير الضريبية المعتمدة، وأذون الاستلام والصرف المخزني
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>متوافق مع ZATCA والتفقيط المالي</span>
          </span>
        </div>
      </div>

      {/* Navigation Pills / Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 bg-slate-100 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-start p-3 rounded-xl transition-all text-right cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 shadow-md border border-slate-200/80 dark:border-slate-700'
                  : 'hover:bg-white/60 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span
                  className={`p-1.5 rounded-lg ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </div>
              <span
                className={`text-xs font-bold leading-tight block line-clamp-1 ${
                  isActive ? 'text-slate-900 dark:text-white font-black' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.name}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">{tab.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Body */}
      <div>
        {activeTab === 'receipts' && (
          <CashReceiptsTab
            onPrintReceipt={(receipt) => setSelectedDocForPrint({ type: 'cash_receipt', data: receipt })}
          />
        )}

        {activeTab === 'payments' && (
          <CashPaymentsTab
            onPrintPayment={(payment) => setSelectedDocForPrint({ type: 'cash_payment', data: payment })}
          />
        )}

        {activeTab === 'tax_invoices' && (
          <SpecializedTaxInvoicesTab
            onPrintInvoice={(inv) => setSelectedDocForPrint({ type: 'tax_invoice', data: inv })}
          />
        )}

        {activeTab === 'goods_receipts' && (
          <GoodsReceiptsTab
            onPrintReceipt={(grn) => setSelectedDocForPrint({ type: 'goods_receipt', data: grn })}
          />
        )}

        {activeTab === 'goods_issues' && (
          <GoodsIssuesTab
            onPrintIssue={(gin) => setSelectedDocForPrint({ type: 'goods_issue', data: gin })}
          />
        )}
      </div>

      {/* Official Print Modal */}
      <DocumentPrintModal
        document={selectedDocForPrint}
        onClose={() => setSelectedDocForPrint(null)}
      />
    </div>
  );
};
