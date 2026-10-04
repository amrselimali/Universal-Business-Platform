import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { AppNotification, NotificationSeverity } from '../types';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Sliders,
  X,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Zap,
  TrendingDown,
  Building2,
} from 'lucide-react';

interface NotificationBellProps {
  onNavigate: (view: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    activeToastNotification,
    dismissToastNotification,
    t,
  } = usePlatform();

  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'laser' | 'finance'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterTab === 'unread') return !n.isRead;
      if (filterTab === 'laser') return n.category === 'laser_devices' || n.category === 'reception_ops';
      if (filterTab === 'finance') return n.category === 'financial' || n.category === 'staff_hr';
      return true;
    });
  }, [notifications, filterTab]);

  const getSeverityBadge = (sev: NotificationSeverity) => {
    switch (sev) {
      case 'critical':
        return {
          icon: <AlertOctagon className="w-4 h-4 text-rose-600" />,
          bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900',
          badgeText: 'bg-rose-600 text-white',
          label: 'حرج',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
          bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
          badgeText: 'bg-amber-500 text-white',
          label: 'تحذير',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900',
          badgeText: 'bg-emerald-600 text-white',
          label: 'نجاح',
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-sky-600" />,
          bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-900',
          badgeText: 'bg-sky-600 text-white',
          label: 'معلومة',
        };
    }
  };

  const formatRelativeTime = (isoStr: string) => {
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      const diffDays = Math.floor(diffHours / 24);
      return `منذ ${diffDays} يوم`;
    } catch {
      return '';
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.isRead) {
      markNotificationAsRead(notif.id);
    }
    if (notif.actionUrl) {
      onNavigate(notif.actionUrl);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs"
        title={t('التنبيهات الفورية', 'Instant Notifications')}
        aria-label="Notifications"
      >
        <Bell className={`w-5 h-5 ${unreadNotificationsCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />

        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-md animate-pulse">
            {unreadNotificationsCount > 99 ? '+99' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[92vw] sm:w-[420px] max-w-[460px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-slate-900 dark:text-white">
                    {t('مركز التنبيهات الفورية', 'Notifications Center')}
                  </h3>
                  {unreadNotificationsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      {unreadNotificationsCount} جديد
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">إشعارات تشغيلية ورقابية لحظية</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-500">
              {unreadNotificationsCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsAsRead}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition"
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="p-1.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition"
                  title="مسح كافة الإشعارات"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-900 gap-1 overflow-x-auto text-[11px] font-bold">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                filterTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setFilterTab('unread')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                filterTab === 'unread'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              غير مقروءة ({unreadNotificationsCount})
            </button>
            <button
              onClick={() => setFilterTab('laser')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                filterTab === 'laser'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              الليزر والتشغيل
            </button>
            <button
              onClick={() => setFilterTab('finance')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                filterTab === 'finance'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              المالية والرواتب
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-500">لا توجد تنبيهات في هذه القائمة حالياً.</p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const badge = getSeverityBadge(n.severity);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      !n.isRead ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 border ${badge.bg}`}>{badge.icon}</div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {n.titleAr}
                          </h4>
                          <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${badge.badgeText}`}>
                            {badge.label}
                          </span>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {formatRelativeTime(n.timestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {n.messageAr}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        {n.actionUrl && (
                          <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                            <span>الانتقال للشاشة المباشرة</span>
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="text-slate-400 hover:text-rose-600 transition"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: Manage Rules Button */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onNavigate('notifications_config');
                setIsOpen(false);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>إدارة وقواعد التنبيهات (Notification Rules)</span>
            </button>

            <span className="text-[10px] text-slate-400 font-mono">نظام الإشعارات الذكي v2</span>
          </div>
        </div>
      )}

      {/* Floating Instant Toast Alert (When critical/warning event triggers) */}
      {activeToastNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl bg-slate-900 text-white p-4 shadow-2xl border border-indigo-500/40 animate-in slide-in-from-bottom-5 duration-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-500 text-white rounded-lg animate-pulse">
                <AlertOctagon className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-black text-rose-300">{activeToastNotification.titleAr}</h4>
            </div>
            <button
              onClick={dismissToastNotification}
              className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">{activeToastNotification.messageAr}</p>

          {activeToastNotification.actionUrl && (
            <button
              onClick={() => {
                onNavigate(activeToastNotification.actionUrl!);
                dismissToastNotification();
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 hover:text-indigo-100 underline cursor-pointer"
            >
              <span>فتح الشاشة المعنية فوراً</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
