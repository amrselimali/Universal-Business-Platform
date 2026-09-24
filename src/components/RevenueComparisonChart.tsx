import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Package,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight,
  Filter,
  BarChart2,
  PieChart as PieIcon,
  Activity,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface RevenueComparisonChartProps {
  className?: string;
  onNavigate?: (view: string) => void;
}

export const RevenueComparisonChart: React.FC<RevenueComparisonChartProps> = ({
  className = '',
  onNavigate,
}) => {
  const {
    t,
    language,
    formatMoney,
    invoices,
    products,
    parties,
    activeBranch,
  } = usePlatform();

  const [chartType, setChartType] = useState<'bar' | 'area' | 'donut'>('bar');
  const [timeRange, setTimeRange] = useState<'month' | 'two_weeks' | 'quarter'>('month');

  // Filter invoices strictly to the active branch
  const branchInvoices = useMemo(() => {
    return (invoices || []).filter((inv) => {
      if (!activeBranch || !activeBranch.id || activeBranch.id === 'none') return true;
      return inv.branchId === activeBranch.id;
    });
  }, [invoices, activeBranch]);

  // Set of package product IDs for fast lookup
  const packageProductIds = useMemo(() => {
    return new Set(
      products
        .filter((p) => p.isPackage || p.itemType === 'sales_package')
        .map((p) => p.id)
    );
  }, [products]);

  // Daily revenue data across the month - strictly derived from real transactions!
  const chartData = useMemo(() => {
    // Dynamic current month or default to active cycle
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthLabel = language === 'ar' ? monthNamesAr[month] : monthNamesEn[month];

    const dailyMap: {
      [dayKey: string]: {
        day: string;
        dateLabel: string;
        packageRevenue: number;
        productRevenue: number;
        totalRevenue: number;
        packagesCount: number;
        productsCount: number;
      };
    } = {};

    // Initialize all days of the current month with zero balances
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = d.toString().padStart(2, '0');
      const dayKey = `${monthPrefix}-${dayStr}`;
      dailyMap[dayKey] = {
        day: `${d}`,
        dateLabel: `${d} ${currentMonthLabel}`,
        packageRevenue: 0,
        productRevenue: 0,
        totalRevenue: 0,
        packagesCount: 0,
        productsCount: 0,
      };
    }

    // 1. Ingest actual sales invoices for the active branch only
    branchInvoices.forEach((inv) => {
      if (!inv.createdAt) return;
      const invDate = inv.createdAt.split('T')[0];
      
      let dayKey = invDate;
      // If invoice is in current month range
      if (!dailyMap[dayKey]) {
        const parts = invDate.split('-');
        if (parts.length === 3) {
          const invDay = parseInt(parts[2], 10);
          if (invDay >= 1 && invDay <= daysInMonth) {
            dayKey = `${monthPrefix}-${String(invDay).padStart(2, '0')}`;
          }
        }
      }

      if (dailyMap[dayKey]) {
        (inv.items || []).forEach((item) => {
          const isPkg = packageProductIds.has(item.productId);
          const amount = item.lineTotal || (item.quantity * item.unitPrice) || 0;
          if (isPkg) {
            dailyMap[dayKey].packageRevenue += amount;
            dailyMap[dayKey].packagesCount += item.quantity || 1;
          } else {
            dailyMap[dayKey].productRevenue += amount;
            dailyMap[dayKey].productsCount += item.quantity || 1;
          }
        });
      }
    });

    // 2. Ingest assigned client package offers for the active branch only
    (parties || []).forEach((party) => {
      if (activeBranch && party.branchId && party.branchId !== activeBranch.id) {
        if (!party.branchIds || !party.branchIds.includes(activeBranch.id)) return;
      }
      (party.offers || []).forEach((offer) => {
        if (offer.purchaseDate && dailyMap[offer.purchaseDate]) {
          dailyMap[offer.purchaseDate].packageRevenue += offer.totalPrice || 0;
          dailyMap[offer.purchaseDate].packagesCount += 1;
        }
      });
    });

    // Compute totals
    let allDays = Object.values(dailyMap).map((entry) => ({
      ...entry,
      totalRevenue: entry.packageRevenue + entry.productRevenue,
      packageShare:
        entry.packageRevenue + entry.productRevenue > 0
          ? Math.round((entry.packageRevenue / (entry.packageRevenue + entry.productRevenue)) * 100)
          : 0,
    }));

    // Filter by selected time range
    if (timeRange === 'two_weeks') {
      allDays = allDays.slice(7, 21); // middle two weeks
    } else if (timeRange === 'quarter') {
      // Return representative weekly aggregates
      const weeks: typeof allDays = [];
      for (let w = 0; w < 4; w++) {
        const slice = allDays.slice(w * 7, (w + 1) * 7);
        const pkgRev = slice.reduce((sum, d) => sum + d.packageRevenue, 0);
        const prdRev = slice.reduce((sum, d) => sum + d.productRevenue, 0);
        weeks.push({
          day: `${t('أسبوع', 'W')} ${w + 1}`,
          dateLabel: `${t('الأسبوع', 'Week')} ${w + 1}`,
          packageRevenue: pkgRev,
          productRevenue: prdRev,
          totalRevenue: pkgRev + prdRev,
          packagesCount: slice.reduce((sum, d) => sum + d.packagesCount, 0),
          productsCount: slice.reduce((sum, d) => sum + d.productsCount, 0),
          packageShare: pkgRev + prdRev > 0 ? Math.round((pkgRev / (pkgRev + prdRev)) * 100) : 0,
        });
      }
      return weeks;
    }

    return allDays;
  }, [invoices, parties, packageProductIds, language, timeRange, t]);

  // Aggregate monthly totals
  const aggregates = useMemo(() => {
    const totalPackages = chartData.reduce((sum, d) => sum + d.packageRevenue, 0);
    const totalProducts = chartData.reduce((sum, d) => sum + d.productRevenue, 0);
    const grandTotal = totalPackages + totalProducts;
    const packageRatio = grandTotal > 0 ? ((totalPackages / grandTotal) * 100).toFixed(1) : '0';
    const productRatio = grandTotal > 0 ? ((totalProducts / grandTotal) * 100).toFixed(1) : '0';

    // Find peak package revenue day
    const peakPackageDay = [...chartData].sort((a, b) => b.packageRevenue - a.packageRevenue)[0];

    return {
      totalPackages,
      totalProducts,
      grandTotal,
      packageRatio,
      productRatio,
      peakPackageDay,
      dailyAverage: chartData.length > 0 ? Math.round(grandTotal / chartData.length) : 0,
    };
  }, [chartData]);

  // Donut chart data representation
  const donutData = useMemo(() => [
    {
      name: t('إيرادات باقات الجلسات', 'Session Packages Revenue'),
      value: aggregates.totalPackages,
      color: '#7c3aed', // Purple-600
    },
    {
      name: t('إيرادات المنتجات والخدمات العادية', 'Regular Products & Services'),
      value: aggregates.totalProducts,
      color: '#059669', // Emerald-600
    },
  ], [aggregates, t]);

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
            <span className="font-bold text-slate-200">{dataPoint?.dateLabel || label}</span>
            <span className="text-[10px] text-purple-300 font-semibold">
              {t('مساهمة الباقات:', 'Package Share:')} {dataPoint?.packageShare || 0}%
            </span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between text-purple-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" />
                {t('إيرادات الباقات:', 'Packages:')}
              </span>
              <span className="font-bold font-mono">
                {formatMoney(dataPoint?.packageRevenue || 0)}
              </span>
            </div>

            <div className="flex items-center justify-between text-emerald-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                {t('المنتجات العادية:', 'Regular Products:')}
              </span>
              <span className="font-bold font-mono">
                {formatMoney(dataPoint?.productRevenue || 0)}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-700/80 pt-1.5 text-slate-100 font-bold">
              <span>{t('إجمالي اليوم:', 'Total Day:')}</span>
              <span className="font-mono text-amber-300">
                {formatMoney(dataPoint?.totalRevenue || 0)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="revenue-packages-vs-products-chart"
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-6 ${className}`}
    >
      {/* Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">
                  {t('مقارنة إيرادات الباقات بالمنتجات العادية على مدار الشهر', 'Packages vs. Regular Products Revenue (Monthly)')}
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  Recharts Analytics
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {t(
                  'تحليل بصري تفاعلي لمبيعات باقات الجلسات وعروضها مقارنة بمبيعات المنتجات والخدمات الفردية خلال الشهر',
                  'Interactive comparison of session packages sales against standard commercial items and services'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'month' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              {t('الشهر بالكامل', 'Full Month')}
            </button>
            <button
              onClick={() => setTimeRange('two_weeks')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'two_weeks' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              {t('14 يوماً', '14 Days')}
            </button>
            <button
              onClick={() => setTimeRange('quarter')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'quarter' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              {t('أسبوعياً', 'Weekly')}
            </button>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setChartType('bar')}
              title={t('رسم بياني شريطي', 'Bar Chart')}
              className={`p-1.5 rounded-lg transition flex items-center gap-1 ${
                chartType === 'bar' ? 'bg-white text-purple-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('شريطي', 'Bar')}</span>
            </button>
            <button
              onClick={() => setChartType('area')}
              title={t('رسم بياني مساحي', 'Area Chart')}
              className={`p-1.5 rounded-lg transition flex items-center gap-1 ${
                chartType === 'area' ? 'bg-white text-purple-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">{t('مساحي', 'Area')}</span>
            </button>
            <button
              onClick={() => setChartType('donut')}
              title={t('توزيع دائري', 'Donut Chart')}
              className={`p-1.5 rounded-lg transition flex items-center gap-1 ${
                chartType === 'donut' ? 'bg-white text-purple-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <PieIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('دائري', 'Donut')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlights Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Package Revenue */}
        <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              {t('إيرادات باقات الجلسات', 'Package Revenue')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 text-purple-800">
              {aggregates.packageRatio}%
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xl font-black text-purple-800">
              {formatMoney(aggregates.totalPackages)}
            </h4>
            <p className="text-[11px] text-purple-600/90 mt-0.5">
              {t('إجمالي مبيعات الباقات خلال الشهر', 'Total package sales in current month')}
            </p>
          </div>
        </div>

        {/* Metric 2: Regular Products Revenue */}
        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              {t('إيرادات المنتجات العادية', 'Regular Products')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
              {aggregates.productRatio}%
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xl font-black text-emerald-800">
              {formatMoney(aggregates.totalProducts)}
            </h4>
            <p className="text-[11px] text-emerald-600/90 mt-0.5">
              {t('أصناف تجارية وكشوفات فردية', 'Commercial retail & individual sessions')}
            </p>
          </div>
        </div>

        {/* Metric 3: Grand Combined Revenue */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              {t('إجمالي الإيرادات المجمعة', 'Grand Total Revenue')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
              100%
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xl font-black text-slate-900">
              {formatMoney(aggregates.grandTotal)}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t('متوسط يومي:', 'Daily Avg:')} {formatMoney(aggregates.dailyAverage)}
            </p>
          </div>
        </div>

        {/* Metric 4: Package Contribution Ratio */}
        <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900">
              {t('نسبة مساهمة الباقات', 'Package Contribution')}
            </span>
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <h4 className="text-xl font-black text-indigo-800">
                {aggregates.packageRatio}%
              </h4>
              <span className="text-[11px] font-semibold text-slate-500">
                {aggregates.peakPackageDay?.dateLabel || ''} (الأعلى)
              </span>
            </div>
            {/* Visual ratio bar */}
            <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden flex mt-2">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${aggregates.packageRatio}%` }}
                title={`باقات: ${aggregates.packageRatio}%`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="w-full h-[340px] pt-2">
        {chartType === 'donut' ? (
          <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="w-full md:w-1/2 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatMoney(val), t('القيمة', 'Revenue')]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#ffffff',
                      border: '1px solid #334155',
                      fontSize: '12px',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full md:w-1/2 space-y-4">
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-purple-600 inline-block" />
                    {t('باقات الجلسات والعروض', 'Packages')}
                  </span>
                  <span className="text-sm font-black text-purple-700">{aggregates.packageRatio}%</span>
                </div>
                <p className="text-xs text-slate-600">
                  {formatMoney(aggregates.totalPackages)} {t('محققة من اشتراكات وجلسات الباقات', 'from package sales')}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block" />
                    {t('المنتجات والخدمات الفردية', 'Regular Items')}
                  </span>
                  <span className="text-sm font-black text-emerald-700">{aggregates.productRatio}%</span>
                </div>
                <p className="text-xs text-slate-600">
                  {formatMoney(aggregates.totalProducts)} {t('محققة من مبيعات الصيدلية والكشوفات', 'from retail & consultations')}
                </p>
              </div>
            </div>
          </div>
        ) : chartType === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPackage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorProduct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                formatter={(val) => (
                  <span className="text-xs font-semibold text-slate-700">
                    {val === 'packageRevenue'
                      ? t('إيرادات الباقات (Purple)', 'Packages Revenue')
                      : t('إيرادات المنتجات العادية (Emerald)', 'Regular Products Revenue')}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="packageRevenue"
                name="packageRevenue"
                stroke="#7c3aed"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorPackage)"
              />
              <Area
                type="monotone"
                dataKey="productRevenue"
                name="productRevenue"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorProduct)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                formatter={(val) => (
                  <span className="text-xs font-semibold text-slate-700">
                    {val === 'packageRevenue'
                      ? t('إيرادات الباقات', 'Packages Revenue')
                      : t('إيرادات المنتجات العادية', 'Regular Products Revenue')}
                  </span>
                )}
              />
              <Bar
                dataKey="packageRevenue"
                name="packageRevenue"
                fill="#7c3aed"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
              <Bar
                dataKey="productRevenue"
                name="productRevenue"
                fill="#059669"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart Footer with Quick Navigation and Insights */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            {t(
              'تُحدث البيانات لحظياً فور إصدار أي فاتورة بيع أو تسجيل إسناد باقة جديدة لعميل.',
              'Data updates dynamically whenever a POS invoice or package assignment is executed.'
            )}
          </span>
        </div>

        {onNavigate && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('products')}
              className="text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 transition"
            >
              <span>{t('إدارة باقات الجلسات', 'Manage Packages')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition"
            >
              <span>{t('سجل الفواتير', 'Invoices Log')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
