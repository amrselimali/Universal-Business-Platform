import type { ElementType } from 'react';

/**
 * عناصر لوحة الأوامر (Command Palette Items) — Ctrl+K
 * ---------------------------------------------------------------------------
 * فُصلت من `CommandPaletteModal.tsx` لأن الملف كان يتجاوز حد 300 سطر، ولأن
 * إضافة شاشة جديدة للوحة يجب أن تكون سطراً واحداً هنا لا تعديلاً في مكوّن الواجهة.
 *
 * ملاحظة صلاحيات: العناصر تُفلتَر وقت العرض بـ `canAccessView` (وبـ `actionKey`
 * إن وُجد) — فلا تظهر شاشة لمستخدم غير مصرح له بها.
 */
import {
  Calendar,
  Activity,
  ShoppingCart,
  Users,
  UserCheck,
  FileText,
  Warehouse,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  SlidersHorizontal,
  BookOpen,
  Zap,
  Network,
} from 'lucide-react';

export interface PaletteItem {
  id: string;
  titleAr: string;
  titleEn: string;
  categoryAr: string;
  categoryEn: string;
  icon: ElementType;
  shortcut?: string;
  viewId: string;
  actionKey?: string;
}

export const COMMAND_PALETTE_ITEMS: PaletteItem[] = [] = [
    {
      id: 'bookings',
      titleAr: 'إدارة ومتابعة الحجوزات ومواعيد الدوام',
      titleEn: 'Bookings Management & Staff Schedule',
      categoryAr: 'العمليات',
      categoryEn: 'Operations',
      icon: Calendar,
      shortcut: 'F4',
      viewId: 'bookings',
    },
    {
      id: 'reception_ops',
      titleAr: 'شاشة التشغيل (الريسيبشن والنبضات)',
      titleEn: 'Reception Operations Run-Sheet',
      categoryAr: 'العمليات',
      categoryEn: 'Operations',
      icon: Activity,
      shortcut: 'F3',
      viewId: 'reception_ops',
    },
    {
      id: 'pos',
      titleAr: 'نقطة البيع السريعة وفواتير الكاشير',
      titleEn: 'Fast POS Cashier Terminal',
      categoryAr: 'المبيعات',
      categoryEn: 'Sales',
      icon: ShoppingCart,
      shortcut: 'F2',
      viewId: 'pos',
    },
    {
      id: 'parties',
      titleAr: 'دليل المرضى والعملاء 360',
      titleEn: 'Patients & Customers Directory',
      categoryAr: 'العملاء',
      categoryEn: 'Customers',
      icon: Users,
      shortcut: 'F6',
      viewId: 'parties',
    },
    {
      id: 'staff',
      titleAr: 'إدارة الأطباء ومقدمي الخدمة والموظفين',
      titleEn: 'Doctors, Service Providers & Staff',
      categoryAr: 'الكوادر',
      categoryEn: 'Staff',
      icon: UserCheck,
      shortcut: 'F8',
      viewId: 'staff',
    },
    {
      id: 'laser_devices',
      titleAr: 'أجهزة الليزر ومتابعة الصيانة والعدادات',
      titleEn: 'Laser Devices & Maintenance',
      categoryAr: 'الأجهزة',
      categoryEn: 'Equipment',
      icon: Zap,
      viewId: 'laser_devices',
    },
    {
      id: 'cash_receipts',
      titleAr: 'سندات القبض النقدية والتحصيل',
      titleEn: 'Cash Receipt Vouchers',
      categoryAr: 'المالية',
      categoryEn: 'Finance',
      icon: ArrowDownLeft,
      shortcut: 'F7',
      viewId: 'cash_receipts',
    },
    {
      id: 'cash_payments',
      titleAr: 'سندات الصرف النقدية والمصروفات',
      titleEn: 'Cash Payment Vouchers',
      categoryAr: 'المالية',
      categoryEn: 'Finance',
      icon: ArrowUpRight,
      viewId: 'cash_payments',
    },
    {
      id: 'invoices',
      titleAr: 'سجل فواتير المبيعات المكتملة',
      titleEn: 'Sales Invoices Log',
      categoryAr: 'المبيعات',
      categoryEn: 'Sales',
      icon: FileText,
      viewId: 'invoices',
    },
    {
      id: 'inventory_mgmt',
      titleAr: 'إدارة المخازن والجرد والتحويلات',
      titleEn: 'Warehouse & Stock Inventory',
      categoryAr: 'المخازن',
      categoryEn: 'Inventory',
      icon: Warehouse,
      viewId: 'inventory_mgmt',
    },
    {
      id: 'users',
      titleAr: 'إدارة المستخدمين وصلاحيات الأدوار والشاشات',
      titleEn: 'Users & Roles Permissions (RBAC)',
      categoryAr: 'الإدارة',
      categoryEn: 'Admin',
      icon: ShieldCheck,
      viewId: 'users',
    },
    {
      id: 'companies',
      titleAr: 'إدارة الشركات والفروع والمخازن',
      titleEn: 'Companies, Branches & Warehouses',
      categoryAr: 'الإدارة',
      categoryEn: 'Admin',
      icon: Building2,
      viewId: 'companies',
    },
    {
      id: 'modules',
      titleAr: 'تخصيص وتفعيل موديولات النظام',
      titleEn: 'Module Configurations',
      categoryAr: 'الإدارة',
      categoryEn: 'Admin',
      icon: SlidersHorizontal,
      viewId: 'modules',
    },
    {
      id: 'system_manual',
      titleAr: 'دليل المستخدم والتوثيق التقني الشامل',
      titleEn: 'System User Manual & Tech Specs',
      categoryAr: 'المساعدة',
      categoryEn: 'Help',
      icon: BookOpen,
      shortcut: 'F1',
      viewId: 'system_manual',
    },
    {
      id: 'architecture',
      titleAr: 'معمارية المنظومة الجديدة وبوابات الفحص المعماري',
      titleEn: 'New System Architecture & CI Guardrails',
      categoryAr: 'المساعدة',
      categoryEn: 'Help',
      icon: Network,
      viewId: 'architecture',
    },
  ];
