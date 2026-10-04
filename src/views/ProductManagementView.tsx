import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Product, ItemCategory } from '../types';
import { PackageDashboardWidget } from '../components/PackageDashboardWidget';
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
  AlertTriangle,
  HelpCircle,
  Filter,
  Users,
  Calendar,
  Award,
  Zap,
  BookOpen,
  Receipt,
} from 'lucide-react';

export const ProductManagementView: React.FC = () => {
  const {
    t,
    formatMoney,
    tenant,
    products,
    categories,
    parties,
    addClientOffer,
    addCategory,
    updateCategory,
    deleteCategory,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductStock,
    language,
    accounts,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'sales_items' | 'categories'>('sales_items');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'products' | 'services' | 'packages'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);

  // Delete confirmation modals
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ItemCategory | null>(null);

  // Quick reorder level adjustment modal
  const [editingReorderProduct, setEditingReorderProduct] = useState<{
    id: string;
    nameAr: string;
    currentLevel: number;
    stock: number;
    unit?: string;
  } | null>(null);
  const [newReorderValue, setNewReorderValue] = useState<number>(5);

  // Low stock table filter
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);

  // Toast notification feedback
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Quick Client Package Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignPackageProduct, setAssignPackageProduct] = useState<Product | null>(null);
  const [assignForm, setAssignForm] = useState<{
    customerId: string;
    totalSessions: number;
    totalPrice: number;
    validityDays: number;
    customExpiryDate: string;
    notes: string;
  }>({
    customerId: '',
    totalSessions: 6,
    totalPrice: 2000,
    validityDays: 180,
    customExpiryDate: '',
    notes: '',
  });

  // Modal to inspect cost breakdown from linked stock raw materials
  const [costBreakdownProduct, setCostBreakdownProduct] = useState<Product | null>(null);

  // Form for Sales Product / Service / Package
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
    minStockLevel: number;
    unit: string;
    isService: boolean;
    itemType: 'sales_product' | 'sales_service' | 'sales_package';
    isPackage: boolean;
    totalSessions: number;
    validityDays: number;
    linkedServiceId: string;
    linkedServiceNameAr: string;
    isActive: boolean;
    notes: string;
    itemCodingType: 'EGS' | 'GS1';
    egsCode: string;
    gs1Code: string;
    salesAccountId: string;
    salesAccountNameAr: string;
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
    minStockLevel: 5,
    unit: 'جلسة',
    isService: true,
    itemType: 'sales_service',
    isPackage: false,
    totalSessions: 6,
    validityDays: 180,
    linkedServiceId: '',
    linkedServiceNameAr: '',
    isActive: true,
    notes: '',
    itemCodingType: 'EGS',
    egsCode: '',
    gs1Code: '',
    salesAccountId: 'acc-4200',
    salesAccountNameAr: 'إيرادات الكشوفات والخدمات والعيادات',
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

  // Count of items approaching out of stock or depleted
  const lowStockAlertItemsCount = useMemo(() => {
    return salesItems.filter((p) => {
      if (p.isService || p.isPackage || p.itemType === 'sales_service') return false;
      const stock = getProductStock(p.id);
      const reorder = p.minStockLevel !== undefined ? p.minStockLevel : 5;
      return stock <= reorder;
    }).length;
  }, [salesItems, getProductStock]);

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
        matchesType = !p.isService && !p.isPackage && p.itemType === 'sales_product';
      } else if (typeFilter === 'services') {
        matchesType = (p.isService || p.itemType === 'sales_service') && !p.isPackage;
      } else if (typeFilter === 'packages') {
        matchesType = !!p.isPackage || p.itemType === 'sales_package';
      }

      let matchesLowStock = true;
      if (onlyLowStock) {
        if (p.isService || p.isPackage || p.itemType === 'sales_service') {
          matchesLowStock = false;
        } else {
          const stock = getProductStock(p.id);
          const reorder = p.minStockLevel !== undefined ? p.minStockLevel : 5;
          matchesLowStock = stock <= reorder;
        }
      }

      return matchesSearch && matchesCat && matchesType && matchesLowStock;
    });
  }, [salesItems, searchQuery, selectedCategoryFilter, typeFilter, onlyLowStock, getProductStock]);

  // Stats
  const totalSalesItemsCount = salesItems.length;
  const servicesCount = salesItems.filter((p) => (p.isService || p.itemType === 'sales_service') && !p.isPackage).length;
  const packagesCount = salesItems.filter((p) => p.isPackage || p.itemType === 'sales_package').length;
  const commercialProductsCount = salesItems.filter((p) => !p.isService && !p.isPackage && p.itemType !== 'sales_service').length;
  const avgSellingPrice =
    salesItems.length > 0
      ? salesItems.reduce((sum, p) => sum + p.sellingPrice, 0) / salesItems.length
      : 0;

  // Handlers
  const handleOpenAdd = (type: 'sales_service' | 'sales_product' | 'sales_package' = 'sales_service') => {
    const isPkg = type === 'sales_package';
    const isSrv = type === 'sales_service';
    const nextSku = isPkg
      ? `PKG-${(packagesCount + 1).toString().padStart(3, '0')}`
      : isSrv
      ? `SRV-${(servicesCount + 1).toString().padStart(3, '0')}`
      : `PRD-${(commercialProductsCount + 1).toString().padStart(3, '0')}`;

    const defaultCat = isPkg
      ? categories.find((c) => c.nameAr.includes('باقات') || c.id === 'cat-006') || categories[0]
      : categories.find((c) => (isSrv ? c.type === 'service' : c.type === 'product')) || categories[0];

    const defaultSalesAcc = (type === 'sales_product')
      ? (accounts.find((a) => a.code === '4100') || accounts.find((a) => a.type === 'Revenue') || accounts[0])
      : (accounts.find((a) => a.code === '4200') || accounts.find((a) => a.type === 'Revenue') || accounts[0]);

    setForm({
      nameAr: '',
      nameEn: '',
      sku: nextSku,
      barcode: `622${Date.now().toString().slice(-8)}`,
      category: defaultCat?.nameAr || (isPkg ? 'باقات وعروض الجلسات' : 'خدمات طبية وكشوفات'),
      categoryId: defaultCat?.id || '',
      sellingPrice: isPkg ? 2400 : isSrv ? 400 : 250,
      minSellingPrice: isPkg ? 2100 : isSrv ? 350 : 200,
      purchasePrice: 0,
      taxRate: isPkg ? 0 : isSrv ? 0 : 14,
      minStockLevel: isSrv || isPkg ? 0 : 5,
      unit: isPkg ? 'باقة' : isSrv ? 'جلسة' : 'قطعة',
      isService: isSrv || isPkg,
      itemType: type,
      isPackage: isPkg,
      totalSessions: 6,
      validityDays: 180,
      linkedServiceId: '',
      linkedServiceNameAr: '',
      isActive: true,
      notes: '',
      itemCodingType: 'EGS',
      egsCode: `EG-100234567-${nextSku}`,
      gs1Code: '',
      defaultCollectionOnly: false,
      salesAccountId: defaultSalesAcc?.id || 'acc-4200',
      salesAccountNameAr: defaultSalesAcc?.nameAr || 'إيرادات المبيعات والخدمات',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setSelectedProduct(prod);
    const isPkg = !!prod.isPackage || prod.itemType === 'sales_package';
    const isSrv = prod.isService || prod.itemType === 'sales_service';
    const fallbackAcc = (isPkg || isSrv)
      ? (accounts.find((a) => a.code === '4200') || accounts.find((a) => a.type === 'Revenue'))
      : (accounts.find((a) => a.code === '4100') || accounts.find((a) => a.type === 'Revenue'));
    const linkedAcc = accounts.find((a) => a.id === prod.salesAccountId) || fallbackAcc;

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
      minStockLevel: prod.minStockLevel !== undefined ? prod.minStockLevel : 5,
      unit: prod.unit || (isPkg ? 'باقة' : 'جلسة'),
      isService: isPkg ? true : !!prod.isService,
      itemType: isPkg ? 'sales_package' : (prod.isService || prod.itemType === 'sales_service') ? 'sales_service' : 'sales_product',
      isPackage: isPkg,
      totalSessions: prod.totalSessions || 6,
      validityDays: prod.validityDays || 180,
      linkedServiceId: prod.linkedServiceId || '',
      linkedServiceNameAr: prod.linkedServiceNameAr || '',
      isActive: prod.isActive !== false,
      notes: prod.notes || '',
      itemCodingType: prod.itemCodingType || 'EGS',
      egsCode: prod.egsCode || (prod.sku ? `EG-100234567-${prod.sku}` : ''),
      gs1Code: prod.gs1Code || '',
      defaultCollectionOnly: Boolean(prod.defaultCollectionOnly),
      salesAccountId: prod.salesAccountId || linkedAcc?.id || 'acc-4200',
      salesAccountNameAr: prod.salesAccountNameAr || linkedAcc?.nameAr || 'إيرادات المبيعات والخدمات',
    });
    setShowEditModal(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim()) return;

    const matchedCat = categories.find((c) => c.id === form.categoryId);
    const chosenAcc = accounts.find((a) => a.id === form.salesAccountId);

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
        minStockLevel: Number(form.minStockLevel) || 0,
        unit: form.unit.trim() || (form.isPackage ? 'باقة' : form.isService ? 'جلسة' : 'قطعة'),
        isService: form.isPackage ? true : form.isService,
        itemType: form.itemType,
        isPackage: form.isPackage,
        totalSessions: form.isPackage ? (Number(form.totalSessions) || 1) : undefined,
        validityDays: form.isPackage ? (Number(form.validityDays) || 180) : undefined,
        linkedServiceId: form.linkedServiceId || undefined,
        linkedServiceNameAr: form.linkedServiceNameAr || undefined,
        isSalesItem: true,
        isStockItem: false,
        isActive: form.isActive,
        defaultCollectionOnly: Boolean(form.defaultCollectionOnly),
        notes: form.notes,
        itemCodingType: form.itemCodingType,
        egsCode: form.egsCode,
        gs1Code: form.gs1Code,
        salesAccountId: form.salesAccountId || chosenAcc?.id || undefined,
        salesAccountNameAr: chosenAcc?.nameAr || form.salesAccountNameAr || undefined,
      },
      0
    );

    setShowAddModal(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !form.nameAr.trim()) return;

    const matchedCat = categories.find((c) => c.id === form.categoryId);
    const chosenAcc = accounts.find((a) => a.id === form.salesAccountId);

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
      minStockLevel: Number(form.minStockLevel) || 0,
      unit: form.unit.trim() || (form.isPackage ? 'باقة' : 'جلسة'),
      isService: form.isPackage ? true : form.isService,
      itemType: form.itemType,
      isPackage: form.isPackage,
      totalSessions: form.isPackage ? (Number(form.totalSessions) || 1) : undefined,
      validityDays: form.isPackage ? (Number(form.validityDays) || 180) : undefined,
      linkedServiceId: form.linkedServiceId || undefined,
      linkedServiceNameAr: form.linkedServiceNameAr || undefined,
      isSalesItem: true,
      isStockItem: false,
      isActive: form.isActive,
      defaultCollectionOnly: Boolean(form.defaultCollectionOnly),
      notes: form.notes,
      itemCodingType: form.itemCodingType,
      egsCode: form.egsCode,
      gs1Code: form.gs1Code,
      salesAccountId: form.salesAccountId || chosenAcc?.id || undefined,
      salesAccountNameAr: chosenAcc?.nameAr || form.salesAccountNameAr || undefined,
    });

    setShowEditModal(false);
    setSelectedProduct(null);
  };

  // Open Direct Client Assignment Modal for a Package
  const handleOpenAssignModal = (prod: Product) => {
    setAssignPackageProduct(prod);
    const sessions = prod.totalSessions || 6;
    const price = prod.sellingPrice || 2000;
    const days = prod.validityDays || 180;
    const defaultExpiry = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    const firstClient = parties.find((p) => p.type === 'Customer' || p.type === 'Both');

    setAssignForm({
      customerId: firstClient ? firstClient.id : '',
      totalSessions: sessions,
      totalPrice: price,
      validityDays: days,
      customExpiryDate: defaultExpiry,
      notes: `تم الإسناد المباشر من شاشة إدارة المنتجات والخدمات (باقة: ${prod.nameAr})`,
    });
    setShowAssignModal(true);
  };

  const handleSaveAssignOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.customerId || !assignPackageProduct) {
      alert(t('يرجى اختيار العميل أولاً!', 'Please select a customer first!'));
      return;
    }

    addClientOffer(assignForm.customerId, {
      packageProductId: assignPackageProduct.id,
      offerNameAr: assignPackageProduct.nameAr,
      offerNameEn: assignPackageProduct.nameEn || assignPackageProduct.nameAr,
      totalQuantity: Number(assignForm.totalSessions) || 1,
      consumedQuantity: 0,
      remainingQuantity: Number(assignForm.totalSessions) || 1,
      totalPrice: Number(assignForm.totalPrice) || 0,
      expiryDate: assignForm.customExpiryDate || new Date(Date.now() + (assignForm.validityDays || 180) * 86400000).toISOString().split('T')[0],
      serviceType: 'Laser & Aesthetic Sessions',
      notes: assignForm.notes,
    });

    const clientObj = parties.find((p) => p.id === assignForm.customerId);
    alert(t(
      `تم إسناد الباقة بنجاح للعميل (${clientObj?.name || ''}) برصيد ${assignForm.totalSessions} جلسات!`,
      `Package successfully assigned to (${clientObj?.name || ''}) with ${assignForm.totalSessions} sessions!`
    ));

    setShowAssignModal(false);
    setAssignPackageProduct(null);
  };

  const handleDelete = (prod: Product) => {
    setProductToDelete(prod);
  };

  const confirmDeleteProduct = () => {
    if (!productToDelete) return;
    const name = productToDelete.nameAr;
    deleteProduct(productToDelete.id);
    setProductToDelete(null);
    setToastNotification({
      message: t(
        `تم حذف الصنف البيعي (${name}) بنجاح وإلغاؤه من قائمة المبيعات وسجل المخزون.`,
        `Sales item (${name}) deleted successfully.`
      ),
      type: 'success',
    });
    setTimeout(() => setToastNotification(null), 4500);
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
    setCategoryToDelete(cat);
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const name = categoryToDelete.nameAr;
    const res = deleteCategory(categoryToDelete.id);
    setCategoryToDelete(null);
    if (res.success) {
      setToastNotification({
        message: t(`تم حذف المجموعة البيعية (${name}) بنجاح.`, `Category (${name}) deleted successfully.`),
        type: 'success',
      });
    } else {
      setToastNotification({
        message: res.message || t('تعذر حذف المجموعة لأنها تحتوي على أصناف بيعية مربوطة بها', 'Cannot delete category with linked items'),
        type: 'error',
      });
    }
    setTimeout(() => setToastNotification(null), 4500);
  };

  const handleSaveReorderAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReorderProduct) return;
    const newLvl = Math.max(0, Number(newReorderValue));
    updateProduct(editingReorderProduct.id, { minStockLevel: newLvl });
    const name = editingReorderProduct.nameAr;
    setEditingReorderProduct(null);
    setToastNotification({
      message: t(
        `تم تحديث وضبط حد الطلب للصنف (${name}) إلى ${newLvl} وحدة بنجاح.`,
        `Reorder point for (${name}) updated to ${newLvl} units.`
      ),
      type: 'success',
    });
    setTimeout(() => setToastNotification(null), 4500);
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
            id="btn-add-sales-package"
            onClick={() => handleOpenAdd('sales_package')}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('إضافة باقة جلسات وعروض', 'Add Session Package')}</span>
          </button>

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
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>{t('مجموعة جديدة', 'New Group')}</span>
          </button>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastNotification && (
        <div
          className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-xs font-bold transition-all shadow-xs ${
            toastNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : toastNotification.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-indigo-50 border-indigo-300 text-indigo-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : toastNotification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-indigo-600 shrink-0" />
            )}
            <p className="leading-snug">{toastNotification.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="p-1 rounded-lg hover:bg-black/5 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('إجمالي الأصناف البيعية', 'Total Sales Items')}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalSalesItemsCount}</h3>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">
              {commercialProductsCount} {t('منتج', 'prod')} + {servicesCount} {t('خدمة', 'srv')} + {packagesCount} {t('باقة', 'pkg')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('باقات وعروض الجلسات', 'Session Packages')}</p>
            <h3 className="text-2xl font-bold text-purple-600 mt-1">{packagesCount}</h3>
            <span className="text-xs text-purple-500 mt-0.5 inline-block">{t('باقات بيعية قابلة للإسناد للعملاء', 'Assignable client packages')}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
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
      </div>

      {/* Package Performance & Completion Rate Dashboard Widget */}
      <PackageDashboardWidget
        onAssignPackage={(pkg) => handleOpenAssignModal(pkg)}
        onFilterByPackage={(pkg) => {
          setActiveTab('sales_items');
          setTypeFilter('packages');
          setSearchQuery(pkg.nameAr);
        }}
      />

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
                    onClick={() => setTypeFilter('packages')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                      typeFilter === 'packages' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('باقات الجلسات', 'Packages')}</span>
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
                    <th className="py-3.5 px-4 text-center">{t('المخزون وحد الطلب', 'Stock & Reorder')}</th>
                    <th className="py-3.5 px-4 text-center">{t('الحالة', 'Status')}</th>
                    <th className="py-3.5 px-4 text-center">{t('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSalesItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
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
                      const isPkg = !!prod.isPackage || prod.itemType === 'sales_package';
                      const isService = (prod.isService || prod.itemType === 'sales_service') && !isPkg;

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isPkg
                                    ? 'bg-purple-50 text-purple-600 border border-purple-100'
                                    : isService
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {isPkg ? <Sparkles className="w-4 h-4" /> : isService ? <Stethoscope className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="font-semibold text-slate-800">{prod.nameAr}</h4>
                                  {isPkg && (
                                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                                      {prod.totalSessions ? `${prod.totalSessions} جلسات` : t('باقة', 'Package')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <span>{prod.nameEn}</span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-500">{prod.sku}</span>
                                  {(prod.egsCode || prod.gs1Code) && (
                                    <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 font-bold">
                                      {prod.egsCode ? `EGS: ${prod.egsCode}` : `GS1: ${prod.gs1Code}`}
                                    </span>
                                  )}
                                  {isPkg && prod.validityDays && (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                                      صلاحية: {prod.validityDays} يوم
                                    </span>
                                  )}
                                </div>
                                {/* حساب المبيعات المرتبط بشجرة الحسابات */}
                                {(() => {
                                  const linkedAcc = accounts.find((a) => a.id === prod.salesAccountId) ||
                                    (isPkg || isService
                                      ? accounts.find((a) => a.code === '4200')
                                      : accounts.find((a) => a.code === '4100'));
                                  return (
                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-200/60 w-fit">
                                      <BookOpen className="w-3 h-3 text-blue-600 shrink-0" />
                                      <span className="font-semibold">
                                        {t('حساب المبيعات:', 'Sales Account:')} {linkedAcc ? `${linkedAcc.code} - ${linkedAcc.nameAr}` : (prod.salesAccountNameAr || 'إيرادات المبيعات')}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  isPkg
                                    ? 'bg-purple-50 text-purple-700 border border-purple-100 font-bold'
                                    : isService
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}
                              >
                                {isPkg ? t('باقة جلسات وعروض', 'Session Package') : isService ? t('خدمة طبية / جلسة', 'Service') : t('منتج تجاري بيعي', 'Product')}
                              </span>
                              <p className="text-xs text-slate-500">{prod.category}</p>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
                              {prod.unit || (isPkg ? 'باقة' : isService ? 'جلسة' : 'قطعة')}
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
                            {isService || isPkg ? (
                              <span className="text-[11px] text-slate-400">
                                {isPkg ? t('باقة جلسات', 'Package') : t('خدمة طبية', 'Service')}
                              </span>
                            ) : (
                              <div>
                                {(() => {
                                  const stock = getProductStock(prod.id);
                                  const reorder = prod.minStockLevel !== undefined ? prod.minStockLevel : 5;
                                  const isOut = stock <= 0;
                                  const isLow = stock > 0 && stock <= reorder;

                                  return (
                                    <div className="inline-flex flex-col items-center">
                                      <div className="flex items-center gap-1 font-mono text-xs">
                                        <span
                                          className={`font-black ${
                                            isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-emerald-700'
                                          }`}
                                        >
                                          {stock}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingReorderProduct({
                                              id: prod.id,
                                              nameAr: prod.nameAr,
                                              currentLevel: reorder,
                                              stock,
                                              unit: prod.unit,
                                            });
                                            setNewReorderValue(reorder);
                                          }}
                                          className="text-slate-400 hover:text-indigo-600 transition flex items-center gap-0.5 text-[10px] hover:underline cursor-pointer group"
                                          title={t('اضغط لتعديل وضبط حد الطلب لهذا الصنف', 'Click to adjust reorder point')}
                                        >
                                          <span>/ حد {reorder}</span>
                                          <Sliders className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                                        </button>
                                      </div>
                                      {isOut ? (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                          <AlertCircle className="w-2.5 h-2.5" />
                                          <span>نفذ</span>
                                        </span>
                                      ) : isLow ? (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                          <AlertTriangle className="w-2.5 h-2.5" />
                                          <span>قارب النفاذ</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                          <span>متوفر</span>
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingReorderProduct({
                                            id: prod.id,
                                            nameAr: prod.nameAr,
                                            currentLevel: reorder,
                                            stock,
                                            unit: prod.unit,
                                          });
                                          setNewReorderValue(reorder);
                                        }}
                                        className="text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold mt-0.5 hover:underline cursor-pointer"
                                      >
                                        {t('ضبط حد الطلب', 'Set Reorder')}
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
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
                              {isPkg && (
                                <button
                                  onClick={() => handleOpenAssignModal(prod)}
                                  title={t('إسناد هذه الباقة لعميل', 'Assign Package to Client')}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold border border-purple-200 transition"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{t('إسناد لعميل', 'Assign')}</span>
                                </button>
                              )}
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
                <div className={`p-2 rounded-xl ${
                  form.isPackage
                    ? 'bg-purple-50 text-purple-600'
                    : form.isService
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {form.isPackage ? (
                    <Sparkles className="w-5 h-5" />
                  ) : form.isService ? (
                    <Stethoscope className="w-5 h-5" />
                  ) : (
                    <Package className="w-5 h-5" />
                  )}
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
                        isPackage: true,
                        isService: true,
                        itemType: 'sales_package',
                        unit: 'باقة',
                        taxRate: 0,
                        totalSessions: form.totalSessions || 6,
                        validityDays: form.validityDays || 90,
                      });
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      form.isPackage
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{t('باقة جلسات وعروض', 'Session Package')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        isPackage: false,
                        isService: true,
                        itemType: 'sales_service',
                        unit: 'جلسة',
                        taxRate: 0,
                      });
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      form.isService && !form.isPackage
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>{t('خدمة طبية / جلسة فردية', 'Medical Service / Session')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        isPackage: false,
                        isService: false,
                        itemType: 'sales_product',
                        unit: 'قطعة',
                        taxRate: 14,
                      });
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      !form.isService && !form.isPackage
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>{t('منتج تجاري للبيع', 'Retail Product')}</span>
                  </button>
                </div>
              </div>

              {/* Package Configuration Panel (Shows when isPackage is true) */}
              {form.isPackage && (
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>{t('إعدادات باقة الجلسات البيعية والصلاحية', 'Package Sessions & Validity Settings')}</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-800 text-[10px] font-bold">
                      {t('صنف بيعي قابل للإسناد والبيع بالـ POS', 'POS Sellable & Client Assignable')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-purple-950 mb-1">
                        {t('عدد الجلسات الإجمالي في الباقة *', 'Total Sessions *')}
                      </label>
                      <input
                        type="number"
                        required={form.isPackage}
                        min={1}
                        value={form.totalSessions || 1}
                        onChange={(e) => setForm({ ...form, totalSessions: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-purple-950 mb-1">
                        {t('فترة الصلاحية (بالأيام) *', 'Validity Period (Days) *')}
                      </label>
                      <input
                        type="number"
                        required={form.isPackage}
                        min={1}
                        value={form.validityDays || 90}
                        onChange={(e) => setForm({ ...form, validityDays: parseInt(e.target.value) || 30 })}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-semibold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-purple-950 mb-1">
                        {t('الخدمة الطبية المربوطة (اختياري)', 'Linked Medical Service')}
                      </label>
                      <select
                        value={form.linkedServiceId || ''}
                        onChange={(e) => {
                          const srv = products.find((p) => p.id === e.target.value);
                          setForm({
                            ...form,
                            linkedServiceId: e.target.value,
                            linkedServiceNameAr: srv?.nameAr || '',
                          });
                        }}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">{t('-- جلسات عامة أو متعددة --', '-- General / Multiple --')}</option>
                        {products
                          .filter((p) => (p.isService || p.itemType === 'sales_service') && !p.isPackage)
                          .map((srv) => (
                            <option key={srv.id} value={srv.id}>
                              {srv.nameAr} ({formatMoney(srv.sellingPrice)})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-purple-700">
                    💡 {t('عند بيع هذا الصنف في نقطة البيع (POS) أو إسناده للعميل مباشرة، سيتم إنشاء باقة مفعلة في ملف العميل تلقائياً بعدد الجلسات وتاريخ الانتهاء المحسوب.', 'Purchasing this item via POS or assigning it directly automatically creates an active package in the client profile.')}
                  </p>
                </div>
              )}

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

              {/* ETA Egyptian Tax Authority e-Invoice Coding (مصلحة الضرائب المصرية) */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>{t('الترميز الضريبي لمنظومة الفاتورة والإيصال الإلكتروني (ETA)', 'ETA e-Invoice Coding')}</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                    مصلحة الضرائب المصرية
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('نوع كود المنظومة', 'Coding Standard')}
                    </label>
                    <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="itemCodingType"
                          value="EGS"
                          checked={form.itemCodingType === 'EGS'}
                          onChange={() => setForm({ ...form, itemCodingType: 'EGS' })}
                        />
                        <span>EGS (الترميز المصري الموحد)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="itemCodingType"
                          value="GS1"
                          checked={form.itemCodingType === 'GS1'}
                          onChange={() => setForm({ ...form, itemCodingType: 'GS1' })}
                        />
                        <span>GS1 (الباركود الدولي)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {form.itemCodingType === 'EGS'
                        ? t('كود الصنف الضريبي EGS Code *', 'EGS Item Code *')
                        : t('كود الباركود الدولي GS1 Code *', 'GS1 GTIN Code *')}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder={form.itemCodingType === 'EGS' ? 'EG-100234567-SRV01' : '6221234567890'}
                      value={form.itemCodingType === 'EGS' ? form.egsCode : form.gs1Code}
                      onChange={(e) => {
                        if (form.itemCodingType === 'EGS') {
                          setForm({ ...form, egsCode: e.target.value });
                        } else {
                          setForm({ ...form, gs1Code: e.target.value });
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  * هذا الكود يُرسل تلقائياً في ملف JSON لمنظومة مصلحة الضرائب المصرية لتسجيل الفواتير والإيصالات الإلكترونية المعتمدة.
                </p>
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

              {/* الربط المحاسبي بشجرة الحسابات (حساب إيرادات المبيعات) */}
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-bold text-xs sm:text-sm">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>{t('الربط المحاسبي بشجرة الحسابات (حساب المبيعات / الإيرادات) *', 'Chart of Accounts Linking (Sales Revenue Account) *')}</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/60 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    {t('شجرة الحسابات التفاعلية', 'Chart of Accounts')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('حساب المبيعات / الإيرادات المعتمد *', 'Linked Sales / Revenue Account *')}
                    </label>
                    <select
                      required
                      value={form.salesAccountId}
                      onChange={(e) => {
                        const chosen = accounts.find((a) => a.id === e.target.value);
                        setForm({
                          ...form,
                          salesAccountId: e.target.value,
                          salesAccountNameAr: chosen?.nameAr || form.salesAccountNameAr,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                    >
                      <optgroup label={t('حسابات الإيرادات والمبيعات (موصى به)', 'Revenue & Sales Accounts (Recommended)')}>
                        {accounts
                          .filter((a) => a.type === 'Revenue')
                          .map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.nameAr}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label={t('حسابات أخرى في الدليل المحاسبي', 'Other Accounts in Ledger')}>
                        {accounts
                          .filter((a) => a.type !== 'Revenue')
                          .map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.nameAr} ({acc.type})
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="text-xs text-blue-800 dark:text-blue-300 bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 leading-relaxed">
                    <p className="font-semibold mb-0.5">📌 {t('توجيه القيود المحاسبية التلقائية:', 'Automated Ledger Posting:')}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {t(
                        'عند بيع هذا الصنف في نقطة البيع أو تسجيل جلسة في شاشة التشغيل، يُسجل القيد المحاسبي دائناً لحساب الإيرادات المحدد، ويظهر مباشرة في ميزان المراجعة وقائمة الدخل لكل فرع.',
                        'Sales of this item will be automatically credited to this revenue account in the general ledger and financial reports.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Inventory Reorder Point Alert Configuration (حد الطلب والتنبيه التلقائي للمخزون) */}
              {(!form.isService && !form.isPackage) || form.itemType === 'sales_product' ? (
                <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{t('نظام التنبيه التلقائي: حد إعادة الطلب للمخزون', 'Reorder Point & Stock Alert')}</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                      {t('مراقبة النفاذ الآلي', 'Auto Depletion Monitor')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t('حد الطلب / نقطة التنبيه (بالوحدة) *', 'Reorder Point / Min Stock Alert Level *')}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          value={form.minStockLevel}
                          onChange={(e) => setForm({ ...form, minStockLevel: Math.max(0, parseInt(e.target.value) || 0) })}
                          placeholder="5"
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                          {form.unit || 'وحدة'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 bg-white/80 p-3 rounded-xl border border-amber-100">
                      <p className="leading-relaxed text-[11px]">
                        📌 {t(
                          'سيتم تفعيل تنبيه تلقائي في لوحة التحكم فور وصول رصيد هذا المنتج بالمخزن إلى',
                          'An automatic alert will trigger in the dashboard when stock drops to'
                        )}{' '}
                        <strong className="text-amber-800 font-mono font-bold">{form.minStockLevel || 0} {form.unit || 'وحدة'}</strong>{' '}
                        {t('أو أقل، مع اقتراح كمية إعادة التوريد فوراً.', 'or below, with suggested purchase quantities.')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

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

              {/* Default POS Collection Only Setting (User Requested) */}
              <div className="flex items-center justify-between p-3 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/60">
                <div>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                    {t('الوضع الافتراضي في نقطة البيع: تسجيل تحصيل فقط (ليس إيراد)', 'Default in POS: Collection Only (No Revenue)')}
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    {form.defaultCollectionOnly
                      ? t('مفعل: عند اختيار هذا الصنف في نقطة البيع يتم تفعيل خيار (تحصيل فقط) تلقائياً', 'Enabled: checking this product in POS auto-selects Collection Only')
                      : t('غير مفعل: يسجل كإيراد بيع اعتيادي ما لم يغيره المستخدم يدوياً', 'Disabled: recorded as regular revenue unless toggled manually')}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(form.defaultCollectionOnly)}
                  onChange={(e) => setForm({ ...form, defaultCollectionOnly: e.target.checked })}
                  className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
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

      {/* Modal: Direct Assign Package to Client (إسناد باقة جديدة للعميل) */}
      {showAssignModal && assignPackageProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-purple-50/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {t('إسناد باقة جلسات جديدة لعميل', 'Assign New Package to Client')}
                  </h3>
                  <p className="text-xs text-purple-700 font-medium">
                    {assignPackageProduct.nameAr} ({assignPackageProduct.sku})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssignPackageProduct(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignOffer} className="p-6 space-y-4">
              {/* Client Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('اختر العميل المستفيد *', 'Select Client *')}
                </label>
                <select
                  required
                  value={assignForm.customerId}
                  onChange={(e) => setAssignForm({ ...assignForm, customerId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">{t('-- اختر العميل من القائمة --', '-- Select Client --')}</option>
                  {parties
                    .filter((p) => p.type === 'Customer' || p.type === 'Both')
                    .map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} {client.phone ? `(${client.phone})` : ''} - {client.code || ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Package Summary & Custom Overrides */}
              <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-purple-950 mb-1">
                    {t('عدد الجلسات الإجمالي *', 'Total Sessions *')}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={assignForm.totalSessions}
                    onChange={(e) => setAssignForm({ ...assignForm, totalSessions: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-950 mb-1">
                    {t('السعر الإجمالي (ج.م) *', 'Total Price (EGP) *')}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={assignForm.totalPrice}
                    onChange={(e) => setAssignForm({ ...assignForm, totalPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-950 mb-1">
                    {t('تاريخ الصلاحية / الانتهاء *', 'Expiry Date *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={assignForm.customExpiryDate}
                    onChange={(e) => setAssignForm({ ...assignForm, customExpiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('ملاحظات الإسناد وشروط الباقة', 'Assignment Notes')}
                </label>
                <textarea
                  rows={2}
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  placeholder="ملاحظات إضافية تظهر في سجل باقات العميل..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssignPackageProduct(null);
                  }}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-xl transition"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('تأكيد إسناد الباقة للعميل', 'Confirm Assignment')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('تأكيد حذف الصنف البيعي', 'Confirm Product Deletion')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('سيتم حذف هذا الصنف وإلغاؤه من قائمة البيع ونقاط البيع POS.', 'This item will be removed from catalog and POS.')}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('اسم الصنف:', 'Item Name:')}</span>
                <span className="font-bold text-slate-900">{productToDelete.nameAr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('الكود / SKU:', 'SKU:')}</span>
                <span className="font-mono font-semibold text-slate-700">{productToDelete.sku}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('المجموعة:', 'Category:')}</span>
                <span className="font-semibold text-indigo-600">{productToDelete.category}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('سعر البيع:', 'Selling Price:')}</span>
                <span className="font-bold text-emerald-700">{formatMoney(productToDelete.sellingPrice)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                {t('تأكيد الحذف النهائي', 'Confirm Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('تأكيد حذف المجموعة البيعية', 'Confirm Category Deletion')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('لن يمكن الحذف إذا كانت المجموعة تحتوي على أصناف مرتبطة بها.', 'Cannot delete if category contains linked items.')}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('اسم المجموعة:', 'Category Name:')}</span>
                <span className="font-bold text-slate-900">{categoryToDelete.nameAr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('نوع المجموعة:', 'Category Type:')}</span>
                <span className="font-semibold text-indigo-600">
                  {categoryToDelete.type === 'service' ? t('خدمات طبية', 'Services') : t('منتجات تجارية', 'Products')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                {t('تأكيد حذف المجموعة', 'Confirm Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reorder Point Adjustment Modal */}
      {editingReorderProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {t('ضبط حد الطلب ونظام التنبيهات', 'Adjust Reorder Point & Alerts')}
                  </h3>
                  <p className="text-xs text-amber-800 font-medium">
                    {editingReorderProduct.nameAr}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingReorderProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReorderAdjustment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <div>
                  <span className="text-[11px] text-slate-500 block">{t('الرصيد المتوفر حالياً', 'Current Stock')}</span>
                  <span className="text-lg font-black text-slate-800">
                    {editingReorderProduct.stock} {editingReorderProduct.unit || 'وحدة'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">{t('حد الطلب السابق', 'Current Reorder')}</span>
                  <span className="text-lg font-bold text-amber-700">
                    {editingReorderProduct.currentLevel} {editingReorderProduct.unit || 'وحدة'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('حد الطلب الجديد (نقطة إطلاق التنبيه التلقائي) *', 'New Reorder Alert Threshold *')}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={newReorderValue}
                  onChange={(e) => setNewReorderValue(Number(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
                />
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] text-slate-500 block mb-1.5 font-medium">{t('خيارات سريعة:', 'Quick Presets:')}</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[2, 5, 10, 15, 20, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewReorderValue(preset)}
                      className={`px-3 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                        newReorderValue === preset
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {preset} {editingReorderProduct.unit || 'وحدة'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  {t(
                    'عند وصول رصيد المخزن الفعلي إلى هذه الكمية أو أقل، سيقوم النظام تلقائياً بإظهار تنبيه في بطاقات نقص المخزون ويقترح إصدار أمر شراء توريد لتفادي توقف البيع.',
                    'When real stock hits this threshold or lower, the system flags the item as low-stock and suggests reordering.'
                  )}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingReorderProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('حفظ وضبط حد الطلب', 'Save & Update Threshold')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
