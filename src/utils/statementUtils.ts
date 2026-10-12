import { CashReceiptVoucher, CustomerRefundVoucher, Party } from '../types';

/**
 * Normalizes any date string (ISO, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD) to standard ISO YYYY-MM-DD.
 * Crucial to prevent string comparison bugs like "11/10/2026" < "1970-01-01".
 */
export const normalizeStatementDate = (val?: string | number | null): string => {
  if (val === undefined || val === null) return '';
  const s = String(val).trim();
  if (!s) return '';

  // ISO with timestamp: 2026-10-11T...
  if (s.includes('T')) {
    const part = s.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Fallback: Date.parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    try {
      return parsed.toISOString().slice(0, 10);
    } catch {
      // ignore
    }
  }

  return s;
};

/**
 * Normalizes Arabic names to enable robust matching across spelling variations
 * (e.g. عزة vs عزه, إبراهيم vs ابراهيم, أ vs ا, ى vs ي, tashkeel, titles).
 */
export const normalizeArabicName = (text?: string): string => {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip diacritics / tashkeel
    .replace(/\u0640/g, '') // strip tatweel / kashida
    .replace(/[أإآآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/^(?:مدام|استاذه|استاذ|دكتور|دكتوره|د\/|م\/|السيد|السيده|mr|mrs|ms)\s+/i, '')
    .replace(/\s+/g, ' ');
};

/**
 * Extracts all relevant search codes for a party into a lookup Set,
 * including raw and zero-stripped variations.
 */
export const getPartyLookupCodes = (party: Party): Set<string> => {
  const codes = new Set<string>();
  const candidates = [
    party.id,
    party.customerCode,
    party.code,
    party.systemCode,
    party.paperCode,
    party.fileCode,
    party.fileNumber,
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const s = String(c).trim().toLowerCase();
      if (s) {
        codes.add(s);
        const norm = s.replace(/^0+/, '');
        if (norm) codes.add(norm);
      }
    }
  }

  return codes;
};

const isDummyPhone = (phone?: string): boolean => {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return true;
  // Common placeholders: 01000000000, 0000000000, 12345678, etc.
  if (/^0+$/.test(digits)) return true;
  if (/^010{7,}/.test(digits)) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  return false;
};

/**
 * Checks whether a cash collection receipt belongs to the given party.
 * Matches on:
 * - Direct partyId
 * - Any code (customerCode, systemCode, paperCode, code)
 * - Normalized Arabic name
 * - Valid phone number (excluding dummy placeholders)
 * - Notes / description referencing customer code
 */
export const isReceiptMatchingParty = (rcpt: CashReceiptVoucher, party: Party): boolean => {
  if (!party || !rcpt) return false;
  // Direct link.
  if (rcpt.partyId && rcpt.partyId === party.id) return true;

  // Link by the auto-serial customer code ONLY (كود العميل المسلسل الآلي).
  // No system code / paper code / name / phone matching.
  const partyAutoCode = String(party.customerCode || '').trim();
  const rcptAutoCode = String(rcpt.customerCode || '').trim();
  if (!partyAutoCode || !rcptAutoCode) return false;
  if (partyAutoCode === rcptAutoCode) return true;
  const normParty = partyAutoCode.replace(/^0+/, '');
  const normRcpt = rcptAutoCode.replace(/^0+/, '');
  return Boolean(normParty) && normParty === normRcpt;
};

/**
 * Checks whether a customer refund voucher belongs to the given party.
 * Links by the auto-serial customer code ONLY.
 */
export const isRefundMatchingParty = (refund: CustomerRefundVoucher, party: Party): boolean => {
  if (!party || !refund) return false;
  if (refund.partyId && refund.partyId === party.id) return true;

  // Link by the auto-serial customer code ONLY (كود العميل المسلسل الآلي).
  const partyAutoCode = String(party.customerCode || '').trim();
  const refundAutoCode = String(refund.customerCode || '').trim();
  if (!partyAutoCode || !refundAutoCode) return false;
  if (partyAutoCode === refundAutoCode) return true;
  const normParty = partyAutoCode.replace(/^0+/, '');
  const normRefund = refundAutoCode.replace(/^0+/, '');
  return Boolean(normParty) && normParty === normRefund;
};
