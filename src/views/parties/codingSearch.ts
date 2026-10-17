/**
 * منطق بحث التكويد — دالة نقية مستخرجة من PartiesView
 * ---------------------------------------------------------------------------
 * تُبقي نفس شروط البحث تماماً (نوع/حالة/فرع/أكواد/هاتف/تاريخ/نص حر) لكن خارج
 * الشاشة، لتقليل أسطرها وإتاحة اختبارها، بلا أي تغيير في السلوك.
 */

import type { Party } from '../../types';

export interface CodingFilters {
  query: string;
  branchIds: string[];
  statuses: string[];
  customerCodes: string[];
  systemCodes: string[];
  fileCodes: string[];
  phone: string;
  dateFrom: string;
  dateTo: string;
}

export interface BranchRef {
  id: string;
  name: string;
  code?: string;
}

export const filterCodingResults = (
  parties: Party[],
  branches: BranchRef[],
  filters: CodingFilters
): Party[] => {
  const query = filters.query.trim().toLocaleLowerCase();
  const phone = filters.phone.trim().toLocaleLowerCase();

  return parties.filter((party) => {
    if (!(party.type === 'Customer' || party.type === 'Both')) return false;
    const isArchived = Boolean(party.isArchived || party.mergedIntoPartyId);
    if (filters.statuses.length && !filters.statuses.includes(isArchived ? 'archived' : 'active')) return false;

    const assignedBranch =
      branches.find((branch) => branch.id === party.branchId || branch.name === party.branchId || branch.code === party.branchId)?.id ||
      party.branchId;
    const customerBranches = new Set(
      [assignedBranch, ...(party.branchIds || []).map((value) => branches.find((branch) => branch.id === value || branch.name === value || branch.code === value)?.id || value)].filter(
        Boolean
      )
    );
    if (filters.branchIds.length && !filters.branchIds.some((branchId) => customerBranches.has(branchId))) return false;

    const customerCode = party.customerCode || party.code || '';
    const systemCode = party.systemCode || party.paperCode || '';
    const fileCode = party.fileCode || party.fileNumber || '';
    if (filters.customerCodes.length && !filters.customerCodes.includes(customerCode)) return false;
    if (filters.systemCodes.length && !filters.systemCodes.includes(systemCode)) return false;
    if (filters.fileCodes.length && !filters.fileCodes.includes(fileCode)) return false;
    if (phone && ![party.phone, party.altPhone].some((value) => value?.toLocaleLowerCase().includes(phone))) return false;

    const createdDate = party.createdAt?.slice(0, 10) || '';
    if (filters.dateFrom && (!createdDate || createdDate < filters.dateFrom)) return false;
    if (filters.dateTo && (!createdDate || createdDate > filters.dateTo)) return false;

    if (query) {
      const values = Object.values(party).flatMap((value) => (Array.isArray(value) ? value : [value]));
      if (!values.some((value) => value != null && String(value).toLocaleLowerCase().includes(query))) return false;
    }
    return true;
  });
};

/** خيارات أكواد العميل/السيستم/الملف لقوائم فلترة التكويد. */
export const buildCodingCodeOptions = (
  parties: Party[],
  branches: BranchRef[],
  branchIds: string[],
  statuses: string[],
  language: 'ar' | 'en'
): { customerCodes: Array<{ value: string; label: string }>; systemCodes: Array<{ value: string; label: string }>; fileCodes: Array<{ value: string; label: string }> } => {
  const scoped = parties.filter((party) => {
    if (!(party.type === 'Customer' || party.type === 'Both')) return false;
    const isArchived = Boolean(party.isArchived || party.mergedIntoPartyId);
    if (statuses.length && !statuses.includes(isArchived ? 'archived' : 'active')) return false;
    const assignedBranch =
      branches.find((branch) => branch.id === party.branchId || branch.name === party.branchId || branch.code === party.branchId)?.id ||
      party.branchId;
    const partyBranchIds = new Set(
      [assignedBranch, ...(party.branchIds || []).map((value) => branches.find((branch) => branch.id === value || branch.name === value || branch.code === value)?.id || value)].filter(
        Boolean
      )
    );
    return !branchIds.length || branchIds.some((branchId) => partyBranchIds.has(branchId));
  });

  const optionsFor = (getValue: (party: Party) => string | undefined) =>
    Array.from(new Set(scoped.map(getValue).filter((value): value is string => Boolean(value?.trim()))))
      .sort((a, b) => a.localeCompare(b, language === 'ar' ? 'ar' : 'en'))
      .map((value) => ({ value, label: value }));

  return {
    customerCodes: optionsFor((party) => party.customerCode || party.code),
    systemCodes: optionsFor((party) => party.systemCode || party.paperCode),
    fileCodes: optionsFor((party) => party.fileCode || party.fileNumber),
  };
};
