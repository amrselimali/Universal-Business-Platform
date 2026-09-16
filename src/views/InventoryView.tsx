import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Product, ItemCategory } from '../types';
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
  Trash2,
  Edit2,
  Tag,
  Stethoscope,
  Boxes,
  Building2,
  FolderPlus,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const {
    t,
    formatMoney,
    tenant,
    products,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    warehouses,
    activeWarehouse,
    setActiveWarehouse,
    getProductStock,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    transferStock,
    language,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'services' | 'goods'>('all');

  // Modals
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [showEditProductModal, setShowEditProductModal] = useState<boolean>(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);

  // New/Edit Product Form State
  const [prodForm, setProdForm] = useState({
    nameAr: '',
    nameEn: '',
    sku: '',
    barcode: '',
    category: '',
    categoryId: '',
    purchasePrice: 0,
    sellingPrice: 100,
    minStockLevel: 5,
    unit: 'جلسة/كشف',
    isService: true,
    initialStock: 0,
  });

  // Category Form State
  const [categoryForm, setCategoryForm] = useState<{
    nameAr: string;
    nameEn: string;
    type: 'services' | 'goods' | 'both';
    description?: string;
  }>({
    nameAr: '',
    nameEn: '',
    type: 'services',
    description: '',
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

  // Filtered Products for current tenant
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      p.nameAr.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q);

    const matchCategory =
      selectedCategoryFilter === 'all' ||
      p.categoryId === selectedCategoryFilter ||
      p.category === selectedCategoryFilter;

    const matchType =
      typeFilter === 'all' ||
      (typeFilter === 'services' && p.isService) ||
      (typeFilter === 'goods' && !p.isService);

    return matchQuery && matchCategory && matchType;
  });

  const openAddProductModal = () => {
    const defaultCat = categories[0]?.nameAr || 'خدمات عامة';
    const defaultCatId = categories[0]?.id || '';
    setProdForm({
      nameAr: '',
      nameEn: '',
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      barcode: '',
      category: defaultCat,
      categoryId: defaultCatId,
      purchasePrice: 0,
      sellingPrice: 150,
      minStockLevel: 5,
      unit: 'خدمة/جلسة',
      isService: true,
      initialStock: 0,
    });
    setShowAddProductModal(true);
  };

  const openEditProductModal = (prod: Product) => {
    setSelectedProduct(prod);
    setProdForm({
      nameAr: prod.nameAr,
      nameEn: prod.nameEn,
      sku: prod.sku,
      barcode: prod.barcode || '',
      category: prod.category,
      categoryId: prod.categoryId || '',
      purchasePrice: prod.purchasePrice,
      sellingPrice: prod.sellingPrice,
      minStockLevel: prod.minStockLevel,
      unit: prod.unit,
      isService: prod.isService,
      initialStock: 0,
    });
    setShowEditProductModal(true);
  };

  const handleSaveNewProduct = () => {
    if (!prodForm.nameAr.trim() || !prodForm.sku.trim()) {
      alert(t('يرجى كتابة اسم الصنف أو الخدمة وكود الـ SKU!', 'Please enter item name and SKU!'));
      return;
    }

    const assignedCat = categories.find((c) => c.id === prodForm.categoryId || c.nameAr === prodForm.category);

    addProduct(
      {
        nameAr: prodForm.nameAr,
        nameEn: prodForm.nameEn || prodForm.nameAr,
        sku: prodForm.sku,
        barcode: prodForm.barcode || prodForm.sku,
        category: assignedCat ? assignedCat.nameAr : prodForm.category || 'عام',
        categoryId: assignedCat ? assignedCat.id : prodForm.categoryId,
        purchasePrice: Number(prodForm.purchasePrice) || 0,
        sellingPrice: Number(prodForm.sellingPrice) || 0,
        minStockLevel: Number(prodForm.minStockLevel) || 0,
        unit: prodForm.unit || (prodForm.isService ? 'جلسة' : 'قطعة'),
        isService: prodForm.isService,
      },
      prodForm.isService ? 0 : prodForm.initialStock
    );
    setShowAddProductModal(false);
  };

  const handleSaveEditProduct = () => {
    if (!selectedProduct) return;
    if (!prodForm.nameAr.trim() || !prodForm.sku.trim()) {
      alert(t('يرجى كتابة اسم الصنف أو الخدمة وكود الـ SKU!', 'Please enter item name and SKU!'));
      return;
    }

    const assignedCat = categories.find((c) => c.id === prodForm.categoryId || c.nameAr === prodForm.category);

    updateProduct(selectedProduct.id, {
      nameAr: prodForm.nameAr,
      nameEn: prodForm.nameEn || prodForm.nameAr,
      sku: prodForm.sku,
      barcode: prodForm.barcode || prodForm.sku,
      category: assignedCat ? assignedCat.nameAr : prodForm.category || 'عام',
      categoryId: assignedCat ? assignedCat.id : prodForm.categoryId,
      purchasePrice: Number(prodForm.purchasePrice) || 0,
      sellingPrice: Number(prodForm.sellingPrice) || 0,
      minStockLevel: Number(prodForm.minStockLevel) || 0,
      unit: prodForm.unit,
      isService: prodForm.isService,
    });
    setShowEditProductModal(false);
    setSelectedProduct(null);
  };

  const openAddCategoryModal = () => {
    setCategoryForm({
      nameAr: '',
      nameEn: '',
      type: 'services',
      description: '',
    });
    setShowAddCategoryModal(true);
  };

  const openEditCategoryModal = (cat: ItemCategory) => {
    setSelectedCategory(cat);
    setCategoryForm({
      nameAr: cat.nameAr,
      nameEn: cat.nameEn || '',
      type: cat.type || 'services',
      description: cat.description || '',
    });
    setShowEditCategoryModal(true);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.nameAr.trim()) {
      alert(t('يرجى إدخال اسم المجموعة بالعربية!', 'Please enter group/category name in Arabic!'));
      return;
    }

    addCategory({
      nameAr: categoryForm.nameAr.trim(),
      nameEn: categoryForm.nameEn?.trim() || categoryForm.nameAr.trim(),
      type: categoryForm.type,
      description: categoryForm.description?.trim(),
    });

    setShowAddCategoryModal(false);
  };

  const handleUpdateCategory = () => {
    if (!selectedCategory) return;
    if (!categoryForm.nameAr.trim()) {
      alert(t('يرجى إدخال اسم المجموعة بالعربية!', 'Please enter group/category name in Arabic!'));
      return;
    }

    updateCategory(selectedCategory.id, {
      nameAr: categoryForm.nameAr.trim(),
      nameEn: categoryForm.nameEn?.trim() || categoryForm.nameAr.trim(),
      type: categoryForm.type,
      description: categoryForm.description?.trim(),
    });

    setShowEditCategoryModal(false);
    setSelectedCategory(null);
  };

  const handleDeleteCategory = (cat: ItemCategory) => {
    if (
      window.confirm(
        t(
          `هل أنت متأكد من حذف مجموعة الخدمات / الأصناف (${cat.nameAr})؟`,
          `Are you sure you want to delete category (${cat.nameAr})?`
        )
      )
    ) {
      const res = deleteCategory(cat.id);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Scope Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                {t('الشركة الحالية النشطة:', 'Active Company Scope:')}
              </span>
              <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-extrabold text-white">
                {tenant?.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                'المجموعات والخدمات والأصناف الموضحة أدناه خاصة بهذه الشركة وتشمل كافة فروعها كوحدة واحدة ومفصولة تماماً عن باقي الشركات.',
                'Categories, services, and products below are dedicated to this company across all its branches and isolated completely.'
              )}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center rounded-xl bg-white p-1 shadow-xs dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'items'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>{t('الخدمات والأصناف', 'Items & Services')}</span>
            <span className="ms-1 rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {products.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'categories'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>{t('مجموعات الخدمات والأصناف', 'Service Groups & Categories')}</span>
            <span className="ms-1 rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {categories.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: ITEMS & SERVICES */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          {/* Header & Main Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {t('دليل الخدمات والأصناف والمخزون', 'Services, Products & Stock')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'إدارة وتسجيل الخدمات الطبية، السلع والمستلزمات، وتتبع أرصدة الفروع والمستودعات.',
                  'Manage medical services, goods, and track stock levels per warehouse.'
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {warehouses.length > 1 && (
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition-colors"
                >
                  <ArrowRightLeft className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t('تحويل بين المستودعات', 'Inter-Warehouse Transfer')}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTab('categories');
                  openAddCategoryModal();
                }}
                className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 transition-colors"
              >
                <FolderPlus className="h-4 w-4" />
                <span>{t('إضافة مجموعة جديدة', 'New Group')}</span>
              </button>

              <button
                onClick={openAddProductModal}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{t('إضافة صنف / خدمة جديدة', 'Add Item / Service')}</span>
              </button>
            </div>
          </div>

          {/* Filter and Warehouse Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {/* Type Filter & Categories Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    typeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  {t('الكل', 'All')}
                </button>
                <button
                  onClick={() => setTypeFilter('services')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    typeFilter === 'services'
                      ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  {t('خدمات فقط', 'Services')}
                </button>
                <button
                  onClick={() => setTypeFilter('goods')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    typeFilter === 'goods'
                      ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  {t('بضائع ومستلزمات', 'Goods')}
                </button>
              </div>

              {/* Category Filter Select */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="all">{t('كافة المجموعات', 'All Groups')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Warehouse selector for goods */}
              {activeWarehouse && (
                <div className="hidden lg:flex items-center gap-1 border-s border-slate-200 ps-3 dark:border-slate-700">
                  <WarehouseIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-500">{t('المستودع:', 'Warehouse:')}</span>
                  <select
                    value={activeWarehouse.id}
                    onChange={(e) => {
                      const wh = warehouses.find((w) => w.id === e.target.value);
                      if (wh) setActiveWarehouse(wh);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {language === 'ar' ? wh.name : wh.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('ابحث بالاسم، الكود، الباركود...', 'Search items & services...')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-4 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Products / Services Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  <Boxes className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  {products.length === 0
                    ? t('لا توجد أصناف أو خدمات مضافة لهذه الشركة بعد', 'No items or services yet for this company')
                    : t('لا توجد نتائج مطابقة لبحثك', 'No matching results found')}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {products.length === 0
                    ? t('ابدأ بإضافة أول مجموعة خدمات ثم قم بإدراج الخدمات والأصناف التابعة لها.', 'Start by adding service groups, then add items and services.')
                    : t('جرّب تغيير عبارة البحث أو إزالة التصفية.', 'Try modifying search criteria or removing filters.')}
                </p>
                {products.length === 0 && (
                  <button
                    onClick={openAddProductModal}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('إضافة أول خدمة / صنف', 'Add First Service / Product')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                      <th className="pb-3 font-bold text-start">{t('كود الصنف (SKU)', 'SKU')}</th>
                      <th className="pb-3 font-bold text-start">{t('اسم الخدمة / الصنف', 'Item / Service Name')}</th>
                      <th className="pb-3 font-bold text-start">{t('المجموعة / التصنيف', 'Group / Category')}</th>
                      <th className="pb-3 font-bold text-center">{t('النوع', 'Type')}</th>
                      <th className="pb-3 font-bold text-end">{t('سعر التكلفة', 'Cost')}</th>
                      <th className="pb-3 font-bold text-end">{t('سعر البيع / الكشف', 'Selling Price')}</th>
                      <th className="pb-3 font-bold text-end">{t('الرصيد المتاح', 'Stock on Hand')}</th>
                      <th className="pb-3 font-bold text-center">{t('إجراءات', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredProducts.map((prod) => {
                      const stock = activeWarehouse ? getProductStock(prod.id, activeWarehouse.id) : 0;
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
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Tag className="h-3 w-3 text-indigo-500" />
                              {prod.category}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            {prod.isService ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                <Stethoscope className="h-3 w-3" />
                                {t('خدمة / كشف', 'Service')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Package className="h-3 w-3" />
                                {t('سلعة مخزنية', 'Physical Item')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-end font-mono text-slate-500">
                            {prod.isService ? '-' : formatMoney(prod.purchasePrice)}
                          </td>
                          <td className="py-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                            {formatMoney(prod.sellingPrice)}
                          </td>
                          <td className="py-3 text-end font-mono">
                            {prod.isService ? (
                              <span className="text-[11px] text-slate-400">
                                {t('غير مرتبط بمخزن', 'Non-inventory')}
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                <span
                                  className={`font-black ${
                                    stock === 0
                                      ? 'text-rose-600'
                                      : isLow
                                      ? 'text-amber-600'
                                      : 'text-slate-800 dark:text-slate-100'
                                  }`}
                                >
                                  {stock} {prod.unit}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Item */}
                              <button
                                onClick={() => openEditProductModal(prod)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
                                title={t('تعديل الصنف / الخدمة', 'Edit Item')}
                              >
                                <Edit2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>{t('تعديل', 'Edit')}</span>
                              </button>

                              {!prod.isService && activeWarehouse && (
                                <button
                                  onClick={() => {
                                    setSelectedProduct(prod);
                                    setShowAdjustModal(true);
                                  }}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  {t('تسوية', 'Adjust')}
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      t(
                                        `هل أنت متأكد من حذف (${prod.nameAr}) من دليل هذه الشركة؟`,
                                        `Are you sure to delete (${prod.nameAr})?`
                                      )
                                    )
                                  ) {
                                    deleteProduct(prod.id);
                                  }
                                }}
                                className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 transition-colors cursor-pointer"
                                title={t('حذف', 'Delete')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SERVICE GROUPS & CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          {/* Categories Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {t('مجموعات الخدمات والتصنيفات', 'Service Groups & Categories')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'إضافة وتعديل مجموعات الخدمات الخاصة بشركتك وتنظيم بنود الكشوفات والسلع.',
                  'Add and customize service groups and item categories specifically for your company.'
                )}
              </p>
            </div>

            <button
              onClick={openAddCategoryModal}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t('إضافة مجموعة خدمات جديدة', 'Add Service Group')}</span>
            </button>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const itemCount = products.filter(
                (p) => p.categoryId === cat.id || p.category === cat.nameAr
              ).length;
              const serviceCount = products.filter(
                (p) => (p.categoryId === cat.id || p.category === cat.nameAr) && p.isService
              ).length;
              const goodsCount = products.filter(
                (p) => (p.categoryId === cat.id || p.category === cat.nameAr) && !p.isService
              ).length;

              return (
                <div
                  key={cat.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                          {cat.type === 'services' ? (
                            <Stethoscope className="h-5 w-5" />
                          ) : cat.type === 'goods' ? (
                            <Package className="h-5 w-5" />
                          ) : (
                            <Layers className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {cat.nameAr}
                          </h3>
                          {cat.nameEn && cat.nameEn !== cat.nameAr && (
                            <p className="text-[11px] text-slate-400">{cat.nameEn}</p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          cat.type === 'services'
                            ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                            : cat.type === 'goods'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                        }`}
                      >
                        {cat.type === 'services'
                          ? t('مجموعة خدمات', 'Services Group')
                          : cat.type === 'goods'
                          ? t('مجموعة بضائع', 'Goods Group')
                          : t('شاملة (خدمات وبضائع)', 'Both')}
                      </span>
                    </div>

                    {cat.description && (
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {cat.description}
                      </p>
                    )}

                    <div className="mt-4 flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('إجمالي البنود:', 'Items count:')}{' '}
                        <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                          {itemCount}
                        </strong>
                      </span>
                      {serviceCount > 0 && (
                        <span className="text-slate-400">
                          ({serviceCount} {t('خدمة', 'services')})
                        </span>
                      )}
                      {goodsCount > 0 && (
                        <span className="text-slate-400">
                          ({goodsCount} {t('صنف', 'goods')})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => openEditCategoryModal(cat)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{t('تعديل المجموعة', 'Edit')}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('حذف', 'Delete')}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {categories.length === 0 && (
              <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <Layers className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {t('لا توجد مجموعات خدمات لهذه الشركة بعد', 'No service groups for this company yet')}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {t(
                    'أنشئ مجموعات مثل: "كشوفات الجلدية"، "خدمات الليزر"، "مستلزمات الأسنان"، لتنظيم الخدمات بدقة.',
                    'Create groups like "Dermatology", "Laser Services", "Dental Supplies" to organize your services.'
                  )}
                </p>
                <button
                  onClick={openAddCategoryModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('إضافة أول مجموعة خدمات', 'Add First Service Group')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD ITEM / SERVICE MODAL */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t('إضافة صنف أو خدمة جديدة للشركة', 'Add Item / Service to Company')}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t('الشركة:', 'Company:')} <strong className="text-indigo-600">{tenant?.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() =>
                    setProdForm({ ...prodForm, isService: true, unit: 'جلسة/كشف', initialStock: 0 })
                  }
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all ${
                    prodForm.isService
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Stethoscope className="h-4 w-4" />
                  <span>{t('خدمة طبية / كشف / استشارة', 'Medical Service / Consultation')}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProdForm({ ...prodForm, isService: false, unit: 'قطعة', initialStock: 10 })
                  }
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all ${
                    !prodForm.isService
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Package className="h-4 w-4" />
                  <span>{t('سلعة / بضاعة مخزنية', 'Physical Stock Item')}</span>
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الخدمة أو الصنف (بالعربية)*:', 'Item / Service Name (Arabic)*:')}
                </label>
                <input
                  type="text"
                  value={prodForm.nameAr}
                  onChange={(e) => setProdForm({ ...prodForm, nameAr: e.target.value })}
                  placeholder={prodForm.isService ? 'مثال: كشف استشاري جلدية وتجميل' : 'مثال: جهاز قياس سكر ديجيتال'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالإنجليزية (اختياري):', 'Name (English):')}
                  </label>
                  <input
                    type="text"
                    value={prodForm.nameEn}
                    onChange={(e) => setProdForm({ ...prodForm, nameEn: e.target.value })}
                    placeholder="e.g. Dermatology Consultation"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('المجموعة التابعة لها*:', 'Service Group / Category*:')}
                  </label>
                  {categories.length > 0 ? (
                    <select
                      value={prodForm.categoryId}
                      onChange={(e) => {
                        const selected = categories.find((c) => c.id === e.target.value);
                        setProdForm({
                          ...prodForm,
                          categoryId: e.target.value,
                          category: selected?.nameAr || prodForm.category,
                        });
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameAr}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={prodForm.category}
                      onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                      placeholder="خدمات عامة"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الصنف / الخدمة (SKU)*:', 'SKU Code*:')}
                  </label>
                  <input
                    type="text"
                    value={prodForm.sku}
                    onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الباركود / الكود الدولي:', 'Barcode:')}
                  </label>
                  <input
                    type="text"
                    value={prodForm.barcode}
                    onChange={(e) => setProdForm({ ...prodForm, barcode: e.target.value })}
                    placeholder="اختياري"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {prodForm.isService ? t('تكلفة التشغيل المباشرة (ج.م):', 'Direct Cost:') : t('سعر التكلفة (ج.م):', 'Cost Price:')}
                  </label>
                  <input
                    type="number"
                    value={prodForm.purchasePrice}
                    onChange={(e) => setProdForm({ ...prodForm, purchasePrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {prodForm.isService ? t('سعر الكشف / الخدمة (ج.م)*:', 'Price (EGP)*:') : t('سعر البيع (ج.م)*:', 'Selling Price*:')}
                  </label>
                  <input
                    type="number"
                    value={prodForm.sellingPrice}
                    onChange={(e) => setProdForm({ ...prodForm, sellingPrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono font-bold text-indigo-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400"
                  />
                </div>
              </div>

              {!prodForm.isService && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('الرصيد الافتتاحي بالمستودع:', 'Initial Stock:')}
                    </label>
                    <input
                      type="number"
                      value={prodForm.initialStock}
                      onChange={(e) => setProdForm({ ...prodForm, initialStock: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('حد إعادة الطلب (الأدنى):', 'Min Stock Alert:')}
                    </label>
                    <input
                      type="number"
                      value={prodForm.minStockLevel}
                      onChange={(e) => setProdForm({ ...prodForm, minStockLevel: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleSaveNewProduct}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  {prodForm.isService ? t('حفظ الخدمة', 'Save Service') : t('حفظ الصنف', 'Save Product')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ITEM / SERVICE MODAL */}
      {showEditProductModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t('تعديل بيانات الخدمة أو الصنف', 'Edit Item / Service')}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">{selectedProduct.sku}</p>
              </div>
              <button
                onClick={() => setShowEditProductModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الخدمة أو الصنف (بالعربية)*:', 'Item Name (Arabic)*:')}
                </label>
                <input
                  type="text"
                  value={prodForm.nameAr}
                  onChange={(e) => setProdForm({ ...prodForm, nameAr: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالإنجليزية:', 'Name (English):')}
                  </label>
                  <input
                    type="text"
                    value={prodForm.nameEn}
                    onChange={(e) => setProdForm({ ...prodForm, nameEn: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('المجموعة التابعة لها*:', 'Service Group / Category*:')}
                  </label>
                  {categories.length > 0 ? (
                    <select
                      value={prodForm.categoryId}
                      onChange={(e) => {
                        const selected = categories.find((c) => c.id === e.target.value);
                        setProdForm({
                          ...prodForm,
                          categoryId: e.target.value,
                          category: selected?.nameAr || prodForm.category,
                        });
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameAr}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={prodForm.category}
                      onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('سعر التكلفة (ج.م):', 'Cost Price:')}
                  </label>
                  <input
                    type="number"
                    value={prodForm.purchasePrice}
                    onChange={(e) => setProdForm({ ...prodForm, purchasePrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {prodForm.isService ? t('سعر الكشف / الخدمة (ج.م)*:', 'Price (EGP)*:') : t('سعر البيع (ج.م)*:', 'Selling Price*:')}
                  </label>
                  <input
                    type="number"
                    value={prodForm.sellingPrice}
                    onChange={(e) => setProdForm({ ...prodForm, sellingPrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono font-bold text-indigo-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleSaveEditProduct}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditProductModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD CATEGORY MODAL */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t('إضافة مجموعة خدمات جديدة للشركة', 'Add New Service Group')}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t('الشركة:', 'Company:')} <strong className="text-indigo-600">{tenant?.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم المجموعة (بالعربية)*:', 'Group Name (Arabic)*:')}
                </label>
                <input
                  type="text"
                  value={categoryForm.nameAr}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })}
                  placeholder="مثال: خدمات عيادة الأسنان والتركيبات"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم المجموعة (بالإنجليزية):', 'Group Name (English):')}
                </label>
                <input
                  type="text"
                  value={categoryForm.nameEn}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameEn: e.target.value })}
                  placeholder="e.g. Dental Services"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('نوع البنود في هذه المجموعة:', 'Category Item Types:')}
                </label>
                <select
                  value={categoryForm.type}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      type: e.target.value as 'services' | 'goods' | 'both',
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="services">{t('خدمات طبية واستشارية (Non-stock)', 'Services Only')}</option>
                  <option value="goods">{t('سلع ومستلزمات مخزنية (Physical Stock)', 'Goods / Stock Only')}</option>
                  <option value="both">{t('شاملة (خدمات وبضائع معاً)', 'Both Services & Goods')}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('وصف أو ملاحظات المجموعة (اختياري):', 'Description (Optional):')}
                </label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="ملاحظات توضيحية حول هذه المجموعة..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  {t('حفظ المجموعة', 'Save Group')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {showEditCategoryModal && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t('تعديل مجموعة الخدمات', 'Edit Service Group')}
                </h3>
                <p className="text-[11px] text-slate-500">{selectedCategory.nameAr}</p>
              </div>
              <button
                onClick={() => setShowEditCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم المجموعة (بالعربية)*:', 'Group Name (Arabic)*:')}
                </label>
                <input
                  type="text"
                  value={categoryForm.nameAr}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم المجموعة (بالإنجليزية):', 'Group Name (English):')}
                </label>
                <input
                  type="text"
                  value={categoryForm.nameEn}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameEn: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('نوع البنود في هذه المجموعة:', 'Category Item Types:')}
                </label>
                <select
                  value={categoryForm.type}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      type: e.target.value as 'services' | 'goods' | 'both',
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="services">{t('خدمات طبية واستشارية (Non-stock)', 'Services Only')}</option>
                  <option value="goods">{t('سلع ومستلزمات مخزنية (Physical Stock)', 'Goods / Stock Only')}</option>
                  <option value="both">{t('شاملة (خدمات وبضائع معاً)', 'Both Services & Goods')}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('وصف أو ملاحظات المجموعة:', 'Description:')}
                </label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleUpdateCategory}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditCategoryModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && selectedProduct && activeWarehouse && (
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
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  {t('اعتماد التسوية', 'Confirm Adjustment')}
                </button>
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTER-WAREHOUSE TRANSFER MODAL */}
      {showTransferModal && warehouses.length > 1 && (
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
                    const prodId = selEl?.value || products[0]?.id;
                    if (prodId) {
                      transferStock(prodId, transferData.fromWh, transferData.toWh, transferData.qty);
                      setShowTransferModal(false);
                      alert(t('تم تنفيذ التحويل وتحديث الأرصدة فوراً!', 'Transfer executed successfully!'));
                    }
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  {t('تنفيذ التحويل الفوري', 'Execute Transfer')}
                </button>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
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
