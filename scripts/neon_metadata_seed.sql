-- =========================================================================
-- بيانات محرك الشاشات (Metadata Engine) — مولَّد آلياً
-- =========================================================================
-- ⚠️ لا تُحرّر هذا الملف يدوياً.
--    المصدر: src/data/permissionsData.ts  (SYSTEM_VIEWS + SYSTEM_ACTIONS)
--    التوليد: npx tsx scripts/generate_metadata_seed.ts
--
-- شغّله بعد neon_metadata_engine.sql
-- =========================================================================

-- 1) الشاشات (22 شاشة) ----------------------------------
INSERT INTO erp_views (id, name_ar, name_en, description_ar, description_en, icon_name, category, sort_order) VALUES
  ('dashboard', 'لوحة التحكم والتحليلات', 'Dashboard & Analytics', 'مؤشرات الأداء الرئيسية والملخصات المالية والرسوم البيانية', 'KPI metrics, financial snapshots, and real-time overview', 'LayoutDashboard', 'core', 10),
  ('reception_ops', 'شاشة التشغيل (الريسيبشن)', 'Reception Operations', 'تسجيل حركات التشغيل اليومية، النبضات، المصروفات، وتسوية الشيفت وطباعة التقرير', 'Daily shift run-sheet, pulses counter, expenses, and shift balancing', 'Activity', 'operations', 20),
  ('bookings', 'إدارة الحجوزات', 'Bookings Management', 'جدول مواعيد المرضى، حجوزات اليوم، اليوم التالي، وقائمة اتصالات المتابعة', 'Patient appointments, today/tomorrow schedule, and follow-up CRM', 'CalendarCheck', 'operations', 30),
  ('pos', 'نقطة البيع السريعة (POS)', 'Fast POS Terminal', 'شاشة الكاشير السريعة لإصدار فواتير المبيعات والباركود', 'Quick cashier register, barcode scan, and instant invoice checkout', 'ShoppingCart', 'operations', 40),
  ('invoices', 'سجل فواتير المبيعات', 'Sales Invoices Log', 'استعراض والبحث في الفواتير المكتملة والإيصالات وحالات الدفع', 'Browse completed sales invoices, receipts, and payment statuses', 'Receipt', 'operations', 50),
  ('parties', 'المرضى والعملاء 360', 'Patients & Customers Directory', 'دليل المرضى والعملاء، الأكواد الورقية، الملفات الطبية واستيراد إكسيل', 'Patients and customers master directory with codes, medical records and phone numbers', 'Users', 'operations', 60),
  ('suppliers', 'سجل وإدارة الموردين', 'Suppliers Directory', 'دليل الموردين، حسابات الموردين، الأرصدة المستحقة وكشوف الحسابات', 'Suppliers master directory with payable balances, tax IDs and statements', 'Truck', 'operations', 70),
  ('staff', 'الأطباء والتمريض وفريق العمل', 'Doctors & Staff Directory', 'إدارة الكادر الطبي، الأطباء والاستشاريين والتمريض والمهن', 'Doctors, specialists, nurses, and operational staff directory', 'UserCheck', 'operations', 80),
  ('attendance', 'إدارة الحضور والانصراف والبصمة', 'Staff Attendance & Biometrics', 'تسجيل الحضور اليدوي، الربط بأجهزة البصمة الخارجية، وساعات العمل والتأخير', 'Daily attendance logs, external biometric device sync, working hours and lateness', 'Clock', 'operations', 90),
  ('inventory', 'المخازن والأصناف والخدمات', 'Inventory & Services Catalog', 'إدارة المنتجات والخدمات، متابعة الأرصدة، والتحويلات والتسويات المخزنية', 'Catalog, multi-warehouse stock levels, transfers & adjustments', 'Package', 'operations', 100),
  ('payment_methods', 'طرق الدفع والسداد', 'Payment Methods & Gateways', 'إدارة طرق التحصيل والصرف (كاش، فيزا، إنستاباي، فودافون كاش)', 'Manage payment methods (Cash, Visa, InstaPay, Mobile Wallets)', 'CreditCard', 'operations', 110),
  ('shift_reports', 'تقارير الشيفتات المقفلة', 'Shift Reports & History', 'أرشيف الشيفتات المقفلة مع حركات التشغيل والمصروفات وطباعة التقارير', 'Historical closed shifts archive, detailed run-sheet logs, and printing', 'FileSpreadsheet', 'operations', 120),
  ('accounting', 'الشجرة المحاسبية والقيود', 'Chart of Accounts & GL', 'دليل الحسابات التفاعلي والقيود المحاسبية الآلية واليدوية وميزان المراجعة', 'Interactive chart of accounts, manual journals, and trial balance', 'Calculator', 'core', 130),
  ('audit_trail', 'سجل التعديلات والمحذوفات', 'Audit Trail (Changes & Deletions)', 'التتبع الأمني الدقيق لكافة التعديلات وحذف السجلات وتعديل الأسماء مع التوقيت والمستخدم', 'Security audit trail tracking edits, cancellations, and deletions with timestamps', 'History', 'admin', 140),
  ('activity_logs', 'سجل نشاط المستخدمين', 'User Activity Logs', 'سجل التفاعلات اليومية للمستخدمين والتنقل بين الشاشات والعمليات', 'Comprehensive user interaction and operational event logs', 'ScrollText', 'admin', 150),
  ('clinics', 'العيادات والسجلات الطبية', 'Clinics & Patient Records', 'سجلات المرضى الإلكترونية، المتابعات الطبية والملفات', 'Patient EHR, clinical follow-ups, and history', 'Stethoscope', 'operations', 160),
  ('companies', 'إدارة الشركات والفروع والمخازن', 'Companies, Branches & Warehouses', 'هيكلة المؤسسة، إضافة الفروع والمخازن والتحكم بموديولات كل شركة', 'Multi-tenant hierarchy, branch/warehouse routing and module toggles', 'Building2', 'admin', 170),
  ('users', 'المستخدمين والصلاحيات (RBAC)', 'Users & Permissions', 'تحديد صلاحيات الشاشات، الفروع والمخازن المسموحة، وأزرار التحكم لكل مستخدم', 'Configure user logins, scoped branches, warehouses & in-screen buttons', 'ShieldCheck', 'admin', 180),
  ('modules', 'تخصيص وتفعيل الموديولات', 'Modules Switcher', 'تفعيل أو تعطيل الـ 15 موديول للنظام بحسب نشاط الشركة', 'Enable or disable platform business modules per tenant', 'SlidersHorizontal', 'admin', 190),
  ('metadata_studio', 'استوديو الشاشات والحقول', 'Metadata Studio', 'إدارة تعريف الشاشات والحقول من الواجهة بلا كود: تسميات، ترتيب، أنواع، وإظهار في الشبكة', 'Manage screen and field definitions without code: labels, order, types, grid visibility', 'Boxes', 'admin', 200),
  ('neon', 'قاعدة بيانات Neon PostgreSQL', 'Neon PostgreSQL Database Hub', 'لوحة التحكم والاتصال بالسيرفر السحابي ومزامنة الجداول', 'Cloud database connectivity, sync logs, and schema engine', 'Database', 'admin', 210),
  ('system_manual', 'دليل المستخدم والتوثيق التقني', 'User Manual & Tech Specs', 'الدليل الإرشادي والتوثيق المعماري ومخطط النظام ومسارات العمل', 'Comprehensive user guide, architecture specs, and system blueprints', 'BookOpen', 'admin', 220)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  icon_name = EXCLUDED.icon_name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

