import React, { useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { CashPaymentVoucher } from '../../types';
import {
  CreditCard,
  Plus,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  FileText,
  Building,
  ArrowUpRight,
} from 'lucide-react';
import { tafqeetArabic } from '../../utils/fiscalUtils';

interface CashPaymentsTabProps {
  onPrintPayment: (payment: CashPaymentVoucher) => void;
}

export const CashPaymentsTab: React.FC<CashPaymentsTabProps> = ({ onPrintPayment }) => {
  const {
    cashPayments,
    addCashPayment,
    deleteCashPayment,
    parties,
    staffMembers,
    branches,
    activeBranch,
    formatMoney,
    tenant,
    currentUser,
  } = usePlatform();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranch?.id || 'all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    paidTo: '',
    partyId: '',
    expenseCategory: 'مستلزمات ومستهلكات طبية',
    amount: '',
    paymentMethod: 'Cash' as 'Cash' | 'Card' | 'Transfer' | 'Check',
    paidFromAccount: 'خزينة الفرع الرئيسية (كاش)',
    checkNumber: '',
    invoiceReference: '',
    description: 'صرف مصاريف تشغيلية / مستحقات',
    costCenter: 'الفرع الرئيسي',
    preparedBy: currentUser?.name || 'المحاسب المالي',
    approvedBy: 'المدير التنفيذي / الإدارة المالية',
    receiverName: '',
  });

  const filteredPayments = cashPayments.filter((p) => {
    const matchesSearch =
      p.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.paidTo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.expenseCategory && p.expenseCategory.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBranch = selectedBranchId === 'all' || p.branchId === selectedBranchId;
    return matchesSearch && matchesBranch;
  });

  const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('الرجاء إدخال مبلغ صحيح لسند الصرف');
      return;
    }
    if (!formData.paidTo.trim()) {
      alert('الرجاء تحديد المستفيد المصروف إليه');
      return;
    }

    const newPayment = addCashPayment({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      tenantId: tenant.id,
      branchId: activeBranch?.id || branches[0]?.id || 'branch-1',
      paidTo: formData.paidTo,
      partyId: formData.partyId || undefined,
      expenseCategory: formData.expenseCategory,
      amount: amountNum,
      currency: tenant?.currency || 'EGP',
      paymentMethod: formData.paymentMethod,
      paidFromAccount: formData.paidFromAccount,
      checkNumber: formData.checkNumber || undefined,
      invoiceReference: formData.invoiceReference || undefined,
      description: formData.description,
      costCenter: formData.costCenter,
      preparedBy: formData.preparedBy,
      approvedBy: formData.approvedBy,
      receiverName: formData.receiverName || formData.paidTo,
      status: 'active',
    });

    setIsModalOpen(false);
    setFormData({
      paidTo: '',
      partyId: '',
      expenseCategory: 'مستلزمات ومستهلكات طبية',
      amount: '',
      paymentMethod: 'Cash',
      paidFromAccount: 'خزينة الفرع الرئيسية (كاش)',
      checkNumber: '',
      invoiceReference: '',
      description: 'صرف مصاريف تشغيلية / مستحقات',
      costCenter: 'الفرع الرئيسي',
      preparedBy: currentUser?.name || 'المحاسب المالي',
      approvedBy: 'المدير التنفيذي / الإدارة المالية',
      receiverName: '',
    });

    onPrintPayment(newPayment);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-bold block mb-1">
              إجمالي سندات الصرف المنصرفة
            </span>
            <span className="text-2xl font-black text-rose-800 dark:text-rose-200">
              {formatMoney(totalPaid)}
            </span>
          </div>
          <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-xl text-rose-600 dark:text-rose-300">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">
              عدد أذونات الصرف النقدية
            </span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-200">
              {filteredPayments.length} سند صرف
            </span>
          </div>
          <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>إصدار سند صرف نقدي جديد</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم السند، المصروف له، البيان، التصنيف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
          >
            <option value="all">جميع الفروع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3.5 px-4">رقم السند</th>
                <th className="py-3.5 px-4">التاريخ والوقت</th>
                <th className="py-3.5 px-4">المصروف إليه (المستفيد)</th>
                <th className="py-3.5 px-4">بند ومجال الصرف</th>
                <th className="py-3.5 px-4">البيان والتفاصيل</th>
                <th className="py-3.5 px-4">المبلغ المنصرف</th>
                <th className="py-3.5 px-4">المصدر المصروف منه</th>
                <th className="py-3.5 px-4 text-center">الإجراءات والطباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد سندات صرف نقدية مسجلة تطابق البحث
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {p.voucherNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {p.date} <span className="text-[10px] text-slate-400">({p.time})</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100">{p.paidTo}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {p.expenseCategory || 'مصروف عام'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-slate-600 dark:text-slate-300 truncate" title={p.description}>
                      {p.description}
                      {p.invoiceReference && (
                        <span className="block text-[10px] text-rose-500 font-mono font-bold">
                          مستند مرفق: {p.invoiceReference}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-black text-rose-600 dark:text-rose-400 text-sm">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">{p.paidFromAccount}</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onPrintPayment(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 transition-colors text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                          title="معاينة وطباعة السند"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف سند الصرف رقم ${p.voucherNumber}؟`)) {
                              deleteCashPayment(p.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="حذف السند"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Cash Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-950/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/20">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    إصدار سند صرف نقدي (Cash Payment Voucher)
                  </h3>
                  <p className="text-xs text-slate-500">
                    صرف مبالغ مالية لموردين، مصاريف صيانة، إيجارات، رواتب، أو سلف معتمدة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المصروف إليه (اسم المستفيد / الجهة) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="اسم المورد، الموظف، الشركة..."
                    value={formData.paidTo}
                    onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    بند / تصنيف المصروف
                  </label>
                  <select
                    value={formData.expenseCategory}
                    onChange={(e) => setFormData({ ...formData, expenseCategory: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-rose-500"
                  >
                    <option value="مستلزمات ومستهلكات طبية">مستلزمات ومستهلكات طبية</option>
                    <option value="صيانة دورية للأجهزة">صيانة دورية للأجهزة ومعدات الليزر</option>
                    <option value="مصاريف تشغيل ومرافق">مصاريف تشغيل ومرافق (كهرباء، مياه، إنترنت)</option>
                    <option value="رواتب وأجور وسلف موظفين">رواتب وأجور وسلف موظفين</option>
                    <option value="سداد مستحقات مورد">سداد مستحقات مورد خارجي</option>
                    <option value="نثريات وضيافة ونظافة">نثريات وضيافة ونظافة</option>
                    <option value="أخرى">مصروفات أخرى</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المبلغ المصروف (ج.م) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-rose-600 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    طريقة الصرف والخصم
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-rose-500"
                  >
                    <option value="Cash">نقداً من الخزينة (Cash)</option>
                    <option value="Transfer">تحويل من الحساب البنكي (Bank Transfer)</option>
                    <option value="Check">شيك بنكي صادر (Bank Check)</option>
                  </select>
                </div>
              </div>

              {/* Automatic Arabic Tafqeet */}
              {parseFloat(formData.amount) > 0 && (
                <div className="p-3 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs">
                  <span className="font-bold text-rose-800 dark:text-rose-300 block mb-0.5">
                    التفقيط العربي المحاسبي المعتمد:
                  </span>
                  <span className="text-rose-700 dark:text-rose-200 font-semibold italic">
                    {tafqeetArabic(parseFloat(formData.amount), tenant?.currency || 'EGP')}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الخزينة أو الحساب المصروف منه *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.paidFromAccount}
                    onChange={(e) => setFormData({ ...formData, paidFromAccount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الفاتورة أو المستند المرفق (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: فاتورة المورد رقم 8891"
                    value={formData.invoiceReference}
                    onChange={(e) => setFormData({ ...formData, invoiceReference: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وذلك مقابل (البيان والتفاصيل) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="بيان تفصيلي لسبب الصرف..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المعد (المحاسب)</label>
                  <input
                    type="text"
                    value={formData.preparedBy}
                    onChange={(e) => setFormData({ ...formData, preparedBy: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الاعتماد والموافقة</label>
                  <input
                    type="text"
                    value={formData.approvedBy}
                    onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المستلم الفعلي</label>
                  <input
                    type="text"
                    placeholder="اسم وتوقيع المستلم"
                    value={formData.receiverName}
                    onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وإصدار سند الصرف والطباعة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
