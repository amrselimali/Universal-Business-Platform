import React, { useMemo, useState } from 'react';
import {
  Save,
  Trash2,
  Plus,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import {
  getMetadataRegistry,
  loadMetadataRegistry,
  type MetadataEntity,
  type MetadataField,
} from '../services/metadataRegistry';
import { deleteMetadataField, saveMetadataField } from '../services/metadataStudioApi';
import { MetadataFieldRow, toDraft, type FieldDraft } from '../components/MetadataFieldRow';
import { MetadataEntityList } from '../components/MetadataEntityList';
import { MetadataFieldsHeader } from '../components/MetadataFieldRow';

/**
 * استوديو الـ Metadata (Metadata Studio)
 * ---------------------------------------------------------------------------
 * إدارة تعريف الشاشات والحقول **من الواجهة** بلا كود ولا نشر.
 *
 * مثال عملي: لإظهار رقم الهاتف في شبكة العملاء بجانب الرصيد:
 *   افتح الكيان «العملاء والموردون» ← عدّل ترتيب/إظهار حقل phone ← احفظ.
 *   لا إعادة بناء، ولا مبرمج، ولا نشر جديد.
 *
 * الكتابة محصورة على المدير العام (والفحص النهائي على السيرفر).
 */

export const MetadataStudioView: React.FC<{ onPreview?: (entityCode: string) => void }> = ({
  onPreview,
}) => {
  const { t, language, currentUser } = usePlatform();
  const isArabic = language === 'ar';

  const registry = getMetadataRegistry();
  const entities = registry.entities;

  const [selectedCode, setSelectedCode] = useState<string>(entities[0]?.code ?? '');
  const [drafts, setDrafts] = useState<Record<number, FieldDraft>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const selected: MetadataEntity | undefined = useMemo(
    () => entities.find((e) => e.code === selectedCode),
    [entities, selectedCode]
  );

  const canEdit =
    Boolean(currentUser?.isAdmin) ||
    currentUser?.role === 'SuperAdmin' ||
    Boolean(currentUser?.allowedViews?.includes('*'));

  const updateDraft = (fieldId: number, patch: Partial<FieldDraft>) =>
    setDrafts((prev) => ({ ...prev, [fieldId]: { ...prev[fieldId], ...patch } }));

  const handleSave = async (field: MetadataField) => {
    if (!selected) return;
    const draft = drafts[field.id ?? -1] ?? toDraft(field);
    setBusy(true);
    setFeedback(null);

    const result = await saveMetadataField({
      id: draft.id,
      entityCode: selected.code,
      columnName: field.columnName,
      labelAr: draft.labelAr,
      labelEn: draft.labelEn,
      dataType: draft.dataType,
      isRequired: draft.isRequired,
      isReadonly: draft.isReadonly,
      gridVisible: draft.gridVisible,
      formOrder: draft.formOrder,
      width: draft.width,
    });

    setBusy(false);
    if (result.ok) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[field.id ?? -1];
        return next;
      });
      setFeedback({
        type: 'ok',
        text: t('تم الحفظ — الشاشة محدَّثة فوراً.', 'Saved — the screen is updated instantly.'),
      });
    } else {
      setFeedback({
        type: 'err',
        text:
          result.error === 'api_not_configured'
            ? t('الكتابة تحتاج تشغيل الـ API.', 'Writing requires the API to be running.')
            : t('فشل الحفظ: ', 'Save failed: ') + (result.error ?? ''),
      });
    }
  };

  const handleDelete = async (field: MetadataField) => {
    if (field.id === undefined) return;
    if (!window.confirm(t('حذف هذا الحقل من تعريف الكيان؟', 'Remove this field from the entity?'))) {
      return;
    }
    setBusy(true);
    const result = await deleteMetadataField(field.id);
    setBusy(false);
    setFeedback(
      result.ok
        ? { type: 'ok', text: t('تم حذف الحقل.', 'Field removed.') }
        : { type: 'err', text: result.error ?? 'delete_failed' }
    );
  };

  const handleAddField = async () => {
    if (!selected) return;
    const columnName = window.prompt(
      t('اسم العمود في قاعدة البيانات (إنجليزي):', 'Database column name:')
    );
    if (!columnName) return;
    const labelAr = window.prompt(t('التسمية بالعربية:', 'Arabic label:')) ?? columnName;

    setBusy(true);
    const result = await saveMetadataField({
      entityCode: selected.code,
      columnName: columnName.trim(),
      labelAr: labelAr.trim(),
      labelEn: labelAr.trim(),
      dataType: 'string',
      isRequired: false,
      isReadonly: false,
      gridVisible: true,
      formOrder: (selected.fields.length + 1) * 10,
      width: 150,
    });
    setBusy(false);
    setFeedback(
      result.ok
        ? { type: 'ok', text: t('تمت إضافة الحقل.', 'Field added.') }
        : { type: 'err', text: result.error ?? 'save_failed' }
    );
  };

  // لا توجد كيانات مسجّلة (قاعدة البيانات غير مهيأة بعد)
  if (entities.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <Database className="h-8 w-8 text-slate-400" />
        <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
          {t('محرك الشاشات غير مهيأ بعد', 'The metadata engine is not set up yet')}
        </h2>
        <p className="max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {t(
            'شغّل ملفَي neon_metadata_engine.sql و neon_metadata_seed.sql ثم أعد التحميل.',
            'Run neon_metadata_engine.sql and neon_metadata_seed.sql, then reload.'
          )}
        </p>
        <code className="rounded-lg bg-slate-100 px-3 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          scripts/neon_metadata_engine.sql → scripts/neon_metadata_seed.sql
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* الترويسة */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-base font-extrabold text-slate-900 dark:text-white">
            {t('استوديو الشاشات والحقول', 'Metadata Studio')}
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {t(
              `${entities.length} كيان · ${registry.actions.length} فعل · المصدر: ${registry.source === 'database' ? 'قاعدة البيانات' : 'كتالوج مدمج'}`,
              `${entities.length} entities · ${registry.actions.length} actions · source: ${registry.source}`
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadMetadataRegistry(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            {t('تحديث', 'Reload')}
          </button>

          {selected && (
            <button
              type="button"
              onClick={() => onPreview?.(selected.code)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Eye className="h-3.5 w-3.5" />
              {t('معاينة الشاشة', 'Preview screen')}
            </button>
          )}
        </div>
      </div>

      {/* التنبيه */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" />
          <span>{t('وضع القراءة فقط — التعديل للمدير العام.', 'Read-only — editing is for admins.')}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <MetadataEntityList
          entities={entities}
          selectedCode={selectedCode}
          isArabic={isArabic}
          t={t}
          onSelect={(code) => {
            setSelectedCode(code);
            setDrafts({});
            setFeedback(null);
          }}
        />

        {/* جدول الحقول */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
              {t('حقول الكيان', 'Entity fields')}
              {selected && <span className="font-mono text-slate-400"> — {selected.code}</span>}
            </h2>
            {canEdit && (
              <button
                type="button"
                onClick={() => void handleAddField()}
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
                    onDraftChange={updateDraft}
                    onSave={handleSave}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
