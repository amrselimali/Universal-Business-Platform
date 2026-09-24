import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  Building2,
  Sparkles,
  Database,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Server,
  Layers,
  X,
  RefreshCw,
  ExternalLink,
  DollarSign,
  MapPin,
  Phone,
  Tag,
  FileSpreadsheet,
} from 'lucide-react';

interface CleanCompanySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (tenantId: string) => void;
}

export const CleanCompanySetupModal: React.FC<CleanCompanySetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    t,
    neonDb,
    updateNeonConnectionString,
    testNeonConnection,
    initializeCleanProductionCompany,
  } = usePlatform();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Form State
  const [nameAr, setNameAr] = useState<string>('');
  const [nameEn, setNameEn] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [currency, setCurrency] = useState<string>('EGP');
  const [currencySymbol, setCurrencySymbol] = useState<string>('ج.م');
  const [taxRate, setTaxRate] = useState<number>(14);
  const [activityType, setActivityType] = useState<'retail_pos' | 'clinic_medical' | 'trading_services' | 'general'>('general');
  const [mainBranchName, setMainBranchName] = useState<string>('الفرع الرئيسي');
  const [city, setCity] = useState<string>('القاهرة');
  const [phone, setPhone] = useState<string>('');
  const [mainWarehouseName, setMainWarehouseName] = useState<string>('المستودع الرئيسي');
  const [wipeDemoData, setWipeDemoData] = useState<boolean>(true);

  // Neon DB Connection Input
  const [neonUrl, setNeonUrl] = useState<string>(neonDb.connectionString || '');
  const [testingNeon, setTestingNeon] = useState<boolean>(false);
  const [neonTestFeedback, setNeonTestFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCurrencyChange = (curr: string) => {
    setCurrency(curr);
    if (curr === 'EGP') {
      setCurrencySymbol('ج.م');
      setTaxRate(14);
    } else if (curr === 'SAR') {
      setCurrencySymbol('ر.س');
      setTaxRate(15);
    } else if (curr === 'AED') {
      setCurrencySymbol('د.إ');
      setTaxRate(5);
    } else if (curr === 'KWD') {
      setCurrencySymbol('د.ك');
      setTaxRate(0);
    } else if (curr === 'USD') {
      setCurrencySymbol('$');
      setTaxRate(0);
    } else {
      setCurrencySymbol(curr);
    }
  };

  const handleTestNeon = async () => {
    if (!neonUrl.trim()) return;
    setTestingNeon(true);
    setNeonTestFeedback(null);
    updateNeonConnectionString(neonUrl.trim());
    const ok = await testNeonConnection(neonUrl.trim());
    setTestingNeon(false);
    if (ok) {
      setNeonTestFeedback(t('تم الاتصال بقاعدة بيانات Neon السحابية بنجاح 100%! 🚀', 'Connected to Neon Cloud successfully! 🚀'));
    } else {
      setNeonTestFeedback(t('تعذر الاتصال: يرجى التحقق من صحة رابط Neon', 'Connection failed: Check your Neon URL'));
    }
  };

  const handleSubmit = async () => {
    if (!nameAr.trim()) {
      alert(t('يرجى إدخال اسم الشركة بالعربية', 'Please enter company Arabic name'));
      setStep(1);
      return;
    }

    setLoading(true);
    setResultMsg(null);

    try {
      const res = await initializeCleanProductionCompany({
        name: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
        code: code.trim() || 'CMP',
        currency,
        currencySymbol,
        taxRate: taxRate / 100,
        activityType,
        mainBranchName: mainBranchName.trim() || undefined,
        mainWarehouseName: mainWarehouseName.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        wipeDemoData,
      });

      setLoading(false);
      setResultMsg({ success: res.success, text: res.message });

      if (res.success) {
        if (onSuccess) onSuccess(res.tenantId);
      }
    } catch (err: any) {
      setLoading(false);
      setResultMsg({ success: false, text: err.message || 'حدث خطأ أثناء التأسيس' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2 backdrop-blur-xs">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black">
                {t('معالج تهيئة وتشغيل شركة جديدة خالية من البيانات', 'Clean Company & Live Cloud Setup Wizard')}
              </h2>
              <p className="text-[11px] text-cyan-100">
                {t(
                  'بدء بيئة إنتاجية نظيفة (0.00 رصيد) مع شجرة حسابات قياسية وربط سحابي حي',
                  'Fresh production setup (0.00 balances) with clean accounts & cloud connectivity'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between w-full text-xs font-bold">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 ${step === 1 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${step === 1 ? 'bg-cyan-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>1</span>
              <span>{t('بيانات الشركة', 'Company')}</span>
            </button>
            <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 ${step === 2 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${step === 2 ? 'bg-cyan-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>2</span>
              <span>{t('الفروع والمستودع', 'Branches')}</span>
            </button>
            <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={() => setStep(3)}
              className={`flex items-center gap-2 ${step === 3 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${step === 3 ? 'bg-cyan-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>3</span>
              <span>{t('السحابة والبيانات', 'Cloud & Data')}</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {resultMsg ? (
            <div className={`rounded-2xl p-6 text-center space-y-4 ${resultMsg.success ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200 dark:border-rose-800'}`}>
              <div className="flex justify-center">
                {resultMsg.success ? (
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-bounce" />
                ) : (
                  <AlertCircle className="h-12 w-12 text-rose-600" />
                )}
              </div>
              <h3 className="text-base font-black">
                {resultMsg.success ? t('تم تأسيس الشركة وتشغيلها بنجاح!', 'Company Setup Completed!') : t('تنبيه أثناء الإعداد', 'Setup Notice')}
              </h3>
              <p className="text-xs leading-relaxed max-w-lg mx-auto">
                {resultMsg.text}
              </p>
              {resultMsg.success && (
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={onClose}
                    className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    {t('ابدأ العمل فوراً على الشاشات', 'Go to Dashboard')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* STEP 1: Company Profile */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      {t('1. هوية الشركة والبيانات الرسمية', '1. Company Identity & Official Data')}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {t('أدخل اسم المؤسسة الرسمي ليتم اعتماده على الفواتير، التقارير المحاسبية، وتذييل الإيصالات.', 'Enter official organization name to reflect on invoices, fiscal reports, and vouchers.')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('اسم الشركة (بالعربية)*', 'Company Name (Arabic)*')}
                      </label>
                      <input
                        type="text"
                        required
                        value={nameAr}
                        onChange={(e) => setNameAr(e.target.value)}
                        placeholder="مثال: شركة الأفق للتجارة والتوريدات"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('اسم الشركة (بالإنجليزية)', 'Company Name (English)')}
                      </label>
                      <input
                        type="text"
                        value={nameEn}
                        onChange={(e) => setNameEn(e.target.value)}
                        placeholder="e.g. Al-Ofoq Trading Co."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('كود الشركة (رمز تعريفي)', 'Company Code')}
                      </label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="e.g. OFQ"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs uppercase font-mono text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('العملة الأساسية', 'Base Currency')}
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => handleCurrencyChange(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="EGP">جنيه مصري (EGP - ج.م)</option>
                        <option value="SAR">ريال سعودي (SAR - ر.س)</option>
                        <option value="AED">درهم إماراتي (AED - د.إ)</option>
                        <option value="KWD">دينار كويتي (KWD - د.ك)</option>
                        <option value="USD">دولار أمريكي (USD - $)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('نسبة الضريبة (%)', 'Tax Rate (%)')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Activity Type Selection */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {t('طبيعة ونشاط المؤسسة:', 'Organization Domain / Industry:')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'general', titleAr: 'عام وتجاري', titleEn: 'General & Commercial', icon: Building2 },
                        { id: 'retail_pos', titleAr: 'تجزئة ومبيعات POS', titleEn: 'Retail & POS', icon: Tag },
                        { id: 'clinic_medical', titleAr: 'عيادات ومراكز طبية', titleEn: 'Medical Clinic & Laser', icon: Sparkles },
                        { id: 'trading_services', titleAr: 'خدمات وتوريدات', titleEn: 'Services & Supply', icon: Layers },
                      ].map((act) => {
                        const Icon = act.icon;
                        const isSelected = activityType === act.id;
                        return (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => setActivityType(act.id as any)}
                            className={`flex flex-col items-center text-center p-3 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:border-cyan-400 dark:bg-cyan-950/40 dark:text-cyan-200 font-bold shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300'}`}
                          >
                            <Icon className={`h-4 w-4 mb-1 ${isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                            <span className="text-[11px]">{act.titleAr}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Branches & Warehouse */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      {t('2. الفرع الرئيسي والمستودع الافتراضي', '2. Main Operating Branch & Warehouse')}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {t('سيتم إنشاء الفرع والمستودع الأولي لتمكين الفواتير والمخزون، ويمكنك إضافة فروع أخرى لاحقاً.', 'Creates the primary branch and warehouse for immediate inventory & POS operations.')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('اسم الفرع الرئيسي', 'Main Branch Name')}
                      </label>
                      <input
                        type="text"
                        value={mainBranchName}
                        onChange={(e) => setMainBranchName(e.target.value)}
                        placeholder="الفرع الرئيسي"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('المدينة / الموقع', 'City / Location')}
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="مثال: القاهرة / الرياض"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('هاتف الفرع (اختياري)', 'Branch Phone (Optional)')}
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="010XXXXXXXX"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {t('اسم المستودع الافتراضي', 'Default Warehouse Name')}
                      </label>
                      <input
                        type="text"
                        value={mainWarehouseName}
                        onChange={(e) => setMainWarehouseName(e.target.value)}
                        placeholder="المستودع الرئيسي"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Chart of Accounts Preview Card */}
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-950/40 dark:bg-indigo-950/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t('شجرة الحسابات القياسية النظيفة (Chart of Accounts):', 'Clean Chart of Accounts Built-in:')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t(
                        'سيتم تلقائياً تأسيس دليل حسابات محاسبي احترافي متوازن (أصول: خزينة، بنك، مخزون، عملاء | خصوم: موردين، ضرائب | حقوق ملكية: رأس مال | إيرادات ومصروفات تشغيلية) برصيد صفري 0.00 دون أي قيود سابقة.',
                        'A full balanced Chart of Accounts will be created (Cash, Bank, Inventory, AR, AP, VAT, Capital, Sales, COGS, Expenses) with exactly 0.00 balances.'
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3: Cloud Database & Wipe Demo Data */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      {t('3. ربط قاعدة البيانات السحابية الحية (Live Cloud Database)', '3. Live Cloud Database & Clean Slate')}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {t('ربط النظام مباشرة بقاعدة بيانات PostgreSQL السحابية (Neon) لتصبح كافة العمليات حية ومحفوظة سحابياً.', 'Connect to Neon Cloud PostgreSQL for persistent, real-time live database storage.')}
                    </p>
                  </div>

                  {/* Connection String Input */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 text-cyan-600" />
                        <span>{t('رابط الاتصال السحابي (Neon Connection String):', 'Neon Connection String:')}</span>
                      </label>
                      <a
                        href="https://console.neon.tech"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-cyan-600 hover:underline flex items-center gap-1"
                      >
                        <span>{t('إنشاء حساب مجاني على Neon', 'Get free Neon DB')}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={neonUrl}
                        onChange={(e) => setNeonUrl(e.target.value)}
                        placeholder="postgresql://user:pass@ep-cool-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require"
                        className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={testingNeon || !neonUrl.trim()}
                        onClick={handleTestNeon}
                        className="flex items-center gap-1 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${testingNeon ? 'animate-spin' : ''}`} />
                        <span>{testingNeon ? t('جاري الفحص...', 'Testing...') : t('فحص الاتصال', 'Test')}</span>
                      </button>
                    </div>

                    {neonTestFeedback && (
                      <p className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                        {neonTestFeedback}
                      </p>
                    )}

                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t(
                        '💡 ملاحظة: إذا تركت الرابط فارغاً، سيعمل التطبيق في الوضع المحلي المحفوظ بالمتصفح، ويمكنك ربط السحابة في أي وقت لاحقاً من شاشة Neon Hub.',
                        '💡 Note: If left empty, local storage will be used, and you can plug Neon at any time from Neon Hub.'
                      )}
                    </p>
                  </div>

                  {/* Clean Slate vs Keep Demo Switch */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {t('خيارات تنظيف البيانات السابقة (Data Scope):', 'Demo Data Cleaning Scope:')}
                    </h4>

                    <div className="space-y-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="wipeDemo"
                          checked={wipeDemoData === true}
                          onChange={() => setWipeDemoData(true)}
                          className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {t('تنظيف كامل وتعيين شركتي الجديدة فقط (Clean Production Slate)', 'Clean Production Slate (Wipe Demo Data)')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t(
                              'إزالة كافة الشركات التجريبية والفواتير والأصناف الوهمية تماماً، لتصبح شركتك الجديدة هي المؤسسة الوحيدة بنقاء 100%. (موصى به للإنتاج الفعلي).',
                              'Removes all dummy demo companies, invoices, and dummy items. Recommended for real production launch.'
                            )}
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="wipeDemo"
                          checked={wipeDemoData === false}
                          onChange={() => setWipeDemoData(false)}
                          className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {t('إضافة الشركة الجديدة مع الإبقاء على الشركات التجريبية كمرجع', 'Keep Demo Companies for Reference')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t(
                              'تأسيس شركتك الجديدة كشركة نشطة، مع إبقاء الشركات التجريبية متاحة في قائمة التبديل للمعاينة.',
                              'Creates your clean company as active, while keeping demo company available in the switcher.'
                            )}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!resultMsg && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" />
                <span>{t('السابق', 'Back')}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
              >
                {t('إلغاء', 'Cancel')}
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1 && !nameAr.trim()) {
                      alert(t('يرجى إدخال اسم الشركة بالعربية', 'Please enter company Arabic name'));
                      return;
                    }
                    setStep((s) => s + 1);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-700 transition-colors"
                >
                  <span>{t('التالي', 'Next')}</span>
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-md hover:from-cyan-700 hover:to-emerald-700 transition-all disabled:opacity-50"
                >
                  <Sparkles className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>
                    {loading
                      ? t('جاري التأسيس والربط السحابي...', 'Initializing & Connecting...')
                      : t('🚀 إطلاق الشركة وتفعيل البيئة النظيفة', 'Launch Clean Company Now')}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
