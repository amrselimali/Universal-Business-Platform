import React, { useState } from 'react';
import { Copy, CopyCheck, FileCode2, Quote } from 'lucide-react';
import { ARCHITECTURE_SNIPPETS } from '../../data/architecture/architectureSnippets';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  canCopy: boolean;
}

/** مقتطفات الكود المعتمد — منقولة من الكود الموجود فعلاً في المستودع. */
export const ArchitectureSnippets: React.FC<Props> = ({ t, isArabic, canCopy }) => {
  const [activeId, setActiveId] = useState<string>(ARCHITECTURE_SNIPPETS[0]?.id ?? '');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const active = ARCHITECTURE_SNIPPETS.find((s) => s.id === activeId) ?? ARCHITECTURE_SNIPPETS[0];

  const copy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setCopiedId(null);
    }
  };

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ARCHITECTURE_SNIPPETS.map((snippet) => {
          const isActive = snippet.id === active.id;
          return (
            <button
              key={snippet.id}
              type="button"
              onClick={() => setActiveId(snippet.id)}
              className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-colors ${
                isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {isArabic ? snippet.titleAr : snippet.titleEn}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileCode2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate font-mono text-[10px] text-slate-300" dir="ltr">
              {active.sourcePath}
            </span>
          </div>

          <button
            type="button"
            disabled={!canCopy}
            onClick={() => void copy(active.code, active.id)}
            title={
              canCopy
                ? t('نسخ المقتطف', 'Copy snippet')
                : t('ممنوع: الفعل architecture.copy_snippet غير ممنوح لحسابك', 'Denied: action architecture.copy_snippet is not granted to your account')
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copiedId === active.id ? <CopyCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedId === active.id ? t('تم النسخ', 'Copied') : t('نسخ', 'Copy')}
          </button>
        </div>

        <pre
          dir="ltr"
          className="max-h-[420px] overflow-auto px-3 py-3 text-[11px] leading-5 text-emerald-200"
        >
          <code>{active.code}</code>
        </pre>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
          {isArabic ? active.noteAr : active.noteEn}
        </p>
      </div>
    </div>
  );
};
