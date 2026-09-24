import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Product } from '../types';
import { RevenueComparisonChart } from './RevenueComparisonChart';
import {
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Clock,
  Users,
  Award,
  DollarSign,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Calendar,
  Flame,
  Filter,
  Plus,
  ArrowRight,
  Zap,
  Tag,
  Stethoscope,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface PackageDashboardWidgetProps {
  onAssignPackage?: (pkg: Product) => void;
  onFilterByPackage?: (pkg: Product) => void;
}

export const PackageDashboardWidget: React.FC<PackageDashboardWidgetProps> = ({
  onAssignPackage,
  onFilterByPackage,
}) => {
  const {
    t,
    language,
    formatMoney,
    products,
    parties,
    invoices,
  } = usePlatform();

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeSubTab, setActiveSubTab] = useState<'ranking' | 'analytics' | 'revenue_chart' | 'clients'>('ranking');
  const [sortBy, setSortBy] = useState<'most_sold' | 'highest_revenue' | 'highest_completion' | 'sessions_count'>('most_sold');
  const [clientSearch, setClientSearch] = useState<string>('');

  // 1. All package products defined in the catalog
  const packageProducts = useMemo(() => {
    return products.filter((p) => p.isPackage || p.itemType === 'sales_package');
  }, [products]);

  // 2. All client package offers from all parties
  const clientOffersList = useMemo(() => {
    return parties.flatMap((p) =>
      (p.offers || []).map((off) => ({
        ...off,
        clientName: p.name,
        clientNameEn: p.nameEn || p.name,
        clientPhone: p.phone,
        clientSystemCode: p.systemCode,
        clientId: p.id,
      }))
    );
  }, [parties]);

  // 3. Invoices containing package items
  const packageInvoiceSales = useMemo(() => {
    const pkgIds = new Set(packageProducts.map((p) => p.id));
    const items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      invoiceNumber: string;
      customerId?: string;
      customerName?: string;
    }> = [];

    invoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        if (pkgIds.has(item.productId)) {
          items.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            invoiceNumber: inv.invoiceNumber,
            customerId: inv.customerId,
            customerName: inv.customerName,
          });
        }
      });
    });

    return items;
  }, [invoices, packageProducts]);

  // 4. Per-package comprehensive metrics
  const packageStats = useMemo(() => {
    return packageProducts.map((pkg) => {
      // Direct matches by packageProductId or fuzzy by name
      const matchingOffers = clientOffersList.filter((off) => {
        if (off.packageProductId === pkg.id) return true;
        if (off.offerNameAr && pkg.nameAr) {
          const cleanOff = off.offerNameAr.trim().toLowerCase();
          const cleanPkg = pkg.nameAr.trim().toLowerCase();
          return cleanOff.includes(cleanPkg) || cleanPkg.includes(cleanOff);
        }
        return false;
      });

      // Matching invoice items
      const matchingInvoices = packageInvoiceSales.filter((i) => i.productId === pkg.id);
      const invoiceQtySold = matchingInvoices.reduce((sum, i) => sum + i.quantity, 0);
      const invoiceRevenue = matchingInvoices.reduce((sum, i) => sum + i.lineTotal, 0);

      // Offer metrics
      const offerCount = matchingOffers.length;
      const offerTotalSessions = matchingOffers.reduce((sum, o) => sum + (Number(o.totalQuantity) || 0), 0);
      const offerConsumedSessions = matchingOffers.reduce((sum, o) => sum + (Number(o.consumedQuantity) || 0), 0);
      const offerRemainingSessions = matchingOffers.reduce((sum, o) => sum + (Number(o.remainingQuantity) || 0), 0);
      const offerRevenue = matchingOffers.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);

      // Total sold count: combine offers count and invoice sales count accurately
      const totalSoldCount = Math.max(offerCount, invoiceQtySold) || offerCount;

      // Effective total sessions: based on actual offers or fallback to pkg totalSessions * sold
      const effectiveTotalSessions = offerTotalSessions > 0
        ? offerTotalSessions
        : (totalSoldCount * (pkg.totalSessions || 1));

      // Effective consumed sessions
      const effectiveConsumedSessions = offerConsumedSessions;
      const effectiveRemainingSessions = effectiveTotalSessions - effectiveConsumedSessions;

      // Completion Rate %
      const completionRate = effectiveTotalSessions > 0
        ? Math.round((effectiveConsumedSessions / effectiveTotalSessions) * 100)
        : 0;

      // Effective revenue
      const effectiveRevenue = offerRevenue > 0
        ? offerRevenue
        : (invoiceRevenue > 0 ? invoiceRevenue : totalSoldCount * (pkg.sellingPrice || 0));

      return {
        package: pkg,
        totalSoldCount,
        totalRevenue: effectiveRevenue,
        totalSessions: effectiveTotalSessions,
        consumedSessions: effectiveConsumedSessions,
        remainingSessions: effectiveRemainingSessions,
        completionRate,
        offersCount: offerCount,
        activeOffersCount: matchingOffers.filter((o) => (o.remainingQuantity || 0) > 0).length,
        completedOffersCount: matchingOffers.filter((o) => (o.remainingQuantity || 0) === 0).length,
        subscribers: matchingOffers,
      };
    });
  }, [packageProducts, clientOffersList, packageInvoiceSales]);

  // 5. Sorted packages list based on user preference
  const sortedPackages = useMemo(() => {
    const list = [...packageStats];
    if (sortBy === 'most_sold') {
      list.sort((a, b) => b.totalSoldCount - a.totalSoldCount || b.totalRevenue - a.totalRevenue);
    } else if (sortBy === 'highest_revenue') {
      list.sort((a, b) => b.totalRevenue - a.totalRevenue || b.totalSoldCount - a.totalSoldCount);
    } else if (sortBy === 'highest_completion') {
      list.sort((a, b) => b.completionRate - a.completionRate || b.totalSessions - a.totalSessions);
    } else if (sortBy === 'sessions_count') {
      list.sort((a, b) => b.totalSessions - a.totalSessions);
    }
    return list;
  }, [packageStats, sortBy]);

  // 6. Global Overall Aggregate Statistics
  const globalStats = useMemo(() => {
    const totalSoldAll = packageStats.reduce((sum, s) => sum + s.totalSoldCount, 0);
    const totalRevenueAll = packageStats.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalSessionsAll = packageStats.reduce((sum, s) => sum + s.totalSessions, 0);
    const totalConsumedAll = packageStats.reduce((sum, s) => sum + s.consumedSessions, 0);
    const totalRemainingAll = Math.max(0, totalSessionsAll - totalConsumedAll);

    const overallRate = totalSessionsAll > 0
      ? Number(((totalConsumedAll / totalSessionsAll) * 100).toFixed(1))
      : 0;

    const topSeller = [...packageStats].sort((a, b) => b.totalSoldCount - a.totalSoldCount || b.totalRevenue - a.totalRevenue)[0];

    const activePackagesCount = clientOffersList.filter((o) => (o.remainingQuantity || 0) > 0).length;
    const completedPackagesCount = clientOffersList.filter((o) => (o.remainingQuantity || 0) === 0).length;

    return {
      totalSoldAll,
      totalRevenueAll,
      totalSessionsAll,
      totalConsumedAll,
      totalRemainingAll,
      overallRate,
      topSeller,
      activePackagesCount,
      completedPackagesCount,
      totalSubscribersCount: clientOffersList.length,
    };
  }, [packageStats, clientOffersList]);

  // 7. Filtered client offers for the Clients view
  const filteredClientOffers = useMemo(() => {
    return clientOffersList.filter((off) => {
      if (!clientSearch) return true;
      const q = clientSearch.toLowerCase();
      return (
        off.clientName.toLowerCase().includes(q) ||
        off.clientPhone.includes(q) ||
        (off.clientSystemCode && off.clientSystemCode.toLowerCase().includes(q)) ||
        off.offerNameAr.toLowerCase().includes(q)
      );
    });
  }, [clientOffersList, clientSearch]);

  return (
    <div
      id="widget-packages-dashboard"
      className="bg-white rounded-2xl border border-purple-200 shadow-sm overflow-hidden transition-all duration-300"
    >
      {/* Widget Header Banner */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-slate-50 border-b border-purple-100 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">
                {t('لوحة مؤشرات أداء باقات الجلسات', 'Session Packages Performance Dashboard')}
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                {packageProducts.length} {t('باقة بيعية معرفة', 'Registered Packages')}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Flame className="w-3 h-3 text-emerald-600" />
                {t('إحصائيات فورية حية', 'Live Metrics')}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {t(
                'تحليل فوري للباقات الأكثر مبيعاً، إجمالي الإيرادات، ومعدل إنجاز واستهلاك الجلسات (المستخدمة مقابل الإجمالي)',
                'Real-time analytics for top-selling packages, total revenue, and session completion rates'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-toggle-widget-collapse"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-sm transition"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-slate-500" />
                <span>{t('طي اللوحة', 'Collapse')}</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-slate-500" />
                <span>{t('توسيع اللوحة', 'Expand')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Widget KPI Stat Cards Row (Visible even when collapsed or expanded) */}
      <div className="p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-purple-50/20 border-b border-slate-100">
        {/* Metric 1: نسبة الإنجاز الإجمالية (Sessions Completion Rate) */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {t('نسبة إنجاز الجلسات (المستخدمة)', 'Overall Completion Rate')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-purple-700">
              {globalStats.overallRate}%
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              ({globalStats.totalConsumedAll} / {globalStats.totalSessionsAll} {t('جلسة', 'sessions')})
            </span>
          </div>

          {/* Completion Progress Bar */}
          <div className="mt-3">
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, globalStats.overallRate))}%` }}
                title={`${globalStats.overallRate}% مستهلك`}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1 font-medium">
              <span className="text-emerald-700 font-semibold">
                ✓ {globalStats.totalConsumedAll} {t('مستهلكة', 'Consumed')}
              </span>
              <span className="text-purple-700 font-semibold">
                ⏳ {globalStats.totalRemainingAll} {t('متبقية', 'Remaining')}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2: الباقة الأكثر مبيعاً (Top Best Seller) */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {t('الباقة الأكثر مبيعاً وإقبالاً', 'Most Sold Package')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition">
              <Award className="w-4 h-4" />
            </div>
          </div>

          {globalStats.topSeller && globalStats.topSeller.totalSoldCount > 0 ? (
            <div className="mt-2">
              <h4 className="text-sm font-bold text-slate-800 line-clamp-1" title={globalStats.topSeller.package.nameAr}>
                {language === 'ar' ? globalStats.topSeller.package.nameAr : globalStats.topSeller.package.nameEn}
              </h4>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-600" />
                  {globalStats.topSeller.totalSoldCount} {t('مبيعات', 'Sales')}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  {formatMoney(globalStats.topSeller.totalRevenue)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {t('إنجاز الجلسات في هذه الباقة:', 'Sessions rate:')}{' '}
                <span className="font-bold text-purple-600">{globalStats.topSeller.completionRate}%</span> ({globalStats.topSeller.consumedSessions}/{globalStats.topSeller.totalSessions})
              </p>
            </div>
          ) : (
            <div className="mt-2">
              <h4 className="text-sm font-semibold text-slate-400">
                {t('لا توجد مبيعات باقات مسجلة بعد', 'No package sales yet')}
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                {t('سيتم تصنيف الباقات فور تسجيل أي فاتورة أو إسناد', 'Packages will be ranked upon first sale')}
              </p>
            </div>
          )}
        </div>

        {/* Metric 3: إجمالي الجلسات المباعة والمتبقية */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {t('وعاء الجلسات المعتمدة', 'Sessions Pool')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-indigo-700">
              {globalStats.totalSessionsAll}
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {t('إجمالي الجلسات بالباقات', 'Total Sessions')}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>
              {t('باقات نشطة:', 'Active:')} <b className="text-purple-600">{globalStats.activePackagesCount}</b>
            </span>
            <span>
              {t('باقات مكتملة:', 'Done:')} <b className="text-emerald-600">{globalStats.completedPackagesCount}</b>
            </span>
          </div>
        </div>

        {/* Metric 4: إجمالي مبيعات وإيرادات الباقات */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {t('إيرادات مبيعات الباقات', 'Package Revenue')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-black text-emerald-700">
              {formatMoney(globalStats.totalRevenueAll)}
            </h3>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>
              {t('إجمالي المشتركين:', 'Clients:')} <b className="text-slate-800">{globalStats.totalSubscribersCount}</b>
            </span>
            <span className="text-xs text-emerald-600 font-semibold">
              {globalStats.totalSoldAll} {t('باقة مباعة', 'Sold')}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Interactive Body */}
      {isExpanded && (
        <div className="p-5 md:p-6 space-y-6">
          {/* Sub-Tabs and Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <button
                id="btn-tab-ranking"
                onClick={() => setActiveSubTab('ranking')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                  activeSubTab === 'ranking'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>{t('ترتيب الباقات الأكثر مبيعاً ونسبة الإنجاز', 'Most Sold Packages & Completion')}</span>
              </button>

              <button
                id="btn-tab-analytics"
                onClick={() => setActiveSubTab('analytics')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                  activeSubTab === 'analytics'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{t('تحليل استهلاك الجلسات', 'Sessions Breakdown')}</span>
              </button>

              <button
                id="btn-tab-revenue-chart"
                onClick={() => setActiveSubTab('revenue_chart')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                  activeSubTab === 'revenue_chart'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{t('مقارنة إيرادات الباقات بالمنتجات (Recharts)', 'Revenue Comparison Chart')}</span>
              </button>

              <button
                id="btn-tab-clients"
                onClick={() => setActiveSubTab('clients')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                  activeSubTab === 'clients'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t('سجل المشتركين بالباقات', 'Client Subscriptions')}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeSubTab === 'clients' ? 'bg-purple-800 text-purple-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {clientOffersList.length}
                </span>
              </button>
            </div>

            {/* Sorting controls for ranking view */}
            {activeSubTab === 'ranking' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  {t('الترتيب حسب:', 'Sort by:')}
                </span>
                <select
                  id="select-package-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="most_sold">{t('الأكثر مبيعاً وإسناداً', 'Most Sold / Assigned')}</option>
                  <option value="highest_revenue">{t('الأعلى إيراداً مالياً', 'Highest Revenue')}</option>
                  <option value="highest_completion">{t('الأعلى نسبة إنجاز للجلسات', 'Highest Completion Rate')}</option>
                  <option value="sessions_count">{t('الأكبر بعدد الجلسات', 'Total Sessions Count')}</option>
                </select>
              </div>
            )}
          </div>

          {/* SUB-TAB 1: RANKING OF MOST SOLD PACKAGES */}
          {activeSubTab === 'ranking' && (
            <div className="space-y-4">
              {sortedPackages.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">
                    {t('لم يتم تعريف أي باقات جلسات بيعية بعد!', 'No session packages defined yet!')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('يمكنك النقر على زر "إضافة باقة جلسات وعروض" بأعلى الشاشة لتعريف أول باقة', 'Click "Add Session Package" at the top to create your first package')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedPackages.map((item, idx) => {
                    const isTopThree = idx < 3;
                    const rankColor =
                      idx === 0
                        ? 'bg-amber-500 text-white'
                        : idx === 1
                        ? 'bg-slate-400 text-white'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-100 text-slate-700';

                    return (
                      <div
                        key={item.package.id}
                        id={`card-package-rank-${item.package.id}`}
                        className={`bg-white rounded-xl border p-4.5 transition hover:shadow-md flex flex-col justify-between ${
                          idx === 0
                            ? 'border-amber-300 ring-1 ring-amber-200/50 shadow-sm'
                            : 'border-slate-200'
                        }`}
                      >
                        <div>
                          {/* Top Card Header with Rank and Sales badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shadow-xs ${rankColor}`}>
                                #{idx + 1}
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-slate-800 leading-snug">
                                  {language === 'ar' ? item.package.nameAr : item.package.nameEn}
                                </h3>
                                <span className="text-[11px] text-slate-500">
                                  {item.package.category || t('باقة جلسات', 'Package')}
                                </span>
                              </div>
                            </div>

                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0">
                                <Award className="w-3 h-3 text-amber-600" />
                                {t('الأكثر طلباً', 'Top 1')}
                              </span>
                            )}
                          </div>

                          {/* Price and Sales count row */}
                          <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-[10px] font-medium text-slate-400 block">
                                {t('عدد مرات البيع / الإسناد', 'Times Sold')}
                              </span>
                              <span className="text-sm font-black text-purple-700 flex items-center gap-1 mt-0.5">
                                <Flame className="w-3.5 h-3.5 text-purple-600" />
                                {item.totalSoldCount} {t('مرة', 'sold')}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-medium text-slate-400 block">
                                {t('إجمالي الإيرادات', 'Total Revenue')}
                              </span>
                              <span className="text-sm font-black text-emerald-700 mt-0.5 block">
                                {formatMoney(item.totalRevenue)}
                              </span>
                            </div>
                          </div>

                          {/* Sessions Progress & Completion Rate (Core requirement) */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                                {t('نسبة إنجاز الجلسات:', 'Completion Rate:')}
                              </span>
                              <span className="font-bold text-purple-700">
                                {item.completionRate}%
                              </span>
                            </div>

                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  item.completionRate >= 80
                                    ? 'bg-emerald-500'
                                    : item.completionRate >= 40
                                    ? 'bg-purple-600'
                                    : 'bg-indigo-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, item.completionRate))}%` }}
                              />
                            </div>

                            {/* Detailed breakdown: Consumed vs Total sessions */}
                            <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                              <span>
                                {t('المستخدمة:', 'Used:')}{' '}
                                <b className="text-slate-800">{item.consumedSessions}</b> {t('جلسة', 'sess')}
                              </span>
                              <span>
                                {t('المتبقية:', 'Remaining:')}{' '}
                                <b className="text-purple-600">{item.remainingSessions}</b> {t('جلسة', 'sess')}
                              </span>
                              <span>
                                {t('الإجمالي:', 'Total:')}{' '}
                                <b className="text-slate-800">{item.totalSessions}</b>
                              </span>
                            </div>
                          </div>

                          {/* Linked service & validity tag */}
                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                            <span>
                              {t('صلاحية الباقة:', 'Validity:')}{' '}
                              <b>{item.package.validityDays || 180} {t('يوم', 'days')}</b>
                            </span>
                            <span>
                              {t('الجلسات لكل باقة:', 'Sessions:')}{' '}
                              <b className="text-purple-600">{item.package.totalSessions || 1}</b>
                            </span>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                          <button
                            id={`btn-assign-quick-${item.package.id}`}
                            onClick={() => onAssignPackage && onAssignPackage(item.package)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('إسناد فوري لعميل', 'Direct Assign')}</span>
                          </button>

                          {onFilterByPackage && (
                            <button
                              id={`btn-filter-quick-${item.package.id}`}
                              onClick={() => onFilterByPackage(item.package)}
                              title={t('عرض وتصفية في الجدول أدناه', 'View in table')}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: SESSIONS BREAKDOWN & ANALYTICS */}
          {activeSubTab === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Visual completion meter */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600" />
                    {t('ميزان استهلاك الجلسات التراكمي', 'Cumulative Sessions Meter')}
                  </h4>

                  <div className="text-center py-4 bg-purple-50/40 rounded-xl border border-purple-100">
                    <span className="text-4xl font-black text-purple-700 block">
                      {globalStats.overallRate}%
                    </span>
                    <span className="text-xs font-semibold text-slate-500 mt-1 block">
                      {t('نسبة إنجاز وتنفيذ الجلسات الإجمالية', 'Overall Delivered Sessions Ratio')}
                    </span>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-purple-800 border border-purple-200 shadow-xs">
                      {globalStats.totalConsumedAll} {t('منفذة', 'Completed')} / {globalStats.totalSessionsAll} {t('إجمالي مباع', 'Total Sold')}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">{t('جلسات منفذة ومستهلكة:', 'Delivered Sessions:')}</span>
                      <span className="font-bold text-emerald-700">{globalStats.totalConsumedAll} {t('جلسة', 'sessions')}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">{t('جلسات متبقية برصيد العملاء:', 'Remaining in Balances:')}</span>
                      <span className="font-bold text-purple-700">{globalStats.totalRemainingAll} {t('جلسة', 'sessions')}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">{t('متوسط الجلسات لكل باقة:', 'Average Sessions/Pkg:')}</span>
                      <span className="font-bold text-slate-800">
                        {packageProducts.length > 0
                          ? (packageProducts.reduce((sum, p) => sum + (p.totalSessions || 1), 0) / packageProducts.length).toFixed(1)
                          : 0} {t('جلسات', 'sessions')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Table of packages session usage */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800">
                      {t('جدول مقارنة استهلاك الجلسات حسب الباقة', 'Session Consumption Breakdown Table')}
                    </h4>
                    <span className="text-xs text-slate-500 font-medium">
                      {packageStats.length} {t('باقة', 'packages')}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">{t('اسم الباقة', 'Package Name')}</th>
                          <th className="py-2.5 px-3 text-center">{t('الجلسات لكل باقة', 'Sess/Pkg')}</th>
                          <th className="py-2.5 px-3 text-center">{t('المباع', 'Sold')}</th>
                          <th className="py-2.5 px-3 text-center">{t('الجلسات المستهلكة', 'Consumed')}</th>
                          <th className="py-2.5 px-3 text-center">{t('الجلسات المتبقية', 'Remaining')}</th>
                          <th className="py-2.5 px-3 text-center">{t('نسبة الإنجاز', 'Completion')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {packageStats.map((item) => (
                          <tr key={item.package.id} className="hover:bg-purple-50/30 transition">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {language === 'ar' ? item.package.nameAr : item.package.nameEn}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                              {item.package.totalSessions || 1}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-purple-700">
                              {item.totalSoldCount}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                              {item.consumedSessions}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-700">
                              {item.remainingSessions}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="bg-purple-600 h-full rounded-full"
                                    style={{ width: `${Math.min(100, item.completionRate)}%` }}
                                  />
                                </div>
                                <span className="font-bold text-purple-700">
                                  {item.completionRate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB: REVENUE COMPARISON RECHARTS */}
          {activeSubTab === 'revenue_chart' && (
            <div className="pt-1">
              <RevenueComparisonChart />
            </div>
          )}

          {/* SUB-TAB 3: CLIENT SUBSCRIPTIONS FEED */}
          {activeSubTab === 'clients' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-md">
                  <input
                    id="input-search-client-packages"
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder={t('بحث باسم العميل أو رقم الهاتف أو الباقة...', 'Search client name, phone or package...')}
                    className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Users className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                </div>
                <span className="text-xs text-slate-500">
                  {t('إجمالي اشتراكات العملاء:', 'Total Subscriptions:')} <b>{filteredClientOffers.length}</b>
                </span>
              </div>

              {filteredClientOffers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">
                    {t('لا توجد اشتراكات عملاء مطابقة', 'No matching client package subscriptions')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">{t('العميل / المريض', 'Client / Patient')}</th>
                        <th className="py-2.5 px-3">{t('اسم الباقة المشترك بها', 'Subscribed Package')}</th>
                        <th className="py-2.5 px-3 text-center">{t('الجلسات المستهلكة', 'Consumed')}</th>
                        <th className="py-2.5 px-3 text-center">{t('المتبقي', 'Remaining')}</th>
                        <th className="py-2.5 px-3 text-center">{t('نسبة الإنجاز', 'Progress')}</th>
                        <th className="py-2.5 px-3 text-center">{t('تاريخ الشراء', 'Purchase Date')}</th>
                        <th className="py-2.5 px-3 text-center">{t('الحالة', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredClientOffers.map((off) => {
                        const rate = off.totalQuantity > 0
                          ? Math.round(((off.consumedQuantity || 0) / off.totalQuantity) * 100)
                          : 0;

                        return (
                          <tr key={off.id} className="hover:bg-purple-50/25 transition">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-800">{off.clientName}</div>
                              <span className="text-[10px] text-slate-400">{off.clientPhone}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-purple-900">{off.offerNameAr}</div>
                              <span className="text-[10px] text-slate-400">{formatMoney(off.totalPrice)}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                              {off.consumedQuantity || 0} {t('جلسة', 'sess')}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-purple-700">
                              {off.remainingQuantity} {t('جلسة', 'sess')}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="bg-purple-600 h-full rounded-full"
                                    style={{ width: `${Math.min(100, rate)}%` }}
                                  />
                                </div>
                                <span className="font-bold text-slate-700 text-[11px]">{rate}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                              {off.purchaseDate || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {off.remainingQuantity === 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  {t('مكتملة 100%', 'Completed')}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {t('نشطة قيد الاستخدام', 'Active')}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
