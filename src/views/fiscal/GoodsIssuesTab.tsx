import React, { useState, useMemo } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { GoodsIssueVoucher, GoodsIssueItem, Product } from '../../types';
import {
  PackageMinus,
  Plus,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  Warehouse,
  Building,
  AlertCircle,
  Boxes,
  ShieldCheck,
} from 'lucide-react';
import { tafqeetArabic } from '../../utils/fiscalUtils';

interface GoodsIssuesTabProps {
  onPrintIssue: (gin: GoodsIssueVoucher) => void;
}

export const GoodsIssuesTab: React.FC<GoodsIssuesTabProps> = ({ onPrintIssue }) => {
  const {
    goodsIssues,
    addGoodsIssue,
    deleteGoodsIssue,
    warehouses,
    products,
    stockLevels,
    getProductStock,
    staffMembers,
    branches,
    activeBranch,
    formatMoney,
    tenant,
    currentUser,
  } = usePlatform();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [recipientName, setRecipientName] = useState('');
  const [department, setDepartment] = useState('قسم الليزر والجلدية');
  const [purpose, setPurpose] = useState('تشغيل يومي وجلسات علاجية');
  const [referenceOrderNo, setReferenceOrderNo] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || 'wh-1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [issuedBy, setIssuedBy] = useState(currentUser?.name || 'أمين المخزن');
  const [approvedBy, setApprovedBy] = useState('مشرف العيادات / مدير التشغيل');
  const [notes, setNotes] = useState('تم تسليم الأصناف بحالة سليمة مطابقة لطلب الصرف');

  // الأصناف المسجلة بالمخازن حصراً
  const warehouseRegisteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isService || p.itemType === 'service' || p.itemType === 'sales_service') {
        return false;
      }
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

  const createIssueItemFromProduct = (prod?: Product, qty: number = 2): GoodsIssueItem => {
    const target = prod || warehouseRegisteredProducts[0];
    const cost = target?.purchasePrice ?? (target as any)?.costPrice ?? 50;
    return {
      productId: target?.id || '',
      productName: target?.nameAr || (target as any)?.name || 'صنف مخزني',
      sku: target?.sku || '',
      unit: target?.unit || 'قطعة',
      quantityIssued: qty,
      unitCost: cost,
      totalCost: Number((qty * cost).toFixed(2)),
    };
  };

  // Items State
  const [items, setItems] = useState<GoodsIssueItem[]>(() => {
    const defaultP = warehouseRegisteredProducts[0];
    return defaultP ? [createIssueItemFromProduct(defaultP, 2)] : [];
  });

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = warehouseRegisteredProducts.find((p) => p.id === prodId);
    if (!prod) return;
    const updated = [...items];
    const qty = updated[index]?.quantityIssued || 1;
    const cost = prod.purchasePrice ?? (prod as any).costPrice ?? 50;
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

  const handleItemChange = (index: number, field: keyof GoodsIssueItem, val: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: val };

    if (field === 'quantityIssued' || field === 'unitCost') {
      const qty = Number(field === 'quantityIssued' ? val : current.quantityIssued) || 0;
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
    setItems((prev) => [...prev, createIssueItemFromProduct(nextProd, 1)]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const totalValue = items.reduce((sum, it) => sum + it.totalCost, 0);

  const filteredIssues = goodsIssues.filter((gin) => {
    const matchesSearch =
      gin.ginNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gin.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gin.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gin.warehouseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWh = selectedWarehouseId === 'all' || gin.warehouseId === selectedWarehouseId;
    return matchesSearch && matchesWh;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      alert('الرجاء إدخال اسم المستلم أو القسم');
      return;
    }
    const wh = warehouses.find((w) => w.id === warehouseId);

    const created = addGoodsIssue({
      date,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      tenantId: tenant.id,
      branchId: activeBranch?.id || branches[0]?.id || 'branch-1',
      warehouseId,
      warehouseName: wh?.name || 'المخزن الرئيسي',
      recipientName,
      department,
      purpose,
      referenceOrderNo: referenceOrderNo || undefined,
      items,
      totalCostValue: totalValue,
      issuedBy,
      approvedBy,
      notes,
      status: 'issued',
    });

    setIsModalOpen(false);
    onPrintIssue(created);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-orange-600 dark:text-orange-400 font-bold block mb-1">
              إجمالي تكلفة المنصرف المخزني
            </span>
            <span className="text-2xl font-black text-orange-800 dark:text-orange-200">
              {formatMoney(filteredIssues.reduce((sum, g) => sum + g.totalCostValue, 0))}
            </span>
          </div>
          <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-xl text-orange-600 dark:text-orange-300">
            <PackageMinus className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">
              أذونات الصرف المخزني (GIN)
            </span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-200">
              {filteredIssues.length} إذن صرف
            </span>
          </div>
          <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300">
            <Warehouse className="w-6 h-6" />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>إصدار إذن صرف أصناف مخزنية (GIN)</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم الإذن GIN، اسم المستلم، القسم، المخزن..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-orange-500"
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

      {/* Issues Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3.5 px-4">رقم إذن الصرف (GIN)</th>
                <th className="py-3.5 px-4">تاريخ الصرف</th>
                <th className="py-3.5 px-4">المخزن المصروف منه</th>
                <th className="py-3.5 px-4">المستلم والجهة</th>
                <th className="py-3.5 px-4">الغرض من الصرف</th>
                <th className="py-3.5 px-4">عدد الأصناف</th>
                <th className="py-3.5 px-4">تكلفة المنصرف</th>
                <th className="py-3.5 px-4 text-center">الإجراءات والطباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد أذونات صرف مخزنية مسجلة تطابق البحث
                  </td>
                </tr>
              ) : (
                filteredIssues.map((gin) => (
                  <tr key={gin.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-orange-600 dark:text-orange-400">
                      {gin.ginNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{gin.date}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                      {gin.warehouseName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold">{gin.recipientName}</div>
                      <div className="text-[10px] text-slate-400">{gin.department}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {gin.purpose}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-[11px] font-bold text-orange-700 dark:text-orange-300">
                        {gin.items.length} صنف مصروف
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white text-sm">
                      {formatMoney(gin.totalCostValue)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onPrintIssue(gin)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-orange-600 hover:text-white dark:hover:bg-orange-600 transition-colors text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                          title="معاينة وطباعة إذن الصرف المخزني"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف إذن الصرف ${gin.ginNumber}؟`)) {
                              deleteGoodsIssue(gin.id);
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

      {/* New GIN Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-orange-50/60 dark:bg-orange-950/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-orange-600 text-white shadow-md shadow-orange-600/20">
                  <PackageMinus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    إصدار إذن صرف أصناف مخزنية (Goods Issue Note - GIN)
                  </h3>
                  <p className="text-xs text-slate-500">
                    صرف مستلزمات طبية أو تشغيلية للعيادات وخصم الكميات فورياً من رصيد المخزن
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
                    المخزن المصروف منه *
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
                    المستلم (اسم الموظف / العيادة) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="اسم الطبيب، الفنية، أو مسؤول العيادة"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الصرف</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    القسم / الغرفة المستفيدة
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الغرض من الصرف
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم طلب الصرف المرجعي (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: REQ-2026-088"
                    value={referenceOrderNo}
                    onChange={(e) => setReferenceOrderNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="p-3.5 bg-slate-100 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      الأصناف المراد صرفها من المخزن
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      الأصناف المسجلة بالمخازن حصراً ({warehouseRegisteredProducts.length} صنف)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={warehouseRegisteredProducts.length === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صنف</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      <tr>
                        <th className="p-2.5 min-w-[260px]">الصنف المخزني (دروب داون ليست)</th>
                        <th className="p-2.5 w-24">الوحدة</th>
                        <th className="p-2.5 w-24">الكمية المصروفة</th>
                        <th className="p-2.5 w-28">سعر التكلفة التقديري</th>
                        <th className="p-2.5 w-28">إجمالي التكلفة</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((it, idx) => {
                        const selectedProd = warehouseRegisteredProducts.find((p) => p.id === it.productId);
                        const availableStock = selectedProd ? getProductStock(selectedProd.id, warehouseId) : 0;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="p-2.5">
                              <div className="space-y-1">
                                <select
                                  value={it.productId}
                                  onChange={(e) => handleProductSelect(idx, e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
                                >
                                  {warehouseRegisteredProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nameAr || (p as any).name}
                                    </option>
                                  ))}
                                </select>
                                {selectedProd && (
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 font-bold">
                                      كود: {selectedProd.sku}
                                    </span>
                                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                      الرصيد المتاح للصرف: <strong className={availableStock > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 font-bold'}>{availableStock}</strong> {selectedProd.unit || 'وحدة'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={it.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={it.quantityIssued}
                              onChange={(e) => handleItemChange(idx, 'quantityIssued', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center font-bold text-orange-600"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={it.unitCost}
                              onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center font-semibold"
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
              </div>

              {/* Totals & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ملاحظات الصرف والتعليمات
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>

                <div className="bg-orange-50/70 dark:bg-orange-950/30 p-3 rounded-2xl border border-orange-200 dark:border-orange-800/60 flex flex-col justify-center">
                  <div className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-1">
                    إجمالي تكلفة الأصناف المنصرفة:
                  </div>
                  <div className="text-xl font-black text-orange-900 dark:text-orange-100">
                    {formatMoney(totalValue)}
                  </div>
                  <div className="text-[11px] text-orange-700 dark:text-orange-300 italic mt-1">
                    {tafqeetArabic(totalValue, 'EGP')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">مسؤول الصرف بالمخزن</label>
                  <input
                    type="text"
                    value={issuedBy}
                    onChange={(e) => setIssuedBy(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اعتماد المشرف / المدير</label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
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
                  className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md shadow-orange-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وخصم من المخزون وطباعة إذن الصرف</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
