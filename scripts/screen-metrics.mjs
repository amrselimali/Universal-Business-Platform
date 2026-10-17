#!/usr/bin/env node
/**
 * مقياس موارد الشاشات (Screen Resource Metrics) — مسح آلي للكود
 * ---------------------------------------------------------------------------
 * يحسب لكل شاشة في `src/views`:
 *   • عدد الأسطر (مقارنة بحد 300).
 *   • عدد useState / useEffect (مؤشر على كلفة إعادة الرسم).
 *   • المكتبات الثقيلة المستوردة (xlsx/docx/recharts/motion/neon/qrcode).
 *
 * يُنتج ملفاً مولَّداً: `src/data/architecture/screenMetrics.ts`
 *   node scripts/screen-metrics.mjs --update   ← يعيد التوليد
 *   node scripts/screen-metrics.mjs --check    ← يفشل إذا كان الملف قديماً
 *
 * ملاحظة صدق: هذا قياس **ساكن** للكود. الذاكرة الفعلية/زمن الرسم تُقاس حياً في
 * المتصفح (performance.memory + longtask) داخل شاشة المعمارية.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const VIEWS_DIR = join(ROOT, 'src', 'views');
const OUT_PATH = join(ROOT, 'src', 'data', 'architecture', 'screenMetrics.ts');
const LIMIT = 300;

const HEAVY_LIBS = [
  ['xlsx', 'xlsx'],
  ['docx', 'docx'],
  ['recharts', 'recharts'],
  ['motion', 'motion'],
  ['@neondatabase/serverless', 'neon'],
  ['qrcode', 'qrcode'],
];

const files = readdirSync(VIEWS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
  .map((entry) => entry.name)
  .sort();

const metrics = files.map((file) => {
  const path = join(VIEWS_DIR, file);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n').length;
  const useState = (text.match(/useState\s*[<(]/g) ?? []).length;
  const useEffect = (text.match(/useEffect\s*\(/g) ?? []).length;
  const heavy = HEAVY_LIBS.filter(([pkg]) => text.includes(`from '${pkg}'`) || text.includes(`from "${pkg}"`)).map(
    ([, label]) => label
  );

  return {
    viewId: file.replace('.tsx', ''),
    file: `src/views/${file}`,
    lines,
    useState,
    useEffect,
    heavyLibs: heavy,
    overLimit: lines > LIMIT,
  };
});

metrics.sort((a, b) => b.lines - a.lines || a.viewId.localeCompare(b.viewId));

const render = () => {
  const rows = metrics
    .map(
      (m) =>
        `  { viewId: '${m.viewId}', file: '${m.file}', lines: ${m.lines}, useState: ${m.useState}, ` +
        `useEffect: ${m.useEffect}, heavyLibs: [${m.heavyLibs.map((lib) => `'${lib}'`).join(', ')}], overLimit: ${m.overLimit} },`
    )
    .join('\n');

  return `/**
 * مقياس موارد الشاشات — ملف **مولَّد آلياً** (لا تُعدّله يدوياً)
 * ---------------------------------------------------------------------------
 * التوليد: node scripts/screen-metrics.mjs --update
 * التحقق في الـ CI: node scripts/screen-metrics.mjs --check
 *
 * القياس ساكن (من الكود): الأسطر · useState · useEffect · المكتبات الثقيلة.
 * أما الذاكرة وزمن الرسم فتُقاس حياً داخل المتصفح في شاشة المعمارية.
 */

export interface ScreenMetric {
  viewId: string;
  file: string;
  lines: number;
  useState: number;
  useEffect: number;
  heavyLibs: string[];
  overLimit: boolean;
}

export const SCREEN_FILE_LIMIT = ${LIMIT};

export const SCREEN_METRICS: ScreenMetric[] = [
${rows}
];
`;
};

const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--update') ? 'update' : 'report';
const content = render();

if (mode === 'update') {
  writeFileSync(OUT_PATH, content, 'utf8');
  console.log(`✅ تم توليد ${OUT_PATH} (${metrics.length} شاشة)`);
  process.exit(0);
}

if (mode === 'report') {
  console.log(`الشاشات: ${metrics.length} · فوق ${LIMIT} سطراً: ${metrics.filter((m) => m.overLimit).length}`);
  process.exit(0);
}

try {
  const current = readFileSync(OUT_PATH, 'utf8');
  if (current.trim() !== content.trim()) {
    console.error('❌ مقياس موارد الشاشات قديم. شغّل: node scripts/screen-metrics.mjs --update');
    process.exit(1);
  }
  console.log('✅ مقياس موارد الشاشات محدَّث.');
} catch {
  console.error('❌ ملف screenMetrics.ts غير موجود. شغّل --update');
  process.exit(1);
}
