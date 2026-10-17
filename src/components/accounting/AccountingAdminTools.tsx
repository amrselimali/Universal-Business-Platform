/**
 * أدوات الإدارة المحاسبية — تُفتح فقط بضغطة صريحة من مستخدم مصرّح
 * ---------------------------------------------------------------------------
 * تحرير القواعد · ترحيل مستند · إقفال الفترات · التغطية/سجل التدقيق.
 * فُصلت من الشاشة لتبقى الشاشة الأساسية «للعرض فقط» وتحت حد 300 سطر.
 */

import React from 'react';
import type { CoverageGapRow } from '../../data/accountingOperations';
import type { PostingRulesSnapshot } from '../../types/postingRules';
import { PostingRulesPanel, type AccountOption } from './PostingRulesPanel';
import type { PaymentMethodRef } from '../../data/accountingOperations';
import { PostingDocumentsPanel } from './PostingDocumentsPanel';
import { PeriodLocksPanel } from './PeriodLocksPanel';
import { PostingCoveragePanel } from './PostingCoveragePanel';
import { SeedDefaultsCard } from './SeedDefaultsCard';
import { GeneratedEntriesTable } from '../../views/accounting-mapping/GeneratedEntriesTable';

export type AdminTab = 'edit-rules' | 'posting' | 'locks' | 'coverage';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  tenantId: string;
  branchId?: string;
  actor?: string;
  adminTab: AdminTab;
  snapshot: PostingRulesSnapshot;
  accounts: AccountOption[];
  paymentMethods: PaymentMethodRef[];
  coverage: { total: number; covered: number; gaps: CoverageGapRow[] };
  canPost: boolean;
  canLock: boolean;
  canOpen: boolean;
  formatMoney: (value: number) => string;
  notify: (type: 'ok' | 'err', text: string) => void;
  onChanged: () => void | Promise<void>;
}

export const AccountingAdminTools: React.FC<Props> = ({
  t, isArabic, tenantId, branchId, actor, adminTab, snapshot, accounts, paymentMethods,
  coverage, canPost, canLock, canOpen, formatMoney, notify, onChanged,
}) => {
  if (adminTab === 'edit-rules') {
    return (
      <div className="space-y-3">
        <SeedDefaultsCard t={t} tenantId={tenantId} canEdit={canPost} hasRules={snapshot.rules.length > 0} notify={notify} onSeeded={onChanged} />
        <PostingRulesPanel
          t={t}
          isArabic={isArabic}
          tenantId={tenantId}
          rules={snapshot.rules}
          accounts={accounts}
          paymentMethods={paymentMethods}
          canEdit={canPost}
          actor={actor}
          notify={notify}
          onSaved={onChanged}
        />
      </div>
    );
  }

  if (adminTab === 'posting') {
    return (
      <PostingDocumentsPanel
        t={t}
        isArabic={isArabic}
        tenantId={tenantId}
        branchId={branchId}
        documents={snapshot.documents}
        paymentMethods={paymentMethods}
        canPost={canPost}
        actor={actor}
        formatMoney={formatMoney}
        notify={notify}
        onChanged={onChanged}
      />
    );
  }

  if (adminTab === 'locks') {
    return (
      <PeriodLocksPanel
        t={t}
        isArabic={isArabic}
        tenantId={tenantId}
        locks={snapshot.locks}
        canLock={canLock}
        canOpen={canOpen}
        actor={actor}
        notify={notify}
        onChanged={onChanged}
      />
    );
  }

  return (
    <div className="space-y-3">
      <PostingCoveragePanel
        t={t}
        isArabic={isArabic}
        coverage={coverage}
        documents={snapshot.documents}
        generated={snapshot.generated}
        formatMoney={formatMoney}
      />
      <GeneratedEntriesTable entries={snapshot.generated} formatMoney={formatMoney} t={t} isArabic={isArabic} />
    </div>
  );
};
