import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Patient, Appointment } from '../types';
import {
  Stethoscope,
  Calendar,
  User,
  Plus,
  CheckCircle2,
  Clock,
  FileText,
  Activity,
  HeartPulse,
  Phone,
  Search,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export const ClinicsView: React.FC = () => {
  const {
    t,
    formatMoney,
    patients,
    appointments,
    treatmentPlans,
    addPatient,
    addAppointment,
    updateAppointmentStatus,
    progressTreatmentPlan,
    products,
    language,
  } = usePlatform();

  const [activeSubTab, setActiveSubTab] = useState<'appointments' | 'patients' | 'plans'>('appointments');
  const [showBookModal, setShowBookModal] = useState<boolean>(false);
  const [showPatientModal, setShowPatientModal] = useState<boolean>(false);

  // New Appointment Form
  const [newApt, setNewApt] = useState({
    patientId: patients[0]?.id || '',
    doctorName: 'د. حازم القاضي (استشاري العظام)',
    serviceNameAr: 'كشف استشاري عظام وتأهيل طبي',
    serviceNameEn: 'Orthopedic Consultation',
    price: 400,
    date: new Date().toISOString().split('T')[0],
    time: '18:00',
    notes: '',
  });

  // New Patient Form
  const [newPat, setNewPat] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '1990-01-01',
    gender: 'Male' as const,
    chronicDiseases: '',
    allergies: '',
  });

  const handleSaveAppointment = () => {
    const pat = patients.find((p) => p.id === newApt.patientId) || patients[0];
    addAppointment({
      branchId: 'branch-cairo',
      patientId: pat.id,
      patientName: pat.fullName,
      doctorName: newApt.doctorName,
      serviceNameAr: newApt.serviceNameAr,
      serviceNameEn: newApt.serviceNameEn,
      price: Number(newApt.price),
      date: newApt.date,
      time: newApt.time,
      notes: newApt.notes,
    });
    setShowBookModal(false);
  };

  const handleSavePatient = () => {
    if (!newPat.fullName.trim() || !newPat.phone.trim()) {
      alert(t('يرجى ملء اسم المريض ورقم الهاتف!', 'Please fill patient name and phone!'));
      return;
    }
    addPatient({
      fullName: newPat.fullName,
      phone: newPat.phone,
      dateOfBirth: newPat.dateOfBirth,
      gender: newPat.gender,
      chronicDiseases: newPat.chronicDiseases ? [newPat.chronicDiseases] : [],
      allergies: newPat.allergies ? [newPat.allergies] : [],
    });
    setShowPatientModal(false);
    setNewPat({
      fullName: '',
      phone: '',
      dateOfBirth: '1990-01-01',
      gender: 'Male',
      chronicDiseases: '',
      allergies: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {t('المراكز الطبية وبرامج العلاج (Clinics & EHR)', 'Medical Clinics & Treatment Plans')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'ملفات المرضى الطبية، حجز المواعيد، متابعة خطط الجلسات المتعددة، وربطها بالـ POS والمحاسبة.',
              'Patient health records, doctor scheduling, and multi-session treatment plans.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPatientModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition-colors"
          >
            <User className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>{t('فتح ملف مريض جديد', 'New Patient File')}</span>
          </button>

          <button
            onClick={() => setShowBookModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition-all active:scale-95"
          >
            <Calendar className="h-4 w-4" />
            <span>{t('حجز موعد / كشف طبي', 'Book Appointment')}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveSubTab('appointments')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors ${
            activeSubTab === 'appointments'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>{t('جدول المواعيد والكشوفات', 'Appointments Schedule')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {appointments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('plans')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors ${
            activeSubTab === 'plans'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>{t('برامج وخطط العلاج (Treatment Plans)', 'Treatment Plans')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {treatmentPlans.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('patients')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors ${
            activeSubTab === 'patients'
              ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <User className="h-4 w-4" />
          <span>{t('سجل ملفات المرضى (EHR)', 'Patient Directory')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {patients.length}
          </span>
        </button>
      </div>

      {/* SUBTAB 1: APPOINTMENTS */}
      {activeSubTab === 'appointments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">{apt.patientName}</h3>
                    <p className="text-[11px] text-slate-500">{apt.doctorName}</p>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    apt.status === 'Confirmed'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : apt.status === 'Completed'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {apt.status}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{apt.serviceNameAr}</p>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>{apt.date} • {apt.time}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatMoney(apt.price)}</span>
                </div>
                {apt.notes && <p className="text-[11px] text-slate-400 italic mt-1">{apt.notes}</p>}
              </div>

              <div className="flex items-center gap-2 pt-1">
                {apt.status !== 'Completed' && (
                  <button
                    onClick={() => updateAppointmentStatus(apt.id, 'Completed')}
                    className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                  >
                    {t('اكتمل الكشف / تسجيل الزيارة', 'Mark Completed')}
                  </button>
                )}
                {apt.status === 'Scheduled' && (
                  <button
                    onClick={() => updateAppointmentStatus(apt.id, 'Confirmed')}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {t('تأكيد الحضور', 'Confirm')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUBTAB 2: TREATMENT PLANS */}
      {activeSubTab === 'plans' && (
        <div className="space-y-4">
          {treatmentPlans.map((plan) => {
            const progressPercent = Math.round((plan.completedSessions / plan.totalSessions) * 100);

            return (
              <div
                key={plan.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                      {t('برنامج علاج طبيعي وتأهيل', 'Rehabilitation Program')}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{plan.title}</h3>
                    <p className="text-xs text-slate-500">{t('المريض:', 'Patient:')} {plan.patientName}</p>
                  </div>

                  <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-extrabold text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                    {plan.completedSessions} / {plan.totalSessions} {t('جلسات', 'Sessions')}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500 font-semibold">
                    <span>{t('نسبة إنجاز الخطة:', 'Progress:')}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-600 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 p-2.5 rounded-xl dark:bg-slate-800/40">
                  {plan.notes}
                </p>

                {plan.status !== 'Completed' && (
                  <button
                    onClick={() => progressTreatmentPlan(plan.id)}
                    className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-cyan-700 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('تسجيل جلسة مكتملة جديدة (+1)', 'Record Session Completed (+1)')}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SUBTAB 3: PATIENT RECORDS */}
      {activeSubTab === 'patients' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                <th className="pb-3 font-bold text-start">{t('رقم الملف الطبي', 'File #')}</th>
                <th className="pb-3 font-bold text-start">{t('اسم المريض', 'Patient Name')}</th>
                <th className="pb-3 font-bold text-start">{t('الهاتف', 'Phone')}</th>
                <th className="pb-3 font-bold text-start">{t('الأمراض المزمنة / التشخيص', 'Medical History')}</th>
                <th className="pb-3 font-bold text-start">{t('الحساسية', 'Allergies')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 font-mono font-bold text-cyan-600 dark:text-cyan-400">{p.fileNumber}</td>
                  <td className="py-3 font-bold text-slate-900 dark:text-white">{p.fullName}</td>
                  <td className="py-3 font-mono text-slate-600 dark:text-slate-400">{p.phone}</td>
                  <td className="py-3 text-slate-700 dark:text-slate-300">
                    {p.chronicDiseases?.join(', ') || '-'}
                  </td>
                  <td className="py-3">
                    {p.allergies && p.allergies.length > 0 ? (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                        {p.allergies.join(', ')}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BOOK APPOINTMENT MODAL */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
              {t('حجز موعد كشف أو جلسة جديدة', 'Book Medical Appointment')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('المريض:', 'Patient:')}
                </label>
                <select
                  value={newApt.patientId}
                  onChange={(e) => setNewApt({ ...newApt, patientId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-medium outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fileNumber} - {p.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الطبيب المعالج / الأخصائي:', 'Doctor:')}
                </label>
                <input
                  type="text"
                  value={newApt.doctorName}
                  onChange={(e) => setNewApt({ ...newApt, doctorName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('التاريخ:', 'Date:')}
                  </label>
                  <input
                    type="date"
                    value={newApt.date}
                    onChange={(e) => setNewApt({ ...newApt, date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الوقت:', 'Time:')}
                  </label>
                  <input
                    type="time"
                    value={newApt.time}
                    onChange={(e) => setNewApt({ ...newApt, time: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('سعر الخدمة (ج.م):', 'Fee (EGP):')}
                </label>
                <input
                  type="number"
                  value={newApt.price}
                  onChange={(e) => setNewApt({ ...newApt, price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSaveAppointment}
                  className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white hover:bg-cyan-700 transition-colors"
                >
                  {t('تأكيد الحجز', 'Confirm Appointment')}
                </button>
                <button
                  onClick={() => setShowBookModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW PATIENT FILE MODAL */}
      {showPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
              {t('فتح ملف طبي لمريض جديد', 'Register New Patient File')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('الاسم الثلاثي أو الرباعي:', 'Full Name:')}
                </label>
                <input
                  type="text"
                  value={newPat.fullName}
                  onChange={(e) => setNewPat({ ...newPat, fullName: e.target.value })}
                  placeholder="مثال: ياسمين محمد علي"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('رقم الموبايل:', 'Mobile Phone:')}
                </label>
                <input
                  type="tel"
                  value={newPat.phone}
                  onChange={(e) => setNewPat({ ...newPat, phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('النوع:', 'Gender:')}
                  </label>
                  <select
                    value={newPat.gender}
                    onChange={(e) => setNewPat({ ...newPat, gender: e.target.value as 'Male' | 'Female' })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Male">{t('ذكر', 'Male')}</option>
                    <option value="Female">{t('أنثى', 'Female')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('تاريخ الميلاد:', 'Date of Birth:')}
                  </label>
                  <input
                    type="date"
                    value={newPat.dateOfBirth}
                    onChange={(e) => setNewPat({ ...newPat, dateOfBirth: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('التاريخ المرضي / أمراض مزمنة:', 'Chronic Conditions:')}
                </label>
                <input
                  type="text"
                  value={newPat.chronicDiseases}
                  onChange={(e) => setNewPat({ ...newPat, chronicDiseases: e.target.value })}
                  placeholder="مثال: ضغط دم، خشونة ركبة..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSavePatient}
                  className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white hover:bg-cyan-700 transition-colors"
                >
                  {t('إنشاء الملف الطبي', 'Save Patient File')}
                </button>
                <button
                  onClick={() => setShowPatientModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
