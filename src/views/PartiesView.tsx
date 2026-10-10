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
  Lock,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';
import { PartyStatementModal } from '../components/PartyStatementModal';
import { exportToCsv, shareViaWhatsApp } from '../utils/exportUtils';
import { buildCustomerDuplicateIndex, buildCustomerDuplicateIndexAsync, CustomerDuplicateMatch, findCustomerDuplicates, findCustomerNameDuplicates } from '../utils/customerDuplicateDetection';
import {
  ExcelDataTransferModal,
  ExcelColumnConfig,
  CellValidationError,
  ExcelValidationResult,
} from '../components/ExcelDataTransferModal';

const partyExcelColumns: ExcelColumnConfig[] = [
  {
    key: 'branchName',
    labelAr: 'اسم الفرع',
    labelEn: 'Branch Name',
    required: false,
    type: 'text',
    sampleValue: 'فرع المعادي',
    instructions: 'اسم الفرع التابع له العميل (اختياري - يحدد الفرع الحالي افتراضياً)',
  },
  {
    key: 'customerCode',
    labelAr: 'كود العميل',
    labelEn: 'Customer Code',
    required: false,
    type: 'text',
    sampleValue: '1',
    instructions: 'كود العميل المسريل بالتطبيق (يحسب آلياً مسريل إذا ترك فارغاً)',
  },
  {
    key: 'systemCode',
    labelAr: 'كود السيستم',
    labelEn: 'System Code',
    required: false,
    type: 'text',
    sampleValue: 'P-101',
    instructions: 'كود السيستم (الكود الورقي سابقاً المحتفظ بالبيانات المدخلة)',
  },
  {
    key: 'fileCode',
    labelAr: 'كود الملف',
    labelEn: 'File Code',
    required: false,
    type: 'text',
    sampleValue: 'F-101',
    instructions: 'كود ورقم الملف الورقي بالعيادة أو الأرشيف (يدخل يدوياً عند تكويد العميل)',
  },
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

const MultiSelectFilter: React.FC<{
  label: string;
  selectAllLabel: string;
  clearLabel: string;
  emptyLabel: string;
  searchLabel: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (values: string[]) => void;
}> = ({ label, selectAllLabel, clearLabel, emptyLabel, searchLabel, options, selected, onChange }) => {
  const [search, setSearch] = useState('');
  const visibleOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? options.filter((option) => option.label.toLocaleLowerCase().includes(query) || option.value.toLocaleLowerCase().includes(query)) : options;
  }, [options, search]);
  const allVisibleSelected = visibleOptions.length > 0 && visibleOptions.every((option) => selected.includes(option.value));

  return (
    <details className="relative min-w-0 text-xs">
      <summary className="cursor-pointer list-none truncate rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
        {label} ({selected.length || '—'})
      </summary>
      <div className="absolute z-20 mt-1 max-h-72 min-w-full overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 bg-white pb-1 dark:bg-slate-900">
          <div className="relative">
            <Search className="absolute start-2 top-2 h-3.5 w-3.5 text-slate-400" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchLabel} className="w-full rounded border border-slate-200 bg-slate-50 py-1.5 ps-7 pe-2 dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <button type="button" disabled={visibleOptions.length === 0} onClick={() => {
            const visibleValues = new Set(visibleOptions.map((option) => option.value));
            onChange(allVisibleSelected ? selected.filter((value) => !visibleValues.has(value)) : [...new Set([...selected, ...visibleValues])]);
          }} className="mt-1 w-full rounded px-2 py-1 text-start font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
            {allVisibleSelected ? clearLabel : selectAllLabel} ({visibleOptions.length})
          </button>
        </div>
        {visibleOptions.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} />
            <span>{option.label}</span>
          </label>
        ))}
        {visibleOptions.length === 0 && <p className="px-2 py-2 text-slate-500">{emptyLabel}</p>}
      </div>
    </details>
  );
};

