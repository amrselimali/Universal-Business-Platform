import { neon } from '@neondatabase/serverless';
import { isApiConfigured, getApiToken, apiUpsertRecords, apiDeleteRecords, apiFetchRecords, apiPostReceipt, apiPostJournal, apiReverseJournal } from './apiClient';
import { postCustomerReceipt, postCustomerRefund, postJournal, reverseJournal, JournalLineInput } from './accountingApi';

/**
 * Database-first command layer (طبقة الأوامر الموجّهة لقاعدة البيانات).
 *
 * Goal: the screen becomes a VIEW and every button is a DATABASE operation.
 *
 * Operational Model:
 *   1. Build the record(s) the button should create/change (pure data, no side effects).
 *   2. Call the corresponding command in `commands.ts`.
 *   3. The command writes to the database FIRST (via API or direct Neon PL/pgSQL transactions).
 *      Only when the database confirms with success does the local state update.
 *   4. If the database rejects or network fails, the local state is untouched and the caller
 *      gets the error to display - eliminating silent drift and phantom records.
 *   5. If offline or no database session is configured, falls back safely to local updates.
 */

export interface CommandResult<T = unknown> {
  success: boolean;
  /** True when the change was applied locally because no database connection is available. */
  appliedLocally?: boolean;
  error?: string;
  data?: T;
}

export function getActiveDbConnection(): { connectionString: string; tenantId: string } | null {
  try {
    const rawCfg = localStorage.getItem('erp_neon_cfg');
    if (!rawCfg) return null;
    const parsed = JSON.parse(rawCfg);
    const conn = String(parsed?.connectionString || '').trim();
    if (!conn.startsWith('postgres://') && !conn.startsWith('postgresql://')) return null;
    const tenantId = String(localStorage.getItem('erp_active_tenant_id') || '').trim() || 'tenant-eg-001';
    return { connectionString: conn, tenantId };
  } catch {
    return null;
  }
}

export const canUseDb = (): boolean =>
  (isApiConfigured() && Boolean(getApiToken())) || Boolean(getActiveDbConnection());

const getNeonClient = (connectionString: string) => neon(connectionString.trim());

/**
 * Runs a database-first write for one record of a dataset.
 * Writes to the database FIRST, only applying locally once accepted.
 */
