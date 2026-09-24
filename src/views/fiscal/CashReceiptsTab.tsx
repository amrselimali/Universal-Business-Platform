import React, { useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { CashReceiptVoucher } from '../../types';
import {
  Receipt,
  Plus,
  Search,
  Printer,
  Calendar,
  CreditCard,
  Building2,
  Trash2,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { tafqeetArabic } from '../../utils/fiscalUtils';

interface CashReceiptsTabProps {
  onPrintReceipt: (receipt: CashReceiptVoucher) => void;
}

export const CashReceiptsTab: React.FC<CashReceiptsTabProps> = ({ onPrintReceipt }) => {
  const {
    cashReceipts,
    addCashReceipt,
    deleteCashReceipt,
    parties,
    branches,
    activeBranch,
    formatMoney,
    tenant,
    currentUser,
    t,
  } = usePlatform();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranch?.id || 'all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State for new Cash Receipt
  const [formData, setFormData] = useState({
    receivedFrom: '',
    partyId: '',
    amount: '',
    paymentMethod: 'Cash' as 'Cash' | 'Card' | 'Transfer' | 'Check',
    bankName: '',
    checkNumber: '',
    checkDate: '',
    referenceInvoiceNo: '',
    description: 'دفعة سداد حساب / حجز خدمة',
    costCenter: 'القسم الرئيسي',
    receiverName: currentUser?.name || 'أمين الخزينة',
  });

  const filteredReceipts = cashReceipts.filter((r) => {
    const matchesSearch =
      r.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.receivedFrom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = selectedBranchId === 'all' || r.branchId === selectedBranchId;
    return matchesSearch && matchesBranch;
  });

  const totalCollected = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);

  const handlePartySelect = (partyId: string) => {
    const party = parties.find((p) => p.id === partyId);
    if (party) {
      setFormData((prev) => ({
        ...prev,
        partyId,
        receivedFrom: party.name,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('الرجاء إدخال مبلغ صحيح لسند القبض');
      return;
    }
    if (!formData.receivedFrom.trim()) {
      alert('الرجاء تحديد اسم المستلم منه');
      return;
    }

    const newReceipt = addCashReceipt({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      tenantId: tenant.id,
      branchId: activeBranch?.id || branches[0]?.id || 'branch-1',
      partyId: formData.partyId || undefined,
      receivedFrom: formData.receivedFrom,
      amount: amountNum,
      currency: tenant?.currency || 'EGP',
      paymentMethod: formData.paymentMethod,
      bankName: formData.bankName || undefined,
      checkNumber: formData.checkNumber || undefined,
      checkDate: formData.checkDate || undefined,
      referenceInvoiceNo: formData.referenceInvoiceNo || undefined,
      description: formData.description,
      costCenter: formData.costCenter,
      receiverName: formData.receiverName,
      status: 'active',
    });

    setIsModalOpen(false);
    // Reset
    setFormData({
      receivedFrom: '',
      partyId: '',
      amount: '',
      paymentMethod: 'Cash',
      bankName: '',
      checkNumber: '',
      checkDate: '',
      referenceInvoiceNo: '',
      description: 'دفعة سداد حساب / حجز خدمة',
      costCenter: 'القسم الرئيسي',
      receiverName: currentUser?.name || 'أمين الخزينة',
    });

    // Auto open print
    onPrintReceipt(newReceipt);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block mb-1">
              إجمالي سندات القبض المستلمة
            </span>
            <span className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
              {formatMoney(totalCollected)}
            </span>
          </div>
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-300">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block mb-1">
              عدد إيصالات القبض المصدرة
            </span>
            <span className="text-2xl font-black text-indigo-800 dark:text-indigo-200">
              {filteredReceipts.length} إيصال
            </span>
          </div>
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-300">
            <FileCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>إصدار إيصال وسند قبض جديد</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم السند، اسم العميل، البيان..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
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

      {/* Receipts Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3.5 px-4">رقم السند</th>
                <th className="py-3.5 px-4">التاريخ والوقت</th>
                <th className="py-3.5 px-4">المستلم منه (العميل)</th>
                <th className="py-3.5 px-4">طريقة السداد</th>
                <th className="py-3.5 px-4">البيان المحاسبي</th>
                <th className="py-3.5 px-4">المبلغ المستلم</th>
                <th className="py-3.5 px-4">المستلم</th>
                <th className="py-3.5 px-4 text-center">الإجراءات والطباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد سندات قبض مسجلة حالياً تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((rcpt) => (
                  <tr key={rcpt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {rcpt.voucherNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {rcpt.date} <span className="text-[10px] text-slate-400">({rcpt.time})</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                      {rcpt.receivedFrom}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CreditCard className="w-3.5 h-3.5" />
                        {rcpt.paymentMethod === 'Cash'
                          ? 'نقداً (كاش)'
                          : rcpt.paymentMethod === 'Card'
                          ? 'بطاقة / مدى'
                          : rcpt.paymentMethod === 'Transfer'
                          ? 'تحويل بنكي'
                          : 'شيك مصرفي'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-slate-600 dark:text-slate-300 truncate" title={rcpt.description}>
                      {rcpt.description}
                      {rcpt.referenceInvoiceNo && (
                        <span className="block text-[10px] text-indigo-500 font-mono font-bold">
                          فاتورة مرجعية: {rcpt.referenceInvoiceNo}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white text-sm">
                      {formatMoney(rcpt.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">{rcpt.receiverName}</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onPrintReceipt(rcpt)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-colors text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                          title="معاينة وطباعة السند"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف سند القبض رقم ${rcpt.voucherNumber}؟`)) {
                              deleteCashReceipt(rcpt.id);
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

      {/* New Cash Receipt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    إصدار إيصال استلام نقدية (سند قبض نقدي)
                  </h3>
                  <p className="text-xs text-slate-500">
                    توثيق استلام المبالغ المالية من العملاء والمرضى والتأثير الفوري في الخزينة
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
                    اختيار العميل / المريض من السجل
                  </label>
                  <select
                    value={formData.partyId}
                    onChange={(e) => handlePartySelect(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- اختيار عميل مسجل أو كتابة اسم حر بالأسفل --</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.phone ? `(${p.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المستلم منه (اسم العميل / الجهة) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="اسم العميل أو المؤسسة المسددة"
                    value={formData.receivedFrom}
                    onChange={(e) => setFormData({ ...formData, receivedFrom: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المبلغ المستلم (ج.م) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-emerald-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    طريقة الاستلام والسداد
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Cash">نقداً بالخزينة (Cash)</option>
                    <option value="Card">شبكة / مدى / بطاقة (Card)</option>
                    <option value="Transfer">تحويل بنكي رسمي (Bank Transfer)</option>
                    <option value="Check">شيك بنكي (Bank Check)</option>
                  </select>
                </div>
              </div>

              {/* Automatic Arabic Tafqeet Preview */}
              {parseFloat(formData.amount) > 0 && (
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                    التفقيط العربي المحاسبي المعتمد:
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-200 font-semibold italic">
                    {tafqeetArabic(parseFloat(formData.amount), tenant?.currency || 'EGP')}
                  </span>
                </div>
              )}

              {formData.paymentMethod === 'Transfer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم البنك المحوّل إليه
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: البنك الأهلي المصري - الحساب الرئيسي"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>
              )}

              {formData.paymentMethod === 'Check' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الشيك</label>
                    <input
                      type="text"
                      placeholder="رقم الشيك المصرفي"
                      value={formData.checkNumber}
                      onChange={(e) => setFormData({ ...formData, checkNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ استحقاق الشيك</label>
                    <input
                      type="date"
                      value={formData.checkDate}
                      onChange={(e) => setFormData({ ...formData, checkDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    وذلك عن (البيان والسبب) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="دفعة سداد فاتورة، عربون حجز، باقة علاجية..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الفاتورة أو الحجز المرجعي (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: INV-2026-0045"
                    value={formData.referenceInvoiceNo}
                    onChange={(e) => setFormData({ ...formData, referenceInvoiceNo: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">مركز التكلفة</label>
                  <input
                    type="text"
                    value={formData.costCenter}
                    onChange={(e) => setFormData({ ...formData, costCenter: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم أمين الخزينة / المستلم</label>
                  <input
                    type="text"
                    value={formData.receiverName}
                    onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
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
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وإصدار إيصال القبض والطباعة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
