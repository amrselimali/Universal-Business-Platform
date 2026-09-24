import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  BookOpen,
  Download,
  Printer,
  Search,
  CheckCircle2,
  Layers,
  Database,
  ShieldCheck,
  Server,
  Cpu,
  Boxes,
  Users,
  Building2,
  Receipt,
  ShoppingCart,
  Calculator,
  ArrowRight,
  ArrowLeft,
  Sliders,
  AlertTriangle,
  HelpCircle,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const SystemManualView: React.FC = () => {
  const { language, t } = usePlatform();
  const [langMode, setLangMode] = useState<'both' | 'ar' | 'en'>(language === 'ar' ? 'ar' : 'en');
  const [activeTab, setActiveTab] = useState<
    'architecture' | 'beginner' | 'screens' | 'workflows' | 'roles' | 'faq'
  >('architecture');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadWord = () => {
    // Direct link to the generated .docx file in public folder
    const link = document.createElement('a');
    link.href = '/Universal_ERP_Comprehensive_Manual_Bilingual.docx';
    link.download = 'Universal_ERP_Comprehensive_Manual_Bilingual.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner - Screen / Action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-indigo-700/40">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-bold border border-indigo-400/30">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('التوثيق الرسمي المعتمد 2026', 'Official Certified Documentation 2026')}</span>
            <span className="text-white/40">•</span>
            <span>Version 1.01 Enterprise</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {t('دليل المستخدم الشامل والتوثيق المعماري', 'Comprehensive User Manual & Architecture Blueprint')}
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200/90 max-w-2xl leading-relaxed">
            {t(
              'مرجع تشغيلي وتقني شامل باللغتين العربية والإنجليزية يشرح كل شاشة وزر ودورة عمل وترحيل محاسبي ومخزني بالتفصيل للمستخدم البسيط والمهندس المحترف.',
              'Exhaustive operational and technical reference in Arabic & English detailing every screen, button, workflow, and posting cycle.'
            )}
          </p>
        </div>

        {/* Action Controls: Download Word, Print, Language Mode */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadWord}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer"
            title={t('تحميل الدليل كاملاً كملف وورد Microsoft Word (.docx)', 'Download full manual as Microsoft Word .docx')}
          >
            <Download className="w-4 h-4" />
            <span>{t('تحميل ملف وورد (.docx)', 'Download Word (.docx)')}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold rounded-2xl border border-white/20 backdrop-blur-xs transition cursor-pointer"
            title={t('طباعة الدليل أو حفظه بصيغة PDF', 'Print or save as PDF')}
          >
            <Printer className="w-4 h-4" />
            <span>{t('طباعة / PDF', 'Print / PDF')}</span>
          </button>

          {/* Language Toggle for Manual */}
          <div className="flex items-center bg-black/30 p-1 rounded-2xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setLangMode('ar')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                langMode === 'ar' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => setLangMode('both')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                langMode === 'both' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              ثنائي (Both)
            </button>
            <button
              type="button"
              onClick={() => setLangMode('en')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                langMode === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>{t('1. المعمارية والمواصفات التقنية', '1. Architecture & Tech Specs')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('beginner')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'beginner'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('2. دليل المبتدئ والبداية السريعة', "2. Beginner's Onboarding")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('screens')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'screens'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>{t('3. دليل الشاشات والأزرار بالتفصيل', '3. Screens & Buttons Guide')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workflows')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'workflows'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t('4. دورات العمل والترحيل المحاسبي', '4. Workflows & Postings')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t('5. مصفوفة الصلاحيات والأمان', '5. Roles & Permissions')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'faq'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{t('6. الأسئلة الشائعة وحل المشكلات', '6. FAQs & Solutions')}</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 rtl:right-3 rtl:left-auto text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('بحث في الدليل والشاشات...', 'Search manual...')}
            className="w-full text-xs py-2 pl-9 pr-3 rtl:pr-9 rtl:pl-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Content Area based on Active Tab */}

      {/* TAB 1: ARCHITECTURE & TECHNICAL SPECIFICATIONS */}
      {activeTab === 'architecture' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('المعمارية التقنية ومواصفات النظام المتكاملة', 'Technical Architecture & Full System Specifications')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('مبنية على أحدث المعايير الهندسية للأنظمة السحابية الموزعة (Cloud-Native Enterprise)', 'Engineered for cloud-native scalability, resilience, and strict type safety')}
                </p>
              </div>
            </div>

            {/* Quick Specs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                  <Server className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">{t('لغة البرمجة والبيئة', 'Language & Runtime')}</span>
                </div>
                <p className="text-base font-black text-slate-900 dark:text-white">TypeScript 5.8</p>
                <p className="text-xs text-slate-500">Node.js 22 LTS + Native ESM</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-2">
                  <Database className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">{t('قاعدة البيانات', 'Database')}</span>
                </div>
                <p className="text-base font-black text-slate-900 dark:text-white">Neon PostgreSQL 16+</p>
                <p className="text-xs text-slate-500">Serverless ACID & Scale-to-Zero</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-2">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">{t('الواجهة الأمامية', 'Frontend Stack')}</span>
                </div>
                <p className="text-base font-black text-slate-900 dark:text-white">React 19 + Tailwind 4</p>
                <p className="text-xs text-slate-500">Vite 6 + Motion + Recharts</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                  <Building2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">{t('الهيكل التنظيمي', 'Hierarchy Model')}</span>
                </div>
                <p className="text-base font-black text-slate-900 dark:text-white">Multi-Tenant / Branch</p>
                <p className="text-xs text-slate-500">Company → Branch → Warehouse</p>
              </div>
            </div>

            {/* Detailed Architecture Breakdown */}
            <div className="space-y-6 pt-2">
              {/* Frontend & UX */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 text-xs font-black">1</span>
                  {t('الواجهة الأمامية وتجربة الاستخدام (Frontend & UX Design)', 'Frontend Stack & User Experience')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• React 19 والبرمجة الوظيفية الصارمة:', '• React 19 Strict Functional Components:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'كافة الشاشات مبنية على React 19 مع Custom Hooks متخصصة (مثل usePlatform) لإدارة الحالة المركزية بكفاءة وتفادي إعادة الرسم غير الضرورية.',
                        'Built on React 19 leveraging specialized custom hooks for lightweight state management and high render performance.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• Tailwind CSS v4 والتصميم المتجاوب الكامل:', '• Tailwind CSS v4 Full Responsiveness:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'يدعم النظام العمل على الهواتف الذكية، أجهزة الآيباد والتابلت، أجهزة شاشات اللمس الخاصة بنقاط البيع POS، والشاشات المكتبية العريضة بسلاسة تامة.',
                        'Flawless responsive adaptivity supporting mobile devices, iPad/tablets, touch POS terminals, and ultra-wide desktop monitors.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• دعم ثنائي اللغة كامل مع اتجاه (RTL / LTR):', '• Comprehensive Bilingual RTL / LTR:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'تبديل فوري بين العربية والإنجليزية دون إعادة تحميل الصفحة، مع الحفاظ التام على اتجاه النصوص وتنسيق الأرقام والعملات.',
                        'Instant one-click toggle between Arabic and English without reloading, preserving localized typography, currencies, and numbers.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• الرسوم البيانية التفاعلية ومؤشرات الأداء:', '• Visual Data Analytics with Recharts:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'رسوم بيانية حية للإيرادات، المصروفات، الأرباح، وفئات المبيعات لتسهيل اتخاذ القرارات السريعة للإدارة.',
                        'Real-time visualization for revenue streams, operating costs, margins, and sales distribution facilitating executive decisions.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Backend & Database */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-600 text-xs font-black">2</span>
                  {t('الباك إند وقاعدة البيانات السحابية (Backend & Neon Cloud Database)', 'Backend Services & Cloud Database')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• Express.js والخدمات الخفيفة:', '• Express.js Micro-Routing Layer:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'طبقة خلفية سريعة تعالج الطلبات وتدمج Vite في بيئة التطوير، وتعمل بحزمة مدمجة واحدة (dist/server.cjs) في الإنتاج لتقليل زمن التشغيل.',
                        'Ultra-fast service layer bundling to a single CJS artifact for instant cold-starts and container deployment.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• Neon Serverless PostgreSQL والتوسع التلقائي:', '• Neon Serverless PostgreSQL & Auto-Scale:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'قاعدة بيانات PostgreSQL 16 سحابية حقيقية تدعم العمليات المالية المتزامنة والـ ACID Transactions مع ميزة تعليق التشغيل عند عدم النشاط (Scale-to-zero) لتوفير التكاليف.',
                        'Production PostgreSQL engine with true ACID compliance and scale-to-zero compute auto-suspension to minimize cloud costs.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• المرونة ضد انقطاع الإنترنت (Local Fallback):', '• Zero-Downtime Local Fallback:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'إذا تعذر الاتصال بالسيرفر أو بالإنترنت، يعمل النظام محلياً بالكامل على المتصفح دون توقف فواتير المبيعات أو عمليات الكاشير، مع مزامنتها لاحقاً.',
                        'Offline resilience guarantees cashier operations continue uninterrupted even if internet goes down, queuing state for later sync.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• مركز تحكم نيون (Neon Hub):', '• Dedicated Neon Cloud Hub:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'شاشة مخصصة تتيح للمشرف فحص صحة الاتصال، إنشاء ومزامنة الجداول تلقائياً بضغطة زر، وإعادة تعيين البيانات بمرونة مطلقة.',
                        'Interactive management hub verifying connectivity, executing one-click schema migrations, and seeding initial records.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scalability & Extensibility */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 text-xs font-black">3</span>
                  {t('إمكانيات التوسع والربط المستقبلي (Scalability & Integrations)', 'Scalability & Future Growth')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• تعدد الشركات والفروع (Multi-Tenant):', '• Multi-Company & Multi-Branch Architecture:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'إمكانية إدارة عشرات الشركات والفروع والمستودعات من حساب واحد مع عزل تام للبيانات المالية والمخزنية لكل فرع وشركة.',
                        'Run dozens of independent companies, regional branches, and storehouses with complete data isolation.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• مخصص تفعيل الموديولات (Modules Switcher):', '• Modular Feature Toggling:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'إمكانية تفعيل أو إيقاف أي موديول (مثل: العيادات والليزر، نقاط البيع، أذونات المخازن، الحسابات) بضغطة زر واحدة لتكييف النظام مع أي نشاط تجاري أو طبي.',
                        'Turn modules on or off dynamically to fit any retail, wholesale, clinic, or service business model without code modifications.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• التوافق مع الفاتورة الإلكترونية (ZATCA):', '• E-Invoicing & ZATCA Phase 2 Readiness:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'كافة الفواتير الضريبية مزودة بترميز Base64 TLV QR Code المعتمد، ومجهزة بحقول المعرف الموحد UUID والتسلسل المشفر للربط المستقبلي.',
                        'Compliant cryptographic QR code generation and sequential UUID structures ready for regulatory e-invoicing APIs.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('• الأرشيف الآمن وسجل التدقيق اللحظي:', '• Safe Archive Vault & Audit Record:')}</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'تطبيق الحذف الآمن (Soft Delete) مع خزينة مخصصة لاستعادة أي فرع أو مستودع أو صنف، وتوثيق كافة العمليات في سجل رقابة غير قابل للتعديل.',
                        'Safe-delete architecture with an instant-restore vault and immutable audit records tracking who changed what and when.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BEGINNER'S GUIDE & HEADER NAVIGATION */}
      {activeTab === 'beginner' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('دليل المستخدم البسيط - كيف تبدأ من الصفر', "Beginner's Step-by-Step Onboarding Guide")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('شرح مبسط وواضح لمن لا يملك أي خبرة سابقة في استخدام الأنظمة المحاسبية والبرمجيات', 'Clear and simple instructions for first-time users without any prior accounting software experience')}
                </p>
              </div>
            </div>

            {/* Step 1: Login */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-black">1</span>
                {t('تسجيل الدخول واختيار الحساب الوظيفي', 'Signing In & Selecting User Account')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t(
                  'عند فتح المنصة، تظهر شاشة تسجيل الدخول. يمكنك استخدام الحساب التجريبي المتاح بضغطة زر من القائمة السريعة، أو إدخال اسم المستخدم وكلمة المرور يدوياً. فيما يلي الحسابات الافتراضية المجهزة في النظام:',
                  'On initial launch, the login screen displays. Select from the quick demo user badges or enter credentials manually:'
                )}
              </p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3 font-bold">{t('الدور الوظيفي', 'Role')}</th>
                      <th className="p-3 font-bold">{t('اسم المستخدم', 'Username')}</th>
                      <th className="p-3 font-bold">{t('كلمة المرور', 'Password')}</th>
                      <th className="p-3 font-bold">{t('الوظيفة والمسؤولية اليومية', 'Daily Responsibility')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-bold text-indigo-600">مدير النظام الشامل (Admin)</td>
                      <td className="p-3 font-mono font-semibold">admin</td>
                      <td className="p-3 font-mono text-slate-500">admin123</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">صلاحيات مطلقة لكافة الشاشات وإدارة الشركات والمستخدمين والنيون</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">مدير الفرع (Manager)</td>
                      <td className="p-3 font-mono font-semibold">sarah</td>
                      <td className="p-3 font-mono text-slate-500">sarah123</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">إدارة الفرع المعين، التقارير التشغيلية، ومتابعة الكوادر والمبيعات</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">المحاسب المالي (Accountant)</td>
                      <td className="p-3 font-mono font-semibold">khaled</td>
                      <td className="p-3 font-mono text-slate-500">khaled123</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">القيود المحاسبية، السندات، الضرائب، ومراجعة ميزان المراجعة والأرباح</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">كاشير المبيعات (Cashier)</td>
                      <td className="p-3 font-mono font-semibold">nora</td>
                      <td className="p-3 font-mono text-slate-500">nora123</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">شاشة نقطة البيع السريعة POS، استلام الأموال، وإصدار فواتير المبيعات</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">موظف الاستقبال (Reception)</td>
                      <td className="p-3 font-mono font-semibold">reception</td>
                      <td className="p-3 font-mono text-slate-500">rec123</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">حجوزات المرضى، شاشة التشغيل، وجلسات العيادات والليزر</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">أمين المستودع (Storekeeper)</td>
                      <td className="p-3 font-mono font-semibold">tariq</td>
                      <td className="p-3 font-mono text-slate-500">tariq123</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">أذونات الاستلام المخزني GRN وأذونات الصرف GIN وإجراء الجرد الفعلي</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 2: Top Header Controls */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-black">2</span>
                {t('فهم الشريط العلوي وأزراره الدائمة (Top Header Controls)', 'Understanding Top Header Controls & Selectors')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t(
                  'الشريط العلوي موجود دائماً في أعلى شاشة النظام، ويوفر لك مفاتيح التحكم السريعة التالية:',
                  'The persistent top bar displays operational context and immediate actions:'
                )}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <Building2 className="w-4 h-4" />
                    <span>{t('مبدل الشركة النشطة (Company Switcher)', 'Active Company Switcher')}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('يظهر اسم الشركة الحالية. اضغط عليه لاختيار الشركة التي ترغب في العمل عليها وتصفية عملياتها.', 'Switches active enterprise tenant to isolate records and settings.')}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <Layers className="w-4 h-4" />
                    <span>{t('مبدل الفرع النشط (Branch Switcher)', 'Active Branch Switcher')}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('يحدد الفرع الذي ستصدر منه الفواتير وأذونات المخازن (مثل: فرع الرياض، فرع جدة).', 'Filters data and directs sales/inventory postings to the selected branch.')}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <Database className="w-4 h-4" />
                    <span>{t('مؤشر قاعدة بيانات نيون (Neon DB Badge)', 'Neon Cloud Database Badge')}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('يظهر كلمة (متصل) بالسماوي عند الربط السحابي، أو (محلي) بالكهرماني عند العمل دون إنترنت.', 'Shows cloud connection state. Clicking it opens the Neon Cloud Hub.')}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold">
                    <ShoppingCart className="w-4 h-4" />
                    <span>{t('زر نقطة البيع السريع (Fast POS - F2)', 'Fast POS Shortcut')}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('زر بنفسجي بارز يفتح شاشة الكاشير فوراً، ويمكنك أيضاً الضغط على زر F2 من الكيبورد.', 'Opens cashier POS immediately. Keyboard shortcut: Press F2.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Sidebar Navigation */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-black">3</span>
                {t('فهم القائمة الجانبية (Sidebar Sections)', 'Understanding Sidebar Navigation Sections')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t(
                  'تنقسم القائمة الجانبية إلى 6 مجموعات واضحة تمنع التشتت وتسهل الوصول السريع لأي شاشة:',
                  'The navigation sidebar is grouped into 6 logical business domains:'
                )}
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold shrink-0">1</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{t('العمليات والتشغيل اليومي:', 'Daily Operations:')}</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 ml-1.5">{t('لوحة التحكم، شاشة التشغيل، أجهزة الليزر، الحجوزات، نقطة البيع POS، وسجل فواتير المبيعات.', 'Dashboard, Run-sheet, Laser devices, Bookings, POS, and Invoices log.')}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold shrink-0">2</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{t('السندات والوثائق المالية:', 'Fiscal Vouchers & Tax Invoices:')}</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 ml-1.5">{t('سندات القبض النقدية، سندات الصرف النقدية، وفواتير المبيعات الضريبية.', 'Cash receipts, cash payments, and tax invoices.')}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold shrink-0">3</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{t('المخازن وأذونات المخازن:', 'Stock & Warehouse Vouchers:')}</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 ml-1.5">{t('أذونات الاستلام GRN، أذونات الصرف GIN، إدارة المنتجات وحد الطلب، وإدارة المخازن والجرد.', 'Goods receipts, goods issues, products catalog, and stocktaking.')}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold shrink-0">4</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{t('الكوادر والعملاء والرواتب:', 'Directory & Management:')}</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 ml-1.5">{t('إدارة العملاء، إدارة الموردين، شؤون الموظفين، ومسير الرواتب والأجور.', 'Customer CRM, Suppliers, Staff profiles, and monthly Payroll.')}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold shrink-0">5</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{t('الحسابات والتقارير المالية:', 'Accounts & Financial Reports:')}</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 ml-1.5">{t('طرق التحصيل، إدارة الحسابات ودليل الحسابات، وتقارير التشغيل والورديات.', 'Payment methods, Chart of accounts, General ledger, and Operations reports.')}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold shrink-0">6</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{t('الرقابة والشركات والإعدادات:', 'Audit, Security & Platform:')}</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 ml-1.5">{t('سجل الرقابة والمحذوفات، سجل نشاط المستخدمين، الشركات والفروع والأرشيف الآمن، المستخدمين والصلاحيات، وموديولات النظام والنيون.', 'Audit trail, Activity logs, Companies & Archive vault, Users & Roles, and Neon Hub.')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SCREENS & BUTTONS GUIDE */}
      {activeTab === 'screens' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 rounded-2xl">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('دليل الشاشات والأزرار خطوة بخطوة بالتفصيل الدقيق', 'Exhaustive Screen-by-Screen & Button Functionality Guide')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('شرح تفصيلي لكل شاشة وماذا يفعل كل زر في المنصة لضمان عدم حدوث أي خطأ في التشغيل', 'Detailed breakdown explaining every button, modal, and action across the ERP platform')}
                </p>
              </div>
            </div>

            {/* List of screens */}
            <div className="space-y-4">
              {/* Screen 1: POS */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand('pos')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 text-start hover:bg-slate-100 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        {t('1. شاشة نقطة البيع السريعة (Point of Sale - POS)', '1. Point of Sale (POS) Screen')}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t('إدارة الورديات، مسح الباركود، إضافة الأصناف، والتحصيل متعدد الطرق', 'Shift management, barcode scanning, cart building, and split checkout')}
                      </p>
                    </div>
                  </div>
                  {expandedSection === 'pos' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {(expandedSection === 'pos' || expandedSection === null) && (
                  <div className="p-5 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('زر [فتح وردية كاشير - Open Shift]:', 'Button [Open POS Shift]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('يطلب إدخال العهدة النقدية الافتتاحية في الدرج لتفعيل إمكانية البيع وتسجيل الحركات باسم الكاشير الحالي.', 'Enters opening cash float, binding all issued transactions to current user shift.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('خانة البحث ومسح الباركود:', 'Barcode & Search Input:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('اكتب اسم الصنف أو امسحه بالماسح الضوئي ليضاف فوراً للسلة مع حساب السعر والضريبة.', 'Scan product barcode or type SKU/name to instantly add line items to the cart.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('أزرار الكميات (+ / -) ومسح السطر:', 'Quantity Adjusters (+ / -):')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('تعديل عدد الوحدات المطلوبة أو حذف المنتج من الفاتورة قبل السداد.', 'Increment or decrement quantity or delete mis-scanned items from the invoice.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('زر [الدفع والسداد المالي]:', 'Button [Checkout & Payment]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('يفتح نافذة التحصيل لاختيار (نقد، مدى، فيزا، آجل، أو خصم من باقة العميل) وتوليد الفاتورة والباركود الضريبي.', 'Opens payment modal for multi-tender checkout, generating compliant QR tax invoice.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 md:col-span-2">
                        <span className="font-bold text-rose-600 block mb-1">{t('زر [إقفال الوردية - End Shift]:', 'Button [End Cashier Shift]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('يدخل الكاشير النقدية الموجودة في الدرج بنهاية الشيفت، فيقوم النظام آلياً بمقارنتها بالمبيعات المسجلة وإظهار أي عجز أو زيادة وترحيل الوردية نهائياً.', 'Prompts for closing drawer count, calculates cash variance (overage/shortage), and locks the shift.')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Screen 2: Products & Low-stock Alerts */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand('products')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 text-start hover:bg-slate-100 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        {t('2. شاشة إدارة المنتجات والخدمات ونظام تنبيهات نقص المخزون', '2. Products & Services with Low-Stock Alerts')}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t('إضافة الأصناف، تحديد حد الطلب، فلترة النقص، والحذف الآمن للمنتج', 'Catalog management, reorder points, low-stock filter, and safe deletion modal')}
                      </p>
                    </div>
                  </div>
                  {expandedSection === 'products' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {(expandedSection === 'products' || expandedSection === null) && (
                  <div className="p-5 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('زر [صنف بيعي جديد]:', 'Button [New Sales Item]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('يفتح نافذة تسجيل منتج جديد مع الاسم، الكود SKU، سعر الشراء، سعر البيع، والمجموعة البيعية.', 'Creates product/service with name, SKU, cost, selling price, and category.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-amber-600 block mb-1">{t('ودجت تنبيهات نقص المخزون التلقائي:', 'Automated Low-Stock Alert Widget:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('شريط أعلى الشاشة يراقب آلياً الأصناف التي وصلت إلى حد الطلب أو نفدت، ويقترح كميات الشراء المطلوبة لتفادي نفاد البضاعة.', 'Live widget alerting items nearing depletion or out of stock with reorder recommendations.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-amber-600 block mb-1">{t('زر فلتر [تنبيهات نقص المخزون]:', 'Filter Button [Low Stock]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('بضغطة واحدة يقوم بتصفية الجدول بالكامل لعرض الأصناف المنخفضة فقط لسرعة إصدار أوامر الشراء.', 'One-click filter restricting table to items at or below reorder threshold.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('زر ورابط [ضبط حد الطلب] في الجدول:', 'Direct [Set Reorder Threshold] Button:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('يمكنك الضغط على "/ حد X" بجانب الصنف لفتح نافذة سريعة تتيح لك تغيير حد التنبيه بالخيارات السريعة (2، 5، 10، 20) أو أي رقم وحفظه فوراً.', 'Adjusts minimum threshold in 2 clicks with presets (2, 5, 10, 20) and immediate feedback.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 md:col-span-2">
                        <span className="font-bold text-rose-600 block mb-1">{t('زر [حذف الصنف البيعي]:', 'Button [Delete Product]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('يفتح نافذة تأكيد داخلية تعرض اسم الصنف وكوده وسعره للتأكيد قبل الحذف النهائي، مع إشعار نجاح فوري وتسجيل الحركة في سجل التدقيق.', 'In-app confirmation modal showing product details before final deletion with audit trail.')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Screen 3: Companies, Branches & Archive Vault */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand('companies')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 text-start hover:bg-slate-100 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        {t('3. شاشة إدارة الشركات والفروع وخزينة الأرشيف الآمن', '3. Companies, Branches & Safe Archive Vault')}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t('إدارة الفروع والمستودعات واستعادة المحذوفات من خزينة الأرشيف', 'Branch/warehouse management and 1-click restore from archive vault')}
                      </p>
                    </div>
                  </div>
                  {expandedSection === 'companies' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {(expandedSection === 'companies' || expandedSection === null) && (
                  <div className="p-5 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('زر [إضافة فرع جديد]:', 'Button [New Branch]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('إنشاء فرع إقليمي جديد للشركة مع تحديد عنوانه، رقم جواله، ورقمه الضريبي الخاص.', 'Registers new physical branch under the enterprise with address and tax info.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('زر [إضافة مستودع]:', 'Button [New Warehouse]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('تأسيس مستودع أو مخزن بضائع وتعيينه لفرع معين وأمين مستودع مسؤول.', 'Sets up inventory storage facility attached to specific branch and custodian.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 md:col-span-2 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200">
                        <span className="font-bold text-emerald-800 dark:text-emerald-400 block mb-1">{t('شريط وزر [خزينة الأرشيف الآمن - Archive Vault]:', 'Bar & Button [Safe Archive Vault]:')}</span>
                        <p className="text-slate-700 dark:text-slate-300">{t('شريط بارز في أعلى شاشة الشركات ينقلك مباشرة لخزينة الأرشيف. يمكنك من خلالها استعراض أي فرع أو مستودع أو شركة تم حذفها، واستعادتها فوراً بضغطة زر واحدة بكامل حركاتها التاريخية.', 'Prominent banner giving instant access to the Soft-Delete vault to inspect and restore archived branches and warehouses.')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Screen 4: Users & Roles */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand('users')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 text-start hover:bg-slate-100 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        {t('4. شاشة المستخدمين وتحديد الصلاحيات', '4. Users, Roles & Security Permissions')}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t('إضافة الموظفين، تغيير كلمات المرور، ونافذة حذف المستخدم الآمنة', 'User provisioning, password management, and safe deletion modal')}
                      </p>
                    </div>
                  </div>
                  {expandedSection === 'users' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {(expandedSection === 'users' || expandedSection === null) && (
                  <div className="p-5 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('زر [مستخدم جديد]:', 'Button [New User]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('إضافة حساب موظف جديد وتحديد اسم الدخول، كلمة المرور، والدور الوظيفي (Admin, Manager, Accountant, Cashier, Reception, Doctor, Storekeeper).', 'Creates staff account with credentials and assigns RBAC role.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-indigo-600 block mb-1">{t('زر [تعديل الصلاحيات والمستخدم]:', 'Button [Edit User & Roles]:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('إعادة تعيين كلمة مرور الموظف أو ترقيته أو تغيير دوره وصلاحياته على الفروع.', 'Updates user password, branch assignments, or operational permissions.')}</p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 md:col-span-2">
                        <span className="font-bold text-rose-600 block mb-1">{t('نافذة تأكيد حذف المستخدم المخصصة:', 'Safe User Deletion Modal & Feedback:')}</span>
                        <p className="text-slate-600 dark:text-slate-400">{t('عند الضغط على أيقونة الحذف، تفتح نافذة تأكيد داخلية تعرض اسم الموظف واسم دخوله وصلاحياته. وعند تأكيد الحذف النهائي، يُلغى الحساب فوراً ويظهر شريط إشعار نجاح عائم ويوثق في سجل الرقابة.', 'Replaced browser alerts with in-app confirmation modal showing username, role, and permanent audit entry.')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WORKFLOWS & POSTINGS */}
      {activeTab === 'workflows' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('دورات العمل والترحيل المحاسبي والمخزني التلقائي', 'End-to-End Business Workflows & Automated Postings')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('كيف تتحرك المعاملات آلياً بين شاشات الكاشير، أذونات المخازن، ودفتر الأستاذ العام', 'How business transactions flow automatically into double-entry ledger entries and stock levels')}
                </p>
              </div>
            </div>

            {/* Workflow 1: POS Sales posting */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                <ShoppingCart className="w-4 h-4" />
                <span>{t('دورة المبيعات وفاتورة الكاشير السريعة (POS Sales & Cashier Flow)', '1. POS Sales & Cashier Posting Cycle')}</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-white">{t('خطوات الحركة والتأثير التلقائي:', 'Automated Lifecycle:')}</p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-600 dark:text-slate-400">
                  <li>{t('فتح الوردية: الكاشير يدخل عهدة نقدية (Opening Float) -> يسجل النظام شيفت كاشير جديد بحالة مفتوح.', 'Shift Start: Cashier registers opening float; system records an Open Shift.')}</li>
                  <li>{t('بناء السلة: مسح الأصناف والخدمات واحتساب ضريبة القيمة المضافة (15% VAT) تلقائياً.', 'Cart Scanning: System computes discounts, subtotal, and 15% VAT.')}</li>
                  <li>{t('السداد وتوليد الفاتورة: عند الضغط على تأكيد الدفع تحدث 3 عمليات تلقائية فورية دون تدخل يدوي:', 'Payment & Posting: Triggering payment automatically executes 3 synchronous operations:')}</li>
                </ol>
                <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-[11px] space-y-1">
                  <p className="text-emerald-600 font-bold">{t('الترحيل المحاسبي المزدوج الآلي للفاتورة:', 'Automated Double-Entry Journal Entry:')}</p>
                  <p>{t('من حـ/ الخزينة أو البنك أو حساب العميل (مدين بإجمالي الفاتورة)', 'DEBIT: Cash / Bank or Accounts Receivable (Gross Total)')}</p>
                  <p className="text-indigo-600 rtl:pr-4 ltr:pl-4">{t('إلى حـ/ إيرادات المبيعات والخدمات (دائن بالصافي قبل الضريبة)', 'CREDIT: Sales Revenue (Net Before Tax)')}</p>
                  <p className="text-indigo-600 rtl:pr-4 ltr:pl-4">{t('إلى حـ/ ضريبة القيمة المضافة المستحقة (دائن بضريبة الـ 15%)', 'CREDIT: Output VAT Payable (15% Tax)')}</p>
                  <p className="text-slate-500 pt-1">{t('التأثير المخزني: يخصم رصيد المنتجات المباعة فوراً من المستودع المعين للفرع.', 'Stock Impact: Inventory balance decremented immediately in real time.')}</p>
                </div>
              </div>
            </div>

            {/* Workflow 2: Goods Receipt */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <Boxes className="w-4 h-4" />
                <span>{t('دورة المشتريات والتوريد المخزني (Goods Receipt Notes - GRN)', '2. Goods Receipt & Purchasing Cycle')}</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-white">{t('خطوات الحركة والتأثير التلقائي:', 'Automated Lifecycle:')}</p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-600 dark:text-slate-400">
                  <li>{t('يقوم أمين المخزن بفتح شاشة أذونات الاستلام المخزني وإدخال البضاعة الواردة من المورد.', 'Storekeeper enters GRN selecting supplier, target warehouse, and incoming quantities.')}</li>
                  <li>{t('عند الضغط على [اعتماد وترحيل إذن الاستلام]:', 'Upon clicking [Approve & Post GRN]:')}</li>
                </ol>
                <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-[11px] space-y-1">
                  <p className="text-emerald-600 font-bold">{t('الترحيل المحاسبي والمخزني:', 'Automated Accounting & Stock Posting:')}</p>
                  <p>{t('من حـ/ أصول المخزون السلعي (مدين بقيمة البضاعة الواردة)', 'DEBIT: Inventory Asset Account')}</p>
                  <p className="text-indigo-600 rtl:pr-4 ltr:pl-4">{t('إلى حـ/ حسابات الموردين أو البنك (دائن بقيمة التوريد)', 'CREDIT: Accounts Payable (Vendor) or Bank')}</p>
                  <p className="text-slate-500 pt-1">{t('التأثير المخزني: يرتفع رصيد الأصناف في المستودع فوراً ويتحدث متوسط التكلفة.', 'Stock Impact: Product stock levels increase instantly with weighted average cost updated.')}</p>
                </div>
              </div>
            </div>

            {/* Workflow 3: Stocktake Adjustments */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                <Sliders className="w-4 h-4" />
                <span>{t('دورة الجرد الفعلي وتسوية الفروقات المخزنية (Stocktake & Variance Posting)', '3. Physical Stocktake & Variance Postings')}</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-white">{t('خطوات الحركة والتأثير التلقائي:', 'Automated Lifecycle:')}</p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-600 dark:text-slate-400">
                  <li>{t('بدء جلسة الجرد وإدخال الكميات المعدودة فعلياً على الأرفف.', 'Open stocktake session and input physical shelf counts.')}</li>
                  <li>{t('يقوم النظام آلياً باحتساب الفرق بين الدفتري والفعلي وإظهار العجز أو الزيادة.', 'System compares ledger stock vs counted stock to calculate deficit or surplus.')}</li>
                  <li>{t('عند اعتماد محضر التسوية:', 'Upon clicking [Approve Stocktake Adjustment]:')}</li>
                </ol>
                <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-[11px] space-y-1">
                  <p className="text-amber-600 font-bold">{t('الترحيل في حالة العجز المخزني (Shortage / Loss):', 'Journal Entry for Deficit:')}</p>
                  <p>{t('من حـ/ خسائر فروقات الجرد وعجز المخزون (مدين) -> إلى حـ/ بضاعة المخزون (دائن)', 'DEBIT: Inventory Variance Loss | CREDIT: Inventory Asset')}</p>
                  <p className="text-emerald-600 font-bold pt-1">{t('الترحيل في حالة الزيادة المخزنية (Surplus / Gain):', 'Journal Entry for Surplus:')}</p>
                  <p>{t('من حـ/ بضاعة المخزون (مدين) -> إلى حـ/ أرباح تسويات الجرد (دائن)', 'DEBIT: Inventory Asset | CREDIT: Inventory Variance Gain')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('مصفوفة الصلاحيات والأمان وحوكمة النظام (RBAC Matrix)', 'Role-Based Access Control & Security Matrix')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('توزيع الصلاحيات وفصل المهام المحاسبية والتشغيلية وفق المعايير الرقابية الصارمة', 'Segregation of duties across 8 enterprise role definitions')}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">{t('الموديول / الشاشة', 'Module / Screen')}</th>
                    <th className="p-3 text-center text-indigo-600">Admin</th>
                    <th className="p-3 text-center">Manager</th>
                    <th className="p-3 text-center">Accountant</th>
                    <th className="p-3 text-center">Cashier</th>
                    <th className="p-3 text-center">Reception</th>
                    <th className="p-3 text-center">Storekeeper</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{t('لوحة التحكم والتحليلات', 'Dashboard')}</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-indigo-600">مالي فقط</td>
                    <td className="p-3 text-center text-slate-400">محدودة</td>
                    <td className="p-3 text-center text-slate-400">تشغيلي</td>
                    <td className="p-3 text-center text-slate-400">مخزني</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{t('نقطة البيع السريعة POS', 'Point of Sale')}</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-indigo-600">إشراف</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">بيع كامل</td>
                    <td className="p-3 text-center text-slate-400">عرض فقط</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{t('أذونات المخازن والجرد', 'Warehouse & Stock')}</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-indigo-600">مطابقة</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{t('الحسابات ودفتر الأستاذ', 'Accounting & Ledger')}</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-slate-400">عرض فرعه</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{t('إدارة الشركات والفروع والأرشيف', 'Companies & Archive')}</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-slate-400">فرعه فقط</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{t('المستخدمين والصلاحيات والنيون', 'Users & Neon Hub')}</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">كاملة</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                    <td className="p-3 text-center text-rose-500">محظور</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TROUBLESHOOTING & FAQS */}
      {activeTab === 'faq' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('الأسئلة الشائعة واستكشاف الأخطاء وإصلاحها', 'Troubleshooting & Frequently Asked Questions')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('إجابات وحلول سريعة لأكثر المواقف اليومية شيوعاً أثناء العمل', 'Direct solutions to common operational scenarios')}
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm block">
                  {t('س1: انقطع الإنترنت فجأة أثناء وقوف العميل أمام الكاشير، ماذا أفعل؟', 'Q1: What happens if internet goes down while checking out a customer?')}
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(
                    'ج: استمر في عملك بشكل طبيعي تماماً! المنصة مزودة بخاصية العمل المحلي بدون إنترنت (Offline Local Fallback). سيتم حفظ الفاتورة وطباعتها للعميل وتحديث الرصيد محلياً، وعند عودة الإنترنت يمكنك مزامنة كافة الفواتير بضغطة زر واحدة من شاشة نيون.',
                    'A: Continue business without interruption! The system runs on offline-first local state caching. Sales are printed locally and sync seamlessly to the cloud once connection is restored.'
                  )}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm block">
                  {t('س2: حذفت فرعاً أو مستودعاً بالخطأ، كيف أستعيده فوراً؟', 'Q2: How do I restore an accidentally deleted branch or warehouse?')}
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(
                    'ج: ادخل على شاشة "إدارة الشركات والفروع"، واضغط على زر "خزينة الأرشيف الآمن" في الشريط العلوي البارز. ستجد الفرع أو المستودع المحذوف مع تاريخ وتوقيت حذفه، اضغط على زر [استعادة] الأخضر ليعود فوراً إلى العمل بكامل تاريخه وسجلاته.',
                    'A: Open "Companies & Branches", click the prominent "Archive Vault" top bar button, find your item, and click [Restore] to immediately reactivate the entity without data loss.'
                  )}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm block">
                  {t('س3: كيف أضبط تنبيه نقص المخزون لصنف معين لتفادي نفاد الرصيد؟', 'Q3: How do I adjust the minimum stock alert threshold for an item?')}
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(
                    'ج: من شاشة "إدارة المنتجات والخدمات"، ابحث عن الصنف وفي عمود المخزون اضغط على زر [ضبط حد الطلب] أو مؤشر "/ حد X". اختر الرقم المطلوب (مثل: 5 أو 10 وحدات) واضغط حفظ. سيقوم النظام تلقائياً بإظهار تنبيه فور وصول رصيده الفعلي لهذا الحد.',
                    'A: In "Products & Services", click [Set Reorder] in the stock column, choose your desired minimum count (e.g., 5 or 10 units), and save. The automated alert will trigger immediately when stock drops to that level.'
                  )}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm block">
                  {t('س4: كيف أحذف مستخدماً أو موظفاً غادر المنشأة؟', 'Q4: How do I delete a former employee user account?')}
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(
                    'ج: من شاشة "المستخدمين والصلاحيات"، اضغط على أيقونة سلة المهملات الحمراء بجانب المستخدم. ستظهر لك نافذة تأكيد آمنة تعرض اسمه ودوره، اضغط على [تأكيد الحذف النهائي]، وسيتم إلغاء الحساب فوراً وإظهار إشعار تأكيد وتوثيق الحركة في سجل الرقابة.',
                    'A: In "Users & Roles", click the red trash icon on the user row, verify user details in the in-app confirmation modal, and click [Confirm Delete].'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Signature Card */}
      <div className="p-6 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-base">
            ERP
          </div>
          <div>
            <h4 className="font-bold text-sm">Universal Business & Clinic Platform</h4>
            <p className="text-xs text-slate-400">
              {t('منصة موحدة لإدارة الشركات والمراكز والعيادات ونقاط البيع السريعة', 'Universal Enterprise ERP & Clinical Management System')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadWord}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('تحميل ملف الوورد (.docx)', 'Download Word (.docx)')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
