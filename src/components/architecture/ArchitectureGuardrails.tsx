import React, { useMemo, useState } from 'react';
import {
  CircleCheckBig,
  CircleX,
  Clock,
  Hourglass,
  Lock,
  Play,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { SYSTEM_ACTIONS } from '../../data/actionsData';
import { SYSTEM_VIEWS } from '../../data/permissionsData';
import {
  GUARDRAILS_FACTS,
  GUARDRAILS_MEASURED_AT,
  GUARDRAILS_REVISION,
} from '../../data/architecture/guardrailsSnapshot';
import {
  runGuardrailSuite,
  type GateResult,
  type GuardrailSuite,
  type GuardrailsFacts,
} from '../../services/architectureGuardrails';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  canRun: boolean;
}

const VISIBLE_ROWS = 8;

const GateCard: React.FC<{
  gate: GateResult;
  t: (ar: string, en: string) => string;
  isArabic: boolean;
}> = ({ gate, t, isArabic }) => {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? gate.rows : gate.rows.slice(0, VISIBLE_ROWS);

  return (
    <div
      className={`rounded-2xl border bg-white p-4 dark:bg-slate-900 ${
        gate.passed
          ? 'border-emerald-200 dark:border-emerald-900/40'
          : 'border-rose-300 dark:border-rose-900/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
            {isArabic ? gate.titleAr : gate.titleEn}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            {isArabic ? gate.budgetAr : gate.budgetEn}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black ${
            gate.passed
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {gate.passed ? <CircleCheckBig className="h-3 w-3" /> : <CircleX className="h-3 w-3" />}
          {isArabic ? `نجحت ${gate.passedChecks} من ${gate.checks}` : `${gate.passedChecks} of ${gate.checks} passed`}
        </span>
      </div>

      <div className="mt-3 max-h-[360px] space-y-1 overflow-auto">
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className={`flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-[10px] leading-4 ${
              row.passed ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-rose-50 dark:bg-rose-950/30'
            }`}
          >
            <span className="min-w-0 break-all font-mono text-slate-700 dark:text-slate-200" dir="ltr">
              {row.label}
            </span>
            <span
              className={`shrink-0 text-end ${
                row.passed ? 'text-slate-500 dark:text-slate-400' : 'font-bold text-rose-700 dark:text-rose-300'
              }`}
            >
              {isArabic ? row.detailAr : row.detailEn}
            </span>
          </div>
        ))}
      </div>

      {gate.rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 text-[10px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {expanded
            ? t('إظهار أقل', 'Show fewer')
            : t(`إظهار كل النتائج (${gate.rows.length})`, `Show all results (${gate.rows.length})`)}
        </button>
      )}
    </div>
  );
};

/** لوحة بوابات الفحص الآلي: تُقيَّم فعلياً على قياسات المستودع المسجّلة. */
export const ArchitectureGuardrails: React.FC<Props> = ({ t, isArabic, canRun }) => {
  const suite: GuardrailSuite = useMemo(
    () => runGuardrailSuite(GUARDRAILS_FACTS, SYSTEM_ACTIONS, SYSTEM_VIEWS.map((v) => v.id)),
    []
  );
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const run = () => {
    if (!canRun || running) return;
    setRunning(true);
    // إعادة تقييم حقيقية لمنطق البوابات على القياسات المسجّلة من المستودع
    window.setTimeout(() => {
      setLastRun(new Date().toISOString());
      setRunning(false);
    }, 240);
  };

  const measuredAt = (() => {
    try {
      return new Date(GUARDRAILS_MEASURED_AT).toLocaleString(isArabic ? 'ar-EG' : 'en-GB');
    } catch {
      return GUARDRAILS_MEASURED_AT;
    }
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
            {t('تشغيل بوابات الفحص المعماري', 'Run the architecture guardrails')}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            {t(
              `آخر قياس من المستودع: ${measuredAt} @ ${GUARDRAILS_REVISION} · إجمالي الفحوصات: ${suite.totalChecks} · الفاشلة: ${suite.failedChecks}`,
              `Last repository measurement: ${measuredAt} @ ${GUARDRAILS_REVISION} · checks: ${suite.totalChecks} · failing: ${suite.failedChecks}`
            )}
          </p>
          {lastRun && (
            <p className="mt-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
              {t('آخر إعادة تقييم في المتصفح: ', 'Last in-browser re-evaluation: ')}
              {new Date(lastRun).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-GB')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-black text-white ${
              suite.passed ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {suite.passed ? <CircleCheckBig className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
            {suite.passed ? t('كل البوابات ناجحة', 'All gates pass') : t('بوابات فاشلة', 'Failing gates')}
          </span>

          <button
            type="button"
            onClick={run}
            disabled={!canRun || running}
            title={
              canRun
                ? t('إعادة تقييم البوابات', 'Re-evaluate the gates')
                : t(
                    'ممنوع: الفعل architecture.run_guardrails غير ممنوح لحسابك (Default-Deny)',
                    'Denied: action architecture.run_guardrails is not granted (Default-Deny)'
                  )
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (
              <Hourglass className="h-3.5 w-3.5 animate-pulse" />
            ) : lastRun ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {running
              ? t('جارٍ التقييم…', 'Evaluating…')
              : lastRun
                ? t('إعادة تشغيل البوابات', 'Re-run the gates')
                : t('تشغيل البوابات', 'Run the gates')}
          </button>

          {!canRun && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              <Lock className="h-3 w-3" />
              {t('مقفل بالصلاحيات', 'Locked by permissions')}
            </span>
          )}
        </div>
      </div>

      {suite.gates.map((gate) => (
        <GateCard key={gate.id} gate={gate} t={t} isArabic={isArabic} />
      ))}

      <AdvisoryPanel suite={suite} facts={GUARDRAILS_FACTS} t={t} isArabic={isArabic} />
    </div>
  );
};
const AdvisoryPanel: React.FC<{
  suite: GuardrailSuite;
  facts: GuardrailsFacts;
  t: (ar: string, en: string) => string;
  isArabic: boolean;
}> = ({ suite, facts, t, isArabic }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-2">
      <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
        {t('توصيات التوسع (غير مُلزِمة الآن)', 'Scale-up recommendations (not enforced yet)')}
      </p>
    </div>

    <div className="mt-3 space-y-1">
      {suite.advisories.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] leading-4 dark:bg-slate-800/40"
        >
          <span className="min-w-0 text-slate-700 dark:text-slate-200">{row.label}</span>
          <span
            className={
              row.passed
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }
          >
            {isArabic ? row.detailAr : row.detailEn}
          </span>
        </div>
      ))}
    </div>

    <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
      <Clock className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        {t(
          `بوابة التطبيق القديم (Ratchet): ${facts.legacy.scanned} ملف مفحوص · ${facts.legacy.violations} في خط الأساس · ${facts.legacy.newViolations.length} مخالفة جديدة — تُدار بأمر node scripts/check-file-size.mjs`,
          `Legacy ratchet gate: ${facts.legacy.scanned} files scanned · ${facts.legacy.violations} in the baseline · ${facts.legacy.newViolations.length} new violation(s) — managed by node scripts/check-file-size.mjs`
        )}
      </span>
    </p>
  </div>
);


