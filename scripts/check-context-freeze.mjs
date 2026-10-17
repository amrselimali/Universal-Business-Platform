#!/usr/bin/env node
/**
 * تجميد حِزمة الإقلاع في PlatformContext (Context Dataset Freeze)
 * ---------------------------------------------------------------------------
 * القرار: **ممنوع إضافة dataset جديد** إلى حِزمة الإقلاع. الشاشات الجديدة تقرأ
 * من السيرفر عند الطلب، وكل شاشة تُنقل تُزيل dataset من القائمة.
 *
 *   node scripts/check-context-freeze.mjs           ← يفشل عند أي إضافة
 *   node scripts/check-context-freeze.mjs --update  ← يثبّت القائمة الحالية
 *
 * المصدر: مفاتيح `sourceKey` في src/services/neonSchema.ts.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCHEMA_PATH = join(ROOT, 'src/services/neonSchema.ts');
const BASELINE_PATH = join(ROOT, '.github/context-datasets.json');

const source = readFileSync(SCHEMA_PATH, 'utf8');
const current = [...source.matchAll(/sourceKey:\s*'([^']+)'/g)].map((match) => match[1]).sort();

if (current.length === 0) {
  console.error('❌ لم أجد أي sourceKey في neonSchema.ts — تحقق من الصيغة.');
  process.exit(1);
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ datasets: current }, null, 2) + '\n', 'utf8');
  console.log(`✅ ثُبّتت ${current.length} dataset في ${BASELINE_PATH}`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).datasets ?? []
  : [];

const added = current.filter((key) => !baseline.includes(key));
const removed = baseline.filter((key) => !current.includes(key));

console.log('=== تجميد datasets في PlatformContext ===');
console.log(`  الحالي: ${current.length} · خط الأساس: ${baseline.length}`);

if (removed.length > 0) {
  console.log(`  ✅ datasets أُزيلت (تحسّن): ${removed.join(', ')}`);
  console.log('     ثبّت التقليص بـ: node scripts/check-context-freeze.mjs --update');
}

if (added.length > 0) {
  console.error(`\n❌ BUILD FAILED: datasets جديدة في حِزمة الإقلاع: ${added.join(', ')}`);
  console.error('   القرار: ممنوع إضافة dataset. اقرأ الشاشة من السيرفر عند الطلب بدلاً من الإقلاع.');
  process.exit(1);
}

console.log('\n✅ لا إضافات جديدة إلى حِزمة الإقلاع.');
