/**
 * محرك الشاشات (Metadata Registry) — طبقة العميل
 * ---------------------------------------------------------------------------
 * يقرأ تعريف الشاشات والأفعال والكيانات وحقولها من قاعدة البيانات بدل أن تكون
 * مكتوبة يدوياً في الكود. الفائدة المباشرة:
 *
 *   • إضافة حقل جديد لأي كيان = صف واحد في `erp_entity_fields` (بلا إعادة بناء).
 *   • الصلاحيات تُدار في مكان واحد (`erp_actions`) ويقرأها العميل والسيرفر معاً.
 *   • شاشة جدول كاملة تُولَّد من الـ Metadata بدل كتابتها يدوياً.
 *
 * التصميم:
 *   1. تحميل من الـ API (المصدر الرسمي).
 *   2. كاش في `localStorage` للعمل دون اتصال وللتحميل الفوري.
 *   3. كتالوج احتياطي مدمج (`SYSTEM_VIEWS` / `SYSTEM_ACTIONS`) حتى لا تتعطل
 *      الواجهة أبداً إذا كانت قاعدة البيانات غير مهيأة بعد.
 */

import { SYSTEM_ACTIONS, SYSTEM_VIEWS } from '../data/permissionsData';
import type { ActionPermissionDef } from '../types';
import { getApiToken, getApiUrl, isApiConfigured } from './apiClient';
import { loadMetadataFromDirectDb } from './metadataDirectLoader';
// ---------------------------------------------------------------------------
// الأنواع
// ---------------------------------------------------------------------------

export interface MetadataView {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  iconName: string;
  category: string;
  sortOrder: number;
}

export interface MetadataAction {
  key: string;
  nameAr: string;
  nameEn: string;
  viewId: string | null;
  descriptionAr?: string;
  descriptionEn?: string;
  sortOrder: number;
}

export interface MetadataField {
  /** معرّف الصف في erp_entity_fields — مطلوب للتعديل والحذف. */
  id?: number;
  columnName: string;
  labelAr: string;
  labelEn: string;
  dataType: string;
  isRequired: boolean;
  isReadonly: boolean;
  gridVisible: boolean;
  formOrder: number;
  width: number;
}

export interface MetadataEntity {
  code: string;
  tableName: string;
  displayNameAr: string;
  displayNameEn: string;
  viewId: string | null;
  softDelete: boolean;
  fields: MetadataField[];
}

export interface MetadataScreen {
  code: string;
  viewId: string | null;
  entityCode: string | null;
  kind: string;
  route: string;
  menuGroup: string;
  sortOrder: number;
  icon: string;
}

export interface MetadataRegistry {
  views: MetadataView[];
  actions: MetadataAction[];
  entities: MetadataEntity[];
  screens: MetadataScreen[];
  /** من أين جاءت البيانات: قاعدة البيانات أم الكتالوج المدمج. */
  source: 'database' | 'builtin';
  loadedAt: string;
}

// ---------------------------------------------------------------------------
// الكتالوج الاحتياطي المدمج
// ---------------------------------------------------------------------------

const BUILTIN_ACTIONS: MetadataAction[] = SYSTEM_ACTIONS.map((a: ActionPermissionDef, i) => ({
  key: a.key,
  nameAr: a.nameAr,
  nameEn: a.nameEn,
  viewId: a.viewId,
  descriptionAr: a.descriptionAr,
  descriptionEn: a.descriptionEn,
  sortOrder: (i + 1) * 10,
}));

const BUILTIN_VIEWS: MetadataView[] = SYSTEM_VIEWS.map((v, i) => ({
  id: v.id,
  nameAr: v.nameAr,
  nameEn: v.nameEn,
  descriptionAr: v.descriptionAr,
  descriptionEn: v.descriptionEn,
  iconName: v.iconName,
  category: v.category,
  sortOrder: (i + 1) * 10,
}));

