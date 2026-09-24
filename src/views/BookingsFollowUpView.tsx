import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Appointment, TreatmentPlan, Party, PatientFollowUp } from '../types';
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
} from 'lucide-react';

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
  } = usePlatform();

  const isRtl = language === 'ar';

  // Navigation Tabs (Treatment plans and packages removed as requested)
  const [activeTab, setActiveTab] = useState<'agenda' | 'next_day' | 'followup'>('agenda');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('All');
  
  // Date Range Filter (From Date -> To Date)
  const todayIso = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState<string>(todayIso);
  const [dateTo, setDateTo] = useState<string>(todayIso);

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

  // Tomorrow's Date for Next Day Bookings
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowIso = tomorrowObj.toISOString().split('T')[0];

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

  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [selectedFollowUp, setSelectedFollowUp] = useState<PatientFollowUp | null>(null);
  const [selectedPatientFor360, setSelectedPatientFor360] = useState<Party | null>(null);

  // Form: Add / Edit Booking
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [systemCode, setSystemCode] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [serviceNameAr, setServiceNameAr] = useState('');
  const [serviceNameEn, setServiceNameEn] = useState('');
  const [roomNumber, setRoomNumber] = useState('غرفة 1');
  const [aptDate, setAptDate] = useState(todayIso);
  const [aptTime, setAptTime] = useState('12:00 PM');
  const [price, setPrice] = useState<number>(500);
  const [deposit, setDeposit] = useState<number>(0);
  const [leadSource, setLeadSource] = useState('Facebook Ads');
  const [notes, setNotes] = useState('');

  // Form: Follow-up
  const [fupPatientId, setFupPatientId] = useState('');
  const [fupPatientName, setFupPatientName] = useState('');
  const [fupPatientPhone, setFupPatientPhone] = useState('');
  const [fupSystemCode, setFupSystemCode] = useState('');
  const [fupDate, setFupDate] = useState(tomorrowIso);
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
  const [newTime, setNewTime] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  // New Treatment Plan Form
  const [planPatientId, setPlanPatientId] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planDoctorName, setPlanDoctorName] = useState('');
  const [planTotalSessions, setPlanTotalSessions] = useState<number>(6);
  const [planTotalCost, setPlanTotalCost] = useState<number>(3000);

  // Helper: Find Party by patient name or ID
  const getPartyForPatient = (pId?: string, pName?: string) => {
    return parties.find((p) => (pId && p.id === pId) || (pName && p.name === pName));
  };

  // Helper: Get Future Status for a customer (حجز قادم أو متابعة قادمة)
  const getCustomerFutureStatus = (patientName: string, patientPhone?: string, patientId?: string, currentAptId?: string) => {
    // Find future appointment after today or current row
    const futureApt = appointments.find(
      (a) =>
        a.id !== currentAptId &&
        ((patientId && a.patientId === patientId) ||
          a.patientName.toLowerCase() === patientName.toLowerCase() ||
          (patientPhone && a.patientPhone && a.patientPhone === patientPhone)) &&
        a.date >= todayIso &&
        a.status !== 'Cancelled'
    );

    // Find pending future follow-up
    const futureFup = patientFollowUps.find(
      (f) =>
        ((patientId && f.patientId === patientId) ||
          f.patientName.toLowerCase() === patientName.toLowerCase() ||
          (patientPhone && f.patientPhone && f.patientPhone === patientPhone)) &&
        f.followUpDate >= todayIso &&
        f.status === 'Pending'
    );

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

  // Filtered Appointments (Search by name, phone, or systemCode, with Date Range)
  const filteredAppointments = appointments.filter((apt) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      apt.patientName.toLowerCase().includes(q) ||
      (apt.patientPhone && apt.patientPhone.includes(q)) ||
      (apt.systemCode && apt.systemCode.toLowerCase().includes(q)) ||
      apt.serviceNameAr.toLowerCase().includes(q) ||
      (apt.doctorName && apt.doctorName.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'All' || apt.status === statusFilter;
    const matchesDoctor = selectedDoctorId === 'All' || apt.doctorId === selectedDoctorId;
    
    const matchesDate =
      activeTab === 'agenda'
        ? (!dateFrom || apt.date >= dateFrom) && (!dateTo || apt.date <= dateTo)
        : true;

    return matchesSearch && matchesStatus && matchesDoctor && matchesDate;
  });

  // Next Day Appointments (حجوزات اليوم التالي المستقلة)
  const nextDayAppointments = appointments.filter((apt) => {
    const isTomorrow = apt.date === tomorrowIso;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      apt.patientName.toLowerCase().includes(q) ||
      (apt.patientPhone && apt.patientPhone.includes(q)) ||
      (apt.systemCode && apt.systemCode.toLowerCase().includes(q)) ||
      apt.serviceNameAr.toLowerCase().includes(q) ||
      (apt.doctorName && apt.doctorName.toLowerCase().includes(q));

    return isTomorrow && matchesSearch;
  });

  // Filtered Patient Follow-ups
  const filteredFollowUps = patientFollowUps.filter((fup) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      fup.patientName.toLowerCase().includes(q) ||
      (fup.patientPhone && fup.patientPhone.includes(q)) ||
      (fup.systemCode && fup.systemCode.toLowerCase().includes(q)) ||
      (fup.reason && fup.reason.toLowerCase().includes(q)) ||
      (fup.notes && fup.notes.toLowerCase().includes(q));

    const matchesDate =
      (!dateFrom || fup.followUpDate >= dateFrom) && (!dateTo || fup.followUpDate <= dateTo);

    return matchesSearch && matchesDate;
  });

  const handleSelectExistingPatient = (pId: string) => {
    setPatientId(pId);
    const p = parties.find((party) => party.id === pId);
    if (p) {
      setPatientName(p.name);
      setPatientPhone(p.phone);
      setSystemCode(p.systemCode || '');
      if (p.leadSource) setLeadSource(p.leadSource);
    }
  };

  const handleSelectService = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prod = products.find((p) => p.id === e.target.value);
    if (prod) {
      setServiceNameAr(prod.nameAr);
      setServiceNameEn(prod.nameEn);
      setPrice(prod.sellingPrice);
    }
  };

  const handleAutoTranslateService = () => {
    if (serviceNameAr.trim()) {
      setServiceNameEn(autoTranslateArabic(serviceNameAr));
    }
  };

  // Submit Add Booking (Doctor Name is MANDATORY)
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId && !doctorName.trim()) {
      alert(t('اسم الطبيب المعالج إجباري لتسجيل الحجز!', 'Doctor name is mandatory for bookings!'));
      return;
    }

    const doc = staffMembers.find((s) => s.id === doctorId);
    const tech = staffMembers.find((s) => s.id === technicianId);
    const resolvedDoctorName = doc ? doc.nameAr : doctorName.trim() || 'د. استشاري';

    // Find if party already exists or register them in Customers (العملاء)
    let finalPatientId = patientId;
    let finalSystemCode = systemCode;
    const existingParty = parties.find(
      (p) =>
        (patientId && p.id === patientId) ||
        p.name.trim().toLowerCase() === patientName.trim().toLowerCase() ||
        (patientPhone.trim() && p.phone.trim() === patientPhone.trim())
    );

    if (existingParty) {
      finalPatientId = existingParty.id;
      finalSystemCode = existingParty.systemCode || systemCode || `CUST-${Date.now().toString().slice(-4)}`;
    } else {
      // Auto-register new patient in Customers database
      const newParty = addParty({
        name: patientName.trim(),
        phone: patientPhone.trim() || '01000000000',
        type: 'Customer',
        category: 'Patient',
        branchId: activeBranch?.id,
        leadSource: leadSource || 'زيارة مباشرة',
        systemCode: `PAT-${Date.now().toString().slice(-4)}`,
        notes: 'تمت إضافته تلقائياً عند حجز موعد جديد',
      });
      finalPatientId = newParty.id;
      finalSystemCode = newParty.systemCode || `PAT-${Date.now().toString().slice(-4)}`;
    }

    addAppointment({
      patientId: finalPatientId,
      systemCode: finalSystemCode,
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      doctorId: doctorId || undefined,
      doctorName: resolvedDoctorName,
      technicianId: technicianId || undefined,
      technicianName: tech ? tech.nameAr : undefined,
      serviceNameAr: serviceNameAr.trim(),
      serviceNameEn: serviceNameEn.trim() || autoTranslateArabic(serviceNameAr),
      roomNumber: '',
      date: aptDate,
      time: aptTime,
      price: 0,
      deposit: 0,
      remainingBalance: 0,
      leadSource: leadSource || existingParty?.leadSource || 'زيارة مباشرة',
      status: 'Scheduled',
      notes,
    });

    // Reset Form
    setPatientId('');
    setPatientName('');
    setPatientPhone('');
    setSystemCode('');
    setDoctorId('');
    setDoctorName('');
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
    setDoctorId(apt.doctorId || '');
    setDoctorName(apt.doctorName || '');
    setTechnicianId(apt.technicianId || '');
    setServiceNameAr(apt.serviceNameAr);
    setServiceNameEn(apt.serviceNameEn || '');
    setAptDate(apt.date);
    setAptTime(apt.time);
    setLeadSource(apt.leadSource || 'Facebook Ads');
    setNotes(apt.notes || '');
    setShowEditAptModal(true);
  };

  const handleEditAptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt) return;
    const doc = staffMembers.find((s) => s.id === doctorId);
    const tech = staffMembers.find((s) => s.id === technicianId);

    updateAppointment(selectedApt.id, {
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      systemCode,
      doctorId: doctorId || undefined,
      doctorName: doc ? doc.nameAr : doctorName || selectedApt.doctorName,
      technicianId: technicianId || undefined,
      technicianName: tech ? tech.nameAr : undefined,
      serviceNameAr,
      serviceNameEn: serviceNameEn || autoTranslateArabic(serviceNameAr),
      roomNumber: '',
      date: aptDate,
      time: aptTime,
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
    if (selectedApt && newDate && newTime) {
      rescheduleAppointment(selectedApt.id, newDate, newTime, rescheduleNotes);
      setShowRescheduleModal(false);
    }
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

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
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
                  {t('شاشة الحجز والمتابعة وإدارة المرضى', 'Bookings, Agenda & Patient Follow-ups')}
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-full">
                  {appointments.length} {t('حجز مسجل', 'Bookings')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  'البحث برقم الهاتف أو الكود أو الاسم، حجوزات الغد المستقلة، سجل المتابعات للتذكير، ومصدر وتاريخ التكويد',
                  'Search by phone, name or code, next-day bookings confirmation, standalone follow-ups & lead sources'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          </div>

          {/* Action Buttons */}
          {activeTab === 'followup' ? (
            <button
              onClick={() => setShowAddFollowUpModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>{t('تسجيل متابعة مريض جديد', 'Add Follow-up')}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t('حجز موعد جديد', 'New Booking')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Bar (Name, Phone, System Code, Date Range & Presets) */}
      {activeTab !== 'next_day' && (
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
                {staffMembers
                  .filter((s) => s.roleType === 'Doctor')
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
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('جدول أجندة ومواعيد الحجوزات', 'Bookings Agenda Table')}
              </h2>
              <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md font-bold">
                {filteredAppointments.length} {t('حجز', 'Records')}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">{t('كود واسم المريض والهاتف', 'Patient Code, Name & Phone')}</th>
                  <th className="p-3.5">{t('مصدر وتاريخ تكويد العميل', 'Lead Source & Account Creation Date')}</th>
                  <th className="p-3.5">{t('الخدمة / الجلسة', 'Service / Session')}</th>
                  <th className="p-3.5">{t('الطبيب المعالج * / التكنيشن', 'Doctor * / Technician')}</th>
                  <th className="p-3.5">{t('الموعد والغرفة', 'Date, Time & Room')}</th>
                  <th className="p-3.5">{t('حالة العميل القادمة', 'Customer Future Status')}</th>
                  <th className="p-3.5">{t('حالة الحجز', 'Booking Status')}</th>
                  <th className="p-3.5 text-center">{t('إجراءات ومتابعة', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p>{t('لا توجد حجوزات مطابقة للفلاتر المحددة.', 'No bookings matching the criteria.')}</p>
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((apt, idx) => {
                    const party = getPartyForPatient(apt.patientId, apt.patientName);
                    const creationDate = party?.createdAt
                      ? party.createdAt.split('T')[0]
                      : apt.createdAt ? apt.createdAt.split('T')[0] : '2026-01-15';
                    const activeLeadSource = apt.leadSource || party?.leadSource || '';
                    const custCode = apt.systemCode || party?.systemCode || `CUST-${1000 + idx}`;
                    const futureStatus = getCustomerFutureStatus(apt.patientName, apt.patientPhone, apt.patientId, apt.id);

                    const statusBadge = {
                      Scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200',
                      Confirmed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200',
                      Attended: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300',
                      NotAttended: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
                      Cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200',
                    }[apt.status] || 'bg-slate-100 text-slate-700';

                    return (
                      <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-semibold text-slate-400">{idx + 1}</td>

                        {/* Patient Code, Name & Phone */}
                        <td className="p-3.5">
                          <button
                            onClick={() => handleOpen360(apt)}
                            className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 cursor-pointer text-right rtl:text-right"
                          >
                            <span>{apt.patientName}</span>
                            <Eye className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded">
                              {custCode}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {apt.patientPhone || '-'}
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
                            {language === 'ar' ? apt.serviceNameAr : apt.serviceNameEn || apt.serviceNameAr}
                          </div>
                        </td>

                        {/* Doctor * / Technician */}
                        <td className="p-3.5">
                          <div className="text-slate-900 dark:text-white font-bold flex items-center gap-1">
                            <Stethoscope className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span>{apt.doctorName || t('د. استشاري', 'Dr. Consultant')}</span>
                          </div>
                          {apt.technicianName && (
                            <div className="text-[10px] text-slate-400 mt-0.5">تك: {apt.technicianName}</div>
                          )}
                        </td>

                        {/* Date, Time & Room */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">{apt.time}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{apt.date} • {apt.roomNumber || 'عيادة 1'}</div>
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
                                setNewTime(apt.time);
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

      {/* TAB 2: INDEPENDENT NEXT DAY BOOKINGS TABLE (جدول حجوزات اليوم التالي المستقل مع تأكيد وإلغاء وتعديل) */}
      {activeTab === 'next_day' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
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
                  {t('تاريخ الغد:', "Tomorrow's Date:")} <span className="font-bold text-emerald-600">{tomorrowIso}</span> • {nextDayAppointments.length} {t('حجز مسجل للغد', 'bookings for tomorrow')}
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
                  <th className="p-3">{t('التوقيت والغرفة', 'Time & Room')}</th>
                  <th className="p-3">{t('حالة الحجز', 'Status')}</th>
                  <th className="p-3 text-center">{t('إجراءات (إلغاء وتعديل)', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nextDayAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <CalendarCheck className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p>{t('لا توجد أي حجوزات مسجلة لليوم التالي حتى الآن.', 'No bookings scheduled for tomorrow yet.')}</p>
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
                    const isConfirmed = apt.status === 'Confirmed';

                    return (
                      <tr
                        key={apt.id}
                        className={`transition-colors ${
                          isConfirmed ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
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
                              {apt.systemCode || party?.systemCode || `CUST-${1000 + idx}`}
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
                          {apt.doctorName || t('د. استشاري', 'Dr. Consultant')}
                        </td>

                        {/* Time & Room */}
                        <td className="p-3">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 block">{apt.time}</span>
                          <span className="text-[11px] text-slate-400">{apt.roomNumber || 'عيادة 1'}</span>
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

                        {/* Actions: (X) for cancel, Pencil for Edit */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
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

            <button
              onClick={() => setShowAddFollowUpModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>{t('تسجيل متابعة مريض جديدة', 'Add Follow-up Entry')}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{t('كود واسم المريض والهاتف', 'Patient Name, Code & Phone')}</th>
                  <th className="p-3">{t('المصدر وتاريخ التكويد', 'Source & Creation Date')}</th>
                  <th className="p-3">{t('تاريخ المتابعة المستحق', 'Due Follow-up Date')}</th>
                  <th className="p-3">{t('موضوع وسبب المتابعة', 'Follow-up Topic / Reason')}</th>
                  <th className="p-3">{t('المسؤول / التابع لـ', 'Created By')}</th>
                  <th className="p-3">{t('حالة العميل القادمة', 'Future Status')}</th>
                  <th className="p-3">{t('حالة المتابعة', 'Follow-up Status')}</th>
                  <th className="p-3 text-center">{t('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredFollowUps.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p>{t('لا توجد متابعات مطابقة للفترة المحددة.', 'No follow-ups recorded.')}</p>
                    </td>
                  </tr>
                ) : (
                  filteredFollowUps.map((fup, idx) => {
                    const party = getPartyForPatient(fup.patientId, fup.patientName);
                    const creationDate = party?.createdAt
                      ? party.createdAt.split('T')[0]
                      : fup.createdAt ? fup.createdAt.split('T')[0] : '2026-01-20';
                    const futureStatus = getCustomerFutureStatus(fup.patientName, fup.patientPhone, fup.patientId);

                    const statusBadge = {
                      Pending: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
                      Contacted: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200',
                      Booked: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200',
                      NoAnswer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
                      Cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200',
                    }[fup.status] || 'bg-slate-100 text-slate-700';

                    return (
                      <tr key={fup.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>

                        {/* Patient Name, Code & Phone */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{fup.patientName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-1 rounded">
                              {fup.systemCode || party?.systemCode || `CUST-${1000 + idx}`}
                            </span>
                            <span>{fup.patientPhone}</span>
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

                        {/* Follow-up Date */}
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          {fup.followUpDate}
                        </td>

                        {/* Reason & Notes */}
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{fup.reason}</div>
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
                          <select
                            value={fup.status}
                            onChange={(e) => updatePatientFollowUp(fup.id, { status: e.target.value as any })}
                            className={`text-[11px] font-bold rounded-lg border px-2 py-0.5 ${statusBadge}`}
                          >
                            <option value="Pending">{t('قيد الانتظار', 'Pending')}</option>
                            <option value="Contacted">{t('تم التواصل', 'Contacted')}</option>
                            <option value="Booked">{t('تم الحجز بنجاح', 'Booked')}</option>
                            <option value="NoAnswer">{t('لم يرد / مغلق', 'No Answer')}</option>
                            <option value="Cancelled">{t('اعتذر / ملغي', 'Cancelled')}</option>
                          </select>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Convert to Booking */}
                            <button
                              onClick={() => handleConvertFollowUpToBooking(fup)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg cursor-pointer transition-colors"
                              title={t('تحويل إلى حجز مؤكد', 'Convert to Booking')}
                            >
                              <Plus className="h-3 w-3" />
                              <span>{t('حجز موعد', 'Book')}</span>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => deletePatientFollowUp(fup.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                              title={t('حذف المتابعة', 'Delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
              {/* Patient Selection & Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اختيار مريض مسجل', 'Select Registered Patient')}
                  </label>
                  <select
                    value={patientId}
                    onChange={(e) => handleSelectExistingPatient(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('عميل جديد أو كتابة يدوية...', 'New or custom...')}</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.systemCode || p.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم المريض *', 'Patient Name *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="اسم المريض بالكامل..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الهاتف / واتساب *', 'Phone / WhatsApp *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Service Selection */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('اختيار الخدمة من القائمة أو كتابتها', 'Select Service or Type Custom')}
                  </label>
                  <select
                    onChange={handleSelectService}
                    className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="">{t('اختر من قائمة الخدمات...', 'Pick from services...')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {language === 'ar' ? p.nameAr : p.nameEn} ({formatMoney(p.sellingPrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {t('اسم الخدمة (عربي) *', 'Service Name (Arabic) *')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={serviceNameAr}
                        onChange={(e) => setServiceNameAr(e.target.value)}
                        placeholder="جلسة ليزر فول بودي..."
                        className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={handleAutoTranslateService}
                        className="px-2.5 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl cursor-pointer"
                        title={t('ترجمة للإنجليزية', 'Translate to English')}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {t('اسم الخدمة (إنجليزي) *', 'Service Name (English) *')}
                    </label>
                    <input
                      type="text"
                      required
                      value={serviceNameEn}
                      onChange={(e) => setServiceNameEn(e.target.value)}
                      placeholder="Full Body Laser Session..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* MANDATORY Doctor Name, Technician, Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                    {t('الطبيب المعالج * (إجباري)', 'Doctor * (Mandatory)')}
                  </label>
                  <select
                    required
                    value={doctorId}
                    onChange={(e) => {
                      setDoctorId(e.target.value);
                      const d = staffMembers.find((s) => s.id === e.target.value);
                      if (d) setDoctorName(d.nameAr);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 focus:outline-indigo-600 font-bold"
                  >
                    <option value="">{t('اختر الطبيب المعالج *...', 'Select Doctor *...')}</option>
                    {staffMembers
                      .filter((s) => s.roleType === 'Doctor')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr} ({d.specialtyAr || d.jobTitleAr})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التكنيشن / المساعد', 'Technician')}
                  </label>
                  <select
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('اختر التكنيشن...', 'Select...')}</option>
                    {staffMembers
                      .filter((s) => s.roleType === 'Technician' || s.roleType === 'Employee')
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nameAr}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التاريخ', 'Date')}
                  </label>
                  <input
                    type="date"
                    required
                    value={aptDate}
                    onChange={(e) => setAptDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التوقيت والغرفة', 'Time & Room')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={aptTime}
                      onChange={(e) => setAptTime(e.target.value)}
                      placeholder="12:00 PM"
                      className="w-1/2 px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="غرفة 1"
                      className="w-1/2 px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Price, Deposit & Lead Source */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('سعر الجلسة (ج.م)', 'Price (EGP)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('المقدم المدفوع (عربون)', 'Deposit')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold text-emerald-600 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('مصدر العميل / الإعلان', 'Lead Source')}
                  </label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Facebook Ads">إعلانات فيسبوك (Facebook Ads)</option>
                    <option value="Instagram">إنستجرام (Instagram)</option>
                    <option value="TikTok">تيك توك (TikTok)</option>
                    <option value="Friend Referral">ترشيح صديق / عميل سابق</option>
                    <option value="Walk-in">زيارة مباشرة للفرع</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('ملاحظات الحجز والحالة الطبية', 'Medical Notes')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات الحساسية، التوصيات الخاصة..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
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
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
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
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('رقم الهاتف', 'Phone')}
                  </label>
                  <input
                    type="text"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود السيستم', 'System Code')}
                  </label>
                  <input
                    type="text"
                    value={systemCode}
                    onChange={(e) => setSystemCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                    {t('الطبيب المعالج *', 'Doctor *')}
                  </label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="">{t('اختر الطبيب...', 'Select Doctor...')}</option>
                    {staffMembers
                      .filter((s) => s.roleType === 'Doctor')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التاريخ', 'Date')}
                  </label>
                  <input
                    type="date"
                    value={aptDate}
                    onChange={(e) => setAptDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التوقيت والغرفة', 'Time & Room')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aptTime}
                      onChange={(e) => setAptTime(e.target.value)}
                      className="w-1/2 px-2 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-1/2 px-2 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الخدمة', 'Service Name')}
                </label>
                <input
                  type="text"
                  value={serviceNameAr}
                  onChange={(e) => setServiceNameAr(e.target.value)}
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
                  {t('التاريخ الجديد *', 'New Date *')}
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('التوقيت الجديد *', 'New Time *')}
                </label>
                <input
                  type="text"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  placeholder="03:00 PM"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                />
              </div>

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
    </div>
  );
};
