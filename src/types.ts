export type Language = 'ar' | 'en';

export interface CleanCompanySetupParams {
  name: string;
  nameEn?: string;
  code: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  activityType: 'retail_pos' | 'clinic_medical' | 'trading_services' | 'general';
  mainBranchName?: string;
  mainWarehouseName?: string;
  city?: string;
  phone?: string;
  wipeDemoData?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  nameEn: string;
  code: string;
  plan: 'Starter' | 'Professional' | 'Enterprise';
  currency: string;
  currencySymbol: string;
  taxRate: number; // e.g. 0.14 for Egypt VAT
  activeModules: string[];
  customerNumberingMode?: 'per_company' | 'per_branch'; // Serial mode: company-wide vs per-branch
  customerStartNumber?: number; // Starting serial number (e.g. 1000)
  supplierNumberingMode?: 'per_company' | 'per_branch';
  supplierStartNumber?: number;
  defaultPosCollectionOnly?: boolean; // الوضع الافتراضي لخيار تحصيل فقط في نقطة البيع
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  nameEn: string;
  code: string;
  city: string;
  phone: string;
  isMain: boolean;
  isHeadquarters?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  nameEn: string;
  code: string;
  location: string;
  isDefault?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}

export interface ItemCategory {
  id: string;
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  type: 'service' | 'product' | 'both';
  description?: string;
  color?: string;
  icon?: string;
}

export interface ProductRecipeItem {
  id: string;
  stockItemId: string; // الصنف المخزني
  stockItemNameAr: string;
  salesProductId: string; // الصنف البيعي (الخدمة أو المنتج البيعي)
  salesProductNameAr: string;
  consumptionType: 'per_unit' | 'revenue_percent' | 'fixed_monthly';
  quantityRequired: number; // الكمية المستهلكة من الصنف المخزني لكل وحدة بيع (مثلاً 0.2 أمبولة أو 50 مل)
  unit: string; // وحدة الصنف المخزني
  unitCost: number; // تكلفة وحدة الصنف المخزني
  costContribution: number; // المساهمة في تكلفة البيع = quantityRequired * unitCost
  notes?: string;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  category: string;
  categoryId?: string;
  purchasePrice: number;
  sellingPrice: number;
  minSellingPrice?: number; // الحد الأدنى لسعر البيع
  taxRate?: number; // نسبة الضريبة المضافة
  minStockLevel: number;
  unit: string; // وحدة التعريف اليدوية (قطعة، علبة، طقم، أنبوبة، شريط، الخ)
  isService?: boolean;
  isPackage?: boolean; // هل هو باقة / عرض جلسات متعددة
  totalSessions?: number; // عدد الجلسات المضمنة في الباقة
  validityDays?: number; // صلاحية الباقة بالأيام (مثلاً 90 أو 180 يوم)
  linkedServiceId?: string; // معرف الخدمة/الجلسة الطبية المندرجة في الباقة
  linkedServiceNameAr?: string; // اسم الخدمة الطبية المندرجة
  itemType?: 'product' | 'service' | 'stock_raw' | 'consumable' | 'sales_product' | 'sales_service' | 'sales_package' | 'medical_supply'; // تمييز الصنف المخزني أو الصنف البيعي أو الباقة
  isSalesItem?: boolean; // هل هو صنف بيعي (للعملاء)
  isStockItem?: boolean; // هل هو صنف مخزني (خامات ومستهلكات)
  defaultCollectionOnly?: boolean; // الوضع الافتراضي عند إضافة هذا المنتج/الخدمة في نقطة البيع: تحصيل فقط
  isActive?: boolean;

  // الربط المحاسبي بشجرة الحسابات (Sales, Expense, and Inventory Accounts)
  salesAccountId?: string; // حساب المبيعات / الإيرادات بالدليل المحاسبي (للمنتجات والخدمات البيعية)
  salesAccountNameAr?: string;
  expenseAccountId?: string; // حساب المصروفات / الاستهلاك بالدليل المحاسبي (للأصناف المخزنية والخامات)
  expenseAccountNameAr?: string;
  inventoryAccountId?: string; // حساب المخزون / الأصول المتداولة
  inventoryAccountNameAr?: string;

