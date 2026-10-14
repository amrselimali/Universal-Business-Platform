import React from 'react';
import type { MetadataEntity } from '../services/metadataRegistry';

/**
 * قائمة الكيانات الجانبية في استوديو الـ Metadata
 * ---------------------------------------------------------------------------
 * فُصلت من MetadataStudioView.tsx للحفاظ على حجم الملف تحت الحد المسموح.
 */

interface MetadataEntityListProps {
  entities: MetadataEntity[];
  selectedCode: string;
  isArabic: boolean;
  t: (ar: string, en: string) => string;
  onSelect: (code: string) => void;
}

export const MetadataEntityList: React.FC<MetadataEntityListProps> = ({
  entities,
  selectedCode,
  isArabic,
  t,
  onSelect,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
    <h2 className="mb-2 px-1 text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
      {t('الكيانات', 'Entities')}
    </h2>
    <div className="space-y-1">
      {entities.map((entity) => (
        <button
          key={entity.code}
          type="button"
          onClick={() => onSelect(entity.code)}
          className={`w-full rounded-xl px-3 py-2 text-right text-xs font-bold transition-colors ${
            entity.code === selectedCode
              ? 'bg-indigo-600 text-white'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span className="block">{isArabic ? entity.displayNameAr : entity.displayNameEn}</span>
          <span
            className={`block font-mono text-[10px] ${
              entity.code === selectedCode ? 'text-indigo-100' : 'text-slate-400'
            }`}
          >
            {entity.tableName} · {entity.fields.length} {t('حقل', 'fields')}
          </span>
        </button>
      ))}
    </div>
  </div>
);
