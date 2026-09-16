import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Tenant,
  Branch,
  Warehouse,
  ItemCategory,
  Product,
  StockLevel,
  Account,
  Party,
  ModuleDefinition,
  SalesInvoice,
  SalesInvoiceItem,
  PosShift,
  Appointment,
  PatientFollowUp,
  TreatmentPlan,
  JournalEntry,
  Language,
  NeonDbState,
  AppUser,
  PaymentMethod,
  StaffMember,
  ReceptionShift,
  ShiftRunRow,
  ShiftExpense,
  ShiftBalancingRow,
  ShiftDeviceCounter,
  AuditRecord,
  UserActivityLog,
  PaymentSplit,
  StaffPayrollItem,
  PayrollRun,
  LaserDevice,
  DeviceMaintenanceRecord,
  DeviceMaintenancePart,
  InventoryAudit,
  InventoryStaffLiability,
} from '../types';
import {
  INITIAL_MODULES,
  INITIAL_TENANT,
  INITIAL_TENANTS,
  INITIAL_USERS,
  INITIAL_BRANCHES,
  INITIAL_WAREHOUSES,
  INITIAL_ACCOUNTS,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_STOCK,
  INITIAL_PARTIES,
  INITIAL_APPOINTMENTS,
  INITIAL_PATIENT_FOLLOW_UPS,
  INITIAL_TREATMENT_PLANS,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_INVOICES,
  INITIAL_PAYMENT_METHODS,
  INITIAL_STAFF,
  INITIAL_RECEPTION_SHIFTS,
  INITIAL_AUDIT_RECORDS,
  INITIAL_USER_ACTIVITY_LOGS,
  INITIAL_PAYROLL_RUNS,
  INITIAL_LASER_DEVICES,
  INITIAL_DEVICE_MAINTENANCE,
  INITIAL_INVENTORY_AUDITS,
} from '../data/initialData';
import { NeonService } from '../services/neonService';
import { autoTranslateArabic } from '../utils/translator';

interface CheckoutPayload {
  customerId: string;
  items: {
    product: Product;
    quantity: number;
    unitPrice: number;
    discount: number;
  }[];
  discountAmount: number;
  paymentMethod: string;
  paymentMethodId?: string;
  cashPaid?: number;
  cardPaid?: number;
  taxRate?: number;
  isCollectionOnly?: boolean;
  splitPayments?: PaymentSplit[];
}

interface PlatformContextType {
  // Localization & Identity
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (ar: string, en: string) => string;
  formatMoney: (amount: number) => string;
  tenant: Tenant;
  setTenant: React.Dispatch<React.SetStateAction<Tenant>>;
  tenants: Tenant[];
  addTenant: (tenantData: Omit<Tenant, 'id'>) => Tenant;
  updateTenant: (tenantId: string, updatedData: Partial<Tenant>) => void;
  updateTenantModules: (tenantId: string, moduleIds: string[]) => void;
  switchTenant: (tenantId: string) => void;
  deleteTenant: (tenantId: string) => { status: 'archived' | 'deleted'; message: string };
  restoreTenant: (tenantId: string) => boolean;

  // Branches & Warehouses
  branches: Branch[];
  allBranches: Branch[];
  activeBranch: Branch | null;
  setActiveBranch: (branch: Branch | null) => void;
  addBranch: (branchData: Omit<Branch, 'id' | 'tenantId'>) => void;
  updateBranch: (branchId: string, updatedData: Partial<Branch>) => void;
  deleteBranch: (branchId: string) => { status: 'archived' | 'deleted'; message: string };
  archiveBranch: (branchId: string, reason?: string) => void;
  restoreBranch: (branchId: string) => boolean;
  warehouses: Warehouse[];
  allWarehouses: Warehouse[];
  activeWarehouse: Warehouse | null;
  setActiveWarehouse: (wh: Warehouse | null) => void;
  addWarehouse: (whData: Omit<Warehouse, 'id' | 'tenantId'>) => void;
  updateWarehouse: (warehouseId: string, updatedData: Partial<Warehouse>) => void;
  deleteWarehouse: (warehouseId: string) => { status: 'archived' | 'deleted'; message: string };
  archiveWarehouse: (warehouseId: string, reason?: string) => void;
  restoreWarehouse: (warehouseId: string) => boolean;

  // Users & Roles (RBAC) & Authentication
  isLoggedIn: boolean;
  login: (username: string, password?: string) => { success: boolean; error?: string };
  logout: () => void;
  users: AppUser[];
  allUsers: AppUser[];
  addUser: (userData: Omit<AppUser, 'id' | 'createdAt'>) => void;
  updateUser: (userId: string, updatedData: Partial<AppUser>) => void;
  deleteUser: (userId: string) => void;
  toggleUserStatus: (userId: string) => void;
  currentUser: AppUser;
  setCurrentUser: (user: AppUser) => void;
  canAccessTenant: (tenantId: string) => boolean;
  canAccessBranch: (branchId: string) => boolean;
  canAccessWarehouse: (warehouseId: string) => boolean;
  canAccessView: (viewId: string) => boolean;
  canPerformAction: (actionKey: string) => boolean;

  // Modules Configuration
  allModules: ModuleDefinition[];
  toggleModule: (moduleId: string) => void;
  isModuleActive: (moduleId: string) => boolean;

  // Categories & Service Groups
  categories: ItemCategory[];
  allCategories: ItemCategory[];
  addCategory: (categoryData: Omit<ItemCategory, 'id' | 'tenantId'>) => ItemCategory;
  updateCategory: (categoryId: string, updatedData: Partial<ItemCategory>) => void;
  deleteCategory: (categoryId: string) => { success: boolean; message: string };

  // Inventory & Products
  products: Product[];
  allProducts: Product[];
  stockLevels: StockLevel[];
  getProductStock: (productId: string, warehouseId?: string) => number;
  addProduct: (product: Omit<Product, 'id' | 'tenantId'>, initialStock: number) => void;
  updateProduct: (productId: string, updatedData: Partial<Product>) => void;
  deleteProduct: (productId: string) => Promise<void>;
  adjustStock: (productId: string, warehouseId: string, delta: number, reason: string) => void;
  transferStock: (productId: string, fromWh: string, toWh: string, qty: number) => void;
  pullLatestFromNeon: () => Promise<boolean>;

  // Inventory Audits & Settlements (الجرد والتسويات والخصم من الرواتب)
  inventoryAudits: InventoryAudit[];
  allInventoryAudits: InventoryAudit[];
  createInventoryAudit: (auditData: Omit<InventoryAudit, 'id' | 'tenantId' | 'auditNumber' | 'createdAt'>) => InventoryAudit;
  settleInventoryAudit: (
    auditId: string,
    settlementData: {
      settlementType: 'write_off' | 'staff_liability' | 'mixed' | 'inventory_adjustment_only';
      staffLiabilities?: InventoryStaffLiability[];
      settlementNotes?: string;
      linkToPayroll?: boolean;
    }
  ) => { success: boolean; error?: string; journalNumber?: string };
  deleteInventoryAudit: (auditId: string) => void;

  // Payment Methods (طرق السداد)
  paymentMethods: PaymentMethod[];
  allPaymentMethods: PaymentMethod[];
  addPaymentMethod: (data: Omit<PaymentMethod, 'id' | 'tenantId'>) => PaymentMethod;
  updatePaymentMethod: (id: string, data: Partial<PaymentMethod>) => void;
  archivePaymentMethod: (id: string, reason?: string) => void;
  restorePaymentMethod: (id: string) => void;
  deletePaymentMethod: (id: string) => void;

  // Staff, Doctors & Technicians (الموظفين والدكاترة والتكنيشن)
  staffMembers: StaffMember[];
  allStaffMembers: StaffMember[];
  addStaffMember: (data: Omit<StaffMember, 'id' | 'tenantId' | 'createdAt'>) => StaffMember;
  updateStaffMember: (id: string, data: Partial<StaffMember>) => void;
  toggleStaffMemberStatus: (id: string) => void;
  archiveStaffMember: (id: string, reason?: string) => void;
  restoreStaffMember: (id: string) => void;
  deleteStaffMember: (id: string) => void;

  // Staff Payroll & Salaries (مسير كشوف المرتبات والأجور)
  payrollRuns: PayrollRun[];
  allPayrollRuns: PayrollRun[];
  generatePayrollRun: (month: string, branchId?: string) => PayrollRun;
  updatePayrollItem: (runId: string, itemId: string, data: Partial<StaffPayrollItem>) => void;
  payPayrollItem: (runId: string, itemId: string, paymentMethod: string, notes?: string) => void;
  payEntirePayrollRun: (runId: string, paymentMethod: string) => void;

  // Customers, Patients & Suppliers (العملاء والمرضى والموردين)
  parties: Party[];
  allParties: Party[];
  patients: Party[];
  allPatients: Party[];
  addParty: (party: Omit<Party, 'id' | 'tenantId'>) => Party;
  updateParty: (id: string, data: Partial<Party>) => void;
  archiveParty: (id: string, reason?: string) => void;
  restoreParty: (id: string) => void;
  deleteParty: (id: string) => void;
  importPartiesFromExcel: (rows: Array<{
    paperCode?: string;
    systemCode?: string;
    name: string;
    nameEn?: string;
    phone: string;
    leadSource?: string;
    branchName?: string;
    type?: 'Customer' | 'Supplier' | 'Both';
  }>) => { imported: number; updated: number; errors: string[] };
  importCustomersFromExcel: (rows: any[]) => void;
  getNextCustomerSystemCode: (branchId?: string) => string;

  // Bookings & Follow-ups (شاشة الحجز والمتابعة)
  appointments: Appointment[];
  allAppointments: Appointment[];
  patientFollowUps: PatientFollowUp[];
  allPatientFollowUps: PatientFollowUp[];
  treatmentPlans: TreatmentPlan[];
  allTreatmentPlans: TreatmentPlan[];
  addAppointment: (apt: Omit<Appointment, 'id' | 'tenantId'>) => Appointment;
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  cancelAppointment: (id: string, reason: string) => void;
  markAppointmentAttendance: (id: string, attended: boolean, reason?: string) => void;
  rescheduleAppointment: (id: string, date: string, time: string, notes?: string) => void;
  addPatientFollowUp: (data: Omit<PatientFollowUp, 'id' | 'tenantId' | 'createdAt'>) => PatientFollowUp;
  updatePatientFollowUp: (id: string, data: Partial<PatientFollowUp>) => void;
  deletePatientFollowUp: (id: string) => void;
  addTreatmentPlan: (plan: Omit<TreatmentPlan, 'id' | 'tenantId'>) => TreatmentPlan;
  updateTreatmentPlan: (id: string, data: Partial<TreatmentPlan>) => void;
  progressTreatmentPlan: (planId: string) => void;

  // Reception Operations & Shifts (شاشة التشغيل للريسيبشن)
  receptionShifts: ReceptionShift[];
  allReceptionShifts: ReceptionShift[];
  activeReceptionShift: ReceptionShift | null;
  openReceptionShift: (receptionistName?: string, notes?: string) => ReceptionShift;
  closeReceptionShift: (shiftId: string, notes?: string) => void;
  addShiftRunRow: (shiftId: string, row: Omit<ShiftRunRow, 'id'>) => void;
  updateShiftRunRow: (shiftId: string, rowId: string, data: Partial<ShiftRunRow>) => void;
  removeShiftRunRow: (shiftId: string, rowId: string) => void;
  addShiftExpense: (shiftId: string, expense: Omit<ShiftExpense, 'id'>) => void;
  removeShiftExpense: (shiftId: string, expenseId: string) => void;
  updateShiftBalancing: (shiftId: string, methodId: string, data: Partial<ShiftBalancingRow>) => void;
  updateDeviceCounter: (
    shiftId: string,
    deviceId: string,
    dataOrConsumed: Partial<ShiftDeviceCounter> | number,
    adjustmentsVal?: number
  ) => void;
  updateShiftNotes: (shiftId: string, notes: string) => void;
  addAccountantAdjustment: (shiftId: string, adjustmentAmount: number, reason: string) => void;

  // Laser Devices (أجهزة ومعدات الليزر)
  laserDevices: LaserDevice[];
  allLaserDevices: LaserDevice[];
  addLaserDevice: (device: Omit<LaserDevice, 'id' | 'createdAt'>) => LaserDevice;
  updateLaserDevice: (id: string, updates: Partial<LaserDevice>) => void;
  deleteLaserDevice: (id: string) => void;
  resetLaserLampCounter: (id: string, newLimit?: number) => void;

  // Laser Device Maintenance & Warranty Tracking (صيانة الأجهزة وحساب المورد والضمان)
  deviceMaintenanceRecords: DeviceMaintenanceRecord[];
  allDeviceMaintenance: DeviceMaintenanceRecord[];
  addDeviceMaintenance: (record: Omit<DeviceMaintenanceRecord, 'id' | 'createdAt'>) => {
    success: boolean;
    maintenanceId?: string;
    journalEntryNumber?: string;
    error?: string;
  };
  deleteDeviceMaintenance: (maintenanceId: string) => { success: boolean; error?: string };

  // POS & Legacy Shift
  activeShift: PosShift;
  invoices: SalesInvoice[];
  allInvoices: SalesInvoice[];
  processCheckout: (payload: CheckoutPayload) => { success: boolean; invoice?: SalesInvoice; error?: string };
  refundInvoice: (invoiceId: string, reason: string, restockItems?: boolean) => { success: boolean; error?: string };
  closeShift: (actualCash: number, notes?: string) => void;
  openShift: (openingFloat: number) => void;

  // Accounting & Journal
  accounts: Account[];
  journalEntries: JournalEntry[];
  addAccount: (acc: Omit<Account, 'id' | 'tenantId'>) => Account;
  updateAccount: (accountId: string, data: Partial<Account>) => void;
  deleteAccount: (accountId: string) => { success: boolean; error?: string };
  createManualJournalEntry: (entry: {
    description: string;
    lines: { accountId: string; debit: number; credit: number; memo?: string }[];
  }) => { success: boolean; error?: string };

  // Audit Trail & User Activity Logs (سجل التعديلات، المحذوفات، ونشاطات المستخدمين)
  auditRecords: AuditRecord[];
  allAuditRecords: AuditRecord[];
  userActivityLogs: UserActivityLog[];
  allUserActivityLogs: UserActivityLog[];
  activityLogs: UserActivityLog[];
  recordAudit: (audit: Omit<AuditRecord, 'id' | 'tenantId' | 'performedById' | 'performedByName' | 'timestamp'>) => void;
  logUserActivity: (screenId: string, screenNameAr: string, screenNameEn: string, actionNameAr: string, actionNameEn: string, details: string) => void;

