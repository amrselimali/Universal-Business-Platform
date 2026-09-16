import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { AuditRecord } from '../types';
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
  const { language, t, auditRecords, users } = usePlatform();
  const isRtl = language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');

  // Inspect / Reveal Snapshot Modal
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  const filteredRecords = auditRecords.filter((rec) => {
    const matchesSearch =
      (rec.entityName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.performedByName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.reason && rec.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rec.details && rec.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rec.diffSummary && rec.diffSummary.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAction = actionFilter === 'All' || rec.actionType === actionFilter;
    const matchesEntity = entityFilter === 'All' || rec.entityType === entityFilter;
    const matchesUser = userFilter === 'All' || rec.performedById === userFilter;

    return matchesSearch && matchesAction && matchesEntity && matchesUser;
  });

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
            <span>{auditRecords.length} {t('عملية مسجلة بالرقابة', 'Recorded Audits')}</span>
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
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ShieldAlert className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p>{t('لا توجد سجلات رقابة مطابقة.', 'No audit records matching search criteria.')}</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
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
      </div>

      {/* Snapshot & Diff Modal */}
      {showSnapshotModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${
                    selectedRecord.actionType === 'DELETE' || selectedRecord.actionType === 'CANCEL' ? 'bg-rose-600' : 'bg-amber-600'
                  }`}
                >
                  {selectedRecord.actionType === 'DELETE' || selectedRecord.actionType === 'CANCEL' ? <Trash2 className="h-5 w-5" /> : <Edit3 className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {t('كشف تفاصيل السجل والبيانات', 'Audit Record Snapshot & Diff')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedRecord.entityName} • {getEntityTypeLabel(selectedRecord.entityType)} • {new Date(selectedRecord.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSnapshotModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Reason & User Details Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">{t('المستخدم المنفذ:', 'Performed By:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedRecord.performedByName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">{t('السبب المذكور للعملية:', 'Recorded Reason:')}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{selectedRecord.reason || selectedRecord.details || t('غير محدد', 'Unspecified')}</span>
              </div>
              {selectedRecord.diffSummary && (
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-300">{t('ملخص التغيير:', 'Diff Summary:')}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRecord.diffSummary}</span>
                </div>
              )}
            </div>

            {/* Data Snapshots Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Snapshot Before */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/40">
                <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t('البيانات السابقة (قبل التعديل أو الحذف)', 'Snapshot Before')}</span>
                </h4>
                <pre className="text-[11px] font-mono p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-60 text-slate-800 dark:text-slate-200">
                  {JSON.stringify(selectedRecord.previousState || {}, null, 2)}
                </pre>
              </div>

              {/* Snapshot After */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/40">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{t('البيانات الحالية (بعد التعديل)', 'Snapshot After')}</span>
                </h4>
                <pre className="text-[11px] font-mono p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-60 text-slate-800 dark:text-slate-200">
                  {selectedRecord.newState
                    ? JSON.stringify(selectedRecord.newState, null, 2)
                    : t('// تم الحذف بالكامل من النظام', '// Entity completely removed')}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowSnapshotModal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                {t('إغلاق النافذة', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
