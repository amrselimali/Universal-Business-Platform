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

const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${getApiToken()}`,
  'Content-Type': 'application/json',
});

/** إضافة أو تعديل حقل كيان، ثم تحديث الكاش فوراً. */
export async function saveMetadataField(input: SaveFieldInput): Promise<MetadataWriteResult> {
  if (!isApiConfigured() || !getApiToken()) {
    return { ok: false, error: 'api_not_configured' };
  }

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
      return { ok: false, error: (payload as any)?.message || (payload as any)?.error || 'save_failed' };
    }

    // تحديث فوري للكاش حتى ترى الواجهة التغيير بلا إعادة تحميل.
    await loadMetadataRegistry(true);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'network_error' };
  }
}

/** حذف حقل كيان. */
export async function deleteMetadataField(fieldId: number): Promise<MetadataWriteResult> {
  if (!isApiConfigured() || !getApiToken()) {
    return { ok: false, error: 'api_not_configured' };
  }

  try {
    const response = await fetch(`${getApiUrl()}/metadata/fields/${fieldId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return { ok: false, error: (payload as any)?.message || (payload as any)?.error || 'delete_failed' };
    }

    await loadMetadataRegistry(true);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'network_error' };
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