import React from 'react';
import { usePlatform } from '../../context/PlatformContext';
import {
  CashReceiptVoucher,
  CashPaymentVoucher,
  SpecializedTaxInvoice,
  GoodsReceiptVoucher,
  GoodsIssueVoucher,
} from '../../types';
import { Printer, X, CheckCircle2, ShieldCheck, Building2, MessageCircle } from 'lucide-react';
import { tafqeetArabic } from '../../utils/fiscalUtils';
import { shareViaWhatsApp, generateInvoiceWhatsAppText } from '../../utils/exportUtils';

export type PrintableDocument =
  | { type: 'cash_receipt'; data: CashReceiptVoucher }
  | { type: 'cash_payment'; data: CashPaymentVoucher }
  | { type: 'tax_invoice'; data: SpecializedTaxInvoice }
  | { type: 'goods_receipt'; data: GoodsReceiptVoucher }
  | { type: 'goods_issue'; data: GoodsIssueVoucher };

interface DocumentPrintModalProps {
  document: PrintableDocument | null;
  onClose: () => void;
}

export const DocumentPrintModal: React.FC<DocumentPrintModalProps> = ({ document: doc, onClose }) => {
  const { tenant, activeBranch, formatMoney } = usePlatform();

  if (!doc) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white text-slate-900 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-6 print:shadow-none print:m-0 print:rounded-none print:w-full print:max-w-none">
        {/* Modal Action Bar (hidden on print) */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-bold text-slate-800">
              معاينة الطباعة الرسمية والمستندية
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (doc.type === 'tax_invoice') {
                  const text = generateInvoiceWhatsAppText({
                    invoiceNumber: doc.data.invoiceNumber,
                    customerName: doc.data.customerName,
                    netTotal: doc.data.netTotal,
                    vatAmount: doc.data.vatAmount,
                    date: doc.data.issueDate,
                    clinicName: tenant.nameAr || tenant.name || 'المركز الطبي',
                  });
                  shareViaWhatsApp(doc.data.customerPhone || '', text);
                } else if (doc.type === 'cash_receipt') {
                  const text = `مرحباً ${doc.data.receivedFrom}، تم استلام مبلغ ${formatMoney(doc.data.amount)} بموجب سند قبض رقم ${doc.data.voucherNumber} بتاريخ ${doc.data.date} لصالح ${tenant.nameAr || tenant.name}. شكراً لتعاملكم معنا.`;
                  shareViaWhatsApp('', text);
                } else {
                  const text = `مستند مالي: رقم المستند ${doc.data.id} الصادر من ${tenant.nameAr || tenant.name}`;
                  shareViaWhatsApp('', text);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال عبر واتساب</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند الآن (Ctrl+P)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Printable Document Paper */}
        <div className="p-8 space-y-6 text-slate-800 font-sans print:p-6" id="printable-area">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 mb-1">{tenant.nameAr}</h1>
              <p className="text-xs text-slate-500">{tenant.nameEn}</p>
              <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                <div>السجل التجاري: <span className="font-mono font-bold">{tenant.commercialRegNumber || '1010123456'}</span></div>
                <div>الرقم الضريبي: <span className="font-mono font-bold">{tenant.taxNumber || '300000000000003'}</span></div>
                <div>الفرع: {activeBranch?.nameAr || 'الفرع الرئيسي'}</div>
              </div>
            </div>

            <div className="text-left">
              {doc.type === 'tax_invoice' && doc.data.qrCodeDataUrl ? (
                <div className="flex flex-col items-end">
                  <img
                    src={doc.data.qrCodeDataUrl}
                    alt="Invoice QR Code"
                    className="w-24 h-24 border border-slate-300 rounded-lg p-1"
                  />
                  <span className="text-[9px] text-slate-500 font-bold mt-1">
                    رمز الاستجابة السريعة (QR)
                  </span>
                </div>
              ) : (
                <div className="p-3 border-2 border-slate-300 rounded-2xl text-center min-w-[140px]">
                  <span className="block text-[10px] font-bold text-slate-400">مستند إداري مالي</span>
                  <span className="font-mono text-xs font-black text-slate-700">
                    {doc.type === 'cash_receipt'
                      ? 'OFFICIAL RECEIPT'
                      : doc.type === 'cash_payment'
                      ? 'PAYMENT VOUCHER'
                      : doc.type === 'goods_receipt'
                      ? 'STOCK GRN'
                      : 'STOCK GIN'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 1. CASH RECEIPT VOUCHER */}
          {doc.type === 'cash_receipt' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-black inline-block px-6 py-1.5 bg-slate-100 rounded-xl border border-slate-300">
                  إيصال وسند استلام نقدية (سند قبض)
                </h2>
                <div className="text-xs text-slate-500 mt-1 font-mono">
                  رقم السند: <strong className="text-emerald-700 text-sm">{doc.data.voucherNumber}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block mb-0.5">التاريخ والوقت:</span>
                  <span className="font-bold font-mono">{doc.data.date} {doc.data.time}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">طريقة الاستلام:</span>
                  <span className="font-bold">
                    {doc.data.paymentMethod === 'Cash'
                      ? 'نقداً بالخزينة'
                      : doc.data.paymentMethod === 'Card'
                      ? 'شبكة / مدى / بطاقة'
                      : doc.data.paymentMethod === 'Transfer'
                      ? `تحويل بنكي (${doc.data.bankName || 'البنك المعتمد'})`
                      : `شيك رقم ${doc.data.checkNumber || ''}`}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 min-w-[120px]">استلمنا من المكرم / السيد:</span>
                  <span className="font-black text-sm text-slate-900 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {doc.data.receivedFrom}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 min-w-[120px]">مبلغ وقدره:</span>
                  <span className="font-black text-base text-emerald-700 font-mono">
                    {formatMoney(doc.data.amount)}
                  </span>
                  <span className="font-bold text-slate-700 italic flex-1 border-b border-dotted border-slate-400 pb-0.5">
                    ({tafqeetArabic(doc.data.amount, doc.data.currency || tenant.currency || 'EGP')})
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-bold text-slate-600 min-w-[120px] pt-1">وذلك عن (البيان):</span>
                  <div className="flex-1 font-semibold text-slate-800 border-b border-dotted border-slate-400 pb-1">
                    {doc.data.description}
                    {doc.data.referenceInvoiceNo && (
                      <span className="block text-[11px] text-indigo-600 font-mono mt-0.5">
                        مرجع الفاتورة / الحجز: {doc.data.referenceInvoiceNo}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs text-center">
                <div>
                  <div className="font-bold text-slate-600 mb-8">توقيع العميل / المسدد</div>
                  <div className="border-t border-slate-300 w-40 mx-auto pt-1 text-[11px] text-slate-400">
                    الاسم والتوقيع
                  </div>
                </div>
                <div>
                  <div className="font-bold text-slate-600 mb-8">
                    أمين الخزينة / المستلم ({doc.data.receiverName})
                  </div>
                  <div className="border-t border-slate-300 w-40 mx-auto pt-1 text-[11px] text-slate-400">
                    الختم والتوقيع الرسمي
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CASH PAYMENT VOUCHER */}
          {doc.type === 'cash_payment' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-black inline-block px-6 py-1.5 bg-slate-100 rounded-xl border border-slate-300">
                  إيصال وسند صرف نقدية (سند صرف)
                </h2>
                <div className="text-xs text-slate-500 mt-1 font-mono">
                  رقم السند: <strong className="text-rose-700 text-sm">{doc.data.voucherNumber}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block mb-0.5">تاريخ ووقت الصرف:</span>
                  <span className="font-bold font-mono">{doc.data.date} {doc.data.time}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">الخزينة المصروف منها:</span>
                  <span className="font-bold">{doc.data.paidFromAccount}</span>
                </div>
              </div>

              <div className="space-y-3 text-xs border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 min-w-[120px]">اصرفوا للمكرم / الجهة:</span>
                  <span className="font-black text-sm text-slate-900 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {doc.data.paidTo}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 min-w-[120px]">المبلغ المصروف:</span>
                  <span className="font-black text-base text-rose-700 font-mono">
                    {formatMoney(doc.data.amount)}
                  </span>
                  <span className="font-bold text-slate-700 italic flex-1 border-b border-dotted border-slate-400 pb-0.5">
                    ({tafqeetArabic(doc.data.amount, doc.data.currency || tenant.currency || 'EGP')})
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-bold text-slate-600 min-w-[120px] pt-1">وذلك مقابل (البيان):</span>
                  <div className="flex-1 font-semibold text-slate-800 border-b border-dotted border-slate-400 pb-1">
                    {doc.data.description}
                    {doc.data.invoiceReference && (
                      <span className="block text-[11px] text-rose-600 font-mono mt-0.5">
                        رقم الفاتورة / المستند المرفق: {doc.data.invoiceReference}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200 text-xs text-center">
                <div>
                  <div className="font-bold text-slate-600 mb-8">إعداد المحاسب ({doc.data.preparedBy})</div>
                  <div className="border-t border-slate-300 w-32 mx-auto pt-1 text-[10px] text-slate-400">التوقيع</div>
                </div>
                <div>
                  <div className="font-bold text-slate-600 mb-8">اعتماد الإدارة ({doc.data.approvedBy})</div>
                  <div className="border-t border-slate-300 w-32 mx-auto pt-1 text-[10px] text-slate-400">الموافقة والختم</div>
                </div>
                <div>
                  <div className="font-bold text-slate-600 mb-8">توقيع المستلم ({doc.data.receiverName || doc.data.paidTo})</div>
                  <div className="border-t border-slate-300 w-32 mx-auto pt-1 text-[10px] text-slate-400">استلمت المبلغ كاملاً</div>
                </div>
              </div>
            </div>
          )}

          {/* 3. SPECIALIZED TAX INVOICE (B2B/B2C) */}
          {doc.type === 'tax_invoice' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-black inline-block px-6 py-1.5 bg-slate-100 rounded-xl border border-slate-300">
                  {doc.data.invoiceType === 'tax_invoice' ? 'فاتورة ضريبية (Tax Invoice)' : 'فاتورة ضريبية مبسطة'}
                </h2>
                <div className="text-xs text-slate-500 mt-1 font-mono">
                  رقم الفاتورة: <strong className="text-sky-700 text-sm">{doc.data.invoiceNumber}</strong>
                </div>
              </div>

              {/* Parties Details */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 block mb-1">بيانات المورد (البائع):</span>
                  <div className="font-black text-sm text-slate-900">{tenant.nameAr}</div>
                  <div>الرقم الضريبي: <strong className="font-mono">{doc.data.sellerVatNumber || tenant.taxNumber}</strong></div>
                  <div>السجل التجاري: <strong className="font-mono">{doc.data.sellerCrNumber || tenant.commercialRegNumber}</strong></div>
                  <div>العنوان: {doc.data.sellerAddress}</div>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-slate-500 block mb-1">بيانات العميل (المشتري):</span>
                  <div className="font-black text-sm text-slate-900">{doc.data.customerName}</div>
                  <div>
                    الرقم الضريبي: <strong className="font-mono">{doc.data.customerVatNumber || 'غير مسجل (فردي)'}</strong>
                  </div>
                  {doc.data.customerCrNumber && (
                    <div>السجل التجاري: <strong className="font-mono">{doc.data.customerCrNumber}</strong></div>
                  )}
                  {doc.data.customerAddress && <div>العنوان: {doc.data.customerAddress}</div>}
                  {doc.data.customerPhone && <div>الهاتف: {doc.data.customerPhone}</div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                <div>تاريخ الإصدار: <strong className="font-mono">{doc.data.date}</strong></div>
                <div>طريقة السداد: <strong>{doc.data.paymentMethod}</strong></div>
              </div>

              {/* Items Table */}
              <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="p-2.5">البند / الخدمة</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5 text-center">سعر الوحدة</th>
                    <th className="p-2.5 text-center">الخصم</th>
                    <th className="p-2.5 text-center">الخاضع للضريبة</th>
                    <th className="p-2.5 text-center">ضريبة القيمة المضافة</th>
                    <th className="p-2.5 text-center">الإجمالي شامل الضريبة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {doc.data.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-slate-800">{it.name}</td>
                      <td className="p-2 text-center font-mono">{it.quantity}</td>
                      <td className="p-2 text-center font-mono">{formatMoney(it.unitPrice)}</td>
                      <td className="p-2 text-center font-mono text-rose-600">{formatMoney(it.discount)}</td>
                      <td className="p-2 text-center font-mono font-semibold">{formatMoney(it.taxableAmount)}</td>
                      <td className="p-2 text-center font-mono text-purple-600">
                        <div>{formatMoney(it.vatAmount)}</div>
                        <div className="text-[10px] text-slate-400 font-sans">({it.vatRate}%)</div>
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-slate-900">
                        {formatMoney(it.subtotalWithVat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Box */}
              <div className="flex justify-between items-start pt-2">
                <div className="text-xs space-y-1 max-w-sm">
                  <div className="font-bold text-slate-700">التفقيط المالي الرسمي:</div>
                  <div className="text-slate-800 italic font-semibold">
                    {tafqeetArabic(doc.data.grandTotal, doc.data.currency || tenant.currency || 'EGP')}
                  </div>
                  {doc.data.bankName && doc.data.iban && (
                    <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                      <div>البنك: {doc.data.bankName}</div>
                      <div>رقم الآيبان IBAN: <strong className="font-mono">{doc.data.iban}</strong></div>
                    </div>
                  )}
                </div>

                <div className="w-64 space-y-1.5 text-xs border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <div className="flex justify-between text-slate-600">
                    <span>الإجمالي قبل الضريبة:</span>
                    <span className="font-mono font-bold">{formatMoney(doc.data.totalTaxable)}</span>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>ضريبة القيمة المضافة:</span>
                    <span className="font-mono font-bold">{formatMoney(doc.data.totalVat)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-300 pt-1.5">
                    <span>الإجمالي المستحق:</span>
                    <span className="font-mono text-sky-700">{formatMoney(doc.data.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. GOODS RECEIPT NOTE (GRN) */}
          {doc.type === 'goods_receipt' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-black inline-block px-6 py-1.5 bg-slate-100 rounded-xl border border-slate-300">
                  إذن استلام أصناف مخزنية (Goods Receipt Note - GRN)
                </h2>
                <div className="text-xs text-slate-500 mt-1 font-mono">
                  رقم الإذن: <strong className="text-amber-700 text-sm">{doc.data.grnNumber}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div>المخزن المستلم: <strong className="text-slate-900">{doc.data.warehouseName}</strong></div>
                  <div>المورد (المصدر): <strong className="text-slate-900">{doc.data.supplierName}</strong></div>
                </div>
                <div className="space-y-1 text-left">
                  <div>تاريخ التوريد: <strong className="font-mono">{doc.data.date}</strong></div>
                  {doc.data.supplierInvoiceNo && (
                    <div>فاتورة المورد: <strong className="font-mono">{doc.data.supplierInvoiceNo}</strong></div>
                  )}
                  {doc.data.purchaseOrderNo && (
                    <div>أمر الشراء: <strong className="font-mono">{doc.data.purchaseOrderNo}</strong></div>
                  )}
                </div>
              </div>

              <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5 text-center">تاريخ الانتهاء</th>
                    <th className="p-2.5 text-center">الكمية المستلمة</th>
                    <th className="p-2.5 text-center">سعر التكلفة</th>
                    <th className="p-2.5 text-center">إجمالي التكلفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {doc.data.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-slate-800">{it.productName} ({it.sku})</td>
                      <td className="p-2 text-center font-mono">{it.expiryDate || '-'}</td>
                      <td className="p-2 text-center font-mono font-bold text-amber-700">{it.quantityReceived} {it.unit}</td>
                      <td className="p-2 text-center font-mono">{formatMoney(it.unitCost)}</td>
                      <td className="p-2 text-center font-mono font-black text-slate-900">{formatMoney(it.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="text-slate-600">
                  ملاحظات الفحص: <strong>{doc.data.notes || 'تم الفحص ومطابقة المواصفات'}</strong>
                </div>
                <div className="text-sm font-black text-slate-900 text-left">
                  <div>إجمالي قيمة الوارد: <span className="text-amber-700 font-mono">{formatMoney(doc.data.totalCostValue)}</span></div>
                  <div className="text-[11px] text-slate-500 font-normal italic mt-0.5">({tafqeetArabic(doc.data.totalCostValue, 'EGP')})</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs text-center">
                <div>
                  <div className="font-bold text-slate-600 mb-8">أمين المخزن ({doc.data.receiverName})</div>
                  <div className="border-t border-slate-300 w-40 mx-auto pt-1 text-[11px] text-slate-400">التوقيع والاستلام</div>
                </div>
                <div>
                  <div className="font-bold text-slate-600 mb-8">لجنة الفحص والرقابة ({doc.data.inspectorName})</div>
                  <div className="border-t border-slate-300 w-40 mx-auto pt-1 text-[11px] text-slate-400">الاعتماد الفني</div>
                </div>
              </div>
            </div>
          )}

          {/* 5. GOODS ISSUE NOTE (GIN) */}
          {doc.type === 'goods_issue' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-black inline-block px-6 py-1.5 bg-slate-100 rounded-xl border border-slate-300">
                  إذن صرف أصناف مخزنية (Goods Issue Note - GIN)
                </h2>
                <div className="text-xs text-slate-500 mt-1 font-mono">
                  رقم الإذن: <strong className="text-orange-700 text-sm">{doc.data.ginNumber}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div>المخزن المصروف منه: <strong className="text-slate-900">{doc.data.warehouseName}</strong></div>
                  <div>المستلم / القسم: <strong className="text-slate-900">{doc.data.recipientName} ({doc.data.department})</strong></div>
                </div>
                <div className="space-y-1 text-left">
                  <div>تاريخ الصرف: <strong className="font-mono">{doc.data.date}</strong></div>
                  <div>الغرض: <strong>{doc.data.purpose}</strong></div>
                </div>
              </div>

              <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5 text-center">الوحدة</th>
                    <th className="p-2.5 text-center">الكمية المصروفة</th>
                    <th className="p-2.5 text-center">سعر التكلفة</th>
                    <th className="p-2.5 text-center">إجمالي التكلفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {doc.data.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-slate-800">{it.productName} ({it.sku})</td>
                      <td className="p-2 text-center">{it.unit}</td>
                      <td className="p-2 text-center font-mono font-bold text-orange-700">{it.quantityIssued}</td>
                      <td className="p-2 text-center font-mono">{formatMoney(it.unitCost)}</td>
                      <td className="p-2 text-center font-mono font-black text-slate-900">{formatMoney(it.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="text-slate-600">
                  ملاحظات الصرف: <strong>{doc.data.notes || 'تم تسليم الأصناف بحالة سليمة'}</strong>
                </div>
                <div className="text-sm font-black text-slate-900 text-left">
                  <div>إجمالي تكلفة المنصرف: <span className="text-orange-700 font-mono">{formatMoney(doc.data.totalCostValue)}</span></div>
                  <div className="text-[11px] text-slate-500 font-normal italic mt-0.5">({tafqeetArabic(doc.data.totalCostValue, 'EGP')})</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200 text-xs text-center">
                <div>
                  <div className="font-bold text-slate-600 mb-8">مسؤول الصرف ({doc.data.issuedBy})</div>
                  <div className="border-t border-slate-300 w-32 mx-auto pt-1 text-[10px] text-slate-400">التوقيع</div>
                </div>
                <div>
                  <div className="font-bold text-slate-600 mb-8">اعتماد المشرف ({doc.data.approvedBy})</div>
                  <div className="border-t border-slate-300 w-32 mx-auto pt-1 text-[10px] text-slate-400">الموافقة</div>
                </div>
                <div>
                  <div className="font-bold text-slate-600 mb-8">توقيع المستلم ({doc.data.recipientName})</div>
                  <div className="border-t border-slate-300 w-32 mx-auto pt-1 text-[10px] text-slate-400">استلمت الأصناف</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
