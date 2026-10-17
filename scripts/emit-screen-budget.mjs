#!/usr/bin/env node
/**
 * ميزانية حزمة كل شاشة (Per-screen bundle budget)
 * ---------------------------------------------------------------------------
 * يقرأ `dist/.vite/manifest.json` (مُفعّل في vite.config) ليحصل على الحزمة
 * الفعلية لكل شاشة، ثم يقيس **الحجم المضغوط (gzip)** ويكتب:
 *   dist/screen-budget.json
 *
 * الشاشة المعمارية تجلب هذا الملف حياً من الموقع، فتكون الأرقام مأخوذة من
 * **آخر بناء فعلي** لا من تقدير.
 *
 * التشغيل: node scripts/emit-screen-budget.mjs  (بعد npm run build)
 */

import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const MANIFEST = join(DIST, '.vite', 'manifest.json');
const OUT = join(DIST, 'screen-budget.json');

if (!existsSync(MANIFEST)) {
  console.error('❌ لا يوجد dist/.vite/manifest.json — شغّل npm run build أولاً (manifest مُفعّل في vite.config).');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

const entry = manifest['index.html'];
const entryFile = entry?.file;
const entryGzip = entryFile && existsSync(join(DIST, entryFile))
  ? kb(gzipSync(readFileSync(join(DIST, entryFile)), { level: 9 }).length)
  : 0;

const screens = {};
for (const [source, item] of Object.entries(manifest)) {
  if (!source.startsWith('src/views/') || !item.file) continue;
  const target = join(DIST, item.file);
  if (!existsSync(target)) continue;
  const viewId = source.replace('src/views/', '').replace('.tsx', '');
  screens[viewId] = {
    file: item.file,
    rawKb: kb(statSync(target).size),
    gzipKb: kb(gzipSync(readFileSync(target), { level: 9 }).length),
  };
}

const payload = {
  generatedAt: new Date().toISOString(),
  entry: entryFile ? { file: entryFile, gzipKb: entryGzip } : null,
  screens,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
const count = Object.keys(screens).length;
const biggest = Object.entries(screens).sort((a, b) => b[1].gzipKb - a[1].gzipKb)[0];
console.log(`✅ ${OUT} — ${count} شاشة · الإقلاع ${entryGzip}KB · الأثقل: ${biggest ? `${biggest[0]} (${biggest[1].gzipKb}KB)` : '—'}`);
