import React from 'react';
import { Gauge, Package, ShieldCheck, Timer, TriangleAlert } from 'lucide-react';
import { BUNDLE_BUDGETS, GUARDRAIL_COMMANDS } from '../../data/architecture/architectureGuardrailsContent';
import { GUARDRAILS_FACTS } from '../../data/architecture/guardrailsSnapshot';
import { LATENCY_BUDGET_MS } from '../../services/architectureGuardrails';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
}

/**
 * البوابات المصاحبة: ما يُفرض على التطبيق الحالي بجانب بوابات المعمارية الجديدة.
 * الأرقام المقيسة تأتي من لقطة القياس، أما ميزانيات الحزمة والزمن فتُعرض كحدود
 * لا كقياس، لأن قياسها يحتاج بناءً كاملاً (budget:bundle) أو خدمة حيّة (k6).
 */
export const ArchitectureCompanionGates: React.FC<Props> = ({ t, isArabic }) => (
  <div className="space-y-3">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
          {t('بوابات التطبيق الحالي (Ratchet — لا تتفاقم الديون)', 'Current app gates (ratchet — debt cannot grow)')}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {t('حد 300 سطر لكل ملف', '300-line limit per file')}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            {t(
              `${GUARDRAILS_FACTS.legacy.scanned} ملفاً مفحوصاً · ${GUARDRAILS_FACTS.legacy.violations} في خط الأساس · ${GUARDRAILS_FACTS.legacy.newViolations.length} مخالفة جديدة`,
              `${GUARDRAILS_FACTS.legacy.scanned} files scanned · ${GUARDRAILS_FACTS.legacy.violations} in the baseline · ${GUARDRAILS_FACTS.legacy.newViolations.length} new violations`
            )}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-400" dir="ltr">
            $ {GUARDRAIL_COMMANDS.withRatchet}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {t(`ميزانية زمن الـ API (p95 < ${LATENCY_BUDGET_MS}ms)`, `API latency budget (p95 < ${LATENCY_BUDGET_MS}ms)`)}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            {t(
              'قياس حقيقي على خدمة تعمل: p95 < 200ms · p99 < 400ms · فشل < 1% — يُشغَّل قبل كل إصدار، لا داخل المتصفح.',
              'A real measurement against a running service: p95 < 200 ms · p99 < 400 ms · failures < 1% — run before each release, not inside the browser.'
            )}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-400" dir="ltr">
            $ {GUARDRAIL_COMMANDS.speedBudget}
          </p>
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
          {t('ميزانية حجم الحزمة (gzip) — ما يُنزَّل على جهاز المستخدم', 'Bundle size budget (gzip) — what the user actually downloads')}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {BUNDLE_BUDGETS.map((budget) => (
          <div key={budget.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {isArabic ? budget.labelAr : budget.labelEn}
              </span>
              <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-white dark:bg-slate-100 dark:text-slate-900">
                {budget.limitGb}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
              {isArabic ? budget.whyAr : budget.whyEn}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 font-mono text-[10px] text-slate-400" dir="ltr">
        $ {GUARDRAIL_COMMANDS.bundleBudget}
      </p>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-[10px] leading-4 text-slate-600 dark:text-slate-300">
          {t(
            'ميزانية زمن الـ API لا تُقاس داخل هذه الشاشة (رقم المتصفح المحلي مضلِّل)، وميزانية الحزمة تُقاس بعد كل بناء في الـ CI — والاثنان يظهران هنا كحدود معلنة لا كأرقام مُدَّعاة.',
            'The API latency budget is not measured inside this screen (a local browser figure would be misleading), and the bundle budget is measured after each CI build — both appear here as declared limits, not as claimed numbers.'
          )}
        </p>
      </div>
    </div>
  </div>
);
