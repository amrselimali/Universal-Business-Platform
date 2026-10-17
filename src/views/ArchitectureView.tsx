import React, { useState } from 'react';
import { BadgeCheck, Cpu, Gauge, ShieldCheck, Sparkles, Workflow, Layers } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { ArchitectureBudgetGrid } from '../components/architecture/ArchitectureBudgetGrid';
import { ArchitectureTopology } from '../components/architecture/ArchitectureTopology';
import { ArchitectureDecisions } from '../components/architecture/ArchitectureDecisions';
import { ArchitectureSnippets } from '../components/architecture/ArchitectureSnippets';
import { ArchitectureGuardrails } from '../components/architecture/ArchitectureGuardrails';
import { ArchitectureCiWorkflow } from '../components/architecture/ArchitectureCiWorkflow';
import { ArchitectureCompanionGates } from '../components/architecture/ArchitectureCompanionGates';
import { ArchitectureScreenProfile } from '../components/architecture/ArchitectureScreenProfile';
import { GUARDRAILS_REVISION } from '../data/architecture/guardrailsSnapshot';

type TabId = 'budget' | 'topology' | 'decisions' | 'snippets' | 'guardrails' | 'screens' | 'ci';

/**
 * شاشة معمارية المنظومة الجديدة (Clean Micro-Engine Architecture)
 * ---------------------------------------------------------------------------
 * ثلاثة أهداف:
 *   1. توثيق المعمارية المعتمدة للمنظومة الجديدة (YARP + .NET 10 + Postgres RLS
 *      + SignalR) كما هي منفَّذة فعلاً في `erp-nextgen-local/` داخل هذا المستودع.
 *   2. إظهار ما تم التخلص منه من عيوب المنصة الحالية بدليل مقيس لا بوعود.
 *   3. تشغيل **بوابات الفحص المعماري الحقيقية** (حد 300 سطر، سجل الأفعال،
 *      الثوابت المعمارية) على قياسات مسجّلة من المستودع، مع أمر تشغيلها في الـ CI.
 *
 * الشاشة نفسها مقيَّدة بحد 300 سطر وكذلك كل مكوّناتها، وأزرارها محمية بأفعال
 * مسجّلة في الـ RBAC — أي أنها تخضع للقواعد التي توثّقها.
 */
export const ArchitectureView: React.FC = () => {
  const { t, language, canPerformAction } = usePlatform();
  const isArabic = language === 'ar';
  const [tab, setTab] = useState<TabId>('budget');

  const canRunGuardrails = canPerformAction('architecture.run_guardrails');
  const canCopySnippet = canPerformAction('architecture.copy_snippet');

  const tabs = [
    { id: 'budget' as TabId, labelAr: 'الميزانية والأساس', labelEn: 'Budget & Foundations', icon: <Gauge className="h-3.5 w-3.5" /> },
    { id: 'topology' as TabId, labelAr: 'مخطط تدفق البيانات الحي', labelEn: 'Data Flow Topology', icon: <Layers className="h-3.5 w-3.5" /> },
    { id: 'decisions' as TabId, labelAr: 'عيوب المنصة ← الحلول', labelEn: 'Flaws to Fixes', icon: <BadgeCheck className="h-3.5 w-3.5" /> },
    { id: 'snippets' as TabId, labelAr: 'كود التنفيذ المعتمد', labelEn: 'Production Code', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { id: 'guardrails' as TabId, labelAr: 'بوابات الفحص وميزانية السرعة', labelEn: 'Guardrails & Speed Budget', icon: <Workflow className="h-3.5 w-3.5" /> },
    { id: 'screens' as TabId, labelAr: 'الشاشات والذاكرة والسرعة', labelEn: 'Screens, memory & speed', icon: <Cpu className="h-3.5 w-3.5" /> },
    { id: 'ci' as TabId, labelAr: 'بوابات الـ CI وحدودها', labelEn: 'CI Gates', icon: <Sparkles className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black tracking-widest text-indigo-300">
              CLEAN MICRO-ENGINE ARCHITECTURE
            </p>
            <h1 className="mt-1 text-lg font-black">
              {t('المعمارية المعتمدة للمنظومة الجديدة', 'The approved architecture of the new system')}
            </h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-300">
              {t(
                'YARP + .NET 10 + PostgreSQL RLS + SignalR — تصميم هندسي متين لتفادي عيوب المنصة السابقة: إلغاء كتابة الشاشات اليدوية عبر Metadata Engine، سرعة استجابة استثنائية (Optimistic UI) بدون هنج، وعزل تام (RLS + Tenant ID) مع مزامنة لحظية ثنائية الاتجاه دون اتصال المتصفح بقاعدة البيانات.',
                'YARP + .NET 10 + PostgreSQL RLS + SignalR — a solid engineering design that removes the previous platform flaws: no hand-written screens thanks to the metadata engine, exceptional responsiveness (Optimistic UI) with no freezing, and total isolation (RLS + tenant id) with realtime bidirectional sync while the browser never touches the database.'
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-[10px] text-slate-300">
            <span className="rounded-lg bg-white/10 px-2 py-1 font-mono" dir="ltr">
              snapshot @ {GUARDRAILS_REVISION}
            </span>
            <span className="rounded-lg bg-white/10 px-2 py-1 font-mono" dir="ltr">
              erp-nextgen-local/
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition-colors ${
              tab === item.id
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.icon}
            {isArabic ? item.labelAr : item.labelEn}
          </button>
        ))}
      </div>

      {tab === 'budget' && <ArchitectureBudgetGrid t={t} isArabic={isArabic} />}
      {tab === 'topology' && <ArchitectureTopology t={t} isArabic={isArabic} />}
      {tab === 'decisions' && <ArchitectureDecisions t={t} isArabic={isArabic} />}
      {tab === 'snippets' && (
        <ArchitectureSnippets t={t} isArabic={isArabic} canCopy={canCopySnippet} />
      )}
      {tab === 'guardrails' && (
        <ArchitectureGuardrails t={t} isArabic={isArabic} canRun={canRunGuardrails} />
      )}
      {tab === 'screens' && <ArchitectureScreenProfile t={t} isArabic={isArabic} />}
      {tab === 'ci' && (
        <div className="space-y-3">
          <ArchitectureCiWorkflow t={t} isArabic={isArabic} canCopy={canCopySnippet} />
          <ArchitectureCompanionGates t={t} isArabic={isArabic} />
        </div>
      )}
    </div>
  );

};
