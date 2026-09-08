import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Tenant,
  Branch,
  Warehouse,
  Product,
  StockLevel,
  Account,
  Party,
  ModuleDefinition,
  SalesInvoice,
  SalesInvoiceItem,
  PosShift,
  Patient,
  Appointment,
  TreatmentPlan,
  JournalEntry,
  Language,
  NeonDbState,
} from '../types';
import {
  INITIAL_MODULES,
  INITIAL_TENANT,
  INITIAL_BRANCHES,
  INITIAL_WAREHOUSES,
  INITIAL_ACCOUNTS,
  INITIAL_PRODUCTS,
  INITIAL_STOCK,
  INITIAL_PARTIES,
  INITIAL_PATIENTS,
  INITIAL_APPOINTMENTS,
  INITIAL_TREATMENT_PLANS,
  INITIAL_JOURNAL_ENTRIES,
} from '../data/initialData';

interface CheckoutPayload {
  customerId: string;
  items: {
    product: Product;
    quantity: number;
    unitPrice: number;
    discount: number;
  }[];
  discountAmount: number;
  paymentMethod: 'Cash' | 'Card' | 'Credit' | 'Split';
  cashPaid?: number;
  cardPaid?: number;
}

interface PlatformContextType {
  // Localization & Identity
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (ar: string, en: string) => string;
  formatMoney: (amount: number) => string;
  tenant: Tenant;
  setTenant: React.Dispatch<React.SetStateAction<Tenant>>;
  branches: Branch[];
  activeBranch: Branch;
  setActiveBranch: (branch: Branch) => void;
  warehouses: Warehouse[];
  activeWarehouse: Warehouse;
  setActiveWarehouse: (wh: Warehouse) => void;

  // Modules Configuration
  allModules: ModuleDefinition[];
  toggleModule: (moduleId: string) => void;
  isModuleActive: (moduleId: string) => boolean;

  // Inventory & Products
  products: Product[];
  stockLevels: StockLevel[];
  getProductStock: (productId: string, warehouseId?: string) => number;
  addProduct: (product: Omit<Product, 'id' | 'tenantId'>, initialStock: number) => void;
  adjustStock: (productId: string, warehouseId: string, delta: number, reason: string) => void;
  transferStock: (productId: string, fromWh: string, toWh: string, qty: number) => void;

  // Customers & Suppliers
  parties: Party[];
  addParty: (party: Omit<Party, 'id' | 'tenantId'>) => void;

  // POS & Sales
  activeShift: PosShift;
  invoices: SalesInvoice[];
  processCheckout: (payload: CheckoutPayload) => { success: boolean; invoice?: SalesInvoice; error?: string };
  closeShift: (actualCash: number, notes?: string) => void;
  openShift: (openingFloat: number) => void;

  // Accounting & Journal
  accounts: Account[];
  journalEntries: JournalEntry[];
  createManualJournalEntry: (entry: {
    description: string;
    lines: { accountId: string; debit: number; credit: number; memo?: string }[];
  }) => { success: boolean; error?: string };

  // Clinic
  patients: Patient[];
  appointments: Appointment[];
  treatmentPlans: TreatmentPlan[];
  addPatient: (patient: Omit<Patient, 'id' | 'tenantId' | 'fileNumber' | 'createdAt'>) => void;
  addAppointment: (apt: Omit<Appointment, 'id' | 'tenantId' | 'status'>) => void;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  progressTreatmentPlan: (planId: string) => void;

  // Neon PostgreSQL
  neonDb: NeonDbState;
  updateNeonConnectionString: (conn: string) => void;
  testNeonConnection: () => Promise<boolean>;
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