-- 2) الأفعال (44 فعل) ------------------------------------
INSERT INTO erp_actions (key, name_ar, name_en, view_id, description_ar, description_en, sort_order) VALUES
  ('reception_ops.open_shift', 'افتتاح وبدء شيفت جديد', 'Open New Shift', 'reception_ops', 'السماح للموظف بافتتاح وبدء شيفت تشغيل للفرع الحالي', NULL, 10),
  ('reception_ops.close_shift', 'تقفيل وإنهاء الشيفت', 'Close & Finalize Shift', 'reception_ops', 'إغلاق الشيفت وترحيل إجمالي الإيرادات والمصروفات والأرصدة', NULL, 20),
  ('reception_ops.add_run_row', 'إضافة حركة تشغيل جديدة', 'Add Shift Run Row', 'reception_ops', 'تسجيل مريض جديد في جدول التشغيل وحساب النبضات والقيمة المحصلة', NULL, 30),
  ('reception_ops.edit_row', 'تعديل حركات التشغيل واسم المريض', 'Edit Run Row & Patient Name', 'reception_ops', 'تعديل اسم المريض، الخدمة، النبضات، أو طريقة الدفع في الشيفت النشط', NULL, 40),
  ('reception_ops.add_expense', 'تسجيل مصروفات الشيفت', 'Record Shift Expense', 'reception_ops', 'إضافة مصروف نقدي أو بنكي مع توثيق وقت الصرف والبيان', NULL, 50),
  ('reception_ops.adjust_balance', 'تعديل تسوية طرق السداد وعدادات الأجهزة', 'Adjust Balancing & Device Counters', 'reception_ops', 'تسجيل التعديلات والملاحظات على تسوية الخزينة وعدادات الليزر', NULL, 60),
  ('reception_ops.print_shift', 'طباعة تقرير الشيفت', 'Print Shift Report', 'reception_ops', 'طباعة التقرير الشامل لحركات التشغيل والمصروفات وتسوية الخزائن', NULL, 70),
  ('bookings.create_booking', 'حجز موعد جديد', 'Create New Appointment', 'bookings', 'تسجيل حجز موعد جديد لمريض مع البحث والتسجيل الآلي للعميل', NULL, 80),
  ('bookings.edit_booking', 'تعديل بيانات الحجز', 'Edit Appointment', 'bookings', 'تعديل وقت وتاريخ والطبيب المعالج للموعد', NULL, 90),
  ('bookings.cancel_booking', 'إلغاء الموعد وتوثيق السبب', 'Cancel Appointment', 'bookings', 'إلغاء حجز الموعد مع تسجيل سبب الإلغاء في سجل التدقيق', NULL, 100),
  ('bookings.reschedule_booking', 'إعادة جدولة الموعد', 'Reschedule Appointment', 'bookings', 'ترحيل الموعد إلى يوم أو وقت آخر', NULL, 110),
  ('bookings.mark_attendance', 'تأكيد الحضور أو عدم الحضور', 'Mark Attendance / No-show', 'bookings', 'تحديث حالة حضور المريض في شيت اليوم', NULL, 120),
  ('bookings.add_followup', 'تسجيل متابعة مريض هاتفية', 'Add Follow-up Entry', 'bookings', 'إضافة تذكير أو اتصال متابعة جديد مع المريض', NULL, 130),
  ('bookings.manage_staff_schedule', 'تسجيل وتعديل مواعيد دوام الموظفين', 'Manage Staff Work Schedules', 'bookings', 'إضافة وتعديل وحذف أوقات ومواعيد عمل الموظفين في تبويب مواعيد الموظفين', NULL, 140),
  ('pos.checkout', 'إتمام البيع وإصدار الفاتورة', 'Checkout & Issue Invoices', 'pos', 'إمكانية إتمام سلة المشتريات وإصدار الفواتير النقدية والآجلة', NULL, 150),
  ('pos.discount', 'منح خصومات على الفاتورة', 'Apply Cart Discounts', 'pos', 'السماح بإدخال مبالغ خصم إضافية على الفاتورة', NULL, 160),
  ('pos.tax_edit', 'تعديل نسبة الضريبة بالفاتورة', 'Edit Invoice Tax Rate', 'pos', 'إمكانية تغيير نسبة الضريبة عن القيمة الافتراضية (0% أو نسب مخصصة)', NULL, 170),
  ('pos.close_shift', 'تقفيل الشيفت والجرد الأعمى', 'Close Shift & Blind Reconcile', 'pos', 'تقفيل درج النقدية وتسجيل الفروقات النقدية للشيفت', NULL, 180),
  ('pos.print', 'طباعة الإيصالات والفواتير', 'Print Sales Receipts', 'pos', 'إرسال الفاتورة للطابعة الحرارية', NULL, 190),
  ('staff.add_staff', 'إضافة طبيب أو موظف جديد', 'Add Doctor / Staff Member', 'staff', 'تسجيل بيانات طبيب أو ممرض أو موظف جديد في الفرع', NULL, 200),
  ('staff.edit_staff', 'تعديل بيانات الكادر الطبي والإداري', 'Edit Staff Member', 'staff', 'تحديث بيانات التخصص والهاتف والراتب والنسبة', NULL, 210),
  ('staff.delete_staff', 'حذف أو أرشفة الموظف', 'Archive / Delete Staff Member', 'staff', 'أرشفة الموظف أو إيقاف حسابه', NULL, 220),
  ('shift_reports.print', 'طباعة تقرير الشيفت المؤرشف', 'Print Archived Shift Report', 'shift_reports', 'طباعة تقرير تفصيلي لأي شيفت تاريخي مقفل', NULL, 230),
  ('shift_reports.export', 'تصدير تقارير الشيفتات إلى إكسيل', 'Export Shift Reports to Excel', 'shift_reports', 'تصدير جدول الشيفتات وحركات التشغيل لملف Excel', NULL, 240),
  ('inventory.add_item', 'إضافة أصناف وخدمات جديدة', 'Add New Products / Services', 'inventory', 'تسجيل بطاقة صنف جديدة بالباركود وأسعار الشراء والبيع', NULL, 250),
  ('inventory.delete_item', 'حذف الأصناف من النظام', 'Delete Products', 'inventory', 'حذف المنتج نهائياً من قاعدة البيانات', NULL, 260),
  ('inventory.adjust_stock', 'تسوية الجرد المخزني', 'Adjust Stock Quantities', 'inventory', 'تعديل الكميات بالزيادة أو النقصان عند الجرد الفعلي', NULL, 270),
  ('inventory.transfer', 'التحويل بين المخازن', 'Inter-Warehouse Transfers', 'inventory', 'نقل كميات من مخزن إلى مخزن آخر', NULL, 280),
  ('parties.add', 'إضافة عميل أو مريض جديد', 'Add Customer / Patient', 'parties', 'تسجيل بيانات مريض أو جهة تعامل ورصيدها الافتتاحي', NULL, 290),
  ('parties.edit', 'تعديل بيانات العملاء والمرضى', 'Edit Customer / Patient', 'parties', 'تعديل الهاتف أو الكود الورقي أو الاسم وبيانات الملف', NULL, 300),
  ('parties.delete', 'حذف العملاء والمرضى والموردين', 'Delete Party Record', 'parties', 'أرشفة أو حذف طرف التعامل من السجل', NULL, 310),
  ('parties.import', 'استيراد العملاء من ملف Excel', 'Import Parties from Excel', 'parties', 'استيراد وتحديث آلاف العملاء والمرضى دفعة واحدة من ملف إكسيل', NULL, 320),
  ('payment_methods.manage', 'إضافة وتعديل طرق السداد والحسابات المرتبطة', 'Manage Payment Methods & Accounts', 'payment_methods', 'إضافة خزائن أو محافظ إلكترونية وربطها بالشجرة المحاسبية', NULL, 330),
  ('accounting.add_entry', 'إنشاء قيود يومية يدوية', 'Create Manual Journal Entries', 'accounting', 'تسجيل قيود محاسبية مركبة بين الحسابات', NULL, 340),
  ('accounting.add_account', 'إضافة وتعديل شجرة الحسابات', 'Add / Edit Accounts', 'accounting', 'إضافة حساب فرعي أو رئيسي في دليل الحسابات', NULL, 350),
  ('clinics.add_patient', 'إنشاء وتعديل ملف مريض طبي', 'Create & Edit Patient EHR', 'clinics', 'تسجيل ملف طبي ورقم قومي وأمراض مزمنة لمريض', NULL, 360),
  ('clinics.book_appointment', 'حجز المواعيد والكشوفات الطبية', 'Book Clinic Appointments', 'clinics', 'إدراج موعد كشف في جدول الأطباء', NULL, 370),
  ('companies.create', 'إضافة شركات ومؤسسات جديدة', 'Create New Companies', 'companies', 'إنشاء شركة جديدة وتحديد موديولاتها ونسبة ضريبتها', NULL, 380),
  ('companies.edit', 'تعديل موديولات وبيانات الشركات', 'Edit Company & Modules', 'companies', 'تعديل الاسم والبطاقة الضريبية والموديولات المصاحبة', NULL, 390),
  ('branches.manage', 'إضافة وإدارة الفروع', 'Create & Manage Branches', 'companies', 'إضافة فرع جديد للشركة وتحديد مكانه وهاتفه', NULL, 400),
  ('warehouses.manage', 'إضافة وإدارة المخازن', 'Create & Manage Warehouses', 'companies', 'إضافة مخزن تخزين جديد وربطه بالفرع المناسب', NULL, 410),
  ('users.create', 'إنشاء مستخدمين جدد وتخصيص صلاحياتهم', 'Create Users & Set Scopes', 'users', 'إضافة مستخدم جديد وتحديد الشركات والفروع والمخازن والأزرار المتاحة له', NULL, 420),
  ('users.edit', 'تعديل صلاحيات وحسابات المستخدمين', 'Edit User Permissions & Scope', 'users', 'تعديل الشركات أو الفروع أو الأزرار المتاحة لمستخدم حالي', NULL, 430),
  ('users.delete', 'حذف وإلغاء تفعيل المستخدمين', 'Delete or Deactivate Users', 'users', 'إيقاف حساب موظف أو حذفه نهائياً من النظام', NULL, 440)
