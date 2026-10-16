/**
 * بوابات الفحص الآلي وميزانية السرعة (CI Architecture Guardrails) — التعريف والوصف
 * ---------------------------------------------------------------------------
 * هذا الملف **وصف** للبوابات وتعليمات تشغيلها، أما التنفيذ الفعلي ففي:
 *   • `src/services/architectureGuardrails.ts` → منطق التقييم (نقي، قابل للاختبار)
 *   • `scripts/architecture-guardrails.mjs`    → القياس من قرص المستودع + كتابة اللقطة
 *   • `src/data/architecture/guardrailsSnapshot.ts` → القياس الخام (مولَّد آلياً)
 */

export interface GateDefinition {
  id: string;
  index: number;
  titleAr: string;
  titleEn: string;
  scansAr: string;
  scansEn: string;
  failsAr: string;
  failsEn: string;
  script: string;
}

export const GATE_DEFINITIONS: GateDefinition[] = [
  {
    id: 'file_size',
    index: 1,
    titleAr: 'حد 300 سطر للملف',
    titleEn: '300-line file limit',
    scansAr:
      'كل ملفات نطاق المعمارية الجديدة: كود وسكربتات .NET/TS وملفات SQL للتطبيق المرجعي، وملفات محرك الشاشات الجديد في هذا المستودع',
    scansEn:
      'Every file in the new-architecture scope: .NET/TS sources, scripts and SQL of the reference implementation, plus the new engine files in this repository',
    failsAr: 'الـ Build يفشل فوراً إذا تجاوز أي ملف الحد — لا استثناءات جديدة، والتطبيق القديم يُدار بخط أساس مُقاس (Ratchet)',
    failsEn: 'The build fails immediately if any file exceeds the limit — no new exceptions, and the legacy app runs under a measured ratchet baseline',
    script: 'node scripts/architecture-guardrails.mjs --check',
  },
  {
    id: 'action_registry',
    index: 2,
    titleAr: 'تسجيل الأزرار (Action Scanner)',
    titleEn: 'Action registry scanner',
    scansAr:
      'كل مواضع فحص الصلاحيات في شاشات الواجهة (canPerformAction) ومقارنتها بسجل الأفعال SYSTEM_ACTIONS',
    scansEn:
      'Every permission check inside the UI screens (canPerformAction) compared against the SYSTEM_ACTIONS registry',
    failsAr: 'أي زر يفحص فعلاً غير مسجّل = فشل البوابة، وأي فعل يشير لشاشة غير موجودة = فشل البوابة (Default-Deny)',
    failsEn: 'A button checking an unregistered action fails the gate, and any action pointing to a missing view fails too (Default-Deny)',
    script: 'node scripts/architecture-guardrails.mjs --check',
  },
  {
    id: 'architecture_invariants',
    index: 3,
    titleAr: 'الثوابت المعمارية وميزانية السرعة',
    titleEn: 'Architecture invariants & speed budget',
    scansAr:
      'سياسات RLS، أعمدة version، دوال NOTIFY، جسر LISTEN/SignalR، مسارات YARP، فلتر Default-Deny، HttpOnly Cookie، وألا يستورد كود العميل عميل قاعدة بيانات',
    scansEn:
      'RLS policies, version columns, NOTIFY functions, the LISTEN/SignalR bridge, YARP routes, the Default-Deny filter, HttpOnly cookies, and the absence of any DB driver import in client code',
    failsAr: 'غياب أي ثابت أساسي (مثل سياسات RLS أو عمود version) = فشل البوابة، والتوصيات غير المُلزِمة تُعرض منفصلة',
    failsEn: 'A missing core invariant (such as RLS policies or the version column) fails the gate; non-binding recommendations are listed separately',
    script: 'node scripts/architecture-guardrails.mjs --check',
  },
];

export const GUARDRAIL_COMMANDS = {
  verify: 'node scripts/architecture-guardrails.mjs --check',
  regenerate: 'node scripts/architecture-guardrails.mjs --update',
  withRatchet: 'node scripts/check-file-size.mjs',
};

/**
 * مقتطف CI الجاهز. ⚠️ ملاحظة صريحة: تطبيق GitHub المربوط بهذا المستودع لا يملك
 * صلاحية `workflows`، لذلك **لا يمكن دفعه** داخل `.github/workflows/` آلياً.
 * الخطوة موجودة في القالب `docs/ci/ci.yml` وتُنسخ يدوياً مرة واحدة (وهذا هو
 * نفسه الأسلوب الذي اتُّبع لتثبيت ملف الـ CI الأول في هذا المشروع).
 * أما محلياً فهي مفروضة فعلاً: `npm run verify` يشمل `guardrails:check`.
 */
export const CI_WORKFLOW_SNIPPET = `# .github/workflows/ci.yml — وظيفة "بوابات الجودة المعمارية"
# أو: انسخ الملف الجاهز من docs/ci/ci.yml إلى .github/workflows/ci.yml
guardrails:
  name: بوابات الجودة المعمارية
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 22

    # 1. بوابة التطبيق القديم: حد 300 سطر بنمط Ratchet (لا تتفاقم الديون)
    - name: Enforce file-size ratchet (300-line limit)
      run: node scripts/check-file-size.mjs

    # 2. بوابات المنظومة الجديدة: نطاق المحرك + سجل الأفعال + الثوابت المعمارية
    - name: Architecture guardrails (engine + action registry + invariants)
      run: node scripts/architecture-guardrails.mjs --check`;

/** حدود النطاق: أي الملفات تُقاس فعلاً في البوابة 1. */
export const GUARDRAIL_SCOPE_AR = [
  'erp-nextgen-local/** — التطبيق المرجعي (.NET 10 + SQL Migrations + السكربتات)',
  'src/services/architectureGuardrails.ts — منطق تقييم البوابات',
  'src/data/architecture/** — بيانات المعمارية واللقطة المقيسة',
  'src/components/architecture/** و src/components/ViewRenderer.tsx و src/views/ArchitectureView.tsx',
  'scripts/architecture-guardrails.mjs و scripts/guardrail-*.mjs و src/__tests__/architectureGuardrails.test.ts',
];

export const GUARDRAIL_SCOPE_EN = [
  'erp-nextgen-local/** — the reference application (.NET 10 + SQL migrations + scripts)',
  'src/services/architectureGuardrails.ts — the gate evaluation logic',
  'src/data/architecture/** — the architecture content and measured snapshot',
  'src/components/architecture/**, src/components/ViewRenderer.tsx and src/views/ArchitectureView.tsx',
  'scripts/architecture-guardrails.mjs, scripts/guardrail-*.mjs and src/__tests__/architectureGuardrails.test.ts',
];
