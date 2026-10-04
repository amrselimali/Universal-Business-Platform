import * as XLSX from 'xlsx';
import {
  Branch,
  Warehouse,
  AppUser,
  Party,
  Product,
  StockLevel,
  StockMovement,
  Account,
  JournalEntry,
  SalesInvoice,
  CashReceiptVoucher,
  CashPaymentVoucher,
  GoodsReceiptVoucher,
  GoodsIssueVoucher,
  ReceptionShift,
  ShiftRunRow,
  AttendanceRecord,
  StaffMember,
  Appointment,
  PaymentMethod,
  LaserDevice,
} from '../types';

export interface DatabaseBackupPayload {
  tenantName: string;
  branches: Branch[];
  warehouses: Warehouse[];
  users: AppUser[];
  parties: Party[];
  products: Product[];
  stockLevels: StockLevel[];
  stockMovements: StockMovement[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  invoices: SalesInvoice[];
  cashReceipts: CashReceiptVoucher[];
  cashPayments: CashPaymentVoucher[];
  goodsReceipts: GoodsReceiptVoucher[];
  goodsIssues: GoodsIssueVoucher[];
  receptionShifts: ReceptionShift[];
  attendanceRecords: AttendanceRecord[];
  staffMembers: StaffMember[];
  appointments: Appointment[];
  paymentMethods: PaymentMethod[];
  laserDevices: LaserDevice[];
}

export function exportDatabaseToMultiSheetExcel(payload: DatabaseBackupPayload): { success: boolean; filename: string } {
  try {
    const wb = XLSX.utils.book_new();

    // Helper: Safely append sheet
    const addSheet = (sheetName: string, dataRows: any[]) => {
      // Excel limits sheet names to 31 characters
      const cleanName = sheetName.slice(0, 31).replace(/[\\/?*[\]]/g, '');
      const ws = XLSX.utils.json_to_sheet(dataRows.length > 0 ? dataRows : [{ 'ملاحظة': 'لا توجد سجلات حالياً' }]);
      XLSX.utils.book_append_sheet(wb, ws, cleanName);
    };

    // 1. الفروع (Branches)
    addSheet('الفروع - Branches', payload.branches.map((b) => ({
      'كود الفرع': b.id,
      'اسم الفرع (عربي)': b.name,
      'اسم الفرع (إنجليزي)': b.nameEn || '',
      'كود النظام': b.code || '',
      'رقم الهاتف': b.phone || '',
      'المدينة / العنوان': (b as any).address || b.city || '',
      'الحالة': b.isArchived ? 'مؤرشف' : 'مفعل نشط',
    })));

    // 2. المخازن (Warehouses)
    addSheet('المخازن - Warehouses', payload.warehouses.map((w) => ({
      'كود المخزن': w.id,
      'اسم المخزن': w.name,
      'الفرع التابع له': payload.branches.find((b) => b.id === w.branchId)?.name || w.branchId,
      'أمين المخزن المسؤول': (w as any).managerName || '',
      'رقم الهاتف': (w as any).phone || '',
      'العنوان والموقع': w.location || '',
      'الحالة': w.isArchived ? 'مؤرشف' : 'نشط',
    })));

    // 3. المستخدمين والأدوار (Users)
    addSheet('المستخدمين - Users', payload.users.map((u) => ({
      'كود المستخدم': u.id,
      'الاسم الكامل': u.name,
      'اسم الدخول': u.username,
      'البريد الإلكتروني': u.email || '',
      'الدور الوظيفي': u.role,
      'مدير نظام (Admin)': u.isAdmin ? 'نعم' : 'لا',
      'الفرع الأساسي': payload.branches.find((b) => b.id === u.branchId)?.name || 'كل الفروع',
      'الحالة': u.isActive ? 'نشط ومفعل' : 'معطل',
    })));

    // 4. العملاء والمرضى (Customers - Separate)
    const customers = payload.parties.filter((p) => p.type === 'Customer' || p.type === 'Both');
    addSheet('العملاء والمرضى - Customers', customers.map((c) => ({
      'كود السيستم': c.systemCode || c.id,
      'الكود الورقي': c.paperCode || '',
      'الاسم بالعربي': c.name,
      'الاسم بالإنجليزي': c.nameEn || '',
      'رقم الهاتف': c.phone,
      'الهاتف البديل': c.altPhone || '',
      'الرقم القومي': c.nationalId || '',
      'الرصيد المالي': c.balance,
      'الفرع التابع': payload.branches.find((b) => b.id === c.branchId)?.name || 'الكل',
      'مصدر المعرفة': c.leadSource || '',
      'ملاحظات': c.medicalNotes || '',
    })));

    // 5. الموردين (Suppliers - Separate)
    const suppliers = payload.parties.filter((p) => p.type === 'Supplier' || p.type === 'Both');
    addSheet('الموردين - Suppliers', suppliers.map((s) => ({
      'كود المورد': s.systemCode || s.id,
      'اسم المورد': s.name,
      'الاسم بالإنجليزي': s.nameEn || '',
      'رقم الهاتف': s.phone,
      'البريد': s.email || '',
      'السجل التجاري/الضريبي': s.nationalId || s.taxNumber || '',
      'رصيد المديونية المستحق': s.balance,
      'الحد الائتماني': s.creditLimit || 0,
      'العنوان': s.address || '',
    })));

    // 6. المنتجات والخدمات البيعية (Sales Items & Services - Separate)
    const salesItems = payload.products.filter((p) => !p.isStockItem && p.itemType !== 'stock_raw' && p.itemType !== 'consumable');
    addSheet('المنتجات والخدمات البيعية', salesItems.map((p) => ({
      'الباركود': p.barcode || p.sku,
      'اسم الخدمة/المنتج (عربي)': p.nameAr,
      'الاسم (إنجليزي)': p.nameEn || '',
      'التصنيف': p.category,
      'النوع': p.isService ? 'خدمة طبية / جلسة' : p.isPackage ? 'باقة جلسات' : 'منتج بيعي',
      'سعر البيع': p.sellingPrice,
      'الحد الأدنى للبيع': p.minSellingPrice || p.sellingPrice,
      'حساب الإيراد': payload.accounts.find((a) => a.id === p.salesAccountId)?.nameAr || p.salesAccountId || '4200',
      'حساب التكلفة': payload.accounts.find((a) => a.id === p.cogsAccountId)?.nameAr || p.cogsAccountId || '5100',
      'الحالة': p.isActive ? 'مفعل' : 'معطل',
    })));

    // 7. أصناف وخامات المخزن (Stock Items & Raw Materials - Separate)
    const stockItems = payload.products.filter((p) => p.isStockItem || p.itemType === 'stock_raw' || p.itemType === 'consumable' || p.itemType === 'medical_supply');
    addSheet('أصناف وخامات المخزن', stockItems.map((p) => ({
      'كود الصنف (SKU)': p.sku,
      'الباركود': p.barcode || '',
      'اسم الصنف المخزني': p.nameAr,
      'التصنيف': p.category,
      'الوحدة': p.unit || 'قطعة',
      'سعر الشراء / التكلفة': p.purchasePrice,
      'حد إعادة الطلب الأدنى': p.minStockLevel || 5,
      'حساب المخزون': payload.accounts.find((a) => a.id === p.inventoryAccountId)?.nameAr || p.inventoryAccountId || '1130',
      'حساب المصروف/الاستهلاك': payload.accounts.find((a) => a.id === p.expenseAccountId)?.nameAr || p.expenseAccountId || '5100',
      'الفرع المخصص': payload.branches.find((b) => b.id === p.branchId)?.name || 'كل الفروع',
    })));

    // 8. أرصدة المخازن (Stock Levels)
    addSheet('أرصدة المخازن الحالية', payload.stockLevels.map((sl) => {
      const prod = payload.products.find((p) => p.id === sl.productId);
      const wh = payload.warehouses.find((w) => w.id === sl.warehouseId);
      const br = payload.branches.find((b) => b.id === wh?.branchId);
      return {
        'الفرع': br?.name || '',
        'المخزن': wh?.name || sl.warehouseId,
        'كود الصنف': prod?.sku || sl.productId,
        'اسم الصنف': prod?.nameAr || 'صنف',
        'الرصيد الفعلي المتوفر': sl.quantityOnHand,
        'الوحدة': prod?.unit || 'قطعة',
        'تكلفة الوحدة': prod?.purchasePrice || 0,
        'إجمالي القيمة المالية': Number((sl.quantityOnHand * (prod?.purchasePrice || 0)).toFixed(2)),
      };
    }));

    // 9. حركات المخزون (Stock Movements)
    addSheet('سجل حركات المخزون', payload.stockMovements.map((sm) => ({
      'رقم الحركة': sm.referenceNo,
      'التاريخ': sm.createdAt,
      'الفرع': sm.branchNameAr || '',
      'المخزن': sm.warehouseNameAr || '',
      'اسم الصنف': sm.productNameAr || sm.productId,
      'نوع الحركة': sm.type === 'IN' ? 'وارد استلام' : sm.type === 'OUT' ? 'صرف منصرف' : sm.type === 'CONSUMPTION' ? 'استهلاك جلسة' : sm.type === 'TRANSFER' ? 'تحويل' : 'تسوية',
      'الكمية': sm.quantity,
      'تكلفة الوحدة': sm.unitCost,
      'البيان': sm.note || '',
    })));

    // 10. شجرة الحسابات (Chart of Accounts)
    addSheet('شجرة الحسابات - COA', payload.accounts.map((a) => ({
      'كود الحساب': a.code,
      'اسم الحساب (عربي)': a.nameAr,
      'اسم الحساب (إنجليزي)': a.nameEn,
      'نوع الحساب': a.type === 'Asset' ? 'أصول' : a.type === 'Liability' ? 'خصوم والتزامات' : a.type === 'Equity' ? 'حقوق ملكية' : a.type === 'Revenue' ? 'إيرادات' : 'مصروفات',
      'طبيعة الحساب': a.isDebitNormal ? 'مدين' : 'دائن',
      'الرصيد الدفتري الحالي': a.balance,
      'المستوى': a.level,
      'الفرع': payload.branches.find((b) => b.id === a.branchId)?.name || 'حساب عام',
    })));

    // 11. قيود اليومية العامة (Journal Entries)
    const flattenedJournals: any[] = [];
    payload.journalEntries.forEach((je) => {
      je.lines.forEach((line) => {
        flattenedJournals.push({
          'رقم القيد': je.entryNumber,
          'التاريخ': je.date,
          'شرح القيد العام': je.description,
          'المستند المرجعي': je.sourceDocument || '',
          'الفرع': payload.branches.find((b) => b.id === je.branchId)?.name || 'عام',
          'كود الحساب': line.accountCode,
          'اسم الحساب': line.accountNameAr,
          'مدين': line.debit,
          'دائن': line.credit,
          'شرح السطر': line.memo || '',
        });
      });
    });
    addSheet('دفتر القيود اليومية', flattenedJournals);

    // 12. فواتير المبيعات ونقاط البيع (Sales Invoices)
    addSheet('فواتير المبيعات ونقاط البيع', payload.invoices.map((inv) => ({
      'رقم الفاتورة': inv.invoiceNumber,
      'التاريخ': inv.createdAt,
      'اسم العميل': inv.customerName,
      'الفرع': payload.branches.find((b) => b.id === inv.branchId)?.name || '',
      'المخزن': payload.warehouses.find((w) => w.id === inv.warehouseId)?.name || '',
      'طريقة السداد': inv.paymentMethod,
      'الإجمالي قبل الضريبة': inv.subtotal,
      'الخصم': inv.discountAmount,
      'الضريبة': inv.taxAmount,
      'الصافي': inv.netAmount,
      'المحصل': (inv.cashPaid || 0) + (inv.cardPaid || 0),
      'الكاشير': inv.cashierName,
      'حالة الفاتورة': inv.status,
      'رقم قيد الإيراد': inv.journalEntryId || '',
      'رقم قيد التكلفة': inv.costJournalEntryId || '',
    })));

    // 13. سندات القبض (Cash Receipts)
    addSheet('سندات القبض النقدية', payload.cashReceipts.map((r) => ({
      'رقم السند': r.voucherNumber,
      'التاريخ': r.date,
      'الوقت': r.time || '',
      'الفرع': payload.branches.find((b) => b.id === r.branchId)?.name || '',
      'المستلم منه': r.receivedFrom,
      'المبلغ': r.amount,
      'العملة': r.currency || 'EGP',
      'طريقة القبض': r.paymentMethod,
      'اسم البنك/الشيك': r.bankName || r.checkNumber || '',
      'البيان': r.description,
      'المستلم': r.receiverName,
      'الحالة': r.status,
      'رقم القيد': r.journalEntryId || '',
    })));

    // 14. سندات الصرف (Cash Payments)
    addSheet('سندات الصرف النقدية', payload.cashPayments.map((p) => ({
      'رقم السند': p.voucherNumber,
      'التاريخ': p.date,
      'الوقت': p.time || '',
      'الفرع': payload.branches.find((b) => b.id === p.branchId)?.name || '',
      'صرف إلى': p.paidTo,
      'بند المصروف': p.expenseCategory || '',
      'المبلغ': p.amount,
      'طريقة الصرف': p.paymentMethod,
      'الخزينة/الحساب': p.paidFromAccount,
      'البيان': p.description,
      'المحاسب': p.preparedBy,
      'الحالة': p.status,
      'رقم القيد': p.journalEntryId || '',
    })));

    // 15. أذونات استلام مخزني (Goods Receipts - GRN)
    const flattenedGrn: any[] = [];
    payload.goodsReceipts.forEach((grn) => {
      grn.items.forEach((item) => {
        flattenedGrn.push({
          'رقم الإذن': grn.grnNumber,
          'التاريخ': grn.date,
          'المورد': grn.supplierName,
          'المخزن المستلم': grn.warehouseName || payload.warehouses.find((w) => w.id === grn.warehouseId)?.name || '',
          'رقم فاتورة المورد': grn.supplierInvoiceNo || '',
          'الصنف المستلم': item.productName,
          'كود الصنف': item.sku,
          'الكمية المستلمة': item.quantityReceived,
          'سعر الشراء': item.unitCost,
          'إجمالي القيمة': item.totalCost,
          'رقم قيد اليومية': grn.journalEntryId || '',
          'المستلم': grn.receiverName || '',
        });
      });
    });
    addSheet('أذونات استلام مخزني GRN', flattenedGrn);

    // 16. أذونات صرف مخزني (Goods Issues - GIN)
    const flattenedGin: any[] = [];
    payload.goodsIssues.forEach((gin) => {
      gin.items.forEach((item) => {
        flattenedGin.push({
          'رقم الإذن': gin.ginNumber,
          'التاريخ': gin.date,
          'المستلم': gin.recipientName,
          'القسم': gin.department || '',
          'المخزن المنصرف منه': gin.warehouseName || payload.warehouses.find((w) => w.id === gin.warehouseId)?.name || '',
          'الغرض': gin.purpose || '',
          'الصنف المنصرف': item.productName,
          'الكمية المنصرفة': item.quantityIssued,
          'تكلفة الوحدة': item.unitCost,
          'إجمالي التكلفة': item.totalCost,
          'رقم قيد اليومية': gin.journalEntryId || '',
        });
      });
    });
    addSheet('أذونات صرف مخزني GIN', flattenedGin);

    // 17. شيفتات التشغيل والاستقبال (Shifts)
    addSheet('شيفتات التشغيل والاستقبال', payload.receptionShifts.map((s) => ({
      'رقم الشيفت': s.shiftNumber,
      'الفرع': payload.branches.find((b) => b.id === s.branchId)?.name || '',
      'موظف الاستقبال': s.receptionistName,
      'تاريخ الشيفت': s.shiftDate,
      'وقت الفتح': s.openedAt,
      'وقت الإغلاق': s.closedAt || '',
      'إجمالي الإيرادات': s.totalRevenue,
      'إجمالي المحصل': s.totalCollected,
      'إجمالي المصروفات': s.totalExpenses,
      'صافي نقدية الشيفت': s.netShiftCash,
      'الرصيد الفعلي بالدرج': s.actualCashCount || 0,
      'حالة الشيفت': s.status === 'Open' ? 'مفتوح' : 'مغلق',
    })));

    // 18. حركات التشغيل اليومية (Run Sheet Operations)
    const allRunRows: any[] = [];
    payload.receptionShifts.forEach((s) => {
      s.runRows.forEach((r) => {
        allRunRows.push({
          'رقم الشيفت': s.shiftNumber,
          'الفرع': payload.branches.find((b) => b.id === s.branchId)?.name || '',
          'التاريخ': r.date || s.shiftDate,
          'كود العميل': r.systemCode || '',
          'اسم المريض / العميل': r.patientName || r.customerName || '',
          'الهاتف': r.patientPhone || '',
          'اسم الخدمة/الجلسة': r.serviceName,
          'جهاز الليزر': r.laserDevice || '',
          'عدد النبضات': r.pulsesCount || 0,
          'الكمية': r.consumedQuantity,
          'سعر الوحدة': r.unitPrice,
          'الإيراد': r.totalRevenue,
          'المحصل': r.collectedAmount,
          'طريقة السداد': r.paymentMethod,
          'الطبيب / مقدم الخدمة': r.doctorName || '',
          'قيد الإيراد': r.journalEntryId || '',
          'قيد التكلفة': r.costJournalEntryId || '',
          'معدلة بعكس القيد؟': r.isReplaced ? 'نعم (مستبدلة)' : 'لا',
        });
      });
    });
    addSheet('حركات التشغيل اليومية', allRunRows);

    // 19. الحضور والانصراف والبصمة (Attendance)
    addSheet('سجلات الحضور والانصراف', payload.attendanceRecords.map((a) => ({
      'كود الموظف': a.staffId,
      'اسم الموظف': a.staffNameAr,
      'الوظيفة': a.jobTitleAr || '',
      'الفرع': payload.branches.find((b) => b.id === a.branchId)?.name || a.branchId,
      'التاريخ': a.date,
      'وقت الحضور': a.checkInTime || '',
      'وقت الانصراف': a.checkOutTime || '',
      'ساعات العمل': a.workHours || 0,
      'دقائق التأخير': a.lateMinutes || 0,
      'الحالة': a.status === 'Present' ? 'حاضر' : a.status === 'Late' ? 'متأخر' : a.status === 'Absent' ? 'غائب' : a.status === 'Leave' ? 'إجازة' : 'إذن',
      'المصدر': a.source === 'biometric_device' ? 'جهاز بصمة خارجي' : a.source === 'manual' ? 'يدوي' : 'تطبيق هاتف',
      'كود جهاز البصمة': a.deviceUserId || a.deviceIpOrId || '',
      'ملاحظات': a.notes || '',
    })));

    // 20. الموظفين والأطباء (Staff Members)
    addSheet('الكادر الطبي والموظفين', payload.staffMembers.map((sm) => ({
      'اسم الموظف': sm.nameAr,
      'الاسم بالإنجليزي': sm.nameEn || '',
      'المسمى الوظيفي': sm.jobTitleAr,
      'الدور الطبي': sm.roleType || sm.staffType,
      'الفرع': payload.branches.find((b) => b.id === sm.branchId)?.name || 'كل الفروع',
      'الهاتف': sm.phone,
      'تاريخ التعيين': sm.hireDate,
      'الراتب الأساسي': sm.basicSalary || sm.monthlySalary || 0,
      'مقدم خدمة بالتشغيل؟': sm.isServiceProvider ? 'نعم' : 'لا',
      'يستقبل حجوزات؟': sm.acceptsBookings ? 'نعم' : 'لا',
      'الحالة': sm.isActive ? 'نشط' : 'معطل',
    })));

    // 21. الحجوزات والمواعيد (Appointments)
    addSheet('الحجوزات والمواعيد', payload.appointments.map((ap) => ({
      'رقم الحجز': ap.id.slice(-6),
      'الفرع': payload.branches.find((b) => b.id === ap.branchId)?.name || '',
      'التاريخ': ap.date,
      'الوقت': ap.time,
      'اسم المريض': ap.patientName,
      'الهاتف': ap.patientPhone || '',
      'الطبيب المعالج': ap.doctorName,
      'الخدمة المطلوبة': ap.serviceNameAr,
      'السعر': ap.price,
      'العربون/المقدم': ap.deposit || 0,
      'المتبقي': ap.remainingBalance || 0,
      'حالة الموعد': ap.status,
    })));

    // 22. طرق السداد (Payment Methods)
    addSheet('طرق السداد المعتمدة', payload.paymentMethods.map((pm) => ({
      'كود الطريقة': pm.code,
      'اسم الطريقة (عربي)': pm.nameAr,
      'الاسم بالإنجليزي': pm.nameEn,
      'النوع': pm.type,
      'الحساب المحاسبي المرتبط': payload.accounts.find((a) => a.id === pm.linkedAccountId)?.nameAr || pm.linkedAccountId || '',
      'نسبة العمولة %': pm.feePercentage || 0,
      'افتراضي؟': pm.isDefault ? 'نعم' : 'لا',
    })));

    // 23. أجهزة الليزر (Laser Devices)
    addSheet('أجهزة ومعدات الليزر', payload.laserDevices.map((d) => ({
      'كود الجهاز': d.code,
      'اسم الجهاز': d.name,
      'الموديل': d.model,
      'الرقم التسلسلي': d.serialNumber,
      'الغرفة': d.room,
      'الفرع': payload.branches.find((b) => b.id === d.branchId)?.name || 'الرئيسي',
      'إجمالي عداد النبضات': d.totalShotsCounter,
      'نبضات اللمبة الحالية': d.currentLampShots,
      'العمر الأقصى للمبة': d.maxCapacityShots,
      'الحالة': d.status,
    })));

    // Write file
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `ERP_Full_Backup_${payload.tenantName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);

    return { success: true, filename };
  } catch (error: any) {
    console.error('Failed to export full database backup:', error);
    return { success: false, filename: error.message || 'Error exporting' };
  }
}
