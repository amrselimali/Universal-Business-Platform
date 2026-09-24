import React, { useState, useMemo, useEffect } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { SpecializedTaxInvoice, TaxInvoiceItem, PaymentSplit } from '../../types';
import {
  FileText,
  Plus,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  Building2,
  QrCode,
  Calendar,
  Percent,
  FileSpreadsheet,
  MessageCircle,
  Ban,
  X,
  CreditCard,
  Layers,
} from 'lucide-react';
import { tafqeetArabic } from '../../utils/fiscalUtils';
import { exportToCsv, shareViaWhatsApp, generateInvoiceWhatsAppText } from '../../utils/exportUtils';

interface SpecializedTaxInvoicesTabProps {
  onPrintInvoice: (invoice: SpecializedTaxInvoice) => void;
}

export const SpecializedTaxInvoicesTab: React.FC<SpecializedTaxInvoicesTabProps> = ({ onPrintInvoice }) => {
  const {
    specializedTaxInvoices,
    addSpecializedTaxInvoice,
    cancelSpecializedTaxInvoice,
    deleteSpecializedTaxInvoice,
    paymentMethods,
    parties,
    products,
    branches,
    activeBranch,
    formatMoney,
    tenant,
  } = usePlatform();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranch?.id || 'all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (activeBranch?.id) {
      setSelectedBranchId(activeBranch.id);
    }
  }, [activeBranch?.id]);

  // Cancellation Modal
  const [cancellationModalInvoice, setCancellationModalInvoice] = useState<SpecializedTaxInvoice | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  // Form State
  const [defaultVatRate, setDefaultVatRate] = useState<number>(14);
  const [customerName, setCustomerName] = useState('');
  const [partyId, setPartyId] = useState('');
  const [customerVatNumber, setCustomerVatNumber] = useState('');
  const [customerCrNumber, setCustomerCrNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('القاهرة');
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [paymentMethod, setPaymentMethod] = useState('تحويل بنكي رسمي');
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [splitPaymentsList, setSplitPaymentsList] = useState<PaymentSplit[]>([
    { methodId: 'pm-cash-1', methodName: 'نقداً (كاش)', amount: 0 },
    { methodId: 'pm-card-1', methodName: 'بطاقة فيزا / ماستركارد', amount: 0 },
  ]);
  const [bankName, setBankName] = useState('البنك الأهلي المصري');
  const [iban, setIban] = useState('EG120003000000012345678901234');
  const [notes, setNotes] = useState('فاتورة ضريبية رسمية وفق الأصول المحاسبية المعتمدة');
  const [terms, setTerms] = useState('تستحق الفاتورة خلال 15 يوماً من تاريخ الإصدار.');

  // العملاء المسجلون فعلياً حصراً
  const registeredCustomers = useMemo(() => {
    return parties.filter((p) => p.type === 'Customer' || p.type === 'Both');
  }, [parties]);

  // الخدمات والمنتجات البيعية المكودة حصراً
  const salesAndServiceProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isService || p.itemType === 'service') return true;
      if (p.isSalesItem || p.itemType === 'sales_product') return true;
      if (!p.isStockItem && p.sellingPrice > 0) return true;
      return false;
    });
  }, [products]);

  const salesServices = useMemo(() => {
    return salesAndServiceProducts.filter((p) => p.isService || p.itemType === 'service');
  }, [salesAndServiceProducts]);

  const salesProductsOnly = useMemo(() => {
    return salesAndServiceProducts.filter((p) => !p.isService && p.itemType !== 'service');
  }, [salesAndServiceProducts]);

  // Invoice Items
  const [items, setItems] = useState<TaxInvoiceItem[]>([
    {
      id: 'item-1',
      productId: '',
      name: '',
      quantity: 1,
      unit: 'خدمة',
      unitPrice: 0,
      discount: 0,
      taxableAmount: 0,
      vatRate: 14,
      vatAmount: 0,
      subtotalWithVat: 0,
    },
  ]);

  const handleCustomerSelect = (selectedId: string) => {
    setPartyId(selectedId);
    const p = registeredCustomers.find((party) => party.id === selectedId);
    if (p) {
      setCustomerName(p.name);
      setCustomerPhone(p.phone || '');
      setCustomerAddress(p.address?.trim() ? p.address : 'القاهرة');
      setCustomerVatNumber(p.taxNumber || '');
      setCustomerCrNumber(p.commercialReg || '');
      setNationalId(p.nationalId || '');
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('القاهرة');
      setCustomerVatNumber('');
      setCustomerCrNumber('');
      setNationalId('');
    }
  };

  const handleExportInvoicesToExcel = () => {
    const exportData = filteredInvoices.map((inv) => ({
      'رقم الفاتورة': inv.invoiceNumber,
      'تاريخ الإصدار': inv.date,
      'اسم العميل': inv.customerName,
      'الرقم الضريبي للعميل': inv.customerVatNumber || 'فردي (B2C)',
      'الرقم القومي للعميل': inv.nationalId || '-',
      'المبلغ الخاضع للضريبة': inv.totalTaxable,
      'ضريبة القيمة المضافة': inv.totalVat,
      'الإجمالي النهائي (ج.م)': inv.grandTotal,
      'طريقة السداد': inv.splitPayments && inv.splitPayments.length > 0
        ? inv.splitPayments.map((s) => `${s.methodName}: ${s.amount}`).join(' + ')
        : inv.paymentMethod,
      'حالة الفاتورة': inv.status === 'cancelled' ? `ملغاة (${inv.cancellationReason || ''})` : 'معتمدة وصادرة',
    }));
    exportToCsv(exportData, `فواتير_المبيعات_الضريبية_${new Date().toISOString().split('T')[0]}`);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = salesAndServiceProducts.find((p) => p.id === productId);
    if (!prod) {
      handleItemChange(index, 'name', '');
      return;
    }
    const rate = prod.taxRate !== undefined && prod.taxRate !== null ? prod.taxRate : defaultVatRate;
    const price = prod.sellingPrice || 0;
    const qty = Math.max(1, Number(items[index].quantity) || 1);
    const disc = Math.max(0, Number(items[index].discount) || 0);
    const rawSubtotal = qty * price;
    const taxable = Math.max(0, rawSubtotal - disc);
    const vat = taxable * (rate / 100);
    const total = taxable + vat;

    const updated = [...items];
    updated[index] = {
      ...updated[index],
      productId: prod.id,
      name: prod.nameAr,
      sku: prod.sku,
      unit: prod.unit || (prod.isService ? 'خدمة' : 'قطعة'),
      unitPrice: price,
      vatRate: rate,
      taxableAmount: Number(taxable.toFixed(2)),
      vatAmount: Number(vat.toFixed(2)),
      subtotalWithVat: Number(total.toFixed(2)),
    };
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof TaxInvoiceItem, val: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: val };

    // Recompute
    const qty = Math.max(0, Number(current.quantity) || 0);
    const price = Math.max(0, Number(current.unitPrice) || 0);
    const disc = Math.max(0, Number(current.discount) || 0);
    const rate = field === 'vatRate'
      ? (val === '' ? 0 : Math.max(0, Number(val) || 0))
      : (current.vatRate !== undefined && current.vatRate !== null ? Number(current.vatRate) : defaultVatRate);

    current.vatRate = rate;
    const rawSubtotal = qty * price;
    const taxable = Math.max(0, rawSubtotal - disc);
    const vat = taxable * (rate / 100);
    const total = taxable + vat;

    current.taxableAmount = Number(taxable.toFixed(2));
    current.vatAmount = Number(vat.toFixed(2));
    current.subtotalWithVat = Number(total.toFixed(2));

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        productId: '',
        name: '',
        quantity: 1,
        unit: 'خدمة',
        unitPrice: 0,
        discount: 0,
        taxableAmount: 0,
        vatRate: defaultVatRate,
        vatAmount: 0,
        subtotalWithVat: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotalExclVat = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);
  const totalTaxable = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const totalVat = items.reduce((sum, item) => sum + item.vatAmount, 0);
  const grandTotal = items.reduce((sum, item) => sum + item.subtotalWithVat, 0);

  const filteredInvoices = specializedTaxInvoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customerVatNumber && inv.customerVatNumber.includes(searchQuery));
    const matchesBranch = selectedBranchId === 'all' || inv.branchId === selectedBranchId;
    return matchesSearch && matchesBranch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || !customerName.trim()) {
      alert('الرجاء اختيار العميل من قائمة العملاء المسجلين');
      return;
    }
    if (items.length === 0 || grandTotal <= 0) {
      alert('الرجاء إضافة بنود صالحة للفاتورة');
      return;
    }
    if (items.some((it) => !it.name.trim())) {
      alert('الرجاء اختيار الخدمة أو المنتج البيعي لجميع بنود الفاتورة');
      return;
    }

    const created = await addSpecializedTaxInvoice({
      invoiceType: 'tax_invoice',
      tenantId: tenant.id,
      branchId: activeBranch?.id || branches[0]?.id || 'branch-1',
      date,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      supplyDate: date,
      dueDate,
      partyId: partyId || undefined,
      customerName,
      customerVatNumber: customerVatNumber || undefined,
      customerCrNumber: customerCrNumber || undefined,
      nationalId: nationalId || undefined,
      customerAddress: customerAddress || undefined,
      customerPhone: customerPhone || undefined,
      sellerVatNumber: tenant.taxNumber || '200-456-789',
      sellerCrNumber: tenant.commercialRegNumber || '89541',
      sellerAddress: tenant.address || 'القاهرة، جمهورية مصر العربية',
      sellerPhone: tenant.phone || '0226901234',
      items,
      subtotalExclVat,
      totalDiscount,
      totalTaxable,
      totalVat,
      grandTotal,
      currency: tenant?.currency || 'EGP',
      paymentMethod: useSplitPayment ? 'سداد متعدد (مقسم)' : paymentMethod,
      splitPayments: useSplitPayment ? splitPaymentsList.filter((s) => s.amount > 0) : undefined,
      bankName,
      iban,
      notes,
      termsAndConditions: terms,
      status: 'issued',
    });

    setIsModalOpen(false);
    onPrintInvoice(created);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-bold block mb-1">
              إجمالي مبيعات الفواتير الضريبية
            </span>
            <span className="text-2xl font-black text-sky-800 dark:text-sky-200">
              {formatMoney(filteredInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0))}
            </span>
          </div>
          <div className="p-3 bg-sky-100 dark:bg-sky-900/50 rounded-xl text-sky-600 dark:text-sky-300">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold block mb-1">
              إجمالي ضريبة القيمة المضافة (VAT)
            </span>
            <span className="text-2xl font-black text-purple-800 dark:text-purple-200">
              {formatMoney(filteredInvoices.reduce((sum, inv) => sum + inv.totalVat, 0))}
            </span>
          </div>
          <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl text-purple-600 dark:text-purple-300">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={handleExportInvoicesToExcel}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-3.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer text-xs"
            title="تصدير جدول الفواتير الضريبية إلى ملف Excel مع ترميز UTF-8 للغة العربية"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير إلى Excel</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-3.5 rounded-xl shadow-lg shadow-sky-600/20 transition-all cursor-pointer text-xs"
          >
            <Plus className="w-5 h-5" />
            <span>إصدار فاتورة ضريبية رسمية</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم الفاتورة، اسم العميل، الرقم الضريبي..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
          >
            <option value="all">جميع الفروع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3.5 px-4">رقم الفاتورة</th>
                <th className="py-3.5 px-4">تاريخ الإصدار</th>
                <th className="py-3.5 px-4">العميل / المنشأة</th>
                <th className="py-3.5 px-4">الرقم الضريبي / القومي</th>
                <th className="py-3.5 px-4">المبلغ قبل الضريبة</th>
                <th className="py-3.5 px-4">ضريبة VAT (14%)</th>
                <th className="py-3.5 px-4">الإجمالي النهائي</th>
                <th className="py-3.5 px-4 text-center">الحالة</th>
                <th className="py-3.5 px-4 text-center">الإجراءات والطباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    لا توجد فواتير ضريبية مصدرة تطابق البحث
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{inv.date}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                      {inv.customerName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {inv.customerVatNumber || inv.nationalId || <span className="text-slate-400 italic">عميل فردي (B2C)</span>}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {formatMoney(inv.totalTaxable)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-purple-600 dark:text-purple-400">
                      {formatMoney(inv.totalVat)}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white text-sm">
                      {formatMoney(inv.grandTotal)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {inv.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          <Ban className="w-3 h-3" />
                          <span>ملغاة ({inv.cancellationReason || 'ملغاة'})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>معتمدة</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {inv.qrCodeDataUrl && (
                          <span className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" title="رمز استجابة ZATCA/ETA مشفر">
                            <QrCode className="w-4 h-4" />
                          </span>
                        )}
                        <button
                          onClick={() => {
                            const text = generateInvoiceWhatsAppText({
                              invoiceNumber: inv.invoiceNumber,
                              customerName: inv.customerName,
                              totalAmount: inv.grandTotal,
                              currency: inv.currency || 'EGP',
                              companyName: tenant.name,
                              date: inv.date,
                              itemsCount: inv.items.length,
                            });
                            shareViaWhatsApp(inv.customerPhone || '', text);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold transition-colors cursor-pointer"
                          title="مشاركة الفاتورة عبر واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="text-[11px]">واتساب</span>
                        </button>
                        <button
                          onClick={() => onPrintInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-600 transition-colors text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                          title="معاينة وطباعة الفاتورة الضريبية"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="text-[11px]">طباعة</span>
                        </button>
                        {inv.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              setCancellationModalInvoice(inv);
                              setCancelReasonInput('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 font-bold transition-colors cursor-pointer"
                            title="إلغاء الفاتورة الضريبية مع تسجيل السبب والموافقة"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span className="text-[11px]">إلغاء</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف الفاتورة الضريبية رقم ${inv.invoiceNumber}؟`)) {
                              deleteSpecializedTaxInvoice(inv.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="حذف الفاتورة نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Tax Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-sky-50/60 dark:bg-sky-950/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-600/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    إصدار فاتورة ضريبية رسمية متخصصة (Tax Invoice)
                  </h3>
                  <p className="text-xs text-slate-500">
                    إصدار فواتير ضريبية معتمدة للشركات والأفراد مع تحديد نسبة الضريبة يدوياً والعملة بالجنيه المصري
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Customer Selection (حصراً من العملاء المسجلين) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم العميل (من العملاء المسجلين فعلياً حصراً) *
                </label>
                <select
                  required
                  value={partyId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- اختر العميل من قائمة العملاء المسجلين بالمنظومة --</option>
                  {registeredCustomers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ''} {p.taxNumber ? `[الرقم الضريبي: ${p.taxNumber}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Fiscal Info */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الرقم الضريبي للعميل
                  </label>
                  <input
                    type="text"
                    placeholder="100-234-567"
                    value={customerVatNumber}
                    onChange={(e) => setCustomerVatNumber(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الرقم القومي (ETA)
                  </label>
                  <input
                    type="text"
                    placeholder="2980101XXXXXXX"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    السجل التجاري للعميل
                  </label>
                  <input
                    type="text"
                    placeholder="104523"
                    value={customerCrNumber}
                    onChange={(e) => setCustomerCrNumber(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">هاتف العميل</label>
                  <input
                    type="text"
                    placeholder="01XXXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    العنوان الوطني / المدينة
                  </label>
                  <input
                    type="text"
                    placeholder="القاهرة"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Dates (إلغاء تاريخ التوريد) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الإصدار</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      جدول بنود السلع والخدمات
                    </span>
                    {/* Batch tax applicator */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-500">الضريبة الافتراضية:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={defaultVatRate}
                        onChange={(e) => setDefaultVatRate(Number(e.target.value) || 0)}
                        className="w-12 px-1 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center font-bold text-purple-600"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                      <button
                        type="button"
                        onClick={() => {
                          setItems(
                            items.map((it) => {
                              const raw = it.quantity * it.unitPrice;
                              const tax = Math.max(0, raw - it.discount);
                              const vat = tax * (defaultVatRate / 100);
                              return {
                                ...it,
                                vatRate: defaultVatRate,
                                taxableAmount: Number(tax.toFixed(2)),
                                vatAmount: Number(vat.toFixed(2)),
                                subtotalWithVat: Number((tax + vat).toFixed(2)),
                              };
                            })
                          );
                        }}
                        className="text-[11px] font-bold px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded cursor-pointer transition-colors"
                      >
                        تطبيق على الكل
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                      <tr>
                        <th className="p-2.5">اسم البند / الخدمة (المكودة حصراً)</th>
                        <th className="p-2.5 w-18">الكمية</th>
                        <th className="p-2.5 w-24">سعر الوحدة</th>
                        <th className="p-2.5 w-20">الخصم</th>
                        <th className="p-2.5 w-24">الخاضع للضريبة</th>
                        <th className="p-2.5 w-24 text-center">الضريبة % (يدوي)</th>
                        <th className="p-2.5 w-24">مبلغ الضريبة</th>
                        <th className="p-2.5 w-28">الإجمالي شامل VAT</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="p-2 min-w-[280px]">
                            <select
                              required
                              value={item.productId || ''}
                              onChange={(e) => handleProductSelect(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                            >
                              <option value="">-- اختر الخدمة أو المنتج البيعي المكود --</option>
                              {salesServices.length > 0 && (
                                <optgroup label="-- الخدمات الطبية والتأهيلية --">
                                  {salesServices.map((srv) => (
                                    <option key={srv.id} value={srv.id}>
                                      {srv.nameAr} ({formatMoney(srv.sellingPrice)})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {salesProductsOnly.length > 0 && (
                                <optgroup label="-- المنتجات البيعية والمستلزمات --">
                                  {salesProductsOnly.map((prd) => (
                                    <option key={prd.id} value={prd.id}>
                                      {prd.nameAr} ({formatMoney(prd.sellingPrice)})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            {item.sku && (
                              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                كود: {item.sku} | الوحدة: {item.unit}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center font-semibold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.discount}
                              onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center text-rose-500"
                            />
                          </td>
                          <td className="p-2 font-semibold text-slate-800 dark:text-slate-200 text-center">
                            {formatMoney(item.taxableAmount)}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={item.vatRate ?? 0}
                                onChange={(e) => handleItemChange(idx, 'vatRate', e.target.value)}
                                className="w-14 px-1 py-1 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-center font-bold text-purple-700 dark:text-purple-300 focus:outline-none focus:border-purple-500"
                              />
                              <span className="text-[11px] text-slate-400 font-bold">%</span>
                            </div>
                          </td>
                          <td className="p-2 font-bold text-purple-600 dark:text-purple-400 text-center">
                            {formatMoney(item.vatAmount)}
                          </td>
                          <td className="p-2 font-black text-slate-900 dark:text-white text-center">
                            {formatMoney(item.subtotalWithVat)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={items.length <= 1}
                              className="text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer p-1"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Methods & Splits */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">طريقة السداد والتحصيل:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUseSplitPayment(!useSplitPayment);
                      if (!useSplitPayment) {
                        setSplitPaymentsList([
                          { methodId: 'pm-cash-1', methodName: 'نقداً (كاش)', amount: grandTotal },
                          { methodId: 'pm-card-1', methodName: 'بطاقة فيزا / ماستركارد', amount: 0 },
                        ]);
                      }
                    }}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 underline cursor-pointer"
                  >
                    {useSplitPayment ? 'الرجوع لسداد بطريقة واحدة' : 'تفعيل السداد المتعدد (Split Payment)'}
                  </button>
                </div>

                {!useSplitPayment ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        وسيلة الدفع
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                      >
                        <option value="نقداً">نقداً (كاش بالخزينة)</option>
                        <option value="بطاقة ائتمان (فيزا / ماستركارد)">بطاقة ائتمان (فيزا / ماستركارد)</option>
                        <option value="تحويل بنكي رسمي">تحويل بنكي رسمي</option>
                        <option value="شيك بنكي">شيك بنكي</option>
                        <option value="آجل (على الحساب)">آجل (على الحساب)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        اسم البنك
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        رقم الحساب / IBAN
                      </label>
                      <input
                        type="text"
                        value={iban}
                        onChange={(e) => setIban(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-sky-100 dark:border-sky-900/40">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      حدد المبالغ المقسمة بين الكاش والفيزا والبنك (يجب أن يعادل الإجمالي المستحق):
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {splitPaymentsList.map((split, sIdx) => (
                        <div key={split.methodId} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-36">
                            {split.methodName}:
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={split.amount || ''}
                            onChange={(e) => {
                              const updated = [...splitPaymentsList];
                              updated[sIdx].amount = Number(e.target.value) || 0;
                              setSplitPaymentsList(updated);
                            }}
                            className="flex-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white text-center"
                            placeholder="0.00"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-slate-500">
                        مجموع السداد المقسم:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {formatMoney(splitPaymentsList.reduce((acc, cur) => acc + (cur.amount || 0), 0))}
                        </strong>
                      </span>
                      <span className="text-slate-500">
                        المتبقي من الفاتورة:{' '}
                        <strong className={grandTotal - splitPaymentsList.reduce((acc, cur) => acc + (cur.amount || 0), 0) === 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                          {formatMoney(grandTotal - splitPaymentsList.reduce((acc, cur) => acc + (cur.amount || 0), 0))}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-xs space-y-1 w-full md:w-auto">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">
                    التفقيط المالي الرسمي (شامل الضريبة):
                  </span>
                  <span className="text-sky-700 dark:text-sky-300 font-semibold italic">
                    {tafqeetArabic(grandTotal, tenant?.currency || 'EGP')}
                  </span>
                </div>

                <div className="w-full md:w-80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>إجمالي الخاضع للضريبة (غير شامل VAT):</span>
                    <span className="font-bold">{formatMoney(totalTaxable)}</span>
                  </div>
                  <div className="flex justify-between text-purple-600 dark:text-purple-400">
                    <span>ضريبة القيمة المضافة:</span>
                    <span className="font-bold">{formatMoney(totalVat)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span>المبلغ الإجمالي المستحق:</span>
                    <span className="text-sky-600 dark:text-sky-400">{formatMoney(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md shadow-sky-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>إصدار الفاتورة الضريبية وتوليد QR والطباعة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION / VOID INVOICE WORKFLOW MODAL */}
      {cancellationModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-rose-600 mb-3">
              <Ban className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إلغاء وإسقاط الفاتورة الضريبية رسمياً
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
              وفقاً لقواعد المصلحة، يتم تسجيل عملية الإلغاء مع توثيق السبب وإشعار الخزينة وحساب العميل.
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-sky-600">{cancellationModalInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">العميل:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{cancellationModalInvoice.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">المبلغ الإجمالي:</span>
                <span className="font-bold text-rose-600">{formatMoney(cancellationModalInvoice.grandTotal)}</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!cancelReasonInput.trim()) {
                  alert('الرجاء كتابة سبب إلغاء الفاتورة');
                  return;
                }
                cancelSpecializedTaxInvoice(cancellationModalInvoice.id, cancelReasonInput.trim());
                setCancellationModalInvoice(null);
                setCancelReasonInput('');
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  سبب الإلغاء (إلزامي للتوثيق الضريبي والرقابي):
                </label>
                <input
                  type="text"
                  required
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="مثال: خطأ في البند، طلب استرجاع من العميل، إصدار إشعار دائن بديل..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-900 outline-none focus:border-rose-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  تأكيد الإلغاء والتوثيق
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancellationModalInvoice(null);
                    setCancelReasonInput('');
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
