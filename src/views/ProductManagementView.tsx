import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Product, ItemCategory } from '../types';
import {
  Package,
  Plus,
  Search,
  Tag,
  Stethoscope,
  Boxes,
  X,
  Trash2,
  Edit2,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Percent,
  Sliders,
  Sparkles,
  Info,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Filter,
} from 'lucide-react';

export const ProductManagementView: React.FC = () => {
  const {
    t,
    formatMoney,
    tenant,
    products,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    addProduct,
    updateProduct,
    deleteProduct,
    language,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'sales_items' | 'categories'>('sales_items');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'products' | 'services'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);

  // Modal to inspect cost breakdown from linked stock raw materials
  const [costBreakdownProduct, setCostBreakdownProduct] = useState<Product | null>(null);

  // Form for Sales Product / Service
  const [form, setForm] = useState<{
    nameAr: string;
    nameEn: string;
    sku: string;
    barcode: string;
    category: string;
    categoryId: string;
    sellingPrice: number;
    minSellingPrice: number;
    purchasePrice: number;
    taxRate: number;
    unit: string;
    isService: boolean;
    itemType: 'sales_product' | 'sales_service';
    isActive: boolean;
    notes: string;
  }>({
    nameAr: '',
    nameEn: '',
    sku: '',
    barcode: '',
    category: '',
    categoryId: '',
    sellingPrice: 500,
    minSellingPrice: 450,
    purchasePrice: 0,
    taxRate: 0,
    unit: 'جلسة',
    isService: true,
    itemType: 'sales_service',
    isActive: true,
    notes: '',
  });

  // Category Form
  const [categoryForm, setCategoryForm] = useState<{
    nameAr: string;
    nameEn: string;
    type: 'service' | 'product' | 'both';
    description?: string;
    color?: string;
  }>({
    nameAr: '',
    nameEn: '',
    type: 'service',
    description: '',
    color: '#4f46e5',
  });

  // Filter out stock raw items: This view is STRICTLY for Sales Items (Products & Services)
  const salesItems = useMemo(() => {
    return products.filter((p) => {
      // Must NOT be a pure stock/raw item
      if (p.isStockItem) return false;
      if (p.itemType === 'stock_raw' || p.itemType === 'consumable' || p.itemType === 'medical_supply') {
        return false;
      }
      return true;
    });
  }, [products]);

  // All Stock items to compute cost of sale dynamically
  const stockItems = useMemo(() => {
    return products.filter((p) => {
      return (
        p.isStockItem ||
        p.itemType === 'stock_raw' ||
        p.itemType === 'consumable' ||
        p.itemType === 'medical_supply'
      );
    });
  }, [products]);

  // Helper: calculate cost of sale from linked stock items
  const getCalculatedCostOfSale = (salesProd: Product) => {
    let directStockCost = 0;
    const contributingStockItems: { item: Product; qty: number; cost: number }[] = [];

    stockItems.forEach((stk) => {
      if (stk.linkedSalesProductIds && stk.linkedSalesProductIds.includes(salesProd.id)) {
        let qty = stk.consumptionRate || 1;
        let itemCost = 0;
        if (stk.consumptionBasis === 'revenue_ratio') {
          itemCost = (salesProd.sellingPrice * ((stk.consumptionRate || 0) / 100));
        } else {
          itemCost = qty * stk.purchasePrice;
        }
        directStockCost += itemCost;
        contributingStockItems.push({ item: stk, qty, cost: itemCost });
      }
    });

    const finalCost = directStockCost > 0 ? directStockCost : (salesProd.purchasePrice || 0);
    return {
      totalCost: finalCost,
      isCalculatedFromStock: directStockCost > 0,
      contributingItems: contributingStockItems,
    };
  };

  // Filtered sales items
  const filteredSalesItems = useMemo(() => {
    return salesItems.filter((p) => {
      const matchesSearch =
        p.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.unit && p.unit.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategoryFilter === 'all' ||
        p.categoryId === selectedCategoryFilter ||
        p.category === selectedCategoryFilter;

      let matchesType = true;
      if (typeFilter === 'products') {
        matchesType = !p.isService && p.itemType !== 'sales_service';
      } else if (typeFilter === 'services') {
        matchesType = p.isService || p.itemType === 'sales_service';
      }

      return matchesSearch && matchesCat && matchesType;
    });
  }, [salesItems, searchQuery, selectedCategoryFilter, typeFilter]);

  // Stats
  const totalSalesItemsCount = salesItems.length;
  const servicesCount = salesItems.filter((p) => p.isService || p.itemType === 'sales_service').length;
  const commercialProductsCount = salesItems.filter((p) => !p.isService && p.itemType !== 'sales_service').length;
  const avgSellingPrice =
    salesItems.length > 0
      ? salesItems.reduce((sum, p) => sum + p.sellingPrice, 0) / salesItems.length
      : 0;

  // Handlers
  const handleOpenAdd = (type: 'sales_service' | 'sales_product' = 'sales_service') => {
    const isSrv = type === 'sales_service';
    const nextSku = isSrv
      ? `SRV-${(servicesCount + 1).toString().padStart(3, '0')}`
      : `PRD-${(commercialProductsCount + 1).toString().padStart(3, '0')}`;

    const defaultCat = categories.find((c) => (isSrv ? c.type === 'service' : c.type === 'product')) || categories[0];

    setForm({
      nameAr: '',
      nameEn: '',
      sku: nextSku,
      barcode: `622${Date.now().toString().slice(-8)}`,
      category: defaultCat?.nameAr || 'خدمات طبية وكشوفات',
      categoryId: defaultCat?.id || '',
      sellingPrice: isSrv ? 400 : 250,
      minSellingPrice: isSrv ? 350 : 200,
      purchasePrice: 0,
      taxRate: isSrv ? 0 : 14,
      unit: isSrv ? 'جلسة' : 'قطعة',
      isService: isSrv,
      itemType: type,
      isActive: true,
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setSelectedProduct(prod);
    setForm({
      nameAr: prod.nameAr,
      nameEn: prod.nameEn,
      sku: prod.sku,
      barcode: prod.barcode || '',
      category: prod.category,
      categoryId: prod.categoryId || '',
      sellingPrice: prod.sellingPrice,
      minSellingPrice: prod.minSellingPrice || prod.sellingPrice * 0.9,
      purchasePrice: prod.purchasePrice || 0,
      taxRate: prod.taxRate || 0,
      unit: prod.unit || 'جلسة',
      isService: !!prod.isService,
      itemType: (prod.isService || prod.itemType === 'sales_service') ? 'sales_service' : 'sales_product',
      isActive: prod.isActive !== false,
      notes: prod.notes || '',
    });
    setShowEditModal(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim()) return;

    const matchedCat = categories.find((c) => c.id === form.categoryId);

    addProduct(
      {
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim() || form.nameAr.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        category: matchedCat?.nameAr || form.category || 'عام',
        categoryId: form.categoryId,
        sellingPrice: Number(form.sellingPrice) || 0,
        minSellingPrice: Number(form.minSellingPrice) || Number(form.sellingPrice) || 0,
        purchasePrice: Number(form.purchasePrice) || 0,
        taxRate: Number(form.taxRate) || 0,
        minStockLevel: 0,
        unit: form.unit.trim() || (form.isService ? 'جلسة' : 'قطعة'),
        isService: form.isService,
        itemType: form.itemType,
        isSalesItem: true,
        isStockItem: false,
        isActive: form.isActive,
        notes: form.notes,
      },
      0
    );

    setShowAddModal(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !form.nameAr.trim()) return;

    const matchedCat = categories.find((c) => c.id === form.categoryId);

    updateProduct(selectedProduct.id, {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || form.nameAr.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      category: matchedCat?.nameAr || form.category,
      categoryId: form.categoryId,
      sellingPrice: Number(form.sellingPrice) || 0,
      minSellingPrice: Number(form.minSellingPrice) || 0,
      purchasePrice: Number(form.purchasePrice) || 0,
      taxRate: Number(form.taxRate) || 0,
      unit: form.unit.trim(),
      isService: form.isService,
      itemType: form.itemType,
      isSalesItem: true,
      isStockItem: false,
      isActive: form.isActive,
      notes: form.notes,
    });

    setShowEditModal(false);
    setSelectedProduct(null);
  };

  const handleDelete = (prod: Product) => {
    if (window.confirm(`هل أنت متأكد من رغبتك في حذف الصنف البيعي (${prod.nameAr})؟`)) {
      deleteProduct(prod.id);
    }
  };

  // Toggle Sales item active state
  const handleToggleActive = (prod: Product) => {
    const nextState = prod.isActive === false ? true : false;
    updateProduct(prod.id, { isActive: nextState });
  };

  // Category handlers
  const handleOpenAddCategory = () => {
    setCategoryForm({
      nameAr: '',
      nameEn: '',
      type: 'service',
      description: '',
      color: '#4f46e5',
    });
    setShowAddCategoryModal(true);
  };

  const handleOpenEditCategory = (cat: ItemCategory) => {
    setSelectedCategory(cat);
    setCategoryForm({
      nameAr: cat.nameAr,
      nameEn: cat.nameEn || '',
      type: cat.type,
      description: cat.description || '',
      color: cat.color || '#4f46e5',
    });
    setShowEditCategoryModal(true);
  };

  const handleSaveCategoryAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.nameAr.trim()) return;
    addCategory({
      nameAr: categoryForm.nameAr.trim(),
      nameEn: categoryForm.nameEn?.trim() || categoryForm.nameAr.trim(),
      type: categoryForm.type,
      description: categoryForm.description?.trim(),
      color: categoryForm.color,
    });
    setShowAddCategoryModal(false);
  };

  const handleSaveCategoryEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !categoryForm.nameAr.trim()) return;
    updateCategory(selectedCategory.id, {
      nameAr: categoryForm.nameAr.trim(),
      nameEn: categoryForm.nameEn?.trim() || categoryForm.nameAr.trim(),
      type: categoryForm.type,
      description: categoryForm.description?.trim(),
      color: categoryForm.color,
    });
    setShowEditCategoryModal(false);
    setSelectedCategory(null);
  };

  const handleDeleteCategory = (cat: ItemCategory) => {
    if (window.confirm(`هل تريد حذف المجموعة البيعية (${cat.nameAr})؟`)) {
      const res = deleteCategory(cat.id);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  return (
    <div id="product-management-view" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800">
                  {t('إدارة المنتجات والخدمات (الأصناف البيعية)', 'Sales Products & Services Management')}
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                  {t('أصناف بيعية فقط', 'Sales Only')}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {t(
                  'التحكم في الأصناف والخدمات البيعية، تسعيرها، تحديد هوامش الربحية، وإدارة المجموعات والتصنيفات',
                  'Manage commercial products & medical services, pricing, profit margins, and sales categories'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="btn-add-sales-service"
            onClick={() => handleOpenAdd('sales_service')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Stethoscope className="w-4 h-4" />
            <span>{t('إضافة خدمة / جلسة بيعية', 'Add Medical Service')}</span>
          </button>

          <button
            id="btn-add-sales-product"
            onClick={() => handleOpenAdd('sales_product')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Package className="w-4 h-4" />
            <span>{t('إضافة منتج تجاري بيعي', 'Add Retail Product')}</span>
          </button>

          <button
            id="btn-add-category"
            onClick={handleOpenAddCategory}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition"
          >
            <Layers className="w-4 h-4" />
            <span>{t('مجموعة جديدة', 'New Group')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('إجمالي الأصناف البيعية', 'Total Sales Items')}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalSalesItemsCount}</h3>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">
              {commercialProductsCount} {t('منتج تجاري', 'products')} + {servicesCount} {t('خدمة طبية', 'services')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('الخدمات والجلسات الطبية', 'Medical Services')}</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">{servicesCount}</h3>
            <span className="text-xs text-indigo-500 mt-0.5 inline-block">{t('جلسات ليزر وتجميل وكشوفات', 'Laser & aesthetics')}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('المنتجات التجارية للبيع', 'Retail Products')}</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{commercialProductsCount}</h3>
            <span className="text-xs text-emerald-500 mt-0.5 inline-block">{t('مستحضرات وأجهزة ومكملات', 'Retail items')}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('متوسط سعر البيع', 'Average Price')}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatMoney(avgSellingPrice)}</h3>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">{t('عبر كافة الخدمات والمنتجات', 'Across sales catalog')}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 px-6 pt-4 gap-6">
          <button
            id="tab-sales-items"
            onClick={() => setActiveTab('sales_items')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'sales_items'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>{t('الأصناف والخدمات البيعية والتسعير', 'Sales Items & Pricing')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-bold">
              {salesItems.length}
            </span>
          </button>

          <button
            id="tab-categories"
            onClick={() => setActiveTab('categories')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'categories'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t('المجموعات والتصنيفات البيعية', 'Sales Categories & Groups')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-bold">
              {categories.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Sales Items & Pricing */}
        {activeTab === 'sales_items' && (
          <div className="p-6 space-y-5">
            {/* Filters Bar */}
            <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t(
                    'بحث باسم الصنف البيعي، الكود SKU، الباركود، أو الوحدة...',
                    'Search sales items, SKU, barcode, unit...'
                  )}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap">
                {/* Type Filter */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      typeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {t('الكل', 'All')}
                  </button>
                  <button
                    onClick={() => setTypeFilter('services')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                      typeFilter === 'services' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>{t('خدمات وجلسات', 'Services')}</span>
                  </button>
                  <button
                    onClick={() => setTypeFilter('products')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                      typeFilter === 'products' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>{t('منتجات تجارية', 'Products')}</span>
                  </button>
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">{t('جميع المجموعات البيعية', 'All Categories')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hint Notice */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">{t('ملاحظة هامة للمبيعات والتسعير:', 'Notice on Sales & Pricing:')}</span>{' '}
                {t(
                  'هذه الشاشة مخصصة للأصناف والخدمات التي تباع للمرضى والعملاء فقط. تكلفة البيع (COGS) تُحسب آلياً بناءً على استهلاك الخامات والمستهلكات المربوطة بهذا الصنف من شاشة إدارة المخازن لتحديد هامش الربح بدقة.',
                  'This catalog is strictly for items sold to clients. Cost of sale is dynamically computed from linked raw consumables in the Warehouse Management screen.'
                )}
              </div>
            </div>

            {/* Sales Items Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">{t('الصنف البيعي', 'Sales Item')}</th>
                    <th className="py-3.5 px-4">{t('النوع والمجموعة', 'Type & Category')}</th>
                    <th className="py-3.5 px-4">{t('وحدة البيع', 'Sales Unit')}</th>
                    <th className="py-3.5 px-4 text-emerald-700 font-bold">{t('سعر البيع', 'Selling Price')}</th>
                    <th className="py-3.5 px-4 text-slate-600">{t('الحد الأدنى للبيع', 'Min Price')}</th>
                    <th className="py-3.5 px-4 text-slate-700">{t('تكلفة البيع (COGS)', 'Cost of Sale')}</th>
                    <th className="py-3.5 px-4 text-indigo-700">{t('هامش الربح', 'Profit Margin')}</th>
                    <th className="py-3.5 px-4 text-center">{t('الحالة', 'Status')}</th>
                    <th className="py-3.5 px-4 text-center">{t('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSalesItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-slate-500">{t('لا توجد أصناف بيعية مطابقة', 'No sales items found')}</p>
                        <p className="text-xs text-slate-400 mt-1">{t('يمكنك إضافة صنف أو خدمة جديدة أعلاه', 'Add a new service or product above')}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSalesItems.map((prod) => {
                      const costData = getCalculatedCostOfSale(prod);
                      const unitCost = costData.totalCost;
                      const profitAmount = prod.sellingPrice - unitCost;
                      const profitPercent = prod.sellingPrice > 0 ? (profitAmount / prod.sellingPrice) * 100 : 0;
                      const isService = prod.isService || prod.itemType === 'sales_service';

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isService ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {isService ? <Stethoscope className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-800">{prod.nameAr}</h4>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <span>{prod.nameEn}</span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-500">{prod.sku}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  isService
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}
                              >
                                {isService ? t('خدمة طبية / جلسة', 'Service') : t('منتج تجاري بيعي', 'Product')}
                              </span>
                              <p className="text-xs text-slate-500">{prod.category}</p>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
                              {prod.unit || (isService ? 'جلسة' : 'قطعة')}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-base text-emerald-700">
                              {formatMoney(prod.sellingPrice)}
                            </div>
                            {prod.taxRate ? (
                              <span className="text-[11px] text-slate-400">
                                + {prod.taxRate}% {t('ضريبة', 'VAT')}
                              </span>
                            ) : null}
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-xs font-medium text-slate-600">
                              {formatMoney(prod.minSellingPrice || prod.sellingPrice)}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">{formatMoney(unitCost)}</span>
                              {costData.isCalculatedFromStock && (
                                <button
                                  onClick={() => setCostBreakdownProduct(prod)}
                                  title={t('عرض تفاصيل خامات ومكونات التكلفة', 'View BOM Cost breakdown')}
                                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block">
                              {costData.isCalculatedFromStock
                                ? t('محسوبة من خامات المخزن', 'From stock BOM')
                                : t('تكلفة شراء مباشرة', 'Direct cost')}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 font-bold text-xs text-indigo-700">
                                <span>{formatMoney(profitAmount)}</span>
                                <span className="text-[11px] font-normal text-slate-500">
                                  ({profitPercent.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    profitPercent >= 60
                                      ? 'bg-emerald-500'
                                      : profitPercent >= 30
                                      ? 'bg-indigo-500'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, profitPercent))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleActive(prod)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 transition ${
                                prod.isActive !== false
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  prod.isActive !== false ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              />
                              <span>{prod.isActive !== false ? t('مفعل', 'Active') : t('معطل', 'Inactive')}</span>
                            </button>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(prod)}
                                title={t('تعديل وتسعير', 'Edit & Price')}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(prod)}
                                title={t('حذف', 'Delete')}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Categories & Groups Management */}
        {activeTab === 'categories' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {t('المجموعات والتصنيفات البيعية', 'Sales Categories & Item Groups')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    'تصنيف الخدمات والمنتجات البيعية لتسهيل اختيارها في الفواتير والتقارير المالية',
                    'Group services and products for fast billing and sales analytics'
                  )}
                </p>
              </div>

              <button
                onClick={handleOpenAddCategory}
                className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t('إضافة مجموعة جديدة', 'Add New Group')}</span>
              </button>
            </div>

            {/* Categories Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => {
                const categoryItems = salesItems.filter(
                  (p) => p.categoryId === cat.id || p.category === cat.nameAr
                );
                const srvCount = categoryItems.filter((p) => p.isService || p.itemType === 'sales_service').length;
                const prdCount = categoryItems.filter((p) => !p.isService && p.itemType !== 'sales_service').length;

                return (
                  <div
                    key={cat.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                          style={{ backgroundColor: cat.color || '#4f46e5' }}
                        >
                          {cat.nameAr.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-base">{cat.nameAr}</h4>
                          <p className="text-xs text-slate-400">{cat.nameEn || 'Sales Group'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                      {cat.description || t('لا يوجد وصف تفصيلي للمجموعة البيعية', 'No description provided')}
                    </p>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold">
                        {categoryItems.length} {t('أصناف تابعة', 'items')}
                      </span>
                      <span className="text-slate-400">
                        {srvCount} {t('خدمات', 'services')} • {prdCount} {t('منتجات', 'products')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add/Edit Sales Item & Pricing */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  {form.isService ? <Stethoscope className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    {showAddModal
                      ? t('إضافة صنف بيعي جديد وتسعيره', 'Add New Sales Item & Pricing')
                      : t('تعديل الصنف البيعي والتسعير', 'Edit Sales Item & Pricing')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('تحديد بيانات البيع، الأسعار وهوامش الربح للجمهور', 'Configure sales data, customer pricing, and margins')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleSaveAdd : handleSaveEdit} className="p-6 space-y-5">
              {/* Type Switcher */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">{t('طبيعة الصنف البيعي:', 'Item Nature:')}</span>
                <div className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        isService: true,
                        itemType: 'sales_service',
                        unit: 'جلسة',
                        taxRate: 0,
                      });
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      form.isService
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>{t('خدمة طبية / جلسة / كشف', 'Medical Service / Session')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        isService: false,
                        itemType: 'sales_product',
                        unit: 'قطعة',
                        taxRate: 14,
                      });
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      !form.isService
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>{t('منتج تجاري للبيع', 'Retail Product')}</span>
                  </button>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('اسم الصنف البيعي (بالعربي) *', 'Item Name (Arabic) *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={form.isService ? 'مثال: جلسة ليزر كانديلا فل بدي' : 'مثال: سيروم كولاجين منزلي'}
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('الاسم بالإنجليزي (اختياري)', 'Item Name (English)')}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Full Body Candela Laser"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Category, SKU, Barcode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('المجموعة البيعية *', 'Category *')}
                  </label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value);
                      setForm({
                        ...form,
                        categoryId: e.target.value,
                        category: cat?.nameAr || form.category,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t('-- اختر المجموعة --', '-- Select Category --')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('كود الصنف (SKU) *', 'SKU Code *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('وحدة البيع (يدوياً) *', 'Sales Unit (Manual) *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="جلسة، كشف، عبوة، قطعة، باقة..."
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Pricing & Margins Section */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <DollarSign className="w-4 h-4" />
                  <span>{t('التسعير وسياسة البيع للجمهور', 'Pricing & Profit Margins')}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('سعر البيع للجمهور (ج.م) *', 'Selling Price (EGP) *')}
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={form.sellingPrice}
                      onChange={(e) => setForm({ ...form, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-base font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('الحد الأدنى للبيع (في العروض) *', 'Min Selling Price (Discount floor) *')}
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={form.minSellingPrice}
                      onChange={(e) => setForm({ ...form, minSellingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('نسبة الضريبة المضافة (%)', 'VAT Rate (%)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={form.taxRate}
                      onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <span>
                    {t(
                      'هامش الربح وتكلفة البيع:',
                      'Margin notice:'
                    )}{' '}
                    {t(
                      'يتم حساب تكلفة البيع آلياً من الخامات والمستهلكات المربوطة بهذا الصنف من شاشة إدارة المخازن.',
                      'Actual unit cost is calculated from raw consumables linked in Warehouse Management.'
                    )}
                  </span>
                  <span className="font-bold text-emerald-700">
                    {formatMoney(form.sellingPrice)}
                  </span>
                </div>
              </div>

              {/* Barcode & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('رقم الباركود (Barcode)', 'Barcode')}
                  </label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                    dir="ltr"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {t('حالة التفعيل للبيع', 'Active Status')}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {form.isActive ? t('متاح للبيع في نقاط البيع والاستقبال', 'Available for billing') : t('معطل وموقوف مؤقتاً', 'Disabled for billing')}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('وصف وتفاصيل الصنف البيعي (اختياري)', 'Description & Notes')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('ملاحظات عن مدة الجلسة، تعليمات العميل، الخ...', 'Session duration, patient advice...')}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-xl transition"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  {showAddModal ? t('حفظ وإضافة الصنف البيعي', 'Save Sales Item') : t('حفظ التعديلات والتسعير', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Category */}
      {(showAddCategoryModal || showEditCategoryModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {showAddCategoryModal
                      ? t('إضافة مجموعة بيعية جديدة', 'Add New Sales Category')
                      : t('تعديل المجموعة البيعية', 'Edit Sales Category')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('تصنيف وتنظيم أصناف المبيعات والخدمات', 'Organize services and product catalog')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddCategoryModal(false);
                  setShowEditCategoryModal(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showAddCategoryModal ? handleSaveCategoryAdd : handleSaveCategoryEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('اسم المجموعة (بالعربي) *', 'Category Name (Arabic) *')}
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: جلسات الليزر، عيادة الجلدية، مستحضرات العناية..."
                  value={categoryForm.nameAr}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('الاسم بالإنجليزي (اختياري)', 'Category Name (English)')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Laser Treatments"
                  value={categoryForm.nameEn}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameEn: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('نوع المجموعة البيعية *', 'Category Type *')}
                </label>
                <select
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="service">{t('خدمات طبية وجلسات فقط', 'Medical Services Only')}</option>
                  <option value="product">{t('منتجات تجارية ومستلزمات للبيع', 'Retail Products Only')}</option>
                  <option value="both">{t('مشترك (خدمات ومنتجات بيعية)', 'Both (Services & Products)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('لون تمييز المجموعة', 'Category Color')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={categoryForm.color || '#4f46e5'}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="w-10 h-10 rounded-xl border-0 p-1 cursor-pointer"
                  />
                  <span className="text-xs text-slate-500 font-mono">{categoryForm.color}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('وصف المجموعة البيعية (اختياري)', 'Description')}
                </label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setShowEditCategoryModal(false);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-xl transition"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  {t('حفظ المجموعة', 'Save Group')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cost of Sale Breakdown Inspector */}
      {costBreakdownProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {t('تفصيل تكلفة البيع (COGS Breakdown)', 'Cost of Sale Breakdown')}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">{costBreakdownProduct.nameAr}</p>
                </div>
              </div>
              <button
                onClick={() => setCostBreakdownProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-700 font-medium block">
                    {t('إجمالي التكلفة المخزنية المحسوبة للوحدة:', 'Total Computed Unit Cost:')}
                  </span>
                  <span className="text-2xl font-bold text-indigo-900">
                    {formatMoney(getCalculatedCostOfSale(costBreakdownProduct).totalCost)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">{t('سعر البيع للجمهور:', 'Selling Price:')}</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {formatMoney(costBreakdownProduct.sellingPrice)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">{t('الخامات والمستهلكات المربوطة من المخزن:', 'Linked Stock Raw Materials:')}</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {getCalculatedCostOfSale(costBreakdownProduct).contributingItems.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs bg-white">
                      <div>
                        <span className="font-semibold text-slate-800 block">{item.item.nameAr}</span>
                        <span className="text-slate-400">
                          {item.qty} {item.item.unit} × {formatMoney(item.item.purchasePrice)}
                        </span>
                      </div>
                      <span className="font-bold text-slate-800">{formatMoney(item.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t(
                  '* يمكن تعديل أو إضافة روابط الخامات ومعدلات الاستهلاك في أي وقت من شاشة "إدارة المخازن والجرد".',
                  '* You can adjust or add raw material consumption links at any time in the Warehouse Management screen.'
                )}
              </p>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setCostBreakdownProduct(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  {t('إغلاق', 'Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
