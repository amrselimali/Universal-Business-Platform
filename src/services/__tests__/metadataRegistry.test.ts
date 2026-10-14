import { describe, expect, it } from 'vitest';
import { SYSTEM_ACTIONS, SYSTEM_VIEWS } from '../../data/permissionsData';
import {
  getActionsForView,
  getEntity,
  getGlobalActions,
  getGridColumns,
  getMetadataRegistry,
  getScreensByGroup,
  getWritableFields,
  loadMetadataRegistry,
  resetMetadataRegistry,
} from '../metadataRegistry';

describe('metadataRegistry — الكتالوج الاحتياطي المدمج', () => {
  it('يعمل دائماً حتى بدون قاعدة بيانات (لا يعطّل الواجهة)', () => {
    resetMetadataRegistry();
    const registry = getMetadataRegistry();

    expect(registry.source).toBe('builtin');
    expect(registry.views.length).toBeGreaterThan(0);
    expect(registry.actions.length).toBeGreaterThan(0);
  });

  it('يحمّل كل الشاشات المعرّفة في التطبيق', () => {
    // نستورد المصدر مباشرة حتى لا يكسر الاختبار عند إضافة شاشة جديدة.
    const registry = getMetadataRegistry();
    expect(registry.views.length).toBe(SYSTEM_VIEWS.length);
    expect(registry.views.length).toBeGreaterThanOrEqual(21);
  });

  it('يحمّل كل الأفعال المعرّفة في التطبيق', () => {
    const registry = getMetadataRegistry();
    expect(registry.actions.length).toBe(SYSTEM_ACTIONS.length);
  });

  it('يرجع الشاشات مرتّبة ومُعرّفة بالعربية والإنجليزية', () => {
    const registry = getMetadataRegistry();
    const dashboard = registry.views.find((v) => v.id === 'dashboard');

    expect(dashboard).toBeDefined();
    expect(dashboard?.nameAr).toBeTruthy();
    expect(dashboard?.nameEn).toBeTruthy();
    expect(dashboard?.iconName).toBeTruthy();
  });

  it('يرجع أفعال شاشة معيّنة فقط (عزل صحيح)', () => {
    const posActions = getActionsForView('pos');
    expect(Array.isArray(posActions)).toBe(true);
    // كل فعل مُرجع يجب أن ينتمي فعلاً لهذه الشاشة
    posActions.forEach((a) => expect(a.viewId).toBe('pos'));
  });

  it('يرجع الأفعال العامة (بدون شاشة) منفصلة', () => {
    const globals = getGlobalActions();
    globals.forEach((a) => expect(a.viewId).toBeNull());
  });

  it('يرجع undefined لكيان غير مسجّل', () => {
    expect(getEntity('does_not_exist')).toBeUndefined();
  });

  it('يرجع مصفوفة فارغة (لا ينهار) لكيان غير مسجّل', () => {
    expect(getGridColumns('does_not_exist')).toEqual([]);
    expect(getWritableFields('does_not_exist')).toEqual([]);
  });

  it('يرجع قاموساً فارغاً للشاشات المولّدة عند غياب قاعدة البيانات', () => {
    expect(getScreensByGroup()).toEqual({});
  });

  it('لا يرفع استثناء عند فشل التحميل من الشبكة', async () => {
    resetMetadataRegistry();
    const result = await loadMetadataRegistry();
    expect(result).toBeDefined();
    expect(Array.isArray(result.views)).toBe(true);
  });
});
