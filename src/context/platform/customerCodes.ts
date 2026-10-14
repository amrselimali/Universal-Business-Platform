/**
 * إدارة أكواد العملاء (Customer Codes) — منطق نقي
 * ---------------------------------------------------------------------------
 * فُصل من `PlatformContext.tsx` (12,342 سطر) كأول خطوة في تقسيمه.
 * هذا المنطق **نقي** (Pure): لا يعتمد على React ولا على الشبكة ولا على قاعدة
 * البيانات — مدخلاته مصفوفة عملاء ومخرجاته مصفوفة منظّمة، فيسهل اختباره.
 *
 * القاعدة التي يحرسها:
 *   كود العميل المسلسل يجب أن يكون **مستقلاً عن كود السيستم (systemCode)**.
 *   أي كود مساوي لكود السيستم لا يُعتبر مسلسلاً صالحاً ويُعاد توليده،
 *   وإلا لظهر عميلان بنفس الرقم في التقارير.
 */

import type { Party } from '../../types';

/** هل هذا السجل عميل (وليس مورداً فقط)؟ */
export const isCustomerParty = (party: Party): boolean =>
  party.type === 'Customer' || party.type === 'Both';

/** هل الكود مختلف فعلاً عن كود السيستم / الكود الورقي؟ */
export const differsFromSystemCode = (party: Party, candidate: string): boolean =>
  ![party.systemCode, party.paperCode].some(
    (systemCode) =>
      Boolean(systemCode) &&
      (candidate === systemCode ||
        (/^\d+$/.test(systemCode!) && Number(candidate) === Number(systemCode)))
  );

/** هل هذا الكود مسلسل عميل صالح ومستقل؟ */
export const hasValidIndependentSerial = (party: Party, candidate?: string): boolean =>
  typeof candidate === 'string' &&
  /^\d+$/.test(candidate) &&
  Number.isSafeInteger(Number(candidate)) &&
  Number(candidate) > 0 &&
  differsFromSystemCode(party, candidate);

export interface NormalizeCodesOptions {
  /**
   * سجل «مورد كاش» يجب ضمان وجوده قبل الترقيم حتى لا يستهلك رقم عميل.
   * اختياري — إن لم يُمرَّر يُستخدم `fallbackCashSupplier`.
   */
  cashSupplier?: Party;
  /** الفرع الافتراضي الذي يُسنَد لأي عميل بلا فرع. */
  defaultBranchId?: string;
}

/**
 * يُعيد ترقيم أكواد العملاء بشكل موحّد وآمن:
 *   • يحتفظ بكل كود صالح ومستقل كما هو.
 *   • يولّد أكواداً جديدة للمكرر أو غير الصالح (بلا تصادم).
 *   • يضمن وجود «مورد كاش» حتى لا يستهلك مسلسل عميل.
 *   • يُسنِد الفرع الافتراضي لأي سجل بلا فرع.
 */
export const normalizeCustomerPartyCodes = (
  parties: Party[],
  options: NormalizeCodesOptions = {}
): Party[] => {
  const { cashSupplier, defaultBranchId = 'branch-cairo' } = options;

  const hasCashSupplier = parties.some(
    (party) =>
      party.id === 'party-s-cash' ||
      party.nameEn?.includes('Cash Supplier') ||
      party.name.includes('مورد كاش') ||
      party.name.includes('مورد نقدي')
  );

  const partiesToNormalize =
    hasCashSupplier || !cashSupplier ? parties : [cashSupplier, ...parties];

  const validStoredCodes = new Set(
    partiesToNormalize
      .filter(isCustomerParty)
      .map((party) =>
        [party.customerCode, party.code].find((code) => hasValidIndependentSerial(party, code))
      )
      .filter((code): code is string => Boolean(code))
      .map((code) => String(Number(code)))
  );

  const claimedCodes = new Set<string>();
  let nextCustomerSerial =
    Array.from(validStoredCodes).reduce((highest, code) => Math.max(highest, Number(code)), 0) + 1;

  return partiesToNormalize.map((party) => {
    const candidate = [party.customerCode, party.code].find((code) =>
      hasValidIndependentSerial(party, code)
    );

    let customerCode =
      isCustomerParty(party) && candidate ? String(Number(candidate)) : undefined;

    if (isCustomerParty(party)) {
      if (!customerCode || claimedCodes.has(customerCode)) {
        while (claimedCodes.has(String(nextCustomerSerial))) nextCustomerSerial++;
        customerCode = String(nextCustomerSerial++);
      }
      claimedCodes.add(customerCode);
    }

    return {
      ...party,
      branchId: party.branchId || defaultBranchId,
      customerCode: customerCode || party.customerCode,
      code: customerCode || party.code || party.customerCode,
    };
  });
};

/** أقصى كود عميل مسلسل مستخدم حالياً (يُستخدم لبدء الترقيم التالي). */
export const getHighestCustomerCode = (parties: Party[]): number =>
  parties.reduce((highest, party) => {
    if (!isCustomerParty(party)) return highest;
    const candidate = [party.customerCode, party.code].find((code) =>
      hasValidIndependentSerial(party, code)
    );
    return candidate ? Math.max(highest, Number(candidate)) : highest;
  }, 0);
