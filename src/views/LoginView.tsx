import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  Layers,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Shield,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Globe,
  Building2,
  KeyRound,
  UserCheck,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, language, setLanguage, t, users } = usePlatform();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isRtl = language === 'ar';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const res = login(username, password);
      setIsLoading(false);
      if (!res.success) {
        setError(res.error || t('بيانات الدخول غير صحيحة', 'Invalid credentials'));
      }
    }, 300);
  };

  const handleQuickLogin = (uName: string, pass: string) => {
    setUsername(uName);
    setPassword(pass);
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      const res = login(uName, pass);
      setIsLoading(false);
      if (!res.success) {
        setError(res.error || t('بيانات الدخول غير صحيحة', 'Invalid credentials'));
      }
    }, 250);
  };

  return (
    <div
      id="login-view-root"
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative flex min-h-screen w-full flex-col justify-between bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors"
    >
      {/* Subtle Top Navigation / Language Bar */}
      <header className="flex w-full items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-slate-700 text-white shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">
              {t('منظومة ERP الشاملة', 'Universal ERP Platform')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Version badge requested by user */}
          <div
            id="version-tag-header"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Version 1.01</span>
          </div>

          <button
            id="btn-login-lang-switch"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5 text-slate-500" />
            <span>{language === 'ar' ? 'English' : 'عربي'}</span>
          </button>
        </div>
      </header>

      {/* Center Container: Calm and focused Card */}
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Main Card */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            {/* Header / Intro */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-13 w-13 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <KeyRound className="h-6 w-6" />
              </div>

              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {t('تسجيل الدخول إلى النظام', 'Sign In to Your Workspace')}
              </h1>

              <div className="mt-1.5 flex items-center justify-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('بوابة الشركات المتعددة والصلاحيات', 'Multi-tenant Enterprise Access')}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Version 1.01
                </span>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                id="login-error-alert"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('اسم المستخدم', 'Username')}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="login-username-input"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('أدخل اسم المستخدم (مثال: admin)', 'Enter username (e.g. admin)')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pe-3 ps-9 text-xs font-semibold text-slate-800 placeholder-slate-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('كلمة المرور', 'Password')}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pe-10 ps-9 text-xs font-semibold text-slate-800 placeholder-slate-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title={showPassword ? t('إخفاء كلمة المرور', 'Hide') : t('إظهار كلمة المرور', 'Show')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>{t('تذكر جلسة الدخول', 'Remember session')}</span>
                </label>

                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  {t('حساب آمن بنظام الصلاحيات', 'RBAC Secured')}
                </span>
              </div>

              {/* Submit Button */}
              <button
                id="btn-login-submit"
                type="submit"
                disabled={isLoading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
                    <span>{t('جاري التحقق...', 'Authenticating...')}</span>
                  </span>
                ) : (
                  <>
                    <span>{t('تسجيل الدخول', 'Sign In')}</span>
                    {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Logins Section */}
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {t('حسابات تجريبية سريعة (بنقرة واحدة):', 'Quick Demo Accounts (1-Click):')}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                  RBAC Roles
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* Admin Full Access */}
                <button
                  id="btn-quick-login-admin"
                  type="button"
                  onClick={() => handleQuickLogin('admin', 'admin123')}
                  className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 text-start hover:bg-indigo-100/70 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs">
                      <Shield className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                          admin
                        </span>
                        <span className="rounded bg-indigo-200/80 px-1.5 py-0.2 text-[9px] font-extrabold text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
                          {t('المدير العام', 'Super Admin')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('صلاحيات كاملة وغير مقيدة على كل الشركات والفروع والأزرار', 'Unlimited full access across all tenants & screens')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">admin123</span>
                </button>

                {/* Cashier Scoped Access */}
                <button
                  id="btn-quick-login-cashier"
                  type="button"
                  onClick={() => handleQuickLogin('cashier1', '123456')}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-start hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 font-bold text-xs">
                      <UserCheck className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          cashier1
                        </span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {t('كاشير مبيعات', 'Cashier')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {t('مقيد بفرع القاهرة ونقاط البيع وإصدار الفواتير فقط', 'Scoped to Cairo branch, POS & print only')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">123456</span>
                </button>

                {/* Branch Manager Access */}
                <button
                  id="btn-quick-login-manager"
                  type="button"
                  onClick={() => handleQuickLogin('cairo.mgr', '123456')}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-start hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 font-bold text-xs">
                      <Building2 className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          cairo.mgr
                        </span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {t('مدير فرع القاهرة', 'Branch Manager')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {t('صلاحيات فرع القاهرة والمخزن ونقاط البيع والعملاء', 'Cairo Branch, POS, discounts, inventory')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">123456</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-5 text-center text-xs text-slate-400">
            <p>
              {t(
                'نظام تشغيل الشركات والمؤسسات المتكامل • مصمم لمعايير الحماية والأمان العالية',
                'Enterprise Platform Engine • Built for security, performance & reliability'
              )}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              Universal ERP — <span className="font-bold text-indigo-600 dark:text-indigo-400">Version 1.01</span>
            </p>
          </div>
        </div>
      </main>

      {/* Footer minimal bar */}
      <footer className="py-3 text-center text-[11px] text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60">
        <span>© {new Date().getFullYear()} Universal Cloud ERP • All Rights Reserved • Version 1.01</span>
      </footer>
    </div>
  );
};
