import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Product } from '../types';
import {
  AlertTriangle,
  AlertCircle,
  Package,
  Layers,
  Search,
  Check,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Copy,
  RefreshCw,
  Sparkles,
  Sliders,
  Filter,
  CheckCircle2,
  Boxes,
  ArrowDownCircle,
  ExternalLink,
} from 'lucide-react';

interface LowStockAlertWidgetProps {
  onFilterProduct?: (productName: string) => void;
}

export const LowStockAlertWidget: React.FC<LowStockAlertWidgetProps> = ({ onFilterProduct }) => {
  const {
    t,
    products,
    allProducts,
    getProductStock,
    updateProduct,
    formatMoney,
  } = usePlatform();

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [alertFilter, setAlertFilter] = useState<'all_alerts' | 'out_of_stock' | 'low_stock' | 'all_monitored'>('all_alerts');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'sales_only' | 'raw_only'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inline editing state for reorder levels: { [productId]: number }
  const [editingLevels, setEditingLevels] = useState<{ [productId: string]: number }>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedOrder, setCopiedOrder] = useState<boolean>(false);

  // All items with physical inventory (Retail products, Raw consumables, Medical supplies)
  const physicalItems = useMemo(() => {
    // Combine products from tenant
    return products.filter((p) => {
      // Must not be a pure intangible medical service or session package
      if (p.isService && !p.isStockItem && p.itemType !== 'stock_raw' && p.itemType !== 'consumable') {
        return false;
      }
      if (p.isPackage) return false;
      return true;
    });
  }, [products]);

  // Compute stock analysis for each item
  const analyzedProducts = useMemo(() => {
    return physicalItems.map((p) => {
      const stock = getProductStock(p.id);
      // Reorder level (حد الطلب)
      const reorderLevel = p.minStockLevel !== undefined && p.minStockLevel !== null ? p.minStockLevel : 5;
      const isOutOfStock = stock <= 0;
      const isLowStock = stock > 0 && stock <= reorderLevel;
      const isWarning = stock > reorderLevel && stock <= Math.max(reorderLevel * 1.3, reorderLevel + 2);

      // Urgency state
      let status: 'out_of_stock' | 'low_stock' | 'warning' | 'normal' = 'normal';
      if (isOutOfStock) status = 'out_of_stock';
      else if (isLowStock) status = 'low_stock';
      else if (isWarning) status = 'warning';

      // Suggested reorder quantity to reach healthy safety stock (حد الأمان)
      const suggestedReorder = isOutOfStock
        ? Math.max(10, (reorderLevel || 5) * 2)
        : Math.max(5, (reorderLevel * 2) - stock);

      // Remaining stock percentage against reorder level
      const percentOfReorder = reorderLevel > 0 ? Math.min(100, Math.round((stock / reorderLevel) * 100)) : 100;

      return {
        product: p,
        stock,
        reorderLevel,
        status,
        isOutOfStock,
        isLowStock,
        isWarning,
        suggestedReorder,
        percentOfReorder,
        isRawMaterial: p.isStockItem || p.itemType === 'stock_raw' || p.itemType === 'consumable',
      };
    });
  }, [physicalItems, getProductStock]);

  // Key KPI metrics
  const outOfStockItems = useMemo(() => analyzedProducts.filter((p) => p.isOutOfStock), [analyzedProducts]);
  const lowStockItems = useMemo(() => analyzedProducts.filter((p) => p.isLowStock), [analyzedProducts]);
  const warningItems = useMemo(() => analyzedProducts.filter((p) => p.isWarning), [analyzedProducts]);
  const totalAlertsCount = outOfStockItems.length + lowStockItems.length;

  // Filtered list based on user selections
  const displayItems = useMemo(() => {
    return analyzedProducts.filter((item) => {
      // 1. Alert status filter
      if (alertFilter === 'all_alerts' && !item.isOutOfStock && !item.isLowStock) return false;
      if (alertFilter === 'out_of_stock' && !item.isOutOfStock) return false;
      if (alertFilter === 'low_stock' && !item.isLowStock) return false;

      // 2. Category / Nature filter
      if (categoryFilter === 'sales_only' && item.isRawMaterial) return false;
      if (categoryFilter === 'raw_only' && !item.isRawMaterial) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const p = item.product;
        const matchName = p.nameAr?.toLowerCase().includes(q) || p.nameEn?.toLowerCase().includes(q);
        const matchSku = p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
        const matchCat = p.category?.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat) return false;
      }

      return true;
    }).sort((a, b) => {
      // Prioritize out of stock first, then low stock, then stock ratio
      if (a.isOutOfStock && !b.isOutOfStock) return -1;
      if (!a.isOutOfStock && b.isOutOfStock) return 1;
      if (a.isLowStock && !b.isLowStock) return -1;
      if (!a.isLowStock && b.isLowStock) return 1;
      return a.percentOfReorder - b.percentOfReorder;
    });
  }, [analyzedProducts, alertFilter, categoryFilter, searchQuery]);

  // Save updated reorder level for a specific product
  const handleSaveReorderLevel = (productId: string) => {
    const newLevel = editingLevels[productId];
    if (newLevel === undefined || newLevel < 0) return;

    updateProduct(productId, { minStockLevel: Number(newLevel) });
    setEditingId(null);

    const targetItem = analyzedProducts.find((p) => p.product.id === productId);
    const name = targetItem?.product.nameAr || 'المنتج';
    setSuccessToast(`تم تحديث حد الطلب لـ (${name}) إلى ${newLevel} وحدة بنجاح.`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Bulk set default reorder level (e.g., 10) for products with 0 reorder level
  const handleSetDefaultReorderLevel = (defaultValue: number = 10) => {
    let updatedCount = 0;
    physicalItems.forEach((p) => {
      if (!p.minStockLevel || p.minStockLevel <= 0) {
        updateProduct(p.id, { minStockLevel: defaultValue });
        updatedCount++;
      }
    });

    setSuccessToast(`تم تعيين حد الطلب الافتراضي (${defaultValue} وحدات) لعدد ${updatedCount} صنف بنجاح.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Copy purchase order summary to clipboard for WhatsApp or Email
  const handleCopyPurchaseOrder = () => {
    const alertItems = analyzedProducts.filter((p) => p.isOutOfStock || p.isLowStock);
    if (alertItems.length === 0) {
      alert('لا توجد أصناف ناقصة أو منتهية لإنشاء أمر توريد لها.');
      return;
    }

    let poText = `📋 *طلب توريد وشراء أصناف ناقصة - ${new Date().toLocaleDateString('ar-EG')}*\n`;
    poText += `-------------------------------------------\n`;
    alertItems.forEach((item, idx) => {
      const p = item.product;
      const statusLabel = item.isOutOfStock ? '🔴 [نفذ تماماً]' : '⚠️ [قارب على النفاذ]';
      poText += `${idx + 1}. ${p.nameAr} (${p.sku})\n`;
      poText += `   الرصيد الحالي: ${item.stock} ${p.unit || 'وحدة'} | حد الطلب: ${item.reorderLevel}\n`;
      poText += `   الكمية المقترح طلبها: *${item.suggestedReorder} ${p.unit || 'وحدة'}* ${statusLabel}\n`;
    });
    poText += `-------------------------------------------\n`;
    poText += `إجمالي الأصناف المطلوبة: ${alertItems.length} صنف.\n`;

    navigator.clipboard.writeText(poText).then(() => {
      setCopiedOrder(true);
      setTimeout(() => setCopiedOrder(false), 3000);
    });
  };

  return (
    <div
      id="low-stock-alert-widget"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm overflow-hidden transition-all duration-300"
    >
      {/* Widget Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-rose-500/10 dark:from-amber-950/40 dark:via-slate-900 dark:to-rose-950/30 border-b border-amber-200 dark:border-amber-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25">
                <AlertTriangle className="w-5 h-5" />
              </div>
              {totalAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[10px] text-white font-bold items-center justify-center">
                    {totalAlertsCount}
                  </span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800 dark:text-white">
                  {t('نظام التنبيه التلقائي للمخزون وحد الطلب', 'Automated Low Stock & Reorder Point Alerts')}
                </h3>
                {totalAlertsCount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                    {totalAlertsCount} {t('تنبيه نشط', 'Active Alerts')}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                    {t('المخزون آمن ومكتمل', 'All Safe')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'مراقبة فورية للأصناف التي اقترب رصيدها من النفاذ مع إمكانية تعديل حد الطلب وتوليد أوامر الشراء',
                  'Live monitoring of near-depletion items with inline reorder point controls'
                )}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons & Expand Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {totalAlertsCount > 0 && (
              <button
                id="btn-copy-purchase-order"
                onClick={handleCopyPurchaseOrder}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                title="نسخ ملخص الأصناف الناقصة لإرسالها بالواتساب لأمين المخزن أو المورد"
              >
                {copiedOrder ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedOrder ? t('تم النسخ للحافظة!', 'Copied!') : t('نسخ أمر توريد', 'Copy PO')}</span>
              </button>
            )}

            <button
              id="btn-set-default-reorder"
              onClick={() => handleSetDefaultReorderLevel(10)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              title="تطبيق حد طلب افتراضي (10 وحدات) للأصناف التي لم يحدد لها حد طلب"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t('ضبط حد افتراضي (10)', 'Set Default (10)')}</span>
            </button>

            <button
              id="btn-toggle-widget-expand"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-white/80 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Counter Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          <div
            onClick={() => {
              setAlertFilter('out_of_stock');
              setIsExpanded(true);
            }}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              alertFilter === 'out_of_stock'
                ? 'bg-rose-100/80 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800'
                : 'bg-white/80 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-rose-200'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block">
                {t('نفذ بالكامل (رصيد صفر)', 'Out of Stock')}
              </span>
              <span className="text-lg font-black font-mono text-rose-700 dark:text-rose-300">
                {outOfStockItems.length}
              </span>
            </div>
            <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
              0
            </span>
          </div>

          <div
            onClick={() => {
              setAlertFilter('low_stock');
              setIsExpanded(true);
            }}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              alertFilter === 'low_stock'
                ? 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                : 'bg-white/80 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-amber-200'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block">
                {t('اقترب من النفاذ (تحت حد الطلب)', 'Near Depletion')}
              </span>
              <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-300">
                {lowStockItems.length}
              </span>
            </div>
            <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>

          <div
            onClick={() => {
              setAlertFilter('all_alerts');
              setIsExpanded(true);
            }}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              alertFilter === 'all_alerts'
                ? 'bg-indigo-100/80 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800'
                : 'bg-white/80 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-indigo-200'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 block">
                {t('إجمالي التنبيهات الحرجة', 'Total Critical')}
              </span>
              <span className="text-lg font-black font-mono text-indigo-700 dark:text-indigo-300">
                {totalAlertsCount}
              </span>
            </div>
            <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
            </span>
          </div>

          <div
            onClick={() => {
              setAlertFilter('all_monitored');
              setIsExpanded(true);
            }}
            className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              alertFilter === 'all_monitored'
                ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                : 'bg-white/80 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                {t('إجمالي الأصناف المراقبة', 'All Monitored')}
              </span>
              <span className="text-lg font-black font-mono text-slate-800 dark:text-white">
                {physicalItems.length}
              </span>
            </div>
            <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
              <Boxes className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Sub-Filters & Live Search Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 ps-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                <span>{t('عرض:', 'Filter:')}</span>
              </span>
              
              <button
                onClick={() => setAlertFilter('all_alerts')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  alertFilter === 'all_alerts'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-850 text-slate-600 hover:text-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {t('كل التنبيهات', 'All Alerts')} ({totalAlertsCount})
              </button>

              <button
                onClick={() => setAlertFilter('out_of_stock')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  alertFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-850 text-slate-600 hover:text-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {t('نفذ تماماً', 'Out of Stock')} ({outOfStockItems.length})
              </button>

              <button
                onClick={() => setAlertFilter('low_stock')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  alertFilter === 'low_stock'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-850 text-slate-600 hover:text-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {t('اقترب من النفاذ', 'Near Depletion')} ({lowStockItems.length})
              </button>

              <button
                onClick={() => setAlertFilter('all_monitored')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  alertFilter === 'all_monitored'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-850 text-slate-600 hover:text-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {t('كل الأصناف المخزنية', 'All Items')} ({physicalItems.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('بحث بالاسم أو الكود...', 'Search by name or SKU...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Alert Products Table with Inline Reorder Control */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold">
                  <th className="py-2.5 px-3 text-start">{t('الصنف التجاري / الخامة', 'Item Name & SKU')}</th>
                  <th className="py-2.5 px-3 text-start">{t('التصنيف', 'Category')}</th>
                  <th className="py-2.5 px-3 text-center">{t('الرصيد الفعلي', 'Stock on Hand')}</th>
                  <th className="py-2.5 px-3 text-center bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                    {t('حد الطلب (نقطة التنبيه)', 'Reorder Point')}
                  </th>
                  <th className="py-2.5 px-3 text-center">{t('حالة المخزون', 'Stock Status')}</th>
                  <th className="py-2.5 px-3 text-center">{t('الكمية المقترح طلبها', 'Suggested Order')}</th>
                  <th className="py-2.5 px-3 text-center">{t('إجراءات وضبط', 'Actions & Settings')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {displayItems.map((item) => {
                  const p = item.product;
                  const isEditingThis = editingId === p.id;
                  const currentEditValue =
                    editingLevels[p.id] !== undefined ? editingLevels[p.id] : item.reorderLevel;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        item.isOutOfStock
                          ? 'bg-rose-50/30 dark:bg-rose-950/10'
                          : item.isLowStock
                          ? 'bg-amber-50/20 dark:bg-amber-950/10'
                          : ''
                      }`}
                    >
                      {/* Name & SKU */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {item.isOutOfStock ? (
                            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                          ) : item.isLowStock ? (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          )}
                          <span>{p.nameAr}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>{p.sku || '-'}</span>
                          {p.barcode && <span>• {p.barcode}</span>}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-slate-600 dark:text-slate-300">{p.category || 'عام'}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {item.isRawMaterial ? t('خامة ومستهلك', 'Raw Supply') : t('منتج بيعي', 'Sales Retail')}
                        </span>
                      </td>

                      {/* Stock on Hand */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 font-mono font-black text-sm">
                          <span
                            className={
                              item.isOutOfStock
                                ? 'text-rose-600 font-black'
                                : item.isLowStock
                                ? 'text-amber-600 font-black'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }
                          >
                            {item.stock}
                          </span>
                          <span className="text-[10px] font-sans text-slate-400 font-normal">
                            {p.unit || 'وحدة'}
                          </span>
                        </div>

                        {/* Progress Bar of Stock vs Reorder Level */}
                        <div className="w-20 mx-auto h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.isOutOfStock
                                ? 'bg-rose-600 w-0'
                                : item.isLowStock
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(8, item.percentOfReorder))}%`,
                            }}
                          />
                        </div>
                      </td>

                      {/* Reorder Point (حد الطلب) with Inline Controls */}
                      <td className="py-3 px-3 text-center bg-amber-50/20 dark:bg-amber-950/10">
                        {isEditingThis ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={currentEditValue}
                              onChange={(e) =>
                                setEditingLevels((prev) => ({
                                  ...prev,
                                  [p.id]: Math.max(0, parseInt(e.target.value) || 0),
                                }))
                              }
                              className="w-16 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded-lg text-slate-900 dark:text-white outline-none"
                            />
                            <button
                              onClick={() => handleSaveReorderLevel(p.id)}
                              className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                              title="حفظ التعديل"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                              title="إلغاء"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 group">
                            <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                              {item.reorderLevel}
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans">
                              {p.unit || 'وحدة'}
                            </span>
                            <button
                              onClick={() => {
                                setEditingId(p.id);
                                setEditingLevels((prev) => ({ ...prev, [p.id]: item.reorderLevel }));
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition cursor-pointer opacity-70 group-hover:opacity-100"
                              title={t('تعديل حد الطلب لهذا الصنف', 'Edit reorder level')}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Stock Status Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>نفذ بالكامل</span>
                          </span>
                        ) : item.isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>أوشك على النفاذ</span>
                          </span>
                        ) : item.isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300">
                            <span>قريب من حد الطلب</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>مستوى آمن</span>
                          </span>
                        )}
                      </td>

                      {/* Suggested Order Qty */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono font-black text-xs border border-indigo-100 dark:border-indigo-900/40">
                          +{item.suggestedReorder} {p.unit || 'وحدة'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {onFilterProduct && (
                            <button
                              onClick={() => onFilterProduct(p.nameAr)}
                              title={t('عرض الصنف بالجدول الرئيسي', 'Focus in main catalog')}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingId(p.id);
                              setEditingLevels((prev) => ({ ...prev, [p.id]: item.reorderLevel }));
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition cursor-pointer"
                          >
                            <span>{t('ضبط الحد', 'Adjust')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {displayItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-1.5 text-emerald-500 opacity-60" />
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t('لا توجد أصناف تطابق معايير التنبيه المحددة حالياً', 'No items match alert criteria')}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t('جميع أرصدة المخزون تقع فوق حدود الطلب المقررة', 'All stock levels are above reorder thresholds')}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Informational Tip */}
          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">معلومة ذكية: </span>
              <span>
                حد الطلب (Reorder Point) هو الحد الأدنى من المخزون الذي يُطلق التنبيه التلقائي فور الوصول إليه لمنع توقف جلسات العيادة أو المبيعات. يمكنك تعديله مباشرة بالنقر على رقم حد الطلب أو زر "ضبط الحد" في أي وقت.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
