/**
 * تهيئة القواعد الافتراضية لمنشأة — إجراء إداري صريح
 * ---------------------------------------------------------------------------
 * يُدرج القواعد القياسية اعتماداً على أكواد الحسابات الموجودة فعلاً في دليل
 * المنشأة، ولا يمس أي قاعدة قائمة (ON CONFLICT DO NOTHING).
 */

import React, { useState } from 'react';
import { seedDefaultPostingRules } from '../../services/postingRulesApi';

export const SeedDefaultsCard: React.FC<{
  t: (ar: string, en: string) => string;
  tenantId: string;
  canEdit: boolean;
  hasRules: boolean;
  notify: (type: 'ok' | 'err', text: string) => void;
  onSeeded: () => void | Promise<void>;
}> = ({ t, tenantId, canEdit, hasRules, notify, onSeeded }) => {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const result = await seedDefaultPostingRules(tenantId);
    setBusy(false);
    if (!result.ok) {
      notify('err', result.error ?? 'seed_failed');
      return;
    }
    notify(
      'ok',
      t(
        `تمت تهيئة ${result.inserted} قاعدة لهذه المنشأة (الحسابات الموجودة فقط).`,
        `Seeded ${result.inserted} rules for this tenant (existing accounts only).`
      )
    );
    await onSeeded();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold text-emerald-900 dark:text-emerald-200">
          {t('تهيئة القواعد الافتراضية', 'Seed default rules')}
        </p>
        <p className="text-[10px] leading-4 text-emerald-800/90 dark:text-emerald-300/90">
          {t(
            'تُدرج القواعد القياسية لمنشأتك اعتماداً على أكواد الحسابات الموجودة في دليلك (لا تمس أي قاعدة قائمة). استخدمها مرة واحدة عند البداية.',
            'Inserts the standard rules for your tenant using the account codes that exist in your chart (never touches existing rules). Use it once at the start.'
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={!canEdit || busy}
        className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        {busy ? t('جارٍ التهيئة…', 'Seeding…') : hasRules ? t('إضافة الناقص فقط', 'Add missing only') : t('تهيئة القواعد', 'Seed rules')}
      </button>
    </div>
  );
};
