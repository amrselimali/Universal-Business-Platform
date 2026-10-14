import React from 'react';
import { Save, Trash2 } from 'lucide-react';
import { METADATA_DATA_TYPES } from '../services/metadataStudioApi';
import type { MetadataField } from '../services/metadataRegistry';

/**
 * صف تعديل حقل واحد في استوديو الـ Metadata
 * ---------------------------------------------------------------------------
 * فُصل من MetadataStudioView.tsx للحفاظ على حجم الملف تحت الحد المسموح،
 * ولأن الصف وحدة مستقلة تماماً: يعرض حقلاً ويبلّغ الأب بالتغييرات.
 */

export interface FieldDraft {
  id?: number;
  labelAr: string;
  labelEn: string;
  dataType: string;
  isRequired: boolean;
  isReadonly: boolean;
  gridVisible: boolean;
  formOrder: number;
  width: number;
}

export const toDraft = (field: MetadataField): FieldDraft => ({
  id: field.id,
  labelAr: field.labelAr,
  labelEn: field.labelEn,
  dataType: field.dataType,
  isRequired: field.isRequired,
  isReadonly: field.isReadonly,
  gridVisible: field.gridVisible,
  formOrder: field.formOrder,
  width: field.width,
});

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold outline-none focus:border-indigo-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

interface MetadataFieldRowProps {
  field: MetadataField;
  draft: FieldDraft;
  dirty: boolean;
  canEdit: boolean;
  busy: boolean;
  isArabic: boolean;
  t: (ar: string, en: string) => string;
  onDraftChange: (fieldId: number, patch: Partial<FieldDraft>) => void;
  onSave: (field: MetadataField) => void;
  onDelete: (field: MetadataField) => void;
}

export const MetadataFieldRow: React.FC<MetadataFieldRowProps> = ({
  field,
  draft,
  dirty,
  canEdit,
  busy,
  isArabic,
  t,
  onDraftChange,
  onSave,
  onDelete,
}) => {
  const id = field.id ?? -1;

  return (
    <tr
      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
        dirty ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
      }`}
    >
      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{field.columnName}</td>
      <td className="px-3 py-2">
        <input
          value={draft.labelAr}
          disabled={!canEdit}
          onChange={(e) => onDraftChange(id, { labelAr: e.target.value })}
          className={INPUT_CLASS}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={draft.dataType}
          disabled={!canEdit}
          onChange={(e) => onDraftChange(id, { dataType: e.target.value })}
          className={INPUT_CLASS}
        >
          {METADATA_DATA_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {isArabic ? dt.labelAr : dt.labelEn}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.isRequired}
          disabled={!canEdit}
          onChange={(e) => onDraftChange(id, { isRequired: e.target.checked })}
          className="h-4 w-4 accent-indigo-600"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.isReadonly}
          disabled={!canEdit}
          onChange={(e) => onDraftChange(id, { isReadonly: e.target.checked })}
          className="h-4 w-4 accent-indigo-600"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.gridVisible}
          disabled={!canEdit}
          onChange={(e) => onDraftChange(id, { gridVisible: e.target.checked })}
          className="h-4 w-4 accent-indigo-600"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={draft.formOrder}
          disabled={!canEdit}
          onChange={(e) => onDraftChange(id, { formOrder: Number(e.target.value) || 0 })}
          className={`${INPUT_CLASS} w-16`}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSave(field)}
            disabled={!canEdit || busy || !dirty}
            className="rounded-lg bg-indigo-600 p-1.5 text-white hover:bg-indigo-700 disabled:opacity-30"
            title={t('حفظ', 'Save')}
          >
            <Save className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(field)}
            disabled={!canEdit || busy}
            className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 disabled:opacity-30 dark:bg-rose-950/40 dark:text-rose-400"
            title={t('حذف', 'Delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};


/** رأس جدول الحقول — مشترك مع الصفوف لضمان تطابق الأعمدة. */
export const MetadataFieldsHeader: React.FC<{
  t: (ar: string, en: string) => string;
}> = ({ t }) => (
  <thead className="bg-slate-50 dark:bg-slate-800/60">
    <tr>
      {[
        ['العمود', 'Column'],
        ['التسمية (ع)', 'Label (AR)'],
        ['النوع', 'Type'],
        ['إجباري', 'Required'],
        ['للقراءة', 'Read-only'],
        ['في الشبكة', 'In grid'],
        ['الترتيب', 'Order'],
        ['إجراءات', 'Actions'],
      ].map(([ar, en]) => (
        <th
          key={en}
          className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300"
        >
          {t(ar, en)}
        </th>
      ))}
    </tr>
  </thead>
);
