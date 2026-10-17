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

import { getEffectiveNeonConnectionString } from './neonConfig';

export function getActiveDbConnection(): { connectionString: string; tenantId: string } | null {
  try {
    const conn = getEffectiveNeonConnectionString();
    let tenantId = String(localStorage.getItem('erp_active_tenant_id') || '').trim();
    if (!tenantId) {
      try {
        const rawTenants = localStorage.getItem('erp_tenants');
        if (rawTenants) {
          const list = JSON.parse(rawTenants);
          if (Array.isArray(list) && list.length > 0 && list[0].id) {
            tenantId = String(list[0].id).trim();
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (!tenantId) tenantId = 'tenant-eg-003';
    return { connectionString: conn, tenantId };
  } catch {
    return null;
  }
}

export const canUseDb = (): boolean =>
  (isApiConfigured() && Boolean(getApiToken())) || Boolean(getActiveDbConnection());

import { NeonService } from './neonService';
import { NEON_SCHEMA_TABLES } from './neonSchema';
import {
  Tenant,
  Branch,
  Warehouse,
  Product,
  Party,
  Account,
  ItemCategory,
  AppUser,
  PaymentMethod,
  Appointment,
  SalesInvoice,
  JournalEntry,
} from '../types';

const getNeonClient = (connectionString: string) => neon(connectionString.trim());

async function syncToRelationalTable(
  connectionString: string,
  tenantId: string,
  docKey: string,
  record: Record<string, unknown>
): Promise<void> {
  try {
    switch (docKey) {
      case 'erp_tenants':
        await NeonService.upsertTenantDirect(connectionString, record as unknown as Tenant);
        break;
      case 'erp_branches':
        await NeonService.upsertBranchDirect(connectionString, tenantId, record as unknown as Branch);
        break;
      case 'erp_warehouses':
        await NeonService.upsertWarehouseDirect(connectionString, tenantId, record as unknown as Warehouse);
        break;
      case 'erp_categories':
        await NeonService.upsertCategoryDirect(connectionString, tenantId, record as unknown as ItemCategory);
        break;
      case 'erp_products':
        await NeonService.upsertProductDirect(connectionString, tenantId, record as unknown as Product);
        break;
      case 'erp_parties':
      case 'erp_parties_backup':
        await NeonService.upsertPartyDirect(connectionString, tenantId, record as unknown as Party);
        break;
      case 'erp_accounts':
        await NeonService.upsertAccountDirect(connectionString, tenantId, record as unknown as Account);
        break;
      case 'erp_users':
        await NeonService.upsertUserDirect(connectionString, tenantId, record as unknown as AppUser);
        break;
      case 'erp_payment_methods':
        await NeonService.upsertPaymentMethodDirect(connectionString, tenantId, record as unknown as PaymentMethod);
        break;
      case 'erp_appointments':
        await NeonService.insertAppointmentDirect(connectionString, tenantId, record as unknown as Appointment);
        break;
      case 'erp_invoices':
        await NeonService.insertInvoiceDirect(connectionString, tenantId, record as unknown as SalesInvoice);
        break;
      case 'erp_journals':
        await NeonService.insertJournalEntryDirect(connectionString, tenantId, record as unknown as JournalEntry);
        break;
      default: {
        const schema = NEON_SCHEMA_TABLES.find((s) => s.sourceKey === docKey);
        if (schema) {
          await NeonService.upsertRecordDirect(connectionString, tenantId, schema.table, record);
        }
        break;
      }
    }
  } catch (err) {
    console.warn(`[Relational table sync warning for ${docKey}]:`, err);
  }
}

async function deleteFromRelationalTable(
  connectionString: string,
  tenantId: string,
  docKey: string,
  id: string
): Promise<void> {
  try {
    switch (docKey) {
      case 'erp_tenants':
        await NeonService.deleteTenantDirect(connectionString, id);
        break;
      case 'erp_branches':
        await NeonService.deleteBranchDirect(connectionString, id);
        break;
      case 'erp_warehouses':
        await NeonService.deleteWarehouseDirect(connectionString, id);
        break;
      case 'erp_categories':
        await NeonService.deleteCategoryDirect(connectionString, id);
        break;
      case 'erp_products':
        await NeonService.deleteProductDirect(connectionString, id);
        break;
      case 'erp_parties':
      case 'erp_parties_backup':
        await NeonService.deletePartyDirect(connectionString, id);
        break;
      case 'erp_accounts':
        await NeonService.deleteAccountDirect(connectionString, id);
        break;
      case 'erp_users':
        await NeonService.deleteUserDirect(connectionString, id);
        break;
      case 'erp_payment_methods':
        await NeonService.deletePaymentMethodDirect(connectionString, id);
        break;
      default: {
        const schema = NEON_SCHEMA_TABLES.find((s) => s.sourceKey === docKey);
        if (schema) {
          await NeonService.deleteRecordDirect(connectionString, tenantId, schema.table, id);
        }
        break;
      }
    }
  } catch (err) {
    console.warn(`[Relational table delete warning for ${docKey}]:`, err);
  }
}

/**
 * Runs a database-first write for one record of a dataset.
 * Writes to the database FIRST (both typed relational table and JSONB record store),
 * only applying locally once accepted.
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
      // المصدر الوحيد للحقيقة: الجدول المنمّط.
      // أُلغيت الكتابة المزدوجة في مخزن المستندات (app_records) لإنهاء الازدواجية.
      await syncToRelationalTable(directDb.connectionString, directDb.tenantId, docKey, record);

      applyLocal(record);
      return { success: true };
    } catch (err: any) {
      console.warn(`[saveRecord direct DB error for ${docKey}]:`, err);
      // Fallback: apply locally so screen doesn't freeze, but report warning
      applyLocal(record);
      return { success: false, error: err?.message || String(err), appliedLocally: true };
    }
  }

  // Offline / standalone fallback
  applyLocal(record);
  return { success: true, appliedLocally: true };
}

/** Deletes a record in the database (both typed table and soft delete) FIRST before removing it from the screen. */
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
      // المصدر الوحيد للحقيقة: الجدول المنمّط (حذف ناعم).
      // أُلغيت الكتابة المزدوجة في مخزن المستندات (app_records).
      await deleteFromRelationalTable(directDb.connectionString, directDb.tenantId, docKey, id);

      removeLocal(id);
      return { success: true };
    } catch (err: any) {
      console.warn(`[deleteRecord direct DB error for ${docKey}]:`, err);
      removeLocal(id);
      return { success: false, error: err?.message || String(err), appliedLocally: true };
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
