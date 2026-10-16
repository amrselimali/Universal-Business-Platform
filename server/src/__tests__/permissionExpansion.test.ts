import { describe, expect, it } from 'vitest';
import { ACTION_EXPANSION, expandPermissions } from '../permissionExpansion.js';

/**
 * اختبارات توسيع الصلاحيات.
 *
 * هذه الثغرة كانت تمنع أي مستخدم غير المدير من الكتابة عبر الـ API:
 * أفعال الواجهة (`pos.checkout`) لا تطابق الأفعال العامة التي يفرضها
 * الـ API (`record.save`) ⇒ 403 على كل عملية.
 */

describe('expandPermissions', () => {
  it('يُضيف الفعل العام المطلوب لفعل الواجهة', () => {
    const result = expandPermissions(['pos.checkout']);
    expect(result).toContain('pos.checkout'); // الأصل محفوظ
    expect(result).toContain('record.save'); // الفعل العام المطلوب
    expect(result).toContain('receipt.create');
  });

  it('يحفظ الفعل الأصلي دائماً', () => {
    expect(expandPermissions(['parties.add'])).toContain('parties.add');
  });

  it('لا يُضيف أفعالاً عامة لأفعال القراءة/الطباعة (لا كتابة)', () => {
    const result = expandPermissions(['pos.print', 'shift_reports.export']);
    expect(result).toEqual(['pos.print', 'shift_reports.export']);
  });

  it('يجمع الأفعال العامة من عدة أفعال واجهة بلا تكرار', () => {
    const result = expandPermissions(['parties.add', 'parties.edit', 'bookings.create_booking']);
    const saves = result.filter((a) => a === 'record.save');
    expect(saves).toHaveLength(1); // بلا تكرار
  });

  it('يُضيف record.delete لأفعال الحذف فقط', () => {
    expect(expandPermissions(['parties.delete'])).toContain('record.delete');
    expect(expandPermissions(['parties.add'])).not.toContain('record.delete');
  });

  it('يُضيف أفعال المحاسبة لأفعال القيود', () => {
    const result = expandPermissions(['accounting.add_entry']);
    expect(result).toContain('journal.post');
    expect(result).toContain('journal.reverse');
  });

  it('النجمة تعني كل شيء — بلا توسيع', () => {
    expect(expandPermissions(['*'])).toEqual(['*']);
    expect(expandPermissions(['pos.checkout', '*'])).toEqual(['*']);
  });

  it('قائمة فارغة تبقى فارغة (Default-Deny)', () => {
    expect(expandPermissions([])).toEqual([]);
  });

  it('الفعل غير المعروف لا يُضيف شيئاً (أمان)', () => {
    expect(expandPermissions(['unknown.action'])).toEqual(['unknown.action']);
  });

  it('كل فعل مسجّل في خريطة التوسيع له قيمة صحيحة', () => {
    const allowed = ['record.save', 'record.delete', 'journal.post', 'journal.reverse', 'receipt.create'];
    Object.values(ACTION_EXPANSION).forEach((generics) => {
      generics.forEach((g) => expect(allowed).toContain(g));
    });
  });

  it('كل فعل حقيقي في الواجهة له مدخل في الخريطة', () => {
    // الأفعال الـ 44 المسجّلة في التطبيق — يجب ألا يُنسى أي منها
    const uiActions = [
      'reception_ops.open_shift', 'reception_ops.close_shift', 'reception_ops.add_run_row',
      'reception_ops.edit_row', 'reception_ops.add_expense', 'reception_ops.adjust_balance',
      'reception_ops.print_shift', 'bookings.create_booking', 'bookings.edit_booking',
      'bookings.cancel_booking', 'bookings.reschedule_booking', 'bookings.mark_attendance',
      'bookings.add_followup', 'bookings.manage_staff_schedule', 'pos.checkout', 'pos.discount',
      'pos.tax_edit', 'pos.close_shift', 'pos.print', 'staff.add_staff', 'staff.edit_staff',
      'staff.delete_staff', 'shift_reports.print', 'shift_reports.export', 'inventory.add_item',
      'inventory.delete_item', 'inventory.adjust_stock', 'inventory.transfer', 'parties.add',
      'parties.edit', 'parties.delete', 'parties.import', 'payment_methods.manage',
      'accounting.add_entry', 'accounting.add_account', 'clinics.add_patient',
      'clinics.book_appointment', 'companies.create', 'companies.edit', 'branches.manage',
      'warehouses.manage', 'users.create', 'users.edit', 'users.delete',
    ];

    const missing = uiActions.filter((a) => !(a in ACTION_EXPANSION));
    expect(missing).toEqual([]);
  });
});
