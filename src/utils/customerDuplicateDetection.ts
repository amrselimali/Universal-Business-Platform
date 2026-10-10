import { Party } from '../types';

export type CustomerDuplicateReason = 'name' | 'phone' | 'fileCode' | 'systemCode';

export interface CustomerDuplicateMatch {
  party: Party;
  reasons: CustomerDuplicateReason[];
  nameSimilarity?: number;
  phoneSimilarity?: number;
}

interface BranchDuplicateIndex {
  nameGrams: Map<string, Set<Party>>;
  shortNames: Map<string, Set<Party>>;
  phoneGrams: Map<string, Set<Party>>;
  shortPhones: Map<string, Set<Party>>;
  systemCodes: Map<string, Set<Party>>;
  fileCodes: Map<string, Set<Party>>;
}

export type CustomerDuplicateIndex = Map<string, BranchDuplicateIndex>;

const normalizeText = (value?: string) =>
  (value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');

const normalizeCode = (value?: string) => (value || '').trim().toLocaleLowerCase();
const normalizePhone = (value?: string) => (value || '').replace(/\D/g, '');

const levenshteinDistance = (left: string, right: string, maxDistance = Number.POSITIVE_INFINITY): number => {
  const a = Array.from(left);
  const b = Array.from(right);
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    current.fill(maxDistance + 1);
    current[0] = i <= maxDistance ? i : maxDistance + 1;
    let rowMinimum = current[0];
    const firstColumn = Math.max(1, i - maxDistance);
    const lastColumn = Math.min(b.length, i + maxDistance);
    for (let j = firstColumn; j <= lastColumn; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      rowMinimum = Math.min(rowMinimum, current[j]);
    }
    if (rowMinimum > maxDistance) return maxDistance + 1;
    [previous, current] = [current, previous];
  }
  return previous[b.length];
};

const similarity = (left: string, right: string) => {
  if (!left || !right) return 0;
  const length = Math.max(Array.from(left).length, Array.from(right).length);
  const maxDistance = Math.floor(length * 0.2);
  const distance = levenshteinDistance(left, right, maxDistance);
  return distance > maxDistance ? 0 : 1 - distance / length;
};

const valuesForPartyNames = (party: Party) => [party.name, party.nameEn].map(normalizeText).filter(Boolean);
const valuesForPartyPhones = (party: Party) => [party.phone, party.altPhone].map(normalizePhone).filter(Boolean);

const addToIndex = (index: Map<string, Set<Party>>, key: string, party: Party) => {
  if (!key) return;
  const values = index.get(key) || new Set<Party>();
  values.add(party);
  index.set(key, values);
};

const addTextToIndex = (grams: Map<string, Set<Party>>, short: Map<string, Set<Party>>, value: string, party: Party) => {
  if (Array.from(value).length < 3) {
    addToIndex(short, value, party);
    return;
  }
  const chars = Array.from(value);
  for (let i = 0; i < chars.length - 1; i++) addToIndex(grams, chars[i] + chars[i + 1], party);
};

const isCustomer = (party: Party) => party.type === 'Customer' || party.type === 'Both' || !party.type;

export const buildCustomerDuplicateIndex = (
  parties: Party[],
  defaultBranchId: string
): CustomerDuplicateIndex => {
  const index: CustomerDuplicateIndex = new Map();

  parties.forEach((party) => {
    if (!isCustomer(party)) return;
    const branchId = party.branchId || defaultBranchId;
    let branch = index.get(branchId);
    if (!branch) {
      branch = {
        nameGrams: new Map(),
        shortNames: new Map(),
        phoneGrams: new Map(),
        shortPhones: new Map(),
        systemCodes: new Map(),
        fileCodes: new Map(),
      };
      index.set(branchId, branch);
    }

    valuesForPartyNames(party).forEach((name) => addTextToIndex(branch!.nameGrams, branch!.shortNames, name, party));
    valuesForPartyPhones(party).forEach((phone) => addTextToIndex(branch!.phoneGrams, branch!.shortPhones, phone, party));
    [party.systemCode, party.paperCode].forEach((code) => addToIndex(branch!.systemCodes, normalizeCode(code), party));
    [party.fileCode, party.fileNumber, party.paperCode].forEach((code) => addToIndex(branch!.fileCodes, normalizeCode(code), party));
  });

  return index;
};

