import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  GitBranch,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  LayoutGrid,
  Table,
  Zap,
} from 'lucide-react';
import { PartyStatementModal } from '../components/PartyStatementModal';
import { exportToCsv, shareViaWhatsApp } from '../utils/exportUtils';
import {
  ExcelDataTransferModal,
  ExcelColumnConfig,
  CellValidationError,
  ExcelValidationResult,
} from '../components/ExcelDataTransferModal';

const partyExcelColumns: ExcelColumnConfig[] = [
  {
    key: 'name',
    labelAr: 'الاسم بالعربي',
    labelEn: 'Full Name Ar',
    required: true,
    type: 'text',
    sampleValue: 'سارة أحمد محمود',
    instructions: 'الاسم ثلاثي أو ثنائي على الأقل للمريض أو العميل',
  },
  {
    key: 'nameEn',
    labelAr: 'الاسم بالإنجليزي',
    labelEn: 'Full Name En',
    required: false,
    type: 'text',
    sampleValue: 'Sara Ahmed Mahmoud',
    instructions: 'الاسم باللغة الإنجليزية (اختياري)',
  },
  {
    key: 'phone',
    labelAr: 'رقم الموبايل',
    labelEn: 'Phone Number',
    required: true,
    type: 'phone',
    sampleValue: '01011112233',
    instructions: 'رقم هاتف صالح يبدأ بـ 01 ويتكون من أرقام ولا يقل عن 8 أرقام',
  },
  {
    key: 'paperCode',
    labelAr: 'الكود الورقي',
    labelEn: 'Paper File Code',
    required: false,
    type: 'text',
    sampleValue: 'P-101',
    instructions: 'رقم الملف الورقي بالعيادة أو الأرشيف إن وجد',
  },
  {
    key: 'nationalId',
    labelAr: 'الرقم القومي',
    labelEn: 'National ID',
    required: false,
    type: 'text',
    sampleValue: '29501011234567',
    instructions: 'الرقم القومي أو رقم جواز السفر',
  },
  {
    key: 'leadSource',
    labelAr: 'مصدر العميل',
    labelEn: 'Lead Source',
    required: false,
    type: 'text',
    sampleValue: 'Facebook Ads',
    instructions: 'مصدر التعرف على العيادة (Facebook Ads, Instagram, صديق, زيارة مباشرة)',
  },
  {
    key: 'balance',
    labelAr: 'الرصيد الافتتاحي',
    labelEn: 'Opening Balance',
    required: false,
    type: 'number',
    sampleValue: 0,
    instructions: 'الرصيد المالي السابق إن وجد (مدين موجب، دائن سالب، أو 0)',
  },
  {
    key: 'creditLimit',
    labelAr: 'الحد الائتماني',
    labelEn: 'Credit Limit',
    required: false,
    type: 'number',
    sampleValue: 10000,
    instructions: 'الحد الأقصى للمديونية المسموحة للعميل',
  },
  {
    key: 'address',
    labelAr: 'العنوان',
    labelEn: 'Address',
    required: false,
    type: 'text',
    sampleValue: 'مدينة نصر، القاهرة',
    instructions: 'محل الإقامة أو المحافظة والمنطقة',
  },
  {
    key: 'medicalNotes',
    labelAr: 'ملاحظات وتاريخ صحي',
    labelEn: 'Medical Notes',
    required: false,
    type: 'text',
    sampleValue: 'جلسات ليزر كانديلا سابقة، بشرة حساسة',
    instructions: 'أي حساسية، تاريخ مرضي، أو تعليمات للجلسات',
  },
];