  // Neon PostgreSQL
  neonDb: NeonDbState;
  updateNeonConnectionString: (conn: string) => void;
  testNeonConnection: (connOverride?: string) => Promise<boolean>;
  syncAllToNeon: () => Promise<{ success: boolean; message: string; count: number }>;
  fixNeonSchema: () => Promise<{ success: boolean; message: string }>;
  fetchRemoteCounts: () => Promise<{ [key: string]: number }>;
  getPostgresSchemaSql: () => string;
  resetToDefaults: () => void;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Language & Direction
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('erp_lang') as Language) || 'ar';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('erp_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // 2. Tenants & Companies Management
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    try {
      const saved = localStorage.getItem('erp_tenants');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: Tenant) => ({
            ...t,
            activeModules: Array.isArray(t.activeModules) ? t.activeModules : INITIAL_TENANT.activeModules,
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load tenants:', e);
    }
    return INITIAL_TENANTS;
  });

  const [tenant, setTenant] = useState<Tenant>(() => {
    try {
      const savedId = localStorage.getItem('erp_active_tenant_id');
      if (savedId) {
        const found = tenants.find((t) => t.id === savedId);
        if (found) return found;
      }
    } catch (e) {
      console.error('Failed to load active tenant:', e);
    }
    return tenants[0] || INITIAL_TENANT;
  });

  useEffect(() => {
    localStorage.setItem('erp_tenants', JSON.stringify(tenants));
  }, [tenants]);

  useEffect(() => {
    if (tenant?.id) {
      localStorage.setItem('erp_active_tenant_id', tenant.id);
    }
  }, [tenant]);

  const formatMoney = (amount: number) => {
    const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const formatted = new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
    const symbol = language === 'ar' ? (tenant?.currencySymbol || 'ج.م') : (tenant?.currency || 'EGP');
    return `${formatted} ${symbol}`;
  };

  // 3. Branches & Warehouses
  const [allBranches, setAllBranches] = useState<Branch[]>(() => {
    try {
      const saved = localStorage.getItem('erp_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
    return INITIAL_BRANCHES;
  });

  const [activeBranch, setActiveBranch] = useState<Branch | null>(() => {
    return allBranches.find((b) => b.tenantId === tenant.id) || allBranches[0] || null;
  });

  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>(() => {
    try {
      const saved = localStorage.getItem('erp_warehouses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load warehouses:', e);
    }
    return INITIAL_WAREHOUSES;
  });

  const [activeWarehouse, setActiveWarehouse] = useState<Warehouse | null>(() => {
    return allWarehouses.find((w) => w.tenantId === tenant.id) || allWarehouses[0] || null;
  });

  useEffect(() => {
    localStorage.setItem('erp_branches', JSON.stringify(allBranches));
  }, [allBranches]);

  useEffect(() => {
    localStorage.setItem('erp_warehouses', JSON.stringify(allWarehouses));
  }, [allWarehouses]);

  const branches = allBranches.filter((b) => b.tenantId === tenant?.id);
  const warehouses = allWarehouses.filter((w) => w.tenantId === tenant?.id);

  // 4. Users & Authentication
  const [allUsers, setAllUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('erp_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
    return INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<AppUser>(() => {
    try {
      const savedUser = localStorage.getItem('erp_current_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {
      console.error('Failed to load current user:', e);
    }
    return allUsers[0] || INITIAL_USERS[0];
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('erp_is_logged_in') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('erp_users', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem('erp_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('erp_is_logged_in', isLoggedIn ? 'true' : 'false');
  }, [isLoggedIn]);

  const users = allUsers.filter((u) => u.isAdmin || u.allowedTenantIds?.includes('*') || u.allowedTenantIds?.includes(tenant?.id));

  // 5. Activity Logs & Audit Trail (سجل النشاطات والتعديلات)
  const [allAuditRecords, setAllAuditRecords] = useState<AuditRecord[]>(() => {
    try {
      const saved = localStorage.getItem('erp_audit_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load audit records:', e);
    }
    return INITIAL_AUDIT_RECORDS;
  });

  const [allUserActivityLogs, setAllUserActivityLogs] = useState<UserActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem('erp_user_activity_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load activity logs:', e);
    }
    return INITIAL_USER_ACTIVITY_LOGS;
  });

  useEffect(() => {
    localStorage.setItem('erp_audit_records', JSON.stringify(allAuditRecords));
  }, [allAuditRecords]);

  useEffect(() => {
    localStorage.setItem('erp_user_activity_logs', JSON.stringify(allUserActivityLogs));
  }, [allUserActivityLogs]);

  const auditRecords = allAuditRecords.filter((a) => a.tenantId === tenant?.id);
  const userActivityLogs = allUserActivityLogs.filter((u) => u.tenantId === tenant?.id);

  const recordAudit = (audit: Omit<AuditRecord, 'id' | 'tenantId' | 'performedById' | 'performedByName' | 'timestamp'>) => {
    const newRecord: AuditRecord = {
      ...audit,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      branchId: activeBranch?.id,
      performedById: currentUser?.id || 'admin',
      performedByName: currentUser?.name || 'System Administrator',
      timestamp: new Date().toISOString(),
    };
    setAllAuditRecords((prev) => [newRecord, ...prev]);
  };

  const logUserActivity = (
    screenId: string,
    screenNameAr: string,
    screenNameEn: string,
    actionNameAr: string,
    actionNameEn: string,
    details: string
  ) => {
    const newLog: UserActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      branchId: activeBranch?.id,
      userId: currentUser?.id || 'admin',
      userName: currentUser?.name || 'System Admin',
      userRole: currentUser?.role || 'SuperAdmin',
      screenId,
      screenNameAr,
      screenNameEn,
      actionNameAr,
      actionNameEn,
      details,
      timestamp: new Date().toISOString(),
    };
    setAllUserActivityLogs((prev) => [newLog, ...prev]);
  };

  // 6. Payment Methods (طرق السداد)
  const [allPaymentMethods, setAllPaymentMethods] = useState<PaymentMethod[]>(() => {
    try {
      const saved = localStorage.getItem('erp_payment_methods');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge linkedAccountId if missing from initial default
          return parsed.map((item: PaymentMethod) => {
            if (!item.linkedAccountId) {
              const defaultMatch = INITIAL_PAYMENT_METHODS.find((d) => d.id === item.id || d.code === item.code);
              if (defaultMatch?.linkedAccountId) {
                return { ...item, linkedAccountId: defaultMatch.linkedAccountId };
              }
            }
            return item;
          });
        }
      }
    } catch (e) {
      console.error('Failed to load payment methods:', e);
    }
    return INITIAL_PAYMENT_METHODS;
  });

  useEffect(() => {
    localStorage.setItem('erp_payment_methods', JSON.stringify(allPaymentMethods));
  }, [allPaymentMethods]);

  const paymentMethods = allPaymentMethods.filter((p) => p.tenantId === tenant?.id);

  const addPaymentMethod = (data: Omit<PaymentMethod, 'id' | 'tenantId'>): PaymentMethod => {
    const nameEn = data.nameEn || autoTranslateArabic(data.nameAr);
    const newMethod: PaymentMethod = {
      ...data,
      nameEn,
      id: `pm-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      isArchived: false,
    };
    setAllPaymentMethods((prev) => [...prev, newMethod]);
    recordAudit({
      entityType: 'PaymentMethod',
      entityId: newMethod.id,
      entityName: newMethod.nameAr,
      actionType: 'CREATE',
      diffSummary: `إضافة وسيلة دفع جديدة (${newMethod.nameAr} - ${newMethod.nameEn})`,
      newState: newMethod,
    });
    logUserActivity(
      'payment_methods',
      'طرق السداد',
      'Payment Methods',
      'إضافة طريقة سداد',
      'Add Payment Method',
      `تمت إضافة وسيلة الدفع: ${newMethod.nameAr}`
    );
    return newMethod;
  };

  const updatePaymentMethod = (id: string, data: Partial<PaymentMethod>) => {
    const prevMethod = allPaymentMethods.find((p) => p.id === id);
    const nameEn = data.nameEn || (data.nameAr ? autoTranslateArabic(data.nameAr) : prevMethod?.nameEn);
    setAllPaymentMethods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data, nameEn: nameEn || p.nameEn } : p))
    );
    recordAudit({
      entityType: 'PaymentMethod',
      entityId: id,
      entityName: prevMethod?.nameAr || 'Payment Method',
      actionType: 'UPDATE',
      diffSummary: `تعديل بيانات وسيلة الدفع (${prevMethod?.nameAr})`,
      previousState: prevMethod,
      newState: { ...prevMethod, ...data },
    });
  };

  const archivePaymentMethod = (id: string, reason?: string) => {
    const prevMethod = allPaymentMethods.find((p) => p.id === id);
    if (!prevMethod) return;
    setAllPaymentMethods((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              isArchived: true,
              archivedAt: new Date().toISOString(),
              archivedBy: currentUser?.name || 'Admin',
              archiveReason: reason || 'أرشفة وسيلة الدفع',
            }
          : p
      )
    );
    recordAudit({
      entityType: 'PaymentMethod',
      entityId: id,
      entityName: prevMethod.nameAr,
      actionType: 'ARCHIVE',
      reason,
      diffSummary: `أرشفة وسيلة الدفع (${prevMethod.nameAr})`,
      previousState: prevMethod,
    });
  };

  const restorePaymentMethod = (id: string) => {
    setAllPaymentMethods((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              isArchived: false,
              archivedAt: undefined,
              archivedBy: undefined,
              archiveReason: undefined,
            }
          : p
      )
    );
  };

  // 7. Staff, Doctors & Technicians (الأطباء والتكنيشن والموظفين)
  const [allStaffMembers, setAllStaffMembers] = useState<StaffMember[]>(() => {
    try {
      const saved = localStorage.getItem('erp_staff_members');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load staff members:', e);
    }
    return INITIAL_STAFF;
  });

  useEffect(() => {
    localStorage.setItem('erp_staff_members', JSON.stringify(allStaffMembers));
  }, [allStaffMembers]);

  const staffMembers = allStaffMembers.filter((s) => s.tenantId === tenant?.id);

  const addStaffMember = (data: Omit<StaffMember, 'id' | 'tenantId' | 'createdAt'>): StaffMember => {
    const nameEn = data.nameEn || autoTranslateArabic(data.nameAr);
    const jobTitleEn = data.jobTitleEn || autoTranslateArabic(data.jobTitleAr);
    const specialtyEn = data.specialtyEn || (data.specialtyAr ? autoTranslateArabic(data.specialtyAr) : undefined);

    const newStaff: StaffMember = {
      ...data,
      nameEn,
      jobTitleEn,
      specialtyEn,
      id: `stf-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    setAllStaffMembers((prev) => [...prev, newStaff]);
    recordAudit({
      entityType: 'Staff',
      entityId: newStaff.id,
      entityName: newStaff.nameAr,
      actionType: 'CREATE',
      diffSummary: `إضافة عضو فريق جديد (${newStaff.nameAr} - ${newStaff.jobTitleAr})`,
      newState: newStaff,
    });
    logUserActivity(
      'staff_management',
      'فريق العمل والأطباء',
      'Staff & Doctors',
      'إضافة عضو كادر',
      'Add Staff Member',
      `تمت إضافة ${newStaff.nameAr} بمهنة ${newStaff.jobTitleAr}`
    );
    return newStaff;
  };

  const updateStaffMember = (id: string, data: Partial<StaffMember>) => {
    const prevStaff = allStaffMembers.find((s) => s.id === id);
    const nameEn = data.nameEn || (data.nameAr ? autoTranslateArabic(data.nameAr) : prevStaff?.nameEn);
    const jobTitleEn = data.jobTitleEn || (data.jobTitleAr ? autoTranslateArabic(data.jobTitleAr) : prevStaff?.jobTitleEn);

    setAllStaffMembers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data, nameEn: nameEn || s.nameEn, jobTitleEn: jobTitleEn || s.jobTitleEn } : s))
    );
    recordAudit({
      entityType: 'Staff',
      entityId: id,
      entityName: prevStaff?.nameAr || 'Staff Member',
      actionType: 'UPDATE',
      diffSummary: `تعديل بيانات الموظف/الطبيب (${prevStaff?.nameAr})`,
      previousState: prevStaff,
      newState: { ...prevStaff, ...data },
    });
  };

  const archiveStaffMember = (id: string, reason?: string) => {
    const prevStaff = allStaffMembers.find((s) => s.id === id);
    if (!prevStaff) return;
    setAllStaffMembers((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              isArchived: true,
              archivedAt: new Date().toISOString(),
              archivedBy: currentUser?.name || 'Admin',
              archiveReason: reason || 'أرشفة الموظف',
            }
          : s
      )
    );
    recordAudit({
      entityType: 'Staff',
      entityId: id,
      entityName: prevStaff.nameAr,
      actionType: 'ARCHIVE',
      reason,
      diffSummary: `أرشفة الموظف/الطبيب (${prevStaff.nameAr})`,
    });
  };

  const restoreStaffMember = (id: string) => {
    setAllStaffMembers((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              isArchived: false,
              archivedAt: undefined,
              archivedBy: undefined,
              archiveReason: undefined,
            }
          : s
      )
    );
  };

  const toggleStaffMemberStatus = (id: string) => {
    const s = allStaffMembers.find((staff) => staff.id === id);
    if (!s) return;
    const nextStatus = !s.isActive;
    updateStaffMember(id, { isActive: nextStatus });
    logUserActivity(
      'staff_management',
      'إدارة الموظفين',
      'Employee Management',
      nextStatus ? 'تفعيل حساب موظف' : 'تعطيل حساب موظف',
      nextStatus ? 'Activate Employee' : 'Deactivate Employee',
      `تم ${nextStatus ? 'تفعيل' : 'تعطيل'} حساب الموظف: ${s.nameAr}`
    );
  };

  // 8. Unified Parties (Customers, Patients & Suppliers)
  const [allParties, setAllParties] = useState<Party[]>(() => {
    try {
      const saved = localStorage.getItem('erp_parties');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasCashSupplier = parsed.some((p: Party) => p.name.includes('مورد كاش') || p.name.includes('مورد نقدي'));
          if (!hasCashSupplier) {
            const cashSupplier: Party = {
              id: 'party-s-cash',
              tenantId: parsed[0]?.tenantId || 'tenant-eg-001',
              name: 'مورد كاش (نقدي)',
              nameEn: 'Cash Supplier (General)',
              type: 'Supplier',
              phone: '01000000000',
              taxNumber: '000-000-000',
              balance: 0,
              createdAt: '2026-01-01T08:00:00Z',
            };
            return [cashSupplier, ...parsed];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load parties:', e);
    }
    return INITIAL_PARTIES;
  });

  useEffect(() => {
    localStorage.setItem('erp_parties', JSON.stringify(allParties));
  }, [allParties]);

  const parties = allParties.filter((p) => p.tenantId === tenant?.id);

  // System Code Generator based on Company preferences
  const getNextCustomerSystemCode = (branchId?: string): string => {
    const currentTenant = tenant || INITIAL_TENANT;
    const mode = currentTenant.customerNumberingMode || 'per_company';
    const startNum = currentTenant.customerStartNumber || 1000;

    if (mode === 'per_branch' && branchId) {
      const targetBranch = branches.find((b) => b.id === branchId);
      const branchCode = targetBranch?.code || 'BR';
      const branchParties = parties.filter((p) => p.branchId === branchId);
      const nextNum = startNum + branchParties.length;
      return `${branchCode}-${nextNum}`;
    }

    // Default: Per company
    const totalCustomers = parties.filter((p) => p.type === 'Customer' || p.type === 'Both').length;
    return `CUST-${startNum + totalCustomers}`;
  };

  const addParty = (partyData: Omit<Party, 'id' | 'tenantId'>): Party => {
    const nameEn = partyData.nameEn || autoTranslateArabic(partyData.name);
    const systemCode = partyData.systemCode || getNextCustomerSystemCode(partyData.branchId);

    const newParty: Party = {
      ...partyData,
      nameEn,
      systemCode,
      id: `party-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      createdAt: new Date().toISOString(),
      balance: partyData.balance || 0,
      isArchived: false,
    };

    setAllParties((prev) => [newParty, ...prev]);
    recordAudit({
      entityType: 'Party',
      entityId: newParty.id,
      entityName: newParty.name,
      actionType: 'CREATE',
      diffSummary: `إضافة عميل/مريض جديد (${newParty.name} - كود: ${newParty.systemCode})`,
      newState: newParty,
    });
    logUserActivity(
      'parties',
      'العملاء والمرضى والموردين',
      'Parties Directory',
      'إضافة عميل/مريض',
      'Add Client/Patient',
      `تمت إضافة العميل ${newParty.name} برقم هاتف ${newParty.phone}`
    );

    if (neonDb.connected && neonDb.connectionString && tenant?.id) {
      NeonService.insertPartyDirect(neonDb.connectionString, tenant.id, newParty);
    }
    return newParty;
  };

  const updateParty = (id: string, data: Partial<Party>) => {
    const prevParty = allParties.find((p) => p.id === id);
    const nameEn = data.nameEn || (data.name ? autoTranslateArabic(data.name) : prevParty?.nameEn);

    setAllParties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data, nameEn: nameEn || p.nameEn } : p))
    );
    recordAudit({
      entityType: 'Party',
      entityId: id,
      entityName: prevParty?.name || 'Party',
      actionType: 'UPDATE',
      diffSummary: `تعديل بيانات العميل/المريض (${prevParty?.name})`,
      previousState: prevParty,
      newState: { ...prevParty, ...data },
    });
  };

  const archiveParty = (id: string, reason?: string) => {
    const prevParty = allParties.find((p) => p.id === id);
    if (!prevParty) return;
    setAllParties((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              isArchived: true,
              archivedAt: new Date().toISOString(),
              archivedBy: currentUser?.name || 'Admin',
              archiveReason: reason || 'أرشفة العميل/المريض',
            }
          : p
      )
    );
    recordAudit({
      entityType: 'Party',
      entityId: id,
      entityName: prevParty.name,
      actionType: 'ARCHIVE',
      reason,
      diffSummary: `أرشفة العميل (${prevParty.name})`,
    });
  };

  const restoreParty = (id: string) => {
    setAllParties((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              isArchived: false,
              archivedAt: undefined,
              archivedBy: undefined,
              archiveReason: undefined,
            }
          : p
      )
    );
  };

  const deleteParty = (id: string) => {
    const p = allParties.find((party) => party.id === id);
    setAllParties((prev) => prev.filter((party) => party.id !== id));
    if (p) {
      recordAudit({
        branchId: activeBranch?.id,
        entityType: 'Party',
        entityId: id,
        entityName: p.name,
        actionType: 'DELETE',
        details: `تم حذف العميل/المورد: ${p.name} (${p.systemCode || ''})`,
      });
      logUserActivity(
        'parties',
        'العملاء والموردين',
        'Parties',
        'حذف عميل/مورد',
        'Delete Party',
        `تم حذف العميل/المورد نهائياً: ${p.name}`
      );
    }
  };

  const deleteStaffMember = (id: string) => {
    const s = allStaffMembers.find((staff) => staff.id === id);
    setAllStaffMembers((prev) => prev.filter((staff) => staff.id !== id));
    if (s) {
      recordAudit({
        branchId: activeBranch?.id,
        entityType: 'Staff',
        entityId: id,
        entityName: s.nameAr,
        actionType: 'DELETE',
        details: `تم حذف الموظف: ${s.nameAr}`,
      });
      logUserActivity(
        'staff',
        'الموظفين والكوادر',
        'Staff Directory',
        'حذف موظف',
        'Delete Staff',
        `تم حذف الموظف: ${s.nameAr}`
      );
    }
  };

  const deletePaymentMethod = (id: string) => {
    const pm = allPaymentMethods.find((p) => p.id === id);
    setAllPaymentMethods((prev) => prev.filter((p) => p.id !== id));
    if (pm) {
      recordAudit({
        branchId: activeBranch?.id,
        entityType: 'PaymentMethod',
        entityId: id,
        entityName: pm.nameAr,
        actionType: 'DELETE',
        details: `تم حذف طريقة السداد: ${pm.nameAr}`,
      });
    }
  };

  const importCustomersFromExcel = (rows: any[]) => {
    importPartiesFromExcel(
      rows.map((r) => ({
        name: r.name,
        nameEn: r.nameEn,
        phone: r.phone,
        paperCode: r.paperCode,
        leadSource: r.leadSource,
        type: 'Customer' as const,
      }))
    );
  };

  const importPartiesFromExcel = (
    rows: Array<{
      paperCode?: string;
      systemCode?: string;
      name: string;
      nameEn?: string;
      phone: string;
      leadSource?: string;
      branchName?: string;
      type?: 'Customer' | 'Supplier' | 'Both';
    }>
  ) => {
    let imported = 0;
    let updated = 0;
    const errors: string[] = [];
    const activeTenantId = tenant?.id || INITIAL_TENANT.id;

    const newPartiesToAdd: Party[] = [];

    rows.forEach((row, idx) => {
      if (!row.name || !row.name.trim()) {
        errors.push(`السطر ${idx + 1}: اسم العميل مطلوب`);
        return;
      }
      const cleanPhone = (row.phone || '').trim();
      const existing = parties.find((p) => p.phone === cleanPhone && cleanPhone.length > 5);

      if (existing) {
        updateParty(existing.id, {
          paperCode: row.paperCode || existing.paperCode,
          leadSource: row.leadSource || existing.leadSource,
        });
        updated++;
      } else {
        const branchMatch = branches.find(
          (b) => b.name.includes(row.branchName || '') || b.nameEn.toLowerCase().includes((row.branchName || '').toLowerCase())
        );
        const nameEn = row.nameEn || autoTranslateArabic(row.name);
        const sysCode = row.systemCode || getNextCustomerSystemCode(branchMatch?.id);

        const newParty: Party = {
          id: `party-imp-${Date.now()}-${idx}`,
          tenantId: activeTenantId,
          branchId: branchMatch?.id || activeBranch?.id,
          paperCode: row.paperCode || '',
          systemCode: sysCode,
          name: row.name.trim(),
          nameEn: nameEn.trim(),
          phone: cleanPhone || '0000000000',
          leadSource: row.leadSource || 'استيراد إكسل',
          type: row.type || 'Customer',
          balance: 0,
          isArchived: false,
          createdAt: new Date().toISOString(),
        };
        newPartiesToAdd.push(newParty);
        imported++;
      }
    });

    if (newPartiesToAdd.length > 0) {
      setAllParties((prev) => [...newPartiesToAdd, ...prev]);
    }

    logUserActivity(
      'parties',
      'العملاء والمرضى',
      'Parties Import',
      'استيراد شيت إكسل',
      'Import Excel Sheet',
      `تم استيراد ${imported} عميل جديد وتحديث ${updated} بنجاح`
    );

    return { imported, updated, errors };
  };

  // 9. Bookings & Follow-ups (شاشة الحجز والمتابعة)
  const [allAppointments, setAllAppointments] = useState<Appointment[]>(() => {
    try {
      const saved = localStorage.getItem('erp_appointments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load appointments:', e);
    }
    return INITIAL_APPOINTMENTS;
  });

  const [allTreatmentPlans, setAllTreatmentPlans] = useState<TreatmentPlan[]>(() => {
    try {
      const saved = localStorage.getItem('erp_treatment_plans');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load treatment plans:', e);
    }
    return INITIAL_TREATMENT_PLANS;
  });

  // Patient Follow-ups State
  const [allPatientFollowUps, setAllPatientFollowUps] = useState<PatientFollowUp[]>(() => {
    try {
      const saved = localStorage.getItem('erp_patient_follow_ups');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load patient follow-ups:', e);
    }
    return INITIAL_PATIENT_FOLLOW_UPS;
  });

  useEffect(() => {
    localStorage.setItem('erp_appointments', JSON.stringify(allAppointments));
  }, [allAppointments]);

  useEffect(() => {
    localStorage.setItem('erp_treatment_plans', JSON.stringify(allTreatmentPlans));
  }, [allTreatmentPlans]);

  useEffect(() => {
    localStorage.setItem('erp_patient_follow_ups', JSON.stringify(allPatientFollowUps));
  }, [allPatientFollowUps]);

  const appointments = allAppointments.filter((a) => a.tenantId === tenant?.id);
  const treatmentPlans = allTreatmentPlans.filter((t) => t.tenantId === tenant?.id);
  const patientFollowUps = allPatientFollowUps.filter((f) => f.tenantId === tenant?.id);

  const addPatientFollowUp = (data: Omit<PatientFollowUp, 'id' | 'tenantId' | 'createdAt'>): PatientFollowUp => {
    const newFollowUp: PatientFollowUp = {
      ...data,
      id: `fup-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      branchId: data.branchId || activeBranch?.id || 'branch-cairo',
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy || currentUser?.name || 'فريق المتابعة',
    };
    setAllPatientFollowUps((prev) => [newFollowUp, ...prev]);
    recordAudit({
      entityType: 'Appointment',
      entityId: newFollowUp.id,
      entityName: `متابعة ${newFollowUp.patientName}`,
      actionType: 'CREATE',
      diffSummary: `تسجيل متابعة جديدة للمريض/العميل (${newFollowUp.patientName}) بتاريخ ${newFollowUp.followUpDate}`,
      newState: newFollowUp,
    });
    logUserActivity(
      'appointments',
      'شاشة الحجز والمتابعة',
      'Bookings & Follow-ups',
      'تسجيل متابعة مريض',
      'Add Patient Follow-up',
      `تم تسجيل متابعة جديدة للمريض ${newFollowUp.patientName}`
    );
    return newFollowUp;
  };

  const updatePatientFollowUp = (id: string, data: Partial<PatientFollowUp>) => {
    setAllPatientFollowUps((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...data } : f))
    );
  };

  const deletePatientFollowUp = (id: string) => {
    setAllPatientFollowUps((prev) => prev.filter((f) => f.id !== id));
  };

  const addAppointment = (aptData: Omit<Appointment, 'id' | 'tenantId'>): Appointment => {
    const serviceNameEn = aptData.serviceNameEn || autoTranslateArabic(aptData.serviceNameAr);
    const newApt: Appointment = {
      ...aptData,
      serviceNameEn,
      id: `apt-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      createdAt: new Date().toISOString(),
    };
    setAllAppointments((prev) => [newApt, ...prev]);

    // Auto-sync into active reception shift if booking is for today and shift is open
    const today = new Date().toISOString().split('T')[0];
    if (newApt.date === today && activeReceptionShift && activeReceptionShift.status === 'Open') {
      const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const dayName = dayNames[new Date().getDay()] || 'اليوم';
      const autoRow: ShiftRunRow = {
        id: `run-row-auto-${Date.now()}`,
        date: today,
        dayName,
        customerId: newApt.patientId,
        patientId: newApt.patientId,
        systemCode: newApt.systemCode || `CUST-${newApt.patientId.slice(-4)}`,
        customerName: newApt.patientName,
        patientName: newApt.patientName,
        patientPhone: newApt.patientPhone,
        roomNumber: newApt.roomNumber || 'غرفة 1',
        serviceName: newApt.serviceNameAr,
        pulsesCount: 0,
        consumedQuantity: 1,
        unitPrice: newApt.price,
        totalRevenue: newApt.price,
        paymentMethod: paymentMethods[0]?.nameAr || 'نقداً (كاش)',
        collectedAmount: newApt.deposit || 0,
        laserDevice: 'جهاز كانديلا ليزر GentleMax Pro #1',
        doctorName: newApt.doctorName,
        doctorId: newApt.doctorId,
        technicianName: newApt.technicianName || '',
        technicianId: newApt.technicianId,
        appointmentId: newApt.id,
        description: `حجز مباشر جديد أثناء الشيفت: ${newApt.notes || ''}`,
      };
      setAllReceptionShifts((prevShifts) =>
        prevShifts.map((s) => {
          if (s.id === activeReceptionShift.id) {
            const nextRows = [...s.runRows, autoRow];
            const totalRev = nextRows.reduce((sum, r) => sum + r.totalRevenue, 0);
            const totalColl = nextRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);
            return {
              ...s,
              runRows: nextRows,
              totalRevenue: totalRev,
              totalCollected: totalColl,
              netShiftCash: totalColl - s.totalExpenses,
            };
          }
          return s;
        })
      );
    }

    recordAudit({
      entityType: 'Appointment',
      entityId: newApt.id,
      entityName: `حجز ${newApt.patientName}`,
      actionType: 'CREATE',
      diffSummary: `تسجيل حجز جديد للمريض (${newApt.patientName}) مع الطبيب (${newApt.doctorName}) بتكلفة ${newApt.price} ج.م`,
      newState: newApt,
    });
    logUserActivity(
      'appointments',
      'شاشة الحجز والمتابعة',
      'Bookings & Follow-ups',
      'حجز موعد جديد',
      'New Booking',
      `تم حجز موعد للمريض ${newApt.patientName} بتكلفة ${newApt.price} ج.م`
    );
    return newApt;
  };

  const updateAppointment = (id: string, data: Partial<Appointment>) => {
    const prevApt = allAppointments.find((a) => a.id === id);
    setAllAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...data } : a))
    );
    recordAudit({
      entityType: 'Appointment',
      entityId: id,
      entityName: prevApt?.patientName || 'Appointment',
      actionType: 'UPDATE',
      diffSummary: `تعديل تفاصيل الحجز للمريض (${prevApt?.patientName})`,
      previousState: prevApt,
      newState: { ...prevApt, ...data },
    });
  };

  const cancelAppointment = (id: string, reason: string) => {
    const prevApt = allAppointments.find((a) => a.id === id);
    setAllAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Cancelled', cancellationReason: reason } : a))
    );
    recordAudit({
      entityType: 'Appointment',
      entityId: id,
      entityName: prevApt?.patientName || 'Appointment',
      actionType: 'CANCEL',
      reason,
      diffSummary: `إلغاء حجز المريض (${prevApt?.patientName}) بسبب: ${reason}`,
      previousState: prevApt,
    });
  };

  const markAppointmentAttendance = (id: string, attended: boolean, reason?: string) => {
    const prevApt = allAppointments.find((a) => a.id === id);
    const newStatus = attended ? 'Attended' : 'NotAttended';
    setAllAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: newStatus,
              notAttendedReason: !attended ? reason : undefined,
            }
          : a
      )
    );
    recordAudit({
      entityType: 'Appointment',
      entityId: id,
      entityName: prevApt?.patientName || 'Appointment',
      actionType: 'UPDATE',
      diffSummary: attended ? `تسجيل حضور المريض (${prevApt?.patientName})` : `تسجيل عدم حضور المريض (${prevApt?.patientName}) - السبب: ${reason || 'غير محدد'}`,
      previousState: prevApt,
    });
  };

  const rescheduleAppointment = (id: string, date: string, time: string, notes?: string) => {
    const prevApt = allAppointments.find((a) => a.id === id);
    setAllAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              date,
              time,
              notes: notes ? `${a.notes || ''} | تم التعديل: ${notes}` : a.notes,
            }
          : a
      )
    );
    recordAudit({
      entityType: 'Appointment',
      entityId: id,
      entityName: prevApt?.patientName || 'Appointment',
      actionType: 'UPDATE',
      diffSummary: `تعديل وقت الحجز للمريض (${prevApt?.patientName}) إلى تاريخ ${date} الساعة ${time}`,
      previousState: prevApt,
    });
  };

  const addTreatmentPlan = (plan: Omit<TreatmentPlan, 'id' | 'tenantId'>): TreatmentPlan => {
    const newPlan: TreatmentPlan = {
      ...plan,
      id: `tp-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      status: 'Active',
      completedSessions: plan.completedSessions || 0,
    };
    setAllTreatmentPlans((prev) => [newPlan, ...prev]);
    recordAudit({
      entityType: 'TreatmentPlan',
      entityId: newPlan.id,
      entityName: newPlan.title,
      actionType: 'CREATE',
      diffSummary: `تسجيل خطة علاج ومتابعة جديدة (${newPlan.title}) للمريض ${newPlan.patientName}`,
      newState: newPlan,
    });
    return newPlan;
  };

  const updateTreatmentPlan = (id: string, data: Partial<TreatmentPlan>) => {
    setAllTreatmentPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  };

  const progressTreatmentPlan = (planId: string) => {
    setAllTreatmentPlans((prev) =>
      prev.map((plan) => {
        if (plan.id === planId) {
          const completed = Math.min(plan.totalSessions, plan.completedSessions + 1);
          return {
            ...plan,
            completedSessions: completed,
            status: completed === plan.totalSessions ? 'Completed' : 'Active',
          };
        }
        return plan;
      })
    );
  };

  // 9.5 Laser Devices State & Management (شاشة وإدارة أجهزة الليزر والمعدات)
  const [allLaserDevices, setAllLaserDevices] = useState<LaserDevice[]>(() => {
    try {
      const saved = localStorage.getItem('clinic_laser_devices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load laser devices:', e);
    }
    return INITIAL_LASER_DEVICES;
  });

  useEffect(() => {
    localStorage.setItem('clinic_laser_devices', JSON.stringify(allLaserDevices));
  }, [allLaserDevices]);

  const laserDevices = allLaserDevices.filter((d) => {
    const matchesTenant = !d.tenantId || d.tenantId === tenant?.id;
    const matchesBranch = !d.branchId || !activeBranch?.id || d.branchId === activeBranch.id;
    return matchesTenant && matchesBranch;
  });

  const addLaserDevice = (data: Omit<LaserDevice, 'id' | 'createdAt'>): LaserDevice => {
    const nameEn = data.nameEn || autoTranslateArabic(data.name);
    const newDevice: LaserDevice = {
      ...data,
      nameEn,
      id: `dev-${Date.now()}`,
      tenantId: data.tenantId || tenant?.id || INITIAL_TENANT.id,
      branchId: data.branchId || activeBranch?.id || 'branch-cairo',
      createdAt: new Date().toISOString(),
    };

    setAllLaserDevices((prev) => [newDevice, ...prev]);

    recordAudit({
      entityType: 'Device' as any,
      entityId: newDevice.id,
      entityName: newDevice.name,
      actionType: 'CREATE',
      diffSummary: `إضافة جهاز ليزر جديد (${newDevice.name}) كود ${newDevice.code} في ${newDevice.room}`,
      newState: newDevice,
    });

    logUserActivity(
      'laser_devices',
      'أجهزة الليزر والمعدات',
      'Laser Devices',
      'إضافة جهاز ليزر',
      'Add Laser Device',
      `تمت إضافة جهاز ليزر: ${newDevice.name}`
    );

    return newDevice;
  };

  const updateLaserDevice = (id: string, updates: Partial<LaserDevice>) => {
    const prevDev = allLaserDevices.find((d) => d.id === id);
    const nameEn = updates.nameEn || (updates.name ? autoTranslateArabic(updates.name) : prevDev?.nameEn);

    setAllLaserDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates, nameEn: nameEn || d.nameEn } : d))
    );

    recordAudit({
      entityType: 'Device' as any,
      entityId: id,
      entityName: prevDev?.name || 'Laser Device',
      actionType: 'UPDATE',
      diffSummary: `تعديل بيانات جهاز الليزر (${prevDev?.name})`,
      previousState: prevDev,
      newState: { ...prevDev, ...updates },
    });

    logUserActivity(
      'laser_devices',
      'أجهزة الليزر والمعدات',
      'Laser Devices',
      'تعديل جهاز ليزر',
      'Update Laser Device',
      `تم تعديل بيانات جهاز: ${prevDev?.name}`
    );
  };

  const deleteLaserDevice = (id: string) => {
    const prevDev = allLaserDevices.find((d) => d.id === id);
    if (!prevDev) return;

    setAllLaserDevices((prev) => prev.filter((d) => d.id !== id));

    recordAudit({
      entityType: 'Device' as any,
      entityId: id,
      entityName: prevDev.name,
      actionType: 'DELETE',
      diffSummary: `حذف جهاز الليزر (${prevDev.name}) من النظام`,
    });

    logUserActivity(
      'laser_devices',
      'أجهزة الليزر والمعدات',
      'Laser Devices',
      'حذف جهاز ليزر',
      'Delete Laser Device',
      `تم حذف جهاز الليزر: ${prevDev.name}`
    );
  };

  const resetLaserLampCounter = (id: string, newLimit?: number) => {
    setAllLaserDevices((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          return {
            ...d,
            currentLampShots: 0,
            lastMaintenanceDate: new Date().toISOString().split('T')[0],
            warningLimitShots: newLimit || d.warningLimitShots,
            maintenanceNotes: `${d.maintenanceNotes ? d.maintenanceNotes + ' | ' : ''}تم استبدال وتصفير عداد اللمبة بتاريخ ${new Date().toLocaleDateString('ar-EG')}`,
          };
        }
        return d;
      })
    );
  };

  // 9.5 Laser Device Maintenance & Warranty Tracking (صيانة الأجهزة وحساب المورد والضمان)
  const [allDeviceMaintenance, setAllDeviceMaintenance] = useState<DeviceMaintenanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('erp_device_maintenance');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load device maintenance:', e);
    }
    return INITIAL_DEVICE_MAINTENANCE;
  });

  useEffect(() => {
    localStorage.setItem('erp_device_maintenance', JSON.stringify(allDeviceMaintenance));
  }, [allDeviceMaintenance]);

  const deviceMaintenanceRecords = allDeviceMaintenance.filter((m) => {
    const matchesTenant = !m.tenantId || m.tenantId === tenant?.id;
    const matchesBranch = !m.branchId || !activeBranch?.id || m.branchId === activeBranch.id;
    return matchesTenant && matchesBranch;
  });

  const addDeviceMaintenance = (
    data: Omit<DeviceMaintenanceRecord, 'id' | 'createdAt'>
  ): { success: boolean; maintenanceId?: string; journalEntryNumber?: string; error?: string } => {
    try {
      const maintenanceId = `maint-${Date.now()}`;
      const journalEntryNumber = `JV-MNT-${Date.now().toString().slice(-5)}`;
      const nowIso = new Date().toISOString();

      // 1. شجرة الحسابات والقيود المحاسبية
      // حساب مصروفات الصيانة (5250 أو 5200 أو أي مصروف)
      let expenseAcc =
        allAccounts.find((a) => a.code === '5250') ||
        allAccounts.find((a) => a.type === 'Expense' && a.code.startsWith('52')) ||
        allAccounts.find((a) => a.type === 'Expense');

      if (!expenseAcc) {
        const parent5000 = allAccounts.find((a) => a.code === '5000');
        expenseAcc = {
          id: 'acc-5250',
          tenantId: tenant?.id || INITIAL_TENANT.id,
          code: '5250',
          nameAr: 'مصروفات صيانة وتحديث أجهزة ومعدات الليزر',
          nameEn: 'Laser & Equipment Maintenance Expense',
          type: 'Expense',
          parentId: parent5000?.id || 'acc-5000',
          balance: 0,
          isDebitNormal: true,
          level: 2,
        };
        setAllAccounts((prev) => [...prev, expenseAcc!]);
      }

      // حساب الطرف الدائن حسب طريقة السداد
      let creditAcc =
        allAccounts.find((a) => a.code === '2110') ||
        allAccounts.find((a) => a.code === '2100') ||
        allAccounts.find((a) => a.type === 'Liability');

      if (data.paymentStatus === 'PaidCash') {
        creditAcc =
          allAccounts.find((a) => a.code === '1111') ||
          allAccounts.find((a) => a.code.startsWith('111')) ||
          creditAcc;
      } else if (data.paymentStatus === 'PaidBank') {
        creditAcc =
          allAccounts.find((a) => a.code === '1112') ||
          allAccounts.find((a) => a.code === '1110') ||
          creditAcc;
      }

      const costNum = Number(data.cost) || 0;

      const jvLines = [
        {
          id: `line-${Date.now()}-1`,
          accountId: expenseAcc.id,
          accountCode: expenseAcc.code,
          accountNameAr: expenseAcc.nameAr,
          accountNameEn: expenseAcc.nameEn,
          debit: costNum,
          credit: 0,
          memo: `صيانة جهاز ${data.deviceName} (${data.deviceCode || ''}) - المورد: ${data.supplierName}`,
        },
        {
          id: `line-${Date.now()}-2`,
          accountId: creditAcc ? creditAcc.id : expenseAcc.id,
          accountCode: creditAcc ? creditAcc.code : '0000',
          accountNameAr: creditAcc ? creditAcc.nameAr : 'الموردون والدائنون',
          accountNameEn: creditAcc ? creditAcc.nameEn : 'Accounts Payable',
          debit: 0,
          credit: costNum,
          memo:
            data.paymentStatus === 'OnCredit'
              ? `استحقاق آجل للمورد (${data.supplierName}) عن صيانة جهاز ${data.deviceName}`
              : `سداد فوري (${data.paymentMethodName || 'نقدي'}) لمصاريف صيانة جهاز ${data.deviceName}`,
        },
      ];

      const newJournal: JournalEntry = {
        id: `jv-mnt-${Date.now()}`,
        tenantId: data.tenantId || tenant?.id || INITIAL_TENANT.id,
        branchId: data.branchId || activeBranch?.id || '',
        entryNumber: journalEntryNumber,
        date: data.maintenanceDate || nowIso.split('T')[0],
        description: `فاتورة صيانة جهاز ليزر: ${data.deviceName} - المورد: ${data.supplierName} ${
          data.invoiceNumber ? `(#${data.invoiceNumber})` : ''
        }`,
        isPosted: true,
        lines: jvLines,
        createdAt: nowIso,
      };

      setAllJournals((prev) => [newJournal, ...prev]);

      // تحديث أرصدة شجرة الحسابات
      setAllAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id === expenseAcc?.id) {
            return { ...acc, balance: (acc.balance || 0) + costNum };
          }
          if (creditAcc && acc.id === creditAcc.id) {
            if (acc.isDebitNormal) {
              return { ...acc, balance: (acc.balance || 0) - costNum };
            } else {
              return { ...acc, balance: (acc.balance || 0) + costNum };
            }
          }
          return acc;
        })
      );

      // 2. تحديث رصيد المورد في شاشة الموردين (Suppliers & Parties)
      if (data.supplierId) {
        setAllParties((prev) =>
          prev.map((p) => {
            if (p.id === data.supplierId || (data.supplierName && p.name.trim() === data.supplierName.trim())) {
              if (data.paymentStatus === 'OnCredit') {
                return {
                  ...p,
                  balance: Number(p.balance || 0) + costNum,
                };
              }
            }
            return p;
          })
        );
      }

      // 3. إنشاء سجل الصيانة
      const newRecord: DeviceMaintenanceRecord = {
        ...data,
        id: maintenanceId,
        tenantId: data.tenantId || tenant?.id || INITIAL_TENANT.id,
        branchId: data.branchId || activeBranch?.id || 'branch-cairo',
        journalEntryId: newJournal.id,
        journalEntryNumber: journalEntryNumber,
        createdAt: nowIso,
      };

      setAllDeviceMaintenance((prev) => [newRecord, ...prev]);

      // 4. تحديث ريكورد الجهاز (تاريخ آخر صيانة، الملاحظات، الحالة، تصفير اللمبة)
      setAllLaserDevices((prev) =>
        prev.map((dev) => {
          if (dev.id === data.deviceId) {
            const currentHist = dev.maintenanceHistory || [];
            return {
              ...dev,
              status: data.deviceStatusAfter || dev.status,
              lastMaintenanceDate: data.maintenanceDate,
              maintenanceNotes: data.description,
              currentLampShots: data.resetLampShots ? 0 : dev.currentLampShots,
              maintenanceHistory: [newRecord, ...currentHist],
            };
          }
          return dev;
        })
      );

      // 5. سجل التدقيق وسجل نشاط المستخدمين
      recordAudit({
        branchId: activeBranch?.id,
        entityType: 'Device' as any,
        entityId: data.deviceId,
        entityName: data.deviceName,
        actionType: 'UPDATE',
        diffSummary: `إضافة عملية صيانة بقيمة ${costNum} ج.م مع المورد (${data.supplierName}) وقيد محاسبي (${journalEntryNumber})`,
        newState: newRecord,
      });

      logUserActivity(
        'laser_devices',
        'أجهزة ومعدات الليزر',
        'Laser Devices & Maintenance',
        'تسجيل عملية صيانة جهاز',
        'Add Device Maintenance',
        `تم تسجيل صيانة لجهاز ${data.deviceName} بمبلغ ${costNum} ج.م مع المورد ${data.supplierName}`
      );

      return { success: true, maintenanceId, journalEntryNumber };
    } catch (err: any) {
      console.error('Failed to add device maintenance:', err);
      return { success: false, error: err?.message || 'فشل في حفظ عملية الصيانة' };
    }
  };

  const deleteDeviceMaintenance = (maintenanceId: string): { success: boolean; error?: string } => {
    const rec = allDeviceMaintenance.find((m) => m.id === maintenanceId);
    if (!rec) return { success: false, error: 'سجل الصيانة غير موجود' };

    setAllDeviceMaintenance((prev) => prev.filter((m) => m.id !== maintenanceId));

    // تعديل رصيد المورد إذا كان آجل
    if (rec.paymentStatus === 'OnCredit' && rec.supplierId) {
      setAllParties((prev) =>
        prev.map((p) => {
          if (p.id === rec.supplierId) {
            return {
              ...p,
              balance: Math.max(0, Number(p.balance || 0) - Number(rec.cost)),
            };
          }
          return p;
        })
      );
    }

    // حذف قيد اليومية المرتبط
    if (rec.journalEntryId || rec.journalEntryNumber) {
      setAllJournals((prev) =>
        prev.filter((j) => j.id !== rec.journalEntryId && j.entryNumber !== rec.journalEntryNumber)
      );
    }

    // تحديث ريكورد الجهاز
    setAllLaserDevices((prev) =>
      prev.map((dev) => {
        if (dev.id === rec.deviceId) {
          return {
            ...dev,
            maintenanceHistory: (dev.maintenanceHistory || []).filter((m) => m.id !== maintenanceId),
          };
        }
        return dev;
      })
    );

    return { success: true };
  };

  // 10. Reception Operating Screen & Shifts (شاشة التشغيل للريسيبشن)
  const [allReceptionShifts, setAllReceptionShifts] = useState<ReceptionShift[]>(() => {
    try {
      const saved = localStorage.getItem('erp_reception_shifts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load reception shifts:', e);
    }
    return INITIAL_RECEPTION_SHIFTS;
  });

  useEffect(() => {
    localStorage.setItem('erp_reception_shifts', JSON.stringify(allReceptionShifts));
  }, [allReceptionShifts]);

  const receptionShifts = allReceptionShifts.filter((s) => s.tenantId === tenant?.id);
  const activeReceptionShift = receptionShifts.find((s) => s.status === 'Open' && (!activeBranch || s.branchId === activeBranch.id)) || null;

  const openReceptionShift = (receptionistName?: string, notes?: string): ReceptionShift => {
    const today = new Date().toISOString().split('T')[0];
    const shiftNum = `SH-${new Date().getFullYear()}-${(receptionShifts.length + 1).toString().padStart(4, '0')}`;
    const targetBranchId = activeBranch?.id || branches[0]?.id || 'branch-cairo';

    // Find the last closed shift for this branch to carry forward opening balances
    const lastClosedShift = receptionShifts.find(
      (s) => s.status === 'Closed' && s.branchId === targetBranchId
    );

    // Auto-populate default runRows with today's scheduled/attended bookings for this branch
    const todayAppointments = allAppointments.filter(
      (a) => a.tenantId === tenant?.id && a.date === today && (!activeBranch || a.branchId === targetBranchId) && a.status !== 'Cancelled'
    );
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = dayNames[new Date().getDay()] || 'اليوم';
    const initialRunRows: ShiftRunRow[] = todayAppointments.map((apt, idx) => {
      const patientParty = parties.find((p) => p.id === apt.patientId || p.name === apt.patientName);
      return {
        id: `run-row-init-${Date.now()}-${idx}`,
        date: today,
        dayName,
        customerId: apt.patientId || `cust-${idx}`,
        patientId: apt.patientId || `cust-${idx}`,
        systemCode: apt.systemCode || patientParty?.systemCode || `CUST-${1000 + idx}`,
        customerName: apt.patientName,
        patientName: apt.patientName,
        patientPhone: apt.patientPhone,
        roomNumber: apt.roomNumber || 'غرفة 1',
        serviceName: apt.serviceNameAr || 'جلسة علاجية',
        pulsesCount: 0,
        consumedQuantity: 1,
        unitPrice: apt.price || 0,
        totalRevenue: apt.price || 0,
        paymentMethod: paymentMethods[0]?.nameAr || 'نقداً (كاش)',
        collectedAmount: apt.deposit !== undefined ? apt.deposit : (apt.status === 'Attended' ? apt.price : 0),
        laserDevice: 'جهاز كانديلا ليزر GentleMax Pro #1',
        doctorName: apt.doctorName || 'د. استشاري',
        doctorId: apt.doctorId,
        technicianName: apt.technicianName || '',
        technicianId: apt.technicianId,
        appointmentId: apt.id,
        description: apt.notes || 'حجز مجدول لليوم',
      };
    });

    const initTotalRev = initialRunRows.reduce((sum, r) => sum + r.totalRevenue, 0);
    const initTotalColl = initialRunRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);

    // Default balancing rows based on available payment methods with opening balance from last closed shift
    const initialBalancing: ShiftBalancingRow[] = paymentMethods
      .filter((pm) => !pm.isArchived)
      .map((pm) => {
        const prevBal = lastClosedShift?.balancing.find(
          (b) => b.paymentMethodId === pm.id || b.paymentMethodName === pm.nameAr
        );
        const openingBal = prevBal ? prevBal.closingBalance : 0;
        const methodRows = initialRunRows.filter(
          (r) => r.paymentMethod.includes(pm.nameAr) || pm.nameAr.includes(r.paymentMethod)
        );
        const methodColl = methodRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);
        return {
          paymentMethodId: pm.id,
          paymentMethodName: pm.nameAr,
          openingBalance: openingBal,
          totalCollected: methodColl,
          totalDisbursed: 0,
          adjustments: 0,
          closingBalance: openingBal + methodColl,
        };
      });

    // Dynamically build device counters from all active laser devices for this branch/tenant
    const branchDevices = allLaserDevices.filter(
      (d) =>
        (d.status === 'Active' || d.status === 'Maintenance') &&
        (!d.branchId || !targetBranchId || d.branchId === targetBranchId)
    );
    const devicesToMonitor = branchDevices.length > 0 ? branchDevices : allLaserDevices.filter((d) => d.status === 'Active');

    const initialDeviceCounters: ShiftDeviceCounter[] = devicesToMonitor.map((d) => {
      const prevDev = lastClosedShift?.deviceCounters.find((dc) => dc.deviceId === d.id || dc.deviceName === d.name);
      const opening = prevDev ? prevDev.closingCounter : d.totalShotsCounter;
      return {
        deviceId: d.id,
        deviceName: d.name,
        openingCounter: opening,
        consumedCounter: 0,
        adjustments: 0,
        closingCounter: opening,
      };
    });

    const newShift: ReceptionShift = {
      id: `shift-rec-${Date.now()}`,
      shiftNumber: shiftNum,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      branchId: targetBranchId,
      receptionistId: currentUser?.id || 'rec-01',
      receptionistName: receptionistName || currentUser?.name || 'موظف الاستقبال',
      shiftDate: today,
      openedAt: new Date().toISOString(),
      status: 'Open',
      notes: notes || '',
      runRows: initialRunRows,
      expenses: [],
      balancing: initialBalancing,
      deviceCounters: initialDeviceCounters,
      totalRevenue: initTotalRev,
      totalCollected: initTotalColl,
      totalExpenses: 0,
      netShiftCash: initTotalColl,
    };

    setAllReceptionShifts((prev) => [newShift, ...prev]);
    recordAudit({
      entityType: 'Shift',
      entityId: newShift.id,
      entityName: `شيفت ${newShift.shiftNumber}`,
      actionType: 'CREATE',
      diffSummary: `فتح شيفت تشغيل ريسيبشن جديد رقم (${newShift.shiftNumber}) مع تحميل (${initialRunRows.length}) حجز لليوم ورصيد افتتاحي`,
      newState: newShift,
    });
    logUserActivity(
      'reception_ops',
      'شاشة التشغيل (الريسيبشن)',
      'Reception Run-sheet',
      'فتح الشيفت',
      'Open Shift',
      `تم فتح الشيفت رقم ${newShift.shiftNumber} مع تحميل حجوزات اليوم تلقائياً`
    );
    return newShift;
  };

  const closeReceptionShift = (shiftId: string, notes?: string) => {
    setAllReceptionShifts((prev) =>
      prev.map((s) => {
        if (s.id === shiftId) {
          return {
            ...s,
            status: 'Closed',
            closedAt: new Date().toISOString(),
            notes: notes !== undefined ? notes : s.notes,
          };
        }
        return s;
      })
    );
    const closed = allReceptionShifts.find((s) => s.id === shiftId);
    recordAudit({
      entityType: 'Shift',
      entityId: shiftId,
      entityName: closed?.shiftNumber || 'Shift',
      actionType: 'UPDATE',
      diffSummary: `إغلاق شيفت التشغيل (${closed?.shiftNumber}) بإجمالي إيراد ${closed?.totalRevenue} ج.م ومصروفات ${closed?.totalExpenses} ج.م`,
    });
    logUserActivity(
      'reception_ops',
      'شاشة التشغيل (الريسيبشن)',
      'Reception Run-sheet',
      'إغلاق الشيفت',
      'Close Shift',
      `تم تقفيل الشيفت رقم ${closed?.shiftNumber}`
    );
  };

  const addShiftRunRow = (shiftId: string, rowData: Omit<ShiftRunRow, 'id'>) => {
    const pName = rowData.patientName || rowData.customerName || 'عميل / مريض نقدي';
    const newRow: ShiftRunRow = {
      ...rowData,
      patientName: pName,
      customerName: pName,
      customerId: rowData.customerId || rowData.patientId || `cust-${Date.now().toString().slice(-4)}`,
      patientId: rowData.patientId || rowData.customerId || `cust-${Date.now().toString().slice(-4)}`,
      id: `run-row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      totalRevenue: Number(((rowData.consumedQuantity ?? 1) * (rowData.unitPrice ?? 0)).toFixed(2)),
    };

    setAllReceptionShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === shiftId) {
          const nextRows = [...shift.runRows, newRow];
          const totalRev = nextRows.reduce((sum, r) => sum + r.totalRevenue, 0);
          const totalColl = nextRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);

          // Update balancing table
          const nextBalancing = shift.balancing.map((b) => {
            const methodRows = nextRows.filter((r) => r.paymentMethod.includes(b.paymentMethodName) || b.paymentMethodName.includes(r.paymentMethod));
            const methodColl = methodRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);
            return {
              ...b,
              totalCollected: methodColl,
              closingBalance: b.openingBalance + methodColl - b.totalDisbursed + b.adjustments,
            };
          });

          // Update device counter if pulses exist
          const existingDeviceIds = new Set(shift.deviceCounters.map((d) => d.deviceName));
          let currentCounters = [...shift.deviceCounters];

          // If new row used a device not in counters list, add it
          if (newRow.laserDevice && !existingDeviceIds.has(newRow.laserDevice)) {
            const devObj = allLaserDevices.find((d) => d.name === newRow.laserDevice || d.id === newRow.laserDevice);
            currentCounters.push({
              deviceId: devObj?.id || `dev-${Date.now()}`,
              deviceName: newRow.laserDevice,
              openingCounter: devObj?.totalShotsCounter || 0,
              consumedCounter: 0,
              adjustments: 0,
              closingCounter: devObj?.totalShotsCounter || 0,
            });
          }

          const nextCounters = currentCounters.map((d) => {
            const devRows = nextRows.filter((r) => r.laserDevice === d.deviceName);
            const consumed = devRows.reduce((sum, r) => sum + (r.pulsesCount || 0), 0);
            return {
              ...d,
              consumedCounter: consumed,
              closingCounter: d.openingCounter + consumed + d.adjustments,
            };
          });

          if (newRow.laserDevice && newRow.pulsesCount && newRow.pulsesCount > 0) {
            setAllLaserDevices((prevDevs) =>
              prevDevs.map((dev) => {
                if (dev.name === newRow.laserDevice || dev.id === newRow.laserDevice) {
                  return {
                    ...dev,
                    totalShotsCounter: dev.totalShotsCounter + (newRow.pulsesCount || 0),
                    currentLampShots: dev.currentLampShots + (newRow.pulsesCount || 0),
                  };
                }
                return dev;
              })
            );
          }

          return {
            ...shift,
            runRows: nextRows,
            totalRevenue: totalRev,
            totalCollected: totalColl,
            balancing: nextBalancing,
            deviceCounters: nextCounters,
            netShiftCash: totalColl - shift.totalExpenses,
          };
        }
        return shift;
      })
    );
  };

  const updateShiftRunRow = (shiftId: string, rowId: string, data: Partial<ShiftRunRow>) => {
    setAllReceptionShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === shiftId) {
          const nextRows = shift.runRows.map((r) => {
            if (r.id === rowId) {
              const updated = { ...r, ...data };
              if (data.consumedQuantity !== undefined || data.unitPrice !== undefined) {
                updated.totalRevenue = Number(((data.consumedQuantity ?? r.consumedQuantity) * (data.unitPrice ?? r.unitPrice)).toFixed(2));
              }
              return updated;
            }
            return r;
          });

          const totalRev = nextRows.reduce((sum, r) => sum + r.totalRevenue, 0);
          const totalColl = nextRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);

          return {
            ...shift,
            runRows: nextRows,
            totalRevenue: totalRev,
            totalCollected: totalColl,
            netShiftCash: totalColl - shift.totalExpenses,
          };
        }
        return shift;
      })
    );
  };

  const removeShiftRunRow = (shiftId: string, rowId: string) => {
    setAllReceptionShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === shiftId) {
          const nextRows = shift.runRows.filter((r) => r.id !== rowId);
          const totalRev = nextRows.reduce((sum, r) => sum + r.totalRevenue, 0);
          const totalColl = nextRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);
          return {
            ...shift,
            runRows: nextRows,
            totalRevenue: totalRev,
            totalCollected: totalColl,
            netShiftCash: totalColl - shift.totalExpenses,
          };
        }
        return shift;
      })
    );
  };

  const addShiftExpense = (shiftId: string, expense: Omit<ShiftExpense, 'id'>) => {
    const newExp: ShiftExpense = {
      ...expense,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    };

    // Link Supplier: If expense is linked to an existing payable supplier (non-cash), update supplier ledger balance
    if (newExp.supplierId && newExp.supplierId !== 'party-s-cash') {
      setAllParties((prev) =>
        prev.map((p) => {
          if (p.id === newExp.supplierId) {
            return {
              ...p,
              balance: Number(p.balance || 0) + Number(newExp.amount),
            };
          }
          return p;
        })
      );

      recordAudit({
        branchId: activeBranch?.id,
        entityType: 'Party' as any,
        entityId: newExp.supplierId,
        entityName: newExp.supplierName || 'مورد',
        actionType: 'UPDATE',
        diffSummary: `سند صرف / سداد دفعة لمورد (${newExp.supplierName || ''}) بقيمة ${newExp.amount} ج.م من نقدية الشيفت`,
      });
    }

    // Auto-post journal entry for shift disbursement
    const isPayablePayment = newExp.category === 'سداد دفعات ومستلزمات موردين' && newExp.supplierId !== 'party-s-cash';
    const debitAcc = isPayablePayment
      ? (allAccounts.find((a) => a.code === '2100') || allAccounts.find((a) => a.type === 'Liability'))
      : (allAccounts.find((a) => a.code === '5200') || allAccounts.find((a) => a.code === '5100') || allAccounts.find((a) => a.type === 'Expense'));

    const pm = allPaymentMethods.find(
      (p) => p.nameAr === newExp.disbursementMethod || p.id === newExp.disbursementMethod || p.nameEn === newExp.disbursementMethod
    );
    const cashAcc =
      (pm?.linkedAccountId ? allAccounts.find((a) => a.id === pm.linkedAccountId) : null) ||
      allAccounts.find((a) => a.code === '1111') ||
      allAccounts.find((a) => a.type === 'Asset');

    if (debitAcc && cashAcc) {
      const jvNum = `JV-EXP-${Date.now().toString().slice(-5)}`;
      const autoJv: JournalEntry = {
        id: `jv-exp-${Date.now()}`,
        tenantId: tenant?.id || INITIAL_TENANT.id,
        branchId: activeBranch?.id || '',
        entryNumber: jvNum,
        date: newExp.date || new Date().toISOString().split('T')[0],
        description: `سند صرف شيفت: ${newExp.description || newExp.reason} (${newExp.supplierName ? `المورد: ${newExp.supplierName}` : ''})`,
        isPosted: true,
        sourceDocument: `سند صرف شيفت #${shiftId.slice(-4)}`,
        createdAt: new Date().toISOString(),
        lines: [
          {
            id: `line-${Date.now()}-1`,
            accountId: debitAcc.id,
            accountCode: debitAcc.code,
            accountNameAr: debitAcc.nameAr,
            accountNameEn: debitAcc.nameEn,
            debit: newExp.amount,
            credit: 0,
            memo: newExp.supplierName ? `صرف للمورد: ${newExp.supplierName}` : newExp.reason,
          },
          {
            id: `line-${Date.now()}-2`,
            accountId: cashAcc.id,
            accountCode: cashAcc.code,
            accountNameAr: cashAcc.nameAr,
            accountNameEn: cashAcc.nameEn,
            debit: 0,
            credit: newExp.amount,
            memo: `صرف عبر: ${newExp.disbursementMethod || 'الخزينة'}`,
          },
        ],
      };
      setAllJournals((prev) => [autoJv, ...prev]);
    }

    setAllReceptionShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === shiftId) {
          const nextExpenses = [...shift.expenses, newExp];
          const totalExp = nextExpenses.reduce((sum, e) => sum + e.amount, 0);

          // Update balancing table
          const nextBalancing = shift.balancing.map((b) => {
            const methodExps = nextExpenses.filter(
              (e) => e.disbursementMethod.includes(b.paymentMethodName) || b.paymentMethodName.includes(e.disbursementMethod)
            );
            const disbursed = methodExps.reduce((sum, e) => sum + e.amount, 0);
            return {
              ...b,
              totalDisbursed: disbursed,
              closingBalance: b.openingBalance + b.totalCollected - disbursed + b.adjustments,
            };
          });

          return {
            ...shift,
            expenses: nextExpenses,
            totalExpenses: totalExp,
            balancing: nextBalancing,
            netShiftCash: shift.totalCollected - totalExp,
          };
        }
        return shift;
      })
    );
  };

  const removeShiftExpense = (shiftId: string, expenseId: string) => {
    // Reverse supplier balance if supplier was linked
    const targetShift = allReceptionShifts.find((s) => s.id === shiftId);
    const expToRemove = targetShift?.expenses.find((e) => e.id === expenseId);
    if (expToRemove?.supplierId) {
      setAllParties((prev) =>
        prev.map((p) =>
          p.id === expToRemove.supplierId
            ? { ...p, balance: Math.max(0, Number(p.balance || 0) - Number(expToRemove.amount)) }
            : p
        )
      );
    }

    setAllReceptionShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === shiftId) {
          const nextExpenses = shift.expenses.filter((e) => e.id !== expenseId);
          const totalExp = nextExpenses.reduce((sum, e) => sum + e.amount, 0);
          return {
            ...shift,
            expenses: nextExpenses,
            totalExpenses: totalExp,
            netShiftCash: shift.totalCollected - totalExp,
          };
        }
        return shift;
      })
    );
  };

  const updateShiftBalancing = (shiftId: string, methodId: string, data: Partial<ShiftBalancingRow>) => {
    setAllReceptionShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === shiftId) {
          const nextBalancing = shift.balancing.map((b) => {
            if (b.paymentMethodId === methodId) {
              const updated = { ...b, ...data };
              updated.closingBalance = updated.openingBalance + updated.totalCollected - updated.totalDisbursed + updated.adjustments;
              return updated;
            }
            return b;
          });
          return { ...shift, balancing: nextBalancing };
        }
        return shift;
      })
    );
  };

  const updateDeviceCounter = (
    shiftId: string,
    deviceId: string,
    dataOrConsumed: Partial<ShiftDeviceCounter> | number,
    adjustmentsVal?: number
  ) => {
    const data: Partial<ShiftDeviceCounter> =
      typeof dataOrConsumed === 'object'
        ? dataOrConsumed
        : { consumedCounter: dataOrConsumed, adjustments: adjustmentsVal ?? 0 };

    setAllReceptionShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === shiftId) {
          const nextCounters = shift.deviceCounters.map((d) => {
            if (d.deviceId === deviceId) {
              const updated = { ...d, ...data };
              updated.closingCounter =
                (updated.openingCounter ?? d.openingCounter) +
                (updated.consumedCounter ?? d.consumedCounter) +
                (updated.adjustments ?? d.adjustments ?? 0);
              return updated;
            }
            return d;
          });
          return { ...shift, deviceCounters: nextCounters };
        }
        return shift;
      })
    );
  };

  const updateShiftNotes = (shiftId: string, notes: string) => {
    setAllReceptionShifts((prev) =>
      prev.map((s) => (s.id === shiftId ? { ...s, notes } : s))
    );
  };

  const addAccountantAdjustment = (shiftId: string, adjustmentAmount: number, reason: string) => {
    setAllReceptionShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === shiftId) {
          const adjustments = shift.accountantAdjustments || [];
          const newAdj = {
            adjustedAt: new Date().toISOString(),
            adjustedBy: currentUser?.name || 'Accountant',
            adjustmentReason: reason,
            adjustmentAmount,
            auditLog: `تعديل محاسبي بقيمة ${adjustmentAmount} ج.م - السبب: ${reason}`,
          };
          return {
            ...shift,
            accountantAdjustments: [...adjustments, newAdj],
            totalCollected: shift.totalCollected + adjustmentAmount,
            netShiftCash: shift.netShiftCash + adjustmentAmount,
          };
        }
        return shift;
      })
    );
    recordAudit({
      entityType: 'Shift',
      entityId: shiftId,
      entityName: 'Shift Adjustment',
      actionType: 'UPDATE',
      reason,
      diffSummary: `إجراء تسوية محاسبية للشيفت بقيمة ${adjustmentAmount} ج.م بواسطة المحاسب (${currentUser?.name})`,
    });
  };

  // 11. Categories & Items
  const [allCategories, setAllCategories] = useState<ItemCategory[]>(() => {
    try {
      const saved = localStorage.getItem('erp_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
    return INITIAL_CATEGORIES;
  });

  useEffect(() => {
    localStorage.setItem('erp_categories', JSON.stringify(allCategories));
  }, [allCategories]);

  const categories = allCategories.filter((c) => c.tenantId === tenant?.id);

  const addCategory = (categoryData: Omit<ItemCategory, 'id' | 'tenantId'>): ItemCategory => {
    const nameEn = categoryData.nameEn || autoTranslateArabic(categoryData.nameAr);
    const newCat: ItemCategory = {
      ...categoryData,
      nameEn,
      id: `cat-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
    };
    setAllCategories((prev) => [...prev, newCat]);
    return newCat;
  };

  const updateCategory = (categoryId: string, updatedData: Partial<ItemCategory>) => {
    const nameEn = updatedData.nameEn || (updatedData.nameAr ? autoTranslateArabic(updatedData.nameAr) : undefined);
    setAllCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, ...updatedData, nameEn: nameEn || c.nameEn } : c))
    );
  };

  const deleteCategory = (categoryId: string): { success: boolean; message: string } => {
    const isUsed = allProducts.some((p) => p.categoryId === categoryId);
    if (isUsed) {
      return {
        success: false,
        message: 'لا يمكن حذف هذه المجموعة لأن هناك أصناف أو خدمات مرتبطة بها.',
      };
    }
    setAllCategories((prev) => prev.filter((c) => c.id !== categoryId));
    return { success: true, message: 'تم حذف المجموعة بنجاح.' };
  };

  // 12. Products & Inventory
  const [allProducts, setAllProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('erp_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge any missing initial raw/stock products
          const existingIds = new Set(parsed.map((p: any) => p.id));
          const missing = INITIAL_PRODUCTS.filter((p) => !existingIds.has(p.id));
          return missing.length > 0 ? [...parsed, ...missing] : parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load products:', e);
    }
    return INITIAL_PRODUCTS;
  });

  const [stockLevels, setStockLevels] = useState<StockLevel[]>(() => {
    try {
      const saved = localStorage.getItem('erp_stock');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge missing initial stock items
          const existingKeys = new Set(parsed.map((s: any) => `${s.productId}_${s.warehouseId}`));
          const missing = INITIAL_STOCK.filter((s) => !existingKeys.has(`${s.productId}_${s.warehouseId}`));
          return missing.length > 0 ? [...parsed, ...missing] : parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load stock levels:', e);
    }
    return INITIAL_STOCK;
  });

  useEffect(() => {
    localStorage.setItem('erp_products', JSON.stringify(allProducts));
  }, [allProducts]);

  useEffect(() => {
    localStorage.setItem('erp_stock', JSON.stringify(stockLevels));
  }, [stockLevels]);

  const products = allProducts.filter((p) => p.tenantId === tenant?.id);

  const getProductStock = (productId: string, warehouseId?: string) => {
    if (warehouseId) {
      const entry = stockLevels.find((s) => s.productId === productId && s.warehouseId === warehouseId);
      return entry ? entry.quantityOnHand : 0;
    }
    return stockLevels
      .filter((s) => s.productId === productId)
      .reduce((sum, s) => sum + s.quantityOnHand, 0);
  };

  const addProduct = (productData: Omit<Product, 'id' | 'tenantId'>, initialStock: number) => {
    const nameEn = productData.nameEn || autoTranslateArabic(productData.nameAr);
    const newProdId = `prod-${Date.now()}`;
    const newProduct: Product = {
      ...productData,
      nameEn,
      id: newProdId,
      tenantId: tenant?.id || INITIAL_TENANT.id,
    };

    setAllProducts((prev) => [...prev, newProduct]);

    if (!productData.isService && initialStock > 0 && activeWarehouse) {
      setStockLevels((prev) => [
        ...prev,
        {
          productId: newProdId,
          warehouseId: activeWarehouse.id,
          quantityOnHand: initialStock,
        },
      ]);
    }

    recordAudit({
      entityType: 'Product',
      entityId: newProdId,
      entityName: newProduct.nameAr,
      actionType: 'CREATE',
      diffSummary: `إضافة صنف/خدمة جديدة (${newProduct.nameAr} - ${newProduct.nameEn}) بسعر بيع ${newProduct.sellingPrice} ج.م`,
      newState: newProduct,
    });
  };

  const updateProduct = (productId: string, updatedData: Partial<Product>) => {
    const prevProd = allProducts.find((p) => p.id === productId);
    const nameEn = updatedData.nameEn || (updatedData.nameAr ? autoTranslateArabic(updatedData.nameAr) : prevProd?.nameEn);

    setAllProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updatedData, nameEn: nameEn || p.nameEn } : p))
    );
    recordAudit({
      entityType: 'Product',
      entityId: productId,
      entityName: prevProd?.nameAr || 'Product',
      actionType: 'UPDATE',
      diffSummary: `تعديل بيانات الصنف/الخدمة (${prevProd?.nameAr})`,
      previousState: prevProd,
      newState: { ...prevProd, ...updatedData },
    });
  };

  const deleteProduct = async (productId: string) => {
    const prevProd = allProducts.find((p) => p.id === productId);
    setAllProducts((prev) => prev.filter((p) => p.id !== productId));
    setStockLevels((prev) => prev.filter((s) => s.productId !== productId));
    if (prevProd) {
      recordAudit({
        entityType: 'Product',
        entityId: productId,
        entityName: prevProd.nameAr,
        actionType: 'DELETE',
        diffSummary: `حذف الصنف/الخدمة (${prevProd.nameAr}) من النظام`,
        previousState: prevProd,
      });
    }
  };

  const adjustStock = (productId: string, warehouseId: string, delta: number, reason: string) => {
    setStockLevels((prev) => {
      const idx = prev.findIndex((s) => s.productId === productId && s.warehouseId === warehouseId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantityOnHand: Math.max(0, next[idx].quantityOnHand + delta),
        };
        return next;
      }
      return [...prev, { productId, warehouseId, quantityOnHand: Math.max(0, delta) }];
    });
  };

  const transferStock = (productId: string, fromWh: string, toWh: string, qty: number) => {
    adjustStock(productId, fromWh, -qty, 'تحويل صادر');
    adjustStock(productId, toWh, qty, 'تحويل وارد');
  };

  const pullLatestFromNeon = async (): Promise<boolean> => {
    if (!neonDb.connected || !neonDb.connectionString) return false;
    const remoteProds = await NeonService.fetchProductsFromNeon(neonDb.connectionString);
    if (remoteProds && remoteProds.length > 0) {
      setAllProducts(remoteProds);
      return true;
    }
    return false;
  };

  // 12.1 Inventory Audits & Settlements (الجرد الفعلي واستخراج الفروق والتسوية وربطها بالمرتبات)
  const [allInventoryAudits, setAllInventoryAudits] = useState<InventoryAudit[]>(() => {
    try {
      const saved = localStorage.getItem('erp_inventory_audits');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load inventory audits:', e);
    }
    return INITIAL_INVENTORY_AUDITS;
  });

  useEffect(() => {
    localStorage.setItem('erp_inventory_audits', JSON.stringify(allInventoryAudits));
  }, [allInventoryAudits]);

  const inventoryAudits = allInventoryAudits.filter((a) => a.tenantId === tenant?.id);

  const createInventoryAudit = (
    auditData: Omit<InventoryAudit, 'id' | 'tenantId' | 'auditNumber' | 'createdAt'>
  ): InventoryAudit => {
    const year = new Date().getFullYear();
    const countNum = (allInventoryAudits.length + 1).toString().padStart(3, '0');
    const auditNumber = `AUD-${year}-${countNum}`;

    const newAudit: InventoryAudit = {
      ...auditData,
      id: `audit-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      auditNumber,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'مسؤول المخازن',
    };

    setAllInventoryAudits((prev) => [newAudit, ...prev]);

    recordAudit({
      branchId: newAudit.branchId,
      entityType: 'Inventory' as any,
      entityId: newAudit.id,
      entityName: `جرد مخزن ${newAudit.warehouseName}`,
      actionType: 'CREATE',
      diffSummary: `إنشاء عملية جرد جديدة (${auditNumber}) لمخزن ${newAudit.warehouseName} بصافي فرق مالي ${newAudit.netDifferenceValue} ج.م`,
      newState: newAudit,
    });

    logUserActivity(
      'inventory',
      'إدارة المخازن والجرد',
      'Inventory & Stocktaking',
      'بدء جلسة جرد',
      'Start Stocktaking',
      `تم تسجيل جرد جديد (${auditNumber}) لمخزن ${newAudit.warehouseName}`
    );

    return newAudit;
  };

  const settleInventoryAudit = (
    auditId: string,
    settlementData: {
      settlementType: 'write_off' | 'staff_liability' | 'mixed' | 'inventory_adjustment_only';
      staffLiabilities?: InventoryStaffLiability[];
      settlementNotes?: string;
      linkToPayroll?: boolean;
    }
  ): { success: boolean; error?: string; journalNumber?: string } => {
    const targetAudit = allInventoryAudits.find((a) => a.id === auditId);
    if (!targetAudit) {
      return { success: false, error: 'سجل الجرد غير موجود' };
    }
    if (targetAudit.status === 'Settled') {
      return { success: false, error: 'تمت تسوية هذا الجرد من قبل بالفعل' };
    }

    // 1. تحديث أرصدة المخزن تلقائياً لتطابق الكمية الفعلية
    targetAudit.items.forEach((item) => {
      if (item.differenceQty !== 0) {
        adjustStock(
          item.productId,
          targetAudit.warehouseId,
          item.differenceQty,
          `تسوية جرد ${targetAudit.auditNumber}: ${item.differenceQty > 0 ? 'فائض مخزني' : 'عجز مخزني'}`
        );
      }
    });

    // 2. إنشاء قيد محاسبي للتسوية إذا وُجد فرق مالي
    let journalNumber = '';
    const shortageVal = Math.abs(targetAudit.totalShortageValue || 0);
    const surplusVal = Math.abs(targetAudit.totalSurplusValue || 0);

    if (shortageVal > 0 || surplusVal > 0) {
      const entryId = `jv-inv-${Date.now().toString().slice(-6)}`;
      journalNumber = `JV-INV-${Date.now().toString().slice(-4)}`;

      // قيد تسوية العجز أو الفائض
      const lines = [];
      if (shortageVal > 0) {
        // إذا كان هناك عجز:
        if (settlementData.settlementType === 'staff_liability' && settlementData.staffLiabilities?.length) {
          // مدين: حساب العهد والموظفين (أو جاري موظفين)
          lines.push({
            accountId: 'acc-1120', // حساب ذمم / عهد الموظفين
            accountCode: '1120',
            accountNameAr: 'ذمم وأمانات الموظفين (تحميل عجز الجرد)',
            accountNameEn: 'Staff Receivables / Stock Deficit',
            debit: shortageVal,
            credit: 0,
            descriptionAr: `تحميل عجز جرد ${targetAudit.auditNumber} على الموظفين المسئولين`,
            descriptionEn: `Staff liability for stocktaking shortage ${targetAudit.auditNumber}`,
          });
        } else {
          // مدين: أرباح وخسائر / خسائر عجز المخزون
          lines.push({
            accountId: 'acc-5200', // مصروفات تشغيلية
            accountCode: '5200',
            accountNameAr: 'خسائر عجز وهلاك المخزون (تسوية جردية)',
            accountNameEn: 'Inventory Shrinkage & Loss',
            debit: shortageVal,
            credit: 0,
            descriptionAr: `تسوية عجز جرد ${targetAudit.auditNumber}`,
            descriptionEn: `Write-off inventory shortage ${targetAudit.auditNumber}`,
          });
        }
        // دائن: المخزون
        lines.push({
          accountId: 'acc-1130',
          accountCode: '1130',
          accountNameAr: 'مخزون البضائع ومستلزمات العيادة',
          accountNameEn: 'Merchandise & Clinic Inventory',
          debit: 0,
          credit: shortageVal,
          descriptionAr: `تخفيض المخزون بقيمة العجز الفعلي ${targetAudit.auditNumber}`,
          descriptionEn: `Reduce inventory by shortage ${targetAudit.auditNumber}`,
        });
      }

      if (surplusVal > 0) {
        // مدين: المخزون
        lines.push({
          accountId: 'acc-1130',
          accountCode: '1130',
          accountNameAr: 'مخزون البضائع ومستلزمات العيادة',
          accountNameEn: 'Merchandise & Clinic Inventory',
          debit: surplusVal,
          credit: 0,
          descriptionAr: `إضافة الفائض المخزني الفعلي ${targetAudit.auditNumber}`,
          descriptionEn: `Add inventory surplus ${targetAudit.auditNumber}`,
        });
        // دائن: أرباح تسوية المخزون
        lines.push({
          accountId: 'acc-4000',
          accountCode: '4000',
          accountNameAr: 'أرباح وإيرادات تسويات جرد المخزون',
          accountNameEn: 'Inventory Surplus Gain',
          debit: 0,
          credit: surplusVal,
          descriptionAr: `قيد فائض جرد ${targetAudit.auditNumber}`,
          descriptionEn: `Inventory surplus entry ${targetAudit.auditNumber}`,
        });
      }

      const newJournal: JournalEntry = {
        id: entryId,
        tenantId: targetAudit.tenantId,
        branchId: targetAudit.branchId || 'branch-1',
        entryNumber: journalNumber,
        date: new Date().toISOString().split('T')[0],
        description: `تسوية جرد ${targetAudit.auditNumber} لمستودع ${targetAudit.warehouseName}`,
        sourceDocument: targetAudit.auditNumber,
        isPosted: true,
        lines,
        createdAt: new Date().toISOString(),
      };

      setAllJournals((prev) => [newJournal, ...prev]);
    }

    // 3. تحديث مسير الرواتب إذا تم اختيار تحميلها على الموظفين
    const formattedLiabilities = (settlementData.staffLiabilities || []).map((lib) => ({
      ...lib,
      appliedToPayroll: true,
    }));

    if (settlementData.staffLiabilities && settlementData.staffLiabilities.length > 0) {
      // تعديل مسير الرواتب المفتوح أو إضافة الاستقطاع للموظفين المستهدفين
      setAllPayrollRuns((prev) =>
        prev.map((run) => {
          let runModified = false;
          const updatedItems = run.items.map((pItem) => {
            const matchLib = settlementData.staffLiabilities?.find(
              (l) => l.staffId === pItem.staffId && (l.deductionMonth === run.month || !l.deductionMonth)
            );
            if (matchLib && pItem.paymentStatus !== 'Paid') {
              runModified = true;
              const newDeductions = Number(pItem.deductions || 0) + Number(matchLib.amount);
              const newNet = Number(pItem.basicSalary || 0) + Number(pItem.allowances || 0) + Number(pItem.commissions || 0) - newDeductions;
              const addedNote = `[خصم عجز جرد ${targetAudit.auditNumber}: ${matchLib.amount} ج.م (${matchLib.percentage}%)]`;
              return {
                ...pItem,
                deductions: newDeductions,
                netSalary: newNet,
                notes: pItem.notes ? `${pItem.notes} | ${addedNote}` : addedNote,
              };
            }
            return pItem;
          });

          if (!runModified) return run;

          return {
            ...run,
            items: updatedItems,
            totalDeductions: updatedItems.reduce((s, i) => s + i.deductions, 0),
            totalNet: updatedItems.reduce((s, i) => s + i.netSalary, 0),
          };
        })
      );
    }

    // 4. تحديث حالة الجرد إلى مسوّى (Settled)
    const updatedAudit: InventoryAudit = {
      ...targetAudit,
      status: 'Settled',
      settlementType: settlementData.settlementType,
      staffLiabilities: formattedLiabilities,
      settlementNotes: settlementData.settlementNotes,
      settledAt: new Date().toISOString(),
      settledBy: currentUser?.name || 'المراجع العام',
      journalEntryId: journalNumber || undefined,
    };

    setAllInventoryAudits((prev) =>
      prev.map((a) => (a.id === auditId ? updatedAudit : a))
    );

    recordAudit({
      branchId: targetAudit.branchId,
      entityType: 'Inventory' as any,
      entityId: auditId,
      entityName: `تسوية جرد ${targetAudit.auditNumber}`,
      actionType: 'UPDATE',
      diffSummary: `اعتماد وتسوية جرد المخزن (${targetAudit.auditNumber}) بنوع تسوية (${settlementData.settlementType}) مع ترحيل الفروق محاسبياً وإلى الرواتب`,
      newState: updatedAudit,
    });

    logUserActivity(
      'inventory',
      'إدارة المخازن والجرد',
      'Inventory & Stocktaking',
      'تسوية جرد المخزن',
      'Settle Inventory Audit',
      `تمت تسوية جرد ${targetAudit.auditNumber} وترحيل القيود وتطبيق الاستقطاعات على المرتبات`
    );

    return { success: true, journalNumber };
  };

  const deleteInventoryAudit = (auditId: string) => {
    const prev = allInventoryAudits.find((a) => a.id === auditId);
    if (!prev) return;
    setAllInventoryAudits((items) => items.filter((a) => a.id !== auditId));
    recordAudit({
      branchId: prev.branchId,
      entityType: 'Inventory' as any,
      entityId: auditId,
      entityName: `حذف مسودة جرد ${prev.auditNumber}`,
      actionType: 'DELETE',
      diffSummary: `حذف جلسة الجرد (${prev.auditNumber})`,
    });
  };

  // 13. Accounting & Accounts
  const [allAccounts, setAllAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem('erp_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load accounts:', e);
    }
    return INITIAL_ACCOUNTS;
  });

  const [allJournals, setAllJournals] = useState<JournalEntry[]>(() => {
    try {
      const saved = localStorage.getItem('erp_journals');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load journals:', e);
    }
    return INITIAL_JOURNAL_ENTRIES;
  });

  useEffect(() => {
    localStorage.setItem('erp_accounts', JSON.stringify(allAccounts));
  }, [allAccounts]);

  useEffect(() => {
    localStorage.setItem('erp_journals', JSON.stringify(allJournals));
  }, [allJournals]);

  const accounts = allAccounts.filter((a) => a.tenantId === tenant?.id);
  const journalEntries = allJournals.filter((j) => j.tenantId === tenant?.id);

  // 13b. Staff Payroll & Salaries (مسير الرواتب والأجور)
  const [allPayrollRuns, setAllPayrollRuns] = useState<PayrollRun[]>(() => {
    try {
      const saved = localStorage.getItem('erp_payroll_runs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load payroll runs:', e);
    }
    return INITIAL_PAYROLL_RUNS;
  });

  useEffect(() => {
    localStorage.setItem('erp_payroll_runs', JSON.stringify(allPayrollRuns));
  }, [allPayrollRuns]);

  const payrollRuns = allPayrollRuns.filter((p) => p.tenantId === tenant?.id);

  const generatePayrollRun = (month: string, branchId?: string): PayrollRun => {
    const targetStaff = staffMembers.filter((s) => !s.isArchived && (!branchId || s.branchId === branchId));

    const items: StaffPayrollItem[] = targetStaff.map((staff, idx) => {
      const staffBranch = branches.find((b) => b.id === staff.branchId);
      const baseSalary = Number(staff.monthlySalary) || Number(staff.basicSalary) || 6000;

      // Completed appointments in this month for commissions
      const staffMonthAppointments = allAppointments.filter((a) => {
        if (a.tenantId !== tenant?.id) return false;
        if (a.doctorId !== staff.id && a.technicianId !== staff.id) return false;
        return a.date.startsWith(month) && a.status === 'Attended';
      });

      const commissionRate = staff.commissionRate || (staff.roleType === 'Doctor' ? 15 : staff.roleType === 'Technician' ? 5 : 0);
      const calculatedCommissions = staffMonthAppointments.reduce((sum, a) => {
        return sum + Math.round(((a.price || 0) * commissionRate) / 100);
      }, 0);

      const allowances = 0;

      // حساب استقطاعات عجز الجرد المحملة على الموظف في هذا الشهر
      const staffAuditsLiabilities = allInventoryAudits
        .filter((aud) => aud.tenantId === tenant?.id && aud.status === 'Settled')
        .flatMap((aud) => (aud.staffLiabilities || []).map((l) => ({ ...l, auditNumber: aud.auditNumber })))
        .filter((l) => l.staffId === staff.id && (l.deductionMonth === month || !l.deductionMonth));

      const auditDeductions = staffAuditsLiabilities.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
      const deductions = auditDeductions;
      const netSalary = baseSalary + allowances + calculatedCommissions - deductions;

      const auditNote = staffAuditsLiabilities.length > 0
        ? staffAuditsLiabilities.map((l) => `عجز جرد ${l.auditNumber}: ${l.amount} ج.م (${l.percentage}%)`).join(' | ')
        : '';

      return {
        id: `payitem-${Date.now()}-${idx}`,
        staffId: staff.id,
        staffNameAr: staff.nameAr,
        staffNameEn: staff.nameEn,
        roleType: staff.roleType,
        jobTitleAr: staff.jobTitleAr,
        branchId: staff.branchId,
        branchName: staffBranch?.nameAr,
        month,
        basicSalary: baseSalary,
        allowances,
        commissions: calculatedCommissions,
        deductions,
        netSalary,
        paymentStatus: 'Pending',
        paymentMethod: 'الخزينة الرئيسية (نقداً)',
        notes: auditNote,
      };
    });

    const totalBasic = items.reduce((sum, i) => sum + i.basicSalary, 0);
    const totalAllowances = items.reduce((sum, i) => sum + i.allowances, 0);
    const totalCommissions = items.reduce((sum, i) => sum + i.commissions, 0);
    const totalDeductions = items.reduce((sum, i) => sum + i.deductions, 0);
    const totalNet = items.reduce((sum, i) => sum + i.netSalary, 0);

    const newRun: PayrollRun = {
      id: `payrun-${month}-${Date.now().toString().slice(-4)}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      branchId: branchId || undefined,
      month,
      totalBasic,
      totalAllowances,
      totalCommissions,
      totalDeductions,
      totalNet,
      status: 'Approved',
      createdAt: new Date().toISOString(),
      items,
    };

    setAllPayrollRuns((prev) => [newRun, ...prev]);

    recordAudit({
      branchId: branchId || activeBranch?.id,
      entityType: 'Staff' as any,
      entityId: newRun.id,
      entityName: `مسير رواتب ${month}`,
      actionType: 'CREATE',
      details: `توليد واعتماد مسير رواتب شهر ${month} لعدد ${items.length} من الكوادر بإجمالي صافي ${totalNet} ج.م`,
    });

    logUserActivity(
      'staff_management',
      'المرتبات والأجور',
      'Staff Payroll',
      'توليد مسير رواتب',
      'Generate Payroll',
      `تم توليد مسير رواتب شهر ${month} بإجمالي ${totalNet} ج.م`
    );

    return newRun;
  };

  const updatePayrollItem = (runId: string, itemId: string, data: Partial<StaffPayrollItem>) => {
    setAllPayrollRuns((prev) =>
      prev.map((run) => {
        if (run.id === runId) {
          const nextItems = run.items.map((item) => {
            if (item.id === itemId) {
              const updated = { ...item, ...data };
              updated.netSalary =
                Number(updated.basicSalary || 0) +
                Number(updated.allowances || 0) +
                Number(updated.commissions || 0) -
                Number(updated.deductions || 0);
              return updated;
            }
            return item;
          });

          return {
            ...run,
            items: nextItems,
            totalBasic: nextItems.reduce((s, i) => s + i.basicSalary, 0),
            totalAllowances: nextItems.reduce((s, i) => s + i.allowances, 0),
            totalCommissions: nextItems.reduce((s, i) => s + i.commissions, 0),
            totalDeductions: nextItems.reduce((s, i) => s + i.deductions, 0),
            totalNet: nextItems.reduce((s, i) => s + i.netSalary, 0),
          };
        }
        return run;
      })
    );
  };

  const payPayrollItem = (runId: string, itemId: string, paymentMethod: string, notes?: string) => {
    let paidItem: StaffPayrollItem | null = null;
    let targetMonth = '';

    setAllPayrollRuns((prev) =>
      prev.map((run) => {
        if (run.id === runId) {
          targetMonth = run.month;
          const nextItems = run.items.map((item) => {
            if (item.id === itemId) {
              paidItem = {
                ...item,
                paymentStatus: 'Paid' as const,
                paymentMethod,
                paidAt: new Date().toISOString(),
                paidBy: currentUser?.name || 'المحاسب المالي',
                notes: notes || item.notes,
              };
              return paidItem;
            }
            return item;
          });

          const allPaid = nextItems.every((i) => i.paymentStatus === 'Paid');

          return {
            ...run,
            items: nextItems,
            status: allPaid ? ('Paid' as const) : run.status,
          };
        }
        return run;
      })
    );

    if (paidItem) {
      const salaryExpAcc = accounts.find((a) => a.code === '5300') || accounts.find((a) => a.type === 'Expense');
      const pm = paymentMethods.find(
        (p) => p.nameAr === paymentMethod || p.id === paymentMethod || p.nameEn === paymentMethod
      );
      const cashAcc =
        (pm?.linkedAccountId ? accounts.find((a) => a.id === pm.linkedAccountId) : null) ||
        accounts.find((a) => a.code === '1111') ||
        accounts.find((a) => a.type === 'Asset');

      if (salaryExpAcc && cashAcc) {
        const jvNumber = `JV-PAY-${Date.now().toString().slice(-5)}`;
        const autoJv: JournalEntry = {
          id: `jv-pay-${Date.now()}`,
          tenantId: tenant?.id || INITIAL_TENANT.id,
          branchId: activeBranch?.id || '',
          entryNumber: jvNumber,
          date: new Date().toISOString().split('T')[0],
          description: `صرف مرتب ${targetMonth} - ${(paidItem as StaffPayrollItem).staffNameAr} (${(paidItem as StaffPayrollItem).jobTitleAr})`,
          isPosted: true,
          sourceDocument: `مسير رواتب ${targetMonth}`,
          createdAt: new Date().toISOString(),
          lines: [
            {
              id: `line-${Date.now()}-1`,
              accountId: salaryExpAcc.id,
              accountCode: salaryExpAcc.code,
              accountNameAr: salaryExpAcc.nameAr,
              accountNameEn: salaryExpAcc.nameEn,
              debit: (paidItem as StaffPayrollItem).netSalary,
              credit: 0,
              memo: `صافي راتب ${(paidItem as StaffPayrollItem).staffNameAr} لشهر ${targetMonth}`,
            },
            {
              id: `line-${Date.now()}-2`,
              accountId: cashAcc.id,
              accountCode: cashAcc.code,
              accountNameAr: cashAcc.nameAr,
              accountNameEn: cashAcc.nameEn,
              debit: 0,
              credit: (paidItem as StaffPayrollItem).netSalary,
              memo: `صرف عبر ${paymentMethod}`,
            },
          ],
        };
        setAllJournals((prev) => [autoJv, ...prev]);
      }

      recordAudit({
        branchId: activeBranch?.id,
        entityType: 'Staff' as any,
        entityId: (paidItem as StaffPayrollItem).staffId,
        entityName: (paidItem as StaffPayrollItem).staffNameAr,
        actionType: 'UPDATE',
        details: `صرف راتب شهر ${targetMonth} لـ (${(paidItem as StaffPayrollItem).staffNameAr}) بصافي ${(paidItem as StaffPayrollItem).netSalary} ج.م طريقة: ${paymentMethod}`,
      });
    }
  };

  const payEntirePayrollRun = (runId: string, paymentMethod: string) => {
    const targetRun = allPayrollRuns.find((r) => r.id === runId);
    if (!targetRun) return;

    const nowIso = new Date().toISOString();
    const currentUserName = currentUser?.name || 'المحاسب المالي';

    setAllPayrollRuns((prev) =>
      prev.map((run) => {
        if (run.id === runId) {
          const nextItems = run.items.map((item) => ({
            ...item,
            paymentStatus: 'Paid' as const,
            paymentMethod,
            paidAt: nowIso,
            paidBy: currentUserName,
          }));

          return {
            ...run,
            items: nextItems,
            status: 'Paid' as const,
          };
        }
        return run;
      })
    );

    const salaryExpAcc = accounts.find((a) => a.code === '5300') || accounts.find((a) => a.type === 'Expense');
    const pm = paymentMethods.find(
      (p) => p.nameAr === paymentMethod || p.id === paymentMethod || p.nameEn === paymentMethod
    );
    const cashAcc =
      (pm?.linkedAccountId ? accounts.find((a) => a.id === pm.linkedAccountId) : null) ||
      accounts.find((a) => a.code === '1111') ||
      accounts.find((a) => a.type === 'Asset');

    if (salaryExpAcc && cashAcc) {
      const jvNumber = `JV-PAYALL-${Date.now().toString().slice(-5)}`;
      const autoJv: JournalEntry = {
        id: `jv-payall-${Date.now()}`,
        tenantId: tenant?.id || INITIAL_TENANT.id,
        branchId: activeBranch?.id || '',
        entryNumber: jvNumber,
        date: new Date().toISOString().split('T')[0],
        description: `صرف واعتماد مسير رواتب شهر ${targetRun.month} بالكامل لعدد ${targetRun.items.length} موظف`,
        isPosted: true,
        sourceDocument: `مسير رواتب ${targetRun.month}`,
        createdAt: new Date().toISOString(),
        lines: [
          {
            id: `line-${Date.now()}-1`,
            accountId: salaryExpAcc.id,
            accountCode: salaryExpAcc.code,
            accountNameAr: salaryExpAcc.nameAr,
            accountNameEn: salaryExpAcc.nameEn,
            debit: targetRun.totalNet,
            credit: 0,
            memo: `إجمالي صافي رواتب شهر ${targetRun.month}`,
          },
          {
            id: `line-${Date.now()}-2`,
            accountId: cashAcc.id,
            accountCode: cashAcc.code,
            accountNameAr: cashAcc.nameAr,
            accountNameEn: cashAcc.nameEn,
            debit: 0,
            credit: targetRun.totalNet,
            memo: `صرف عبر ${paymentMethod}`,
          },
        ],
      };
      setAllJournals((prev) => [autoJv, ...prev]);
    }

    recordAudit({
      branchId: activeBranch?.id,
      entityType: 'Staff' as any,
      entityId: targetRun.id,
      entityName: `مسير رواتب ${targetRun.month}`,
      actionType: 'UPDATE',
      details: `صرف مسير رواتب شهر ${targetRun.month} بالكامل بإجمالي ${targetRun.totalNet} ج.م عبر ${paymentMethod}`,
    });
  };

  // 14. POS & Invoices
  const [activeShift, setActiveShift] = useState<PosShift>(() => {
    try {
      const saved = localStorage.getItem('erp_active_shift');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.status) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load active shift:', e);
    }
    return {
      id: 'shift-01',
      tenantId: INITIAL_TENANT.id,
      branchId: INITIAL_BRANCHES[0].id,
      cashierName: 'كاشير رئيسي',
      openingFloat: 1500,
      openedAt: new Date().toISOString(),
      status: 'Open',
      totalCashSales: 0,
      totalCardSales: 0,
      expectedCash: 1500,
    };
  });

  useEffect(() => {
    localStorage.setItem('erp_active_shift', JSON.stringify(activeShift));
  }, [activeShift]);

  const [allInvoices, setAllInvoices] = useState<SalesInvoice[]>(() => {
    try {
      const saved = localStorage.getItem('erp_invoices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load invoices:', e);
    }
    return INITIAL_INVOICES;
  });

  useEffect(() => {
    localStorage.setItem('erp_invoices', JSON.stringify(allInvoices));
  }, [allInvoices]);

  const invoices = allInvoices.filter((i) => i.tenantId === tenant?.id);

  const openShift = (openingFloat: number) => {
    const newShift: PosShift = {
      id: `shift-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      branchId: activeBranch?.id || '',
      cashierName: currentUser?.name || 'كاشير اليوم',
      openingFloat,
      openedAt: new Date().toISOString(),
      status: 'Open',
      totalCashSales: 0,
      totalCardSales: 0,
      expectedCash: openingFloat,
    };
    setActiveShift(newShift);
  };

  const closeShift = (actualCash: number, notes?: string) => {
    setActiveShift((prev) => ({
      ...prev,
      status: 'Closed',
      closedAt: new Date().toISOString(),
      actualCashCount: actualCash,
      difference: actualCash - prev.expectedCash,
      notes,
    }));
  };

  const processCheckout = (payload: CheckoutPayload): { success: boolean; invoice?: SalesInvoice; error?: string } => {
    if (!activeBranch) {
      return {
        success: false,
        error: t('لا يوجد فرع نشط لهذه الشركة.', 'No active branch for this company.'),
      };
    }
    if (!activeWarehouse) {
      return {
        success: false,
        error: t('لا يوجد مستودع نشط لهذه الشركة.', 'No active warehouse for this company.'),
      };
    }
    if (payload.items.length === 0) {
      return { success: false, error: t('سلة المشتريات فارغة!', 'Cart is empty!') };
    }

    // Check stock for physical items
    for (const item of payload.items) {
      if (!item.product.isService) {
        const available = getProductStock(item.product.id, activeWarehouse.id);
        if (available < item.quantity) {
          return {
            success: false,
            error: `${t('الرصيد غير كافٍ للصنف:', 'Insufficient stock for:')} ${
              language === 'ar' ? item.product.nameAr : item.product.nameEn
            } (${t('المتاح:', 'Available:')} ${available})`,
          };
        }
      }
    }

    const effectiveTaxRate = payload.taxRate !== undefined ? payload.taxRate : 0;
    const subtotal = payload.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const afterDiscount = Math.max(0, subtotal - payload.discountAmount);
    const taxAmount = Number((afterDiscount * effectiveTaxRate).toFixed(2));
    const netAmount = Number((afterDiscount + taxAmount).toFixed(2));

    const customer = parties.find((p) => p.id === payload.customerId) || parties[0] || {
      id: 'customer-cash',
      name: language === 'ar' ? 'عميل نقدي عام' : 'Walk-in Cash Customer',
    };
    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const invoiceItems: SalesInvoiceItem[] = payload.items.map((i) => {
      const lineSub = i.quantity * i.unitPrice;
      const lineTax = Number((lineSub * effectiveTaxRate).toFixed(2));
      return {
        productId: i.product.id,
        productNameAr: i.product.nameAr,
        productNameEn: i.product.nameEn,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        tax: lineTax,
        lineTotal: lineSub + lineTax,
      };
    });

    const isCollOnly = Boolean(payload.isCollectionOnly);

    const newInvoice: SalesInvoice = {
      id: `inv-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      branchId: activeBranch.id,
      warehouseId: activeWarehouse.id,
      invoiceNumber: invoiceNum,
      customerId: customer.id,
      customerName: customer.name,
      items: invoiceItems,
      subtotal,
      taxAmount,
      discountAmount: payload.discountAmount,
      netAmount,
      paymentMethod: payload.paymentMethod,
      paymentMethodId: payload.paymentMethodId,
      cashPaid: payload.paymentMethod.includes('Cash') || payload.paymentMethod.includes('نقداً') ? netAmount : payload.cashPaid || 0,
      cardPaid: payload.paymentMethod.includes('Card') || payload.paymentMethod.includes('فيزا') ? netAmount : payload.cardPaid || 0,
      splitPayments: payload.splitPayments,
      isCollectionOnly: isCollOnly,
      status: 'Posted',
      createdAt: nowIso,
      cashierName: activeShift?.cashierName || currentUser?.name || 'الكاشير',
      cashierId: currentUser?.id,
      createdById: currentUser?.id,
    };

    // Deduct stock only if not collection only
    if (!isCollOnly) {
      setStockLevels((prev) => {
        const next = [...prev];
        for (const item of payload.items) {
          if (!item.product.isService) {
            const idx = next.findIndex((s) => s.productId === item.product.id && s.warehouseId === activeWarehouse.id);
            if (idx >= 0) {
              next[idx] = {
                ...next[idx],
                quantityOnHand: Math.max(0, next[idx].quantityOnHand - item.quantity),
              };
            }
          }
        }
        return next;
      });
    }

    setAllInvoices((prev) => [newInvoice, ...prev]);

    // Auto-sync POS invoice into active reception shift run-sheet if open for this branch
    if (activeReceptionShift && activeReceptionShift.status === 'Open') {
      const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const dayName = dayNames[new Date().getDay()] || 'اليوم';
      const totalQty = payload.items.reduce((s, i) => s + i.quantity, 0);
      const posRunRow: ShiftRunRow = {
        id: `run-row-pos-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        dayName,
        customerId: customer.id,
        patientId: customer.id,
        systemCode: (customer as Party).systemCode || `CUST-${customer.id.slice(-4)}`,
        customerName: customer.name,
        patientName: customer.name,
        patientPhone: (customer as Party).phone,
        roomNumber: 'الاستقبال / POS',
        serviceName: isCollOnly
          ? `تحصيل دفعة/مقدم فقط (${payload.items.map((i) => i.product.nameAr).join(' + ') || 'دفعة نقدية'})`
          : payload.items.map((i) => i.product.nameAr).join(' + ') || 'فاتورة نقطة بيع',
        pulsesCount: 0,
        consumedQuantity: isCollOnly ? 0 : totalQty,
        unitPrice: isCollOnly ? 0 : (totalQty > 0 ? netAmount / totalQty : 0),
        totalRevenue: isCollOnly ? 0 : netAmount,
        paymentMethod: payload.paymentMethod || paymentMethods[0]?.nameAr || 'نقداً (كاش)',
        collectedAmount: netAmount,
        laserDevice: 'نقطة البيع (POS)',
        doctorName: 'إدارة العيادة / كاشير',
        description: isCollOnly
          ? `تحصيل دفعة/مقدم فقط - فاتورة ${invoiceNum}`
          : `فاتورة نقطة بيع رقم ${invoiceNum}`,
      };

      setAllReceptionShifts((prevShifts) =>
        prevShifts.map((s) => {
          if (s.id === activeReceptionShift.id) {
            const nextRows = [...s.runRows, posRunRow];
            const totalRev = nextRows.reduce((sum, r) => sum + r.totalRevenue, 0);
            const totalColl = nextRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);
            const nextBalancing = s.balancing.map((b) => {
              const methodRows = nextRows.filter(
                (r) => r.paymentMethod.includes(b.paymentMethodName) || b.paymentMethodName.includes(r.paymentMethod)
              );
              const methodColl = methodRows.reduce((sum, r) => sum + (r.collectedAmount || 0), 0);
              return {
                ...b,
                totalCollected: methodColl,
                closingBalance: b.openingBalance + methodColl - b.totalDisbursed + b.adjustments,
              };
            });
            return {
              ...s,
              runRows: nextRows,
              totalRevenue: totalRev,
              totalCollected: totalColl,
              balancing: nextBalancing,
              netShiftCash: totalColl - s.totalExpenses,
            };
          }
          return s;
        })
      );
    }

    logUserActivity(
      'pos',
      'نقطة البيع السريعة',
      'POS Terminal',
      'إصدار فاتورة بيع',
      'Create Invoice',
      `إصدار الفاتورة رقم ${invoiceNum} بقيمة ${netAmount} ج.م للعميل ${customer.name}${isCollOnly ? ' (تحصيل فقط)' : ''}`
    );

    // Auto-post journal entry for invoice into General Ledger using the linked payment method GL account
    const pm = paymentMethods.find(
      (p) => p.id === payload.paymentMethodId || p.nameAr === payload.paymentMethod || p.code === payload.paymentMethod
    );
    const debitAccount =
      (pm?.linkedAccountId ? accounts.find((a) => a.id === pm.linkedAccountId) : null) ||
      accounts.find((a) => a.code === (payload.paymentMethod?.includes('Card') || payload.paymentMethod?.includes('فيزا') ? '1112' : '1111')) ||
      accounts.find((a) => a.type === 'Asset');

    const hasServices = payload.items.some((i) => i.product.isService);
    const revenueAccount =
      accounts.find((a) => a.code === (hasServices ? '4200' : '4100')) ||
      accounts.find((a) => a.code === '4000') ||
      accounts.find((a) => a.type === 'Revenue');

    const vatAccount = accounts.find((a) => a.code === '2150') || accounts.find((a) => a.type === 'Liability');

    if (debitAccount && revenueAccount && netAmount > 0) {
      const jvNum = `JV-INV-${invoiceNum.slice(-6)}`;
      const jvLines = [];

      // Debit: Cash / Bank / Linked Account
      jvLines.push({
        id: `line-${Date.now()}-1`,
        accountId: debitAccount.id,
        accountCode: debitAccount.code,
        accountNameAr: debitAccount.nameAr,
        accountNameEn: debitAccount.nameEn,
        debit: netAmount,
        credit: 0,
        memo: `تحصيل فاتورة مبيعات ${invoiceNum} عبر ${pm?.nameAr || payload.paymentMethod}`,
      });

      // Credit: Revenue
      const revAmount = taxAmount > 0 ? afterDiscount : netAmount;
      jvLines.push({
        id: `line-${Date.now()}-2`,
        accountId: revenueAccount.id,
        accountCode: revenueAccount.code,
        accountNameAr: revenueAccount.nameAr,
        accountNameEn: revenueAccount.nameEn,
        debit: 0,
        credit: revAmount,
        memo: `إيراد مبيعات فاتورة ${invoiceNum}`,
      });

      // Credit: VAT if applicable
      if (taxAmount > 0 && vatAccount) {
        jvLines.push({
          id: `line-${Date.now()}-3`,
          accountId: vatAccount.id,
          accountCode: vatAccount.code,
          accountNameAr: vatAccount.nameAr,
          accountNameEn: vatAccount.nameEn,
          debit: 0,
          credit: taxAmount,
          memo: `ضريبة القيمة المضافة 14% - فاتورة ${invoiceNum}`,
        });
      }

      const invJv: JournalEntry = {
        id: `jv-inv-${Date.now()}`,
        tenantId: tenant?.id || INITIAL_TENANT.id,
        branchId: activeBranch.id,
        entryNumber: jvNum,
        date: nowIso.split('T')[0],
        description: `إثبات تحصيل مبيعات فاتورة ${invoiceNum} للعميل ${customer.name} عبر ${pm?.nameAr || payload.paymentMethod}`,
        isPosted: true,
        sourceDocument: `فاتورة مبيعات ${invoiceNum}`,
        createdAt: nowIso,
        lines: jvLines,
      };
      setAllJournals((prev) => [invJv, ...prev]);
    }

    return { success: true, invoice: newInvoice };
  };

  // Refund & Void Invoice
  const refundInvoice = (invoiceId: string, reason: string, restockItems: boolean = true): { success: boolean; error?: string } => {
    const inv = allInvoices.find((i) => i.id === invoiceId);
    if (!inv) return { success: false, error: 'الفاتورة غير موجودة' };
    if (inv.status === 'Refunded' || inv.status === 'Cancelled') {
      return { success: false, error: 'تم ارتجاع أو إلغاء هذه الفاتورة مسبقاً!' };
    }

    const refundIso = new Date().toISOString();
    setAllInvoices((prev) =>
      prev.map((i) => {
        if (i.id === invoiceId) {
          return {
            ...i,
            status: 'Refunded',
            isRefunded: true,
            refundReason: reason || 'طلب العميل / إلغاء',
            refundedAt: refundIso,
            refundedBy: currentUser?.name || 'المشرف',
            refundedAmount: i.netAmount,
          };
        }
        return i;
      })
    );

    if (restockItems && !inv.isCollectionOnly && inv.items && inv.items.length > 0) {
      setStockLevels((prev) => {
        const next = [...prev];
        for (const item of inv.items) {
          const idx = next.findIndex((s) => s.productId === item.productId && s.warehouseId === inv.warehouseId);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              quantityOnHand: next[idx].quantityOnHand + item.quantity,
            };
          }
        }
        return next;
      });
    }

    recordAudit({
      branchId: inv.branchId,
      entityType: 'Invoice',
      entityId: inv.id,
      entityName: `فاتورة ${inv.invoiceNumber}`,
      actionType: 'CANCEL',
      details: `تم ارتجاع وإلغاء الفاتورة ${inv.invoiceNumber} بمبلغ ${inv.netAmount} ج.م - السبب: ${reason}`,
    });

    logUserActivity(
      'pos',
      'نقطة البيع',
      'POS',
      'ارتجاع فاتورة',
      'Refund Invoice',
      `تم ارتجاع الفاتورة ${inv.invoiceNumber} بمبلغ ${inv.netAmount} ج.م`
    );

    return { success: true };
  };

  // Chart of Accounts CRUD
  const addAccount = (accData: Omit<Account, 'id' | 'tenantId'>): Account => {
    const newAcc: Account = {
      ...accData,
      id: `acc-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      balance: Number(accData.balance) || 0,
      nameEn: accData.nameEn || autoTranslateArabic(accData.nameAr),
    };
    setAllAccounts((prev) => [...prev, newAcc]);
    recordAudit({
      branchId: activeBranch?.id,
      entityType: 'Product' as any,
      entityId: newAcc.id,
      entityName: `${newAcc.code} - ${newAcc.nameAr}`,
      actionType: 'CREATE',
      details: `تم إضافة حساب جديد بالشجرة: ${newAcc.code} - ${newAcc.nameAr}`,
    });
    return newAcc;
  };

  const updateAccount = (accountId: string, data: Partial<Account>) => {
    setAllAccounts((prev) =>
      prev.map((a) => {
        if (a.id === accountId) {
          const updated = { ...a, ...data };
          if (data.nameAr && !data.nameEn) {
            updated.nameEn = autoTranslateArabic(data.nameAr);
          }
          return updated;
        }
        return a;
      })
    );
    recordAudit({
      branchId: activeBranch?.id,
      entityType: 'Product' as any,
      entityId: accountId,
      entityName: `حساب ${accountId}`,
      actionType: 'UPDATE',
      details: `تم تعديل بيانات الحساب: ${JSON.stringify(data)}`,
    });
  };

  const deleteAccount = (accountId: string): { success: boolean; error?: string } => {
    const acc = allAccounts.find((a) => a.id === accountId);
    if (!acc) return { success: false, error: 'الحساب غير موجود' };
    const hasChildren = allAccounts.some((a) => a.parentId === accountId);
    if (hasChildren) {
      return { success: false, error: 'لا يمكن حذف حساب رئيسي يحتوي على حسابات فرعية! يرجى حذف الحسابات الفرعية أولاً.' };
    }
    const hasJournals = allJournals.some((j) => j.lines.some((l) => l.accountId === accountId));
    if (hasJournals) {
      return { success: false, error: 'لا يمكن حذف هذا الحساب لوجود قيود وحركات محاسبية مرتبطة به!' };
    }
    setAllAccounts((prev) => prev.filter((a) => a.id !== accountId));
    recordAudit({
      branchId: activeBranch?.id,
      entityType: 'Product' as any,
      entityId: accountId,
      entityName: `${acc.code} - ${acc.nameAr}`,
      actionType: 'DELETE',
      details: `تم حذف الحساب: ${acc.code} - ${acc.nameAr}`,
    });
    return { success: true };
  };

  // Manual Journal Entry
  const createManualJournalEntry = (entryData: {
    description: string;
    lines: { accountId: string; debit: number; credit: number; memo?: string }[];
  }) => {
    const totalDebit = entryData.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = entryData.lines.reduce((s, l) => s + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        error: `${t('القيد غير متوازن! إجمالي المدين:', 'Entry not balanced! Total Debit:')} ${totalDebit} != ${t(
          'إجمالي الدائن:',
          'Total Credit:'
        )} ${totalCredit}`,
      };
    }

    const entryNum = `JV-M-${Date.now().toString().slice(-5)}`;
    const linesWithMeta = entryData.lines.map((l, idx) => {
      const acc = accounts.find((a) => a.id === l.accountId);
      return {
        id: `line-${Date.now()}-${idx}`,
        accountId: l.accountId,
        accountCode: acc?.code || '0000',
        accountNameAr: acc?.nameAr || '',
        accountNameEn: acc?.nameEn || '',
        debit: l.debit,
        credit: l.credit,
        memo: l.memo || '',
      };
    });

    const newEntry: JournalEntry = {
      id: `jv-manual-${Date.now()}`,
      tenantId: tenant?.id || INITIAL_TENANT.id,
      branchId: activeBranch?.id || '',
      entryNumber: entryNum,
      date: new Date().toISOString().split('T')[0],
      description: entryData.description,
      isPosted: true,
      lines: linesWithMeta,
      createdAt: new Date().toISOString(),
    };

    setAllJournals((prev) => [newEntry, ...prev]);
    return { success: true };
  };

  // Tenant Operations
  const addTenant = (tenantData: Omit<Tenant, 'id'>): Tenant => {
    const nameEn = tenantData.nameEn || autoTranslateArabic(tenantData.name);
    const newId = `tenant-eg-${(tenants.length + 1).toString().padStart(3, '0')}`;
    const newTenant: Tenant = {
      ...tenantData,
      nameEn,
      id: newId,
      isArchived: false,
      activeModules: tenantData.activeModules || INITIAL_TENANT.activeModules,
      customerNumberingMode: tenantData.customerNumberingMode || 'per_company',
      customerStartNumber: tenantData.customerStartNumber || 1001,
    };
    setTenants((prev) => [...prev, newTenant]);
    recordAudit({
      entityType: 'Tenant',
      entityId: newId,
      entityName: newTenant.name,
      actionType: 'CREATE',
      diffSummary: `إنشاء شركة ومؤسسة جديدة (${newTenant.name})`,
      newState: newTenant,
    });
    return newTenant;
  };

  const updateTenant = (tenantId: string, updatedData: Partial<Tenant>) => {
    const nameEn = updatedData.nameEn || (updatedData.name ? autoTranslateArabic(updatedData.name) : undefined);
    setTenants((prev) =>
      prev.map((t) => {
        if (t.id === tenantId) {
          const updated = { ...t, ...updatedData, nameEn: nameEn || t.nameEn };
          if (tenant?.id === tenantId) {
            setTenant(updated);
          }
          return updated;
        }
        return t;
      })
    );
  };

  const updateTenantModules = (tenantId: string, moduleIds: string[]) => {
    updateTenant(tenantId, { activeModules: moduleIds });
  };

  const switchTenant = (tenantId: string) => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;
    setTenant(target);
    const tenantBranches = branches.filter((b) => b.tenantId === target.id);
    if (tenantBranches.length > 0) {
      setActiveBranch(tenantBranches[0]);
      const branchWh = warehouses.find((w) => w.branchId === tenantBranches[0].id) || warehouses.find((w) => w.tenantId === target.id);
      setActiveWarehouse(branchWh || null);
    } else {
      setActiveBranch(null);
      setActiveWarehouse(null);
    }
  };

  const deleteTenant = (tenantId: string): { status: 'archived' | 'deleted'; message: string } => {
    const tItem = tenants.find((t) => t.id === tenantId);
    if (!tItem) return { status: 'deleted', message: 'الشركة غير موجودة' };

    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              isArchived: true,
              archivedAt: new Date().toISOString(),
              archivedBy: currentUser?.name || 'Admin',
              archiveReason: 'أرشفة المؤسسة بالكامل لحماية كافة سجلاتها المحاسبية والتشغيلية',
            }
          : t
      )
    );
    return {
      status: 'archived',
      message: 'تمت أرشفة الشركة لحماية القيود والفواتير التاريخية المرتبطة بها.',
    };
  };

  const restoreTenant = (tenantId: string): boolean => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              isArchived: false,
              archivedAt: undefined,
              archivedBy: undefined,
              archiveReason: undefined,
            }
          : t
      )
    );
    return true;
  };

  // Branch Operations
  const addBranch = (branchData: Omit<Branch, 'id' | 'tenantId'>) => {
    const nameEn = branchData.nameEn || autoTranslateArabic(branchData.name);
    const activeTenantId = tenant?.id || INITIAL_TENANT.id;
    const newBranchId = `branch-${Date.now().toString().slice(-4)}`;
    const newBranch: Branch = {
      ...branchData,
      nameEn,
      id: newBranchId,
      tenantId: activeTenantId,
      isArchived: false,
    };
    setAllBranches((prev) => [...prev, newBranch]);
    recordAudit({
      entityType: 'Branch',
      entityId: newBranchId,
      entityName: newBranch.name,
      actionType: 'CREATE',
      diffSummary: `إضافة فرع جديد (${newBranch.name})`,
      newState: newBranch,
    });
  };

  const updateBranch = (branchId: string, updatedData: Partial<Branch>) => {
    const nameEn = updatedData.nameEn || (updatedData.name ? autoTranslateArabic(updatedData.name) : undefined);
    setAllBranches((prev) =>
      prev.map((b) => {
        if (b.id === branchId) {
          const updated = { ...b, ...updatedData, nameEn: nameEn || b.nameEn };
          if (activeBranch?.id === branchId) {
            setActiveBranch(updated);
          }
          return updated;
        }
        return b;
      })
    );
  };

  const archiveBranch = (branchId: string, reason?: string) => {
    setAllBranches((prev) =>
      prev.map((b) =>
        b.id === branchId
          ? {
              ...b,
              isArchived: true,
              archivedAt: new Date().toISOString(),
              archivedBy: currentUser?.name || 'Admin',
              archiveReason: reason || 'أرشفة الفرع',
            }
          : b
      )
    );
  };

  const deleteBranch = (branchId: string): { status: 'archived' | 'deleted'; message: string } => {
    archiveBranch(branchId, 'تم نقل الفرع إلى الأرشيف لحماية الحركات المسجلة');
    return {
      status: 'archived',
      message: 'تم نقل الفرع للأرشيف الآمن.',
    };
  };

  const restoreBranch = (branchId: string): boolean => {
    setAllBranches((prev) =>
      prev.map((b) =>
        b.id === branchId
          ? {
              ...b,
              isArchived: false,
              archivedAt: undefined,
              archivedBy: undefined,
              archiveReason: undefined,
            }
          : b
      )
    );
    return true;
  };

  // Warehouse Operations
  const addWarehouse = (whData: Omit<Warehouse, 'id' | 'tenantId'>) => {
    const nameEn = whData.nameEn || autoTranslateArabic(whData.name);
    const activeTenantId = tenant?.id || INITIAL_TENANT.id;
    const newWhId = `wh-${Date.now().toString().slice(-4)}`;
    const newWarehouse: Warehouse = {
      ...whData,
      nameEn,
      id: newWhId,
      tenantId: activeTenantId,
      isArchived: false,
    };
    setAllWarehouses((prev) => [...prev, newWarehouse]);
  };

  const updateWarehouse = (warehouseId: string, updatedData: Partial<Warehouse>) => {
    const nameEn = updatedData.nameEn || (updatedData.name ? autoTranslateArabic(updatedData.name) : undefined);
    setAllWarehouses((prev) =>
      prev.map((w) => {
        if (w.id === warehouseId) {
          const updated = { ...w, ...updatedData, nameEn: nameEn || w.nameEn };
          if (activeWarehouse?.id === warehouseId) {
            setActiveWarehouse(updated);
          }
          return updated;
        }
        return w;
      })
    );
  };

  const archiveWarehouse = (warehouseId: string, reason?: string) => {
    setAllWarehouses((prev) =>
      prev.map((w) =>
        w.id === warehouseId
          ? {
              ...w,
              isArchived: true,
              archivedAt: new Date().toISOString(),
              archivedBy: currentUser?.name || 'Admin',
              archiveReason: reason || 'أرشفة المستودع',
            }
          : w
      )
    );
  };

  const deleteWarehouse = (warehouseId: string): { status: 'archived' | 'deleted'; message: string } => {
    archiveWarehouse(warehouseId, 'أرشفة لحماية المخزون التاريخي');
    return { status: 'archived', message: 'تم نقل المستودع للأرشيف.' };
  };

  const restoreWarehouse = (warehouseId: string): boolean => {
    setAllWarehouses((prev) =>
      prev.map((w) =>
        w.id === warehouseId
          ? {
              ...w,
              isArchived: false,
              archivedAt: undefined,
              archivedBy: undefined,
              archiveReason: undefined,
            }
          : w
      )
    );
    return true;
  };

  // User RBAC Permissions
  const canAccessTenant = (tenantId: string) => {
    if (currentUser?.isAdmin || currentUser?.role === 'SuperAdmin') return true;
    return currentUser?.allowedTenantIds?.includes('*') || currentUser?.allowedTenantIds?.includes(tenantId);
  };

  const canAccessBranch = (branchId: string) => {
    if (currentUser?.isAdmin || currentUser?.role === 'SuperAdmin') return true;
    return currentUser?.allowedBranchIds?.includes('*') || currentUser?.allowedBranchIds?.includes(branchId);
  };

  const canAccessWarehouse = (warehouseId: string) => {
    if (currentUser?.isAdmin || currentUser?.role === 'SuperAdmin') return true;
    return currentUser?.allowedWarehouseIds?.includes('*') || currentUser?.allowedWarehouseIds?.includes(warehouseId);
  };

  const canAccessView = (viewId: string) => {
    if (currentUser?.isAdmin || currentUser?.role === 'SuperAdmin') return true;
    if (viewId === 'suppliers' && currentUser?.allowedViews?.includes('parties')) return true;
    if (viewId === 'laser_devices' && (currentUser?.allowedViews?.includes('reception_ops') || currentUser?.allowedViews?.includes('inventory'))) return true;
    if ((viewId === 'products' || viewId === 'inventory_mgmt') && currentUser?.allowedViews?.includes('inventory')) return true;
    return currentUser?.allowedViews?.includes('*') || currentUser?.allowedViews?.includes(viewId);
  };

  const canPerformAction = (actionKey: string) => {
    if (currentUser?.isAdmin || currentUser?.role === 'SuperAdmin') return true;
    return currentUser?.allowedActions?.includes('*') || currentUser?.allowedActions?.includes(actionKey);
  };

  const login = (username: string, password?: string) => {
    const user = allUsers.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.isActive
    );
    if (user) {
      if (password && user.password && user.password !== password) {
        return { success: false, error: 'كلمة المرور غير صحيحة' };
      }
      setCurrentUser(user);
      setIsLoggedIn(true);
      logUserActivity('identity', 'الهوية وتسجيل الدخول', 'Authentication', 'تسجيل دخول', 'Login', `تم تسجيل دخول المستخدم: ${user.name}`);
      return { success: true };
    }
    return { success: false, error: 'اسم المستخدم غير موجود أو الحساب غير مفعل' };
  };

  const logout = () => {
    logUserActivity('identity', 'الهوية وتسجيل الدخول', 'Authentication', 'تسجيل خروج', 'Logout', `تم تسجيل خروج المستخدم: ${currentUser?.name || ''}`);
    setIsLoggedIn(false);
    localStorage.setItem('erp_is_logged_in', 'false');
  };

  const addUser = (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    const nameEn = userData.nameEn || autoTranslateArabic(userData.name);
    const newUser: AppUser = {
      ...userData,
      nameEn,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setAllUsers((prev) => [...prev, newUser]);
  };

  const updateUser = (userId: string, updatedData: Partial<AppUser>) => {
    const nameEn = updatedData.nameEn || (updatedData.name ? autoTranslateArabic(updatedData.name) : undefined);
    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updatedData, nameEn: nameEn || u.nameEn } : u))
    );
  };

  const deleteUser = (userId: string) => {
    setAllUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const toggleUserStatus = (userId: string) => {
    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
    );
  };

  // Modules
  const toggleModule = (moduleId: string) => {
    if (!tenant) return;
    const current = tenant.activeModules || [];
    const next = current.includes(moduleId)
      ? current.filter((m) => m !== moduleId)
      : [...current, moduleId];
    updateTenant(tenant.id, { activeModules: next });
  };

  const isModuleActive = (moduleId: string) => {
    if (!tenant) return true;
    return tenant.activeModules ? tenant.activeModules.includes(moduleId) : true;
  };

  // Neon PostgreSQL state
  const [neonDb, setNeonDb] = useState<NeonDbState>(() => {
    const saved = localStorage.getItem('erp_neon_cfg');
    return saved
      ? JSON.parse(saved)
      : {
          connected: false,
          connectionString: 'postgres://user:pass@ep-cool-snowflake-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require',
          isSyncing: false,
          tablesCount: 15,
          recordsCount: 84,
        };
  });

  const updateNeonConnectionString = (conn: string) => {
    const trimmed = conn.trim();
    const isValid = (trimmed.startsWith('postgres://') || trimmed.startsWith('postgresql://')) && trimmed.includes('neon.tech');
    setNeonDb((prev) => {
      const next = { ...prev, connectionString: trimmed, connected: isValid };
      localStorage.setItem('erp_neon_cfg', JSON.stringify(next));
      return next;
    });
  };

  const testNeonConnection = async (connOverride?: string): Promise<boolean> => {
    const targetConn = (connOverride !== undefined ? connOverride : neonDb.connectionString).trim();
    setNeonDb((prev) => ({ ...prev, isSyncing: true, error: undefined }));

    const isValidFormat =
      (targetConn.startsWith('postgres://') || targetConn.startsWith('postgresql://')) &&
      targetConn.includes('neon.tech');

    if (!isValidFormat) {
      setNeonDb((prev) => ({
        ...prev,
        connectionString: targetConn,
        isSyncing: false,
        connected: false,
        error: t(
          'رابط الاتصال يجب أن يكون رابط Neon صالحًا يبدأ بـ postgresql:// أو postgres://',
          'Connection string must be a valid Neon URL starting with postgresql:// or postgres://'
        ),
      }));
      return false;
    }

    const liveTest = await NeonService.testLiveConnection(targetConn);
    const connected = liveTest.success;

    setNeonDb((prev) => {
      const next = {
        ...prev,
        connectionString: targetConn,
        isSyncing: false,
        connected,
        lastSync: connected ? new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US') : prev.lastSync,
        recordsCount: products.length + accounts.length + invoices.length + parties.length,
        error: connected ? undefined : liveTest.message,
      };
      localStorage.setItem('erp_neon_cfg', JSON.stringify(next));
      return next;
    });
    return connected;
  };

  const syncAllToNeon = async (): Promise<{ success: boolean; message: string; count: number }> => {
    if (!neonDb.connectionString) {
      return { success: false, message: 'الرجاء إدخال رابط اتصال Neon أولاً', count: 0 };
    }
    setNeonDb((prev) => ({ ...prev, isSyncing: true }));
    const res = await NeonService.syncAllData(neonDb.connectionString, {
      tenant,
      branches,
      warehouses,
      products,
      stockLevels,
      accounts,
      invoices,
      patients: parties,
      parties,
      appointments,
      journalEntries,
    });
    setNeonDb((prev) => {
      const next = {
        ...prev,
        isSyncing: false,
        connected: res.success ? true : prev.connected,
        lastSync: res.success ? new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US') : prev.lastSync,
        recordsCount: res.success ? res.insertedCount : prev.recordsCount,
      };
      localStorage.setItem('erp_neon_cfg', JSON.stringify(next));
      return next;
    });
    return { success: res.success, message: res.message, count: res.insertedCount };
  };

  const fixNeonSchema = async (): Promise<{ success: boolean; message: string }> => {
    if (!neonDb.connectionString) {
      return { success: false, message: 'الرجاء إدخال رابط اتصال Neon أولاً' };
    }
    setNeonDb((prev) => ({ ...prev, isSyncing: true }));
    const res = await NeonService.fixSchemaTypes(neonDb.connectionString);
    setNeonDb((prev) => ({ ...prev, isSyncing: false }));
    return res;
  };

  const fetchRemoteCounts = async (): Promise<{ [key: string]: number }> => {
    if (!neonDb.connectionString) return {};
    return await NeonService.fetchTableCounts(neonDb.connectionString);
  };

  const getPostgresSchemaSql = (): string => {
    return `-- Universal PostgreSQL schema script --`;
  };

  const resetToDefaults = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <PlatformContext.Provider
      value={{
        language,
        setLanguage,
        t,
        formatMoney,
        tenant,
        setTenant,
        tenants,
        addTenant,
        updateTenant,
        updateTenantModules,
        switchTenant,
        deleteTenant,
        restoreTenant,
        branches,
        allBranches,
        activeBranch,
        setActiveBranch,
        addBranch,
        updateBranch,
        deleteBranch,
        archiveBranch,
        restoreBranch,
        warehouses,
        allWarehouses,
        activeWarehouse,
        setActiveWarehouse,
        addWarehouse,
        updateWarehouse,
        deleteWarehouse,
        archiveWarehouse,
        restoreWarehouse,
        isLoggedIn,
        login,
        logout,
        users,
        allUsers,
        addUser,
        updateUser,
        deleteUser,
        toggleUserStatus,
        currentUser,
        setCurrentUser,
        canAccessTenant,
        canAccessBranch,
        canAccessWarehouse,
        canAccessView,
        canPerformAction,
        allModules: INITIAL_MODULES,
        toggleModule,
        isModuleActive,
        categories,
        allCategories,
        addCategory,
        updateCategory,
        deleteCategory,
        products,
        allProducts,
        stockLevels,
        getProductStock,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,
        transferStock,
        pullLatestFromNeon,
        inventoryAudits,
        allInventoryAudits,
        createInventoryAudit,
        settleInventoryAudit,
        deleteInventoryAudit,
        paymentMethods,
        allPaymentMethods,
        addPaymentMethod,
        updatePaymentMethod,
        archivePaymentMethod,
        restorePaymentMethod,
        deletePaymentMethod,
        staffMembers,
        allStaffMembers,
        addStaffMember,
        updateStaffMember,
        toggleStaffMemberStatus,
        archiveStaffMember,
        restoreStaffMember,
        deleteStaffMember,
        payrollRuns,
        allPayrollRuns,
        generatePayrollRun,
        updatePayrollItem,
        payPayrollItem,
        payEntirePayrollRun,
        parties,
        allParties,
        patients: parties,
        allPatients: allParties,
        addParty,
        updateParty,
        archiveParty,
        restoreParty,
        deleteParty,
        importPartiesFromExcel,
        importCustomersFromExcel,
        getNextCustomerSystemCode,
        appointments,
        allAppointments,
        patientFollowUps,
        allPatientFollowUps,
        treatmentPlans,
        allTreatmentPlans,
        addAppointment,
        updateAppointment,
        cancelAppointment,
        markAppointmentAttendance,
        rescheduleAppointment,
        addPatientFollowUp,
        updatePatientFollowUp,
        deletePatientFollowUp,
        addTreatmentPlan,
        updateTreatmentPlan,
        progressTreatmentPlan,
        receptionShifts,
        allReceptionShifts,
        activeReceptionShift,
        openReceptionShift,
        closeReceptionShift,
        addShiftRunRow,
        updateShiftRunRow,
        removeShiftRunRow,
        addShiftExpense,
        removeShiftExpense,
        updateShiftBalancing,
        updateDeviceCounter,
        updateShiftNotes,
        addAccountantAdjustment,
        laserDevices,
        allLaserDevices,
        addLaserDevice,
        updateLaserDevice,
        deleteLaserDevice,
        resetLaserLampCounter,
        deviceMaintenanceRecords,
        allDeviceMaintenance,
        addDeviceMaintenance,
        deleteDeviceMaintenance,
        activeShift,
        invoices,
        allInvoices,
        processCheckout,
        refundInvoice,
        closeShift,
        openShift,
        accounts,
        journalEntries,
        addAccount,
        updateAccount,
        deleteAccount,
        createManualJournalEntry,
        auditRecords,
        allAuditRecords,
        userActivityLogs,
        allUserActivityLogs,
        activityLogs: userActivityLogs,
        recordAudit,
        logUserActivity,
        neonDb,
        updateNeonConnectionString,
        testNeonConnection,
        syncAllToNeon,
        fixNeonSchema,
        fetchRemoteCounts,
        getPostgresSchemaSql,
        resetToDefaults,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export const usePlatform = () => {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return context;
};
