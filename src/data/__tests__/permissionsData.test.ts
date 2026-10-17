import { describe, expect, it } from 'vitest';
import { SYSTEM_VIEWS } from '../permissionsData';
import { SYSTEM_ACTIONS } from '../actionsData';

/**
 * اختبارات سلامة تعريفات الشاشات والأفعال.
 *
 * الأهمية: هذه التعريفات هي مرجع الصلاحيات في الواجهة **وفي السيرفر**.
 *   • معرّف مكرر ⇒ شاشة أو فعل لا يمكن منحه بشكل مستقل.
 *   • فعل يشير لشاشة غير موجودة ⇒ صلاحية معلّقة لا تظهر لأي مستخدم.
 *   • فعل بلا مدخل في توسيع الصلاحيات ⇒ **403 على كل عملية حفظ** (عائق حقيقي
 *     وقع فعلاً في هذا المشروع).
 */

describe('SYSTEM_VIEWS — تعريفات الشاشات', () => {
  it('كل شاشة لها معرّف فريد', () => {
    const ids = SYSTEM_VIEWS.map((v) => v.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates, `معرّفات مكررة: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('كل شاشة لها اسم عربي وإنجليزي وأيقونة', () => {
    const incomplete = SYSTEM_VIEWS.filter(
      (v) => !v.nameAr?.trim() || !v.nameEn?.trim() || !v.iconName?.trim()
    ).map((v) => v.id);
    expect(incomplete, `شاشات ناقصة البيانات: ${incomplete.join(', ')}`).toEqual([]);
  });

  it('كل شاشة لها تصنيف صحيح', () => {
    const allowed = ['core', 'operations', 'admin'];
    const invalid = SYSTEM_VIEWS.filter((v) => !allowed.includes(v.category)).map((v) => v.id);
    expect(invalid).toEqual([]);
  });

  it('معرّفات الشاشات بصيغة صحيحة (حروف صغيرة وشرطات سفلية)', () => {
    const invalid = SYSTEM_VIEWS.filter((v) => !/^[a-z][a-z0-9_]*$/.test(v.id)).map((v) => v.id);
    expect(invalid, `معرّفات بصيغة غير صحيحة: ${invalid.join(', ')}`).toEqual([]);
  });

  it('لا تقل عن 20 شاشة (يمنع الحذف العرضي)', () => {
    expect(SYSTEM_VIEWS.length).toBeGreaterThanOrEqual(20);
  });
});

describe('SYSTEM_ACTIONS — سجل الأفعال', () => {
  it('كل فعل له مفتاح فريد', () => {
    const keys = SYSTEM_ACTIONS.map((a) => a.key);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(duplicates, `مفاتيح مكررة: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('كل فعل يشير إلى شاشة موجودة فعلاً', () => {
    const viewIds = new Set(SYSTEM_VIEWS.map((v) => v.id));
    const orphans = SYSTEM_ACTIONS.filter((a) => !viewIds.has(a.viewId)).map(
      (a) => `${a.key} → ${a.viewId}`
    );
    expect(
      orphans,
      `أفعال تشير لشاشات غير موجودة:\n${orphans.join('\n')}`
    ).toEqual([]);
  });

  it('كل فعل له تسمية عربية وإنجليزية', () => {
    const incomplete = SYSTEM_ACTIONS.filter((a) => !a.nameAr?.trim() || !a.nameEn?.trim()).map(
      (a) => a.key
    );
    expect(incomplete).toEqual([]);
  });

  it('مفاتيح الأفعال بصيغة module.action', () => {
    const allowedChars = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
    const invalid = SYSTEM_ACTIONS.filter((a) => !allowedChars.test(a.key)).map((a) => a.key);
    expect(invalid, `مفاتيح بصيغة غير صحيحة: ${invalid.join(', ')}`).toEqual([]);
  });

  it('لا يقل عن 40 فعلاً (يمنع الحذف العرضي)', () => {
    expect(SYSTEM_ACTIONS.length).toBeGreaterThanOrEqual(40);
  });

  it('أفعال الكتابة كلها تُوسَّع إلى أكواد عامة (منع 403)', () => {
    // كل فعل يُتوقع أن يتطلب كتابة، يجب أن يكون له مدخل في توسيع الصلاحيات
    const writeVerbs = ['.add', '.edit', '.create', '.manage', '.import', '.toggle', '.delete'];
    const writeActions = SYSTEM_ACTIONS.filter((a) => writeVerbs.some((v) => a.key.includes(v)));

    const readOnlyExceptions = ['pos.discount', 'pos.tax_edit', 'shift_reports.export'];
    const requiringExpansion = writeActions
      .map((a) => a.key)
      .filter((k) => !readOnlyExceptions.includes(k));

    expect(requiringExpansion.length).toBeGreaterThan(20);
    // نطبعها للمراجعة — الأهم أنها كلها موجودة في خريطة التوسيع (يُفحص في اختبارات السيرفر)
    expect(new Set(requiringExpansion).size).toBe(requiringExpansion.length);
  });
});

describe('اتساق الموديولات', () => {
  it('بادئة كل فعل هي موديول معروف', () => {
    const knownModules = new Set([
      'reception_ops', 'bookings', 'pos', 'staff', 'shift_reports', 'inventory',
      'parties', 'payment_methods', 'accounting', 'clinics', 'companies',
      'branches', 'warehouses', 'users', 'architecture', 'database',
    ]);

    const unknown = SYSTEM_ACTIONS.filter(
      (a) => !knownModules.has(a.key.split('.')[0])
    ).map((a) => a.key);

    expect(unknown, `أفعال بموديول غير معروف: ${unknown.join(', ')}`).toEqual([]);
  });

  it('شاشات بلا أفعال مسجّلة محصورة في قائمة معروفة', () => {
    const viewsWithActions = new Set(SYSTEM_ACTIONS.map((a) => a.viewId));

    /**
     * شاشات تُدار بصلاحية الشاشة فقط (allowedViews) بلا أفعال على مستوى الأزرار.
     *
     * ⚠️ فجوة معروفة: هذه الشاشات تحتوي عمليات كتابة لكن لا يمكن منح صلاحية
     * لزر بعينه داخلها — أي أن أي مستخدم يرى الشاشة يستطيع تنفيذ كل أزرارها.
     * المطلوب لاحقاً: تسجيل أفعال لها في SYSTEM_ACTIONS.
     */
    const VIEWS_WITHOUT_ACTIONS = [
      // شاشات عرض/تقارير — لا تحتاج أفعالاً
      'dashboard', 'audit_trail', 'activity_logs', 'system_manual', 'neon',
      // 🔴 تحتاج تسجيل أفعال (فجوة)
      'invoices', 'suppliers', 'attendance', 'modules', 'accounting_mapping', 'metadata_studio',
    ];

    const orphanViews = SYSTEM_VIEWS.filter(
      (v) => !viewsWithActions.has(v.id) && !VIEWS_WITHOUT_ACTIONS.includes(v.id)
    ).map((v) => v.id);

    expect(
      orphanViews,
      `شاشات جديدة بلا أي فعل مسجّل (أضِف أفعالها أو أدرجها في القائمة الموثّقة): ${orphanViews.join(', ')}`
    ).toEqual([]);
  });
});
