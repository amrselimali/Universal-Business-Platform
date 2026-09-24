import React, { useState, useEffect, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { SalesInvoice } from '../types';
import {
  Receipt,
  Search,
  Printer,
  X,
  QrCode,
  CheckCircle2,
  Calendar,
  CreditCard,
  Banknote,
  User,
  Shield,
  Filter,
  Building2,
  Lock,
  GitBranch,
} from 'lucide-react';

export const InvoicesView: React.FC = () => {
  const {
    t,
    formatMoney,
    invoices,
    tenant,
    activeBranch,
    setActiveBranch,
    branches,
    currentUser,
    users,
    language,
  } = usePlatform();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);

  // Initialize selectedBranchFilter with activeBranch id
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(
    activeBranch?.id || (branches.length > 0 ? branches[0].id : 'all')
  );
  const [selectedCashierFilter, setSelectedCashierFilter] = useState<string>('all');

  // Keep branch filter in sync with activeBranch whenever activeBranch changes anywhere in the platform
  useEffect(() => {
    if (activeBranch?.id) {
      setSelectedBranchFilter(activeBranch.id);
    }
  }, [activeBranch?.id]);

  // Check if current user is an Admin/Manager who can see all invoices of this tenant, or a restricted user
  const isSuperOrAdmin =
    currentUser?.role === 'SuperAdmin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.permissions?.includes('all');

  // Scoped invoices based on User Scope, Role, and Selected Branch
  const scopedInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Strict Tenant Isolation (Already scoped from PlatformContext, but double check)
      if (inv.tenantId !== tenant?.id) return false;

      // 2. Strict Branch Isolation (Only show invoices belonging to selected branch)
      if (selectedBranchFilter !== 'all') {
        if (inv.branchId !== selectedBranchFilter) return false;
      } else if (!isSuperOrAdmin && activeBranch?.id) {
        if (inv.branchId !== activeBranch.id) return false;
      }

      // 3. User Scoping:
      // If not Admin/SuperAdmin, only show invoices created by or linked to this cashier/user
      if (!isSuperOrAdmin) {
        const matchId =
          inv.cashierId === currentUser?.id ||
          inv.createdById === currentUser?.id ||
          (currentUser?.name && inv.cashierName?.includes(currentUser.name));
        if (!matchId) return false;
      }

      return true;
    });
  }, [invoices, tenant?.id, selectedBranchFilter, isSuperOrAdmin, activeBranch?.id, currentUser]);

  const filteredInvoices = useMemo(() => {
    return scopedInvoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.paymentMethod.toLowerCase().includes(q) ||
        inv.cashierName?.toLowerCase().includes(q);

      const matchCashier =
        selectedCashierFilter === 'all' ||
        inv.cashierId === selectedCashierFilter ||
        inv.cashierName === selectedCashierFilter;

      return matchQuery && matchCashier;
    });
  }, [scopedInvoices, searchQuery, selectedCashierFilter]);

  // Calculate stats strictly for the branch-scoped invoices
  const totalRevenue = scopedInvoices.reduce((sum, i) => sum + i.netAmount, 0);
  const totalVat = scopedInvoices.reduce((sum, i) => sum + i.taxAmount, 0);

  const selectedBranchObj = branches.find((b) => b.id === selectedBranchFilter) || activeBranch;

  return (
    <div className="space-y-6">
      {/* Company & Branch Scoping Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('فواتير شركة:', 'Company Invoices:')}
              </span>
              <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-extrabold text-white">
                {tenant?.name}
              </span>

              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('الفرع:', 'Branch:')}
              </span>
              <span className="rounded-md bg-violet-600 px-2 py-0.5 text-xs font-extrabold text-white inline-flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {selectedBranchFilter === 'all' ? t('كافة الفروع', 'All Branches') : (selectedBranchObj?.name || selectedBranchFilter)}
              </span>

              {isSuperOrAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Shield className="h-3 w-3" />
                  {t('صلاحية إدارة الفرع', 'Branch Admin Scope')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Lock className="h-3 w-3" />
                  {t('مقيد بفواتير المستخدم الحالي فقط', 'Scoped to Current User')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {selectedBranchFilter === 'all'
                ? t(
                    'تظهر هنا كافة الفواتير الصادرة عبر فروع هذه الشركة فقط دون تداخل مع أي شركة أخرى.',
                    'Displaying all invoices across branches for this company with complete tenant isolation.'
                  )
                : t(
                    `تظهر هنا الفواتير الصادرة والمسجلة على فرع (${selectedBranchObj?.name || 'المحدد'}) فقط دون تداخل مع الفروع الأخرى.`,
                    `Displaying invoices strictly issued for (${selectedBranchObj?.name || 'Selected'}) branch.`
                  )}
            </p>
          </div>
        </div>

        {/* Summary Mini Cards for current branch */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="text-end">
            <span className="text-slate-400 text-[10px] block">
              {selectedBranchFilter === 'all'
                ? t('إجمالي فواتير الشركة', 'Total Company Invoices')
                : t('إجمالي فواتير الفرع', 'Branch Invoices')}
            </span>
            <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">
              {scopedInvoices.length} {t('فاتورة', 'invoices')}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
          <div className="text-end">
            <span className="text-slate-400 text-[10px] block">
              {selectedBranchFilter === 'all'
                ? t('إجمالي مبيعات الشركة', 'Total Company Sales')
                : t('مبيعات الفرع الصافية', 'Branch Net Sales')}
            </span>
            <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
              {formatMoney(totalRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Header & Main Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {t('سجل فواتير المبيعات الصادرة', 'Sales Invoices Log')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'أرشيف الفواتير المكتملة للفرع مع إمكانية إعادة الطباعة، تدقيق الضريبة، ومراجعة القيد المحاسبي المرتبط.',
              'Completed invoices log for this branch with reprint capabilities and accounting audit verification.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Switcher for Admins */}
          {isSuperOrAdmin && branches.length > 1 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <GitBranch className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <select
                value={selectedBranchFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranchFilter(val);
                  if (val !== 'all') {
                    const targetBr = branches.find((b) => b.id === val);
                    if (targetBr) setActiveBranch(targetBr);
                  }
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none dark:text-slate-200 cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value="all">{t('كافة فروع الشركة (عرض شامل)', 'All Branches (Overview)')}</option>
              </select>
            </div>
          )}

          {/* Cashier Filter for Admins */}
          {isSuperOrAdmin && (
            <select
              value={selectedCashierFilter}
              onChange={(e) => setSelectedCashierFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">{t('كافة الكاشيرات والموظفين', 'All Cashiers')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('ابحث برقم الفاتورة أو العميل...', 'Search invoices...')}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 ps-9 pe-8 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute end-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title={t('مسح البحث', 'Clear')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Receipt className="h-12 w-12 mx-auto mb-2 text-slate-300 dark:text-slate-600 stroke-1" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('لا توجد فواتير مطابقة في نطاق الفرع المحدد', 'No invoices found in current branch scope')}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {selectedBranchObj
                ? t(
                    `لم يتم إصدار أي فواتير بيع في فرع (${selectedBranchObj.name}) بعد. عند إصدار فواتير من هذا الفرع ستظهر هنا فوراً.`,
                    `No sales invoices have been issued in (${selectedBranchObj.name}) branch yet.`
                  )
                : t('لم تقم بإصدار أي فواتير بيع في هذا النطاق بعد.', 'No sales invoices issued in this scope yet.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('رقم الفاتورة', 'Invoice #')}</th>
                  <th className="pb-3 font-bold text-start">{t('التاريخ والوقت', 'Date')}</th>
                  <th className="pb-3 font-bold text-start">{t('الفرع', 'Branch')}</th>
                  <th className="pb-3 font-bold text-start">{t('العميل / المريض', 'Customer / Patient')}</th>
                  <th className="pb-3 font-bold text-start">{t('الكاشير / المنشئ', 'Cashier')}</th>
                  <th className="pb-3 font-bold text-start">{t('طريقة الدفع', 'Payment')}</th>
                  <th className="pb-3 font-bold text-end">{t('المجموع قبل الضريبة', 'Subtotal')}</th>
                  <th className="pb-3 font-bold text-end">{t('ضريبة ق.م', 'VAT')}</th>
                  <th className="pb-3 font-bold text-end">{t('الصافي الإجمالي', 'Net Total')}</th>
                  <th className="pb-3 font-bold text-center">{t('عرض / طباعة', 'View / Print')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredInvoices.map((inv) => {
                  const branchObj = branches.find((b) => b.id === inv.branchId);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(inv.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="py-3 text-slate-700 dark:text-slate-300 font-semibold">
                        {branchObj ? branchObj.name : t('الفرع الرئيسي', 'Main Branch')}
                      </td>
                      <td className="py-3 font-bold text-slate-900 dark:text-white">{inv.customerName}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                          <User className="h-3 w-3 text-slate-400" />
                          {inv.cashierName || 'كاشير'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            inv.paymentMethod === 'Cash'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          }`}
                        >
                          {inv.paymentMethod === 'Cash' ? t('نقداً (كاش)', 'Cash') : t('فيزا / كارت', 'Card')}
                        </span>
                      </td>
                      <td className="py-3 text-end font-mono text-slate-500">
                        {formatMoney(inv.subtotal - inv.discountAmount)}
                      </td>
                      <td className="py-3 text-end font-mono text-slate-500">{formatMoney(inv.taxAmount)}</td>
                      <td className="py-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(inv.netAmount)}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {t('معاينة الإيصال', 'View Receipt')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {t('معاينة الفاتورة الضريبية', 'Tax Invoice Preview')}
              </span>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-center space-y-1 mb-3">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{tenant?.name}</h3>
                <p className="text-[11px] text-slate-500">
                  {branches.find((b) => b.id === selectedInvoice.branchId)?.name || activeBranch?.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {selectedInvoice.invoiceNumber} • {selectedInvoice.paymentMethod}
                </p>
                <p className="text-[10px] text-slate-400">
                  {new Date(selectedInvoice.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                </p>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 my-2 space-y-1 dark:border-slate-700">
                {selectedInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.productNameAr} x{item.quantity}
                    </span>
                    <span className="font-bold">{formatMoney(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>{t('المجموع قبل الضريبة:', 'Subtotal:')}</span>
                  <span>{formatMoney(selectedInvoice.subtotal - selectedInvoice.discountAmount)}</span>
                </div>
                {selectedInvoice.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('ضريبة ق.م (14%):', 'VAT (14%):')}</span>
                    <span>{formatMoney(selectedInvoice.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm border-t border-slate-300 pt-1 dark:border-slate-700 text-slate-900 dark:text-white">
                  <span>{t('الصافي النهائي:', 'Net Total:')}</span>
                  <span>{formatMoney(selectedInvoice.netAmount)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-3 pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                <QrCode className="h-10 w-10 text-slate-800 dark:text-slate-200" />
                <div className="text-[10px]">
                  <p className="font-bold">{t('منظومة الفاتورة الإلكترونية', 'Electronic Tax Compliant')}</p>
                  <p>{t('الكاشير:', 'Cashier:')} {selectedInvoice.cashierName}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>{t('طباعة (Print)', 'Print')}</span>
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {t('إغلاق', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
