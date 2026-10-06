import React, { useState, useEffect } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Appointment, TreatmentPlan, Party, PatientFollowUp, StaffWorkSchedule, StaffMember } from '../types';
import { autoTranslateArabic } from '../utils/translator';
import { shareViaWhatsApp, generateBookingWhatsAppText } from '../utils/exportUtils';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Stethoscope,
  Phone,
  Sparkles,
  Layers,
  FileText,
  CreditCard,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Eye,
  Activity,
  Award,
  Edit2,
  Trash2,
  Check,
  X,
  MessageSquare,
  CalendarRange,
  CalendarCheck,
  UserPlus,
  History,
  Lock,
  GitBranch,
  Tag,
  Hash,
  Users,
  AlertTriangle,
  Briefcase,
  FileSpreadsheet,
  Download,
  ExternalLink,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import {
  ExcelDataTransferModal,
  ExcelColumnConfig,
  CellValidationError,
  ExcelValidationResult,
} from '../components/ExcelDataTransferModal';
import {
  parseExcelDate,
  parseTimeToMinutes,
  formatMinutesTo24h,
  formatMinutesTo12h,
  getAppointmentTimeRange,
  checkDoctorAppointmentConflict,
  sortAppointments,
} from '../utils/bookingTimeUtils';

const bookingsExcelColumns: ExcelColumnConfig[] = [
  {
    key: 'paperCode',
    labelAr: 'الكود الورقي',
    labelEn: 'Paper File Code',
    required: false,
    type: 'text',
    sampleValue: 'MED-1042',
    instructions: 'كود الملف الورقي للعميل. من خلاله يتم البحث آلياً في قاعدة بيانات العملاء وربط كود العميل على السيستم تلقائياً، وسيتم إصدار خطأ فوري إذا كان الكود الورقي غير مسجل بداتا العملاء.',
  },
  {
    key: 'customerCode',
    labelAr: 'كود العميل (السيستم)',
    labelEn: 'System Customer Code',
    required: false,
    type: 'text',
    sampleValue: 'CUST-1001',
    instructions: 'كود العميل الرقمي المسجل في النظام للربط المباشر مع ملف المريض والتقارير وسجل الحسابات (اختياري في حال استخدام الكود الورقي)',
  },
  {
    key: 'patientName',
    labelAr: 'اسم العميل / المريض',
    labelEn: 'Patient Name',
    required: true,
    type: 'text',
    sampleValue: 'مريم عادل الشريف',
    instructions: 'الاسم الكامل للعميل أو المريض متلقي الخدمة',
  },
  {
    key: 'patientPhone',
    labelAr: 'رقم الهاتف',
    labelEn: 'Phone Number',
    required: true,
    type: 'phone',
    sampleValue: '01234567890',
    instructions: 'رقم هاتف صالح لا يقل عن 8 أرقام',
  },
  {
    key: 'date',
    labelAr: 'تاريخ الحجز',
    labelEn: 'Booking Date',
    required: true,
    type: 'date',
    sampleValue: '2026-10-05',
    instructions: 'تاريخ الموعد بصيغة YYYY-MM-DD (مثال: 2026-10-05)',
  },
  {
    key: 'doctorName',
    labelAr: 'الطبيب المعالج / الأخصائي',
    labelEn: 'Doctor / Specialist',
    required: true,
    type: 'text',
    sampleValue: 'د. نورهان علي',
    instructions: 'اسم الطبيب المعالج المنفذ للجلسة (مطلوب للتحقق من عدم تداخل المواعيد)',
  },
  {
    key: 'startTime',
    labelAr: 'وقت بدء الجلسة (من)',
    labelEn: 'Start Time (From)',
    required: true,
    type: 'text',
    sampleValue: '10:00',
    instructions: 'وقت بداية الجلسة (مثال: 10:00 أو 10:00 AM)',
  },
  {
    key: 'endTime',
    labelAr: 'وقت انتهاء الجلسة (إلى)',
    labelEn: 'End Time (To)',
    required: true,
    type: 'text',
    sampleValue: '10:45',
    instructions: 'وقت نهاية الجلسة (مثال: 10:45 أو 10:45 AM)',
  },
  {
    key: 'serviceNameAr',
    labelAr: 'الخدمة / الجلسة',
    labelEn: 'Service Name',
    required: true,
    type: 'text',
    sampleValue: 'جلسة ليزر فول بودي كانديلا',
    instructions: 'اسم الخدمة الطبية أو الجلسة المحجوزة',
  },
  {
    key: 'price',
    labelAr: 'سعر الخدمة',
    labelEn: 'Price',
    required: false,
    type: 'number',
    sampleValue: 800,
    instructions: 'السعر التقديري أو المتفق عليه للجلسة (رقم موجب)',
  },
  {
    key: 'deposit',
    labelAr: 'العربون أو المدفوع',
    labelEn: 'Deposit Paid',
    required: false,
    type: 'number',
    sampleValue: 200,
    instructions: 'العربون المدفوع مقدماً إن وجد (0 إذا لم يدفع)',
  },
  {
    key: 'status',
    labelAr: 'حالة الحجز',
    labelEn: 'Status',
    required: false,
    type: 'text',
    sampleValue: 'Confirmed',
    instructions: 'الحالة: Confirmed (مؤكد), Scheduled (مجدول), Completed (مكتمل)',
  },
  {
    key: 'notes',
    labelAr: 'ملاحظات الحجز',
    labelEn: 'Notes',
    required: false,
    type: 'text',
    sampleValue: 'طلب غرفة ليزر 1',
    instructions: 'أي ملاحظات خاصة بالعميل أو الحجز',
  },
];

const followUpsExcelColumns: ExcelColumnConfig[] = [
  {
    key: 'paperCode',
    labelAr: 'الكود الورقي',
    labelEn: 'Paper File Code',
    required: false,
    type: 'text',
    sampleValue: 'MED-1042',
    instructions: 'كود الملف الورقي للعميل. من خلاله يتم البحث آلياً في قاعدة بيانات العملاء وربط كود العميل على السيستم تلقائياً، وسيتم إصدار خطأ فوري إذا كان الكود الورقي غير مسجل بداتا العملاء.',
  },
  {
    key: 'customerCode',
    labelAr: 'كود العميل (السيستم)',
    labelEn: 'System Customer Code',
    required: false,
    type: 'text',
    sampleValue: 'CUST-1001',
    instructions: 'كود العميل الرقمي المسجل في النظام للربط المباشر مع ملف وسجل المريض (اختياري في حال استخدام الكود الورقي)',
  },
  {
    key: 'patientName',
    labelAr: 'اسم العميل / المريض',
    labelEn: 'Patient Name',
    required: true,
    type: 'text',
    sampleValue: 'سارة عبد الله',
    instructions: 'الاسم الكامل للعميل أو متلقي المتابعة والتذكير',
  },
  {
    key: 'patientPhone',
    labelAr: 'رقم الهاتف',
    labelEn: 'Phone Number',
    required: true,
    type: 'phone',
    sampleValue: '01012345678',
    instructions: 'رقم هاتف العميل للتواصل والمتابعة عبر واتساب أو الهاتف',
  },
  {
    key: 'followUpDate',
    labelAr: 'تاريخ المتابعة والتذكير',
    labelEn: 'Follow-up Date',
    required: true,
    type: 'date',
    sampleValue: '2026-10-06',
    instructions: 'تاريخ استحقاق المتابعة بصيغة YYYY-MM-DD',
  },
  {
    key: 'followUpTime',
    labelAr: 'وقت المتابعة والتذكير',
    labelEn: 'Follow-up Time',
    required: false,
    type: 'text',
    sampleValue: '11:00 AM',
    instructions: 'توقيت إجراء المكالمة أو التذكير (مثال: 11:00 AM أو 14:00)',
  },
  {
    key: 'reason',
    labelAr: 'موضوع وسبب المتابعة',
    labelEn: 'Follow-up Reason',
    required: true,
    type: 'text',
    sampleValue: 'تذكير بموعد جلسة الرتوش وعروض الليزر',
    instructions: 'موضوع المتابعة (مثال: استفسار أسعار، متابعة ما بعد الجلسة، تذكير بموعد)',
  },
  {
    key: 'type',
    labelAr: 'نوع المتابعة',
    labelEn: 'Type',
    required: false,
    type: 'text',
    sampleValue: 'Recall',
    instructions: 'النوع: Recall (تذكير), PostTreatment (ما بعد الجلسة), Inquiry (استفسار), Complaint (شكوى), General (عام)',
  },
  {
    key: 'status',
    labelAr: 'حالة المتابعة',
    labelEn: 'Status',
    required: false,
    type: 'text',
    sampleValue: 'Pending',
    instructions: 'الحالة: Pending (قيد الانتظار), Contacted (تم التواصل), Booked (تم الحجز), NoAnswer (لم يرد), Cancelled (ملغي)',
  },
  {
    key: 'notes',
    labelAr: 'ملاحظات المتابعة',
    labelEn: 'Notes',
    required: false,
    type: 'text',
    sampleValue: 'العميل يفضل التواصل بعد الساعة 2 ظهراً',
    instructions: 'تفاصيل وملاحظات مسؤول التواصل والمتابعة',
  },
  {
    key: 'createdBy',
    labelAr: 'الموظف المسؤول',
    labelEn: 'Responsible Staff',
    required: false,
    type: 'text',
    sampleValue: 'فريق الكول سنتر',
    instructions: 'اسم الموظف أو القسم القائم بالمتابعة والتواصل',
  },
];

