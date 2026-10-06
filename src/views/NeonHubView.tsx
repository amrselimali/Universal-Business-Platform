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
  FileSpreadsheet,
  Download,
  X,
} from 'lucide-react';
import { exportDatabaseToMultiSheetExcel } from '../utils/fullDatabaseExcelBackup';

export const NeonHubView: React.FC = () => {
  const {
    t,
    tenant,
    neonDb,
    updateNeonConnectionString,
    testNeonConnection,
    syncAllToNeon,
    fixNeonSchema,
    runNeonMigrations,
    fetchRemoteCounts,
    getPostgresSchemaSql,
    pullLatestFromNeon,
    branches,
    allBranches,
    warehouses,
    allWarehouses,
    users,
    allUsers,
    parties,
    allParties,
    products,
    allProducts,
    stockLevels,
    stockMovements,
    allStockMovements,
    accounts,
    allAccounts,
    journalEntries,
    allJournals,
    invoices,
    allInvoices,
    cashReceipts,
    allCashReceipts,
    cashPayments,
    allCashPayments,
    goodsReceipts,
    allGoodsReceipts,
    goodsIssues,
    allGoodsIssues,
    receptionShifts,
    allReceptionShifts,
    attendanceRecords,
    allAttendanceRecords,
    staffMembers,
    allStaffMembers,
    appointments,
    allAppointments,
    patientFollowUps,
    allPatientFollowUps,
    paymentMethods,
    allPaymentMethods,
    laserDevices,
    allLaserDevices,
    patients,
  } = usePlatform();

  const [copied, setCopied] = useState<boolean>(false);
  const [inputConn, setInputConn] = useState<string>(neonDb.connectionString);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; message?: string; success?: boolean }>({
    loading: false,
  });
  const [remoteCounts, setRemoteCounts] = useState<{ [key: string]: number } | null>(null);
  const [checkingCounts, setCheckingCounts] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);

  const handleBackupToExcel = () => {
    setIsExportingExcel(true);
    setBackupFeedback(null);
    try {
      const res = exportDatabaseToMultiSheetExcel({
        tenantName: tenant?.nameAr || 'المؤسسة الطبية',
        branches: allBranches || branches,
        warehouses: allWarehouses || warehouses,
        users: allUsers || users,
        parties: allParties || parties,
        products: allProducts || products,
        stockLevels: stockLevels,
        stockMovements: allStockMovements || stockMovements,
        accounts: allAccounts || accounts,
        journalEntries: allJournals || journalEntries,
        invoices: allInvoices || invoices,
        cashReceipts: allCashReceipts || cashReceipts,
        cashPayments: allCashPayments || cashPayments,
        goodsReceipts: allGoodsReceipts || goodsReceipts,
        goodsIssues: allGoodsIssues || goodsIssues,
        receptionShifts: allReceptionShifts || receptionShifts,
        attendanceRecords: allAttendanceRecords || attendanceRecords,
        staffMembers: allStaffMembers || staffMembers,
        appointments: allAppointments || appointments,
        patientFollowUps: allPatientFollowUps || patientFollowUps,
        paymentMethods: allPaymentMethods || paymentMethods,
        laserDevices: allLaserDevices || laserDevices,
      });

      if (res.success) {
        setBackupFeedback(t(`تم تصدير النسخة الاحتياطية بنجاح إلى ملف: ${res.filename} (يحتوي على 24 جدول منفصل تشمل الحجوزات والمتابعات)`, `Database backup exported successfully to: ${res.filename} with 24 separate sheets including bookings and follow-ups!`));
      } else {
        setBackupFeedback(t('فشل في تصدير النسخة الاحتياطية: ' + res.filename, 'Failed to export backup: ' + res.filename));
      }
    } catch (err: any) {
      setBackupFeedback(t('حدث خطأ أثناء النسخ الاحتياطي: ' + err.message, 'Error: ' + err.message));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(getPostgresSchemaSql());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    setTestResult(null);
    updateNeonConnectionString(inputConn);
    const ok = await testNeonConnection(inputConn);
    if (ok) {
      setTestResult(t('تم التحقق والاتصال بقاعدة بيانات Neon السحابية بنجاح 100%! 🚀', 'Connected to Neon Cloud PostgreSQL successfully! 🚀'));
      handleCheckRemoteCounts();
    } else {
      setTestResult(t('فشل الاتصال: تأكد من رابط Neon السحابي (يبدأ بـ postgresql:// أو postgres://)', 'Failed: Ensure a valid postgresql:// or postgres:// Neon URL'));
    }
  };

  const handleCheckRemoteCounts = async () => {
    setCheckingCounts(true);
    const counts = await fetchRemoteCounts();
    setRemoteCounts(counts);
    setCheckingCounts(false);
  };

  const handleFixSchema = async () => {
    if (window.confirm(t('هل تريد تهيئة وتنظيف الجداول في Neon وإزالة أي تعارضات سابقة مع الـ UUID؟', 'Do you want to reset and prepare clean Neon tables without UUID conflicts?'))) {
      setSyncStatus({ loading: true });
      const res = await fixNeonSchema();
      setSyncStatus({ loading: false, message: res.message, success: res.success });
      if (res.success) {
        // Automatically run sync after fix
        setTimeout(() => handleSyncAll(), 500);
      }
    }
  };

  const handleSyncAll = async () => {
    setSyncStatus({ loading: true });
    const res = await syncAllToNeon();
    setSyncStatus({ loading: false, message: res.message, success: res.success });
    if (res.success) {
      handleCheckRemoteCounts();
    }
  };

  const tables = [
    { name: 'tenants', descAr: 'عزل بيانات الشركات والاشتراكات والضرائب', count: 1 },
    { name: 'branches', descAr: 'الفروع ومواقع العمل الإدارية', count: 2 },
    { name: 'warehouses', descAr: 'مخازن البضائع والمستلزمات', count: 2 },
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Requested Backup to Excel Button */}
          <button
            onClick={handleBackupToExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title={t('نسخ احتياطي شامل لجميع جداول قاعدة البيانات في ملف إكسل واحد', 'Backup all database tables to a single multi-sheet Excel file')}
          >
            <Download className="h-4 w-4" />
            <FileSpreadsheet className="h-4 w-4" />
            <span>{isExportingExcel ? t('جاري إنشاء النسخة الاحتياطية...', 'Creating Backup...') : t('نسخة احتياطية (إكسل شامل)', 'Backup to Excel')}</span>
          </button>

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

      {/* Backup Success Feedback Banner */}
      {backupFeedback && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{backupFeedback}</span>
          </div>
          <button onClick={() => setBackupFeedback(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* Real Live Database Push & Sync Action Card */}
      <div className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-5 shadow-xs dark:border-cyan-900/50 dark:from-cyan-950/20 dark:to-blue-950/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-600" />
              <span>{t('مزامنة ورفع البيانات الحالية إلى Neon فوراً', 'Sync & Push Live Data to Neon Cloud')}</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
              {t(
                'اضغط هنا لرفع كافة الأصناف، شجرة الحسابات، فواتير المبيعات، وبيانات المرضى الحالية مباشرة إلى جداول Neon السحابية. بعد الضغط، ستجد الجداول في موقع Neon ممتلئة بالبيانات فوراً!',
                'Click here to upload all current products, accounts, invoices, and patients to your Neon PostgreSQL tables. They will immediately show up in Neon Tables!'
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              disabled={syncStatus.loading || !neonDb.connectionString}
              onClick={handleSyncAll}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${syncStatus.loading ? 'animate-spin' : ''}`} />
              <span>
                {syncStatus.loading
                  ? t('جاري رفع السجلات إلى السحاب...', 'Uploading to Neon...')
                  : t('🚀 رفع ومزامنة كافة البيانات إلى Neon الآن', 'Push All Records to Neon Now')}
              </span>
            </button>

            <button
              disabled={checkingCounts || !neonDb.connectionString}
              onClick={handleCheckRemoteCounts}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-300 bg-white px-3.5 py-3 text-xs font-bold text-cyan-800 shadow-xs hover:bg-cyan-50 dark:border-cyan-800 dark:bg-slate-900 dark:text-cyan-300 cursor-pointer transition-colors"
              title="فحص السجلات الموجودة في Neon مباشرة"
            >
              <Database className={`h-3.5 w-3.5 ${checkingCounts ? 'animate-spin' : ''}`} />
              <span>{checkingCounts ? '...' : t('فحص السحاب', 'Check Neon Cloud')}</span>
            </button>

            <button
              disabled={syncStatus.loading || !neonDb.connectionString}
              onClick={async () => {
                setSyncStatus({ loading: true });
                const ok = await pullLatestFromNeon();
                setSyncStatus({
                  loading: false,
                  success: ok,
                  message: ok
                    ? t('تم تنزيل وتحديث أحدث البيانات بنجاح من قاعدة بيانات Neon!', 'Data refreshed successfully from Neon!')
                    : t('تعذر جلب البيانات من Neon', 'Failed to pull data'),
                });
                if (ok) handleCheckRemoteCounts();
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-3 text-xs font-bold text-sky-800 shadow-xs hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 cursor-pointer transition-colors"
              title="تنزيل أحدث البيانات من سحابة Neon إلى شاشات البرنامج"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncStatus.loading ? 'animate-spin' : ''}`} />
              <span>{t('جلب من Neon', 'Pull from Neon')}</span>
            </button>

            <button
              disabled={syncStatus.loading || !neonDb.connectionString}
              onClick={async () => {
                setSyncStatus({ loading: true });
                const res = await runNeonMigrations();
                setSyncStatus({ loading: false, message: res.message, success: res.success });
                if (res.success) handleCheckRemoteCounts();
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-3 text-xs font-bold text-emerald-800 shadow-xs hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer transition-colors"
              title="تحديث وترحيل هيكل الجداول في Neon لإضافة الأعمدة الجديدة دون مساس بالبيانات"
            >
              <Database className="h-3.5 w-3.5 text-emerald-600" />
              <span>{t('ترحيل وتحديث الهيكل (Safe Migration)', 'Run Safe Migration')}</span>
            </button>

            <button
              disabled={syncStatus.loading || !neonDb.connectionString}
              onClick={handleFixSchema}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-xs font-bold text-amber-800 shadow-xs hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer transition-colors"
              title="اضغط هنا إذا كانت الجداول في Neon فارغة أو تعطي أخطاء UUID سابقة"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>{t('تنظيف وتهيئة الجداول (Fix Schema)', 'Fix Schema')}</span>
            </button>
          </div>
        </div>

        {remoteCounts && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white/80 p-3 text-xs dark:bg-slate-900/80 border border-cyan-100 dark:border-cyan-900/50">
            <span className="font-bold text-slate-700 dark:text-slate-200">{t('السجلات الحقيقية في سحابة Neon الآن:', 'Real Records in Neon Cloud Right Now:')}</span>
            <span className="rounded-md bg-cyan-100 px-2 py-0.5 font-black text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300">
              {t('المنتجات:', 'Products:')} {remoteCounts['products'] ?? 0}
            </span>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 font-black text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
              {t('الحسابات:', 'Accounts:')} {remoteCounts['accounts'] ?? 0}
            </span>
            <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-black text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
              {t('الفواتير:', 'Invoices:')} {remoteCounts['sales_invoices'] ?? 0}
            </span>
            <span className="rounded-md bg-purple-100 px-2 py-0.5 font-black text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
              {t('المرضى:', 'Patients:')} {remoteCounts['patients'] ?? 0}
            </span>
          </div>
        )}

        {syncStatus.message && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              syncStatus.success
                ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-rose-100/80 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
            }`}
          >
            {syncStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{syncStatus.message}</span>
          </div>
        )}
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
