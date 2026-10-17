/**
 * جدول قواعد الترحيل — قلب الشاشة
 * ---------------------------------------------------------------------------
 * يعرض **كل خلية رقمية في كل عملية**، وتختار لكل خلية: الاتجاه (مدين/دائن)
 * والحساب، أو تتركها بلا قاعدة فيُمنع الترحيل. لا يوجد أي حساب في الكود:
 * ما تختاره هنا هو ما يُرحَّل فعلاً.
 */

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Save, ShieldOff } from 'lucide-react';
import {
  ACCOUNTING_OPERATIONS,
  paymentSelectorOptions,
  type OperationDef,
  type OperationField,
  type PaymentMethodRef,
} from '../../data/accountingOperations';
import { savePostingRule } from '../../services/postingRulesApi';
import type { PostingRule } from '../../types/postingRules';

export interface AccountOption {
  id: string;
  code: string;
  nameAr: string;
}

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  tenantId: string;
  rules: PostingRule[];
  accounts: AccountOption[];
  paymentMethods: PaymentMethodRef[];
  canEdit: boolean;
  actor?: string;
  notify: (type: 'ok' | 'err', text: string) => void;
  onSaved: () => void | Promise<void>;
}

interface Draft {
  direction: 'debit' | 'credit';
  accountCode: string;
  active: boolean;
}

const keyOf = (type: string, field: string, selector: string) => `${type}|${field}|${selector}`;

const inputClass =
  'rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-900';