export const BookingsFollowUpView: React.FC = () => {
  const {
    language,
    t,
    formatMoney,
    tenant,
    activeBranch,
    branches,
    parties,
    staffMembers,
    products,
    appointments,
    patientFollowUps,
    treatmentPlans,
    addAppointment,
    updateAppointment,
    cancelAppointment,
    markAppointmentAttendance,
    rescheduleAppointment,
    addPatientFollowUp,
    updatePatientFollowUp,
    deletePatientFollowUp,
    addTreatmentPlan,
    progressTreatmentPlan,
    invoices,
    updateParty,
    addParty,
    importPartiesBulk,
    importAppointmentsBulk,
    importFollowUpsBulk,
    getNextCustomerSystemCode,
    currentUser,
    canPerformAction,
  } = usePlatform();

  const isRtl = language === 'ar';

  // Navigation Tabs (أجندة الحجوزات، حجوزات اليوم التالي، جدول المتابعات، وجدول مواعيد دوام الموظفين)
  const [activeTab, setActiveTab] = useState<'agenda' | 'next_day' | 'followup' | 'staff_schedule'>('agenda');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('All');
  
  // Date Range Filter (From Date -> To Date)
  const todayIso = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState<string>(todayIso);
  const [dateTo, setDateTo] = useState<string>(todayIso);

  // Pagination State for high-volume datasets (e.g. 62k+ records)
  const [agendaPage, setAgendaPage] = useState<number>(1);
  const [agendaRowsPerPage, setAgendaRowsPerPage] = useState<number>(50);
  const [followUpPage, setFollowUpPage] = useState<number>(1);
  const [followUpRowsPerPage, setFollowUpRowsPerPage] = useState<number>(50);

  // Quick Date Range Presets
  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().split('T')[0];
      setDateFrom(d);
      setDateTo(d);
    } else if (preset === 'week') {
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      const last = new Date(now.setDate(now.getDate() - now.getDay() + 6));
      setDateFrom(first.toISOString().split('T')[0]);
      setDateTo(last.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setDateFrom(firstDay);
      setDateTo(lastDay);
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  // Tomorrow's Date for Next Day Bookings & Schedules
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowIso = tomorrowObj.toISOString().split('T')[0];

  // Current Active Branch ID (قصر الحجوزات والمتابعات على الفرع المفعل)
  const currentBranchId = activeBranch?.id || (branches.length > 0 ? branches[0].id : 'branch-cairo');

  // =========================================================================
  // Staff Work Schedules (مواعيد ودوام الموظفين ومقدمي الخدمة بالفرع المفعل)
  // =========================================================================
  const [staffSchedules, setStaffSchedules] = useState<StaffWorkSchedule[]>(() => {
    try {
      const saved = localStorage.getItem('erp_staff_work_schedules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load staff schedules:', e);
    }
    // جدول دوام افتراضي للغد لفرع القاهرة
    return [
      {
        id: 'sch-001',
        branchId: 'branch-cairo',
        date: tomorrowIso,
        staffId: 'user-05',
        staffName: 'د. حازم القاضي',
        jobTitle: 'استشاري علاج طبيعي وتأهيل',
        startTime: '10:00 AM',
        endTime: '07:00 PM',
        notes: 'الدوام الرئيسي لليوم التالي - عيادة العلاج الطبيعي',
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('erp_staff_work_schedules', JSON.stringify(staffSchedules));
  }, [staffSchedules]);

  // Staff Schedule Tab States
  const [scheduleTargetDate, setScheduleTargetDate] = useState<string>(tomorrowIso);
  const [showAddStaffScheduleModal, setShowAddStaffScheduleModal] = useState(false);
  const [newSchStaffId, setNewSchStaffId] = useState('');
  const [newSchStaffName, setNewSchStaffName] = useState('');
  const [newSchJobTitle, setNewSchJobTitle] = useState('');
  const [newSchStartTime, setNewSchStartTime] = useState('09:00 AM');
  const [newSchEndTime, setNewSchEndTime] = useState('05:00 PM');
  const [newSchNotes, setNewSchNotes] = useState('');
  const [newSchDate, setNewSchDate] = useState(tomorrowIso);

  // Edit Staff Schedule Modal States
  const [showEditStaffScheduleModal, setShowEditStaffScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<StaffWorkSchedule | null>(null);
  const [editSchStaffId, setEditSchStaffId] = useState('');
  const [editSchStaffName, setEditSchStaffName] = useState('');
  const [editSchJobTitle, setEditSchJobTitle] = useState('');
  const [editSchStartTime, setEditSchStartTime] = useState('09:00 AM');
  const [editSchEndTime, setEditSchEndTime] = useState('05:00 PM');
  const [editSchNotes, setEditSchNotes] = useState('');
  const [editSchDate, setEditSchDate] = useState(tomorrowIso);

  // Active Branch Staff Members (الموظفون المسجلون في إدارة الموظفين للفرع المفعل حصراً)
  const branchStaffMembers = React.useMemo(() => {
    return staffMembers.filter((s) => {
      if (!s.isActive || s.isArchived) return false;
      if (!currentBranchId) return true;
      if (s.branchId) {
        return (
          s.branchId === currentBranchId ||
          (activeBranch?.name && s.branchId === activeBranch.name) ||
          (activeBranch?.code && s.branchId === activeBranch.code)
        );
      }
      if (Array.isArray(s.branchIds) && s.branchIds.length > 0) {
        return (
          s.branchIds.includes(currentBranchId) ||
          (activeBranch?.name && s.branchIds.includes(activeBranch.name))
        );
      }
      return false;
    });
  }, [staffMembers, currentBranchId, activeBranch?.name, activeBranch?.code]);

  // Handle staff selection in schedule form: Auto-populate job title!
  const handleSelectStaffForSchedule = (sId: string) => {
    setNewSchStaffId(sId);
    if (!sId) {
      setNewSchStaffName('');
      setNewSchJobTitle('');
      return;
    }
    const staff = branchStaffMembers.find((s) => s.id === sId) || staffMembers.find((s) => s.id === sId);
    if (staff) {
      setNewSchStaffName(staff.nameAr);
      const title =
        staff.jobTitleAr ||
        staff.specialtyAr ||
        (staff.roleType === 'Doctor' ? 'طبيب بشري معالج' : staff.roleType) ||
        'مقدم خدمة';
      setNewSchJobTitle(title);
    }
  };

  const handleSelectStaffForEditSchedule = (sId: string) => {
    setEditSchStaffId(sId);
    if (!sId) {
      setEditSchStaffName('');
      setEditSchJobTitle('');
      return;
    }
    const staff = branchStaffMembers.find((s) => s.id === sId) || staffMembers.find((s) => s.id === sId);
    if (staff) {
      setEditSchStaffName(staff.nameAr);
      const title =
        staff.jobTitleAr ||
        staff.specialtyAr ||
        (staff.roleType === 'Doctor' ? 'طبيب بشري معالج' : staff.roleType) ||
        'مقدم خدمة';
      setEditSchJobTitle(title);
    }
  };

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditAptModal, setShowEditAptModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showPatient360Modal, setShowPatient360Modal] = useState(false);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showAddFollowUpModal, setShowAddFollowUpModal] = useState(false);
  const [showEditFollowUpModal, setShowEditFollowUpModal] = useState(false);
  const [showQuickAddCustomerModal, setShowQuickAddCustomerModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showFollowUpExcelModal, setShowFollowUpExcelModal] = useState(false);
  const [showPatientHistoryModal, setShowPatientHistoryModal] = useState(false);
  const [patientHistorySearch, setPatientHistorySearch] = useState('');
  const [patientHistoryData, setPatientHistoryData] = useState<{
    patientId?: string;
    patientName: string;
    patientPhone?: string;
    systemCode?: string;
    paperCode?: string;
  } | null>(null);
  const [historyFilterTab, setHistoryFilterTab] = useState<'all' | 'bookings' | 'followups'>('all');

  // Quick Customer Creation Form State
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustPaperCode, setQuickCustPaperCode] = useState('');
  const [quickCustLeadSource, setQuickCustLeadSource] = useState('Facebook Ads');
  const [quickCustNotes, setQuickCustNotes] = useState('');

  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [selectedFollowUp, setSelectedFollowUp] = useState<PatientFollowUp | null>(null);
  const [selectedPatientFor360, setSelectedPatientFor360] = useState<Party | null>(null);

  // Form: Add / Edit Booking
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [systemCode, setSystemCode] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [serviceNameAr, setServiceNameAr] = useState('');
  const [serviceNameEn, setServiceNameEn] = useState('');
  const [roomNumber, setRoomNumber] = useState('غرفة 1');
  const [aptDate, setAptDate] = useState(todayIso);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:45');
  const [aptTime, setAptTime] = useState('10:00 - 10:45');
  const [price, setPrice] = useState<number>(500);
  const [deposit, setDeposit] = useState<number>(0);
  const [leadSource, setLeadSource] = useState('Facebook Ads');
  const [notes, setNotes] = useState('');

  // Form: Follow-up
  const [fupPatientId, setFupPatientId] = useState('');
  const [fupPatientName, setFupPatientName] = useState('');
  const [fupPatientPhone, setFupPatientPhone] = useState('');
  const [fupSystemCode, setFupSystemCode] = useState('');
  const [fupCustomerCode, setFupCustomerCode] = useState('');
  const [fupDate, setFupDate] = useState(tomorrowIso);
  const [fupTime, setFupTime] = useState('11:00 AM');
  const [fupReason, setFupReason] = useState('استفسار عن عروض الليزر');
  const [fupType, setFupType] = useState<'Inquiry' | 'PostTreatment' | 'Recall' | 'Complaint' | 'General'>('Inquiry');
  const [fupNotes, setFupNotes] = useState('');
  const [fupStatus, setFupStatus] = useState<'Pending' | 'Contacted' | 'Booked' | 'Cancelled' | 'NoAnswer'>('Pending');

  // Cancel & Attendance Reasons
  const [cancelReason, setCancelReason] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<'Attended' | 'NotAttended'>('Attended');
  const [notAttendedReason, setNotAttendedReason] = useState('الهاتف مغلق / لم يرد');

  // Reschedule Form
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('10:00');
  const [newEndTime, setNewEndTime] = useState('10:45');
  const [newTime, setNewTime] = useState('10:00 - 10:45');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  // New Treatment Plan Form
  const [planPatientId, setPlanPatientId] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planDoctorName, setPlanDoctorName] = useState('');
  const [planTotalSessions, setPlanTotalSessions] = useState<number>(6);
  const [planTotalCost, setPlanTotalCost] = useState<number>(3000);

  // Ultra-Fast O(1) indexed maps for parties
  const partyMap = React.useMemo(() => {
    const byId = new Map<string, Party>();
    const byName = new Map<string, Party>();
    const byPhone = new Map<string, Party>();
    const byCode = new Map<string, Party>();

    for (let i = 0; i < parties.length; i++) {
      const p = parties[i];
      if (p.id) byId.set(p.id, p);
      if (p.name) byName.set(p.name.toLowerCase().trim(), p);
      if (p.phone) byPhone.set(p.phone.trim(), p);
      if (p.systemCode) byCode.set(p.systemCode.toLowerCase().trim(), p);
      if (p.paperCode) byCode.set(p.paperCode.toLowerCase().trim(), p);
      if (p.code) byCode.set(p.code.toLowerCase().trim(), p);
    }
    return { byId, byName, byPhone, byCode };
  }, [parties]);

  // Helper: Find Party by patient name or ID in O(1)
  const getPartyForPatient = (pId?: string, pName?: string) => {
    return (pId ? partyMap.byId.get(pId) : undefined) ||
           (pName ? partyMap.byName.get(pName.toLowerCase().trim()) : undefined);
  };

  // Ultra-Fast O(1) Future Status Lookup Maps for upcoming events
  const { futureAptMap, futureFupMap } = React.useMemo(() => {
    const aptMap = new Map<string, Appointment>();
    const fupMap = new Map<string, PatientFollowUp>();

    for (let i = 0; i < appointments.length; i++) {
      const a = appointments[i];
      if (a.date >= todayIso && a.status !== 'Cancelled') {
        if (a.patientId && !aptMap.has(a.patientId)) aptMap.set(a.patientId, a);
        if (a.patientPhone && !aptMap.has(a.patientPhone)) aptMap.set(a.patientPhone, a);
        if (a.patientName) {
          const k = a.patientName.toLowerCase().trim();
          if (!aptMap.has(k)) aptMap.set(k, a);
        }
      }
    }

    for (let i = 0; i < patientFollowUps.length; i++) {
      const f = patientFollowUps[i];
      if (f.followUpDate >= todayIso && f.status === 'Pending') {
        if (f.patientId && !fupMap.has(f.patientId)) fupMap.set(f.patientId, f);
        if (f.patientPhone && !fupMap.has(f.patientPhone)) fupMap.set(f.patientPhone, f);
        if (f.patientName) {
          const k = f.patientName.toLowerCase().trim();
          if (!fupMap.has(k)) fupMap.set(k, f);
        }
      }
    }

    return { futureAptMap: aptMap, futureFupMap: fupMap };
  }, [appointments, patientFollowUps, todayIso]);

  // Helper: Get Future Status for a customer in O(1)
  const getCustomerFutureStatus = (patientName: string, patientPhone?: string, patientId?: string, currentAptId?: string) => {
    const nameKey = (patientName || '').toLowerCase().trim();
    const candidateApt =
      (patientId ? futureAptMap.get(patientId) : undefined) ||
      (patientPhone ? futureAptMap.get(patientPhone) : undefined) ||
      (nameKey ? futureAptMap.get(nameKey) : undefined);

    const futureApt = candidateApt && candidateApt.id !== currentAptId ? candidateApt : null;

    const futureFup =
      (patientId ? futureFupMap.get(patientId) : undefined) ||
      (patientPhone ? futureFupMap.get(patientPhone) : undefined) ||
      (nameKey ? futureFupMap.get(nameKey) : undefined);

    if (futureApt) {
      return {
        type: 'apt',
        label: `${t('حجز قادم:', 'Booking:')} ${futureApt.date} (${futureApt.time})`,
        badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200',
      };
    }

    if (futureFup) {
      return {
        type: 'fup',
        label: `${t('متابعة قادمة:', 'Follow-up:')} ${futureFup.followUpDate}`,
        badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
      };
    }

    return null;
  };

  // Branch Customers (strictly active branch customers)
  const branchCustomers = React.useMemo(() => {
    return parties.filter((p) => {
      const isCustomer = p.type === 'Customer' || p.type === 'Both';
      if (!isCustomer) return false;
      if (currentBranchId) {
        const matchesBranch =
          p.branchId === currentBranchId ||
          (activeBranch?.name && p.branchId === activeBranch.name) ||
          (activeBranch?.code && p.branchId === activeBranch.code) ||
          (Array.isArray(p.branchIds) && (p.branchIds.includes(currentBranchId) || (activeBranch?.name && p.branchIds.includes(activeBranch.name)))) ||
          (!p.branchId && (!p.branchIds || p.branchIds.length === 0) && currentBranchId === (branches[0]?.id || 'branch-cairo'));
        return Boolean(matchesBranch);
      }
      return true;
    });
  }, [parties, activeBranch?.id, activeBranch?.name, activeBranch?.code, currentBranchId, branches]);

  // Branch Appointments strictly filtered by active branch in O(N) using partyMap
  const branchAppointments = React.useMemo(() => {
    return appointments.filter((apt) => {
      if (!currentBranchId) return true;
      if (apt.branchId) {
        return (
          apt.branchId === currentBranchId ||
          (activeBranch?.name && apt.branchId === activeBranch.name) ||
          (activeBranch?.code && apt.branchId === activeBranch.code)
        );
      }
      const p = (apt.patientId ? partyMap.byId.get(apt.patientId) : undefined) ||
                (apt.patientName ? partyMap.byName.get(apt.patientName.toLowerCase().trim()) : undefined);
      if (p) {
        return (
          p.branchId === currentBranchId ||
          (activeBranch?.name && p.branchId === activeBranch.name) ||
          (Array.isArray(p.branchIds) && p.branchIds.includes(currentBranchId))
        );
      }
      return currentBranchId === (branches[0]?.id || 'branch-cairo');
    });
  }, [appointments, currentBranchId, activeBranch?.name, activeBranch?.code, partyMap, branches]);

  // Branch Follow-ups strictly filtered by active branch in O(N) using partyMap
  const branchFollowUps = React.useMemo(() => {
    return patientFollowUps.filter((fup) => {
      if (!currentBranchId) return true;
      if (fup.branchId) {
        return (
          fup.branchId === currentBranchId ||
          (activeBranch?.name && fup.branchId === activeBranch.name) ||
          (activeBranch?.code && fup.branchId === activeBranch.code)
        );
      }
      const p = (fup.patientId ? partyMap.byId.get(fup.patientId) : undefined) ||
                (fup.patientName ? partyMap.byName.get(fup.patientName.toLowerCase().trim()) : undefined);
      if (p) {
        return (
          p.branchId === currentBranchId ||
          (activeBranch?.name && p.branchId === activeBranch.name) ||
          (Array.isArray(p.branchIds) && p.branchIds.includes(currentBranchId))
        );
      }
      return currentBranchId === (branches[0]?.id || 'branch-cairo');
    });
  }, [patientFollowUps, currentBranchId, activeBranch?.name, activeBranch?.code, partyMap, branches]);

  // Filtered Appointments (Search by name, phone, or systemCode, with Date Range)
  // Evaluated ONLY when on agenda tab or excel modal to keep tab switching instantaneous
  const filteredAppointments = React.useMemo(() => {
    if (activeTab !== 'agenda' && !showExcelModal) {
      return [];
    }

    const q = searchQuery.toLowerCase().trim();
    const hasSearch = Boolean(q);
    const sourcePool = hasSearch ? appointments : branchAppointments;

    const list = sourcePool.filter((apt) => {
      const matchesSearch =
        !hasSearch ||
        Boolean(apt.patientName && apt.patientName.toLowerCase().includes(q)) ||
        Boolean(apt.patientPhone && apt.patientPhone.includes(q)) ||
        Boolean(apt.systemCode && apt.systemCode.toLowerCase().includes(q)) ||
        Boolean(apt.customerCode && apt.customerCode.toLowerCase().includes(q)) ||
        Boolean(apt.paperCode && apt.paperCode.toLowerCase().includes(q)) ||
        Boolean(apt.serviceNameAr && apt.serviceNameAr.toLowerCase().includes(q)) ||
        Boolean(apt.doctorName && apt.doctorName.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'All' || apt.status === statusFilter;
      const matchesDoctor = selectedDoctorId === 'All' || apt.doctorId === selectedDoctorId;
      
      const matchesDate =
        hasSearch ||
        ((!dateFrom || (apt.date && apt.date >= dateFrom)) && (!dateTo || (apt.date && apt.date <= dateTo)));

      return matchesSearch && matchesStatus && matchesDoctor && matchesDate;
    });

    return sortAppointments(list);
  }, [branchAppointments, appointments, searchQuery, statusFilter, selectedDoctorId, activeTab, showExcelModal, dateFrom, dateTo]);

  // Pagination for Agenda Table
  const totalAgendaPages = Math.ceil(filteredAppointments.length / (agendaRowsPerPage || 50)) || 1;
  const paginatedAppointments = React.useMemo(() => {
    if (agendaRowsPerPage === -1) return filteredAppointments;
    const start = (agendaPage - 1) * agendaRowsPerPage;
    return filteredAppointments.slice(start, start + agendaRowsPerPage);
  }, [filteredAppointments, agendaPage, agendaRowsPerPage]);

  // Next Day Appointments (حجوزات اليوم التالي المستقلة للفرع المفعل) - Sorted by Date -> Doctor -> Start Time
  // Evaluated ONLY when on next_day tab
  const nextDayAppointments = React.useMemo(() => {
    if (activeTab !== 'next_day') return [];
    const q = searchQuery.toLowerCase().trim();
    const hasSearch = Boolean(q);

    const list = branchAppointments.filter((apt) => {
      const isTomorrow = apt.date === tomorrowIso;
      if (!isTomorrow) return false;

      const matchesSearch =
        !hasSearch ||
        Boolean(apt.patientName && apt.patientName.toLowerCase().includes(q)) ||
        Boolean(apt.patientPhone && apt.patientPhone.includes(q)) ||
        Boolean(apt.systemCode && apt.systemCode.toLowerCase().includes(q)) ||
        Boolean(apt.customerCode && apt.customerCode.toLowerCase().includes(q)) ||
        Boolean(apt.paperCode && apt.paperCode.toLowerCase().includes(q)) ||
        Boolean(apt.serviceNameAr && apt.serviceNameAr.toLowerCase().includes(q)) ||
        Boolean(apt.doctorName && apt.doctorName.toLowerCase().includes(q));

      return matchesSearch;
    });

    return sortAppointments(list);
  }, [branchAppointments, tomorrowIso, searchQuery, activeTab]);

  // Filtered Patient Follow-ups for active branch
  // Evaluated ONLY when on followup tab or follow-up excel modal
  const filteredFollowUps = React.useMemo(() => {
    if (activeTab !== 'followup' && !showFollowUpExcelModal) return [];
    const q = searchQuery.toLowerCase().trim();
    const hasSearch = Boolean(q);
    const sourcePool = hasSearch ? patientFollowUps : branchFollowUps;

    return sourcePool.filter((fup) => {
      const matchesSearch =
        !hasSearch ||
        Boolean(fup.patientName && fup.patientName.toLowerCase().includes(q)) ||
        Boolean(fup.patientPhone && fup.patientPhone.includes(q)) ||
        Boolean(fup.systemCode && fup.systemCode.toLowerCase().includes(q)) ||
        Boolean(fup.customerCode && fup.customerCode.toLowerCase().includes(q)) ||
        Boolean(fup.paperCode && fup.paperCode.toLowerCase().includes(q)) ||
        Boolean(fup.reason && fup.reason.toLowerCase().includes(q)) ||
        Boolean(fup.notes && fup.notes.toLowerCase().includes(q));

      const matchesDate =
        hasSearch ||
        ((!dateFrom || (fup.followUpDate && fup.followUpDate >= dateFrom)) && (!dateTo || (fup.followUpDate && fup.followUpDate <= dateTo)));

      return matchesSearch && matchesDate;
    });
  }, [branchFollowUps, patientFollowUps, searchQuery, dateFrom, dateTo, activeTab, showFollowUpExcelModal]);

  // Pagination for Follow-ups Table
  const totalFollowUpPages = Math.ceil(filteredFollowUps.length / (followUpRowsPerPage || 50)) || 1;
  const paginatedFollowUps = React.useMemo(() => {
    if (followUpRowsPerPage === -1) return filteredFollowUps;
    const start = (followUpPage - 1) * followUpRowsPerPage;
    return filteredFollowUps.slice(start, start + followUpRowsPerPage);
  }, [filteredFollowUps, followUpPage, followUpRowsPerPage]);

  // Coded Sellable Products / Services only (without raw stock supplies)
  const sellableServices = React.useMemo(() => {
    return products.filter((p) => {
      if (p.isActive === false) return false;
      if (p.itemType === 'stock_raw' || p.itemType === 'consumable' || p.itemType === 'medical_supply') {
        return false;
      }
      return (
        p.itemType === 'service' ||
        p.itemType === 'sales_service' ||
        p.itemType === 'sales_product' ||
        p.itemType === 'sales_package' ||
        p.itemType === 'product' ||
        p.isSalesItem ||
        p.isService ||
        !p.isStockItem
      );
    });
  }, [products]);

  // Check if a doctor has attendance / schedule in tomorrow's staff schedules
  // Check if a doctor has attendance / schedule in tomorrow's staff schedules for active branch
  const isDoctorScheduledForTomorrow = (doctorId?: string, doctorName?: string) => {
    return branchStaffSchedules.some(
      (s) =>
        s.date === tomorrowIso &&
        ((doctorId && s.staffId === doctorId) || (doctorName && s.staffName.trim() === doctorName.trim()))
    );
  };

  // Helper: Check if staff member is eligible for bookings (مؤدى خدمة مفعل + يستقبل حجوزات)
  // الموظف الغير مفعل له مؤدى خدمة لا يظهر، ومستقبل الحجوزات فقط من يظهر
  const isStaffAcceptingBookings = (s: StaffMember) => {
    if (!s.isActive || s.isArchived) return false;
    return s.isServiceProvider === true && s.acceptsBookings === true;
  };

  // Doctors / Staff available for selection depending on date:
  // Tomorrow's bookings: strictly branch staff who accept bookings AND have a schedule entry for tomorrow!
  // Future dates or today: strictly branch staff who accept bookings!
  const getAvailableDoctorsForDate = (targetDate: string) => {
    const isTomorrow = targetDate === tomorrowIso;
    if (isTomorrow) {
      const scheduledTomorrowStaffIds = new Set(
        branchStaffSchedules
          .filter((s) => s.date === tomorrowIso)
          .map((s) => s.staffId)
      );

      return branchStaffMembers.filter((s) => {
        return isStaffAcceptingBookings(s) && scheduledTomorrowStaffIds.has(s.id);
      });
    }

    // Future days or today: any branch staff member with active acceptsBookings profile
    return branchStaffMembers.filter((s) => {
      return isStaffAcceptingBookings(s);
    });
  };

  // Fallback booking doctors for general views (strictly active branch staff who accept bookings)
  const bookingDoctors = React.useMemo(() => {
    return branchStaffMembers.filter((s) => s.isActive && !s.isArchived && isStaffAcceptingBookings(s));
  }, [branchStaffMembers]);

  // Quick Action: Open Add Follow-Up for a specific Patient
  const handleOpenAddFollowUpForPatient = (patientIdParam?: string, patientNameParam?: string, patientPhoneParam?: string, systemCodeParam?: string) => {
    setFupPatientId(patientIdParam || '');
    setFupPatientName(patientNameParam || '');
    setFupPatientPhone(patientPhoneParam || '');
    setFupSystemCode(systemCodeParam || '');
    setFupDate(tomorrowIso);
    setFupReason('متابعة دورية وتذكير');
    setFupNotes('');
    setFupStatus('Pending');
    setShowAddFollowUpModal(true);
  };

  // Quick Action: Open Add Booking for a specific Patient
  const handleOpenAddBookingForPatient = (patientIdParam?: string, patientNameParam?: string, patientPhoneParam?: string, systemCodeParam?: string, leadSourceParam?: string) => {
    if (patientIdParam) {
      handleSelectExistingPatient(patientIdParam);
    } else {
      setPatientId('');
      setPatientName(patientNameParam || '');
      setPatientPhone(patientPhoneParam || '');
      setSystemCode(systemCodeParam || '');
      setLeadSource(leadSourceParam || 'زيارة مباشرة للفرع');
    }
    setAptDate(todayIso);
    setShowAddModal(true);
  };

  const handleSelectExistingPatient = (pId: string) => {
    setPatientId(pId);
    if (!pId) {
      setPatientName('');
      setPatientPhone('');
      setSystemCode('');
      setLeadSource('زيارة مباشرة للفرع');
      return;
    }
    const p = parties.find((party) => party.id === pId);
    if (p) {
      setPatientName(p.name);
      setPatientPhone(p.phone);
      setSystemCode(p.systemCode || p.paperCode || '');
      setLeadSource(p.leadSource || 'زيارة مباشرة للفرع');
    }
  };

  // Quick Customer Creation
  const handleQuickAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim() || !quickCustPhone.trim()) {
      alert(t('يرجى إدخال اسم العميل ورقم هاتفه!', 'Please enter customer name and phone!'));
      return;
    }

    const newParty = addParty({
      name: quickCustName.trim(),
      nameEn: autoTranslateArabic(quickCustName),
      phone: quickCustPhone.trim(),
      paperCode: quickCustPaperCode.trim() || undefined,
      leadSource: quickCustLeadSource || 'زيارة مباشرة للفرع',
      medicalNotes: quickCustNotes.trim() || undefined,
      type: 'Customer',
      category: 'Patient',
      branchId: currentBranchId,
      balance: 0,
      creditLimit: 5000,
    });

    handleSelectExistingPatient(newParty.id);
    setShowQuickAddCustomerModal(false);
    setQuickCustName('');
    setQuickCustPhone('');
    setQuickCustPaperCode('');
    setQuickCustNotes('');
  };

  // Submit Add Booking
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !patientName.trim()) {
      alert(t('يرجى اختيار العميل من عملاء الفرع المفعل أولاً أو إضافته من زر (+ إضافة عميل جديد)!', 'Please select a registered branch customer or add a new client!'));
      return;
    }

    if (!doctorId && !doctorName.trim()) {
      alert(t('اختيار الطبيب المعالج إجباري لتسجيل الحجز!', 'Doctor name is mandatory for bookings!'));
      return;
    }

    const doc = bookingDoctors.find((s) => s.id === doctorId) || staffMembers.find((s) => s.id === doctorId);
    const resolvedDoctorName = doc ? doc.nameAr : doctorName.trim() || 'د. استشاري';
    const existingParty = parties.find((p) => p.id === patientId);

    // Validate No Overlapping Sessions for the same doctor on the same date
    const conflict = checkDoctorAppointmentConflict(
      aptDate,
      doctorId || undefined,
      resolvedDoctorName,
      startTime,
      endTime,
      appointments
    );

    if (conflict.hasConflict) {
      alert(isRtl ? conflict.reasonAr : conflict.reasonEn);
      return;
    }

    const formattedTime = startTime && endTime ? `${startTime} - ${endTime}` : (aptTime || startTime);
    const resolvedCustomerCode = existingParty?.systemCode || customerCode || systemCode || `CUST-${Date.now().toString().slice(-4)}`;

    addAppointment({
      patientId,
      branchId: currentBranchId,
      systemCode: resolvedCustomerCode,
      customerCode: resolvedCustomerCode,
      patientName: existingParty?.name || patientName.trim(),
      patientPhone: existingParty?.phone || patientPhone.trim(),
      doctorId: doctorId || undefined,
      doctorName: resolvedDoctorName,
      serviceNameAr: serviceNameAr.trim() || 'كشف واستشارة طبية',
      serviceNameEn: serviceNameAr.trim(),
      date: aptDate,
      time: formattedTime,
      startTime: startTime,
      endTime: endTime,
      price: 0,
      deposit: 0,
      remainingBalance: 0,
      leadSource: existingParty?.leadSource || leadSource || 'زيارة مباشرة للفرع',
      status: 'Scheduled',
      notes,
    });

    // Reset Form
    setPatientId('');
    setPatientName('');
    setPatientPhone('');
    setSystemCode('');
    setCustomerCode('');
    setDoctorId('');
    setDoctorName('');
    setServiceNameAr('');
    setStartTime('10:00');
    setEndTime('10:45');
    setNotes('');
    setShowAddModal(false);
  };

  // Quick Confirm Next Day Booking (Tentative / Scheduled -> Confirmed)
  const handleToggleConfirmBooking = (apt: Appointment) => {
    const nextStatus = apt.status === 'Confirmed' ? 'Scheduled' : 'Confirmed';
    updateAppointment(apt.id, { status: nextStatus });
  };

  // Open Edit Modal for Booking
  const handleOpenEditApt = (apt: Appointment) => {
    setSelectedApt(apt);
    setPatientId(apt.patientId || '');
    setPatientName(apt.patientName);
    setPatientPhone(apt.patientPhone || '');
    setSystemCode(apt.systemCode || '');
    setCustomerCode(apt.customerCode || apt.systemCode || '');
    setDoctorId(apt.doctorId || '');
    setDoctorName(apt.doctorName || '');
    setServiceNameAr(apt.serviceNameAr);
    setAptDate(apt.date);

    const range = getAppointmentTimeRange(apt);
    const sTime = apt.startTime || (range.startMin !== null ? formatMinutesTo24h(range.startMin) : '10:00');
    const eTime = apt.endTime || (range.endMin !== null ? formatMinutesTo24h(range.endMin) : '10:45');
    setStartTime(sTime);
    setEndTime(eTime);
    setAptTime(apt.time || `${sTime} - ${eTime}`);
    setLeadSource(apt.leadSource || 'زيارة مباشرة للفرع');
    setNotes(apt.notes || '');
    setShowEditAptModal(true);
  };

  const handleEditAptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt) return;
    const doc = bookingDoctors.find((s) => s.id === doctorId) || staffMembers.find((s) => s.id === doctorId);
    const resolvedDoctorName = doc ? doc.nameAr : doctorName || selectedApt.doctorName;

    // Validate No Overlapping Sessions for the same doctor (excluding current apt)
    const conflict = checkDoctorAppointmentConflict(
      aptDate,
      doctorId || undefined,
      resolvedDoctorName,
      startTime,
      endTime,
      appointments,
      selectedApt.id
    );

    if (conflict.hasConflict) {
      alert(isRtl ? conflict.reasonAr : conflict.reasonEn);
      return;
    }

    const formattedTime = startTime && endTime ? `${startTime} - ${endTime}` : (aptTime || startTime);

    updateAppointment(selectedApt.id, {
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      systemCode,
      customerCode: customerCode || systemCode,
      doctorId: doctorId || undefined,
      doctorName: resolvedDoctorName,
      serviceNameAr: serviceNameAr.trim(),
      serviceNameEn: serviceNameAr.trim(),
      date: aptDate,
      time: formattedTime,
      startTime,
      endTime,
      price: 0,
      deposit: 0,
      remainingBalance: 0,
      leadSource,
      notes,
    });

    setShowEditAptModal(false);
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApt && cancelReason.trim()) {
      cancelAppointment(selectedApt.id, cancelReason);
      setShowCancelModal(false);
    }
  };

  const handleAttendanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApt) {
      markAppointmentAttendance(
        selectedApt.id,
        attendanceStatus === 'Attended',
        attendanceStatus === 'NotAttended' ? notAttendedReason : undefined
      );
      setShowAttendanceModal(false);
    }
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt || !newDate || !newStartTime || !newEndTime) return;

    // Overlap validation for reschedule
    const conflict = checkDoctorAppointmentConflict(
      newDate,
      selectedApt.doctorId,
      selectedApt.doctorName,
      newStartTime,
      newEndTime,
      appointments,
      selectedApt.id
    );

    if (conflict.hasConflict) {
      alert(isRtl ? conflict.reasonAr : conflict.reasonEn);
      return;
    }

    const formattedTime = `${newStartTime} - ${newEndTime}`;
    rescheduleAppointment(selectedApt.id, newDate, formattedTime, rescheduleNotes);
    updateAppointment(selectedApt.id, {
      date: newDate,
      time: formattedTime,
      startTime: newStartTime,
      endTime: newEndTime,
    });
    setShowRescheduleModal(false);
  };

  const handleOpen360 = (apt: Appointment) => {
    const party = parties.find((p) => p.name === apt.patientName || p.phone === apt.patientPhone);
    if (party) {
      setSelectedPatientFor360(party);
    } else {
      setSelectedPatientFor360({
        id: apt.patientId || 'temp',
        tenantId: tenant.id,
        name: apt.patientName,
        phone: apt.patientPhone || 'غير مسجل',
        type: 'Customer',
        systemCode: apt.systemCode || 'CUST-TEMP',
        leadSource: apt.leadSource,
        createdAt: apt.createdAt,
      });
    }
    setShowPatient360Modal(true);
  };

  // Add Follow-Up Form Submit
  const handleAddFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = getPartyForPatient(fupPatientId, fupPatientName);
    const finalCode = fupSystemCode || p?.systemCode || `CUST-${Date.now().toString().slice(-4)}`;

    addPatientFollowUp({
      patientId: fupPatientId || p?.id,
      branchId: currentBranchId,
      patientName: fupPatientName.trim(),
      patientPhone: fupPatientPhone.trim(),
      systemCode: finalCode,
      leadSource: p?.leadSource || 'Facebook Ads',
      followUpDate: fupDate,
      reason: fupReason.trim(),
      type: fupType,
      status: fupStatus,
      notes: fupNotes.trim(),
    });

    // Reset
    setFupPatientId('');
    setFupPatientName('');
    setFupPatientPhone('');
    setFupSystemCode('');
    setFupNotes('');
    setShowAddFollowUpModal(false);
  };

  // Convert Follow-Up to Real Booking
  const handleConvertFollowUpToBooking = (fup: PatientFollowUp) => {
    setPatientId(fup.patientId || '');
    setPatientName(fup.patientName);
    setPatientPhone(fup.patientPhone);
    setSystemCode(fup.systemCode || '');
    setLeadSource(fup.leadSource || 'متابعة هاتفية');
    setServiceNameAr(fup.reason || 'جلسة علاجية');
    setAptDate(fup.followUpDate || tomorrowIso);
    setNotes(`تم التحويل من سجل المتابعات: ${fup.notes || ''}`);
    setShowAddModal(true);
  };

  // Inline update Lead Source for Patient
  const handleUpdateLeadSource = (partyId?: string, aptId?: string, newSrc?: string) => {
    if (!newSrc) return;
    if (partyId) {
      updateParty(partyId, { leadSource: newSrc });
    }
    if (aptId) {
      updateAppointment(aptId, { leadSource: newSrc });
    }
  };

  // Open Patient Detailed History Modal (All bookings & follow-ups in rows)
  const handleOpenPatientHistory = (pId?: string, pName?: string, pPhone?: string) => {
    setPatientHistoryData({
      patientId: pId,
      patientName: pName || '',
      patientPhone: pPhone,
    });
    setPatientHistorySearch(pName || pPhone || '');
    setShowPatientHistoryModal(true);
  };

  // Branch Staff Schedules strictly filtered by current branch and schedule target date
  const branchStaffSchedules = React.useMemo(() => {
    return staffSchedules.filter((s) => {
      const matchBranch =
        !currentBranchId ||
        s.branchId === currentBranchId ||
        (activeBranch?.name && s.branchId === activeBranch.name);
      const matchDate = !scheduleTargetDate || s.date === scheduleTargetDate;
      return matchBranch && matchDate;
    });
  }, [staffSchedules, currentBranchId, activeBranch, scheduleTargetDate]);

  // Handle Add Staff Schedule
  const handleAddStaffScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchStaffId || !newSchStaffName.trim()) return;

    const newSchedule: StaffWorkSchedule = {
      id: `sch-${Date.now()}`,
      tenantId: tenant?.id || 'demo-tenant',
      branchId: currentBranchId,
      staffId: newSchStaffId,
      staffName: newSchStaffName.trim(),
      jobTitle: newSchJobTitle || 'مقدم خدمة',
      date: newSchDate || scheduleTargetDate || tomorrowIso,
      startTime: newSchStartTime || '09:00 AM',
      endTime: newSchEndTime || '05:00 PM',
      notes: newSchNotes.trim(),
    };

    setStaffSchedules((prev) => [newSchedule, ...prev]);
    setShowAddStaffScheduleModal(false);
    setNewSchStaffId('');
    setNewSchStaffName('');
    setNewSchJobTitle('');
    setNewSchNotes('');
  };

  // Open Edit Staff Schedule Modal
  const handleOpenEditStaffSchedule = (sch: StaffWorkSchedule) => {
    setEditingSchedule(sch);
    setEditSchStaffId(sch.staffId);
    setEditSchStaffName(sch.staffName);
    setEditSchJobTitle(sch.jobTitle || '');
    setEditSchDate(sch.date);
    setEditSchStartTime(sch.startTime);
    setEditSchEndTime(sch.endTime);
    setEditSchNotes(sch.notes || '');
    setShowEditStaffScheduleModal(true);
  };

  // Handle Edit Staff Schedule Submit
  const handleEditStaffScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule || !editSchStaffId || !editSchStaffName.trim()) return;

    setStaffSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== editingSchedule.id) return s;
        return {
          ...s,
          staffId: editSchStaffId,
          staffName: editSchStaffName.trim(),
          jobTitle: editSchJobTitle || 'مقدم خدمة',
          date: editSchDate || scheduleTargetDate || tomorrowIso,
          startTime: editSchStartTime || '09:00 AM',
          endTime: editSchEndTime || '05:00 PM',
          notes: editSchNotes.trim(),
        };
      })
    );
    setShowEditStaffScheduleModal(false);
    setEditingSchedule(null);
  };

  // Handle Delete Staff Schedule
  const handleDeleteStaffSchedule = (schId: string) => {
    if (window.confirm(t('هل تريد حذف موعد دوام هذا الموظف؟', 'Delete this staff schedule entry?'))) {
      setStaffSchedules((prev) => prev.filter((s) => s.id !== schId));
    }
  };

  // High-Performance O(N) Validator for Bookings Excel with Paper Code Verification & Ultra-Fast Processing
  const validateBookingRows = async (
    rawRows: any[],
    onProgress?: (current: number, total: number, msg: string) => void
  ): Promise<ExcelValidationResult<any>> => {
    const errors: CellValidationError[] = [];
    const validRows: any[] = [];
    const allRowsAsIs: any[] = [];
    const allRowsWithFallback: any[] = [];
    const totalCount = rawRows.length;
    const MAX_RECORDED_ERRORS = 200;
    let totalErrorsCount = 0;

    // 1. Pre-index existing customers in HashMaps for instant O(1) lookups
    const partiesByPaperCode = new Map<string, Party>();
    const partiesBySystemCode = new Map<string, Party>();
    const partiesByPhone = new Map<string, Party>();
    const partiesByName = new Map<string, Party>();

    parties.forEach((p) => {
      if (p.paperCode) partiesByPaperCode.set(p.paperCode.trim().toLowerCase(), p);
      if (p.systemCode) partiesBySystemCode.set(p.systemCode.trim().toLowerCase(), p);
      if (p.id) partiesBySystemCode.set(p.id.trim().toLowerCase(), p);
      if (p.phone) {
        const clean = p.phone.replace(/[^0-9]/g, '');
        if (clean) partiesByPhone.set(clean, p);
      }
      if (p.name) partiesByName.set(p.name.trim().toLowerCase(), p);
    });

    // 2. Pre-index existing system appointments by `${date}__${doctorName}`
    const sysAppointmentsMap = new Map<string, Array<{ startMin: number; endMin: number; patientName: string; aptId: string }>>();
    appointments.forEach((apt) => {
      if (apt.status === 'Cancelled') return;
      if (!apt.date || !apt.doctorName) return;
      const { startMin, endMin } = getAppointmentTimeRange(apt);
      if (startMin === null || endMin === null) return;
      const key = `${apt.date}__${apt.doctorName.trim().toLowerCase()}`;
      let list = sysAppointmentsMap.get(key);
      if (!list) {
        list = [];
        sysAppointmentsMap.set(key, list);
      }
      list.push({ startMin, endMin, patientName: apt.patientName, aptId: apt.id });
    });

    // 3. Map to track sessions within the file for duplicate/overlap detection
    const fileSessionsMap = new Map<string, Array<{ startMin: number; endMin: number; patientName: string; rowNum: number; startTime: string; endTime: string }>>();

    // 4. Process in chunks to maintain UI responsiveness and update progress
    const CHUNK_SIZE = 5000;
    for (let i = 0; i < totalCount; i += CHUNK_SIZE) {
      const sliceEnd = Math.min(i + CHUNK_SIZE, totalCount);

      if (onProgress) {
        onProgress(i, totalCount, `جاري مطابقة وفحص صفوف الحجوزات: ${i.toLocaleString('ar-EG')} من ${totalCount.toLocaleString('ar-EG')}...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));

      for (let index = i; index < sliceEnd; index++) {
        const row = rawRows[index];
        const rowNum = index + 2;

        const paperCode = String(
          row['الكود الورقي'] ??
          row['كود الملف الورقي'] ??
          row['الكود الورقي للعميل'] ??
          row['كود الورقي'] ??
          row['Paper Code'] ??
          row['PaperCode'] ??
          ''
        ).trim();

        const customerCode = String(
          row['كود العميل (السيستم)'] ??
          row['كود العميل'] ??
          row['كود المريض'] ??
          row['Customer Code'] ??
          row['System Code'] ??
          row['Code'] ??
          ''
        ).trim();

        let patientName = String(
          row['اسم العميل / المريض'] ??
          row['اسم المريض'] ??
          row['الاسم'] ??
          row['Patient Name'] ??
          ''
        ).trim();

        let patientPhone = String(
          row['رقم الهاتف'] ??
          row['الموبايل'] ??
          row['الهاتف'] ??
          row['Phone Number'] ??
          row['Phone'] ??
          ''
        ).trim();

        const rawDateVal =
          row['تاريخ الحجز'] ??
          row['التاريخ'] ??
          row['تاريخ الموعد'] ??
          row['تاريخ الجلسة'] ??
          row['موعد الحجز'] ??
          row['Booking Date'] ??
          row['Date'] ??
          row['Appointment Date'] ??
          '';

        const doctorName = String(
          row['الطبيب المعالج / الأخصائي'] ??
          row['الطبيب / الأخصائي'] ??
          row['الطبيب'] ??
          row['Doctor'] ??
          row['Doctor / Specialist'] ??
          ''
        ).trim();

        // Extract Start and End times with full support for formats and Excel times
        const rawStartVal = row['وقت بدء الجلسة (من)'] ?? row['وقت البدء'] ?? row['من'] ?? row['Start Time'] ?? row['Start Time (From)'] ?? '';
        const rawEndVal = row['وقت انتهاء الجلسة (إلى)'] ?? row['وقت الانتهاء'] ?? row['إلى'] ?? row['End Time'] ?? row['End Time (To)'] ?? '';
        const rawTimeVal = row['وقت الحجز'] ?? row['الوقت'] ?? row['Booking Time'] ?? row['Time'] ?? '';

        let startMin = parseTimeToMinutes(rawStartVal);
        let endMin = parseTimeToMinutes(rawEndVal);

        if (startMin === null && rawTimeVal) {
          const rawTimeStr = String(rawTimeVal).trim();
          if (rawTimeStr.includes(' - ')) {
            const parts = rawTimeStr.split(' - ');
            startMin = parseTimeToMinutes(parts[0]);
            endMin = parseTimeToMinutes(parts[1]);
          } else {
            startMin = parseTimeToMinutes(rawTimeStr);
            if (startMin !== null && endMin === null) {
              endMin = (startMin + 45) % 1440;
            }
          }
        }

        if (startMin === null) {
          startMin = 600; // Default: 10:00 AM
        }
        if (endMin === null) {
          endMin = (startMin + 45) % 1440;
        }

        const startTime = formatMinutesTo24h(startMin);
        const endTime = formatMinutesTo24h(endMin);

        const serviceNameAr = String(row['الخدمة / الجلسة'] ?? row['الخدمة'] ?? row['اسم الخدمة'] ?? row['Service Name'] ?? '').trim();
        const rawPrice = row['سعر الخدمة'] !== undefined && row['سعر الخدمة'] !== '' ? row['سعر الخدمة'] : (row['Price'] || 0);
        const rawDeposit = row['العربون أو المدفوع'] !== undefined && row['العربون أو المدفوع'] !== '' ? row['العربون أو المدفوع'] : (row['Deposit Paid'] || 0);
        const status = String(row['حالة الحجز'] ?? row['الحالة'] ?? row['Status'] ?? 'Confirmed').trim();
        const notes = String(row['ملاحظات الحجز'] ?? row['ملاحظات'] ?? row['Notes'] ?? '').trim();

        // Paper Code Matching & Strict Error Check (شرط إلزامي: خطأ إذا كان الكود الورقي غير مسجل)
        let matchedParty: Party | undefined = undefined;
        let hasPaperCodeError = false;

        if (paperCode) {
          matchedParty = partiesByPaperCode.get(paperCode.toLowerCase());
          if (!matchedParty) {
            hasPaperCodeError = true;
            totalErrorsCount++;
            if (errors.length < MAX_RECORDED_ERRORS) {
              errors.push({
                rowNumber: rowNum,
                columnKey: 'paperCode',
                columnLabelAr: 'الكود الورقي',
                enteredValue: paperCode,
                reasonAr: `الكود الورقي (${paperCode}) غير مسجل في قاعدة بيانات العملاء بالسيستم! يرجى تسجيل العميل أولاً بسجل العملاء أو تصحيح الكود الورقي.`,
              });
            }
          } else {
            // Auto-fill customer details from database automatically
            if (!patientName) patientName = matchedParty.name;
            if (!patientPhone) patientPhone = matchedParty.phone || '';
          }
        } else if (customerCode) {
          matchedParty = partiesBySystemCode.get(customerCode.toLowerCase());
          if (matchedParty) {
            if (!patientName) patientName = matchedParty.name;
            if (!patientPhone) patientPhone = matchedParty.phone || '';
          }
        } else if (patientPhone) {
          const clean = patientPhone.replace(/[^0-9]/g, '');
          if (clean) {
            matchedParty = partiesByPhone.get(clean);
            if (matchedParty && !patientName) {
              patientName = matchedParty.name;
            }
          }
        } else if (patientName) {
          matchedParty = partiesByName.get(patientName.toLowerCase());
        }

        const resolvedCustomerCode = matchedParty?.systemCode || customerCode || (matchedParty ? matchedParty.systemCode || matchedParty.id : '');
        const resolvedPatientId = matchedParty?.id;

        // Validate patient name
        if (!patientName || patientName.length < 2) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'patientName',
              columnLabelAr: 'اسم العميل / المريض',
              enteredValue: patientName,
              reasonAr: 'اسم العميل أو المريض مطلوب، ولم يتم التعرف عليه من الكود الورقي',
            });
          }
        }

        // Validate phone
        const cleanPhone = patientPhone.replace(/[^0-9+]/g, '');
        if (!patientPhone) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'patientPhone',
              columnLabelAr: 'رقم الهاتف',
              enteredValue: patientPhone,
              reasonAr: 'رقم هاتف العميل مطلوب لتأكيد الحجز والتواصل',
            });
          }
        } else if (cleanPhone.length < 7) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'patientPhone',
              columnLabelAr: 'رقم الهاتف',
              enteredValue: patientPhone,
              reasonAr: 'رقم الهاتف غير صالح، يجب ألا يقل عن 7 أرقام',
            });
          }
        }

        // Validate Date Universally with parseExcelDate (يدعم كل الصيغ والأرقام وسلاسل إكسيل)
        const cleanDate = parseExcelDate(rawDateVal);
        if (!cleanDate) {
          const enteredStr = rawDateVal instanceof Date ? rawDateVal.toLocaleDateString('en-CA') : String(rawDateVal || '').trim();
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'date',
              columnLabelAr: 'تاريخ الحجز',
              enteredValue: enteredStr || '«فارغ»',
              reasonAr: !enteredStr
                ? 'تاريخ الحجز مطلوب وإلزامي في ملف الحجوزات'
                : `تاريخ الحجز (${enteredStr}) غير صالح، يرجى كتابة التاريخ بصيغة يوم/شهر/سنة أو سنة-شهر-يوم (مثال: 2026-10-05 أو 05/10/2026)`,
            });
          }
        }

        // Validate Doctor
        if (!doctorName) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'doctorName',
              columnLabelAr: 'الطبيب المعالج / الأخصائي',
              enteredValue: doctorName,
              reasonAr: 'اسم الطبيب المعالج إلزامي للتحقق من عدم تداخل الجلسات',
            });
          }
        }

        // Validate Start and End Time order
        if (rawStartVal && rawEndVal && endMin <= startMin) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'endTime',
              columnLabelAr: 'وقت انتهاء الجلسة (إلى)',
              enteredValue: `${startTime} - ${endTime}`,
              reasonAr: 'وقت نهاية الجلسة (إلى) يجب أن يكون بعد وقت بدايتها (من)',
            });
          }
        }

        // Check Session Overlap for Same Doctor on Same Date in O(1)
        if (startMin !== null && endMin !== null && doctorName && cleanDate && !hasPaperCodeError) {
          const docKey = `${cleanDate}__${doctorName.toLowerCase().trim()}`;
          let hasConflict = false;

          // 1. Check against file sessions for this doctor
          const fileSessions = fileSessionsMap.get(docKey);
          if (fileSessions) {
            for (const s of fileSessions) {
              if (startMin < s.endMin && s.startMin < endMin) {
                hasConflict = true;
                totalErrorsCount++;
                if (errors.length < MAX_RECORDED_ERRORS) {
                  errors.push({
                    rowNumber: rowNum,
                    columnKey: 'startTime',
                    columnLabelAr: 'وقت بدء الجلسة (من)',
                    enteredValue: `${startTime} - ${endTime}`,
                    reasonAr: `تعارض جلسات داخل الملف: الطبيب (${doctorName}) لديه حجز في نفس اليوم مع (${s.patientName}) في نفس التوقيت (${s.startTime} - ${s.endTime}).`,
                  });
                }
                break;
              }
            }
          }

          // 2. Check against system appointments for this doctor
          if (!hasConflict) {
            const sysSessions = sysAppointmentsMap.get(docKey);
            if (sysSessions) {
              for (const s of sysSessions) {
                if (startMin < s.endMin && s.startMin < endMin) {
                  hasConflict = true;
                  totalErrorsCount++;
                  if (errors.length < MAX_RECORDED_ERRORS) {
                    errors.push({
                      rowNumber: rowNum,
                      columnKey: 'startTime',
                      columnLabelAr: 'وقت بدء الجلسة (من)',
                      enteredValue: `${startTime} - ${endTime}`,
                      reasonAr: `تعارض مع حجز مسجل مسبقاً في النظام: الطبيب (${doctorName}) لديه موعد مع المريض (${s.patientName}) في نفس اليوم والتوقيت.`,
                    });
                  }
                  break;
                }
              }
            }
          }

          // Register in fileSessionsMap for subsequent rows if no conflict
          let list = fileSessionsMap.get(docKey);
          if (!list) {
            list = [];
            fileSessionsMap.set(docKey, list);
          }
          list.push({ startMin, endMin, patientName, rowNum, startTime, endTime });
        }

        // Validate service
        if (!serviceNameAr) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'serviceNameAr',
              columnLabelAr: 'الخدمة / الجلسة',
              enteredValue: serviceNameAr,
              reasonAr: 'اسم الخدمة أو الجلسة مطلوب لتحديد نوع الموعد الطبي',
            });
          }
        }

        const priceNum = Number(rawPrice);
        const depositNum = Number(rawDeposit);

        const isRowStrictValid =
          cleanDate !== null &&
          Boolean(doctorName) &&
          Boolean(serviceNameAr) &&
          Boolean(patientName && patientName.length >= 2) &&
          Boolean(cleanPhone && cleanPhone.length >= 7) &&
          !hasPaperCodeError;

        const bookingRecord = {
          paperCode,
          customerCode: resolvedCustomerCode,
          patientId: resolvedPatientId,
          patientName,
          patientPhone: cleanPhone || patientPhone,
          date: cleanDate || '2026-10-05',
          startTime,
          endTime,
          startMin,
          endMin,
          time: `${startTime} - ${endTime}`,
          serviceNameAr: serviceNameAr || 'جلسة علاجية',
          doctorName: doctorName || 'الأخصائي المناوب',
          price: isNaN(priceNum) ? 0 : priceNum,
          deposit: isNaN(depositNum) ? 0 : depositNum,
          remainingBalance: Math.max(0, (isNaN(priceNum) ? 0 : priceNum) - (isNaN(depositNum) ? 0 : depositNum)),
          status: status === 'Scheduled' || status === 'Completed' || status === 'Cancelled' ? status : 'Confirmed',
          notes,
        };

        if (isRowStrictValid) {
          validRows.push(bookingRecord);
        }

        // AS-IS RECORD for forced upload (الرفع الإجباري كما هي بأخطائها دون أي تعديل أو استبدال)
        // الفاضي يفضل فاضي ومفيش حاجة تتغير أو تروح
        const enteredDateStr = rawDateVal instanceof Date 
          ? rawDateVal.toLocaleDateString('en-CA') 
          : String(rawDateVal || '').trim();
        const dateAsIs = cleanDate || enteredDateStr || '';

        const asIsBookingRecord = {
          paperCode: paperCode || '',
          customerCode: resolvedCustomerCode || customerCode || '',
          patientId: resolvedPatientId || '',
          patientName: patientName || '',
          patientPhone: cleanPhone || patientPhone || '',
          date: dateAsIs,
          startTime: startTime || String(rawStartVal || '').trim(),
          endTime: endTime || String(rawEndVal || '').trim(),
          startMin,
          endMin,
          time: (startTime && endTime) ? `${startTime} - ${endTime}` : (String(rawTimeVal || '').trim() || startTime || endTime || ''),
          serviceNameAr: serviceNameAr || '',
          serviceNameEn: serviceNameAr ? autoTranslateArabic(serviceNameAr) : '',
          doctorName: doctorName || '',
          price: isNaN(priceNum) ? 0 : priceNum,
          deposit: isNaN(depositNum) ? 0 : depositNum,
          remainingBalance: Math.max(0, (isNaN(priceNum) ? 0 : priceNum) - (isNaN(depositNum) ? 0 : depositNum)),
          status: status === 'Scheduled' || status === 'Completed' || status === 'Cancelled' ? status : 'Confirmed',
          notes: notes || '',
        };

        allRowsAsIs.push(asIsBookingRecord);
        allRowsWithFallback.push(asIsBookingRecord);
      }
    }

    if (onProgress) {
      onProgress(totalCount, totalCount, 'اكتملت مطابقة وفحص ملف الحجوزات بنجاح!');
    }

    return {
      totalRows: rawRows.length,
      errors,
      totalErrorsCount,
      validRows,
      allRowsAsIs,
      allRowsWithFallback: allRowsAsIs,
    };
  };

  // Safe High-Performance Bulk Import for Bookings: Auto-links customer code, preserves raw data as-is without dummy fallbacks
  const handleConfirmBookingsImport = async (validRows: any[]) => {
    const branchToUse = activeBranch?.id || currentBranchId;
    const newPartiesList: Omit<Party, 'id' | 'tenantId'>[] = [];
    const appointmentsToCreate: Omit<Appointment, 'id' | 'tenantId'>[] = [];
    const createdPartiesKeyMap = new Map<string, string>();

    validRows.forEach((row, idx) => {
      let resolvedCustomerCode = row.customerCode || '';
      let resolvedPartyId = row.patientId || '';

      // Only create party in customers database if at least patientName or phone or paperCode is provided
      if (!resolvedPartyId && (row.patientName || row.patientPhone || row.paperCode)) {
        const partyKey = row.patientPhone 
          ? row.patientPhone.replace(/[^0-9]/g, '') 
          : (row.patientName ? row.patientName.toLowerCase().trim() : (row.paperCode ? `p-${row.paperCode.toLowerCase().trim()}` : ''));
        
        if (partyKey && createdPartiesKeyMap.has(partyKey)) {
          resolvedPartyId = createdPartiesKeyMap.get(partyKey) || '';
        } else if (partyKey) {
          resolvedPartyId = `imported-party-${Date.now()}-${idx}`;
          createdPartiesKeyMap.set(partyKey, resolvedPartyId);

          newPartiesList.push({
            name: row.patientName || '',
            phone: row.patientPhone || '',
            paperCode: row.paperCode || undefined,
            systemCode: resolvedCustomerCode || undefined,
            type: 'Customer',
            branchId: branchToUse,
            leadSource: 'استيراد إكسيل',
            balance: 0,
          });
        }
      }

      appointmentsToCreate.push({
        patientId: resolvedPartyId || '',
        patientName: row.patientName || '',
        patientPhone: row.patientPhone || '',
        paperCode: row.paperCode || undefined,
        systemCode: resolvedCustomerCode || row.customerCode || '',
        customerCode: resolvedCustomerCode || row.customerCode || '',
        date: row.date || '',
        time: row.time || (row.startTime && row.endTime ? `${row.startTime} - ${row.endTime}` : (row.startTime || row.endTime || '')),
        startTime: row.startTime || '',
        endTime: row.endTime || '',
        serviceNameAr: row.serviceNameAr || '',
        serviceNameEn: row.serviceNameEn || (row.serviceNameAr ? autoTranslateArabic(row.serviceNameAr) : ''),
        doctorName: row.doctorName || '',
        price: Number(row.price) || 0,
        deposit: Number(row.deposit) || 0,
        remainingBalance: Number(row.remainingBalance) || 0,
        status: row.status || 'Confirmed',
        branchId: branchToUse,
        leadSource: 'استيراد إكسيل',
        notes: row.notes || '',
      });
    });

    if (newPartiesList.length > 0) {
      await importPartiesBulk(newPartiesList);
    }

    await importAppointmentsBulk(appointmentsToCreate);
    // Reset date filter to all so newly imported rows are immediately shown in table
    setDateFrom('');
    setDateTo('');
    setAgendaPage(1);
    setShowExcelModal(false);
  };

  // High-Performance O(N) Validator for Patient Follow-ups & Reminders Excel with Paper Code Verification
  const validateFollowUpRows = async (
    rawRows: any[],
    onProgress?: (current: number, total: number, msg: string) => void
  ): Promise<ExcelValidationResult<any>> => {
    const errors: CellValidationError[] = [];
    const validRows: any[] = [];
    const allRowsAsIs: any[] = [];
    const allRowsWithFallback: any[] = [];
    const totalCount = rawRows.length;
    const MAX_RECORDED_ERRORS = 200;
    let totalErrorsCount = 0;

    // Pre-index existing customers in HashMaps for instant O(1) lookups
    const partiesByPaperCode = new Map<string, Party>();
    const partiesBySystemCode = new Map<string, Party>();
    const partiesByPhone = new Map<string, Party>();
    const partiesByName = new Map<string, Party>();

    parties.forEach((p) => {
      if (p.paperCode) partiesByPaperCode.set(p.paperCode.trim().toLowerCase(), p);
      if (p.systemCode) partiesBySystemCode.set(p.systemCode.trim().toLowerCase(), p);
      if (p.id) partiesBySystemCode.set(p.id.trim().toLowerCase(), p);
      if (p.phone) {
        const clean = p.phone.replace(/[^0-9]/g, '');
        if (clean) partiesByPhone.set(clean, p);
      }
      if (p.name) partiesByName.set(p.name.trim().toLowerCase(), p);
    });

    const CHUNK_SIZE = 5000;
    for (let i = 0; i < totalCount; i += CHUNK_SIZE) {
      const sliceEnd = Math.min(i + CHUNK_SIZE, totalCount);

      if (onProgress) {
        onProgress(i, totalCount, `جاري مطابقة وفحص صفوف المتابعات: ${i.toLocaleString('ar-EG')} من ${totalCount.toLocaleString('ar-EG')}...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));

      for (let index = i; index < sliceEnd; index++) {
        const row = rawRows[index];
        const rowNum = index + 2;

        const paperCode = String(
          row['الكود الورقي'] ??
          row['كود الملف الورقي'] ??
          row['الكود الورقي للعميل'] ??
          row['كود الورقي'] ??
          row['Paper Code'] ??
          row['PaperCode'] ??
          ''
        ).trim();

        const customerCode = String(
          row['كود العميل (السيستم)'] ??
          row['كود العميل'] ??
          row['كود المريض'] ??
          row['Customer Code'] ??
          row['System Code'] ??
          row['Code'] ??
          ''
        ).trim();

        let patientName = String(
          row['اسم العميل / المريض'] ??
          row['اسم المريض'] ??
          row['الاسم'] ??
          row['Patient Name'] ??
          ''
        ).trim();

        let patientPhone = String(
          row['رقم الهاتف'] ??
          row['الموبايل'] ??
          row['الهاتف'] ??
          row['Phone Number'] ??
          row['Phone'] ??
          ''
        ).trim();

        const rawDateVal =
          row['تاريخ المتابعة والتذكير'] ??
          row['تاريخ المتابعة'] ??
          row['تاريخ التذكير'] ??
          row['التاريخ'] ??
          row['Follow-up Date'] ??
          row['Followup Date'] ??
          row['Date'] ??
          row['Reminder Date'] ??
          '';

        const followUpTime = String(row['وقت المتابعة والتذكير'] ?? row['وقت المتابعة'] ?? row['الوقت'] ?? row['Follow-up Time'] ?? row['Time'] ?? '11:00 AM').trim();
        const reason = String(row['موضوع وسبب المتابعة'] ?? row['موضوع المتابعة'] ?? row['السبب'] ?? row['Reason'] ?? row['Follow-up Reason'] ?? '').trim();
        const type = String(row['نوع المتابعة'] ?? row['النوع'] ?? row['Type'] ?? 'Recall').trim();
        const status = String(row['حالة المتابعة'] ?? row['الحالة'] ?? row['Status'] ?? 'Pending').trim();
        const notes = String(row['ملاحظات المتابعة'] ?? row['ملاحظات'] ?? row['Notes'] ?? '').trim();
        const createdBy = String(row['الموظف المسؤول'] ?? row['المسؤول'] ?? row['Created By'] ?? row['Responsible Staff'] ?? currentUser?.name ?? 'فريق المتابعة').trim();

        // Paper Code Matching & Strict Error Check
        let matchedParty: Party | undefined = undefined;

        if (paperCode) {
          matchedParty = partiesByPaperCode.get(paperCode.toLowerCase());
          if (!matchedParty) {
            totalErrorsCount++;
            if (errors.length < MAX_RECORDED_ERRORS) {
              errors.push({
                rowNumber: rowNum,
                columnKey: 'paperCode',
                columnLabelAr: 'الكود الورقي',
                enteredValue: paperCode,
                reasonAr: `الكود الورقي (${paperCode}) غير مسجل في قاعدة بيانات العملاء بالسيستم! يرجى تسجيل العميل أولاً بسجل العملاء أو تصحيح الكود الورقي.`,
              });
            }
          } else {
            // Auto-fill customer details from database automatically
            if (!patientName) patientName = matchedParty.name;
            if (!patientPhone) patientPhone = matchedParty.phone || '';
          }
        } else if (customerCode) {
          matchedParty = partiesBySystemCode.get(customerCode.toLowerCase());
          if (matchedParty) {
            if (!patientName) patientName = matchedParty.name;
            if (!patientPhone) patientPhone = matchedParty.phone || '';
          }
        } else if (patientPhone) {
          const clean = patientPhone.replace(/[^0-9]/g, '');
          if (clean) {
            matchedParty = partiesByPhone.get(clean);
            if (matchedParty && !patientName) {
              patientName = matchedParty.name;
            }
          }
        } else if (patientName) {
          matchedParty = partiesByName.get(patientName.toLowerCase());
        }

        const resolvedCustomerCode = matchedParty?.systemCode || customerCode || (matchedParty ? matchedParty.systemCode || matchedParty.id : '');
        const resolvedPatientId = matchedParty?.id;

        if (!patientName || patientName.length < 2) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'patientName',
              columnLabelAr: 'اسم العميل / المريض',
              enteredValue: patientName,
              reasonAr: 'اسم العميل أو المريض مطلوب، ولم يتم التعرف عليه من الكود الورقي',
            });
          }
        }

        const cleanPhone = patientPhone.replace(/[^0-9+]/g, '');
        if (!patientPhone) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'patientPhone',
              columnLabelAr: 'رقم الهاتف',
              enteredValue: patientPhone,
              reasonAr: 'رقم هاتف العميل مطلوب للتواصل والمتابعة',
            });
          }
        } else if (cleanPhone.length < 7) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'patientPhone',
              columnLabelAr: 'رقم الهاتف',
              enteredValue: patientPhone,
              reasonAr: 'رقم الهاتف غير صالح، يجب ألا يقل عن 7 أرقام',
            });
          }
        }

        const cleanDate = parseExcelDate(rawDateVal);
        if (!cleanDate) {
          const enteredStr = rawDateVal instanceof Date ? rawDateVal.toLocaleDateString('en-CA') : String(rawDateVal || '').trim();
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'followUpDate',
              columnLabelAr: 'تاريخ المتابعة والتذكير',
              enteredValue: enteredStr || '«فارغ»',
              reasonAr: !enteredStr
                ? 'تاريخ المتابعة والتذكير مطلوب وإلزامي'
                : `تاريخ المتابعة (${enteredStr}) غير صالح، يرجى كتابة التاريخ بصيغة يوم/شهر/سنة أو سنة-شهر-يوم (مثال: 2026-10-06 أو 06/10/2026)`,
            });
          }
        }

        if (!reason) {
          totalErrorsCount++;
          if (errors.length < MAX_RECORDED_ERRORS) {
            errors.push({
              rowNumber: rowNum,
              columnKey: 'reason',
              columnLabelAr: 'موضوع وسبب المتابعة',
              enteredValue: reason,
              reasonAr: 'موضوع وسبب المتابعة مطلوب لتوجيه فريق التواصل',
            });
          }
        }

        const isRowStrictValid =
          cleanDate !== null &&
          Boolean(reason) &&
          Boolean(patientName && patientName.length >= 2) &&
          Boolean(cleanPhone && cleanPhone.length >= 7) &&
          (!paperCode || matchedParty !== undefined);

        const followUpRecord = {
          paperCode,
          customerCode: resolvedCustomerCode,
          patientId: resolvedPatientId,
          patientName,
          patientPhone: cleanPhone || patientPhone,
          followUpDate: cleanDate || '2026-10-06',
          followUpTime,
          reason: reason || 'متابعة دورية',
          type: type === 'PostTreatment' || type === 'Recall' || type === 'Complaint' || type === 'General' ? type : 'Inquiry',
          status: status === 'Contacted' || status === 'Booked' || status === 'Cancelled' || status === 'NoAnswer' ? status : 'Pending',
          notes,
          createdBy,
        };

        if (isRowStrictValid) {
          validRows.push(followUpRecord);
        }

        // AS-IS RECORD for forced upload (الرفع الإجباري كما هي بأخطائها دون أي تعديل أو استبدال)
        const enteredDateStr = rawDateVal instanceof Date 
          ? rawDateVal.toLocaleDateString('en-CA') 
          : String(rawDateVal || '').trim();
        const dateAsIs = cleanDate || enteredDateStr || '';

        const asIsFollowUpRecord = {
          paperCode: paperCode || '',
          customerCode: resolvedCustomerCode || customerCode || '',
          patientId: resolvedPatientId || '',
          patientName: patientName || '',
          patientPhone: cleanPhone || patientPhone || '',
          followUpDate: dateAsIs,
          followUpTime: followUpTime || '',
          reason: reason || '',
          type: type || 'General',
          status: status || 'Pending',
          notes: notes || '',
          createdBy: createdBy || currentUser?.name || 'فريق المتابعة',
        };

        allRowsAsIs.push(asIsFollowUpRecord);
        allRowsWithFallback.push(asIsFollowUpRecord);
      }
    }

    if (onProgress) {
      onProgress(totalCount, totalCount, 'اكتملت مطابقة وفحص ملف المتابعات والتذكير بنجاح!');
    }

    return {
      totalRows: rawRows.length,
      errors,
      totalErrorsCount,
      validRows,
      allRowsAsIs,
      allRowsWithFallback: allRowsAsIs,
    };
  };

  // Safe High-Performance Bulk Import for Follow-ups in O(1): preserves raw data as-is without dummy fallbacks
  const handleConfirmFollowUpsImport = async (validRows: any[]) => {
    const branchToUse = activeBranch?.id || currentBranchId;
    const newPartiesList: Omit<Party, 'id' | 'tenantId'>[] = [];
    const fupsToCreate: Omit<PatientFollowUp, 'id' | 'tenantId' | 'createdAt'>[] = [];
    const createdPartiesKeyMap = new Map<string, string>();

    validRows.forEach((row, idx) => {
      let resolvedCustomerCode = row.customerCode || '';
      let resolvedPartyId = row.patientId || '';

      if (!resolvedPartyId && (row.patientName || row.patientPhone || row.paperCode)) {
        const partyKey = row.patientPhone 
          ? row.patientPhone.replace(/[^0-9]/g, '') 
          : (row.patientName ? row.patientName.toLowerCase().trim() : (row.paperCode ? `p-${row.paperCode.toLowerCase().trim()}` : ''));
        
        if (partyKey && createdPartiesKeyMap.has(partyKey)) {
          resolvedPartyId = createdPartiesKeyMap.get(partyKey) || '';
        } else if (partyKey) {
          resolvedPartyId = `imported-fup-party-${Date.now()}-${idx}`;
          createdPartiesKeyMap.set(partyKey, resolvedPartyId);

          newPartiesList.push({
            name: row.patientName || '',
            phone: row.patientPhone || '',
            paperCode: row.paperCode || undefined,
            systemCode: resolvedCustomerCode || undefined,
            type: 'Customer',
            branchId: branchToUse,
            leadSource: 'استيراد إكسيل للمتابعات',
            balance: 0,
          });
        }
      }

      fupsToCreate.push({
        patientId: resolvedPartyId || '',
        patientName: row.patientName || '',
        patientPhone: row.patientPhone || '',
        paperCode: row.paperCode || undefined,
        systemCode: resolvedCustomerCode || row.customerCode || '',
        customerCode: resolvedCustomerCode || row.customerCode || '',
        branchId: branchToUse,
        followUpDate: row.followUpDate || '',
        followUpTime: row.followUpTime || '',
        reason: row.reason || '',
        type: row.type || 'General',
        status: row.status || 'Pending',
        notes: row.notes || '',
        createdBy: row.createdBy || currentUser?.name || 'فريق المتابعة',
      });
    });

    if (newPartiesList.length > 0) {
      await importPartiesBulk(newPartiesList);
    }

    await importFollowUpsBulk(fupsToCreate);
    // Reset date filter to all so newly imported follow-ups are immediately shown in table
    setDateFrom('');
    setDateTo('');
    setFollowUpPage(1);
    setShowFollowUpExcelModal(false);
  };

  return (
    <div className="flex flex-col min-h-full p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header & Main Nav Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                  {t('إدارة الحجوزات', 'Bookings Management')}
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-full">
                  {appointments.length} {t('حجز مسجل', 'Bookings')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'جدولة وتأكيد حجوزات المرضى، واستعراض سجل الحجوزات والمتابعات التفصيلي',
                  'Schedule and confirm patient bookings, and explore detailed timeline history'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Add Client Shortcut Button */}
          <button
            onClick={() => {
              setQuickCustName('');
              setQuickCustPhone('');
              setQuickCustPaperCode('');
              setQuickCustNotes('');
              setShowQuickAddCustomerModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-all cursor-pointer shadow-xs"
            title={t('إضافة مريض / عميل جديد سريعاً', 'Add New Client')}
          >
            <UserPlus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('إضافة عميل جديد', 'Add Client')}</span>
          </button>

          {/* Detailed Patient History Shortcut Button (يبدأ فارغاً للبحث فقط بدون عميل افتراضي) */}
          <button
            onClick={() => {
              setPatientHistoryData(null);
              setPatientHistorySearch('');
              setShowPatientHistoryModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer shadow-xs"
            title={t('عرض سجل الحجوزات والمتابعات التفصيلي لأي مريض بالبحث بكود السيستم أو الورقي أو الهاتف أو الاسم', 'View detailed patient history with search by code, phone or name')}
          >
            <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('سجل مريض تفصيلي', 'Patient History')}</span>
          </button>

          {/* Import / Export Excel Modal Button (Dynamic for Bookings or Follow-ups) */}
          {activeTab === 'followup' ? (
            <button
              onClick={() => setShowFollowUpExcelModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all cursor-pointer shadow-xs"
              title={t('استيراد وتصدير جدول المتابعات والتذكير وفحص الملفات', 'Import and Export Follow-ups & Reminders')}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>{t('إكسيل المتابعات والتذكير', 'Follow-ups Excel')}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowExcelModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all cursor-pointer shadow-xs"
              title={t('استيراد وتصدير الحجوزات وفحص الملفات', 'Import and Export Bookings')}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>{t('إكسيل الحجوزات (استيراد/تصدير)', 'Bookings Excel')}</span>
            </button>
          )}

          {/* Open in New Tab Button (فتح شاشة الحجوزات في تبويب جديد) */}
          <a
            href="?view=bookings"
            target="_blank"
            rel="noopener noreferrer"
            title={t('فتح هذه الشاشة في تبويب جديد (Open in New Tab)', 'Open bookings in new tab')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <ExternalLink className="h-3.5 w-3.5 text-indigo-600" />
            <span>{t('فتح في تبويب جديد', 'New Tab')}</span>
          </a>

          {/* Tabs Pill */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('agenda')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'agenda'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('أجندة الحجوزات', 'Bookings Agenda')}
            </button>
            <button
              onClick={() => setActiveTab('next_day')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'next_day'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>{t('حجوزات اليوم التالي', "Next Day's Bookings")}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            </button>
            <button
              onClick={() => setActiveTab('followup')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'followup'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{t('جدول المتابعات (تذكير)', 'Follow-ups (Reminders)')}</span>
            </button>
            <button
              onClick={() => setActiveTab('staff_schedule')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'staff_schedule'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>{t('مواعيد دوام الموظفين', 'Staff Schedule')}</span>
            </button>
          </div>

          {/* Action Buttons */}
          {activeTab === 'staff_schedule' ? (
            <button
              onClick={() => {
                setNewSchStaffId('');
                setNewSchStaffName('');
                setNewSchJobTitle('');
                setNewSchNotes('');
                setNewSchDate(scheduleTargetDate || tomorrowIso);
                setShowAddStaffScheduleModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t('إضافة موعد موظف', 'Add Staff Schedule')}</span>
            </button>
          ) : activeTab === 'followup' ? (
            canPerformAction('bookings.add_followup') && (
              <button
                onClick={() => setShowAddFollowUpModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>{t('تسجيل متابعة مريض جديد', 'Add Follow-up')}</span>
              </button>
            )
          ) : (
            canPerformAction('bookings.create_booking') && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{t('حجز موعد جديد', 'New Booking')}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Advanced Filter Bar (Name, Phone, System Code, Date Range & Presets) */}
      {activeTab !== 'next_day' && activeTab !== 'staff_schedule' && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search by Name, Phone, or System Code */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('بحث باسم المريض، رقم التليفون، أو كود السيستم...', 'Search by patient name, phone, or code...')}
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            {/* Date Range: From */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">{t('من:', 'From:')}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-bold"
              />
            </div>

            {/* Date Range: To */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">{t('إلى:', 'To:')}</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-bold"
              />
            </div>

            {/* Doctor Filter */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <Stethoscope className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden font-medium"
              >
                <option value="All">{t('كافة الأطباء والأخصائيين', 'All Doctors')}</option>
                {branchStaffMembers
                  .filter((s) => isStaffAcceptingBookings(s))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nameAr}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Date Quick Presets & Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">{t('الفترة السريعة:', 'Quick Range:')}</span>
              <button
                type="button"
                onClick={() => setDatePreset('today')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
              >
                {t('اليوم', 'Today')}
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('week')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
              >
                {t('هذا الأسبوع', 'This Week')}
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('month')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
              >
                {t('هذا الشهر', 'This Month')}
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('all')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
              >
                {t('كافة التواريخ', 'All Dates')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDateFrom('');
                  setDateTo('');
                  setSelectedDoctorId('All');
                  setStatusFilter('All');
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                title={t('تفريغ كافة الفلاتر والبحث', 'Reset all filters')}
              >
                <RotateCcw className="h-3 w-3" />
                <span>{t('إعادة ضبط الفلاتر', 'Clear Filters')}</span>
              </button>
            </div>

            {activeTab === 'agenda' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">{t('الحالة:', 'Status:')}</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="All">{t('كافة الحالات', 'All Statuses')}</option>
                  <option value="Scheduled">{t('حجز مبدئي / مجدول', 'Tentative / Scheduled')}</option>
                  <option value="Confirmed">{t('حجز مؤكد', 'Confirmed')}</option>
                  <option value="Attended">{t('حضر الجلسة', 'Attended')}</option>
                  <option value="NotAttended">{t('لم يحضر (اعتذار)', 'Not Attended')}</option>
                  <option value="Cancelled">{t('ملغي', 'Cancelled')}</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: MAIN BOOKINGS AGENDA TABLE (No Financials Column, With Lead Source & Reg Date, Customer Status) */}
      {activeTab === 'agenda' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('جدول أجندة ومواعيد الحجوزات', 'Bookings Agenda Table')}
              </h2>
              <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md font-bold">
                {filteredAppointments.length.toLocaleString('ar-EG')} {t('حجز', 'Records')}
              </span>
            </div>

            {/* Quick Navigation Scroll Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const container = document.getElementById('bookings-table-scroll-container');
                  if (container) {
                    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-all cursor-pointer shadow-2xs"
                title={t('النزول المباشر لأسفل الصفحة لآخر الحجوزات', 'Scroll to bottom')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>{t('لآخر الصفحة (الأسفل) ↓', 'To Bottom ↓')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const container = document.getElementById('bookings-table-scroll-container');
                  if (container) {
                    container.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer shadow-2xs"
                title={t('الصعود لأعلى الصفحة', 'Scroll to top')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>{t('للأعلى ↑', 'To Top ↑')}</span>
              </button>
            </div>
          </div>

          <div
            id="bookings-table-scroll-container"
            className="overflow-x-auto max-h-[72vh] overflow-y-auto relative custom-scrollbar border-t border-slate-100 dark:border-slate-800"
          >
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 shadow-xs text-slate-700 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">{t('كود واسم المريض والهاتف', 'Patient Code, Name & Phone')}</th>
                  <th className="p-3.5">{t('مصدر وتاريخ تكويد العميل', 'Lead Source & Account Creation Date')}</th>
                  <th className="p-3.5">{t('الخدمة / الجلسة', 'Service / Session')}</th>
                  <th className="p-3.5">{t('الطبيب المعالج *', 'Doctor *')}</th>
                  <th className="p-3.5">{t('تاريخ الحجز', 'Booking Date')}</th>
                  <th className="p-3.5 text-center">{t('وقت البدء (من)', 'Start Time (From)')}</th>
                  <th className="p-3.5 text-center">{t('وقت الانتهاء (إلى)', 'End Time (To)')}</th>
                  <th className="p-3.5">{t('حالة العميل القادمة', 'Customer Future Status')}</th>
                  <th className="p-3.5">{t('حالة الحجز', 'Booking Status')}</th>
                  <th className="p-3.5 text-center">{t('إجراءات وسجل المريض', 'Actions & History')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p>{t('لا توجد حجوزات مطابقة للفلاتر المحددة.', 'No bookings matching the criteria.')}</p>
                    </td>
                  </tr>
                ) : (
                  paginatedAppointments.map((apt, idx) => {
                    const party = getPartyForPatient(apt.patientId, apt.patientName);
                    const creationDate = party?.createdAt
                      ? party.createdAt.split('T')[0]
                      : apt.createdAt ? apt.createdAt.split('T')[0] : '2026-01-15';
                    const activeLeadSource = apt.leadSource || party?.leadSource || '';
                    const rowNumber = agendaRowsPerPage === -1 ? idx + 1 : (agendaPage - 1) * agendaRowsPerPage + idx + 1;
                    const custCode = apt.customerCode || apt.systemCode || party?.systemCode || (apt.paperCode ? `P-${apt.paperCode}` : '-');
                    const futureStatus = getCustomerFutureStatus(apt.patientName, apt.patientPhone, apt.patientId, apt.id);

                    const isTomorrowApt = apt.date === tomorrowIso;
                    const doctorScheduled = !isTomorrowApt || isDoctorScheduledForTomorrow(apt.doctorId, apt.doctorName);
                    const isPastApt = Boolean(apt.date && apt.date < todayIso);

                    const range = getAppointmentTimeRange(apt);
                    const sTime = apt.startTime || (range.startMin !== null ? formatMinutesTo24h(range.startMin) : (apt.time ? apt.time.split(' - ')[0] : ''));
                    const eTime = apt.endTime || (range.endMin !== null ? formatMinutesTo24h(range.endMin) : (apt.time && apt.time.includes(' - ') ? apt.time.split(' - ')[1] : ''));

                    const statusBadge = {
                      Scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200',
                      Confirmed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200',
                      Attended: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300',
                      NotAttended: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
                      Cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200',
                    }[apt.status] || 'bg-slate-100 text-slate-700';

                    // Row classes: Highlight red if tomorrow booking and doctor is not scheduled in staff schedules!
                    const rowClass = !doctorScheduled
                      ? 'bg-rose-50/90 dark:bg-rose-950/40 border-y-2 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                      : isPastApt
                      ? 'bg-slate-50/50 dark:bg-slate-900/40 opacity-90'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors';

                    return (
                      <tr key={apt.id} className={rowClass}>
                        <td className="p-3.5 font-semibold text-slate-400 font-mono">{rowNumber}</td>

                        {/* Patient Code, Name & Phone */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpen360(apt)}
                              className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 cursor-pointer text-right rtl:text-right"
                            >
                              <span>{apt.patientName || <span className="text-slate-400 font-normal italic text-[11px]">— (فارغ)</span>}</span>
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPatientHistory(apt.patientId, apt.patientName, apt.patientPhone)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                              title={t('عرض كافة الحجوزات والمتابعات الخاصة بهذا المريض تفصيلياً في أسطر', 'View all patient bookings & follow-ups')}
                            >
                              <History className="h-3 w-3 text-indigo-600" />
                              <span>{t('سجل المريض', 'History')}</span>
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded">
                              {custCode}
                            </span>
                            {apt.paperCode && (
                              <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-1 py-0.2 rounded" title="كود الملف الورقي">
                                ورقي: {apt.paperCode}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {apt.patientPhone || <span className="text-slate-400 font-mono">-</span>}
                            </span>
                            {apt.patientPhone && (
                              <button
                                onClick={() => {
                                  const text = generateBookingWhatsAppText({
                                    patientName: apt.patientName,
                                    date: apt.date,
                                    time: apt.time,
                                    serviceName: language === 'ar' ? apt.serviceNameAr : apt.serviceNameEn || apt.serviceNameAr,
                                    clinicName: tenant?.name || 'المركز الطبي',
                                    phone: tenant?.phone,
                                  });
                                  shareViaWhatsApp(apt.patientPhone, text);
                                }}
                                title="تذكير الموعد عبر واتساب"
                                className="p-0.5 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                              >
                                <MessageSquare className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Lead Source + Registration Date in ONE Single Cell */}
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              {activeLeadSource ? (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/40">
                                  {activeLeadSource}
                                </span>
                              ) : (
                                <select
                                  defaultValue=""
                                  onChange={(e) => handleUpdateLeadSource(party?.id, apt.id, e.target.value)}
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 font-semibold"
                                >
                                  <option value="">{t('+ تحديد المصدر...', '+ Set source...')}</option>
                                  <option value="Facebook Ads">Facebook Ads</option>
                                  <option value="Instagram">Instagram</option>
                                  <option value="TikTok">TikTok</option>
                                  <option value="Friend Referral">ترشيح صديق</option>
                                  <option value="Walk-in">زيارة مباشرة</option>
                                </select>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {t('تاريخ التكويد:', 'Created:')} {creationDate}
                            </span>
                          </div>
                        </td>

                        {/* Service / Session */}
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {(language === 'ar' ? apt.serviceNameAr : apt.serviceNameEn || apt.serviceNameAr) || (
                              <span className="text-slate-400 font-normal italic text-[11px]">— (فارغ)</span>
                            )}
                          </div>
                        </td>

                        {/* Doctor * */}
                        <td className="p-3.5">
                          <div className="text-slate-900 dark:text-white font-bold flex items-center gap-1">
                            <Stethoscope className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span>{apt.doctorName || <span className="text-slate-400 font-normal italic text-[11px]">— (فارغ)</span>}</span>
                          </div>
                          {!doctorScheduled && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                              <AlertCircle className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-400" />
                              <span>{t('مؤدى الخدمة المسجل غير متواجد غداً', 'Registered service provider is not scheduled tomorrow')}</span>
                            </div>
                          )}
                        </td>

                        {/* Booking Date */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="text-slate-900 dark:text-white font-bold flex items-center gap-1.5 font-mono text-xs">
                            <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span>{apt.date || <span className="text-amber-600 font-normal italic text-[11px]">— (فارغ)</span>}</span>
                          </div>
                          {isPastApt && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              <Lock className="h-2.5 w-2.5" />
                              {t('سابق', 'Past')}
                            </span>
                          )}
                        </td>

                        {/* Start Time (من) - Separate Column */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
                            <Clock className="h-3 w-3 text-indigo-500" />
                            <span>{sTime || '—'}</span>
                          </span>
                        </td>

                        {/* End Time (إلى) - Separate Column */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
                            <Clock className="h-3 w-3 text-emerald-500" />
                            <span>{eTime || '—'}</span>
                          </span>
                        </td>

                        {/* Customer Future Status */}
                        <td className="p-3.5">
                          {futureStatus ? (
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${futureStatus.badgeClass}`}>
                              {futureStatus.label}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 text-xs font-mono">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-lg border ${statusBadge}`}>
                            {apt.status === 'Scheduled' && t('حجز مبدئي', 'Tentative')}
                            {apt.status === 'Confirmed' && t('حجز مؤكد', 'Confirmed')}
                            {apt.status === 'Attended' && t('حضر الجلسة', 'Attended')}
                            {apt.status === 'NotAttended' && t('لم يحضر', 'Not Attended')}
                            {apt.status === 'Cancelled' && t('ملغي', 'Cancelled')}
                          </span>
                          {apt.cancellationReason && (
                            <div className="text-[10px] text-rose-500 mt-1 max-w-xs">{apt.cancellationReason}</div>
                          )}
                          {apt.notAttendedReason && (
                            <div className="text-[10px] text-amber-600 mt-1 max-w-xs">{apt.notAttendedReason}</div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Detailed Patient History */}
                            <button
                              onClick={() => handleOpenPatientHistory(apt.patientId, apt.patientName, apt.patientPhone)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                              title={t('عرض كافة الحجوزات والمتابعات الخاصة بهذا المريض تفصيلياً في أسطر', 'View all patient bookings & follow-ups in rows')}
                            >
                              <History className="h-4 w-4" />
                            </button>

                            {/* Action to Add New Follow-up for this Patient (متاح لجميع المواعيد السابقة والجديدة) */}
                            <button
                              onClick={() => handleOpenAddFollowUpForPatient(party?.id || apt.patientId, apt.patientName, apt.patientPhone, custCode)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                              title={t('إضافة متابعة جديدة لهذا العميل', 'Add New Follow-up for this Patient')}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>

                            {isPastApt ? (
                              <>
                                {/* Past appointment: Only adding new booking is allowed */}
                                <button
                                  onClick={() => handleOpenAddBookingForPatient(party?.id || apt.patientId, apt.patientName, apt.patientPhone, custCode, activeLeadSource)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                                  title={t('إضافة حجز جديد لهذا العميل', 'Add New Booking for this Client')}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
                                  title={t('موعد سابق: تم إيقاف التعديل والحذف لحماية السجلات', 'Past appointment: Editing and deletion locked')}
                                >
                                  <Lock className="h-3 w-3 text-slate-400" />
                                  <span>{t('مغلق', 'Locked')}</span>
                                </span>
                              </>
                            ) : (
                              <>
                                {/* Attendance */}
                                <button
                                  onClick={() => {
                                    setSelectedApt(apt);
                                    setAttendanceStatus(apt.status === 'Attended' ? 'Attended' : 'Attended');
                                    setShowAttendanceModal(true);
                                  }}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                                  title={t('تسجيل الحضور', 'Mark Attendance')}
                                >
                                  <UserCheck className="h-4 w-4" />
                                </button>

                                {/* Edit Booking */}
                                <button
                                  onClick={() => handleOpenEditApt(apt)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                                  title={t('تعديل الحجز', 'Edit Booking')}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>

                                {/* Reschedule */}
                                <button
                                  onClick={() => {
                                    setSelectedApt(apt);
                                    setNewDate(apt.date);
                                    const range = getAppointmentTimeRange(apt);
                                    const sTime = apt.startTime || (range.startMin !== null ? formatMinutesTo24h(range.startMin) : '10:00');
                                    const eTime = apt.endTime || (range.endMin !== null ? formatMinutesTo24h(range.endMin) : '10:45');
                                    setNewStartTime(sTime);
                                    setNewEndTime(eTime);
                                    setNewTime(apt.time || `${sTime} - ${eTime}`);
                                    setShowRescheduleModal(true);
                                  }}
                                  className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                  title={t('تغيير التوقيت', 'Reschedule')}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </button>

                                {/* Cancel Booking */}
                                {apt.status !== 'Cancelled' && (
                                  <button
                                    onClick={() => {
                                      setSelectedApt(apt);
                                      setCancelReason('');
                                      setShowCancelModal(true);
                                    }}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                    title={t('إلغاء الحجز', 'Cancel Booking')}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for Agenda Table */}
          {filteredAppointments.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50/70 dark:bg-slate-850/50 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 font-bold">
                  {t(
                    `عرض ${(agendaRowsPerPage === -1 ? 1 : (agendaPage - 1) * agendaRowsPerPage + 1).toLocaleString('ar-EG')} إلى ${(agendaRowsPerPage === -1 ? filteredAppointments.length : Math.min(agendaPage * agendaRowsPerPage, filteredAppointments.length)).toLocaleString('ar-EG')} من إجمالي (${filteredAppointments.length.toLocaleString('ar-EG')}) حجز`,
                    `Showing ${(agendaRowsPerPage === -1 ? 1 : (agendaPage - 1) * agendaRowsPerPage + 1)} to ${(agendaRowsPerPage === -1 ? filteredAppointments.length : Math.min(agendaPage * agendaRowsPerPage, filteredAppointments.length))} of ${filteredAppointments.length} bookings`
                  )}
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">{t('صفوف الصفحة:', 'Per page:')}</span>
                  <select
                    value={agendaRowsPerPage}
                    onChange={(e) => {
                      setAgendaRowsPerPage(Number(e.target.value));
                      setAgendaPage(1);
                    }}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={-1}>{t('عرض الكل', 'All')}</option>
                  </select>
                </div>
              </div>

              {agendaRowsPerPage !== -1 && totalAgendaPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAgendaPage(1)}
                    disabled={agendaPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('الأولى', 'First')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgendaPage((p) => Math.max(1, p - 1))}
                    disabled={agendaPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('السابق', 'Prev')}
                  </button>
                  <span className="px-3 py-1 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {agendaPage} / {totalAgendaPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAgendaPage((p) => Math.min(totalAgendaPages, p + 1))}
                    disabled={agendaPage === totalAgendaPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('التالي', 'Next')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgendaPage(totalAgendaPages)}
                    disabled={agendaPage === totalAgendaPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('الأخيرة', 'Last')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INDEPENDENT NEXT DAY BOOKINGS TABLE (جدول حجوزات اليوم التالي المستقل مع تأكيد وإلغاء وتعديل) */}
      {activeTab === 'next_day' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Quick Staff Schedule Banner for Tomorrow */}
          <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 to-emerald-50/60 dark:from-indigo-950/40 dark:to-emerald-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{t('مواعيد دوام مقدمي الخدمة لليوم التالي', "Tomorrow's Scheduled Staff & Service Providers")}</span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200">
                    {staffSchedules.filter((s) => s.date === tomorrowIso && (s.branchId === currentBranchId || !s.branchId)).length} {t('موظف مسجل بالدوام', 'Staff on duty')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('قائمة الكادر الطبي ومقدمي الخدمة المسجلين بالدوام ليوم الغد', "Staff and service providers scheduled on duty for tomorrow")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewSchDate(tomorrowIso);
                  setNewSchStaffId('');
                  setNewSchStaffName('');
                  setNewSchJobTitle('');
                  setNewSchNotes('');
                  setShowAddStaffScheduleModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 hover:bg-indigo-50 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-600" />
                <span>{t('+ إضافة موعد موظف لدوام الغد', '+ Add Staff Schedule')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScheduleTargetDate(tomorrowIso);
                  setActiveTab('staff_schedule');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <span>{t('إدارة جدول المواعيد كاملة', 'View All Schedule')}</span>
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0 rotate-180" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('جدول حجوزات اليوم التالي المستقل (متابعة وتأكيد الحضور)', "Independent Next Day's Bookings Table")}
                </h2>
                <p className="text-xs text-slate-500">
                  {t('تاريخ الغد:', "Tomorrow's Date:")} <span className="font-bold text-emerald-600">{tomorrowIso}</span> • {nextDayAppointments.length} {t('حجز مسجل للغد بالفرع المفعل', 'bookings for tomorrow in active branch')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('بحث بالاسم أو التليفون أو الكود...', 'Search tomorrow bookings...')}
                  className="bg-transparent text-xs text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-bold uppercase border-b border-emerald-100 dark:border-emerald-800/40">
                <tr>
                  <th className="p-3">{t('تأكيد الحجز', 'Confirm Check')}</th>
                  <th className="p-3">{t('المريض / الكود / الهاتف', 'Patient / Code / Phone')}</th>
                  <th className="p-3">{t('مصدر وتاريخ تكويد العميل', 'Source & Creation Date')}</th>
                  <th className="p-3">{t('الخدمة / الجلسة', 'Service / Session')}</th>
                  <th className="p-3">{t('الطبيب المعالج *', 'Doctor *')}</th>
                  <th className="p-3">{t('تاريخ الحجز', 'Booking Date')}</th>
                  <th className="p-3 text-center">{t('وقت البدء (من)', 'Start Time (From)')}</th>
                  <th className="p-3 text-center">{t('وقت الانتهاء (إلى)', 'End Time (To)')}</th>
                  <th className="p-3">{t('حالة الحجز', 'Status')}</th>
                  <th className="p-3 text-center">{t('إجراءات (إلغاء وتعديل)', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nextDayAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <CalendarCheck className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p>{t('لا توجد أي حجوزات مسجلة لليوم التالي بالفرع المفعل حتى الآن.', 'No bookings scheduled for tomorrow yet.')}</p>
                      <button
                        onClick={() => {
                          setAptDate(tomorrowIso);
                          setShowAddModal(true);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t('إضافة حجز للغد', 'Add Booking for Tomorrow')}</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  nextDayAppointments.map((apt, idx) => {
                    const party = getPartyForPatient(apt.patientId, apt.patientName);
                    const creationDate = party?.createdAt
                      ? party.createdAt.split('T')[0]
                      : apt.createdAt ? apt.createdAt.split('T')[0] : '2026-01-15';
                    const activeLeadSource = apt.leadSource || party?.leadSource || '';
                    const custCode = apt.systemCode || party?.systemCode || `CUST-${1000 + idx}`;
                    const isConfirmed = apt.status === 'Confirmed';
                    const doctorScheduled = isDoctorScheduledForTomorrow(apt.doctorId, apt.doctorName);

                    // If doctor is NOT scheduled in tomorrow's staff schedules -> Color row RED!
                    const rowClass = !doctorScheduled
                      ? 'bg-rose-50/90 dark:bg-rose-950/40 border-y-2 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                      : isConfirmed
                      ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors';

                    return (
                      <tr key={apt.id} className={rowClass}>
                        {/* Checkbox to Confirm Booking (Tentative -> Confirmed) */}
                        <td className="p-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isConfirmed}
                              onChange={() => handleToggleConfirmBooking(apt)}
                              className="h-4 w-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span
                              className={`text-[11px] font-bold ${
                                isConfirmed ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'
                              }`}
                            >
                              {isConfirmed ? t('مؤكد ✓', 'Confirmed') : t('تأكيد الآن', 'Confirm')}
                            </span>
                          </label>
                        </td>

                        {/* Patient Name, Code, Phone */}
                        <td className="p-3">
                          <button
                            onClick={() => handleOpen360(apt)}
                            className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 flex items-center gap-1 text-right rtl:text-right cursor-pointer"
                          >
                            <span>{apt.patientName}</span>
                            <Eye className="h-3 w-3 text-slate-400" />
                          </button>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1 rounded">
                              {custCode}
                            </span>
                            <span>{apt.patientPhone || '-'}</span>
                            {apt.patientPhone && (
                              <button
                                onClick={() => {
                                  const text = generateBookingWhatsAppText({
                                    patientName: apt.patientName,
                                    date: apt.date,
                                    time: apt.time,
                                    serviceName: language === 'ar' ? apt.serviceNameAr : apt.serviceNameEn || apt.serviceNameAr,
                                    clinicName: tenant?.name || 'المركز الطبي',
                                    phone: tenant?.phone,
                                  });
                                  shareViaWhatsApp(apt.patientPhone, text);
                                }}
                                title="تأكيد وتذكير موعد الغد عبر واتساب"
                                className="p-0.5 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                              >
                                <MessageSquare className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Lead Source + Registration Date */}
                        <td className="p-3">
                          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {activeLeadSource || t('زيارة مباشرة', 'Walk-in')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{creationDate}</div>
                        </td>

                        {/* Service */}
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          {apt.serviceNameAr}
                        </td>

                        {/* Doctor */}
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1">
                            <Stethoscope className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span>{apt.doctorName || t('د. استشاري', 'Dr. Consultant')}</span>
                          </div>
                          {!doctorScheduled && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                              <AlertCircle className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-400" />
                              <span>{t('مؤدى الخدمة المسجل غير متواجد غداً', 'Registered service provider is not scheduled tomorrow')}</span>
                            </div>
                          )}
                        </td>

                        {/* Booking Date */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="text-slate-900 dark:text-white font-bold flex items-center gap-1.5 font-mono text-xs">
                            <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span>{apt.date}</span>
                          </div>
                        </td>

                        {/* Start Time (من) - Separate Column */}
                        <td className="p-3 text-center whitespace-nowrap">
                          {(() => {
                            const nextRange = getAppointmentTimeRange(apt);
                            const nextStart = apt.startTime || (nextRange.startMin !== null ? formatMinutesTo24h(nextRange.startMin) : (apt.time ? apt.time.split(' - ')[0] : '10:00'));
                            return (
                              <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
                                <Clock className="h-3 w-3 text-indigo-500" />
                                <span>{nextStart}</span>
                              </span>
                            );
                          })()}
                        </td>

                        {/* End Time (إلى) - Separate Column */}
                        <td className="p-3 text-center whitespace-nowrap">
                          {(() => {
                            const nextRange = getAppointmentTimeRange(apt);
                            const nextEnd = apt.endTime || (nextRange.endMin !== null ? formatMinutesTo24h(nextRange.endMin) : (apt.time && apt.time.includes(' - ') ? apt.time.split(' - ')[1] : '10:45'));
                            return (
                              <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
                                <Clock className="h-3 w-3 text-emerald-500" />
                                <span>{nextEnd}</span>
                              </span>
                            );
                          })()}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-lg border ${
                              isConfirmed
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                            }`}
                          >
                            {isConfirmed ? t('حجز مؤكد', 'Confirmed') : t('حجز مبدئي', 'Tentative')}
                          </span>
                        </td>

                        {/* Actions: History, Follow-up, Pencil for Edit, (X) for cancel */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Patient History */}
                            <button
                              onClick={() => handleOpenPatientHistory(apt.patientId, apt.patientName, apt.patientPhone)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                              title={t('عرض كافة الحجوزات والمتابعات الخاصة بهذا المريض تفصيلياً في أسطر', 'View all patient bookings & follow-ups in rows')}
                            >
                              <History className="h-4 w-4" />
                            </button>

                            {/* Action to Add New Follow-up for this Patient */}
                            <button
                              onClick={() => handleOpenAddFollowUpForPatient(party?.id || apt.patientId, apt.patientName, apt.patientPhone, custCode)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                              title={t('إضافة متابعة جديدة لهذا العميل', 'Add New Follow-up for this Patient')}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEditApt(apt)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                              title={t('تعديل تفاصيل الحجز', 'Edit Booking')}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            {/* Cancel (X) Button */}
                            <button
                              onClick={() => {
                                setSelectedApt(apt);
                                setCancelReason('');
                                setShowCancelModal(true);
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                              title={t('إلغاء الحجز (X)', 'Cancel Booking (X)')}
                            >
                              <X className="h-4 w-4" />
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
      )}

      {/* TAB 3: STANDALONE PATIENT FOLLOW-UPS TABLE (جدول المتابعات المستقل للتذكير والمتابعة للمرضى غير الحاجزين) */}
      {activeTab === 'followup' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center font-bold">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('جدول المتابعات والتذكير المستقل للمرضى', 'Patient Follow-ups & Recall Reminder Log')}
                </h2>
                <p className="text-xs text-slate-500">
                  {t(
                    'مخصص للمرضى غير المسجلين بحجوزات فعلية، للاستفسارات، التذكير بمواعيد الجلسات، وعروض المتابعة',
                    'Dedicated for non-booking patients, inquiry calls, post-session follow-ups & retention recalls'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFollowUpExcelModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all cursor-pointer shadow-xs"
                title={t('استيراد وتصدير جدول المتابعات والتذكير وفحص الملفات', 'Import and Export Follow-ups & Reminders')}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>{t('إكسيل المتابعات والتذكير', 'Follow-ups Excel')}</span>
              </button>

              <button
                onClick={() => setShowAddFollowUpModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <Plus className="h-4 w-4" />
                <span>{t('تسجيل متابعة مريض جديدة', 'Add Follow-up Entry')}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{t('كود واسم المريض والهاتف', 'Patient Name, Code & Phone')}</th>
                  <th className="p-3">{t('المصدر وتاريخ التكويد', 'Source & Creation Date')}</th>
                  <th className="p-3">{t('تاريخ وتوقيت المتابعة', 'Due Date & Time')}</th>
                  <th className="p-3">{t('موضوع وسبب المتابعة', 'Follow-up Topic / Reason')}</th>
                  <th className="p-3">{t('المسؤول / التابع لـ', 'Created By')}</th>
                  <th className="p-3">{t('حالة العميل القادمة', 'Future Status')}</th>
                  <th className="p-3">{t('حالة المتابعة', 'Follow-up Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredFollowUps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p>{t('لا توجد متابعات مطابقة للفترة المحددة.', 'No follow-ups recorded.')}</p>
                    </td>
                  </tr>
                ) : (
                  paginatedFollowUps.map((fup, idx) => {
                    const party = getPartyForPatient(fup.patientId, fup.patientName);
                    const creationDate = party?.createdAt
                      ? party.createdAt.split('T')[0]
                      : fup.createdAt ? fup.createdAt.split('T')[0] : '2026-01-20';
                    const futureStatus = getCustomerFutureStatus(fup.patientName, fup.patientPhone, fup.patientId);
                    const rowNumber = followUpRowsPerPage === -1 ? idx + 1 : (followUpPage - 1) * followUpRowsPerPage + idx + 1;

                    const statusBadge = {
                      Pending: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
                      Contacted: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200',
                      Booked: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200',
                      NoAnswer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
                      Cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200',
                    }[fup.status] || 'bg-slate-100 text-slate-700';

                    const isPastFup = Boolean(fup.followUpDate && fup.followUpDate < todayIso);

                    return (
                      <tr key={fup.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isPastFup ? 'bg-slate-50/50 dark:bg-slate-900/40 opacity-90' : ''}`}>
                        <td className="p-3 font-semibold text-slate-400 font-mono">{rowNumber}</td>

                        {/* Patient Name, Code & Phone */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {fup.patientName || <span className="text-slate-400 font-normal italic text-[11px]">— (فارغ)</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-1 rounded">
                              {fup.customerCode || fup.systemCode || party?.systemCode || (fup.paperCode ? `P-${fup.paperCode}` : '-')}
                            </span>
                            {fup.paperCode && (
                              <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-1 py-0.2 rounded" title="كود الملف الورقي">
                                ورقي: {fup.paperCode}
                              </span>
                            )}
                            <span>{fup.patientPhone || <span className="text-slate-400 font-mono">-</span>}</span>
                            {fup.patientPhone && (
                              <button
                                onClick={() => {
                                  shareViaWhatsApp(
                                    fup.patientPhone,
                                    `مرحباً ${fup.patientName}، نتواصل معك من ${tenant?.name || 'المركز الطبي'} بخصوص: ${fup.reason}...`
                                  );
                                }}
                                title="مراسلة المتابعة عبر واتساب"
                                className="p-0.5 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                              >
                                <MessageSquare className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Lead Source + Creation Date */}
                        <td className="p-3">
                          <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                            {fup.leadSource || party?.leadSource || 'Walk-in'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{creationDate}</div>
                        </td>

                        {/* Follow-up Date & Time */}
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5 font-mono">
                            <Clock className="h-3 w-3 text-indigo-500 shrink-0" />
                            <span>{fup.followUpTime || '—'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-0.5">
                            <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{fup.followUpDate || <span className="text-amber-600 font-normal italic text-[11px]">— (فارغ)</span>}</span>
                            {isPastFup && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                <Lock className="h-2.5 w-2.5" />
                                {t('سابق', 'Past')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Reason & Notes */}
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {fup.reason || <span className="text-slate-400 font-normal italic text-[11px]">— (فارغ)</span>}
                          </div>
                          {fup.notes && <div className="text-[10px] text-slate-500 mt-0.5">{fup.notes}</div>}
                        </td>

                        {/* Created By */}
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {fup.createdBy || 'فريق المتابعة'}
                        </td>

                        {/* Customer Future Status */}
                        <td className="p-3">
                          {futureStatus ? (
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${futureStatus.badgeClass}`}>
                              {futureStatus.label}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 font-mono">-</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3">
                          {isPastFup ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-lg border px-2 py-0.5 opacity-80 cursor-not-allowed ${statusBadge}`}
                              title={t('متابعة سابقة: لا يمكن تعديل حالتها', 'Past follow-up: status locked')}
                            >
                              <Lock className="h-3 w-3" />
                              <span>
                                {fup.status === 'Pending' && t('قيد الانتظار', 'Pending')}
                                {fup.status === 'Contacted' && t('تم التواصل', 'Contacted')}
                                {fup.status === 'Booked' && t('تم الحجز بنجاح', 'Booked')}
                                {fup.status === 'NoAnswer' && t('لم يرد / مغلق', 'No Answer')}
                                {fup.status === 'Cancelled' && t('اعتذر / ملغي', 'Cancelled')}
                              </span>
                            </span>
                          ) : (
                            <select
                              value={fup.status}
                              onChange={(e) => updatePatientFollowUp(fup.id, { status: e.target.value as any })}
                              className={`text-[11px] font-bold rounded-lg border px-2 py-0.5 cursor-pointer ${statusBadge}`}
                            >
                              <option value="Pending">{t('قيد الانتظار', 'Pending')}</option>
                              <option value="Contacted">{t('تم التواصل', 'Contacted')}</option>
                              <option value="Booked">{t('تم الحجز بنجاح', 'Booked')}</option>
                              <option value="NoAnswer">{t('لم يرد / مغلق', 'No Answer')}</option>
                              <option value="Cancelled">{t('اعتذر / ملغي', 'Cancelled')}</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for Follow-ups Table */}
          {filteredFollowUps.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50/70 dark:bg-slate-850/50 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 font-bold">
                  {t(
                    `عرض ${(followUpRowsPerPage === -1 ? 1 : (followUpPage - 1) * followUpRowsPerPage + 1).toLocaleString('ar-EG')} إلى ${(followUpRowsPerPage === -1 ? filteredFollowUps.length : Math.min(followUpPage * followUpRowsPerPage, filteredFollowUps.length)).toLocaleString('ar-EG')} من إجمالي (${filteredFollowUps.length.toLocaleString('ar-EG')}) متابعة`,
                    `Showing ${(followUpRowsPerPage === -1 ? 1 : (followUpPage - 1) * followUpRowsPerPage + 1)} to ${(followUpRowsPerPage === -1 ? filteredFollowUps.length : Math.min(followUpPage * followUpRowsPerPage, filteredFollowUps.length))} of ${filteredFollowUps.length} follow-ups`
                  )}
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">{t('صفوف الصفحة:', 'Per page:')}</span>
                  <select
                    value={followUpRowsPerPage}
                    onChange={(e) => {
                      setFollowUpRowsPerPage(Number(e.target.value));
                      setFollowUpPage(1);
                    }}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={-1}>{t('عرض الكل', 'All')}</option>
                  </select>
                </div>
              </div>

              {followUpRowsPerPage !== -1 && totalFollowUpPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFollowUpPage(1)}
                    disabled={followUpPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('الأولى', 'First')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpPage((p) => Math.max(1, p - 1))}
                    disabled={followUpPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('السابق', 'Prev')}
                  </button>
                  <span className="px-3 py-1 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {followUpPage} / {totalFollowUpPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFollowUpPage((p) => Math.min(totalFollowUpPages, p + 1))}
                    disabled={followUpPage === totalFollowUpPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('التالي', 'Next')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpPage(totalFollowUpPages)}
                    disabled={followUpPage === totalFollowUpPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t('الأخيرة', 'Last')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: STAFF WORK SCHEDULES (تسجيل مواعيد ودوام الموظفين للفرع المفعل) */}
      {activeTab === 'staff_schedule' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{t('تسجيل مواعيد ودوام موظفي الفرع', 'Branch Staff Work Schedules')}</span>
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {activeBranch?.name || t('الفرع المفعل', 'Active Branch')}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {t('إدارة وتنظيم ساعات ومواعيد دوام موظفي الفرع', 'Manage branch staff shifts and working hours')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Date Selector */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('تاريخ الدوام:', 'Duty Date:')}</span>
                <input
                  type="date"
                  value={scheduleTargetDate}
                  onChange={(e) => {
                    setScheduleTargetDate(e.target.value);
                    setNewSchDate(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              {/* Quick toggle tomorrow button */}
              <button
                type="button"
                onClick={() => {
                  setScheduleTargetDate(tomorrowIso);
                  setNewSchDate(tomorrowIso);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  scheduleTargetDate === tomorrowIso
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {t('دوام الغد (اليوم التالي)', "Tomorrow's Schedule")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setScheduleTargetDate(todayIso);
                  setNewSchDate(todayIso);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  scheduleTargetDate === todayIso
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {t('دوام اليوم', "Today's Schedule")}
              </button>

              {/* Add Staff Schedule Button */}
              {canPerformAction('bookings.manage_staff_schedule') && (
                <button
                  type="button"
                  onClick={() => {
                    setNewSchDate(scheduleTargetDate || tomorrowIso);
                    setNewSchStaffId('');
                    setNewSchStaffName('');
                    setNewSchJobTitle('');
                    setNewSchNotes('');
                    setShowAddStaffScheduleModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('+ إضافة موعد موظف', '+ Add Staff Schedule')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Schedule Summary Banner */}
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-950 dark:text-indigo-200">
                {t('الموظفون المسجلون بالدوام لتاريخ', 'Staff on duty for date:')} <span className="font-mono underline font-extrabold">{scheduleTargetDate}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 text-[11px]">
                {branchStaffSchedules.length} {t('موظف', 'staff')}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{t('اسم الموظف', 'Staff Member Name')}</th>
                  <th className="p-3">{t('الوظيفة', 'Job Title')}</th>
                  <th className="p-3">{t('وقت بداية العمل', 'Start Time')}</th>
                  <th className="p-3">{t('وقت انتهاء العمل', 'End Time')}</th>
                  <th className="p-3">{t('ملاحظات', 'Notes')}</th>
                  <th className="p-3 text-center">{t('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {branchStaffSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p>{t('لا توجد مواعيد مسجلة للموظفين في هذا التاريخ بهذا الفرع.', 'No staff schedules recorded for this date.')}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewSchDate(scheduleTargetDate);
                          setShowAddStaffScheduleModal(true);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t('إضافة أول موظف لهذا اليوم (+)', 'Add First Staff Member (+)')}</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  branchStaffSchedules.map((sch, idx) => {
                    const staffObj = staffMembers.find((s) => s.id === sch.staffId);

                    return (
                      <tr key={sch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-semibold text-slate-400">{idx + 1}</td>

                        {/* Staff Name */}
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                              {sch.staffName.slice(0, 1)}
                            </div>
                            <div>
                              <span>{sch.staffName}</span>
                              {staffObj?.code && (
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  {staffObj.code}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Job Title */}
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {sch.jobTitle || staffObj?.jobTitleAr || staffObj?.specialtyAr || t('مقدم خدمة', 'Service Provider')}
                          </span>
                        </td>

                        {/* Start Time */}
                        <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-300">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{sch.startTime}</span>
                          </div>
                        </td>

                        {/* End Time */}
                        <td className="p-3.5 font-bold text-rose-700 dark:text-rose-300">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-rose-600" />
                            <span>{sch.endTime}</span>
                          </div>
                        </td>

                        {/* Notes */}
                        <td className="p-3.5 text-slate-600 dark:text-slate-400 max-w-xs">
                          {sch.notes || '-'}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canPerformAction('bookings.manage_staff_schedule') ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditStaffSchedule(sch)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                                  title={t('تعديل موعد دوام الموظف', 'Edit Shift')}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaffSchedule(sch.id)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                  title={t('حذف موعد دوام الموظف', 'Delete Shift')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400">-</span>
                            )}
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
      )}

      {/* Modal: Add Staff Work Schedule */}
      {showAddStaffScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {t('تسجيل موعد دوام موظف بالفرع', 'Add Staff Work Schedule')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddStaffScheduleSubmit} className="space-y-4">
              {/* Employee Selection: From active branch employees registered in Staff Management */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الموظف *', 'Employee Name *')}
                </label>
                <select
                  required
                  value={newSchStaffId}
                  onChange={(e) => {
                    const stId = e.target.value;
                    setNewSchStaffId(stId);
                    const selected = branchStaffMembers.find((s) => s.id === stId);
                    if (selected) {
                      setNewSchStaffName(selected.nameAr);
                      const title = selected.jobTitleAr || selected.specialtyAr || selected.role || 'مقدم خدمة';
                      setNewSchJobTitle(title);
                    } else {
                      setNewSchStaffName('');
                      setNewSchJobTitle('');
                    }
                  }}
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white font-bold focus:outline-indigo-600"
                >
                  <option value="">{t('-- اختر اسم الموظف * --', '-- Select Staff Member * --')}</option>
                  {branchStaffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr} {s.jobTitleAr ? `[${s.jobTitleAr}]` : s.specialtyAr ? `[${s.specialtyAr}]` : ''}
                    </option>
                  ))}
                </select>
                {branchStaffMembers.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    {t('لا يوجد موظفون مكودون بهذا الفرع في إدارة الموظفين.', 'No staff found for this branch in Staff Management.')}
                  </p>
                )}
              </div>

              {/* Job Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الوظيفة', 'Job Title')}
                </label>
                <input
                  type="text"
                  value={newSchJobTitle}
                  onChange={(e) => setNewSchJobTitle(e.target.value)}
                  placeholder={t('الوظيفة...', 'Job Title...')}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('تاريخ الدوام *', 'Duty Date *')}
                </label>
                <input
                  type="date"
                  required
                  min={todayIso}
                  value={newSchDate}
                  onChange={(e) => setNewSchDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('وقت بداية العمل *', 'Start Time *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchStartTime}
                    onChange={(e) => setNewSchStartTime(e.target.value)}
                    placeholder="09:00 AM"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('وقت انتهاء العمل *', 'End Time *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchEndTime}
                    onChange={(e) => setNewSchEndTime(e.target.value)}
                    placeholder="05:00 PM"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={newSchNotes}
                  onChange={(e) => setNewSchNotes(e.target.value)}
                  placeholder="ملاحظات العيادة، الغرفة، الشفت..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddStaffScheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {t('حفظ موعد الدوام', 'Save Schedule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Staff Work Schedule */}
      {showEditStaffScheduleModal && editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {t('تعديل موعد دوام موظف بالفرع', 'Edit Staff Work Schedule')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditStaffScheduleModal(false);
                  setEditingSchedule(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditStaffScheduleSubmit} className="space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الموظف *', 'Employee Name *')}
                </label>
                <select
                  required
                  value={editSchStaffId}
                  onChange={(e) => handleSelectStaffForEditSchedule(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white font-bold focus:outline-indigo-600"
                >
                  <option value="">{t('-- اختر اسم الموظف * --', '-- Select Staff Member * --')}</option>
                  {branchStaffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr} {s.jobTitleAr ? `[${s.jobTitleAr}]` : s.specialtyAr ? `[${s.specialtyAr}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الوظيفة', 'Job Title')}
                </label>
                <input
                  type="text"
                  value={editSchJobTitle}
                  onChange={(e) => setEditSchJobTitle(e.target.value)}
                  placeholder={t('الوظيفة...', 'Job Title...')}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('تاريخ الدوام *', 'Duty Date *')}
                </label>
                <input
                  type="date"
                  required
                  min={todayIso}
                  value={editSchDate}
                  onChange={(e) => setEditSchDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('وقت بداية العمل *', 'Start Time *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editSchStartTime}
                    onChange={(e) => setEditSchStartTime(e.target.value)}
                    placeholder="09:00 AM"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('وقت انتهاء العمل *', 'End Time *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editSchEndTime}
                    onChange={(e) => setEditSchEndTime(e.target.value)}
                    placeholder="05:00 PM"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={editSchNotes}
                  onChange={(e) => setEditSchNotes(e.target.value)}
                  placeholder="ملاحظات العيادة، الغرفة، الشفت..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditStaffScheduleModal(false);
                    setEditingSchedule(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {t('حفظ التعديلات', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: Treatment Plans & Packages */}
      {activeTab === 'treatment_plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('برامج وخطط العلاج والمتابعة المستمرة للمرضى', 'Active Treatment Plans & Care Packages')}
            </h2>
            <button
              onClick={() => setShowNewPlanModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t('إنشاء خطة علاج جديدة', 'Create Treatment Plan')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {treatmentPlans.map((plan) => {
              const progressPct = Math.round((plan.completedSessions / plan.totalSessions) * 100);

              return (
                <div
                  key={plan.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">{plan.title}</h3>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                          {plan.patientName} • {plan.doctorName}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          plan.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400'
                        }`}
                      >
                        {plan.status === 'Completed' ? t('مكتمل', 'Completed') : t('ساري', 'Active')}
                      </span>
                    </div>

                    <div className="my-4">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{t('نسبة إنجاز الجلسات:', 'Sessions Progress:')}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {plan.completedSessions} / {plan.totalSessions} ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>{t('إجمالي قيمة الخطة:', 'Total Cost:')}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatMoney(plan.totalCost)}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-end gap-2">
                    {plan.status !== 'Completed' && (
                      <button
                        onClick={() => progressTreatmentPlan(plan.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg transition-colors cursor-pointer"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>{t('تسجيل جلسة مكتملة (+1)', 'Complete Session (+1)')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Booking Modal (Doctor Name is MANDATORY) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('تسجيل حجز موعد جديد لمريض', 'New Patient Booking')}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Customer Selection from Active Branch */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('اختيار العميل من عملاء الفرع المفعل *', 'Select Customer from Active Branch *')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCustomerModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>{t('+ إضافة عميل جديد سريعاً', '+ Quick Add New Client')}</span>
                  </button>
                </div>

                <select
                  required
                  value={patientId}
                  onChange={(e) => handleSelectExistingPatient(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white font-bold focus:outline-indigo-600"
                >
                  <option value="">{t('-- اختر اسم العميل من عملاء الفرع المفعل * --', '-- Select customer from active branch * --')}</option>
                  {branchCustomers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} • {p.phone} {p.paperCode ? `[ورقي: ${p.paperCode}]` : ''} {p.systemCode ? `[${p.systemCode}]` : ''}
                    </option>
                  ))}
                </select>

                {branchCustomers.length === 0 && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <span>{t('لا يوجد عملاء مكودين بهذا الفرع حتى الآن.', 'No customers found for this branch.')}</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddCustomerModal(true)}
                      className="font-bold underline cursor-pointer"
                    >
                      {t('إضافة أول عميل الآن (+)', 'Add First Client (+)')}
                    </button>
                  </div>
                )}

                {/* Read-Only Pre-filled Registered Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>{t('اسم العميل (افتراضي ومقفل)', 'Customer Name (Locked)')}</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={patientName}
                      placeholder={t('سيظهر الاسم المسجل...', 'Registered name...')}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>{t('رقم الهاتف (افتراضي ومقفل)', 'Phone (Locked)')}</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={patientPhone}
                      placeholder={t('سيظهر الهاتف المسجل...', 'Registered phone...')}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>{t('مصدر العميل (افتراضي ومقفل)', 'Lead Source (Locked)')}</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={leadSource || t('زيارة مباشرة للفرع', 'Walk-in')}
                      placeholder={t('مصدر العميل...', 'Lead source...')}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>{t('الفرع المفعل (غير قابل للتعديل)', 'Branch (Locked)')}</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={activeBranch?.name || t('الفرع المفعل', 'Active Branch')}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-400 font-bold cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Service Selection: Coded sellable products/services only without price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الخدمة / الجلسة المطلوب حجزها *', 'Service / Session *')}
                </label>
                <select
                  required
                  value={serviceNameAr}
                  onChange={(e) => {
                    setServiceNameAr(e.target.value);
                    setServiceNameEn(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold text-slate-900 dark:text-white"
                >
                  <option value="">{t('-- اختر الخدمة / الجلسة * --', '-- Select Service / Session * --')}</option>
                  {sellableServices.map((p) => (
                    <option key={p.id} value={p.nameAr}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Selection: Coded service providers */}
              {(() => {
                const availableDocs = getAvailableDoctorsForDate(aptDate);
                const isTomorrowBooking = aptDate === tomorrowIso;

                return (
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                      {t('مقدم الخدمة / الطبيب المعالج *', 'Service Provider / Doctor *')}
                    </label>
                    <select
                      required
                      value={doctorId}
                      onChange={(e) => {
                        setDoctorId(e.target.value);
                        const d =
                          availableDocs.find((s) => s.id === e.target.value) ||
                          branchStaffMembers.find((s) => s.id === e.target.value) ||
                          staffMembers.find((s) => s.id === e.target.value);
                        if (d) setDoctorName(d.nameAr);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 focus:outline-indigo-600 font-bold text-slate-900 dark:text-white"
                    >
                      <option value="">{t('-- اختر مقدم الخدمة / الطبيب المعالج * --', '-- Select Service Provider * --')}</option>
                      {availableDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr} {d.specialtyAr ? `(${d.specialtyAr})` : d.jobTitleAr ? `(${d.jobTitleAr})` : ''}
                        </option>
                      ))}
                    </select>

                    {availableDocs.length === 0 && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
                        {isTomorrowBooking
                          ? t(
                              'لا يوجد مقدمو خدمة مسجلون بجدول دوام الغد حالياً.',
                              'No service providers scheduled for tomorrow.'
                            )
                          : t(
                              'لا يوجد مقدمو خدمة متاحون حالياً بهذا الفرع.',
                              'No active service providers for this branch.'
                            )}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Date & Manual Session Timing (من وقت إلى وقت) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('تاريخ الحجز *', 'Booking Date *')}
                  </label>
                  <input
                    type="date"
                    required
                    min={todayIso}
                    value={aptDate}
                    onChange={(e) => setAptDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('وقت بدء الجلسة (من) *', 'Start Time (From) *')}</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => {
                      const newS = e.target.value;
                      setStartTime(newS);
                      const sM = parseTimeToMinutes(newS);
                      if (sM !== null) {
                        const curEM = parseTimeToMinutes(endTime);
                        if (curEM === null || curEM <= sM) {
                          setEndTime(formatMinutesTo24h(sM + 45));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('وقت انتهاء الجلسة (إلى) *', 'End Time (To) *')}</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Real-time Overlap Conflict Check Banner */}
              {(() => {
                const sMin = parseTimeToMinutes(startTime);
                const endMin = parseTimeToMinutes(endTime);
                const invalidInterval = sMin !== null && endMin !== null && endMin <= sMin;
                const conflict = checkDoctorAppointmentConflict(
                  aptDate,
                  doctorId || undefined,
                  doctorName,
                  startTime,
                  endTime,
                  appointments
                );

                if (invalidInterval) {
                  return (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>{t('وقت نهاية الجلسة (إلى) يجب أن يكون بعد وقت بدايتها (من)', 'End time must be strictly after start time')}</span>
                    </div>
                  );
                }

                if (conflict.hasConflict) {
                  return (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-xl text-xs text-rose-900 dark:text-rose-200 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{t('تنبيه تعارض موعد محجوز لنفس الطبيب!', 'Doctor Scheduling Conflict Alert!')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {isRtl ? conflict.reasonAr : conflict.reasonEn}
                      </p>
                    </div>
                  );
                }

                if (sMin !== null && endMin !== null && (doctorId || doctorName)) {
                  const duration = endMin - sMin;
                  return (
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span>{t('الوقت متاح للطبيب بدون أي تداخلات', 'Slot is available for doctor without conflicts')}</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                        {t('المدة:', 'Duration:')} {duration} {t('دقيقة', 'min')}
                      </span>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات الحجز والحالة الطبية', 'Booking & Medical Notes')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات الحساسية، التوصيات الخاصة..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {t('حفظ الحجز', 'Save Booking')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {showEditAptModal && selectedApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('تعديل تفاصيل الحجز للمريض', 'Edit Booking')} - {selectedApt.patientName}
              </h3>
              <button
                onClick={() => setShowEditAptModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditAptSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم المريض', 'Patient Name')}
                  </label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={patientName}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-not-allowed font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الهاتف', 'Phone')}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={patientPhone}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-not-allowed font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود السيستم', 'System Code')}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={systemCode}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Doctor Selection */}
              {(() => {
                const availableDocs = getAvailableDoctorsForDate(aptDate);
                const isTomorrowBooking = aptDate === tomorrowIso;

                return (
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                      {t('مقدم الخدمة / الطبيب المعالج *', 'Service Provider / Doctor *')}
                    </label>
                    <select
                      required
                      value={doctorId}
                      onChange={(e) => {
                        setDoctorId(e.target.value);
                        const d =
                          availableDocs.find((s) => s.id === e.target.value) ||
                          branchStaffMembers.find((s) => s.id === e.target.value) ||
                          staffMembers.find((s) => s.id === e.target.value);
                        if (d) setDoctorName(d.nameAr);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 font-bold"
                    >
                      <option value="">{t('-- اختر مقدم الخدمة / الطبيب المعالج * --', '-- Select Service Provider * --')}</option>
                      {availableDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr} {d.specialtyAr ? `(${d.specialtyAr})` : d.jobTitleAr ? `(${d.jobTitleAr})` : ''}
                        </option>
                      ))}
                    </select>

                    {availableDocs.length === 0 && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
                        {isTomorrowBooking
                          ? t(
                              'لا يوجد مقدمو خدمة مسجلون بجدول دوام الغد حالياً.',
                              'No service providers scheduled for tomorrow.'
                            )
                          : t(
                              'لا يوجد مقدمو خدمة متاحون حالياً بهذا الفرع.',
                              'No active service providers for this branch.'
                            )}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الخدمة / الجلسة المطلوب حجزها *', 'Service / Session *')}
                </label>
                <select
                  required
                  value={serviceNameAr}
                  onChange={(e) => {
                    setServiceNameAr(e.target.value);
                    setServiceNameEn(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                >
                  <option value="">{t('-- اختر الخدمة من المنتجات والخدمات المكودة --', '-- Pick Coded Service --')}</option>
                  {sellableServices.map((p) => (
                    <option key={p.id} value={p.nameAr}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Manual Session Timing (من وقت إلى وقت) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التاريخ *', 'Date *')}
                  </label>
                  <input
                    type="date"
                    required
                    min={todayIso}
                    value={aptDate}
                    onChange={(e) => setAptDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('وقت بدء الجلسة (من) *', 'Start Time (From) *')}</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('وقت انتهاء الجلسة (إلى) *', 'End Time (To) *')}</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Real-time Overlap Conflict Check Banner for Edit */}
              {(() => {
                const sMin = parseTimeToMinutes(startTime);
                const endMin = parseTimeToMinutes(endTime);
                const invalidInterval = sMin !== null && endMin !== null && endMin <= sMin;
                const conflict = checkDoctorAppointmentConflict(
                  aptDate,
                  doctorId || undefined,
                  doctorName,
                  startTime,
                  endTime,
                  appointments,
                  selectedApt?.id
                );

                if (invalidInterval) {
                  return (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>{t('وقت نهاية الجلسة (إلى) يجب أن يكون بعد وقت بدايتها (من)', 'End time must be strictly after start time')}</span>
                    </div>
                  );
                }

                if (conflict.hasConflict) {
                  return (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-xl text-xs text-rose-900 dark:text-rose-200 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{t('تنبيه تعارض موعد محجوز لنفس الطبيب!', 'Doctor Scheduling Conflict Alert!')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {isRtl ? conflict.reasonAr : conflict.reasonEn}
                      </p>
                    </div>
                  );
                }

                if (sMin !== null && endMin !== null && (doctorId || doctorName)) {
                  const duration = endMin - sMin;
                  return (
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span>{t('الوقت متاح للطبيب بدون أي تداخلات', 'Slot is available for doctor without conflicts')}</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                        {t('المدة:', 'Duration:')} {duration} {t('دقيقة', 'min')}
                      </span>
                    </div>
                  );
                }

                return null;
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات الحجز والحالة الطبية', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditAptModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  {t('تحديث الحجز', 'Update Booking')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Follow-Up Modal */}
      {showAddFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('تسجيل متابعة / تذكير جديد لمريض', 'New Patient Follow-up / Reminder')}
              </h3>
              <button
                onClick={() => setShowAddFollowUpModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddFollowUpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اختيار مريض مسجل (اختياري)', 'Select Registered Patient')}
                </label>
                <select
                  value={fupPatientId}
                  onChange={(e) => {
                    setFupPatientId(e.target.value);
                    const p = parties.find((party) => party.id === e.target.value);
                    if (p) {
                      setFupPatientName(p.name);
                      setFupPatientPhone(p.phone);
                      setFupSystemCode(p.systemCode || '');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="">{t('مريض جديد أو كتابة يدوية...', 'New patient or custom...')}</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم المريض / العميل *', 'Patient Name *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={fupPatientName}
                    onChange={(e) => setFupPatientName(e.target.value)}
                    placeholder="اسم المريض..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الهاتف *', 'Phone *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={fupPatientPhone}
                    onChange={(e) => setFupPatientPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('تاريخ المتابعة والتذكير *', 'Follow-up Due Date *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={fupDate}
                    onChange={(e) => setFupDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('نوع المتابعة', 'Type')}
                  </label>
                  <select
                    value={fupType}
                    onChange={(e) => setFupType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Inquiry">{t('استفسار عن خدمة / أسعار', 'Inquiry')}</option>
                    <option value="PostTreatment">{t('اطمئنان بعد الجلسة', 'Post-Treatment Check')}</option>
                    <option value="Recall">{t('تذكير بموعد جلسة قادمة', 'Session Recall')}</option>
                    <option value="Complaint">{t('شكوى أو ملاحظة', 'Complaint')}</option>
                    <option value="General">{t('متابعة عامة', 'General')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('موضوع وسبب المتابعة *', 'Reason / Subject *')}
                </label>
                <input
                  type="text"
                  required
                  value={fupReason}
                  onChange={(e) => setFupReason(e.target.value)}
                  placeholder="مثال: متابعة جلسة ليزر الرتوش بعد أسبوعين..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات المتابعة', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={fupNotes}
                  onChange={(e) => setFupNotes(e.target.value)}
                  placeholder="تفاصيل المكالمة أو الاستفسار..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddFollowUpModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  {t('حفظ المتابعة', 'Save Follow-up')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && selectedApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              {t('تسجيل حضور / عدم حضور المريض', 'Mark Patient Attendance')}
            </h3>

            <p className="text-xs text-slate-500 mb-4">
              {t('المريض:', 'Patient:')} <span className="font-bold text-slate-800 dark:text-slate-200">{selectedApt.patientName}</span> • {selectedApt.time}
            </p>

            <form onSubmit={handleAttendanceSubmit} className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAttendanceStatus('Attended')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    attendanceStatus === 'Attended'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  ✓ {t('حضر وتم تقديم الخدمة', 'Attended')}
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceStatus('NotAttended')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    attendanceStatus === 'NotAttended'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  ✕ {t('لم يحضر (اعتذار / تأجيل)', 'Not Attended')}
                </button>
              </div>

              {attendanceStatus === 'NotAttended' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('سبب عدم الحضور *', 'Reason for Non-Attendance *')}
                  </label>
                  <select
                    value={notAttendedReason}
                    onChange={(e) => setNotAttendedReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="الهاتف مغلق / لم يرد">الهاتف مغلق / لم يرد</option>
                    <option value="اعتذر لظروف طارئة وطلب تأجيل الموعد">اعتذر لظروف طارئة وطلب تأجيل الموعد</option>
                    <option value="مسافر خارج المدينة">مسافر خارج المدينة</option>
                    <option value="عدم توفر المبلغ حالياً">عدم توفر المبلغ حالياً</option>
                    <option value="لم يحضر بدون إبداء أسباب">لم يحضر بدون إبداء أسباب</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  {t('تحديث الحالة', 'Update Status')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <h3 className="text-base font-bold text-rose-600 mb-2">
              {t('إلغاء موعد الحجز', 'Cancel Booking')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('المريض:', 'Patient:')} <span className="font-bold">{selectedApt.patientName}</span> • {selectedApt.serviceNameAr}
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('سبب الإلغاء * (يتم حفظه في سجل الأوديت)', 'Cancellation Reason *')}
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="سبب إلغاء الحجز..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-rose-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('تراجع', 'Back')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                >
                  {t('تأكيد الإلغاء', 'Confirm Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {t('تعديل موعد الحجز (Reschedule)', 'Reschedule Appointment')}
            </h3>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('التاريخ الجديد * (تاريخ اليوم أو تاريخ مستقبلي)', 'New Date * (Today or Future)')}
                </label>
                <input
                  type="date"
                  required
                  min={todayIso}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('وقت البدء (من) *', 'Start Time (From) *')}</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={newStartTime}
                    onChange={(e) => {
                      const newS = e.target.value;
                      setNewStartTime(newS);
                      const sM = parseTimeToMinutes(newS);
                      if (sM !== null) {
                        const curEM = parseTimeToMinutes(newEndTime);
                        if (curEM === null || curEM <= sM) {
                          setNewEndTime(formatMinutesTo24h(sM + 45));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('وقت الانتهاء (إلى) *', 'End Time (To) *')}</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Real-time Overlap Conflict Check Banner for Reschedule */}
              {(() => {
                const sMin = parseTimeToMinutes(newStartTime);
                const endMin = parseTimeToMinutes(newEndTime);
                const invalidInterval = sMin !== null && endMin !== null && endMin <= sMin;
                const conflict = checkDoctorAppointmentConflict(
                  newDate,
                  selectedApt.doctorId,
                  selectedApt.doctorName,
                  newStartTime,
                  newEndTime,
                  appointments,
                  selectedApt.id
                );

                if (invalidInterval) {
                  return (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>{t('وقت نهاية الجلسة (إلى) يجب أن يكون بعد وقت بدايتها (من)', 'End time must be after start time')}</span>
                    </div>
                  );
                }

                if (conflict.hasConflict) {
                  return (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-xl text-xs text-rose-900 dark:text-rose-200 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{t('تعارض موعد محجوز لنفس الطبيب!', 'Doctor Conflict!')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {isRtl ? conflict.reasonAr : conflict.reasonEn}
                      </p>
                    </div>
                  );
                }

                if (sMin !== null && endMin !== null) {
                  const duration = endMin - sMin;
                  return (
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{t('الموعد متاح بدون تعارض', 'Slot is available')}</span>
                      </span>
                      <span className="font-mono text-[10px] font-bold">
                        {duration} {t('دقيقة', 'min')}
                      </span>
                    </div>
                  );
                }

                return null;
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات سبب التأجيل', 'Reschedule Notes')}
                </label>
                <input
                  type="text"
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="طلب العميل التأجيل بسبب العمل..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  {t('تحديث الموعد', 'Save New Date')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient 360-Degree History Modal */}
      {showPatient360Modal && selectedPatientFor360 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-lg">
                  {selectedPatientFor360.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {selectedPatientFor360.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t('كود العميل:', 'Code:')} {selectedPatientFor360.systemCode || selectedPatientFor360.paperCode || '-'} • {selectedPatientFor360.phone} • {t('تاريخ التكويد:', 'Created:')} {selectedPatientFor360.createdAt?.split('T')[0] || '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPatient360Modal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                <span className="text-[11px] text-slate-400 block">{t('إجمالي الزيارات', 'Total Visits')}</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {appointments.filter((a) => a.patientName === selectedPatientFor360.name).length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                <span className="text-[11px] text-slate-400 block">{t('خطط العلاج', 'Treatment Plans')}</span>
                <span className="text-lg font-bold text-indigo-600">
                  {treatmentPlans.filter((tp) => tp.patientName === selectedPatientFor360.name).length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                <span className="text-[11px] text-slate-400 block">{t('الفواتير المسجلة', 'Total Invoices')}</span>
                <span className="text-lg font-bold text-emerald-600">
                  {invoices.filter((i) => i.customerName === selectedPatientFor360.name).length}
                </span>
              </div>
            </div>

            {/* Past Appointments History */}
            <div className="space-y-2 mt-4">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t('سجل الزيارات والحجوزات السابقة', 'Past Visits & Bookings')}
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                {appointments
                  .filter((a) => a.patientName === selectedPatientFor360.name)
                  .map((apt) => (
                    <div key={apt.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{apt.serviceNameAr}</div>
                        <div className="text-[10px] text-slate-400">{apt.date} • {apt.time} • د. {apt.doctorName || 'استشاري'}</div>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{formatMoney(apt.price)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowPatient360Modal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                {t('إغلاق', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Treatment Plan Modal */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {t('إنشاء خطة علاج / باكدج جلسات', 'New Treatment Care Plan')}
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              const p = parties.find((party) => party.id === planPatientId);
              if (!p) return;
              addTreatmentPlan({
                patientId: p.id,
                patientName: p.name,
                doctorName: planDoctorName || 'د. الاستشاري',
                title: planTitle,
                totalSessions: planTotalSessions,
                completedSessions: 0,
                totalCost: planTotalCost,
                status: 'Active',
                startDate: todayIso,
                sessions: [
                  {
                    sessionNumber: 1,
                    date: todayIso,
                    notes: 'جلسة أولى - فحص وخطة علاج',
                    status: 'Pending',
                  },
                ],
              });
              setShowNewPlanModal(false);
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('المريض / العميل *', 'Patient *')}
                </label>
                <select
                  required
                  value={planPatientId}
                  onChange={(e) => setPlanPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                >
                  <option value="">{t('اختر المريض...', 'Select Patient...')}</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('عنوان الخطة / الباكدج *', 'Plan Title *')}
                </label>
                <input
                  type="text"
                  required
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="مثال: باكدج 6 جلسات ليزر كانديلا فول بودي..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('إجمالي عدد الجلسات', 'Total Sessions')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={planTotalSessions}
                    onChange={(e) => setPlanTotalSessions(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التكلفة الإجمالية (ج.م)', 'Total Cost (EGP)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={planTotalCost}
                    onChange={(e) => setPlanTotalCost(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  {t('إنشاء الخطة', 'Create Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal (مختصر لإضافة عميل جديد بالفرع المفعل فوراً) */}
      {showQuickAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 font-bold">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {t('إضافة عميل / مريض جديد سريعاً', 'Quick Add New Client')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('تكويد العميل مباشرة وربطه بالفرع المفعل واستخدامه بالحجز', 'Create client for active branch and auto-select for booking')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickAddCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="mb-4 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-indigo-600" />
                <span className="font-bold text-indigo-900 dark:text-indigo-200">
                  {t('الفرع المفعل المحدد للعميل:', 'Active Branch for Client:')}
                </span>
              </div>
              <span className="font-black text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-700">
                {activeBranch?.name || t('الفرع المفعل', 'Active Branch')}
              </span>
            </div>

            <form onSubmit={handleQuickAddCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم العميل / المريض *', 'Patient / Customer Name *')}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  placeholder="مثال: ياسمين محمود السيد"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الهاتف المحمول *', 'Mobile Phone *')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={quickCustPhone}
                    onChange={(e) => setQuickCustPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الملف الورقي (اختياري)', 'Paper File Code (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={quickCustPaperCode}
                    onChange={(e) => setQuickCustPaperCode(e.target.value)}
                    placeholder="مثال: F-204"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('مصدر العميل / جهة الإحالة *', 'Lead Source *')}
                </label>
                <select
                  value={quickCustLeadSource}
                  onChange={(e) => setQuickCustLeadSource(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                >
                  <option value="Facebook Ads">Facebook Ads (إعلانات فيسبوك)</option>
                  <option value="Instagram">Instagram (إنستغرام)</option>
                  <option value="TikTok">TikTok (تيك توك)</option>
                  <option value="Walk-in">زيارة مباشرة للفرع (Walk-in)</option>
                  <option value="Friend Referral">ترشيح من مريض / صديق (Referral)</option>
                  <option value="Google Search">بحث جوجل وموقع إلكتروني</option>
                  <option value="Outdoor Sign">لافتة العيادة الخارجية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات أولية أو طبية (اختياري)', 'Notes (Optional)')}
                </label>
                <textarea
                  rows={2}
                  value={quickCustNotes}
                  onChange={(e) => setQuickCustNotes(e.target.value)}
                  placeholder="ملاحظات العميل، استفساراته، تاريخ الحساسية..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickAddCustomerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {t('حفظ واختيار للحجز فوراً', 'Save & Select for Booking')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Detailed History Modal (سجل كل الحجوزات والمتابعات الخاصة بالمريض تفصيلي تحت بعض في أسطر) */}
      {showPatientHistoryModal && (() => {
        const historyPatient =
          (patientHistoryData?.patientId ? partyMap.byId.get(patientHistoryData.patientId) : undefined) ||
          (patientHistoryData?.patientName ? partyMap.byName.get(patientHistoryData.patientName.toLowerCase().trim()) : undefined) ||
          (patientHistoryData?.patientPhone ? partyMap.byPhone.get(patientHistoryData.patientPhone.trim()) : undefined) ||
          parties.find(
            (p) =>
              (patientHistoryData?.patientId && p.id === patientHistoryData.patientId) ||
              (patientHistoryData?.patientName && p.name.toLowerCase() === patientHistoryData.patientName.toLowerCase()) ||
              (patientHistoryData?.patientPhone && p.phone === patientHistoryData.patientPhone)
          );

        const hasSelectedPatient = Boolean(historyPatient || patientHistoryData?.patientName);

        // Instant Multi-Field Patient Search (Search by System Code, Paper Code, Phone, or Name across parties, bookings & followups)
        const qSearch = patientHistorySearch.trim().toLowerCase();
        const matchingSearchPatients = React.useMemo(() => {
          if (!qSearch) return [];
          const matched: Party[] = [];
          const seenKeys = new Set<string>();

          // 1. Search in parties
          for (let i = 0; i < parties.length; i++) {
            const p = parties[i];
            const isCust = p.type === 'Customer' || p.type === 'Both' || !p.type;
            if (!isCust) continue;
            const matches =
              Boolean(p.name && p.name.toLowerCase().includes(qSearch)) ||
              Boolean(p.phone && p.phone.includes(qSearch)) ||
              Boolean(p.systemCode && p.systemCode.toLowerCase().includes(qSearch)) ||
              Boolean(p.paperCode && p.paperCode.toLowerCase().includes(qSearch)) ||
              Boolean(p.code && p.code.toLowerCase().includes(qSearch));
            if (matches) {
              const k = p.id || p.phone || p.name;
              if (!seenKeys.has(k)) {
                seenKeys.add(k);
                matched.push(p);
                if (matched.length >= 30) return matched;
              }
            }
          }

          // 2. Also search in appointments for patients that might only be in appointments
          for (let i = 0; i < appointments.length; i++) {
            const a = appointments[i];
            const matches =
              Boolean(a.patientName && a.patientName.toLowerCase().includes(qSearch)) ||
              Boolean(a.patientPhone && a.patientPhone.includes(qSearch)) ||
              Boolean(a.systemCode && a.systemCode.toLowerCase().includes(qSearch)) ||
              Boolean(a.customerCode && a.customerCode.toLowerCase().includes(qSearch)) ||
              Boolean(a.paperCode && a.paperCode.toLowerCase().includes(qSearch));
            if (matches) {
              const k = a.patientPhone || a.patientName.toLowerCase().trim();
              if (!seenKeys.has(k)) {
                seenKeys.add(k);
                matched.push({
                  id: a.patientId || `apt-cust-${i}`,
                  name: a.patientName,
                  phone: a.patientPhone || '',
                  systemCode: a.systemCode || a.customerCode,
                  paperCode: a.paperCode,
                  type: 'Customer',
                  branchId: a.branchId,
                  balance: 0,
                } as Party);
                if (matched.length >= 30) return matched;
              }
            }
          }

          // 3. Also search in patientFollowUps
          for (let i = 0; i < patientFollowUps.length; i++) {
            const f = patientFollowUps[i];
            const matches =
              Boolean(f.patientName && f.patientName.toLowerCase().includes(qSearch)) ||
              Boolean(f.patientPhone && f.patientPhone.includes(qSearch)) ||
              Boolean(f.systemCode && f.systemCode.toLowerCase().includes(qSearch)) ||
              Boolean(f.customerCode && f.customerCode.toLowerCase().includes(qSearch)) ||
              Boolean(f.paperCode && f.paperCode.toLowerCase().includes(qSearch));
            if (matches) {
              const k = f.patientPhone || f.patientName.toLowerCase().trim();
              if (!seenKeys.has(k)) {
                seenKeys.add(k);
                matched.push({
                  id: f.patientId || `fup-cust-${i}`,
                  name: f.patientName,
                  phone: f.patientPhone || '',
                  systemCode: f.systemCode || f.customerCode,
                  paperCode: f.paperCode,
                  type: 'Customer',
                  branchId: f.branchId,
                  balance: 0,
                } as Party);
                if (matched.length >= 30) return matched;
              }
            }
          }

          return matched;
        }, [qSearch, parties, appointments, patientFollowUps]);

        const selectedSysCode = historyPatient?.systemCode || patientHistoryData?.systemCode;
        const selectedPaperCode = historyPatient?.paperCode || patientHistoryData?.paperCode;

        const currentBookings = hasSelectedPatient
          ? appointments
              .filter(
                (a) =>
                  (patientHistoryData?.patientId && a.patientId === patientHistoryData.patientId) ||
                  (historyPatient?.id && a.patientId === historyPatient.id) ||
                  (patientHistoryData?.patientName && a.patientName && a.patientName.toLowerCase() === patientHistoryData.patientName.toLowerCase()) ||
                  (historyPatient?.name && a.patientName && a.patientName.toLowerCase() === historyPatient.name.toLowerCase()) ||
                  (historyPatient?.phone && a.patientPhone && a.patientPhone === historyPatient.phone) ||
                  (patientHistoryData?.patientPhone && a.patientPhone && a.patientPhone === patientHistoryData.patientPhone) ||
                  (selectedSysCode && (a.systemCode === selectedSysCode || a.customerCode === selectedSysCode)) ||
                  (selectedPaperCode && a.paperCode === selectedPaperCode)
              )
              .sort((a, b) => (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time))
          : [];

        const currentFollows = hasSelectedPatient
          ? patientFollowUps
              .filter(
                (f) =>
                  (patientHistoryData?.patientId && f.patientId === patientHistoryData.patientId) ||
                  (historyPatient?.id && f.patientId === historyPatient.id) ||
                  (patientHistoryData?.patientName && f.patientName && f.patientName.toLowerCase() === patientHistoryData.patientName.toLowerCase()) ||
                  (historyPatient?.name && f.patientName && f.patientName.toLowerCase() === historyPatient.name.toLowerCase()) ||
                  (historyPatient?.phone && f.patientPhone && f.patientPhone === historyPatient.phone) ||
                  (patientHistoryData?.patientPhone && f.patientPhone && f.patientPhone === patientHistoryData.patientPhone) ||
                  (selectedSysCode && (f.systemCode === selectedSysCode || f.customerCode === selectedSysCode)) ||
                  (selectedPaperCode && f.paperCode === selectedPaperCode)
              )
              .sort((a, b) => b.followUpDate.localeCompare(a.followUpDate))
          : [];

        const attendedCount = currentBookings.filter((b) => b.status === 'Attended').length;
        const cancelledCount = currentBookings.filter((b) => b.status === 'Cancelled' || b.status === 'NotAttended').length;

        const handleCloseModal = () => {
          setShowPatientHistoryModal(false);
          setPatientHistoryData(null);
          setPatientHistorySearch('');
        };

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
                      {t('بحث مباشر بكود السيستم، الكود الورقي، رقم الهاتف، أو الاسم لاستعراض السجل الكامل', 'Instant search by system code, paper code, phone, or name')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCloseModal}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none p-1 cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Comprehensive Patient Search Bar */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mx-1" />
                  <input
                    type="text"
                    value={patientHistorySearch}
                    onChange={(e) => setPatientHistorySearch(e.target.value)}
                    placeholder={t(
                      'ابحث عن العميل بكود السيستم، الكود الورقي، رقم الهاتف، أو الاسم...',
                      'Search patient by system code, paper code, phone, or name...'
                    )}
                    className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  {patientHistorySearch && (
                    <button
                      type="button"
                      onClick={() => setPatientHistorySearch('')}
                      className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Search Matching Results Dropdown / Quick Select */}
                {qSearch && (
                  <div className="bg-slate-50 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 max-h-56 overflow-y-auto space-y-1 shadow-md">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 pb-1 border-b border-slate-200 dark:border-slate-700">
                      <span>{t('نتائج البحث المطابقة:', 'Matching Patients:')} ({matchingSearchPatients.length})</span>
                      <span className="text-[10px] text-slate-400">{t('اضغط على العميل لعرض سجله', 'Click to view history')}</span>
                    </div>
                    {matchingSearchPatients.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        {t('لا يوجد عميل مطابق للبحث الحالي.', 'No patient found matching search.')}
                      </div>
                    ) : (
                      matchingSearchPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPatientHistoryData({
                              patientId: p.id,
                              patientName: p.name,
                              patientPhone: p.phone,
                              systemCode: p.systemCode || p.code,
                              paperCode: p.paperCode,
                            });
                            setPatientHistorySearch('');
                          }}
                          className="w-full text-start p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 flex items-center justify-between gap-3 transition-colors cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</span>
                            {p.phone && <span className="font-mono text-[11px] text-slate-500">{p.phone}</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {p.systemCode && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded">
                                سيستم: {p.systemCode}
                              </span>
                            )}
                            {p.paperCode && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded">
                                ورقي: {p.paperCode}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* EMPTY STATE: WHEN NO CLIENT IS SELECTED YET */}
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
                      'أدخل كود السيستم، الكود الورقي، رقم الهاتف، أو اسم العميل في شريط البحث أعلاه لعرض كافة الحجوزات والمتابعات الخاصة به بالأسطر.',
                      'Enter system code, paper code, phone, or name in the search bar above to view all detailed bookings and follow-up records.'
                    )}
                  </p>
                </div>
              ) : (
                <>
                  {/* Patient Profile & Stats Banner */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black text-base flex items-center justify-center">
                          {(patientHistoryData?.patientName || 'م').charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 dark:text-white text-base">
                              {patientHistoryData?.patientName || historyPatient?.name}
                            </span>
                            {(historyPatient?.systemCode || historyPatient?.paperCode) && (
                              <div className="flex items-center gap-1">
                                {historyPatient.systemCode && (
                                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 rounded-md">
                                    سيستم: {historyPatient.systemCode}
                                  </span>
                                )}
                                {historyPatient.paperCode && (
                                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 rounded-md">
                                    ورقي: {historyPatient.paperCode}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Change Patient Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setPatientHistoryData(null);
                                setPatientHistorySearch('');
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 rounded-md border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                            >
                              {t('بحث عن عميل آخر', 'Search Another Client')}
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3" />
                              {patientHistoryData?.patientPhone || historyPatient?.phone || '-'}
                            </span>
                            {(patientHistoryData?.patientPhone || historyPatient?.phone) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const phone = patientHistoryData?.patientPhone || historyPatient?.phone;
                                  if (phone) {
                                    shareViaWhatsApp(
                                      phone,
                                      `مرحباً ${patientHistoryData?.patientName || historyPatient?.name}، نتواصل معك من ${tenant?.name || 'المركز الطبي'}`
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                              >
                                <MessageSquare className="h-3 w-3" />
                                <span>واتساب</span>
                              </button>
                            )}
                            <span>•</span>
                            <span>{t('المصدر:', 'Source:')} <strong className="text-slate-700 dark:text-slate-300">{historyPatient?.leadSource || 'زيارة مباشرة'}</strong></span>
                            <span>•</span>
                            <span>{t('الفرع:', 'Branch:')} <strong className="text-slate-700 dark:text-slate-300">{historyPatient?.branchId || activeBranch?.name || 'الرئيسي'}</strong></span>
                            <span>•</span>
                            <span>{t('تاريخ التكويد:', 'Created:')} <strong className="font-mono text-slate-700 dark:text-slate-300">{historyPatient?.createdAt?.split('T')[0] || '2026-01-15'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Summary Counters */}
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

                  {/* View Filters Tabs */}
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <button
                      onClick={() => setHistoryFilterTab('all')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        historyFilterTab === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t('كافة السجلات (حجوزات ومتابعات)', 'All Records')} ({currentBookings.length + currentFollows.length})
                    </button>
                    <button
                      onClick={() => setHistoryFilterTab('bookings')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                        historyFilterTab === 'bookings'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{t('سجل الحجوزات فقط', 'Bookings Only')} ({currentBookings.length})</span>
                    </button>
                    <button
                      onClick={() => setHistoryFilterTab('followups')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                        historyFilterTab === 'followups'
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

              {/* SECTION 1: DETAILED BOOKINGS IN ROWS */}
              {(historyFilterTab === 'all' || historyFilterTab === 'bookings') && (
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
                      <table className="w-full text-xs text-left rtl:text-right">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">{t('تاريخ وتوقيت الحجز', 'Booking Date & Time')}</th>
                            <th className="p-3">{t('الخدمة / الجلسة', 'Service / Session')}</th>
                            <th className="p-3">{t('الطبيب المعالج', 'Doctor')}</th>
                            <th className="p-3">{t('حالة الحجز', 'Status')}</th>
                            <th className="p-3">{t('سبب الإلغاء / عدم الحضور', 'Cancellation / No-Show Reason')}</th>
                            <th className="p-3">{t('ملاحظات الحجز', 'Booking Notes')}</th>
                            <th className="p-3">{t('تاريخ التسجيل', 'Created At')}</th>
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

                            return (
                              <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
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
                                <td className="p-3">
                                  {b.cancellationReason && (
                                    <span className="text-rose-600 text-xs font-semibold block">{b.cancellationReason}</span>
                                  )}
                                  {b.notAttendedReason && (
                                    <span className="text-amber-600 text-xs font-semibold block">{b.notAttendedReason}</span>
                                  )}
                                  {!b.cancellationReason && !b.notAttendedReason && (
                                    <span className="text-slate-400 text-xs font-mono">-</span>
                                  )}
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

              {/* SECTION 2: DETAILED FOLLOW-UPS IN ROWS */}
              {(historyFilterTab === 'all' || historyFilterTab === 'followups') && (
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
                      <table className="w-full text-xs text-left rtl:text-right">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">{t('تاريخ المتابعة المستحق', 'Due Date')}</th>
                            <th className="p-3">{t('نوع وتصنيف المتابعة', 'Type')}</th>
                            <th className="p-3">{t('موضوع وسبب المتابعة', 'Reason / Subject')}</th>
                            <th className="p-3">{t('حالة المتابعة', 'Status')}</th>
                            <th className="p-3">{t('ملاحظات ونتائج التواصل', 'Notes & Result')}</th>
                            <th className="p-3">{t('المسؤول / التابع له', 'Created By')}</th>
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

                            return (
                              <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
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
                                      setPatientHistoryData(null);
                                      handleConvertFollowUpToBooking(f);
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
                      if (historyPatient) {
                        handleSelectExistingPatient(historyPatient.id);
                      } else if (patientHistoryData) {
                        setPatientName(patientHistoryData.patientName);
                        setPatientPhone(patientHistoryData.patientPhone || '');
                      }
                      handleCloseModal();
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('+ حجز موعد جديد لهذا المريض', '+ New Booking for Patient')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFupPatientId(historyPatient?.id || '');
                      setFupPatientName(patientHistoryData?.patientName || historyPatient?.name || '');
                      setFupPatientPhone(patientHistoryData?.patientPhone || historyPatient?.phone || '');
                      handleCloseModal();
                      setShowAddFollowUpModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    <span>{t('+ تسجيل متابعة جديدة للمريض', '+ New Follow-up')}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  {t('إغلاق السجل', 'Close')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EXCEL DATA TRANSFER & VALIDATION MODAL FOR BOOKINGS */}
      <ExcelDataTransferModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        entityTitleAr="حجوزات ومواعيد المرضى"
        entityTitleEn="Patient Bookings & Appointments"
        descriptionAr="استيراد وتصدير جدول الحجوزات مع الفحص الخلوي الذكي للتأكد من المواعيد والأطباء وربط كود العميل"
        columns={bookingsExcelColumns}
        currentDataForExport={filteredAppointments.map((a) => {
          const range = getAppointmentTimeRange(a);
          const sTime = a.startTime || (range.startMin !== null ? formatMinutesTo24h(range.startMin) : (a.time ? a.time.split(' - ')[0] : '10:00'));
          const eTime = a.endTime || (range.endMin !== null ? formatMinutesTo24h(range.endMin) : (a.time && a.time.includes(' - ') ? a.time.split(' - ')[1] : '10:45'));
          const party = parties.find((p) => p.id === a.patientId || p.systemCode === a.systemCode || p.systemCode === a.customerCode);
          return {
            paperCode: a.paperCode || party?.paperCode || '',
            customerCode: a.customerCode || a.systemCode || party?.systemCode || '',
            patientName: a.patientName,
            patientPhone: a.patientPhone || '',
            date: a.date,
            doctorName: a.doctorName || '',
            startTime: sTime,
            endTime: eTime,
            serviceNameAr: a.serviceNameAr,
            price: a.price || 0,
            deposit: a.deposit || 0,
            status: a.status,
            notes: a.notes || '',
          };
        })}
        exportFileNamePrefix="جدول_الحجوزات_والمواعيد"
        validator={validateBookingRows}
        onConfirmImport={handleConfirmBookingsImport}
        branchName={activeBranch?.name || 'الفرع الحالي'}
      />

      {/* EXCEL DATA TRANSFER & VALIDATION MODAL FOR PATIENT FOLLOW-UPS & REMINDERS */}
      <ExcelDataTransferModal
        isOpen={showFollowUpExcelModal}
        onClose={() => setShowFollowUpExcelModal(false)}
        entityTitleAr="جدول المتابعات والتذكير للمرضى"
        entityTitleEn="Patient Follow-ups & Reminders"
        descriptionAr="استيراد وتصدير جدول المتابعات والتذكير مع الفحص الخلوي الذكي وربط كود العميل آلياً بدون تجميد المتصفح"
        columns={followUpsExcelColumns}
        currentDataForExport={filteredFollowUps.map((f) => {
          const party = parties.find((p) => p.id === f.patientId || p.systemCode === f.systemCode || p.systemCode === f.customerCode);
          return {
            paperCode: f.paperCode || party?.paperCode || '',
            customerCode: f.customerCode || f.systemCode || party?.systemCode || '',
            patientName: f.patientName,
            patientPhone: f.patientPhone || '',
            followUpDate: f.followUpDate,
            followUpTime: f.followUpTime || '11:00 AM',
            reason: f.reason || '',
            type: f.type || 'Recall',
            status: f.status || 'Pending',
            notes: f.notes || '',
            createdBy: f.createdBy || '',
          };
        })}
        exportFileNamePrefix="جدول_المتابعات_والتذكير"
        validator={validateFollowUpRows}
        onConfirmImport={handleConfirmFollowUpsImport}
        branchName={activeBranch?.name || 'الفرع الحالي'}
      />
    </div>
  );
};
