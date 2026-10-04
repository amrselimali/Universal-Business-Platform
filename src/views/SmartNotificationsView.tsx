import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  NotificationRule,
  NotificationCategory,
  NotificationSeverity,
  NotificationChannel,
  AppNotification,
} from '../types';
import {
  Bell,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Volume2,
  VolumeX,
  Send,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  Sparkles,
  Zap,
  Radio,
  Users,
  Building2,
  ExternalLink,
  Search,
  Filter,
  Eye,
  Check,
  CheckCheck,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
  MessageSquare,
  HelpCircle,
  X,
  Play,
} from 'lucide-react';

interface SmartNotificationsViewProps {
  onNavigate?: (view: string) => void;
}

export const SmartNotificationsView: React.FC<SmartNotificationsViewProps> = ({ onNavigate }) => {
  const {
    t,
    language,
    notificationRules,
    toggleNotificationRule,
    updateNotificationRule,
    addNotificationRule,
    deleteNotificationRule,
    resetNotificationRulesToDefaults,
    notifications,
    allNotifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    sendInstantNotification,
    broadcastCustomNotification,
    activeBranch,
    branches,
    staffMembers,
    currentUser,
  } = usePlatform();

  const isRtl = language === 'ar';

  // State Tabs
  const [activeTab, setActiveTab] = useState<'rules' | 'history' | 'lifecycle'>('rules');

  // Search & Filter for Rules
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Search & Filter for History
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('all');
  const [historyReadFilter, setHistoryReadFilter] = useState<'all' | 'unread' | 'read'>('all');

  // Modals
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [testAlertSuccess, setTestAlertSuccess] = useState<string | null>(null);

  // Form State for Create / Edit Rule
  const [ruleFormData, setRuleFormData] = useState<Partial<NotificationRule>>({
    code: '',
    category: 'financial',
    nameAr: '',
    nameEn: '',
    descriptionAr: '',
    isEnabled: true,
    severity: 'warning',
    channels: ['in_app', 'popup', 'sound'],
    targetRoles: ['Admin', 'SuperAdmin', 'BranchManager'],
    targetBranchId: 'all',
    templateMessageAr: '',
    templateMessageEn: '',
    soundAlert: true,
    actionUrl: 'dashboard',
  });

  // Form State for Broadcast Alert
  const [broadcastData, setBroadcastData] = useState({
    titleAr: '',
    titleEn: '',
    messageAr: '',
    messageEn: '',
    severity: 'warning' as NotificationSeverity,
    category: 'general' as NotificationCategory,
    targetRoles: ['*'],
    targetBranchId: 'all',
    soundAlert: true,
    showToast: true,
  });

  // Available system roles
  const availableRoles = useMemo(() => {
    const list = [
      { id: '*', nameAr: 'جميع الأدوار والمستخدمين (الكل)', nameEn: 'All Roles & Users' },
      { id: 'SuperAdmin', nameAr: 'المدير العام (SuperAdmin)', nameEn: 'SuperAdmin' },
      { id: 'Admin', nameAr: 'مدير النظام (Admin)', nameEn: 'Admin' },
      { id: 'BranchManager', nameAr: 'مدير الفرع (Branch Manager)', nameEn: 'Branch Manager' },
      { id: 'Doctor', nameAr: 'الأطباء والاستشاريين', nameEn: 'Doctors & Specialists' },
      { id: 'Receptionist', nameAr: 'موظفو الاستقبال والكاشير', nameEn: 'Reception & Cashier' },
      { id: 'Accountant', nameAr: 'الإدارة المالية والمحاسبين', nameEn: 'Finance & Accountants' },
      { id: 'Inventory', nameAr: 'أمناء المخازن والمشتريات', nameEn: 'Inventory Keepers' },
      { id: 'Nurse', nameAr: 'التمريض والمساعدين', nameEn: 'Nurses & Assistants' },
    ];
    return list;
  }, []);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return notificationRules.filter((rule) => {
      if (categoryFilter !== 'all' && rule.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && rule.severity !== severityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName =
          rule.nameAr.toLowerCase().includes(q) || rule.nameEn.toLowerCase().includes(q);
        const matchDesc = rule.descriptionAr?.toLowerCase().includes(q);
        const matchCode = rule.code.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCode) return false;
      }
      return true;
    });
  }, [notificationRules, categoryFilter, severityFilter, searchQuery]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return allNotifications.filter((notif) => {
      if (historyCategoryFilter !== 'all' && notif.category !== historyCategoryFilter) return false;
      if (historyReadFilter === 'unread' && notif.isRead) return false;
      if (historyReadFilter === 'read' && !notif.isRead) return false;
      return true;
    });
  }, [allNotifications, historyCategoryFilter, historyReadFilter]);

  // Categories helper
  const categoriesList: { id: string; labelAr: string; labelEn: string; icon: any }[] = [
    { id: 'all', labelAr: 'كافة التصنيفات', labelEn: 'All Categories', icon: Layers },
    { id: 'laser_devices', labelAr: 'أجهزة الليزر والبلصات', labelEn: 'Laser & Pulses', icon: Zap },
    { id: 'reception_ops', labelAr: 'الاستقبال والعيادات', labelEn: 'Reception & Clinics', icon: Users },
    { id: 'financial', labelAr: 'الرقابة المالية والخزينة', labelEn: 'Financial & Vault', icon: Sliders },
    { id: 'staff_hr', labelAr: 'شؤون الموظفين والعهد', labelEn: 'Staff HR & Custody', icon: Clock },
    { id: 'inventory', labelAr: 'المخازن والأصناف', labelEn: 'Inventory & Stock', icon: Building2 },
    { id: 'general', labelAr: 'تنبيهات عامة وإدارية', labelEn: 'General & Broadcast', icon: Radio },
  ];

  // Helper for Severity Badge
  const renderSeverityBadge = (sev: NotificationSeverity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>حرج جداً (Critical)</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>تحذير (Warning)</span>
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>نجاح (Success)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            <Info className="w-3.5 h-3.5" />
            <span>معلومة (Info)</span>
          </span>
        );
    }
  };

  // Trigger Live Test for a Rule
  const handleTestRule = (rule: NotificationRule) => {
    const mockPayload: Record<string, any> = {
      اسم_الجهاز: 'جهاز كانديلا جنتل برو ماكس #1',
      البلصات: '412,500',
      نسبة_الاستهلاك: '88',
      اسم_العميل: 'نورهان أحمد محمد',
      الخدمة: 'جلسة ليزر فل بدي كربوني',
      اسم_الطبيب: 'د. سمر الشريف',
      اسم_الموظف: currentUser?.name || 'كاشير الاستقبال',
      اسم_الفرع: activeBranch?.name || 'الفرع الرئيسي',
      المبلغ: '3,850',
      رقم_الشيفت: 'SH-884',
      رقم_الحركة: 'INV-2026-941',
      السبب: 'طلب تعديل بناء على موافقة الإدارة',
      نوع_الفارق: 'عجز',
      الدقائق: '25',
      اسم_العهدة: 'جهاز تابلت آيباد استشارات',
      اسم_الصنف: 'شفرات حلاقة جراحية كانولا',
      الكمية: '5',
      حد_الطلب: '20',
    };

    sendInstantNotification(rule.code, mockPayload);
    setTestAlertSuccess(rule.nameAr);
    setTimeout(() => setTestAlertSuccess(null), 4000);
  };

  // Open Edit Modal
  const handleOpenEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setRuleFormData({
      code: rule.code,
      category: rule.category,
      nameAr: rule.nameAr,
      nameEn: rule.nameEn,
      descriptionAr: rule.descriptionAr,
      isEnabled: rule.isEnabled,
      severity: rule.severity,
      channels: [...rule.channels],
      targetRoles: [...rule.targetRoles],
      targetBranchId: rule.targetBranchId || 'all',
      templateMessageAr: rule.templateMessageAr,
      templateMessageEn: rule.templateMessageEn,
      soundAlert: rule.soundAlert,
      thresholdValue: rule.thresholdValue,
      actionUrl: rule.actionUrl,
    });
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setIsCreatingRule(true);
    setRuleFormData({
      code: `custom_rule_${Date.now().toString().slice(-5)}`,
      category: 'general',
      nameAr: '',
      nameEn: '',
      descriptionAr: '',
      isEnabled: true,
      severity: 'warning',
      channels: ['in_app', 'popup', 'sound'],
      targetRoles: ['*'],
      targetBranchId: 'all',
      templateMessageAr: '',
      templateMessageEn: '',
      soundAlert: true,
      actionUrl: 'dashboard',
    });
  };

  // Save Rule
  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleFormData.nameAr || !ruleFormData.templateMessageAr) {
      alert(t('يرجى ملء اسم التنبيه ونص الرسالة', 'Please enter alert name and template message'));
      return;
    }

    if (editingRule) {
      updateNotificationRule(editingRule.id, ruleFormData);
      setEditingRule(null);
    } else if (isCreatingRule) {
      addNotificationRule({
        code: ruleFormData.code || `rule_${Date.now()}`,
        category: (ruleFormData.category as NotificationCategory) || 'general',
        nameAr: ruleFormData.nameAr,
        nameEn: ruleFormData.nameEn || ruleFormData.nameAr,
        descriptionAr: ruleFormData.descriptionAr || '',
        isEnabled: ruleFormData.isEnabled !== false,
        severity: ruleFormData.severity || 'warning',
        channels: ruleFormData.channels || ['in_app', 'popup', 'sound'],
        targetRoles: ruleFormData.targetRoles || ['*'],
        targetBranchId: ruleFormData.targetBranchId || 'all',
        templateMessageAr: ruleFormData.templateMessageAr,
        templateMessageEn: ruleFormData.templateMessageEn || ruleFormData.templateMessageAr,
        soundAlert: ruleFormData.soundAlert !== false,
        thresholdValue: ruleFormData.thresholdValue,
        actionUrl: ruleFormData.actionUrl,
      });
      setIsCreatingRule(false);
    }
  };

  // Send Broadcast
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastData.titleAr || !broadcastData.messageAr) {
      alert(t('يرجى كتابة عنوان التنبيه ونص الرسالة', 'Please enter title and message'));
      return;
    }

    broadcastCustomNotification({
      titleAr: broadcastData.titleAr,
      titleEn: broadcastData.titleEn || broadcastData.titleAr,
      messageAr: broadcastData.messageAr,
      messageEn: broadcastData.messageEn || broadcastData.messageAr,
      severity: broadcastData.severity,
      category: broadcastData.category,
      targetRoles: broadcastData.targetRoles,
      targetBranchId: broadcastData.targetBranchId === 'all' ? undefined : broadcastData.targetBranchId,
      soundAlert: broadcastData.soundAlert,
      showToast: broadcastData.showToast,
    });

    setIsBroadcasting(false);
    setBroadcastData({
      titleAr: '',
      titleEn: '',
      messageAr: '',
      messageEn: '',
      severity: 'warning',
      category: 'general',
      targetRoles: ['*'],
      targetBranchId: 'all',
      soundAlert: true,
      showToast: true,
    });
  };

  // Helper chips for inserting tokens into message
  const availableTokens = [
    '{اسم_العميل}',
    '{المبلغ}',
    '{اسم_الجهاز}',
    '{البلصات}',
    '{اسم_الموظف}',
    '{اسم_الفرع}',
    '{الخدمة}',
    '{رقم_الشيفت}',
    '{رقم_الحركة}',
    '{السبب}',
    '{اسم_الصنف}',
    '{الكمية}',
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Confirmation for Rule Test */}
      {testAlertSuccess && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-indigo-900 text-white shadow-2xl border border-indigo-400 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
          <span className="text-sm font-black">
            {t('تم إطلاق التنبيه التجريبي بنجاح:', 'Test notification fired successfully:')} {testAlertSuccess}
          </span>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-2xl border border-indigo-900/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>نظام التنبيهات الفورية التلقائية والذكية (Smart Real-Time Alert Engine)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              {t('مركز التحكم في التنبيهات الفورية وقواعد التشغيل', 'Instant Notifications & Alert Rules Center')}
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              {t(
                'إدارة وتخصيص كافة التنبيهات الآلية والرقابية للنظام: تحديد نص الرسائل، لمن تظهر التنبيهات (الأدوار أو الموظفين أو الفروع)، القنوات التفاعلية (نافذة منبثقة، تنبيه صوتي، جرس)، وإرسال تنبيهات بث مباشر فورية.',
                'Manage all automated system alerts: configure message templates, choose recipients (roles, users, branches), set audio alarms & toast popups, and broadcast live alerts.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsBroadcasting(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs shadow-lg shadow-rose-900/40 transition cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>{t('إرسال تنبيه فوري مباشر (Broadcast)', 'Broadcast Instant Alert')}</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg shadow-indigo-900/40 transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{t('إضافة قاعدة تنبيه جديدة', 'New Notification Rule')}</span>
            </button>

            <button
              onClick={() => {
                if (confirm(t('هل تريد استعادة قواعد التنبيهات القياسية المعتمدة؟', 'Reset rules to default standards?'))) {
                  resetNotificationRulesToDefaults();
                }
              }}
              title={t('استعادة التنبيهات القياسية', 'Reset Defaults')}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <div className="text-slate-400">{t('إجمالي قواعد التنبيه النشطة', 'Active Rules')}</div>
            <div className="text-xl font-black text-indigo-300 mt-1">
              {notificationRules.filter((r) => r.isEnabled).length} / {notificationRules.length}
            </div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <div className="text-slate-400">{t('الإشعارات غير المقروءة', 'Unread Alerts')}</div>
            <div className="text-xl font-black text-rose-400 mt-1">{unreadNotificationsCount}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <div className="text-slate-400">{t('تنبيهات حرجة ومشددة', 'Critical Rules')}</div>
            <div className="text-xl font-black text-amber-400 mt-1">
              {notificationRules.filter((r) => r.severity === 'critical').length}
            </div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <div className="text-slate-400">{t('تنبيهات صوتية فورية', 'Audio Alarms')}</div>
            <div className="text-xl font-black text-emerald-400 mt-1">
              {notificationRules.filter((r) => r.soundAlert).length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{t('قواعد التنبيهات والمستلمين (Alert Rules Engine)', 'Alert Rules Engine')}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-indigo-900/30 text-indigo-200">
              {notificationRules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>{t('سجل الإشعارات الحية والواردة (Live Log)', 'Notifications Log')}</span>
            {unreadNotificationsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-rose-500 text-white animate-pulse">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('lifecycle')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'lifecycle'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{t('دورة التشغيل والتوثيق (Life Cycle & Workflow)', 'Life Cycle & Workflow')}</span>
          </button>
        </div>

        {activeTab === 'history' && (
          <div className="flex items-center gap-2">
            <button
              onClick={markAllNotificationsAsRead}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 transition cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{t('تحديد الكل كمقروء', 'Mark all read')}</span>
            </button>
            <button
              onClick={() => {
                if (confirm(t('مسح سجل الإشعارات بالكامل؟', 'Clear notification history?'))) {
                  clearAllNotifications();
                }
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('مسح السجل', 'Clear history')}</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: RULES ENGINE */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {categoriesList.map((cat) => {
                const Icon = cat.icon;
                const isSelected = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{isRtl ? cat.labelAr : cat.labelEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Search & Severity Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('بحث في القواعد...', 'Search rules...')}
                  className="w-full pl-3 pr-9 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="all">{t('كافة درجات الخطورة', 'All Severities')}</option>
                <option value="critical">{t('حرج (Critical)', 'Critical')}</option>
                <option value="warning">{t('تحذير (Warning)', 'Warning')}</option>
                <option value="info">{t('معلومة (Info)', 'Info')}</option>
                <option value="success">{t('نجاح (Success)', 'Success')}</option>
              </select>
            </div>
          </div>

          {/* Rules Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map((rule) => {
              return (
                <div
                  key={rule.id}
                  className={`relative p-5 rounded-3xl border transition-all duration-200 ${
                    rule.isEnabled
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderSeverityBadge(rule.severity)}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500">
                          {rule.code}
                        </span>
                        {rule.soundAlert && (
                          <span
                            title={t('صوت إنذار مفعّل', 'Sound alert enabled')}
                            className="p-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white">
                        {isRtl ? rule.nameAr : rule.nameEn}
                      </h3>
                    </div>

                    {/* Enable/Disable Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.isEnabled}
                        onChange={() => toggleNotificationRule(rule.id)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                    {rule.descriptionAr}
                  </p>

                  {/* Message Template Preview */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 mb-4 text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 font-sans">
                      {t('نص الرسالة المنبثقة الذكي:', 'Dynamic Message Template:')}
                    </div>
                    <div className="leading-relaxed dir-rtl">{rule.templateMessageAr}</div>
                  </div>

                  {/* Recipients & Channels */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="font-bold flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{t('لمن تظهر (المستلمون):', 'Recipients:')}</span>
                      </span>
                      <div className="flex flex-wrap gap-1 justify-end max-w-[65%]">
                        {rule.targetRoles.includes('*') ? (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                            {t('الجميع (All Users)', 'All Users')}
                          </span>
                        ) : (
                          rule.targetRoles.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[10px]"
                            >
                              {r}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="font-bold flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t('القنوات:', 'Channels:')}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {rule.channels.includes('in_app') && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px]">
                            جرس
                          </span>
                        )}
                        {rule.channels.includes('popup') && (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold">
                            نافذة Toast
                          </span>
                        )}
                        {rule.channels.includes('sound') && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            صوت
                          </span>
                        )}
                        {rule.channels.includes('whatsapp') && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            WhatsApp
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Test, Edit, Delete */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => handleTestRule(rule)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition cursor-pointer active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{t('تجربة واختبار التنبيه (Live Test)', 'Test Alert')}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(rule)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t('تعديل التنبيه والرسالة', 'Edit')}</span>
                      </button>

                      {rule.id.startsWith('rule-custom') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t('حذف قاعدة التنبيه المخصصة؟', 'Delete custom rule?'))) {
                              deleteNotificationRule(rule.id);
                            }
                          }}
                          className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE NOTIFICATION HISTORY LOG */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{t('الحالة:', 'Status:')}</span>
              <button
                onClick={() => setHistoryReadFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  historyReadFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {t('الكل', 'All')} ({allNotifications.length})
              </button>
              <button
                onClick={() => setHistoryReadFilter('unread')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  historyReadFilter === 'unread'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {t('غير مقروء', 'Unread')} ({unreadNotificationsCount})
              </button>
              <button
                onClick={() => setHistoryReadFilter('read')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  historyReadFilter === 'read'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {t('مقروء', 'Read')}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{t('التصنيف:', 'Category:')}</span>
              <select
                value={historyCategoryFilter}
                onChange={(e) => setHistoryCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
              >
                {categoriesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isRtl ? c.labelAr : c.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Bell className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-bold">{t('لا توجد إشعارات مسجلة تطابق الفلتر', 'No notifications matching criteria')}</p>
              </div>
            ) : (
              filteredHistory.map((item) => {
                return (
                  <div
                    key={item.id}
                    className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                      !item.isRead
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="pt-0.5">{renderSeverityBadge(item.severity)}</div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">
                            {isRtl ? item.titleAr : item.titleEn}
                          </h4>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(item.timestamp).toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                          {isRtl ? item.messageAr : item.messageEn}
                        </p>

                        {item.targetRoles && (
                          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                            <span>{t('المستهدفون:', 'Targets:')}</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {item.targetRoles.includes('*') ? t('الكل', 'All') : item.targetRoles.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      {item.actionUrl && onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate(item.actionUrl!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition cursor-pointer"
                        >
                          <span>{t('فتح الشاشة المعنية', 'Open Screen')}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => markNotificationAsRead(item.id)}
                          title={t('تعليم كمقروء', 'Mark as read')}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => deleteNotification(item.id)}
                        title={t('حذف من السجل', 'Delete notification')}
                        className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LIFE CYCLE & WORKFLOW GUIDE */}
      {activeTab === 'lifecycle' && (
        <div className="space-y-6 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="max-w-3xl space-y-3">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-indigo-600" />
              <span>دورة تشغيل وهندسة التنبيهات الفورية (Real-Time Notification Lifecycle)</span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              إجابة على استفسار دورة التشغيل: هل هي شاشة مخصصة أم ستاندرد؟
              <br />
              <strong>النظام يجمع بين الاثنين معاً بشكل تكاملي:</strong> يوفر حزمة قواعد قياسية مدمجة (Standard Presets) تغطي أكثر من 15 سيناريو حرج بالعيادات والمراكز الطبية، مع إتاحة <strong>شاشة كاملة للتحكم والتخصيص</strong> لتعديل الرسائل وتحديد المستلمين وتشغيل أو تعطيل أي تنبيه أو إضافة قواعد جديدة بالكامل.
            </p>
          </div>

          {/* Workflow Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
            <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                1
              </div>
              <h3 className="font-black text-sm text-indigo-900 dark:text-indigo-200">الحدث والزناد (Event Trigger)</h3>
              <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                يتم رصد الحدث فور حدوثه (استهلاك بلصات ليزر وتجاوز 85%، إلغاء فاتورة مبيعات، وصول مريض للعيادة، عجز في تقفيل الخزينة، رصيد مخزني منخفض).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-sm">
                2
              </div>
              <h3 className="font-black text-sm text-amber-900 dark:text-amber-200">الترشيح والرقابة (Rule & RBAC)</h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                يقوم محرك التنبيهات بفحص حالة القاعدة (مفعلة/معطلة)، والتحقق من صلاحيات المستخدمين المستهدفين، الفرع النشط، وقيمة العتبة المحددة.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm">
                3
              </div>
              <h3 className="font-black text-sm text-rose-900 dark:text-rose-200">البث الفوري المتعدد (Multi-Channel)</h3>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
                يطلق النظام التنبيه عبر قنوات متزامنة: جرس الإشعارات، نافذة منبثقة فورية (Toast)، إنذار صوتي حقيقي (Siren/Bell)، وتجهيز رسائل WhatsApp.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                4
              </div>
              <h3 className="font-black text-sm text-emerald-900 dark:text-emerald-200">التفاعل والتوثيق (Audit & Action)</h3>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                الضغط على الإشعار ينقل المستخدم مباشرة للشاشة المعنية (جهاز الليزر، الفاتورة الملغاة، كشف حساب الموظف) مع توثيق الحركة في سجل المراجعة.
              </p>
            </div>
          </div>

          {/* Table of Standard Alert Catalog */}
          <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-black text-slate-800 dark:text-white">
              كتالوج التنبيهات المقترحة القياسية المدمجة بالنظام
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">اسم التنبيه القياسي</th>
                    <th className="p-3">درجة الأهمية</th>
                    <th className="p-3">المستلمون الافتراضيون</th>
                    <th className="p-3">شروط الإطلاق والزناد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <td className="p-3 font-bold text-indigo-600">أجهزة الليزر</td>
                    <td className="p-3 font-semibold">اقتراب نفاد لمبة الليزر (حد التحذير)</td>
                    <td className="p-3">{renderSeverityBadge('warning')}</td>
                    <td className="p-3">المدير العام، مدير الفرع، الأطباء</td>
                    <td className="p-3">وصول عداد البلصات إلى 85% من سعة اللمبة</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-indigo-600">أجهزة الليزر</td>
                    <td className="p-3 font-semibold">تشغيل جهاز ليزر خارج الشيفت المعتمد</td>
                    <td className="p-3">{renderSeverityBadge('critical')}</td>
                    <td className="p-3">المدير العام، مدير الفرع</td>
                    <td className="p-3">تسجيل ضربات أو استهلاك لجهاز بدون شيفت مفتوح</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-sky-600">الاستقبال والعيادات</td>
                    <td className="p-3 font-semibold">وصول المريض للعيادة (Patient Checked-In)</td>
                    <td className="p-3">{renderSeverityBadge('info')}</td>
                    <td className="p-3">الأطباء، التمريض، الاستقبال</td>
                    <td className="p-3">تأكيد الاستقبال حضور المريض لبدء الجلسة فوراً</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-600">الرقابة المالية</td>
                    <td className="p-3 font-semibold">إلغاء فاتورة مبيعات أو إيصال تحصيل</td>
                    <td className="p-3">{renderSeverityBadge('critical')}</td>
                    <td className="p-3">المدير العام، المدير المالي، المحاسب</td>
                    <td className="p-3">قيام أي كاشير بإلغاء حركة مالية مع بيان السبب</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-600">الرقابة المالية</td>
                    <td className="p-3 font-semibold">عجز أو زيادة نقدية عند تقفيل الشيفت</td>
                    <td className="p-3">{renderSeverityBadge('critical')}</td>
                    <td className="p-3">المدير المالي، مدير الفرع</td>
                    <td className="p-3">وجود فرق بين النقدية المحصية ونقدية النظام بـ Z-Report</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-600">الخزينة</td>
                    <td className="p-3 font-semibold">تراكم نقدية الدرج وتجاوز حد الأمان</td>
                    <td className="p-3">{renderSeverityBadge('warning')}</td>
                    <td className="p-3">كاشير الاستقبال، مدير الفرع</td>
                    <td className="p-3">تجاوز النقدية في الدرج مبلغ 20,000 ج.م لتوريدها</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-rose-600">الموظفين والعهد</td>
                    <td className="p-3 font-semibold">صرف سلفة نقدية جديدة لموظف</td>
                    <td className="p-3">{renderSeverityBadge('warning')}</td>
                    <td className="p-3">المحاسب، الموارد البشرية، الإدارة</td>
                    <td className="p-3">تسجيل سند صرف سلفة نقدية لجدولة الخصم من الراتب</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-600">المخازن</td>
                    <td className="p-3 font-semibold">وصول رصيد الصنف لحد إعادة الطلب</td>
                    <td className="p-3">{renderSeverityBadge('warning')}</td>
                    <td className="p-3">أمين المخزن، قسم المشتريات، الإدارة</td>
                    <td className="p-3">انخفاض كمية المستهلكات أو الأدوية عن حد الأمان</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT OR CREATE NOTIFICATION RULE */}
      {(editingRule || isCreatingRule) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingRule
                      ? t('تخصيص وتعديل قاعدة التنبيه الفوري', 'Customize Notification Rule')
                      : t('إنشاء قاعدة تنبيه فورية جديدة', 'Create New Notification Rule')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('حدد نص الرسالة والمتغيرات ومن تظهر له التنبيهات ونبرة الصوت', 'Set template, recipients, sound and channels')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingRule(null);
                  setIsCreatingRule(false);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveRule} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    {t('اسم التنبيه (بالعربية) *', 'Alert Name (Arabic) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={ruleFormData.nameAr || ''}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, nameAr: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    {t('الاسم بالإنجليزية (اختياري)', 'Alert Name (English)')}
                  </label>
                  <input
                    type="text"
                    value={ruleFormData.nameEn || ''}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    {t('التصنيف الرئيسي', 'Category')}
                  </label>
                  <select
                    value={ruleFormData.category || 'financial'}
                    onChange={(e) =>
                      setRuleFormData({ ...ruleFormData, category: e.target.value as NotificationCategory })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="laser_devices">أجهزة الليزر والبلصات</option>
                    <option value="reception_ops">الاستقبال والعيادات</option>
                    <option value="financial">الرقابة المالية والخزينة</option>
                    <option value="staff_hr">الموظفين والعهد والسلف</option>
                    <option value="inventory">المخازن والأصناف</option>
                    <option value="general">تنبيهات عامة</option>
                  </select>
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    {t('درجة الأهمية والخطورة', 'Severity')}
                  </label>
                  <select
                    value={ruleFormData.severity || 'warning'}
                    onChange={(e) =>
                      setRuleFormData({ ...ruleFormData, severity: e.target.value as NotificationSeverity })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="critical">حرج جداً (Critical - أحمر)</option>
                    <option value="warning">تحذير (Warning - برتقالي)</option>
                    <option value="info">معلومة (Info - أزرق)</option>
                    <option value="success">نجاح (Success - أخضر)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    {t('الشاشة المرتبطة للتحويل', 'Redirect View')}
                  </label>
                  <select
                    value={ruleFormData.actionUrl || 'dashboard'}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, actionUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="laser_devices">أجهزة الليزر والبلصات</option>
                    <option value="reception_ops">الاستقبال وشيفت التشغيل</option>
                    <option value="invoices">الفواتير والإيرادات</option>
                    <option value="collection_receipts">التحصيلات والخزينة</option>
                    <option value="employee_dossier">ملف وكشف حساب الموظف</option>
                    <option value="attendance">حضور وانصراف الموظفين</option>
                    <option value="inventory_mgmt">المخازن والأرصدة</option>
                    <option value="bookings">الحجوزات والمتابعات</option>
                    <option value="dashboard">لوحة المؤشرات الرئيسية</option>
                  </select>
                </div>
              </div>

              {/* Target Roles (Recipients) */}
              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                  {t('المستلمون المسموح لهم برؤية التنبيه (Target Roles) *', 'Allowed Recipient Roles *')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {availableRoles.map((role) => {
                    const isChecked = ruleFormData.targetRoles?.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-indigo-600"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let updated = ruleFormData.targetRoles ? [...ruleFormData.targetRoles] : [];
                            if (role.id === '*') {
                              updated = e.target.checked ? ['*'] : [];
                            } else {
                              updated = updated.filter((r) => r !== '*');
                              if (e.target.checked) {
                                updated.push(role.id);
                              } else {
                                updated = updated.filter((r) => r !== role.id);
                              }
                            }
                            setRuleFormData({ ...ruleFormData, targetRoles: updated });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-semibold text-[11px]">
                          {isRtl ? role.nameAr : role.nameEn}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Channels & Sound */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    {t('قنوات البث التفاعلية', 'Notification Channels')}
                  </label>
                  <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {[
                      { id: 'in_app', label: 'جرس النظام' },
                      { id: 'popup', label: 'نافذة Toast منبثقة' },
                      { id: 'sound', label: 'إنذار صوتي' },
                      { id: 'whatsapp', label: 'WhatsApp' },
                    ].map((ch) => {
                      const hasCh = ruleFormData.channels?.includes(ch.id as NotificationChannel);
                      return (
                        <label key={ch.id} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasCh}
                            onChange={(e) => {
                              const cur = ruleFormData.channels ? [...ruleFormData.channels] : [];
                              const updated = e.target.checked
                                ? [...cur, ch.id as NotificationChannel]
                                : cur.filter((x) => x !== ch.id);
                              setRuleFormData({ ...ruleFormData, channels: updated });
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span className="font-bold text-[11px]">{ch.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleFormData.soundAlert !== false}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, soundAlert: e.target.checked })}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="space-y-0.5">
                      <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Volume2 className="w-4 h-4 text-amber-500" />
                        <span>{t('تشغيل صوت إنذار فوري', 'Play siren sound')}</span>
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {t('يصدر نغمة تنبيه صوتية حقيقية عند وقوع الحدث', 'Triggers real browser audio chime')}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Template Message with Token Helpers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-black text-slate-700 dark:text-slate-300">
                    {t('قالب نص الرسالة المنبثقة (بالعربية) *', 'Message Template (Arabic) *')}
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {t('انقر على أي رمز لإدراجه في نص الرسالة تلقائياً', 'Click chip to insert token')}
                  </span>
                </div>

                {/* Chips */}
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900">
                  {availableTokens.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => {
                        const cur = ruleFormData.templateMessageAr || '';
                        setRuleFormData({ ...ruleFormData, templateMessageAr: `${cur} ${token}` });
                      }}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 hover:bg-indigo-100 transition cursor-pointer"
                    >
                      {token}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  required
                  value={ruleFormData.templateMessageAr || ''}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, templateMessageAr: e.target.value })}
                  placeholder="مثال: تنبيه: اقتربت لمبة الجهاز {اسم_الجهاز} من النفاد! العداد {البلصات} بلصة."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold leading-relaxed"
                />
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRule(null);
                    setIsCreatingRule(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  {t('حفظ التعديلات والتفعيل فوراً', 'Save & Activate Rule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL BROADCAST ALERT */}
      {isBroadcasting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-50 dark:bg-rose-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-600 text-white">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950 dark:text-rose-200">
                    {t('إرسال تنبيه بث مباشر فوري للمستخدمين', 'Send Instant Broadcast Alert')}
                  </h3>
                  <p className="text-xs text-rose-800/80 dark:text-rose-300/80">
                    {t('يظهر فوراً على شاشات الموظفين المحددين مع التنبيه الصوتي', 'Fires immediately to target users screens')}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsBroadcasting(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                  {t('عنوان التنبيه *', 'Alert Title *')}
                </label>
                <input
                  type="text"
                  required
                  value={broadcastData.titleAr}
                  onChange={(e) => setBroadcastData({ ...broadcastData, titleAr: e.target.value })}
                  placeholder="مثال: إشعار إداري عاجل من الإدارة العامة"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                  {t('نص الرسالة الفورية *', 'Instant Message *')}
                </label>
                <textarea
                  rows={3}
                  required
                  value={broadcastData.messageAr}
                  onChange={(e) => setBroadcastData({ ...broadcastData, messageAr: e.target.value })}
                  placeholder="اكتب التوجيه أو التنبيه هنا..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    {t('درجة الأهمية', 'Severity')}
                  </label>
                  <select
                    value={broadcastData.severity}
                    onChange={(e) =>
                      setBroadcastData({ ...broadcastData, severity: e.target.value as NotificationSeverity })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="critical">حرج (Critical)</option>
                    <option value="warning">تحذير (Warning)</option>
                    <option value="info">معلومة عامة (Info)</option>
                    <option value="success">إشعار نجاح (Success)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    {t('الفرع المستهدف', 'Target Branch')}
                  </label>
                  <select
                    value={broadcastData.targetBranchId}
                    onChange={(e) => setBroadcastData({ ...broadcastData, targetBranchId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="all">كافة الفروع (All Branches)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={broadcastData.soundAlert}
                    onChange={(e) => setBroadcastData({ ...broadcastData, soundAlert: e.target.checked })}
                    className="rounded text-rose-600"
                  />
                  <span className="font-bold">{t('تشغيل صوت إنذار', 'Sound alert')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={broadcastData.showToast}
                    onChange={(e) => setBroadcastData({ ...broadcastData, showToast: e.target.checked })}
                    className="rounded text-rose-600"
                  />
                  <span className="font-bold">{t('إظهار نافذة منبثقة فورية (Toast)', 'Show popup toast')}</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBroadcasting(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black shadow-lg shadow-rose-600/30 transition cursor-pointer"
                >
                  {t('إرسال وبث التنبيه فوراً', 'Send Broadcast Now')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
