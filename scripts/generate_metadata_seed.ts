/**
 * مولّد بيانات الـ Metadata Engine
 * ---------------------------------------------------------------------------
 * يقرأ تعريفات الشاشات والأفعال الموجودة فعلاً في التطبيق
 * (`SYSTEM_VIEWS` و `SYSTEM_ACTIONS`) ويحوّلها إلى ملف SQL جاهز للتشغيل.
 *
 * التشغيل:  npx tsx scripts/generate_metadata_seed.ts
 * المخرج:   scripts/neon_metadata_seed.sql
 */

import { writeFileSync } from 'node:fs';
import { SYSTEM_VIEWS, SYSTEM_ACTIONS } from '../src/data/permissionsData';

const esc = (value: string | undefined | null): string =>
  value === undefined || value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;

const lines: string[] = [];

lines.push(`-- =========================================================================
-- بيانات محرك الشاشات (Metadata Engine) — مولَّد آلياً
-- =========================================================================
-- ⚠️ لا تُحرّر هذا الملف يدوياً.
--    المصدر: src/data/permissionsData.ts  (SYSTEM_VIEWS + SYSTEM_ACTIONS)
--    التوليد: npx tsx scripts/generate_metadata_seed.ts
--
-- شغّله بعد neon_metadata_engine.sql
-- =========================================================================

-- 1) الشاشات (${SYSTEM_VIEWS.length} شاشة) ----------------------------------
INSERT INTO erp_views (id, name_ar, name_en, description_ar, description_en, icon_name, category, sort_order) VALUES`);

const viewRows = SYSTEM_VIEWS.map(
  (v, i) =>
    `  (${esc(v.id)}, ${esc(v.nameAr)}, ${esc(v.nameEn)}, ${esc(v.descriptionAr)}, ${esc(
      v.descriptionEn
    )}, ${esc(v.iconName)}, ${esc(v.category)}, ${(i + 1) * 10})`
);
lines.push(viewRows.join(',\n') + '\nON CONFLICT (id) DO UPDATE SET\n' +
  '  name_ar = EXCLUDED.name_ar,\n' +
  '  name_en = EXCLUDED.name_en,\n' +
  '  description_ar = EXCLUDED.description_ar,\n' +
  '  description_en = EXCLUDED.description_en,\n' +
  '  icon_name = EXCLUDED.icon_name,\n' +
  '  category = EXCLUDED.category,\n' +
  '  sort_order = EXCLUDED.sort_order;');

lines.push(`
-- 2) الأفعال (${SYSTEM_ACTIONS.length} فعل) ------------------------------------
INSERT INTO erp_actions (key, name_ar, name_en, view_id, description_ar, description_en, sort_order) VALUES`);

const actionRows = SYSTEM_ACTIONS.map(
  (a, i) =>
    `  (${esc(a.key)}, ${esc(a.nameAr)}, ${esc(a.nameEn)}, ${esc(a.viewId)}, ${esc(
      a.descriptionAr
    )}, ${esc(a.descriptionEn)}, ${(i + 1) * 10})`
);
lines.push(actionRows.join(',\n') + '\nON CONFLICT (key) DO UPDATE SET\n' +
  '  name_ar = EXCLUDED.name_ar,\n' +
  '  name_en = EXCLUDED.name_en,\n' +
  '  view_id = EXCLUDED.view_id,\n' +
  '  description_ar = EXCLUDED.description_ar,\n' +
  '  description_en = EXCLUDED.description_en,\n' +
  '  sort_order = EXCLUDED.sort_order;');

lines.push('\n-- تم بنجاح.');

// ---------------------------------------------------------------------------
// 3) الكيانات والحقول والشاشات المولّدة
//    ⚠️ ترتيبها مهم: erp_entities يشير إلى erp_views (FK)، لذلك تُدرج
//    الشاشات والأفعال أولاً — وهو ما يحدث أعلاه.
// ---------------------------------------------------------------------------

interface EntitySeed {
  code: string;
  table: string;
  nameAr: string;
  nameEn: string;
  viewId: string;
  icon: string;
  group: string;
  fields: Array<{
    column: string;
    ar: string;
    en: string;
    type: string;
    required?: boolean;
    readonly?: boolean;
    width?: number;
  }>;
}