export const PartiesView: React.FC = () => {
  const {
    t,
    formatMoney,
    parties,
    addParty,
    updateParty,
    deleteParty,
    deletePartiesBulk,
    archiveParty,
    mergeCustomerParties,
    mergeCustomerPartiesBulk,
    allReceptionShifts,
    allInvoices,
    allCashReceipts,
    allSpecializedTaxInvoices,
    importPartiesBulk,
    importCustomersFromExcel,
    getNextCustomerAppCode,
    language,
    tenant,
    activeBranch,
    branches,
    clientOffers,
    addClientOffer,
    consumeClientOfferSession,
  } = usePlatform();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'WITH_BALANCE' | 'ZERO_BALANCE'>('ALL');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [statementPartyId, setStatementPartyId] = useState<string | null>(null);
  const [statementInitialMode, setStatementInitialMode] = useState<'VALUE' | 'QUANTITY'>('VALUE');
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
  const [showDuplicateReview, setShowDuplicateReview] = useState(false);
  const [duplicateReviewStartDate, setDuplicateReviewStartDate] = useState('');
  const [duplicateReviewEndDate, setDuplicateReviewEndDate] = useState('');
  const [duplicateReviewSubmitted, setDuplicateReviewSubmitted] = useState(false);
  const [duplicateReviewResults, setDuplicateReviewResults] = useState<Array<{ party: Party; match: CustomerDuplicateMatch }>>([]);
  const [duplicateReviewLoading, setDuplicateReviewLoading] = useState(false);
  const [duplicateReviewProgress, setDuplicateReviewProgress] = useState(0);
  const [duplicateReviewVisibleCount, setDuplicateReviewVisibleCount] = useState(100);
  const [codingFilters, setCodingFilters] = useState({ query: '', branchIds: [] as string[], statuses: ['active'], customerCodes: [] as string[], systemCodes: [] as string[], fileCodes: [] as string[], phone: '', dateFrom: '', dateTo: '' });
  const [codingResults, setCodingResults] = useState<Party[] | null>(null);
  const [selectedCodingPartyIds, setSelectedCodingPartyIds] = useState<string[]>([]);
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeNote, setMergeNote] = useState('');
  const [codingAction, setCodingAction] = useState<'merge' | 'archive' | 'delete' | null>(null);
  const [systemCodeMergeGroups, setSystemCodeMergeGroups] = useState<Array<{ systemCode: string; parties: Party[]; primaryId: string }>>([]);
  const duplicateReviewRunIdRef = useRef(0);
  const [showAddDuplicateWarning, setShowAddDuplicateWarning] = useState(false);
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

  const currentBranchId = activeBranch?.id || (branches.length > 0 ? branches[0].id : 'branch-cairo');

  const [autoFileCodeFromCustomerCode, setAutoFileCodeFromCustomerCode] = useState(true);
  const [newParty, setNewParty] = useState({
    name: '',
    nameEn: '',
    branchId: currentBranchId,
    type: 'Customer' as const,
    phone: '',
    email: '',
    systemCode: '',
    paperCode: '',
    fileCode: '',
    nationalId: '',
    address: '',
    medicalNotes: '',
    allergies: '',
    leadSource: 'Facebook Ads',
    creditLimit: 10000,
  });

  // Only patients & customers strictly belonging to the active branch
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

  const statusFilteredCustomers = useMemo(() => customers.filter((party) => {
    const isArchived = Boolean(party.isArchived || party.mergedIntoPartyId);
    if (customerStatusFilter === 'active') return !isArchived;
    if (customerStatusFilter === 'archived') return isArchived;
    return true;
  }), [customers, customerStatusFilter]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter, customerStatusFilter, itemsPerPage]);

  const filteredParties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return statusFilteredCustomers.filter((p) => {
      if (activeFilter === 'WITH_BALANCE' && p.balance === 0) return false;
      if (activeFilter === 'ZERO_BALANCE' && p.balance !== 0) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.phone.includes(q) ||
        (p.customerCode && p.customerCode.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.systemCode && p.systemCode.toLowerCase().includes(q)) ||
        (p.paperCode && p.paperCode.toLowerCase().includes(q)) ||
        (p.fileCode && p.fileCode.toLowerCase().includes(q)) ||
        (p.fileNumber && p.fileNumber.toLowerCase().includes(q))
      );
    });
  }, [statusFilteredCustomers, activeFilter, searchQuery]);

  const runCodingSearch = () => {
    const q = codingFilters.query.trim().toLocaleLowerCase();
    const phone = codingFilters.phone.trim().toLocaleLowerCase();
    const results = parties.filter((party) => {
      if (!(party.type === 'Customer' || party.type === 'Both')) return false;
      const isArchived = Boolean(party.isArchived || party.mergedIntoPartyId);
      if (codingFilters.statuses.length && !codingFilters.statuses.includes(isArchived ? 'archived' : 'active')) return false;
      const assignedBranch = branches.find((branch) => branch.id === party.branchId || branch.name === party.branchId || branch.code === party.branchId)?.id || party.branchId;
      const customerBranches = new Set([assignedBranch, ...(party.branchIds || []).map((value) => branches.find((branch) => branch.id === value || branch.name === value || branch.code === value)?.id || value)].filter(Boolean));
      if (codingFilters.branchIds.length && !codingFilters.branchIds.some((branchId) => customerBranches.has(branchId))) return false;
      const customerCode = party.customerCode || party.code || '';
      const systemCode = party.systemCode || party.paperCode || '';
      const fileCode = party.fileCode || party.fileNumber || '';
      if (codingFilters.customerCodes.length && !codingFilters.customerCodes.includes(customerCode)) return false;
      if (codingFilters.systemCodes.length && !codingFilters.systemCodes.includes(systemCode)) return false;
      if (codingFilters.fileCodes.length && !codingFilters.fileCodes.includes(fileCode)) return false;
      if (phone && ![party.phone, party.altPhone].some((value) => value?.toLocaleLowerCase().includes(phone))) return false;
      const createdDate = party.createdAt?.slice(0, 10) || '';
      if (codingFilters.dateFrom && (!createdDate || createdDate < codingFilters.dateFrom)) return false;
      if (codingFilters.dateTo && (!createdDate || createdDate > codingFilters.dateTo)) return false;
      if (q) {
        const values = Object.values(party).flatMap((value) => Array.isArray(value) ? value : [value]);
        if (!values.some((value) => value != null && String(value).toLocaleLowerCase().includes(q))) return false;
      }
      return true;
    });
    setCodingResults(results);
    setSelectedCodingPartyIds([]);
    setMergePrimaryId('');
  };

  const codingPartyOptions = useMemo(() => {
    const scopedParties = parties.filter((party) => {
      if (!(party.type === 'Customer' || party.type === 'Both')) return false;
      const isArchived = Boolean(party.isArchived || party.mergedIntoPartyId);
      if (codingFilters.statuses.length && !codingFilters.statuses.includes(isArchived ? 'archived' : 'active')) return false;
      const assignedBranch = branches.find((branch) => branch.id === party.branchId || branch.name === party.branchId || branch.code === party.branchId)?.id || party.branchId;
      const partyBranchIds = new Set([assignedBranch, ...(party.branchIds || []).map((value) => branches.find((branch) => branch.id === value || branch.name === value || branch.code === value)?.id || value)].filter(Boolean));
      return !codingFilters.branchIds.length || codingFilters.branchIds.some((branchId) => partyBranchIds.has(branchId));
    });
    const optionsFor = (getValue: (party: Party) => string | undefined) => Array.from(new Set(scopedParties.map(getValue).filter((value): value is string => Boolean(value?.trim())))).sort((a, b) => a.localeCompare(b, language === 'ar' ? 'ar' : 'en')).map((value) => ({ value, label: value }));
    return {
      customerCodes: optionsFor((party) => party.customerCode || party.code),
      systemCodes: optionsFor((party) => party.systemCode || party.paperCode),
      fileCodes: optionsFor((party) => party.fileCode || party.fileNumber),
    };
  }, [parties, branches, codingFilters.branchIds, codingFilters.statuses, language]);

  const selectedCodingIdSet = useMemo(() => new Set(selectedCodingPartyIds), [selectedCodingPartyIds]);
  const selectedCodingParties = parties.filter((party) => selectedCodingIdSet.has(party.id));
  const findSystemCodeMergeGroups = () => {
    const groupsByCode = new Map<string, Party[]>();
    parties.forEach((party) => {
      if (!(party.type === 'Customer' || party.type === 'Both') || party.isArchived || party.mergedIntoPartyId) return;
      const assignedBranch = branches.find((branch) => branch.id === party.branchId || branch.name === party.branchId || branch.code === party.branchId)?.id || party.branchId;
      const partyBranches = new Set([assignedBranch, ...(party.branchIds || []).map((value) => branches.find((branch) => branch.id === value || branch.name === value || branch.code === value)?.id || value)].filter(Boolean));
      if (codingFilters.branchIds.length && !codingFilters.branchIds.some((branchId) => partyBranches.has(branchId))) return;
      const systemCode = (party.systemCode || party.paperCode || '').trim();
      if (!systemCode) return;
      const normalizedCode = systemCode.toLocaleLowerCase();
      const matches = groupsByCode.get(normalizedCode) || [];
      matches.push(party);
      groupsByCode.set(normalizedCode, matches);
    });
    const groups = [...groupsByCode.entries()]
      .filter(([, matches]) => matches.length > 1)
      .map(([systemCodeKey, matches]) => ({
        systemCode: (matches[0].systemCode || matches[0].paperCode || systemCodeKey).trim(),
        parties: matches.sort((left, right) => (left.createdAt || '').localeCompare(right.createdAt || '') || left.name.localeCompare(right.name)),
        primaryId: '',
      }))
      .sort((left, right) => left.systemCode.localeCompare(right.systemCode));
    setSystemCodeMergeGroups(groups);
    setCodingAction(null);
    if (!groups.length) window.alert(t('لا توجد مجموعات عملاء نشطين لها كود سيستم متطابق ضمن الفروع المختارة.', 'No active customer groups share a system code within the selected branches.'));
  };

  const mergeAllSystemCodeGroups = () => {
    if (!systemCodeMergeGroups.length || systemCodeMergeGroups.some((group) => !group.primaryId)) return;
    const sourceCount = systemCodeMergeGroups.reduce((total, group) => total + group.parties.length - 1, 0);
    if (!window.confirm(t(`سيتم دمج ${sourceCount} ملف مصدر في ${systemCodeMergeGroups.length} ملفات رئيسية حسب اختيارك، وأرشفة الملفات المصدر. لن تتغير أي معاملات تاريخية. استمرار؟`, `Merge ${sourceCount} source files into ${systemCodeMergeGroups.length} primaries as selected, then archive the sources? Historical transactions will remain unchanged.`))) return;
    const mergeResult = mergeCustomerPartiesBulk(systemCodeMergeGroups.map((group) => ({
      primaryId: group.primaryId,
      sourceIds: group.parties.filter((party) => party.id !== group.primaryId).map((party) => party.id),
      note: `دمج لتطابق كود السيستم: ${group.systemCode}`,
    })));
    const mergedSourceIds = new Set(systemCodeMergeGroups.flatMap((group) => group.parties.filter((party) => party.id !== group.primaryId).map((party) => party.id)));
    setCodingResults((current) => current?.filter((party) => !mergedSourceIds.has(party.id)) || current);
    setSelectedCodingPartyIds((current) => current.filter((id) => !mergedSourceIds.has(id)));
    setSystemCodeMergeGroups([]);
    window.alert(t(`تم دمج ${mergeResult.sources} ملف في ${mergeResult.groups} مجموعات.`, `Merged ${mergeResult.sources} files across ${mergeResult.groups} groups.`));
  };

  const handleCodingAction = () => {
    if (!codingAction || selectedCodingPartyIds.length === 0) return;
    let successfullyProcessedIds: string[] = [];
    if (codingAction === 'merge') {
      const primary = selectedCodingParties.find((party) => party.id === mergePrimaryId);
      if (!primary || primary.isArchived) return;
      const sources = selectedCodingPartyIds.filter((id) => id !== mergePrimaryId);
      if (!sources.length) return;
      if (!window.confirm(t(`سيتم اعتماد ${primary.name} ملفاً رئيسياً وأرشفة ${sources.length} ملف. لن يتم تعديل أي سجل تاريخي. استمرار؟`, `Use ${primary.name} as the primary file and archive ${sources.length} files? Historical records will remain unchanged.`))) return;
      mergeCustomerParties(mergePrimaryId, sources, mergeNote);
      successfullyProcessedIds = sources;
    } else if (codingAction === 'archive') {
      if (!window.confirm(t(`أرشفة ${selectedCodingPartyIds.length} عميل؟`, `Archive ${selectedCodingPartyIds.length} selected customers?`))) return;
      selectedCodingPartyIds.forEach((id) => archiveParty(id, 'أرشفة جماعية من مراجعة تكويد العملاء'));
      successfullyProcessedIds = selectedCodingPartyIds;
    } else {
      const protectedCustomerIds = new Set<string>();
      allCashReceipts.forEach((receipt) => { if (receipt.partyId && receipt.status === 'active') protectedCustomerIds.add(receipt.partyId); });
      allInvoices.forEach((invoice) => { if ((invoice.status === 'Posted' || invoice.status === 'Refunded') && invoice.netAmount > 0) protectedCustomerIds.add(invoice.customerId); });
      allSpecializedTaxInvoices.forEach((invoice) => { if (invoice.partyId && invoice.status !== 'cancelled' && invoice.grandTotal > 0) protectedCustomerIds.add(invoice.partyId); });
      allReceptionShifts.forEach((shift) => shift.runRows.forEach((row) => { const id = row.customerId || row.patientId; if (id && (row.collectedAmount > 0 || row.totalRevenue > 0)) protectedCustomerIds.add(id); }));
      const protectedNames = selectedCodingParties.filter((party) => protectedCustomerIds.has(party.id));
      const deletableIds = selectedCodingParties.filter((party) => !protectedCustomerIds.has(party.id)).map((party) => party.id);
      if (!deletableIds.length) {
        window.alert(t(`لا يمكن حذف العملاء المحددين لوجود تحصيلات أو إيرادات سابقة. عدد العملاء المحميين: ${protectedNames.length}.`, `The selected customers have prior receipts or revenue and are protected from deletion. Protected customers: ${protectedNames.length}.`));
        return;
      }
      if (!window.confirm(t(`سيتم حذف ${deletableIds.length} عميل نهائياً. سيتم تجاوز ${selectedCodingPartyIds.length - deletableIds.length} عميل لوجود تحصيلات أو إيرادات سابقة. متابعة؟`, `Permanently delete ${deletableIds.length} customers? ${selectedCodingPartyIds.length - deletableIds.length} with prior receipts or revenue will be skipped.`))) return;
      const deletionResult = deletePartiesBulk(deletableIds);
      if (deletionResult.deleted !== deletableIds.length) {
        window.alert(t(`تم حذف ${deletionResult.deleted} فقط من ${deletableIds.length} نتيجة بسبب اختلاف نطاق المؤسسة أو تحديث البيانات.`, `Deleted ${deletionResult.deleted} of ${deletableIds.length}; tenant scope or data changes prevented the rest.`));
        successfullyProcessedIds = selectedCodingPartyIds.filter((id) => !protectedCustomerIds.has(id)).slice(0, deletionResult.deleted);
      } else {
        successfullyProcessedIds = deletableIds;
      }
    }
    const affected = new Set(successfullyProcessedIds);
    setCodingResults((current) => current?.filter((party) => !affected.has(party.id)) || current);
    setCodingAction(null);
    setSelectedCodingPartyIds([]);
  };

  const addPartyDuplicateIndex = useMemo(() => {
    const defaultBranchId = branches[0]?.id || 'branch-cairo';
    const canonicalCustomers = parties.map((party) => {
      const branch = branches.find((item) => item.id === party.branchId || item.name === party.branchId || item.code === party.branchId);
      return branch && party.branchId !== branch.id ? { ...party, branchId: branch.id } : party;
    });
    return buildCustomerDuplicateIndex(canonicalCustomers, defaultBranchId);
  }, [parties, branches]);

  const addPartyDuplicateMatches = useMemo(() => {
    if (!newParty.name.trim()) return [];
    const branchId = newParty.branchId || currentBranchId;
    const branch = branches.find((item) => item.id === branchId || item.name === branchId || item.code === branchId);
    return findCustomerDuplicates(addPartyDuplicateIndex, {
      name: newParty.name,
      nameEn: newParty.nameEn,
      phone: newParty.phone,
      fileCode: newParty.fileCode,
      branchId: branch?.id || branchId,
      systemCode: newParty.systemCode || newParty.paperCode,
      paperCode: newParty.paperCode || newParty.systemCode,
    }, branch?.id || branchId);
  }, [addPartyDuplicateIndex, newParty, currentBranchId, branches]);

  const handleRunDuplicateReview = async () => {
    if (!duplicateReviewStartDate || !duplicateReviewEndDate || duplicateReviewStartDate > duplicateReviewEndDate) return;
    const runId = ++duplicateReviewRunIdRef.current;
    const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    setDuplicateReviewSubmitted(true);
    setDuplicateReviewLoading(true);
    setDuplicateReviewResults([]);
    setDuplicateReviewProgress(0);
    setDuplicateReviewVisibleCount(100);
    const defaultBranchId = branches[0]?.id || 'branch-cairo';
    const codedCustomers = parties.filter((party) =>
      (party.type === 'Customer' || party.type === 'Both' || !party.type) && Boolean(party.customerCode || party.code)
    );
    const canonicalCustomers = codedCustomers.map((party) => {
      const branch = branches.find((item) => item.id === party.branchId || item.name === party.branchId || item.code === party.branchId);
      return branch && party.branchId !== branch.id ? { ...party, branchId: branch.id } : party;
    });
    const duplicateIndex = await buildCustomerDuplicateIndexAsync(canonicalCustomers, defaultBranchId, 200, (processed, total) => {
      if (duplicateReviewRunIdRef.current === runId) setDuplicateReviewProgress(total ? Math.floor((processed / total) * 20) : 20);
    }, true);
    if (duplicateReviewRunIdRef.current !== runId) return;
    const targets = canonicalCustomers.filter((party) => {
      const codingDate = party.createdAt?.slice(0, 10) || '';
      return codingDate >= duplicateReviewStartDate && codingDate <= duplicateReviewEndDate;
    });
    const targetIds = new Set(targets.map((party) => party.id));
    const results: Array<{ party: Party; match: CustomerDuplicateMatch }> = [];
    const progressInterval = Math.max(1, Math.floor(targets.length / 100));
    for (let i = 0; i < targets.length; i++) {
      const party = targets[i];
      findCustomerNameDuplicates(duplicateIndex, party, party.branchId || defaultBranchId, party.id).forEach((match) => {
        if (!targetIds.has(match.party.id) || party.id < match.party.id) results.push({ party, match });
      });
      if ((i + 1) % progressInterval === 0 || i === targets.length - 1) {
        if (duplicateReviewRunIdRef.current !== runId) return;
        setDuplicateReviewProgress(20 + (targets.length ? Math.floor(((i + 1) / targets.length) * 80) : 80));
        await yieldToBrowser();
      }
    }
    if (duplicateReviewRunIdRef.current === runId) {
      setDuplicateReviewResults(results);
      setDuplicateReviewLoading(false);
      setDuplicateReviewProgress(100);
    }
  };


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

  const persistNewParty = () => {
    if (!newParty.name.trim() || !newParty.phone.trim()) {
      alert(t('يرجى كتابة الاسم ورقم الهاتف!', 'Please provide name and phone!'));
      return;
    }

    const nextCustCode = getNextCustomerAppCode();
    const finalFileCode = newParty.fileCode.trim() || (autoFileCodeFromCustomerCode ? nextCustCode : undefined);

    addParty({
      name: newParty.name.trim(),
      nameEn: newParty.nameEn.trim() || autoTranslateArabic(newParty.name),
      branchId: newParty.branchId || currentBranchId,
      type: newParty.type,
      phone: newParty.phone.trim(),
      email: newParty.email.trim() || undefined,
      systemCode: newParty.systemCode.trim() || newParty.paperCode.trim() || undefined,
      paperCode: newParty.paperCode.trim() || newParty.systemCode.trim() || undefined,
      fileCode: finalFileCode,
      nationalId: newParty.nationalId.trim() || undefined,
      address: newParty.address.trim() || undefined,
      medicalNotes: newParty.medicalNotes.trim() || undefined,
      allergies: newParty.allergies.trim() ? newParty.allergies.split(',').map((s) => s.trim()) : undefined,
      leadSource: newParty.leadSource,
      balance: 0,
      creditLimit: Number(newParty.creditLimit) || 0,
    });

    setShowAddModal(false);
    setShowAddDuplicateWarning(false);
    setNewParty({
      name: '',
      nameEn: '',
      branchId: currentBranchId,
      type: 'Customer',
      phone: '',
      email: '',
      systemCode: '',
      paperCode: '',
      fileCode: '',
      nationalId: '',
      address: '',
      medicalNotes: '',
      allergies: '',
      leadSource: 'Facebook Ads',
      creditLimit: 10000,
    });
  };

  const handleSaveParty = () => {
    if (!newParty.name.trim() || !newParty.phone.trim()) {
      alert(t('يرجى كتابة الاسم ورقم الهاتف!', 'Please provide name and phone!'));
      return;
    }
    if (addPartyDuplicateMatches.length > 0) {
      setShowAddDuplicateWarning(true);
      return;
    }
    persistNewParty();
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
      branchId: editingParty.branchId || currentBranchId,
      customerCode: editingParty.customerCode || editingParty.code,
      code: editingParty.customerCode || editingParty.code,
      phone: editingParty.phone.trim(),
      email: editingParty.email?.trim() || undefined,
      systemCode: editingParty.systemCode?.trim() || editingParty.paperCode?.trim() || undefined,
      paperCode: editingParty.paperCode?.trim() || editingParty.systemCode?.trim() || undefined,
      fileCode: editingParty.fileCode?.trim() || undefined,
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

      const branchName = String(row['اسم الفرع'] || row['الفرع'] || row['Branch'] || row['Branch Name'] || '').trim();
      const customerCode = String(row['كود العميل'] || row['Customer Code'] || row['Client Code'] || '').trim();
      const systemCode = String(row['كود السيستم'] || row['الكود الورقي'] || row['System Code'] || row['Paper Code'] || row['الكود الورقي للعميل'] || '').trim();
      const fileCode = String(row['كود الملف'] || row['رقم الملف'] || row['كود الملف الورقي'] || row['File Code'] || row['File Number'] || '').trim();
      const name = String(row['الاسم بالعربي'] || row['الاسم'] || row['Name'] || row['Full Name Ar'] || '').trim();
      const nameEn = String(row['الاسم بالإنجليزي'] || row['Name En'] || row['Full Name En'] || '').trim();
      const phone = String(row['رقم الموبايل'] || row['الموبايل'] || row['Phone'] || row['Phone Number'] || row['الهاتف'] || '').trim();
      const paperCode = systemCode || String(row['الكود الورقي'] || row['Paper File Code'] || row['Paper Code'] || '').trim();
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
        branchName,
        customerCode,
        systemCode,
        fileCode,
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
      validRows,
      allRowsWithFallback: validRows,
    };
  };

  const handleConfirmPartyImport = async (validRows: any[]) => {
    const defaultBranchId = activeBranch?.id || currentBranchId;
    const mapped = validRows.map((row) => {
      const branchMatch = branches.find(
        (b) => b.name === row.branchName || b.nameEn?.toLowerCase() === row.branchName?.toLowerCase() || b.id === row.branchName
      );
      const custCode = row.customerCode || undefined;
      const fileCode = row.fileCode || custCode || undefined;
      return {
        name: row.name,
        nameEn: row.nameEn,
        phone: row.phone,
        type: 'Customer' as const,
        branchId: branchMatch?.id || defaultBranchId,
        customerCode: custCode,
        systemCode: row.systemCode || undefined,
        paperCode: row.systemCode || row.paperCode || undefined,
        fileCode: fileCode,
        nationalId: row.nationalId || undefined,
        leadSource: row.leadSource || 'Excel Import',
        balance: row.balance || 0,
        creditLimit: row.creditLimit || 10000,
        address: row.address || undefined,
        medicalNotes: row.medicalNotes || undefined,
      };
    });
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
                'Customer Code': p.customerCode || p.code || '',
                'System Code': p.systemCode || '',
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
            onClick={() => {
              setCodingResults(null);
              setSelectedCodingPartyIds([]);
              setCodingAction(null);
              setShowDuplicateReview(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-all cursor-pointer"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>{t('مراجعة تكويد العملاء', 'Review Customer Coding')}</span>
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
        <select
          value={customerStatusFilter}
          onChange={(event) => setCustomerStatusFilter(event.target.value as 'all' | 'active' | 'archived')}
          aria-label={t('حالة العملاء', 'Customer status')}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="all">{t('كل العملاء', 'All customers')} ({customers.length})</option>
          <option value="active">{t('العملاء المفعّلة فقط', 'Active only')} ({customers.filter((party) => !party.isArchived && !party.mergedIntoPartyId).length})</option>
          <option value="archived">{t('العملاء المؤرشفة فقط', 'Archived only')} ({customers.filter((party) => party.isArchived || party.mergedIntoPartyId).length})</option>
        </select>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('كافة المرضى والعملاء', 'All Patients')} ({statusFilteredCustomers.length})
          </button>
          <button
            onClick={() => setActiveFilter('WITH_BALANCE')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'WITH_BALANCE'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('عملاء بأرصدة غير مسواة', 'With Balance')} ({statusFilteredCustomers.filter((c) => c.balance !== 0).length})
          </button>
          <button
            onClick={() => setActiveFilter('ZERO_BALANCE')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'ZERO_BALANCE'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('أرصدة مسواة (صفر)', 'Zero Balance')} ({statusFilteredCustomers.filter((c) => c.balance === 0).length})
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
                      {(() => {
                        const branchObj = branches.find((b) => b.id === party.branchId) || activeBranch;
                        return branchObj ? (
                          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800 inline-flex items-center gap-1" title={t('اسم الفرع', 'Branch')}>
                            <GitBranch className="h-2.5 w-2.5" />
                            {branchObj.name}
                          </span>
                        ) : null;
                      })()}
                      {(party.customerCode || party.code) && (
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" title={t('كود العميل', 'Customer Code')}>
                          كود العميل: {party.customerCode || party.code}
                        </span>
                      )}
                      {(party.systemCode || party.paperCode) && (
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title={t('كود السيستم (الورقي سابقاً)', 'System Code')}>
                          كود السيستم: {party.systemCode || party.paperCode}
                        </span>
                      )}
                      {(party.fileCode || party.fileNumber) && (
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800" title={t('كود الملف', 'File Code')}>
                          كود الملف: {party.fileCode || party.fileNumber}
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
                <th className="p-3">{t('اسم الفرع', 'Branch')}</th>
                <th className="p-3">{t('كود العميل', 'Client Code')}</th>
                <th className="p-3">{t('كود السيستم', 'System Code')}</th>
                <th className="p-3">{t('كود الملف', 'File Code')}</th>
                <th className="p-3">{t('اسم العميل / المريض', 'Name')}</th>
                <th className="p-3">{t('الموبايل', 'Phone')}</th>
                <th className="p-3">{t('الرصيد المالي', 'Balance')}</th>
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
                    <td className="p-3 text-slate-700 dark:text-slate-300 font-bold">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px]">
                        <GitBranch className="h-3 w-3 text-slate-400" />
                        {branchObj?.name || 'الفرع الرئيسي'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {party.customerCode || party.code || '—'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {party.systemCode || party.paperCode || '—'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        {party.fileCode || party.fileNumber || '—'}
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-slate-900 dark:text-white">
                      <div>{party.name}</div>
                      {party.nameEn && <div className="text-[10px] text-slate-400 font-normal">{party.nameEn}</div>}
                    </td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300 font-bold">
                      {party.phone}
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

      {showDuplicateReview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="font-black text-slate-900 dark:text-white">{t('مراجعة تكويد العملاء', 'Customer Coding Review')}</h3>
              </div>
              <button type="button" onClick={() => { duplicateReviewRunIdRef.current++; setDuplicateReviewLoading(false); setShowDuplicateReview(false); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              <section className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <input value={codingFilters.query} onChange={(e) => setCodingFilters({ ...codingFilters, query: e.target.value })} placeholder={t('بحث في جميع بيانات العميل', 'Search all customer data')} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
                  <MultiSelectFilter label={t('الفروع', 'Branches')} selectAllLabel={t('تحديد الكل', 'Select all')} clearLabel={t('مسح الاختيار', 'Clear selection')} emptyLabel={t('لا توجد اختيارات', 'No options')} searchLabel={t('ابحث في الاختيارات', 'Search options')} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} selected={codingFilters.branchIds} onChange={(branchIds) => setCodingFilters({ ...codingFilters, branchIds, customerCodes: [], systemCodes: [], fileCodes: [] })} />
                  <MultiSelectFilter label={t('حالة العميل', 'Customer status')} selectAllLabel={t('تحديد الكل', 'Select all')} clearLabel={t('مسح الاختيار', 'Clear selection')} emptyLabel={t('لا توجد اختيارات', 'No options')} searchLabel={t('ابحث في الاختيارات', 'Search options')} options={[{ value: 'active', label: t('مفعل', 'Active') }, { value: 'archived', label: t('مؤرشف', 'Archived') }]} selected={codingFilters.statuses} onChange={(statuses) => setCodingFilters({ ...codingFilters, statuses, customerCodes: [], systemCodes: [], fileCodes: [] })} />
                  <MultiSelectFilter label={t('كود العميل', 'Customer code')} selectAllLabel={t('تحديد الكل', 'Select all')} clearLabel={t('مسح الاختيار', 'Clear selection')} emptyLabel={t('لا توجد اختيارات', 'No options')} searchLabel={t('ابحث في الاختيارات', 'Search options')} options={codingPartyOptions.customerCodes} selected={codingFilters.customerCodes} onChange={(customerCodes) => setCodingFilters({ ...codingFilters, customerCodes })} />
                  <MultiSelectFilter label={t('كود السيستم', 'System code')} selectAllLabel={t('تحديد الكل', 'Select all')} clearLabel={t('مسح الاختيار', 'Clear selection')} emptyLabel={t('لا توجد اختيارات', 'No options')} searchLabel={t('ابحث في الاختيارات', 'Search options')} options={codingPartyOptions.systemCodes} selected={codingFilters.systemCodes} onChange={(systemCodes) => setCodingFilters({ ...codingFilters, systemCodes })} />
                  <MultiSelectFilter label={t('كود الملف', 'File code')} selectAllLabel={t('تحديد الكل', 'Select all')} clearLabel={t('مسح الاختيار', 'Clear selection')} emptyLabel={t('لا توجد اختيارات', 'No options')} searchLabel={t('ابحث في الاختيارات', 'Search options')} options={codingPartyOptions.fileCodes} selected={codingFilters.fileCodes} onChange={(fileCodes) => setCodingFilters({ ...codingFilters, fileCodes })} />
                  <input value={codingFilters.phone} onChange={(e) => setCodingFilters({ ...codingFilters, phone: e.target.value })} placeholder={t('رقم الهاتف', 'Phone')} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
                  <label className="text-[11px] font-bold">{t('تاريخ التسجيل من', 'Created from')}<input type="date" value={codingFilters.dateFrom} onChange={(e) => setCodingFilters({ ...codingFilters, dateFrom: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800" /></label>
                  <label className="text-[11px] font-bold">{t('تاريخ التسجيل إلى', 'Created to')}<input type="date" value={codingFilters.dateTo} onChange={(e) => setCodingFilters({ ...codingFilters, dateTo: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800" /></label>
                  <button type="button" onClick={runCodingSearch} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white">{t('بحث', 'Search')}</button>
                </div>
                {codingResults && <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                    <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={codingResults.length > 0 && codingResults.every((party) => selectedCodingPartyIds.includes(party.id))} onChange={(e) => setSelectedCodingPartyIds(e.target.checked ? codingResults.map((party) => party.id) : [])} />{t('تحديد الكل', 'Select all')} ({codingResults.length})</label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={!selectedCodingPartyIds.length} onClick={() => setCodingAction('archive')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{t('أرشيف', 'Archive')}</button>
                      <button type="button" disabled={!selectedCodingPartyIds.length} onClick={() => setCodingAction('delete')} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{t('حذف نهائي', 'Permanent delete')}</button>
                      <button type="button" disabled={selectedCodingPartyIds.length < 2} onClick={() => setCodingAction('merge')} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{t('دمج', 'Merge')}</button>
                      <button type="button" onClick={findSystemCodeMergeGroups} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white">{t('دمج العملاء المتطابق كود السيستم', 'Merge customers with matching system codes')}</button>
                    </div>
                  </div>
                  {systemCodeMergeGroups.length > 0 && <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-900 dark:bg-violet-950/20">
                    <div>
                      <h4 className="text-sm font-black text-violet-900 dark:text-violet-200">{t('مجموعات كود السيستم المتطابق', 'Matching system-code groups')}</h4>
                      <p className="mt-1 text-[11px] text-violet-800 dark:text-violet-300">{t('اختر ملفاً رئيسياً لكل كود. ستُؤرشف بقية الملفات، وتظل السجلات التاريخية كما هي.', 'Choose a primary file for each code. Other files will be archived; historical records remain unchanged.')}</p>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                      {systemCodeMergeGroups.map((group, groupIndex) => (
                        <div key={`${group.systemCode}-${groupIndex}`} className="grid gap-2 rounded-lg border border-violet-100 bg-white p-2 dark:border-violet-900 dark:bg-slate-900 sm:grid-cols-[minmax(100px,0.7fr)_2fr] sm:items-center">
                          <div className="font-mono text-xs font-black">{group.systemCode}<div className="mt-1 text-[10px] font-normal text-slate-500">{group.parties.length} {t('ملفات', 'files')}</div></div>
                          <label className="text-[11px] font-bold">{t('الملف الرئيسي', 'Primary file')}
                            <select value={group.primaryId} onChange={(event) => setSystemCodeMergeGroups((current) => current.map((item, index) => index === groupIndex ? { ...item, primaryId: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                              <option value="">{t('اختر الملف الرئيسي لهذه المجموعة', 'Choose this group’s primary file')}</option>
                              {group.parties.map((party) => <option key={party.id} value={party.id}>{party.name} · {party.customerCode || party.code || '—'} · {party.phone || '—'}</option>)}
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold">{systemCodeMergeGroups.reduce((total, group) => total + group.parties.length - 1, 0)} {t('ملف سيتم أرشفته', 'source files to archive')}</span>
                      <div className="flex gap-2">
                        <button type="button" disabled={systemCodeMergeGroups.some((group) => !group.primaryId)} onClick={mergeAllSystemCodeGroups} className="rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{t('تأكيد دمج كل المجموعات', 'Merge all groups')}</button>
                        <button type="button" onClick={() => setSystemCodeMergeGroups([])} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-700">{t('إلغاء', 'Cancel')}</button>
                      </div>
                    </div>
                  </div>}
                  {codingAction === 'merge' && <div className="grid gap-2 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950/30 sm:grid-cols-2">
                    <label className="text-xs font-bold">{t('اختر الملف الرئيسي', 'Choose the primary file')}<select value={mergePrimaryId} onChange={(e) => setMergePrimaryId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"><option value="">{t('اختر عميلاً محدداً', 'Select a selected customer')}</option>{selectedCodingParties.filter((party) => !party.isArchived).map((party) => <option key={party.id} value={party.id}>{party.name} — {party.customerCode || party.code || party.phone}</option>)}</select></label>
                    <label className="text-xs font-bold">{t('شرح النقل (سيضاف لملاحظات الملف الرئيسي)', 'Merge note (added to primary file notes)')}<input value={mergeNote} onChange={(e) => setMergeNote(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800" /></label>
                    <p className="text-[11px] text-indigo-800 dark:text-indigo-200 sm:col-span-2">{t('المعاملات السابقة ستظل مرتبطة بملفاتها الأصلية دون أي تعديل، والدمج للاستخدام المستقبلي فقط.', 'Historical records remain linked to their original files unchanged. The merge applies to future use only.')}</p>
                    <button type="button" disabled={!mergePrimaryId} onClick={handleCodingAction} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{t('تأكيد الدمج', 'Confirm merge')}</button>
                    <button type="button" onClick={() => setCodingAction(null)} className="rounded-lg border px-3 py-2 text-xs font-bold">{t('إلغاء', 'Cancel')}</button>
                  </div>}
                  <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100 dark:bg-slate-800"><tr><th className="p-2"></th><th className="p-2">{t('العميل', 'Customer')}</th><th className="p-2">{t('الأكواد', 'Codes')}</th><th className="p-2">{t('الهاتف', 'Phone')}</th><th className="p-2">{t('الفرع', 'Branch')}</th><th className="p-2">{t('الحالة', 'Status')}</th></tr></thead><tbody>{codingResults.slice(0, 500).map((party) => <tr key={party.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2"><input type="checkbox" checked={selectedCodingPartyIds.includes(party.id)} onChange={(e) => setSelectedCodingPartyIds((ids) => e.target.checked ? [...ids, party.id] : ids.filter((id) => id !== party.id))} /></td><td className="p-2">{party.name}<div className="text-[10px] text-slate-500">{party.nameEn}</div></td><td className="p-2">{[party.customerCode || party.code, party.systemCode, party.fileCode].filter(Boolean).join(' · ')}</td><td className="p-2">{party.phone}</td><td className="p-2">{branches.find((branch) => branch.id === party.branchId)?.name || party.branchId || '—'}</td><td className="p-2">{party.isArchived ? t('مؤرشف', 'Archived') : t('مفعل', 'Active')}</td></tr>)}</tbody></table>{codingResults.length > 500 && <p className="p-2 text-center text-xs">{t('أول 500 نتيجة ظاهرة لتحسين الأداء. استخدم فلاتر أدق.', 'Showing first 500 results for performance. Narrow the filters.')}</p>}</div>
                </>}
              </section>
              {codingAction && codingAction !== 'merge' && <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:bg-amber-950/30"><span>{codingAction === 'archive' ? t('تأكيد أرشفة العملاء المحددين؟', 'Confirm archiving selected customers?') : t('الحذف النهائي متاح فقط دون سجلات مالية أو تشغيلية سابقة.', 'Permanent deletion is allowed only when no previous financial or operational records exist.')}</span><button type="button" onClick={handleCodingAction} className="rounded bg-slate-900 px-3 py-1.5 font-bold text-white">{t('تأكيد', 'Confirm')}</button><button type="button" onClick={() => setCodingAction(null)} className="rounded border px-3 py-1.5">{t('إلغاء', 'Cancel')}</button></div>}
              <section className="space-y-3 rounded-xl border border-amber-200 p-3 dark:border-amber-900">
              <h4 className="flex items-center gap-2 text-sm font-black text-amber-800 dark:text-amber-300"><AlertTriangle className="h-4 w-4" />{t('مراجعة تكرار العملاء', 'Review Customer Duplicates')}</h4>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('من تاريخ التكويد', 'Coded From')}
                  <input type="date" value={duplicateReviewStartDate} disabled={duplicateReviewLoading} onChange={(event) => { duplicateReviewRunIdRef.current++; setDuplicateReviewLoading(false); setDuplicateReviewStartDate(event.target.value); setDuplicateReviewSubmitted(false); setDuplicateReviewResults([]); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800" />
                </label>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('إلى تاريخ التكويد', 'Coded To')}
                  <input type="date" value={duplicateReviewEndDate} disabled={duplicateReviewLoading} onChange={(event) => { duplicateReviewRunIdRef.current++; setDuplicateReviewLoading(false); setDuplicateReviewEndDate(event.target.value); setDuplicateReviewSubmitted(false); setDuplicateReviewResults([]); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800" />
                </label>
                <button type="button" disabled={duplicateReviewLoading || !duplicateReviewStartDate || !duplicateReviewEndDate || duplicateReviewStartDate > duplicateReviewEndDate} onClick={handleRunDuplicateReview} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                  <CalendarDays className="mr-1 inline h-4 w-4" />{t('مراجعة النتائج', 'Review Results')}
                </button>
              </div>

              {duplicateReviewStartDate && duplicateReviewEndDate && duplicateReviewStartDate > duplicateReviewEndDate && (
                <p className="text-xs font-bold text-rose-600">{t('تاريخ البداية يجب أن يكون قبل تاريخ النهاية.', 'Start date must be on or before the end date.')}</p>
              )}

              {duplicateReviewLoading && <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center text-sm font-bold text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">Checking coded customers... {duplicateReviewProgress}%<div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${duplicateReviewProgress}%` }} /></div></div>}

              {duplicateReviewSubmitted && !duplicateReviewLoading && (
                duplicateReviewResults.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                    {t('لا توجد حالات تكرار مطابقة في الفترة المحددة.', 'No duplicate matches found in the selected period.')}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left rtl:text-right">
                      <thead className="bg-slate-50 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="p-2">{t('العميل المكود في الفترة', 'Coded Customer in Range')}</th>
                          <th className="p-2">{t('العميل المطابق', 'Matching Customer')}</th>
                          <th className="p-2">{t('الفرع', 'Branch')}</th>
                          <th className="p-2">{t('سبب التطابق', 'Match Reason')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {duplicateReviewResults.slice(0, duplicateReviewVisibleCount).map(({ party, match }) => {
                          const branch = branches.find((item) => item.id === party.branchId || item.name === party.branchId);
                          return (
                            <tr key={`${party.id}-${match.party.id}`}>
                              <td className="p-2"><strong>{party.customerCode || party.code || '—'}</strong> · {party.name}<div className="font-mono text-slate-500">{party.phone}</div></td>
                              <td className="p-2"><strong>{match.party.customerCode || match.party.code || '—'}</strong> · {match.party.name}<div className="font-mono text-slate-500">{match.party.phone}</div></td>
                              <td className="p-2">{branch?.name || party.branchId || '—'}</td>
                              <td className="p-2">{match.reasons.map((reason) => reason === 'name' ? t(`الاسم ${Math.round(match.nameSimilarity! * 100)}%`, `Name ${Math.round(match.nameSimilarity! * 100)}%`) : reason === 'phone' ? t(`الهاتف ${Math.round(match.phoneSimilarity! * 100)}%`, `Phone ${Math.round(match.phoneSimilarity! * 100)}%`) : reason === 'systemCode' ? t('كود السيستم مطابق تماماً', 'Exact System Code') : t('كود الملف / الورقي مطابق تماماً', 'Exact File / Paper Code')).join(' · ')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
              {duplicateReviewSubmitted && !duplicateReviewLoading && duplicateReviewVisibleCount < duplicateReviewResults.length && (
                <button type="button" onClick={() => setDuplicateReviewVisibleCount((count) => count + 100)} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  Show more ({Math.min(100, duplicateReviewResults.length - duplicateReviewVisibleCount)})
                </button>
              )}
              </section>
            </div>
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

              {/* Branch and Auto Serial Customer Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                    <GitBranch className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('اسم الفرع *', 'Branch *')}</span>
                  </label>
                  <select
                    value={newParty.branchId || currentBranchId}
                    onChange={(e) => setNewParty({ ...newParty, branchId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t('كود العميل', 'Customer Code')}</span>
                    </label>
                    <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 text-[9px] font-bold">
                      {t('مسريل آلياً بالتطبيق', 'Auto-Serialized')}
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={getNextCustomerAppCode()}
                    className="w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-100/60 dark:bg-slate-800/80 p-2 text-xs font-mono font-black text-indigo-700 dark:text-indigo-300 outline-none cursor-not-allowed select-none"
                    title={t('يحسب آلياً مسريل ولا يمكن للمستخدم التحكم فيه', 'Auto-calculated serial code - cannot be modified')}
                  />
                </div>
              </div>

              {/* System Code and File Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود السيستم (الكود الورقي سابقاً)', 'System Code')}
                  </label>
                  <input
                    type="text"
                    value={newParty.systemCode || newParty.paperCode}
                    onChange={(e) => setNewParty({ ...newParty, systemCode: e.target.value, paperCode: e.target.value })}
                    placeholder="P-101 أو كود السيستم..."
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 font-mono outline-none dark:border-slate-700 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('يحتوي على البيانات المدخلة حالياً', 'Contains currently entered code')}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الملف (إدخال يدوي)', 'File Code')}
                  </label>
                  <input
                    type="text"
                    value={newParty.fileCode}
                    onChange={(e) => setNewParty({ ...newParty, fileCode: e.target.value })}
                    placeholder="F-101 (رقم الملف بالأرشيف)..."
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 font-mono outline-none dark:border-slate-700 dark:text-white"
                  />
                  <div className="flex items-center gap-2 mt-2 p-1.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40">
                    <input
                      type="checkbox"
                      id="autoFileCodeToggle"
                      checked={autoFileCodeFromCustomerCode}
                      onChange={(e) => setAutoFileCodeFromCustomerCode(e.target.checked)}
                      className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="autoFileCodeToggle" className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-200 cursor-pointer select-none">
                      {t('إذا تُرك كود الملف فارغاً، يتم اعتماده تلقائياً مطابقاً لكود العميل', 'If left blank, auto-use customer code as file code')} ({getNextCustomerAppCode()})
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {t('يدخل يدوياً عند تكويد العميل، أو يُولّد آلياً من كود العميل في حال عدم الإدخال', 'Manually entered code, or auto-filled with customer code')}
                  </span>
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {showAddDuplicateWarning && addPartyDuplicateMatches.length > 0 && (
                <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Possible duplicate customers found in this branch.</div>
                  {addPartyDuplicateMatches.slice(0, 5).map(({ party, reasons }) => (
                    <div key={party.id} className="rounded-lg bg-white/70 p-2 dark:bg-slate-900/60">
                      <div className="font-bold">{party.customerCode || party.code || '—'} · {party.name}</div>
                      <div>{party.phone} · {reasons.map((reason) => reason === 'name' ? 'Name similarity' : reason === 'phone' ? 'Phone similarity' : reason === 'systemCode' ? 'Same System Code' : 'Same File Code').join(', ')}</div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowAddDuplicateWarning(false)} className="flex-1 rounded-lg border border-amber-300 px-3 py-2 font-bold">Dismiss</button>
                    <button type="button" onClick={persistNewParty} className="flex-1 rounded-lg bg-amber-700 px-3 py-2 font-bold text-white">Create New Anyway</button>
                  </div>
                </div>
              )}



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
        currentDataForExport={filteredParties.map((p) => {
          const branchObj = branches.find((b) => b.id === p.branchId);
          return {
            branchName: branchObj?.name || activeBranch?.name || 'الفرع الرئيسي',
            customerCode: p.customerCode || p.code || '',
            systemCode: p.systemCode || p.paperCode || '',
            fileCode: p.fileCode || p.fileNumber || '',
            name: p.name,
            nameEn: p.nameEn || '',
            phone: p.phone,
            paperCode: p.paperCode || p.systemCode || '',
            nationalId: p.nationalId || '',
            leadSource: p.leadSource || '',
            balance: p.balance || 0,
            creditLimit: p.creditLimit || 0,
            address: p.address || '',
            medicalNotes: p.medicalNotes || '',
          };
        })}
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

              {/* Branch and Auto Serial Customer Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                    <GitBranch className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('اسم الفرع *', 'Branch *')}</span>
                  </label>
                  <select
                    value={editingParty.branchId || currentBranchId}
                    onChange={(e) => setEditingParty({ ...editingParty, branchId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t('كود العميل', 'Customer Code')}</span>
                    </label>
                    <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 text-[9px] font-bold">
                      {t('مسريل آلياً بالتطبيق', 'Auto-Serialized')}
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={editingParty.customerCode || editingParty.code || ''}
                    className="w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-100/60 dark:bg-slate-800/80 p-2 text-xs font-mono font-black text-indigo-700 dark:text-indigo-300 outline-none cursor-not-allowed select-none"
                    title={t('يحسب آلياً مسريل ولا يمكن للمستخدم التحكم فيه', 'Auto-calculated serial code - cannot be modified')}
                  />
                </div>
              </div>

              {/* System Code and File Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود السيستم (الكود الورقي سابقاً)', 'System Code')}
                  </label>
                  <input
                    type="text"
                    value={editingParty.systemCode || editingParty.paperCode || ''}
                    onChange={(e) => setEditingParty({ ...editingParty, systemCode: e.target.value, paperCode: e.target.value })}
                    placeholder="P-101 أو كود السيستم..."
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 font-mono outline-none dark:border-slate-700 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('يحتوي على البيانات المدخلة حالياً', 'Contains currently entered code')}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الملف (إدخال يدوي)', 'File Code')}
                  </label>
                  <input
                    type="text"
                    value={editingParty.fileCode || editingParty.fileNumber || ''}
                    onChange={(e) => setEditingParty({ ...editingParty, fileCode: e.target.value, fileNumber: e.target.value })}
                    placeholder="F-101 (رقم الملف بالأرشيف)..."
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800 p-2 font-mono outline-none dark:border-slate-700 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('يدخل يدوياً عند تكويد العميل', 'Manually entered code')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