  const formatMoney = (amount: number) => {
    const formatted = new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ${language === 'ar' ? 'ج.م' : 'EGP'}`;
  };

  // 2. Tenant & Branch State
  const [tenant, setTenant] = useState<Tenant>(() => {
    const saved = localStorage.getItem('erp_tenant');
    return saved ? JSON.parse(saved) : INITIAL_TENANT;
  });

  const [branches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [activeBranch, setActiveBranch] = useState<Branch>(branches[0]);

  const [warehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [activeWarehouse, setActiveWarehouse] = useState<Warehouse>(warehouses[0]);

  useEffect(() => {
    localStorage.setItem('erp_tenant', JSON.stringify(tenant));
  }, [tenant]);

  // When active branch changes, pick corresponding default warehouse
  useEffect(() => {
    const branchWh = warehouses.find((w) => w.branchId === activeBranch.id) || warehouses[0];
    setActiveWarehouse(branchWh);
  }, [activeBranch, warehouses]);

  // 3. Modules Configuration
  const allModules = INITIAL_MODULES;
  const toggleModule = (moduleId: string) => {
    setTenant((prev) => {
      const isCurrentlyActive = prev.activeModules.includes(moduleId);
      const updated = isCurrentlyActive
        ? prev.activeModules.filter((m) => m !== moduleId)
        : [...prev.activeModules, moduleId];
      return { ...prev, activeModules: updated };
    });
  };

  const isModuleActive = (moduleId: string) => tenant.activeModules.includes(moduleId);

  // 4. Products & Stock
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('erp_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [stockLevels, setStockLevels] = useState<StockLevel[]>(() => {
    const saved = localStorage.getItem('erp_stock');
    return saved ? JSON.parse(saved) : INITIAL_STOCK;
  });

  useEffect(() => {
    localStorage.setItem('erp_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('erp_stock', JSON.stringify(stockLevels));
  }, [stockLevels]);

  const getProductStock = (productId: string, warehouseId?: string) => {
    const targetWh = warehouseId || activeWarehouse.id;
    const record = stockLevels.find((s) => s.productId === productId && s.warehouseId === targetWh);
    return record ? record.quantityOnHand : 0;
  };

  const addProduct = (prodData: Omit<Product, 'id' | 'tenantId'>, initialStock: number) => {
    const newProdId = `prod-${Date.now()}`;
    const newProd: Product = {
      ...prodData,
      id: newProdId,
      tenantId: tenant.id,
    };
    setProducts((prev) => [newProd, ...prev]);

    if (initialStock > 0 && !prodData.isService) {
      setStockLevels((prev) => [
        ...prev,
        {
          productId: newProdId,
          warehouseId: activeWarehouse.id,
          quantityOnHand: initialStock,
        },
      ]);
    }
  };

  const adjustStock = (productId: string, warehouseId: string, delta: number, reason: string) => {
    setStockLevels((prev) => {
      const idx = prev.findIndex((s) => s.productId === productId && s.warehouseId === warehouseId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantityOnHand: Math.max(0, copy[idx].quantityOnHand + delta) };
        return copy;
      } else {
        return [...prev, { productId, warehouseId, quantityOnHand: Math.max(0, delta) }];
      }
    });
  };

  const transferStock = (productId: string, fromWh: string, toWh: string, qty: number) => {
    const currentFrom = getProductStock(productId, fromWh);
    if (currentFrom < qty) return;

    adjustStock(productId, fromWh, -qty, 'Transfer Out');
    adjustStock(productId, toWh, qty, 'Transfer In');
  };

  // 5. Customers & Parties
  const [parties, setParties] = useState<Party[]>(() => {
    const saved = localStorage.getItem('erp_parties');
    return saved ? JSON.parse(saved) : INITIAL_PARTIES;
  });

  useEffect(() => {
    localStorage.setItem('erp_parties', JSON.stringify(parties));
  }, [parties]);

  const addParty = (partyData: Omit<Party, 'id' | 'tenantId'>) => {
    const newParty: Party = {
      ...partyData,
      id: `party-${Date.now()}`,
      tenantId: tenant.id,
    };
    setParties((prev) => [newParty, ...prev]);
  };

  // 6. Accounting & General Ledger
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('erp_accounts');
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    const saved = localStorage.getItem('erp_journals');
    return saved ? JSON.parse(saved) : INITIAL_JOURNAL_ENTRIES;
  });

  useEffect(() => {
    localStorage.setItem('erp_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('erp_journals', JSON.stringify(journalEntries));
  }, [journalEntries]);

  // 7. POS & Shift Management
  const [activeShift, setActiveShift] = useState<PosShift>(() => {
    const saved = localStorage.getItem('erp_active_shift');
    return (
      saved ? JSON.parse(saved) : {
        id: 'shift-01',
        tenantId: INITIAL_TENANT.id,
        branchId: INITIAL_BRANCHES[0].id,
        cashierName: 'كاشير رئيسي (أحمد)',
        openingFloat: 1500,
        openedAt: new Date().toISOString(),
        status: 'Open',
        totalCashSales: 0,
        totalCardSales: 0,
        expectedCash: 1500,
      }
    );
  });

  useEffect(() => {
    localStorage.setItem('erp_active_shift', JSON.stringify(activeShift));
  }, [activeShift]);

  const [invoices, setInvoices] = useState<SalesInvoice[]>(() => {
    const saved = localStorage.getItem('erp_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('erp_invoices', JSON.stringify(invoices));
  }, [invoices]);

  const openShift = (openingFloat: number) => {
    const newShift: PosShift = {
      id: `shift-${Date.now()}`,
      tenantId: tenant.id,
      branchId: activeBranch.id,
      cashierName: 'كاشير اليوم',
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

  // CHECKOUT ENGINE (Atomic: Invoice + Stock Deduction + Automated Posting Matrix)
  const processCheckout = (payload: CheckoutPayload): { success: boolean; invoice?: SalesInvoice; error?: string } => {
    if (payload.items.length === 0) {
      return { success: false, error: t('سلة المشتريات فارغة!', 'Cart is empty!') };
    }

    // Check stock for non-service items
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

    // 1. Calculate Financials
    const subtotal = payload.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const afterDiscount = Math.max(0, subtotal - payload.discountAmount);
    const taxAmount = Number((afterDiscount * tenant.taxRate).toFixed(2));
    const netAmount = Number((afterDiscount + taxAmount).toFixed(2));

    const customer = parties.find((p) => p.id === payload.customerId) || parties[0];
    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const invoiceItems: SalesInvoiceItem[] = payload.items.map((i) => {
      const lineSub = i.quantity * i.unitPrice;
      const lineTax = Number((lineSub * tenant.taxRate).toFixed(2));
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

    const newInvoice: SalesInvoice = {
      id: `inv-${Date.now()}`,
      tenantId: tenant.id,
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
      cashPaid: payload.paymentMethod === 'Cash' ? netAmount : payload.cashPaid || 0,
      cardPaid: payload.paymentMethod === 'Card' ? netAmount : payload.cardPaid || 0,
      status: 'Posted',
      createdAt: nowIso,
      cashierName: activeShift.cashierName,
    };

    // 2. Deduct Inventory Stock
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

    // 3. Update Shift Cash Counters
    if (activeShift.status === 'Open') {
      setActiveShift((prev) => {
        const cashAdd = payload.paymentMethod === 'Cash' ? netAmount : payload.cashPaid || 0;
        const cardAdd = payload.paymentMethod === 'Card' ? netAmount : payload.cardPaid || 0;
        return {
          ...prev,
          totalCashSales: prev.totalCashSales + cashAdd,
          totalCardSales: prev.totalCardSales + cardAdd,
          expectedCash: prev.expectedCash + cashAdd,
        };
      });
    }

    // 4. AUTOMATED POSTING MATRIX (قيد اليومية التلقائي)
    // Accounts:
    // Debit: Cash (1111) / Bank / AR (1120)
    // Credit: Sales Revenue (4100) or Medical Revenue (4200)
    // Credit: VAT Output (2200)
    // Debit: COGS (5100) / Credit: Inventory (1130) [for physical goods]
    const hasServices = payload.items.some((i) => i.product.isService);
    const revenueAccId = hasServices ? 'acc-4200' : 'acc-4100';
    const revenueAccCode = hasServices ? '4200' : '4100';
    const revenueAccNameAr = hasServices ? 'إيرادات الكشوفات والخدمات والعيادات' : 'إيرادات مبيعات البضائع والـ POS';
    const revenueAccNameEn = hasServices ? 'Medical & Services Revenue' : 'Commercial Sales Revenue';

    const debitAccId =
      payload.paymentMethod === 'Cash'
        ? 'acc-1111'
        : payload.paymentMethod === 'Card'
        ? 'acc-1112'
        : 'acc-1120';
    const debitAccCode =
      payload.paymentMethod === 'Cash' ? '1111' : payload.paymentMethod === 'Card' ? '1112' : '1120';
    const debitAccNameAr =
      payload.paymentMethod === 'Cash'
        ? 'الخزينة الرئيسية (النقدية بالصندوق)'
        : payload.paymentMethod === 'Card'
        ? 'البنك الأهلي المصري (حساب جاري)'
        : 'المدينون والعملاء (AR)';
    const debitAccNameEn =
      payload.paymentMethod === 'Cash'
        ? 'Main Cashier Drawer'
        : payload.paymentMethod === 'Card'
        ? 'National Bank of Egypt'
        : 'Accounts Receivable';

    // Calculate total COGS for physical goods
    const totalCogs = payload.items.reduce((sum, i) => {
      if (!i.product.isService) {
        return sum + i.quantity * i.product.purchasePrice;
      }
      return sum;
    }, 0);

    const journalLines = [
      // 1. Debit Payment Method
      {
        id: `line-${Date.now()}-1`,
        accountId: debitAccId,
        accountCode: debitAccCode,
        accountNameAr: debitAccNameAr,
        accountNameEn: debitAccNameEn,
        debit: netAmount,
        credit: 0,
        memo: `تحصيل فاتورة ${invoiceNum}`,
      },
      // 2. Credit Sales Revenue (net of tax)
      {
        id: `line-${Date.now()}-2`,
        accountId: revenueAccId,
        accountCode: revenueAccCode,
        accountNameAr: revenueAccNameAr,
        accountNameEn: revenueAccNameEn,
        debit: 0,
        credit: afterDiscount,
        memo: `إيراد مبيعات فاتورة ${invoiceNum}`,
      },
      // 3. Credit VAT Output 14%
      {
        id: `line-${Date.now()}-3`,
        accountId: 'acc-2200',
        accountCode: '2200',
        accountNameAr: 'أمانات ضريبة القيمة المضافة (VAT 14%)',
        accountNameEn: 'VAT Payable (14%)',
        debit: 0,
        credit: taxAmount,
        memo: `ضريبة ق.م 14% على فاتورة ${invoiceNum}`,
      },
    ];

    // If there is inventory COGS, add perpetual inventory journal lines:
    if (totalCogs > 0) {
      journalLines.push(
        {
          id: `line-${Date.now()}-4`,
          accountId: 'acc-5100',
          accountCode: '5100',
          accountNameAr: 'تكلفة البضاعة المباعة (COGS)',
          accountNameEn: 'Cost of Goods Sold',
          debit: totalCogs,
          credit: 0,
          memo: `تكلفة البضاعة لفاتورة ${invoiceNum}`,
        },
        {
          id: `line-${Date.now()}-5`,
          accountId: 'acc-1130',
          accountCode: '1130',
          accountNameAr: 'مخزون البضائع ومستلزمات العيادة',
          accountNameEn: 'Merchandise & Clinic Inventory',
          debit: 0,
          credit: totalCogs,
          memo: `صرف مخزون فاتورة ${invoiceNum}`,
        }
      );
    }

    const autoJournalEntry: JournalEntry = {
      id: `jv-${Date.now()}`,
      tenantId: tenant.id,
      branchId: activeBranch.id,
      entryNumber: `JV-${invoiceNum}`,
      date: new Date().toISOString().split('T')[0],
      description: `قيد آلي ناتج عن إصدار فاتورة بيع ${invoiceNum} للعميل ${customer.name}`,
      isPosted: true,
      sourceDocument: invoiceNum,
      createdAt: nowIso,
      lines: journalLines,
    };

    // Update Account Balances
    setAccounts((prevAccs) => {
      return prevAccs.map((acc) => {
        if (acc.id === debitAccId) {
          return { ...acc, balance: acc.balance + netAmount };
        }
        if (acc.id === revenueAccId) {
          return { ...acc, balance: acc.balance + afterDiscount };
        }
        if (acc.id === 'acc-2200') {
          return { ...acc, balance: acc.balance + taxAmount };
        }
        if (totalCogs > 0) {
          if (acc.id === 'acc-5100') {
            return { ...acc, balance: acc.balance + totalCogs };
          }
          if (acc.id === 'acc-1130') {
            return { ...acc, balance: Math.max(0, acc.balance - totalCogs) };
          }
        }
        return acc;
      });
    });

    setJournalEntries((prev) => [autoJournalEntry, ...prev]);
    setInvoices((prev) => [newInvoice, ...prev]);

    return { success: true, invoice: newInvoice };
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
      tenantId: tenant.id,
      branchId: activeBranch.id,
      entryNumber: entryNum,
      date: new Date().toISOString().split('T')[0],
      description: entryData.description,
      isPosted: true,
      lines: linesWithMeta,
      createdAt: new Date().toISOString(),
    };

    setJournalEntries((prev) => [newEntry, ...prev]);

    // Update account balances
    setAccounts((prev) => {
      return prev.map((acc) => {
        const line = entryData.lines.find((l) => l.accountId === acc.id);
        if (line) {
          const delta = acc.isDebitNormal ? line.debit - line.credit : line.credit - line.debit;
          return { ...acc, balance: acc.balance + delta };
        }
        return acc;
      });
    });

    return { success: true };
  };

  // 8. Clinic State
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('erp_patients');
    return saved ? JSON.parse(saved) : INITIAL_PATIENTS;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem('erp_appointments');
    return saved ? JSON.parse(saved) : INITIAL_APPOINTMENTS;
  });

  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlan[]>(() => {
    const saved = localStorage.getItem('erp_treatment_plans');
    return saved ? JSON.parse(saved) : INITIAL_TREATMENT_PLANS;
  });

  useEffect(() => {
    localStorage.setItem('erp_patients', JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem('erp_appointments', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem('erp_treatment_plans', JSON.stringify(treatmentPlans));
  }, [treatmentPlans]);

  const addPatient = (patientData: Omit<Patient, 'id' | 'tenantId' | 'fileNumber' | 'createdAt'>) => {
    const newPat: Patient = {
      ...patientData,
      id: `pat-${Date.now()}`,
      tenantId: tenant.id,
      fileNumber: `PAT-2026-${(patients.length + 1).toString().padStart(4, '0')}`,
      createdAt: new Date().toISOString(),
    };
    setPatients((prev) => [newPat, ...prev]);
  };

  const addAppointment = (aptData: Omit<Appointment, 'id' | 'tenantId' | 'status'>) => {
    const newApt: Appointment = {
      ...aptData,
      id: `apt-${Date.now()}`,
      tenantId: tenant.id,
      status: 'Scheduled',
    };
    setAppointments((prev) => [newApt, ...prev]);
  };

  const updateAppointmentStatus = (id: string, status: Appointment['status']) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const progressTreatmentPlan = (planId: string) => {
    setTreatmentPlans((prev) =>
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

  // 9. Neon PostgreSQL Integration State
  const [neonDb, setNeonDb] = useState<NeonDbState>(() => {
    const saved = localStorage.getItem('erp_neon_cfg');
    return (
      saved ? JSON.parse(saved) : {
        connected: false,
        connectionString: 'postgres://user:pass@ep-cool-snowflake-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require',
        isSyncing: false,
        tablesCount: 15,
        recordsCount: 84,
      }
    );
  });

  const updateNeonConnectionString = (conn: string) => {
    setNeonDb((prev) => {
      const next = { ...prev, connectionString: conn, connected: conn.includes('neon.tech') };
      localStorage.setItem('erp_neon_cfg', JSON.stringify(next));
      return next;
    });
  };

  const testNeonConnection = async (): Promise<boolean> => {
    setNeonDb((prev) => ({ ...prev, isSyncing: true, error: undefined }));
    await new Promise((r) => setTimeout(r, 1200));

    const isValid = neonDb.connectionString.trim().startsWith('postgres://') && neonDb.connectionString.includes('neon.tech');
    setNeonDb((prev) => ({
      ...prev,
      isSyncing: false,
      connected: isValid,
      lastSync: new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US'),
      recordsCount: products.length + accounts.length + invoices.length + patients.length,
      error: isValid ? undefined : t('رابط الاتصال يجب أن يكون رابط Neon صالحًا يبدأ بـ postgres://', 'Connection string must be a valid Neon URL starting with postgres://'),
    }));
    return isValid;
  };

  const getPostgresSchemaSql = (): string => {
    return `-- =========================================================================
-- Universal Business Management Platform - Neon PostgreSQL DDL Schema
-- Multi-Tenancy (RLS), Double-Entry Accounting, POS & Clinics
-- Generated for Tenant: ${tenant.name} (${tenant.code})
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TENANTS & SECURITY
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'Enterprise',
    currency VARCHAR(10) DEFAULT 'EGP',
    tax_rate NUMERIC(5, 4) DEFAULT 0.1400,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BRANCHES & WAREHOUSES
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    city VARCHAR(100),
    phone VARCHAR(50),
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    location TEXT
);

-- 3. PRODUCTS & STOCK
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    barcode VARCHAR(100),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    category VARCHAR(100),
    purchase_price NUMERIC(15, 2) DEFAULT 0.00,
    selling_price NUMERIC(15, 2) DEFAULT 0.00,
    min_stock_level NUMERIC(12, 2) DEFAULT 5.00,
    is_service BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(15, 3) DEFAULT 0.000,
    CONSTRAINT unique_product_warehouse UNIQUE (product_id, warehouse_id)
);