const ENTITIES: EntitySeed[] = [
  {
    code: 'parties', table: 'parties', nameAr: 'العملاء والموردون', nameEn: 'Parties',
    viewId: 'parties', icon: 'Users', group: 'العمليات',
    fields: [
      { column: 'name', ar: 'الاسم', en: 'Name', type: 'string', required: true, width: 240 },
      { column: 'name_en', ar: 'الاسم بالإنجليزية', en: 'Name (EN)', type: 'string', width: 220 },
      { column: 'type', ar: 'النوع', en: 'Type', type: 'badge', required: true, width: 110 },
      { column: 'phone', ar: 'الهاتف', en: 'Phone', type: 'string', required: true, width: 140 },
      { column: 'customerCode', ar: 'كود العميل', en: 'Customer Code', type: 'string', readonly: true, width: 110 },
      { column: 'systemCode', ar: 'كود السيستم', en: 'System Code', type: 'string', readonly: true, width: 120 },
      { column: 'balance', ar: 'الرصيد', en: 'Balance', type: 'currency', readonly: true, width: 130 },
    ],
  },
  {
    code: 'products', table: 'products', nameAr: 'الأصناف والخدمات', nameEn: 'Products',
    viewId: 'inventory', icon: 'Package', group: 'العمليات',
    fields: [
      { column: 'nameAr', ar: 'الاسم', en: 'Name', type: 'string', required: true, width: 240 },
      { column: 'nameEn', ar: 'الاسم بالإنجليزية', en: 'Name (EN)', type: 'string', width: 220 },
      { column: 'sku', ar: 'كود الصنف', en: 'SKU', type: 'string', required: true, width: 130 },
      { column: 'barcode', ar: 'الباركود', en: 'Barcode', type: 'string', width: 150 },
      { column: 'sellingPrice', ar: 'سعر البيع', en: 'Selling Price', type: 'currency', required: true, width: 120 },
      { column: 'purchasePrice', ar: 'سعر الشراء', en: 'Purchase Price', type: 'currency', width: 120 },
      { column: 'isActive', ar: 'مُفعّل', en: 'Active', type: 'boolean', width: 90 },
    ],
  },
  {
    code: 'branches', table: 'branches', nameAr: 'الفروع', nameEn: 'Branches',
    viewId: 'companies', icon: 'Building2', group: 'الإدارة',
    fields: [
      { column: 'name', ar: 'اسم الفرع', en: 'Name', type: 'string', required: true, width: 240 },
      { column: 'nameEn', ar: 'الاسم بالإنجليزية', en: 'Name (EN)', type: 'string', width: 220 },
      { column: 'code', ar: 'كود الفرع', en: 'Code', type: 'string', width: 120 },
      { column: 'city', ar: 'المدينة', en: 'City', type: 'string', width: 150 },
      { column: 'phone', ar: 'الهاتف', en: 'Phone', type: 'string', width: 140 },
      { column: 'isMain', ar: 'الفرع الرئيسي', en: 'Main Branch', type: 'boolean', readonly: true, width: 110 },
    ],
  },
  {
    code: 'warehouses', table: 'warehouses', nameAr: 'المخازن', nameEn: 'Warehouses',
    viewId: 'companies', icon: 'Warehouse', group: 'الإدارة',
    fields: [
      { column: 'name', ar: 'اسم المخزن', en: 'Name', type: 'string', required: true, width: 240 },
      { column: 'code', ar: 'كود المخزن', en: 'Code', type: 'string', width: 120 },
      { column: 'location', ar: 'الموقع', en: 'Location', type: 'string', width: 220 },
    ],
  },
  {
    code: 'payment_methods', table: 'payment_methods', nameAr: 'طرق السداد', nameEn: 'Payment Methods',
    viewId: 'payment_methods', icon: 'CreditCard', group: 'العمليات',
    fields: [
      { column: 'code', ar: 'كود الطريقة', en: 'Code', type: 'string', required: true, width: 130 },
      { column: 'nameAr', ar: 'الاسم', en: 'Name', type: 'string', required: true, width: 220 },
      { column: 'type', ar: 'النوع', en: 'Type', type: 'badge', required: true, width: 120 },
      { column: 'displayOnReceipt', ar: 'يظهر على الإيصال', en: 'On Receipt', type: 'boolean', width: 130 },
    ],
  },
  {
    code: 'accounts', table: 'accounts', nameAr: 'دليل الحسابات', nameEn: 'Chart of Accounts',
    viewId: 'accounting', icon: 'Calculator', group: 'المحاسبة',
    fields: [
      { column: 'code', ar: 'كود الحساب', en: 'Code', type: 'string', required: true, width: 120 },
      { column: 'nameAr', ar: 'اسم الحساب', en: 'Name', type: 'string', required: true, width: 240 },
      { column: 'type', ar: 'النوع', en: 'Type', type: 'badge', required: true, width: 130 },
      { column: 'balance', ar: 'الرصيد', en: 'Balance', type: 'currency', readonly: true, width: 140 },
      { column: 'level', ar: 'المستوى', en: 'Level', type: 'number', readonly: true, width: 90 },
    ],
  },
];


