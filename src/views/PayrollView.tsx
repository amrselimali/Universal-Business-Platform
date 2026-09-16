import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { StaffPayrollItem, PayrollRun, StaffRoleType } from '../types';
import {
  Wallet,
  Plus,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  DollarSign,
  Building2,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  X,
  CreditCard,
  UserCheck,
  ChevronDown,
} from 'lucide-react';

export const PayrollView: React.FC = () => {
  const {
    t,
    formatMoney,
    language,
    tenant,
    activeBranch,
    branches,
    staffMembers,
    payrollRuns,
    generatePayrollRun,
    updatePayrollItem,
    payPayrollItem,
    payEntirePayrollRun,
    paymentMethods,
  } = usePlatform();

  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-09"
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [roleFilter, setRoleFilter] = useState<'ALL' | StaffRoleType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Edit Item Modal State
  const [editingItem, setEditingItem] = useState<StaffPayrollItem | null>(null);
  const [allowancesVal, setAllowancesVal] = useState<number>(0);
  const [deductionsVal, setDeductionsVal] = useState<number>(0);
  const [notesVal, setNotesVal] = useState<string>('');

  // Disburse Single Item Modal State
  const [payingItem, setPayingItem] = useState<StaffPayrollItem | null>(null);
  const [disburseMethod, setDisburseMethod] = useState<string>('الخزينة الرئيسية (نقداً)');
  const [disburseNotes, setDisburseNotes] = useState<string>('');

  // Disburse All Modal
  const [showDisburseAllModal, setShowDisburseAllModal] = useState<boolean>(false);
  const [bulkMethod, setBulkMethod] = useState<string>('الخزينة الرئيسية (نقداً)');

  // Printable Payslip / Summary
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printSingleItem, setPrintSingleItem] = useState<StaffPayrollItem | null>(null);

  // Active or selected run
  const activeRun = payrollRuns.find((r) => r.month === selectedMonth);

  // Handle generating run for month
  const handleGenerateRun = () => {
    generatePayrollRun(selectedMonth, activeBranch?.id);
  };

  // Filter items in the active run
  const filteredItems = (activeRun?.items || []).filter((item) => {
    const matchesRole = roleFilter === 'ALL' || item.roleType === roleFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.staffNameAr.toLowerCase().includes(q) ||
      item.staffNameEn.toLowerCase().includes(q) ||
      item.jobTitleAr.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  // Calculate Run KPI Totals
  const totalBasic = (activeRun?.items || []).reduce((s, i) => s + i.basicSalary, 0);
  const totalAllowances = (activeRun?.items || []).reduce((s, i) => s + i.allowances, 0);
  const totalDeductions = (activeRun?.items || []).reduce((s, i) => s + i.deductions, 0);
  const totalNet = (activeRun?.items || []).reduce((s, i) => s + i.netSalary, 0);
  const totalPaid = (activeRun?.items || []).reduce((s, i) => s + (i.paidAmount || 0), 0);
  const totalPending = totalNet - totalPaid;

  const handleOpenEditItem = (item: StaffPayrollItem) => {
    setEditingItem(item);
    setAllowancesVal(item.allowances);
    setDeductionsVal(item.deductions);
    setNotesVal(item.notes || '');
  };

  const handleSaveItemEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun || !editingItem) return;

    updatePayrollItem(activeRun.id, editingItem.id, {
      allowances: Number(allowancesVal) || 0,
      deductions: Number(deductionsVal) || 0,
      notes: notesVal,
    });
    setEditingItem(null);
  };

  const handleOpenPayItem = (item: StaffPayrollItem) => {
    setPayingItem(item);
    setDisburseMethod('الخزينة الرئيسية (نقداً)');
    setDisburseNotes(`صرف راتب شهر ${selectedMonth} للعضو: ${item.staffNameAr}`);
  };

  const handleConfirmPayItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun || !payingItem) return;

    payPayrollItem(activeRun.id, payingItem.id, disburseMethod);
    setPayingItem(null);
  };

  const handleConfirmBulkPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun) return;

    payEntirePayrollRun(activeRun.id, bulkMethod);
    setShowDisburseAllModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {t('مسير الرواتب والأجور للكوادر الطبية والإدارية', 'Staff Payroll & Salaries Management')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'احتساب رواتب الأطباء والتكنيشن، المكافآت والبدلات، الخصومات، وصرف الرواتب آلياً مع التوجيه المحاسبي.',
                  'Monthly payroll processing, bonuses, deductions and automated GL posting upon payment.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold bg-transparent border-none text-slate-800 dark:text-white outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleGenerateRun}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>
              {activeRun ? t('إعادة توليد وتحديث المسير', 'Refresh Payroll') : t('توليد مسير الشهر', 'Generate Payroll')}
            </span>
          </button>

          {activeRun && totalPending > 0 && (
            <button
              onClick={() => setShowDisburseAllModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('صرف كامل المسير دفعة واحدة', 'Disburse All')}</span>
            </button>
          )}

          {activeRun && (
            <button
              onClick={() => {
                setPrintSingleItem(null);
                setShowPrintModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4 text-indigo-600" />
              <span>{t('طباعة كشف المسير', 'Print Sheet')}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400 block">{t('عدد الكوادر', 'Total Staff')}</span>
          <span className="text-lg font-black text-slate-800 dark:text-white mt-1 block">
            {activeRun?.items.length || staffMembers.filter((s) => s.isActive).length}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400 block">{t('الراتب الأساسي', 'Basic Salary')}</span>
          <span className="text-lg font-black text-slate-800 dark:text-white mt-1 block font-mono">
            {formatMoney(totalBasic)}
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-xs dark:border-emerald-950/40 dark:bg-emerald-950/20">
          <span className="text-[11px] font-bold text-emerald-600 block">{t('البدلات والحوافز (+)', 'Allowances (+)')}</span>
          <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-1 block font-mono">
            {formatMoney(totalAllowances)}
          </span>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5 shadow-xs dark:border-rose-950/40 dark:bg-rose-950/20">
          <span className="text-[11px] font-bold text-rose-600 block">{t('الخصومات والجزاءات (-)', 'Deductions (-)')}</span>
          <span className="text-lg font-black text-rose-700 dark:text-rose-400 mt-1 block font-mono">
            {formatMoney(totalDeductions)}
          </span>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5 shadow-xs dark:border-indigo-950/40 dark:bg-indigo-950/20">
          <span className="text-[11px] font-bold text-indigo-600 block">{t('صافي المسير الكلي', 'Net Payable')}</span>
          <span className="text-lg font-black text-indigo-700 dark:text-indigo-300 mt-1 block font-mono">
            {formatMoney(totalNet)}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400 block">{t('المسدد / المصروف', 'Disbursed')}</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-black text-emerald-600 font-mono">{formatMoney(totalPaid)}</span>
            {totalPending > 0 ? (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                متبقي {formatMoney(totalPending)}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                مكتمل
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!activeRun ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Wallet className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {t(`لم يتم إنشاء مسير رواتب لشهر ${selectedMonth} بعد`, `No payroll run created for ${selectedMonth} yet`)}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {t(
              'يمكنك بنقرة زر واحدة توليد مسير الرواتب الشهري بالاعتماد على بيانات الكوادر المسجلة ورواتبهم الأساسية مع إمكانية إضافة البدلات والخصومات وصرفها مباشرة.',
              'Click below to generate the monthly payroll with active staff members, calculate net wages, and disburse.'
            )}
          </p>
          <button
            onClick={handleGenerateRun}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t(`إنشاء مسير رواتب شهر ${selectedMonth} الآن`, `Create Payroll for ${selectedMonth}`)}</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              {(['ALL', 'Doctor', 'Technician', 'Employee'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    roleFilter === role
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {role === 'ALL'
                    ? t('كافة الكوادر', 'All Staff')
                    : role === 'Doctor'
                    ? t('الأطباء', 'Doctors')
                    : role === 'Technician'
                    ? t('التكنيشن والتمريض', 'Technicians')
                    : t('الإداريين والموظفين', 'Employees')}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('بحث باسم الكادر أو المسمى الوظيفي...', 'Search staff name or title...')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-4 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Payroll Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('اسم العضو والوظيفة', 'Staff Member')}</th>
                  <th className="pb-3 font-bold text-start">{t('الفئة', 'Role')}</th>
                  <th className="pb-3 font-bold text-end">{t('الأساسي', 'Basic')}</th>
                  <th className="pb-3 font-bold text-end">{t('البدلات (+)', 'Allowances')}</th>
                  <th className="pb-3 font-bold text-end">{t('الخصومات (-)', 'Deductions')}</th>
                  <th className="pb-3 font-bold text-end">{t('الصافي المستحق', 'Net Salary')}</th>
                  <th className="pb-3 font-bold text-center">{t('حالة الصرف', 'Status')}</th>
                  <th className="pb-3 font-bold text-center">{t('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3">
                      <div>
                        <span className="font-extrabold text-slate-900 dark:text-white block">
                          {language === 'ar' ? item.staffNameAr : item.staffNameEn}
                        </span>
                        <span className="text-[11px] text-slate-400">{item.jobTitleAr}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          item.roleType === 'Doctor'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : item.roleType === 'Technician'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {item.roleType === 'Doctor' ? 'طبيب' : item.roleType === 'Technician' ? 'تكنيشن' : 'موظف'}
                      </span>
                    </td>
                    <td className="py-3 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatMoney(item.basicSalary)}
                    </td>
                    <td className="py-3 text-end font-mono font-bold text-emerald-600">
                      {item.allowances > 0 ? `+${formatMoney(item.allowances)}` : '-'}
                    </td>
                    <td className="py-3 text-end font-mono font-bold text-rose-600">
                      {item.deductions > 0 ? (
                        <div>
                          <span>-{formatMoney(item.deductions)}</span>
                          {item.notes && item.notes.includes('عجز جرد') && (
                            <span className="block text-[9px] font-sans font-normal text-amber-700 dark:text-amber-400">
                              (تسوية عجز مخزن)
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="py-3 text-end font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      {formatMoney(item.netSalary)}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          item.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : item.paymentStatus === 'Partial'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {item.paymentStatus === 'Paid' ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            {t('مسدد بالكامل', 'Paid')}
                          </>
                        ) : item.paymentStatus === 'Partial' ? (
                          t('مسدد جزئياً', 'Partial')
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            {t('معلق للصرف', 'Pending')}
                          </>
                        )}
                      </span>
                      {item.disbursementMethod && (
                        <span className="block text-[9px] text-slate-400 mt-0.5">{item.disbursementMethod}</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit allowances & deductions */}
                        <button
                          onClick={() => handleOpenEditItem(item)}
                          title={t('تعديل البدلات والخصومات', 'Edit Allowances/Deductions')}
                          className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          {t('تعديل', 'Edit')}
                        </button>

                        {/* Pay Button */}
                        {item.paymentStatus !== 'Paid' ? (
                          <button
                            onClick={() => handleOpenPayItem(item)}
                            title={t('صرف الراتب الآن', 'Pay Salary')}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700 text-[11px] font-bold transition-colors shadow-xs cursor-pointer"
                          >
                            {t('صرف الراتب', 'Pay')}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setPrintSingleItem(item);
                              setShowPrintModal(true);
                            }}
                            title={t('طباعة قسيمة الراتب', 'Print Payslip')}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800/40">
                  <td className="py-3 font-bold" colSpan={2}>
                    {t('الإجمالي العام للمسير:', 'Total Run:')}
                  </td>
                  <td className="py-3 text-end font-mono font-black">{formatMoney(totalBasic)}</td>
                  <td className="py-3 text-end font-mono font-black text-emerald-600">{formatMoney(totalAllowances)}</td>
                  <td className="py-3 text-end font-mono font-black text-rose-600">{formatMoney(totalDeductions)}</td>
                  <td className="py-3 text-end font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                    {formatMoney(totalNet)}
                  </td>
                  <td className="py-3 text-center" colSpan={2}>
                    <span className="text-emerald-600 font-bold">{formatMoney(totalPaid)} مسدد</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ALLOWANCES / DEDUCTIONS */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('تعديل مستحقات واستقطاعات الراتب', 'Adjust Staff Salary')}
                </h3>
                <p className="text-xs text-slate-400 font-bold">{editingItem.staffNameAr}</p>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemEdit} className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl flex justify-between items-center font-bold">
                <span className="text-slate-500">{t('الراتب الأساسي التعاقدي:', 'Contractual Basic:')}</span>
                <span className="font-mono text-sm text-slate-900 dark:text-white">{formatMoney(editingItem.basicSalary)}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('البدلات والمكافآت والعمولات الإضافية (+)', 'Allowances & Bonuses (+)')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={allowancesVal}
                  onChange={(e) => setAllowancesVal(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-bold text-emerald-600 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الخصومات والجزاءات والغياب (-)', 'Deductions & Penalties (-)')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={deductionsVal}
                  onChange={(e) => setDeductionsVal(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-bold text-rose-600 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl flex justify-between items-center font-black">
                <span className="text-indigo-800 dark:text-indigo-200">{t('صافي الراتب الجديد:', 'New Net:')}</span>
                <span className="font-mono text-base text-indigo-700 dark:text-indigo-300">
                  {formatMoney(editingItem.basicSalary + allowancesVal - deductionsVal)}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات وسند التعديل', 'Adjustment Notes')}
                </label>
                <input
                  type="text"
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  placeholder="مثال: مكافأة تميز في الحالات، خصم تأخير..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISBURSE SINGLE SALARY */}
      {payingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('صرف راتب الموظف / الطبيب', 'Disburse Salary')}
              </h3>
              <button onClick={() => setPayingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayItem} className="space-y-4 text-xs">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 space-y-1 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-600 dark:text-slate-300">{t('المستفيد:', 'Staff:')}</span>
                  <span className="text-slate-900 dark:text-white">{payingItem.staffNameAr}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-600 dark:text-slate-300">{t('الشهر:', 'Month:')}</span>
                  <span>{selectedMonth}</span>
                </div>
                <div className="flex justify-between font-black pt-2 border-t border-indigo-200/50">
                  <span className="text-indigo-900 dark:text-indigo-200">{t('المبلغ المطلوب صرفه:', 'Amount:')}</span>
                  <span className="font-mono text-base text-indigo-700 dark:text-indigo-400">
                    {formatMoney(payingItem.netSalary - (payingItem.paidAmount || 0))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('طريقة وجهة الصرف (توجيه الحساب الدائن) *', 'Disbursement Method / Cash Account *')}
                </label>
                <select
                  value={disburseMethod}
                  onChange={(e) => setDisburseMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold focus:outline-indigo-600"
                >
                  <option value="الخزينة الرئيسية (نقداً)">الخزينة الرئيسية (نقداً)</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="تحويل بنكي - البنك الأهلي">تحويل بنكي - البنك الأهلي</option>
                  <option value="عهدة الفرع">عهدة الفرع</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {t(
                    'سيتم إنشاء قيد يومية متوازن آلياً: من حـ/ مصروفات الرواتب والأجور إلى حـ/ الخزينة أو البنك.',
                    'Automated Balanced JV will be posted to General Ledger.'
                  )}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('البيان والوصف', 'Description')}
                </label>
                <input
                  type="text"
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {t('تأكيد الصرف وترحيل القيد', 'Confirm Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK DISBURSE ALL */}
      {showDisburseAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('صرف كامل مسير الرواتب دفعة واحدة', 'Bulk Disburse Entire Payroll')}
              </h3>
              <button onClick={() => setShowDisburseAllModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBulkPay} className="space-y-4 text-xs">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-1 dark:border-amber-900/40 dark:bg-amber-950/30">
                <p className="text-amber-900 dark:text-amber-200 font-bold">
                  {t(
                    `أنت على وشك صرف رواتب كافة الكوادر غير المسددة لشهر ${selectedMonth}`,
                    `You are about to disburse all pending salaries for ${selectedMonth}`
                  )}
                </p>
                <div className="flex justify-between font-black pt-2 border-t border-amber-200 text-sm">
                  <span>{t('إجمالي المبلغ المتبقي للصرف:', 'Total Amount:')}</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">{formatMoney(totalPending)}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('جهة وطريقة الصرف *', 'Disbursement Method *')}
                </label>
                <select
                  value={bulkMethod}
                  onChange={(e) => setBulkMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold focus:outline-indigo-600"
                >
                  <option value="الخزينة الرئيسية (نقداً)">الخزينة الرئيسية (نقداً)</option>
                  <option value="تحويل بنكي - البنك الأهلي">تحويل بنكي - البنك الأهلي</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDisburseAllModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {t('تأكيد الصرف وترحيل القيود', 'Confirm Bulk Disburse')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT PAYSLIP / SHEET */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {printSingleItem
                    ? t('قسيمة صرف راتب موظف معتمدة', 'Official Staff Payslip')
                    : t(`مسير رواتب الكوادر لشهر ${selectedMonth}`, `Staff Payroll Sheet - ${selectedMonth}`)}
                </h3>
                <p className="text-xs text-slate-400">{tenant?.name} • {activeBranch?.nameAr}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  <span>{t('طباعة الآن', 'Print Now')}</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* If Single Item Payslip */}
            {printSingleItem ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                  <div>
                    <span className="text-slate-400 block">{t('اسم العضو:', 'Staff Name:')}</span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">{printSingleItem.staffNameAr}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t('المسمى الوظيفي:', 'Job Title:')}</span>
                    <span className="font-bold">{printSingleItem.jobTitleAr} ({printSingleItem.roleType})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t('شهر الاستحقاق:', 'Month:')}</span>
                    <span className="font-mono font-bold">{selectedMonth}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t('طريقة الصرف:', 'Method:')}</span>
                    <span className="font-bold text-emerald-600">{printSingleItem.disbursementMethod || 'نقداً'}</span>
                  </div>
                </div>

                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b py-2">
                      <td className="py-2 text-slate-600">{t('الراتب الأساسي التعاقدي', 'Basic Salary')}</td>
                      <td className="py-2 text-end font-mono font-bold">{formatMoney(printSingleItem.basicSalary)}</td>
                    </tr>
                    <tr className="border-b py-2 text-emerald-600">
                      <td className="py-2">{t('البدلات والمكافآت والعمولات (+)', 'Allowances (+)')}</td>
                      <td className="py-2 text-end font-mono font-bold">+{formatMoney(printSingleItem.allowances)}</td>
                    </tr>
                    <tr className="border-b py-2 text-rose-600">
                      <td className="py-2">{t('الاستقطاعات والخصومات (-)', 'Deductions (-)')}</td>
                      <td className="py-2 text-end font-mono font-bold">-{formatMoney(printSingleItem.deductions)}</td>
                    </tr>
                    <tr className="font-black text-sm text-indigo-700 dark:text-indigo-400 bg-slate-50 dark:bg-slate-800/40">
                      <td className="py-3 px-2">{t('صافي الراتب المنصرف', 'Net Disbursed')}</td>
                      <td className="py-3 px-2 text-end font-mono">{formatMoney(printSingleItem.netSalary)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              /* All items summary table */
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 dark:border-slate-800">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <tr>
                      <th className="p-2 text-start border-b">{t('اسم الكادر', 'Staff Name')}</th>
                      <th className="p-2 text-start border-b">{t('الوظيفة', 'Role')}</th>
                      <th className="p-2 text-end border-b">{t('الأساسي', 'Basic')}</th>
                      <th className="p-2 text-end border-b">{t('البدلات', 'Allowances')}</th>
                      <th className="p-2 text-end border-b">{t('الخصم', 'Deductions')}</th>
                      <th className="p-2 text-end border-b">{t('الصافي', 'Net')}</th>
                      <th className="p-2 text-center border-b">{t('الحالة', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(activeRun?.items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="p-2 font-bold">{item.staffNameAr}</td>
                        <td className="p-2">{item.jobTitleAr}</td>
                        <td className="p-2 text-end font-mono">{formatMoney(item.basicSalary)}</td>
                        <td className="p-2 text-end font-mono text-emerald-600">+{formatMoney(item.allowances)}</td>
                        <td className="p-2 text-end font-mono text-rose-600">-{formatMoney(item.deductions)}</td>
                        <td className="p-2 text-end font-mono font-bold text-indigo-600">{formatMoney(item.netSalary)}</td>
                        <td className="p-2 text-center font-bold">
                          {item.paymentStatus === 'Paid' ? 'مسدد' : 'معلق'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
