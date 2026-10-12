import { isApiConfigured, getApiToken, apiUpsertRecords, apiDeleteRecords, apiFetchRecords, apiPostReceipt, apiPostJournal } from './apiClient';

/**
 * Database-first command layer (طبقة الأوامر الموجّهة لقاعدة البيانات).
 *
 * Goal: the screen becomes a VIEW and every button is a DATABASE operation.
 *
 * How to convert a screen (mechanical, one screen at a time):
 *
 *   1. Build the record(s) the button should create/change (pure data, no side effects).
 *   2. Call `runDbCommand(...)` with the dataset key and the operation.
 *   3. The command writes to the database FIRST. Only when the database confirms it does
 *      the local state change, so the screen can never show something that was not saved.
 *   4. If the database rejects or the network fails, the local state is left untouched and
 *      the caller gets the error to display - no silent divergence.
 *
 * While an API URL/token is not configured the layer falls back to the local update so the
 * running application keeps working during the migration.
 */

export interface CommandResult<T = unknown> {
  success: boolean;
  /** True when the change was applied locally because no API session is available. */
  appliedLocally?: boolean;
  error?: string;
  data?: T;
}

const canUseDb = (): boolean => isApiConfigured() && Boolean(getApiToken());

/**
 * Runs a database-first write for one record of a dataset.
 *
 * @param docKey    dataset key (e.g. 'erp_cash_receipts')
 * @param record    the full record to store (must include `id`)
 * @param applyLocal callback that updates the screen state AFTER the database accepted it
 * @param removeLocal optional callback used when the command is a deletion
 */
export async function saveRecord(params: {
  docKey: string;
  record: Record<string, unknown>;
  applyLocal: (record: Record<string, unknown>) => void;
}): Promise<CommandResult> {
  const { docKey, record, applyLocal } = params;
  const id = String(record?.id || '');
  if (!id) return { success: false, error: 'record_id_required' };

  if (!canUseDb()) {
    applyLocal(record);
    return { success: true, appliedLocally: true };
  }

  const result = await apiUpsertRecords(docKey, [record]);
  if (!result.ok) return { success: false, error: result.error };
  applyLocal(record);
  return { success: true, data: result.data };
}

/** Deletes a record in the database (soft delete) before removing it from the screen. */
export async function deleteRecord(params: {
  docKey: string;
  id: string;
  removeLocal: (id: string) => void;
}): Promise<CommandResult> {
  const { docKey, id, removeLocal } = params;
  if (!id) return { success: false, error: 'record_id_required' };

  if (!canUseDb()) {
    removeLocal(id);
    return { success: true, appliedLocally: true };
  }

  const result = await apiDeleteRecords(docKey, [id]);
  if (!result.ok) return { success: false, error: result.error };
  removeLocal(id);
  return { success: true, data: result.data };
}

/**
 * Records a customer collection receipt in the database FIRST (atomic: journal + record),
 * then updates the screen. This is the model every financial button should follow.
 */
export async function createCollectionReceipt(params: {
  receipt: Record<string, unknown>;
  customerCode: string;
  paymentAccountId: string;
  branchId: string;
  amount: number;
  units: number;
  date: string;
  service?: string;
  applyLocal: (receipt: Record<string, unknown>) => void;
}): Promise<CommandResult> {
  if (!canUseDb()) {
    params.applyLocal(params.receipt);
    return { success: true, appliedLocally: true };
  }
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

/** Posts a manual journal in the database first, then reflects it on the screen. */
export async function createJournalEntry(params: {
  branchId?: string;
  date: string;
  description: string;
  sourceDocument?: string;
  lines: { account_id: string; account_code: string; account_name_ar: string; memo: string; debit: number; credit: number }[];
  applyLocal: (journalId: string) => void;
}): Promise<CommandResult> {
  if (!canUseDb()) {
    params.applyLocal('');
    return { success: true, appliedLocally: true };
  }
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

/** Re-reads one dataset from the database (what a "refresh this screen" should do). */
export async function reloadDataset(docKey: string): Promise<CommandResult<any[]>> {
  if (!canUseDb()) return { success: false, error: 'api_not_configured' };
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