lines.push(`\n-- 3) الكيانات (${ENTITIES.length} كيان) -------------------------------------`);
lines.push('INSERT INTO erp_entities (code, table_name, display_name_ar, display_name_en, view_id) VALUES');
lines.push(
  ENTITIES.map(
    (e) => `  (${esc(e.code)}, ${esc(e.table)}, ${esc(e.nameAr)}, ${esc(e.nameEn)}, ${esc(e.viewId)})`
  ).join(',\n') +
    '\nON CONFLICT (code) DO UPDATE SET\n' +
    '  table_name = EXCLUDED.table_name,\n' +
    '  display_name_ar = EXCLUDED.display_name_ar,\n' +
    '  display_name_en = EXCLUDED.display_name_en,\n' +
    '  view_id = EXCLUDED.view_id;'
);

const fieldRows = ENTITIES.flatMap((e) =>
  e.fields.map(
    (f, idx) =>
      `  (${esc(e.code)}, ${esc(f.column)}, ${esc(f.ar)}, ${esc(f.en)}, ${esc(f.type)}, ` +
      `${f.required ? 'TRUE' : 'FALSE'}, ${f.readonly ? 'TRUE' : 'FALSE'}, ${(idx + 1) * 10}, ${f.width ?? 150})`
  )
);
lines.push(`\n-- 4) حقول الكيانات (${fieldRows.length} حقل) --------------------------------`);
lines.push(
  'INSERT INTO erp_entity_fields (entity_code, column_name, label_ar, label_en, data_type, is_required, is_readonly, form_order, width) VALUES'
);
lines.push(
  fieldRows.join(',\n') +
    '\nON CONFLICT (entity_code, column_name) DO UPDATE SET\n' +
    '  label_ar = EXCLUDED.label_ar,\n' +
    '  label_en = EXCLUDED.label_en,\n' +
    '  data_type = EXCLUDED.data_type,\n' +
    '  is_required = EXCLUDED.is_required,\n' +
    '  is_readonly = EXCLUDED.is_readonly,\n' +
    '  form_order = EXCLUDED.form_order,\n' +
    '  width = EXCLUDED.width;'
);

lines.push(`\n-- 5) الشاشات المولّدة (${ENTITIES.length} شاشة) --------------------------------`);
lines.push('INSERT INTO erp_screens (code, view_id, entity_code, kind, route, menu_group, sort_order, icon) VALUES');
lines.push(
  ENTITIES.map(
    (e, i) =>
      `  (${esc(`${e.code}_grid`)}, ${esc(e.viewId)}, ${esc(e.code)}, 'grid', ` +
      `${esc(`/${e.code.replaceAll('_', '-')}`)}, ${esc(e.group)}, ${(i + 1) * 10}, ${esc(e.icon)})`
  ).join(',\n') +
    '\nON CONFLICT (code) DO UPDATE SET\n' +
    '  view_id = EXCLUDED.view_id,\n' +
    '  entity_code = EXCLUDED.entity_code,\n' +
    '  route = EXCLUDED.route,\n' +
    '  menu_group = EXCLUDED.menu_group,\n' +
    '  sort_order = EXCLUDED.sort_order,\n' +
    '  icon = EXCLUDED.icon;'
);

lines.push('\n-- تم بنجاح.');

writeFileSync('scripts/neon_metadata_seed.sql', lines.join('\n') + '\n', 'utf8');
console.log(`تم توليد scripts/neon_metadata_seed.sql`);
console.log(`  الشاشات: ${SYSTEM_VIEWS.length}`);
console.log(`  الأفعال : ${SYSTEM_ACTIONS.length}`);
console.log(`  الكيانات: ${ENTITIES.length}`);
console.log(`  الحقول  : ${fieldRows.length}`);
