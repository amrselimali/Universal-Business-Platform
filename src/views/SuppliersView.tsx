import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { autoTranslateArabic } from '../utils/translator';
import {
  Truck,
  Plus,
  Phone,
  Mail,
  Search,
  Building2,
  CheckCircle2,
  X,
  FileText,
  Sparkles,
  DollarSign,
  ShieldCheck,
  TrendingDown,
  Hash,
} from 'lucide-react';
import { PartyStatementModal } from '../components/PartyStatementModal';

export const SuppliersView: React.FC = () => {
  const { t, formatMoney, parties, addParty, language } = usePlatform();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PAYABLE' | 'SETTLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [statementPartyId, setStatementPartyId] = useState<string | null>(null);
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    nameEn: '',
    phone: '',
    email: '',
    address: '',
    nationalId: '', // Commercial Register / Tax ID
    creditLimit: 50000,
    medicalNotes: '', // Supplier payment terms / notes
  });

  // Filter only suppliers
  const suppliers = parties.filter((p) => p.type === 'Supplier' || p.type === 'Both');

  const filteredSuppliers = suppliers.filter((s) => {
    if (activeFilter === 'PAYABLE' && s.balance <= 0) return false;
    if (activeFilter === 'SETTLED' && s.balance > 0) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
      s.phone.includes(q) ||
      (s.systemCode && s.systemCode.toLowerCase().includes(q)) ||
      (s.nationalId && s.nationalId.toLowerCase().includes(q))
    );
  });

  // Statistics
  const totalSuppliersCount = suppliers.length;
  const totalPayableBalance = suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
  const suppliersWithBalancesCount = suppliers.filter((s) => s.balance > 0).length;

  const handleAutoTranslateName = () => {
    if (newSupplier.name.trim()) {
      setNewSupplier((prev) => ({
        ...prev,
        nameEn: autoTranslateArabic(prev.name),
      }));
    }
  };

  const handleSaveSupplier = () => {
    if (!newSupplier.name.trim() || !newSupplier.phone.trim()) {
      alert(t('يرجى كتابة اسم المورد ورقم الهاتف للتواصل!', 'Please provide supplier name and phone!'));
      return;
    }

    addParty({
      name: newSupplier.name.trim(),
      nameEn: newSupplier.nameEn.trim() || autoTranslateArabic(newSupplier.name),
      type: 'Supplier',
      phone: newSupplier.phone.trim(),
      email: newSupplier.email.trim() || undefined,
      nationalId: newSupplier.nationalId.trim() || undefined,
      address: newSupplier.address.trim() || undefined,
      medicalNotes: newSupplier.medicalNotes.trim() || undefined,
      balance: 0,
      creditLimit: Number(newSupplier.creditLimit) || 0,
    });

    setShowAddModal(false);
    setNewSupplier({
      name: '',
      nameEn: '',
      phone: '',
      email: '',
      address: '',
      nationalId: '',
      creditLimit: 50000,
      medicalNotes: '',
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-md shadow-amber-600/20">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                {t('سجل وإدارة الموردين والشركات (Suppliers Directory)', 'Suppliers & Vendors Directory')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'شاشة مخصصة لإدارة حسابات الموردين، الأرصدة الدائنة، كشوف الحسابات ومتابعة سداد الدفعات',
                  'Dedicated screen for managing suppliers, accounts payable balances, and statement logs'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setStatementPartyId(null);
              setShowStatementModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-all cursor-pointer"
          >
            <FileText className="h-4 w-4 text-indigo-600" />
            <span>{t('كشوف حسابات الموردين', 'Supplier Statements')}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة مورد جديد', 'Add New Supplier')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">{t('إجمالي عدد الموردين', 'Total Suppliers')}</span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {totalSuppliersCount} <span className="text-xs font-normal text-slate-400">{t('مورد مكود', 'Vendors')}</span>
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/40 rounded-xl">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">{t('إجمالي المستحقات للموردين', 'Total Accounts Payable')}</span>
            <div className="text-xl font-black text-rose-600 mt-1 font-mono">
              {formatMoney(totalPayableBalance)}
            </div>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 dark:bg-rose-950/40 rounded-xl">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">{t('موردين لديهم مستحقات حالية', 'Suppliers with Balance')}</span>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {suppliersWithBalancesCount} <span className="text-xs font-normal text-slate-400">{t('مورد مستحق', 'Due')}</span>
            </div>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('كافة الموردين', 'All Suppliers')} ({suppliers.length})
          </button>
          <button
            onClick={() => setActiveFilter('PAYABLE')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'PAYABLE'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('موردين لهم أرصدة مستحقة', 'With Balance Due')} ({suppliersWithBalancesCount})
          </button>
          <button
            onClick={() => setActiveFilter('SETTLED')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'SETTLED'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('أرصدة مسواة (صفر)', 'Settled (Zero)')} ({suppliers.length - suppliersWithBalancesCount})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('بحث بالاسم، الكود، أو رقم الهاتف...', 'Search by supplier name, code, phone...')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-8 text-xs font-medium outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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

      {/* Grid of Suppliers */}
      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Truck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {t('لا توجد نتائج مطابقة لبحث الموردين', 'No matching suppliers found')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('يمكنك إضافة مورد جديد بالضغط على زر "إضافة مورد جديد" بالأعلى', 'You can add a new supplier using the button above')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3 flex flex-col justify-between hover:border-amber-400 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        {t('مورد معتمد', 'Supplier')}
                      </span>
                      {supplier.id === 'party-s-cash' && (
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {t('افتراضي (كاش)', 'Default')}
                        </span>
                      )}
                      {supplier.systemCode && (
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {supplier.systemCode}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1.5">{supplier.name}</h3>
                    {supplier.nameEn && <p className="text-xs text-slate-400">{supplier.nameEn}</p>}
                  </div>

                  <div className="text-end">
                    <span className="text-[10px] text-slate-400 block">{t('رصيد المورد المستحق:', 'Payable Due:')}</span>
                    <span
                      className={`text-xs font-black font-mono ${
                        supplier.balance > 0
                          ? 'text-rose-600 font-extrabold'
                          : supplier.balance < 0
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {formatMoney(supplier.balance)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 space-y-1 mt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono font-semibold">{supplier.phone}</span>
                  </div>

                  {supplier.email && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}

                  {supplier.nationalId && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Hash className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t('سجل/بطاقة ضريبية:', 'Tax/CR ID:')} {supplier.nationalId}</span>
                    </div>
                  )}

                  {supplier.medicalNotes && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg mt-1">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{supplier.medicalNotes}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="text-[10px] text-slate-400 truncate">
                  <span>{formatMoney(supplier.creditLimit)} {t('حد ائتماني', 'credit limit')}</span>
                </div>

                <button
                  onClick={() => {
                    setStatementPartyId(supplier.id);
                    setShowStatementModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer shrink-0"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                  <span>{t('كشف الحساب', 'Statement')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {t('إضافة مورد جديد للنظام', 'Add New Supplier')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t('تسجيل بيانات مورد مستلزمات أو أدوية أو صيانة', 'Register supplies, medical or maintenance vendor')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Dual Language Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم المورد / الشركة بالعربي *', 'Supplier / Company Name (Arabic) *')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                      placeholder="مثال: شركة النيل للمستلزمات الطبية..."
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAutoTranslateName}
                      className="px-2 py-1 bg-amber-100 text-amber-800 rounded-xl cursor-pointer"
                      title={t('ترجمة آلية', 'Auto-translate')}
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم المورد بالإنجليزي', 'Supplier Name (English)')}
                  </label>
                  <input
                    type="text"
                    value={newSupplier.nameEn}
                    onChange={(e) => setNewSupplier({ ...newSupplier, nameEn: e.target.value })}
                    placeholder="English name..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الهاتف للتواصل *', 'Phone / Contact *')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="01xxxxxxxxx"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('البريد الإلكتروني (اختياري)', 'Email (Optional)')}
                  </label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="supplier@company.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('السجل التجاري / البطاقة الضريبية', 'Commercial Register / Tax ID')}
                  </label>
                  <input
                    type="text"
                    value={newSupplier.nationalId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, nationalId: e.target.value })}
                    placeholder="مثال: 123-456-789"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الحد الائتماني المسموح (ج.م)', 'Credit Limit (EGP)')}
                  </label>
                  <input
                    type="number"
                    value={newSupplier.creditLimit}
                    onChange={(e) => setNewSupplier({ ...newSupplier, creditLimit: Number(e.target.value) })}
                    placeholder="50000"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('العنوان ومقر المورد', 'Address / Headquarters')}
                </label>
                <input
                  type="text"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  placeholder="مثال: القاهرة، المنطقة الصناعية..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('شروط السداد وملاحظات التوريد', 'Payment Terms & Notes')}
                </label>
                <input
                  type="text"
                  value={newSupplier.medicalNotes}
                  onChange={(e) => setNewSupplier({ ...newSupplier, medicalNotes: e.target.value })}
                  placeholder="مثال: دفعات آجلة 30 يوم، تحويل بنكي..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleSaveSupplier}
                  className="flex-1 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors cursor-pointer shadow-md shadow-amber-600/20"
                >
                  {t('حفظ المورد في السجل', 'Save Supplier')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER STATEMENT MODAL */}
      {showStatementModal && (
        <PartyStatementModal
          initialPartyId={statementPartyId}
          onClose={() => {
            setShowStatementModal(false);
            setStatementPartyId(null);
          }}
        />
      )}
    </div>
  );
};
