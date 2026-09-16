import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { AppUser, UserRole } from '../types';
import { INITIAL_USERS, INITIAL_TENANT, INITIAL_BRANCHES } from '../data/initialData';
import { SYSTEM_VIEWS, SYSTEM_ACTIONS } from '../data/permissionsData';
import {
  Users,
  UserCheck,
  Shield,
  Plus,
  ShieldCheck,
  Check,
  X,
  Trash2,
  Building2,
  KeyRound,
  CheckCircle2,
  User,
  Search,
  RotateCcw,
  Sparkles,
  Lock,
  Edit3,
  Layers,
  Warehouse as WarehouseIcon,
  SlidersHorizontal,
  Receipt,
  ShoppingCart,
  Package,
  Calculator,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const UsersRolesView: React.FC = () => {
  const {
    t,
    language,
    tenant,
    tenants,
    branches,
    warehouses,
    users,
    addUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    currentUser,
    setCurrentUser,
  } = usePlatform();

  const isRtl = language === 'ar';

  const [activeTab, setActiveTab] = useState<'users' | 'matrix'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  // Modal State for Create / Edit User
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form Fields State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('Cashier');
  const [isActive, setIsActive] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Granular RBAC Permissions State
  const [allowedTenantIds, setAllowedTenantIds] = useState<string[]>([]);
  const [allowedBranchIds, setAllowedBranchIds] = useState<string[]>([]);
  const [allowedWarehouseIds, setAllowedWarehouseIds] = useState<string[]>([]);
  const [allowedViews, setAllowedViews] = useState<string[]>([]);
  const [allowedActions, setAllowedActions] = useState<string[]>([]);

  // Active Tab inside User Modal
  const [modalScopeTab, setModalScopeTab] = useState<
    'basic' | 'companies' | 'branches' | 'warehouses' | 'views' | 'actions'
  >('basic');

  const safeTenant = tenant || INITIAL_TENANT;
  const safeTenants = (tenants && tenants.length > 0 ? tenants : [INITIAL_TENANT]).filter((t) => !t.isArchived);
  const safeBranches = (branches && branches.length > 0 ? branches : INITIAL_BRANCHES).filter((b) => !b.isArchived);
  const safeWarehouses = (warehouses && warehouses.length > 0 ? warehouses : []).filter((w) => !w.isArchived);
  const safeUsers = users && users.length > 0 ? users : INITIAL_USERS;
  const safeCurrentUser = currentUser || safeUsers[0];

  const getRoleDefaults = (selectedRole: UserRole) => {
    switch (selectedRole) {
      case 'SuperAdmin':
        return {
          views: SYSTEM_VIEWS.map((v) => v.id),
          actions: SYSTEM_ACTIONS.map((a) => a.key),
        };
      case 'BranchManager':
        return {
          views: SYSTEM_VIEWS.filter((v) => !['modules', 'neon'].includes(v.id)).map((v) => v.id),
          actions: SYSTEM_ACTIONS.map((a) => a.key),
        };
      case 'Receptionist':
        return {
          views: ['reception_ops', 'bookings', 'pos', 'invoices', 'parties', 'shift_reports', 'clinics', 'dashboard'],
          actions: SYSTEM_ACTIONS.filter((a) =>
            ['reception_ops', 'bookings', 'pos', 'parties', 'shift_reports', 'clinics'].includes(a.viewId)
          ).map((a) => a.key),
        };
      case 'Cashier':
        return {
          views: ['pos', 'invoices', 'reception_ops', 'parties', 'shift_reports'],
          actions: SYSTEM_ACTIONS.filter((a) => ['pos', 'reception_ops', 'parties'].includes(a.viewId)).map((a) => a.key),
        };
      case 'Accountant':
        return {
          views: ['accounting', 'invoices', 'shift_reports', 'payment_methods', 'parties', 'inventory', 'dashboard', 'audit_trail'],
          actions: SYSTEM_ACTIONS.filter((a) => ['accounting', 'payment_methods', 'shift_reports'].includes(a.viewId)).map((a) => a.key),
        };
      case 'Doctor':
        return {
          views: ['clinics', 'bookings', 'staff', 'parties'],
          actions: SYSTEM_ACTIONS.filter((a) => ['clinics', 'bookings', 'staff'].includes(a.viewId)).map((a) => a.key),
        };
      default:
        return {
          views: SYSTEM_VIEWS.map((v) => v.id),
          actions: SYSTEM_ACTIONS.map((a) => a.key),
        };
    }
  };

  // Open modal for NEW user
  const handleOpenAddModal = () => {
    setEditingUserId(null);
    setName('');
    setUsername('');
    setPassword('123456');
    setEmail('');
    setPhone('');
    setRole('Receptionist');
    setIsActive(true);
    setIsAdmin(false);

    const defaults = getRoleDefaults('Receptionist');
    setAllowedTenantIds(safeTenant ? [safeTenant.id] : []);
    setAllowedBranchIds(safeBranches[0] ? [safeBranches[0].id] : []);
    setAllowedWarehouseIds(safeWarehouses[0] ? [safeWarehouses[0].id] : []);
    setAllowedViews(defaults.views);
    setAllowedActions(defaults.actions);

    setModalScopeTab('basic');
    setIsModalOpen(true);
  };

  // Open modal for EDITING user
  const handleOpenEditModal = (u: AppUser) => {
    setEditingUserId(u.id);
    setName(u.name);
    setUsername(u.username);
    setPassword(u.password || '');
    setEmail(u.email || '');
    setPhone(u.phone || '');
    setRole(u.role);
    setIsActive(u.isActive);
    setIsAdmin(!!u.isAdmin || u.username === 'admin');

    const roleDefs = getRoleDefaults(u.role);
    setAllowedTenantIds(u.allowedTenantIds || (u.isAdmin ? safeTenants.map((t) => t.id) : [safeTenant.id]));
    setAllowedBranchIds(u.allowedBranchIds || (u.branchId ? [u.branchId] : safeBranches.map((b) => b.id)));
    setAllowedWarehouseIds(u.allowedWarehouseIds || safeWarehouses.map((w) => w.id));
    setAllowedViews(u.allowedViews && u.allowedViews.length > 0 ? u.allowedViews : roleDefs.views);
    setAllowedActions(u.allowedActions && u.allowedActions.length > 0 ? u.allowedActions : roleDefs.actions);

    setModalScopeTab('basic');
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) return;

    if (editingUserId) {
      // Update existing user
      updateUser(editingUserId, {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: password.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
        role,
        isActive,
        isAdmin,
        allowedTenantIds: isAdmin ? safeTenants.map((t) => t.id) : allowedTenantIds,
        allowedBranchIds: isAdmin ? safeBranches.map((b) => b.id) : allowedBranchIds,
        allowedWarehouseIds: isAdmin ? safeWarehouses.map((w) => w.id) : allowedWarehouseIds,
        allowedViews: isAdmin ? SYSTEM_VIEWS.map((v) => v.id) : allowedViews,
        allowedActions: isAdmin ? SYSTEM_ACTIONS.map((a) => a.key) : allowedActions,
      });
    } else {
      // Create new user
      addUser({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: password.trim() || '123456',
        email: email.trim() || `${username.trim().toLowerCase()}@${safeTenant.code.toLowerCase()}.com`,
        phone: phone.trim(),
        role,
        isActive,
        isAdmin,
        allowedTenantIds: isAdmin ? safeTenants.map((t) => t.id) : allowedTenantIds,
        allowedBranchIds: isAdmin ? safeBranches.map((b) => b.id) : allowedBranchIds,
        allowedWarehouseIds: isAdmin ? safeWarehouses.map((w) => w.id) : allowedWarehouseIds,
        allowedViews: isAdmin ? SYSTEM_VIEWS.map((v) => v.id) : allowedViews,
        allowedActions: isAdmin ? SYSTEM_ACTIONS.map((a) => a.key) : allowedActions,
      });
    }

    setIsModalOpen(false);
  };

  // Helper toggle functions
  const toggleItem = (list: string[], item: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return safeUsers.filter((u) => {
      const matchesSearch =
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole = selectedRoleFilter === 'ALL' || u.role === selectedRoleFilter;

      return matchesSearch && matchesRole;
    });
  }, [safeUsers, searchQuery, selectedRoleFilter]);

  // Group actions by View ID for the in-screen buttons permissions tab
  const actionsByView = useMemo(() => {
    const map: Record<string, typeof SYSTEM_ACTIONS> = {};
    SYSTEM_ACTIONS.forEach((act) => {
      if (!map[act.viewId]) map[act.viewId] = [];
      map[act.viewId].push(act);
    });
    return map;
  }, []);

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              {t('إدارة المستخدمين وصلاحيات الشركات والفروع (RBAC)', 'Users, Tenants & Granular RBAC')}
            </h1>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              Security & Scope Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'حساب admin يمتلك صلاحيات غير مقيدة افتراضياً، وباقي المستخدمين تحدد لهم الشركات، الفروع، المخازن، والشاشات وأزرار العمليات بدقة.',
              'Admin has full default access; configure granular company, branch, warehouse, screen, and in-screen button permissions for all other users.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-open-new-user-modal"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة مستخدم جديد +', 'Add New User +')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('إجمالي المستخدمين', 'Total Users')}
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{safeUsers.length}</p>
          <span className="text-[10px] text-slate-400">{t('مسجلين بالدليل', 'In directory')}</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('المدراء العامون (Super Admin)', 'Super Admins')}
            </span>
            <div className="rounded-xl bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {safeUsers.filter((u) => u.isAdmin || u.role === 'SuperAdmin').length}
          </p>
          <span className="text-[10px] text-slate-400">{t('صلاحيات كاملة على كل الشركات', 'Unrestricted All Tenants')}</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('مستخدمين مخصصين (Scoped)', 'Scoped Staff')}
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {safeUsers.filter((u) => !u.isAdmin && u.role !== 'SuperAdmin').length}
          </p>
          <span className="text-[10px] text-slate-400">{t('مقيدين بفروع وشاشات محددة', 'Scoped to branches & buttons')}</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('الحسابات النشطة', 'Active Accounts')}
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {safeUsers.filter((u) => u.isActive).length}
          </p>
          <span className="text-[10px] text-slate-400">{t('جاهز لتسجيل الدخول', 'Enabled for login')}</span>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>{t('دليل المستخدمين وربط الصلاحيات', 'User Directory & Permissions')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {safeUsers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'matrix'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>{t('كتالوج الشاشات والأزرار المتاحة (Actions Catalog)', 'System Screens & Actions Catalog')}</span>
        </button>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('البحث بالاسم أو اسم المستخدم أو البريد...', 'Search by name, username, or email...')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pe-4 ps-9 text-xs text-slate-800 placeholder-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-indigo-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">{t('كافة الأدوار الوظيفية', 'All Roles')}</option>
                <option value="SuperAdmin">مدير عام (SuperAdmin)</option>
                <option value="BranchManager">مدير فرع (BranchManager)</option>
                <option value="Cashier">كاشير (Cashier)</option>
                <option value="Accountant">محاسب (Accountant)</option>
                <option value="Doctor">طبيب (Doctor)</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {t('لا توجد نتائج مطابقة لبحثك', 'No matching users found')}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRoleFilter('ALL');
                  }}
                  className="mt-3 rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إعادة ضبط البحث', 'Reset Filters')}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4 text-start">{t('المستخدم / الحساب', 'Staff / Account')}</th>
                      <th className="py-3.5 px-3 text-start">{t('اسم الدخول', 'Username')}</th>
                      <th className="py-3.5 px-3 text-center">{t('طبيعة الصلاحية', 'Access Type')}</th>
                      <th className="py-3.5 px-3 text-center">{t('الشركات المصرحة', 'Allowed Tenants')}</th>
                      <th className="py-3.5 px-3 text-center">{t('الفروع والمخازن', 'Branches & Warehouses')}</th>
                      <th className="py-3.5 px-3 text-center">{t('الشاشات والأزرار', 'Screens & Actions')}</th>
                      <th className="py-3.5 px-3 text-center">{t('الحالة', 'Status')}</th>
                      <th className="py-3.5 px-4 text-center">{t('إجراءات', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredUsers.map((u) => {
                      const userIsSuperAdmin = !!u.isAdmin || u.role === 'SuperAdmin';
                      const tenantCount = userIsSuperAdmin ? safeTenants.length : (u.allowedTenantIds?.length || 1);
                      const branchCount = userIsSuperAdmin ? safeBranches.length : (u.allowedBranchIds?.length || 1);
                      const warehouseCount = userIsSuperAdmin ? safeWarehouses.length : (u.allowedWarehouseIds?.length || 0);
                      const screenCount = userIsSuperAdmin ? SYSTEM_VIEWS.length : (u.allowedViews?.length || 2);
                      const actionCount = userIsSuperAdmin ? SYSTEM_ACTIONS.length : (u.allowedActions?.length || 4);

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* User info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                                  userIsSuperAdmin
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {u.name ? u.name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                                    {u.name}
                                  </span>
                                  {u.id === safeCurrentUser?.id && (
                                    <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                      {t('أنت', 'You')}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400">{u.email || u.phone || u.role}</span>
                              </div>
                            </div>
                          </td>

                          {/* Username & Pass */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                @{u.username}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              {u.password ? '••••••' : t('بدون كلمة مرور', 'No pass')}
                            </span>
                          </td>

                          {/* Role / Access Type Badge */}
                          <td className="py-3.5 px-3 text-center">
                            {userIsSuperAdmin ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60">
                                <Shield className="h-3 w-3" />
                                <span>{t('المدير العام (مطلق الصلاحيات)', 'Super Admin (Full Access)')}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <span>{u.role}</span>
                              </span>
                            )}
                          </td>

                          {/* Allowed Tenants */}
                          <td className="py-3.5 px-3 text-center">
                            {userIsSuperAdmin ? (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                {t('كل الشركات', 'All Companies')} ({safeTenants.length})
                              </span>
                            ) : (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {tenantCount} {t('شركة', 'Company')}
                              </span>
                            )}
                          </td>

                          {/* Branches & Warehouses */}
                          <td className="py-3.5 px-3 text-center">
                            {userIsSuperAdmin ? (
                              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                {t('كافة الفروع والمستودعات', 'All Branches & Warehouses')}
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5 text-[11px]">
                                <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                  {branchCount} {t('فرع', 'Branch')}
                                </span>
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                  {warehouseCount} {t('مخزن', 'Wh')}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Allowed Screens & Actions */}
                          <td className="py-3.5 px-3 text-center">
                            {userIsSuperAdmin ? (
                              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                {t('كافة الشاشات والأزرار', 'All Screens & Actions')}
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5 text-[11px]">
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {screenCount} {t('شاشات', 'Screens')}
                                </span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {actionCount} {t('زر مصرح', 'Buttons')}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Active Status */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              onClick={() => toggleUserStatus(u.id)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                                u.isActive
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {u.isActive ? t('نشط', 'Active') : t('معطل', 'Inactive')}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Permissions Button */}
                              <button
                                onClick={() => handleOpenEditModal(u)}
                                title={t('تعديل الصلاحيات والمربوطات', 'Edit Permissions & Scopes')}
                                className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 transition-colors cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>{t('الصلاحيات', 'Permissions')}</span>
                              </button>

                              {/* Delete User Button (not allowed on self or admin) */}
                              {u.id !== safeCurrentUser?.id && u.username !== 'admin' && (
                                <button
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        t(
                                          `هل تريد بالتأكيد حذف المستخدم (${u.name})؟`,
                                          `Are you sure you want to delete user (${u.name})?`
                                        )
                                      )
                                    ) {
                                      deleteUser(u.id);
                                    }
                                  }}
                                  className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                  title={t('حذف المستخدم', 'Delete User')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SYSTEM ACTIONS CATALOG & MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-black text-slate-900 dark:text-white mb-1">
              {t('دليل شاشات النظام وعمليات الأزرار (Actions Catalog)', 'System Views & In-Screen Actions Catalog')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {t(
                'يوضح هذا الكتالوج كافة الشاشات والأزرار المتاحة التي يمكنك التحكم في إظهارها أو حجبها عن كل مستخدم على حدة.',
                'Catalog of all screens and buttons available to be granularly granted or restricted per user.'
              )}
            </p>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {SYSTEM_VIEWS.map((v) => {
                const acts = actionsByView[v.id] || [];
                return (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <h3 className="text-xs font-black text-slate-900 dark:text-white">
                          {isRtl ? v.nameAr : v.nameEn}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isRtl ? v.descriptionAr : v.descriptionEn}
                        </p>
                      </div>
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                        {v.id}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {t('الأزرار والعمليات المحكومة داخل الشاشة:', 'Controlled in-screen buttons & actions:')}
                      </span>
                      {acts.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">
                          {t('دخول الشاشة فقط بدون أزرار خاصة', 'View access only')}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {acts.map((act) => (
                            <div
                              key={act.key}
                              className="flex items-start justify-between rounded-xl bg-white p-2 text-xs border border-slate-100 dark:bg-slate-900 dark:border-slate-800"
                            >
                              <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200">
                                  {isRtl ? act.nameAr : act.nameEn}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {isRtl ? act.descriptionAr : act.descriptionEn}
                                </p>
                              </div>
                              <span className="font-mono text-[9px] text-slate-400 shrink-0">
                                {act.key}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE USER CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative my-8 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    {editingUserId
                      ? t(`تعديل المستخدم والصلاحيات: ${name}`, `Edit User & Permissions: ${name}`)
                      : t('إضافة مستخدم جديد وتحديد صلاحياته', 'Add New User & Configure Permissions')}
                  </h2>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    RBAC
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t(
                    'اربط المستخدم بالشركات والفروع والمخازن المصرح بها، وحدد الأزرار المتاحة له داخل كل شاشة.',
                    'Scope user to specific companies, branches, warehouses, views, and button actions.'
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scope Navigation Tabs inside Modal */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 py-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalScopeTab('basic')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  modalScopeTab === 'basic'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>{t('البيانات والدور', 'Basic & Role')}</span>
              </button>

              <button
                type="button"
                onClick={() => setModalScopeTab('companies')}
                disabled={isAdmin}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                  modalScopeTab === 'companies'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>{t('الشركات المصرحة', 'Companies')}</span>
                {!isAdmin && (
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] dark:bg-slate-700">
                    {allowedTenantIds.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setModalScopeTab('branches')}
                disabled={isAdmin}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                  modalScopeTab === 'branches'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{t('الفروع المصرحة', 'Branches')}</span>
                {!isAdmin && (
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] dark:bg-slate-700">
                    {allowedBranchIds.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setModalScopeTab('warehouses')}
                disabled={isAdmin}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                  modalScopeTab === 'warehouses'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <WarehouseIcon className="h-3.5 w-3.5" />
                <span>{t('المستودعات / المخازن', 'Warehouses')}</span>
                {!isAdmin && (
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] dark:bg-slate-700">
                    {allowedWarehouseIds.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setModalScopeTab('views')}
                disabled={isAdmin}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                  modalScopeTab === 'views'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>{t('الشاشات المصرحة', 'Screens')}</span>
                {!isAdmin && (
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] dark:bg-slate-700">
                    {allowedViews.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setModalScopeTab('actions')}
                disabled={isAdmin}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                  modalScopeTab === 'actions'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{t('أزرار العمليات', 'Buttons & Actions')}</span>
                {!isAdmin && (
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] dark:bg-slate-700">
                    {allowedActions.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              {/* TAB: BASIC INFO & SUPER ADMIN FLAG */}
              {modalScopeTab === 'basic' && (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                  {/* Super Admin Toggle Banner (Mandate 2: User admin له كل الصلاحيات على كل الشركات بشكل افتراضى) */}
                  <div
                    className={`rounded-2xl p-4 border transition-colors ${
                      isAdmin
                        ? 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            isAdmin ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
                          }`}
                        >
                          <Shield className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">
                            {t('مدير عام كامل الصلاحيات (Super Admin)', 'Full Super Administrator')}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {t(
                              'يمتلك تلقائياً وصولاً غير مقيد لكافة الشركات والفروع والمخازن والشاشات وكافة الأزرار بشكل افتراضي.',
                              'Grants unrestricted access across all companies, branches, warehouses, views, and actions by default.'
                            )}
                          </p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAdmin}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setIsAdmin(val);
                            if (val) {
                              setRole('SuperAdmin');
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Standard Form Inputs */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t('اسم الموظف الكامل *:', 'Full Name *:')}
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="مثال: أحمد عبد الله"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t('اسم المستخدم للدخول *:', 'Username (Login) *:')}
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ahmed.cashier"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t('كلمة المرور *:', 'Password *:')}
                      </label>
                      <input
                        type="text"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="123456"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {t('الدور الوظيفي والصلاحيات:', 'Role Title & Preset:')}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const defs = getRoleDefaults(role);
                            setAllowedViews(defs.views);
                            setAllowedActions(defs.actions);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          {t('تطبيق الصلاحيات الافتراضية للدور', 'Apply Role Defaults')}
                        </button>
                      </div>
                      <select
                        value={role}
                        onChange={(e) => {
                          const newRole = e.target.value as UserRole;
                          setRole(newRole);
                          const defs = getRoleDefaults(newRole);
                          setAllowedViews(defs.views);
                          setAllowedActions(defs.actions);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        <option value="Receptionist">موظف استقبال وتسكين (Receptionist)</option>
                        <option value="Cashier">كاشير مبيعات (Cashier)</option>
                        <option value="BranchManager">مدير فرع (Branch Manager)</option>
                        <option value="Accountant">محاسب مالي (Accountant)</option>
                        <option value="Doctor">طبيب / أخصائي (Doctor)</option>
                        <option value="SuperAdmin">مدير عام النظام (Super Admin)</option>
                        <option value="Custom">مخصص (Custom Permissions)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t('البريد الإلكتروني:', 'Email:')}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@company.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t('رقم الهاتف:', 'Phone:')}
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="010XXXXXXXX"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300 font-bold">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>{t('الحساب مفعل ومسموح له بتسجيل الدخول', 'Account active & enabled for login')}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB: ALLOWED COMPANIES (Mandate 2: ربطه بشركات ايه) */}
              {modalScopeTab === 'companies' && (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {t('حدد الشركات والمؤسسات المسموح للمستخدم بالدخول عليها:', 'Select allowed companies:')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowedTenantIds(safeTenants.map((t) => t.id))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {t('تحديد الكل', 'Select All')}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAllowedTenantIds([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        {t('إلغاء التحديد', 'Clear')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {safeTenants.map((ten) => {
                      const isChecked = allowedTenantIds.includes(ten.id);
                      return (
                        <div
                          key={ten.id}
                          onClick={() => toggleItem(allowedTenantIds, ten.id, setAllowedTenantIds)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                            isChecked
                              ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/40'
                              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-5 w-5 items-center justify-center">
                              {isChecked ? (
                                <CheckSquare className="h-5 w-5 text-indigo-600" />
                              ) : (
                                <Square className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {isRtl ? ten.name : ten.nameEn}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                Code: {ten.code} • Plan: {ten.plan}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-500">{ten.currency}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: ALLOWED BRANCHES (Mandate 2: وفروع ايه) */}
              {modalScopeTab === 'branches' && (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {t('حدد الفروع المسموح للمستخدم بالعمل عليها:', 'Select allowed branches:')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowedBranchIds(safeBranches.map((b) => b.id))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {t('تحديد الكل', 'Select All')}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAllowedBranchIds([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        {t('إلغاء التحديد', 'Clear')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {safeBranches.map((b) => {
                      const isChecked = allowedBranchIds.includes(b.id);
                      const branchTenant = safeTenants.find((t) => t.id === b.tenantId);

                      return (
                        <div
                          key={b.id}
                          onClick={() => toggleItem(allowedBranchIds, b.id, setAllowedBranchIds)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                            isChecked
                              ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/40'
                              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-5 w-5 items-center justify-center">
                              {isChecked ? (
                                <CheckSquare className="h-5 w-5 text-indigo-600" />
                              ) : (
                                <Square className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {isRtl ? b.name : b.nameEn}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {b.city} • {branchTenant ? (isRtl ? branchTenant.name : branchTenant.nameEn) : ''}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {b.isHeadquarters ? t('فرع رئيسي', 'HQ') : t('فرع إقليمي', 'Branch')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: ALLOWED WAREHOUSES (Mandate 2: ومخازن ايه) */}
              {modalScopeTab === 'warehouses' && (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {t('حدد المستودعات والمخازن المسموح بالصرف منها أو الجرد عليها:', 'Select allowed warehouses:')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowedWarehouseIds(safeWarehouses.map((w) => w.id))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {t('تحديد الكل', 'Select All')}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAllowedWarehouseIds([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        {t('إلغاء التحديد', 'Clear')}
                      </button>
                    </div>
                  </div>

                  {safeWarehouses.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      {t('لا توجد مستودعات مضافة بعد لهذه الشركة', 'No warehouses found for this tenant')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {safeWarehouses.map((w) => {
                        const isChecked = allowedWarehouseIds.includes(w.id);
                        const whBranch = safeBranches.find((b) => b.id === w.branchId);

                        return (
                          <div
                            key={w.id}
                            onClick={() => toggleItem(allowedWarehouseIds, w.id, setAllowedWarehouseIds)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                              isChecked
                                ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/40'
                                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-5 w-5 items-center justify-center">
                                {isChecked ? (
                                  <CheckSquare className="h-5 w-5 text-indigo-600" />
                                ) : (
                                  <Square className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  {isRtl ? w.name : w.nameEn}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {w.code} • {whBranch ? (isRtl ? whBranch.name : whBranch.nameEn) : ''}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              {w.isDefault ? t('مستودع افتراضي', 'Default') : t('مستودع فرعي', 'Sub')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: ALLOWED VIEWS / SCREENS (Mandate 2: شاشات ايه) */}
              {modalScopeTab === 'views' && (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {t('حدد الشاشات المصرح لهذا المستخدم برؤيتها في القائمة الجانبية والدخول إليها:', 'Allowed screens:')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowedViews(SYSTEM_VIEWS.map((v) => v.id))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {t('تحديد الكل', 'Select All')}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAllowedViews([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        {t('إلغاء التحديد', 'Clear')}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SYSTEM_VIEWS.map((v) => {
                      const isChecked = allowedViews.includes(v.id);

                      return (
                        <div
                          key={v.id}
                          onClick={() => toggleItem(allowedViews, v.id, setAllowedViews)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                            isChecked
                              ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/40'
                              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
                            {isChecked ? (
                              <CheckSquare className="h-5 w-5 text-indigo-600" />
                            ) : (
                              <Square className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {isRtl ? v.nameAr : v.nameEn}
                            </p>
                            <p className="text-[10px] text-slate-400 line-clamp-1">
                              {isRtl ? v.descriptionAr : v.descriptionEn}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: ALLOWED IN-SCREEN BUTTONS & ACTIONS (Mandate 2: وزار ايه بداخل كل شاشة) */}
              {modalScopeTab === 'actions' && (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {t('حدد الصلاحيات الإجرائية (الأزرار والعمليات) داخل كل شاشة:', 'In-screen button rights:')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowedActions(SYSTEM_ACTIONS.map((a) => a.key))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {t('تحديد كافة الأزرار', 'Select All Buttons')}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAllowedActions([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        {t('إلغاء الكل', 'Clear All')}
                      </button>
                    </div>
                  </div>

                  {SYSTEM_VIEWS.map((v) => {
                    const acts = actionsByView[v.id] || [];
                    if (acts.length === 0) return null;

                    return (
                      <div
                        key={v.id}
                        className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-3.5 dark:border-slate-800 dark:bg-slate-800/30 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                            {isRtl ? v.nameAr : v.nameEn}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {acts.filter((a) => allowedActions.includes(a.key)).length} / {acts.length} {t('مفعل', 'granted')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {acts.map((act) => {
                            const isChecked = allowedActions.includes(act.key);

                            return (
                              <div
                                key={act.key}
                                onClick={() => toggleItem(allowedActions, act.key, setAllowedActions)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'border-indigo-500 bg-white dark:border-indigo-500 dark:bg-slate-900 shadow-xs'
                                    : 'border-slate-200 bg-slate-100/60 hover:bg-white dark:border-slate-700 dark:bg-slate-800'
                                }`}
                              >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
                                  {isChecked ? (
                                    <CheckSquare className="h-4 w-4 text-indigo-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                      {isRtl ? act.nameAr : act.nameEn}
                                    </p>
                                    <span className="font-mono text-[9px] text-slate-400">
                                      {act.key}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {isRtl ? act.descriptionAr : act.descriptionEn}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Modal Actions Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-98 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{editingUserId ? t('تحديث المستخدم والصلاحيات', 'Update User & Scopes') : t('حفظ وتفعيل المستخدم', 'Save & Activate User')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