ON CONFLICT (key) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  view_id = EXCLUDED.view_id,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  sort_order = EXCLUDED.sort_order;

-- تم بنجاح.

-- 3) الكيانات (6 كيان) -------------------------------------
INSERT INTO erp_entities (code, table_name, display_name_ar, display_name_en, view_id) VALUES
  ('parties', 'parties', 'العملاء والموردون', 'Parties', 'parties'),
  ('products', 'products', 'الأصناف والخدمات', 'Products', 'inventory'),
  ('branches', 'branches', 'الفروع', 'Branches', 'companies'),
  ('warehouses', 'warehouses', 'المخازن', 'Warehouses', 'companies'),
  ('payment_methods', 'payment_methods', 'طرق السداد', 'Payment Methods', 'payment_methods'),
  ('accounts', 'accounts', 'دليل الحسابات', 'Chart of Accounts', 'accounting')
ON CONFLICT (code) DO UPDATE SET
  table_name = EXCLUDED.table_name,
  display_name_ar = EXCLUDED.display_name_ar,
  display_name_en = EXCLUDED.display_name_en,
  view_id = EXCLUDED.view_id;

-- 4) حقول الكيانات (32 حقل) --------------------------------
INSERT INTO erp_entity_fields (entity_code, column_name, label_ar, label_en, data_type, is_required, is_readonly, form_order, width) VALUES
  ('parties', 'name', 'الاسم', 'Name', 'string', TRUE, FALSE, 10, 240),
  ('parties', 'name_en', 'الاسم بالإنجليزية', 'Name (EN)', 'string', FALSE, FALSE, 20, 220),
  ('parties', 'type', 'النوع', 'Type', 'badge', TRUE, FALSE, 30, 110),
  ('parties', 'phone', 'الهاتف', 'Phone', 'string', TRUE, FALSE, 40, 140),
  ('parties', 'customerCode', 'كود العميل', 'Customer Code', 'string', FALSE, TRUE, 50, 110),
  ('parties', 'systemCode', 'كود السيستم', 'System Code', 'string', FALSE, TRUE, 60, 120),
  ('parties', 'balance', 'الرصيد', 'Balance', 'currency', FALSE, TRUE, 70, 130),
  ('products', 'nameAr', 'الاسم', 'Name', 'string', TRUE, FALSE, 10, 240),
  ('products', 'nameEn', 'الاسم بالإنجليزية', 'Name (EN)', 'string', FALSE, FALSE, 20, 220),
  ('products', 'sku', 'كود الصنف', 'SKU', 'string', TRUE, FALSE, 30, 130),
  ('products', 'barcode', 'الباركود', 'Barcode', 'string', FALSE, FALSE, 40, 150),
  ('products', 'sellingPrice', 'سعر البيع', 'Selling Price', 'currency', TRUE, FALSE, 50, 120),
  ('products', 'purchasePrice', 'سعر الشراء', 'Purchase Price', 'currency', FALSE, FALSE, 60, 120),
  ('products', 'isActive', 'مُفعّل', 'Active', 'boolean', FALSE, FALSE, 70, 90),
  ('branches', 'name', 'اسم الفرع', 'Name', 'string', TRUE, FALSE, 10, 240),
  ('branches', 'nameEn', 'الاسم بالإنجليزية', 'Name (EN)', 'string', FALSE, FALSE, 20, 220),
  ('branches', 'code', 'كود الفرع', 'Code', 'string', FALSE, FALSE, 30, 120),
  ('branches', 'city', 'المدينة', 'City', 'string', FALSE, FALSE, 40, 150),
  ('branches', 'phone', 'الهاتف', 'Phone', 'string', FALSE, FALSE, 50, 140),
  ('branches', 'isMain', 'الفرع الرئيسي', 'Main Branch', 'boolean', FALSE, TRUE, 60, 110),
  ('warehouses', 'name', 'اسم المخزن', 'Name', 'string', TRUE, FALSE, 10, 240),
  ('warehouses', 'code', 'كود المخزن', 'Code', 'string', FALSE, FALSE, 20, 120),
  ('warehouses', 'location', 'الموقع', 'Location', 'string', FALSE, FALSE, 30, 220),
  ('payment_methods', 'code', 'كود الطريقة', 'Code', 'string', TRUE, FALSE, 10, 130),
  ('payment_methods', 'nameAr', 'الاسم', 'Name', 'string', TRUE, FALSE, 20, 220),
  ('payment_methods', 'type', 'النوع', 'Type', 'badge', TRUE, FALSE, 30, 120),
  ('payment_methods', 'displayOnReceipt', 'يظهر على الإيصال', 'On Receipt', 'boolean', FALSE, FALSE, 40, 130),
  ('accounts', 'code', 'كود الحساب', 'Code', 'string', TRUE, FALSE, 10, 120),
  ('accounts', 'nameAr', 'اسم الحساب', 'Name', 'string', TRUE, FALSE, 20, 240),
  ('accounts', 'type', 'النوع', 'Type', 'badge', TRUE, FALSE, 30, 130),
  ('accounts', 'balance', 'الرصيد', 'Balance', 'currency', FALSE, TRUE, 40, 140),
  ('accounts', 'level', 'المستوى', 'Level', 'number', FALSE, TRUE, 50, 90)
