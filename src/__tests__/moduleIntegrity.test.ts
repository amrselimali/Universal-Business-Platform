import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * اختبار سلامة الوحدات (Module Integrity)
 * ---------------------------------------------------------------------------
 * بديل خفيف لاختبار End-to-End يعمل بلا متصفح.
 *
 * ما يكشفه:
 *   • ملف شاشة موجود في المجلد لكن **لا يُصدِّر** المكوّن المتوقع ⇒ شاشة بيضاء.
 *   • مسار استيراد خاطئ في `App.tsx` بعد التقسيم.
 *   • أي ملف مصدر مُستورَد من `App.tsx` غير موجود.
 *
 * اختبارات E2E الحقيقية في مجلد `e2e/` (تشغيل: npm run e2e) — تحتاج متصفحاً.
 */

const ROOT = process.cwd();
const APP_PATH = join(ROOT, 'src/App.tsx');
const appSource = readFileSync(APP_PATH, 'utf8');

describe('تكامل شاشات التطبيق', () => {
  const viewsDir = join(ROOT, 'src/views');
  const viewFiles = readdirSync(viewsDir).filter((f) => f.endsWith('.tsx'));

  it('كل ملفات الشاشات موجودة وعددها منطقي', () => {
    expect(viewFiles.length).toBeGreaterThanOrEqual(20);
  });

  it('كل شاشة تُصدِّر مكوّناً بنفس اسم الملف', () => {
    const broken: string[] = [];

    for (const file of viewFiles) {
      const name = file.replace('.tsx', '');
      const source = readFileSync(join(viewsDir, file), 'utf8');

      // نبحث عن `export const X` أو `export function X` أو `export default`
      const hasNamed = new RegExp(`export\\s+(const|function)\\s+${name}\\b`).test(source);
      const hasDefault = /export\s+default/.test(source);

      if (!hasNamed && !hasDefault) broken.push(file);
    }

    expect(broken, `شاشات لا تُصدِّر المكوّن المتوقع:\n${broken.join('\n')}`).toEqual([]);
  });

  it('كل استيراد في App.tsx يشير لملف موجود', () => {
    const missing: string[] = [];
    const importRegex = /from\s+'(\.[^']+)'/g;

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(appSource)) !== null) {
      const relative = match[1];
      const base = join(ROOT, 'src', relative.replace(/^\.\//, ''));

      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
      if (!candidates.some((c) => existsSync(c))) missing.push(relative);
    }

    expect(missing, `استيرادات تشير لملفات غير موجودة:\n${missing.join('\n')}`).toEqual([]);
  });

  it('كل شاشة مؤجّلة (lazy) في lazyViews.ts موجودة فعلاً', () => {
    const lazyPath = join(viewsDir, 'lazyViews.ts');
    if (!existsSync(lazyPath)) return;

    const lazySource = readFileSync(lazyPath, 'utf8');
    const importRegex = /import\('\.\/([^']+)'\)/g;
    const missing: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(lazySource)) !== null) {
      const target = join(viewsDir, `${match[1]}.tsx`);
      if (!existsSync(target)) missing.push(match[1]);
    }

    expect(missing, `شاشات مؤجّلة تشير لملفات غير موجودة:\n${missing.join('\n')}`).toEqual([]);
  });

  it('تقسيم الحزمة مفعّل (الشاشات ليست مستوردة مباشرة في App)', () => {
    // لو رجعت الاستيرادات المباشرة، البناء يفقد التقسيم ويعود لحزمة واحدة ضخمة
    const matches: string[] = appSource.match(/from\s+'\.\/views\/[^']+'/g) ?? [];
    const directViewImports = matches.filter((i) => !i.includes('lazyViews'));
    expect(
      directViewImports,
      'هناك استيرادات مباشرة للشاشات داخل App.tsx — يجب أن تمر عبر lazyViews'
    ).toEqual([]);
  });
});

describe('حالة الملفات المصدرية', () => {
  it('لا توجد ملفات مصدر فارغة', () => {
    const empty: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const content = readFileSync(full, 'utf8').trim();
          if (content.length === 0) empty.push(full.replace(ROOT + '/', ''));
        }
      }
    };
    walk(join(ROOT, 'src'));
    expect(empty).toEqual([]);
  });

  it('لا توجد علامات تعارض دمج متبقية في الكود', () => {
    const conflicts: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          if (/^(<<<<<<<|>>>>>>>)/m.test(readFileSync(full, 'utf8'))) {
            conflicts.push(full.replace(ROOT + '/', ''));
          }
        }
      }
    };
    walk(join(ROOT, 'src'));
    expect(conflicts, `ملفات فيها علامات تعارض دمج:\n${conflicts.join('\n')}`).toEqual([]);
  });
});
