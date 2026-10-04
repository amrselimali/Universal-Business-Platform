import React, { useState, useMemo, useEffect } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { StaffMember, ShiftRunRow, CashPaymentVoucher, AttendanceRecord, StaffPayrollItem } from '../types';
import * as XLSX from 'xlsx';
import {
  UserCheck,
  Search,
  Calendar,
  Filter,
  Wallet,
  Clock,
  Briefcase,
  Zap,
  Package,
  FileText,
  Printer,
  Download,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Phone,
  Mail,
  Building2,
  Activity,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  X,
  CreditCard,
  User,
  Info,
} from 'lucide-react';

export interface EmployeeAdvanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  voucherNumber: string;
  date: string;
  amount: number;
  paymentMethod: string;
  reason: string;
  isDeducted: boolean;
  deductedAmount: number;
  remainingAmount: number;
  payrollMonth?: string;
  notes?: string;
  createdAt: string;
}

export interface EmployeeCustodyRecord {
  id: string;
  staffId: string;
  staffName: string;
  itemName: string;
  type: 'عينية' | 'نقدية';
  serialNumber?: string;
  estimatedValue?: number;
  receivedDate: string;
  returnDate?: string;
  status: 'قيد العهدة' | 'تم إخلاء الطرف' | 'تالفة / مفقودة';
  handedBy?: string;
  notes?: string;
  createdAt: string;
}

interface EmployeeDossierViewProps {
  initialStaffId?: string;
}