const builtinRegistry = (): MetadataRegistry => ({
  views: BUILTIN_VIEWS,
  actions: BUILTIN_ACTIONS,
  entities: [],
  screens: [],
  source: 'builtin',
  loadedAt: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// الكاش
// ---------------------------------------------------------------------------

const CACHE_KEY = 'erp_metadata_registry';

let registry: MetadataRegistry = builtinRegistry();
let loadPromise: Promise<MetadataRegistry> | null = null;

/** يقرأ الكاش المحلي إن وُجد (تحميل فوري عند إعادة التشغيل). */
const readCache = (): MetadataRegistry | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MetadataRegistry;
    if (!Array.isArray(parsed?.views) || parsed.views.length === 0) return null;
    if (!Array.isArray(parsed?.entities) || parsed.entities.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (value: MetadataRegistry): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    /* تجاهل: الكاش تحسين أداء فقط ولا يجوز أن يكسر التطبيق */
  }
};

/** يستعيد الكاش المحلي فوراً عند تحميل الوحدة (بلا انتظار الشبكة). */
const cached = readCache();
if (cached) registry = cached;

// تحميل تلقائي عند بدء التطبيق عبر الاتصال المباشر (الوضع الافتراضي).
// بدون هذا السطر لا يُحمَّل محرك الشاشات أبداً لمن لا يستخدم الـ API.
if (!isApiConfigured() && typeof window !== 'undefined') {
  void loadMetadataFromDirectDb().then((loaded) => {
    if (loaded) {
      registry = loaded;
      writeCache(loaded);
    }
  });
}

// ---------------------------------------------------------------------------
// التحميل
// ---------------------------------------------------------------------------

/** الوصول الفوري للـ Metadata المحمّلة حالياً (بلا انتظار). */
export const getMetadataRegistry = (): MetadataRegistry => registry;

/**
 * يُحمّل الـ Metadata من قاعدة البيانات (عبر الـ API أو اتصال Neon المباشر).
 * لا يرفع استثناء أبداً: عند أي فشل يعود بالكتالوج المدمج أو الكاش.
 */
export async function loadMetadataRegistry(force = false): Promise<MetadataRegistry> {
  const needsFetch = force || !Array.isArray(registry.entities) || registry.entities.length === 0;
  if (loadPromise && !needsFetch) return loadPromise;

  loadPromise = (async (): Promise<MetadataRegistry> => {
    // المسار (1): الـ API — إن كان مفعّلاً.
    if (isApiConfigured() && getApiToken()) {
      try {
        const response = await fetch(`${getApiUrl()}/metadata/registry`, {
          headers: {
            Authorization: `Bearer ${getApiToken()}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const payload = (await response.json()) as Partial<MetadataRegistry>;
          const loaded: MetadataRegistry = {
            views: payload.views?.length ? payload.views : registry.views,
            actions: payload.actions?.length ? payload.actions : registry.actions,
            entities: payload.entities ?? registry.entities,
            screens: payload.screens ?? registry.screens,
            source: 'database',
            loadedAt: new Date().toISOString(),
          };

          registry = loaded;
          writeCache(loaded);
          return loaded;
        }
      } catch {
        /* fallback to Neon direct */
      }
    }

    // 2. التحميل المباشر من قاعدة بيانات Neon السحابية
    const neonPayload = await loadMetadataFromDirectDb();
    if (neonPayload && neonPayload.entities && neonPayload.entities.length > 0) {
      const loaded: MetadataRegistry = {
        views: neonPayload.views?.length ? neonPayload.views : registry.views,
        actions: neonPayload.actions?.length ? neonPayload.actions : registry.actions,
        entities: neonPayload.entities,
        screens: neonPayload.screens ?? registry.screens,
        source: 'database',
        loadedAt: new Date().toISOString(),
      };

      registry = loaded;
      writeCache(loaded);
      return loaded;
    }

    return registry;
  })();

  return loadPromise;
}

// ---------------------------------------------------------------------------
// استعلامات مساعدة
// ---------------------------------------------------------------------------

/** كل الأفعال المسجّلة لشاشة معيّنة. */
export const getActionsForView = (viewId: string): MetadataAction[] =>
  registry.actions
    .filter((a) => a.viewId === viewId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

/** كل الأفعال التي لا تنتمي لشاشة محددة (أفعال عامة). */
export const getGlobalActions = (): MetadataAction[] =>
  registry.actions.filter((a) => !a.viewId);

/** كيان بالرمز، أو undefined إن لم يكن مسجّلاً. */
export const getEntity = (code: string): MetadataEntity | undefined =>
  registry.entities.find((e) => e.code === code);

/** الأعمدة الظاهرة في الشبكة مرتّبة حسب ترتيب النموذج. */
export const getGridColumns = (entityCode: string): MetadataField[] =>
  (getEntity(entityCode)?.fields ?? [])
    .filter((f) => f.gridVisible)
    .sort((a, b) => a.formOrder - b.formOrder);

/** الأعمدة القابلة للكتابة (غير readonly) — تُستخدم في نماذج الإضافة والتعديل. */
export const getWritableFields = (entityCode: string): MetadataField[] =>
  (getEntity(entityCode)?.fields ?? [])
    .filter((f) => !f.isReadonly)
    .sort((a, b) => a.formOrder - b.formOrder);

/** الشاشات المولّدة من الـ Metadata مجمّعة حسب المجموعة. */
export const getScreensByGroup = (): Record<string, MetadataScreen[]> =>
  registry.screens.reduce<Record<string, MetadataScreen[]>>((acc, screen) => {
    (acc[screen.menuGroup] ||= []).push(screen);
    return acc;
  }, {});

/** يُعيد الوحدة إلى الكتالوج المدمج (يُستخدم عند تسجيل الخروج أو إعادة الضبط). */
export const resetMetadataRegistry = (): void => {
  registry = builtinRegistry();
  loadPromise = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* تجاهل */
  }
};

// ---------------------------------------------------------------------------
