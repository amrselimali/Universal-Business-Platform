/**
 * جلب تعريفات الـ Metadata مباشرة من قاعدة بيانات Neon السحابية
 */
import { neon } from '@neondatabase/serverless';
import { getEffectiveNeonConnectionString } from './neonConfig';
import type { MetadataField, MetadataRegistry } from './metadataRegistry';

export async function fetchRegistryFromNeon(): Promise<Partial<MetadataRegistry> | null> {
  const connStr = getEffectiveNeonConnectionString();
  if (!connStr) return null;
  try {
    const cleanUrl = connStr.trim();
    const sql = neon(cleanUrl);
    const [views, actions, entities, fields, screens] = await Promise.all([
      sql`SELECT id, name_ar, name_en, description_ar, description_en, icon_name, category, sort_order FROM erp_views WHERE is_active = TRUE ORDER BY sort_order, id`,
      sql`SELECT key, name_ar, name_en, view_id, description_ar, description_en, sort_order FROM erp_actions ORDER BY sort_order, key`,
      sql`SELECT code, table_name, display_name_ar, display_name_en, view_id, soft_delete FROM erp_entities WHERE is_active = TRUE ORDER BY code`,
      sql`SELECT id, entity_code, column_name, label_ar, label_en, data_type, is_required, is_readonly, grid_visible, form_order, width FROM erp_entity_fields ORDER BY entity_code, form_order`,
      sql`SELECT code, view_id, entity_code, kind, route, menu_group, sort_order, icon FROM erp_screens ORDER BY sort_order, code`,
    ]);

    const fieldsByEntity = new Map<string, MetadataField[]>();
    for (const row of (fields || []) as any[]) {
      const key = String(row.entity_code);
      const list = fieldsByEntity.get(key) || [];
      list.push({
        id: Number(row.id),
        columnName: String(row.column_name),
        labelAr: String(row.label_ar),
        labelEn: String(row.label_en),
        dataType: String(row.data_type),
        isRequired: Boolean(row.is_required),
        isReadonly: Boolean(row.is_readonly),
        gridVisible: Boolean(row.grid_visible),
        formOrder: Number(row.form_order),
        width: Number(row.width),
      });
      fieldsByEntity.set(key, list);
    }

    return {
      views: ((views || []) as any[]).map((v) => ({
        id: String(v.id),
        nameAr: String(v.name_ar),
        nameEn: String(v.name_en),
        descriptionAr: String(v.description_ar || ''),
        descriptionEn: String(v.description_en || ''),
        iconName: String(v.icon_name || 'Layers'),
        category: String(v.category),
        sortOrder: Number(v.sort_order),
      })),
      actions: ((actions || []) as any[]).map((a) => ({
        key: String(a.key),
        nameAr: String(a.name_ar),
        nameEn: String(a.name_en),
        viewId: a.view_id ? String(a.view_id) : null,
        descriptionAr: a.description_ar ? String(a.description_ar) : undefined,
        descriptionEn: a.description_en ? String(a.description_en) : undefined,
        sortOrder: Number(a.sort_order),
      })),
      entities: ((entities || []) as any[]).map((e) => ({
        code: String(e.code),
        tableName: String(e.table_name),
        displayNameAr: String(e.display_name_ar),
        displayNameEn: String(e.display_name_en),
        viewId: e.view_id ? String(e.view_id) : null,
        softDelete: Boolean(e.soft_delete),
        fields: fieldsByEntity.get(String(e.code)) || [],
      })),
      screens: ((screens || []) as any[]).map((s) => ({
        code: String(s.code),
        viewId: s.view_id ? String(s.view_id) : null,
        entityCode: s.entity_code ? String(s.entity_code) : null,
        kind: String(s.kind),
        route: String(s.route),
        menuGroup: String(s.menu_group),
        sortOrder: Number(s.sort_order),
        icon: String(s.icon),
      })),
      source: 'database',
      loadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Direct Neon metadata fetch warning:', err);
    return null;
  }
}