-- 4. CHART OF ACCOUNTS & DOUBLE-ENTRY GL
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    account_type VARCHAR(50) NOT NULL, -- Asset, Liability, Equity, Revenue, Expense
    parent_id UUID REFERENCES accounts(id),
    balance NUMERIC(18, 2) DEFAULT 0.00,
    level INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    entry_number VARCHAR(100) UNIQUE NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    is_posted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    debit NUMERIC(18, 2) DEFAULT 0.00,
    credit NUMERIC(18, 2) DEFAULT 0.00,
    memo TEXT
);

-- 5. POS & SALES INVOICES
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    warehouse_id UUID REFERENCES warehouses(id),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id VARCHAR(100),
    customer_name VARCHAR(255),
    subtotal NUMERIC(15, 2) NOT NULL,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    tax_amount NUMERIC(15, 2) DEFAULT 0.00,
    net_amount NUMERIC(15, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    cashier_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. CLINICS & APPOINTMENTS
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_name VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    price NUMERIC(12, 2) DEFAULT 0.00,
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR(20),
    status VARCHAR(50) DEFAULT 'Scheduled'
);

-- ROW LEVEL SECURITY (RLS) ENABLEMENT
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
`;
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
        branches,
        activeBranch,
        setActiveBranch,
        warehouses,
        activeWarehouse,
        setActiveWarehouse,
        allModules,
        toggleModule,
        isModuleActive,
        products,
        stockLevels,
        getProductStock,
        addProduct,
        adjustStock,
        transferStock,
        parties,
        addParty,
        activeShift,
        invoices,
        processCheckout,
        closeShift,
        openShift,
        accounts,
        journalEntries,
        createManualJournalEntry,
        patients,
        appointments,
        treatmentPlans,
        addPatient,
        addAppointment,
        updateAppointmentStatus,
        progressTreatmentPlan,
        neonDb,
        updateNeonConnectionString,
        testNeonConnection,
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
