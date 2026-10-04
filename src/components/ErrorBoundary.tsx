import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Trash2, Home, CheckCircle2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    if (confirm('هل ترغب في تنظيف ذاكرة التخزين المؤقت للمتصفح لحل التعليق وإعادة التحميل؟ لن يتم مسح بيانات نيون السحابية.')) {
      try {
        localStorage.removeItem('erp_user_activity_logs');
        localStorage.removeItem('erp_audit_records');
      } catch (e) {
        console.error(e);
      }
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-900 text-white font-sans dir-rtl">
          <div className="max-w-xl w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-black text-rose-300">
                حدث استثناء غير متوقع في واجهة المتصفح
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                تم التقاط الخطأ بنجاح لحماية بياناتك من التلف. غالباً ما يحدث هذا نتيجة تحميل بيانات ضخمة تفوق قدرة ذاكرة التبويب أو تعليق مؤقت.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 rounded-xl bg-slate-950 text-left font-mono text-xs text-rose-400 overflow-x-auto border border-rose-900/40 max-h-36">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تحميل وتشغيل الصفحة</span>
              </button>

              <button
                onClick={this.handleClearCache}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-amber-400" />
                <span>تنظيف الذاكرة المؤقتة للبيانات</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
