/**
 * منطق تعديل القيد — تحقق ودلتا (دوال نقية قابلة للاختبار)
 * ---------------------------------------------------------------------------
 * الشاشة تسمح بتعديل القيد **مع** أثر رقابي: توازن إجباري، سطر واحد الاتجاه،
 * حساب موجود، وسبب مكتوب. هنا يُحسب الفرق على الأرصدة قبل الإرسال حتى يرى
 * المستخدم أثره بوضوح، وتُرفض التعديلات غير الصالحة قبل أي كتابة.
 */

import type { JournalLineView } from '../types/journalExplorer';

export interface EditableLine {
  accountCode: string;
  accountName?: string;
  memo: string;
  debit: number;
  credit: number;
}

export interface EditValidation {
  ok: boolean;
  errorsAr: string[];
  errorsEn: string[];
  totalDebit: number;
  totalCredit: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const toEditableLine = (line: JournalLineView): EditableLine => ({
  accountCode: line.accountCode,
  accountName: line.accountName,
  memo: line.memo,
  debit: line.debit,
  credit: line.credit,
});

/** تحقق من صحة سطور التعديل قبل الإرسال. */
export const validateEditLines = (
  lines: EditableLine[],
  validAccountCodes: Set<string>
): EditValidation => {
  const errorsAr: string[] = [];
  const errorsEn: string[] = [];
  const totalDebit = round2(lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0));
  const totalCredit = round2(lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0));

  if (lines.length < 2) {
    errorsAr.push('القيد يحتاج سطرين على الأقل.');
    errorsEn.push('An entry needs at least two lines.');
  }

  lines.forEach((line, index) => {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (!line.accountCode) {
      errorsAr.push(`السطر ${index + 1}: اختر الحساب.`);
      errorsEn.push(`Line ${index + 1}: pick an account.`);
    } else if (!validAccountCodes.has(line.accountCode)) {
      errorsAr.push(`السطر ${index + 1}: الحساب ${line.accountCode} غير موجود في الدليل.`);
      errorsEn.push(`Line ${index + 1}: account ${line.accountCode} not found.`);
    }
    if (debit < 0 || credit < 0) {
      errorsAr.push(`السطر ${index + 1}: لا تقبل قيماً سالبة.`);
      errorsEn.push(`Line ${index + 1}: negative values are not accepted.`);
    }
    if (debit > 0 && credit > 0) {
      errorsAr.push(`السطر ${index + 1}: لا يكون مديناً ودائناً معاً.`);
      errorsEn.push(`Line ${index + 1}: cannot be debit and credit at once.`);
    }
    if (debit === 0 && credit === 0) {
      errorsAr.push(`السطر ${index + 1}: أدخل مبلغاً.`);
      errorsEn.push(`Line ${index + 1}: enter an amount.`);
    }
  });

  if (totalDebit === 0 || totalDebit !== totalCredit) {
    errorsAr.push(`القيد غير متوازن: مدين ${totalDebit} / دائن ${totalCredit}.`);
    errorsEn.push(`Entry is unbalanced: debit ${totalDebit} / credit ${totalCredit}.`);
  }

  return { ok: errorsAr.length === 0, errorsAr, errorsEn, totalDebit, totalCredit };
};

/** نتيجة التعديل كما ترجعها `fn_update_journal`. */
export interface JournalEditResult {
  ok: boolean;
  version?: number;
  debit?: number;
  credit?: number;
  sourceSync?: { kind: string; rows?: number; amount?: number }[];
  error?: string;
}
