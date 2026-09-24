import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { PackageMinus, Sparkles, Building2, Warehouse } from 'lucide-react';
import { GoodsIssuesTab } from './fiscal/GoodsIssuesTab';
import { DocumentPrintModal, PrintableDocument } from './fiscal/DocumentPrintModal';

export const GoodsIssuesView: React.FC = () => {
  const { goodsIssues, formatMoney } = usePlatform();
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<PrintableDocument | null>(null);

  const totalIssuesValue = goodsIssues.reduce((sum, g) => sum + (g.totalCostValue || g.totalCost || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-2xl border border-orange-100 dark:border-orange-900/60 shadow-xs">
            <PackageMinus className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                أذونات وصرف أصناف مخزنية (Goods Issue Notes - GIN)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                شاشة مستقلة
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              صرف المستهلكات والمستلزمات الطبية للعيادات وأجهزة الليزر، وتوثيق جهة الصرف وخصم الكميات من المخزن آلياً
            </p>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي تكلفة المنصرف</span>
            <span className="text-sm font-black text-orange-600 dark:text-orange-400 font-mono">
              {formatMoney(totalIssuesValue)}
            </span>
          </div>
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">عدد أذونات الصرف</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
              {goodsIssues.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <GoodsIssuesTab
        onPrintIssue={(gin) => setSelectedDocForPrint({ type: 'goods_issue', data: gin })}
      />

      {/* Print Modal */}
      <DocumentPrintModal
        document={selectedDocForPrint}
        onClose={() => setSelectedDocForPrint(null)}
      />
    </div>
  );
};
