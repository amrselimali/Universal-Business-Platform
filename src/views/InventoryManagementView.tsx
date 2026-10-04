import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { LowStockAlertWidget } from '../components/LowStockAlertWidget';
import {
  InventoryAudit,
  InventoryAuditItem,
  InventoryStaffLiability,
  Product,
  Warehouse,
  StockMovement,
  Account,
} from '../types';
import {
  Warehouse as WarehouseIcon,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Users,
  Search,
  Plus,
  Minus,
  Trash2,
  Building2,
  Printer,
  X,
  DollarSign,
  Layers,
  ArrowRightLeft,
  Link,
  Clock,
  BarChart3,
  PackageSearch,
  BookOpen,
  History,
  GitCommit,
  Filter,
} from 'lucide-react';

export const InventoryManagementView: React.FC = () => {
  const {
    t,
    formatMoney,
    branches,
    activeBranch,
    warehouses,
    products,
    stockLevels,
    stockMovements,
    recordStockMovement,
    accounts,
    getProductStock,
    adjustStock,
    transferStock,
    addProduct,
    updateProduct,
    deleteProduct,
    inventoryAudits,
    createInventoryAudit,
    settleInventoryAudit,
    staffMembers,
    receptionShifts,
    invoices,
  } = usePlatform();

  // Active Tab: Stock items control, Movements log, Cost mapping (BOM), Consumption & Forecasting reports, Audits & Settlements
  const [activeTab, setActiveTab] = useState<'stock_items' | 'movements' | 'cost_mapping' | 'consumption_forecast' | 'audits'>('stock_items');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || 'all');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLinkedOnly, setFilterLinkedOnly] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Movements Tab state
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');
  const [movementSearchQuery, setMovementSearchQuery] = useState<string>('');

  // Sales Cost Mapping Tab state
  const [salesSearchQuery, setSalesSearchQuery] = useState<string>('');
  const [salesCategoryFilter, setSalesCategoryFilter] = useState<string>('all');
  const [showRecipeModal, setShowRecipeModal] = useState<boolean>(false);
  const [selectedSalesForRecipe, setSelectedSalesForRecipe] = useState<Product | null>(null);

  // Filtered warehouses by selected branch
  const branchWarehouses = useMemo(() => {
    if (selectedBranchId === 'all') return warehouses;
    return warehouses.filter((w) => w.branchId === selectedBranchId);
  }, [warehouses, selectedBranchId]);

  // --- Modals State ---
  // 1. Add Stock Item Modal
  const [showAddStockItemModal, setShowAddStockItemModal] = useState<boolean>(false);
  const [stockItemForm, setStockItemForm] = useState<{
    nameAr: string;
    nameEn: string;
    sku: string;
    barcode: string;
    category: string;
    unit: string;
    purchasePrice: number;
    minStockLevel: number;
    initialStock: number;
    initialWarehouseId: string;
    notes: string;
    linkedSalesProductIds: string[];
    consumptionBasis: 'units_sold' | 'revenue_ratio' | 'monthly_period' | 'client_count';
    consumptionRate: number;
    expenseAccountId: string;
    expenseAccountNameAr: string;
    inventoryAccountId: string;
    inventoryAccountNameAr: string;
  }>({
    nameAr: '',
    nameEn: '',
    sku: '',
    barcode: '',
    category: 'مستهلكات وخامات طبية',
    unit: 'مل (ml)',
    purchasePrice: 0.15,
    minStockLevel: 50,
    initialStock: 100,
    initialWarehouseId: warehouses[0]?.id || '',
    notes: '',
    linkedSalesProductIds: [],
    consumptionBasis: 'units_sold',
    consumptionRate: 1,
    expenseAccountId: 'acc-5100',
    expenseAccountNameAr: 'تكلفة البضاعة المباعة (COGS)',
    inventoryAccountId: 'acc-1130',
    inventoryAccountNameAr: 'مخزون البضائع ومستلزمات العيادة',
  });

  // 2. Quick Stock In (+) / Out (-) Modal
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [adjustData, setAdjustData] = useState<{
    productId: string;
    productName: string;
    warehouseId: string;
    direction: 'add' | 'deduct';
    quantity: number;
    reason: string;
    notes: string;
  }>({
    productId: '',
    productName: '',
    warehouseId: warehouses[0]?.id || '',
    direction: 'add',
    quantity: 10,
    reason: 'توريد واستلام مخزني جديد',
    notes: '',
  });

  // 3. Link Stock Item to Sales Products Modal
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [selectedStockItemForLink, setSelectedStockItemForLink] = useState<Product | null>(null);
  const [linkForm, setLinkForm] = useState<{
    linkedSalesProductIds: string[];
    consumptionBasis: 'units_sold' | 'revenue_ratio' | 'monthly_period' | 'client_count';
    consumptionRate: number;
  }>({
    linkedSalesProductIds: [],
    consumptionBasis: 'units_sold',
    consumptionRate: 1,
  });

  // 4. Stock Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferData, setTransferData] = useState<{
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    notes: string;
  }>({
    productId: '',
    fromWarehouseId: warehouses[0]?.id || '',
    toWarehouseId: warehouses[1]?.id || '',
    quantity: 1,
    notes: '',
  });

  // 5. Audit & Stocktake State
  const [showCreateAuditModal, setShowCreateAuditModal] = useState<boolean>(false);
  const [newAuditWarehouseId, setNewAuditWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [newAuditNotes, setNewAuditNotes] = useState<string>('');
  const [auditItemCounts, setAuditItemCounts] = useState<{ [productId: string]: number }>({});
  const [activeAudit, setActiveAudit] = useState<InventoryAudit | null>(null);
  const [showSettleModal, setShowSettleModal] = useState<boolean>(false);
  const [settlementType, setSettlementType] = useState<
    'staff_liability' | 'write_off' | 'mixed' | 'inventory_adjustment_only'
  >('staff_liability');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [linkToPayroll, setLinkToPayroll] = useState<boolean>(true);
  const [staffLiabilities, setStaffLiabilities] = useState<
    {
      staffId: string;
      percentage: number;
      amount: number;
      deductionMonth: string;
      notes: string;
    }[]
  >([]);

  // Forecasting Period Filter
  const [forecastPeriod, setForecastPeriod] = useState<'month' | 'quarter'>('month');

  // Month string YYYY-MM
  const currentMonth = new Date().toISOString().slice(0, 7);

  // --- Strict Separation: Filter ONLY Stock Items (Raw materials, consumables, medical supplies) ---
  const stockItems = useMemo(() => {
    return products.filter((p) => {
      if (p.isStockItem) return true;
      if (p.itemType === 'stock_raw' || p.itemType === 'consumable' || p.itemType === 'medical_supply') {
        return true;
      }
      if (p.isSalesItem && !p.isStockItem) return false;
      if (p.isService) return false;
      return true;
    });
  }, [products]);

  // Sales Items (for linking and calculating Cost of Sale)
  const salesItems = useMemo(() => {
    return products.filter((p) => {
      if (p.isSalesItem) return true;
      if (p.isService) return true;
      if (p.itemType === 'sales_product' || p.itemType === 'sales_service') return true;
      return false;
    });
  }, [products]);

  // Filtered Stock Items for display
  const filteredStockItems = useMemo(() => {
    return stockItems.filter((p) => {
      const matchesSearch =
        p.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.unit && p.unit.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesLinked = true;
      const isLinked = !!(p.linkedSalesProductIds && p.linkedSalesProductIds.length > 0);
      if (filterLinkedOnly === 'linked') matchesLinked = isLinked;
      if (filterLinkedOnly === 'unlinked') matchesLinked = !isLinked;

      return matchesSearch && matchesLinked;
    });
  }, [stockItems, searchQuery, filterLinkedOnly]);

  // Filtered Stock Movements for display (سجل حركات المخازن والاستهلاك)
  const filteredMovements = useMemo(() => {
    return (stockMovements || []).filter((mov) => {
      const matchesBranch = selectedBranchId === 'all' || mov.branchId === selectedBranchId;
      const matchesWh = selectedWarehouseId === 'all' || mov.warehouseId === selectedWarehouseId;
      const matchesType = movementTypeFilter === 'all' || mov.type === movementTypeFilter;
      const q = movementSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (mov.productNameAr && mov.productNameAr.toLowerCase().includes(q)) ||
        (mov.referenceNo && mov.referenceNo.toLowerCase().includes(q)) ||
        (mov.warehouseNameAr && mov.warehouseNameAr.toLowerCase().includes(q)) ||
        (mov.branchNameAr && mov.branchNameAr.toLowerCase().includes(q)) ||
        (mov.note && mov.note.toLowerCase().includes(q));

      return matchesBranch && matchesWh && matchesType && matchesSearch;
    });
  }, [stockMovements, selectedBranchId, selectedWarehouseId, movementTypeFilter, movementSearchQuery]);

  // Total Quantity of an item across warehouses or specific warehouse
  const getItemCurrentStock = (productId: string) => {
    if (selectedWarehouseId !== 'all') {
      return getProductStock(productId, selectedWarehouseId);
    }
    return branchWarehouses.reduce((sum, wh) => sum + getProductStock(productId, wh.id), 0);
  };

  // KPIs (filtered by branch if specified)
  const totalStockItemsCount = stockItems.length;
  const totalStockValuation = useMemo(() => {
    return stockItems.reduce((sum, p) => {
      const qty = branchWarehouses.reduce((wSum, wh) => wSum + getProductStock(p.id, wh.id), 0);
      return sum + qty * (p.purchasePrice || 0);
    }, 0);
  }, [stockItems, branchWarehouses, getProductStock]);

  const lowStockItemsCount = useMemo(() => {
    return stockItems.filter((p) => {
      const currentQty = branchWarehouses.reduce((wSum, wh) => wSum + getProductStock(p.id, wh.id), 0);
      return currentQty <= (p.minStockLevel || 0);
    }).length;
  }, [stockItems, branchWarehouses, getProductStock]);

  const linkedStockItemsCount = stockItems.filter(
    (p) => p.linkedSalesProductIds && p.linkedSalesProductIds.length > 0
  ).length;

  // Helper: Get recipe ingredients & calculated cost of sale for any sales product
  const getSalesProductRecipe = (salesProd: Product) => {
    let totalCost = 0;
    const ingredients: { item: Product; qty: number; cost: number }[] = [];

    stockItems.forEach((stk) => {
      if (stk.linkedSalesProductIds && stk.linkedSalesProductIds.includes(salesProd.id)) {
        const qty = stk.consumptionRate || 1;
        let itemCost = 0;
        if (stk.consumptionBasis === 'revenue_ratio') {
          itemCost = (salesProd.sellingPrice * ((stk.consumptionRate || 0) / 100));
        } else {
          itemCost = qty * (stk.purchasePrice || 0);
        }
        totalCost += itemCost;
        ingredients.push({ item: stk, qty, cost: itemCost });
      }
    });

    const finalCost = totalCost > 0 ? totalCost : (salesProd.purchasePrice || 0);
    const profitMargin = salesProd.sellingPrice - finalCost;
    const marginPercentage = salesProd.sellingPrice > 0 ? Math.round((profitMargin / salesProd.sellingPrice) * 100) : 0;

    return {
      totalCost: finalCost,
      isCalculatedFromStock: totalCost > 0,
      ingredients,
      profitMargin,
      marginPercentage,
    };
  };

  // Filtered sales items for the Cost Mapping tab
  const filteredSalesForMapping = useMemo(() => {
    return salesItems.filter((sp) => {
      const matchesSearch =
        sp.nameAr.toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
        sp.nameEn.toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
        sp.sku.toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
        (sp.category && sp.category.toLowerCase().includes(salesSearchQuery.toLowerCase()));

      const matchesCat = salesCategoryFilter === 'all' || sp.category === salesCategoryFilter || sp.categoryId === salesCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [salesItems, salesSearchQuery, salesCategoryFilter]);

  // Unique categories of sales items
  const salesCategories = useMemo(() => {
    const set = new Set<string>();
    salesItems.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [salesItems]);

  // --- Sales-Driven Consumption & Future Forecasting Calculation (مع فلترة الفروع المنفصلة) ---
  const consumptionForecastReport = useMemo(() => {
    const salesVolumeMap: { [productId: string]: number } = {};
    let totalPatientsServiced = 0;

    // Filter shifts and invoices by selected branch
    const branchShifts = receptionShifts.filter(
      (s) => selectedBranchId === 'all' || !s.branchId || s.branchId === selectedBranchId
    );
    const branchInvoices = invoices.filter(
      (i) => selectedBranchId === 'all' || !i.branchId || i.branchId === selectedBranchId
    );

    // From reception shifts runRows
    branchShifts.forEach((shift) => {
      if (shift.runRows && Array.isArray(shift.runRows)) {
        shift.runRows.forEach((row) => {
          totalPatientsServiced += 1;
          const matchedSalesProd = salesItems.find(
            (sp) => sp.nameAr === row.serviceName || sp.nameEn === row.serviceName || sp.id === row.doctorId
          );
          if (matchedSalesProd) {
            salesVolumeMap[matchedSalesProd.id] = (salesVolumeMap[matchedSalesProd.id] || 0) + 1;
          }
        });
      }
    });

    // Also from invoices lines
    branchInvoices.forEach((inv) => {
      if (inv.lines && Array.isArray(inv.lines)) {
        inv.lines.forEach((line) => {
          salesVolumeMap[line.productId] = (salesVolumeMap[line.productId] || 0) + (line.quantity || 1);
        });
      }
    });

    return stockItems.map((stk) => {
      const currentOnHand = branchWarehouses.reduce((sum, wh) => sum + getProductStock(stk.id, wh.id), 0);
      let totalConsumedFromSales = 0;
      const linkedSalesNames: string[] = [];

      if (stk.linkedSalesProductIds && stk.linkedSalesProductIds.length > 0) {
        stk.linkedSalesProductIds.forEach((spId) => {
          const sp = salesItems.find((s) => s.id === spId);
          if (sp) {
            linkedSalesNames.push(sp.nameAr);
            const soldCount = salesVolumeMap[sp.id] || 0;

            if (stk.consumptionBasis === 'units_sold') {
              totalConsumedFromSales += soldCount * (stk.consumptionRate || 1);
            } else if (stk.consumptionBasis === 'revenue_ratio') {
              const spRevenue = soldCount * sp.sellingPrice;
              totalConsumedFromSales += (spRevenue * ((stk.consumptionRate || 0) / 100)) / (stk.purchasePrice || 1);
            } else if (stk.consumptionBasis === 'client_count') {
              totalConsumedFromSales += totalPatientsServiced * (stk.consumptionRate || 1);
            } else {
              totalConsumedFromSales += stk.consumptionRate || 1;
            }
          }
        });
      }

      if (totalConsumedFromSales === 0 && stk.linkedSalesProductIds && stk.linkedSalesProductIds.length > 0) {
        totalConsumedFromSales = (stk.consumptionRate || 1) * 8;
      }

      const totalConsumedValue = totalConsumedFromSales * (stk.purchasePrice || 0);
      const dailyBurnRate = Math.max(0.1, totalConsumedFromSales / 14);
      const forecast30Days = Math.round(dailyBurnRate * 30);
      const forecast60Days = Math.round(dailyBurnRate * 60);
      const daysOfSupplyRemaining = dailyBurnRate > 0 ? Math.floor(currentOnHand / dailyBurnRate) : 999;
      const isCritical = daysOfSupplyRemaining <= 10 || currentOnHand <= stk.minStockLevel;
      const suggestedReorderQty = isCritical ? Math.max(stk.minStockLevel * 2, forecast30Days) : 0;
      const suggestedReorderCost = suggestedReorderQty * (stk.purchasePrice || 0);

      return {
        item: stk,
        currentOnHand,
        totalConsumedFromSales: Math.round(totalConsumedFromSales * 10) / 10,
        totalConsumedValue,
        dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
        forecast30Days,
        forecast60Days,
        daysOfSupplyRemaining,
        isCritical,
        suggestedReorderQty,
        suggestedReorderCost,
        linkedSalesNames,
      };
    });
  }, [stockItems, salesItems, receptionShifts, invoices, warehouses, getProductStock]);

  // --- Handlers: Add New Stock Item ---
  const handleOpenAddStockItem = () => {
    const nextSku = `RAW-${(stockItems.length + 1).toString().padStart(3, '0')}`;
    const defaultExpenseAcc = accounts.find((a) => a.code === '5100') || accounts.find((a) => a.type === 'Expense');
    const defaultInvAcc = accounts.find((a) => a.code === '1130') || accounts.find((a) => a.type === 'Asset');

    setStockItemForm({
      nameAr: '',
      nameEn: '',
      sku: nextSku,
      barcode: `RAW${Date.now().toString().slice(-6)}`,
      category: 'مستهلكات وخامات طبية',
      unit: 'مل (ml)',
      purchasePrice: 0.15,
      minStockLevel: 100,
      initialStock: 500,
      initialWarehouseId: branchWarehouses[0]?.id || warehouses[0]?.id || '',
      notes: '',
      linkToAllSales: false,
      linkedSalesProductIds: [],
      consumptionBasis: 'units_sold',
      consumptionRate: 1,
      expenseAccountId: defaultExpenseAcc?.id || 'acc-5100',
      expenseAccountNameAr: defaultExpenseAcc?.nameAr || 'تكلفة البضاعة المباعة (COGS)',
      inventoryAccountId: defaultInvAcc?.id || 'acc-1130',
      inventoryAccountNameAr: defaultInvAcc?.nameAr || 'مخزون البضائع ومستلزمات العيادة',
    });
    setShowAddStockItemModal(true);
  };

  const handleSaveAddStockItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockItemForm.nameAr.trim()) return;

    const chosenExpense = accounts.find((a) => a.id === stockItemForm.expenseAccountId);
    const chosenInv = accounts.find((a) => a.id === stockItemForm.inventoryAccountId);

    const finalLinkedIds = stockItemForm.linkToAllSales
      ? salesItems.map((s) => s.id)
      : stockItemForm.linkedSalesProductIds;
    const finalBasis = stockItemForm.linkToAllSales ? 'revenue_ratio' : stockItemForm.consumptionBasis;

    addProduct(
      {
        nameAr: stockItemForm.nameAr.trim(),
        nameEn: stockItemForm.nameEn.trim() || stockItemForm.nameAr.trim(),
        sku: stockItemForm.sku.trim(),
        barcode: stockItemForm.barcode.trim(),
        category: stockItemForm.category,
        purchasePrice: Number(stockItemForm.purchasePrice) || 0,
        sellingPrice: 0,
        minStockLevel: Number(stockItemForm.minStockLevel) || 0,
        unit: stockItemForm.unit.trim(),
        isService: false,
        itemType: 'stock_raw',
        isSalesItem: false,
        isStockItem: true,
        isActive: true,
        notes: stockItemForm.linkToAllSales
          ? `${stockItemForm.notes ? `${stockItemForm.notes} - ` : ''}تم الربط مع جميع الأصناف البيعية وتقسيم التكلفة على كل المبيعات بالقيمة`
          : stockItemForm.notes,
        linkedSalesProductIds: finalLinkedIds,
        consumptionBasis: finalBasis,
        consumptionRate: Number(stockItemForm.consumptionRate) || 1,
        expenseAccountId: stockItemForm.expenseAccountId || chosenExpense?.id || undefined,
        expenseAccountNameAr: chosenExpense?.nameAr || stockItemForm.expenseAccountNameAr || undefined,
        inventoryAccountId: stockItemForm.inventoryAccountId || chosenInv?.id || undefined,
        inventoryAccountNameAr: chosenInv?.nameAr || stockItemForm.inventoryAccountNameAr || undefined,
      },
      Number(stockItemForm.initialStock) || 0
    );

    setShowAddStockItemModal(false);
  };

  // --- Handlers: Quick Stock In (+) / Out (-) ---
  const handleOpenAdjust = (prod: Product, direction: 'add' | 'deduct') => {
    setAdjustData({
      productId: prod.id,
      productName: prod.nameAr,
      warehouseId: selectedWarehouseId !== 'all' ? selectedWarehouseId : warehouses[0]?.id || '',
      direction,
      quantity: direction === 'add' ? 50 : 5,
      reason: direction === 'add' ? 'إذن توريد / استلام كمية جديدة' : 'إذن صرف / استهلاك تشغيلي بالعيادة',
      notes: '',
    });
    setShowAdjustModal(true);
  };

  const handleSaveAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustData.productId || adjustData.quantity <= 0) return;

    const delta = adjustData.direction === 'add' ? Number(adjustData.quantity) : -Number(adjustData.quantity);
    adjustStock(
      adjustData.productId,
      adjustData.warehouseId,
      delta,
      `${adjustData.reason} ${adjustData.notes ? `(${adjustData.notes})` : ''}`
    );

    setShowAdjustModal(false);
  };

  // --- Handlers: Link Stock Item to Sales Products ---
  const handleOpenLinkModal = (prod: Product) => {
    setSelectedStockItemForLink(prod);
    setLinkForm({
      linkedSalesProductIds: prod.linkedSalesProductIds || [],
      consumptionBasis: prod.consumptionBasis || 'units_sold',
      consumptionRate: prod.consumptionRate || 1,
    });
    setShowLinkModal(true);
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockItemForLink) return;

    updateProduct(selectedStockItemForLink.id, {
      linkedSalesProductIds: linkForm.linkedSalesProductIds,
      consumptionBasis: linkForm.consumptionBasis,
      consumptionRate: Number(linkForm.consumptionRate) || 1,
    });

    setShowLinkModal(false);
    setSelectedStockItemForLink(null);
  };

  // --- Recipe (BOM) Editor for Sales Items ---
  interface RecipeDraftItem {
    isLinked: boolean;
    rate: number;
    basis: string;
  }

  const [recipeSearch, setRecipeSearch] = useState<string>('');
  const [recipeDraft, setRecipeDraft] = useState<Record<string, RecipeDraftItem>>({});

  const handleOpenRecipeModal = (salesProd: Product) => {
    setSelectedSalesForRecipe(salesProd);
    const draft: Record<string, RecipeDraftItem> = {};
    stockItems.forEach((stk) => {
      const isLinked = !!(stk.linkedSalesProductIds && stk.linkedSalesProductIds.includes(salesProd.id));
      draft[stk.id] = {
        isLinked,
        rate: stk.consumptionRate || 1,
        basis: stk.consumptionBasis || 'units_sold',
      };
    });
    setRecipeDraft(draft);
    setRecipeSearch('');
    setShowRecipeModal(true);
  };

  const handleSaveRecipeDraft = () => {
    if (!selectedSalesForRecipe) return;
    const salesId = selectedSalesForRecipe.id;

    let totalCalculatedCost = 0;

    Object.entries(recipeDraft).forEach(([stockId, itemDraft]: [string, RecipeDraftItem]) => {
      const stk = stockItems.find((s) => s.id === stockId);
      if (!stk) return;
      const currentLinks = stk.linkedSalesProductIds || [];
      let updatedLinks: string[];

      if (itemDraft.isLinked) {
        if (!currentLinks.includes(salesId)) {
          updatedLinks = [...currentLinks, salesId];
        } else {
          updatedLinks = currentLinks;
        }
        totalCalculatedCost += (itemDraft.rate || 1) * (stk.purchasePrice || 0);
      } else {
        updatedLinks = currentLinks.filter((id) => id !== salesId);
      }

      updateProduct(stockId, {
        linkedSalesProductIds: updatedLinks,
        consumptionRate: itemDraft.rate,
        consumptionBasis: itemDraft.basis as any,
      });
    });

    // Update sales product purchasePrice to reflect calculated cost of sale
    if (totalCalculatedCost > 0) {
      updateProduct(salesId, { purchasePrice: totalCalculatedCost });
    }

    setShowRecipeModal(false);
    setSelectedSalesForRecipe(null);
  };

  // --- Handlers: Stock Transfer ---
  const handleExecuteTransfer = () => {
    if (transferData.fromWarehouseId === transferData.toWarehouseId) {
      alert(t('لا يمكن التحويل لنفس المخزن!', 'Cannot transfer to the same warehouse!'));
      return;
    }
    const currentQty = getProductStock(transferData.productId, transferData.fromWarehouseId);
    if (transferData.quantity > currentQty) {
      alert(t(`الكمية المتاحة في مخزن المصدر هي ${currentQty} فقط!`, 'Insufficient stock in source warehouse!'));
      return;
    }

    transferStock(
      transferData.productId,
      transferData.fromWarehouseId,
      transferData.toWarehouseId,
      transferData.quantity
    );

    setShowTransferModal(false);
    alert(t('تم تنفيذ أمر التحويل المخزني بنجاح!', 'Transfer completed!'));
  };

  // --- Handlers: Audits & Settlements ---
  const handleOpenCreateAudit = (whId?: string) => {
    const targetWhId = whId || (selectedWarehouseId !== 'all' ? selectedWarehouseId : warehouses[0]?.id || '');
    setNewAuditWarehouseId(targetWhId);
    setNewAuditNotes('');

    const initialCounts: { [productId: string]: number } = {};
    stockItems.forEach((p) => {
      initialCounts[p.id] = getProductStock(p.id, targetWhId);
    });
    setAuditItemCounts(initialCounts);
    setShowCreateAuditModal(true);
  };

  const handleSaveAudit = () => {
    const wh = warehouses.find((w) => w.id === newAuditWarehouseId);
    if (!wh) {
      alert(t('يرجى تحديد المخزن المراد جرده!', 'Please select warehouse!'));
      return;
    }

    const branch = branches.find((b) => b.id === wh.branchId);

    let totalExpectedVal = 0;
    let totalActualVal = 0;
    let totalShortageVal = 0;
    let totalSurplusVal = 0;

    const auditItems: InventoryAuditItem[] = stockItems.map((p) => {
      const systemQty = getProductStock(p.id, wh.id);
      const actualQty = Number(auditItemCounts[p.id] !== undefined ? auditItemCounts[p.id] : systemQty);
      const differenceQty = actualQty - systemQty;
      const unitCost = Number(p.purchasePrice || 0);
      const differenceValue = differenceQty * unitCost;

      totalExpectedVal += systemQty * unitCost;
      totalActualVal += actualQty * unitCost;

      if (differenceValue < 0) {
        totalShortageVal += Math.abs(differenceValue);
      } else if (differenceValue > 0) {
        totalSurplusVal += differenceValue;
      }

      return {
        productId: p.id,
        productNameAr: p.nameAr,
        sku: p.sku,
        unit: p.unit || 'قطعة',
        systemQty,
        actualQty,
        differenceQty,
        unitCost,
        differenceValue,
        notes: '',
      };
    });

    const netDiffVal = totalActualVal - totalExpectedVal;

    createInventoryAudit({
      branchId: wh.branchId || branches[0]?.id || 'branch-1',
      branchName: branch?.nameAr || 'الفرع الرئيسي',
      warehouseId: wh.id,
      warehouseName: wh.nameAr,
      auditDate: new Date().toISOString().split('T')[0],
      status: 'Pending_Review',
      notes: newAuditNotes,
      items: auditItems,
      totalExpectedValue: totalExpectedVal,
      totalActualValue: totalActualVal,
      totalShortageValue: totalShortageVal,
      totalSurplusValue: totalSurplusVal,
      netDifferenceValue: netDiffVal,
    });

    setShowCreateAuditModal(false);
  };

  const handleOpenSettleModal = (audit: InventoryAudit) => {
    setActiveAudit(audit);
    setSettlementNotes('');
    setLinkToPayroll(true);

    const shortage = Math.abs(audit.totalShortageValue || 0);
    const branchStaff = staffMembers.filter((s) => !s.isArchived && (!audit.branchId || s.branchId === audit.branchId));
    const defaultStaff = branchStaff.length > 0 ? branchStaff : staffMembers.filter((s) => !s.isArchived);

    if (shortage > 0 && defaultStaff.length > 0) {
      const initialStaff = defaultStaff.slice(0, 1);
      const equalPct = Math.floor(100 / initialStaff.length);

      setStaffLiabilities(
        initialStaff.map((st, i) => {
          const pct = i === 0 ? 100 - equalPct * (initialStaff.length - 1) : equalPct;
          return {
            staffId: st.id,
            percentage: pct,
            amount: Math.round((shortage * pct) / 100),
            deductionMonth: currentMonth,
            notes: `تحميل عجز جرد ${audit.auditNumber}`,
          };
        })
      );
      setSettlementType('staff_liability');
    } else {
      setStaffLiabilities([]);
      setSettlementType(audit.totalSurplusValue > 0 ? 'inventory_adjustment_only' : 'write_off');
    }

    setShowSettleModal(true);
  };

  const updateStaffLiabilityRow = (index: number, field: string, val: any) => {
    if (!activeAudit) return;
    const shortage = Math.abs(activeAudit.totalShortageValue || 0);

    setStaffLiabilities((prev) => {
      const next = [...prev];
      if (field === 'percentage') {
        const pct = Math.min(100, Math.max(0, Number(val)));
        next[index] = {
          ...next[index],
          percentage: pct,
          amount: Math.round((shortage * pct) / 100),
        };
      } else if (field === 'amount') {
        const amt = Math.min(shortage, Math.max(0, Number(val)));
        const pct = shortage > 0 ? Math.round((amt / shortage) * 100) : 0;
        next[index] = {
          ...next[index],
          amount: amt,
          percentage: pct,
        };
      } else {
        next[index] = {
          ...next[index],
          [field]: val,
        };
      }
      return next;
    });
  };

  const handleConfirmSettlement = () => {
    if (!activeAudit) return;

    const finalLiabilities: InventoryStaffLiability[] = staffLiabilities.map((l) => {
      const staff = staffMembers.find((s) => s.id === l.staffId);
      return {
        staffId: l.staffId,
        staffNameAr: staff?.nameAr || 'موظف',
        percentage: l.percentage,
        amount: l.amount,
        deductionMonth: l.deductionMonth,
        appliedToPayroll: linkToPayroll,
        notes: l.notes,
      };
    });

    const res = settleInventoryAudit(activeAudit.id, {
      settlementType,
      staffLiabilities: finalLiabilities,
      settlementNotes,
      linkToPayroll,
    });

    if (res.success) {
      alert(
        t(
          `تمت تسوية الجرد بنجاح!\n- تم تحديث كميات المخزن تلقائياً.\n- تم إنشاء القيد المحاسبي (${res.journalNumber || 'JV-INV'}).\n${
            linkToPayroll && finalLiabilities.length > 0 ? '- تم ربط استقطاعات العجز بمسير رواتب الموظفين.' : ''
          }`,
          'Stocktake settled successfully and payroll updated!'
        )
      );
      setShowSettleModal(false);
      setActiveAudit(null);
    } else {
      alert(res.error || 'حدث خطأ أثناء التسوية');
    }
  };

  return (
    <div id="inventory-management-view" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <WarehouseIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800">
                  {t('إدارة المخازن', 'Warehouse Management')}
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                  {t('خامات ومستهلكات فقط', 'Raw & Stock Only')}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {t(
                  'التحكم في الأصناف المخزنية (إضافة وخصم)، ربطها بالأصناف البيعية لتحديد تكلفة البيع، واستخراج تقارير الاستهلاك والتوقعات المستقبلية والجرد',
                  'Manage stock items (+ / -), link to sales items for COGS, consumption forecasting from sales, and audits'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Multi-Branch Isolation Selector */}
          <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs font-semibold">
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-indigo-900 whitespace-nowrap">{t('الفرع:', 'Branch:')}</span>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSelectedWarehouseId('all');
              }}
              className="bg-transparent font-bold text-indigo-700 focus:outline-none cursor-pointer"
            >
              <option value="all">{t('جميع الفروع (عرض شامل)', 'All Branches (Consolidated)')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn-add-stock-item"
            onClick={handleOpenAddStockItem}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t('إضافة صنف مخزني جديد', 'New Stock Item')}</span>
          </button>

          <button
            id="btn-stock-transfer"
            onClick={() => {
              setTransferData({
                productId: stockItems[0]?.id || '',
                fromWarehouseId: branchWarehouses[0]?.id || warehouses[0]?.id || '',
                toWarehouseId: branchWarehouses[1]?.id || warehouses[1]?.id || '',
                quantity: 10,
                notes: '',
              });
              setShowTransferModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            <span>{t('تحويل بين المخازن', 'Stock Transfer')}</span>
          </button>

          <button
            id="btn-start-audit"
            onClick={() => handleOpenCreateAudit()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-xl border border-indigo-200 transition"
          >
            <ClipboardList className="w-4 h-4" />
            <span>{t('بدء جرد مخزني', 'Start Stocktake')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('إجمالي الأصناف المخزنية', 'Total Stock Items')}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalStockItemsCount}</h3>
            <span className="text-xs text-blue-600 font-semibold mt-0.5 inline-block">
              {linkedStockItemsCount} {t('صنف مربوط بمنتجات بيعية', 'linked to sales')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <PackageSearch className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('القيمة التقديرية للمخزون', 'Total Stock Valuation')}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatMoney(totalStockValuation)}</h3>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">
              {selectedBranchId !== 'all' ? branches.find((b) => b.id === selectedBranchId)?.name : t('بسعر تكلفة الشراء', 'At purchase cost')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('تنبيهات انخفاض المخزون', 'Low Stock Alerts')}</p>
            <h3 className={`text-2xl font-bold mt-1 ${lowStockItemsCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {lowStockItemsCount}
            </h3>
            <span className="text-xs text-rose-500 mt-0.5 inline-block">{t('وصل لحد إعادة الطلب', 'At or below reorder level')}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{t('المخازن المشغلة', 'Active Stores')}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{branchWarehouses.length}</h3>
            <span className="text-xs text-indigo-600 mt-0.5 inline-block">
              {selectedBranchId !== 'all' ? t('مخازن هذا الفرع', 'Branch warehouses') : `${branches.length} ${t('فروع مشغلة', 'branches')}`}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Automated Stock Alert System restricted to Warehouses Screen */}
      <LowStockAlertWidget
        onFilterProduct={(productName) => {
          setActiveTab('stock_items');
          setSearchQuery(productName);
        }}
      />

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 px-6 pt-4 gap-6 overflow-x-auto">
          <button
            id="tab-stock-items"
            onClick={() => setActiveTab('stock_items')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'stock_items'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t('الأصناف المخزنية والتحكم (+ / -)', 'Stock Items Control (+ / -)')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-bold">
              {stockItems.length}
            </span>
          </button>

          <button
            id="tab-movements"
            onClick={() => setActiveTab('movements')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'movements'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-indigo-600" />
            <span>{t('حركة وسجل المخازن والاستهلاك', 'Stock & Consumption Log')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 font-bold">
              {filteredMovements.length}
            </span>
          </button>

          <button
            id="tab-cost-mapping"
            onClick={() => setActiveTab('cost_mapping')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'cost_mapping'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link className="w-4 h-4 text-emerald-600" />
            <span>{t('ربط الأصناف المخزنية بالأصناف البيعية وتحديد تكلفة البيع', 'Link Stock to Sales & COGS')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 font-bold">
              {t('تحديد التكلفة', 'BOM')}
            </span>
          </button>

          <button
            id="tab-consumption-forecast"
            onClick={() => setActiveTab('consumption_forecast')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'consumption_forecast'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>{t('تقارير الاستهلاك والتوقعات المستقبلية من المبيعات', 'Sales Consumption & Forecast')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 font-bold">
              {t('ذكي', 'AI')}
            </span>
          </button>

          <button
            id="tab-audits"
            onClick={() => setActiveTab('audits')}
            className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'audits'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>{t('جلسات الجرد واستخراج الفروق والتسويات', 'Stocktake Audits & Settlements')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-bold">
              {inventoryAudits.length}
            </span>
          </button>
        </div>

        {/* TAB 2: Cost Mapping (BOM - ربط الأصناف المخزنية بالأصناف البيعية وتحديد تكلفة البيع) */}
        {activeTab === 'cost_mapping' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-emerald-50/60 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 rounded-xl">
                    <Link className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-300">
                    {t('ربط الأصناف المخزنية بالأصناف البيعية لتحديد تكلفة البيع', 'Link Stock Items to Sales & Determine Cost of Sale')}
                  </h3>
                </div>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-400 leading-relaxed">
                  {t(
                    'قم بربط الخامات والمستهلكات المخزنية بكل صنف أو خدمة بيعية وتحديد كمية الاستهلاك. يتم حساب تكلفة البيع وهامش الربح تلقائياً وتنعكس فوراً في شاشة المنتجات والخدمات وتقارير المبيعات.',
                    'Map raw stock consumables to sales services/products to calculate Cost of Goods Sold (COGS) and profit margins automatically.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
                  {stockItems.filter(s => s.linkedSalesProductIds && s.linkedSalesProductIds.length > 0).length} {t('خامة مخزنية مربوطة حالياً', 'stock items mapped')}
                </span>
              </div>
            </div>

            {/* Cost Mapping Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block">{t('إجمالي الأصناف والخدمات البيعية:', 'Total Sales Items:')}</span>
                <span className="text-xl font-bold text-slate-800 dark:text-white mt-1 block">
                  {salesItems.length}
                </span>
                <span className="text-[11px] text-blue-600 mt-0.5 block">
                  {salesItems.filter(s => s.isService || s.itemType === 'sales_service').length} {t('خدمة طبية', 'services')} • {salesItems.filter(s => !s.isService && s.itemType !== 'sales_service').length} {t('منتج تجاري', 'products')}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block">{t('أصناف بيعية محددة التكلفة بمخزون:', 'Items with Stock Recipe:')}</span>
                <span className="text-xl font-bold text-emerald-600 mt-1 block">
                  {salesItems.filter(sp => getSalesProductRecipe(sp).isCalculatedFromStock).length} {t('صنف بيعي', 'items')}
                </span>
                <span className="text-[11px] text-emerald-700 mt-0.5 block">
                  {Math.round((salesItems.filter(sp => getSalesProductRecipe(sp).isCalculatedFromStock).length / (salesItems.length || 1)) * 100)}% {t('نسبة التغطية بالوصفات', 'coverage ratio')}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block">{t('متوسط هامش الربح المحقق:', 'Average Profit Margin:')}</span>
                <span className="text-xl font-bold text-indigo-600 mt-1 block">
                  {Math.round(
                    salesItems.reduce((sum, sp) => sum + getSalesProductRecipe(sp).marginPercentage, 0) / (salesItems.length || 1)
                  )}%
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  {t('محسوب على أساس أسعار البيع وتكلفة الخامات', 'Based on sales prices vs recipe costs')}
                </span>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('بحث بالاسم أو الكود أو المجموعة البيعية...', 'Search sales product or service...')}
                  value={salesSearchQuery}
                  onChange={(e) => setSalesSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 font-medium">{t('المجموعة:', 'Category:')}</span>
                  <select
                    value={salesCategoryFilter}
                    onChange={(e) => setSalesCategoryFilter(e.target.value)}
                    className="bg-transparent font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="all">{t('جميع المجموعات', 'All Categories')}</option>
                    {salesCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sales Items Cost & Recipe Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">{t('الصنف البيعي (خدمة / منتج)', 'Sales Item / Service')}</th>
                    <th className="py-3.5 px-4">{t('المجموعة البيعية', 'Sales Category')}</th>
                    <th className="py-3.5 px-4">{t('سعر البيع للعميل', 'Selling Price')}</th>
                    <th className="py-3.5 px-4">{t('المكونات المخزنية المستهلكة (الخامات)', 'Linked Stock Recipe')}</th>
                    <th className="py-3.5 px-4 font-bold text-indigo-700 dark:text-indigo-400">{t('تكلفة البيع المحسوبة', 'Cost of Sale (COGS)')}</th>
                    <th className="py-3.5 px-4 text-emerald-700 dark:text-emerald-400 font-bold">{t('هامش الربح', 'Gross Margin')}</th>
                    <th className="py-3.5 px-4 text-center">{t('إدارة المكونات', 'Recipe Control')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSalesForMapping.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        {t('لا توجد أصناف بيعية مطابقة لبحثك', 'No matching sales items found')}
                      </td>
                    </tr>
                  ) : (
                    filteredSalesForMapping.map((sp) => {
                      const recipe = getSalesProductRecipe(sp);
                      const isService = sp.isService || sp.itemType === 'sales_service';

                      return (
                        <tr key={sp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${isService ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                              <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100">{sp.nameAr}</h4>
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                                  <span>{sp.sku}</span>
                                  <span>•</span>
                                  <span>{sp.unit || (isService ? 'جلسة' : 'قطعة')}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium">
                              {sp.category || '-'}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">
                            {formatMoney(sp.sellingPrice)}
                          </td>

                          <td className="py-3 px-4">
                            {recipe.ingredients.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                {recipe.ingredients.map((ing) => (
                                  <span
                                    key={ing.item.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[11px] font-semibold border border-blue-100 dark:border-blue-900/50"
                                    title={`${ing.item.nameAr}: ${ing.qty} ${ing.item.unit} (${formatMoney(ing.cost)})`}
                                  >
                                    <span>{ing.item.nameAr}</span>
                                    <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                                      ({ing.qty} {ing.item.unit})
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                {t('لم يتم ربط خامات مخزنية بعد', 'No stock ingredients linked')}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-bold text-indigo-700 dark:text-indigo-400">
                            {formatMoney(recipe.totalCost)}
                            {recipe.isCalculatedFromStock && (
                              <span className="text-[10px] block font-normal text-slate-400">
                                {t('محسوبة من الخامات', 'Calculated from stock')}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {formatMoney(recipe.profitMargin)}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold font-mono">
                                {recipe.marginPercentage}%
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleOpenRecipeModal(sp)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                            >
                              <Link className="w-3.5 h-3.5" />
                              <span>{t('تعديل المكونات والتكلفة', 'Edit Recipe / COGS')}</span>
                            </button>
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

        {activeTab === 'stock_items' && (
          <div className="p-6 space-y-5">
            {/* Filter Controls */}
            <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t(
                    'بحث بالاسم، كود SKU، وحدة التعريف، أو الباركود...',
                    'Search stock items, SKU, unit, barcode...'
                  )}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap">
                {/* Warehouse Selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 font-medium">{t('المخزن:', 'Store / Warehouse:')}</span>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">{t('جميع المخازن (الإجمالي)', 'All Stores')}</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Link Filter */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setFilterLinkedOnly('all')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      filterLinkedOnly === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {t('الكل', 'All')}
                  </button>
                  <button
                    onClick={() => setFilterLinkedOnly('linked')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                      filterLinkedOnly === 'linked' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span>{t('مربوط بأصناف بيعية', 'Linked')}</span>
                  </button>
                  <button
                    onClick={() => setFilterLinkedOnly('unlinked')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      filterLinkedOnly === 'unlinked' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {t('غير مربوط', 'Unlinked')}
                  </button>
                </div>
              </div>
            </div>

            {/* Stock Items Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">{t('الصنف المخزني', 'Stock Item')}</th>
                    <th className="py-3.5 px-4">{t('وحدة التعريف (يدوية)', 'Unit (Manual)')}</th>
                    <th className="py-3.5 px-4">{t('تكلفة الشراء', 'Unit Cost')}</th>
                    <th className="py-3.5 px-4">{t('الرصيد الحالي', 'Current Stock')}</th>
                    <th className="py-3.5 px-4">{t('حد الطلب', 'Reorder Level')}</th>
                    <th className="py-3.5 px-4">{t('الربط بالأصناف البيعية (لتكلفة البيع)', 'Linked Sales Items')}</th>
                    <th className="py-3.5 px-4 text-center">{t('التحكم السريع (+ / -)', 'Stock Control')}</th>
                    <th className="py-3.5 px-4 text-center">{t('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <PackageSearch className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-slate-500">{t('لا توجد أصناف مخزنية مطابقة', 'No stock items found')}</p>
                        <p className="text-xs text-slate-400 mt-1">{t('يمكنك تكويد وإضافة صنف مخزني جديد أعلاه', 'Add new stock raw item above')}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((prod) => {
                      const currentQty = getItemCurrentStock(prod.id);
                      const isLowStock = currentQty <= (prod.minStockLevel || 0);
                      const linkedCount = prod.linkedSalesProductIds?.length || 0;
                      const linkedSales = salesItems.filter((sp) => prod.linkedSalesProductIds?.includes(sp.id));

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <Layers className="w-4 h-4" />
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
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
                              {prod.unit || 'قطعة'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800">{formatMoney(prod.purchasePrice || 0)}</span>
                            <span className="text-[11px] text-slate-400 block">/ {prod.unit}</span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold text-base ${
                                  isLowStock ? 'text-rose-600' : 'text-slate-800'
                                }`}
                              >
                                {currentQty}
                              </span>
                              <span className="text-xs text-slate-400">{prod.unit}</span>
                            </div>
                            {isLowStock && (
                              <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                {t('حرج (تحت حد الطلب)', 'Low stock')}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-xs font-medium text-slate-600">
                              {prod.minStockLevel || 0} {prod.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {linkedCount > 0 ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                                    {linkedCount} {t('صنف بيعي', 'sales items')}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    ({prod.consumptionRate} {prod.unit} / {prod.consumptionBasis === 'revenue_ratio' ? '%' : t('جلسة', 'unit')})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                                  {linkedSales.map((s) => s.nameAr).join('، ')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                {t('غير مربوط بتكلفة بيع', 'Not linked')}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                              <button
                                onClick={() => handleOpenAdjust(prod, 'add')}
                                title={t('إضافة مخزنية / توريد (+)', 'Stock In (+)')}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition font-bold"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                onClick={() => handleOpenAdjust(prod, 'deduct')}
                                title={t('خصم مخزني / صرف / تالف (-)', 'Stock Out (-)')}
                                className="p-1.5 text-rose-700 hover:bg-rose-100 rounded-lg transition font-bold"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenLinkModal(prod)}
                                title={t('ربط بأصناف بيعية لتحديد تكلفة البيع', 'Link to sales items for COGS')}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <Link className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`هل تريد حذف الصنف المخزني (${prod.nameAr})؟`)) {
                                    deleteProduct(prod.id);
                                  }
                                }}
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

        {/* TAB 2: Sales-Driven Consumption & Future Forecasting */}
        {activeTab === 'consumption_forecast' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50/60 p-5 rounded-2xl border border-indigo-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-indigo-900">
                    {t('تقارير الاستهلاك والتوقعات المستقبلية من واقع المبيعات', 'Sales-Driven Consumption & Future Forecasting')}
                  </h3>
                </div>
                <p className="text-xs text-indigo-700/80 leading-relaxed">
                  {t(
                    'يتم حساب الاستهلاك الفعلي للمواد المخزنية آلياً استناداً إلى تقارير وجلسات المبيعات المنفذة ومعدلات الربط، مع توقع الاستهلاك القادم ومقترحات الشراء.',
                    'Actual raw material consumption is derived directly from clinic sales reports with future demand forecast and reorder recommendations.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-indigo-200 text-xs font-semibold">
                  <button
                    onClick={() => setForecastPeriod('month')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      forecastPeriod === 'month' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {t('آخر 30 يوماً', 'Last 30 Days')}
                  </button>
                  <button
                    onClick={() => setForecastPeriod('quarter')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      forecastPeriod === 'quarter' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {t('الربع الحالي', 'Quarter')}
                  </button>
                </div>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 text-xs font-semibold rounded-xl border border-indigo-200 hover:bg-indigo-50 transition"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>{t('طباعة التقرير', 'Print Report')}</span>
                </button>
              </div>
            </div>

            {/* Forecasting Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block">{t('تكلفة الخامات المستهلكة بالمبيعات:', 'Consumed Stock Value (COGS):')}</span>
                <span className="text-xl font-bold text-indigo-700 mt-1 block">
                  {formatMoney(
                    consumptionForecastReport.reduce((sum, r) => sum + r.totalConsumedValue, 0)
                  )}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">{t('تم خصمها تلقائياً مع الفواتير والجلسات', 'Computed from billed sessions')}</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block">{t('أصناف مخزنية بحاجة لإعادة طلب عاجل:', 'Urgent Reorder Items:')}</span>
                <span className="text-xl font-bold text-rose-600 mt-1 block">
                  {consumptionForecastReport.filter((r) => r.isCritical).length} {t('خامات', 'items')}
                </span>
                <span className="text-[11px] text-rose-400 mt-0.5 block">{t('تكفي لأقل من 10 أيام تشغيل', 'Supply under 10 days')}</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block">{t('الميزانية المقترحة لأوامر الشراء القادمة:', 'Suggested Purchasing Budget:')}</span>
                <span className="text-xl font-bold text-emerald-700 mt-1 block">
                  {formatMoney(
                    consumptionForecastReport.reduce((sum, r) => sum + r.suggestedReorderCost, 0)
                  )}
                </span>
                <span className="text-[11px] text-emerald-600 mt-0.5 block">{t('لتغطية الاحتياج التشغيلي لـ 30 يوماً', 'For next 30 days demand')}</span>
              </div>
            </div>

            {/* Consumption & Forecasting Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">{t('الصنف المخزني', 'Stock Item')}</th>
                    <th className="py-3.5 px-4">{t('الرصيد المتاح', 'On Hand')}</th>
                    <th className="py-3.5 px-4 text-indigo-700">{t('المستهلك بالمبيعات', 'Consumed in Sales')}</th>
                    <th className="py-3.5 px-4">{t('معدل الحرق اليومي', 'Daily Burn Rate')}</th>
                    <th className="py-3.5 px-4 font-bold text-blue-700">{t('توقع 30 يوماً قادمة', '30-Day Forecast')}</th>
                    <th className="py-3.5 px-4">{t('توقع 60 يوماً', '60-Day Forecast')}</th>
                    <th className="py-3.5 px-4 text-center">{t('أيام التغطية المتبقية', 'Days of Supply')}</th>
                    <th className="py-3.5 px-4 text-emerald-700 font-bold">{t('الطلب المقترح', 'Suggested Reorder')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consumptionForecastReport.map((row) => (
                    <tr key={row.item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div>
                          <h4 className="font-bold text-slate-800">{row.item.nameAr}</h4>
                          <span className="text-xs text-slate-400 font-mono">{row.item.sku} • {row.item.unit}</span>
                          {row.linkedSalesNames.length > 0 && (
                            <p className="text-[11px] text-blue-600 mt-0.5 truncate max-w-[200px]">
                              {t('مربوط بـ:', 'Linked:')} {row.linkedSalesNames.join('، ')}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800">
                        {row.currentOnHand} <span className="text-xs font-normal text-slate-400">{row.item.unit}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-indigo-700">
                          {row.totalConsumedFromSales} {row.item.unit}
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          {formatMoney(row.totalConsumedValue)}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-700">
                        {row.dailyBurnRate} <span className="text-xs text-slate-400">{row.item.unit} / {t('يوم', 'day')}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                          ~ {row.forecast30Days} {row.item.unit}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        ~ {row.forecast60Days} {row.item.unit}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                            row.daysOfSupplyRemaining <= 10
                              ? 'bg-rose-100 text-rose-800'
                              : row.daysOfSupplyRemaining <= 25
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{row.daysOfSupplyRemaining > 365 ? '> سنة' : `${row.daysOfSupplyRemaining} يوم`}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {row.isCritical ? (
                          <div>
                            <span className="font-bold text-emerald-700 block">
                              + {row.suggestedReorderQty} {row.item.unit}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ({formatMoney(row.suggestedReorderCost)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('رصيد كافٍ', 'Adequate')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Audits & Settlements */}
        {activeTab === 'audits' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {t('جلسات الجرد المخزني الفعلي والتسويات', 'Inventory Audits & Variance Settlements')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    'إجراء الجرد الفعلي للمخازن، استخراج الفروق آلياً، والتسوية مع خيار تحميل العجز على الموظفين وخصمه من المرتبات',
                    'Stock audits, variance extraction, automated settlements, and payroll staff liabilities'
                  )}
                </p>
              </div>

              <button
                onClick={() => handleOpenCreateAudit()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <ClipboardList className="w-4 h-4" />
                <span>{t('بدء جرد جديد', 'New Stocktake')}</span>
              </button>
            </div>

            {/* Audits Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">{t('رقم الجرد', 'Audit #')}</th>
                    <th className="py-3 px-4">{t('المخزن والفرع', 'Store & Branch')}</th>
                    <th className="py-3 px-4">{t('تاريخ الجرد', 'Audit Date')}</th>
                    <th className="py-3 px-4">{t('القيمة الدفترية', 'Expected Value')}</th>
                    <th className="py-3 px-4">{t('القيمة الفعلية', 'Actual Value')}</th>
                    <th className="py-3 px-4 text-rose-600">{t('العجز (Shortage)', 'Shortage')}</th>
                    <th className="py-3 px-4 text-emerald-600">{t('الزيادة (Surplus)', 'Surplus')}</th>
                    <th className="py-3 px-4 text-center">{t('الحالة', 'Status')}</th>
                    <th className="py-3 px-4 text-center">{t('التسوية', 'Settlement')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryAudits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-slate-500">{t('لا توجد جلسات جرد سابقة', 'No inventory audits yet')}</p>
                        <p className="text-xs text-slate-400 mt-1">{t('ابدأ جرد مخزني جديد لمطابقة الأرصدة', 'Start an audit to verify physical stock')}</p>
                      </td>
                    </tr>
                  ) : (
                    inventoryAudits.map((audit) => (
                      <tr key={audit.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {audit.auditNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 block">{audit.warehouseName}</span>
                          <span className="text-xs text-slate-400">{audit.branchName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs font-mono">{audit.auditDate}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">{formatMoney(audit.totalExpectedValue)}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{formatMoney(audit.totalActualValue)}</td>
                        <td className="py-3 px-4 font-bold text-rose-600">
                          {audit.totalShortageValue > 0 ? formatMoney(audit.totalShortageValue) : '-'}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600">
                          {audit.totalSurplusValue > 0 ? formatMoney(audit.totalSurplusValue) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              audit.status === 'Settled'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {audit.status === 'Settled' ? t('تمت التسوية', 'Settled') : t('قيد المراجعة', 'Pending')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {audit.status === 'Settled' ? (
                            <div className="text-xs text-slate-500">
                              <span className="font-bold text-slate-700 block">{audit.settlementType}</span>
                              <span className="font-mono text-[10px] text-indigo-600">{audit.journalNumber}</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenSettleModal(audit)}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                            >
                              {t('تسوية الجرد', 'Settle Audit')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* 1. Modal: Add New Stock Item */}
      {showAddStockItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <PackageSearch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {t('تكويد وإضافة صنف مخزني جديد', 'Add New Stock Item')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('خامات، مستلزمات طبية، أو مستهلكات مع وحدة تعريف يدوية', 'Raw materials or consumables with manual unit definition')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddStockItemModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddStockItem} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('اسم الصنف المخزني (بالعربي) *', 'Stock Item Name (Arabic) *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: جل ليزر تبريد، شيت سرير طبي، قفازات لاتكس..."
                    value={stockItemForm.nameAr}
                    onChange={(e) => setStockItemForm({ ...stockItemForm, nameAr: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('الاسم بالإنجليزي (اختياري)', 'Name (English)')}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Laser Cooling Gel"
                    value={stockItemForm.nameEn}
                    onChange={(e) => setStockItemForm({ ...stockItemForm, nameEn: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('وحدة التعريف اليدوية *', 'Manual Unit *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مل، سم³، قطعة، جرام، فيال، شيت، باكت..."
                    value={stockItemForm.unit}
                    onChange={(e) => setStockItemForm({ ...stockItemForm, unit: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('كود الصنف (SKU) *', 'SKU *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={stockItemForm.sku}
                    onChange={(e) => setStockItemForm({ ...stockItemForm, sku: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('التصنيف المخزني', 'Category')}
                  </label>
                  <input
                    type="text"
                    value={stockItemForm.category}
                    onChange={(e) => setStockItemForm({ ...stockItemForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('تكلفة شراء الوحدة (ج.م) *', 'Purchase Cost (EGP) *')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={0}
                    value={stockItemForm.purchasePrice}
                    onChange={(e) => setStockItemForm({ ...stockItemForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('حد إعادة الطلب (Min Level)', 'Min Reorder Level')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={stockItemForm.minStockLevel}
                    onChange={(e) => setStockItemForm({ ...stockItemForm, minStockLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('الرصيد الافتتاحي', 'Opening Stock')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={stockItemForm.initialStock}
                    onChange={(e) => setStockItemForm({ ...stockItemForm, initialStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Linking to Sales Products inside creation */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-blue-600" />
                    {t('ربط الصنف المخزني بأصناف بيعية (لحساب تكلفة البيع COGS)', 'Link to Sales Items for COGS')}
                  </span>
                </div>

                {/* Option to Link with ALL sales items and divide cost across all sales by value */}
                <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-xs">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(stockItemForm.linkToAllSales)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setStockItemForm({
                          ...stockItemForm,
                          linkToAllSales: checked,
                          linkedSalesProductIds: checked ? salesItems.map((s) => s.id) : [],
                          consumptionBasis: checked ? 'revenue_ratio' : 'units_sold',
                        });
                      }}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-blue-950 block">
                        {t('الربط مع جميع الأصناف البيعية وتقسيم تكلفته على كل المبيعات بالقيمة', 'Link with all sales items & divide cost across all sales by value')}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {t(
                          'تفعيل هذا الخيار يقوم بربط هذا الصنف المخزني تلقائياً بكافة الخدمات والمنتجات البيعية في العيادة، وتحميل تكلفتها كنسبة موزعة على القيمة البيعية لكل جلسة أو فاتورة مباعة.',
                          'Allocates this raw material cost across all clinical sales items proportionally based on invoice revenue value.'
                        )}
                      </p>
                    </div>
                  </label>
                </div>

                {!stockItemForm.linkToAllSales ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('اختر صنف بيعي لربطه فوراً:', 'Select Sales Item:')}
                      </label>
                      <select
                        multiple
                        value={stockItemForm.linkedSalesProductIds}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                          setStockItemForm({ ...stockItemForm, linkedSalesProductIds: selected });
                        }}
                        className="w-full h-24 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {salesItems.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.nameAr} ({sp.unit || 'جلسة'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {t('آلية الاستهلاك:', 'Consumption Basis:')}
                        </label>
                        <select
                          value={stockItemForm.consumptionBasis}
                          onChange={(e) => setStockItemForm({ ...stockItemForm, consumptionBasis: e.target.value as any })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="units_sold">{t('بعد الوحدات / الجلسات المباعة', 'Per Unit / Session Sold')}</option>
                          <option value="revenue_ratio">{t('بنسبة مئوية من قيمة الإيراد', 'Revenue Ratio %')}</option>
                          <option value="monthly_period">{t('استهلاك دوري شهرياً', 'Monthly Period')}</option>
                          <option value="client_count">{t('بعدد العملاء والزيارات', 'Per Client Visit')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {t('معدل الاستهلاك لكل وحدة بيع:', 'Consumption Rate:')}
                        </label>
                        <input
                          type="number"
                          step="any"
                          min={0}
                          value={stockItemForm.consumptionRate}
                          onChange={(e) => setStockItemForm({ ...stockItemForm, consumptionRate: parseFloat(e.target.value) || 1 })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <span className="font-bold">✓ {t('تم تفعيل الربط التلقائي الشامل:', 'Global Allocation Active:')}</span>
                    <span>{t(`مربوط بكافة الأصناف البيعية (${salesItems.length} صنف وخدمة)، وسيتم احتساب التكلفة وفق القيمة المالية لكل حركة بيع.`, `Linked to all (${salesItems.length}) sales items, cost is apportioned by revenue value.`)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStockItemModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-xl transition"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  {t('حفظ وتكويد الصنف', 'Save Stock Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Stock Adjust (+ / -) */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    adjustData.direction === 'add' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {adjustData.direction === 'add' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {adjustData.direction === 'add'
                      ? t('إضافة مخزنية / توريد (+)', 'Stock In (+)')
                      : t('خصم مخزني / صرف / تالف (-)', 'Stock Out (-)')}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">{adjustData.productName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('المخزن المستهدف *', 'Target Store *')}
                </label>
                <select
                  required
                  value={adjustData.warehouseId}
                  onChange={(e) => setAdjustData({ ...adjustData, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {adjustData.direction === 'add'
                    ? t('الكمية الواردة المراد إضافتها *', 'Quantity to Add *')
                    : t('الكمية المنصرفة المراد خصمها *', 'Quantity to Deduct *')}
                </label>
                <input
                  type="number"
                  required
                  min={0.1}
                  step="any"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('سبب الحركة / البيان *', 'Reason / Memo *')}
                </label>
                <input
                  type="text"
                  required
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('ملاحظات إضافية (اختياري)', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={adjustData.notes}
                  onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-xl transition"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition ${
                    adjustData.direction === 'add'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {adjustData.direction === 'add' ? t('تنفيذ الإضافة', 'Execute Stock In') : t('تنفيذ الخصم', 'Execute Stock Out')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Link Stock Item to Sales Products */}
      {showLinkModal && selectedStockItemForLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Link className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">
                    {t('ربط الصنف المخزني بأصناف بيعية', 'Link Stock Item to Sales')}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">{selectedStockItemForLink.nameAr}</p>
                </div>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLink} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('حدد الأصناف أو الخدمات البيعية المرتبطة:', 'Select Linked Sales Items:')}
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setLinkForm({ ...linkForm, linkedSalesProductIds: salesItems.map((s) => s.id) })}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      {t('تحديد الكل', 'All')}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setLinkForm({ ...linkForm, linkedSalesProductIds: [] })}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      {t('إلغاء التحديد', 'Clear')}
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-1">
                  {salesItems.map((sp) => {
                    const isChecked = linkForm.linkedSalesProductIds.includes(sp.id);
                    return (
                      <label
                        key={sp.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                          isChecked ? 'bg-blue-50/80 dark:bg-blue-950/40 font-semibold text-blue-900 dark:text-blue-200' : 'hover:bg-slate-100/70 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLinkForm({
                                  ...linkForm,
                                  linkedSalesProductIds: [...linkForm.linkedSalesProductIds, sp.id],
                                });
                              } else {
                                setLinkForm({
                                  ...linkForm,
                                  linkedSalesProductIds: linkForm.linkedSalesProductIds.filter((id) => id !== sp.id),
                                });
                              }
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>{sp.nameAr}</span>
                        </div>
                        <span className="font-mono text-slate-400 text-[11px]">{formatMoney(sp.sellingPrice)}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {t('تم تحديد', 'Selected')}: <span className="font-bold text-blue-600 dark:text-blue-400">{linkForm.linkedSalesProductIds.length}</span> {t('صنف بيعي', 'items')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('آلية الاستهلاك *', 'Consumption Basis *')}
                  </label>
                  <select
                    value={linkForm.consumptionBasis}
                    onChange={(e) => setLinkForm({ ...linkForm, consumptionBasis: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="units_sold">{t('بعدد الوحدات / الجلسات المباعة', 'Per Unit / Session')}</option>
                    <option value="revenue_ratio">{t('بنسبة من قيمة الإيراد (%)', 'Revenue Ratio (%)')}</option>
                    <option value="monthly_period">{t('استهلاك دوري شهرياً', 'Monthly Period')}</option>
                    <option value="client_count">{t('بعدد العملاء والزيارات', 'Per Client Visit')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('معدل الاستهلاك *', 'Consumption Rate *')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      required
                      value={linkForm.consumptionRate}
                      onChange={(e) => setLinkForm({ ...linkForm, consumptionRate: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-blue-700 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500 font-medium shrink-0">
                      {selectedStockItemForLink.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Calculated Cost preview */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                <span>{t('مساهمة هذا الصنف في تكلفة بيع الوحدة:', 'Unit cost contribution:')}</span>
                <span className="font-bold text-sm">
                  {formatMoney((linkForm.consumptionRate || 1) * (selectedStockItemForLink.purchasePrice || 0))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium rounded-xl transition cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition cursor-pointer"
                >
                  {t('حفظ وتحديث التكلفة', 'Save & Update Cost')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3.1 Modal: Manage Recipe / COGS for a Sales Item */}
      {showRecipeModal && selectedSalesForRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-xl">
                  <Link className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">
                    {t('إدارة وتعديل المكونات المخزنية وتكلفة البيع', 'Manage Stock Recipe & COGS')}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{selectedSalesForRecipe.nameAr}</span>
                    <span>•</span>
                    <span>{t('سعر البيع:', 'Selling Price:')} {formatMoney(selectedSalesForRecipe.sellingPrice)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowRecipeModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={t('بحث في الخامات والأصناف المخزنية المتاحة...', 'Search available stock items...')}
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Stock Items Selection List */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 grid grid-cols-12 gap-2">
                  <div className="col-span-1 text-center">{t('تفعيل', 'Link')}</div>
                  <div className="col-span-5">{t('الصنف المخزني (الخامة / المستهلك)', 'Stock Consumable')}</div>
                  <div className="col-span-3">{t('الكمية المستهلكة', 'Consumed Qty')}</div>
                  <div className="col-span-3 text-left">{t('التكلفة المحسوبة', 'Calculated Cost')}</div>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {stockItems
                    .filter((s) => s.nameAr.toLowerCase().includes(recipeSearch.toLowerCase()) || s.sku.toLowerCase().includes(recipeSearch.toLowerCase()))
                    .map((stk) => {
                      const itemState = recipeDraft[stk.id] || { isLinked: false, rate: 1, basis: 'units_sold' };
                      const itemCost = itemState.isLinked ? (itemState.rate || 1) * (stk.purchasePrice || 0) : 0;

                      return (
                        <div
                          key={stk.id}
                          className={`px-4 py-3 grid grid-cols-12 gap-2 items-center text-xs transition ${
                            itemState.isLinked ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <div className="col-span-1 flex justify-center">
                            <input
                              type="checkbox"
                              checked={itemState.isLinked}
                              onChange={(e) => {
                                setRecipeDraft({
                                  ...recipeDraft,
                                  [stk.id]: {
                                    ...itemState,
                                    isLinked: e.target.checked,
                                  },
                                });
                              }}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </div>

                          <div className="col-span-5">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{stk.nameAr}</span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span>{formatMoney(stk.purchasePrice || 0)} / {stk.unit}</span>
                              <span>•</span>
                              <span>{t('رصيد:', 'Stock:')} {getItemCurrentStock(stk.id)} {stk.unit}</span>
                            </div>
                          </div>

                          <div className="col-span-3">
                            {itemState.isLinked ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0.01}
                                  step="any"
                                  value={itemState.rate}
                                  onChange={(e) => {
                                    setRecipeDraft({
                                      ...recipeDraft,
                                      [stk.id]: {
                                        ...itemState,
                                        rate: parseFloat(e.target.value) || 0,
                                      },
                                    });
                                  }}
                                  className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <span className="text-slate-500 font-medium text-[11px]">{stk.unit}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </div>

                          <div className="col-span-3 text-left font-bold text-slate-800 dark:text-slate-200">
                            {itemState.isLinked ? formatMoney(itemCost) : '-'}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Recipe Summary & Margin Calculation */}
              {(() => {
                let totalCost = 0;
                Object.entries(recipeDraft).forEach(([stockId, draft]: [string, RecipeDraftItem]) => {
                  if (draft.isLinked) {
                    const stk = stockItems.find((s) => s.id === stockId);
                    if (stk) totalCost += (draft.rate || 1) * (stk.purchasePrice || 0);
                  }
                });
                const profit = selectedSalesForRecipe.sellingPrice - totalCost;
                const margin = selectedSalesForRecipe.sellingPrice > 0 ? Math.round((profit / selectedSalesForRecipe.sellingPrice) * 100) : 0;

                return (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-xs text-slate-500 block">{t('إجمالي تكلفة المكونات (COGS):', 'Total Stock COGS:')}</span>
                      <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mt-0.5 block">{formatMoney(totalCost)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">{t('سعر البيع الحالي:', 'Current Selling Price:')}</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white mt-0.5 block">{formatMoney(selectedSalesForRecipe.sellingPrice)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">{t('هامش الربح المتوقع:', 'Projected Margin:')}</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1.5">
                        {formatMoney(profit)} <span className="text-xs px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-full font-mono font-bold">({margin}%)</span>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setShowRecipeModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium rounded-xl transition cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveRecipeDraft}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('حفظ وتحديث تكلفة البيع', 'Save & Update COGS')}</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 4. Modal: Stock Transfer */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {t('تحويل مخزني بين المخازن', 'Stock Transfer Between Stores')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('نقل خامات أو مستلزمات بين فروع ومخازن الشركة', 'Move items between branches and stores')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('الصنف المخزني المراد نقله *', 'Stock Item *')}
                </label>
                <select
                  value={transferData.productId}
                  onChange={(e) => setTransferData({ ...transferData, productId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {stockItems.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('من مخزن (المصدر) *', 'From Store (Source) *')}
                  </label>
                  <select
                    value={transferData.fromWarehouseId}
                    onChange={(e) => setTransferData({ ...transferData, fromWarehouseId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('إلى مخزن (الوجهة) *', 'To Store (Destination) *')}
                  </label>
                  <select
                    value={transferData.toWarehouseId}
                    onChange={(e) => setTransferData({ ...transferData, toWarehouseId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('الكمية المراد تحويلها *', 'Quantity *')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={transferData.quantity}
                  onChange={(e) => setTransferData({ ...transferData, quantity: parseFloat(e.target.value) || 1 })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-xl transition"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTransfer}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  {t('تنفيذ التحويل المخزني', 'Execute Transfer')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Create Stock Audit */}
      {showCreateAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {t('بدء جلسة جرد مخزني فعلي ومطابقة الأرصدة', 'Start Physical Inventory Audit')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('إدخال العد الفعلي للأصناف واستخراج فروق العجز والزيادة آلياً', 'Count actual quantities and calculate shortages/surplus')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateAuditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('المخزن المراد جرده *', 'Store to Audit *')}
                  </label>
                  <select
                    value={newAuditWarehouseId}
                    onChange={(e) => {
                      setNewAuditWarehouseId(e.target.value);
                      const initialCounts: { [productId: string]: number } = {};
                      stockItems.forEach((p) => {
                        initialCounts[p.id] = getProductStock(p.id, e.target.value);
                      });
                      setAuditItemCounts(initialCounts);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('ملاحظات الجرد', 'Audit Notes')}
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: جرد دوري شهري، جرد فجائي..."
                    value={newAuditNotes}
                    onChange={(e) => setNewAuditNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Items Count Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">{t('الصنف المخزني', 'Stock Item')}</th>
                      <th className="py-2.5 px-3">{t('الوحدة', 'Unit')}</th>
                      <th className="py-2.5 px-3">{t('الرصيد الدفتري (السيستم)', 'System Qty')}</th>
                      <th className="py-2.5 px-3 text-indigo-700">{t('العد الفعلي الحقيقي *', 'Actual Count *')}</th>
                      <th className="py-2.5 px-3">{t('فارق الكمية', 'Variance')}</th>
                      <th className="py-2.5 px-3">{t('قيمة الفارق', 'Variance Value')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockItems.map((p) => {
                      const sysQty = getProductStock(p.id, newAuditWarehouseId);
                      const actQty = auditItemCounts[p.id] !== undefined ? auditItemCounts[p.id] : sysQty;
                      const diff = actQty - sysQty;
                      const diffVal = diff * (p.purchasePrice || 0);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">{p.nameAr}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{p.unit}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{sysQty}</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              step="any"
                              value={actQty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setAuditItemCounts((prev) => ({ ...prev, [p.id]: val }));
                              }}
                              className="w-24 px-2 py-1 bg-indigo-50/50 border border-indigo-200 rounded-lg font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            <span
                              className={
                                diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-emerald-600' : 'text-slate-400'
                              }
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            <span
                              className={
                                diffVal < 0 ? 'text-rose-600' : diffVal > 0 ? 'text-emerald-600' : 'text-slate-400'
                              }
                            >
                              {formatMoney(diffVal)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {t('يتم حفظ الجلسة بحالة "قيد المراجعة" لمراجعتها واعتماد التسوية لاحقاً.', 'Saved as pending review.')}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateAuditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 text-xs font-semibold rounded-xl transition"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAudit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  {t('حفظ جلسة الجرد واستخراج الفروق', 'Save Audit & Variances')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Settle Audit with Staff Payroll Deduction */}
      {showSettleModal && activeAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {t('تسوية الجرد المخزني وربط العجز بالمرتبات', 'Audit Settlement & Payroll Liability')}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">{activeAudit.auditNumber} - {activeAudit.warehouseName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Shortage / Surplus Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="text-xs text-rose-700 font-medium block">{t('إجمالي قيمة العجز (Shortage):', 'Total Shortage:')}</span>
                  <span className="text-xl font-bold text-rose-700">{formatMoney(activeAudit.totalShortageValue || 0)}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-xs text-emerald-700 font-medium block">{t('إجمالي قيمة الزيادة (Surplus):', 'Total Surplus:')}</span>
                  <span className="text-xl font-bold text-emerald-700">{formatMoney(activeAudit.totalSurplusValue || 0)}</span>
                </div>
              </div>

              {/* Settlement Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('طريقة تسوية ومعالجة فروق الجرد: *', 'Settlement Method: *')}
                </label>
                <select
                  value={settlementType}
                  onChange={(e) => setSettlementType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="staff_liability">{t('تحميل العجز على الموظف / الموظفين (استقطاع من المرتب)', 'Deduct Shortage from Staff Payroll')}</option>
                  <option value="write_off">{t('ترحيل كخسائر عجز مخزني للشركة (دون تحميل موظفين)', 'Company Write-Off Loss')}</option>
                  <option value="mixed">{t('تسوية مختلطة (نسبة على الموظف ونسبة على الشركة)', 'Mixed (Split between Staff & Company)')}</option>
                  <option value="inventory_adjustment_only">{t('تعديل كميات المخزن فقط (للفروق الطبيعية والزيادة)', 'Adjust Store Quantities Only')}</option>
                </select>
              </div>

              {/* Staff Liability Assignment Section */}
              {(settlementType === 'staff_liability' || settlementType === 'mixed') && (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" />
                      {t('تحميل العجز نسباً على الموظفين المسئولين:', 'Assign Shortage % across Staff:')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const unselected = staffMembers.find((s) => !staffLiabilities.some((l) => l.staffId === s.id));
                        if (unselected) {
                          setStaffLiabilities((prev) => [
                            ...prev,
                            {
                              staffId: unselected.id,
                              percentage: 0,
                              amount: 0,
                              deductionMonth: currentMonth,
                              notes: `تحميل عجز جرد ${activeAudit.auditNumber}`,
                            },
                          ]);
                        }
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      + {t('إضافة موظف آخر', 'Add Staff')}
                    </button>
                  </div>

                  {staffLiabilities.map((row, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-indigo-100 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-0.5">{t('الموظف المسؤول:', 'Staff Member:')}</label>
                          <select
                            value={row.staffId}
                            onChange={(e) => updateStaffLiabilityRow(idx, 'staffId', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            {staffMembers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nameAr} ({s.jobTitleAr || s.roleType})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-0.5">{t('النسبة المحملة (%):', 'Percentage (%):')}</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={row.percentage}
                            onChange={(e) => updateStaffLiabilityRow(idx, 'percentage', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-indigo-700"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-0.5">{t('المبلغ المحمل (ج.م):', 'Amount (EGP):')}</label>
                          <input
                            type="number"
                            min={0}
                            value={row.amount}
                            onChange={(e) => updateStaffLiabilityRow(idx, 'amount', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-rose-700"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">
                          {t('شهر الخصم من المرتب:', 'Payroll Month:')} {row.deductionMonth}
                        </span>
                        {staffLiabilities.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setStaffLiabilities((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-[11px] text-rose-600 hover:text-rose-800"
                          >
                            {t('إزالة', 'Remove')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="cb-payroll-link"
                      checked={linkToPayroll}
                      onChange={(e) => setLinkToPayroll(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                    <label htmlFor="cb-payroll-link" className="text-xs font-semibold text-indigo-900 cursor-pointer">
                      {t('الربط التلقائي مع شاشة مسير الرواتب (تخصم تلقائياً من راتب الشهر المحدد)', 'Automatically link and deduct from staff payroll run')}
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('بيان وملاحظات التسوية:', 'Settlement Notes:')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('أسباب التسوية، رقم المحضر، أو أي تفاصيل إضافية...', 'Notes, investigation details...')}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSettlement}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  {t('اعتماد التسوية وترحيل القيود', 'Confirm Settlement & Post Journal')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
