/**
 * محرك بوابات الفحص المعماري (CI Architecture Guardrails) — منطق نقي
 * ---------------------------------------------------------------------------
 * دوال نقية بلا DOM وبلا شبكة لسببين: (1) تُختبر في `vitest` بلا واجهة،
 * (2) يُستخدم **نفس المنطق** في الشاشة لإعادة تقييم البوابات فوراً، وفي السكربت
 * `scripts/architecture-guardrails.mjs` الذي يوقف الـ Build.
 *
 * مبدأ أساسي: لا نُخترع أرقاماً. القياس يأتي من الواقع في المستودع، وهذا الملف
 * يحوّله إلى نتيجة بوابة: نجاح/فشل + سطور تفصيلية.
 */

/** الحد الأقصى لأسطر أي ملف في نطاق المعمارية الجديدة. */
export const FILE_LINE_LIMIT = 300;

/** ميزانية السرعة المستهدفة لأي نقطة نهاية (مللي ثانية). */
export const LATENCY_BUDGET_MS = 200;

/** حد المستخدمين المتزامنين الذي بُنيت عليه القرارات المعمارية. */
export const MAX_CONCURRENT_USERS = 100;

export interface MeasuredFile {
  path: string;
  lines: number;
}

export interface MeasuredActionUsage {
  actionKey: string;
  file: string;
  line: number;
}

/**
 * القياس الفعلي لثابت معماري في المستودع.
 * `atLeast`: يجب أن يوجد الثابت `expected` مرة على الأقل (سياسات RLS مثلاً).
 * `none`:   يجب ألا يوجد إطلاقاً (استيراد عميل داتابيز من كود العميل مثلاً).
 */
export interface MeasuredInvariant {
  id: string;
  labelAr: string;
  labelEn: string;
  comparison: 'atLeast' | 'none';
  expected: number;
  found: number;
  severity: 'required' | 'advisory';
  evidence: string[];
}

/** ملخص بوابة حجم الملفات القديمة (Ratchet) للتطبيق الحالي. */
export interface LegacyRatchetSummary {
  scanned: number;
  limit: number;
  baseline: number;
  violations: number;
  newViolations: string[];
}

/** القياسات المستقرة — تُقارَن في `--check` ولا تتضمن أي طابع زمني. */
export interface GuardrailsFacts {
  engineFiles: MeasuredFile[];
  actionUsages: MeasuredActionUsage[];
  invariants: MeasuredInvariant[];
  legacy: LegacyRatchetSummary;
}

/** القياسات + بيانات توليد اللقطة (لا تُقارَن، تتغير مع كل تحديث). */
export interface GuardrailsSnapshot extends GuardrailsFacts {
  measuredAt: string;
  revision: string;
}

export interface RegisteredActionRef {
  key: string;
  nameAr: string;
  nameEn: string;
  viewId: string;
}

export interface GateRow {
  label: string;
  detailAr: string;
  detailEn: string;
  passed: boolean;
}

export interface GateResult {
  id: string;
  titleAr: string;
  titleEn: string;
  budgetAr: string;
  budgetEn: string;
  passed: boolean;
  checks: number;
  passedChecks: number;
  rows: GateRow[];
}