  // ربط الصنف المخزني بالمنتجات البيعية ومقاييس الاستهلاك وتكلفة البيع
  linkedSalesProductIds?: string[]; // ربطه بالمنتجات أو الخدمات البيعية
  consumptionBasis?: 'revenue_ratio' | 'units_sold' | 'clients_served' | 'fixed_monthly'; // أساس الربط
  consumptionRate?: number; // معدل الاستهلاك لكل وحدة مبيعة أو 1000 ج.م إيراد
  monthlyQuota?: number; // الحصة الاستهلاكية الشهرية المحددة
  etaCode?: string; // كود الفاتورة الإلكترونية الموحد (EGS أو GS1) المعتمد من مصلحة الضرائب المصرية
  etaCodeType?: 'EGS' | 'GS1';
  egsCode?: string;
  gs1Code?: string;
  itemCodingType?: 'EGS' | 'GS1';
  branchId?: string;
  branchIds?: string[];
  notes?: string;
}

export interface StockLevel {
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  reservedQty?: number;
}

// تسوية الجرد وتحميل الفروق على المرتبات والموظفين
export interface InventoryStaffLiability {
  staffId: string;
  staffNameAr: string;
  percentage: number; // النسبة المئوية لتحمل العجز (مثلاً 50%)
  amount: number; // قيمة المبلغ المحمل على الموظف
  deductionMonth: string; // شهر مسير الرواتب (مثلاً "2026-09")
  appliedToPayroll?: boolean; // هل تم ترحيلها إلى مسير الرواتب؟
}

export interface InventoryAuditItem {
  productId: string;
  productNameAr: string;
  productSku: string;
  unit: string;
  bookQty: number; // الرصيد الدفتري المسجل بالنظام
  actualQty: number; // الرصيد الفعلي بعد العد
  differenceQty: number; // الفرق (فعلي - دفتري)
  unitCost: number; // تكلفة الوحدة
  differenceValue: number; // قيمة الفرق المالية (differenceQty * unitCost)
  notes?: string;
}

export interface InventoryAudit {
  id: string;
  tenantId: string;
  branchId: string;
  warehouseId: string;
  warehouseName: string;
  auditNumber: string; // كود الجرد مثلا INV-COUNT-001
  auditDate: string;
  status: 'Draft' | 'Settled' | 'Cancelled';
  totalBookQty: number;
  totalActualQty: number;
  totalShortageQty: number; // إجمالي العجز بالكمية
  totalSurplusQty: number; // إجمالي الزيادة بالكمية
  totalShortageValue: number; // إجمالي قيمة العجز المالية
  totalSurplusValue: number; // إجمالي قيمة الزيادة المالية
  netDifferenceValue: number; // صافي الفرق
  notes?: string;
  items: InventoryAuditItem[];

