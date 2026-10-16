/**
 * عيوب المنصة السابقة ← الحلول المعمارية في المنظومة الجديدة
 * ---------------------------------------------------------------------------
 * كل عيب هنا **مُقاس في هذا المستودع**، لا مبالغة تسويقية:
 * خط الأساس في `.github/file-size-baseline.json` يُظهر 59 ملفاً يتجاوز 300 سطر
 * (منها `PlatformContext.tsx` بأكثر من 12,000 سطر)، والمتصفح في المنصة الحالية
 * يحمل بيانات اعتماد Neon مباشرة عبر `@neondatabase/serverless` — وهو تحديداً
 * ما تعالجه الطبقات الجديدة.
 */

export interface FlawFixRow {
  id: string;
  flawAr: string;
  flawEn: string;
  solutionAr: string;
  solutionEn: string;
  proofAr: string;
  proofEn: string;
}

export const PREVIOUS_FLAWS: FlawFixRow[] = [
  {
    id: 'bloat',
    flawAr: 'تضخّم الكود: ملفات واجهات تتجاوز 10 آلاف سطر يستحيل صيانتها',
    flawEn: 'Code bloat: screens over 10,000 lines that are impossible to maintain',
    solutionAr: 'Metadata Screen Engine: الشاشات تتولّد آلياً من تعريف Metadata، وحد 300 سطر مفروض في الـ CI',
    solutionEn: 'Metadata screen engine: screens are generated from metadata definitions, with a CI-enforced 300-line limit',
    proofAr: 'البوابة 1 ترفض أي ملف يتجاوز 300 سطر داخل نطاق المعمارية الجديدة',
    proofEn: 'Gate 1 rejects any file over 300 lines in the new-architecture scope',
  },
  {
    id: 'button-lag',
    flawAr: 'بطء الزر وهنج الشاشة: انتظار رد السيرفر قبل تحديث الواجهة مع طلبات N+1 متتالية',
    flawEn: 'Laggy buttons and frozen screens: waiting on the server before updating the UI, plus N+1 calls',
    solutionAr: 'Optimistic UI + نقطة نهاية موحّدة ومُجمَّعة لكل شاشة، ثم تسوية الحالة من الحدث اللحظي',
    solutionEn: 'Optimistic UI plus one consolidated endpoint per screen, reconciled by the realtime event',
    proofAr: 'حلقة المزامنة: تحديث محلي في 0ms ← API (version++) ← NOTIFY ← SignalR',
    proofEn: 'Realtime loop: local update at 0 ms → API (version++) → NOTIFY → SignalR',
  },
  {
    id: 'permissions',
    flawAr: 'نسيان الصلاحيات: زر جديد في الواجهة بلا تسجيل في شاشة الصلاحيات = ثغرة أمنية',
    flawEn: 'Forgotten permissions: a new UI button without a registry entry becomes a security hole',
    solutionAr: 'Action Registry كمصدر واحد للأزرار + Default-Deny مفروض مركزياً على السيرفر',
    solutionEn: 'Action Registry as the single source of buttons + server-side Default-Deny in one central filter',
    proofAr: 'البوابة 2 تفشل إذا استخدمت أي شاشة فعلاً غير مسجّل في السجل',
    proofEn: 'Gate 2 fails whenever any screen uses an action absent from the registry',
  },
  {
    id: 'cold-start',
    flawAr: 'Cold Starts: انتظار قاتل عند أول طلب بسبب مزوّدي السحابة المجانية (Scale-to-Zero)',
    flawEn: 'Cold starts: a painful wait on the first request caused by free-tier scale-to-zero',
    solutionAr: 'خدمات دائمة التشغيل على Postgres مُدار قريب من مصر (زمن شبكة مستهدف أقل من 50ms)',
    solutionEn: 'Always-on services on a managed Postgres close to Egypt (sub-50 ms network target)',
    proofAr: 'بيئة التشغيل المرجعية تعمل بـ `restart: unless-stopped` بلا إيقاف تلقائي',
    proofEn: 'The reference runtime uses `restart: unless-stopped` with no automatic shutdown',
  },
  {
    id: 'db-access',
    flawAr: 'المتصفح يتصل بقاعدة البيانات مباشرة، فيحمل مفاتيح الوصول ويخترق حدود العزل',
    flawEn: 'The browser connects straight to the database, carrying access keys and crossing isolation boundaries',
    solutionAr: 'المتصفح لا يرى الداتابيز إطلاقاً: بوابة YARP ← خدمات ← Postgres مع RLS و Tenant من التوكن',
    solutionEn: 'The browser never sees the database: YARP gateway → services → Postgres with RLS and token-derived tenant',
    proofAr: 'البوابة 3 تتحقق من عدم وجود أي استيراد لعميل قاعدة بيانات في كود العميل بالمحرك الجديد',
    proofEn: 'Gate 3 verifies the new engine client code imports no database driver at all',
  },
  {
    id: 'concurrency',
    flawAr: 'رجوع القيم القديمة: تعديلان متزامنان يكتب أحدهما فوق الآخر بلا اكتشاف',
    flawEn: 'Stale values: two concurrent edits silently overwrite each other',
    solutionAr: 'عمود version + شرط WHERE version = @clientVersion، والتعارض يُعاد كـ 409 Conflict صريح',
    solutionEn: 'A version column with WHERE version = @clientVersion, and conflicts surface as an explicit 409',
    proofAr: 'Trigger core.touch_row يزيد الإصدار، ونقطة التحديث ترجع 409 عند عدم التطابق',
    proofEn: 'The core.touch_row trigger bumps the version and the update endpoint returns 409 on mismatch',
  },
];