const RuleRow: React.FC<{
  op: OperationDef;
  field: OperationField;
  selector: string;
  selectorLabel: string;
  rule?: PostingRule;
  draft: Draft;
  accounts: AccountOption[];
  canEdit: boolean;
  saving: boolean;
  t: Props['t'];
  isArabic: boolean;
  onPatch: (patch: Partial<Draft>) => void;
  onSave: () => void;
}> = ({ op, field, selector, selectorLabel, rule, draft, accounts, canEdit, saving, t, isArabic, onPatch, onSave }) => (
  <div className="grid items-center gap-2 rounded-xl bg-slate-50 px-2 py-1.5 sm:grid-cols-[1.3fr_0.7fr_0.6fr_1.5fr_auto] dark:bg-slate-800/40">
    <div className="min-w-0">
      <p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
        {isArabic ? field.labelAr : field.labelEn}
        <span
          className={`ms-1 rounded px-1 text-[9px] font-black ${
            field.required
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {field.required ? t('إلزامي', 'required') : t('اختياري', 'optional')}
        </span>
      </p>
      <p className="truncate font-mono text-[9px] text-slate-400">
        {op.type}.{field.key}
      </p>
    </div>

    <span
      title={selector}
      className="justify-self-start truncate rounded-md bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600 dark:bg-slate-700 dark:text-slate-200"
    >
      {selectorLabel}
    </span>

    <select
      value={draft.direction}
      disabled={!canEdit}
      onChange={(e) => onPatch({ direction: e.target.value as 'debit' | 'credit' })}
      className={inputClass}
    >
      <option value="debit">{t('مدين', 'Debit')}</option>
      <option value="credit">{t('دائن', 'Credit')}</option>
    </select>

    <select
      value={draft.accountCode}
      disabled={!canEdit}
      onChange={(e) => onPatch({ accountCode: e.target.value })}
      className={inputClass}
    >
      <option value="">{t('— بدون قاعدة —', '— no rule —')}</option>
      {accounts.map((account) => (
        <option key={account.code} value={account.code}>
          {account.code} — {account.nameAr}
        </option>
      ))}
    </select>

    <div className="flex items-center justify-end gap-1">
      <label className="inline-flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
        <input
          type="checkbox"
          checked={draft.active}
          disabled={!canEdit}
          onChange={(e) => onPatch({ active: e.target.checked })}
          className="h-3 w-3 accent-indigo-600"
        />
        {t('فعّالة', 'active')}
      </label>

      {rule && !saving ? (
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-1.5 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          {rule.accountCode}
        </span>
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={!canEdit || saving}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          <Save className="h-3 w-3" />
          {saving ? t('يحفظ…', 'Saving…') : t('حفظ', 'Save')}
        </button>
      )}
    </div>
  </div>
);

export const PostingRulesPanel: React.FC<Props> = ({
  t, isArabic, tenantId, rules, accounts, paymentMethods, canEdit, actor, notify, onSaved,
}) => {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const paymentOptions = useMemo(() => paymentSelectorOptions(paymentMethods), [paymentMethods]);
  const optionLabel = useMemo(
    () => new Map(paymentOptions.map((option) => [option.key, isArabic ? option.labelAr : option.labelEn])),
    [paymentOptions, isArabic]
  );

  const accountList = useMemo(
    () => [...accounts].filter((a) => a.code).sort((a, b) => a.code.localeCompare(b.code)),
    [accounts]
  );

  const rulesByKey = useMemo(() => {
    const map = new Map<string, PostingRule>();
    rules.forEach((rule) => map.set(keyOf(rule.transactionType, rule.fieldKey, rule.selectorKey), rule));
    return map;
  }, [rules]);

  const draftFor = (type: string, fieldKey: string, selector: string, rule?: PostingRule): Draft =>
    drafts[keyOf(type, fieldKey, selector)] ?? {
      direction: rule?.direction ?? (fieldKey.includes('revenue') ? 'credit' : 'debit'),
      accountCode: rule?.accountCode ?? '',
      active: rule?.isActive ?? true,
    };

  const patch = (type: string, fieldKey: string, selector: string, value: Partial<Draft>) => {
    const key = keyOf(type, fieldKey, selector);
    const base = draftFor(type, fieldKey, selector, rulesByKey.get(key));
    setDrafts((prev) => ({ ...prev, [key]: { ...base, ...value } }));
  };

  const save = async (op: OperationDef, field: OperationField, selector: string) => {
    const key = keyOf(op.type, field.key, selector);
    const draft = draftFor(op.type, field.key, selector, rulesByKey.get(key));
    if (!draft.accountCode) {
      notify('err', t('اختر الحساب أولاً.', 'Pick an account first.'));
      return;
    }
    const account = accountList.find((a) => a.code === draft.accountCode);
    setSavingKey(key);
    const result = await savePostingRule({
      tenantId,
      transactionType: op.type,
      fieldKey: field.key,
      selectorKey: selector,
      direction: draft.direction,
      accountCode: draft.accountCode,
      accountName: account?.nameAr ?? draft.accountCode,
      autoPostEnabled: true,
      isActive: draft.active,
      strictExclusive: true,
      actor,
    });
    setSavingKey(null);
    if (result.ok) {
      notify('ok', t('تم حفظ القاعدة — الترحيل القادم يستخدمها فوراً.', 'Rule saved — the next posting uses it immediately.'));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await onSaved();
    } else {
      notify('err', result.error ?? 'save_failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-[11px] leading-5 text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-200">
        <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {t(
            'هذه الشاشة هي المصدر الوحيد: كل خلية رقمية أدناه تُوجَّه بحسابها من هنا. أي خلية إلزامية بلا قاعدة ⇒ الترحيل مرفوض بخطأ صريح. الحقول المخزّنة سابقاً على المنتج/طريقة الدفع/العميل لم تعد مصدراً للقيد.',
            'This screen is the single source: every amount cell below is routed from here. A required cell with no rule blocks posting with an explicit error. Previously stored account fields on products/payment methods/customers are no longer a journal source.'
          )}
        </p>
      </div>

      {ACCOUNTING_OPERATIONS.map((op) => (
        <div key={op.type} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
            <div>
              <p className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
                {isArabic ? op.labelAr : op.labelEn}
              </p>
              <p className="text-[10px] text-slate-400">
                {isArabic ? op.screenAr : op.screenEn} · <span className="font-mono">{op.type}</span>
              </p>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {op.fields.map((field) => {
              const baseKeys = field.selector ? paymentOptions.map((option) => option.key) : ['default'];
              const existingKeys = rules
                .filter((rule) => rule.transactionType === op.type && rule.fieldKey === field.key)
                .map((rule) => rule.selectorKey);
              const selectors = [...new Set([...baseKeys, ...existingKeys])];
              return selectors.map((selector) => {
                const key = keyOf(op.type, field.key, selector);
                return (
                  <RuleRow
                    key={key}
                    op={op}
                    field={field}
                    selector={selector}
                    selectorLabel={optionLabel.get(selector) ?? selector}
                    rule={rulesByKey.get(key)}
                    draft={draftFor(op.type, field.key, selector, rulesByKey.get(key))}
                    accounts={accountList}
                    canEdit={canEdit}
                    saving={savingKey === key}
                    t={t}
                    isArabic={isArabic}
                    onPatch={(value) => patch(op.type, field.key, selector, value)}
                    onSave={() => void save(op, field, selector)}
                  />
                );
              });
            })}
          </div>
        </div>
      ))}

      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {t(
          'القواعد القديمة (accounting_mapping_rules) لم تعد تُقرأ في الترحيل — أُبقيت للقراءة فقط كمرجع تاريخي.',
          'The legacy mapping rules table is no longer read at posting time — kept read-only as historical reference.'
        )}
      </p>
    </div>
  );
};
