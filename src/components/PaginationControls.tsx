import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationControlsProps = {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  language: 'ar' | 'en';
};

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  pageSize = 50,
  onPageChange,
  language,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const isArabic = language === 'ar';
  const previousPage = currentPage - 1;
  const nextPage = currentPage + 1;

  return (
    <nav
      aria-label={isArabic ? 'التنقل بين صفحات النتائج' : 'Result pagination'}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 py-3 text-xs dark:border-slate-800"
    >
      <span className="text-slate-500 dark:text-slate-400">
        {isArabic
          ? `عرض ${Math.min((currentPage - 1) * pageSize + 1, totalItems)}–${Math.min(currentPage * pageSize, totalItems)} من ${totalItems}`
          : `Showing ${Math.min((currentPage - 1) * pageSize + 1, totalItems)}–${Math.min(currentPage * pageSize, totalItems)} of ${totalItems}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(previousPage)}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
        >
          {isArabic ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {isArabic ? 'السابق' : 'Previous'}
        </button>
        <span className="min-w-20 text-center font-mono font-bold text-slate-700 dark:text-slate-200">
          {isArabic ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(nextPage)}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
        >
          {isArabic ? 'التالي' : 'Next'}
          {isArabic ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </nav>
  );
};
