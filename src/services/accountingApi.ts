import { neon } from '@neondatabase/serverless';

/**
 * Server-side accounting API (المرحلة 2).
 *
 * Posting now happens INSIDE the database in a single atomic PL/pgSQL call, so the
 * journal header, its lines and the account balances are always consistent - even if
 * the client crashes half-way or two users post at the same time. The browser no longer
 * builds or writes journal entries itself for these operations.
 *
 * Database functions:
 *   fn_post_journal           - validates balance + line rules, writes header/lines, updates balances
 *   fn_reverse_journal        - atomic reversal that keeps the original
 *   fn_post_customer_receipt  - debit payment account / credit customer account + record
 *   fn_post_customer_refund   - debit customer account / credit payment account + record
 */

const getClient = (connectionString: string) => neon(connectionString.trim());

export interface PostedResult {
  success: boolean;
  journalId?: string;
  receiptId?: string;
  refundId?: string;
  customerAccount?: string;
  paymentAccount?: string;
  error?: string;
}

export interface JournalLineInput {
  account_id: string;
  account_code: string;
  account_name_ar: string;
  memo: string;
  debit: number;
  credit: number;
}

/** Posts a balanced journal atomically in the database. */
export async function postJournal(params: {
  connectionString: string;
  tenantId: string;
  branchId?: string;
  date: string;
  description: string;
  sourceDocument: string;
  lines: JournalLineInput[];
  actor?: string;
}): Promise<PostedResult> {
  try {
    const sql = getClient(params.connectionString);
    const rows: any = await sql.query(
      `SELECT fn_post_journal($1, $2, $3, $4, $5, $6::jsonb, $7) AS journal_id`,
      [params.tenantId, params.branchId || null, params.date, params.description,
       params.sourceDocument, JSON.stringify(params.lines), params.actor || 'app']
    );
    return { success: true, journalId: String(rows?.[0]?.journal_id) };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

/** Reverses a journal atomically (the original is preserved). */
export async function reverseJournal(params: {
  connectionString: string;
  tenantId: string;
  journalId: string;
  reason: string;
  actor?: string;
}): Promise<PostedResult> {
  try {
    const sql = getClient(params.connectionString);
    const rows: any = await sql.query(
      `SELECT fn_reverse_journal($1, $2, $3, $4) AS journal_id`,
      [params.tenantId, params.journalId, params.reason, params.actor || 'app']
    );
    return { success: true, journalId: String(rows?.[0]?.journal_id) };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

/** Records a customer collection receipt and posts its journal atomically. */
export async function postCustomerReceipt(params: {
  connectionString: string;
  tenantId: string;
  branchId: string;
  customerCode: string;
  amount: number;
  date: string;
  paymentAccountId: string;
  service?: string;
  receipt: Record<string, unknown>;
  actor?: string;
}): Promise<PostedResult> {
  try {
    const sql = getClient(params.connectionString);
    const rows: any = await sql.query(
      `SELECT fn_post_customer_receipt($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) AS result`,
      [params.tenantId, params.branchId, params.customerCode, params.amount, params.date,
       params.paymentAccountId, params.service || '', JSON.stringify(params.receipt), params.actor || 'app']
    );
    const result = rows?.[0]?.result || {};
    return { success: true, receiptId: result.receiptId, journalId: result.journalId,
             customerAccount: result.customerAccount, paymentAccount: result.paymentAccount };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

/** Records a customer refund and posts its journal atomically. */
export async function postCustomerRefund(params: {
  connectionString: string;
  tenantId: string;
  branchId: string;
  customerCode: string;
  amount: number;
  units: number;
  date: string;
  paymentAccountId: string;
  service?: string;
  refund: Record<string, unknown>;
  actor?: string;
}): Promise<PostedResult> {
  try {
    const sql = getClient(params.connectionString);
    const rows: any = await sql.query(
      `SELECT fn_post_customer_refund($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) AS result`,
      [params.tenantId, params.branchId, params.customerCode, params.amount, params.units,
       params.date, params.paymentAccountId, params.service || '',
       JSON.stringify(params.refund), params.actor || 'app']
    );
    const result = rows?.[0]?.result || {};
    return { success: true, refundId: result.refundId, journalId: result.journalId,
             customerAccount: result.customerAccount, paymentAccount: result.paymentAccount };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

/** Reads the authoritative account balances straight from the database. */
export async function fetchAccountBalances(params: {
  connectionString: string;
  tenantId: string;
}): Promise<{ code: string; name: string; type: string; balance: number }[]> {
  try {
    const sql = getClient(params.connectionString);
    const rows: any = await sql.query(
      `SELECT code, name_ar, account_type, balance FROM accounts WHERE tenant_id = $1 ORDER BY code`,
      [params.tenantId]
    );
    return (rows as { code: unknown; name_ar: unknown; account_type: unknown; balance: unknown }[]).map((row) => ({
      code: String(row.code),
      name: String(row.name_ar),
      type: String(row.account_type),
      balance: Number(row.balance || 0),
    }));
  } catch (error) {
    console.warn('fetchAccountBalances failed:', error);
    return [];
  }
}
