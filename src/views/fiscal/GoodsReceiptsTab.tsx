import React, { useState, useMemo } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { GoodsReceiptVoucher, GoodsReceiptItem, Product } from '../../types';
import {
  PackagePlus,
  Plus,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  Warehouse,
  Truck,
  Building,
  AlertCircle,
  Boxes,
  ShieldCheck,
} from 'lucide-react';
import { tafqeetArabic } from '../../utils/fiscalUtils';

interface GoodsReceiptsTabProps {
  onPrintReceipt: (grn: GoodsReceiptVoucher) => void;
}

export const GoodsReceiptsTab: React.FC<GoodsReceiptsTabProps> = ({ onPrintReceipt }) => {
  const {
    goodsReceipts,
    addGoodsReceipt,
    deleteGoodsReceipt,
    warehouses,
    products,
    stockLevels,
    getProductStock,
    parties,
    branches,
    activeBranch,
    formatMoney,
    tenant,
    currentUser,
  } = usePlatform();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- الموردون المكودون حصراً بالسيستم ---
  const registeredSuppliers = useMemo(() => {
    return parties.filter((p) => p.type === 'Supplier' || p.type === 'Both');
  }, [parties]);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseOrderNo, setPurchaseOrderNo] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || 'wh-1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiverName, setReceiverName] = useState(currentUser?.name || 'أمين المخزن');
  const [inspectorName, setInspectorName] = useState('لجنة الفحص والاستلام');
  const [notes, setNotes] = useState('تم الاستلام والفحص ومطابقة الكميات للمواصفات');

  // --- الأصناف المسجلة في المخازن حصراً ---
  // استبعاد أي خدمات أو استشارات، وقصر القائمة المنسدلة فقط على الأصناف المخزنية المسجلة بالسيستم
  const warehouseRegisteredProducts = useMemo(() => {
    return products.filter((p) => {
      // استبعاد الخدمات الطبية والعلاجية نهائياً
      if (p.isService || p.itemType === 'service' || p.itemType === 'sales_service') {
        return false;
      }
      // التحقق من كون الصنف مسجلاً بالمخازن
      const hasWarehouseStock = stockLevels.some((sl) => sl.productId === p.id);
      const isStockDesignated =
        p.isStockItem === true ||
        p.itemType === 'stock_raw' ||
        p.itemType === 'consumable' ||
        p.itemType === 'medical_supply' ||
        p.itemType === 'product' ||
        (p.isSalesItem && !p.isService);

      return hasWarehouseStock || isStockDesignated;
    });
  }, [products, stockLevels]);

  const createItemFromProduct = (prod?: Product, qty: number = 10): GoodsReceiptItem => {
    const target = prod || warehouseRegisteredProducts[0];
    const cost = target?.purchasePrice ?? (target as any)?.costPrice ?? 50;
    return {
      productId: target?.id || '',
      productName: target?.nameAr || (target as any)?.name || 'صنف مخزني',
      sku: target?.sku || '',
      unit: target?.unit || 'قطعة',
      expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      quantityOrdered: qty,
      quantityReceived: qty,
      unitCost: cost,
      totalCost: Number((qty * cost).toFixed(2)),
    };
  };

  // Items State (initialized cleanly from registered warehouse items)
  const [items, setItems] = useState<GoodsReceiptItem[]>(() => {
    const firstProd = warehouseRegisteredProducts[0];
    return firstProd ? [createItemFromProduct(firstProd, 20)] : [];
  });

  const handleOpenNewReceiptModal = () => {
    const initialWh = warehouses[0]?.id || 'wh-1';
    setWarehouseId(initialWh);

    // اختيار أول مورد مكود افتراضياً إن وجد
    const defaultSup = registeredSuppliers[0];
    if (defaultSup) {
      setSupplierId(defaultSup.id);
      setSupplierName(defaultSup.name);
    } else {
      setSupplierId('');
      setSupplierName('');
    }

    setSupplierInvoiceNo('');
    setPurchaseOrderNo('');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiverName(currentUser?.name || 'أمين المخزن');
    setInspectorName('لجنة الفحص والاستلام');
    setNotes('تم الاستلام والفحص ومطابقة الكميات للمواصفات');

    if (warehouseRegisteredProducts.length > 0) {
      setItems([createItemFromProduct(warehouseRegisteredProducts[0], 10)]);
    } else {
      setItems([]);
    }

    setIsModalOpen(true);
  };

  const handleSupplierSelect = (id: string) => {
    setSupplierId(id);
    const sup = registeredSuppliers.find((s) => s.id === id);
    if (sup) {
      setSupplierName(sup.name);
    }
  };

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = warehouseRegisteredProducts.find((p) => p.id === prodId);
    if (!prod) return;
    const updated = [...items];
    const qty = updated[index]?.quantityReceived || 1;
    const cost = prod.purchasePrice ?? (prod as any).costPrice ?? 0;
    updated[index] = {
      ...updated[index],
      productId: prod.id,
      productName: prod.nameAr || (prod as any).name || '',
      sku: prod.sku,
      unit: prod.unit || 'قطعة',
      unitCost: cost,
      totalCost: Number((qty * cost).toFixed(2)),
    };
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof GoodsReceiptItem, val: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: val };

    if (field === 'quantityReceived' || field === 'unitCost') {
      const qty = Number(field === 'quantityReceived' ? val : current.quantityReceived) || 0;
      const cost = Number(field === 'unitCost' ? val : current.unitCost) || 0;
      current.totalCost = Number((qty * cost).toFixed(2));
    }

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItem = () => {
    if (warehouseRegisteredProducts.length === 0) return;
    const existingIds = new Set(items.map((it) => it.productId));
    const nextProd = warehouseRegisteredProducts.find((p) => !existingIds.has(p.id)) || warehouseRegisteredProducts[0];
    setItems((prev) => [...prev, createItemFromProduct(nextProd, 10)]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const totalValue = items.reduce((sum, it) => sum + it.totalCost, 0);

  const filteredReceipts = goodsReceipts.filter((grn) => {
    const matchesSearch =
      grn.grnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.warehouseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (grn.supplierInvoiceNo && grn.supplierInvoiceNo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesWh = selectedWarehouseId === 'all' || grn.warehouseId === selectedWarehouseId;
    return matchesSearch && matchesWh;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !supplierName.trim()) {
      alert('الرجاء اختيار المورد من قائمة الموردين المكودين');
      return;
    }

    // التحقق الصارم من أن المورد مكود حصراً بالسيستم
    const isSupplierValid = registeredSuppliers.some((s) => s.id === supplierId || s.name === supplierName);
    if (!isSupplierValid) {
      alert('تنبيه: يجب اختيار مورد مكود ومسجل في شاشة الموردين بالسيستم حصراً.');
      return;
    }

    if (items.length === 0) {
      alert('الرجاء اختيار صنف مخزني واحد على الأقل للاستلام');
      return;
    }

    // التحقق الصارم من أن جميع الأصناف مسجلة بالمخازن حصراً ومختارة من القائمة
    const invalidItem = items.find(
      (it) => !it.productId || !warehouseRegisteredProducts.some((p) => p.id === it.productId)
    );
    if (invalidItem) {
      alert('تنبيه: جميع الأصناف في إذن الاستلام يجب أن تكون من الأصناف المسجلة بالمخازن حصراً ومختارة من القائمة المنسدلة.');
      return;
    }

    const wh = warehouses.find((w) => w.id === warehouseId);

    const created = addGoodsReceipt({
      date,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      tenantId: tenant.id,
      branchId: activeBranch?.id || branches[0]?.id || 'branch-1',
      warehouseId,
      warehouseName: wh?.name || 'المخزن الرئيسي',
      supplierId,
      supplierName,
      supplierInvoiceNo: supplierInvoiceNo || undefined,
      purchaseOrderNo: purchaseOrderNo || undefined,
      items,
      totalCostValue: totalValue,
      receiverName,
      inspectorName,
      notes,
      status: 'received',
    });

    setIsModalOpen(false);
    onPrintReceipt(created);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-bold block mb-1">
              إجمالي قيمة الواردات المخزنية
            </span>
            <span className="text-2xl font-black text-amber-800 dark:text-amber-200">
              {formatMoney(filteredReceipts.reduce((sum, g) => sum + g.totalCostValue, 0))}
            </span>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl text-amber-600 dark:text-amber-300">
            <PackagePlus className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">
              أذونات الاستلام المخزني (GRN)
            </span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-200">
              {filteredReceipts.length} إذن توريد
            </span>
          </div>
          <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300">
            <Warehouse className="w-6 h-6" />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={handleOpenNewReceiptModal}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>إصدار إذن استلام أصناف مخزنية (GRN)</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم الإذن GRN، اسم المورد، المخزن..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
          >
            <option value="all">جميع المخازن</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3.5 px-4">رقم إذن الاستلام (GRN)</th>
                <th className="py-3.5 px-4">تاريخ التوريد</th>
                <th className="py-3.5 px-4">المخزن المستلم</th>
                <th className="py-3.5 px-4">المورد والمصدر</th>
                <th className="py-3.5 px-4">عدد الأصناف</th>
                <th className="py-3.5 px-4">إجمالي قيمة البضاعة</th>
                <th className="py-3.5 px-4">أمين المخزن</th>
                <th className="py-3.5 px-4 text-center">الإجراءات والطباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد أذونات استلام مخزنية مسجلة تطابق البحث
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {grn.grnNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{grn.date}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                      {grn.warehouseName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold">{grn.supplierName}</div>
                      {grn.supplierInvoiceNo && (
                        <div className="text-[10px] text-slate-400">فاتورة: {grn.supplierInvoiceNo}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        {grn.items.length} صنف مستلم
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white text-sm">
                      {formatMoney(grn.totalCostValue)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">{grn.receiverName}</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onPrintReceipt(grn)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 transition-colors text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                          title="معاينة وطباعة إذن الاستلام المخزني"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف إذن الاستلام ${grn.grnNumber}؟`)) {
                              deleteGoodsReceipt(grn.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="حذف الإذن"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New GRN Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-amber-50/60 dark:bg-amber-950/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-600/20">
                  <PackagePlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    إصدار إيصال استلام أصناف مخزنية (Goods Receipt Note - GRN)
                  </h3>
                  <p className="text-xs text-slate-500">
                    استلام الواردات من الموردين وتغذية أرصدة المخزن تلقائياً وتوثيق الفحص
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المخزن المستلم *
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المورد (المصدر المكود بالسيستم) *
                  </label>
                  {registeredSuppliers.length === 0 ? (
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-600 font-bold">
                      لا يوجد موردون مكودون بالسيستم. يرجى إضافة موردين من شاشة الأطراف والعملاء أولاً.
                    </div>
                  ) : (
                    <select
                      required
                      value={supplierId}
                      onChange={(e) => handleSupplierSelect(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="" disabled>-- اختر المورد المكود --</option>
                      {registeredSuppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} {sup.phone ? `(${sup.phone})` : ''} {sup.taxNumber ? `- ضريبي: ${sup.taxNumber}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {supplierId && (
                    <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-2">
                      <span>كود المورد: <strong className="font-mono text-slate-700 dark:text-slate-300">{supplierId}</strong></span>
                      {registeredSuppliers.find(s => s.id === supplierId)?.taxNumber && (
                        <span>الرقم الضريبي: <strong className="font-mono text-slate-700 dark:text-slate-300">{registeredSuppliers.find(s => s.id === supplierId)?.taxNumber}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الاستلام</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم فاتورة المورد (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: SUP-INV-8841"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم أمر الشراء PO (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: PO-2026-012"
                    value={purchaseOrderNo}
                    onChange={(e) => setPurchaseOrderNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="p-3.5 bg-slate-100 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      قائمة الأصناف المستلمة والمفحوصة
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      الأصناف المسجلة بالمخازن حصراً ({warehouseRegisteredProducts.length} صنف متاح)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={warehouseRegisteredProducts.length === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صنف من المخزن</span>
                  </button>
                </div>

                {warehouseRegisteredProducts.length === 0 ? (
                  <div className="p-6 text-center space-y-2 bg-slate-50 dark:bg-slate-900/50">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      لا توجد أصناف مخزنية مسجلة حالياً في المخازن
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      يجب تسجيل الأصناف والخامات أولاً في شاشة إدارة المخزون لتتمكن من إصدار إيصالات استلام لها.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                        <tr>
                          <th className="p-2.5 min-w-[280px]">اسم الصنف المخزني (دروب داون ليست حصراً)</th>
                          <th className="p-2.5 w-32">تاريخ الانتهاء</th>
                          <th className="p-2.5 w-20">المطلوب</th>
                          <th className="p-2.5 w-24">المستلم فعلياً</th>
                          <th className="p-2.5 w-24">سعر التكلفة</th>
                          <th className="p-2.5 w-24">إجمالي التكلفة</th>
                          <th className="p-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map((it, idx) => {
                          const selectedProd = warehouseRegisteredProducts.find((p) => p.id === it.productId);
                          const currentWhStock = selectedProd ? getProductStock(selectedProd.id, warehouseId) : 0;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="p-2.5">
                                <div className="space-y-1">
                                  {/* Dropdown list exclusively containing registered warehouse items - Only product name */}
                                  <select
                                    value={it.productId}
                                    onChange={(e) => handleProductSelect(idx, e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
                                  >
                                    {warehouseRegisteredProducts.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.nameAr || (p as any).name}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Selected Item Stock & Specs Badge */}
                                  {selectedProd && (
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 font-bold">
                                        كود: {selectedProd.sku}
                                      </span>
                                      <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                        الوحدة: {selectedProd.unit || 'قطعة'}
                                      </span>
                                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                        رصيد المخزن الحالي: <strong className="text-amber-600 dark:text-amber-400 font-bold">{currentWhStock}</strong> {selectedProd.unit || 'وحدة'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={it.expiryDate || ''}
                                  onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={it.quantityOrdered}
                                  onChange={(e) => handleItemChange(idx, 'quantityOrdered', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center"
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    value={it.quantityReceived}
                                    onChange={(e) => handleItemChange(idx, 'quantityReceived', e.target.value)}
                                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center font-bold text-amber-600"
                                  />
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={it.unitCost}
                                  onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center font-semibold"
                                />
                              </td>
                              <td className="p-2 font-black text-slate-900 dark:text-white text-center">
                                {formatMoney(it.totalCost)}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  disabled={items.length <= 1}
                                  className="text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer p-1"
                                  title="حذف هذا البند"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Totals & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تقرير الفحص والملاحظات
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>

                <div className="bg-amber-50/70 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/60 flex flex-col justify-center">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                    إجمالي قيمة الأصناف الواردة للمخزن:
                  </div>
                  <div className="text-xl font-black text-amber-900 dark:text-amber-100">
                    {formatMoney(totalValue)}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 italic mt-1">
                    {tafqeetArabic(totalValue, 'EGP')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">أمين المخزن</label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">مسؤول الفحص الفني</label>
                  <input
                    type="text"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وإضافة للمخزون وطباعة إذن الاستلام</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
