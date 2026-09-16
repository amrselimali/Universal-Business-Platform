import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { INITIAL_TENANT, INITIAL_BRANCHES, INITIAL_MODULES } from '../data/initialData';
import { Tenant, Branch, Warehouse } from '../types';
import {
  Building2,
  GitBranch,
  Warehouse as WarehouseIcon,
  Plus,
  CheckCircle2,
  Coins,
  MapPin,
  Phone,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Sliders,
  X,
  Check,
  Percent,
  Edit3,
  Trash2,
  Archive,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Info,
} from 'lucide-react';

export const CompaniesBranchesView: React.FC = () => {
  const {
    t,
    language,
    tenant,
    tenants,
    addTenant,
    updateTenant,
    updateTenantModules,
    deleteTenant,
    restoreTenant,
    allModules,
    switchTenant,
    branches,
    activeBranch,
    setActiveBranch,
    addBranch,
    updateBranch,
    deleteBranch,
    restoreBranch,
    warehouses,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    restoreWarehouse,
    currentUser,
    invoices,
    users,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'companies' | 'branches' | 'archive'>('companies');
  const [archiveSubTab, setArchiveSubTab] = useState<'all' | 'branches' | 'warehouses' | 'companies'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAdmin =
    currentUser?.isAdmin ||
    currentUser?.username?.toLowerCase() === 'admin' ||
    currentUser?.role === 'SuperAdmin';

  // Defensive fallbacks - excluding archived items from active views
  const currentTenant = tenant || tenants.find((t) => !t.isArchived) || INITIAL_TENANT;
  const currentTenantBranches = (branches || []).filter((b) => !b.isArchived && b.tenantId === currentTenant.id);
  const currentTenantWarehouses = (warehouses || []).filter((w) => !w.isArchived && w.tenantId === currentTenant.id);
  const currentActiveBranch =
    activeBranch && !activeBranch.isArchived
      ? activeBranch
      : currentTenantBranches[0] || null;

  // Archived items
  const archivedBranches = (branches || []).filter((b) => b.isArchived);
  const archivedWarehouses = (warehouses || []).filter((w) => w.isArchived);
  const archivedTenants = (tenants || []).filter((t) => t.isArchived);
  const totalArchivedCount = archivedBranches.length + archivedWarehouses.length + archivedTenants.length;

  // Default modules list for selection
  const platformModuleList = allModules && allModules.length > 0 ? allModules : INITIAL_MODULES;

  // New Company Modal
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [newCompanyNameAr, setNewCompanyNameAr] = useState('');
  const [newCompanyNameEn, setNewCompanyNameEn] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [newCompanyPlan, setNewCompanyPlan] = useState<'Starter' | 'Professional' | 'Enterprise'>('Enterprise');
  const [newCompanyCurrency, setNewCompanyCurrency] = useState('EGP');
  const [newCompanyTaxRate, setNewCompanyTaxRate] = useState<number>(0); // Default 0 as requested!
  const [newCompanyModules, setNewCompanyModules] = useState<string[]>([
    'identity',
    'parties',
    'inventory',
    'pos_sales',
    'accounting',
    'reporting_bi',
  ]);

  // Edit Company & Modules Modal
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editPlan, setEditPlan] = useState<'Starter' | 'Professional' | 'Enterprise'>('Enterprise');
  const [editCurrency, setEditCurrency] = useState('EGP');
  const [editTaxRate, setEditTaxRate] = useState<number>(0);
  const [editModules, setEditModules] = useState<string[]>([]);

  const openEditTenant = (tItem: Tenant) => {
    setEditingTenant(tItem);
    setEditNameAr(tItem.name);
    setEditNameEn(tItem.nameEn || tItem.name);
    setEditCode(tItem.code);
    setEditPlan(tItem.plan);
    setEditCurrency(tItem.currency || 'EGP');
    setEditTaxRate(tItem.taxRate !== undefined ? tItem.taxRate : 0);
    setEditModules(tItem.activeModules || []);
  };

  const handleSaveEditTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    updateTenant(editingTenant.id, {
      name: editNameAr.trim(),
      nameEn: editNameEn.trim() || editNameAr.trim(),
      code: editCode.trim().toUpperCase(),
      plan: editPlan,
      currency: editCurrency,
      taxRate: Number(editTaxRate) || 0,
      activeModules: editModules,
    });
    setEditingTenant(null);
  };

  const toggleEditModule = (moduleId: string) => {
    setEditModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const toggleNewCompanyModule = (moduleId: string) => {
    setNewCompanyModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  // New Branch Modal
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchNameAr, setNewBranchNameAr] = useState('');
  const [newBranchNameEn, setNewBranchNameEn] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('القاهرة');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [newBranchIsMain, setNewBranchIsMain] = useState(false);

  // New Warehouse Modal
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [selectedBranchForWh, setSelectedBranchForWh] = useState<string>(
    currentTenantBranches[0]?.id || currentActiveBranch?.id || ''
  );
  const [newWhNameAr, setNewWhNameAr] = useState('');
  const [newWhNameEn, setNewWhNameEn] = useState('');
  const [newWhCode, setNewWhCode] = useState('');
  const [newWhLocation, setNewWhLocation] = useState('');

  // Handle Create Company
  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyNameAr.trim()) return;

    addTenant({
      name: newCompanyNameAr.trim(),
      nameEn: newCompanyNameEn.trim() || newCompanyNameAr.trim(),
      code: (newCompanyCode.trim() || 'CMP').toUpperCase(),
      plan: newCompanyPlan,
      currency: newCompanyCurrency,
      currencySymbol: newCompanyCurrency === 'EGP' ? 'ج.م' : '$',
      taxRate: Number(newCompanyTaxRate) || 0, // default 0 per user requirement
      activeModules:
        newCompanyModules.length > 0
          ? newCompanyModules
          : ['identity', 'parties', 'pos_sales', 'inventory', 'accounting'],
    });

    setShowCompanyModal(false);
    setNewCompanyNameAr('');
    setNewCompanyNameEn('');
    setNewCompanyCode('');
    setNewCompanyTaxRate(0);
    setNewCompanyModules(['identity', 'parties', 'inventory', 'pos_sales', 'accounting', 'reporting_bi']);
  };

  // Handle Create Branch
  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchNameAr.trim()) return;

    addBranch({
      name: newBranchNameAr.trim(),
      nameEn: newBranchNameEn.trim() || newBranchNameAr.trim(),
      code: (newBranchCode.trim() || `BR-${Date.now().toString().slice(-3)}`).toUpperCase(),
      city: newBranchCity || 'القاهرة',
      phone: newBranchPhone,
      isMain: newBranchIsMain,
    });

    setShowBranchModal(false);
    setNewBranchNameAr('');
    setNewBranchNameEn('');
    setNewBranchCode('');
    setNewBranchPhone('');
  };

  // Handle Create Warehouse
  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhNameAr.trim()) return;

    const targetBranchId = selectedBranchForWh || currentActiveBranch?.id || currentTenantBranches[0]?.id || 'branch-default';

    addWarehouse({
      branchId: targetBranchId,
      name: newWhNameAr.trim(),
      nameEn: newWhNameEn.trim() || newWhNameAr.trim(),
      code: (newWhCode.trim() || `WH-${Date.now().toString().slice(-3)}`).toUpperCase(),
      location: newWhLocation,
    });

    setShowWarehouseModal(false);
    setNewWhNameAr('');
    setNewWhNameEn('');
    setNewWhCode('');
    setNewWhLocation('');
  };

  // Edit Branch State & Handlers
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editBranchNameAr, setEditBranchNameAr] = useState('');
  const [editBranchNameEn, setEditBranchNameEn] = useState('');
  const [editBranchCode, setEditBranchCode] = useState('');
  const [editBranchCity, setEditBranchCity] = useState('');
  const [editBranchPhone, setEditBranchPhone] = useState('');
  const [editBranchIsMain, setEditBranchIsMain] = useState(false);

  const openEditBranch = (bItem: Branch) => {
    setEditingBranch(bItem);
    setEditBranchNameAr(bItem.name);
    setEditBranchNameEn(bItem.nameEn || bItem.name);
    setEditBranchCode(bItem.code);
    setEditBranchCity(bItem.city || 'القاهرة');
    setEditBranchPhone(bItem.phone || '');
    setEditBranchIsMain(!!bItem.isMain);
  };

  const handleSaveEditBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    updateBranch(editingBranch.id, {
      name: editBranchNameAr.trim(),
      nameEn: editBranchNameEn.trim() || editBranchNameAr.trim(),
      code: editBranchCode.trim().toUpperCase(),
      city: editBranchCity.trim(),
      phone: editBranchPhone.trim(),
      isMain: editBranchIsMain,
    });
    setEditingBranch(null);
    setToastMessage(language === 'ar' ? 'تم تحديث بيانات الفرع بنجاح' : 'Branch updated successfully');
  };

  // Edit Warehouse State & Handlers
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editWhNameAr, setEditWhNameAr] = useState('');
  const [editWhNameEn, setEditWhNameEn] = useState('');
  const [editWhCode, setEditWhCode] = useState('');
  const [editWhLocation, setEditWhLocation] = useState('');

  const openEditWarehouse = (wItem: Warehouse) => {
    setEditingWarehouse(wItem);
    setEditWhNameAr(wItem.name);
    setEditWhNameEn(wItem.nameEn || wItem.name);
    setEditWhCode(wItem.code);
    setEditWhLocation(wItem.location || '');
  };

  const handleSaveEditWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    updateWarehouse(editingWarehouse.id, {
      name: editWhNameAr.trim(),
      nameEn: editWhNameEn.trim() || editWhNameAr.trim(),
      code: editWhCode.trim().toUpperCase(),
      location: editWhLocation.trim(),
    });
    setEditingWarehouse(null);
    setToastMessage(language === 'ar' ? 'تم تحديث بيانات المستودع بنجاح' : 'Warehouse updated successfully');
  };

  // Safe Delete & Archive Prompt State
  interface DeleteTarget {
    type: 'branch' | 'warehouse' | 'tenant';
    id: string;
    name: string;
    code: string;
    dataDetails: string[];
    hasData: boolean;
  }
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const promptDeleteBranch = (br: Branch) => {
    const attachedWh = warehouses.filter((w) => w.branchId === br.id);
    const attachedInvoices = (invoices || []).filter((i) => i.branchId === br.id);
    const attachedUsers = (users || []).filter((u) => u.branchId === br.id || u.allowedBranchIds?.includes(br.id));

    const details: string[] = [];
    if (attachedWh.length > 0) details.push(`${attachedWh.length} مستودع تابعة للفرع`);
    if (attachedInvoices.length > 0) details.push(`${attachedInvoices.length} فاتورة مبيعات مسجلة`);
    if (attachedUsers.length > 0) details.push(`${attachedUsers.length} مستخدمين مرتبطين بالفرع`);

    setDeleteTarget({
      type: 'branch',
      id: br.id,
      name: br.name,
      code: br.code,
      dataDetails: details,
      hasData: details.length > 0,
    });
  };

  const promptDeleteWarehouse = (wh: Warehouse) => {
    const attachedInvoices = (invoices || []).filter((i) => i.warehouseId === wh.id);
    const details: string[] = [];
    if (attachedInvoices.length > 0) details.push(`${attachedInvoices.length} فاتورة مبيعات مرتبطة`);

    setDeleteTarget({
      type: 'warehouse',
      id: wh.id,
      name: wh.name,
      code: wh.code,
      dataDetails: details,
      hasData: details.length > 0,
    });
  };

  const promptDeleteTenant = (tItem: Tenant) => {
    const attachedBr = (branches || []).filter((b) => b.tenantId === tItem.id);
    const attachedInvoices = (invoices || []).filter((i) => i.tenantId === tItem.id);
    const details: string[] = [];
    if (attachedBr.length > 0) details.push(`${attachedBr.length} فروع مسجلة`);
    if (attachedInvoices.length > 0) details.push(`${attachedInvoices.length} فواتير مسجلة`);

    setDeleteTarget({
      type: 'tenant',
      id: tItem.id,
      name: tItem.name,
      code: tItem.code,
      dataDetails: details,
      hasData: details.length > 0,
    });
  };

  const executeDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'branch') {
      const res = deleteBranch(deleteTarget.id);
      setToastMessage(res.message);
    } else if (deleteTarget.type === 'warehouse') {
      const res = deleteWarehouse(deleteTarget.id);
      setToastMessage(res.message);
    } else if (deleteTarget.type === 'tenant') {
      const res = deleteTenant(deleteTarget.id);
      setToastMessage(res.message);
    }
    setDeleteTarget(null);
  };

  // Restoration Handlers (Admin Approval Only!)
  const handleRestoreBranch = (branchId: string) => {
    const ok = restoreBranch(branchId);
    if (ok) {
      setToastMessage(language === 'ar' ? 'تم اعتماد استعادة الفرع بنجاح ونقله إلى الفروع النشطة' : 'Branch restored successfully');
    }
  };

  const handleRestoreWarehouse = (whId: string) => {
    const ok = restoreWarehouse(whId);
    if (ok) {
      setToastMessage(language === 'ar' ? 'تم اعتماد استعادة المستودع بنجاح ونقله إلى المستودعات النشطة' : 'Warehouse restored successfully');
    }
  };

  const handleRestoreTenant = (tenantId: string) => {
    const ok = restoreTenant(tenantId);
    if (ok) {
      setToastMessage(language === 'ar' ? 'تم اعتماد استعادة الشركة بنجاح وتفعيلها' : 'Company restored successfully');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              {t('إدارة الشركات والمؤسسات وتعدد الفروع', 'Companies & Multi-Branch Hub')}
            </h1>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              Multi-Tenant Architecture
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'إضافة وتخصيص شركات متعددة، إدارة الفروع الجغرافية، والمستودعات المركزية والفرعية مع عزل البيانات التام.',
              'Add and manage multiple business entities, geographical branches, and warehouses.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCompanyModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة شركة جديدة', 'New Company')}</span>
          </button>
          <button
            onClick={() => setShowBranchModal(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <GitBranch className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('إضافة فرع جديد', 'New Branch')}</span>
          </button>
          <button
            onClick={() => {
              if (currentTenantBranches.length > 0) {
                setSelectedBranchForWh(currentTenantBranches[0].id);
              }
              setShowWarehouseModal(true);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <WarehouseIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('إضافة مستودع', 'New Warehouse')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('إجمالي الشركات المسجلة', 'Registered Entities')}
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{tenants?.length || 1}</p>
          <span className="text-[10px] text-slate-400">
            {t('الشركة النشطة حالياً:', 'Active Company:')}{' '}
            <strong className="text-slate-700 dark:text-slate-300">{currentTenant.name}</strong>
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('فروع الشركة النشطة', 'Active Company Branches')}
            </span>
            <div className="rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
              <GitBranch className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{currentTenantBranches.length}</p>
          <span className="text-[10px] text-slate-400">
            {t('الفرع النشط:', 'Active Branch:')}{' '}
            <strong className="text-slate-700 dark:text-slate-300">{currentActiveBranch?.name || t('غير محدد', 'Default')}</strong>
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('المستودعات والمخازن', 'Warehouses')}
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <WarehouseIcon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{currentTenantWarehouses.length}</p>
          <span className="text-[10px] text-slate-400">
            {t('تغطي كافة نقاط البيع والتوزيع', 'Attached to branches')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('companies')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'companies'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>{t('الشركات والمؤسسات (Entities)', 'Companies Directory')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">
            {tenants?.length || 1}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('branches')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'branches'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <GitBranch className="h-4 w-4" />
          <span>{t('فروع ومستودعات الشركة النشطة', 'Branches & Warehouses')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">
            {currentTenantBranches.length} {t('فروع', 'Branches')}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('archive')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'archive'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Archive className="h-4 w-4" />
          <span>{t('سجل الأرشيف والمحفوظات (Archive Vault)', 'Archive Vault')}</span>
          {totalArchivedCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {totalArchivedCount}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
              0
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: COMPANIES DIRECTORY */}
      {activeTab === 'companies' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(tenants || [currentTenant]).map((item) => {
            const isSelected = item.id === currentTenant.id;
            const bCount = (branches || []).filter((b) => b.tenantId === item.id).length;
            const wCount = (warehouses || []).filter((w) => w.tenantId === item.id).length;

            return (
              <div
                key={item.id}
                className={`relative rounded-2xl border p-5 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/20 shadow-md ring-2 ring-indigo-500/20 dark:bg-indigo-950/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20 font-black text-lg">
                      {item.name ? item.name.charAt(0) : 'C'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {language === 'ar' ? item.name : item.nameEn || item.name}
                        </h3>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('الشركة الحالية النشطة', 'Active Company')}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-slate-400 mt-0.5">
                        {t('كود المؤسسة:', 'Code:')} <span className="font-bold text-slate-600 dark:text-slate-300">{item.code}</span> | {t('الباقة:', 'Plan:')} {item.plan}
                      </p>
                    </div>
                  </div>

                  {!isSelected ? (
                    <button
                      onClick={() => switchTenant(item.id)}
                      className="shrink-0 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-300 transition-colors cursor-pointer"
                    >
                      {t('التبديل إلى هذه الشركة', 'Switch to Company')}
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
                      {t('مفعلة', 'Active')}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800/60">
                  <div className="rounded-xl bg-slate-50 p-2 text-center dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-400">{t('العملة والضريبة', 'Currency & VAT')}</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      {item.currency || 'EGP'} ({Math.round((item.taxRate !== undefined ? item.taxRate : 0) * 100)}%)
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2 text-center dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-400">{t('عدد الفروع', 'Branches')}</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{bCount} {t('فروع', 'branches')}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2 text-center dark:bg-slate-800/50">
                    <span className="text-[10px] text-slate-400">{t('المستودعات', 'Warehouses')}</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{wCount} {t('مخازن', 'stores')}</p>
                  </div>
                </div>

                {/* Accompanying Modules badge */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs dark:border-slate-800/60">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Layers className="h-3 w-3 text-indigo-500" />
                    <span>{t('الموديولات المصاحبة:', 'Modules:')}</span>
                  </span>
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {item.activeModules?.length || 0} / {platformModuleList.length} {t('موديول مفعّل', 'active modules')}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => openEditTenant(item)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Sliders className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('تعديل الموديولات والبيانات', 'Edit Modules & Details')}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!isSelected) switchTenant(item.id);
                      setActiveTab('branches');
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{t('إدارة فروع ومستودعات هذه الشركة', 'Manage branches & warehouses')}</span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: BRANCHES & WAREHOUSES */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5 text-xs text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-200">
            <div>
              <span className="font-bold">{t('الشركة الحالية المعروض فروعها ومستودعاتها:', 'Current Active Entity:')}</span>{' '}
              <strong className="underline">{currentTenant.name}</strong> ({currentTenant.code})
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">{t('تبديل الشركة:', 'Switch:')}</span>
              <select
                value={currentTenant.id}
                onChange={(e) => switchTenant(e.target.value)}
                className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-300"
              >
                {(tenants || [currentTenant]).map((tItem) => (
                  <option key={tItem.id} value={tItem.id}>
                    {tItem.name} ({tItem.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* If no branches exist for this tenant */}
          {currentTenantBranches.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 mb-3">
                <GitBranch className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t('لا توجد فروع مسجلة لهذه الشركة حتى الآن', 'No branches recorded for this company yet')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-4">
                {t(
                  `يمكنك إضافة فرع جديد يدوياً لشركة (${currentTenant.name}) دون أي إنشاء إجباري أو افتراضي للمخازن.`,
                  `You can add a branch manually for (${currentTenant.name}) without auto-generating any warehouses.`
                )}
              </p>
              <button
                onClick={() => setShowBranchModal(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{t('إضافة فرع جديد للشركة', 'Add New Branch')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {currentTenantBranches.map((br) => {
                const isSelectedBranch = br.id === currentActiveBranch?.id;
                const branchWhs = (warehouses || []).filter((w) => !w.isArchived && w.branchId === br.id);

                return (
                  <div
                    key={br.id}
                    className={`rounded-2xl border p-5 transition-all ${
                      isSelectedBranch
                        ? 'border-violet-500 bg-violet-50/20 ring-2 ring-violet-500/20 dark:bg-violet-950/20'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {language === 'ar' ? br.name : br.nameEn || br.name}
                          </span>
                          {br.isMain && (
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {t('الفرع الرئيسي', 'Main Branch')}
                            </span>
                          )}
                          {isSelectedBranch && (
                            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                              {t('الفرع النشط الآن', 'Active')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-mono">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {br.city || t('القاهرة', 'Cairo')}
                          </span>
                          {br.phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {br.phone}
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-slate-400">[{br.code}]</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isSelectedBranch && (
                          <button
                            onClick={() => setActiveBranch(br)}
                            className="rounded-xl border border-violet-200 bg-white px-2.5 py-1 text-xs font-bold text-violet-600 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-800 dark:text-violet-300 transition-colors cursor-pointer"
                            title={t('تحديد كفرع حالي', 'Select as current')}
                          >
                            {t('تحديد', 'Select')}
                          </button>
                        )}
                        <button
                          onClick={() => openEditBranch(br)}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                          title={t('تعديل بيانات الفرع', 'Edit branch')}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{t('تعديل', 'Edit')}</span>
                        </button>
                        <button
                          onClick={() => promptDeleteBranch(br)}
                          className="flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 dark:border-rose-900/60 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title={t('حذف أو نقل للأرشيف', 'Delete or archive')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{t('حذف', 'Delete')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Warehouses attached to this branch */}
                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {t('المستودعات والمخازن التابعة لهذا الفرع:', 'Warehouses in this branch:')}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedBranchForWh(br.id);
                            setShowWarehouseModal(true);
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                          <span>{t('إضافة مخزن', 'Add WH')}</span>
                        </button>
                      </div>

                      {branchWhs.length === 0 ? (
                        <div className="rounded-xl bg-slate-50 p-2.5 text-center text-xs text-slate-400 dark:bg-slate-800/40">
                          {t('لا توجد مستودعات مسجلة لهذا الفرع بعد.', 'No warehouses in this branch yet.')}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {branchWhs.map((wh) => (
                            <div
                              key={wh.id}
                              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/50"
                            >
                              <div className="flex items-center gap-2">
                                <WarehouseIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {language === 'ar' ? wh.name : wh.nameEn || wh.name}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  [{wh.code}] {wh.location ? `• ${wh.location}` : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEditWarehouse(wh)}
                                  className="rounded-lg p-1 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                  title={t('تعديل المستودع', 'Edit warehouse')}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => promptDeleteWarehouse(wh)}
                                  className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                  title={t('حذف أو أرشفة المستودع', 'Delete or archive warehouse')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ARCHIVE & VAULT (Admin Gated Restore) */}
      {activeTab === 'archive' && (
        <div className="space-y-5">
          {/* Policy Banner */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-black text-amber-900 dark:text-amber-200 text-sm mb-1">
                  {t('سجل الأرشيف الآمن وحماية السجلات التاريخية', 'Archive & Audit Vault')}
                </h4>
                <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  {t(
                    'تطبيقاً لقواعد النزاهة المحاسبية وحماية البيانات: أي فرع، مستودع، أو شركة مرتبط به فواتير أو مستخدمين أو حركات مخزنية يتم تحويله تلقائياً إلى هذا الأرشيف الآمن لمنع تلف الحركات السابقة بدلاً من الحذف النهائي. ولا يمكن استعادة أي سجل إلى الخدمة النشطة إلا باعتماد رسمي من مدير عام النظام (Admin Approval Required).',
                    'To protect accounting integrity and historical transactions: any entity with linked invoices, warehouses, or users is safeguarded here rather than hard-deleted. Restoration requires explicit Admin approval.'
                  )}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {t('حالة المستخدم الحالي:', 'Current Session:')}
                  </span>
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3" />
                      {t('مدير عام النظام (Admin) - مصرح لك بالاعتماد والاستعادة', 'System Admin - Authorized to Approve & Restore')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      <Lock className="h-3 w-3" />
                      {t('مستخدم عادي - الاستعادة مقفلة وتتطلب اعتماد Admin', 'Standard User - Restore is locked (Requires Admin)')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tabs / Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setArchiveSubTab('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                archiveSubTab === 'all'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {t('كافة السجلات المؤرشفة', 'All Records')} ({totalArchivedCount})
            </button>
            <button
              onClick={() => setArchiveSubTab('branches')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                archiveSubTab === 'branches'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {t('الفروع المؤرشفة', 'Archived Branches')} ({archivedBranches.length})
            </button>
            <button
              onClick={() => setArchiveSubTab('warehouses')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                archiveSubTab === 'warehouses'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {t('المستودعات المؤرشفة', 'Archived Warehouses')} ({archivedWarehouses.length})
            </button>
            <button
              onClick={() => setArchiveSubTab('companies')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                archiveSubTab === 'companies'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {t('الشركات المؤرشفة', 'Archived Companies')} ({archivedTenants.length})
            </button>
          </div>

          {/* Archive Cards List */}
          {totalArchivedCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="rounded-2xl bg-slate-100 p-4 text-slate-400 dark:bg-slate-800 mb-3">
                <Archive className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t('سجل الأرشيف فارغ حالياً', 'Archive Vault is Empty')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                {t(
                  'كافة الفروع والمستودعات والشركات تعمل بالحالة النشطة دون أي أرشفة.',
                  'All branches, warehouses, and companies are active and operating normally.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Render Archived Branches */}
              {(archiveSubTab === 'all' || archiveSubTab === 'branches') &&
                archivedBranches.map((br) => {
                  const parentTenant = tenants.find((t) => t.id === br.tenantId);
                  return (
                    <div
                      key={br.id}
                      className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-xs dark:border-amber-900/50 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            <GitBranch className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                                {language === 'ar' ? br.name : br.nameEn || br.name}
                              </span>
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                {t('فرع مؤرشف', 'Archived Branch')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              [{br.code}] • {parentTenant?.name || t('شركة عامة', 'Company')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Archive Metadata */}
                      <div className="mt-3.5 space-y-1.5 rounded-xl bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                          <span>{t('تاريخ الأرشفة:', 'Archived At:')}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {br.archivedAt ? new Date(br.archivedAt).toLocaleString('ar-EG') : t('غير مسجل', 'N/A')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                          <span>{t('المؤرشف بواسطة:', 'Archived By:')}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {br.archivedBy || t('نظام الحماية الآلية', 'System')}
                          </span>
                        </div>
                        {br.archiveReason && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 pt-1 border-t border-amber-200/50 dark:border-amber-900/40">
                            <strong>{t('سبب الحفظ في الأرشيف:', 'Reason:')}</strong> {br.archiveReason}
                          </div>
                        )}
                      </div>

                      {/* Restore Action */}
                      <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                        {isAdmin ? (
                          <button
                            onClick={() => handleRestoreBranch(br.id)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{t('اعتماد واستعادة الفرع للخدمة (Admin Approve)', 'Approve & Restore Branch')}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800">
                            <Lock className="h-3.5 w-3.5 text-amber-600" />
                            <span>{t('يتطلب اعتماد مدير عام النظام للاستعادة', 'Admin Approval Required to Restore')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Render Archived Warehouses */}
              {(archiveSubTab === 'all' || archiveSubTab === 'warehouses') &&
                archivedWarehouses.map((wh) => {
                  const parentBranch = branches.find((b) => b.id === wh.branchId);
                  const parentTenant = tenants.find((t) => t.id === wh.tenantId);
                  return (
                    <div
                      key={wh.id}
                      className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-xs dark:border-amber-900/50 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <WarehouseIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                                {language === 'ar' ? wh.name : wh.nameEn || wh.name}
                              </span>
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                {t('مستودع مؤرشف', 'Archived Warehouse')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              [{wh.code}] • {parentBranch?.name || t('فرع عام', 'Branch')} ({parentTenant?.name || ''})
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Archive Metadata */}
                      <div className="mt-3.5 space-y-1.5 rounded-xl bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                          <span>{t('تاريخ الأرشفة:', 'Archived At:')}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {wh.archivedAt ? new Date(wh.archivedAt).toLocaleString('ar-EG') : t('غير مسجل', 'N/A')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                          <span>{t('المؤرشف بواسطة:', 'Archived By:')}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {wh.archivedBy || t('نظام الحماية الآلية', 'System')}
                          </span>
                        </div>
                        {wh.archiveReason && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 pt-1 border-t border-amber-200/50 dark:border-amber-900/40">
                            <strong>{t('سبب الحفظ في الأرشيف:', 'Reason:')}</strong> {wh.archiveReason}
                          </div>
                        )}
                      </div>

                      {/* Restore Action */}
                      <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                        {isAdmin ? (
                          <button
                            onClick={() => handleRestoreWarehouse(wh.id)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{t('اعتماد واستعادة المستودع (Admin Approve)', 'Approve & Restore Warehouse')}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800">
                            <Lock className="h-3.5 w-3.5 text-amber-600" />
                            <span>{t('يتطلب اعتماد مدير عام النظام للاستعادة', 'Admin Approval Required to Restore')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Render Archived Companies */}
              {(archiveSubTab === 'all' || archiveSubTab === 'companies') &&
                archivedTenants.map((tItem) => (
                  <div
                    key={tItem.id}
                    className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-xs dark:border-amber-900/50 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                              {language === 'ar' ? tItem.name : tItem.nameEn || tItem.name}
                            </span>
                            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
                              {t('شركة مؤرشفة', 'Archived Company')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            [{tItem.code}] • {tItem.plan}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Archive Metadata */}
                    <div className="mt-3.5 space-y-1.5 rounded-xl bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                        <span>{t('تاريخ الأرشفة:', 'Archived At:')}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {tItem.archivedAt ? new Date(tItem.archivedAt).toLocaleString('ar-EG') : t('غير مسجل', 'N/A')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                        <span>{t('المؤرشف بواسطة:', 'Archived By:')}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {tItem.archivedBy || t('نظام الحماية الآلية', 'System')}
                        </span>
                      </div>
                      {tItem.archiveReason && (
                        <div className="text-[11px] text-amber-800 dark:text-amber-300 pt-1 border-t border-amber-200/50 dark:border-amber-900/40">
                          <strong>{t('سبب الحفظ في الأرشيف:', 'Reason:')}</strong> {tItem.archiveReason}
                        </div>
                      )}
                    </div>

                    {/* Restore Action */}
                    <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                      {isAdmin ? (
                        <button
                          onClick={() => handleRestoreTenant(tItem.id)}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{t('اعتماد واستعادة الشركة (Admin Approve)', 'Approve & Restore Company')}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800">
                          <Lock className="h-3.5 w-3.5 text-amber-600" />
                          <span>{t('يتطلب اعتماد مدير عام النظام للاستعادة', 'Admin Approval Required to Restore')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE COMPANY MODAL */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t('إضافة شركة / مؤسسة جديدة وتحديد موديولاتها', 'Create New Company & Select Modules')}
                </h3>
              </div>
              <button
                onClick={() => setShowCompanyModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم الشركة (بالعربية) *:', 'Company Name (Arabic) *:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newCompanyNameAr}
                    onChange={(e) => setNewCompanyNameAr(e.target.value)}
                    placeholder="مثال: شركة الأمل للتجارة والمقاولات"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم الشركة (بالإنجليزية):', 'Company Name (English):')}
                  </label>
                  <input
                    type="text"
                    value={newCompanyNameEn}
                    onChange={(e) => setNewCompanyNameEn(e.target.value)}
                    placeholder="e.g. Al-Amal Trading Co."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الشركة (مختصر):', 'Company Code:')}
                  </label>
                  <input
                    type="text"
                    value={newCompanyCode}
                    onChange={(e) => setNewCompanyCode(e.target.value)}
                    placeholder="AMAL"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs uppercase font-mono text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الباقة:', 'Plan:')}
                  </label>
                  <select
                    value={newCompanyPlan}
                    onChange={(e) => setNewCompanyPlan(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="Enterprise">Enterprise (غير محدود)</option>
                    <option value="Professional">Professional</option>
                    <option value="Starter">Starter</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('العملة الرئيسية:', 'Currency:')}
                  </label>
                  <select
                    value={newCompanyCurrency}
                    onChange={(e) => setNewCompanyCurrency(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              {/* Tax Rate (Defaults to 0 per user requirement) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('نسبة الضريبة الافتراضية (VAT) - القيمة صفر افتراضياً:', 'Default Tax Rate (0 by default):')}</span>
                  </label>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                    {Math.round(newCompanyTaxRate * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={newCompanyTaxRate}
                    onChange={(e) => setNewCompanyTaxRate(Number(e.target.value))}
                    placeholder="0"
                    className="w-32 rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 text-center"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { label: '0% (معفاة)', val: 0 },
                      { label: '5%', val: 0.05 },
                      { label: '10%', val: 0.1 },
                      { label: '14% (ق.م)', val: 0.14 },
                    ].map((rate) => (
                      <button
                        key={rate.val}
                        type="button"
                        onClick={() => setNewCompanyTaxRate(rate.val)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                          newCompanyTaxRate === rate.val
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {rate.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {t('القيمة 0 تعني فواتير بدون ضريبة افتراضية مع إمكانية تعديلها عند إصدار الفاتورة.', 'Value 0 sets invoices tax-exempt by default with full flexibility during checkout.')}
                </p>
              </div>

              {/* Accompanying Modules Chooser */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                      {t('الموديولات المصاحبة للشركة الجديدة (Modules Selection):', 'Accompanying Modules:')}
                    </span>
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      {newCompanyModules.length} {t('محدد', 'selected')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCompanyModules(platformModuleList.map((m) => m.id))}
                      className="text-[11px] font-bold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
                    >
                      {t('تحديد الكل', 'Select All')}
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setNewCompanyModules(['identity', 'parties', 'pos_sales'])}
                      className="text-[11px] font-bold text-slate-500 hover:underline dark:text-slate-400 cursor-pointer"
                    >
                      {t('الأساسية فقط', 'Core Only')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {platformModuleList.map((mod) => {
                    const isChecked = newCompanyModules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'border-indigo-500 bg-indigo-50/40 text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-200 ring-1 ring-indigo-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleNewCompanyModule(mod.id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="text-[11px] leading-tight">
                          <p className="font-bold">{language === 'ar' ? mod.nameAr : mod.nameEn}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                            {language === 'ar' ? mod.descAr : mod.descEn}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Requirement confirmation notice */}
              <div className="rounded-xl bg-amber-50/90 p-3 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5">
                <span className="text-base">🛡️</span>
                <div>
                  <p className="font-bold">{t('عدم إنشاء فروع أو مستودعات آلياً:', 'Manual Branch & Warehouse Management:')}</p>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                    {t(
                      'لن يتم توليد فرع أو مستودع بشكل آلي عند حفظ الشركة. يمكنك إضافة الفروع والمستودعات حسب رغبتك وتوزيعك الجغرافي لاحقاً من تبويب الفروع.',
                      'No branches or warehouses will be created automatically. You can manually add branches and warehouses as required from the branches tab.'
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
                >
                  {t('تأكيد وحفظ الشركة والموديولات', 'Save Company & Modules')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EXISTING COMPANY & MODULES MODAL */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {t('تعديل موديولات وبيانات الشركة', 'Edit Company & Modules Configuration')}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{editingTenant.code} - {editingTenant.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTenant(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTenant} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم الشركة (بالعربية) *:', 'Company Name (Arabic) *:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editNameAr}
                    onChange={(e) => setEditNameAr(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم الشركة (بالإنجليزية):', 'Company Name (English):')}
                  </label>
                  <input
                    type="text"
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الشركة:', 'Company Code:')}
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs uppercase font-mono text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الباقة:', 'Plan:')}
                  </label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="Enterprise">Enterprise (غير محدود)</option>
                    <option value="Professional">Professional</option>
                    <option value="Starter">Starter</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('العملة:', 'Currency:')}
                  </label>
                  <select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              {/* Tax Rate Setting */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('نسبة الضريبة الافتراضية (VAT):', 'Default Tax Rate:')}</span>
                  </label>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                    {Math.round(editTaxRate * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={editTaxRate}
                    onChange={(e) => setEditTaxRate(Number(e.target.value))}
                    className="w-32 rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 text-center"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { label: '0% (معفاة)', val: 0 },
                      { label: '5%', val: 0.05 },
                      { label: '10%', val: 0.1 },
                      { label: '14% (ق.م)', val: 0.14 },
                    ].map((rate) => (
                      <button
                        key={rate.val}
                        type="button"
                        onClick={() => setEditTaxRate(rate.val)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                          editTaxRate === rate.val
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {rate.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Accompanying Modules Modification */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                      {t('الموديولات المفعّلة لهذه الشركة:', 'Active Modules for this Company:')}
                    </span>
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      {editModules.length} / {platformModuleList.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditModules(platformModuleList.map((m) => m.id))}
                      className="text-[11px] font-bold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
                    >
                      {t('تحديد الكل', 'Select All')}
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setEditModules(['identity', 'parties', 'pos_sales'])}
                      className="text-[11px] font-bold text-slate-500 hover:underline dark:text-slate-400 cursor-pointer"
                    >
                      {t('الأساسية فقط', 'Core Only')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {platformModuleList.map((mod) => {
                    const isChecked = editModules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'border-indigo-500 bg-indigo-50/40 text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-200 ring-1 ring-indigo-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEditModule(mod.id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="text-[11px] leading-tight">
                          <p className="font-bold">{language === 'ar' ? mod.nameAr : mod.nameEn}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                            {language === 'ar' ? mod.descAr : mod.descEn}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BRANCH MODAL */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
              {t('إضافة فرع جديد للشركة', 'Add New Branch')}
            </h3>
            <p className="text-xs text-indigo-600 font-bold mb-3">{currentTenant.name}</p>

            <form onSubmit={handleCreateBranch} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الفرع (بالعربية) *:', 'Branch Name (Arabic) *:')}
                </label>
                <input
                  type="text"
                  required
                  value={newBranchNameAr}
                  onChange={(e) => setNewBranchNameAr(e.target.value)}
                  placeholder="مثال: فرع الجيزة - المهندسين"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الفرع (بالإنجليزية):', 'Branch Name (English):')}
                </label>
                <input
                  type="text"
                  value={newBranchNameEn}
                  onChange={(e) => setNewBranchNameEn(e.target.value)}
                  placeholder="e.g. Giza - Mohandessin Branch"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الفرع:', 'Branch Code:')}
                  </label>
                  <input
                    type="text"
                    value={newBranchCode}
                    onChange={(e) => setNewBranchCode(e.target.value)}
                    placeholder="GZ-03"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs uppercase font-mono text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('المدينة / المحافظة:', 'City:')}
                  </label>
                  <input
                    type="text"
                    value={newBranchCity}
                    onChange={(e) => setNewBranchCity(e.target.value)}
                    placeholder="الجيزة"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('رقم هاتف الفرع:', 'Phone Number:')}
                </label>
                <input
                  type="text"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mainBranchChk"
                  checked={newBranchIsMain}
                  onChange={(e) => setNewBranchIsMain(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="mainBranchChk" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  {t('تعيين هذا الفرع كفرع رئيسي', 'Mark as main branch')}
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
                >
                  {t('حفظ الفرع', 'Save Branch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE WAREHOUSE MODAL */}
      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
              {t('إضافة مستودع / مخزن جديد', 'Add New Warehouse')}
            </h3>

            <form onSubmit={handleCreateWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الفرع التابع له المستودع *:', 'Assigned Branch *:')}
                </label>
                <select
                  value={selectedBranchForWh}
                  onChange={(e) => setSelectedBranchForWh(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {(currentTenantBranches.length > 0 ? currentTenantBranches : branches).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم المستودع (بالعربية) *:', 'Warehouse Name (Arabic) *:')}
                </label>
                <input
                  type="text"
                  required
                  value={newWhNameAr}
                  onChange={(e) => setNewWhNameAr(e.target.value)}
                  placeholder="مثال: مخزن الأدوية والمستلزمات"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود المستودع:', 'Warehouse Code:')}
                  </label>
                  <input
                    type="text"
                    value={newWhCode}
                    onChange={(e) => setNewWhCode(e.target.value)}
                    placeholder="WH-02"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs uppercase font-mono text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الموقع / العنوان:', 'Location:')}
                  </label>
                  <input
                    type="text"
                    value={newWhLocation}
                    onChange={(e) => setNewWhLocation(e.target.value)}
                    placeholder="الطابق الأرضي"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
                >
                  {t('حفظ المستودع', 'Save Warehouse')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BRANCH MODAL */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t('تعديل بيانات الفرع', 'Edit Branch Details')}
                </h3>
              </div>
              <button
                onClick={() => setEditingBranch(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBranch} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم الفرع (بالعربية) *:', 'Branch Name (Arabic) *:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editBranchNameAr}
                    onChange={(e) => setEditBranchNameAr(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم الفرع (بالإنجليزية):', 'Branch Name (English):')}
                  </label>
                  <input
                    type="text"
                    value={editBranchNameEn}
                    onChange={(e) => setEditBranchNameEn(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الفرع:', 'Branch Code:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editBranchCode}
                    onChange={(e) => setEditBranchCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs uppercase font-mono text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('المدينة / المنطقة:', 'City / Region:')}
                  </label>
                  <input
                    type="text"
                    value={editBranchCity}
                    onChange={(e) => setEditBranchCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الهاتف:', 'Phone:')}
                  </label>
                  <input
                    type="text"
                    value={editBranchPhone}
                    onChange={(e) => setEditBranchPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="editBranchIsMain"
                  checked={editBranchIsMain}
                  onChange={(e) => setEditBranchIsMain(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="editBranchIsMain" className="font-bold text-slate-700 dark:text-slate-300">
                  {t('تعيين هذا الفرع كفرع رئيسي للشركة (Main Branch)', 'Set as Main Branch')}
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT WAREHOUSE MODAL */}
      {editingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <WarehouseIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t('تعديل بيانات المستودع', 'Edit Warehouse Details')}
                </h3>
              </div>
              <button
                onClick={() => setEditingWarehouse(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditWarehouse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم المستودع (بالعربية) *:', 'Warehouse Name (Arabic) *:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editWhNameAr}
                    onChange={(e) => setEditWhNameAr(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم المستودع (بالإنجليزية):', 'Warehouse Name (English):')}
                  </label>
                  <input
                    type="text"
                    value={editWhNameEn}
                    onChange={(e) => setEditWhNameEn(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود المستودع:', 'Warehouse Code:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editWhCode}
                    onChange={(e) => setEditWhCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs uppercase font-mono text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الموقع / العنوان الداخلي:', 'Internal Location:')}
                  </label>
                  <input
                    type="text"
                    value={editWhLocation}
                    onChange={(e) => setEditWhLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingWarehouse(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / ARCHIVE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`rounded-xl p-2.5 ${
                  deleteTarget.hasData
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {deleteTarget.hasData ? <ShieldAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {deleteTarget.hasData
                    ? t('النقل إلى الأرشيف الآمن للبيانات', 'Move to Safe Archive')
                    : t('تأكيد حذف السجل', 'Confirm Deletion')}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {deleteTarget.name} [{deleteTarget.code}]
                </p>
              </div>
            </div>

            {deleteTarget.hasData ? (
              <div className="space-y-3 text-xs">
                <div className="rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 border border-amber-200/60 dark:border-amber-900/40">
                  <p className="font-bold mb-1.5 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-amber-600" />
                    <span>{t('تنبيه حفظ النزاهة التاريخية والمحاسبية:', 'Historical Integrity Notice:')}</span>
                  </p>
                  <p className="leading-relaxed text-[11px]">
                    {t(
                      'نظراً لارتباط هذا السجل ببيانات تشغيلية سابقة، فلن يتم مسحه نهائياً لتفادي تلف العمليات التاريخية، وإنما سيتم تجميده ونقله إلى «الأرشيف الآمن».',
                      'Because this record has associated data, it will not be permanently deleted. It will be safely archived and frozen to prevent breaking past transactions.'
                    )}
                  </p>
                  <ul className="mt-2 list-disc list-inside text-[11px] font-bold text-amber-800 dark:text-amber-300 space-y-0.5">
                    {deleteTarget.dataDetails.map((detail, idx) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(
                    '🔒 ملاحظة هامة: بعد الأرشفة، لن يتمكن أي مستخدم من استعادة هذا السجل إلا بعد اعتماد رسمي من مدير عام النظام (Admin Approval).',
                    '🔒 Note: Once archived, this record cannot be restored without explicit System Admin approval.'
                  )}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t(
                  'هذا السجل غير مرتبط بأي فواتير أو مستودعات أو حركات سابقة. هل ترغب بالتأكيد في حذفه نهائياً؟',
                  'This record has no associated data or invoices. Are you sure you want to permanently delete it?'
                )}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md cursor-pointer transition-colors ${
                  deleteTarget.hasData
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {deleteTarget.hasData ? (
                  <>
                    <Archive className="h-4 w-4" />
                    <span>{t('نقل إلى الأرشيف الآمن', 'Move to Archive')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>{t('تأكيد الحذف النهائي', 'Confirm Delete')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-xl dark:bg-white dark:text-slate-900 border border-slate-800 dark:border-slate-200 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="rounded-lg p-1 text-slate-400 hover:text-white dark:text-slate-600 dark:hover:text-slate-900 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
