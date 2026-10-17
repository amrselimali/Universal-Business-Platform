/**
 * عميل واجهة الفواتير (Invoices API client)
 * ---------------------------------------------------------------------------
 * **لا يتصل بقاعدة البيانات إطلاقاً.** كل قراءة/كتابة تمرّ عبر الـ API (Fastify):
 *   GET  /sales/invoices            → قائمة Keyset بفلاتر
 *   GET  /sales/invoices/summary    → عدّاد + صافي + ضريبة
 *   GET  /sales/invoices/:id        → رأس + سطور invoice_lines
 *   PUT  /sales/invoices/:id        → تعديل (سبب إلزامي)
 *   POST /sales/invoices/:id/cancel → إلغاء (سبب إلزامي)
 *
 * tenant_id يأتي من التوكن داخل السيرفر (لا يُرسل من العميل)، وRLS يُطبَّق هناك.
 * إن لم يكن عنوان الـ API مُهيّأً في الإعدادات تُعاد رسالة صريحة، ولا يوجد أي
 * مسار بديل يكتب في الداتابيز من المتصفح.
 */

import { apiRequest } from './apiClient';
import type { SalesInvoice } from '../types';

export interface InvoiceFilters {
  search?: string;
  from?: string;
  to?: string;
  status?: string;
  source?: string;
  customerId?: string;
  branchId?: string;
}

export interface InvoicePage {
  invoices: SalesInvoice[];
  nextAfterDate: string | null;
  nextAfterId: string | null;
  error?: string;
}

export interface InvoiceSummary {
  count: number;
  netTotal: number;
  taxTotal: number;
  error?: string;
}

export interface InvoiceDetail {
  header: SalesInvoice | null;
  lines: Array<Record<string, unknown>>;
  error?: string;
}

interface ServerLine {
  invoice_number?: string;
  invoice_date?: string;
  status?: string;
  customer_name?: string;
  net_amount?: number | string;
  tax_amount?: number | string;
  created_at?: string;
  source?: string;
  payload?: Record<string, any>;
  [key: string]: unknown;
}

const query = (filters: InvoiceFilters): string => {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.source && filters.source !== 'all') params.set('source', filters.source);
  if (filters.customerId && filters.customerId !== 'all') params.set('customerId', filters.customerId);
  if (filters.branchId) params.set('branchId', filters.branchId);
  return params.toString();
};

/** يحوّل صف السيرفر إلى كائن الفاتورة المتوقع في الشاشة. */
export const toInvoice = (row: ServerLine): SalesInvoice => {
  const payload = (row.payload ?? {}) as Partial<SalesInvoice>;
  return {
    ...payload,
    id: String(row.id ?? payload.id ?? ''),
    invoiceNumber: String(row.invoice_number ?? payload.invoiceNumber ?? ''),
    customerId: String(payload.customerId ?? ''),
    customerName: String(row.customer_name ?? payload.customerName ?? ''),
    items: Array.isArray(payload.items) ? payload.items : [],
    subtotal: Number(payload.subtotal ?? row.net_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? payload.taxAmount ?? 0),
    discountAmount: Number(payload.discountAmount ?? 0),
    netAmount: Number(row.net_amount ?? payload.netAmount ?? 0),
    paymentMethod: String(payload.paymentMethod ?? ''),
    status: String(row.status ?? payload.status ?? 'Posted'),
    createdAt: String(row.created_at ?? payload.createdAt ?? ''),
    source: String(row.source ?? payload.source ?? 'pos'),
  } as SalesInvoice;
};

export async function loadInvoicePage(params: {
  /** يبقى للتوقيع المتوافق فقط — السيرفر يستخرج الـ tenant من التوكن. */
  tenantId: string;
  filters: InvoiceFilters;
  limit?: number;
  afterDate?: string | null;
  afterId?: string | null;
}): Promise<InvoicePage> {
  const search = query(params.filters);
  const tail = [
    `limit=${encodeURIComponent(String(params.limit ?? 50))}`,
    params.afterDate ? `afterDate=${encodeURIComponent(params.afterDate)}` : '',
    params.afterId ? `afterId=${encodeURIComponent(params.afterId)}` : '',
  ].filter(Boolean).join('&');

  const result = await apiRequest<{ items?: ServerLine[]; nextAfterDate?: string; nextAfterId?: string }>(
    `/sales/invoices?${[search, tail].filter(Boolean).join('&')}`
  );
  if (!result.ok) return { invoices: [], nextAfterDate: null, nextAfterId: null, error: result.error };

  const items = Array.isArray(result.data?.items) ? result.data!.items! : [];
  return {
    invoices: items.map(toInvoice),
    nextAfterDate: result.data?.nextAfterDate ? String(result.data.nextAfterDate).slice(0, 10) : null,
    nextAfterId: result.data?.nextAfterId ? String(result.data.nextAfterId) : null,
  };
}

export async function loadInvoiceSummary(params: {
  tenantId: string;
  filters: InvoiceFilters;
}): Promise<InvoiceSummary> {
  const result = await apiRequest<{ count?: number; netTotal?: number; taxTotal?: number }>(
    `/sales/invoices/summary?${query(params.filters)}`
  );
  if (!result.ok) return { count: 0, netTotal: 0, taxTotal: 0, error: result.error };
  return {
    count: Number(result.data?.count ?? 0),
    netTotal: Number(result.data?.netTotal ?? 0),
    taxTotal: Number(result.data?.taxTotal ?? 0),
  };
}

export async function loadInvoiceDetail(tenantId: string, invoiceId: string): Promise<InvoiceDetail> {
  const result = await apiRequest<{ header?: ServerLine; lines?: Array<Record<string, unknown>> }>(
    `/sales/invoices/${encodeURIComponent(invoiceId)}`
  );
  if (!result.ok) return { header: null, lines: [], error: result.error };
  return {
    header: result.data?.header ? toInvoice(result.data.header) : null,
    lines: Array.isArray(result.data?.lines) ? result.data!.lines! : [],
  };
}

/** تعديل فاتورة عبر الـ API (tenant من التوكن على السيرفر). */
export async function updateInvoiceRow(params: {
  tenantId: string;
  invoiceId: string;
  netAmount: number;
  paymentMethod?: string;
  reason: string;
  actor?: string;
}): Promise<{ ok: boolean; version?: number; error?: string }> {
  const result = await apiRequest<{ version?: number }>(
    `/sales/invoices/${encodeURIComponent(params.invoiceId)}`,
    { method: 'PUT', body: { netAmount: params.netAmount, paymentMethod: params.paymentMethod, reason: params.reason } }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, version: Number(result.data?.version) || undefined };
}

/** إلغاء فاتورة عبر الـ API. */
export async function cancelInvoiceRow(params: {
  tenantId: string;
  invoiceId: string;
  reason: string;
  actor?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const result = await apiRequest(
    `/sales/invoices/${encodeURIComponent(params.invoiceId)}/cancel`,
    { method: 'POST', body: { reason: params.reason } }
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
