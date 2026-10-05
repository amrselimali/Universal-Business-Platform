import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck,
  RefreshCw,
  Info,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

export interface ExcelColumnConfig {
  key: string;
  labelAr: string;
  labelEn: string;
  required?: boolean;
  type: 'text' | 'number' | 'date' | 'phone' | 'select';
  options?: string[];
  sampleValue: string | number;
  instructions: string;
}

export interface CellValidationError {
  rowNumber: number;
  columnKey: string;
  columnLabelAr: string;
  enteredValue: any;
  reasonAr: string;
}

export interface ExcelValidationResult<T> {
  totalRows: number;
  errors: CellValidationError[];
  totalErrorsCount?: number;
  validRows: T[];
  allRowsAsIs?: T[];
  allRowsWithFallback?: T[];
  warnings?: string[];
}

interface ExcelDataTransferModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  entityTitleAr: string;
  entityTitleEn: string;
  descriptionAr: string;
  columns: ExcelColumnConfig[];
  currentDataForExport: any[];
  exportFileNamePrefix: string;
  validator: (
    rawRows: any[],
    onProgress?: (current: number, total: number, msg: string) => void
  ) => ExcelValidationResult<T> | Promise<ExcelValidationResult<T>>;
  onConfirmImport: (validRows: T[]) => Promise<boolean | void> | boolean | void;
  branchName?: string;
  extraExportColumns?: { [key: string]: (item: any) => any };
}