  // آلية التسوية والربط بالمرتبات
  settlementType?: 'write_off' | 'staff_liability' | 'mixed' | 'inventory_adjustment_only';
  staffLiabilities?: InventoryStaffLiability[];
  settledAt?: string;
  settledBy?: string;
  settlementNotes?: string;
  journalEntryId?: string;
  createdAt: string;
  createdBy?: string;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  branchId?: string;
  branchNameAr?: string;
  productId: string;
  productNameAr?: string;
  warehouseId: string;
  warehouseNameAr?: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'CONSUMPTION';
  quantity: number;
  unitCost: number;
  referenceNo: string;
  createdAt: string;
  note?: string;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface Account {
  id: string;
  tenantId: string;
  branchId?: string; // معرف الفرع التابع له الحساب (فارغ أو 'all' يعني حساب عام للشركة ككل)
  branchNameAr?: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: AccountType;
  parentId?: string;
  balance: number;
  isDebitNormal: boolean;
  level: number;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  accountNameEn: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  branchId?: string;
  entryNumber: string;
  date: string;
  description: string;
  isPosted: boolean;
  sourceDocument?: string;
  lines: JournalLine[];
  createdAt: string;
}

// Payment Methods (طرق السداد)
export interface PaymentMethod {
  id: string;
  tenantId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: 'Cash' | 'Card' | 'Transfer' | 'Wallet' | 'Credit' | 'Custom';
  icon?: string;
  isDefault?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  orderIndex: number;
  displayOnReceipt: boolean;
  instructionsAr?: string;
  instructionsEn?: string;
  feePercentage?: number;
  branchId?: string;
  linkedAccountId?: string;
}

// Client Offers / Packages (عروض وباقات العميل)
export interface ClientOffer {
  id: string;
  packageProductId?: string; // معرّف الصنف البيعي للباقة
  offerNameAr: string;
  offerNameEn: string;
  totalQuantity: number; // إجمالي الجلسات / البلسات
  consumedQuantity: number; // المستهلك
  remainingQuantity: number; // المتبقي
  unitPrice?: number;
  totalPrice: number;
  purchaseDate: string;
  expiryDate?: string;
  status: 'Active' | 'Consumed' | 'Expired';
  serviceType?: string;
  notes?: string;
}

// Unified Parties (Customers/Patients & Suppliers)
export interface Party {
  id: string;
  tenantId: string;
  branchId?: string; // التابع له
  branchIds?: string[]; // الفروع المصرح بها
  paperCode?: string; // كود ورقي
  systemCode?: string; // كود السيستم
  fileNumber?: string; // رقم الملف
  fullName?: string;
  name: string; // الاسم بالعربي
  nameEn: string; // الاسم بالإنجليزي
  type: 'Customer' | 'Supplier' | 'Both';
  phone: string;
  altPhone?: string;
  email?: string;
  taxNumber?: string;
  nationalId?: string;
  address?: string;
  leadSource?: string; // عرفنا منين (فيسبوك، انستجرام، ترشيح صديق، الخ)
  balance: number; // positive = debit, negative = credit
  creditLimit?: number;

