#!/usr/bin/env node
/**
 * بوابة جودة: حد أقصى لحجم الملفات (Ratchet Guardrail)
 * ---------------------------------------------------------------------------
 * المشكلة التي تحلّها: ملف `PlatformContext.tsx` وصل 12,341 سطراً، ثم انتشر
 * النمط نفسه في 63 ملفاً. لا يمكن إصلاح ذلك في يوم واحد، لكن يمكن **منع تفاقمه**.
 *
 * القاعدة:
 *   1. أي ملف جديد يتجاوز الحد (300 سطر) ⇒ فشل فوري.
 *   2. أي ملف في القائمة الأساسية (baseline) كبر أكثر من قيمته المسجّلة ⇒ فشل.
 *   3. أي ملف صغُر عن الحد ⇒ يمكن حذفه من القائمة (تنبيه فقط).
 *
 * التشغيل: node scripts/check-file-size.mjs
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, '.github', 'file-size-baseline.json');
const LINE_LIMIT = 300;
const EXTENSIONS = ['.ts', '.tsx'];

const isUpdateMode = process.argv.includes('--update');

/** يجمع كل ملفات المصدر مع عدد أسطرها. */
function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
    } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      const lines = readFileSync(full, 'utf8').split('\n').length;
      out.push({ path: relative(ROOT, full).replaceAll('\\', '/'), lines });
    }
  }
  return out;
}

const files = collectFiles(SCAN_DIR).sort((a, b) => b.lines - a.lines);
const oversized = files.filter((f) => f.lines > LINE_LIMIT);

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { limit: LINE_LIMIT, files: {} };

if (isUpdateMode) {
  baseline.limit = LINE_LIMIT;
  baseline.files = Object.fromEntries(oversized.map((f) => [f.path, f.lines]));
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`تم تحديث القائمة الأساسية: ${oversized.length} ملف.`);
  process.exit(0);
}

const failures = [];
const improved = [];

for (const file of oversized) {
  const recorded = baseline.files[file.path];
  if (recorded === undefined) {
    failures.push(
      `ملف جديد يتجاوز ${LINE_LIMIT} سطر: ${file.path} (${file.lines} سطر)\n` +
        `    ⇒ قسّم الملف إلى وحدات أصغر قبل الدمج.`
    );
  } else if (file.lines > recorded) {
    failures.push(
      `ملف مُكبَّر: ${file.path} (${file.lines} سطر، الحد المسجَّل ${recorded})\n` +
        `    ⇒ يجب ألا يزيد حجمه. قسّمه بدل توسيعه.`
    );
  }
}

for (const [path, recorded] of Object.entries(baseline.files)) {
  const current = files.find((f) => f.path === path);
  if (!current) {
    improved.push(`${path}: حُذف أو نُقل — أزلْه من القائمة الأساسية.`);
  } else if (current.lines <= LINE_LIMIT) {
    improved.push(`${path}: أصبح ${current.lines} سطراً (${recorded} سابقاً) — أزلْه من القائمة.`);
  }
}

console.log('=== بوابة حجم الملفات ===');
console.log(`  الملفات المفحوصة      : ${files.length}`);
console.log(`  ملفات تتجاوز الحد     : ${oversized.length}`);
console.log(`  الحد المسموح          : ${LINE_LIMIT} سطر`);
console.log(`  في القائمة الأساسية   : ${Object.keys(baseline.files).length}`);

if (improved.length > 0) {
  console.log('\n  تحسّنات (يمكن تقليص القائمة الأساسية):');
  for (const line of improved) console.log(`    • ${line}`);
}

if (failures.length > 0) {
  console.error('\n❌ فشلت البوابة:\n');
  for (const line of failures) console.error(`  ✗ ${line}`);
  console.error(`\n  ${failures.length} مخالفة. لمتابعة الحالة الحالية: node scripts/check-file-size.mjs --update`);
  process.exit(1);
}

console.log('\n✅ لا توجد مخالفات جديدة في حجم الملفات.');
