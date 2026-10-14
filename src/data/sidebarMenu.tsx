/**
 * تعريف قائمة التنقل الجانبية (Sidebar Menu)
 * ---------------------------------------------------------------------------
 * فُصل من Sidebar.tsx لأن الملف كان سيتجاوز حد الحجم المسموح عند إضافة أي عنصر
 * جديد. الآن إضافة شاشة للقائمة = سطر واحد هنا، وملف المكوّن يبقى صغيراً.
 */

export interface MenuItemDef {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
  alwaysShow?: boolean;
  /** الموديول الذي تنتمي إليه الشاشة — يُستخدم لإخفائها عند تعطيل الموديول. */
  moduleId?: string;
  highlight?: boolean;
}

export interface MenuSectionDef {
  titleAr: string;
  titleEn: string;
  items: MenuItemDef[];
}

import {
  LayoutDashboard, ShoppingCart, Package, Calculator, Receipt, Undo2, Stethoscope, Users,
  SlidersHorizontal, Database, RotateCcw, Sparkles, Building2, ShieldCheck, CreditCard,
  Activity, Calendar, UserCheck, ShieldAlert, Clock, FileText, Wallet, Truck, Zap, Warehouse,
  Boxes, BookOpen, PackagePlus, PackageMinus, ArrowDownLeft, ArrowUpRight, Contact, Bell,
} from 'lucide-react';

