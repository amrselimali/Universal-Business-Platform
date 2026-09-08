import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Party } from '../types';
import {
  Users,
  Plus,
  Phone,
  Mail,
  Search,
  Building,
  CreditCard,
  CheckCircle2,
  X,
} from 'lucide-react';

export const PartiesView: React.FC = () => {
  const { t, formatMoney, parties, addParty, language } = usePlatform();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'Customer' | 'Supplier'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const [newParty, setNewParty] = useState({
    name: '',
    nameEn: '',
    type: 'Customer' as const,
    phone: '',
    email: '',
    taxNumber: '',
    creditLimit: 10000,
  });

  const filteredParties = parties.filter((p) => {
    const matchesType = activeFilter === 'ALL' || p.type === activeFilter || p.type === 'Both';
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
      p.phone.includes(q);
    return matchesType && matchesSearch;
  });

  const handleSaveParty = () => {
    if (!newParty.name.trim() || !newParty.phone.trim()) {
      alert(t('يرجى كتابة الاسم ورقم الهاتف!', 'Please provide name and phone!'));
      return;
    }
    addParty({
      name: newParty.name,
      nameEn: newParty.nameEn || newParty.name,
      type: newParty.type,
      phone: newParty.phone,
      email: newParty.email,
      taxNumber: newParty.taxNumber,
      balance: 0,
      creditLimit: Number(newParty.creditLimit),
    });
    setShowAddModal(false);
    setNewParty({
      name: '',
      nameEn: '',
      type: 'Customer',
      phone: '',
      email: '',
      taxNumber: '',
      creditLimit: 10000,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {t('دليل العملاء والموردين (Parties Directory)', 'Customers & Suppliers')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'متابعة الحسابات، الأرصدة المستحقة، حدود الائتمان، وبيانات الاتصال والملفات الضريبية.',
              'Track receivables, payables, credit limits, and contact profiles.'
            )}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>{t('إضافة عميل / مورد جديد', 'Add Customer/Vendor')}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1">
          {(['ALL', 'Customer', 'Supplier'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                activeFilter === filter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {filter === 'ALL'
                ? t('كافة الأطراف', 'All')
                : filter === 'Customer'
                ? t('العملاء فقط', 'Customers')
                : t('الموردين فقط', 'Suppliers')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('ابحث بالاسم أو الموبايل...', 'Search by name or phone...')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-4 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Grid of Parties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredParties.map((party) => (
          <div
            key={party.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    party.type === 'Customer'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                  }`}
                >
                  {party.type === 'Customer' ? t('عميل', 'Customer') : t('مورد', 'Supplier')}
                </span>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">{party.name}</h3>
                {party.nameEn && <p className="text-xs text-slate-400">{party.nameEn}</p>}
              </div>

              <div className="text-end">
                <span className="text-[10px] text-slate-400 block">{t('الرصيد:', 'Balance:')}</span>
                <span
                  className={`text-xs font-black font-mono ${
                    party.balance > 0 ? 'text-rose-600' : party.balance < 0 ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                >
                  {formatMoney(party.balance)}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 space-y-1">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-mono">{party.phone}</span>
              </div>
              {party.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono">{party.email}</span>
                </div>
              )}
              {party.creditLimit && (
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                  <span>{t('حد الائتمان:', 'Credit Limit:')}</span>
                  <span className="font-bold">{formatMoney(party.creditLimit)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ADD PARTY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
              {t('إضافة جهة جديدة (عميل / مورد)', 'Add Customer / Vendor')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('نوع الجهة:', 'Party Type:')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewParty({ ...newParty, type: 'Customer' })}
                    className={`rounded-xl p-2 font-bold border transition-colors ${
                      newParty.type === 'Customer'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    {t('عميل (Customer)', 'Customer')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewParty({ ...newParty, type: 'Supplier' })}
                    className={`rounded-xl p-2 font-bold border transition-colors ${
                      newParty.type === 'Supplier'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    {t('مورد (Supplier)', 'Supplier')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الاسم بالكامل:', 'Full Name:')}
                </label>
                <input
                  type="text"
                  value={newParty.name}
                  onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                  placeholder="مثال: شركة القاهرة للأدوية أو حسام إبراهيم"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الموبايل / الهاتف:', 'Phone:')}
                  </label>
                  <input
                    type="tel"
                    value={newParty.phone}
                    onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                    placeholder="01xxxxxxxxx"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('حد الائتمان (ج.م):', 'Credit Limit:')}
                  </label>
                  <input
                    type="number"
                    value={newParty.creditLimit}
                    onChange={(e) => setNewParty({ ...newParty, creditLimit: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSaveParty}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('حفظ الجهة', 'Save Party')}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
