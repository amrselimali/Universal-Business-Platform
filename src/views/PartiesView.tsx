import React, { useState, useRef } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Party } from '../types';
import { autoTranslateArabic } from '../utils/translator';
import * as XLSX from 'xlsx';
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
  Upload,
  Download,
  FileSpreadsheet,
  Sparkles,
  HeartPulse,
  Tag,
  Hash,
  Filter,
  FileText,
  Package,
  MessageCircle,
} from 'lucide-react';
import { PartyStatementModal } from '../components/PartyStatementModal';
import { exportToCsv, shareViaWhatsApp } from '../utils/exportUtils';

export const PartiesView: React.FC = () => {
  const {
    t,
    formatMoney,
    parties,
    addParty,
    importCustomersFromExcel,
    language,
    tenant,
    activeBranch,
    clientOffers,
    addClientOffer,
    consumeClientOfferSession,
  } = usePlatform();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'WITH_BALANCE' | 'ZERO_BALANCE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [statementPartyId, setStatementPartyId] = useState<string | null>(null);
  const [statementInitialMode, setStatementInitialMode] = useState<'VALUE' | 'QUANTITY'>('VALUE');
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
  const [selectedPackageParty, setSelectedPackageParty] = useState<Party | null>(null);
  const [newOfferName, setNewOfferName] = useState('');
  const [newOfferSessions, setNewOfferSessions] = useState(6);
  const [newOfferPrice, setNewOfferPrice] = useState(1500);
  const [newOfferExpiry, setNewOfferExpiry] = useState(
    new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newParty, setNewParty] = useState({
    name: '',
    nameEn: '',
    type: 'Customer' as const,
    phone: '',
    email: '',
    paperCode: '',
    nationalId: '',
    address: '',
    medicalNotes: '',
    allergies: '',
    leadSource: 'Facebook Ads',
    creditLimit: 10000,
  });

  // Only patients & customers
  const customers = parties.filter((p) => p.type === 'Customer' || p.type === 'Both');

  const filteredParties = customers.filter((p) => {
    if (activeFilter === 'WITH_BALANCE' && p.balance === 0) return false;
    if (activeFilter === 'ZERO_BALANCE' && p.balance !== 0) return false;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
      p.phone.includes(q) ||
      (p.systemCode && p.systemCode.toLowerCase().includes(q)) ||
      (p.paperCode && p.paperCode.toLowerCase().includes(q));
    return matchesSearch;
  });

  const handleAutoTranslateName = () => {
    if (newParty.name.trim()) {
      setNewParty((prev) => ({
        ...prev,
        nameEn: autoTranslateArabic(prev.name),
      }));
    }
  };

  const handleSaveParty = () => {
    if (!newParty.name.trim() || !newParty.phone.trim()) {
      alert(t('يرجى كتابة الاسم ورقم الهاتف!', 'Please provide name and phone!'));
      return;
    }

    addParty({
      name: newParty.name.trim(),
      nameEn: newParty.nameEn.trim() || autoTranslateArabic(newParty.name),
      type: newParty.type,
      phone: newParty.phone.trim(),
      email: newParty.email.trim() || undefined,
      paperCode: newParty.paperCode.trim() || undefined,
      nationalId: newParty.nationalId.trim() || undefined,
      address: newParty.address.trim() || undefined,
      medicalNotes: newParty.medicalNotes.trim() || undefined,
      allergies: newParty.allergies.trim() ? newParty.allergies.split(',').map((s) => s.trim()) : undefined,
      leadSource: newParty.leadSource,
      balance: 0,
      creditLimit: Number(newParty.creditLimit) || 0,
    });

    setShowAddModal(false);
    setNewParty({
      name: '',
      nameEn: '',
      type: 'Customer',
      phone: '',
      email: '',
      paperCode: '',
      nationalId: '',
      address: '',
      medicalNotes: '',
      allergies: '',
      leadSource: 'Facebook Ads',
      creditLimit: 10000,
    });
  };

  // Excel Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json(ws);

        const formatted = rawData.map((row: any) => ({
          name: row['الاسم'] || row['Name'] || row['الاسم بالعربي'] || 'مريض جديد',
          nameEn: row['Name En'] || row['الاسم بالإنجليزي'] || undefined,
          phone: String(row['الموبايل'] || row['Phone'] || row['الهاتف'] || ''),
          email: row['Email'] || row['البريد'] || undefined,
          paperCode: row['الكود الورقي'] || row['Paper Code'] || undefined,
          address: row['العنوان'] || row['Address'] || undefined,
          medicalNotes: row['ملاحظات طبية'] || row['Medical Notes'] || undefined,
          allergies: row['حساسية'] ? String(row['حساسية']).split(',') : undefined,
          leadSource: row['مصدر الإعلان'] || row['Lead Source'] || 'Excel Import',
        }));

        importCustomersFromExcel(formatted);
        alert(t(`تم استيراد ${formatted.length} مريض/عميل بنجاح!`, `Successfully imported ${formatted.length} customers!`));
        setShowExcelModal(false);
      } catch (err) {
        alert(t('حدث خطأ أثناء قراءة ملف الإكسيل، يرجى التأكد من التنسيق!', 'Error reading Excel file!'));
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'الاسم': 'سارة أحمد محمود',
        'Name En': 'Sara Ahmed Mahmoud',
        'الموبايل': '01011112233',
        'الكود الورقي': 'P-101',
        'العنوان': 'مدينة نصر، القاهرة',
        'ملاحظات طبية': 'جلسات ليزر كانديلا سابقة، بشرة حساسة',
        'حساسية': 'البنسلين, حساسية شمس',
        'مصدر الإعلان': 'Facebook Ads',
      },
      {
        'الاسم': 'مروة عبد الرحمن',
        'Name En': 'Marwa Abdelrahman',
        'الموبايل': '01122334455',
        'الكود الورقي': 'P-102',
        'العنوان': 'التجمع الخامس',
        'ملاحظات طبية': 'علاج تصبغات وهيدرافيشل',
        'حساسية': '',
        'مصدر الإعلان': 'Instagram',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients_Template');
    XLSX.writeFile(wb, 'Patients_Import_Template.xlsx');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                {t('سجل المرضى والعملاء 360 (Patients & Customers Directory)', 'Patients & Customers Directory')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'شاشة مخصصة لإدارة ملفات المرضى والعملاء، الأكواد الورقية، استيراد شيتات الإكسيل، والتاريخ الطبي',
                  'Dedicated directory for patients & customers profiles, paper file codes, Excel import, and medical records'
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
            <span>{t('كشوف حسابات العملاء', 'Customer Statements')}</span>
          </button>

          <button
            onClick={() => setShowExcelModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>{t('رفع إكسيل العملاء', 'Import Excel')}</span>
          </button>

          <button
            onClick={() => {
              const rows = filteredParties.map((p) => ({
                'كود النظام': p.systemCode || '',
                'الاسم بالعربي': p.name,
                'الاسم بالإنجليزية': p.nameEn || '',
                'رقم الهاتف': p.phone,
                'الرصيد المالي': p.balance,
                'الرقم القومي': p.nationalId || '',
                'الكود الورقي': p.paperCode || '',
                'المصدر التسويقي': p.leadSource || '',
              }));
              exportToCsv(rows, 'سجل_المرضى_والعملاء');
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4 text-sky-600" />
            <span>{t('تصدير إكسيل', 'Export Excel')}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة مريض / عميل جديد', 'Add Patient / Client')}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('كافة المرضى والعملاء', 'All Patients')} ({customers.length})
          </button>
          <button
            onClick={() => setActiveFilter('WITH_BALANCE')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'WITH_BALANCE'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('عملاء بأرصدة غير مسواة', 'With Balance')} ({customers.filter((c) => c.balance !== 0).length})
          </button>
          <button
            onClick={() => setActiveFilter('ZERO_BALANCE')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'ZERO_BALANCE'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('أرصدة مسواة (صفر)', 'Zero Balance')} ({customers.filter((c) => c.balance === 0).length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('بحث بالاسم، الكود، أو الموبايل...', 'Search by name, code or phone...')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-8 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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

      {/* Grid of Parties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredParties.map((party) => (
          <div
            key={party.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {t('مريض / عميل', 'Patient / Client')}
                    </span>
                    {party.systemCode && (
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {party.systemCode}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1.5">{party.name}</h3>
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

              <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 space-y-1 mt-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono font-semibold">{party.phone}</span>
                </div>

                {party.paperCode && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                    <span>{t('الكود الورقي:', 'Paper File:')} {party.paperCode}</span>
                  </div>
                )}

                {party.medicalNotes && (
                  <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg mt-1">
                    <HeartPulse className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{party.medicalNotes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
              <div className="text-[10px] text-slate-400 truncate">
                {party.leadSource && <span>{party.leadSource} • </span>}
                <span>{formatMoney(party.creditLimit)} {t('ائتمان', 'limit')}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {party.phone && (
                  <button
                    onClick={() =>
                      shareViaWhatsApp(
                        party.phone,
                        `مرحباً ${party.name}، نتواصل معكم بخصوص مواعيدكم وحسابكم في ${tenant?.name || 'المركز'}...`
                      )
                    }
                    title={t('مراسلة عبر واتساب', 'Chat on WhatsApp')}
                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 hover:bg-emerald-100 cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setSelectedPackageParty(party)}
                  title={t('إدارة باقات وعروض واشتراكات المريض', 'Client Packages & Sessions')}
                  className="inline-flex items-center gap-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 px-2 py-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 cursor-pointer"
                >
                  <Package className="h-3.5 w-3.5 text-purple-600" />
                  <span>{t('الباقات', 'Packages')}</span>
                </button>

                <button
                  onClick={() => {
                    setStatementPartyId(party.id);
                    setShowStatementModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer shrink-0"
                >
                  <FileText className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{t('كشف الحساب', 'Statement')}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ADD PARTY / PATIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <span>{t('إضافة مريض / عميل جديد للمركز', 'Add New Patient / Client')}</span>
            </h3>

            <div className="space-y-3 text-xs">

              {/* Dual Language Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالعربي *', 'Full Name (Arabic) *')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newParty.name}
                      onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                      placeholder="اسم المريض أو العميل..."
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAutoTranslateName}
                      className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-xl cursor-pointer"
                      title={t('ترجمة آلية', 'Auto-translate')}
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالإنجليزي', 'Full Name (English)')}
                  </label>
                  <input
                    type="text"
                    value={newParty.nameEn}
                    onChange={(e) => setNewParty({ ...newParty, nameEn: e.target.value })}
                    placeholder="English name..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الموبايل / الهاتف *', 'Phone *')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={newParty.phone}
                    onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                    placeholder="01xxxxxxxxx"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الكود الورقي (الملف)', 'Paper File #')}
                  </label>
                  <input
                    type="text"
                    value={newParty.paperCode}
                    onChange={(e) => setNewParty({ ...newParty, paperCode: e.target.value })}
                    placeholder="P-101"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('مصدر العميل / الإعلان', 'Lead Source')}
                  </label>
                  <select
                    value={newParty.leadSource}
                    onChange={(e) => setNewParty({ ...newParty, leadSource: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Facebook Ads">Facebook Ads</option>
                    <option value="Instagram">Instagram</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Friend Referral">ترشيح صديق</option>
                    <option value="Walk-in">زيارة مباشرة</option>
                  </select>
                </div>
              </div>

              {/* Medical notes & Allergies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('ملاحظات طبية وتاريخ علاجي', 'Medical History')}
                  </label>
                  <input
                    type="text"
                    value={newParty.medicalNotes}
                    onChange={(e) => setNewParty({ ...newParty, medicalNotes: e.target.value })}
                    placeholder="جلسات سابقة، نوع البشرة..."
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 outline-none dark:border-slate-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('حساسية الأدوية (مفصولة بفواصل)', 'Allergies')}
                  </label>
                  <input
                    type="text"
                    value={newParty.allergies}
                    onChange={(e) => setNewParty({ ...newParty, allergies: e.target.value })}
                    placeholder="بنسلين، ليدوكايين..."
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 outline-none dark:border-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSaveParty}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  {t('حفظ في السجل', 'Save Party')}
                </button>
                <button
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

      {/* EXCEL UPLOAD MODAL */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <span>{t('استيراد المرضى والعملاء عبر ملف إكسيل', 'Import Patients via Excel')}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t(
                'يمكنك رفع ملف إكسيل يحتوي على بيانات المرضى وأرقام الهواتف والملاحظات الطبية لإضافتهم دفعة واحدة.',
                'Upload an Excel (.xlsx/.xls) spreadsheet with patient records, phone numbers & medical notes.'
              )}
            </p>

            <div className="space-y-4">
              {/* File Upload Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <Upload className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t('اضغط هنا لاختيار ملف الإكسيل (.xlsx)', 'Click to choose Excel file (.xlsx)')}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  {t('أو اسحب وأفلت الملف في هذا المربع', 'or drag and drop file here')}
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
              </div>

              {/* Download Template Link */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {t('نموذج إكسيل قياسي للتعبئة:', 'Download standard template:')}
                </span>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t('تحميل النموذج', 'Sample File')}</span>
                </button>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExcelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* PARTY STATEMENT MODAL */}
      {showStatementModal && (
        <PartyStatementModal
          initialPartyId={statementPartyId}
          initialMode={statementInitialMode}
          onClose={() => {
            setShowStatementModal(false);
            setStatementPartyId(null);
            setStatementInitialMode('VALUE');
          }}
        />
      )}

      {/* CLIENT PACKAGES & SUBSCRIPTIONS MODAL */}
      {selectedPackageParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {t('باقات وعروض واشتراكات العميل', 'Client Packages & Subscriptions')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedPackageParty.name} • {selectedPackageParty.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setStatementPartyId(selectedPackageParty.id);
                    setStatementInitialMode('QUANTITY');
                    setSelectedPackageParty(null);
                    setShowStatementModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-200 cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>{t('كشف حساب الكميات', 'Quantity Statement')}</span>
                </button>
                <button
                  onClick={() => setSelectedPackageParty(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* List of Active Packages */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('الباقات والاشتراكات الحالية:', 'Current Packages:')}
              </h4>

              {(() => {
                const partyOffers = clientOffers.filter((o) => o.clientId === selectedPackageParty.id);
                if (partyOffers.length === 0) {
                  return (
                    <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                      لا توجد باقات أو اشتراكات مسجلة لهذا العميل حالياً. يمكنك إضافة باقة جديدة بالأسفل.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {partyOffers.map((offer) => {
                      const percent = Math.round(((offer.totalSessions - offer.remainingSessions) / offer.totalSessions) * 100);
                      const isFinished = offer.remainingSessions <= 0;

                      return (
                        <div
                          key={offer.id}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2 shadow-xs"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                {offer.offerName}
                              </h5>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                القيمة: {formatMoney(offer.totalPrice)} • صالح حتى: {offer.expiresAt}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isFinished
                                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}
                            >
                              {isFinished ? 'مكتمل الاستهلاك' : 'نشطة وجارية'}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <div className="flex justify-between text-[11px] font-bold mb-1">
                              <span className="text-purple-600 dark:text-purple-400">
                                المتبقي: {offer.remainingSessions} من {offer.totalSessions} جلسة
                              </span>
                              <span className="text-slate-400">{percent}% مستهلك</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-600 rounded-full transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          {/* Actions */}
                          {!isFinished && (
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={() => consumeClientOfferSession(offer.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>استهلاك جلسة واحدة الآن</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Add New Package Form */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-purple-600" />
                <span>{t('إسناد باقة أو عرض جديد للعميل', 'Assign New Package')}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الباقة أو العرض
                  </label>
                  <input
                    type="text"
                    value={newOfferName}
                    onChange={(e) => setNewOfferName(e.target.value)}
                    placeholder="مثال: باقة إزالة الشعر كامل الجسم 6 جلسات..."
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عدد الجلسات الإجمالي
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newOfferSessions}
                    onChange={(e) => setNewOfferSessions(Number(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    السعر الإجمالي للباقة (ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newOfferPrice}
                    onChange={(e) => setNewOfferPrice(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاريخ انتهاء الصلاحية
                  </label>
                  <input
                    type="date"
                    value={newOfferExpiry}
                    onChange={(e) => setNewOfferExpiry(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!newOfferName.trim()) {
                      alert('يرجى كتابة اسم الباقة أولاً');
                      return;
                    }
                    addClientOffer({
                      clientId: selectedPackageParty.id,
                      clientName: selectedPackageParty.name,
                      offerName: newOfferName.trim(),
                      totalSessions: newOfferSessions,
                      remainingSessions: newOfferSessions,
                      totalPrice: newOfferPrice,
                      expiresAt: newOfferExpiry,
                    });
                    setNewOfferName('');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>تأكيد إسناد الباقة للمريض</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