export const SIDEBAR_MENU_SECTIONS: MenuSectionDef[] = [
    {
      titleAr: 'العمليات والتشغيل اليومي',
      titleEn: 'Daily Operations',
      items: [
        {
          id: 'dashboard',
          labelAr: 'لوحة التحكم والتحليلات',
          labelEn: 'Dashboard & Analytics',
          icon: LayoutDashboard,
          alwaysShow: true,
        },
        {
          id: 'reception_ops',
          labelAr: 'شاشة التشغيل',
          labelEn: 'Operations Run-Sheet',
          icon: Activity,
          alwaysShow: true,
        },
        {
          id: 'laser_devices',
          labelAr: 'أجهزة ومعدات الليزر',
          labelEn: 'Laser Devices Directory',
          icon: Zap,
          alwaysShow: true,
        },
        {
          id: 'bookings',
          labelAr: 'إدارة الحجوزات',
          labelEn: 'Bookings Management',
          icon: Calendar,
          alwaysShow: true,
        },
        {
          id: 'pos',
          labelAr: 'نقطة البيع السريعة',
          labelEn: 'Point of Sale',
          icon: ShoppingCart,
          moduleId: 'pos_sales',
        },
        {
          id: 'collection_receipts',
          labelAr: 'إيصالات التحصيل',
          labelEn: 'Collection Receipts',
          icon: Receipt,
          alwaysShow: true,
        },
        {
          id: 'customer_refunds',
          labelAr: 'تسوية مستحقات عميل',
          labelEn: 'Customer Refunds',
          icon: Undo2,
          alwaysShow: true,
        },
        {
          id: 'invoices',
          labelAr: 'سجل فواتير المبيعات',
          labelEn: 'Sales Invoices Log',
          icon: FileText,
          moduleId: 'pos_sales',
        },
      ],
    },
    {
      titleAr: 'السندات والوثائق المالية',
      titleEn: 'Fiscal Vouchers & Tax Invoices',
      items: [
        {
          id: 'cash_receipts',
          labelAr: 'سندات القبض النقدية',
          labelEn: 'Cash Receipt Vouchers',
          icon: ArrowDownLeft,
          alwaysShow: true,
        },
        {
          id: 'cash_payments',
          labelAr: 'سندات الصرف النقدية',
          labelEn: 'Cash Payment Vouchers',
          icon: ArrowUpRight,
          alwaysShow: true,
        },
        {
          id: 'tax_invoices',
          labelAr: 'فواتير المبيعات',
          labelEn: 'Sales Invoices',
          icon: FileText,
          alwaysShow: true,
        },
      ],
    },
    {
      titleAr: 'المخازن وأذونات المخازن',
      titleEn: 'Stock & Warehouse Vouchers',
      items: [
        {
          id: 'goods_receipts',
          labelAr: 'أذونات استلام مخزني',
          labelEn: 'Goods Receipt Notes',
          icon: PackagePlus,
          moduleId: 'inventory',
        },
        {
          id: 'goods_issues',
          labelAr: 'أذونات صرف مخزني',
          labelEn: 'Goods Issue Notes',
          icon: PackageMinus,
          moduleId: 'inventory',
        },
        {
          id: 'products',
          labelAr: 'إدارة المنتجات والخدمات',
          labelEn: 'Products & Services',
          icon: Boxes,
          moduleId: 'inventory',
        },
        {
          id: 'inventory_mgmt',
          labelAr: 'إدارة المخازن',
          labelEn: 'Warehouse Management',
          icon: Warehouse,
          moduleId: 'inventory',
        },
      ],
    },
    {
      titleAr: 'الكوادر والعملاء والرواتب',
      titleEn: 'Directory & Management',
      items: [
        {
          id: 'parties',
          labelAr: 'إدارة العملاء',
          labelEn: 'Customer Management',
          icon: Users,
          moduleId: 'parties',
        },
        {
          id: 'suppliers',
          labelAr: 'إدارة الموردين',
          labelEn: 'Supplier Management',
          icon: Truck,
          moduleId: 'parties',
        },
        {
          id: 'staff',
          labelAr: 'إدارة الموظفين',
          labelEn: 'Employee Management',
          icon: UserCheck,
          alwaysShow: true,
        },
        {
          id: 'attendance',
          labelAr: 'إدارة الحضور والانصراف',
          labelEn: 'Staff Attendance',
          icon: Clock,
          alwaysShow: true,
        },
        {
          id: 'payroll',
          labelAr: 'إدارة الأجور',
          labelEn: 'Payroll Management',
          icon: Wallet,
          alwaysShow: true,
        },
        {
          id: 'employee_dossier',
          labelAr: 'ملف وكشف حساب الموظف',
          labelEn: 'Employee Full Dossier',
          icon: Contact,
          alwaysShow: true,
          highlight: true,
        },
      ],
    },
    {
      titleAr: 'الحسابات والتقارير المالية',
      titleEn: 'Accounts & Financial Reports',
      items: [
        {
          id: 'payment_methods',
          labelAr: 'إدارة طرق التحصيل والسداد',
          labelEn: 'Payment & Collection Methods',
          icon: CreditCard,
          alwaysShow: true,
        },
        {
          id: 'accounting',
          labelAr: 'إدارة الحسابات',
          labelEn: 'Accounts Management',
          icon: Calculator,
          moduleId: 'accounting',
        },
        {
          id: 'shift_reports',
          labelAr: 'تقارير التشغيل',
          labelEn: 'Operations Reports',
          icon: FileText,
          alwaysShow: true,
        },
      ],
    },
    {
      titleAr: 'الرقابة والشركات والإعدادات',
      titleEn: 'Audit, Security & Platform',
      items: [
        {
          id: 'audit_trail',
          labelAr: 'سجل الرقابة والمحذوفات',
          labelEn: 'Audit Trail & Diffs',
          icon: ShieldAlert,
          alwaysShow: true,
        },
        {
          id: 'activity_logs',
          labelAr: 'سجل نشاط المستخدمين',
          labelEn: 'User Activity Logs',
          icon: Clock,
          alwaysShow: true,
        },
        {
          id: 'companies',
          labelAr: 'إدارة الشركات والفروع',
          labelEn: 'Companies & Branches',
          icon: Building2,
          alwaysShow: true,
        },
        {
          id: 'users',
          labelAr: 'المستخدمين والصلاحيات',
          labelEn: 'Users & Permissions',
          icon: ShieldCheck,
          alwaysShow: true,
        },
        {
          id: 'modules',
          labelAr: 'تخصيص وتفعيل الموديولات',
          labelEn: 'Modules Switcher',
          icon: SlidersHorizontal,
          alwaysShow: true,
          highlight: true,
        },
        {
          // استوديو الـ Metadata: إدارة الشاشات والحقول بلا كود ولا نشر.
          id: 'metadata_studio',
          labelAr: 'استوديو الشاشات والحقول',
          labelEn: 'Metadata Studio',
          icon: Boxes,
          alwaysShow: false,
          highlight: true,
        },
        {
          id: 'notifications_config',
          labelAr: 'التنبيهات الفورية وقواعد التشغيل',
          labelEn: 'Instant Alerts & Rules',
          icon: Bell,
          alwaysShow: true,
          highlight: true,
        },
        {
          id: 'neon',
          labelAr: 'قاعدة بيانات نيون السحابية',
          labelEn: 'Neon Cloud Database',
          icon: Database,
          alwaysShow: true,
        },
        {
          id: 'system_manual',
          labelAr: 'دليل المستخدم والتوثيق التقني',
          labelEn: 'User Manual & Tech Specs',
          icon: BookOpen,
          highlight: true,
        },
      ],
    },
  ];