export interface GuardrailSuite {
  gates: GateResult[];
  advisories: GateRow[];
  totalChecks: number;
  failedChecks: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// البوابة 1: حد الأسطر لكل ملف
// ---------------------------------------------------------------------------

export const evaluateFileSizeGate = (
  files: MeasuredFile[],
  limit: number = FILE_LINE_LIMIT
): GateResult => {
  const sorted = [...files].sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
  const violations = sorted.filter((f) => f.lines > limit);

  const rows: GateRow[] = sorted.map((f) => ({
    label: f.path,
    detailAr: `${f.lines} / ${limit} سطر`,
    detailEn: `${f.lines} / ${limit} lines`,
    passed: f.lines <= limit,
  }));

  const largest = sorted[0];
  if (largest) {
    rows.push({
      label: 'أكبر ملف في النطاق',
      detailAr: `${largest.path} — ${largest.lines} من ${limit} سطر`,
      detailEn: `${largest.path} — ${largest.lines} of ${limit} lines`,
      passed: largest.lines <= limit,
    });
  }

  return {
    id: 'file_size',
    titleAr: 'البوابة 1: حد 300 سطر للملف',
    titleEn: 'Gate 1: 300-line file limit',
    budgetAr: `ممنوع أي ملف يتجاوز ${limit} سطراً في نطاق المعمارية الجديدة`,
    budgetEn: `No file in the new-architecture scope may exceed ${limit} lines`,
    passed: violations.length === 0,
    checks: files.length,
    passedChecks: files.length - violations.length,
    rows,
  };
};

// ---------------------------------------------------------------------------
// البوابة 2: تغطية سجل الأفعال (Action Registry — Default-Deny)
// ---------------------------------------------------------------------------

export const evaluateActionRegistryGate = (
  usages: MeasuredActionUsage[],
  actions: RegisteredActionRef[],
  knownViewIds: string[]
): GateResult => {
  const byKey = new Map(actions.map((a) => [a.key, a]));
  const sorted = [...usages].sort(
    (a, b) =>
      a.actionKey.localeCompare(b.actionKey) || a.file.localeCompare(b.file) || a.line - b.line
  );

  const rows: GateRow[] = sorted.map((usage) => {
    const action = byKey.get(usage.actionKey);
    const where = `${usage.file}:${usage.line}`;
    return {
      label: usage.actionKey,
      detailAr: action
        ? `${where} ← ${action.nameAr} (مسجّل · شاشة ${action.viewId})`
        : `${where} ← زر غير مسجّل في سجل الأفعال!`,
      detailEn: action
        ? `${where} ← ${action.nameEn} (registered · view ${action.viewId})`
        : `${where} ← unregistered action!`,
      passed: Boolean(action),
    };
  });

  const usedKeys = new Set(sorted.map((u) => u.actionKey));
  const unused = actions.filter((a) => !usedKeys.has(a.key));
  rows.push({
    label: 'أفعال مسجّلة بلا زرّ ظاهر بعد',
    detailAr: `${unused.length} من ${actions.length} فعلاً مسجّلة في الـ RBAC ولم تُستخدم بعد في أي شاشة`,
    detailEn: `${unused.length} of ${actions.length} registered actions are not used by any screen yet`,
    passed: true,
  });

  const views = new Set(knownViewIds);
  const orphans = actions.filter((a) => !views.has(a.viewId));
  rows.push({
    label: 'أفعال تشير لشاشة غير موجودة',
    detailAr:
      orphans.length === 0
        ? 'كل فعل مسجّل مرتبط بشاشة موجودة في سجل الشاشات'
        : orphans.map((a) => `${a.key} → ${a.viewId}`).join(' · '),
    detailEn:
      orphans.length === 0
        ? 'Every registered action points to an existing view'
        : orphans.map((a) => `${a.key} → ${a.viewId}`).join(' · '),
    passed: orphans.length === 0,
  });

  const unregistered = sorted.filter((u) => !byKey.has(u.actionKey));
  const checks = sorted.length + 1;

  return {
    id: 'action_registry',
    titleAr: 'البوابة 2: فحص تسجيل الأزرار (Action Registry)',
    titleEn: 'Gate 2: UI action registry scan',
    budgetAr:
      'كل فعل يُفحص به الصلاحية في الواجهة يجب أن يكون مسجّلاً — وإلا فهو مرفوض (Default-Deny)',
    budgetEn:
      'Every permission-checked UI action must exist in the registry — otherwise Default-Deny applies',
    passed: unregistered.length === 0 && orphans.length === 0,
    checks,
    passedChecks: checks - unregistered.length - (orphans.length > 0 ? 1 : 0),
    rows,
  };
};

// ---------------------------------------------------------------------------
// البوابة 3: الثوابت المعمارية (عزل، تزامن، بث لحظي، بوابة)
// ---------------------------------------------------------------------------

export const isInvariantSatisfied = (invariant: MeasuredInvariant): boolean =>
  invariant.comparison === 'atLeast'
    ? invariant.found >= invariant.expected
    : invariant.found === 0;

const invariantRow = (invariant: MeasuredInvariant, advisory: boolean): GateRow => ({
  label: invariant.labelAr,
  detailAr:
    `${invariant.found} / المطلوب ${invariant.expected}` +
    (invariant.comparison === 'none' ? ' (يجب أن يكون صفراً)' : '') +
    (invariant.evidence.length > 0 ? ` — ${invariant.evidence.slice(0, 3).join(' · ')}` : '') +
    (advisory ? ' — توصية للتوسع، غير مُلزِمة الآن' : ''),
  detailEn:
    `${invariant.found} / required ${invariant.expected}` +
    (invariant.comparison === 'none' ? ' (must be zero)' : '') +
    (invariant.evidence.length > 0
      ? ` — ${invariant.evidence.slice(0, 3).join(' · ')}`
      : '') +
    (advisory ? ' — scale-up recommendation, not enforced yet' : ''),
  passed: isInvariantSatisfied(invariant),
});

export const evaluateInvariantGate = (invariants: MeasuredInvariant[]): GateResult => {
  const required = invariants.filter((i) => i.severity === 'required');
  const failed = required.filter((i) => !isInvariantSatisfied(i));

  return {
    id: 'architecture_invariants',
    titleAr: 'البوابة 3: الثوابت المعمارية وميزانية السرعة',
    titleEn: 'Gate 3: architecture invariants & speed budget',
    budgetAr: `عزل Tenant بـ RLS + تزامن متفائل بعمود version + بث لحظي NOTIFY/SignalR + ميزانية ${LATENCY_BUDGET_MS}ms`,
    budgetEn: `Tenant isolation (RLS) + optimistic concurrency (version) + NOTIFY/SignalR realtime + ${LATENCY_BUDGET_MS}ms budget`,
    passed: failed.length === 0,
    checks: required.length,
    passedChecks: required.length - failed.length,
    rows: required.map((i) => invariantRow(i, false)),
  };
};

// ---------------------------------------------------------------------------
// تشغيل الحزمة كاملة
// ---------------------------------------------------------------------------

export const runGuardrailSuite = (
  facts: GuardrailsFacts,
  actions: RegisteredActionRef[],
  knownViewIds: string[]
): GuardrailSuite => {
  const gates: GateResult[] = [
    evaluateFileSizeGate(facts.engineFiles),
    evaluateActionRegistryGate(facts.actionUsages, actions, knownViewIds),
    evaluateInvariantGate(facts.invariants),
  ];

  const advisories = facts.invariants
    .filter((i) => i.severity === 'advisory')
    .map((i) => invariantRow(i, true));

  const totalChecks = gates.reduce((sum, gate) => sum + gate.checks, 0);
  const failedChecks = gates.reduce((sum, gate) => sum + (gate.checks - gate.passedChecks), 0);

  return {
    gates,
    advisories,
    totalChecks,
    failedChecks,
    passed: gates.every((gate) => gate.passed),
  };
};


