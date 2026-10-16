import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isExecutableSql, splitSqlStatements } from '@/scripts/sqlSplitter.mjs';

/**
 * اختبارات جزّاء أوامر SQL.
 *
 * الأهمية: سائق Neon السحابي لا يقبل أوامر متعددة في جملة واحدة
 * ("cannot insert multiple commands into a prepared statement")،
 * فكل ملف Migration يجب أن يُجزَّأ بشكل صحيح. **جزّ خاطئ يعني SQL مقطوع
 * أو دالة مبتورة** — وهو خطأ صامت لا يظهر إلا عند التشغيل الفعلي.
 */

describe('splitSqlStatements', () => {
  it('يفصل الأوامر العادية بعلامة الفاصلة المنقوطة', () => {
    const parts = splitSqlStatements('CREATE TABLE a (id int); CREATE TABLE b (id int);');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('CREATE TABLE a');
    expect(parts[1]).toContain('CREATE TABLE b');
  });

  it('لا يفصل داخل نص بين علامتي اقتباس', () => {
    const parts = splitSqlStatements(`INSERT INTO t VALUES ('a;b;c');`);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain("'a;b;c'");
  });

  it('يتعامل مع الاقتباس المُهرَّب (علامتان متتاليتان)', () => {
    const parts = splitSqlStatements(`INSERT INTO t VALUES ('it''s; fine');`);
    expect(parts).toHaveLength(1);
  });

  it('لا يفصل داخل دالة بعلامة $$ (أهم حالة)', () => {
    const sql = `
      CREATE OR REPLACE FUNCTION f() RETURNS TRIGGER AS $$
      BEGIN
        NEW.x := 1; NEW.y := 2;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      SELECT 1;`;
    const parts = splitSqlStatements(sql);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('CREATE OR REPLACE FUNCTION');
    expect(parts[0]).toContain('END;'); // الأوامر الداخلية لم تُفصل
    expect(parts[1]).toBe('SELECT 1;');
  });

  it('يتعامل مع كتلة دولار مُسمّاة ($body$)', () => {
    const sql = `DO $body$ BEGIN PERFORM 1; END; $body$; SELECT 2;`;
    const parts = splitSqlStatements(sql);
    expect(parts).toHaveLength(2);
  });

  it('يتجاهل الفاصلة المنقوطة داخل تعليق سطري', () => {
    const parts = splitSqlStatements('-- comment; with semicolon\nSELECT 1;');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('SELECT 1');
  });

  it('يتجاهل الفاصلة المنقوطة داخل تعليق كتلة', () => {
    const parts = splitSqlStatements('/* a; b; */ SELECT 1;');
    expect(parts).toHaveLength(1);
  });

  it('يستبعد المقاطع التي تحتوي تعليقات فقط', () => {
    const sql = `
      -- ملف كذا
      -- ================
      SELECT 1;
      -- نهاية الملف`;
    const parts = splitSqlStatements(sql);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('SELECT 1');
  });

  it('يرجع مصفوفة فارغة لملف تعليقات فقط', () => {
    expect(splitSqlStatements('-- فقط تعليقات\n-- بلا أوامر')).toEqual([]);
  });

  it('يتعامل مع نص فارغ', () => {
    expect(splitSqlStatements('')).toEqual([]);
    expect(splitSqlStatements('   \n  ')).toEqual([]);
  });

  it('لا يُسقط الأمر الأخير بلا فاصلة منقوطة', () => {
    const parts = splitSqlStatements('SELECT 1; SELECT 2');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toBe('SELECT 2');
  });
});

describe('isExecutableSql', () => {
  it('يعتبر التعليقات فقط غير قابلة للتنفيذ', () => {
    expect(isExecutableSql('-- تعليق')).toBe(false);
    expect(isExecutableSql('/* كتلة */')).toBe(false);
    expect(isExecutableSql('  \n  ')).toBe(false);
  });

  it('يعتبر الأمر الحقيقي قابلاً للتنفيذ', () => {
    expect(isExecutableSql('SELECT 1;')).toBe(true);
    expect(isExecutableSql('-- تعليق\nSELECT 1;')).toBe(true);
  });
});

describe('ملفات الـ Migrations الحقيقية', () => {
  const dir = join(process.cwd(), 'scripts');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));

  it('كل ملف SQL يُجزَّأ إلى أوامر فعلية', () => {
    const problems: string[] = [];

    for (const file of files) {
      const parts = splitSqlStatements(readFileSync(join(dir, file), 'utf8'));
      if (parts.length === 0) problems.push(`${file}: لا أوامر`);
      if (parts.some((p) => !isExecutableSql(p))) problems.push(`${file}: أمر غير قابل للتنفيذ`);
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('الدوال ذات الكتل الدولارية تُجزَّأ كأمر واحد لا أكثر', () => {
    const file = join(dir, 'neon_phase4_infrastructure.sql');
    if (!existsSync(file)) return;

    const parts = splitSqlStatements(readFileSync(file, 'utf8'));
    const fnParts = parts.filter((p) => p.includes('CREATE OR REPLACE FUNCTION'));
    expect(fnParts.length).toBeGreaterThan(0);
    // كل دالة يجب أن تحتوي على END; وإغلاق الكتلة — أي أنها لم تُقطع
    fnParts.forEach((p) => {
      expect(p).toMatch(/LANGUAGE plpgsql\s*;/);
    });
  });

  it('الملف الموحّد يُجزَّأ بلا أخطاء', () => {
    const file = join(dir, 'neon_full_schema.sql');
    if (!existsSync(file)) return;
    const parts = splitSqlStatements(readFileSync(file, 'utf8'));
    expect(parts.length).toBeGreaterThan(50);
  });
});