export const PartiesView: React.FC = () => {
  const {
    t,
    formatMoney,
    parties,
    addParty,
    updateParty,
    deleteParty,
    importPartiesBulk,
    importCustomersFromExcel,
    language,
    tenant,
    activeBranch,
    branches,
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
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
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

  // Only patients & customers strictly belonging to the active branch
  const currentBranchId = activeBranch?.id || (branches.length > 0 ? branches[0].id : 'branch-cairo');
  const customers = parties.filter((p) => {
    const isCustomer = p.type === 'Customer' || p.type === 'Both';
    if (!isCustomer) return false;
    if (p.branchId) {
      return (
        p.branchId === currentBranchId ||
        (activeBranch?.name && p.branchId === activeBranch.name) ||
        (activeBranch?.code && p.branchId === activeBranch.code)
      );
    }
    if (Array.isArray(p.branchIds) && p.branchIds.length > 0) {
      return (
        p.branchIds.includes(currentBranchId) ||
        (activeBranch?.name && p.branchIds.includes(activeBranch.name)) ||
        (activeBranch?.code && p.branchIds.includes(activeBranch.code))
      );
    }
    return currentBranchId === (branches[0]?.id || 'branch-cairo');
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter, itemsPerPage]);

  const filteredParties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((p) => {
      if (activeFilter === 'WITH_BALANCE' && p.balance === 0) return false;
      if (activeFilter === 'ZERO_BALANCE' && p.balance !== 0) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.phone.includes(q) ||
        (p.systemCode && p.systemCode.toLowerCase().includes(q)) ||
        (p.paperCode && p.paperCode.toLowerCase().includes(q))
      );
    });
  }, [customers, activeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredParties.length / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedParties = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredParties.slice(start, start + itemsPerPage);
  }, [filteredParties, safeCurrentPage, itemsPerPage]);

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
      branchId: activeBranch?.id || branches[0]?.id || 'branch-cairo',
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

  const handleEditClick = (party: Party) => {
    setEditingParty({ ...party });
    setShowEditModal(true);
  };

  const handleSaveEditParty = () => {
    if (!editingParty || !editingParty.name.trim() || !editingParty.phone.trim()) {
      alert(t('يرجى كتابة الاسم ورقم الهاتف!', 'Please provide name and phone!'));
      return;
    }
    updateParty(editingParty.id, {
      name: editingParty.name.trim(),
      nameEn: editingParty.nameEn?.trim() || autoTranslateArabic(editingParty.name),
      phone: editingParty.phone.trim(),
      email: editingParty.email?.trim() || undefined,
      paperCode: editingParty.paperCode?.trim() || undefined,
      nationalId: editingParty.nationalId?.trim() || undefined,
      address: editingParty.address?.trim() || undefined,
      medicalNotes: editingParty.medicalNotes?.trim() || undefined,
      leadSource: editingParty.leadSource,
      creditLimit: Number(editingParty.creditLimit) || 0,
    });
    setShowEditModal(false);
    setEditingParty(null);
  };

  const handleDeleteParty = (id: string, name: string) => {
    if (window.confirm(t(`هل أنت متأكد من حذف العميل/المريض "${name}" نهائياً من قاعدة البيانات؟`, `Are you sure you want to permanently delete "${name}"?`))) {
      deleteParty(id);
    }
  };

  // Validator & Importer for Customers / Patients
  const validatePartyRows = (rawRows: any[]): ExcelValidationResult<any> => {
    const errors: CellValidationError[] = [];
    const validRows: any[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // Row number in Excel

      const name = String(row['الاسم بالعربي'] || row['الاسم'] || row['Name'] || row['Full Name Ar'] || '').trim();
      const nameEn = String(row['الاسم بالإنجليزي'] || row['Name En'] || row['Full Name En'] || '').trim();
      const phone = String(row['رقم الموبايل'] || row['الموبايل'] || row['Phone'] || row['Phone Number'] || row['الهاتف'] || '').trim();
      const paperCode = String(row['الكود الورقي'] || row['Paper File Code'] || row['Paper Code'] || '').trim();
      const nationalId = String(row['الرقم القومي'] || row['National ID'] || row['الهوية'] || '').trim();
      const leadSource = String(row['مصدر العميل'] || row['Lead Source'] || row['مصدر الإعلان'] || 'Excel Import').trim();
      const rawBalance = row['الرصيد الافتتاحي'] !== undefined && row['الرصيد الافتتاحي'] !== '' ? row['الرصيد الافتتاحي'] : (row['Opening Balance'] || 0);
      const rawCreditLimit = row['الحد الائتماني'] !== undefined && row['الحد الائتماني'] !== '' ? row['الحد الائتماني'] : (row['Credit Limit'] || 10000);
      const address = String(row['العنوان'] || row['Address'] || '').trim();
      const medicalNotes = String(row['ملاحظات وتاريخ صحي'] || row['ملاحظات طبية'] || row['Medical Notes'] || '').trim();

      // Validate Name
      if (!name || name.length < 2) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'name',
          columnLabelAr: 'الاسم بالعربي',
          enteredValue: name,
          reasonAr: 'اسم العميل حقل إلزامي ويجب ألا يقل عن حرفين',
        });
      }

      // Validate Phone
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      if (!phone) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'phone',
          columnLabelAr: 'رقم الموبايل',
          enteredValue: phone,
          reasonAr: 'رقم هاتف العميل حقل إلزامي لا يمكن تركه فارغاً',
        });
      } else if (cleanPhone.length < 7) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'phone',
          columnLabelAr: 'رقم الموبايل',
          enteredValue: phone,
          reasonAr: 'رقم الهاتف غير صالح، يجب أن يحتوي على أرقام فقط ولا يقل عن 7 أرقام',
        });
      }

      // Validate Balance
      const balanceNum = Number(rawBalance);
      if (isNaN(balanceNum)) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'balance',
          columnLabelAr: 'الرصيد الافتتاحي',
          enteredValue: rawBalance,
          reasonAr: 'الرصيد الافتتاحي يجب أن يكون قيمة رقمية صالحة (مثال: 0 أو 500 أو -200)',
        });
      }

      // Validate Credit Limit
      const creditLimitNum = Number(rawCreditLimit);
      if (isNaN(creditLimitNum) || creditLimitNum < 0) {
        errors.push({
          rowNumber: rowNum,
          columnKey: 'creditLimit',
          columnLabelAr: 'الحد الائتماني',
          enteredValue: rawCreditLimit,
          reasonAr: 'الحد الائتماني يجب أن يكون رقماً موجباً أو صفراً',
        });
      }

      validRows.push({
        name,
        nameEn: nameEn || autoTranslateArabic(name),
        phone: cleanPhone || phone,
        paperCode,
        nationalId,
        leadSource,
        balance: isNaN(balanceNum) ? 0 : balanceNum,
        creditLimit: isNaN(creditLimitNum) ? 10000 : creditLimitNum,
        address,
        medicalNotes,
      });
    });

    return {
      totalRows: rawRows.length,
      errors,
      validRows: errors.length === 0 ? validRows : [],
    };
  };

  const handleConfirmPartyImport = async (validRows: any[]) => {
    const branchToUse = activeBranch?.id || currentBranchId;
    const mapped = validRows.map((row) => ({
      name: row.name,
      nameEn: row.nameEn,
      phone: row.phone,
      type: 'Customer' as const,
      branchId: branchToUse,
      paperCode: row.paperCode || undefined,
      nationalId: row.nationalId || undefined,
      leadSource: row.leadSource || 'Excel Import',
      balance: row.balance || 0,
      creditLimit: row.creditLimit || 10000,
      address: row.address || undefined,
      medicalNotes: row.medicalNotes || undefined,
    }));
    await importPartiesBulk(mapped);
    setShowExcelModal(false);
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
                {t('سجل العملاء', 'Customers Directory')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'سجل العملاء لإدارة الملفات، الأكواد الورقية، استيراد شيتات الإكسيل، ومتابعة الحسابات',
                  'Customers directory for managing profiles, paper codes, Excel import, and account ledgers'
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

      {/* Performance Bar & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 text-[11px]">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>
              {t(
                `عرض ${filteredParties.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1} - ${Math.min(
                  safeCurrentPage * itemsPerPage,
                  filteredParties.length
                )} من إجمالي ${filteredParties.length} عميل`,
                `Showing ${filteredParties.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1} - ${Math.min(
                  safeCurrentPage * itemsPerPage,
                  filteredParties.length
                )} of ${filteredParties.length} clients`
              )}
            </span>
          </span>

          {filteredParties.length > 500 && (
            <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
              ⚡ {t('نظام تقسيم الصفحات عالي الأداء مفعل لمنع تعليق المتصفح', 'High-performance pagination active')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Items Per Page */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-bold">{t('لكل صفحة:', 'Per page:')}</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          {/* Grid / Table Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('GRID')}
              title={t('عرض كروت', 'Cards View')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'GRID'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              title={t('عرض جدول سريع', 'Compact Table View')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <Table className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Display: Grid or Table */}
      {filteredParties.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-400 space-y-2">
          <Users className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {t('لم يتم العثور على أي عملاء يطابقون البحث أو الفلتر', 'No clients match your filter or search query')}
          </p>
          <p className="text-xs text-slate-400">
            {t('تأكد من كتابة الاسم أو رقم الهاتف بشكل صحيح، أو اضغط مسح البحث', 'Check spelling or clear search filter')}
          </p>
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedParties.map((party) => (
            <div
              key={party.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {t('مريض / عميل', 'Patient / Client')}
                      </span>
                      {party.systemCode && (
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {party.systemCode}
                        </span>
                      )}
                      {(() => {
                        const branchObj = branches.find((b) => b.id === party.branchId) || activeBranch;
                        return branchObj ? (
                          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800 inline-flex items-center gap-1">
                            <GitBranch className="h-2.5 w-2.5" />
                            {branchObj.name}
                          </span>
                        ) : null;
                      })()}
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

                  <button
                    onClick={() => handleEditClick(party)}
                    title={t('تعديل بيانات العميل', 'Edit Customer')}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteParty(party.id, party.name)}
                    title={t('حذف العميل', 'Delete Customer')}
                    className="p-1 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Compact Table View */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">{t('كود النظام', 'Code')}</th>
                <th className="p-3">{t('اسم العميل / المريض', 'Name')}</th>
                <th className="p-3">{t('الموبايل', 'Phone')}</th>
                <th className="p-3">{t('الفرع', 'Branch')}</th>
                <th className="p-3">{t('الرصيد المالي', 'Balance')}</th>
                <th className="p-3">{t('الكود الورقي', 'Paper Code')}</th>
                <th className="p-3">{t('المصدر', 'Lead Source')}</th>
                <th className="p-3 text-center">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedParties.map((party, idx) => {
                const branchObj = branches.find((b) => b.id === party.branchId) || activeBranch;
                return (
                  <tr key={party.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="p-3 text-slate-400 font-mono">
                      {(safeCurrentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {party.systemCode || '—'}
                    </td>
                    <td className="p-3 font-extrabold text-slate-900 dark:text-white">
                      <div>{party.name}</div>
                      {party.nameEn && <div className="text-[10px] text-slate-400 font-normal">{party.nameEn}</div>}
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                      {party.phone}
                    </td>
                    <td className="p-3 text-slate-500">
                      {branchObj?.name || '—'}
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <span
                        className={
                          party.balance > 0
                            ? 'text-rose-600'
                            : party.balance < 0
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                        }
                      >
                        {formatMoney(party.balance)}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {party.paperCode || '—'}
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {party.leadSource || '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {party.phone && (
                          <button
                            onClick={() => shareViaWhatsApp(party.phone, `مرحباً ${party.name}`)}
                            title={t('واتساب', 'WhatsApp')}
                            className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setStatementPartyId(party.id);
                            setShowStatementModal(true);
                          }}
                          title={t('كشف الحساب', 'Statement')}
                          className="p-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditClick(party)}
                          title={t('تعديل', 'Edit')}
                          className="p-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteParty(party.id, party.name)}
                          title={t('حذف', 'Delete')}
                          className="p-1 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modern Comprehensive Pagination Navigation Bar */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            {t(
              `صفحة ${safeCurrentPage} من إجمالي ${totalPages} صفحة (${filteredParties.length} عميل)`,
              `Page ${safeCurrentPage} of ${totalPages} (${filteredParties.length} clients)`
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              title={t('الصفحة الأولى', 'First Page')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              title={t('الصفحة السابقة', 'Previous Page')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Page Number Pills Window */}
            {(() => {
              const pages: number[] = [];
              const maxButtons = 5;
              let startPage = Math.max(1, safeCurrentPage - 2);
              let endPage = Math.min(totalPages, startPage + maxButtons - 1);
              if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
              }
              for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
              }

              return pages.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-w-8 h-8 rounded-xl font-bold transition-all cursor-pointer ${
                    safeCurrentPage === pageNum
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              ));
            })()}

            {/* Next Page */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              title={t('الصفحة التالية', 'Next Page')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              title={t('الصفحة الأخيرة', 'Last Page')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Jump Input */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">{t('انتقال:', 'Go to:')}</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={safeCurrentPage}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= totalPages) {
                  setCurrentPage(val);
                }
              }}
              className="w-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-center font-bold text-xs outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* ADD PARTY / PATIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <span>{t('إضافة مريض / عميل جديد للمركز', 'Add New Patient / Client')}</span>
            </h3>

            <div className="space-y-3 text-xs">

              {/* Branch Field (الفرع التابع له العميل - بشكل افتراضي للفرع المفعل وغير قابل للتعديل) */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('الفرع التابع له العميل', 'Assigned Branch')}</span>
                  </label>
                  <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-bold">
                    {t('الفرع المفعل (غير قابل للتعديل)', 'Active Branch (Read-Only)')}
                  </span>
                </div>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={activeBranch?.name || branches.find((b) => b.id === currentBranchId)?.name || t('الفرع الرئيسي', 'Main Branch')}
                  className="w-full rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 p-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 outline-none cursor-not-allowed select-none"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {t('يتم تسجيل العميل وتكويده تلقائياً ضمن فرع المركز المفعل حالياً.', 'Customer will automatically be linked strictly to the active branch.')}
                </p>
              </div>

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

              {/* Notes (ملاحظات) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={newParty.medicalNotes}
                  onChange={(e) => setNewParty({ ...newParty, medicalNotes: e.target.value })}
                  placeholder={t('أي ملاحظات خاصة بالعميل...', 'Any notes regarding the customer...')}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 outline-none dark:border-slate-700 dark:text-white text-xs"
                />
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

      {/* EXCEL DATA TRANSFER & VALIDATION MODAL */}
      <ExcelDataTransferModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        entityTitleAr="بيانات وسجلات العملاء والمرضى"
        entityTitleEn="Customers & Patients Database"
        descriptionAr="استيراد وتصدير قاعدة بيانات العملاء مع الفحص الخلوي الذكي واكتشاف الأخطاء"
        columns={partyExcelColumns}
        currentDataForExport={filteredParties.map((p) => ({
          name: p.name,
          nameEn: p.nameEn || '',
          phone: p.phone,
          paperCode: p.paperCode || '',
          nationalId: p.nationalId || '',
          leadSource: p.leadSource || '',
          balance: p.balance || 0,
          creditLimit: p.creditLimit || 0,
          address: p.address || '',
          medicalNotes: p.medicalNotes || '',
        }))}
        exportFileNamePrefix="سجل_العملاء_والمرضى"
        validator={validatePartyRows}
        onConfirmImport={handleConfirmPartyImport}
        branchName={activeBranch?.name || 'الفرع الحالي'}
      />
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

      {/* EDIT CUSTOMER MODAL */}
      {showEditModal && editingParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-indigo-600" />
                <span>{t('تعديل بيانات العميل / المريض', 'Edit Client / Patient')}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingParty(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالعربي *', 'Full Name (Arabic) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingParty.name}
                    onChange={(e) => setEditingParty({ ...editingParty, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالإنجليزي', 'Full Name (English)')}
                  </label>
                  <input
                    type="text"
                    value={editingParty.nameEn || ''}
                    onChange={(e) => setEditingParty({ ...editingParty, nameEn: e.target.value })}
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
                    value={editingParty.phone}
                    onChange={(e) => setEditingParty({ ...editingParty, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الكود الورقي', 'Paper File #')}
                  </label>
                  <input
                    type="text"
                    value={editingParty.paperCode || ''}
                    onChange={(e) => setEditingParty({ ...editingParty, paperCode: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الحد الائتماني', 'Credit Limit')}
                  </label>
                  <input
                    type="number"
                    value={editingParty.creditLimit || 0}
                    onChange={(e) => setEditingParty({ ...editingParty, creditLimit: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('مصدر العميل / الإعلان', 'Lead Source')}
                </label>
                <select
                  value={editingParty.leadSource || 'Facebook Ads'}
                  onChange={(e) => setEditingParty({ ...editingParty, leadSource: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="Facebook Ads">Facebook Ads</option>
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Friend Referral">ترشيح صديق</option>
                  <option value="Walk-in">زيارة مباشرة</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('العنوان', 'Address')}
                </label>
                <input
                  type="text"
                  value={editingParty.address || ''}
                  onChange={(e) => setEditingParty({ ...editingParty, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات وتاريخ صحي', 'Medical / General Notes')}
                </label>
                <textarea
                  rows={2}
                  value={editingParty.medicalNotes || ''}
                  onChange={(e) => setEditingParty({ ...editingParty, medicalNotes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingParty(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditParty}
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
