import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { UserActivityLog } from '../types';
import {
  Clock,
  Search,
  Filter,
  User,
  Layers,
  Activity,
  Calendar,
  Shield,
  Download,
  LogIn,
  LogOut,
  PlusCircle,
  Edit,
  Trash2,
  Eye,
  Printer,
  RotateCcw,
  X,
  Building2,
} from 'lucide-react';

export const ActivityLogsView: React.FC = () => {
  const {
    language,
    t,
    activityLogs,
    userActivityLogs,
    allUserActivityLogs,
    allTenants,
    tenant,
    users,
  } = usePlatform();
  const isRtl = language === 'ar';

  const logsList =
    allUserActivityLogs && allUserActivityLogs.length > 0
      ? allUserActivityLogs
      : (userActivityLogs && userActivityLogs.length > 0)
      ? userActivityLogs
      : activityLogs || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [screenFilter, setScreenFilter] = useState<string>('All');
  const [actionFilter, setActionFilter] = useState<string>('All');

  const handleClearFilters = () => {
    setSearchQuery('');
    setTenantFilter('All');
    setUserFilter('All');
    setScreenFilter('All');
    setActionFilter('All');
  };

  const filteredLogs = logsList.filter((log) => {
    const matchesSearch =
      (log.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.screenNameAr || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.screenNameEn || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.actionNameAr || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.actionNameEn || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTenant = tenantFilter === 'All' || log.tenantId === tenantFilter;
    const matchesUser = userFilter === 'All' || log.userId === userFilter;
    const matchesScreen =
      screenFilter === 'All' ||
      log.screenId === screenFilter ||
      log.screenNameAr === screenFilter ||
      log.screenNameEn === screenFilter;
    const matchesAction =
      actionFilter === 'All' ||
      (log.actionNameEn && log.actionNameEn.toLowerCase().includes(actionFilter.toLowerCase())) ||
      (log.actionNameAr && log.actionNameAr.includes(actionFilter));

    return matchesSearch && matchesTenant && matchesUser && matchesScreen && matchesAction;
  });

  const getActionBadge = (actionName: string) => {
    const act = (actionName || '').toLowerCase();
    if (act.includes('login') || act.includes('دخول')) {
      return {
        icon: <LogIn className="h-3.5 w-3.5 text-emerald-600" />,
        bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200',
        label: t('تسجيل دخول', 'LOGIN'),
      };
    }
    if (act.includes('logout') || act.includes('خروج')) {
      return {
        icon: <LogOut className="h-3.5 w-3.5 text-slate-500" />,
        bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
        label: t('تسجيل خروج', 'LOGOUT'),
      };
    }
    if (act.includes('create') || act.includes('add') || act.includes('إضافة') || act.includes('إنشاء')) {
      return {
        icon: <PlusCircle className="h-3.5 w-3.5 text-indigo-600" />,
        bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200',
        label: t('إضافة وإنشاء', 'CREATE'),
      };
    }
    if (act.includes('update') || act.includes('edit') || act.includes('تعديل')) {
      return {
        icon: <Edit className="h-3.5 w-3.5 text-amber-600" />,
        bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
        label: t('تعديل', 'UPDATE'),
      };
    }
    if (act.includes('delete') || act.includes('refund') || act.includes('cancel') || act.includes('حذف') || act.includes('إلغاء')) {
      return {
        icon: <Trash2 className="h-3.5 w-3.5 text-rose-600" />,
        bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200',
        label: t('حذف / إلغاء', 'DELETE'),
      };
    }
    return {
      icon: <Activity className="h-3.5 w-3.5 text-indigo-600" />,
      bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200',
      label: actionName,
    };
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white shadow-md">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                {t('سجل نشاط المستخدمين (User Activities Log)', 'User Activity & Operations Log')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'توثيق زمني فوري لكافة الحركات والتفاعلات التي يقوم بها كل مستخدم في جميع شاشات النظام',
                  'Chronological tracking of every action performed by users across all system screens'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(searchQuery || userFilter !== 'All' || screenFilter !== 'All' || actionFilter !== 'All') && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('إعادة ضبط الفلاتر', 'Clear Filters')}</span>
            </button>
          )}
          <span className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-1.5">
            <Activity className="h-4 w-4" />
            <span>{logsList.length} {t('نشاط مسجل', 'Logged Activities')}</span>
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search */}
        <div className="relative flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('بحث بالوصف أو الشاشة أو المستخدم...', 'Search activity description...')}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden pe-6"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute end-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={t('مسح', 'Clear')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Company / Entity Filter */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
          <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-medium"
          >
            <option value="All">{t('كافة الشركات والمؤسسات', 'All Companies')}</option>
            {(allTenants && allTenants.length > 0 ? allTenants : tenant ? [tenant] : []).map((tn) => (
              <option key={tn.id} value={tn.id}>
                {tn.name}
              </option>
            ))}
          </select>
        </div>

        {/* User Filter */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
          <User className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-medium"
          >
            <option value="All">{t('كافة المستخدمين', 'All Users')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {/* Action Type Filter */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-medium"
          >
            <option value="All">{t('كافة أنواع الإجراءات', 'All Action Types')}</option>
            <option value="login">{t('تسجيل دخول (LOGIN)', 'LOGIN')}</option>
            <option value="logout">{t('تسجيل خروج (LOGOUT)', 'LOGOUT')}</option>
            <option value="create">{t('إضافة جديدة (CREATE)', 'CREATE')}</option>
            <option value="update">{t('تعديل (UPDATE)', 'UPDATE')}</option>
            <option value="delete">{t('حذف وإلغاء (DELETE)', 'DELETE')}</option>
          </select>
        </div>

        {/* Screen / Module Filter */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
          <Layers className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={screenFilter}
            onChange={(e) => setScreenFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-medium"
          >
            <option value="All">{t('كافة الشاشات', 'All Screens')}</option>
            <option value="companies">{t('إدارة الشركات والفروع والمخازن', 'Companies & Branches')}</option>
            <option value="users">{t('المستخدمين والصلاحيات', 'Users & Roles')}</option>
            <option value="products">{t('إدارة المنتجات والخدمات', 'Products & Services')}</option>
            <option value="reception_ops">{t('شاشة التشغيل', 'Operations')}</option>
            <option value="bookings">{t('الحجوزات والمتابعة', 'Bookings')}</option>
            <option value="pos">{t('نقطة البيع السريعة', 'POS')}</option>
            <option value="invoices">{t('فواتير المبيعات', 'Invoices')}</option>
            <option value="payment_methods">{t('طرق السداد', 'Payment Methods')}</option>
            <option value="staff">{t('فريق العمل والكادر', 'Staff')}</option>
            <option value="parties">{t('العملاء والموردين', 'Customers & Suppliers')}</option>
            <option value="inventory">{t('المخازن والأصناف', 'Inventory')}</option>
            <option value="accounting">{t('الحسابات والقيود', 'Accounting')}</option>
          </select>
        </div>
      </div>

      {/* Main Activity Timeline Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5">{t('الوقت والتاريخ', 'Timestamp')}</th>
                <th className="p-3.5">{t('المستخدم', 'User')}</th>
                <th className="p-3.5">{t('الإجراء', 'Action')}</th>
                <th className="p-3.5">{t('الشاشة / الموديول', 'Screen')}</th>
                <th className="p-3.5">{t('الوصف والتفاصيل', 'Description & Details')}</th>
                <th className="p-3.5">{t('عنوان IP', 'IP Address')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Clock className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p>{t('لا توجد سجلات نشاط مطابقة.', 'No activity logs matching the criteria.')}</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const badge = getActionBadge(log.actionNameEn || log.actionNameAr);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">{log.userName}</div>
                        <div className="text-[10px] text-slate-400">
                          {log.userRole} {log.userId ? `• ID: ${log.userId}` : ''}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-lg border ${badge.bg}`}>
                          {badge.icon}
                          <span>{language === 'ar' ? log.actionNameAr : log.actionNameEn}</span>
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                        <div>{language === 'ar' ? log.screenNameAr : log.screenNameEn}</div>
                        {log.tenantId && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            <span>
                              {allTenants?.find((t) => t.id === log.tenantId)?.name || (log.tenantId === 'tenant-barbie' ? 'شركة باربي' : log.tenantId)}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-700 dark:text-slate-300">
                        <div className="font-semibold">{log.details}</div>
                      </td>

                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {log.ipAddress || '192.168.1.1'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
