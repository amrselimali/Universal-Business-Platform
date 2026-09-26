import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { StaffMember } from '../types';
import { autoTranslateArabic } from '../utils/translator';
import {
  UserCheck,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Search,
  Filter,
  Sparkles,
  Stethoscope,
  Wrench,
  Users,
  FileCheck,
  Phone,
  Mail,
  Percent,
  Building2,
  Calendar,
  Wallet,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Sliders,
  DollarSign,
  Activity,
  Layers,
} from 'lucide-react';

interface StaffManagementViewProps {
  onNavigateToPayroll?: () => void;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({ onNavigateToPayroll }) => {
  const {
    language,
    t,
    formatMoney,
    staffMembers,
    addStaffMember,
    updateStaffMember,
    toggleStaffMemberStatus,
    archiveStaffMember,
    restoreStaffMember,
    branches,
  } = usePlatform();

  const isRtl = language === 'ar';
  const [roleFilter, setRoleFilter] = useState<'All' | 'Doctor' | 'Technician' | 'Employee'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [branchFilter, setBranchFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form State
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [roleType, setRoleType] = useState<'Doctor' | 'Technician' | 'Employee'>('Doctor');
  const [jobTitleAr, setJobTitleAr] = useState('طبيب استشاري جلدية وليزر');
  const [jobTitleEn, setJobTitleEn] = useState('');
  const [specialtyAr, setSpecialtyAr] = useState('');
  const [specialtyEn, setSpecialtyEn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isServiceProvider, setIsServiceProvider] = useState(true);
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);

  // Financial & Rates State
  const [fixedMonthlySalary, setFixedMonthlySalary] = useState<number>(12000);
  const [fixedAllowances, setFixedAllowances] = useState<number>(1500);
  const [hourlyRate, setHourlyRate] = useState<number>(120);
  const [laserRevenueRate, setLaserRevenueRate] = useState<number>(10);
  const [laserPulseRate, setLaserPulseRate] = useState<number>(0.05);
  const [dermatologyRevenueRate, setDermatologyRevenueRate] = useState<number>(15);
  const [commissionRate, setCommissionRate] = useState<number>(15);

  // Documents Checklist
  const [nationalIdSubmitted, setNationalIdSubmitted] = useState(true);
  const [syndicateCardSubmitted, setSyndicateCardSubmitted] = useState(true);
  const [degreeCertSubmitted, setDegreeCertSubmitted] = useState(true);
  const [contractSubmitted, setContractSubmitted] = useState(true);
  const [licenseSubmitted, setLicenseSubmitted] = useState(true);
  const [criminalRecordSubmitted, setCriminalRecordSubmitted] = useState(true);

  // Active / Inactive staff counts
  const totalEmployees = staffMembers.filter((s) => !s.isArchived).length;
  const activeEmployees = staffMembers.filter((s) => !s.isArchived && s.isActive).length;
  const inactiveEmployees = staffMembers.filter((s) => !s.isArchived && !s.isActive).length;
  const totalSalaries = staffMembers
    .filter((s) => !s.isArchived && s.isActive)
    .reduce((acc, s) => acc + (s.fixedMonthlySalary ?? s.monthlySalary ?? 0) + (s.fixedAllowances ?? 0), 0);

  const filteredStaff = staffMembers.filter((s) => {
    const matchesSearch =
      s.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.jobTitleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery));
    const matchesRole = roleFilter === 'All' || s.roleType === roleFilter;
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Active' && s.isActive) ||
      (statusFilter === 'Inactive' && !s.isActive);
    const matchesBranch = branchFilter === 'All' || s.branchId === branchFilter;
    const matchesArchive = showArchived ? true : !s.isArchived;
    return matchesSearch && matchesRole && matchesStatus && matchesBranch && matchesArchive;
  });

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setNameAr('');
    setNameEn('');
    setRoleType('Doctor');
    setJobTitleAr('طبيب استشاري جلدية وليزر');
    setJobTitleEn('');
    setSpecialtyAr('جلدية وتجميل وليزر');
    setSpecialtyEn('');
    setPhone('');
    setEmail('');
    setBranchId(branches[0]?.id || '');
    setIsActive(true);
    setIsServiceProvider(true);
    setHireDate(new Date().toISOString().split('T')[0]);
    setFixedMonthlySalary(15000);
    setFixedAllowances(1500);
    setHourlyRate(150);
    setLaserRevenueRate(10);
    setLaserPulseRate(0.05);
    setDermatologyRevenueRate(15);
    setCommissionRate(15);
    setNationalIdSubmitted(true);
    setSyndicateCardSubmitted(true);
    setDegreeCertSubmitted(true);
    setContractSubmitted(true);
    setLicenseSubmitted(true);
    setCriminalRecordSubmitted(true);
    setShowModal(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setNameAr(staff.nameAr);
    setNameEn(staff.nameEn);
    setRoleType(staff.roleType || 'Doctor');
    setJobTitleAr(staff.jobTitleAr);
    setJobTitleEn(staff.jobTitleEn);
    setSpecialtyAr(staff.specialtyAr || '');
    setSpecialtyEn(staff.specialtyEn || '');
    setPhone(staff.phone || '');
    setEmail(staff.email || '');
    setBranchId(staff.branchId || '');
    setIsActive(staff.isActive);
    setIsServiceProvider(staff.isServiceProvider ?? (staff.roleType === 'Doctor' || staff.roleType === 'Technician'));
    setHireDate(staff.hireDate || new Date().toISOString().split('T')[0]);
    setFixedMonthlySalary(staff.fixedMonthlySalary ?? staff.monthlySalary ?? 0);
    setFixedAllowances(staff.fixedAllowances ?? 0);
    setHourlyRate(staff.hourlyRate ?? 0);
    setLaserRevenueRate(staff.laserRevenueRate ?? 0);
    setLaserPulseRate(staff.laserPulseRate ?? 0);
    setDermatologyRevenueRate(staff.dermatologyRevenueRate ?? 0);
    setCommissionRate(staff.commissionRate ?? 0);

    const docs = staff.hiringDocuments || [];
    setNationalIdSubmitted(docs.find((d) => d.documentType === 'NationalID')?.isSubmitted ?? true);
    setSyndicateCardSubmitted(docs.find((d) => d.documentType === 'SyndicateCard')?.isSubmitted ?? true);
    setDegreeCertSubmitted(docs.find((d) => d.documentType === 'DegreeCertificate')?.isSubmitted ?? true);
    setContractSubmitted(docs.find((d) => d.documentType === 'Contract')?.isSubmitted ?? true);
    setLicenseSubmitted(docs.find((d) => d.documentType === 'MedicalLicense')?.isSubmitted ?? true);
    setCriminalRecordSubmitted(docs.find((d) => d.documentType === 'CriminalRecord')?.isSubmitted ?? true);

    setShowModal(true);
  };

  const handleToggleStatus = (staffId: string, currentActive: boolean) => {
    if (toggleStaffMemberStatus) {
      toggleStaffMemberStatus(staffId);
    } else {
      updateStaffMember(staffId, { isActive: !currentActive });
    }
  };

  const handleAutoTranslateName = () => {
    if (nameAr.trim()) {
      setNameEn(autoTranslateArabic(nameAr));
    }
  };

  const handleAutoTranslateJob = () => {
    if (jobTitleAr.trim()) {
      setJobTitleEn(autoTranslateArabic(jobTitleAr));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) return;

    const hiringDocs = [
      {
        documentType: 'NationalID' as const,
        documentName: 'بطاقة الرقم القومي',
        isSubmitted: nationalIdSubmitted,
      },
      {
        documentType: 'SyndicateCard' as const,
        documentName: 'كارنيه النقابة ومزاولة المهنة',
        isSubmitted: syndicateCardSubmitted,
      },
      {
        documentType: 'DegreeCertificate' as const,
        documentName: 'شهادة المؤهل والتخصص',
        isSubmitted: degreeCertSubmitted,
      },
      {
        documentType: 'Contract' as const,
        documentName: 'عقد العمل المبرم',
        isSubmitted: contractSubmitted,
      },
      {
        documentType: 'MedicalLicense' as const,
        documentName: 'ترخيص مزاولة المهنة / المنشأة',
        isSubmitted: licenseSubmitted,
      },
      {
        documentType: 'CriminalRecord' as const,
        documentName: 'فيش وتشبيه (صحيفة الحالة الجنائية)',
        isSubmitted: criminalRecordSubmitted,
      },
    ];

    const payload = {
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || autoTranslateArabic(nameAr),
      staffType: roleType,
      roleType,
      jobTitleAr: jobTitleAr.trim(),
      jobTitleEn: jobTitleEn.trim() || autoTranslateArabic(jobTitleAr),
      specialtyAr: specialtyAr.trim() || undefined,
      specialtyEn: specialtyEn.trim() || (specialtyAr ? autoTranslateArabic(specialtyAr) : undefined),
      phone: phone.trim(),
      email: email.trim() || undefined,
      branchId: branchId || undefined,
      isActive,
      isServiceProvider,
      hireDate: hireDate || new Date().toISOString().split('T')[0],
      monthlySalary: Number(fixedMonthlySalary) || 0,
      fixedMonthlySalary: Number(fixedMonthlySalary) || 0,
      fixedAllowances: Number(fixedAllowances) || 0,
      hourlyRate: Number(hourlyRate) || 0,
      laserRevenueRate: Number(laserRevenueRate) || 0,
      laserPulseRate: Number(laserPulseRate) || 0,
      dermatologyRevenueRate: Number(dermatologyRevenueRate) || 0,
      commissionRate: Number(commissionRate) || 0,
      hiringDocsReceived: hiringDocs.every((d) => d.isSubmitted),
      hiringDocuments: hiringDocs,
    };

    if (editingStaff) {
      updateStaffMember(editingStaff.id, payload);
    } else {
      addStaffMember(payload);
    }

    setShowModal(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-5 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  {t('إدارة الموظفين', 'Employee Management')}
                </h1>
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                  {staffMembers.length} {t('موظف مسجل', 'Registered')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t(
                  'إدارة الموظفين والكوادر الطبية والفنية، تفعيل وتعطيل الحسابات، الرواتب والبدلات الثابتة، ونسب إيرادات الليزر والجلدية والنبضات',
                  'Manage employees and medical/technical staff, active/inactive toggles, fixed salaries, allowances, and laser/dermatology commission shares'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToPayroll && (
            <button
              onClick={onNavigateToPayroll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
            >
              <Wallet className="h-4 w-4" />
              <span>{t('مسير الرواتب والأجور', 'Staff Payroll')}</span>
            </button>
          )}

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
              showArchived
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            {showArchived ? t('إخفاء المؤرشف', 'Hide Archived') : t('عرض المؤرشف', 'Show Archived')}
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة موظف جديد', 'Add New Employee')}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t('إجمالي الموظفين', 'Total Staff')}
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{totalEmployees}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {t('الموظفون المفعلون', 'Active Staff')}
            </span>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{activeEmployees}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-rose-500 dark:text-rose-400">
              {t('الموظفون المعطلون', 'Inactive Staff')}
            </span>
            <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">{inactiveEmployees}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <XCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t('إجمالي الرواتب والبدلات الثابتة', 'Fixed Salaries & Allowances')}
            </span>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{formatMoney(totalSalaries)}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Role Tabs, Status Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Role Type Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full lg:w-auto overflow-x-auto">
          <button
            onClick={() => setRoleFilter('All')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'All'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {t('كافة الكوادر', 'All Staff')} ({totalEmployees})
          </button>

          <button
            onClick={() => setRoleFilter('Doctor')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'Doctor'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5 inline-block mr-1" />
            {t('الأطباء', 'Doctors')} ({staffMembers.filter((s) => s.roleType === 'Doctor' && !s.isArchived).length})
          </button>

          <button
            onClick={() => setRoleFilter('Technician')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'Technician'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Wrench className="h-3.5 w-3.5 inline-block mr-1" />
            {t('التكنيشن والفنيين', 'Technicians')} ({staffMembers.filter((s) => s.roleType === 'Technician' && !s.isArchived).length})
          </button>

          <button
            onClick={() => setRoleFilter('Employee')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'Employee'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 inline-block mr-1" />
            {t('الموظفين والريسيبشن', 'Employees')} ({staffMembers.filter((s) => s.roleType === 'Employee' && !s.isArchived).length})
          </button>
        </div>

        {/* Filters: Active/Inactive status, Branch, and Search */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Status selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('All')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'All'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t('الحالة: الكل', 'Status: All')}
            </button>
            <button
              onClick={() => setStatusFilter('Active')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'Active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
              }`}
            >
              {t('مفعل فقط', 'Active')}
            </button>
            <button
              onClick={() => setStatusFilter('Inactive')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'Inactive'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
              }`}
            >
              {t('معطل فقط', 'Inactive')}
            </button>
          </div>

          {/* Branch filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="All">{t('كافة الفروع', 'All Branches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {language === 'ar' ? b.name : b.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 sm:w-56">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('بحث بالاسم أو الهاتف...', 'Search employee...')}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Staff Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((staff) => {
          const branch = branches.find((b) => b.id === staff.branchId);
          const docs = staff.hiringDocuments || [];
          const submittedCount = docs.filter((d) => d.isSubmitted).length;
          const totalDocs = docs.length || 6;

          return (
            <div
              key={staff.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                staff.isArchived
                  ? 'border-slate-300 opacity-60 bg-slate-100/50 dark:bg-slate-900/40'
                  : staff.isActive
                  ? 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                  : 'border-rose-200 dark:border-rose-950 bg-rose-50/20 dark:bg-rose-950/10'
              }`}
            >
              <div>
                {/* Card Top Bar: Avatar, Info, and Active/Inactive Switch */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl font-black text-white shrink-0 ${
                        staff.roleType === 'Doctor'
                          ? 'bg-indigo-600 shadow-md shadow-indigo-600/20'
                          : staff.roleType === 'Technician'
                          ? 'bg-amber-600 shadow-md shadow-amber-600/20'
                          : 'bg-emerald-600 shadow-md shadow-emerald-600/20'
                      }`}
                    >
                      {staff.roleType === 'Doctor' && <Stethoscope className="h-6 w-6" />}
                      {staff.roleType === 'Technician' && <Wrench className="h-6 w-6" />}
                      {staff.roleType === 'Employee' && <UserCheck className="h-6 w-6" />}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {language === 'ar' ? staff.nameAr : staff.nameEn}
                      </h3>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                        {language === 'ar' ? staff.jobTitleAr : staff.jobTitleEn}
                      </p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          staff.roleType === 'Doctor'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : staff.roleType === 'Technician'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {staff.roleType === 'Doctor' && t('طبيب', 'Doctor')}
                        {staff.roleType === 'Technician' && t('تكنيشن / فني', 'Technician')}
                        {staff.roleType === 'Employee' && t('موظف / إداري', 'Employee')}
                      </span>
                    </div>
                  </div>

                  {/* Active / Inactive Toggle Switch - User requirement: كل موظف يبقى جنبه اختيار مفعل لتعطيله او تشغيله */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(staff.id, staff.isActive)}
                      className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        staff.isActive
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                          : 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                      title={staff.isActive ? t('انقر لتعطيل الموظف', 'Click to deactivate') : t('انقر لتفعيل الموظف', 'Click to activate')}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          staff.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                        }`}
                      />
                      <span>{staff.isActive ? t('مفعل (نشط)', 'Active') : t('معطل (متوقف)', 'Inactive')}</span>
                      {staff.isActive ? (
                        <ToggleRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Core Attributes: Linked Branch & Hire Date */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <Building2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] text-slate-400 block">{t('الفرع المربوط به:', 'Branch:')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {branch ? (language === 'ar' ? branch.name : branch.nameEn) : t('كافة الفروع', 'All Branches')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] text-slate-400 block">{t('تاريخ التعيين:', 'Hire Date:')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {staff.hireDate || t('غير مسجل', 'Not recorded')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Salaries, Fixed Allowances & Hourly Rate Grid */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    {t('الراتب والبدلات وسعر الساعة:', 'Salary, Allowances & Rate:')}
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">{t('الراتب الثابت', 'Fixed Salary')}</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {formatMoney(staff.fixedMonthlySalary ?? staff.monthlySalary ?? 0)}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">{t('البدلات الثابتة', 'Fixed Allow.')}</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                        {formatMoney(staff.fixedAllowances ?? 0)}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">{t('سعر الساعة', 'Hourly')}</span>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                        {staff.hourlyRate ? `${staff.hourlyRate} ج.م` : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rates & Commissions Section: Laser %, Laser Pulses %, Dermatology % */}
                <div className="mt-3 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    {t('نسب الإيرادات والنبضات:', 'Revenue & Pulses Commission Rates:')}
                  </span>

                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {/* Laser Revenue % */}
                    <div className="flex flex-col p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-center">
                      <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold flex items-center justify-center gap-1">
                        <Zap className="h-3 w-3" />
                        <span>{t('إيراد الليزر', 'Laser Rev.')}</span>
                      </span>
                      <span className="text-xs font-black text-purple-900 dark:text-purple-200 mt-0.5">
                        {staff.laserRevenueRate ?? 0}%
                      </span>
                    </div>

                    {/* Laser Pulses Rate % / per pulse */}
                    <div className="flex flex-col p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900 text-center">
                      <span className="text-[10px] text-cyan-700 dark:text-cyan-300 font-semibold flex items-center justify-center gap-1">
                        <Activity className="h-3 w-3" />
                        <span>{t('بلصات الليزر', 'Pulses')}</span>
                      </span>
                      <span className="text-xs font-black text-cyan-900 dark:text-cyan-200 mt-0.5">
                        {staff.laserPulseRate ?? 0} {staff.laserPulseRate && staff.laserPulseRate < 1 ? t('ج/بلصة', 'EGP') : '%'}
                      </span>
                    </div>

                    {/* Dermatology Revenue % */}
                    <div className="flex flex-col p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-center">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        <span>{t('إيراد الجلدية', 'Derma Rev.')}</span>
                      </span>
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 mt-0.5">
                        {staff.dermatologyRevenueRate ?? 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hiring Documents Checklist Status */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="text-slate-400 font-bold">{t('مسوغات التعيين المكتملة:', 'Hiring Docs:')}</span>
                    <span className="font-bold text-emerald-600">
                      {submittedCount} / {totalDocs} ({Math.round((submittedCount / totalDocs) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(submittedCount / totalDocs) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{staff.phone || '-'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title={t('تعديل بيانات الموظف', 'Edit Employee')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>

                  {staff.isArchived ? (
                    <button
                      onClick={() => restoreStaffMember(staff.id)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                      title={t('استعادة الموظف', 'Restore Employee')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => archiveStaffMember(staff.id, 'أرشفة الموظف')}
                      className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                      title={t('أرشفة الموظف', 'Archive Employee')}
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 md:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {editingStaff
                      ? t('تعديل بيانات الموظف', 'Edit Employee Record')
                      : t('إضافة موظف جديد إلى الكادر', 'Add New Employee')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t('استكمل الحقول المالية والإدارية ونسب الليزر والجلدية', 'Enter administrative & commission details')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Role Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('نوع الوظيفة والكادر *', 'Role Type *')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoleType('Doctor')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      roleType === 'Doctor'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Stethoscope className="h-3.5 w-3.5 inline-block mr-1" />
                    {t('طبيب / استشاري', 'Doctor')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleType('Technician')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      roleType === 'Technician'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Wrench className="h-3.5 w-3.5 inline-block mr-1" />
                    {t('تكنيشن / فني ليزر', 'Technician')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleType('Employee')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      roleType === 'Employee'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5 inline-block mr-1" />
                    {t('موظف / استقبال', 'Employee')}
                  </button>
                </div>
              </div>

              {/* Name Fields with Auto-Translate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالكامل (عربي) *', 'Full Name (Arabic) *')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="مثال: د. حسام النجار"
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={handleAutoTranslateName}
                      className="px-2.5 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl cursor-pointer shrink-0"
                      title={t('ترجمة آلية للإنجليزية', 'Translate to English')}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالكامل (إنجليزي) *', 'Full Name (English) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Dr. Hossam Elnaggar"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Job Title & Specialty */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('المسمى الوظيفي (عربي) *', 'Job Title (Arabic) *')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={jobTitleAr}
                      onChange={(e) => setJobTitleAr(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={handleAutoTranslateJob}
                      className="px-2.5 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl cursor-pointer shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('المسمى الوظيفي (إنجليزي) *', 'Job Title (English) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={jobTitleEn}
                    onChange={(e) => setJobTitleEn(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Phone, Linked Branch, Hire Date & Active Status Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الهاتف *', 'Phone *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الفرع المربوط به *', 'Linked Branch *')}
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 cursor-pointer"
                  >
                    <option value="">{t('كافة الفروع', 'All Branches')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {language === 'ar' ? b.name : b.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('تاريخ التعيين *', 'Hire Date *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('حالة التفعيل (تشغيل / تعطيل)', 'Active Status')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-full py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    <span>{isActive ? t('مفعل (نشط)', 'Active') : t('معطل (متوقف)', 'Inactive')}</span>
                    {isActive ? (
                      <ToggleRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-slate-400" />
                    )}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('مقدم خدمة (يظهر بشاشة التشغيل)', 'Service Provider (Operations)')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsServiceProvider(!isServiceProvider)}
                    className={`w-full py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isServiceProvider
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    <span>{isServiceProvider ? t('مقدم خدمة (نعم)', 'Provider (Yes)') : t('غير مقدم خدمة (لا)', 'No')}</span>
                    {isServiceProvider ? (
                      <ToggleRight className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Salaries & Fixed Allowances & Hourly Rate */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5 flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-indigo-600" />
                  <span>{t('الراتب الشهري الثابت والبدلات وسعر الساعة', 'Fixed Salary, Allowances & Hourly Rate')}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t('الراتب الشهري الثابت (ج.م) *', 'Fixed Monthly Salary *')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={fixedMonthlySalary}
                      onChange={(e) => setFixedMonthlySalary(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t('البدلات الثابتة (ج.م)', 'Fixed Allowances')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={fixedAllowances}
                      onChange={(e) => setFixedAllowances(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t('سعر الساعة (ج.م / ساعة)', 'Hourly Rate')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Commission Rates: Laser Revenue %, Laser Pulses %, Dermatology Revenue % */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5 flex items-center gap-1.5">
                  <Percent className="h-4 w-4 text-purple-600" />
                  <span>{t('نسب الإيرادات والعمولات (الليزر، النبضات، الجلدية)', 'Commission & Revenue Shares')}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t('نسبته من إيراد الليزر (%)', 'Laser Revenue Share (%)')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={laserRevenueRate}
                      onChange={(e) => setLaserRevenueRate(Number(e.target.value))}
                      placeholder="e.g. 10"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t('نسبته من عدد بلصات الليزر المستهلكة (ج/بلصة أو %)', 'Laser Pulses Share')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={laserPulseRate}
                      onChange={(e) => setLaserPulseRate(Number(e.target.value))}
                      placeholder="e.g. 0.05"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t('نسبته من إيراد الجلدية (%)', 'Dermatology Revenue Share (%)')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={dermatologyRevenueRate}
                      onChange={(e) => setDermatologyRevenueRate(Number(e.target.value))}
                      placeholder="e.g. 15"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Hiring Documents Checklist Section */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  <span>{t('مسوغات وأوراق التعيين (Hiring Documents Checklist)', 'Hiring Documents Checklist')}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nationalIdSubmitted}
                      onChange={(e) => setNationalIdSubmitted(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>{t('بطاقة الرقم القومي', 'National ID')}</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syndicateCardSubmitted}
                      onChange={(e) => setSyndicateCardSubmitted(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>{t('كارنيه النقابة ومزاولة المهنة', 'Syndicate Card')}</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={degreeCertSubmitted}
                      onChange={(e) => setDegreeCertSubmitted(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>{t('شهادة المؤهل الدراسي', 'Degree Certificate')}</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contractSubmitted}
                      onChange={(e) => setContractSubmitted(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>{t('عقد العمل الموقع', 'Signed Contract')}</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={licenseSubmitted}
                      onChange={(e) => setLicenseSubmitted(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>{t('ترخيص مزاولة المهنة', 'Medical License')}</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criminalRecordSubmitted}
                      onChange={(e) => setCriminalRecordSubmitted(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>{t('فيش وتشبيه جنائي', 'Criminal Record')}</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  {editingStaff ? t('حفظ التعديلات', 'Save Changes') : t('إضافة الموظف', 'Add Employee')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
