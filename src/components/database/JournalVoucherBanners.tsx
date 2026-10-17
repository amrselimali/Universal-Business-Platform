/**
 * بانرات توضيحية لجدولي القيود: الرؤوس مقابل السطور
 * ---------------------------------------------------------------------------
 * فُصلت من TableGrid (حد 300 سطر). الغرض: تفسير فرق "10 قيود" عن "20 سطراً"
 * — الرؤوس في journal_entries والسطور في v_journal_entry_lines.
 */

import React from 'react';

interface Props {
  t: (ar: string, en: string) => string;
  tableName: string;
  total: number;
  onSelectTable?: (tableName: string) => void;
}

export const JournalVoucherBanners: React.FC<Props> = ({ t, tableName, total, onSelectTable }) => (
  <>
      {/* تنبيه وشرح تفاعلي بين رؤوس القيود وسطورها */}
      {tableName === 'journal_entries' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/90 p-3 text-[11px] text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">
                {t('رؤوس القيود المحاسبية', 'Journal Vouchers')}
              </span>
              <span className="font-bold">
                {t(
                  `هذا الجدول يحتوي على رؤوس القيود المجمعة (${total} قيد).`,
                  `This table holds master journal voucher headers (${total} vouchers).`
                )}
              </span>
            </div>
            <p className="text-[10px] text-indigo-800 dark:text-indigo-300">
              {t(
                'كل قيد يحتوي على تفاصيل سطور المدين والدائن في حقل lines. إذا كنت تبحث عن سطور القيود المفردة (20 سطر بالمدين والدائن للحسابات)، اضغط الزر المجاور.',
                'Each entry holds debit/credit line items in the lines field. To view individual debit/credit rows, switch to v_journal_entry_lines.'
              )}
            </p>
          </div>
          {onSelectTable && (
            <button
              type="button"
              onClick={() => onSelectTable('v_journal_entry_lines')}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow hover:bg-indigo-700"
            >
              {t('الانتقال إلى جدول سطور القيود (20 سطر)', 'Switch to Journal Lines (20 rows)')} →
            </button>
          )}
        </div>
      )}

      {tableName === 'v_journal_entry_lines' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 text-[11px] text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                {t('سطور القيود المفردة', 'Individual Journal Lines')}
              </span>
              <span className="font-bold">
                {t(
                  `يعرض هذا العرض جميع سطور القيود بالتفصيل (${total} سطر: مدين / دائن / حساب).`,
                  `This view displays every individual debit/credit line (${total} lines).`
                )}
              </span>
            </div>
            <p className="text-[10px] text-emerald-800 dark:text-emerald-300">
              {t('هنا تجد الـ 20 قيداً مفردة كما هي مسجلة في شجرة الحسابات.', 'Here you find the 20 individual entry lines matching the chart of accounts.')}
            </p>
          </div>
          {onSelectTable && (
            <button
              type="button"
              onClick={() => onSelectTable('journal_entries')}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow hover:bg-emerald-700"
            >
              ← {t('الانتقال إلى جدول رؤوس القيود (10 قيود)', 'Switch to Journal Vouchers (10 rows)')}
            </button>
          )}
        </div>
      )}
  </>
);
