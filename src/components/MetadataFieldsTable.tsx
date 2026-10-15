import React from 'react';
import { Plus } from 'lucide-react';
import type { MetadataEntity, MetadataField } from '../services/metadataRegistry';
import { MetadataFieldRow, MetadataFieldsHeader, toDraft, type FieldDraft } from './MetadataFieldRow';

interface MetadataFieldsTableProps {
  selected?: MetadataEntity;
  canEdit: boolean;
  busy: boolean;
  isArabic: boolean;
  drafts: Record<number, FieldDraft>;
  t: (ar: string, en: string) => string;
  onAddField: () => void;
  onDraftChange: (fieldId: number, patch: Partial<FieldDraft>) => void;
  onSave: (field: MetadataField) => void;
  onDelete: (field: MetadataField) => void;
}

export const MetadataFieldsTable: React.FC<MetadataFieldsTableProps> = ({
  selected,
  canEdit,
  busy,
  isArabic,
  drafts,
  t,
  onAddField,
  onDraftChange,
  onSave,
  onDelete,
}) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
          {t('حقول الكيان', 'Entity fields')}
          {selected && <span className="font-mono text-slate-400"> — {selected.code}</span>}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={onAddField}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('حقل جديد', 'New field')}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <MetadataFieldsHeader t={t} />
          <tbody>
            {(selected?.fields ?? []).map((field) => (
              <MetadataFieldRow
                key={field.columnName}
                field={field}
                draft={drafts[field.id ?? -1] ?? toDraft(field)}
                dirty={Boolean(drafts[field.id ?? -1])}
                canEdit={canEdit}
                busy={busy}
                isArabic={isArabic}
                t={t}
                onDraftChange={onDraftChange}
                onSave={onSave}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
