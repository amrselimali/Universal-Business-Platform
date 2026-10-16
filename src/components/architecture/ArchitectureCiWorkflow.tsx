import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, CopyCheck, Terminal, Workflow } from 'lucide-react';
import {
  CI_WORKFLOW_SNIPPET,
  GATE_DEFINITIONS,
  GUARDRAIL_COMMANDS,
} from '../../data/architecture/architectureGuardrailsContent';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  canCopy: boolean;
}

/**
 * تعريف البوابات الثلاث + أمر التشغيل + قالب ملف الـ CI
 * (القالب `docs/ci/ci.yml` لأنه لا يمكن دفع تعديلات `.github/workflows/` آلياً).
 */
export const ArchitectureCiWorkflow: React.FC<Props> = ({ t, isArabic, canCopy }) => {
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CI_WORKFLOW_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        {GATE_DEFINITIONS.map((gate) => (
          <div
            key={gate.id}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white dark:bg-slate-100 dark:text-slate-900">
                {gate.index}
              </span>
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                {isArabic ? gate.titleAr : gate.titleEn}
              </p>
            </div>

            <p className="mt-2 flex-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-600 dark:text-slate-300">
                {t('ما يُفحَص: ', 'Scans: ')}
              </span>
              {isArabic ? gate.scansAr : gate.scansEn}
            </p>

            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2 text-[10px] leading-4 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <span className="font-bold">{t('متى يفشل الـ Build: ', 'Build fails when: ')}</span>
              {isArabic ? gate.failsAr : gate.failsEn}
            </p>

            <p className="mt-2 font-mono text-[10px] text-slate-400" dir="ltr">
              $ {gate.script}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
              {t('أوامر التشغيل والصيانة', 'Run and maintenance commands')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowWorkflow((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Workflow className="h-3 w-3" />
            {showWorkflow ? t('إخفاء ملف الـ CI', 'Hide CI workflow') : t('عرض ملف الـ CI', 'Show CI workflow')}
            {showWorkflow ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        <div className="mt-2 space-y-1">
          {Object.entries(GUARDRAIL_COMMANDS).map(([key, command]) => (
            <p key={key} className="font-mono text-[10px] text-slate-500 dark:text-slate-400" dir="ltr">
              $ {command}
            </p>
          ))}
        </div>

        {showWorkflow && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5">
              <span className="font-mono text-[10px] text-slate-300" dir="ltr">
                docs/ci/ci.yml → .github/workflows/ci.yml
              </span>
              <button
                type="button"
                disabled={!canCopy}
                onClick={() => void copy()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? <CopyCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? t('تم النسخ', 'Copied') : t('نسخ', 'Copy')}
              </button>
            </div>
            <pre dir="ltr" className="max-h-80 overflow-auto bg-slate-950 px-3 py-3 text-[10px] leading-5 text-sky-200">
              <code>{CI_WORKFLOW_SNIPPET}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
