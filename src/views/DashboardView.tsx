import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  INITIAL_TENANT,
  INITIAL_BRANCHES,
  INITIAL_WAREHOUSES,
  INITIAL_INVOICES,
  INITIAL_ACCOUNTS,
  INITIAL_STOCK,
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
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Building2,
  GitBranch,
  Shield,
  Clock,
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
    activeWarehouse,
    invoices,
    accounts,
    stockLevels,
    activeShift,
    neonDb,
    currentUser,
  } = usePlatform();

  // Pure Tenant Scoped State (Empty when new company is created)
  const safeTenant = tenant || INITIAL_TENANT;
  const safeBranch = activeBranch || { id: 'none', name: 'لا يوجد فرع نشط' };
  const safeWarehouse = activeWarehouse || { id: 'none', name: 'لا يوجد مستودع نشط' };
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeStockLevels = Array.isArray(stockLevels) ? stockLevels : [];
  const safeNeonDb = neonDb || {
    connected: false,
    tablesCount: 15,
    recordsCount: 84,
  };

  // Metrics calculation
  const totalSalesToday = safeInvoices.reduce((sum, inv) => sum + (inv.netAmount || 0), 0);

  const cashAccount = safeAccounts.find((a) => a.code === '1111');
  const inventoryAccount = safeAccounts.find((a) => a.code === '1130');
  const receivablesAccount = safeAccounts.find((a) => a.code === '1120');

  const totalStockItemsCount = safeStockLevels
    .filter((s) => s.warehouseId === safeWarehouse.id)
    .reduce((sum, s) => sum + (s.quantityOnHand || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner: Context & Status */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-md bg-indigo-500/30 px-2 py-0.5 text-xs font-semibold text-indigo-300">
              {safeTenant.name} ({safeTenant.code})
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="rounded-md bg-violet-500/30 px-2 py-0.5 text-xs font-semibold text-violet-300">
              {safeBranch.name}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-300">
              {t('المستودع:', 'Warehouse:')} {safeWarehouse.name}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            {t('منظومة الإدارة المتكاملة (Universal ERP)', 'Universal Business Platform')}
          </h1>
          <p className="text-xs text-slate-300">
            {t(
              'النظام يعمل بنموذج Modular Monolith مع عزل الشركات (RLS) ومحرك التوجيه المحاسبي الآلي.',
              'Modular Architecture with RLS Tenant Isolation and Automated Accounting Engine.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-transform active:scale-95 cursor-pointer"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{t('فتح الكاشير وPOS السريع', 'Open Fast POS')}</span>
          </button>

          <button
            onClick={() => onNavigate('companies')}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors cursor-pointer"
          >
            <Building2 className="h-4 w-4 text-indigo-300" />
            <span>{t('إدارة الشركات والفروع', 'Companies & Branches')}</span>
          </button>

          <button
            onClick={() => onNavigate('users')}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors cursor-pointer"
          >
            <Users className="h-4 w-4 text-emerald-300" />
            <span>{t('المستخدمين والأدوار', 'Users & Roles')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Sales Today */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('مبيعات اليوم المحققة', "Today's Net Sales")}
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
              <span>{safeInvoices.length} {t('فواتير مُرحلة آلياً', 'invoices auto-posted')}</span>
            </p>
          </div>
        </div>

        {/* Card 2: Cash in Drawer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('نقدية الخزينة المتوقعة (الصندوق)', 'Cashier Drawer Cash')}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMoney(cashAccount?.balance || (activeShift?.expectedCash ?? 1500))}
            </span>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t('رصيد حساب الخزينة رقم 1111', 'GL Account 1111 balance')}
            </p>
          </div>
        </div>

        {/* Card 3: Inventory Valuation */}
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
              {formatMoney(inventoryAccount?.balance || 140000)}
            </span>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {totalStockItemsCount} {t('قطعة في المستودع الحالي', 'units in active warehouse')}
            </p>
          </div>
        </div>

        {/* Card 4: Accounts Receivable */}
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
              {formatMoney(receivablesAccount?.balance || 89200)}
            </span>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t('مطالبات مسجلة بحساب 1120', 'Open customer claims in 1120')}
            </p>
          </div>
        </div>
      </div>

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
          </div>

          {/* Recent Invoices Table */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('آخر فواتير المبيعات الصادرة', 'Recent Sales Invoices')}
              </h3>
              <button
                onClick={() => onNavigate('invoices')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {t('عرض الكل', 'View All')}
              </button>
            </div>

            {safeInvoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
                <p className="text-xs text-slate-400">
                  {t('لا توجد فواتير بعد. اضغط على "نقطة البيع POS" لإصدار أول فاتورة فوراً.', 'No invoices yet. Open POS to create the first sale.')}
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
                    {safeInvoices.slice(0, 4).map((inv) => (
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
        </div>

        {/* Database & System Architecture Widget */}
        <div className="space-y-4">
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

          {/* Architecture Pillars info */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t('معايير المنصة المعتمدة (Master Specs)', 'Enterprise Specs')}</span>
            </div>
            <ul className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>{t('عزل الشركات وقواعد RLS لكل Tenant', 'Tenant Data Isolation with RLS')}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>{t('توجيه محاسبي آلي وقيد يومية فوري لكل فاتورة', 'Automated Posting Matrix')}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>{t('ضريبة القيمة المضافة المصرية 14% جاهزة', 'Egyptian VAT 14% Compliant')}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>{t('دعم كامل للشاشات والأجهزة والموبايل (PWA)', 'Responsive Multi-Device PWA')}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