export interface ServiceCard {
  id: string;
  nameAr: string;
  nameEn: string;
  dutyAr: string;
  dutyEn: string;
}

/** الخدمات الأربع/الخمس: كل خدمة تملك مجالاً واحداً فقط. */
export const ARCHITECTURE_SERVICES: ServiceCard[] = [
  {
    id: 'generic',
    nameAr: 'Generic Data API',
    nameEn: 'Generic Data API',
    dutyAr: 'Dapper + Metadata: CRUD عام لكل الكيانات المسجّلة عبر Keyset Pagination وتزامن بـ version',
    dutyEn: 'Dapper + metadata: generic CRUD for every registered entity with keyset pagination and version checks',
  },
  {
    id: 'auth',
    nameAr: 'Auth API',
    nameEn: 'Auth API',
    dutyAr: 'RBAC + HttpOnly Refresh Cookie، والتوكن يحمل tenant_id وuser_id اللذين تقرأهما سياسات RLS',
    dutyEn: 'RBAC + HttpOnly refresh cookie; the token carries the tenant_id/user_id that RLS policies read',
  },
  {
    id: 'modules',
    nameAr: 'Module APIs',
    nameEn: 'Module APIs',
    dutyAr: 'منطق الأعمال والحسابات فقط (ترحيل، تحصيل، جرد) — بلا شاشات ولا استعلامات عامة',
    dutyEn: 'Business and accounting logic only (posting, receipts, stock) with no screens or generic queries',
  },
  {
    id: 'realtime',
    nameAr: 'Realtime SignalR',
    nameEn: 'Realtime SignalR',
    dutyAr: 'جسر LISTEN على قناة table_changes يوزّع الأحداث على مجموعة المنشأة فقط',
    dutyEn: 'A LISTEN bridge on the table_changes channel fanning events to the tenant group only',
  },
  {
    id: 'outbox',
    nameAr: 'Transactional Outbox + Jobs',
    nameEn: 'Transactional Outbox + Jobs',
    dutyAr: 'لا تُفقد أي حركة مالية: الحدث يُكتب في نفس معاملة الحركة ثم يُعالَج بمهام مجدولة',
    dutyEn: 'No financial movement is ever lost: the event is written in the same transaction, then processed by jobs',
  },
];