export function ExcelDataTransferModal<T>({
  isOpen,
  onClose,
  entityTitleAr,
  entityTitleEn,
  descriptionAr,
  columns,
  currentDataForExport,
  exportFileNamePrefix,
  validator,
  onConfirmImport,
  branchName,
}: ExcelDataTransferModalProps<T>) {
  const [activeTab, setActiveTab] = useState<'import' | 'template' | 'export'>('import');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ExcelValidationResult<T> | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('جاري قراءة وتحليل ملف الإكسيل...');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [forceUploadMode, setForceUploadMode] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Download Blank/Sample Template
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Row 1: Arabic Headers
      // Row 2: English Headers
      // Row 3: Sample Row
      // Row 4: Column Instructions / Rules
      const headerRowAr: { [key: string]: any } = {};
      const sampleRow: { [key: string]: any } = {};
      const instructionsRow: { [key: string]: any } = {};

      columns.forEach((col) => {
        headerRowAr[col.labelAr] = col.sampleValue;
      });

      columns.forEach((col) => {
        sampleRow[col.labelAr] = col.sampleValue;
        instructionsRow[col.labelAr] = `[${col.required ? 'إلزامي *' : 'اختياري'}] ${col.instructions}`;
      });

      const templateData = [sampleRow, instructionsRow];
      const ws = XLSX.utils.json_to_sheet(templateData);

      // Set column widths
      ws['!cols'] = columns.map((col) => ({
        wch: Math.max(col.labelAr.length * 2, String(col.sampleValue).length, 22),
      }));

      XLSX.utils.book_append_sheet(wb, ws, 'قالب_البيانات');
      const fileName = `قالب_استيراد_${exportFileNamePrefix}_جاهز.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      alert('حدث خطأ أثناء تحميل القالب: ' + err.message);
    }
  };

  // 2. Export Current Filtered Records
  const handleExportCurrent = () => {
    try {
      const wb = XLSX.utils.book_new();
      const exportRows = currentDataForExport.map((item, index) => {
        const row: { [key: string]: any } = {
          'م': index + 1,
        };
        columns.forEach((col) => {
          row[col.labelAr] = item[col.key] !== undefined && item[col.key] !== null ? item[col.key] : '';
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(
        exportRows.length > 0 ? exportRows : [{ 'ملاحظة': 'لا توجد بيانات حالية للتصدير' }]
      );
      ws['!cols'] = columns.map((col) => ({
        wch: Math.max(col.labelAr.length * 2, 20),
      }));

      XLSX.utils.book_append_sheet(wb, ws, 'البيانات_الحالية');
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `تصدير_${exportFileNamePrefix}_${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      alert('حدث خطأ أثناء تصدير البيانات: ' + err.message);
    }
  };

  // 3. Handle File Upload & Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsProcessing(true);
    setProgressPercent(10);
    setProgressMsg('جاري قراءة واستخراج أوراق العمل من الملف...');
    setValidationResult(null);
    setImportSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      // Yield to let React paint the modal and progress UI immediately
      setTimeout(async () => {
        try {
          setProgressPercent(20);
          setProgressMsg('جاري قراءة وفك تشفير ملف الإكسيل...');
          await new Promise((resolve) => setTimeout(resolve, 0));

          const buffer = evt.target?.result as ArrayBuffer;
          const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
          const sheetName = wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });

          // Filter out instruction guide rows AND empty blank rows
          const cleanedRows = rawJson.filter((r) => {
            const values = Object.values(r);
            if (values.length === 0) return false;
            const firstVal = String(values[0] || '').trim();
            if (firstVal.startsWith('[إلزامي') || firstVal.startsWith('[اختياري') || firstVal.includes('قواعد التحقق')) {
              return false;
            }
            // Ignore completely blank rows (e.g. empty rows at end of Excel sheet)
            return values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
          });

          setProgressPercent(40);
          setProgressMsg(`تم استخراج ${cleanedRows.length.toLocaleString('ar-EG')} صف بياني نشط. جاري فحص ومطابقة البيانات...`);
          await new Promise((resolve) => setTimeout(resolve, 0));

          const onProg = (current: number, total: number, msg: string) => {
            const pct = Math.min(98, 40 + Math.round((current / (total || 1)) * 58));
            setProgressPercent(pct);
            setProgressMsg(msg);
          };

          const testResult = await Promise.resolve(validator(cleanedRows, onProg));
          setProgressPercent(100);
          setProgressMsg('اكتملت المطابقة والفحص بنجاح!');
          setValidationResult(testResult);
        } catch (err: any) {
          alert('فشل في قراءة ملف الإكسل: ' + err.message);
        } finally {
          setIsProcessing(false);
        }
      }, 60);
    };
    reader.readAsArrayBuffer(file);
  };

  // 4. Confirm Import with explicit rows and optional mode description
  const handleConfirmWithRows = async (rowsToSave: T[], labelMode?: string) => {
    if (!rowsToSave || rowsToSave.length === 0) {
      alert('لا توجد بيانات صالحة للاستيراد!');
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirmImport(rowsToSave);
      setImportSuccessMessage(
        `تم استيراد وحفظ ${rowsToSave.length.toLocaleString('ar-EG')} سجل بنجاح في قاعدة البيانات! ${
          labelMode ? `(${labelMode})` : ''
        }`
      );
      setTimeout(() => {
        onClose();
        // Reset modal state
        setSelectedFileName(null);
        setValidationResult(null);
        setImportSuccessMessage(null);
        setForceUploadMode(false);
        setIsConfirming(false);
      }, 1500);
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ البيانات: ' + err.message);
      setIsConfirming(false);
    }
  };

  const handleConfirm = async () => {
    if (!validationResult) return;
    const rowsToUse =
      (forceUploadMode && validationResult.allRowsAsIs && validationResult.allRowsAsIs.length > 0)
        ? validationResult.allRowsAsIs
        : (forceUploadMode && validationResult.allRowsWithFallback && validationResult.allRowsWithFallback.length > 0)
        ? validationResult.allRowsWithFallback
        : validationResult.validRows;
    await handleConfirmWithRows(rowsToUse, forceUploadMode ? 'الرفع الإجباري كما هي بأخطائها دون أي تعديل' : undefined);
  };

  const handleResetFile = () => {
    setSelectedFileName(null);
    setValidationResult(null);
    setForceUploadMode(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  مركز نقل وفحص البيانات (Excel): {entityTitleAr}
                </h2>
                {branchName && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    الفرع: {branchName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {descriptionAr} • {entityTitleEn}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>استيراد واختبار البيانات (Import & Test)</span>
          </button>

          <button
            onClick={() => setActiveTab('template')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'template'
                ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>تحميل فورم الإكسل الجاهز (Download Template)</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>تصدير البيانات الحالية (Export to Excel)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: IMPORT & TEST */}
          {activeTab === 'import' && (
            <div className="space-y-5">
              {/* Option to force upload regardless of errors */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        خيار الرفع وتجاوز الأخطاء (Force Upload / Ignore Errors)
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500 text-white">
                        أوبشن متاح
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      تفعيل هذا الخيار يتيح لك تأكيد الرفع فورياً وتجاوز أي أخطاء تظهر في خلايا الإكسيل دون إيقاف أو تعطيل العملية.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-auto">
                  <input
                    type="checkbox"
                    checked={forceUploadMode}
                    onChange={(e) => setForceUploadMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* File Upload Box */}
              {!selectedFileName ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-8 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-800/20 group space-y-3"
                >
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      اضغط لاختيار ملف الإكسيل أو اسحبه هنا
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      يدعم ملفات بصيغة (.xlsx, .xls, .csv). سيتم فحص واختبار جميع الخلايا بدقة قبل الرفع.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <span>تصفح الملف من جهازك</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{selectedFileName}</h4>
                      <p className="text-[11px] text-slate-500">
                        {isProcessing ? 'جاري فحص واختبار خلايا الملف...' : 'تم تحليل وفحص الملف بالكامل'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleResetFile}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    اختيار ملف آخر
                  </button>
                </div>
              )}

              {/* Processing Progress Bar & Spinner */}
              {isProcessing && (
                <div className="p-8 text-center space-y-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {progressMsg}
                    </p>
                    <div className="w-full max-w-md mx-auto bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full transition-all duration-200 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-mono text-emerald-600 font-bold">
                      {progressPercent}%
                    </p>
                  </div>
                </div>
              )}

              {/* Success Message Banner */}
              {importSuccessMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {/* VALIDATION RESULTS */}
              {validationResult && !isProcessing && (
                <div className="space-y-4">
                  {/* Case 1: ERRORS FOUND */}
                  {validationResult.errors.length > 0 ? (
                    <div className="space-y-3">
                      {(() => {
                        const displayErrorCount = validationResult.totalErrorsCount ?? validationResult.errors.length;
                        return (
                          <>
                            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-1">
                              <div className="flex items-center gap-2 font-black text-sm">
                                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                                <span>
                                  تم فحص الملف واكتشاف ({displayErrorCount.toLocaleString('ar-EG')}) خطأ في خلايا البيانات!
                                </span>
                              </div>
                              <p className="text-xs text-rose-700 dark:text-rose-300">
                                يرجى تصحيح الخلايا الموضحة بالجدول أدناه في ملف الإكسيل وإعادة رفعه، لضمان سلامة قاعدة البيانات وعدم حدوث تداخلات أو خلل في الترحيل.
                              </p>
                            </div>

                            {/* Error Table */}
                            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden shadow-xs">
                              <div className="bg-rose-100/70 dark:bg-rose-950/60 px-4 py-2.5 font-bold text-xs text-rose-900 dark:text-rose-200 flex items-center justify-between">
                                <span>جدول تفصيل الخلايا غير المتوافقة وسبب عدم التوافق:</span>
                                <span className="font-mono text-[11px]">{displayErrorCount.toLocaleString('ar-EG')} خلية معيبة</span>
                              </div>
                              <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-right text-xs">
                                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                      <th className="p-2.5 font-bold">رقم الصف بالإكسيل</th>
                                      <th className="p-2.5 font-bold">اسم الحقل / العمود</th>
                                      <th className="p-2.5 font-bold">القيمة الحالية بالخلية</th>
                                      <th className="p-2.5 font-bold text-rose-600">سبب عدم التوافق للتصحيح</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                    {validationResult.errors.slice(0, 100).map((err, idx) => (
                                      <tr key={idx} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20">
                                        <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-white">
                                          صف #{err.rowNumber}
                                        </td>
                                        <td className="p-2.5 font-bold text-slate-700 dark:text-slate-200">
                                          {err.columnLabelAr}
                                        </td>
                                        <td className="p-2.5 font-mono text-slate-500 bg-slate-50/50 dark:bg-slate-800/40 rounded">
                                          {String(err.enteredValue || '«فارغ»')}
                                        </td>
                                        <td className="p-2.5 text-rose-600 dark:text-rose-400 font-bold">
                                          {err.reasonAr}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {displayErrorCount > 100 && (
                                  <div className="p-2.5 text-center text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900">
                                    يتم عرض أول {Math.min(100, validationResult.errors.length)} خطأ لتسريع الواجهة بسلاسة من إجمالي ({displayErrorCount.toLocaleString('ar-EG')}) خطأ مكتشف في الملف.
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      {/* Force Upload Actions & Options Card */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 space-y-3.5 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-100">
                              خيارات استكمال الرفع أياً كانت الأخطاء (تجاوز الأخطاء)
                            </h4>
                            <p className="text-[11px] text-amber-900/80 dark:text-amber-300">
                              اختر الطريقة المفضلة لإتمام الرفع وحفظ البيانات في السيستم فورياً:
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Option 1: Import valid rows only */}
                          <button
                            type="button"
                            onClick={() => handleConfirmWithRows(validationResult.validRows, 'استيراد السجلات السليمة فقط')}
                            disabled={isConfirming || validationResult.validRows.length === 0}
                            className="flex flex-col text-right p-3.5 rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-900 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed group"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2 font-black text-xs text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>استيراد السجلات السليمة فقط</span>
                              </div>
                              <ArrowRight className="w-4 h-4 rtl:rotate-180 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1">
                              حفظ ({validationResult.validRows.length.toLocaleString('ar-EG')}) سجل سليم وتخطي الصفوف المعيبة
                            </span>
                          </button>

                          {/* Option 2: Force import all rows AS-IS without modifications */}
                          <button
                            type="button"
                            onClick={() => {
                              const rows = (validationResult.allRowsAsIs && validationResult.allRowsAsIs.length > 0)
                                ? validationResult.allRowsAsIs
                                : (validationResult.allRowsWithFallback && validationResult.allRowsWithFallback.length > 0)
                                ? validationResult.allRowsWithFallback
                                : validationResult.validRows;
                              handleConfirmWithRows(rows, 'الرفع الإجباري كما هي بأخطائها دون أي تعديل');
                            }}
                            disabled={isConfirming}
                            className="flex flex-col text-right p-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer shadow-md shadow-amber-600/25 disabled:opacity-40 disabled:cursor-not-allowed group"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2 font-black text-xs">
                                <Zap className="w-4 h-4 text-amber-200" />
                                <span>الرفع الإجباري للبيانات كما هي بأخطائها ({validationResult.totalRows.toLocaleString('ar-EG')} صف)</span>
                              </div>
                              <ArrowRight className="w-4 h-4 rtl:rotate-180 text-white group-hover:translate-x-1 transition-transform" />
                            </div>
                            <span className="text-[11px] font-medium text-amber-100 mt-1">
                              إدخال كافة البيانات في الجدول كما هي بالملف، والفارغ يظل فارغاً ودون استبدال أي شيء
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={handleDownloadTemplate}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-cyan-300 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-300 text-xs font-bold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل قالب الفورم النموذجي الصحيح للمقارنة</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Case 2: 100% VALID - NO ERRORS! */
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 space-y-2">
                        <div className="flex items-center gap-2 text-base font-black text-emerald-700 dark:text-emerald-400">
                          <ShieldCheck className="w-6 h-6 shrink-0" />
                          <span>لا يوجد أي أخطاء في البيانات!</span>
                        </div>
                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 leading-relaxed">
                          تم فحص جميع السجلات والخلايا ({validationResult.validRows.length} سجل) واختبار توافقها التام مع قواعد البيانات والشروط المحاسبية والإدارية. البيانات جاهزة للرفع النهائي الآن.
                        </p>
                      </div>

                      {/* Preview of Valid Records */}
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-between">
                          <span>معاينة السجلات المتوافقة قبل التأكيد (أول 5 صفوف):</span>
                          <span className="font-mono text-emerald-600 font-bold">
                            {validationResult.validRows.length} سجل جاهز للتسجيل
                          </span>
                        </div>
                        <div className="max-h-48 overflow-x-auto overflow-y-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400">
                              <tr>
                                <th className="p-2 font-bold">#</th>
                                {columns.slice(0, 5).map((col) => (
                                  <th key={col.key} className="p-2 font-bold">
                                    {col.labelAr}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {validationResult.validRows.slice(0, 5).map((row: any, i) => (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="p-2 font-mono text-slate-400">{i + 1}</td>
                                  {columns.slice(0, 5).map((col) => (
                                    <td key={col.key} className="p-2 text-slate-800 dark:text-slate-200 truncate max-w-xs">
                                      {String(row[col.key] || '-')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Final Confirm Button */}
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                            جاهز لإتمام الترحيل وحفظ {validationResult.validRows.length} سجل؟
                          </span>
                        </div>
                        <button
                          onClick={handleConfirm}
                          disabled={isConfirming}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isConfirming
                              ? 'جاري الترحيل والحفظ في قاعدة البيانات...'
                              : `تأكيد الرفع النهائي والحفظ في قاعدة البيانات (${validationResult.validRows.length} سجل)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOWNLOAD TEMPLATE */}
          {activeTab === 'template' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-cyan-950 dark:text-cyan-100 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-cyan-600" />
                    <span>تحميل فورم إكسل مجهز ومطابق لقواعد البيانات</span>
                  </h3>
                  <p className="text-xs text-cyan-800/80 dark:text-cyan-300 max-w-xl leading-relaxed">
                    ملف إكسل تم تصميمه خصيصاً مع أسماء الأعمدة الدقيقة وقيم نموذجية لملء البيانات القديمة بسهولة ورفعها دون أخطاء.
                  </p>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-md shadow-cyan-600/20 shrink-0 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل الفورم الجاهز (.xlsx)</span>
                </button>
              </div>

              {/* Columns Guide Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                  دليل الحقول وقواعد التحقق من الخلايا الخاصة بـ ({entityTitleAr}):
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 font-bold">اسم العمود في الإكسيل</th>
                        <th className="p-3 font-bold">الحالة</th>
                        <th className="p-3 font-bold">نوع البيانات المطلوب</th>
                        <th className="p-3 font-bold">قيمة نموذجية صحيحة</th>
                        <th className="p-3 font-bold">تعليمات وقواعد القبول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {columns.map((col, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{col.labelAr}</span>
                            <span className="text-[10px] text-slate-400 font-normal font-mono">({col.key})</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                col.required
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {col.required ? 'مطلوب إلزامي *' : 'اختياري'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {col.type === 'phone'
                              ? 'رقم هاتف (أرقام)'
                              : col.type === 'date'
                              ? 'تاريخ (YYYY-MM-DD)'
                              : col.type === 'number'
                              ? 'رقم مالي / كمي'
                              : 'نص'}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">
                            {String(col.sampleValue)}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {col.instructions}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT CURRENT DATA */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-2">
                    <Download className="w-5 h-5 text-indigo-600" />
                    <span>تصدير البيانات الحالية بالكامل إلى ملف إكسيل</span>
                  </h3>
                  <p className="text-xs text-indigo-800/80 dark:text-indigo-300">
                    عدد السجلات الحالية الجاهزة للتصدير: <strong className="font-mono">{currentDataForExport.length} سجل</strong>
                  </p>
                </div>
                <button
                  onClick={handleExportCurrent}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-600/20 shrink-0 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير السجلات الحالية (.xlsx)</span>
                </button>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>معلومات التصدير وعزل الفروع:</span>
                </p>
                <p>
                  يتم تصدير السجلات التي تم تصفيتها حالياً في الشاشة فقط والمطابقة للفرع المختار، مع الحفاظ على التواريخ، الأرقام والأسماء بدقة 100%.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            إغلاق
          </button>

          {activeTab === 'import' && validationResult && validationResult.errors.length === 0 && (
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isConfirming ? 'جاري الحفظ...' : 'تأكيد الرفع النهائي'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