  // Medical / Patient specifics (العملاء هما المرضى)
  dateOfBirth?: string;
  gender?: 'Male' | 'Female';
  bloodType?: string;
  chronicDiseases?: string[];
  allergies?: string[];
  medicalNotes?: string;
  offers?: ClientOffer[]; // العروض المشتراة
  createdAt?: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}

// Legacy Patient interface for backward compatibility
export type Patient = Party;

// Staff, Doctors & Technicians (الموظفين والدكاترة والتكنيشن)
export type StaffRoleType = 'Doctor' | 'Technician' | 'Receptionist' | 'Nurse' | 'Accountant' | 'Manager' | 'Staff' | 'Employee';

export interface StaffHiringDoc {
  documentType: string;
  documentNameAr: string;
  documentNameEn: string;
  isSubmitted: boolean;
  notes?: string;
}

export interface StaffMember {
  id: string;
  tenantId: string;
  branchId?: string; // الفرع المربوط به
  nameAr: string;
  nameEn: string;
  staffType: StaffRoleType;
  roleType?: StaffRoleType;
  specialtyAr?: string; // التخصص (جلدية، ليزر، عظام، الخ)
  specialtyEn?: string;
  jobTitleAr: string; // المسمى الوظيفي
  jobTitleEn: string;
  phone: string;
  email?: string;
  hiringDocsReceived: boolean; // هل مسوغات التعيين جت ولا لا (تشيك بوكس)
  hiringDocsNotes?: string;
  hiringDocuments?: StaffHiringDoc[];
  hireDate: string; // تاريخ التعيين
  basicSalary?: number;
  monthlySalary?: number; // الراتب الشهري الثابت
  fixedMonthlySalary?: number; // الراتب الشهري الثابت
  fixedAllowances?: number; // البدلات الثابتة
  hourlyRate?: number; // سعر الساعة
  laserRevenueRate?: number; // نسبته من إيراد الليزر %
  laserPulseRate?: number; // نسبته من عدد بلصات الليزر المستهلكة (ج.م لكل نبضة أو نسبة)
  dermatologyRevenueRate?: number; // نسبته من إيراد الجلدية %
  commissionRate?: number; // نسبة العمولة العامة %
  isServiceProvider?: boolean; // مقدم خدمة (يظهر في شاشة التشغيل والجلسات)
  isActive: boolean; // اختيار مفعل لتعطيله أو تشغيله
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  createdAt: string;
}

// Staff Payroll & Salaries (مسير الرواتب والأجور)
export interface StaffPayrollItem {
  id: string;
  staffId: string;
  staffNameAr: string;
  staffNameEn: string;
  roleType: StaffRoleType;
  jobTitleAr: string;
  branchId?: string;
  branchName?: string;
  month: string; // e.g. "2026-09"
  basicSalary: number;
  allowances: number; // بدلات ومكافآت
  commissions: number; // عمولات جلسات
  deductions: number; // استقطاعات وخصومات وسلف
  netSalary: number; // basic + allowances + commissions - deductions
  paymentStatus: 'Pending' | 'Paid';
  paymentMethod?: string; // e.g. "الخزينة الرئيسية" | "تحويل بنكي"
  paidAt?: string;
  paidBy?: string;
  journalEntryId?: string;
  notes?: string;
}

export interface PayrollRun {
  id: string;
  tenantId: string;
  branchId?: string;
  month: string; // "2026-09"
  totalBasic: number;
  totalAllowances: number;
  totalCommissions: number;
  totalDeductions: number;
  totalNet: number;
  status: 'Draft' | 'Approved' | 'Paid';
  createdAt: string;
  items: StaffPayrollItem[];
}

export interface SalesInvoiceItem {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface PaymentSplit {
  methodId: string;
  methodName: string;
  amount: number;
}

export interface SalesInvoice {
  id: string;
  tenantId: string;
  branchId?: string;
  warehouseId?: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  items: SalesInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  paymentMethod: string; // Dynamic payment method name/code
  paymentMethodId?: string;
  paymentFeePercentage?: number;
  paymentFeeAmount?: number;
  totalWithFee?: number;
  cashPaid?: number;
  cardPaid?: number;
  splitPayments?: PaymentSplit[];
  isCollectionOnly?: boolean; // تحصيل دفعة/مقدم فقط
  isRefunded?: boolean;
  refundReason?: string;
  refundedAt?: string;
  refundedBy?: string;
  refundedAmount?: number;
  status: 'Draft' | 'Posted' | 'Cancelled' | 'Refunded';
  createdAt: string;
  cashierName: string;
  cashierId?: string;
  createdById?: string;
  journalEntryId?: string;
}

// Appointments & Bookings (شاشة الحجز والمتابعة)
export interface Appointment {
  id: string;
  tenantId: string;
  branchId: string;
  patientId: string; // customerId
  patientName: string;
  patientPhone?: string;
  systemCode?: string;
  doctorName: string; // إجباري
  doctorId?: string;
  technicianName?: string;
  technicianId?: string;
  serviceNameAr: string;
  serviceNameEn: string;
  roomNumber?: string;
  price: number;
  deposit?: number;
  remainingBalance?: number;
  date: string;
  time: string;
  status: 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Attended' | 'NotAttended';
  notAttendedReason?: string; // سبب عدم الحضور
  cancellationReason?: string;
  leadSource?: string;
  notes?: string;
  treatmentPlanId?: string;
  createdAt?: string;
}

// Patient Follow-ups (جدول المتابعات المستقل)
export interface PatientFollowUp {
  id: string;
  tenantId: string;
  branchId?: string;
  patientId?: string;
  patientName: string;
  patientPhone: string;
  systemCode?: string;
  followUpDate: string; // تاريخ المتابعة
  notes?: string; // الملاحظة المسجلة وقت المتابعة
  reason?: string; // موضوع وسبب المتابعة
  type?: 'Inquiry' | 'PostTreatment' | 'Recall' | 'Complaint' | 'General';
  status: 'Pending' | 'Completed' | 'Cancelled' | 'Contacted' | 'Booked' | 'NoAnswer';
  outcome?: string; // نتيجة المتابعة
  leadSource?: string;
  createdAt: string;
  createdBy?: string;
}

export interface TreatmentPlan {
  id: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  doctorName?: string;
  doctorId?: string;
  title: string;
  totalSessions: number;
  completedSessions: number;
  totalCost?: number;
  notes: string;
  status: 'Active' | 'Completed' | 'Suspended';
  startDate?: string;
  date?: string;
  nextSessionDate?: string;
  sessions?: {
    sessionNumber: number;
    date: string;
    notes: string;
    status: 'Pending' | 'Completed';
  }[];
}

// Reception Run-Sheet & Shifts (شاشة التشغيل للريسيبشن)
export interface ShiftRunRow {
  id: string;
  date?: string; // اليوم / التاريخ
  dayName?: string; // اليوم (السبت، الأحد...)
  customerId?: string;
  patientId?: string;
  systemCode?: string; // كود العميل السيستم
  customerName?: string; // اسم العميل
  patientName?: string; // اسم المريض
  patientPhone?: string; // رقم الهاتف
  roomNumber?: string; // الغرفة
  serviceName: string; // اسم الخدمة
  serviceId?: string;
  pulsesCount?: number; // عدد النبضات (قبل الكمية)
  consumedQuantity: number; // الكمية المستهلكة
  unitPrice: number; // سعر الوحدة
  totalRevenue: number; // الإيراد = الكمية * سعر الوحدة (محسوب آلياً)
  paymentMethod: string; // طريقة التحصيل
  collectedAmount: number; // القيمة المحصلة
  laserDevice?: string; // جهاز الليزر
  doctorName?: string; // اسم الدكتور
  doctorId?: string;
  technicianName?: string;
  technicianId?: string;
  description?: string; // الشرح
  appointmentId?: string;
  notes?: string;
}

export interface ShiftExpense {
  id: string;
  date: string; // التاريخ والوقت
  category?: string; // بند المصروف
  itemId?: string; // معرف الصنف المخزني
  itemName?: string; // اسم الصنف المخزني
  quantity?: number; // الكمية
  unitPrice?: number; // سعر الوحدة
  expenseType?: 'receipt_and_payment' | 'receipt_only' | 'balance_payment'; // نوع الحركة: استلام وسداد | استلام فقط (آجل) | سداد من الرصيد
  description: string; // البيان والسبب
  reason?: string; // سبب الصرف
  amount: number; // القيمة المنصرفة
  disbursementMethod: string; // طريقة الصرف
  disbursementMethodId?: string;
  disbursedBy?: string; // القائم بالصرف
  supplierId?: string; // اسم/معرف المورد إن وجد
  supplierName?: string;
  receiptNumber?: string;
  timestamp?: string;
  disbursementTime?: string; // وقت الصرف الآلي
}

export interface DeviceMaintenancePart {
  id: string;
  partName: string; // اسم القطعة (لمبة، ألياف ضوئية، هاندبيس، شيلر تبريد، عدسة...)
  partCode?: string; // كود القطعة
  cost: number; // تكلفة القطعة
  warrantyMonths: number; // مدة الضمان بالشهور
  warrantyExpiryDate: string; // تاريخ انتهاء الضمان YYYY-MM-DD
  installedDate: string; // تاريخ التركيب YYYY-MM-DD
  expectedLifespanShots?: number; // العمر الافتراضي بالنبضات
  expectedLifespanMonths?: number; // العمر الافتراضي بالشهور
  startingShotsCounter?: number; // قراءة العداد وقت التركيب
  notes?: string;
}

export interface DeviceMaintenanceRecord {
  id: string;
  tenantId?: string;
  branchId?: string;
  deviceId: string;
  deviceName: string;
  deviceCode?: string;
  maintenanceDate: string; // تاريخ الصيانة YYYY-MM-DD
  maintenanceType: 'Routine' | 'LampReplacement' | 'FiberRepair' | 'HandpieceCalibration' | 'CoolingSystem' | 'EmergencyFix' | 'GeneralOverhaul' | 'Other';
  maintenanceTypeAr?: string;
  supplierId: string; // معرف المورد من شاشة الموردين
  supplierName: string; // اسم المورد من شاشة الموردين
  cost: number; // قيمة الصيانة الإجمالية
  paymentStatus: 'OnCredit' | 'PaidCash' | 'PaidBank'; // طريقة المحاسبة (آجل على حساب المورد / نقداً / بنك)
  paymentMethodName?: string;
  invoiceNumber?: string; // رقم فاتورة المورد / أمر الصيانة
  technicianName?: string; // اسم الفني أو مهندس الصيانة
  description: string; // تفاصيل وأسباب الصيانة
  deviceStatusAfter: 'Active' | 'Maintenance' | 'Out of Service'; // حالة الجهاز بعد الصيانة
  resetLampShots?: boolean; // هل تم استبدال وتصفير عداد اللمبة؟
  replacedParts: DeviceMaintenancePart[]; // قائمة القطع المستبدلة وتتبع الضمان
  journalEntryId?: string; // رقم قيد اليومية المسجل في شجرة الحسابات
  journalEntryNumber?: string;
  warrantyExpiryDate?: string; // تاريخ انتهاء ضمان الصيانة العام
  createdAt: string;
  createdBy?: string;
}

export interface LaserDevice {
  id: string;
  tenantId?: string;
  branchId?: string;
  name: string;
  nameEn?: string;
  code: string; // e.g. "LSR-01"
  model: string; // e.g. "Candela GentleMax Pro Plus"
  serialNumber: string; // e.g. "SN-CAN-98421"
  room: string; // e.g. "غرفة ليزر 1"
  status: 'Active' | 'Maintenance' | 'Out of Service' | 'Inactive';
  totalShotsCounter: number; // إجمالي عداد النبضات للجهاز
  currentLampShots: number; // عدد نبضات اللمبة الحالية
  warningLimitShots: number; // حد التنبيه لصيانة اللمبة
  maxCapacityShots: number; // العمر الافتراضي الأقصى للمبة
  costPerShot?: number; // تكلفة النبضة
  pricePerShot?: number; // سعر النبضة للعميل
  lastMaintenanceDate?: string;
  maintenanceNotes?: string;
  assignedTechnician?: string;
  maintenanceHistory?: DeviceMaintenanceRecord[];
  createdAt: string;
}

export interface ShiftBalancingRow {
  paymentMethodId: string;
  paymentMethodName: string;
  openingBalance: number; // رصيد أول المدة (افتراضي صفر للنقدي)
  totalCollected: number; // إجمالي المحصل
  totalDisbursed: number; // المنصرف
  adjustments: number; // التعديلات والتسويات
  closingBalance: number; // رصيد آخر المدة = أول + محصل - منصرف + تعديلات
}

export interface ShiftDeviceCounter {
  deviceId: string;
  deviceName: string;
  openingCounter: number; // رصيد أول المدة
  consumedCounter: number; // المستهلك بالشيفت
  adjustments: number; // التعديلات
  closingCounter: number; // رصيد آخر المدة = أول + مستهلك + تعديلات
}

export interface ReceptionShift {
  id: string;
  shiftNumber: string;
  tenantId: string;
  branchId: string;
  receptionistId: string;
  receptionistName: string;
  shiftDate: string;
  openedAt: string;
  closedAt?: string;
  status: 'Open' | 'Closed';
  notes?: string;
  closingNotes?: string;
  manualNotesHistory?: {
    id: string;
    timestamp: string;
    author: string;
    note: string;
  }[];

