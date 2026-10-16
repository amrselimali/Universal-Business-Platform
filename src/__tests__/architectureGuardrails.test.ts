import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { SYSTEM_ACTIONS } from '../data/actionsData';
import { SYSTEM_VIEWS } from '../data/permissionsData';
import { GUARDRAILS_FACTS } from '../data/architecture/guardrailsSnapshot';
import {
  evaluateActionRegistryGate,
  evaluateFileSizeGate,
  evaluateInvariantGate,
  isInvariantSatisfied,
  runGuardrailSuite,
  type MeasuredInvariant,
} from '../services/architectureGuardrails';

/**
 * اختبارات بوابات الفحص المعماري.
 *
 * قسمان:
 *   1. منطق التقييم النقي (بلا نظام ملفات) — يضمن أن النجاح والفشل يُحسبان صحيحاً.
 *   2. حالة المستودع الفعلية — يضمن أن اللقطة المولَّدة محدَّثة (`--check`) وأن كل
 *      بوابات المعمارية الجديدة ناجحة، فلا تُعرض شاشة "خضراء" كاذبة.
 */

const ROOT = process.cwd();

const invariant = (patch: Partial<MeasuredInvariant>): MeasuredInvariant => ({
  id: 'x',
  labelAr: 'ثابت',
  labelEn: 'invariant',
  comparison: 'atLeast',
  expected: 1,
  found: 1,
  severity: 'required',
  evidence: ['file.sql'],
  ...patch,
});

describe('البوابة 1 — حد 300 سطر', () => {
  it('تفشل عند وجود ملف واحد متجاوز', () => {
    const gate = evaluateFileSizeGate(
      [
        { path: 'src/a.ts', lines: 120 },
        { path: 'src/big.tsx', lines: 891 },
      ],
      300
    );

    expect(gate.passed).toBe(false);
    expect(gate.checks).toBe(2);
    expect(gate.passedChecks).toBe(1);
    expect(gate.rows.find((row) => row.label === 'src/big.tsx')?.passed).toBe(false);
  });

  it('تنجح حين تكون كل الملفات داخل الحد وتضيف سطر أكبر ملف', () => {
    const gate = evaluateFileSizeGate([
      { path: 'a.cs', lines: 76 },
      { path: 'b.cs', lines: 48 },
    ]);

    expect(gate.passed).toBe(true);
    expect(gate.rows.at(-1)?.label).toBe('أكبر ملف في النطاق');
    expect(gate.rows.at(-1)?.passed).toBe(true);
  });

  it('الحد صارم (300 سطر مقبول، 301 مرفوض)', () => {
    expect(evaluateFileSizeGate([{ path: 'x.ts', lines: 300 }]).passed).toBe(true);
    expect(evaluateFileSizeGate([{ path: 'x.ts', lines: 301 }]).passed).toBe(false);
  });
});

describe('البوابة 2 — سجل الأفعال', () => {
  const actions = [
    { key: 'pos.checkout', nameAr: 'إتمام', nameEn: 'Checkout', viewId: 'pos' },
    { key: 'unused.action', nameAr: 'غير مستخدم', nameEn: 'Unused', viewId: 'pos' },
  ];

  it('تفشل عند وجود زر يفحص فعلاً غير مسجّل', () => {
    const gate = evaluateActionRegistryGate(
      [{ actionKey: 'hack.button', file: 'src/views/X.tsx', line: 10 }],
      actions,
      ['pos']
    );

    expect(gate.passed).toBe(false);
    expect(gate.rows[0].passed).toBe(false);
    expect(gate.rows[0].detailAr).toContain('غير مسجّل');
  });

  it('تفشل عند وجود فعل يشير لشاشة غير موجودة', () => {
    const gate = evaluateActionRegistryGate(
      [{ actionKey: 'pos.checkout', file: 'src/views/PosView.tsx', line: 830 }],
      actions,
      ['dashboard']
    );

    expect(gate.passed).toBe(false);
    expect(gate.rows.at(-1)?.label).toBe('أفعال تشير لشاشة غير موجودة');
  });

  it('تنجح وتُبرز الأفعال المسجّلة غير المستخدمة كمعلومة لا كفشل', () => {
    const gate = evaluateActionRegistryGate(
      [{ actionKey: 'pos.checkout', file: 'src/views/PosView.tsx', line: 830 }],
      actions,
      ['pos']
    );

    expect(gate.passed).toBe(true);
    const unusedRow = gate.rows.find((row) => row.label === 'أفعال مسجّلة بلا زرّ ظاهر بعد');
    expect(unusedRow?.passed).toBe(true);
    expect(unusedRow?.detailAr).toContain('1 من 2');
  });
});

describe('البوابة 3 — الثوابت المعمارية', () => {
  it('atLeast تنجح بالمساواة أو الزيادة فقط', () => {
    expect(isInvariantSatisfied(invariant({ expected: 5, found: 5 }))).toBe(true);
    expect(isInvariantSatisfied(invariant({ expected: 5, found: 4 }))).toBe(false);
  });

  it('none تفشل عند وجود أي أثر (مثل استيراد عميل داتابيز في كود العميل)', () => {
    const clean = invariant({ comparison: 'none', expected: 0, found: 0 });
    const dirty = invariant({ comparison: 'none', expected: 0, found: 1 });

    expect(isInvariantSatisfied(clean)).toBe(true);
    expect(isInvariantSatisfied(dirty)).toBe(false);
  });

  it('التوصيات غير المُلزِمة لا تُفشل البوابة', () => {
    const gate = evaluateInvariantGate([
      invariant({ severity: 'required', found: 3, expected: 1 }),
      invariant({ severity: 'advisory', found: 0, expected: 1, id: 'pgbouncer' }),
    ]);

    expect(gate.passed).toBe(true);
    expect(gate.checks).toBe(1);
  });
});

describe('حزمة البوابات على حالة المستودع الفعلية', () => {
  const suite = runGuardrailSuite(
    GUARDRAILS_FACTS,
    SYSTEM_ACTIONS,
    SYSTEM_VIEWS.map((view) => view.id)
  );

  it('كل البوابات ناجحة على القياس المسجّل من المستودع', () => {
    const failing = suite.gates.filter((gate) => !gate.passed).map((gate) => gate.id);
    expect(failing, `بوابات فاشلة: ${failing.join(', ')}`).toEqual([]);
    expect(suite.failedChecks).toBe(0);
  });

  it('كل فعل مستخدم في الواجهة مسجّل في سجل الأفعال', () => {
    expect(GUARDRAILS_FACTS.actionUsages.length).toBeGreaterThan(0);
    const registered = new Set(SYSTEM_ACTIONS.map((action) => action.key));
    const missing = GUARDRAILS_FACTS.actionUsages
      .filter((usage) => !registered.has(usage.actionKey))
      .map((usage) => `${usage.actionKey} @ ${usage.file}:${usage.line}`);

    expect(missing, `أزرار بلا فعل مسجّل:\n${missing.join('\n')}`).toEqual([]);
  });

  it('لقطة القياس محدَّثة ومطابقة للمستودع (تشغيل --check)', () => {
    const output = execFileSync('node', ['scripts/architecture-guardrails.mjs', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(output).toContain('محدَّثة ومطابقة للمستودع');
  });

  it('ملفات المحرك الجديد كلها تحت حد 300 سطر', () => {
    const oversized = GUARDRAILS_FACTS.engineFiles
      .filter((file) => file.lines > 300)
      .map((file) => `${file.path} (${file.lines})`);

    expect(oversized, `ملفات تتجاوز الحد:\n${oversized.join('\n')}`).toEqual([]);
  });
});