export async function saveRecord(params: {
  docKey: string;
  record: Record<string, unknown>;
  applyLocal: (record: Record<string, unknown>) => void;
  actor?: string;
}): Promise<CommandResult> {
  const { docKey, record, applyLocal, actor } = params;
  const id = String(record?.id || '');
  if (!id) return { success: false, error: 'record_id_required' };

  if (isApiConfigured() && getApiToken()) {
    const result = await apiUpsertRecords(docKey, [record]);
    if (!result.ok) return { success: false, error: result.error };
    applyLocal(record);
    return { success: true, data: result.data };
  }

  const directDb = getActiveDbConnection();
  if (directDb) {
    try {
      const sql = getNeonClient(directDb.connectionString);
      await sql.query(
        `SELECT fn_upsert_records($1, $2, $3::jsonb, $4) AS n`,
        [directDb.tenantId, docKey, JSON.stringify([record]), actor || 'app']
      );
      applyLocal(record);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Offline / standalone fallback
  applyLocal(record);
  return { success: true, appliedLocally: true };
}

/** Deletes a record in the database (soft delete) FIRST before removing it from the screen. */
export async function deleteRecord(params: {
  docKey: string;
  id: string;
  removeLocal: (id: string) => void;
  actor?: string;
}): Promise<CommandResult> {
  const { docKey, id, removeLocal, actor } = params;
  if (!id) return { success: false, error: 'record_id_required' };

  if (isApiConfigured() && getApiToken()) {
    const result = await apiDeleteRecords(docKey, [id]);
    if (!result.ok) return { success: false, error: result.error };
    removeLocal(id);
    return { success: true, data: result.data };
  }

  const directDb = getActiveDbConnection();
  if (directDb) {
    try {
      const sql = getNeonClient(directDb.connectionString);
      await sql.query(
        `SELECT fn_soft_delete_records($1, $2, $3::jsonb, $4) AS n`,
        [directDb.tenantId, docKey, JSON.stringify([id]), actor || 'app']
      );
      removeLocal(id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Offline / standalone fallback
  removeLocal(id);
  return { success: true, appliedLocally: true };
}

/**
 * Records a customer collection receipt in the database FIRST (atomic: journal + record),
 * then updates the screen.
 */
export async function createCollectionReceipt(params: {
  receipt: Record<string, unknown>;
  customerCode: string;
  paymentAccountId: string;
  branchId: string;
  amount: number;
  units?: number;
  date: string;
  service?: string;
  applyLocal: (receipt: Record<string, unknown>) => void;
  actor?: string;
}): Promise<CommandResult> {
  if (isApiConfigured() && getApiToken()) {
    const result = await apiPostReceipt({
      branchId: params.branchId,
      customerCode: params.customerCode,
      amount: params.amount,
      date: params.date,
      paymentAccountId: params.paymentAccountId,
      service: params.service,
      receipt: params.receipt,
    });
    if (!result.ok) return { success: false, error: result.error };
    params.applyLocal(params.receipt);
    return { success: true, data: result.data };
  }

  const directDb = getActiveDbConnection();
  if (directDb) {
    const outcome = await postCustomerReceipt({
      connectionString: directDb.connectionString,
      tenantId: directDb.tenantId,
      branchId: params.branchId,
      customerCode: params.customerCode,
      amount: params.amount,
      date: params.date,
      paymentAccountId: params.paymentAccountId,
      service: params.service,
      receipt: params.receipt,
      actor: params.actor,
    });
    if (!outcome.success) return { success: false, error: outcome.error };
    params.applyLocal(params.receipt);
    return { success: true, data: outcome };
  }

  // Offline / standalone fallback
  params.applyLocal(params.receipt);
  return { success: true, appliedLocally: true };
}

/**
 * Records a customer refund in the database FIRST (atomic: journal + record),
 * then updates the screen.
 */
export async function createCustomerRefund(params: {
  refund: Record<string, unknown>;
  customerCode: string;
  paymentAccountId: string;
  branchId: string;
  amount: number;
  units: number;
  date: string;
  service?: string;
  applyLocal: (refund: Record<string, unknown>) => void;
  actor?: string;
}): Promise<CommandResult> {
  const directDb = getActiveDbConnection();
  if (directDb) {
    const outcome = await postCustomerRefund({
      connectionString: directDb.connectionString,
      tenantId: directDb.tenantId,
      branchId: params.branchId,
      customerCode: params.customerCode,
      amount: params.amount,
      units: params.units,
      date: params.date,
      paymentAccountId: params.paymentAccountId,
      service: params.service,
      refund: params.refund,
      actor: params.actor,
    });
    if (!outcome.success) return { success: false, error: outcome.error };
    params.applyLocal(params.refund);
    return { success: true, data: outcome };
  }

  // Offline / standalone fallback
  params.applyLocal(params.refund);
  return { success: true, appliedLocally: true };
}

/** Posts a manual journal in the database first, then reflects it on the screen. */
export async function createJournalEntry(params: {
  branchId?: string;
  date: string;
  description: string;
  sourceDocument?: string;
  lines: JournalLineInput[];
  applyLocal: (journalId: string) => void;
  actor?: string;
}): Promise<CommandResult> {
  if (isApiConfigured() && getApiToken()) {
    const result = await apiPostJournal({
      branchId: params.branchId,
      date: params.date,
      description: params.description,
      sourceDocument: params.sourceDocument || 'قيد يومية يدوي',
      lines: params.lines,
    });
    if (!result.ok) return { success: false, error: result.error };
    params.applyLocal(String(result.data?.journalId || ''));
    return { success: true, data: result.data };
  }

  const directDb = getActiveDbConnection();
  if (directDb) {
    const outcome = await postJournal({
      connectionString: directDb.connectionString,
      tenantId: directDb.tenantId,
      branchId: params.branchId,
      date: params.date,
      description: params.description,
      sourceDocument: params.sourceDocument || 'قيد يومية يدوي',
      lines: params.lines,
      actor: params.actor,
    });
    if (!outcome.success) return { success: false, error: outcome.error };
    params.applyLocal(String(outcome.journalId || ''));
    return { success: true, data: outcome };
  }

  params.applyLocal('');
  return { success: true, appliedLocally: true };
}

/** Reverses a journal in the database first, then reflects it on the screen. */
export async function reverseJournalEntry(params: {
  journalId: string;
  reason: string;
  applyLocal: () => void;
  actor?: string;
}): Promise<CommandResult> {
  if (isApiConfigured() && getApiToken()) {
    const result = await apiReverseJournal(params.journalId, params.reason);
    if (!result.ok) return { success: false, error: result.error };
    params.applyLocal();
    return { success: true, data: result.data };
  }

  const directDb = getActiveDbConnection();
  if (directDb) {
    const outcome = await reverseJournal({
      connectionString: directDb.connectionString,
      tenantId: directDb.tenantId,
      journalId: params.journalId,
      reason: params.reason,
      actor: params.actor,
    });
    if (!outcome.success) return { success: false, error: outcome.error };
    params.applyLocal();
    return { success: true, data: outcome };
  }

  params.applyLocal();
  return { success: true, appliedLocally: true };
}

/** Re-reads one dataset from the database (what a "refresh this screen" should do). */
export async function reloadDataset(docKey: string): Promise<CommandResult<any[]>> {
  if (isApiConfigured() && getApiToken()) {
    const records: any[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await apiFetchRecords(docKey, after);
      if (!page.ok) return { success: false, error: page.error };
      (page.data?.records || []).forEach((record) => records.push(record));
      if (!page.data?.nextAfter) break;
      after = page.data.nextAfter;
    }
    return { success: true, data: records };
  }

  return { success: false, error: 'api_not_configured' };
}
