import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { PackagePlus, Sparkles, Building2, Warehouse } from 'lucide-react';
import { GoodsReceiptsTab } from './fiscal/GoodsReceiptsTab';
import { DocumentPrintModal, PrintableDocument } from './fiscal/DocumentPrintModal';

export const GoodsReceiptsView: React.FC = () => {
  const { goodsReceipts, formatMoney } = usePlatform();
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<PrintableDocument | null>(null);

  const totalReceiptsValue = goodsReceipts.reduce((sum, g) => sum + (g.totalCostValue || g.totalValue || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/60 shadow-xs">
            <PackagePlus className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                أذونات واستلام أصناف مخزنية (Goods Receipt Notes - GRN)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                شاشة مستقلة
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              توثيق استلام الشحنات والواردات للمخازن من الموردين، وإثبات التشغيلات وتواريخ الانتهاء وزيادة رصيد المخزون فورياً
            </p>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي قيمة الواردات المخزنية</span>
            <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatMoney(totalReceiptsValue)}
            </span>
          </div>
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">عدد أذونات الاستلام</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
              {goodsReceipts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <GoodsReceiptsTab
        onPrintReceipt={(grn) => setSelectedDocForPrint({ type: 'goods_receipt', data: grn })}
      />

      {/* Print Modal */}
      <DocumentPrintModal
        document={selectedDocForPrint}
        onClose={() => setSelectedDocForPrint(null)}
      />
    </div>
  );
};