ON CONFLICT (entity_code, column_name) DO UPDATE SET
  label_ar = EXCLUDED.label_ar,
  label_en = EXCLUDED.label_en,
  data_type = EXCLUDED.data_type,
  is_required = EXCLUDED.is_required,
  is_readonly = EXCLUDED.is_readonly,
  form_order = EXCLUDED.form_order,
  width = EXCLUDED.width;

-- 5) الشاشات المولّدة (6 شاشة) --------------------------------
INSERT INTO erp_screens (code, view_id, entity_code, kind, route, menu_group, sort_order, icon) VALUES
  ('parties_grid', 'parties', 'parties', 'grid', '/parties', 'العمليات', 10, 'Users'),
  ('products_grid', 'inventory', 'products', 'grid', '/products', 'العمليات', 20, 'Package'),
  ('branches_grid', 'companies', 'branches', 'grid', '/branches', 'الإدارة', 30, 'Building2'),
  ('warehouses_grid', 'companies', 'warehouses', 'grid', '/warehouses', 'الإدارة', 40, 'Warehouse'),
  ('payment_methods_grid', 'payment_methods', 'payment_methods', 'grid', '/payment-methods', 'العمليات', 50, 'CreditCard'),
  ('accounts_grid', 'accounting', 'accounts', 'grid', '/accounts', 'المحاسبة', 60, 'Calculator')
ON CONFLICT (code) DO UPDATE SET
  view_id = EXCLUDED.view_id,
  entity_code = EXCLUDED.entity_code,
  route = EXCLUDED.route,
  menu_group = EXCLUDED.menu_group,
  sort_order = EXCLUDED.sort_order,
  icon = EXCLUDED.icon;

-- تم بنجاح.
