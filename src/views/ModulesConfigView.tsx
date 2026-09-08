import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  SlidersHorizontal,
  Check,
  Shield,
  Users,
  Package,
  ShoppingCart,
  Truck,
  Calculator,
  CreditCard,
  UserCheck,
  Calendar,
  Factory,
  Cpu,
  Stethoscope,
  FileText,
  BarChart3,
  Database,
  Sparkles,
  Layers,
  Wand2,
} from 'lucide-react';

export const ModulesConfigView: React.FC = () => {
  const { t, tenant, setTenant, allModules, toggleModule, isModuleActive, language } = usePlatform();

  const iconMap: Record<string, any> = {
    Shield,
    Users,
    Package,
    ShoppingCart,
    Truck,
    Calculator,
    CreditCard,
    UserCheck,
    Calendar,
    Factory,
    Cpu,
    Stethoscope,
    FileText,
    BarChart3,
    Database,
  };

  // Presets
  const applyPreset = (presetName: string, moduleIds: string[]) => {
    setTenant((prev) => ({
      ...prev,
      activeModules: moduleIds,
    }));
    alert(`${t('تم تفعيل قالب:', 'Applied Preset:')} ${presetName}`);
  };

  const categories = [
    { id: 'Core', labelAr: 'الوحدات الهيكلية الأساسية (Core Systems)', labelEn: 'Core System Modules' },
    { id: 'Operations', labelAr: 'وحدات العمليات والتشغيل اليومي', labelEn: 'Operations & Workflow Modules' },
    { id: 'Specialized', labelAr: 'الموديولات التخصصية (عيادات / تصنيع)', labelEn: 'Specialized Activity Modules' },
    { id: 'Intelligence', labelAr: 'ذكاء الأعمال وقواعد البيانات', labelEn: 'BI & Database Integrations' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>{t('شاشة تخصيص وتفعيل الموديولات (15 Module)', 'Platform Modules Switcher')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'تحكّم كامل في تفعيل أو تعطيل أي نشاط أو موديول لكل شركة بنقرة واحدة، لتخصيص المنصة حسب رغبة العميل.',
              'Toggle any module on/off per tenant without touching core code. Configurable multi-activity platform.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300">
            {t('الموديولات المفعلة:', 'Active:')} {tenant.activeModules.length} / {allModules.length}
          </span>
        </div>
      </div>

      {/* Preset Quick Chooser */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            {t('قوالب الأنشطة السريعة الجاهزة (Industry Presets):', 'Quick Industry Presets:')}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() =>
              applyPreset(
                t('شركة تجارة وتوزيع وتجزئة', 'Retail & Wholesale Trading'),
                ['identity', 'parties', 'inventory', 'pos_sales', 'purchasing', 'accounting', 'cash_banking', 'reporting_bi', 'integrations_neon']
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-start hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-800 dark:bg-slate-800/40 transition-colors"
          >
            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
              {t('تجارة وتوزيع وتجزئة', 'Retail & Wholesale')}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {t('POS + مخازن + موردين + محاسبة', 'POS, Stock, Vendors, Accounting')}
            </p>
          </button>

          <button
            onClick={() =>
              applyPreset(
                t('مركز طبي وعيادات تأهيل', 'Clinics & Rehab Center'),
                ['identity', 'parties', 'pos_sales', 'accounting', 'appointments', 'clinics_records', 'services_catalog', 'reporting_bi', 'integrations_neon']
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-start hover:border-cyan-400 hover:bg-cyan-50/30 dark:border-slate-800 dark:bg-slate-800/40 transition-colors"
          >
            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
              {t('مراكز طبية وعيادات', 'Medical & Clinics')}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {t('ملفات مرضى + جلسات علاج + حجوزات', 'EHR, Sessions & Appointments')}
            </p>
          </button>

          <button
            onClick={() =>
              applyPreset(
                t('منشأة صناعية وتجميع', 'Manufacturing & Assembly'),
                ['identity', 'parties', 'inventory', 'purchasing', 'accounting', 'manufacturing_bom', 'production_orders', 'reporting_bi', 'integrations_neon']
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-start hover:border-amber-400 hover:bg-amber-50/30 dark:border-slate-800 dark:bg-slate-800/40 transition-colors"
          >
            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
              {t('تصنيع وإنتاج', 'Manufacturing')}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {t('مواد خام + BOM + أوامر تشغيل', 'Raw materials, BOM, Work Orders')}
            </p>
          </button>

          <button
            onClick={() =>
              applyPreset(
                t('تفعيل كافة الـ 15 موديول (النسخة الشاملة)', 'All 15 Modules Active'),
                allModules.map((m) => m.id)
              )
            }
            className="rounded-xl border border-indigo-300 bg-indigo-50/60 p-3 text-start hover:bg-indigo-100/60 dark:border-indigo-800 dark:bg-indigo-950/40 transition-colors"
          >
            <p className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
              {t('تفعيل الكل (المنظومة الكاملة)', 'Full Universal Suite')}
            </p>
            <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400 mt-1">
              {t('جميع الـ 15 موديول تعمل بالتوازي', 'All 15 modules active simultaneously')}
            </p>
          </button>
        </div>
      </div>

      {/* Modules Categorized Grid */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catModules = allModules.filter((m) => m.category === cat.id);
          if (catModules.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? cat.labelAr : cat.labelEn}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {catModules.map((mod) => {
                  const Icon = iconMap[mod.icon] || Layers;
                  const isActive = isModuleActive(mod.id);

                  return (
                    <div
                      key={mod.id}
                      className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                        isActive
                          ? 'border-indigo-200 bg-white shadow-xs dark:border-indigo-900/60 dark:bg-slate-900'
                          : 'border-slate-200/80 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                              isActive
                                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
                                : 'bg-slate-200 text-slate-400 dark:bg-slate-800'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          {/* Toggle Switch */}
                          <button
                            disabled={mod.required}
                            onClick={() => toggleModule(mod.id)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isActive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                            } ${mod.required ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                isActive ? (language === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {language === 'ar' ? mod.nameAr : mod.nameEn}
                          </h3>
                          {mod.required && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800">
                              {t('إلزامي بالـ Core', 'Core Base')}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {language === 'ar' ? mod.descriptionAr : mod.descriptionEn}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px]">
                        <span
                          className={`font-bold ${
                            isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {isActive ? t('مفعّل وشغال بالنظام', 'Enabled & Active') : t('معطّل', 'Disabled')}
                        </span>
                        <span className="font-mono text-slate-400">{mod.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
