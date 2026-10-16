/**
 * مواصفات المعمارية المعتمدة للمنظومة الجديدة (Clean Micro-Engine Architecture)
 * ---------------------------------------------------------------------------
 * بيانات تعريفية تُقرأ في الشاشة فقط. كل رقم هنا **هدف تصميمي مُعتمد**،
 * وليس قياساً حياً — القياس الحي في `guardrailsSnapshot.ts`.
 *
 * المصدر: قرار المالك على معمارية YARP + .NET 10 + PostgreSQL RLS + SignalR،
 * والتنفيذ المرجعي الموجود فعلاً في `erp-nextgen-local/` داخل هذا المستودع.
 */

export interface BudgetItem {
  id: string;
  labelAr: string;
  labelEn: string;
  value: string;
  noteAr: string;
  noteEn: string;
}

export interface LayerCard {
  id: string;
  title: string;
  subtitleAr: string;
  subtitleEn: string;
  accent: string;
  itemsAr: string[];
  itemsEn: string[];
  evidenceAr: string;
  evidenceEn: string;
}

export interface LoopStep {
  index: number;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
}

/** ميزانية الالتزام المعماري — الأرقام التي يُقاس عليها النظام. */
export const ARCHITECTURE_BUDGET: BudgetItem[] = [
  {
    id: 'users',
    labelAr: 'المستخدمون المتزامنون',
    labelEn: 'Concurrent users',
    value: '< 100',
    noteAr: 'حجم يسمح بخدمات خفيفة بلا تعقيد توزيع أو Sharding',
    noteEn: 'Small enough for lean services with no sharding complexity',
  },
  {
    id: 'availability',
    labelAr: 'بدون Scale-to-Zero',
    labelEn: 'No scale-to-zero',
    value: '24/7',
    noteAr: 'الخدمة دائمة التشغيل حتى لا يدفع أول مستخدم ثمن الـ Cold Start',
    noteEn: 'Always-on services so the first user never pays a cold-start penalty',
  },
  {
    id: 'latency',
    labelAr: 'ميزانية السرعة',
    labelEn: 'Speed budget',
    value: '< 200 ms',
    noteAr: 'هدف لنقطة النهاية الواحدة، ويُقاس بـ k6 / Lighthouse خارج هذا الفحص',
    noteEn: 'Target per consolidated endpoint; measured by k6 / Lighthouse outside this audit',
  },
  {
    id: 'endpoints',
    labelAr: 'نقاط النهاية لكل شاشة',
    labelEn: 'Endpoints per screen',
    value: '1',
    noteAr: 'نقطة عامة واحدة تخدم كل الكيانات المسجّلة في الـ Metadata',
    noteEn: 'One generic endpoint serves every metadata-registered entity',
  },
  {
    id: 'files',
    labelAr: 'حد حجم الملف في الـ CI',
    labelEn: 'CI file-size limit',
    value: '300 سطر',
    noteAr: 'الـ Build يفشل فوراً على أي ملف يتجاوز الحد — يمنع ملفات الـ 10 آلاف سطر',
    noteEn: 'The build fails immediately on any oversized file — prevents 10k-line screens',
  },
  {
    id: 'permissions',
    labelAr: 'الصلاحيات المسبقة',
    labelEn: 'Permission model',
    value: 'Default Deny',
    noteAr: 'فعل غير مسجّل في الـ Action Registry = ممنوع، بلا استثناءات',
    noteEn: 'An action absent from the Action Registry is denied, no exceptions',
  },
];

