import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Product } from '../types';
import {
  Package,
  Plus,
  ArrowRightLeft,
  Sliders,
  Search,
  AlertTriangle,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  Layers,
  X,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const {
    t,
    formatMoney,
    products,
    warehouses,
    activeWarehouse,
    setActiveWarehouse,
    getProductStock,
    addProduct,
    adjustStock,
    transferStock,
    language,
  } = usePlatform();

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // New Product Form State
  const [newProd, setNewProd] = useState({
    nameAr: '',
    nameEn: '',
    sku: '',
    barcode: '',
    category: 'مستلزمات طبية',
    purchasePrice: 100,
    sellingPrice: 150,
    minStockLevel: 5,
    unit: 'قطعة',
    isService: false,
    initialStock: 10,
  });

  // Transfer Form State
  const [transferData, setTransferData] = useState({
    fromWh: warehouses[0]?.id || '',
    toWh: warehouses[1]?.id || '',
    qty: 5,
  });

  // Adjust Form State
  const [adjustData, setAdjustData] = useState({
    delta: 5,
    reason: 'تسوية جردية دورية',
  });

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      p.nameAr.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    );
  });

  const handleSaveProduct = () => {
    if (!newProd.nameAr.trim() || !newProd.sku.trim()) {
      alert(t('يرجى كتابة اسم الصنف وكود الـ SKU!', 'Please enter product name and SKU!'));
      return;
    }
    addProduct(
      {
        nameAr: newProd.nameAr,
        nameEn: newProd.nameEn || newProd.nameAr,
        sku: newProd.sku,
        barcode: newProd.barcode || newProd.sku,
        category: newProd.category,
        purchasePrice: Number(newProd.purchasePrice),
        sellingPrice: Number(newProd.sellingPrice),
        minStockLevel: Number(newProd.minStockLevel),
        unit: newProd.unit,
        isService: newProd.isService,
      },
      newProd.initialStock
    );
    setShowAddProductModal(false);
    setNewProd({
      nameAr: '',
      nameEn: '',
      sku: '',
      barcode: '',
      category: 'مستلزمات طبية',
      purchasePrice: 100,
      sellingPrice: 150,
      minStockLevel: 5,
      unit: 'قطعة',
      isService: false,
      initialStock: 10,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {t('إدارة المخازن وتعدد المستودعات', 'Warehouses & Products')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'تتبع مستويات الأرصدة، تنبيهات النواقص، التحويلات بين الفروع، والتسويات الجردية.',
              'Multi-warehouse stock tracking, low-stock warnings, and transfers.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition-colors"
          >
            <ArrowRightLeft className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('تحويل بين المخازن', 'Inter-Warehouse Transfer')}</span>
          </button>

          <button
            onClick={() => setShowAddProductModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة صنف / خدمة جديدة', 'Add New Product')}</span>
          </button>
        </div>
      </div>

      {/* Warehouse Selector Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <WarehouseIcon className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {t('عرض أرصدة المستودع:', 'Stock View by Warehouse:')}
          </span>
          <div className="flex items-center gap-1">
            {warehouses.map((wh) => (
              <button
                key={wh.id}
                onClick={() => setActiveWarehouse(wh)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                  activeWarehouse.id === wh.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {language === 'ar' ? wh.name : wh.nameEn}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('ابحث بالاسم، الكود، الباركود...', 'Search products...')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-4 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                <th className="pb-3 font-bold text-start">{t('كود الصنف (SKU)', 'SKU')}</th>
                <th className="pb-3 font-bold text-start">{t('اسم الصنف', 'Product Name')}</th>
                <th className="pb-3 font-bold text-start">{t('التصنيف', 'Category')}</th>
                <th className="pb-3 font-bold text-end">{t('سعر التكلفة', 'Cost')}</th>
                <th className="pb-3 font-bold text-end">{t('سعر البيع', 'Selling Price')}</th>
                <th className="pb-3 font-bold text-end">{t('الرصيد المتاح بالمستودع', 'Stock on Hand')}</th>
                <th className="pb-3 font-bold text-center">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredProducts.map((prod) => {
                const stock = getProductStock(prod.id, activeWarehouse.id);
                const isLow = !prod.isService && stock <= prod.minStockLevel;

                return (
                  <tr key={prod.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {prod.sku}
                    </td>
                    <td className="py-3">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {language === 'ar' ? prod.nameAr : prod.nameEn}
                        </span>
                        {prod.barcode && (
                          <p className="text-[10px] font-mono text-slate-400">{prod.barcode}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-slate-500">{prod.category}</td>
                    <td className="py-3 text-end font-mono text-slate-500">
                      {prod.isService ? '-' : formatMoney(prod.purchasePrice)}
                    </td>
                    <td className="py-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                      {formatMoney(prod.sellingPrice)}
                    </td>
                    <td className="py-3 text-end font-mono">
                      {prod.isService ? (
                        <span className="rounded bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                          {t('خدمة غير مخزنية', 'Service Item')}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          <span
                            className={`font-black ${
                              stock === 0 ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {stock} {prod.unit}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {!prod.isService && (
                        <button
                          onClick={() => {
                            setSelectedProduct(prod);
                            setShowAdjustModal(true);
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                        >
                          {t('تسوية رصيد', 'Adjust')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
              {t('إضافة صنف أو خدمة جديدة', 'Add Product / Service')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الصنف (بالعربية):', 'Name (Arabic):')}
                </label>
                <input
                  type="text"
                  value={newProd.nameAr}
                  onChange={(e) => setNewProd({ ...newProd, nameAr: e.target.value })}
                  placeholder="مثال: جهاز قياس حرارة ديجيتال"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الصنف (SKU):', 'SKU:')}
                  </label>
                  <input
                    type="text"
                    value={newProd.sku}
                    onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                    placeholder="MED-TH-01"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الباركود:', 'Barcode:')}
                  </label>
                  <input
                    type="text"
                    value={newProd.barcode}
                    onChange={(e) => setNewProd({ ...newProd, barcode: e.target.value })}
                    placeholder="622100..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('سعر التكلفة (ج.م):', 'Cost Price:')}
                  </label>
                  <input
                    type="number"
                    value={newProd.purchasePrice}
                    onChange={(e) => setNewProd({ ...newProd, purchasePrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('سعر البيع (ج.م):', 'Selling Price:')}
                  </label>
                  <input
                    type="number"
                    value={newProd.sellingPrice}
                    onChange={(e) => setNewProd({ ...newProd, sellingPrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الرصيد الافتتاحي بالمخزن:', 'Initial Stock:')}
                  </label>
                  <input
                    type="number"
                    value={newProd.initialStock}
                    onChange={(e) => setNewProd({ ...newProd, initialStock: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('حد إعادة الطلب (الأدنى):', 'Min Stock:')}
                  </label>
                  <input
                    type="number"
                    value={newProd.minStockLevel}
                    onChange={(e) => setNewProd({ ...newProd, minStockLevel: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isServiceCheck"
                  checked={newProd.isService}
                  onChange={(e) => setNewProd({ ...newProd, isService: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isServiceCheck" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                  {t('هذا الصنف عبارة عن خدمة طبية/كشف (لا يتبع مخزون)', 'This is a service/consultation (non-stock)')}
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSaveProduct}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('حفظ الصنف', 'Save Product')}
                </button>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
              {t('تسوية رصيد مخزني', 'Stock Adjustment')}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {selectedProduct.nameAr} ({t('الرصيد الحالي:', 'Current:')}{' '}
              {getProductStock(selectedProduct.id, activeWarehouse.id)})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('مقدار التعديل (+ للزيادة، - للعجز):', 'Quantity Delta (+/-):')}
                </label>
                <input
                  type="number"
                  value={adjustData.delta}
                  onChange={(e) => setAdjustData({ ...adjustData, delta: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('سبب التسوية:', 'Reason:')}
                </label>
                <input
                  type="text"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    adjustStock(selectedProduct.id, activeWarehouse.id, adjustData.delta, adjustData.reason);
                    setShowAdjustModal(false);
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('اعتماد التسوية', 'Confirm Adjustment')}
                </button>
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTER-WAREHOUSE TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
              {t('تحويل بضاعة بين المستودعات', 'Inter-Warehouse Stock Transfer')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اختر الصنف المراد تحويله:', 'Select Product:')}
                </label>
                <select
                  id="transferProdSelect"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-medium text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {products
                    .filter((p) => !p.isService)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameAr} - {p.sku} ({t('المتاح:', 'Stock:')} {getProductStock(p.id, transferData.fromWh)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('من مستودع:', 'From Warehouse:')}
                  </label>
                  <select
                    value={transferData.fromWh}
                    onChange={(e) => setTransferData({ ...transferData, fromWh: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('إلى مستودع:', 'To Warehouse:')}
                  </label>
                  <select
                    value={transferData.toWh}
                    onChange={(e) => setTransferData({ ...transferData, toWh: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الكمية المحولة:', 'Transfer Quantity:')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={transferData.qty}
                  onChange={(e) => setTransferData({ ...transferData, qty: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    const selEl = document.getElementById('transferProdSelect') as HTMLSelectElement;
                    const prodId = selEl?.value || products[0].id;
                    transferStock(prodId, transferData.fromWh, transferData.toWh, transferData.qty);
                    setShowTransferModal(false);
                    alert(t('تم تنفيذ التحويل وتحديث الأرصدة فوراً!', 'Transfer executed successfully!'));
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('تنفيذ التحويل الفوري', 'Execute Transfer')}
                </button>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
