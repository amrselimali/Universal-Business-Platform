import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { AuditRecord } from '../types';
import { loadAuditPage } from '../services/auditLogPaged';
import { AuditSnapshotModal } from './audit/AuditSnapshotModal';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  Trash2,
  Edit3,
  Calendar,
  User,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export const AuditTrailView: React.FC = () => {
  const { language, t, users, tenant } = usePlatform();
  const isRtl = language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');

  // قراءة مُرقَّمة من السيرفر: صفحة واحدة في كل مرة (لا تحميل للسجل كاملاً)
  const [rows, setRows] = useState<AuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const afterRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const reload = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const result = await loadAuditPage({
      tenantId: tenant.id,
      limit: 100,
      search: debouncedSearch,
      action: actionFilter,
      entity: entityFilter,
      userId: userFilter,
    });
    afterRef.current = result.nextAfter;
    setRows(result.rows);
    setTotal(result.total);
    setHasMore(Boolean(result.nextAfter));
    setLoading(false);
  }, [tenant?.id, debouncedSearch, actionFilter, entityFilter, userFilter]);

  const loadMore = useCallback(async () => {
    if (!tenant?.id || !afterRef.current || loading) return;
    setLoading(true);
    const result = await loadAuditPage({
      tenantId: tenant.id,
      limit: 100,
      afterId: afterRef.current,
      search: debouncedSearch,
      action: actionFilter,
      entity: entityFilter,
      userId: userFilter,
    });
    afterRef.current = result.nextAfter;
    setRows((prev) => [...prev, ...result.rows]);
    setTotal(result.total);
    setHasMore(Boolean(result.nextAfter));
    setLoading(false);
  }, [tenant?.id, debouncedSearch, actionFilter, entityFilter, userFilter, loading]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Inspect / Reveal Snapshot Modal
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  const handleInspect = (record: AuditRecord) => {
    setSelectedRecord(record);
    setShowSnapshotModal(true);
  };

  const getEntityTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      Invoice: t('فواتير المبيعات', 'Sales Invoices'),
      Appointment: t('الحجوزات والمواعيد', 'Appointments'),
      TreatmentPlan: t('خطط العلاج', 'Treatment Plans'),
      Shift: t('شاشة التشغيل والشيفتات', 'Shifts & Operations'),
      Staff: t('فريق العمل والكادر', 'Staff Directory'),
      Party: t('سجل العملاء والموردين', 'Customers & Suppliers'),
      Product: t('الخدمات والمنتجات', 'Products & Services'),
      PaymentMethod: t('طرق السداد', 'Payment Methods'),
      Account: t('شجرة الحسابات', 'Accounting'),
      Branch: t('الفروع والمواقع', 'Branches'),
      Tenant: t('الشركات والمنشآت', 'Companies'),
      User: t('المستخدمين والصلاحيات', 'Users & Security'),
    };
    return map[type] || type;
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DELETE':
      case 'CANCEL':
        return {
          bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          label: t('حذف وإلغاء', 'DELETED'),
        };
      case 'ARCHIVE':
        return {
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          label: t('أرشفة', 'ARCHIVED'),
        };
      case 'UPDATE':
        return {
          bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
          icon: <Edit3 className="h-3.5 w-3.5" />,
          label: t('تعديل بيانات', 'MODIFIED'),
        };
      case 'CREATE':
        return {
          bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60',
          icon: <Edit3 className="h-3.5 w-3.5" />,
          label: t('إنشاء جديد', 'CREATED'),
        };
      case 'RESTORE':
        return {
          bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900/60',
          icon: <Edit3 className="h-3.5 w-3.5" />,
          label: t('استرجاع', 'RESTORED'),
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
          icon: <Edit3 className="h-3.5 w-3.5" />,
          label: action,
        };
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                {t('سجل الرقابة والأوديت (المحذوفات والتعديلات الحساسة)', 'Audit Trail: Deletions & Sensitive Modifications')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'كشف وتوثيق كافة العمليات التي تم حذفها أو تعديلها بأي موديول مع سبب الإلغاء/التعديل ومعاينة البيانات السابقة والحالية',
                  'Track and reveal all deleted or modified data records across all modules with reasons and diff snapshots'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            <span>{total} {t('عملية مسجلة بالرقابة', 'Recorded Audits')}</span>
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('بحث بالاسم أو السبب أو المستخدم...', 'Search entity or reason...')}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden"
          />
        </div>

        {/* Action Type */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-medium"
          >
            <option value="All">{t('كافة العمليات (حذف وتعديل)', 'All Action Types')}</option>
            <option value="DELETE">{t('حذف فقط (DELETE)', 'Deletions Only')}</option>
            <option value="CANCEL">{t('إلغاء فقط (CANCEL)', 'Cancellations Only')}</option>
            <option value="UPDATE">{t('تعديل فقط (UPDATE)', 'Modifications Only')}</option>
            <option value="ARCHIVE">{t('أرشفة (ARCHIVE)', 'Archived')}</option>
          </select>
        </div>

        {/* Entity / Module Filter */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
          <Layers className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-medium"
          >
            <option value="All">{t('كافة الكيانات', 'All Entities')}</option>
            <option value="Invoice">{t('فواتير المبيعات', 'Invoices')}</option>
            <option value="Appointment">{t('الحجوزات والمواعيد', 'Appointments')}</option>
            <option value="Shift">{t('شاشة التشغيل والشيفتات', 'Shift & Operations')}</option>
            <option value="Staff">{t('فريق العمل والكادر', 'Staff')}</option>
            <option value="Party">{t('العملاء والموردين', 'Customers & Suppliers')}</option>
            <option value="PaymentMethod">{t('طرق السداد', 'Payment Methods')}</option>
            <option value="Account">{t('الحسابات والقيود', 'Accounting')}</option>
            <option value="Product">{t('الخدمات والمنتجات', 'Products')}</option>
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
      </div>

      {/* Main Audit Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5">{t('التوقيت والتاريخ', 'Date & Time')}</th>
                <th className="p-3.5">{t('نوع الإجراء', 'Action Type')}</th>
                <th className="p-3.5">{t('الموديول / الكيان', 'Entity Type')}</th>
                <th className="p-3.5">{t('العنصر المستهدف', 'Entity')}</th>
                <th className="p-3.5">{t('المستخدم المنفذ', 'Performed By')}</th>
                <th className="p-3.5">{t('سبب الحذف / التعديل', 'Reason')}</th>
                <th className="p-3.5 text-center">{t('كشف وتفاصيل السجل', 'Reveal / Inspect')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ShieldAlert className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p>{t('لا توجد سجلات رقابة مطابقة.', 'No audit records matching search criteria.')}</p>
                  </td>
                </tr>
              ) : (
                rows.map((record) => {
                  const badge = getActionBadge(record.actionType);

                  return (
                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(record.timestamp).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border ${badge.bg}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {getEntityTypeLabel(record.entityType)}
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        {record.entityName}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {record.performedByName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ID: {record.performedById}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-600 dark:text-slate-300 max-w-xs">
                        {record.reason || record.details ? (
                          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px]">
                            {record.reason || record.details}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">{t('بدون سبب مسجل', 'No reason provided')}</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleInspect(record)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400 dark:hover:bg-indigo-900/60 rounded-xl transition-all cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>{t('اكشف التفاصيل والبيانات', 'Inspect Diff')}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2.5 text-[10px] dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            {t(`عُرض ${rows.length} من ${total}`, `Showing ${rows.length} of ${total}`)}
            {loading && t(' — جارٍ التحميل…', ' — loading…')}
          </span>
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={!hasMore || loading}
            className="rounded-xl bg-indigo-600 px-3 py-1.5 font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {hasMore ? t('تحميل المزيد', 'Load more') : t('وصلت للنهاية', 'End reached')}
          </button>
        </div>
      </div>

      <AuditSnapshotModal
        t={t}
        open={showSnapshotModal}
        record={selectedRecord}
        entityTypeLabel={selectedRecord ? getEntityTypeLabel(selectedRecord.entityType) : ""}
        onClose={() => setShowSnapshotModal(false)}
      />
    </div>
  );
};
