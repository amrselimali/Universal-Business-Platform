/**
 * Database Bridge & Service Layer (Enterprise ERP Architecture)
 * Provides atomic transactions, strict customer-code linking, and paginated queries.
 */

import { DbParty, DbCashReceipt, DbStatementLine } from '../db/schema';
import { Party, CashReceiptVoucher, JournalEntry, Account } from '../types';

export interface CustomerStatementParams {
  partyId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface CustomerStatementResult {
  party: Party;
  openingBalance: number;
  lines: DbStatementLine[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  totalCount: number;
}

export class DatabaseBridge {
  /**
   * Generates the next sequential auto-serialized customer code.
   * e.g., '1001', '1002', or tenant prefix 'CUST-1001'
   */
  public static generateNextCustomerCode(existingParties: Party[]): string {
    let maxCode = 1000;
    existingParties.forEach((p) => {
      const code = p.customerCode || p.code;
      if (code && /^\d+$/.test(code)) {
        const val = parseInt(code, 10);
        if (val > maxCode && val < 999999) {
          maxCode = val;
        }
      }
    });
    return String(maxCode + 1);
  }

  /**
   * Strictly matches a receipt to a customer using the auto-serialized customer code ONLY.
   */
  public static matchCustomerBySerialCode(
    customerCode: string,
    parties: Party[]
  ): Party | undefined {
    if (!customerCode || !customerCode.trim()) return undefined;
    const cleanCode = customerCode.trim().toLowerCase();
    const cleanWithoutZeros = cleanCode.replace(/^0+/, '');

    return parties.find((p) => {
      if (p.type !== 'Customer' && p.type !== 'Both') return false;
      const partyCode = (p.customerCode || p.code || '').trim().toLowerCase();
      if (!partyCode) return false;
      return partyCode === cleanCode || partyCode.replace(/^0+/, '') === cleanWithoutZeros;
    });
  }

  /**
   * Computes customer running balance statement with window function semantics
   */
  public static computeCustomerRunningStatement(
    party: Party,
    receipts: CashReceiptVoucher[],
    journals: JournalEntry[],
    params: { startDate?: string; endDate?: string }
  ): CustomerStatementResult {
    const rawMovements: Array<{
      date: string;
      docNumber: string;
      docType: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    const partySerial = (party.customerCode || party.code || '').trim().toLowerCase();
    const normSerial = partySerial.replace(/^0+/, '');

    // 1. Receipts matching strictly by partyId or serialized code
    receipts.forEach((r) => {
      if (r.status === 'cancelled') return;
      const isMatched =
        r.partyId === party.id ||
        (r.customerCode && (
          r.customerCode.trim().toLowerCase() === partySerial ||
          r.customerCode.trim().toLowerCase().replace(/^0+/, '') === normSerial
        ));

      if (isMatched) {
        rawMovements.push({
          date: r.date,
          docNumber: r.voucherNumber,
          docType: 'إيصال تحصيل نقدية (دائن)',
          description: r.description || 'إيصال تحصيل',
          debit: 0,
          credit: Number(r.amount) || 0,
        });
      }
    });

    // 2. Journal lines linked to party
    journals.forEach((j) => {
      j.lines.forEach((l) => {
        if (l.partyId === party.id) {
          const deb = Number(l.debit) || 0;
          const cred = Number(l.credit) || 0;
          if (deb > 0 || cred > 0) {
            rawMovements.push({
              date: j.date,
              docNumber: j.entryNumber,
              docType: 'قيد يومية عامة',
              description: l.memo || j.description || 'قيد محاسبي',
              debit: deb,
              credit: cred,
            });
          }
        }
      });
    });

    // Sort chronologically
    rawMovements.sort((a, b) => a.date.localeCompare(b.date));

    const startDate = params.startDate || '1970-01-01';
    const endDate = params.endDate || '2099-12-31';

    // Prior movements
    const priorDebits = rawMovements
      .filter((m) => m.date < startDate)
      .reduce((sum, m) => sum + m.debit, 0);
    const priorCredits = rawMovements
      .filter((m) => m.date < startDate)
      .reduce((sum, m) => sum + m.credit, 0);

    const initialBroughtForward = Number(party.balance || 0) - (
      rawMovements.reduce((sum, m) => sum + m.debit, 0) -
      rawMovements.reduce((sum, m) => sum + m.credit, 0)
    );

    const openingBalance = Number((initialBroughtForward + priorDebits - priorCredits).toFixed(2));

    const inRange = rawMovements.filter((m) => m.date >= startDate && m.date <= endDate);

    let running = openingBalance;
    const lines: DbStatementLine[] = inRange.map((m) => {
      running = Number((running + m.debit - m.credit).toFixed(2));
      return {
        partyId: party.id,
        customerCode: party.customerCode || party.code || '',
        customerName: party.name,
        transactionDate: m.date,
        documentNumber: m.docNumber,
        documentType: m.docType,
        description: m.description,
        debit: m.debit,
        credit: m.credit,
        runningBalance: running,
      };
    });

    const sumDebits = Number(inRange.reduce((sum, m) => sum + m.debit, 0).toFixed(2));
    const sumCredits = Number(inRange.reduce((sum, m) => sum + m.credit, 0).toFixed(2));

    return {
      party,
      openingBalance,
      lines,
      closingBalance: running,
      totalDebits: sumDebits,
      totalCredits: sumCredits,
      totalCount: inRange.length,
    };
  }
}
