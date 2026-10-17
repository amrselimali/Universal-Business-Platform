/**
 * قراءة الفواتير عبر دوال قاعدة البيانات (مسار واحد للشاشة)
 * ---------------------------------------------------------------------------
 * يستدعي:
 *   • fn_invoice_list    → صفحة Keyset + حمولة كل صف (payload)
 *   • fn_invoice_summary → العدّاد والمجاميع المطابقة للفلاتر
 *   • fn_invoice_detail  → رأس الفاتورة + سطورها من invoice_lines
 *
 * المصدر داخل القاعدة: `v_revenue_invoices` (فواتير محفوظة + إيرادات ورديات).
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
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

const client = () => {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return null;
  return neon(connection.connectionString.trim());
};

const params = (tenantId: string, filters: InvoiceFilters) => [
  tenantId,
  filters.search || null,
  filters.from || null,
  filters.to || null,
  filters.status || null,
  filters.source && filters.source !== 'all' ? filters.source : null,
  filters.customerId && filters.customerId !== 'all' ? filters.customerId : null,
  filters.branchId || null,
];

const toInvoice = (row: Record<string, any>): SalesInvoice => {
  const payload = (row.payload ?? {}) as Partial<SalesInvoice>;
  return {
    ...payload,
    id: String(row.id ?? payload.id ?? ''),
    tenantId: String(payload.tenantId ?? ''),
    invoiceNumber: String(row.invoice_number ?? payload.invoiceNumber ?? ''),
    customerId: String(row.customer_id ?? payload.customerId ?? ''),
    customerName: String(row.customer_name ?? payload.customerName ?? ''),
    items: Array.isArray(payload.items) ? payload.items : [],
    subtotal: Number(payload.subtotal ?? row.net_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? payload.taxAmount ?? 0),
    discountAmount: Number(payload.discountAmount ?? 0),
    netAmount: Number(row.net_amount ?? payload.netAmount ?? 0),
    paymentMethod: String(payload.paymentMethod ?? ''),
    status: String(row.status ?? payload.status ?? 'Posted') as SalesInvoice['status'],
    createdAt: String(row.created_at ?? payload.createdAt ?? ''),
    source: String(row.source ?? payload.source ?? 'pos') as SalesInvoice['source'],
  } as SalesInvoice;
};

export async function loadInvoicePage(paramsInput: {
  tenantId: string;
  filters: InvoiceFilters;
  limit?: number;
  afterDate?: string | null;
  afterId?: string | null;
}): Promise<InvoicePage> {
  const sql = client();
  if (!sql || !paramsInput.tenantId) return { invoices: [], nextAfterDate: null, nextAfterId: null, error: 'no_database_connection' };

  try {
    const rows: any = await sql.query(
      `SELECT fn_invoice_list($1,$2,$3::date,$4::date,$5,$6,$7::date,$8,$9,$10,$11) AS page`,
      [...params(paramsInput.tenantId, paramsInput.filters), paramsInput.limit ?? 50,
       paramsInput.afterDate ?? null, paramsInput.afterId ?? null]
    );
    const page = rows?.[0]?.page ?? {};
    const items = Array.isArray(page.items) ? page.items : [];
    return {
      invoices: items.map((item: Record<string, unknown>) => toInvoice(item)),
      nextAfterDate: page.nextAfterDate ? String(page.nextAfterDate).slice(0, 10) : null,
      nextAfterId: page.nextAfterId ? String(page.nextAfterId) : null,
    };
  } catch (error: any) {
    return { invoices: [], nextAfterDate: null, nextAfterId: null, error: error?.message || 'invoice_page_failed' };
  }
}

export async function loadInvoiceSummary(paramsInput: {
  tenantId: string;
  filters: InvoiceFilters;
}): Promise<InvoiceSummary> {
  const sql = client();
  if (!sql || !paramsInput.tenantId) return { count: 0, netTotal: 0, taxTotal: 0, error: 'no_database_connection' };

  try {
    const rows: any = await sql.query(
      `SELECT fn_invoice_summary($1,$2,$3::date,$4::date,$5,$6,$7,$8) AS summary`,
      params(paramsInput.tenantId, paramsInput.filters)
    );
    const summary = rows?.[0]?.summary ?? {};
    return {
      count: Number(summary.count ?? 0),
      netTotal: Number(summary.netTotal ?? 0),
      taxTotal: Number(summary.taxTotal ?? 0),
    };
  } catch (error: any) {
    return { count: 0, netTotal: 0, taxTotal: 0, error: error?.message || 'invoice_summary_failed' };
  }
}

export async function loadInvoiceDetail(tenantId: string, invoiceId: string): Promise<InvoiceDetail> {
  const sql = client();
  if (!sql || !tenantId) return { header: null, lines: [], error: 'no_database_connection' };

  try {
    const rows: any = await sql.query(`SELECT fn_invoice_detail($1,$2) AS detail`, [tenantId, invoiceId]);
    const detail = rows?.[0]?.detail ?? {};
    return {
      header: detail.header ? toInvoice({ id: invoiceId, ...detail.header }) : null,
      lines: Array.isArray(detail.lines) ? detail.lines : [],
    };
  } catch (error: any) {
    return { header: null, lines: [], error: error?.message || 'invoice_detail_failed' };
  }
}
