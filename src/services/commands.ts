import { isApiConfigured, getApiToken, apiUpsertRecords, apiDeleteRecords, apiFetchRecords, apiPostReceipt, apiPostJournal, apiReverseJournal } from './apiClient';
import type { JournalLineInput } from './accountingApi';

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

  // لا كتابة مباشرة من المتصفح إلى الداتابيز (قرار معماري): الكتابة عبر الـ API فقط.
  // بلا API مُهيّأ: تُطبَّق التغييرات محلياً وتُزامَن لاحقاً (نمط offline-first).
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

  // لا حذف مباشر من المتصفح إلى الداتابيز: الحذف عبر الـ API فقط.
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

  // لا يوجد مسار كتابة مباشر من المتصفح إلى الداتابيز (قرار معماري).
  // إن لم يكن الـ API مُهيّأً نُعيد خطأً صريحاً بدل كتابة صامتة من العميل.
  return { success: false, error: 'api_not_configured: اضبط عنوان الـ API من شاشة Neon Hub لتسجيل القيود.' };

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
  // لا يوجد مسار كتابة مباشر من المتصفح إلى الداتابيز (قرار معماري).
  // إن لم يكن الـ API مُهيّأً نُعيد خطأً صريحاً بدل كتابة صامتة من العميل.
  return { success: false, error: 'api_not_configured: اضبط عنوان الـ API من شاشة Neon Hub لتسجيل القيود.' };

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

  // لا مسار كتابة مباشر من المتصفح إلى الداتابيز (قرار معماري).
  return { success: false, error: 'api_not_configured: اضبط عنوان الـ API من شاشة Neon Hub لترحيل القيود.' };
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

  // لا مسار عكس مباشر من المتصفح إلى الداتابيز (قرار معماري).
  return { success: false, error: 'api_not_configured: اضبط عنوان الـ API من شاشة Neon Hub لعكس القيود.' };
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