  // Run rows & Financials
  runRows: ShiftRunRow[];
  expenses: ShiftExpense[];
  balancing: ShiftBalancingRow[];
  deviceCounters: ShiftDeviceCounter[];

  // Totals
  totalRevenue: number;
  totalCollected: number;
  totalExpenses: number;
  netShiftCash: number;

  // Cash Drawer Reconciliation & Z-Report
  openingFloat?: number;
  initialBalance?: number;
  cashCollected?: number;
  cashExpenses?: number;
  expectedCashInDrawer?: number;
  actualCashCount?: number;
  cashDiscrepancy?: number;
  transferredToMainTreasury?: boolean;
  mainTreasuryReceiptNumber?: string;
  zReportNumber?: string;

  // Accountant Overrides / Adjustments (تعديلات المحاسب)
  accountantAdjustments?: {
    adjustedAt: string;
    adjustedBy: string;
    adjustmentReason: string;
    adjustmentAmount: number;
    auditLog: string;
  }[];
}

// Legacy PosShift compatibility
export interface PosShift {
  id: string;
  tenantId: string;
  branchId?: string;
  cashierName: string;
  openingFloat: number;
  openedAt: string;
  closedAt?: string;
  status: 'Open' | 'Closed';
  totalCashSales: number;
  totalCardSales: number;
  expectedCash: number;
  actualCashCount?: number;
  difference?: number;
  notes?: string;
}

// Audit Trail & Logs (سجل التعديلات، المحذوفات، ونشاطات المستخدمين)
export interface PaymentSplit {
  method: string;
  amount: number;
  reference?: string;
}

export interface AuditRecord {
  id: string;
  tenantId: string;
  branchId?: string;
  entityType: 'Party' | 'Appointment' | 'TreatmentPlan' | 'Staff' | 'PaymentMethod' | 'Product' | 'Invoice' | 'Shift' | 'Tenant' | 'Branch' | 'Warehouse' | 'User' | 'Account';
  entityId: string;
  entityName: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'CANCEL';
  performedById: string;
  performedByName: string;
  timestamp: string;
  reason?: string;
  details?: string;
  previousState?: any; // Snapshot before modification/deletion
  newState?: any; // Snapshot after modification
  diffSummary?: string; // Summary of what changed
}

export interface UserActivityLog {
  id: string;
  tenantId: string;
  branchId?: string;
  userId: string;
  userName: string;
  userRole: string;
  screenId: string;
  screenNameAr: string;
  screenNameEn: string;
  actionNameAr: string;
  actionNameEn: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface ModuleDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: 'Core' | 'Operations' | 'Specialized' | 'Intelligence';
  icon: string;
  required?: boolean;
}

export interface NeonDbState {
  connected: boolean;
  connectionString: string;
  isSyncing: boolean;
  lastSync?: string;
  error?: string;
  tablesCount: number;
  recordsCount: number;
}

export type UserRole = 'SuperAdmin' | 'BranchManager' | 'Cashier' | 'Receptionist' | 'Accountant' | 'Doctor' | 'Custom';

export interface ActionPermissionDef {
  key: string;
  nameAr: string;
  nameEn: string;
  viewId: string;
  descriptionAr?: string;
  descriptionEn?: string;
}

export interface AppUser {
  id: string;
  tenantId: string; // default primary company
  branchId?: string; // default primary branch
  name: string;
  nameEn?: string;
  username: string;
  password?: string;
  email: string;
  phone?: string;
  role: UserRole;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;

