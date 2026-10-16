/**
 * صيغة ملف لقطة القياس المعماري (Snapshot format)
 * ---------------------------------------------------------------------------
 * فُصل من `scripts/architecture-guardrails.mjs` ليظل ملف البوابات تحت 300 سطر،
 * ولأن صيغة الملف المولَّد مسؤولية مستقلة: التوليد، الطباعة النصية المرتبة
 * (للمقارنة في --check)، واستخراج القياسات من ملف موجود.
 *
 * الصيغة: ملف TypeScript حقيقي (يخضع لفحص الأنواع مع المشروع) مع علامتي
 * GUARDRAILS_FACTS_BEGIN/END يسهّلان استخراج الجزء القابل للمقارنة.
 */

export const FACTS_BEGIN = '/* GUARDRAILS_FACTS_BEGIN */';
export const FACTS_END = '/* GUARDRAILS_FACTS_END */';

/** تهريب النصوص بشكل آمن إلى TS literal. */
const q = (value) => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

/** طباعة نصية مرتبة ومقروءة للقياسات (تُقارَن نصياً في طور --check). */
export const renderFacts = (facts) => {
  const lines = [
    '{',
    '  engineFiles: [',
    ...facts.engineFiles.map((f) => `    { path: ${q(f.path)}, lines: ${f.lines} },`),
    '  ],',
    '  actionUsages: [',
    ...facts.actionUsages.map(
      (u) => `    { actionKey: ${q(u.actionKey)}, file: ${q(u.file)}, line: ${u.line} },`
    ),
    '  ],',
    '  invariants: [',
    ...facts.invariants.map(
      (i) =>
        `    { id: ${q(i.id)}, labelAr: ${q(i.labelAr)}, labelEn: ${q(i.labelEn)}, comparison: ${q(i.comparison)}, ` +
        `expected: ${i.expected}, found: ${i.found}, severity: ${q(i.severity)}, ` +
        `evidence: [${i.evidence.map(q).join(', ')}] },`
    ),
    '  ],',
    '  legacy: {',
    `    scanned: ${facts.legacy.scanned},`,
    `    limit: ${facts.legacy.limit},`,
    `    baseline: ${facts.legacy.baseline},`,
    `    violations: ${facts.legacy.violations},`,
    `    newViolations: [${facts.legacy.newViolations.map(q).join(', ')}],`,
    '  },',
    '}',
  ];

  return lines.join('\n');
};

/** الملف الكامل (ترويسة + ثوابت التوليد + القياسات). */
export const renderSnapshot = (facts, meta) => `/**
 * لقطة القياس المعماري للمنظومة الجديدة — ملف **مولَّد آلياً**
 * ---------------------------------------------------------------------------
 * لا تُعدّله يدوياً. التوليد: node scripts/architecture-guardrails.mjs --update
 * والتحقق في الـ CI: node scripts/architecture-guardrails.mjs --check
 *
 * ما في هذه اللقطة قياس فعلي من قرص المستودع (أسطر الملفات، مواضع فحص
 * الصلاحيات، وجود ثوابت RLS/version/NOTIFY/YARP…). شاشة «معمارية المنظومة
 * الجديدة» تقرأها وتُعيد تقييم البوابات في المتصفح بالمنطق النقي الموجود في
 * src/services/architectureGuardrails.ts.
 */

import type { GuardrailsFacts } from '../../services/architectureGuardrails';

export const GUARDRAILS_MEASURED_AT = '${meta.measuredAt}';
export const GUARDRAILS_REVISION = '${meta.revision}';

export const GUARDRAILS_FACTS: GuardrailsFacts = ${FACTS_BEGIN}
${renderFacts(facts)}
${FACTS_END};
`;

/** عدد أسطر ملف اللقطة كما سيُكتب فعلاً (يُستخدم لحل الاعتماد الذاتي). */
export const countSnapshotLines = (facts) =>
  renderSnapshot(facts, { measuredAt: 'measure', revision: 'measure' }).split('\n').length;

/** يستخرج جزء القياسات من ملف لقطة موجود، أو null إذا كانت العلامات مفقودة. */
export const extractFacts = (text) => {
  const start = text.indexOf(FACTS_BEGIN);
  const end = text.indexOf(FACTS_END);
  if (start < 0 || end < 0) return null;
  return text.slice(start + FACTS_BEGIN.length, end).trim();
};
