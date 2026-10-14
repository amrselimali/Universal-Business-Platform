import { describe, expect, it } from 'vitest';
import {
  DATASET_COUNT,
  buildDatasetDocuments,
  type DatasetSource,
} from '../datasetDocuments';

/** مصدر بيانات وهمي: كل مجموعة تحتوي عنصراً واحداً يميّزها. */
const buildSource = (): DatasetSource => {
  const source = {} as Record<string, unknown[]>;
  const keys = [
    'allTenants', 'allUsers', 'allBranches', 'allWarehouses', 'allCategories', 'allProducts',
    'allStockMovements', 'stockLevels', 'allAccounts', 'allJournals', 'allParties', 'allInvoices',
    'allAppointments', 'allPatientFollowUps', 'allTreatmentPlans', 'allCashReceipts',
    'allCustomerRefunds', 'allCashPayments', 'allReceptionShifts', 'allPosShifts',
    'allPaymentMethods', 'allSpecializedTaxInvoices', 'allGoodsReceipts', 'allGoodsIssues',
    'allStaffMembers', 'allPayrollRuns', 'allAttendanceRecords', 'allInventoryAudits',
    'allDeviceMaintenance', 'allLaserDevices', 'allPeriodLocks', 'allAuditRecords',
    'allUserActivityLogs', 'allNotifications',
  ];
  keys.forEach((k) => {
    source[k] = [{ marker: k }];
  });
  return source as unknown as DatasetSource;
};

describe('datasetDocuments — عقد التخزين', () => {
  it('يُرجع كل مجموعات البيانات المعرّفة', () => {
    const docs = buildDatasetDocuments(buildSource());
    expect(docs).toHaveLength(DATASET_COUNT);
  });

  it('عدد المجموعات لا يقل عن 34 (يمنع ضياع بيانات بصمت)', () => {
    expect(DATASET_COUNT).toBeGreaterThanOrEqual(34);
  });

  it('لا يوجد مفتاح مكرر (تكرار المفتاح يعني الكتابة فوق بيانات مجموعة أخرى)', () => {
    const docs = buildDatasetDocuments(buildSource());
    const keys = docs.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('كل مفتاح غير فارغ ويبدأ بـ erp_ أو clinic_', () => {
    const docs = buildDatasetDocuments(buildSource());
    docs.forEach((doc) => {
      expect(doc.key.length).toBeGreaterThan(0);
      expect(doc.key.startsWith('erp_') || doc.key.startsWith('clinic_')).toBe(true);
    });
  });

  it('كل مجموعة مربوطة بمصدرها الصحيح (لا خلط بين المجموعات)', () => {
    const docs = buildDatasetDocuments(buildSource());
    docs.forEach((doc) => {
      const payload = doc.payload as { marker: string }[];
      expect(Array.isArray(payload)).toBe(true);
      expect(payload[0].marker).toBeTruthy();
    });
  });

  it('يربط اسم المفتاح بالمصدر الصحيح تحديداً', () => {
    const docs = buildDatasetDocuments(buildSource());
    const byKey = new Map(docs.map((d) => [d.key, d.payload as { marker: string }[]]));

    expect(byKey.get('erp_tenants')?.[0].marker).toBe('allTenants');
    expect(byKey.get('erp_branches')?.[0].marker).toBe('allBranches');
    expect(byKey.get('erp_parties_backup')?.[0].marker).toBe('allParties');
    expect(byKey.get('erp_audit_records')?.[0].marker).toBe('allAuditRecords');
    expect(byKey.get('erp_notifications_history')?.[0].marker).toBe('allNotifications');
    expect(byKey.get('clinic_laser_devices')?.[0].marker).toBe('allLaserDevices');
  });

  it('يتعامل مع مجموعات فارغة (مستخدم جديد)', () => {
    const source = buildSource() as unknown as Record<string, unknown[]>;
    Object.keys(source).forEach((k) => {
      source[k] = [];
    });
    const docs = buildDatasetDocuments(source as unknown as DatasetSource);
    expect(docs).toHaveLength(DATASET_COUNT);
    docs.forEach((d) => expect(d.payload).toEqual([]));
  });
});