/** الطبقات الأربع: من المتصفح إلى قاعدة البيانات. */
export const ARCHITECTURE_LAYERS: LayerCard[] = [
  {
    id: 'client',
    title: 'LAYER 1 · CLIENT',
    subtitleAr: 'React 19 SPA (Vite + Tailwind)',
    subtitleEn: 'React 19 SPA (Vite + Tailwind)',
    accent: 'sky',
    itemsAr: [
      'واجهة أحادية متجاوبة عالية السرعة، لا تتصل بالداتابيز أبداً',
      'AG Grid Community بنمط Keyset Pagination',
      'TanStack Query للكاش والتحديث التلقائي في الخلفية',
      'Optimistic UI: تحديث فوري للزر قبل رد السيرفر',
      'SignalR Client لاستقبال الأحداث اللحظية',
      'JWT Bearer + HttpOnly Refresh Cookie',
    ],
    itemsEn: [
      'Single responsive high-speed SPA — never connects to the database',
      'AG Grid Community with keyset pagination',
      'TanStack Query for caching and background refresh',
      'Optimistic UI: instant button feedback before the server replies',
      'SignalR client for realtime events',
      'JWT bearer + HttpOnly refresh cookie',
    ],
    evidenceAr: 'المبدأ مطبَّق في المنصة الحالية: طبقة `apiClient` تمنع المتصفح من حمل بيانات اعتماد الداتابيز',
    evidenceEn: 'Applied today: the `apiClient` layer keeps database credentials out of the browser',
  },
  {
    id: 'gateway',
    title: 'LAYER 2 · GATEWAY',
    subtitleAr: 'YARP Reverse Proxy (.NET 10)',
    subtitleEn: 'YARP reverse proxy (.NET 10)',
    accent: 'indigo',
    itemsAr: [
      'استخراج وتأكيد tenant_id من التوكن',
      'التحقق من الـ JWT Claims قبل الوصول للخدمات',
      'توجيه WebSockets إلى SignalR',
      'تجميع الـ Endpoints لتفادي Chatty Calls',
      'توجيه فائق السرعة بأقل من 2ms Overhead',
      'Rate Limiting لكل منشأة (600 طلب في الدقيقة)',
    ],
    itemsEn: [
      'Extract and confirm tenant_id from the token',
      'Validate JWT claims before reaching any service',
      'Route WebSockets to SignalR',
      'Aggregate endpoints to avoid chatty calls',
      'Ultra-low latency routing (< 2ms overhead)',
      'Per-tenant rate limiting (600 requests/minute)',
    ],
    evidenceAr: 'منفَّذ فعلاً في `erp-nextgen-local/dotnet/src/Erp.Gateway/Program.cs` مع 4 مسارات توجيه',
    evidenceEn: 'Already implemented in `erp-nextgen-local/dotnet/src/Erp.Gateway/Program.cs` with 4 proxy routes',
  },
  {
    id: 'services',
    title: 'LAYER 3 · SERVICES',
    subtitleAr: '4-5 خدمات خفيفة (.NET 10 Minimal APIs)',
    subtitleEn: '4-5 lean .NET 10 minimal services',
    accent: 'violet',
    itemsAr: [
      'Generic Data API (Dapper + Metadata)',
      'Auth API (RBAC + HttpOnly Cookies)',
      'Module APIs (منطق الأعمال والحسابات فقط)',
      'Realtime SignalR (Postgres Listener)',
      'Transactional Outbox + مهام مجدولة',
    ],
    itemsEn: [
      'Generic Data API (Dapper + metadata)',
      'Auth API (RBAC + HttpOnly cookies)',
      'Module APIs (business and accounting logic only)',
      'Realtime SignalR (Postgres listener)',
      'Transactional outbox + scheduled jobs',
    ],
    evidenceAr: 'كل خدمة مسؤولة عن مجال محدد، وممنوع اختراق جداول الخدمات الأخرى',
    evidenceEn: 'Each service owns one domain; crossing into another service tables is forbidden',
  },
  {
    id: 'database',
    title: 'LAYER 4 · DATABASE',
    subtitleAr: 'PostgreSQL (Managed Cloud)',
    subtitleEn: 'PostgreSQL (managed cloud)',
    accent: 'emerald',
    itemsAr: [
      'Row-Level Security على كل جدول حساس',
      'عمود version للتزامن المتفائل',
      'LISTEN / NOTIFY لبث لحظي بلا استعلامات دورية',
      'PgBouncer لمنع استهلاك الاتصالات',
      "set_config('app.tenant_id', …, true) داخل نفس المعاملة",
      'Trigger تدقيق آلي + Outbox ذري',
    ],
    itemsEn: [
      'Row-Level Security on every sensitive table',
      'A version column for optimistic concurrency',
      'LISTEN / NOTIFY for realtime push without polling',
      'PgBouncer to cap connection consumption',
      "set_config('app.tenant_id', …, true) inside the same transaction",
      'Automatic audit trigger + transactional outbox',
    ],
    evidenceAr: 'منفَّذ فعلاً: 10 ملفات Migrations في `erp-nextgen-local/db/migrations/`',
    evidenceEn: 'Already implemented: 10 migration files under `erp-nextgen-local/db/migrations/`',
  },
];

/** حلقة المزامنة اللحظية: من ضغط الزر إلى شاشات كل المشغلين. */
export const REALTIME_LOOP: LoopStep[] = [
  {
    index: 1,
    titleAr: 'المستخدم يعدّل',
    titleEn: 'User edits',
    detailAr: 'ضغط على الزر أو تعديل مباشر داخل الشبكة',
    detailEn: 'A button press or an inline grid edit',
  },
  {
    index: 2,
    titleAr: 'Optimistic UI فوراً',
    titleEn: 'Optimistic UI',
    detailAr: 'الواجهة تتحدث في 0ms دون انتظار السيرفر — لا هنج ولا مؤشر تحميل',
    detailEn: 'The UI updates in 0 ms without waiting — no freeze, no spinner',
  },
  {
    index: 3,
    titleAr: 'API Update (version++)',
    titleEn: 'API update (version++)',
    detailAr: 'نقطة واحدة لكل شاشة، وتحديث مشروط بالـ version؛ التعارض = 409 Conflict',
    detailEn: 'One endpoint per screen, conditional on version; conflicts return 409',
  },
  {
    index: 4,
    titleAr: 'Postgres NOTIFY',
    titleEn: 'Postgres NOTIFY',
    detailAr: 'Trigger البث يرسل الحمولة على قناة table_changes داخل نفس المعاملة',
    detailEn: 'The realtime trigger publishes to table_changes in the same transaction',
  },
  {
    index: 5,
    titleAr: 'SignalR Hub',
    titleEn: 'SignalR hub',
    detailAr: 'جسر LISTEN يوزّع الحدث على مجموعة المنشأة فقط: tenant_{tenant_id}',
    detailEn: 'A LISTEN bridge fans the event out to tenant_{tenant_id} only',
  },
  {
    index: 6,
    titleAr: 'كل المشغلين يتحدّثون',
    titleEn: 'All operators updated',
    detailAr: 'بقية الشاشات تُحدَّث لحظياً دون تحديث الصفحة ودون أي اتصال مباشر بالداتابيز',
    detailEn: 'Every other screen refreshes live — no page reload, no direct DB connection',
  },
];


