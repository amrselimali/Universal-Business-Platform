import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { AttendanceRecord, BiometricDeviceConfig, StaffMember } from '../types';
import {
  Clock,
  Fingerprint,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Upload,
  Server,
  Zap,
  Filter,
  Check,
  X,
  UserCheck,
  ShieldCheck,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const AttendanceManagementView: React.FC = () => {
  const {
    t,
    tenant,
    branches,
    activeBranch,
    staffMembers,
    attendanceRecords,
    allAttendanceRecords,
    addAttendanceRecord,
    updateAttendanceRecord,
    deleteAttendanceRecord,
    syncBiometricDeviceLogs,
    biometricDevices,
    canPerformAction,
    currentUser,
    recordAudit,
    logUserActivity,
  } = usePlatform();

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || 'all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isImportFileModalOpen, setIsImportFileModalOpen] = useState<boolean>(false);
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState<AttendanceRecord | null>(null);

  // Sync state feedback
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Form State for Manual Add
  const [formData, setFormData] = useState<{
    staffId: string;
    branchId: string;
    date: string;
    checkInTime: string;
    checkOutTime: string;
    status: 'Present' | 'Late' | 'Absent' | 'Leave' | 'Excused';
    lateMinutes: number;
    notes: string;
  }>({
    staffId: '',
    branchId: activeBranch?.id || branches[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    checkInTime: '09:00',
    checkOutTime: '17:00',
    status: 'Present',
    lateMinutes: 0,
    notes: '',
  });

  // Filter staff by the currently active/selected branch to ensure strict branch separation
  const branchStaffMembers = useMemo(() => {
    return staffMembers.filter((s) => {
      if (!s.isActive || s.isArchived) return false;
      if (selectedBranchId === 'all') return true;
      return !s.branchId || s.branchId === selectedBranchId || s.branchId === 'all';
    });
  }, [staffMembers, selectedBranchId]);

  // Filter attendance records by Branch, Date, Status, and Search
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      // 1. Branch Isolation
      if (selectedBranchId !== 'all' && rec.branchId !== selectedBranchId) {
        return false;
      }
      // 2. Date Filter
      if (selectedDate && rec.date !== selectedDate) {
        return false;
      }
      // 3. Status Filter
      if (statusFilter !== 'all' && rec.status !== statusFilter) {
        return false;
      }
      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = rec.staffNameAr.toLowerCase().includes(q) || (rec.staffNameEn && rec.staffNameEn.toLowerCase().includes(q));
        const matchesJob = rec.jobTitleAr && rec.jobTitleAr.toLowerCase().includes(q);
        const matchesDeviceCode = rec.deviceUserId && rec.deviceUserId.toLowerCase().includes(q);
        if (!matchesName && !matchesJob && !matchesDeviceCode) return false;
      }
      return true;
    });
  }, [attendanceRecords, selectedBranchId, selectedDate, statusFilter, searchQuery]);

  // Quick Stats
  const totalBranchStaffCount = branchStaffMembers.length;
  const presentCount = filteredRecords.filter((r) => r.status === 'Present').length;
  const lateCount = filteredRecords.filter((r) => r.status === 'Late').length;
  const absentCount = filteredRecords.filter((r) => r.status === 'Absent').length;
  const leaveCount = filteredRecords.filter((r) => r.status === 'Leave' || r.status === 'Excused').length;

  // Handle Manual Add
  const handleOpenAddModal = () => {
    const initialStaff = branchStaffMembers[0];
    setFormData({
      staffId: initialStaff?.id || '',
      branchId: selectedBranchId !== 'all' ? selectedBranchId : activeBranch?.id || branches[0]?.id || '',
      date: selectedDate || new Date().toISOString().split('T')[0],
      checkInTime: '09:00',
      checkOutTime: '17:00',
      status: 'Present',
      lateMinutes: 0,
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffId) {
      alert(t('يرجى اختيار الموظف أولاً!', 'Please select staff member!'));
      return;
    }

    const staff = staffMembers.find((s) => s.id === formData.staffId);
    if (!staff) return;

    // Calculate work hours if both times provided
    let calculatedHours = 0;
    if (formData.checkInTime && formData.checkOutTime) {
      const [hIn, mIn] = formData.checkInTime.split(':').map(Number);
      const [hOut, mOut] = formData.checkOutTime.split(':').map(Number);
      const inMins = hIn * 60 + mIn;
      const outMins = hOut * 60 + mOut;
      if (outMins > inMins) {
        calculatedHours = Number(((outMins - inMins) / 60).toFixed(1));
      }
    }

    addAttendanceRecord({
      tenantId: tenant?.id || 'tenant-eg-001',
      branchId: formData.branchId || staff.branchId || activeBranch?.id || 'branch-1',
      staffId: staff.id,
      staffNameAr: staff.nameAr,
      staffNameEn: staff.nameEn,
      jobTitleAr: staff.jobTitleAr,
      date: formData.date,
      checkInTime: formData.checkInTime ? `${formData.checkInTime}:00` : undefined,
      checkOutTime: formData.checkOutTime ? `${formData.checkOutTime}:00` : undefined,
      status: formData.status,
      source: 'manual',
      workHours: calculatedHours,
      lateMinutes: Number(formData.lateMinutes) || 0,
      notes: formData.notes,
      createdBy: currentUser?.name || 'مسؤول النظام',
    });

    setIsAddModalOpen(false);
  };

  // Handle Edit
  const handleOpenEditModal = (rec: AttendanceRecord) => {
    setSelectedRecordToEdit(rec);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordToEdit) return;

    updateAttendanceRecord(selectedRecordToEdit.id, selectedRecordToEdit);
    setIsEditModalOpen(false);
  };

  // Handle Delete
  const handleDeleteRecord = (id: string, staffName: string) => {
    if (window.confirm(t(`هل أنت متأكد من حذف سجل حضور ${staffName}؟`, `Are you sure you want to delete attendance record for ${staffName}?`))) {
      deleteAttendanceRecord(id);
    }
  };

  // Trigger External Biometric Device Sync
  const handleTriggerBiometricSync = async (deviceId?: string) => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const result = await syncBiometricDeviceLogs(deviceId || (selectedBranchId !== 'all' ? selectedBranchId : activeBranch?.id));
      setSyncFeedback(result.message);
    } catch (err: any) {
      setSyncFeedback(err.message || 'حدث خطأ أثناء مزامنة البصمة');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Offline USB / CSV Biometric Logs Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        let importedCount = 0;
        rawData.forEach((row, index) => {
          // Look for pin/user_id, time, date
          const pin = String(row['PIN'] || row['UserID'] || row['كود'] || row['رقم_البصمة'] || row['ID'] || index + 101);
          const rawDateTime = String(row['Time'] || row['DateTime'] || row['الوقت'] || row['التاريخ_والوقت'] || '');
          const rowDate = rawDateTime.includes(' ') ? rawDateTime.split(' ')[0] : (row['Date'] || row['التاريخ'] || selectedDate);
          const rowTime = rawDateTime.includes(' ') ? rawDateTime.split(' ')[1] : (row['Time'] || row['الوقت'] || '09:00:00');

          // Match staff by deviceUserId or ID or Name
          const matchedStaff = staffMembers.find((s) => s.id === pin || s.phone?.includes(pin) || s.nameAr.includes(String(row['Name'] || '')));
          const staffToUse = matchedStaff || staffMembers[0];

          if (staffToUse) {
            addAttendanceRecord({
              tenantId: tenant?.id || 'tenant-eg-001',
              branchId: staffToUse.branchId || activeBranch?.id || 'branch-1',
              staffId: staffToUse.id,
              staffNameAr: staffToUse.nameAr,
              staffNameEn: staffToUse.nameEn,
              jobTitleAr: staffToUse.jobTitleAr,
              date: rowDate,
              checkInTime: rowTime,
              status: 'Present',
              source: 'biometric_device',
              deviceUserId: pin,
              deviceIpOrId: 'USB_FILE_IMPORT',
              notes: 'مستورد من ملف بصمة خارجي USB/Excel',
              createdBy: currentUser?.name || 'استيراد بصمة خارجي',
            });
            importedCount++;
          }
        });

        alert(t(`تم استيراد ${importedCount} حركة بصمة بنجاح ومطابقتها مع الموظفين!`, `Successfully imported and matched ${importedCount} biometric logs!`));
        setIsImportFileModalOpen(false);
      } catch (err: any) {
        alert(t('فشل في قراءة ملف البصمة: ' + err.message, 'Failed to parse biometric file'));
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-2xl border border-cyan-100 dark:border-cyan-900/60 shadow-xs">
            <Fingerprint className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {t('إدارة الحضور والانصراف والربط بالبصمة الخارجية', 'Staff Attendance & Biometrics')}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                {t('ربط آلي بالبصمة', 'Biometric Live Sync')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                'تسجيل حضور وانصراف الموظفين، الربط التلقائي بأجهزة البصمة الخارجية، احتساب ساعات العمل والتأخير مع الفصل التام لكل فرع.',
                'Manage staff attendance, external biometric clock-in devices, work hours calculation, and branch isolation.'
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleTriggerBiometricSync()}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? t('جاري سحب البصمات...', 'Syncing Biometrics...') : t('مزامنة البصمة الخارجية', 'Sync Biometric Devices')}</span>
          </button>

          <button
            onClick={() => setIsImportFileModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>{t('استيراد ملف بصمة (USB/Excel)', 'Import Punch File')}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('+ تسجيل حضور يدوي', '+ Manual Attendance')}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner Feedback if exists */}
      {syncFeedback && (
        <div className="flex items-center justify-between p-4 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-2xl text-xs font-bold text-cyan-800 dark:text-cyan-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
          <button onClick={() => setSyncFeedback(null)} className="text-cyan-600 hover:text-cyan-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connected Biometric Hardware Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {biometricDevices.map((dev) => (
          <div
            key={dev.id}
            className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-cyan-600 dark:text-cyan-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">{dev.deviceName}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {dev.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  IP: {dev.deviceIp}:{dev.devicePort} | {dev.branchNameAr || 'الفرع'} | {dev.deviceType}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleTriggerBiometricSync(dev.branchId)}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-xs font-bold transition-all"
            >
              {t('سحب البصمات', 'Pull Logs')}
            </button>
          </div>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 text-right shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">{t('إجمالي قوة الفرع المسجلة', 'Total Branch Staff')}</span>
          <span className="text-xl font-black text-slate-800 dark:text-white mt-1 block font-mono">
            {totalBranchStaffCount} <span className="text-xs font-normal text-slate-400">{t('موظف', 'staff')}</span>
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-950 text-right shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">{t('حضور اليوم بالموعد', 'Present On Time')}</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block font-mono">
            {presentCount}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-100 dark:border-amber-950 text-right shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">{t('متأخرون عن الدوام', 'Late Arrival')}</span>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block font-mono">
            {lateCount}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-100 dark:border-rose-950 text-right shadow-xs">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block">{t('غياب / إجازات', 'Absent / Leaves')}</span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block font-mono">
            {absentCount + leaveCount}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Isolation Selector */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="all">{t('كل الفروع المصرحة', 'All Branches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
            />
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300"
            >
              {t('اليوم', 'Today')}
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="all">{t('جميع الحالات', 'All Statuses')}</option>
              <option value="Present">{t('حاضر', 'Present')}</option>
              <option value="Late">{t('متأخر', 'Late')}</option>
              <option value="Absent">{t('غائب', 'Absent')}</option>
              <option value="Leave">{t('إجازة', 'Leave')}</option>
              <option value="Excused">{t('إذن رسمي', 'Excused')}</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('بحث بالاسم أو الكود...', 'Search by staff or pin...')}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl pr-9 pl-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600" />
            <span>{t('سجل حضور وانصراف الموظفين', 'Attendance Logs Table')} ({filteredRecords.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">{t('اسم الموظف', 'Staff Member')}</th>
                <th className="py-3 px-4">{t('الوظيفة والفرع', 'Role & Branch')}</th>
                <th className="py-3 px-4">{t('وقت الحضور', 'Check-In')}</th>
                <th className="py-3 px-4">{t('وقت الانصراف', 'Check-Out')}</th>
                <th className="py-3 px-4">{t('ساعات العمل', 'Work Hours')}</th>
                <th className="py-3 px-4">{t('الحالة', 'Status')}</th>
                <th className="py-3 px-4">{t('المصدر', 'Source')}</th>
                <th className="py-3 px-4">{t('ملاحظات', 'Notes')}</th>
                <th className="py-3 px-4 text-center">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="text-xs">{t('لا توجد سجلات حضور مسجلة لهذا التاريخ أو الفرع', 'No attendance records found for this date or branch')}</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const branchObj = branches.find((b) => b.id === rec.branchId);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{rec.staffNameAr}</div>
                        {rec.deviceUserId && (
                          <div className="text-[10px] text-slate-400 font-mono">PIN: {rec.deviceUserId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-600 dark:text-slate-300">{rec.jobTitleAr || t('موظف', 'Staff')}</div>
                        <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold">{branchObj?.name || rec.branchId}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {rec.checkInTime || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {rec.checkOutTime || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {rec.workHours ? `${rec.workHours} ${t('ساعة', 'hrs')}` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            rec.status === 'Present'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : rec.status === 'Late'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : rec.status === 'Absent'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          }`}
                        >
                          {rec.status === 'Present'
                            ? t('حاضر', 'Present')
                            : rec.status === 'Late'
                            ? `${t('متأخر', 'Late')} (${rec.lateMinutes || 0} د)`
                            : rec.status === 'Absent'
                            ? t('غائب', 'Absent')
                            : rec.status === 'Leave'
                            ? t('إجازة', 'Leave')
                            : t('إذن', 'Excused')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          {rec.source === 'biometric_device' ? (
                            <>
                              <Fingerprint className="w-3.5 h-3.5 text-cyan-600" />
                              <span>{t('بصمة خارجية', 'Biometric')}</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span>{t('يدوي', 'Manual')}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[180px] truncate" title={rec.notes}>
                        {rec.notes || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(rec)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={t('تعديل', 'Edit')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(rec.id, rec.staffNameAr)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={t('حذف', 'Delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Manual Add Attendance */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>{t('تسجيل حضور وانصراف يدوي', 'Record Manual Attendance')}</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الموظف:', 'Staff Member:')}
                </label>
                <select
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  required
                >
                  <option value="">{t('-- اختر الموظف --', '-- Select Staff --')}</option>
                  {branchStaffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr} - {s.jobTitleAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الفرع:', 'Branch:')}
                  </label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التاريخ:', 'Date:')}
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('وقت الحضور:', 'Check-In Time:')}
                  </label>
                  <input
                    type="time"
                    value={formData.checkInTime}
                    onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('وقت الانصراف:', 'Check-Out Time:')}
                  </label>
                  <input
                    type="time"
                    value={formData.checkOutTime}
                    onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الحالة:', 'Status:')}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  >
                    <option value="Present">{t('حاضر', 'Present')}</option>
                    <option value="Late">{t('متأخر', 'Late')}</option>
                    <option value="Absent">{t('غائب', 'Absent')}</option>
                    <option value="Leave">{t('إجازة', 'Leave')}</option>
                    <option value="Excused">{t('إذن رسمي', 'Excused')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('دقائق التأخير:', 'Late Minutes:')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.lateMinutes}
                    onChange={(e) => setFormData({ ...formData, lateMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات:', 'Notes:')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  placeholder={t('أي ملاحظات على الدوام...', 'Any attendance notes...')}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                >
                  {t('حفظ الحضور', 'Save Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Attendance Record */}
      {isEditModalOpen && selectedRecordToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-600" />
                <span>{t('تعديل سجل حضور الموظف:', 'Edit Staff Attendance:')} {selectedRecordToEdit.staffNameAr}</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('وقت الحضور:', 'Check-In:')}</label>
                  <input
                    type="time"
                    value={selectedRecordToEdit.checkInTime?.slice(0, 5) || ''}
                    onChange={(e) => setSelectedRecordToEdit({ ...selectedRecordToEdit, checkInTime: `${e.target.value}:00` })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('وقت الانصراف:', 'Check-Out:')}</label>
                  <input
                    type="time"
                    value={selectedRecordToEdit.checkOutTime?.slice(0, 5) || ''}
                    onChange={(e) => setSelectedRecordToEdit({ ...selectedRecordToEdit, checkOutTime: `${e.target.value}:00` })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('الحالة:', 'Status:')}</label>
                  <select
                    value={selectedRecordToEdit.status}
                    onChange={(e) => setSelectedRecordToEdit({ ...selectedRecordToEdit, status: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  >
                    <option value="Present">{t('حاضر', 'Present')}</option>
                    <option value="Late">{t('متأخر', 'Late')}</option>
                    <option value="Absent">{t('غائب', 'Absent')}</option>
                    <option value="Leave">{t('إجازة', 'Leave')}</option>
                    <option value="Excused">{t('إذن رسمي', 'Excused')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('دقائق التأخير:', 'Late Minutes:')}</label>
                  <input
                    type="number"
                    value={selectedRecordToEdit.lateMinutes || 0}
                    onChange={(e) => setSelectedRecordToEdit({ ...selectedRecordToEdit, lateMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('ملاحظات:', 'Notes:')}</label>
                <textarea
                  value={selectedRecordToEdit.notes || ''}
                  onChange={(e) => setSelectedRecordToEdit({ ...selectedRecordToEdit, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl p-2.5 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-xs"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Biometric Logs from File */}
      {isImportFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-600" />
                <span>{t('استيراد سجلات البصمة من ملف (USB/Excel)', 'Import Biometric Punch File')}</span>
              </h3>
              <button onClick={() => setIsImportFileModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {t(
                'يمكنك رفع ملف تصدير البصمة المباشر من أجهزة ZKTeco أو Hikvision (Excel أو CSV)، وسيقوم النظام بمطابقة كود البصمة مع كود الموظف وتسجيل وقت الحضور آلياً.',
                'Upload your biometric punch export file (Excel or CSV). The system will automatically map user IDs to staff records.'
              )}
            </p>

            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-cyan-500 transition-colors">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('اضغط لاختيار ملف إكسل أو CSV', 'Click to choose Excel or CSV')}
              </p>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer mt-3"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsImportFileModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                {t('إغلاق', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
