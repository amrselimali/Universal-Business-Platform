#!/usr/bin/env node
/**
 * بوابات الفحص المعماري للمنظومة الجديدة (Architecture Guardrails)
 * ---------------------------------------------------------------------------
 * المشكلة التي يحلّها: قرارات المعمارية (حد 300 سطر، Default-Deny، عزل RLS،
 * تزامن متفاوت، بث لحظي) تبقى "كلاماً في مستند" وتتآكل مع أول ضغط تسليم.
 * هذا السكربت يحوّلها إلى **قياس فعلي من قرص المستودع** وإلى Build يفشل عند الخروج.
 *
 * الأطوار:
 *   node scripts/architecture-guardrails.mjs            → تقرير فقط (بلا كتابة)
 *   node scripts/architecture-guardrails.mjs --update   → يقيس ويكتب اللقطة المولَّدة
 *   node scripts/architecture-guardrails.mjs --check    → يفشل إذا كانت اللقطة قديمة
 *
 * اللقطة المولَّدة: `src/data/architecture/guardrailsSnapshot.ts` — تقرأها شاشة
 * «معمارية المنظومة الجديدة» وتُعيد تقييم البوابات فورياً في المتصفح.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { measureInvariants } from './guardrail-invariants.mjs';
import { countSnapshotLines, extractFacts, renderFacts, renderSnapshot } from './guardrail-snapshot.mjs';

const ROOT = process.cwd();
const SNAPSHOT_REL = 'src/data/architecture/guardrailsSnapshot.ts';
const SNAPSHOT_PATH = join(ROOT, SNAPSHOT_REL);

const MODE = process.argv.includes('--check')
  ? 'check'
  : process.argv.includes('--update')
    ? 'update'
    : 'report';

const CODE_EXTENSIONS = ['.cs', '.sql', '.ts', '.tsx', '.js', '.mjs', '.sh', '.ps1', '.json', '.yml'];

/** التطبيق المرجعي للمنظومة الجديدة. */
const ENGINE_DIRS = ['erp-nextgen-local'];

/** ملفات المحرك الجديد داخل التطبيق الحالي (هي نفسها تحت حد 300 سطر). */
const ENGINE_FILES = [
  'src/services/architectureGuardrails.ts',
  'src/views/ArchitectureView.tsx',
  'src/components/ViewRenderer.tsx',
  'scripts/architecture-guardrails.mjs',
  'scripts/guardrail-invariants.mjs',
  'scripts/guardrail-snapshot.mjs',
  'src/__tests__/architectureGuardrails.test.ts',
];

/** مجلدات المحرك الجديد (تُقرأ كاملة). */
const ENGINE_SRC_DIRS = ['src/components/architecture', 'src/data/architecture'];

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (CODE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
};

const toRepoPath = (full) => relative(ROOT, full).replaceAll('\\', '/');

const countLines = (text) => text.split('\n').length;

const engineSourceFiles = () => {
  const paths = new Set();
  for (const dir of ENGINE_DIRS) {
    const full = join(ROOT, dir);
    if (existsSync(full)) for (const file of walk(full)) paths.add(file);
  }
  for (const dir of ENGINE_SRC_DIRS) {
    const full = join(ROOT, dir);
    if (existsSync(full)) for (const file of walk(full)) paths.add(file);
  }
  for (const file of ENGINE_FILES) {
    const full = join(ROOT, file);
    if (existsSync(full)) paths.add(full);
  }

  return [...paths]
    .map((full) => ({ path: toRepoPath(full), text: readFileSync(full, 'utf8') }))
    .sort((a, b) => a.path.localeCompare(b.path));
};

/** كل مواضع فحص الصلاحيات في شاشات الواجهة: canPerformAction('module.action'). */
const collectActionUsages = () => {
  const usages = [];
  for (const dir of ['src/views', 'src/components']) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    for (const file of walk(full)) {
      if (!file.endsWith('.tsx')) continue;
      const path = toRepoPath(file);
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const match of line.matchAll(/canPerformAction\(\s*'([^']+)'/g)) {
            usages.push({ actionKey: match[1], file: path, line: index + 1 });
          }
        });
    }
  }

  return usages.sort(
    (a, b) =>
      a.actionKey.localeCompare(b.actionKey) || a.file.localeCompare(b.file) || a.line - b.line
  );
};

