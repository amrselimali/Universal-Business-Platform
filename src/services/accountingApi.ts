/**
 * عميل واجهة المحاسبة (Accounting API client)
 * ---------------------------------------------------------------------------
 * **لا يتصل بقاعدة البيانات إطلاقاً.** كل ترحيل/عكس/تحصيل/استرداد يمرّ عبر الـ API:
 *   POST /accounting/journal            → fn_post_journal
 *   POST /accounting/journal/:id/reverse→ fn_reverse_journal
 *   POST /accounting/receipt            → fn_post_customer_receipt
 *   POST /accounting/refund             → fn_post_customer_refund
 *   GET  /accounting/balances           → أرصدة الحسابات (المرجع النهائي)
 *
 * tenant_id يأتي من التوكن داخل السيرفر، ويُضبط `app.tenant_id` في نفس المعاملة
 * فتسري سياسات RLS. لا يوجد أي مسار بديل يكتب في الداتابيز من المتصفح.
 */

import { apiFetchBalances, apiPostJournal, apiPostReceipt, apiReverseJournal, apiRequest } from './apiClient';

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

/** يُرحّل قيداً متوازناً عبر الـ API (السيرفر يستدعي fn_post_journal داخل معاملة RLS). */
export async function postJournal(params: {
  connectionString?: string;
  tenantId: string;
  branchId?: string;
  date: string;
  description: string;
  sourceDocument: string;
  lines: JournalLineInput[];
  actor?: string;
}): Promise<PostedResult> {
  const result = await apiPostJournal({
    branchId: params.branchId,
    date: params.date,
    description: params.description,
    sourceDocument: params.sourceDocument,
    lines: params.lines,
  });
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, journalId: result.data?.journalId };
}

/** يعكس قيداً مع حفظ الأصل. */
export async function reverseJournal(params: {
  connectionString?: string;
  tenantId: string;
  journalId: string;
  reason: string;
  actor?: string;
}): Promise<PostedResult> {
  const result = await apiReverseJournal(params.journalId, params.reason);
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, journalId: result.data?.journalId };
}

/** يسجّل إيصال تحصيل من عميل ويُرحّل قيده ذرّياً. */
export async function postCustomerReceipt(params: {
  connectionString?: string;
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
  const payload = (result.data?.result ?? {}) as Record<string, unknown>;
  return {
    success: true,
    receiptId: payload.receiptId ? String(payload.receiptId) : undefined,
    journalId: payload.journalId ? String(payload.journalId) : undefined,
    customerAccount: payload.customerAccount ? String(payload.customerAccount) : undefined,
    paymentAccount: payload.paymentAccount ? String(payload.paymentAccount) : undefined,
  };
}

/** يسجّل استرداداً لعميل ويُرحّل قيده ذرّياً. */
export async function postCustomerRefund(params: {
  connectionString?: string;
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
  const result = await apiRequest<{ result: Record<string, unknown> }>('/accounting/refund', {
    method: 'POST',
    body: {
      branchId: params.branchId,
      customerCode: params.customerCode,
      amount: params.amount,
      units: params.units,
      date: params.date,
      paymentAccountId: params.paymentAccountId,
      service: params.service,
      refund: params.refund,
    },
  });
  if (!result.ok) return { success: false, error: result.error };
  const payload = (result.data?.result ?? {}) as Record<string, unknown>;
  return {
    success: true,
    refundId: payload.refundId ? String(payload.refundId) : undefined,
    journalId: payload.journalId ? String(payload.journalId) : undefined,
    customerAccount: payload.customerAccount ? String(payload.customerAccount) : undefined,
    paymentAccount: payload.paymentAccount ? String(payload.paymentAccount) : undefined,
  };
}

/** أرصدة الحسابات من الدفتر (المرجع النهائي) — عبر الـ API. */
export async function fetchAccountBalances(_params?: {
  connectionString?: string;
  tenantId?: string;
}): Promise<{ code: string; name: string; type: string; balance: number }[]> {
  const result = await apiFetchBalances();
  if (!result.ok) return [];
  const balances = Array.isArray(result.data?.balances) ? result.data!.balances : [];
  return balances.map((row) => ({
    code: String(row.code ?? ''),
    name: String(row.name_ar ?? ''),
    type: String(row.account_type ?? ''),
    balance: Number(row.balance ?? 0),
  }));
}
