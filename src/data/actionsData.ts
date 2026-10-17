/**
 * سجل الأفعال (Action Registry) — كل زر في النظام
 * ---------------------------------------------------------------------------
 * فُصل من permissionsData.ts للحفاظ على حجم الملف تحت الحد المسموح،
 * ولأن هذا السجل يقرأه أيضاً محرك الشاشات والسيرفر لفرض الصلاحيات.
 *
 * غياب الفعل من صلاحيات المستخدم = ممنوع (Default-Deny).
 */

import { ActionPermissionDef } from '../types';

export const SYSTEM_ACTIONS: ActionPermissionDef[] = [
  // Reception Operations
  {
    key: 'reception_ops.open_shift',
    nameAr: 'افتتاح وبدء شيفت جديد',
    nameEn: 'Open New Shift',
    viewId: 'reception_ops',
    descriptionAr: 'السماح للموظف بافتتاح وبدء شيفت تشغيل للفرع الحالي',
  },
  {
    key: 'reception_ops.close_shift',
    nameAr: 'تقفيل وإنهاء الشيفت',
    nameEn: 'Close & Finalize Shift',
    viewId: 'reception_ops',
    descriptionAr: 'إغلاق الشيفت وترحيل إجمالي الإيرادات والمصروفات والأرصدة',
  },
  {
    key: 'reception_ops.add_run_row',
    nameAr: 'إضافة حركة تشغيل جديدة',
    nameEn: 'Add Shift Run Row',
    viewId: 'reception_ops',
    descriptionAr: 'تسجيل مريض جديد في جدول التشغيل وحساب النبضات والقيمة المحصلة',
  },
  {
    key: 'reception_ops.edit_row',
    nameAr: 'تعديل حركات التشغيل واسم المريض',
    nameEn: 'Edit Run Row & Patient Name',
    viewId: 'reception_ops',
    descriptionAr: 'تعديل اسم المريض، الخدمة، النبضات، أو طريقة الدفع في الشيفت النشط',
  },
  {
    key: 'reception_ops.add_expense',
    nameAr: 'تسجيل مصروفات الشيفت',
    nameEn: 'Record Shift Expense',
    viewId: 'reception_ops',
    descriptionAr: 'إضافة مصروف نقدي أو بنكي مع توثيق وقت الصرف والبيان',
  },
  {
    key: 'reception_ops.adjust_balance',
    nameAr: 'تعديل تسوية طرق السداد وعدادات الأجهزة',
    nameEn: 'Adjust Balancing & Device Counters',
    viewId: 'reception_ops',
    descriptionAr: 'تسجيل التعديلات والملاحظات على تسوية الخزينة وعدادات الليزر',
  },
  {
    key: 'reception_ops.print_shift',
    nameAr: 'طباعة تقرير الشيفت',
    nameEn: 'Print Shift Report',
    viewId: 'reception_ops',
    descriptionAr: 'طباعة التقرير الشامل لحركات التشغيل والمصروفات وتسوية الخزائن',
  },

  // Bookings & Appointments
  {
    key: 'bookings.create_booking',
    nameAr: 'حجز موعد جديد',
    nameEn: 'Create New Appointment',
    viewId: 'bookings',
    descriptionAr: 'تسجيل حجز موعد جديد لمريض مع البحث والتسجيل الآلي للعميل',
  },
  {
    key: 'bookings.edit_booking',
    nameAr: 'تعديل بيانات الحجز',
    nameEn: 'Edit Appointment',
    viewId: 'bookings',
    descriptionAr: 'تعديل وقت وتاريخ والطبيب المعالج للموعد',
  },
  {
    key: 'bookings.cancel_booking',
    nameAr: 'إلغاء الموعد وتوثيق السبب',
    nameEn: 'Cancel Appointment',
    viewId: 'bookings',
    descriptionAr: 'إلغاء حجز الموعد مع تسجيل سبب الإلغاء في سجل التدقيق',
  },
  {
    key: 'bookings.reschedule_booking',
    nameAr: 'إعادة جدولة الموعد',
    nameEn: 'Reschedule Appointment',
    viewId: 'bookings',
    descriptionAr: 'ترحيل الموعد إلى يوم أو وقت آخر',
  },
  {
    key: 'bookings.mark_attendance',
    nameAr: 'تأكيد الحضور أو عدم الحضور',
    nameEn: 'Mark Attendance / No-show',
    viewId: 'bookings',
    descriptionAr: 'تحديث حالة حضور المريض في شيت اليوم',
  },
  {
    key: 'bookings.add_followup',
    nameAr: 'تسجيل متابعة مريض هاتفية',
    nameEn: 'Add Follow-up Entry',
    viewId: 'bookings',
    descriptionAr: 'إضافة تذكير أو اتصال متابعة جديد مع المريض',
  },
  {
    key: 'bookings.manage_staff_schedule',
    nameAr: 'تسجيل وتعديل مواعيد دوام الموظفين',
    nameEn: 'Manage Staff Work Schedules',
    viewId: 'bookings',
    descriptionAr: 'إضافة وتعديل وحذف أوقات ومواعيد عمل الموظفين في تبويب مواعيد الموظفين',
  },

  // POS
  {
    key: 'pos.checkout',
    nameAr: 'إتمام البيع وإصدار الفاتورة',
    nameEn: 'Checkout & Issue Invoices',
    viewId: 'pos',
    descriptionAr: 'إمكانية إتمام سلة المشتريات وإصدار الفواتير النقدية والآجلة',
  },
  {
    key: 'pos.discount',
    nameAr: 'منح خصومات على الفاتورة',
    nameEn: 'Apply Cart Discounts',
    viewId: 'pos',
    descriptionAr: 'السماح بإدخال مبالغ خصم إضافية على الفاتورة',
  },
  {
    key: 'pos.tax_edit',
    nameAr: 'تعديل نسبة الضريبة بالفاتورة',
    nameEn: 'Edit Invoice Tax Rate',
    viewId: 'pos',
    descriptionAr: 'إمكانية تغيير نسبة الضريبة عن القيمة الافتراضية (0% أو نسب مخصصة)',
  },
  {
    key: 'pos.close_shift',
    nameAr: 'تقفيل الشيفت والجرد الأعمى',
    nameEn: 'Close Shift & Blind Reconcile',
    viewId: 'pos',
    descriptionAr: 'تقفيل درج النقدية وتسجيل الفروقات النقدية للشيفت',
  },
  {
    key: 'pos.print',
    nameAr: 'طباعة الإيصالات والفواتير',
    nameEn: 'Print Sales Receipts',
    viewId: 'pos',
    descriptionAr: 'إرسال الفاتورة للطابعة الحرارية',
  },

  // Staff & Doctors
  {
    key: 'staff.add_staff',
    nameAr: 'إضافة طبيب أو موظف جديد',
    nameEn: 'Add Doctor / Staff Member',
    viewId: 'staff',
    descriptionAr: 'تسجيل بيانات طبيب أو ممرض أو موظف جديد في الفرع',
  },
  {
    key: 'staff.edit_staff',
    nameAr: 'تعديل بيانات الكادر الطبي والإداري',
    nameEn: 'Edit Staff Member',
    viewId: 'staff',
    descriptionAr: 'تحديث بيانات التخصص والهاتف والراتب والنسبة',
  },
  {
    key: 'staff.delete_staff',
    nameAr: 'حذف أو أرشفة الموظف',
    nameEn: 'Archive / Delete Staff Member',
    viewId: 'staff',
    descriptionAr: 'أرشفة الموظف أو إيقاف حسابه',
  },

  // Shift Reports
  {
    key: 'shift_reports.print',
    nameAr: 'طباعة تقرير الشيفت المؤرشف',
    nameEn: 'Print Archived Shift Report',
    viewId: 'shift_reports',
    descriptionAr: 'طباعة تقرير تفصيلي لأي شيفت تاريخي مقفل',
  },
  {
    key: 'shift_reports.export',
    nameAr: 'تصدير تقارير الشيفتات إلى إكسيل',
    nameEn: 'Export Shift Reports to Excel',
    viewId: 'shift_reports',
    descriptionAr: 'تصدير جدول الشيفتات وحركات التشغيل لملف Excel',
  },

  // Inventory
  {
    key: 'inventory.add_item',
    nameAr: 'إضافة أصناف وخدمات جديدة',
    nameEn: 'Add New Products / Services',
    viewId: 'inventory',
    descriptionAr: 'تسجيل بطاقة صنف جديدة بالباركود وأسعار الشراء والبيع',
  },
  {
    key: 'inventory.delete_item',
    nameAr: 'حذف الأصناف من النظام',
    nameEn: 'Delete Products',
    viewId: 'inventory',
    descriptionAr: 'حذف المنتج نهائياً من قاعدة البيانات',
  },
  {
    key: 'inventory.adjust_stock',
    nameAr: 'تسوية الجرد المخزني',
    nameEn: 'Adjust Stock Quantities',
    viewId: 'inventory',
    descriptionAr: 'تعديل الكميات بالزيادة أو النقصان عند الجرد الفعلي',
  },
  {
    key: 'inventory.transfer',
    nameAr: 'التحويل بين المخازن',
    nameEn: 'Inter-Warehouse Transfers',
    viewId: 'inventory',
    descriptionAr: 'نقل كميات من مخزن إلى مخزن آخر',
  },

  // Parties (Customers & Suppliers)
  {
    key: 'parties.add',
    nameAr: 'إضافة عميل أو مريض جديد',
    nameEn: 'Add Customer / Patient',
    viewId: 'parties',
    descriptionAr: 'تسجيل بيانات مريض أو جهة تعامل ورصيدها الافتتاحي',
  },
  {
    key: 'parties.edit',
    nameAr: 'تعديل بيانات العملاء والمرضى',
    nameEn: 'Edit Customer / Patient',
    viewId: 'parties',
    descriptionAr: 'تعديل الهاتف أو الكود الورقي أو الاسم وبيانات الملف',
  },
  {
    key: 'parties.delete',
    nameAr: 'حذف العملاء والمرضى والموردين',
    nameEn: 'Delete Party Record',
    viewId: 'parties',
    descriptionAr: 'أرشفة أو حذف طرف التعامل من السجل',
  },
  {
    key: 'parties.import',
    nameAr: 'استيراد العملاء من ملف Excel',
    nameEn: 'Import Parties from Excel',
    viewId: 'parties',
    descriptionAr: 'استيراد وتحديث آلاف العملاء والمرضى دفعة واحدة من ملف إكسيل',
  },

  // Payment Methods
  {
    key: 'payment_methods.manage',
    nameAr: 'إضافة وتعديل طرق السداد والحسابات المرتبطة',
    nameEn: 'Manage Payment Methods & Accounts',
    viewId: 'payment_methods',
    descriptionAr: 'إضافة خزائن أو محافظ إلكترونية وربطها بالشجرة المحاسبية',
  },

  // Accounting
  {
    key: 'accounting.add_entry',
    nameAr: 'إنشاء قيود يومية يدوية',
    nameEn: 'Create Manual Journal Entries',
    viewId: 'accounting',
    descriptionAr: 'تسجيل قيود محاسبية مركبة بين الحسابات',
  },
  {
    key: 'accounting.add_account',
    nameAr: 'إضافة وتعديل شجرة الحسابات',
    nameEn: 'Add / Edit Accounts',
    viewId: 'accounting',
    descriptionAr: 'إضافة حساب فرعي أو رئيسي في دليل الحسابات',
  },

  // Clinics
  {
    key: 'clinics.add_patient',
    nameAr: 'إنشاء وتعديل ملف مريض طبي',
    nameEn: 'Create & Edit Patient EHR',
    viewId: 'clinics',
    descriptionAr: 'تسجيل ملف طبي ورقم قومي وأمراض مزمنة لمريض',
  },
  {
    key: 'clinics.book_appointment',
    nameAr: 'حجز المواعيد والكشوفات الطبية',
    nameEn: 'Book Clinic Appointments',
    viewId: 'clinics',
    descriptionAr: 'إدراج موعد كشف في جدول الأطباء',
  },

  // Companies & Branches
  {
    key: 'companies.create',
    nameAr: 'إضافة شركات ومؤسسات جديدة',
    nameEn: 'Create New Companies',
    viewId: 'companies',
    descriptionAr: 'إنشاء شركة جديدة وتحديد موديولاتها ونسبة ضريبتها',
  },
  {
    key: 'companies.edit',
    nameAr: 'تعديل موديولات وبيانات الشركات',
    nameEn: 'Edit Company & Modules',
    viewId: 'companies',
    descriptionAr: 'تعديل الاسم والبطاقة الضريبية والموديولات المصاحبة',
  },
  {
    key: 'branches.manage',
    nameAr: 'إضافة وإدارة الفروع',
    nameEn: 'Create & Manage Branches',
    viewId: 'companies',
    descriptionAr: 'إضافة فرع جديد للشركة وتحديد مكانه وهاتفه',
  },
  {
    key: 'warehouses.manage',
    nameAr: 'إضافة وإدارة المخازن',
    nameEn: 'Create & Manage Warehouses',
    viewId: 'companies',
    descriptionAr: 'إضافة مخزن تخزين جديد وربطه بالفرع المناسب',
  },

  // Users & RBAC
  {
    key: 'users.create',
    nameAr: 'إنشاء مستخدمين جدد وتخصيص صلاحياتهم',
    nameEn: 'Create Users & Set Scopes',
    viewId: 'users',
    descriptionAr: 'إضافة مستخدم جديد وتحديد الشركات والفروع والمخازن والأزرار المتاحة له',
  },
  {
    key: 'users.edit',
    nameAr: 'تعديل صلاحيات وحسابات المستخدمين',
    nameEn: 'Edit User Permissions & Scope',
    viewId: 'users',
    descriptionAr: 'تعديل الشركات أو الفروع أو الأزرار المتاحة لمستخدم حالي',
  },
  {
    key: 'users.delete',
    nameAr: 'حذف وإلغاء تفعيل المستخدمين',
    nameEn: 'Delete or Deactivate Users',
    viewId: 'users',
    descriptionAr: 'إيقاف حساب موظف أو حذفه نهائياً من النظام',
  },

  // Accounting posting & period locks (محرك قواعد الترحيل)
  {
    key: 'accounting.post_journal',
    nameAr: 'ترحيل القيود المحاسبية',
    nameEn: 'Post Journal Entries',
    viewId: 'accounting_mapping',
    descriptionAr: 'ترحيل مستند محاسبي بقيد يُبنى من قواعد الربط فقط (بدون أي مصدر آخر)',
  },
  {
    key: 'accounting.lock_period',
    nameAr: 'إقفال الفترات المحاسبية',
    nameEn: 'Lock Accounting Periods',
    viewId: 'accounting_mapping',
    descriptionAr: 'إقفال فترة حتى تاريخ معيّن لمنع أي ترحيل أو تعديل داخلها',
  },
  {
    key: 'accounting.open_period',
    nameAr: 'فتح الفترات المحاسبية المقفلة',
    nameEn: 'Reopen Accounting Periods',
    viewId: 'accounting_mapping',
    descriptionAr: 'فتح فترة مقفلة — صلاحية حساسة يجب حصرها على المدير المالي',
  },

  // Architecture Guardrails (شاشة معمارية المنظومة الجديدة)
  {
    key: 'architecture.run_guardrails',
    nameAr: 'تشغيل بوابات الفحص المعماري وإعادة تقييمها',
    nameEn: 'Run & Re-evaluate Architecture Guardrails',
    viewId: 'architecture',
    descriptionAr:
      'السماح بإعادة تقييم بوابات الجودة (حد 300 سطر، تسجيل الأزرار، الثوابت المعمارية) وعرض نتائجها',
  },
  {
    key: 'architecture.copy_snippet',
    nameAr: 'نسخ مقتطفات الكود المعتمد',
    nameEn: 'Copy Approved Code Snippets',
    viewId: 'architecture',
    descriptionAr: 'السماح بنسخ مقتطفات التنفيذ المعتمد وملف بوابات الـ CI من الشاشة',
  },
];