/** بوابة التطبيق القديم: نفس قواعد `scripts/check-file-size.mjs` (Ratchet). */
const collectLegacy = () => {
  const baselinePath = join(ROOT, '.github/file-size-baseline.json');
  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, 'utf8'))
    : { limit: 300, files: {} };
  const limit = baseline.limit ?? 300;
  const dataLimit = baseline.dataLimit ?? 800;
  const declarationLimit = baseline.declarationLimit ?? 1500;
  const limitFor = (path) =>
    path.startsWith('src/data/') ? dataLimit : path === 'src/types.ts' ? declarationLimit : limit;

  const files = walk(join(ROOT, 'src'))
    .filter((full) => full.endsWith('.ts') || full.endsWith('.tsx'))
    .map((full) => ({ path: toRepoPath(full), lines: countLines(readFileSync(full, 'utf8')) }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const oversized = files.filter((f) => f.lines > limitFor(f.path));
  const newViolations = oversized
    .filter((f) => baseline.files[f.path] === undefined || f.lines > baseline.files[f.path])
    .map((f) => `${f.path} (${f.lines})`);

  return {
    scanned: files.length,
    limit,
    baseline: Object.keys(baseline.files).length,
    violations: oversized.length,
    newViolations,
  };
};

/**
 * يبني القياسات. `selfLines` هو عدد أسطر اللقطة المولَّدة نفسها: القياس يشمل
 * الملف المولَّد (كي لا يتحول إلى ثغرة في حد الـ 300 سطر)، وهذا يعني اعتماداً
 * ذاتياً بسيطاً يُحلّ بالتكرار حتى يستقر في `buildStableFacts`.
 */
const buildFacts = (selfLines) => {
  const engineSources = engineSourceFiles();
  const engineFiles = engineSources
    .filter((file) => file.path !== SNAPSHOT_REL)
    .map((file) => ({ path: file.path, lines: countLines(file.text) }));

  if (typeof selfLines === 'number') engineFiles.push({ path: SNAPSHOT_REL, lines: selfLines });
  engineFiles.sort((a, b) => a.path.localeCompare(b.path));

  return {
    engineFiles,
    actionUsages: collectActionUsages(),
    invariants: measureInvariants(engineSources),
    legacy: collectLegacy(),
  };
};

/** يحلّ الاعتماد الذاتي (حجم اللقطة جزء من القياس) بالتكرار حتى الاستقرار. */
const buildStableFacts = () => {
  let facts = buildFacts(null);
  let rendered = renderFacts(facts);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = buildFacts(countSnapshotLines(facts));
    const nextRendered = renderFacts(next);
    if (nextRendered === rendered) return { facts: next, rendered: nextRendered };
    facts = next;
    rendered = nextRendered;
  }

  return { facts, rendered };
};

const printReport = (facts) => {
  const oversized = facts.engineFiles.filter((f) => f.lines > 300);
  const required = facts.invariants.filter((i) => i.severity === 'required');
  const failed = required.filter((i) =>
    i.comparison === 'atLeast' ? i.found < i.expected : i.found !== 0
  );
  const advisories = facts.invariants.filter((i) => i.severity === 'advisory');

  console.log('=== بوابات الفحص المعماري (Clean Micro-Engine Architecture) ===');
  console.log(`  ملفات نطاق المحرك      : ${facts.engineFiles.length} — أكبر ملف: ${facts.engineFiles.reduce((m, f) => Math.max(m, f.lines), 0)} سطر`);
  console.log(`  مخالفات حد 300 سطر     : ${oversized.length}${oversized.length ? ` ← ${oversized.map((f) => f.path).join(', ')}` : ''}`);
  console.log(`  مواضع فحص الصلاحيات    : ${facts.actionUsages.length}`);
  console.log(`  ثوابت معمارية إلزامية  : ${required.length - failed.length} / ${required.length} ناجحة`);
  for (const item of failed) console.log(`    ✗ ${item.labelAr}: ${item.found} / المطلوب ${item.expected}`);
  for (const item of advisories) {
    const ok = item.found >= item.expected;
    console.log(`    ${ok ? '✓' : '•'} (توصية) ${item.labelAr}: ${item.found} / ${item.expected}`);
  }
  console.log(`  بوابة التطبيق القديم   : ${facts.legacy.scanned} ملف مفحوص · ${facts.legacy.violations} في خط الأساس · ${facts.legacy.newViolations.length} مخالفة جديدة`);
  for (const violation of facts.legacy.newViolations) console.log(`    ✗ ${violation}`);
};

const revision = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
})();

const { facts, rendered } = buildStableFacts();
const serialized = rendered;
const existingText = existsSync(SNAPSHOT_PATH) ? readFileSync(SNAPSHOT_PATH, 'utf8') : '';

if (MODE === 'update') {
  writeFileSync(
    SNAPSHOT_PATH,
    renderSnapshot(facts, { measuredAt: new Date().toISOString(), revision }),
    'utf8'
  );
  printReport(facts);
  console.log('\n✅ تم تحديث لقطة القياس: src/data/architecture/guardrailsSnapshot.ts');
  process.exit(0);
}

if (MODE === 'report') {
  printReport(facts);
  process.exit(0);
}

const existing = extractFacts(existingText);
if (existing === null) {
  console.error('\n❌ لقطة القياس غير موجودة أو تالفة. شغّل: node scripts/architecture-guardrails.mjs --update');
  process.exit(1);
}

if (existing !== serialized) {
  printReport(facts);
  console.error('\n❌ BUILD FAILED: لقطة القياس المعماري قديمة (لا تعكس حالة المستودع الحالية).');
  console.error('   شغّل: node scripts/architecture-guardrails.mjs --update  ثم أعد الـ Commit.');
  process.exit(1);
}

// التحقق الثاني: حجم ملف اللقطة الحقيقي يجب أن يطابق ما سجّلته اللقطة عن نفسها.
const recordedSelf = facts.engineFiles.find((file) => file.path === SNAPSHOT_REL);
const actualLines = existingText.split('\n').length;
if (recordedSelf && recordedSelf.lines !== actualLines) {
  console.error(
    `\n❌ BUILD FAILED: حد 300 سطر على ملف اللقطة نفسه — المسجَّل ${recordedSelf.lines} سطر والحقيقي ${actualLines}.`
  );
  console.error('   الحل: قسّم المحتوى أو أعد التوليد بـ node scripts/architecture-guardrails.mjs --update.');
  process.exit(1);
}

printReport(facts);
console.log('\n✅ لقطة القياس المعماري محدَّثة ومطابقة للمستودع.');


