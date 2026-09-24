import React, { useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { RevenueComparisonChart } from '../components/RevenueComparisonChart';
import {
  INITIAL_TENANT,
} from '../data/initialData';
import {
  TrendingUp,
  CreditCard,
  Package,
  Users,
  ShoppingCart,
  Calculator,
  Stethoscope,
  Database,
  ArrowUpRight,
  CheckCircle2,
  Building2,
  GitBranch,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    t,
    formatMoney,
    tenant,
    activeBranch,
    setActiveBranch,
    branches,
    activeWarehouse,
    invoices,
    accounts,
    stockLevels,
    products,
    activeShift,
    neonDb,
    currentUser,
    canAccessView,
    isModuleActive,
  } = usePlatform();

  // Pure Tenant & Branch Scoped State
  const safeTenant = tenant || INITIAL_TENANT;
  const safeBranch = activeBranch || { id: 'none', name: 'لا يوجد فرع نشط' };
  const safeWarehouse = activeWarehouse || { id: 'none', name: 'لا يوجد مخزن نشط' };
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeStockLevels = Array.isArray(stockLevels) ? stockLevels : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safeNeonDb = neonDb || {
    connected: false,
    tablesCount: 15,
    recordsCount: 84,
  };

  // 1. Strict Branch Invoices Filtering (Only for active authorized branch)
  const branchInvoices = useMemo(() => {
    return safeInvoices.filter((inv) => {
      if (!activeBranch || !activeBranch.id || activeBranch.id === 'none') return true;
      return inv.branchId === activeBranch.id;
    });
  }, [safeInvoices, activeBranch]);

  // 2. Metrics calculation strictly from real transactions of active branch (Zero dummy numbers)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = branchInvoices.filter((inv) => inv.createdAt?.startsWith(todayStr));
  const totalSalesToday = (todayInvoices.length > 0 ? todayInvoices : branchInvoices).reduce(
    (sum, inv) => sum + (inv.netAmount || 0),
    0
  );

  // Cash in Drawer (الصندوق / الخزينة) for active branch only
  const cashInDrawer = useMemo(() => {
    if (activeShift && (!activeShift.branchId || activeShift.branchId === activeBranch?.id)) {
      return activeShift.expectedCash ?? activeShift.startingCash ?? 0;
    }
    const cashAccount = safeAccounts.find((a) => a.code === '1111');
    return cashAccount?.balance ?? 0;
  }, [activeShift, activeBranch?.id, safeAccounts]);

  // Inventory Valuation (تقييم مخزون البضائع) for active warehouse / branch
  const inventoryValuation = useMemo(() => {
    const stockVal = safeStockLevels
      .filter((s) => s.warehouseId === safeWarehouse.id)
      .reduce((sum, s) => {
        const prod = safeProducts.find((p) => p.id === s.productId);
        const cost = prod?.purchasePrice || prod?.costPrice || prod?.sellingPrice || 0;
        return sum + (s.quantityOnHand || 0) * cost;
      }, 0);
    const inventoryAccount = safeAccounts.find((a) => a.code === '1130');
    return inventoryAccount?.balance || stockVal || 0;
  }, [safeStockLevels, safeWarehouse.id, safeProducts, safeAccounts]);

  // Accounts Receivable (مديونيات ومطالبات العملاء) for active branch
  const accountsReceivable = useMemo(() => {
    const openCustomerClaims = branchInvoices.reduce((sum, inv) => {
      const remaining = (inv.netAmount || 0) - (inv.paidAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);
    const receivablesAccount = safeAccounts.find((a) => a.code === '1120');
    return receivablesAccount?.balance || openCustomerClaims || 0;
  }, [branchInvoices, safeAccounts]);

  const totalStockItemsCount = safeStockLevels
    .filter((s) => s.warehouseId === safeWarehouse.id)
    .reduce((sum, s) => sum + (s.quantityOnHand || 0), 0);

  // Permission conditions for widgets
  const canSeeSales = canAccessView('pos') || canAccessView('invoices') || canAccessView('reception_ops');
  const canSeeCash = canAccessView('reception_ops') || canAccessView('accounting') || canAccessView('cash_receipts') || canAccessView('pos');
  const canSeeInventory = canAccessView('inventory') || canAccessView('inventory_mgmt') || canAccessView('products');
  const canSeeReceivables = canAccessView('parties') || canAccessView('accounting') || canAccessView('invoices');
  const canSeeRevenueChart = canAccessView('pos') || canAccessView('invoices') || canAccessView('accounting');

  return (
    <div className="space-y-6">
      {/* Top Banner: Context & Branch Selector */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-md bg-indigo-500/30 px-2 py-0.5 text-xs font-semibold text-indigo-300">
              {safeTenant.name} ({safeTenant.code})
            </span>
            <span className="text-xs text-slate-400">•</span>
            
            {/* Active Branch Badge & Selector if multiple branches authorized */}
            {branches.length > 1 ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-violet-500/30 px-2 py-0.5 text-xs font-semibold text-violet-200">
                <GitBranch className="h-3.5 w-3.5 text-violet-300" />
                <span className="text-[11px] text-violet-300">{t('الفرع المفعل:', 'Active Branch:')}</span>
                <select
                  value={activeBranch?.id || ''}
                  onChange={(e) => {
                    const selected = branches.find((b) => b.id === e.target.value);
                    if (selected) setActiveBranch(selected);
                  }}
                  className="bg-transparent text-white font-bold text-xs focus:outline-hidden cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="text-slate-900 bg-white">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="rounded-md bg-violet-500/30 px-2 py-0.5 text-xs font-semibold text-violet-300">
                {safeBranch.name}
              </span>
            )}

            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-300">
              {t('المخزن:', 'Warehouse / Store:')} {safeWarehouse.name}
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight">
            {t('منظومة الإدارة المتكاملة (Universal ERP)', 'Universal Business Platform')}
          </h1>
        </div>

        {/* Action Buttons Gated by Permissions */}
        <div className="flex flex-wrap items-center gap-2">
          {canAccessView('pos') && (
            <button
              onClick={() => onNavigate('pos')}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-transform active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>{t('فتح الكاشير وPOS السريع', 'Open Fast POS')}</span>
            </button>
          )}

          {canAccessView('companies') && (
            <button
              onClick={() => onNavigate('companies')}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors cursor-pointer"
            >
              <Building2 className="h-4 w-4 text-indigo-300" />
              <span>{t('إدارة الشركات والفروع', 'Companies & Branches')}</span>
            </button>
          )}

          {canAccessView('users') && (
            <button
              onClick={() => onNavigate('users')}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors cursor-pointer"
            >
              <Users className="h-4 w-4 text-emerald-300" />
              <span>{t('المستخدمين والأدوار', 'Users & Roles')}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid - Strictly Filtered by Branch & Permissions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Sales Today */}
        {canSeeSales && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('مبيعات اليوم المحققة بالفرع', "Today's Net Branch Sales")}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {formatMoney(totalSalesToday)}
              </span>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                <span>{branchInvoices.length} {t('فواتير مُرحلة للفرع', 'invoices for this branch')}</span>
              </p>
            </div>
          </div>
        )}

        {/* Card 2: Cash in Drawer */}
        {canSeeCash && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('نقدية الخزينة الفعلية (الصندوق)', 'Cashier Drawer Cash')}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {formatMoney(cashInDrawer)}
              </span>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {activeShift ? t('نقدية الوردية الحالية', 'Current open shift cash') : t('رصيد الصندوق المحاسبي', 'GL Cash account')}
              </p>
            </div>
          </div>
        )}

        {/* Card 3: Inventory Valuation */}
        {canSeeInventory && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('تقييم مخزون البضائع', 'Inventory Valuation')}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {formatMoney(inventoryValuation)}
              </span>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {totalStockItemsCount} {t('قطعة في المخزن الحالي', 'units in active warehouse/store')}
              </p>
            </div>
          </div>
        )}

        {/* Card 4: Accounts Receivable */}
        {canSeeReceivables && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('مديونيات العملاء (AR)', 'Accounts Receivable')}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {formatMoney(accountsReceivable)}
              </span>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {t('مطالبات مسجلة بحساب العملاء 1120', 'Open customer claims in 1120')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Packages vs Regular Products Monthly Revenue Chart */}
      {canSeeRevenueChart && (
        <RevenueComparisonChart onNavigate={onNavigate} />
      )}

      {/* Quick Launchpad & Workflows */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Core Operations Fast Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('مسارات العمل السريعة (One-Click Operations)', 'Operational Workflows')}
            </h2>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
              {t('إدخال فوري', 'Direct Access')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {canAccessView('pos') && (
              <button
                onClick={() => onNavigate('pos')}
                className="flex flex-col items-start rounded-xl border border-slate-100 bg-slate-50/80 p-4 hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all text-start group cursor-pointer"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white mb-2 group-hover:scale-105 transition-transform">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('فاتورة بيع سريعة (POS)', 'New POS Sale')}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {t('تخصم المخزن وتولد القيد المالي آلياً', 'Deducts stock & posts journal entry')}
                </p>
              </button>
            )}

            {canAccessView('accounting') && (
              <button
                onClick={() => onNavigate('accounting')}
                className="flex flex-col items-start rounded-xl border border-slate-100 bg-slate-50/80 p-4 hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all text-start group cursor-pointer"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white mb-2 group-hover:scale-105 transition-transform">
                  <Calculator className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('شجرة الحسابات والقيود', 'Chart of Accounts')}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {t('استعراض الأصول والخصوم وميزان المراجعة', 'Review GL, Trial Balance & Entries')}
                </p>
              </button>
            )}

            {canAccessView('clinics') && isModuleActive('clinics') && (
              <button
                onClick={() => onNavigate('clinics')}
                className="flex flex-col items-start rounded-xl border border-slate-100 bg-slate-50/80 p-4 hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all text-start group cursor-pointer"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white mb-2 group-hover:scale-105 transition-transform">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('العيادات وحجز المواعيد', 'Clinic & Bookings')}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {t('إدارة ملفات المرضى وبرامج الجلسات', 'Patient EHR & treatment plans')}
                </p>
              </button>
            )}
          </div>

          {/* Recent Invoices Table (Filtered by Branch) */}
          {(canAccessView('invoices') || canAccessView('pos')) && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('آخر فواتير المبيعات الصادرة بالفرع', 'Recent Branch Invoices')}
                </h3>
                <button
                  onClick={() => onNavigate('invoices')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {t('عرض الكل', 'View All')}
                </button>
              </div>

              {branchInvoices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
                  <p className="text-xs text-slate-400">
                    {t('لا توجد فواتير مسجلة لهذا الفرع بعد. اضغط على "نقطة البيع POS" لإصدار أول فاتورة فوراً.', 'No invoices recorded for this branch yet. Open POS to create the first sale.')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                        <th className="pb-2 font-semibold text-start">{t('رقم الفاتورة', 'Invoice #')}</th>
                        <th className="pb-2 font-semibold text-start">{t('العميل', 'Customer')}</th>
                        <th className="pb-2 font-semibold text-start">{t('طريقة الدفع', 'Payment')}</th>
                        <th className="pb-2 font-semibold text-end">{t('الصافي', 'Net')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {branchInvoices.slice(0, 4).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 font-bold text-indigo-600 dark:text-indigo-400">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-2.5 text-slate-800 dark:text-slate-200">{inv.customerName}</td>
                          <td className="py-2.5">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {inv.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2.5 text-end font-bold text-slate-900 dark:text-white">
                            {formatMoney(inv.netAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Database Widget - Gated by Permission (Master Specs completely removed) */}
        <div className="space-y-4">
          {canAccessView('neon') && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('قاعدة بيانات Neon PostgreSQL', 'Neon PostgreSQL Hub')}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    safeNeonDb.connected
                      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {safeNeonDb.connected ? t('متصل بالسحابة', 'Cloud Connected') : t('الوضع المحلي السريع', 'Local Mode')}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                {t(
                  'المنصة تدعم الربط المباشر مع قاعدة بيانات Neon المجانية أو التشغيل بدون خوادم خارجية ($0 Cost).',
                  'Supports direct Neon PostgreSQL cloud connection or zero-cost local execution.'
                )}
              </p>

              <button
                onClick={() => onNavigate('neon')}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50/60 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300 transition-colors cursor-pointer"
              >
                <span>{t('إدارة الاتصال وسكريبت الـ DDL', 'Open Database Hub & SQL')}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
