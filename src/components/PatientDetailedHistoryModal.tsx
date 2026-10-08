import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Calendar,
  MessageSquare,
  Plus,
  Phone,
  Stethoscope,
  GitBranch,
} from 'lucide-react';
import { Party, Appointment, PatientFollowUp, Branch } from '../types';

interface PatientDetailedHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientHistoryData: {
    patientId?: string;
    patientName?: string;
    patientPhone?: string;
    systemCode?: string;
    paperCode?: string;
    customerCode?: string;
    fileCode?: string;
  } | null;
  parties: Party[];
  appointments: Appointment[];
  patientFollowUps: PatientFollowUp[];
  partyMap: {
    byId: Map<string, Party>;
    byName: Map<string, Party>;
    byPhone: Map<string, Party>;
    byCode: Map<string, Party>;
  };
  branches: Branch[];
  activeBranch?: Branch;
  tenant: any;
  t: (ar: string, en: string) => string;
  onNewBookingForPatient: (patient: {
    id?: string;
    name: string;
    phone?: string;
    systemCode?: string;
    customerCode?: string;
    fileCode?: string;
    branchId?: string;
    leadSource?: string;
  }) => void;
  onNewFollowUpForPatient: (patient: {
    id?: string;
    name: string;
    phone?: string;
    systemCode?: string;
    customerCode?: string;
    fileCode?: string;
    branchId?: string;
    leadSource?: string;
  }) => void;
  onConvertFollowUpToBooking: (fup: PatientFollowUp) => void;
}

