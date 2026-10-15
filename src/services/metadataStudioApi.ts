import { getApiToken, getApiUrl, isApiConfigured } from './apiClient';
import { loadMetadataRegistry } from './metadataRegistry';

/**
 * واجهة كتابة الـ Metadata (Metadata Studio API)
 * ---------------------------------------------------------------------------
 * فُصلت من metadataRegistry.ts للحفاظ على حجم الملف تحت الحد المسموح، ولأن
 * مسؤوليتها مختلفة: registry.ts **يقرأ**، وهذا الملف **يكتب**.
 *
 * الكتابة محصورة على المدير العام — والفحص النهائي على السيرفر لا هنا.
 */

// ---------------------------------------------------------------------------

export interface SaveFieldInput {
  /** معرّف الصف — غيابه يعني إضافة حقل جديد. */
  id?: number;
  entityCode: string;
  columnName: string;
  labelAr: string;
  labelEn: string;
  dataType: string;
  isRequired?: boolean;
  isReadonly?: boolean;
  gridVisible?: boolean;
  formOrder?: number;
  width?: number;
}

export interface MetadataWriteResult {
  ok: boolean;
  error?: string;
}

import { neon } from '@neondatabase/serverless';
import { getEffectiveNeonConnectionString } from './neonConfig';

const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${getApiToken()}`,
  'Content-Type': 'application/json',
});

/** إضافة أو تعديل حقل كيان، ثم تحديث الكاش فوراً. */
export async function saveMetadataField(input: SaveFieldInput): Promise<MetadataWriteResult> {
  if (isApiConfigured() && getApiToken()) {
    const isUpdate = typeof input.id === 'number';
    const url = isUpdate
      ? `${getApiUrl()}/metadata/fields/${input.id}`
      : `${getApiUrl()}/metadata/fields`;

    try {
      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const p = payload as { message?: string; error?: string };
        return { ok: false, error: p?.message || p?.error || 'save_failed' };
      }

      await loadMetadataRegistry(true);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'network_error' };
    }
  }

  // الحفظ المباشر في قاعدة بيانات Neon السحابية
  const connStr = getEffectiveNeonConnectionString();
  if (!connStr) {
    return { ok: false, error: 'database_not_connected' };
  }

  try {
    const sql = neon(connStr);
    if (typeof input.id === 'number') {
      await sql`
        UPDATE erp_entity_fields
        SET label_ar = ${input.labelAr},
            label_en = ${input.labelEn},
            data_type = ${input.dataType},
            is_required = ${Boolean(input.isRequired)},
            is_readonly = ${Boolean(input.isReadonly)},
            grid_visible = ${input.gridVisible !== false},
            form_order = ${input.formOrder ?? 10},
            width = ${input.width ?? 150}
        WHERE id = ${input.id}
      `;
    } else {
      await sql`
        INSERT INTO erp_entity_fields
          (entity_code, column_name, label_ar, label_en, data_type,
           is_required, is_readonly, grid_visible, form_order, width)
        VALUES
          (${input.entityCode}, ${input.columnName}, ${input.labelAr}, ${input.labelEn}, ${input.dataType},
           ${Boolean(input.isRequired)}, ${Boolean(input.isReadonly)}, ${input.gridVisible !== false},
           ${input.formOrder ?? 10}, ${input.width ?? 150})
        ON CONFLICT (entity_code, column_name) DO UPDATE SET
          label_ar = EXCLUDED.label_ar,
          label_en = EXCLUDED.label_en,
          data_type = EXCLUDED.data_type,
          is_required = EXCLUDED.is_required,
          is_readonly = EXCLUDED.is_readonly,
          grid_visible = EXCLUDED.grid_visible,
          form_order = EXCLUDED.form_order,
          width = EXCLUDED.width
      `;
    }

    await loadMetadataRegistry(true);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'save_failed' };
  }
}

/** حذف حقل كيان. */
export async function deleteMetadataField(fieldId: number): Promise<MetadataWriteResult> {
  if (isApiConfigured() && getApiToken()) {
    try {
      const response = await fetch(`${getApiUrl()}/metadata/fields/${fieldId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const p = payload as { message?: string; error?: string };
        return { ok: false, error: p?.message || p?.error || 'delete_failed' };
      }

      await loadMetadataRegistry(true);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'network_error' };
    }
  }

  // الحذف المباشر من قاعدة بيانات Neon السحابية
  const connStr = getEffectiveNeonConnectionString();
  if (!connStr) {
    return { ok: false, error: 'database_not_connected' };
  }

  try {
    const sql = neon(connStr);
    await sql`DELETE FROM erp_entity_fields WHERE id = ${fieldId}`;
    await loadMetadataRegistry(true);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'delete_failed' };
  }
}

/** أنواع الحقول المتاحة في الاستوديو. */
export const METADATA_DATA_TYPES: { value: string; labelAr: string; labelEn: string }[] = [
  { value: 'string', labelAr: 'نص', labelEn: 'Text' },
  { value: 'number', labelAr: 'رقم', labelEn: 'Number' },
  { value: 'currency', labelAr: 'مبلغ مالي', labelEn: 'Currency' },
  { value: 'date', labelAr: 'تاريخ', labelEn: 'Date' },
  { value: 'boolean', labelAr: 'نعم / لا', labelEn: 'Boolean' },
  { value: 'badge', labelAr: 'شارة حالة', labelEn: 'Badge' },
  { value: 'select', labelAr: 'قائمة اختيار', labelEn: 'Select' },
  { value: 'json', labelAr: 'بيانات مركّبة', labelEn: 'JSON' },
];