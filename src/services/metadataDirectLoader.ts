/**
 * تحميل الـ Metadata عبر الاتصال المباشر بقاعدة البيانات
 * ---------------------------------------------------------------------------
 * ⚠️ سبب وجود هذا الملف:
 *   خدمة `metadataRegistry` كانت تُحمّل من الـ API **فقط**. والـ API اختياري
 *   (يُفعَّل بضبط `erp_api_url`)، بينما الوضع الافتراضي هو الاتصال المباشر
 *   بقاعدة البيانات. النتيجة: من يستخدم الاتصال المباشر **لا يُحمَّل عنده
 *   محرك الشاشات أبداً** ويظل يرى «محرك الشاشات غير مهيأ بعد» رغم تشغيل الـ SQL.
 *
 * الحل: مسار قراءة مباشر من جداول `erp_*` يعمل مع الاتصال المباشر.
 */

import { neon } from '@neondatabase/serverless';
import { getEffectiveNeonConnectionString } from './neonConfig';
import type { MetadataRegistry } from './metadataRegistry';

/** صف قاعدة بيانات — مكتبة Neon تُعيد `any`. */
type Row = Record<string, unknown>;

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const str = (value: unknown, fallback = ''): string =>
  value === null || value === undefined ? fallback : String(value);

/**
 * يقرأ تعريفات محرك الشاشات من قاعدة البيانات مباشرة.
 *
 * @returns الـ registry جاهزاً، أو `null` إذا لم يكن هناك اتصال مباشر مضبوط
 *          أو لم تكن الجداول موجودة بعد.
 */
export async function loadMetadataFromDirectDb(): Promise<MetadataRegistry | null> {
  const connectionString = getEffectiveNeonConnectionString();
  if (!connectionString) return null;

  try {
    const sql = neon(connectionString.trim());

    const [views, actions, entities, fields, screens] = await Promise.all([
      sql.query(
        `SELECT id, name_ar, name_en, description_ar, description_en,
                icon_name, category, sort_order
           FROM erp_views WHERE is_active = TRUE
          ORDER BY sort_order, id`
      ),
      sql.query(
        `SELECT key, name_ar, name_en, view_id, description_ar, description_en, sort_order
           FROM erp_actions ORDER BY sort_order, key`
      ),
      sql.query(
        `SELECT code, table_name, display_name_ar, display_name_en, view_id, soft_delete
           FROM erp_entities WHERE is_active = TRUE ORDER BY code`
      ),
      sql.query(
        `SELECT id, entity_code, column_name, label_ar, label_en, data_type,
                is_required, is_readonly, grid_visible, form_order, width
           FROM erp_entity_fields ORDER BY entity_code, form_order`
      ),
      sql.query(
        `SELECT code, view_id, entity_code, kind, route, menu_group, sort_order, icon
           FROM erp_screens ORDER BY sort_order, code`
      ),
    ]);

    const viewRows = (Array.isArray(views) ? views : []) as Row[];
    const actionRows = (Array.isArray(actions) ? actions : []) as Row[];
    const entityRows = (Array.isArray(entities) ? entities : []) as Row[];
    const fieldRows = (Array.isArray(fields) ? fields : []) as Row[];
    const screenRows = (Array.isArray(screens) ? screens : []) as Row[];

    // لا كيانات = الجداول فارغة أو الـ SQL لم يُشغَّل بعد
    if (entityRows.length === 0) return null;

    const fieldsByEntity = new Map<string, MetadataRegistry['entities'][number]['fields']>();
    for (const row of fieldRows) {
      const key = str(row.entity_code);
      const list = fieldsByEntity.get(key) ?? [];
      list.push({
        id: num(row.id),
        columnName: str(row.column_name),
        labelAr: str(row.label_ar),
        labelEn: str(row.label_en, str(row.column_name)),
        dataType: str(row.data_type, 'string'),
        isRequired: row.is_required === true,
        isReadonly: row.is_readonly === true,
        gridVisible: row.grid_visible !== false,
        formOrder: num(row.form_order, 10),
        width: num(row.width, 150),
      });
      fieldsByEntity.set(key, list);
    }

    return {
      views: viewRows.map((v, i) => ({
        id: str(v.id),
        nameAr: str(v.name_ar),
        nameEn: str(v.name_en, str(v.name_ar)),
        descriptionAr: str(v.description_ar),
        descriptionEn: str(v.description_en),
        iconName: str(v.icon_name, 'Layers'),
        category: str(v.category, 'operations'),
        sortOrder: num(v.sort_order, (i + 1) * 10),
      })),
      actions: actionRows.map((a, i) => ({
        key: str(a.key),
        nameAr: str(a.name_ar),
        nameEn: str(a.name_en, str(a.name_ar)),
        viewId: a.view_id === null || a.view_id === undefined ? null : str(a.view_id),
        descriptionAr: str(a.description_ar) || undefined,
        descriptionEn: str(a.description_en) || undefined,
        sortOrder: num(a.sort_order, (i + 1) * 10),
      })),
      entities: entityRows.map((e) => ({
        code: str(e.code),
        tableName: str(e.table_name),
        displayNameAr: str(e.display_name_ar, str(e.code)),
        displayNameEn: str(e.display_name_en, str(e.code)),
        viewId: e.view_id === null || e.view_id === undefined ? null : str(e.view_id),
        softDelete: e.soft_delete !== false,
        fields: fieldsByEntity.get(str(e.code)) ?? [],
      })),
      screens: screenRows.map((s, i) => ({
        code: str(s.code),
        viewId: s.view_id === null || s.view_id === undefined ? null : str(s.view_id),
        entityCode: s.entity_code === null || s.entity_code === undefined ? null : str(s.entity_code),
        kind: str(s.kind, 'grid'),
        route: str(s.route),
        menuGroup: str(s.menu_group, 'عام'),
        sortOrder: num(s.sort_order, (i + 1) * 10),
        icon: str(s.icon, 'Layers'),
      })),
      source: 'database',
      loadedAt: new Date().toISOString(),
    };
  } catch {
    // الجداول غير موجودة بعد، أو الاتصال غير متاح — نرجع null بهدوء.
    return null;
  }
}
