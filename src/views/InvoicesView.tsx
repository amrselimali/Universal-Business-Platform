import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { SalesInvoice } from '../types';
import {
  Receipt,
  Search,
  Printer,
  X,
  QrCode,
  CheckCircle2,
  Calendar,
  CreditCard,
  Banknote,
  User,
} from 'lucide-react';

export const InvoicesView: React.FC = () => {
  const { t, formatMoney, invoices, tenant, activeBranch, language } = usePlatform();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.paymentMethod.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {t('سجل فواتير المبيعات الصادرة', 'Sales Invoices Log')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'أرشيف الفواتير المكتملة مع إمكانية إعادة الطباعة، تدقيق الضريبة، ومراجعة القيد المحاسبي المرتبط.',
              'Completed invoices log with reprint capabilities and accounting audit verification.'
            )}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('ابحث برقم الفاتورة أو العميل...', 'Search invoices...')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 ps-9 pe-4 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Invoices List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Receipt className="h-12 w-12 mx-auto mb-2 text-slate-300 dark:text-slate-600 stroke-1" />
            <p className="text-xs font-bold">{t('لا توجد فواتير مطابقة للبحث', 'No invoices found')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('رقم الفاتورة', 'Invoice #')}</th>
                  <th className="pb-3 font-bold text-start">{t('التاريخ والوقت', 'Date')}</th>
                  <th className="pb-3 font-bold text-start">{t('العميل', 'Customer')}</th>
                  <th className="pb-3 font-bold text-start">{t('طريقة الدفع', 'Payment Method')}</th>
                  <th className="pb-3 font-bold text-end">{t('المجموع قبل الضريبة', 'Subtotal')}</th>
                  <th className="pb-3 font-bold text-end">{t('ضريبة ق.م (14%)', 'VAT 14%')}</th>
                  <th className="pb-3 font-bold text-end">{t('الصافي الإجمالي', 'Net Total')}</th>
                  <th className="pb-3 font-bold text-center">{t('عرض / طباعة', 'View / Print')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(inv.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                    </td>
                    <td className="py-3 font-bold text-slate-900 dark:text-white">{inv.customerName}</td>
                    <td className="py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 text-end font-mono text-slate-500">
                      {formatMoney(inv.subtotal - inv.discountAmount)}
                    </td>
                    <td className="py-3 text-end font-mono text-slate-500">{formatMoney(inv.taxAmount)}</td>
                    <td className="py-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                      {formatMoney(inv.netAmount)}
                    </td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                      >
                        {t('معاينة الإيصال', 'View Receipt')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {t('معاينة الفاتورة الضريبية', 'Tax Invoice Preview')}
              </span>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-center space-y-1 mb-3">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{tenant.name}</h3>
                <p className="text-[11px] text-slate-500">{activeBranch.name}</p>
                <p className="text-[10px] text-slate-400">
                  {selectedInvoice.invoiceNumber} • {selectedInvoice.paymentMethod}
                </p>
                <p className="text-[10px] text-slate-400">
                  {new Date(selectedInvoice.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                </p>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 my-2 space-y-1 dark:border-slate-700">
                {selectedInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.productNameAr} x{item.quantity}
                    </span>
                    <span className="font-bold">{formatMoney(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>{t('المجموع قبل الضريبة:', 'Subtotal:')}</span>
                  <span>{formatMoney(selectedInvoice.subtotal - selectedInvoice.discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('ضريبة ق.م (14%):', 'VAT (14%):')}</span>
                  <span>{formatMoney(selectedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm border-t border-slate-300 pt-1 dark:border-slate-700 text-slate-900 dark:text-white">
                  <span>{t('الصافي النهائي:', 'Net Total:')}</span>
                  <span>{formatMoney(selectedInvoice.netAmount)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-3 pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                <QrCode className="h-10 w-10 text-slate-800 dark:text-slate-200" />
                <div className="text-[10px]">
                  <p className="font-bold">{t('منظومة الفاتورة الإلكترونية المصرية', 'Egyptian Tax Authority Compliant')}</p>
                  <p>{t('الكاشير:', 'Cashier:')} {selectedInvoice.cashierName}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span>{t('طباعة (Print)', 'Print')}</span>
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
              >
                {t('إغلاق', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