  allowedTenantIds: string[];
  allowedBranchIds: string[];
  allowedWarehouseIds: string[];
  allowedViews: string[];
  allowedActions: string[];
}

// ==========================================
// سندات ومستندات محاسبية ومخزنية متخصصة
// ==========================================

export interface CashReceiptVoucher {
  id: string;
  voucherNumber: string;
  date: string;
  time: string;
  tenantId: string;
  branchId: string;
  partyId?: string;
  receivedFrom: string;
  amount: number;
  currency: string;
  paymentMethod: 'Cash' | 'Card' | 'Transfer' | 'Check';
  bankOrSafeAccountId?: string;
  bankName?: string;
  checkNumber?: string;
  checkDate?: string;
  referenceInvoiceNo?: string;
  description: string;
  costCenter?: string;
  receiverName: string;
  clientSignature?: string;
  status: 'active' | 'cancelled';
  createdAt: string;
}

export interface CashPaymentVoucher {
  id: string;
  voucherNumber: string;
  date: string;
  time: string;
  tenantId: string;
  branchId: string;
  paidTo: string;
  partyId?: string;
  expenseAccountId?: string;
  expenseCategory?: string;
  amount: number;
  currency: string;
  paymentMethod: 'Cash' | 'Card' | 'Transfer' | 'Check';
  paidFromAccount: string;
  checkNumber?: string;
  invoiceReference?: string;
  description: string;
  costCenter?: string;
  preparedBy: string;
  approvedBy?: string;
  receiverName?: string;
  status: 'active' | 'cancelled';
  createdAt: string;
}

export interface TaxInvoiceItem {
  id: string;
  productId?: string;
  name: string;
  sku?: string;
  quantity: number;
  unit: string;
  unitPrice: number; // Excl. VAT
  discount: number;
  taxableAmount: number;
  vatRate: number; // e.g. 14%
  vatAmount: number;
  subtotalWithVat: number;
}

export interface SpecializedTaxInvoice {
  id: string;
  invoiceNumber: string;
  invoiceType: 'tax_invoice' | 'simplified_tax_invoice';
  tenantId: string;
  branchId: string;
  date: string;
  time: string;
  supplyDate: string;
  dueDate: string;
  partyId?: string;
  customerName: string;
  customerVatNumber?: string;
  customerCrNumber?: string;
  customerAddress?: string;
  customerPhone?: string;
  nationalId?: string; // الرقم القومي للعميل (لمنظومة الفاتورة والإيصال الإلكتروني ETA)
  sellerVatNumber: string;
  sellerCrNumber: string;
  sellerAddress: string;
  sellerPhone: string;
  items: TaxInvoiceItem[];
  subtotalExclVat: number;
  totalDiscount: number;
  totalTaxable: number;
  totalVat: number;
  grandTotal: number;
  currency: string;
  paymentMethod: string;
  splitPayments?: PaymentSplit[]; // السداد المتعدد (كاش + فيزا + إنستاباي)
  bankName?: string;
  iban?: string;
  notes?: string;
  termsAndConditions?: string;
  status: 'issued' | 'paid' | 'cancelled';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  qrCodeDataUrl?: string;
  createdAt: string;
}

export interface GoodsReceiptItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  batchNo?: string;
  batchNumber?: string;
  expiryDate?: string;
  quantityOrdered?: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

export interface GoodsReceiptVoucher {
  id: string;
  grnNumber: string;
  date: string;
  time: string;
  tenantId: string;
  branchId: string;
  warehouseId: string;
  warehouseName?: string;
  supplierId?: string;
  supplierName: string;
  supplierInvoiceNo?: string;
  purchaseOrderNo?: string;
  items: GoodsReceiptItem[];
  totalItemsCount?: number;
  totalValue?: number;
  totalCostValue?: number;
  receiverStaffName?: string;
  receiverName?: string;
  inspectedBy?: string;
  inspectorName?: string;
  notes?: string;
  status: 'received' | 'cancelled';
  createdAt: string;
}

export interface GoodsIssueItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantityIssued: number;
  unitCost: number;
  totalCost: number;
}

export interface GoodsIssueVoucher {
  id: string;
  ginNumber: string;
  date: string;
  time: string;
  tenantId: string;
  branchId: string;
  warehouseId: string;
  warehouseName?: string;
  department?: string;
  recipientName: string;
  reason?: 'treatment_consumption' | 'clinic_requisition' | 'damaged_write_off' | 'internal_use';
  purpose?: string;
  referenceOrderNo?: string;
  costCenter?: string;
  items: GoodsIssueItem[];
  totalQuantity?: number;
  totalCost?: number;
  totalCostValue?: number;
  authorizedBy?: string;
  approvedBy?: string;
  dispensedBy?: string;
  issuedBy?: string;
  notes?: string;
  status: 'issued' | 'cancelled';
  createdAt: string;
}

