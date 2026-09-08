import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Server,
  Layers,
  Sparkles,
} from 'lucide-react';

export const NeonHubView: React.FC = () => {
  const {
    t,
    neonDb,
    updateNeonConnectionString,
    testNeonConnection,
    getPostgresSchemaSql,
    products,
    accounts,
    invoices,
    patients,
  } = usePlatform();

  const [copied, setCopied] = useState<boolean>(false);
  const [inputConn, setInputConn] = useState<string>(neonDb.connectionString);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleCopySql = () => {
    navigator.clipboard.writeText(getPostgresSchemaSql());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    setTestResult(null);
    updateNeonConnectionString(inputConn);
    const ok = await testNeonConnection();
    if (ok) {
      setTestResult(t('تم اختبار الرابط والاتصال السحابي بنجاح 100%!', 'Connection verified successfully!'));
    } else {
      setTestResult(t('فشل الاتصال: تأكد من رابط Neon السحابي (يبدأ بـ postgres://)', 'Failed: Ensure a valid postgres:// Neon URL'));
    }
  };

  const tables = [
    { name: 'tenants', descAr: 'عزل بيانات الشركات والاشتراكات والضرائب', count: 1 },
    { name: 'branches', descAr: 'الفروع ومواقع العمل الإدارية', count: 2 },
    { name: 'warehouses', descAr: 'المستودعات ومخازن البضائع', count: 2 },
    { name: 'products', descAr: 'دليل الأصناف والخدمات الطبية والتسعير', count: products.length },
    { name: 'stock_levels', descAr: 'أرصدة الأصناف بكل مخزن بدقة', count: products.length * 2 },
    { name: 'accounts', descAr: 'شجرة الحسابات العامة (Chart of Accounts)', count: accounts.length },
    { name: 'journal_entries', descAr: 'دفتر اليومية العامة والقيود المتوازنة', count: invoices.length + 1 },
    { name: 'sales_invoices', descAr: 'فواتير المبيعات ونقاط البيع السريعة', count: invoices.length },
    { name: 'patients', descAr: 'الملفات الطبية للمرضى والتاريخ الصحي', count: patients.length },
    { name: 'appointments', descAr: 'مواعيد الأطباء وحجوزات الكشوفات', count: 2 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span>{t('مركز إدارة قاعدة بيانات Neon PostgreSQL السحابية', 'Neon PostgreSQL Integration Hub')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'الربط مع خادم PostgreSQL السحابي المجاني، تفعيل الـ Schemas، وتطبيق عزل الشركات (RLS).',
              'Manage your zero-cost Neon PostgreSQL connection, DDL migrations and RLS policies.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://console.neon.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition-colors"
          >
            <span>Neon Console</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Connection Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t('سلسلة الاتصال بقاعدة بيانات Neon الخاصة بك (Connection String):', 'Your Neon Connection String:')}
            </h3>
          </div>

          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
              neonDb.connected
                ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
            }`}
          >
            {neonDb.connected ? t('متصل بالسحابة (Online)', 'Cloud Active') : t('الوضع المحلي السريع (Local)', 'Local In-Memory Mode')}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={inputConn}
            onChange={(e) => setInputConn(e.target.value)}
            placeholder="postgres://user:pass@ep-cool-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require"
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-900 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

          <button
            disabled={neonDb.isSyncing}
            onClick={handleTest}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${neonDb.isSyncing ? 'animate-spin' : ''}`} />
            <span>{neonDb.isSyncing ? t('جاري التحقق...', 'Verifying...') : t('اختبار وحفظ الرابط', 'Test & Save')}</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              neonDb.connected
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
            }`}
          >
            {neonDb.connected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{testResult}</span>
          </div>
        )}

        <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 space-y-1">
          <p className="font-bold text-slate-700 dark:text-slate-300">
            {t('💡 ملاحظة تكلفة التشغيل $0:', '💡 0$ Cost Free Tier Note:')}
          </p>
          <p>
            {t(
              'حساب Neon المجاني يمنحك 0.5 GB تكفي لملايين السجلات والمعاملات. النظام الحالي يحفظ كافة التحديثات فوراً محلياً وسحابياً.',
              'Neon free tier offers 0.5 GB which is sufficient for thousands of invoices and GL entries without paying any server fee.'
            )}
          </p>
        </div>
      </div>

      {/* Tables & Schema Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schema SQL Script Viewer & 1-Click Copy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {t('سكريبت الجداول وقواعد RLS (DDL Migration SQL):', 'PostgreSQL DDL Migration SQL:')}
                </h3>
              </div>

              <button
                onClick={handleCopySql}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? t('تم النسخ بالحافظة!', 'Copied!') : t('نسخ الكود بالكامل', 'Copy SQL')}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-3">
              {t(
                'يمكنك نسخ هذا الكود ولصقه في تبويب SQL Editor داخل Neon Console لتجهيز الجداول تلقائياً بضغطة زر واحدة.',
                'Copy and paste this DDL script directly into Neon Console SQL Editor to create all schema tables in 2 seconds.'
              )}
            </p>

            <pre className="h-72 overflow-y-auto rounded-xl bg-slate-900 p-4 font-mono text-[10px] text-slate-300 leading-relaxed dark:bg-slate-950">
              {getPostgresSchemaSql()}
            </pre>
          </div>
        </div>

        {/* Database Tables Inventory */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t('جداول قاعدة البيانات المُهيئة (Database Tables):', 'Database Entities Status:')}
            </h3>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {tables.length} {t('جداول أساسية', 'Tables')}
            </span>
          </div>

          <div className="overflow-y-auto max-h-80 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {tables.map((table) => (
              <div key={table.name} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{table.name}</span>
                  <p className="text-[11px] text-slate-500">{table.descAr}</p>
                </div>
                <div className="text-end">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {table.count} {t('سجلات', 'records')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