export const PatientDetailedHistoryModal: React.FC<PatientDetailedHistoryModalProps> = ({
  isOpen,
  onClose,
  patientHistoryData: initialPatientHistoryData,
  parties,
  appointments,
  patientFollowUps,
  partyMap,
  branches,
  activeBranch,
  tenant,
  t,
  onNewBookingForPatient,
  onNewFollowUpForPatient,
  onConvertFollowUpToBooking,
}) => {
  const [selectedData, setSelectedData] = useState<{
    patientId?: string;
    patientName?: string;
    patientPhone?: string;
    systemCode?: string;
    paperCode?: string;
    customerCode?: string;
    fileCode?: string;
  } | null>(initialPatientHistoryData);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'bookings' | 'followups'>('all');

  // Synchronize when initialPatientHistoryData changes from parent
  React.useEffect(() => {
    setSelectedData(initialPatientHistoryData);
    if (!initialPatientHistoryData) {
      setSearchQuery('');
    }
  }, [initialPatientHistoryData]);

  if (!isOpen) return null;

  const historyPatient =
    (selectedData?.patientId ? partyMap.byId.get(selectedData.patientId) : undefined) ||
    (selectedData?.patientName ? partyMap.byName.get(selectedData.patientName.toLowerCase().trim()) : undefined) ||
    (selectedData?.patientPhone ? partyMap.byPhone.get(selectedData.patientPhone.trim()) : undefined) ||
    parties.find(
      (p) =>
        (selectedData?.patientId && p.id === selectedData.patientId) ||
        (selectedData?.patientName && p.name.toLowerCase() === selectedData.patientName.toLowerCase()) ||
        (selectedData?.patientPhone && p.phone === selectedData.patientPhone)
    );

  const hasSelectedPatient = Boolean(historyPatient || selectedData?.patientName);

  // Search matching patients across parties, bookings, follow-ups
  const qSearch = searchQuery.trim().toLowerCase();
  const matchingPatients = (() => {
    if (!qSearch) return [];
    const matched: Party[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < parties.length; i++) {
      const p = parties[i];
      const isCust = p.type === 'Customer' || p.type === 'Both' || !p.type;
      if (!isCust) continue;
      const matches =
        Boolean(p.name && p.name.toLowerCase().includes(qSearch)) ||
        Boolean(p.phone && p.phone.includes(qSearch)) ||
        Boolean(p.customerCode && p.customerCode.toLowerCase().includes(qSearch)) ||
        Boolean(p.systemCode && p.systemCode.toLowerCase().includes(qSearch)) ||
        Boolean(p.fileCode && p.fileCode.toLowerCase().includes(qSearch)) ||
        Boolean(p.paperCode && p.paperCode.toLowerCase().includes(qSearch)) ||
        Boolean(p.code && p.code.toLowerCase().includes(qSearch));

      if (matches) {
        const k = p.id || p.phone || p.name;
        if (!seen.has(k)) {
          seen.add(k);
          matched.push(p);
          if (matched.length >= 25) return matched;
        }
      }
    }

    // Also search appointments for clients that might only exist there
    for (let i = 0; i < appointments.length; i++) {
      const a = appointments[i];
      const matches =
        Boolean(a.patientName && a.patientName.toLowerCase().includes(qSearch)) ||
        Boolean(a.patientPhone && a.patientPhone.includes(qSearch)) ||
        Boolean(a.customerCode && a.customerCode.toLowerCase().includes(qSearch)) ||
        Boolean(a.systemCode && a.systemCode.toLowerCase().includes(qSearch)) ||
        Boolean(a.fileCode && a.fileCode.toLowerCase().includes(qSearch)) ||
        Boolean(a.paperCode && a.paperCode.toLowerCase().includes(qSearch));

      if (matches) {
        const k = a.patientPhone || a.patientName.toLowerCase().trim();
        if (!seen.has(k)) {
          seen.add(k);
          matched.push({
            id: a.patientId || `apt-cust-${i}`,
            tenantId: a.tenantId || tenant?.id || '',
            name: a.patientName,
            nameEn: '',
            phone: a.patientPhone || '',
            customerCode: a.customerCode,
            systemCode: a.systemCode,
            fileCode: a.fileCode,
            paperCode: a.paperCode,
            type: 'Customer',
            branchId: a.branchId,
            balance: 0,
          } as Party);
          if (matched.length >= 25) return matched;
        }
      }
    }

    return matched;
  })();

  const selectedCustCode = historyPatient?.customerCode || historyPatient?.code || selectedData?.customerCode;
  const selectedSysCode = historyPatient?.systemCode || historyPatient?.paperCode || selectedData?.systemCode;
  const selectedFileCode = historyPatient?.fileCode || historyPatient?.fileNumber || selectedData?.fileCode;

  const currentBookings = hasSelectedPatient
    ? appointments
        .filter(
          (a) =>
            (selectedData?.patientId && a.patientId === selectedData.patientId) ||
            (historyPatient?.id && a.patientId === historyPatient.id) ||
            (selectedData?.patientName && a.patientName && a.patientName.toLowerCase() === selectedData.patientName.toLowerCase()) ||
            (historyPatient?.name && a.patientName && a.patientName.toLowerCase() === historyPatient.name.toLowerCase()) ||
            (historyPatient?.phone && a.patientPhone && a.patientPhone === historyPatient.phone) ||
            (selectedData?.patientPhone && a.patientPhone && a.patientPhone === selectedData.patientPhone) ||
            (selectedCustCode && a.customerCode === selectedCustCode) ||
            (selectedSysCode && (a.systemCode === selectedSysCode || a.paperCode === selectedSysCode)) ||
            (selectedFileCode && a.fileCode === selectedFileCode)
        )
        .sort((a, b) => (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time))
    : [];

  const currentFollows = hasSelectedPatient
    ? patientFollowUps
        .filter(
          (f) =>
            (selectedData?.patientId && f.patientId === selectedData.patientId) ||
            (historyPatient?.id && f.patientId === historyPatient.id) ||
            (selectedData?.patientName && f.patientName && f.patientName.toLowerCase() === selectedData.patientName.toLowerCase()) ||
            (historyPatient?.name && f.patientName && f.patientName.toLowerCase() === historyPatient.name.toLowerCase()) ||
            (historyPatient?.phone && f.patientPhone && f.patientPhone === historyPatient.phone) ||
            (selectedData?.patientPhone && f.patientPhone && f.patientPhone === selectedData.patientPhone) ||
            (selectedCustCode && f.customerCode === selectedCustCode) ||
            (selectedSysCode && (f.systemCode === selectedSysCode || f.paperCode === selectedSysCode)) ||
            (selectedFileCode && f.fileCode === selectedFileCode)
        )
        .sort((a, b) => b.followUpDate.localeCompare(a.followUpDate))
    : [];

  const attendedCount = currentBookings.filter((b) => b.status === 'Attended').length;
  const cancelledCount = currentBookings.filter((b) => b.status === 'Cancelled' || b.status === 'NotAttended').length;

  const branchObj = branches.find((b) => b.id === (historyPatient?.branchId || selectedData?.patientId)) || activeBranch;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 md:p-6 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-600/20">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base md:text-lg">
                {t('سجل الحجوزات والمتابعات التفصيلي للمريض', 'Detailed Patient Bookings & Follow-ups Timeline')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('بحث مباشر بكود العميل، كود السيستم، كود الملف، رقم الهاتف، أو الاسم', 'Search by customer code, system code, file code, phone, or name')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Comprehensive Patient Search Bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mx-1" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                'ابحث عن العميل بكود العميل (التطبيق)، كود السيستم، كود الملف، رقم الهاتف، أو الاسم...',
                'Search patient by customer code, system code, file code, phone, or name...'
              )}
              className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Select Search Results */}
          {qSearch && (
            <div className="bg-slate-50 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 max-h-56 overflow-y-auto space-y-1 shadow-md">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 pb-1 border-b border-slate-200 dark:border-slate-700">
                <span>{t('نتائج البحث المطابقة:', 'Matching Patients:')} ({matchingPatients.length})</span>
                <span className="text-[10px] text-slate-400">{t('اضغط على العميل لعرض سجله', 'Click to view history')}</span>
              </div>
              {matchingPatients.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  {t('لا يوجد عميل مطابق للبحث الحالي.', 'No patient found matching search.')}
                </div>
              ) : (
                matchingPatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedData({
                        patientId: p.id,
                        patientName: p.name,
                        patientPhone: p.phone,
                        customerCode: p.customerCode || p.code,
                        systemCode: p.systemCode || p.paperCode,
                        fileCode: p.fileCode || p.fileNumber,
                      });
                      setSearchQuery('');
                    }}
                    className="w-full text-start p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 flex items-center justify-between gap-3 transition-colors cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</span>
                      {p.phone && <span className="font-mono text-[11px] text-slate-500">{p.phone}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(p.customerCode || p.code) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded">
                          كود العميل: {p.customerCode || p.code}
                        </span>
                      )}
                      {(p.systemCode || p.paperCode) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded">
                          سيستم: {p.systemCode || p.paperCode}
                        </span>
                      )}
                      {(p.fileCode || p.fileNumber) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 rounded">
                          ملف: {p.fileCode || p.fileNumber}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Empty State vs Profile Banner */}
        {!hasSelectedPatient ? (
          <div className="py-16 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 mx-auto flex items-center justify-center">
              <Search className="h-7 w-7" />
            </div>
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              {t('يرجى البحث عن العميل لعرض سجله التفصيلي', 'Please search for a client to display history')}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {t(
                'أدخل كود العميل، كود السيستم، كود الملف، رقم الهاتف، أو اسم العميل في شريط البحث أعلاه لعرض كافة الحجوزات والمتابعات الخاصة به بالأسطر.',
                'Enter customer code, system code, file code, phone, or name in the search bar above to view all bookings and follow-up records.'
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Patient Profile & 4 Identifiers Banner */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-600/20">
                    {(selectedData?.patientName || historyPatient?.name || 'م').charAt(0)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-900 dark:text-white text-base">
                        {selectedData?.patientName || historyPatient?.name}
                      </span>

                      {/* 4 Identifiers Badges */}
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 rounded-md inline-flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {branchObj?.name || 'الفرع الرئيسي'}
                      </span>

                      {selectedCustCode && (
                        <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 rounded-md">
                          كود العميل: {selectedCustCode}
                        </span>
                      )}

                      {selectedSysCode && (
                        <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 rounded-md">
                          كود السيستم: {selectedSysCode}
                        </span>
                      )}

                      {selectedFileCode && (
                        <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 rounded-md">
                          كود الملف: {selectedFileCode}
                        </span>
                      )}

                      {/* Change Patient Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedData(null);
                          setSearchQuery('');
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 rounded-md border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                      >
                        {t('بحث عن عميل آخر', 'Search Another')}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3" />
                        {selectedData?.patientPhone || historyPatient?.phone || '-'}
                      </span>
                      <span>•</span>
                      <span>{t('المصدر:', 'Source:')} <strong className="text-slate-700 dark:text-slate-300">{historyPatient?.leadSource || 'زيارة مباشرة'}</strong></span>
                      <span>•</span>
                      <span>{t('تاريخ التكويد:', 'Created:')} <strong className="font-mono text-slate-700 dark:text-slate-300">{historyPatient?.createdAt?.split('T')[0] || '2026-01-15'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Counters */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {currentBookings.length} {t('إجمالي الحجوزات', 'Total Bookings')}
                  </span>
                  <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {attendedCount} {t('حضر الجلسة', 'Attended')}
                  </span>
                  <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {cancelledCount} {t('اعتذار / ملغي', 'Cancelled')}
                  </span>
                  <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {currentFollows.length} {t('سجلات المتابعة', 'Follow-ups')}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t('كافة السجلات (حجوزات ومتابعات)', 'All Records')} ({currentBookings.length + currentFollows.length})
              </button>
              <button
                onClick={() => setFilterTab('bookings')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  filterTab === 'bookings'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>{t('سجل الحجوزات فقط', 'Bookings Only')} ({currentBookings.length})</span>
              </button>
              <button
                onClick={() => setFilterTab('followups')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  filterTab === 'followups'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{t('سجل المتابعات والتذكير فقط', 'Follow-ups Only')} ({currentFollows.length})</span>
              </button>
            </div>
          </>
        )}

        {/* SECTION 1: DETAILED BOOKINGS */}
        {hasSelectedPatient && (filterTab === 'all' || filterTab === 'bookings') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{t('سجل الحجوزات التفصيلي للمريض (في أسطر)', 'Detailed Patient Bookings (In Rows)')}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                  {currentBookings.length}
                </span>
              </h4>
            </div>

            {currentBookings.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                <Calendar className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                <p>{t('لا توجد أي حجوزات مسجلة لهذا المريض حتى الآن.', 'No bookings found for this patient.')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">{t('الفرع', 'Branch')}</th>
                      <th className="p-3">{t('كود العميل', 'Client Code')}</th>
                      <th className="p-3">{t('تاريخ وتوقيت الحجز', 'Date & Time')}</th>
                      <th className="p-3">{t('الخدمة / الجلسة', 'Service')}</th>
                      <th className="p-3">{t('الطبيب المعالج', 'Doctor')}</th>
                      <th className="p-3">{t('حالة الحجز', 'Status')}</th>
                      <th className="p-3">{t('ملاحظات الحجز', 'Notes')}</th>
                      <th className="p-3">{t('تاريخ التسجيل', 'Created')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentBookings.map((b, idx) => {
                      const badge = {
                        Scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200',
                        Confirmed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200',
                        Attended: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300',
                        NotAttended: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
                        Cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200',
                      }[b.status] || 'bg-slate-100 text-slate-700';

                      const bBranch = branches.find((br) => br.id === b.branchId) || activeBranch;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-semibold text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {bBranch?.name || 'الرئيسي'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {b.customerCode || selectedCustCode || '—'}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{b.date}</div>
                            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">{b.time}</div>
                          </td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                            {b.serviceNameAr}
                          </td>
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-1">
                              <Stethoscope className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span>{b.doctorName || 'د. استشاري'}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${badge}`}>
                              {b.status === 'Scheduled' && t('حجز مبدئي', 'Tentative')}
                              {b.status === 'Confirmed' && t('حجز مؤكد', 'Confirmed')}
                              {b.status === 'Attended' && t('حضر الجلسة', 'Attended')}
                              {b.status === 'NotAttended' && t('لم يحضر', 'Not Attended')}
                              {b.status === 'Cancelled' && t('ملغي', 'Cancelled')}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs">
                            {b.notes || '-'}
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[11px]">
                            {b.createdAt ? b.createdAt.split('T')[0] : b.date}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: DETAILED FOLLOW-UPS */}
        {hasSelectedPatient && (filterTab === 'all' || filterTab === 'followups') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>{t('سجل المتابعات والتذكيرات التفصيلي للمريض (في أسطر)', 'Detailed Patient Follow-ups & Reminders (In Rows)')}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                  {currentFollows.length}
                </span>
              </h4>
            </div>

            {currentFollows.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                <MessageSquare className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                <p>{t('لا توجد أي متابعات مسجلة لهذا المريض حتى الآن.', 'No follow-up calls or reminders found for this patient.')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">{t('الفرع', 'Branch')}</th>
                      <th className="p-3">{t('كود العميل', 'Client Code')}</th>
                      <th className="p-3">{t('تاريخ المتابعة', 'Due Date')}</th>
                      <th className="p-3">{t('نوع المتابعة', 'Type')}</th>
                      <th className="p-3">{t('موضوع المتابعة', 'Reason')}</th>
                      <th className="p-3">{t('الحالة', 'Status')}</th>
                      <th className="p-3">{t('ملاحظات', 'Notes')}</th>
                      <th className="p-3">{t('المسؤول', 'Created By')}</th>
                      <th className="p-3 text-center">{t('إجراء', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentFollows.map((f, idx) => {
                      const badge = {
                        Pending: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
                        Contacted: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200',
                        Booked: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200',
                        NoAnswer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
                        Cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200',
                      }[f.status] || 'bg-slate-100 text-slate-700';

                      const fBranch = branches.find((br) => br.id === f.branchId) || activeBranch;

                      return (
                        <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-semibold text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {fBranch?.name || 'الرئيسي'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {f.customerCode || selectedCustCode || '—'}
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {f.followUpDate}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {f.type === 'Inquiry' && t('استفسار', 'Inquiry')}
                              {f.type === 'PostTreatment' && t('اطمئنان بعد الجلسة', 'Post Treatment')}
                              {f.type === 'Recall' && t('تذكير بموعد', 'Recall')}
                              {f.type === 'Complaint' && t('شكوى', 'Complaint')}
                              {f.type === 'General' && t('متابعة عامة', 'General')}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                            {f.reason}
                          </td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badge}`}>
                              {f.status === 'Pending' && t('قيد الانتظار', 'Pending')}
                              {f.status === 'Contacted' && t('تم التواصل', 'Contacted')}
                              {f.status === 'Booked' && t('تم الحجز', 'Booked')}
                              {f.status === 'NoAnswer' && t('لم يرد', 'No Answer')}
                              {f.status === 'Cancelled' && t('اعتذر / ملغي', 'Cancelled')}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs">
                            {f.notes || '-'}
                          </td>
                          <td className="p-3 text-slate-500 text-xs">
                            {f.createdBy || 'فريق المتابعة'}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                onConvertFollowUpToBooking(f);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                              <span>{t('حجز موعد', 'Book')}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const targetClient = historyPatient || {
                  id: selectedData?.patientId,
                  name: selectedData?.patientName || '',
                  phone: selectedData?.patientPhone,
                  systemCode: selectedSysCode,
                  customerCode: selectedCustCode,
                  fileCode: selectedFileCode,
                  branchId: historyPatient?.branchId || activeBranch?.id,
                };
                onNewBookingForPatient(targetClient as any);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>{t('+ حجز موعد جديد لهذا المريض', '+ New Booking')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const targetClient = historyPatient || {
                  id: selectedData?.patientId,
                  name: selectedData?.patientName || '',
                  phone: selectedData?.patientPhone,
                  systemCode: selectedSysCode,
                  customerCode: selectedCustCode,
                  fileCode: selectedFileCode,
                  branchId: historyPatient?.branchId || activeBranch?.id,
                };
                onNewFollowUpForPatient(targetClient as any);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
            >
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              <span>{t('+ تسجيل متابعة جديدة للمريض', '+ New Follow-up')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            {t('إغلاق السجل', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