export const buildCustomerDuplicateIndexAsync = async (
  parties: Party[],
  defaultBranchId: string,
  batchSize = 250,
  onProgress?: (processed: number, total: number) => void,
  namesOnly = false
): Promise<CustomerDuplicateIndex> => {
  const index: CustomerDuplicateIndex = new Map();
  for (let i = 0; i < parties.length; i++) {
    const party = parties[i];
    if (isCustomer(party)) {
      const branchId = party.branchId || defaultBranchId;
      let branch = index.get(branchId);
      if (!branch) {
        branch = { nameGrams: new Map(), shortNames: new Map(), phoneGrams: new Map(), shortPhones: new Map(), systemCodes: new Map(), fileCodes: new Map() };
        index.set(branchId, branch);
      }
      valuesForPartyNames(party).forEach((name) => addTextToIndex(branch!.nameGrams, branch!.shortNames, name, party));
      if (!namesOnly) {
        valuesForPartyPhones(party).forEach((phone) => addTextToIndex(branch!.phoneGrams, branch!.shortPhones, phone, party));
        [party.systemCode, party.paperCode].forEach((code) => addToIndex(branch!.systemCodes, normalizeCode(code), party));
        [party.fileCode, party.fileNumber, party.paperCode].forEach((code) => addToIndex(branch!.fileCodes, normalizeCode(code), party));
      }
    }
    if ((i + 1) % Math.max(1, batchSize) === 0) {
      onProgress?.(i + 1, parties.length);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  onProgress?.(parties.length, parties.length);
  return index;
};

const addTextCandidates = (
  values: string[],
  grams: Map<string, Set<Party>>,
  short: Map<string, Set<Party>>,
  output: Set<Party>
) => {
  values.forEach((value) => {
    const chars = Array.from(value);
    if (chars.length < 3) {
      short.get(value)?.forEach((party) => output.add(party));
      return;
    }
    const distinctGrams = Array.from(new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1])));
    // With an 80% Levenshtein threshold, at most floor(queryLength / 4)
    // edits can qualify, even when the matching value is longer. Each edit
    // can invalidate at most two distinct bigrams, so one of the rarest
    // 2d+1 query bigrams must still be shared by every valid match.
    const maxQualifyingEdits = Math.floor(chars.length / 4);
    const requiredGrams = Math.min(distinctGrams.length, 2 * maxQualifyingEdits + 1);
    const selectedGrams = distinctGrams.length > requiredGrams
      ? distinctGrams
          .sort((left, right) => (grams.get(left)?.size || 0) - (grams.get(right)?.size || 0))
          .slice(0, requiredGrams)
      : distinctGrams;
    selectedGrams.forEach((gram) => grams.get(gram)?.forEach((party) => output.add(party)));
  });
};

export const findCustomerNameDuplicates = (
  index: CustomerDuplicateIndex,
  candidate: Partial<Party> & Pick<Party, 'name'>,
  branchId: string,
  excludePartyId?: string
): CustomerDuplicateMatch[] => {
  const branch = index.get(candidate.branchId || branchId);
  if (!branch) return [];

  const possibleMatches = new Set<Party>();
  const candidateNames = valuesForPartyNames(candidate as Party);
  addTextCandidates(candidateNames, branch.nameGrams, branch.shortNames, possibleMatches);
  const matches: CustomerDuplicateMatch[] = [];

  for (const party of possibleMatches) {
    if (party.id === excludePartyId) continue;
    const existingNames = valuesForPartyNames(party);
    let nameSimilarity = 0;
    let foundMatch = false;
    for (const candidateName of candidateNames) {
      for (const existingName of existingNames) {
        nameSimilarity = Math.max(nameSimilarity, similarity(candidateName, existingName));
        if (nameSimilarity >= 0.8) {
          foundMatch = true;
          break;
        }
      }
      if (foundMatch) break;
    }
    if (foundMatch) matches.push({ party, reasons: ['name'], nameSimilarity });
  }
  return matches;
};

export const findCustomerDuplicates = (
  index: CustomerDuplicateIndex,
  candidate: Partial<Party> & Pick<Party, 'name'>,
  branchId: string,
  excludePartyId?: string
): CustomerDuplicateMatch[] => {
  const branch = index.get(candidate.branchId || branchId);
  if (!branch) return [];

  const nameCandidates = new Set<Party>();
  const phoneCandidates = new Set<Party>();
  addTextCandidates(valuesForPartyNames(candidate as Party), branch.nameGrams, branch.shortNames, nameCandidates);
  addTextCandidates(valuesForPartyPhones(candidate as Party), branch.phoneGrams, branch.shortPhones, phoneCandidates);
  const possibleMatches = new Set<Party>([...nameCandidates, ...phoneCandidates]);
  [candidate.systemCode, candidate.paperCode].forEach((code) =>
    branch.systemCodes.get(normalizeCode(code))?.forEach((party) => possibleMatches.add(party))
  );
  [candidate.fileCode, candidate.fileNumber, candidate.paperCode].forEach((code) =>
    branch.fileCodes.get(normalizeCode(code))?.forEach((party) => possibleMatches.add(party))
  );

  const candidateNameValues = valuesForPartyNames(candidate as Party);
  const candidatePhoneValues = valuesForPartyPhones(candidate as Party);

  return Array.from(possibleMatches).flatMap((party) => {
    if (party.id === excludePartyId) return [];
    const reasons: CustomerDuplicateReason[] = [];
    const nameSimilarity = nameCandidates.has(party)
      ? Math.max(0, ...candidateNameValues.flatMap((name) =>
          valuesForPartyNames(party).map((existing) => similarity(name, existing))
        ))
      : 0;
    if (nameSimilarity >= 0.8) reasons.push('name');

    const phoneSimilarity = phoneCandidates.has(party)
      ? Math.max(0, ...candidatePhoneValues.flatMap((phone) =>
          valuesForPartyPhones(party).map((existing) => similarity(phone, existing))
        ))
      : 0;
    if (phoneSimilarity >= 0.8) reasons.push('phone');

    const exactSystemMatch = [candidate.systemCode, candidate.paperCode]
      .map(normalizeCode)
      .filter(Boolean)
      .some((code) => [party.systemCode, party.paperCode].some((existing) => normalizeCode(existing) === code));
    if (exactSystemMatch) reasons.push('systemCode');

    const exactFileMatch = [candidate.fileCode, candidate.fileNumber, candidate.paperCode]
      .map(normalizeCode)
      .filter(Boolean)
      .some((code) => [party.fileCode, party.fileNumber, party.paperCode].some((existing) => normalizeCode(existing) === code));
    if (exactFileMatch) reasons.push('fileCode');

    return reasons.length ? [{ party, reasons, nameSimilarity, phoneSimilarity }] : [];
  }).sort((a, b) => b.reasons.length - a.reasons.length || b.nameSimilarity! - a.nameSimilarity!);
};