export const EmployeeDossierView: React.FC<EmployeeDossierViewProps> = ({ initialStaffId }) => {
  const {
    t,
    formatMoney,
    staffMembers,
    activeBranch,
    branches,
    tenant,
    allReceptionShifts,
    cashPayments,
    attendanceRecords,
    allPayrollRuns,
    userActivityLogs,
    currentUser,
    recordAudit,
    language,
  } = usePlatform();

  const isRtl = language === 'ar';

  // 1. Employee Selection & Branch Filter
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranch?.id || (branches.length > 0 ? branches[0].id : 'all')
  );
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');

  // Active Branch Staff
  const filteredStaffList = useMemo(() => {
    return staffMembers.filter((s) => {
      if (s.isArchived) return false;
      if (selectedBranchId !== 'all') {
        const matchesBranch =
          s.branchId === selectedBranchId ||
          (Array.isArray(s.branchIds) && s.branchIds.includes(selectedBranchId)) ||
          (!s.branchId && selectedBranchId === (branches[0]?.id || 'branch-cairo'));
        if (!matchesBranch) return false;
      }
      if (staffSearchQuery.trim()) {
        const query = staffSearchQuery.toLowerCase().trim();
        const nameMatch =
          s.nameAr.toLowerCase().includes(query) ||
          s.nameEn.toLowerCase().includes(query) ||
          s.jobTitleAr.toLowerCase().includes(query) ||
          s.phone.includes(query);
        if (!nameMatch) return false;
      }
      return true;
    });
  }, [staffMembers, selectedBranchId, branches, staffSearchQuery]);

  const [selectedStaffId, setSelectedStaffId] = useState<string>(() => {
    if (initialStaffId) return initialStaffId;
    return filteredStaffList[0]?.id || staffMembers[0]?.id || '';
  });

  // When staff list changes or search changes, maintain selection if valid
  useEffect(() => {
    if (filteredStaffList.length > 0) {
      const exists = filteredStaffList.some((s) => s.id === selectedStaffId);
      if (!exists && filteredStaffList[0]) {
        setSelectedStaffId(filteredStaffList[0].id);
      }
    }
  }, [filteredStaffList, selectedStaffId]);

  const selectedStaff = useMemo(() => {
    return staffMembers.find((s) => s.id === selectedStaffId) || filteredStaffList[0] || null;
  }, [staffMembers, selectedStaffId, filteredStaffList]);

  // 2. Strict Time Period State
  type PeriodPreset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom';
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');

  const todayIso = new Date().toISOString().split('T')[0];

  const getInitialDates = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return {
      from: `${y}-${m}-01`,
      to: todayIso,
    };
  };

  const [dateFrom, setDateFrom] = useState<string>(getInitialDates().from);
  const [dateTo, setDateTo] = useState<string>(getInitialDates().to);

  const handlePeriodPresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'today') {
      setDateFrom(todayIso);
      setDateTo(todayIso);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday/Sunday
      const startOfWeek = new Date(now.setDate(diff));
      setDateFrom(startOfWeek.toISOString().split('T')[0]);
      setDateTo(todayIso);
    } else if (preset === 'this_month') {
      const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
      setDateFrom(firstDay);
      setDateTo(todayIso);
    } else if (preset === 'last_month') {
      const firstDayLastMonth = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const lastDayLastMonth = new Date(y, m, 0).toISOString().split('T')[0];
      setDateFrom(firstDayLastMonth);
      setDateTo(lastDayLastMonth);
    } else if (preset === 'this_year') {
      setDateFrom(`${y}-01-01`);
      setDateTo(todayIso);
    } else if (preset === 'all') {
      setDateFrom('2020-01-01');
      setDateTo('2035-12-31');
    }
  };

  // 3. Navigation Tabs
  type TabKey = 'OPERATIONS' | 'ADVANCES' | 'CUSTODIES' | 'ATTENDANCE' | 'PAYROLL' | 'ACTIVITY';
  const [activeTab, setActiveTab] = useState<TabKey>('OPERATIONS');

  // 4. Local Storage for Staff Dedicated Advances & Custodies
  const [advancesStorage, setAdvancesStorage] = useState<EmployeeAdvanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('erp_employee_advances_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'adv-seed-1',
        staffId: 'staff-01',
        staffName: 'د. ياسمين خالد السعيد',
        voucherNumber: 'ADV-2026-081',
        date: '2026-09-15',
        amount: 3000,
        paymentMethod: 'الخزينة الرئيسية (نقداً)',
        reason: 'سلفة على راتب شهر سبتمبر لظروف شخصية',
        isDeducted: true,
        deductedAmount: 3000,
        remainingAmount: 0,
        payrollMonth: '2026-09',
        notes: 'تم خصمها بالكامل من مسير راتب سبتمبر',
        createdAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'adv-seed-2',
        staffId: 'staff-02',
        staffName: 'د. أحمد محمود الشناوي',
        voucherNumber: 'ADV-2026-089',
        date: '2026-09-25',
        amount: 2500,
        paymentMethod: 'تحويل بنكي',
        reason: 'سلفة مقدمة لاشتراك مؤتمر طبي',
        isDeducted: false,
        deductedAmount: 0,
        remainingAmount: 2500,
        notes: 'مجدولة للخصم على قسطين من راتب أكتوبر ونوفمبر',
        createdAt: '2026-09-25T14:30:00Z',
      },
      {
        id: 'adv-seed-3',
        staffId: 'staff-03',
        staffName: 'سارة عبد الرحمن فوزي',
        voucherNumber: 'ADV-2026-092',
        date: '2026-10-01',
        amount: 1500,
        paymentMethod: 'الخزينة الرئيسية (نقداً)',
        reason: 'سلفة طارئة لحين صرف الراتب',
        isDeducted: false,
        deductedAmount: 0,
        remainingAmount: 1500,
        notes: 'تخصم من راتب شهر أكتوبر',
        createdAt: '2026-10-01T10:00:00Z',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('erp_employee_advances_v1', JSON.stringify(advancesStorage));
    } catch (e) {
      console.error(e);
    }
  }, [advancesStorage]);

  const [custodiesStorage, setCustodiesStorage] = useState<EmployeeCustodyRecord[]>(() => {
    try {
      const saved = localStorage.getItem('erp_employee_custodies_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'cust-seed-1',
        staffId: 'staff-01',
        staffName: 'د. ياسمين خالد السعيد',
        itemName: 'جهاز هاندبيس ليزر كانديلا بروماكس رقم 2',
        type: 'عينية',
        serialNumber: 'HP-CND-8841',
        estimatedValue: 45000,
        receivedDate: '2026-08-01',
        status: 'قيد العهدة',
        handedBy: 'مدير العيادة',
        notes: 'هاندبيس كانديلا أصلي بغرفة الليزر 1',
        createdAt: '2026-08-01T09:00:00Z',
      },
      {
        id: 'cust-seed-2',
        staffId: 'staff-03',
        staffName: 'سارة عبد الرحمن فوزي',
        itemName: 'تابلت ريسيبشن سامسونج لتسجيل دخول المرضى والباركود',
        type: 'عينية',
        serialNumber: 'TAB-SAM-9092',
        estimatedValue: 9500,
        receivedDate: '2026-08-15',
        status: 'قيد العهدة',
        handedBy: 'إدارة الـ IT',
        notes: 'تابلت مدعوم بجراب حماية وشاحن أصلي',
        createdAt: '2026-08-15T09:00:00Z',
      },
      {
        id: 'cust-seed-3',
        staffId: 'staff-03',
        staffName: 'سارة عبد الرحمن فوزي',
        itemName: 'عهدة نقدية طارئة للدرج والفكة (Float Cash)',
        type: 'نقدية',
        estimatedValue: 2000,
        receivedDate: '2026-09-01',
        status: 'قيد العهدة',
        handedBy: 'المدير المالي',
        notes: 'عهدة فكة مستديمة تسوى نهاية كل شهر',
        createdAt: '2026-09-01T09:00:00Z',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('erp_employee_custodies_v1', JSON.stringify(custodiesStorage));
    } catch (e) {
      console.error(e);
    }
  }, [custodiesStorage]);

  // Modals for Adding Advance & Custody
  const [showAddAdvanceModal, setShowAddAdvanceModal] = useState<boolean>(false);
  const [newAdvanceData, setNewAdvanceData] = useState({
    amount: 1000,
    paymentMethod: 'الخزينة الرئيسية (نقداً)',
    date: todayIso,
    reason: '',
    notes: '',
  });

  const [showAddCustodyModal, setShowAddCustodyModal] = useState<boolean>(false);
  const [newCustodyData, setNewCustodyData] = useState({
    itemName: '',
    type: 'عينية' as 'عينية' | 'نقدية',
    serialNumber: '',
    estimatedValue: 0,
    receivedDate: todayIso,
    handedBy: currentUser?.name || 'مدير الفرع',
    notes: '',
  });

  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // -------------------------------------------------------------
  // STRICT DATA FILTERING FOR THE SELECTED EMPLOYEE ONLY!
  // "ولا يعرض اى شى لا تخص اليوزر" - Zero cross-contamination!
  // -------------------------------------------------------------
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return cleanDate >= dateFrom && cleanDate <= dateTo;
  };

  // A. Operations & Laser Pulses (حركات التشغيل وجلسات الليزر)
  const employeeOperations = useMemo(() => {
    if (!selectedStaff) return [];

    const staffNameAr = selectedStaff.nameAr.trim().toLowerCase();
    const staffNameEn = selectedStaff.nameEn.trim().toLowerCase();
    const staffId = selectedStaff.id;

    const list: Array<
      ShiftRunRow & {
        shiftNumber: string;
        shiftDate: string;
        shiftBranchId?: string;
        calculatedCommission: number;
      }
    > = [];

    allReceptionShifts.forEach((shift) => {
      shift.runRows.forEach((r) => {
        // Date range match
        if (!isDateInRange(r.date)) return;

        // Strict employee match: doctor, technician, or receptionist
        const docName = (r.doctorName || '').trim().toLowerCase();
        const isDocMatch =
          r.doctorId === staffId ||
          docName === staffNameAr ||
          docName === staffNameEn ||
          (docName.length > 3 && (staffNameAr.includes(docName) || docName.includes(staffNameAr)));

        const isTechMatch = r.technicianId === staffId;
        const isRecepMatch =
          selectedStaff.jobTitleAr?.includes('استقبال') &&
          shift.receptionistName?.trim().toLowerCase() === staffNameAr;

        if (isDocMatch || isTechMatch || isRecepMatch) {
          // Calculate Doctor / Specialist Commission for this row
          let commission = 0;
          const pulses = r.pulsesCount || 0;
          const rev = r.totalRevenue || 0;

          if (selectedStaff.laserPulseRate && pulses > 0) {
            commission += pulses * selectedStaff.laserPulseRate;
          }
          if (selectedStaff.laserRevenueRate && rev > 0) {
            commission += rev * (selectedStaff.laserRevenueRate / 100);
          } else if (selectedStaff.commissionRate && rev > 0) {
            commission += rev * (selectedStaff.commissionRate / 100);
          }

          list.push({
            ...r,
            shiftNumber: shift.shiftNumber,
            shiftDate: shift.shiftDate,
            shiftBranchId: shift.branchId,
            calculatedCommission: Number(commission.toFixed(2)),
          });
        }
      });
    });

    return list.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [allReceptionShifts, selectedStaff, dateFrom, dateTo]);

  // B. Staff Advances & Loans (السلف والمسحوبات)
  const employeeAdvances = useMemo(() => {
    if (!selectedStaff) return [];

    const staffNameAr = selectedStaff.nameAr.trim().toLowerCase();
    const staffId = selectedStaff.id;

    // 1. Dedicated advances table
    const dedicated = advancesStorage.filter((adv) => {
      if (adv.staffId !== staffId && adv.staffName.toLowerCase() !== staffNameAr) return false;
      return isDateInRange(adv.date);
    });

    // 2. Also incorporate cash payments issued to this staff for salary/advances
    const vouchers = cashPayments
      .filter((cp) => {
        if (cp.status === 'cancelled') return false;
        if (!isDateInRange(cp.date)) return false;
        const isReceiver =
          cp.paidTo?.toLowerCase().includes(staffNameAr) ||
          cp.receiverName?.toLowerCase().includes(staffNameAr) ||
          cp.description?.toLowerCase().includes(staffNameAr);
        const isAdvanceCategory =
          cp.expenseCategory?.includes('سلف') ||
          cp.expenseCategory?.includes('رواتب') ||
          cp.description?.includes('سلف') ||
          cp.description?.includes('سلفة');
        return isReceiver && isAdvanceCategory;
      })
      .map((cp) => ({
        id: `cp-adv-${cp.id}`,
        staffId,
        staffName: selectedStaff.nameAr,
        voucherNumber: cp.voucherNumber,
        date: cp.date,
        amount: cp.amount,
        paymentMethod: cp.paidFromAccount || 'الخزينة النقدية',
        reason: cp.description || 'سند صرف سلفة نقدية معتمد',
        isDeducted: false,
        deductedAmount: 0,
        remainingAmount: cp.amount,
        notes: `سند صرف رسمي رقم ${cp.voucherNumber}`,
        createdAt: `${cp.date}T10:00:00Z`,
      }));

    // Avoid duplication if already recorded in dedicated
    const combined = [...dedicated];
    vouchers.forEach((v) => {
      if (!combined.some((c) => c.voucherNumber === v.voucherNumber)) {
        combined.push(v);
      }
    });

    return combined.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [advancesStorage, cashPayments, selectedStaff, dateFrom, dateTo]);

  // C. Custodies & Handover Items (العهد النقدية والعينية)
  const employeeCustodies = useMemo(() => {
    if (!selectedStaff) return [];

    const staffNameAr = selectedStaff.nameAr.trim().toLowerCase();
    const staffId = selectedStaff.id;

    const list = custodiesStorage.filter((c) => {
      if (c.staffId !== staffId && c.staffName.toLowerCase() !== staffNameAr) return false;
      // Filter by period if received in period or currently active
      return isDateInRange(c.receivedDate) || c.status === 'قيد العهدة';
    });

    return list.sort((a, b) => (b.receivedDate > a.receivedDate ? 1 : -1));
  }, [custodiesStorage, selectedStaff, dateFrom, dateTo]);

  // D. Attendance & Work Hours (الحضور والانصراف)
  const employeeAttendance = useMemo(() => {
    if (!selectedStaff) return [];

    const staffNameAr = selectedStaff.nameAr.trim().toLowerCase();
    const staffId = selectedStaff.id;

    return attendanceRecords
      .filter((rec) => {
        const matchesStaff = rec.staffId === staffId || rec.staffNameAr?.trim().toLowerCase() === staffNameAr;
        if (!matchesStaff) return false;
        return isDateInRange(rec.date);
      })
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [attendanceRecords, selectedStaff, dateFrom, dateTo]);

  // E. Payroll & Salary Slips (مسير الرواتب)
  const employeePayroll = useMemo(() => {
    if (!selectedStaff) return [];

    const staffNameAr = selectedStaff.nameAr.trim().toLowerCase();
    const staffId = selectedStaff.id;

    const items: Array<StaffPayrollItem & { runStatus: string; runCreatedAt: string }> = [];

    allPayrollRuns.forEach((run) => {
      run.items.forEach((it) => {
        const matches = it.staffId === staffId || it.staffNameAr?.trim().toLowerCase() === staffNameAr;
        if (!matches) return false;
        // Month range check: "YYYY-MM"
        const monthStart = `${it.month}-01`;
        if (monthStart >= dateFrom.slice(0, 7) + '-01' && monthStart <= dateTo) {
          items.push({
            ...it,
            runStatus: run.status,
            runCreatedAt: run.createdAt,
          });
        }
      });
    });

    return items.sort((a, b) => (b.month > a.month ? 1 : -1));
  }, [allPayrollRuns, selectedStaff, dateFrom, dateTo]);

  // F. User Activity Logs (سجل النشاط)
  const employeeActivity = useMemo(() => {
    if (!selectedStaff) return [];

    const staffNameAr = selectedStaff.nameAr.trim().toLowerCase();
    const staffId = selectedStaff.id;

    return userActivityLogs
      .filter((log) => {
        const matchesUser =
          log.userName?.trim().toLowerCase() === staffNameAr ||
          log.userId === staffId ||
          log.details?.toLowerCase().includes(staffNameAr);
        if (!matchesUser) return false;
        return isDateInRange(log.timestamp.split('T')[0]);
      })
      .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
  }, [userActivityLogs, selectedStaff, dateFrom, dateTo]);

  // -------------------------------------------------------------
  // STATISTICAL KPI CALCULATIONS FOR THE SELECTED PERIOD
  // -------------------------------------------------------------
  const stats = useMemo(() => {
    const totalOperationsCount = employeeOperations.length;
    const totalPulsesCount = employeeOperations.reduce((s, op) => s + (op.pulsesCount || 0), 0);
    const totalRevenueGenerated = employeeOperations.reduce((s, op) => s + (op.totalRevenue || 0), 0);
    const totalCommissionsEarned = employeeOperations.reduce((s, op) => s + (op.calculatedCommission || 0), 0);

    const totalAdvancesAmount = employeeAdvances.reduce((s, adv) => s + adv.amount, 0);
    const totalAdvancesRemaining = employeeAdvances.reduce((s, adv) => s + adv.remainingAmount, 0);

    const totalActiveCustodiesCount = employeeCustodies.filter((c) => c.status === 'قيد العهدة').length;
    const totalCustodiesValue = employeeCustodies.reduce((s, c) => s + (c.estimatedValue || 0), 0);

    const totalAttendanceDays = employeeAttendance.filter((a) => a.status === 'Present' || a.status === 'Late').length;
    const totalLateDays = employeeAttendance.filter((a) => a.status === 'Late').length;
    const totalWorkHours = employeeAttendance.reduce((s, a) => s + (a.workHours || 8), 0);

    const totalBasicSalaryPaid = employeePayroll.reduce((s, p) => s + p.basicSalary, 0);
    const totalAllowancesPaid = employeePayroll.reduce((s, p) => s + p.allowances, 0);
    const totalNetSalaryPaid = employeePayroll.reduce((s, p) => s + p.netSalary, 0);

    return {
      totalOperationsCount,
      totalPulsesCount,
      totalRevenueGenerated,
      totalCommissionsEarned,
      totalAdvancesAmount,
      totalAdvancesRemaining,
      totalActiveCustodiesCount,
      totalCustodiesValue,
      totalAttendanceDays,
      totalLateDays,
      totalWorkHours,
      totalBasicSalaryPaid,
      totalAllowancesPaid,
      totalNetSalaryPaid,
    };
  }, [employeeOperations, employeeAdvances, employeeCustodies, employeeAttendance, employeePayroll]);

  // -------------------------------------------------------------
  // ACTIONS: ADD ADVANCE & ADD CUSTODY
  // -------------------------------------------------------------
  const handleCreateAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (newAdvanceData.amount <= 0) {
      alert(t('يجب أن يكون مبلغ السلفة أكبر من الصفر!', 'Advance amount must be greater than zero!'));
      return;
    }

    const newAdv: EmployeeAdvanceRecord = {
      id: `adv-${Date.now()}`,
      staffId: selectedStaff.id,
      staffName: selectedStaff.nameAr,
      voucherNumber: `ADV-${new Date().getFullYear()}-${String(advancesStorage.length + 1).padStart(3, '0')}`,
      date: newAdvanceData.date,
      amount: Number(newAdvanceData.amount),
      paymentMethod: newAdvanceData.paymentMethod,
      reason: newAdvanceData.reason.trim() || 'سلفة نقدية على الراتب',
      isDeducted: false,
      deductedAmount: 0,
      remainingAmount: Number(newAdvanceData.amount),
      notes: newAdvanceData.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setAdvancesStorage((prev) => [newAdv, ...prev]);

    recordAudit({
      branchId: selectedStaff.branchId || activeBranch?.id,
      entityType: 'StaffMember',
      entityId: selectedStaff.id,
      entityName: selectedStaff.nameAr,
      actionType: 'CREATE',
      details: `تسجيل سلفة نقدية بقيمة ${newAdvanceData.amount} ج.م للموظف ${selectedStaff.nameAr} بسند رقم ${newAdv.voucherNumber}`,
    });

    setShowAddAdvanceModal(false);
    setNewAdvanceData({
      amount: 1000,
      paymentMethod: 'الخزينة الرئيسية (نقداً)',
      date: todayIso,
      reason: '',
      notes: '',
    });
  };

  const handleCreateCustodySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (!newCustodyData.itemName.trim()) {
      alert(t('يرجى إدخال اسم العهدة المسندة!', 'Please enter custody item name!'));
      return;
    }

    const newCust: EmployeeCustodyRecord = {
      id: `cust-${Date.now()}`,
      staffId: selectedStaff.id,
      staffName: selectedStaff.nameAr,
      itemName: newCustodyData.itemName.trim(),
      type: newCustodyData.type,
      serialNumber: newCustodyData.serialNumber.trim() || undefined,
      estimatedValue: Number(newCustodyData.estimatedValue) || 0,
      receivedDate: newCustodyData.receivedDate,
      status: 'قيد العهدة',
      handedBy: newCustodyData.handedBy.trim() || currentUser?.name || 'مدير الفرع',
      notes: newCustodyData.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setCustodiesStorage((prev) => [newCust, ...prev]);

    recordAudit({
      branchId: selectedStaff.branchId || activeBranch?.id,
      entityType: 'StaffMember',
      entityId: selectedStaff.id,
      entityName: selectedStaff.nameAr,
      actionType: 'CREATE',
      details: `إسناد عهدة (${newCustodyData.itemName}) للموظف ${selectedStaff.nameAr} بقيمة تقديرية ${newCustodyData.estimatedValue} ج.م`,
    });

    setShowAddCustodyModal(false);
    setNewCustodyData({
      itemName: '',
      type: 'عينية',
      serialNumber: '',
      estimatedValue: 0,
      receivedDate: todayIso,
      handedBy: currentUser?.name || 'مدير الفرع',
      notes: '',
    });
  };

  const handleToggleCustodyStatus = (custodyId: string) => {
    setCustodiesStorage((prev) =>
      prev.map((c) => {
        if (c.id === custodyId) {
          const nextStatus = c.status === 'قيد العهدة' ? 'تم إخلاء الطرف' : 'قيد العهدة';
          const returnDate = nextStatus === 'تم إخلاء الطرف' ? todayIso : undefined;
          return { ...c, status: nextStatus, returnDate };
        }
        return c;
      })
    );
  };

  // Export Full Dossier to Excel
  const handleExportFullDossierExcel = () => {
    if (!selectedStaff) return;
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Operations
      const opsData = employeeOperations.map((op, idx) => ({
        'م': idx + 1,
        'التاريخ': op.date,
        'اليوم': op.dayName || '',
        'العميل / المريض': op.customerName || op.patientName,
        'الخدمة / الجلسة': op.serviceName,
        'جهاز الليزر': op.laserDevice || '-',
        'البلصات المستهلكة': op.pulsesCount || 0,
        'إجمالي الإيراد': op.totalRevenue,
        'المحصل': op.collectedAmount || op.totalRevenue,
        'طريقة السداد': op.paymentMethod,
        'العمولة المحسوبة': op.calculatedCommission,
        'رقم الشيفت': op.shiftNumber,
      }));
      const wsOps = XLSX.utils.json_to_sheet(opsData.length > 0 ? opsData : [{ 'تنبيه': 'لا توجد حركات في الفترة' }]);
      XLSX.utils.book_append_sheet(wb, wsOps, 'حركات_التشغيل_والبلصات');

      // Sheet 2: Advances
      const advData = employeeAdvances.map((adv, idx) => ({
        'م': idx + 1,
        'رقم السند': adv.voucherNumber,
        'التاريخ': adv.date,
        'مبلغ السلفة': adv.amount,
        'طريقة الصرف': adv.paymentMethod,
        'سبب السلفة': adv.reason,
        'حالة الخصم': adv.isDeducted ? 'تم الخصم بالكامل' : 'قيد السداد',
        'المبلغ المتبقي': adv.remainingAmount,
        'ملاحظات': adv.notes || '',
      }));
      const wsAdv = XLSX.utils.json_to_sheet(advData.length > 0 ? advData : [{ 'تنبيه': 'لا توجد سلف في الفترة' }]);
      XLSX.utils.book_append_sheet(wb, wsAdv, 'السلف_والقروض');

      // Sheet 3: Custodies
      const custData = employeeCustodies.map((c, idx) => ({
        'م': idx + 1,
        'اسم العهدة': c.itemName,
        'النوع': c.type,
        'السيريال / الكود': c.serialNumber || '-',
        'القيمة التقديرية': c.estimatedValue || 0,
        'تاريخ الاستلام': c.receivedDate,
        'تاريخ الاسترداد': c.returnDate || '-',
        'الحالة': c.status,
        'المسؤول عن التسليم': c.handedBy || '',
        'ملاحظات': c.notes || '',
      }));
      const wsCust = XLSX.utils.json_to_sheet(custData.length > 0 ? custData : [{ 'تنبيه': 'لا توجد عهد مسندة' }]);
      XLSX.utils.book_append_sheet(wb, wsCust, 'العهد_المسندة');

      // Sheet 4: Attendance
      const attData = employeeAttendance.map((a, idx) => ({
        'م': idx + 1,
        'التاريخ': a.date,
        'وقت الحضور': a.checkInTime || '-',
        'وقت الانصراف': a.checkOutTime || '-',
        'ساعات العمل': a.workHours || 8,
        'دقائق التأخير': a.lateMinutes || 0,
        'الحالة': a.status,
        'المصدر': a.source || 'يدوي',
      }));
      const wsAtt = XLSX.utils.json_to_sheet(attData.length > 0 ? attData : [{ 'تنبيه': 'لا توجد سجلات حضور' }]);
      XLSX.utils.book_append_sheet(wb, wsAtt, 'الحضور_والانصراف');

      // Sheet 5: Payroll
      const payData = employeePayroll.map((p, idx) => ({
        'م': idx + 1,
        'الشهر': p.month,
        'الراتب الأساسي': p.basicSalary,
        'البدلات والمكافآت': p.allowances,
        'العمولات المكتسبة': p.commissions,
        'الاستقطاعات والسلف': p.deductions,
        'صافي الراتب': p.netSalary,
        'حالة الصرف': p.paymentStatus === 'Paid' ? 'مدفوع' : 'معلق',
        'طريقة الصرف': p.paymentMethod || 'الخزينة',
      }));
      const wsPay = XLSX.utils.json_to_sheet(payData.length > 0 ? payData : [{ 'تنبيه': 'لا توجد مسيرات رواتب' }]);
      XLSX.utils.book_append_sheet(wb, wsPay, 'الرواتب_والمسيرات');

      const fileName = `ملف_الموظف_الشامل_${selectedStaff.nameAr.replace(/\s+/g, '_')}_${dateFrom}_إلى_${dateTo}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      alert('حدث خطأ أثناء تصدير ملف الإكسل: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. TOP HEADER & MAIN ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
            <UserCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                {t('ملف وكشف حساب الموظف الشامل', 'Employee Comprehensive Dossier')}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {t('فحص حركات فردي', 'Single Employee Deep Inquiry')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t(
                'استعراض كامل البيانات المسجلة باسم الموظف حصرياً (السلف، العهد، حركات التشغيل والبلصات، الحضور والانصراف، ومسير الرواتب) مع عزل تام عن باقي الموظفين',
                'Detailed isolated dossier for a specific employee: Advances, Custodies, Run-sheet & Pulses, Attendance, and Payroll'
              )}
            </p>
          </div>
        </div>

        {/* Global Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddAdvanceModal(true)}
            disabled={!selectedStaff}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span>{t('+ تسجيل سلفة', '+ Record Advance')}</span>
          </button>

          <button
            onClick={() => setShowAddCustodyModal(true)}
            disabled={!selectedStaff}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Package className="w-4 h-4 text-amber-600" />
            <span>{t('+ إسناد عهدة', '+ Assign Custody')}</span>
          </button>

          <button
            onClick={handleExportFullDossierExcel}
            disabled={!selectedStaff}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{t('تصدير إكسل الشامل', 'Export Dossier Excel')}</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            disabled={!selectedStaff}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-indigo-400" />
            <span>{t('طباعة كشف الحساب', 'Print Statement')}</span>
          </button>
        </div>
      </div>

      {/* 2. EMPLOYEE SELECTOR & TIME PERIOD FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
          {/* Branch Filter */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              <Building2 className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              {t('فلترة الفرع التابع له الموظف', 'Branch Scope')}
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-indigo-600"
            >
              <option value="all">{t('جميع الفروع', 'All Branches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              <Search className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              {t('بحث في أسماء الموظفين والأطباء', 'Search Staff')}
            </label>
            <input
              type="text"
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              placeholder={t('اكتب اسم الموظف، المسمى، الهاتف...', 'Name, title, phone...')}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-indigo-600 placeholder:text-slate-400"
            />
          </div>

          {/* Primary Employee Dropdown */}
          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              <User className="w-3.5 h-3.5 inline ml-1" />
              {t('الموظف المختار لعرض كشف حسابه وحركاته حصرياً *', 'Select Employee for Isolated Dossier *')}
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-black rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border-2 border-indigo-500 text-indigo-950 dark:text-indigo-100 focus:outline-indigo-600 cursor-pointer shadow-xs"
            >
              {filteredStaffList.length === 0 ? (
                <option value="">{t('لا يوجد موظفين مطابقين', 'No staff found')}</option>
              ) : (
                filteredStaffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameAr} - {s.jobTitleAr} ({s.staffType})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* TIME PERIOD SELECTOR (خلال فترة محددة) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">
              <Calendar className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
              {t('فترة الحركات المطلوبة:', 'Time Period:')}
            </span>

            {(
              [
                { key: 'today', labelAr: 'اليوم' },
                { key: 'this_week', labelAr: 'هذا الأسبوع' },
                { key: 'this_month', labelAr: 'هذا الشهر' },
                { key: 'last_month', labelAr: 'الشهر السابق' },
                { key: 'this_year', labelAr: 'العام الحالي' },
                { key: 'all', labelAr: 'كل السجلات' },
              ] as Array<{ key: PeriodPreset; labelAr: string }>
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePeriodPresetChange(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodPreset === p.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.labelAr}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">{t('من:', 'From:')}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPeriodPreset('custom');
                }}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">{t('إلى:', 'To:')}</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPeriodPreset('custom');
                }}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. SELECTED EMPLOYEE PROFILE BANNER */}
      {selectedStaff && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-900/50 shadow-md space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center font-black text-2xl shadow-inner shrink-0">
                {selectedStaff.nameAr.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg md:text-xl font-black text-white">{selectedStaff.nameAr}</h2>
                  <span className="text-xs text-indigo-200 font-mono font-medium">({selectedStaff.nameEn})</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                    {selectedStaff.jobTitleAr}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {selectedStaff.isActive ? 'نشط بالخدمة' : 'معطل'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-1.5 font-medium">
                  {selectedStaff.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-mono">{selectedStaff.phone}</span>
                    </span>
                  )}
                  {selectedStaff.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{selectedStaff.email}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {branches.find((b) => b.id === selectedStaff.branchId)?.name ||
                        activeBranch?.name ||
                        'الفرع الرئيسي'}
                    </span>
                  </span>
                  {selectedStaff.hireDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>تاريخ التعيين: {selectedStaff.hireDate}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Parameters Badges */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white/5 rounded-2xl border border-white/10 text-xs">
              <div className="px-3 py-1 bg-white/5 rounded-xl">
                <span className="block text-[10px] text-slate-400 font-bold">الراتب الشهري الثابت</span>
                <span className="font-mono font-black text-amber-300">
                  {formatMoney(selectedStaff.monthlySalary || selectedStaff.basicSalary || 0)}
                </span>
              </div>
              {Boolean(selectedStaff.laserPulseRate) && (
                <div className="px-3 py-1 bg-white/5 rounded-xl">
                  <span className="block text-[10px] text-slate-400 font-bold">عمولة النبضة</span>
                  <span className="font-mono font-black text-emerald-300">
                    {selectedStaff.laserPulseRate} ج/نبضة
                  </span>
                </div>
              )}
              {Boolean(selectedStaff.laserRevenueRate) && (
                <div className="px-3 py-1 bg-white/5 rounded-xl">
                  <span className="block text-[10px] text-slate-400 font-bold">نسبة إيراد الليزر</span>
                  <span className="font-mono font-black text-cyan-300">{selectedStaff.laserRevenueRate}%</span>
                </div>
              )}
              {Boolean(selectedStaff.commissionRate) && (
                <div className="px-3 py-1 bg-white/5 rounded-xl">
                  <span className="block text-[10px] text-slate-400 font-bold">العمولة العامة</span>
                  <span className="font-mono font-black text-purple-300">{selectedStaff.commissionRate}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. EXECUTIVE STATS KPI CARDS FOR SELECTED PERIOD */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Advances & Loans */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي السلف والمسحوبات</span>
            <TrendingDown className="w-4 h-4" />
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-rose-600">
            {formatMoney(stats.totalAdvancesAmount)}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            المتبقي غير المخصوم: {formatMoney(stats.totalAdvancesRemaining)}
          </p>
        </div>

        {/* KPI 2: Custodies */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">العهد المسندة القائمة</span>
            <Package className="w-4 h-4" />
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-amber-600">
            {stats.totalActiveCustodiesCount} <span className="text-xs font-bold">عهدة</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            قيمة تقديرية: {formatMoney(stats.totalCustodiesValue)}
          </p>
        </div>

        {/* KPI 3: Operations & Pulses */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">جلسات التشغيل والبلصات</span>
            <Zap className="w-4 h-4" />
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-indigo-600">
            {stats.totalOperationsCount} <span className="text-xs font-bold">جلسة</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            البلصات: {stats.totalPulsesCount.toLocaleString()} ن • عمولة: {formatMoney(stats.totalCommissionsEarned)}
          </p>
        </div>

        {/* KPI 4: Attendance & Hours */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الحضور وساعات العمل</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-emerald-600">
            {stats.totalAttendanceDays} <span className="text-xs font-bold">يوم عمل</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            {stats.totalWorkHours} ساعة • {stats.totalLateDays} تأخير
          </p>
        </div>

        {/* KPI 5: Net Payroll */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">صافي مسير الرواتب</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-purple-600">
            {formatMoney(stats.totalNetSalaryPaid)}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            أساسي: {formatMoney(stats.totalBasicSalaryPaid)} + بدلات: {formatMoney(stats.totalAllowancesPaid)}
          </p>
        </div>
      </div>

      {/* 5. MULTI-TAB NAVIGATION */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-4 pt-3 overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('OPERATIONS')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'OPERATIONS'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-2xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>حركات التشغيل والبلصات ({employeeOperations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ADVANCES')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ADVANCES'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 rounded-t-2xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>السلف والمسحوبات المالية ({employeeAdvances.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CUSTODIES')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'CUSTODIES'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 rounded-t-2xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>العهد النقدية والعينية ({employeeCustodies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ATTENDANCE')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ATTENDANCE'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-2xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>الحضور والانصراف ({employeeAttendance.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PAYROLL')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PAYROLL'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900 rounded-t-2xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>مسير الرواتب والأجور ({employeePayroll.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ACTIVITY')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ACTIVITY'
                ? 'border-slate-800 text-slate-800 dark:text-white bg-white dark:bg-slate-900 rounded-t-2xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>سجل الحركات الإدارية ({employeeActivity.length})</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-6">
          {/* TAB 1: OPERATIONS & CONSUMED PULSES */}
          {activeTab === 'OPERATIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    حركات التشغيل وجلسات الليزر والبلصات المنفذة باسم ({selectedStaff?.nameAr})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الفترة من {dateFrom} إلى {dateTo} • حركات فردية معزولة لا تشمل أي موظف آخر
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    إجمالي الجلسات: {employeeOperations.length}
                  </span>
                  <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800">
                    البلصات: {stats.totalPulsesCount.toLocaleString()} نبضة
                  </span>
                </div>
              </div>

              {employeeOperations.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <Zap className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-500">
                    لا توجد أي حركات تشغيل أو جلسات مسجلة باسم هذا الموظف خلال الفترة المحددة ({dateFrom} إلى {dateTo}).
                  </p>
                  <p className="text-xs text-slate-400">
                    جرب توسيع الفترة الزمنية أو اختيار شهر آخر لمعاينة الحركات القديمة.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">م</th>
                        <th className="p-3">التاريخ واليوم</th>
                        <th className="p-3">اسم العميل / المريض</th>
                        <th className="p-3">الخدمة / الجلسة</th>
                        <th className="p-3">جهاز الليزر</th>
                        <th className="p-3 text-amber-600 font-black">عدد البلصات المستهلكة</th>
                        <th className="p-3">إجمالي الإيراد</th>
                        <th className="p-3">المحصل</th>
                        <th className="p-3">طريقة السداد</th>
                        <th className="p-3 text-emerald-600 font-black">العمولة المحسوبة</th>
                        <th className="p-3">الشيفت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {employeeOperations.map((op, idx) => (
                        <tr key={op.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-800 dark:text-white">
                            {op.date}{' '}
                            {op.dayName && <span className="text-[10px] text-slate-400">({op.dayName})</span>}
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {op.customerName || op.patientName}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 font-bold">{op.serviceName}</td>
                          <td className="p-3 text-slate-500 font-medium">{op.laserDevice || '-'}</td>
                          <td className="p-3 font-mono font-black text-amber-600 text-sm">
                            {op.pulsesCount ? `${op.pulsesCount.toLocaleString()} ن` : '-'}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatMoney(op.totalRevenue)}
                          </td>
                          <td className="p-3 font-mono text-emerald-600 font-bold">
                            {formatMoney(op.collectedAmount || op.totalRevenue)}
                          </td>
                          <td className="p-3 text-slate-500">{op.paymentMethod}</td>
                          <td className="p-3 font-mono font-black text-emerald-600">
                            {op.calculatedCommission > 0 ? formatMoney(op.calculatedCommission) : '-'}
                          </td>
                          <td className="p-3 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                            #{op.shiftNumber}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100/70 dark:bg-slate-800 font-black text-xs text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={5} className="p-3 text-left">
                          الإجمالي الكلي لفترة البحث:
                        </td>
                        <td className="p-3 text-amber-600 font-mono text-sm">
                          {stats.totalPulsesCount.toLocaleString()} نبضة
                        </td>
                        <td className="p-3 font-mono">{formatMoney(stats.totalRevenueGenerated)}</td>
                        <td className="p-3 font-mono text-emerald-600">
                          {formatMoney(
                            employeeOperations.reduce((s, op) => s + (op.collectedAmount || op.totalRevenue), 0)
                          )}
                        </td>
                        <td></td>
                        <td className="p-3 text-emerald-600 font-mono text-sm">
                          {formatMoney(stats.totalCommissionsEarned)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STAFF ADVANCES & LOANS (السلف والمسحوبات) */}
          {activeTab === 'ADVANCES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    سجل السلف والمسحوبات المالية الخاصة بالموظف ({selectedStaff?.nameAr})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    متابعة المبالغ المصروفة كسلف ومواعيد استقطاعها من مسيرات الرواتب
                  </p>
                </div>
                <button
                  onClick={() => setShowAddAdvanceModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل سلفة جديدة</span>
                </button>
              </div>

              {employeeAdvances.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <TrendingDown className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-500">
                    لا توجد أي سلف أو مسحوبات مالية مسجلة باسم هذا الموظف خلال الفترة المحددة.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">م</th>
                        <th className="p-3">رقم السند</th>
                        <th className="p-3">تاريخ الصرف</th>
                        <th className="p-3 text-rose-600 font-black">مبلغ السلفة</th>
                        <th className="p-3">طريقة الصرف</th>
                        <th className="p-3">السبب / البيان</th>
                        <th className="p-3">حالة الاستقطاع والخصم</th>
                        <th className="p-3 text-amber-600 font-black">المتبقي المطلوب سداده</th>
                        <th className="p-3">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {employeeAdvances.map((adv, idx) => (
                        <tr key={adv.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-800 dark:text-white">
                            {adv.voucherNumber}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{adv.date}</td>
                          <td className="p-3 font-mono font-black text-rose-600 text-sm">
                            {formatMoney(adv.amount)}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{adv.paymentMethod}</td>
                          <td className="p-3 font-bold text-slate-800 dark:text-white">{adv.reason}</td>
                          <td className="p-3">
                            {adv.isDeducted || adv.remainingAmount === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                تم الخصم بالكامل
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                قيد التحصيل / السداد
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-black text-amber-600 text-sm">
                            {formatMoney(adv.remainingAmount)}
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">{adv.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100/70 dark:bg-slate-800 font-black text-xs text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={3} className="p-3 text-left">
                          إجمالي السلف للفترة:
                        </td>
                        <td className="p-3 text-rose-600 font-mono text-sm">
                          {formatMoney(stats.totalAdvancesAmount)}
                        </td>
                        <td colSpan={3}></td>
                        <td className="p-3 text-amber-600 font-mono text-sm">
                          {formatMoney(stats.totalAdvancesRemaining)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTODIES (العهد النقدية والعينية) */}
          {activeTab === 'CUSTODIES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    العهد النقدية والعينية المسندة رسمياً للموظف ({selectedStaff?.nameAr})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الأجهزة، المفاتيح، والعهد النقدية المسلمة للموظف مع تتبع إخلاء الطرف
                  </p>
                </div>
                <button
                  onClick={() => setShowAddCustodyModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إسناد عهدة جديدة</span>
                </button>
              </div>

              {employeeCustodies.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-500">لا توجد أي عهد مسندة لهذا الموظف حالياً.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">م</th>
                        <th className="p-3">اسم وبيان العهدة</th>
                        <th className="p-3">النوع</th>
                        <th className="p-3">الكود / الرقم التسلسلي</th>
                        <th className="p-3">القيمة التقديرية</th>
                        <th className="p-3">تاريخ الاستلام</th>
                        <th className="p-3">تاريخ الاسترداد</th>
                        <th className="p-3">حالة العهدة</th>
                        <th className="p-3">مسلمة بواسطة</th>
                        <th className="p-3">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {employeeCustodies.map((c, idx) => (
                        <tr key={c.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{c.itemName}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.type === 'نقدية'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                              }`}
                            >
                              {c.type}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-500">{c.serialNumber || '-'}</td>
                          <td className="p-3 font-mono font-bold text-slate-800 dark:text-white">
                            {c.estimatedValue ? formatMoney(c.estimatedValue) : '-'}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{c.receivedDate}</td>
                          <td className="p-3 font-mono text-slate-400">{c.returnDate || 'قيد الاستخدام'}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === 'قيد العهدة'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : c.status === 'تم إخلاء الطرف'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{c.handedBy || '-'}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleToggleCustodyStatus(c.id)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                            >
                              {c.status === 'قيد العهدة' ? 'تأكيد الاسترداد' : 'إعادة تعيين قيد العهدة'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ATTENDANCE & HOURS (الحضور والانصراف) */}
          {activeTab === 'ATTENDANCE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    سجلات الحضور والانصراف والبصمة للموظف ({selectedStaff?.nameAr})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الفترة من {dateFrom} إلى {dateTo} • ساعات العمل المحسوبة والتأخير اليومي
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    أيام الحضور: {stats.totalAttendanceDays} يوم
                  </span>
                  <span className="px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
                    أيام التأخير: {stats.totalLateDays} يوم
                  </span>
                </div>
              </div>

              {employeeAttendance.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-500">
                    لا توجد أي بصمات أو سجلات حضور مسجلة لهذا الموظف خلال الفترة المحددة.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">م</th>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3 text-emerald-600">وقت الحضور</th>
                        <th className="p-3 text-slate-500">وقت الانصراف</th>
                        <th className="p-3 font-black">ساعات العمل</th>
                        <th className="p-3 text-rose-600 font-black">دقائق التأخير</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3">مصدر التسجيل</th>
                        <th className="p-3">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {employeeAttendance.map((a, idx) => (
                        <tr key={a.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-800 dark:text-white">{a.date}</td>
                          <td className="p-3 font-mono text-emerald-600 font-bold">
                            {a.checkInTime || 'لم يسجل'}
                          </td>
                          <td className="p-3 font-mono text-slate-500">{a.checkOutTime || 'قيد الوردية'}</td>
                          <td className="p-3 font-mono font-black text-slate-800 dark:text-white">
                            {a.workHours ? `${a.workHours} س` : '8 س'}
                          </td>
                          <td className="p-3 font-mono font-black text-rose-600">
                            {a.lateMinutes && a.lateMinutes > 0 ? `${a.lateMinutes} دقيقة` : '-'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                a.status === 'Present'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : a.status === 'Late'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : a.status === 'Leave'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {a.status === 'Present'
                                ? 'حاضر بالموعد'
                                : a.status === 'Late'
                                ? 'متأخر'
                                : a.status === 'Leave'
                                ? 'إجازة'
                                : 'غياب'}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-slate-500 font-mono">
                            {a.source === 'biometric_device' ? 'بصمة خارجية' : 'تسجيل إداري'}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">{a.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PAYROLL & SALARIES (مسير الرواتب) */}
          {activeTab === 'PAYROLL' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    مسيرات الرواتب والمستحقات الشهرية الخاصة بالموظف ({selectedStaff?.nameAr})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الراتب الأساسي، البدلات، عمولات الجلسات، الخصومات والسلف، وصافي الراتب المستحق
                  </p>
                </div>
                <div className="text-xs font-bold text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                  صافي المنصرف: {formatMoney(stats.totalNetSalaryPaid)}
                </div>
              </div>

              {employeePayroll.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-500">
                    لا توجد مسيرات رواتب معتمدة لهذا الموظف خلال الفترة المحددة.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">م</th>
                        <th className="p-3">الشهر المستحق</th>
                        <th className="p-3">الراتب الأساسي</th>
                        <th className="p-3 text-cyan-600">البدلات والمكافآت</th>
                        <th className="p-3 text-emerald-600 font-black">عمولات الجلسات والنبضات</th>
                        <th className="p-3 text-rose-600">الاستقطاعات والسلف</th>
                        <th className="p-3 text-purple-600 font-black">صافي الراتب المستحق</th>
                        <th className="p-3">حالة السداد</th>
                        <th className="p-3">طريقة الصرف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {employeePayroll.map((p, idx) => (
                        <tr key={p.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-black text-slate-800 dark:text-white text-sm">
                            {p.month}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatMoney(p.basicSalary)}
                          </td>
                          <td className="p-3 font-mono text-cyan-600 font-bold">{formatMoney(p.allowances)}</td>
                          <td className="p-3 font-mono text-emerald-600 font-black">
                            {formatMoney(p.commissions)}
                          </td>
                          <td className="p-3 font-mono text-rose-600 font-bold">
                            {p.deductions > 0 ? `-${formatMoney(p.deductions)}` : '0'}
                          </td>
                          <td className="p-3 font-mono font-black text-purple-600 text-sm">
                            {formatMoney(p.netSalary)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.paymentStatus === 'Paid'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {p.paymentStatus === 'Paid' ? 'مدفوع' : 'قيد الصرف'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{p.paymentMethod || 'الخزينة الرئيسية'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: ACTIVITY LOGS (سجل الحركات الإدارية) */}
          {activeTab === 'ACTIVITY' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    سجل الحركات والعمليات الإدارية المنفذة بواسطة ({selectedStaff?.nameAr})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الرقابة الأمنية والتدقيق الداخلي على كافة الحركات المسجلة باسم الحساب
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {employeeActivity.length} حركة مسجلة
                </span>
              </div>

              {employeeActivity.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-500">لا توجد حركات إدارية مسجلة في الفترة المحددة.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">م</th>
                        <th className="p-3">التاريخ والوقت</th>
                        <th className="p-3">الشاشة / الوحدة</th>
                        <th className="p-3">نوع الحركة</th>
                        <th className="p-3">تفاصيل الحركة الإدارية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {employeeActivity.map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                            {log.timestamp ? log.timestamp.replace('T', ' ').slice(0, 19) : '-'}
                          </td>
                          <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">
                            {log.moduleNameAr || log.moduleId}
                          </td>
                          <td className="p-3 font-bold text-slate-800 dark:text-white">
                            {log.actionNameAr || log.action}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. MODAL: ADD NEW ADVANCE */}
      {showAddAdvanceModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 rounded-xl">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تسجيل سلفة نقدية جديدة للموظف
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">{selectedStaff.nameAr}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddAdvanceModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvanceSubmit} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  مبلغ السلفة بالجنيه (ج.م) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newAdvanceData.amount}
                  onChange={(e) => setNewAdvanceData({ ...newAdvanceData, amount: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm focus:outline-rose-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">تاريخ الصرف *</label>
                  <input
                    type="date"
                    required
                    value={newAdvanceData.date}
                    onChange={(e) => setNewAdvanceData({ ...newAdvanceData, date: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-rose-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">طريقة الصرف *</label>
                  <select
                    value={newAdvanceData.paymentMethod}
                    onChange={(e) => setNewAdvanceData({ ...newAdvanceData, paymentMethod: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-rose-600"
                  >
                    <option value="الخزينة الرئيسية (نقداً)">الخزينة الرئيسية (نقداً)</option>
                    <option value="عهدة الفرع">عهدة الفرع</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="إنستاباي">إنستاباي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">سبب السلفة أو البيان *</label>
                <input
                  type="text"
                  required
                  value={newAdvanceData.reason}
                  onChange={(e) => setNewAdvanceData({ ...newAdvanceData, reason: e.target.value })}
                  placeholder="مثال: سلفة مؤتمر، ظرف شخصي، مقدم مصاريف..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-rose-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات أو جدول الاستقطاع (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={newAdvanceData.notes}
                  onChange={(e) => setNewAdvanceData({ ...newAdvanceData, notes: e.target.value })}
                  placeholder="تخصم من راتب شهر... على قسط واحد أو قسطين..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-rose-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAdvanceModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition cursor-pointer shadow-md shadow-rose-600/20"
                >
                  حفظ وترحيل السلفة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: ADD NEW CUSTODY */}
      {showAddCustodyModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    إسناد عهدة جديدة للموظف
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">{selectedStaff.nameAr}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddCustodyModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustodySubmit} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">اسم العهدة أو البيان *</label>
                <input
                  type="text"
                  required
                  value={newCustodyData.itemName}
                  onChange={(e) => setNewCustodyData({ ...newCustodyData, itemName: e.target.value })}
                  placeholder="مثال: هاندبيس ليزر رقم 2، تابلت ريسيبشن، مفاتيح خزينة الفرع..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">نوع العهدة *</label>
                  <select
                    value={newCustodyData.type}
                    onChange={(e) =>
                      setNewCustodyData({ ...newCustodyData, type: e.target.value as 'عينية' | 'نقدية' })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-amber-600"
                  >
                    <option value="عينية">عينية (أجهزة / أدوات / مفاتيح)</option>
                    <option value="نقدية">نقدية (سلفة مستديمة / فكة درج)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    القيمة التقديرية (ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newCustodyData.estimatedValue}
                    onChange={(e) =>
                      setNewCustodyData({ ...newCustodyData, estimatedValue: Number(e.target.value) })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">الكود / الرقم التسلسلي</label>
                  <input
                    type="text"
                    value={newCustodyData.serialNumber}
                    onChange={(e) => setNewCustodyData({ ...newCustodyData, serialNumber: e.target.value })}
                    placeholder="SN-12345 / Asset-09"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">تاريخ الاستلام والتسليم *</label>
                  <input
                    type="date"
                    required
                    value={newCustodyData.receivedDate}
                    onChange={(e) => setNewCustodyData({ ...newCustodyData, receivedDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">ملاحظات الحالة والشروط</label>
                <textarea
                  rows={2}
                  value={newCustodyData.notes}
                  onChange={(e) => setNewCustodyData({ ...newCustodyData, notes: e.target.value })}
                  placeholder="حالة الجهاز عند التسليم، الملحقات، الشاحن، الكوابل..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-amber-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCustodyModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition cursor-pointer shadow-md shadow-amber-600/20"
                >
                  إسناد العهدة للموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: PRINT COMPREHENSIVE DOSSIER STATEMENT */}
      {showPrintModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden my-auto">
            {/* Modal Controls */}
            <div className="flex items-center justify-between p-4 bg-slate-100 border-b border-slate-200 print:hidden">
              <span className="text-xs font-bold text-slate-700">
                معاينة الطباعة: كشف حساب وملف الموظف الشامل الرسمي
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة فورية (Print)</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Sheet */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-slate-900" id="printable-employee-dossier">
              {/* Official Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black">{tenant.name}</h1>
                  <p className="text-xs text-slate-600 font-bold mt-0.5">
                    الفرع: {branches.find((b) => b.id === selectedStaff.branchId)?.name || activeBranch?.name || 'الفرع الرئيسي'}
                  </p>
                </div>
                <div className="text-left font-mono text-xs">
                  <div className="font-black text-sm">كشف حساب وملف الموظف الشامل</div>
                  <div className="text-slate-500">تاريخ الطباعة: {todayIso}</div>
                  <div className="text-slate-500">
                    الفترة: {dateFrom} إلى {dateTo}
                  </div>
                </div>
              </div>

              {/* Employee Summary Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">اسم الموظف:</span>
                  <span className="font-black text-sm">{selectedStaff.nameAr}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">المسمى الوظيفي:</span>
                  <span className="font-bold">{selectedStaff.jobTitleAr}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الراتب الأساسي:</span>
                  <span className="font-mono font-bold">
                    {formatMoney(selectedStaff.monthlySalary || selectedStaff.basicSalary || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الهاتف:</span>
                  <span className="font-mono">{selectedStaff.phone || '-'}</span>
                </div>
              </div>

              {/* Financial & Operational Stats Summary */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">إجمالي السلف بالفترة</span>
                  <span className="font-mono font-black text-rose-600 text-sm">
                    {formatMoney(stats.totalAdvancesAmount)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">العهد القائمة بعهدته</span>
                  <span className="font-mono font-black text-amber-600 text-sm">
                    {stats.totalActiveCustodiesCount} عهدة
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">جلسات التشغيل والبلصات</span>
                  <span className="font-mono font-black text-indigo-600 text-sm">
                    {stats.totalOperationsCount} جلسة ({stats.totalPulsesCount.toLocaleString()} ن)
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">أيام الحضور وساعات العمل</span>
                  <span className="font-mono font-black text-emerald-600 text-sm">
                    {stats.totalAttendanceDays} يوم ({stats.totalWorkHours} س)
                  </span>
                </div>
              </div>

              {/* Table: Operations & Pulses */}
              {employeeOperations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 border-r-4 border-indigo-600 pr-2">
                    أولاً: حركات التشغيل والبلصات المنفذة ({employeeOperations.length} جلسة)
                  </h4>
                  <table className="w-full text-right text-[11px] border border-slate-300">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5">التاريخ</th>
                        <th className="p-1.5">العميل / المريض</th>
                        <th className="p-1.5">الخدمة</th>
                        <th className="p-1.5">البلصات</th>
                        <th className="p-1.5">الإيراد</th>
                        <th className="p-1.5">المحصل</th>
                        <th className="p-1.5">العمولة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {employeeOperations.slice(0, 25).map((op, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-mono">{op.date}</td>
                          <td className="p-1.5">{op.customerName || op.patientName}</td>
                          <td className="p-1.5">{op.serviceName}</td>
                          <td className="p-1.5 font-mono">{op.pulsesCount || 0}</td>
                          <td className="p-1.5 font-mono">{formatMoney(op.totalRevenue)}</td>
                          <td className="p-1.5 font-mono">{formatMoney(op.collectedAmount || op.totalRevenue)}</td>
                          <td className="p-1.5 font-mono text-emerald-600">{formatMoney(op.calculatedCommission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table: Advances */}
              {employeeAdvances.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 border-r-4 border-rose-600 pr-2">
                    ثانياً: السلف والمسحوبات المالية ({employeeAdvances.length} سلفة)
                  </h4>
                  <table className="w-full text-right text-[11px] border border-slate-300">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5">رقم السند</th>
                        <th className="p-1.5">التاريخ</th>
                        <th className="p-1.5">المبلغ</th>
                        <th className="p-1.5">طريقة الصرف</th>
                        <th className="p-1.5">السبب</th>
                        <th className="p-1.5">الحالة</th>
                        <th className="p-1.5">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {employeeAdvances.map((adv, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-mono">{adv.voucherNumber}</td>
                          <td className="p-1.5 font-mono">{adv.date}</td>
                          <td className="p-1.5 font-mono font-bold text-rose-600">{formatMoney(adv.amount)}</td>
                          <td className="p-1.5">{adv.paymentMethod}</td>
                          <td className="p-1.5">{adv.reason}</td>
                          <td className="p-1.5">{adv.isDeducted ? 'مخصومة' : 'قيد السداد'}</td>
                          <td className="p-1.5 font-mono">{formatMoney(adv.remainingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table: Custodies */}
              {employeeCustodies.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 border-r-4 border-amber-600 pr-2">
                    ثالثاً: العهد النقدية والعينية القائمة ({employeeCustodies.length} عهدة)
                  </h4>
                  <table className="w-full text-right text-[11px] border border-slate-300">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5">اسم العهدة</th>
                        <th className="p-1.5">النوع</th>
                        <th className="p-1.5">السيريال</th>
                        <th className="p-1.5">القيمة</th>
                        <th className="p-1.5">تاريخ الاستلام</th>
                        <th className="p-1.5">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {employeeCustodies.map((c, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-bold">{c.itemName}</td>
                          <td className="p-1.5">{c.type}</td>
                          <td className="p-1.5 font-mono">{c.serialNumber || '-'}</td>
                          <td className="p-1.5 font-mono">{c.estimatedValue ? formatMoney(c.estimatedValue) : '-'}</td>
                          <td className="p-1.5 font-mono">{c.receivedDate}</td>
                          <td className="p-1.5">{c.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signatures */}
              <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs font-bold">
                <div>
                  <span className="block text-slate-500 mb-6">الموظف المقر بصحة البيانات</span>
                  <span>{selectedStaff.nameAr}</span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-6">المدير المالي والمحاسب</span>
                  <span>................................</span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-6">اعتماد الإدارة العامة</span>
                  <span>................................</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
