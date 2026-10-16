#!/usr/bin/env node
/**
 * بوابة ميزانية حجم الحزمة (Bundle Speed Budget)
 * ---------------------------------------------------------------------------
 * لماذا؟ ميزانية الـ 200ms تُقاس على الـ API بـ k6، لكن **الجزء الأول من زمن
 * فتح الشاشة هو تحميل JavaScript على جهاز المستخدم** — وهو ما لا يراه أي اختبار
 * وظيفي. كانت الحزمة الابتدائية للتطبيق 3.8 ميجابايت قبل التقسيم، ويمكن أن تعود
 * ببطء دون أن يلاحظ أحد.
 *
 * الميزانيات (مقيسة بالضغط gzip، وهو ما يُنقل فعلاً على الشبكة):
 *   • حزمة الإقلاع (index-*.js)   ≤ 160 KB   — تُحمَّل قبل ظهور أي شاشة.
 *   • إجمالي الـ CSS               ≤  30 KB
 *   • أكبر حزمة مؤجّلة (Lazy)      ≤ 160 KB   — تُحمَّل عند فتح شاشتها فقط.
 *   • إجمالي كل الحزم              ≤ 1200 KB  — سقف يمنع التضخّم التدريجي.
 *
 * التشغيل (بعد البناء):  node scripts/check-bundle-budget.mjs
 * أي تجاوز ⇒ فشل الـ Build. لا استثناءات صامتة.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const ASSETS_DIR = join(ROOT, 'dist', 'assets');

const KB = 1024;

/** الحدود بالكيلوبايت المضغوط. */
const BUDGETS = {
  entryJs: 160,
  css: 30,
  largestLazyJs: 160,
  totalGz: 1200,
};

if (!existsSync(ASSETS_DIR)) {
  console.error('❌ لم يُعثر على مجلد dist/assets — شغّل البناء أولاً: npm run build');
  process.exit(1);
}

/** يحسب الحجم الخام والمضغوط لكل ملف مُنتَج. */
const measure = () =>
  readdirSync(ASSETS_DIR)
    .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
    .map((name) => {
      const content = readFileSync(join(ASSETS_DIR, name));
      return { name, raw: content.length, gzip: gzipSync(content, { level: 9 }).length };
    });

const files = measure();
const kb = (bytes) => Math.round((bytes / KB) * 10) / 10;

const entries = files.filter((f) => /^index-.*\.js$/.test(f.name));
const styles = files.filter((f) => f.name.endsWith('.css'));
const lazy = files.filter((f) => f.name.endsWith('.js') && !entries.includes(f));

const entryBytes = entries.reduce((sum, f) => sum + f.gzip, 0);
const cssBytes = styles.reduce((sum, f) => sum + f.gzip, 0);
const totalBytes = files.reduce((sum, f) => sum + f.gzip, 0);
const largestLazy = lazy.reduce((max, f) => (f.gzip > max.gzip ? f : max), lazy[0] ?? { name: '—', gzip: 0 });

const checks = [
  {
    labelAr: 'حزمة الإقلاع (index-*.js)',
    labelEn: 'Entry bundle (index-*.js)',
    actual: kb(entryBytes),
    budget: BUDGETS.entryJs,
    detailAr: entries.map((f) => f.name).join(', ') || '—',
  },
  {
    labelAr: 'إجمالي الـ CSS',
    labelEn: 'Total CSS',
    actual: kb(cssBytes),
    budget: BUDGETS.css,
    detailAr: `${styles.length} ملف`,
  },
  {
    labelAr: 'أكبر حزمة مؤجّلة',
    labelEn: 'Largest lazy chunk',
    actual: kb(largestLazy.gzip),
    budget: BUDGETS.largestLazyJs,
    detailAr: largestLazy.name,
  },
  {
    labelAr: 'إجمالي كل الحزم',
    labelEn: 'Total of all chunks',
    actual: kb(totalBytes),
    budget: BUDGETS.totalGz,
    detailAr: `${files.length} ملفاً`,
  },
];

console.log('=== بوابة ميزانية حجم الحزمة (gzip) ===');
for (const check of checks) {
  const ok = check.actual <= check.budget;
  console.log(
    `  ${ok ? '✅' : '❌'} ${check.labelAr}: ${check.actual} KB / الحد ${check.budget} KB — ${check.detailAr}`
  );
}

const failures = checks.filter((check) => check.actual > check.budget);
if (failures.length > 0) {
  console.error(`\n❌ BUILD FAILED: ${failures.length} تجاوزاً في ميزانية حجم الحزمة.`);
  console.error('   الحل: قسّم الحزمة (Lazy import) أو أزل مكتبة ثقيلة قبل رفع الحد.');
  process.exit(1);
}

console.log('\n✅ كل الحزم داخل الميزانية.');
