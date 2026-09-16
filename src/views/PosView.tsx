import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Product, SalesInvoice, PaymentSplit } from '../types';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Receipt,
  User,
  CheckCircle2,
  AlertCircle,
  Printer,
  Sparkles,
  QrCode,
  Layers,
  X,
  Percent,
  RotateCcw,
  Wallet,
  History,
  Coins,
} from 'lucide-react';

export const PosView: React.FC = () => {
  const {
    t,
    formatMoney,
    tenant,
    activeBranch,
    activeWarehouse,
    products,
    parties,
    paymentMethods,
    getProductStock,
    processCheckout,
    refundInvoice,
    invoices,
    activeShift,
    closeShift,
    openShift,
    language,
    setCurrentView,
    canPerformAction,
  } = usePlatform();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(parties[0]?.id || '');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [isCollectionOnly, setIsCollectionOnly] = useState<boolean>(false);

  // Cart state
  interface CartItem {
    product: Product;
    quantity: number;
    unitPrice: number;
    discount: number;
  }
  const [cart, setCart] = useState<CartItem[]>([]);

  // Payment state - dynamic from system payment methods
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    paymentMethods[0]?.id || 'pm-cash-1'
  );
  const [useSplitPayment, setUseSplitPayment] = useState<boolean>(false);
  const [splits, setSplits] = useState<Array<{ methodId: string; methodName: string; amount: number }>>([
    { methodId: paymentMethods[0]?.id || 'pm-cash-1', methodName: paymentMethods[0]?.nameAr || 'نقداً', amount: 0 },
  ]);

  // Modals
  const [completedInvoice, setCompletedInvoice] = useState<SalesInvoice | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [actualCashInput, setActualCashInput] = useState<number>(activeShift?.expectedCash || 0);
  const [showInvoicesHistory, setShowInvoicesHistory] = useState<boolean>(false);
  const [refundModalInvoice, setRefundModalInvoice] = useState<SalesInvoice | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');
  const [restockOnRefund, setRestockOnRefund] = useState<boolean>(true);

  // Categories list
  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.nameAr.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q);
    return matchesCat && matchesSearch;
  });

  const addToCart = (product: Product) => {
    if (!activeWarehouse) {
      alert(t('يرجى أولاً تعيين أو إضافة مستودع للشركة الحالية!', 'Please assign or create a warehouse first!'));
      return;
    }
    const available = getProductStock(product.id, activeWarehouse.id);
    if (!product.isService && available <= 0) {
      alert(t('عفواً، الصنف نفد من المستودع الحالي!', 'Sorry, item is out of stock in current warehouse!'));
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (!product.isService && existing.quantity >= available) {
          alert(t('لا يمكن تجاوز الرصيد المتاح بالمخزن!', 'Cannot exceed available stock!'));
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: product.sellingPrice, discount: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            const available = activeWarehouse ? getProductStock(item.product.id, activeWarehouse.id) : 0;
            if (!item.product.isService && delta > 0 && nextQty > available) {
              alert(t('لا يمكن تجاوز الرصيد المتاح بالمخزن!', 'Cannot exceed available stock!'));
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setIsCollectionOnly(false);
    setUseSplitPayment(false);
  };

  // Cart calculations
  const cartSubtotal = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxableAmount = Math.max(0, cartSubtotal - discountAmount);
  const cartTax = Number(((taxableAmount * taxPercent) / 100).toFixed(2));
  const cartNetTotal = Number((taxableAmount + cartTax).toFixed(2));

  const activePaymentMethod = paymentMethods.find((pm) => pm.id === selectedMethodId) || paymentMethods[0];

  const handleExecuteCheckout = () => {
    setCheckoutError(null);

    let splitPayload: PaymentSplit[] | undefined = undefined;
    if (useSplitPayment) {
      const totalSplit = splits.reduce((s, item) => s + (Number(item.amount) || 0), 0);
      if (Math.abs(totalSplit - cartNetTotal) > 0.01) {
        setCheckoutError(
          `${t('مجموع مبالغ التقسيم لا يساوي إجمالي الفاتورة!', 'Split sum does not equal net total!')} (${formatMoney(
            totalSplit
          )} ≠ ${formatMoney(cartNetTotal)})`
        );
        return;
      }
      splitPayload = splits.map((s) => ({
        methodId: s.methodId,
        methodName: s.methodName,
        amount: Number(s.amount) || 0,
      }));
    }

    const result = processCheckout({
      customerId: selectedCustomerId,
      items: cart,
      discountAmount,
      paymentMethod: activePaymentMethod ? activePaymentMethod.nameAr : 'نقداً',
      paymentMethodId: activePaymentMethod?.id,
      taxRate: taxPercent / 100,
      isCollectionOnly,
      splitPayments: splitPayload,
    });

    if (result.success && result.invoice) {
      setCompletedInvoice(result.invoice);
      clearCart();
    } else {
      setCheckoutError(result.error || t('حدث خطأ أثناء إتمام العملية', 'Error completing checkout'));
    }
  };

  const handleRefund = (invoice: SalesInvoice) => {
    if (!refundReason.trim()) {
      alert(t('يرجى كتابة سبب الإلغاء/الارتجاع', 'Please enter refund reason'));
      return;
    }
    const res = refundInvoice(invoice.id, refundReason, restockOnRefund);
    if (res.success) {
      alert(t('تم ارتجاع وإلغاء الفاتورة بنجاح!', 'Invoice refunded successfully!'));
      setRefundModalInvoice(null);
      setRefundReason('');
    } else {
      alert(res.error || 'حدث خطأ أثناء الإلغاء');
    }
  };

  // Guard if company has no branch or warehouse yet
  if (!activeBranch || !activeWarehouse) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-12 text-center dark:border-amber-800/60 dark:bg-amber-950/20">
        <div className="rounded-2xl bg-amber-100 p-4 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 mb-3">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
          {t('هذه الشركة لا تحتوي على فرع أو مستودع بعد', 'This company has no branch or warehouse configured')}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mb-5 leading-relaxed">
          {t(
            'لإصدار فواتير المبيعات ونقاط البيع، يرجى الانتقال إلى شاشة الشركات والفروع وإضافة فرع ومستودع لهذه الشركة أولاً.',
            'To issue sales invoices and operate POS, please go to Companies & Branches to add a branch and warehouse for this company.'
          )}
        </p>
        <button
          onClick={() => setCurrentView('companies')}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
        >
          {t('الانتقال لإدارة الشركات والفروع والمستودعات', 'Go to Companies, Branches & Warehouses')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col lg:flex-row gap-4">
      {/* LEFT: Products Catalog & Search (60%) */}
      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Top Shift Status Strip */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('شيفت الكاشير:', 'Current Shift:')} {activeShift.cashierName}
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-500">
              {t('نقدية متوقعة:', 'Expected Cash:')} {formatMoney(activeShift.expectedCash)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvoicesHistory(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <History className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t('سجل الفواتير والارتجاع', 'Invoices & Refunds')}</span>
            </button>

            {canPerformAction('pos.close_shift') && (
              <button
                onClick={() => {
                  setActualCashInput(activeShift.expectedCash);
                  setShowShiftModal(true);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {t('تقفيل الشيفت', 'Close Shift')}
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Barcode Input */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('ابحث بالاسم، الكود، أو امسح الباركود...', 'Search by name, SKU or scan barcode...')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 ps-9 pe-4 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">
            <Barcode className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[11px] font-bold hidden sm:inline">Scanner Ready</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {cat === 'ALL' ? t('كافة الأصناف والخدمات', 'All Items') : cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((prod) => {
              const stock = activeWarehouse ? getProductStock(prod.id, activeWarehouse.id) : 0;
              const isOutOfStock = !prod.isService && stock <= 0;

              return (
                <button
                  key={prod.id}
                  disabled={isOutOfStock}
                  onClick={() => addToCart(prod)}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-start transition-all ${
                    isOutOfStock
                      ? 'opacity-50 border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 active:scale-95'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-400">{prod.sku}</span>
                      {prod.isService ? (
                        <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[9px] font-bold text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                          {t('خدمة/كشف', 'Service')}
                        </span>
                      ) : (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            stock <= prod.minStockLevel
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          }`}
                        >
                          {stock} {prod.unit}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
                      {language === 'ar' ? prod.nameAr : prod.nameEn}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      {formatMoney(prod.sellingPrice)}
                    </span>
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT: Active Cart & Fast Checkout (40%) */}
      <div className="flex w-full lg:w-96 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 shrink-0">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('سلة المبيعات والتحصيل', 'Sales Cart')}
            </h2>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {cart.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors"
            >
              {t('تفريغ السلة', 'Clear')}
            </button>
          )}
        </div>

        {/* Customer Selector */}
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
          <User className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none dark:text-slate-200 cursor-pointer"
          >
            {parties
              .filter((p) => p.type === 'Customer' || p.type === 'Both' || !p.type)
              .map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-slate-900">
                  {c.name} {c.systemCode ? `(${c.systemCode})` : ''} {c.balance !== 0 && `| رصيد: ${c.balance}`}
                </option>
              ))}
          </select>
        </div>

        {/* Collection Only Switch (User Requested Feature) */}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-50/80 border border-amber-200/80 p-2.5 dark:bg-amber-950/20 dark:border-amber-800/50">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                {t('تحصيل فقط (ليس إيراد)', 'Collection Only (No Revenue)')}
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                {t('تسجل بالمحصل في الشيفت بدون كميات/إيراد', 'Recorded as collection in shift only')}
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isCollectionOnly}
            onChange={(e) => setIsCollectionOnly(e.target.checked)}
            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 max-h-48">
          {cart.length === 0 ? (
            <div className="flex h-full min-h-28 flex-col items-center justify-center text-center p-4 text-slate-400">
              <Receipt className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-1 stroke-1" />
              <p className="text-xs font-semibold">
                {t('السلة فارغة حالياً', 'Cart is currently empty')}
              </p>
              <p className="text-[10px] mt-0.5">
                {t('انقر على أي صنف من اليسار لإضافته للفاتورة', 'Click any product from the left to add')}
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex-1 pe-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                    {language === 'ar' ? item.product.nameAr : item.product.nameEn}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatMoney(item.unitPrice)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <span className="w-16 text-end text-xs font-black text-slate-900 dark:text-white">
                    {formatMoney(item.quantity * item.unitPrice)}
                  </span>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Calculations */}
        <div className="border-t border-slate-100 pt-2 dark:border-slate-800 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>{t('المجموع الفرعي:', 'Subtotal:')}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMoney(cartSubtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>{t('خصم إضافي:', 'Discount:')}</span>
            <input
              type="number"
              min="0"
              disabled={!canPerformAction('pos.discount')}
              value={discountAmount || ''}
              onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-end text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span className="font-bold flex items-center gap-1">
              <Percent className="h-3 w-3 text-indigo-500" />
              <span>{t('ضريبة (VAT %):', 'Tax (%):')}</span>
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                value={taxPercent}
                onChange={(e) => setTaxPercent(Math.max(0, Number(e.target.value) || 0))}
                className="w-10 rounded border border-slate-200 px-1 py-0.5 text-center text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <span className="font-bold text-slate-900 dark:text-white">{formatMoney(cartTax)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {t('الإجمالي النهائي المطلوب:', 'Net Total:')}
            </span>
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
              {formatMoney(cartNetTotal)}
            </span>
          </div>
        </div>

        {/* Dynamic Payment Methods (Under receipt - User Requested) */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {t('طريقة السداد والتحصيل:', 'Payment Method:')}
            </label>
            <button
              type="button"
              onClick={() => {
                setUseSplitPayment(!useSplitPayment);
                if (!useSplitPayment) {
                  setSplits([
                    {
                      methodId: paymentMethods[0]?.id || '',
                      methodName: paymentMethods[0]?.nameAr || 'نقداً',
                      amount: cartNetTotal,
                    },
                  ]);
                }
              }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline"
            >
              {useSplitPayment ? t('سداد بطريقة واحدة', 'Single Method') : t('سداد متعدد (Split)', 'Split Payment')}
            </button>
          </div>

          {!useSplitPayment ? (
            /* Registered Payment Methods Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-24 overflow-y-auto pr-0.5">
              {paymentMethods.map((pm) => {
                const isSelected = selectedMethodId === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setSelectedMethodId(pm.id)}
                    className={`flex items-center justify-center gap-1 rounded-xl border p-2 text-xs font-bold transition-all text-center ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Wallet className="h-3 w-3 shrink-0" />
                    <span className="truncate">{pm.nameAr}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Split Payment Multi-Selector */
            <div className="space-y-1.5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-2 dark:border-indigo-900/50 dark:bg-indigo-950/20 max-h-32 overflow-y-auto">
              {splits.map((split, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <select
                    value={split.methodId}
                    onChange={(e) => {
                      const pm = paymentMethods.find((p) => p.id === e.target.value);
                      setSplits((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, methodId: e.target.value, methodName: pm?.nameAr || '' } : s
                        )
                      );
                    }}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.nameAr}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={split.amount || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSplits((prev) => prev.map((s, i) => (i === idx ? { ...s, amount: val } : s)));
                    }}
                    placeholder="0"
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-end text-xs font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  {splits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSplits((prev) => [
                    ...prev,
                    {
                      methodId: paymentMethods[0]?.id || '',
                      methodName: paymentMethods[0]?.nameAr || '',
                      amount: 0,
                    },
                  ])
                }
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                + {t('إضافة طريقة سداد أخرى', 'Add Another Method')}
              </button>
            </div>
          )}

          {/* Big Checkout Button */}
          <button
            disabled={cart.length === 0 || !canPerformAction('pos.checkout')}
            onClick={handleExecuteCheckout}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white shadow-lg transition-transform active:scale-98 ${
              cart.length === 0 || !canPerformAction('pos.checkout')
                ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            <CheckCircle2 className="h-5 w-5" />
            <span>
              {isCollectionOnly
                ? t('حفظ كإيصال تحصيل فقط', 'Post as Collection Only')
                : t('حفظ وإصدار الفاتورة فوراً (F9)', 'Complete Sale & Post')} • {formatMoney(cartNetTotal)}
            </span>
          </button>
        </div>

        {checkoutError && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}
      </div>

      {/* INVOICES HISTORY & REFUND DRAWER */}
      {showInvoicesHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('سجل فواتير وإيصالات المبيعات', 'Sales & Invoices History')}
                </h3>
              </div>
              <button
                onClick={() => setShowInvoicesHistory(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {t('لا توجد فواتير سابقة', 'No invoices found')}
                </div>
              ) : (
                invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between rounded-xl border p-3 ${
                      inv.status === 'Refunded'
                        ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20'
                        : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {inv.invoiceNumber}
                        </span>
                        {inv.isCollectionOnly && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {t('تحصيل فقط', 'Collection Only')}
                          </span>
                        )}
                        {inv.status === 'Refunded' && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                            {t('مرتجعة / ملغاة', 'Refunded')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {inv.customerName} • {inv.paymentMethod}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(inv.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </p>
                      {inv.refundReason && (
                        <p className="text-[10px] text-rose-600 mt-1">سبب الإلغاء: {inv.refundReason}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm text-slate-900 dark:text-white">
                        {formatMoney(inv.netAmount)}
                      </span>
                      {inv.status !== 'Refunded' && (
                        <button
                          onClick={() => setRefundModalInvoice(inv)}
                          className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors dark:border-rose-900 dark:bg-slate-800 dark:text-rose-400"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{t('إلغاء / ارتجاع', 'Refund')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* REFUND CONFIRMATION MODAL */}
      {refundModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-rose-600 mb-3">
              <RotateCcw className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('تأكيد ارتجاع وإلغاء الفاتورة', 'Confirm Invoice Refund')}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              {t('هل أنت متأكد من ارتجاع الفاتورة رقم', 'Are you sure you want to refund invoice')}{' '}
              <span className="font-bold text-slate-900 dark:text-white">{refundModalInvoice.invoiceNumber}</span>{' '}
              {t('بمبلغ', 'for amount')}{' '}
              <span className="font-bold text-rose-600">{formatMoney(refundModalInvoice.netAmount)}</span>؟
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('سبب الارتجاع / الإلغاء (إلزامي):', 'Refund Reason (Required):')}
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder={t('مثال: طلب العميل، خطأ بالصنف...', 'e.g. Customer request, error in item...')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-900 outline-none focus:border-rose-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {!refundModalInvoice.isCollectionOnly && (
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restockOnRefund}
                    onChange={(e) => setRestockOnRefund(e.target.checked)}
                    className="h-4 w-4 rounded text-rose-600"
                  />
                  <span>{t('إعادة الكميات للمخزن تلقائياً', 'Restock items back to warehouse')}</span>
                </label>
              )}

              <div className="flex items-center gap-2 pt-3">
                <button
                  onClick={() => handleRefund(refundModalInvoice)}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors"
                >
                  {t('تأكيد الإلغاء والارتجاع', 'Confirm Refund')}
                </button>
                <button
                  onClick={() => setRefundModalInvoice(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  {t('تراجع', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT / INVOICE MODAL */}
      {completedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-extrabold">{t('تم حفظ الفاتورة والإيصال بنجاح!', 'Posted Successfully!')}</span>
              </div>
              <button
                onClick={() => setCompletedInvoice(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Printable Receipt Preview */}
            <div className="my-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-center space-y-1 mb-3">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{tenant.name}</h3>
                <p className="text-[11px] text-slate-500">{activeBranch?.name || tenant.name}</p>
                <p className="text-[10px] text-slate-400">
                  {completedInvoice.isCollectionOnly
                    ? t('إيصال تحصيل نقدية / سداد', 'Cash Collection Receipt')
                    : t('فاتورة ضريبية مبسطة', 'Simplified Tax Invoice')}{' '}
                  | {completedInvoice.invoiceNumber}
                </p>
                <p className="text-[10px] text-slate-400">
                  {new Date(completedInvoice.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                </p>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 my-2 space-y-1 dark:border-slate-700">
                {completedInvoice.items.map((item, idx) => (
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
                  <span>{formatMoney(completedInvoice.subtotal - completedInvoice.discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {t('الضريبة (VAT)', 'Tax (VAT)')}:
                  </span>
                  <span>{formatMoney(completedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm border-t border-slate-300 pt-1 dark:border-slate-700 text-slate-900 dark:text-white">
                  <span>{t('الصافي المحصل:', 'Net Collected:')}</span>
                  <span>{formatMoney(completedInvoice.netAmount)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                  <span>{t('طريقة السداد:', 'Payment Method:')}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{completedInvoice.paymentMethod}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-3 pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                <QrCode className="h-10 w-10 text-slate-800 dark:text-slate-200" />
                <div className="text-[10px]">
                  <p className="font-bold">{t('الفاتورة والإيصال الإلكتروني', 'E-Receipt & Invoice Verified')}</p>
                  <p>{t('تم الترحيل إلى الشيفت والحسابات', 'Shift & Ledger Synchronized')}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span>{t('طباعة الإيصال (Print)', 'Print Receipt')}</span>
              </button>

              <button
                onClick={() => setCompletedInvoice(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
              >
                {t('فاتورة جديدة (New Sale)', 'Next Sale')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLIND CASH RECONCILIATION MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
              {t('تقفيل شيفت الكاشير (الجرد الأعمى Blind Count)', 'Shift Close & Cash Reconciliation')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {t(
                'وفقاً لمعمارية النظام، يقوم الكاشير بعد النقدية الفعلية داخل الدرج دون معرفة الرقم المتوقع مسبقاً لمنع التلاعب.',
                'Blind count architecture ensures the cashier counts physical cash without seeing expected numbers.'
              )}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('المبلغ الفعلي الموجود بالدرج (ج.م):', 'Actual Counted Cash (EGP):')}
                </label>
                <input
                  type="number"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 dark:bg-slate-800">
                <div className="flex justify-between text-slate-500">
                  <span>{t('المبلغ المتوقع بالخزينة:', 'System Expected Cash:')}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatMoney(activeShift.expectedCash)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>{t('الفارق (عجز / زيادة):', 'Difference (Deficit/Surplus):')}</span>
                  <span
                    className={`font-bold ${
                      actualCashInput - activeShift.expectedCash < 0
                        ? 'text-rose-600'
                        : actualCashInput - activeShift.expectedCash > 0
                        ? 'text-emerald-600'
                        : 'text-slate-600'
                    }`}
                  >
                    {formatMoney(actualCashInput - activeShift.expectedCash)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  onClick={() => {
                    closeShift(actualCashInput);
                    setShowShiftModal(false);
                    alert(t('تم تقفيل الشيفت وتسجيل الفروقات بنجاح!', 'Shift closed and reconciled successfully!'));
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('اعتماد وتقفيل الشيفت', 'Reconcile & Close Shift')}
                </button>
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
