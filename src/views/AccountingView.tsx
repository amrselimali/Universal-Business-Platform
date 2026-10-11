import React, { useEffect, useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Account, AccountType } from '../types';
import { resolveJournalLineAccount } from '../services/accountingEngine';
import { autoTranslateArabic } from '../utils/translator';
import {
  BookOpen,
  Scale,
  Plus,
  AlertCircle,
  FileText,
  Search,
  Printer,
  Edit3,
  Trash2,
  FolderPlus,
  History,
  TrendingDown,
  TrendingUp,
  Layers,
  CheckCircle2,
  X,
  ExternalLink,
  Building2,
} from 'lucide-react';
import { PartyStatementModal } from '../components/PartyStatementModal';
import { PaginationControls } from '../components/PaginationControls';

export const AccountingView: React.FC = () => {
  const {
    t,
    formatMoney,
    accounts,
    journalEntries,
    addAccount,
    updateAccount,
    deleteAccount,
    createManualJournalEntry,
    getJournalEntrySourceInfo,
    repairJournalEntryLines,
    voidUnlinkedJournalEntry,
    consolidateUnmappedJournalLines,
    language,
    tenant,
    branches,
    activeBranch,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'coa' | 'general_ledger' | 'journal' | 'trial_balance' | 'statements'>('coa');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Multi-Branch Isolation state for Accounting (الفصل المحاسبي بين الفروع)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [branchOnlyFilter, setBranchOnlyFilter] = useState<boolean>(false);
  const [accountPage, setAccountPage] = useState(1);
  const [generalLedgerPage, setGeneralLedgerPage] = useState(1);
  const [trialBalancePage, setTrialBalancePage] = useState(1);
  const [journalPage, setJournalPage] = useState(1);
  const rowsPerPage = 50;

  // Account Modal State (Add / Edit)
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<{
    code: string;
    nameAr: string;
    nameEn: string;
    type: AccountType;
    parentId: string;
    isDebitNormal: boolean;
    balance: number;
    branchId: string;
    branchNameAr: string;
  }>({
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'Asset',
    parentId: '',
    isDebitNormal: true,
    balance: 0,
    branchId: '',
    branchNameAr: '',
  });
  const [accountModalError, setAccountModalError] = useState<string | null>(null);

  // General Ledger State
  const [selectedGLAccountId, setSelectedGLAccountId] = useState<string>(() => {
    return accounts.find((a) => a.code === '1111')?.id || accounts[0]?.id || '';
  });
  const [glDateFrom, setGlDateFrom] = useState<string>('');
  const [glDateTo, setGlDateTo] = useState<string>('');
  const [glPeriodFilter, setGlPeriodFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('all');
  const [showPrintGL, setShowPrintGL] = useState<boolean>(false);

  // Manual Journal Modal State
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualJournalBranchId, setManualJournalBranchId] = useState<string>('');
  const [entryDesc, setEntryDesc] = useState<string>('');
  const [lines, setLines] = useState<
    { accountId: string; debit: number; credit: number; memo: string }[]
  >([
    { accountId: accounts[0]?.id || '', debit: 1000, credit: 0, memo: '' },
    { accountId: accounts[1]?.id || '', debit: 0, credit: 1000, memo: '' },
  ]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showUnbalancedJournalModal, setShowUnbalancedJournalModal] = useState(false);
  const [unbalancedPage, setUnbalancedPage] = useState(1);
  const [editingUnbalancedEntryId, setEditingUnbalancedEntryId] = useState<string | null>(null);
  const [repairLines, setRepairLines] = useState<{ accountId: string; debit: number; credit: number; memo: string }[]>([]);
  const [repairReason, setRepairReason] = useState('');
  const [repairError, setRepairError] = useState<string | null>(null);
  const [voidingUnbalancedEntryId, setVoidingUnbalancedEntryId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  const [consolidationAccountType, setConsolidationAccountType] = useState<AccountType>('Liability');
  const [consolidationReason, setConsolidationReason] = useState('');
  const [consolidationError, setConsolidationError] = useState<string | null>(null);
  const [consolidationResult, setConsolidationResult] = useState<string | null>(null);

  // Filtered accounts based on Selected Branch
  const activeBranchAccounts = useMemo(() => {
    if (selectedBranchId === 'all') return accounts;
    if (selectedBranchId === 'general') {
      return accounts.filter((a) => !a.branchId || a.branchId === 'all');
    }
    if (branchOnlyFilter) {
      return accounts.filter((a) => a.branchId === selectedBranchId);
    }
    return accounts.filter((a) => a.branchId === selectedBranchId || !a.branchId || a.branchId === 'all');
  }, [accounts, selectedBranchId, branchOnlyFilter]);

  // Trial balance comes from posted journal movements, not roll-up balances in parent accounts.
  const filteredJournalEntries = useMemo(() => {
    return journalEntries.filter((entry) => {
      if (selectedBranchId === 'all') return true;
      if (selectedBranchId === 'general') return !entry.branchId || entry.branchId === 'all';
      return entry.branchId === selectedBranchId;
    });
  }, [journalEntries, selectedBranchId]);
  const paginatedJournalEntries = useMemo(
    () => filteredJournalEntries.slice((journalPage - 1) * rowsPerPage, journalPage * rowsPerPage),
    [filteredJournalEntries, journalPage]
  );
  useEffect(() => setJournalPage(1), [selectedBranchId]);

  const trialBalanceAccounts = useMemo(() => {
    const balances = new Map<string, number>();
    const trialAccounts = new Map(activeBranchAccounts.map((account) => [account.id, account]));
    filteredJournalEntries.forEach((entry) => {
      if (!entry.isPosted) return;
      entry.lines.forEach((line) => {
        const account = resolveJournalLineAccount(line, accounts, entry.tenantId, entry.branchId);
        if (!account) return;
        trialAccounts.set(account.id, account);
        balances.set(account.id, (balances.get(account.id) || 0) + Number(line.debit || 0) - Number(line.credit || 0));
      });
    });
    return Array.from(trialAccounts.values())
      .map((account) => ({ ...account, balance: Number((balances.get(account.id) || 0).toFixed(2)) }))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
  }, [accounts, activeBranchAccounts, filteredJournalEntries]);

  const trialBalanceDiagnostics = useMemo(() => {
    const unbalancedEntries: Array<{ id: string; entryNumber: string; date: string; debit: number; credit: number; difference: number }> = [];
    const unmappedLines: Array<{ entryNumber: string; accountId: string; accountCode: string; debit: number; credit: number }> = [];
    const unmappedAccountTotals = new Map<string, {
      accountId: string;
      accountCode: string;
      lineCount: number;
      debit: number;
      credit: number;
    }>();
    let unmappedLineCount = 0;
    let unmappedDebitTotal = 0;
    let unmappedCreditTotal = 0;
    let unresolvedHistoricalLinkCount = 0;
    let resolvedByLegacyCodeCount = 0;
    const tenantAccountIds = new Set(accounts.map((account) => account.id));
    filteredJournalEntries.filter((entry) => entry.isPosted).forEach((entry) => {
      let debit = 0;
      let credit = 0;
      entry.lines.forEach((line) => {
        const lineDebit = Number(line.debit);
        const lineCredit = Number(line.credit);
        const safeDebit = Number.isFinite(lineDebit) ? lineDebit : 0;
        const safeCredit = Number.isFinite(lineCredit) ? lineCredit : 0;
        debit += safeDebit;
        credit += safeCredit;
        const resolvedAccount = resolveJournalLineAccount(line, accounts, entry.tenantId, entry.branchId);
        if (!resolvedAccount) {
          unmappedLineCount += 1;
          unmappedDebitTotal += safeDebit;
          unmappedCreditTotal += safeCredit;
          if (line.accountId.trim() && !tenantAccountIds.has(line.accountId)) {
            unresolvedHistoricalLinkCount += 1;
          }
          const displayedAccountId = line.historicalAccountId || line.accountId;
          const displayedAccountCode = line.historicalAccountCode || line.accountCode;
          const groupKey = `${displayedAccountId}|${displayedAccountCode.trim()}`;
          const totals = unmappedAccountTotals.get(groupKey) || {
            accountId: displayedAccountId,
            accountCode: displayedAccountCode.trim(),
            lineCount: 0,
            debit: 0,
            credit: 0,
          };
          totals.lineCount += 1;
          totals.debit += safeDebit;
          totals.credit += safeCredit;
          unmappedAccountTotals.set(groupKey, totals);
          if (unmappedLines.length < 50) {
            unmappedLines.push({
              entryNumber: entry.entryNumber,
              accountId: displayedAccountId,
              accountCode: displayedAccountCode,
              debit: safeDebit,
              credit: safeCredit,
            });
          }
        } else if (resolvedAccount.id !== line.accountId) {
          resolvedByLegacyCodeCount += 1;
        }
      });
      const difference = Number((debit - credit).toFixed(2));
      if (Math.abs(difference) >= 0.01) {
        unbalancedEntries.push({ id: entry.id, entryNumber: entry.entryNumber, date: entry.date, debit, credit, difference });
      }
    });
    const unmappedAccountGroups = Array.from(unmappedAccountTotals.values())
      .sort((a, b) => (b.debit + b.credit) - (a.debit + a.credit))
      .slice(0, 50);
    return {
      unbalancedEntries,
      unmappedLines,
      unmappedLineCount,
      unmappedDebitTotal,
      unmappedCreditTotal,
      unresolvedHistoricalLinkCount,
      unmappedAccountGroups,
      unmappedAccountGroupCount: unmappedAccountTotals.size,
      resolvedByLegacyCodeCount,
    };
  }, [accounts, filteredJournalEntries]);
  const paginatedUnbalancedEntries = useMemo(
    () => trialBalanceDiagnostics.unbalancedEntries.slice((unbalancedPage - 1) * rowsPerPage, unbalancedPage * rowsPerPage),
    [trialBalanceDiagnostics.unbalancedEntries, unbalancedPage]
  );
  useEffect(() => setUnbalancedPage(1), [selectedBranchId]);
  useEffect(() => {
    setConsolidationAccountType(
      trialBalanceDiagnostics.unmappedCreditTotal >= trialBalanceDiagnostics.unmappedDebitTotal ? 'Liability' : 'Asset'
    );
  }, [selectedBranchId, trialBalanceDiagnostics.unmappedCreditTotal, trialBalanceDiagnostics.unmappedDebitTotal]);

  const totalDebits = trialBalanceAccounts.reduce((sum, account) => sum + Math.max(0, account.balance), 0);
  const totalCredits = trialBalanceAccounts.reduce((sum, account) => sum + Math.max(0, -account.balance), 0);
  const hasUnmappedJournalLines = trialBalanceDiagnostics.unmappedLineCount > 0;
  const hasUnbalancedJournalEntries = trialBalanceDiagnostics.unbalancedEntries.length > 0;
  const isTrialBalanceBalanced = !hasUnmappedJournalLines && !hasUnbalancedJournalEntries &&
    Math.abs(totalDebits - totalCredits) < 0.01;
  const trialBalanceStatus = hasUnbalancedJournalEntries
    ? 'unbalanced'
    : hasUnmappedJournalLines
      ? 'incomplete'
      : isTrialBalanceBalanced
        ? 'balanced'
        : 'unbalanced';

  // Total Revenue & Expense for Net Profit
  const journalBalanceByAccountId = useMemo(
    () => new Map(trialBalanceAccounts.map((account) => [
      account.id,
      account.isDebitNormal ? account.balance : -account.balance,
    ])),
    [trialBalanceAccounts]
  );
  const totalRevenue = trialBalanceAccounts
    .filter((account) => account.type === 'Revenue')
    .reduce((sum, account) => sum + (account.isDebitNormal ? account.balance : -account.balance), 0);
  const totalExpense = trialBalanceAccounts
    .filter((account) => account.type === 'Expense')
    .reduce((sum, account) => sum + (account.isDebitNormal ? account.balance : -account.balance), 0);
  const netIncome = totalRevenue - totalExpense;

  // Sorted accounts by account code (ترتيب شجرة الحسابات بكود الحساب)
  const sortedAccounts = useMemo(() => {
    return activeBranchAccounts
      .filter((account) => !account.code.startsWith('1120-'))
      .map((account) => ({
        ...account,
        balance: journalBalanceByAccountId.get(account.id) ?? 0,
      }))
      .sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
      );
  }, [activeBranchAccounts, journalBalanceByAccountId]);

  // Filtered accounts for COA table (ordered by account code and search)
  const filteredAccounts = useMemo(() => {
    return sortedAccounts.filter((acc) => {
      const matchesType = selectedType === 'ALL' || acc.type === selectedType;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.code.includes(q) ||
        acc.nameAr.toLowerCase().includes(q) ||
        (acc.nameEn && acc.nameEn.toLowerCase().includes(q)) ||
        (acc.branchNameAr && acc.branchNameAr.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [sortedAccounts, selectedType, searchQuery]);
  const paginatedAccounts = useMemo(
    () => filteredAccounts.slice((accountPage - 1) * rowsPerPage, accountPage * rowsPerPage),
    [filteredAccounts, accountPage]
  );
  useEffect(() => setAccountPage(1), [selectedBranchId, selectedType, searchQuery]);

  const paginatedTrialBalanceAccounts = useMemo(
    () => trialBalanceAccounts.slice((trialBalancePage - 1) * rowsPerPage, trialBalancePage * rowsPerPage),
    [trialBalanceAccounts, trialBalancePage]
  );
  useEffect(() => setTrialBalancePage(1), [trialBalanceAccounts]);

  // Open Add Account modal (optionally with parent preset)
  const handleOpenAddAccount = (parentId: string = '') => {
    setModalMode('add');
    setEditingAccountId(null);
    setAccountModalError(null);

    let nextCode = '';
    let accountType: AccountType = 'Asset';
    let isDebit = true;

    if (parentId) {
      const parentAcc = accounts.find((a) => a.id === parentId);
      if (parentAcc) {
        accountType = parentAcc.type;
        isDebit = parentAcc.isDebitNormal;
        // Count existing siblings
        const siblings = accounts.filter((a) => a.parentId === parentId);
        const subIndex = siblings.length + 1;
        nextCode = `${parentAcc.code}${subIndex < 10 ? subIndex : subIndex}`;
      }
    } else {
      nextCode = `${accounts.length + 1}000`;
    }

    setAccountForm({
      code: nextCode,
      nameAr: '',
      nameEn: '',
      type: accountType,
      parentId,
      isDebitNormal: isDebit,
      balance: 0,
      branchId: selectedBranchId !== 'all' && selectedBranchId !== 'general' ? selectedBranchId : '',
      branchNameAr: selectedBranchId !== 'all' && selectedBranchId !== 'general'
        ? (branches.find((b) => b.id === selectedBranchId)?.name || '')
        : '',
    });
    setShowAccountModal(true);
  };

  // Open Edit Account modal
  const handleOpenEditAccount = (acc: Account) => {
    setModalMode('edit');
    setEditingAccountId(acc.id);
    setAccountModalError(null);
    setAccountForm({
      code: acc.code,
      nameAr: acc.nameAr,
      nameEn: acc.nameEn,
      type: acc.type,
      parentId: acc.parentId || '',
      isDebitNormal: acc.isDebitNormal,
      balance: acc.balance,
      branchId: acc.branchId || '',
      branchNameAr: acc.branchNameAr || (branches.find((b) => b.id === acc.branchId)?.name || ''),
    });
    setShowAccountModal(true);
  };

  // Save Account (Add or Edit)
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountModalError(null);

    if (!accountForm.code.trim() || !accountForm.nameAr.trim()) {
      setAccountModalError(t('يرجى كتابة كود واسم الحساب!', 'Please provide account code and Arabic name!'));
      return;
    }

    const nameEn = accountForm.nameEn.trim() || autoTranslateArabic(accountForm.nameAr);
    const parent = accounts.find((a) => a.id === accountForm.parentId);
    const level = parent ? (parent.level || 1) + 1 : 1;
    const matchedBranch = branches.find((b) => b.id === accountForm.branchId);
    const branchNameAr = matchedBranch ? matchedBranch.name : (accountForm.branchId ? accountForm.branchNameAr : undefined);

    if (modalMode === 'add') {
      // Check code uniqueness
      if (accounts.some((a) => a.code === accountForm.code.trim())) {
        setAccountModalError(t('كود الحساب مسجل مسبقاً! يرجى اختيار كود فريد.', 'Account code already exists!'));
        return;
      }

      addAccount({
        code: accountForm.code.trim(),
        nameAr: accountForm.nameAr.trim(),
        nameEn,
        type: accountForm.type,
        parentId: accountForm.parentId || undefined,
        level,
        isDebitNormal: accountForm.isDebitNormal,
        balance: Number(accountForm.balance) || 0,
        branchId: accountForm.branchId || undefined,
        branchNameAr,
      });
    } else if (editingAccountId) {
      updateAccount(editingAccountId, {
        code: accountForm.code.trim(),
        nameAr: accountForm.nameAr.trim(),
        nameEn,
        type: accountForm.type,
        parentId: accountForm.parentId || undefined,
        level,
        isDebitNormal: accountForm.isDebitNormal,
        balance: Number(accountForm.balance) || 0,
        branchId: accountForm.branchId || undefined,
        branchNameAr,
      });
    }

    setShowAccountModal(false);
  };

  // Delete Account
  const handleDeleteAccount = (acc: Account) => {
    if (
      !confirm(
        t(
          `هل أنت متأكد من حذف الحساب "${acc.code} - ${acc.nameAr}"؟`,
          `Are you sure you want to delete account "${acc.code} - ${acc.nameAr}"?`
        )
      )
    ) {
      return;
    }

    const res = deleteAccount(acc.id);
    if (!res.success) {
      alert(res.error || t('فشل حذف الحساب', 'Failed to delete account'));
    }
  };

  // Switch to General Ledger for a specific account
  const handleViewGL = (accountId: string) => {
    setSelectedGLAccountId(accountId);
    setActiveTab('general_ledger');
  };

  // Quick GL Date Filter
  const handleGLPeriodChange = (filter: 'all' | 'this_month' | 'last_month' | 'this_year') => {
    setGlPeriodFilter(filter);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (filter === 'all') {
      setGlDateFrom('');
      setGlDateTo('');
    } else if (filter === 'this_month') {
      const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setGlDateFrom(firstDay);
      setGlDateTo(lastDay);
    } else if (filter === 'last_month') {
      const firstDay = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m, 0).toISOString().split('T')[0];
      setGlDateFrom(firstDay);
      setGlDateTo(lastDay);
    } else if (filter === 'this_year') {
      const firstDay = `${y}-01-01`;
      const lastDay = `${y}-12-31`;
      setGlDateFrom(firstDay);
      setGlDateTo(lastDay);
    }
  };

  // Active GL Account object
  const activeGLAccount = activeBranchAccounts.find((a) => a.id === selectedGLAccountId) || activeBranchAccounts[0] || accounts[0];

  // General Ledger Movements calculation (filtered by branch and date)
  const glData = useMemo(() => {
    if (!activeGLAccount) {
      return { movements: [], openingBalance: 0, totalDebits: 0, totalCredits: 0, endingBalance: 0 };
    }

    const isDebitNormal = activeGLAccount.isDebitNormal;

    // Collect all journal lines referencing this account from branch filtered journal entries
    const allMatchingLines: {
      journalId: string;
      branchId?: string;
      entryNumber: string;
      date: string;
      description: string;
      sourceDocument?: string;
      lineId: string;
      debit: number;
      credit: number;
      memo?: string;
      historicalAccountId?: string;
      historicalAccountCode?: string;
    }[] = [];

    filteredJournalEntries.forEach((entry) => {
      if (!entry.isPosted) return;
      entry.lines.forEach((line) => {
        const resolvedAccount = resolveJournalLineAccount(line, accounts, entry.tenantId, entry.branchId);
        if (resolvedAccount?.id === activeGLAccount.id) {
          allMatchingLines.push({
            journalId: entry.id,
            branchId: entry.branchId,
            entryNumber: entry.entryNumber,
            date: entry.date,
            description: entry.description,
            sourceDocument: entry.sourceDocument,
            lineId: line.id,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
            historicalAccountId: line.historicalAccountId,
            historicalAccountCode: line.historicalAccountCode,
          });
        }
      });
    });

    // Sort chronologically
    allMatchingLines.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    // Calculate opening balance before `glDateFrom`
    let opening = 0;
    const periodMovements: typeof allMatchingLines = [];

    allMatchingLines.forEach((m) => {
      const isBeforePeriod = glDateFrom && m.date < glDateFrom;
      const isAfterPeriod = glDateTo && m.date > glDateTo;

      if (isBeforePeriod) {
        if (isDebitNormal) {
          opening += m.debit - m.credit;
        } else {
          opening += m.credit - m.debit;
        }
      } else if (!isAfterPeriod) {
        periodMovements.push(m);
      }
    });

    let running = opening;
    let periodDebits = 0;
    let periodCredits = 0;

    const enrichedMovements = periodMovements.map((mov) => {
      periodDebits += mov.debit;
      periodCredits += mov.credit;

      if (isDebitNormal) {
        running += mov.debit - mov.credit;
      } else {
        running += mov.credit - mov.debit;
      }

      return {
        ...mov,
        runningBalance: running,
      };
    });

    return {
      movements: enrichedMovements,
      openingBalance: opening,
      totalDebits: periodDebits,
      totalCredits: periodCredits,
      endingBalance: running,
    };
  }, [accounts, activeGLAccount, filteredJournalEntries, glDateFrom, glDateTo]);
  const paginatedGeneralLedgerMovements = useMemo(
    () => glData.movements.slice((generalLedgerPage - 1) * rowsPerPage, generalLedgerPage * rowsPerPage),
    [glData.movements, generalLedgerPage]
  );
  useEffect(() => setGeneralLedgerPage(1), [activeGLAccount?.id, selectedBranchId, glDateFrom, glDateTo]);

  // Save manual journal
  const handleSaveManualEntry = () => {
    setModalError(null);
    if (!entryDesc.trim()) {
      setModalError(t('يرجى إدخال وصف القيد', 'Please provide an entry description'));
      return;
    }

    const assignedBranchId = manualJournalBranchId || (selectedBranchId !== 'all' && selectedBranchId !== 'general' ? selectedBranchId : activeBranch?.id || branches[0]?.id || '');

    const res = createManualJournalEntry({
      description: entryDesc,
      branchId: assignedBranchId,
      lines,
    });

    if (res.success) {
      setShowManualModal(false);
      setEntryDesc('');
      setManualJournalBranchId('');
      setLines([
        { accountId: accounts[0]?.id || '', debit: 0, credit: 0, memo: '' },
        { accountId: accounts[1]?.id || '', debit: 0, credit: 0, memo: '' },
      ]);
    } else {
      setModalError(res.error || t('حدث خطأ في حفظ القيد', 'Error saving journal entry'));
    }
  };

  const startRepairJournal = (entryId: string) => {
    const entry = journalEntries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    setRepairLines(entry.lines.map((line) => ({
      accountId: line.accountId,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      memo: line.memo || '',
    })));
    setRepairReason('');
    setRepairError(null);
    setEditingUnbalancedEntryId(entryId);
    setVoidingUnbalancedEntryId(null);
  };

  const handleRepairJournal = () => {
    if (!editingUnbalancedEntryId) return;
    const result = repairJournalEntryLines(editingUnbalancedEntryId, repairLines, repairReason);
    if (!result.success) {
      setRepairError(result.error || t('تعذر حفظ تصحيح القيد.', 'Could not save journal correction.'));
      return;
    }
    setEditingUnbalancedEntryId(null);
    setRepairLines([]);
    setRepairReason('');
    setRepairError(null);
    setUnbalancedPage(1);
  };

  const handleVoidJournal = () => {
    if (!voidingUnbalancedEntryId) return;
    const result = voidUnlinkedJournalEntry(voidingUnbalancedEntryId, voidReason);
    if (!result.success) {
      setVoidError(result.error || t('تعذر إلغاء القيد.', 'Could not void journal entry.'));
      return;
    }
    setVoidingUnbalancedEntryId(null);
    setVoidReason('');
    setVoidError(null);
    setUnbalancedPage(1);
  };

  const handleConsolidateUnmappedLines = () => {
    const result = consolidateUnmappedJournalLines(
      filteredJournalEntries.filter((entry) => entry.isPosted).map((entry) => entry.id),
      consolidationAccountType,
      consolidationReason
    );
    if (!result.success) {
      setConsolidationError(result.error || t('تعذر تجميع الحركات غير المربوطة.', 'Could not consolidate unmapped movements.'));
      return;
    }
    if (result.lines === 0) {
      setConsolidationError(t('لا توجد سطور غير مربوطة قابلة للتجميع في النطاق الحالي.', 'No eligible unmapped lines were found in the current scope.'));
      return;
    }
    setConsolidationError(null);
    setConsolidationResult(t(
      `تم تجميع ${result.lines} سطرًا من ${result.affectedEntries} قيد في الحساب 9999999. المدين ${formatMoney(result.debit)} والدائن ${formatMoney(result.credit)}.`,
      `Consolidated ${result.lines} lines from ${result.affectedEntries} journals into account 9999999. Debit ${formatMoney(result.debit)} and credit ${formatMoney(result.credit)}.`
    ));
    setShowConsolidationDialog(false);
    setConsolidationReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {t('المحاسبة العامة والشجرة ودليل الأستاذ (GL & COA)', 'Accounting, Chart of Accounts & General Ledger')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'شجرة الحسابات المتكاملة، دفتر الأستاذ التفصيلي، قيود اليومية الآلية والمزدوجة، وميزان المراجعة مع الفصل المحاسبي التام بين الفروع.',
              'Double-entry balanced accounting engine with automated posting rules, ledger, and isolated multi-branch accounting.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-Branch Accounting Isolation Selector */}
          <div className="flex items-center gap-2 bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs">
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-indigo-950 dark:text-indigo-200 whitespace-nowrap">{t('فرع الحسابات:', 'Branch:')}</span>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
              }}
              className="bg-transparent font-bold text-indigo-700 dark:text-indigo-300 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                {t('🌐 كل الفروع (قوائم موحدة)', '🌐 All Branches (Consolidated)')}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  🏢 {b.name}
                </option>
              ))}
              <option value="general" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                🏛️ {t('المركز الرئيسي / الحسابات العامة', '🏛️ HQ / General Accounts')}
              </option>
            </select>
          </div>

          <button
            onClick={() => handleOpenAddAccount('')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('إضافة حساب بالشجرة', 'Add Account')}</span>
          </button>

          <button
            onClick={() => {
              setEditingUnbalancedEntryId(null);
              setVoidingUnbalancedEntryId(null);
              setShowUnbalancedJournalModal(true);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer ${
              hasUnbalancedJournalEntries
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            <span>{t('القيود غير المتوازنة', 'Unbalanced journals')}</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 font-mono">{trialBalanceDiagnostics.unbalancedEntries.length}</span>
          </button>

          <button
            onClick={() => {
              setManualJournalBranchId(selectedBranchId !== 'all' && selectedBranchId !== 'general' ? selectedBranchId : activeBranch?.id || branches[0]?.id || '');
              setShowManualModal(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 dark:bg-slate-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-900 transition-all active:scale-95 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>{t('قيد يومية يدوي', 'Manual Entry')}</span>
          </button>
        </div>
      </div>

      {/* Financial Health Ribbon */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            {selectedBranchId === 'all'
              ? t('القوائم المالية التشغيلية الموحدة لجميع الفروع', 'Consolidated Financial Overview (All Branches)')
              : selectedBranchId === 'general'
              ? t('القوائم المالية للمركز الرئيسي والحسابات العامة', 'HQ / General Accounts Financial Overview')
              : `${t('القوائم المالية التشغيلية المنفصلة لـ:', 'Isolated Financial Overview for:')} ${branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId}`}
          </span>
          {selectedBranchId !== 'all' && (
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
              {t('بيانات مالية مخصصة للفرع', 'Branch-Isolated Financials')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs text-slate-500">{t('إجمالي إيرادات النشاط (Revenues):', 'Total Revenues:')}</span>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {formatMoney(totalRevenue)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs text-slate-500">{t('إجمالي المصروفات (Expenses):', 'Total Expenses:')}</span>
            <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
              {formatMoney(totalExpense)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs text-slate-500">{t('صافي الأرباح التشغيلية (Net Income):', 'Net Operating Income:')}</span>
            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {formatMoney(netIncome)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('coa')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'coa'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>{t('شجرة الحسابات (Chart of Accounts)', 'Chart of Accounts')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {sortedAccounts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('general_ledger')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'general_ledger'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <History className="h-4 w-4" />
          <span>{t('حساب الأستاذ العام (General Ledger)', 'General Ledger')}</span>
          {activeGLAccount && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-mono text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              {activeGLAccount.code}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('journal')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'journal'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{t('دفتر اليومية العامة والقيود الآلية', 'General Journal Entries')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {journalEntries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trial_balance')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'trial_balance'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>{t('ميزان المراجعة (Trial Balance)', 'Trial Balance')}</span>
        </button>

        <button
          onClick={() => setActiveTab('statements')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'statements'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4 text-emerald-600" />
          <span>{t('كشوف حسابات العملاء والموردين', 'Customer & Supplier Statements')}</span>
        </button>
      </div>

      {/* TAB: CUSTOMER & SUPPLIER STATEMENTS */}
      {activeTab === 'statements' && (
        <PartyStatementModal
          onClose={() => setActiveTab('coa')}
        />
      )}

      {/* TAB 1: CHART OF ACCOUNTS */}
      {activeTab === 'coa' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          {/* Filters & Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('ابحث بكود الحساب أو الاسم...', 'Search by account code or name...')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-4 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {selectedBranchId !== 'all' && selectedBranchId !== 'general' && (
                <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-xl cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={branchOnlyFilter}
                    onChange={(e) => setBranchOnlyFilter(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>{t('حسابات هذا الفرع فقط', 'Branch Only')}</span>
                </label>
              )}
              {(['ALL', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {type === 'ALL'
                    ? t('الكل', 'All')
                    : type === 'Asset'
                    ? t('الأصول', 'Assets')
                    : type === 'Liability'
                    ? t('الالتزامات', 'Liabilities')
                    : type === 'Equity'
                    ? t('حقوق الملكية', 'Equity')
                    : type === 'Revenue'
                    ? t('الإيرادات', 'Revenues')
                    : t('المصروفات', 'Expenses')}
                </button>
              ))}
            </div>
          </div>

          {/* Accounts Table with Action Buttons */}
          <PaginationControls
            currentPage={accountPage}
            totalItems={filteredAccounts.length}
            pageSize={rowsPerPage}
            onPageChange={setAccountPage}
            language={language}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('كود الحساب', 'Code')}</th>
                  <th className="pb-3 font-bold text-start">{t('اسم الحساب', 'Account Name')}</th>
                  <th className="pb-3 font-bold text-start">{t('النوع', 'Type')}</th>
                  <th className="pb-3 font-bold text-start">{t('الفرع التابع', 'Branch')}</th>
                  <th className="pb-3 font-bold text-start">{t('طبيعة الحساب', 'Normal')}</th>
                  <th className="pb-3 font-bold text-end">{t('الرصيد من القيود المرحلة', 'Posted Journal Balance')}</th>
                  <th className="pb-3 font-bold text-center">{t('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {paginatedAccounts.map((acc) => {
                  const paddingClass = acc.level === 1 ? '' : acc.level === 2 ? 'ps-4' : 'ps-8';
                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${
                        acc.level === 1 ? 'font-bold bg-slate-50/40 dark:bg-slate-800/20' : ''
                      }`}
                    >
                      <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {acc.code}
                      </td>
                      <td className={`py-3 ${paddingClass}`}>
                        <div className="flex items-center gap-2">
                          {acc.level > 1 && <span className="text-slate-300 dark:text-slate-600">└─</span>}
                          <span className="text-slate-900 dark:text-white">
                            {language === 'ar' ? acc.nameAr : acc.nameEn}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            acc.type === 'Asset'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              : acc.type === 'Liability'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : acc.type === 'Equity'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                              : acc.type === 'Revenue'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          }`}
                        >
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-3">
                        {acc.branchId ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                            <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{branches.find((b) => b.id === acc.branchId)?.name || acc.branchNameAr || acc.branchId}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
                            <span>{t('عام (كل الفروع)', 'Shared / HQ')}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-500">
                        {acc.isDebitNormal ? t('مدين (Debit)', 'Debit') : t('دائن (Credit)', 'Credit')}
                      </td>
                      <td className="py-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(acc.balance)}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Jump to General Ledger */}
                          <button
                            onClick={() => handleViewGL(acc.id)}
                            title={t('عرض دفتر الأستاذ', 'View General Ledger')}
                            className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 transition-colors"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>

                          {/* Add Sub-account */}
                          <button
                            onClick={() => handleOpenAddAccount(acc.id)}
                            title={t('إضافة حساب فرعي', 'Add Sub-account')}
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 transition-colors"
                          >
                            <FolderPlus className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Account */}
                          <button
                            onClick={() => handleOpenEditAccount(acc)}
                            title={t('تعديل الحساب', 'Edit Account')}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => handleDeleteAccount(acc)}
                            title={t('حذف الحساب', 'Delete Account')}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL LEDGER (حساب الأستاذ العام) */}
      {activeTab === 'general_ledger' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Account Selector */}
            <div className="w-full md:w-80">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('اختر حساب الأستاذ المطلوب استعراضه *', 'Select GL Account *')}
              </label>
              <select
                value={selectedGLAccountId}
                onChange={(e) => setSelectedGLAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.nameAr} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['all', 'this_month', 'last_month', 'this_year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleGLPeriodChange(p)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      glPeriodFilter === p
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p === 'all'
                      ? t('كل المدة', 'All Time')
                      : p === 'this_month'
                      ? t('هذا الشهر', 'This Month')
                      : p === 'last_month'
                      ? t('الشهر السابق', 'Last Month')
                      : t('هذا العام', 'This Year')}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={glDateFrom}
                  onChange={(e) => {
                    setGlDateFrom(e.target.value);
                    setGlPeriodFilter('all');
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium dark:text-white"
                />
                <span className="text-xs text-slate-400">إلى</span>
                <input
                  type="date"
                  value={glDateTo}
                  onChange={(e) => {
                    setGlDateTo(e.target.value);
                    setGlPeriodFilter('all');
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium dark:text-white"
                />
              </div>

              <button
                onClick={() => setShowPrintGL(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Printer className="h-4 w-4 text-indigo-600" />
                <span>{t('طباعة كشف الأستاذ', 'Print Ledger')}</span>
              </button>
            </div>
          </div>

          {/* Account Profile & Financial Metrics */}
          {activeGLAccount && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                      {activeGLAccount.code}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {language === 'ar' ? activeGLAccount.nameAr : activeGLAccount.nameEn}
                    </h2>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {activeGLAccount.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('طبيعة الحساب الأصلية:', 'Normal Nature:')}{' '}
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {activeGLAccount.isDebitNormal ? t('مدين بطبيعته (Debit)', 'Debit') : t('دائن بطبيعته (Credit)', 'Credit')}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-end">
                    <span className="text-[11px] text-slate-400 block">{t('رصيد نهاية الفترة / الحالي', 'Closing Balance')}</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {formatMoney(glData.endingBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Financial KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">{t('رصيد أول المدة', 'Opening Balance')}</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 block font-mono">
                    {formatMoney(glData.openingBalance)}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center dark:border-emerald-950/50 dark:bg-emerald-950/30">
                  <span className="text-[11px] text-emerald-600 block">{t('إجمالي حركات المدين (+)', 'Total Debits')}</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1 block font-mono">
                    {formatMoney(glData.totalDebits)}
                  </span>
                </div>

                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-center dark:border-rose-950/50 dark:bg-rose-950/30">
                  <span className="text-[11px] text-rose-600 block">{t('إجمالي حركات الدائن (-)', 'Total Credits')}</span>
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-400 mt-1 block font-mono">
                    {formatMoney(glData.totalCredits)}
                  </span>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-center dark:border-indigo-950/50 dark:bg-indigo-950/30">
                  <span className="text-[11px] text-indigo-600 block">{t('صافي رصيد الحساب', 'Current Balance')}</span>
                  <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-1 block font-mono">
                    {formatMoney(glData.endingBalance)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <PaginationControls
            currentPage={generalLedgerPage}
            totalItems={glData.movements.length}
            pageSize={rowsPerPage}
            onPageChange={setGeneralLedgerPage}
            language={language}
          />

          {/* Movements Ledger Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
              <span>{t('حركات دفتر الأستاذ التفصيلية', 'General Ledger Transaction Lines')}</span>
              <span className="text-[11px] font-normal text-slate-400">
                {glData.movements.length} {t('حركة مقيدة', 'posted movements')}
              </span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                    <th className="pb-3 font-bold text-start">{t('التاريخ', 'Date')}</th>
                    <th className="pb-3 font-bold text-start">{t('رقم القيد', 'JV No.')}</th>
                    <th className="pb-3 font-bold text-start">{t('الفرع', 'Branch')}</th>
                    <th className="pb-3 font-bold text-start">{t('المستند المرجعي', 'Source Doc')}</th>
                    <th className="pb-3 font-bold text-start">{t('البيان والشرح', 'Description & Memo')}</th>
                    <th className="pb-3 font-bold text-end">{t('مدين (Debit)', 'Debit')}</th>
                    <th className="pb-3 font-bold text-end">{t('دائن (Credit)', 'Credit')}</th>
                    <th className="pb-3 font-bold text-end">{t('الرصيد التراكمي', 'Running Balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {/* Row: Opening Balance */}
                  <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300">
                    <td className="py-2.5 font-bold" colSpan={5}>
                      {t('--- رصيد بداية الفترة المنقول ---', '--- Opening Balance Carried Forward ---')}
                    </td>
                    <td className="py-2.5 text-end font-mono">-</td>
                    <td className="py-2.5 text-end font-mono">-</td>
                    <td className="py-2.5 text-end font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {formatMoney(glData.openingBalance)}
                    </td>
                  </tr>

                  {glData.movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {t('لا توجد حركات مقيدة لهذا الحساب خلال الفترة المحددة', 'No transactions found for this account in the selected period.')}
                      </td>
                    </tr>
                  ) : (
                    paginatedGeneralLedgerMovements.map((m) => (
                      <tr key={m.lineId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-mono text-slate-500 whitespace-nowrap">{m.date}</td>
                        <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {m.entryNumber}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          {m.branchId ? (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                              <Building2 className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{branches.find((b) => b.id === m.branchId)?.name || m.branchId}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">{t('عام', 'HQ')}</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {m.sourceDocument || t('قيد يومية عام', 'General JV')}
                        </td>
                        <td className="py-3">
                          <div className="text-slate-900 dark:text-white font-semibold">{m.description}</div>
                          {m.memo && <div className="text-[11px] text-slate-400 mt-0.5">{m.memo}</div>}
                          {m.historicalAccountCode && (
                            <div className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                              {t('الحساب التاريخي الأصلي:', 'Original historical account:')} {m.historicalAccountCode}
                              {m.historicalAccountId ? ` (${m.historicalAccountId})` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-end font-mono font-bold text-emerald-600">
                          {m.debit > 0 ? formatMoney(m.debit) : '-'}
                        </td>
                        <td className="py-3 text-end font-mono font-bold text-rose-600">
                          {m.credit > 0 ? formatMoney(m.credit) : '-'}
                        </td>
                        <td className="py-3 text-end font-mono font-black text-slate-900 dark:text-white">
                          {formatMoney(m.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50/50 dark:bg-slate-800/30">
                    <td className="py-3" colSpan={5}>
                      {t('إجمالي حركات الفترة والرصيد الختامي:', 'Total Period Movements & Closing Balance:')}
                    </td>
                    <td className="py-3 text-end font-mono text-emerald-600 font-black">
                      {formatMoney(glData.totalDebits)}
                    </td>
                    <td className="py-3 text-end font-mono text-rose-600 font-black">
                      {formatMoney(glData.totalCredits)}
                    </td>
                    <td className="py-3 text-end font-mono text-indigo-600 dark:text-indigo-400 font-black text-sm">
                      {formatMoney(glData.endingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GENERAL JOURNAL */}
      {activeTab === 'journal' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('سجل قيود اليومية العامة (Journal Entries)', 'General Journal')}</span>
                {selectedBranchId !== 'all' && (
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                    🏢 {branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500">
                {selectedBranchId !== 'all'
                  ? t('عرض قيود اليومية الخاصة بهذا الفرع فقط.', 'Displaying journal entries for this branch only.')
                  : t('عرض جميع قيود اليومية لجميع الفروع والمراكز.', 'Displaying all journal entries across all branches.')}
              </p>
            </div>
            <span className="text-xs text-slate-400">{filteredJournalEntries.length} {t('قيد مقيد', 'entries')}</span>
          </div>

          <div className="space-y-4">
            <PaginationControls
              currentPage={journalPage}
              totalItems={filteredJournalEntries.length}
              pageSize={rowsPerPage}
              onPageChange={setJournalPage}
              language={language}
            />
            {paginatedJournalEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
                      {entry.entryNumber}
                    </span>
                    {!entry.isPosted && (
                      <span className="rounded-lg bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {entry.voidReason ? t('ملغي الترحيل', 'Voided') : t('غير مرحل', 'Unposted')}
                      </span>
                    )}
                    <span className="font-bold text-slate-900 dark:text-white">{entry.description}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    {entry.branchId ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                        <Building2 className="w-3 h-3 text-indigo-500" />
                        <span>{branches.find((b) => b.id === entry.branchId)?.name || entry.branchId}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        <span>{t('عام / المركز الرئيسي', 'Shared / HQ')}</span>
                      </span>
                    )}
                    <span>{entry.date}</span>
                    {entry.sourceDocument && (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {entry.sourceDocument}
                      </span>
                    )}
                  </div>
                </div>
                {entry.voidReason && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    {t('سبب إلغاء الترحيل:', 'Void reason:')} {entry.voidReason} · {entry.voidedBy} · {entry.voidedAt}
                  </p>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="pb-1 text-start">{t('كود واسم الحساب', 'Account')}</th>
                        <th className="pb-1 text-start">{t('البيان / الشرح', 'Memo')}</th>
                        <th className="pb-1 text-end">{t('مدين', 'Debit')}</th>
                        <th className="pb-1 text-end">{t('دائن', 'Credit')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium">
                      {entry.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-2 text-slate-900 dark:text-white">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 me-2">
                              {l.accountCode}
                            </span>
                            {language === 'ar' ? l.accountNameAr : l.accountNameEn}
                            {l.historicalAccountCode && (
                              <div className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                                {t('الحساب التاريخي الأصلي:', 'Original historical account:')} {l.historicalAccountCode}
                                {l.historicalAccountId ? ` (${l.historicalAccountId})` : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-2 text-slate-500">{l.memo || '-'}</td>
                          <td className="py-2 text-end font-mono font-bold text-emerald-600">
                            {l.debit > 0 ? formatMoney(l.debit) : '-'}
                          </td>
                          <td className="py-2 text-end font-mono font-bold text-rose-600">
                            {l.credit > 0 ? formatMoney(l.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TRIAL BALANCE */}
      {activeTab === 'trial_balance' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('ميزان المراجعة من القيود المرحلة', 'Trial Balance (Posted Journals)')}</span>
                {selectedBranchId !== 'all' && (
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                    🏢 {branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500">
                {selectedBranchId !== 'all'
                  ? t('إجمالي أرصدة القيود المرحلة للفرع المحدد، دون تكرار أرصدة الحسابات الرئيسية والفرعية.', 'Posted journal balances for the selected branch, without double-counting parent and subsidiary accounts.')
                  : t('إجمالي أرصدة القيود المرحلة لجميع الفروع، دون تكرار أرصدة الحسابات الرئيسية والفرعية.', 'Posted journal balances across branches, without double-counting parent and subsidiary accounts.')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                trialBalanceStatus === 'balanced'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : trialBalanceStatus === 'incomplete'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}>
                {trialBalanceStatus === 'balanced'
                  ? t('الميزان متوازن', 'Balanced')
                  : trialBalanceStatus === 'incomplete'
                    ? t('الميزان غير مكتمل: حسابات غير مربوطة', 'Incomplete: unmapped accounts')
                    : t('الميزان غير متوازن', 'Out of balance')}
              </span>
            </div>
          </div>

          {(trialBalanceDiagnostics.unbalancedEntries.length > 0 || trialBalanceDiagnostics.unmappedLineCount > 0) && (
            <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs dark:border-rose-900/60 dark:bg-rose-950/20">
              <h4 className="font-bold text-rose-800 dark:text-rose-300">
                {t('تفاصيل القيود التي تحتاج مراجعة', 'Journal entries requiring review')}
                {' · '}
                {trialBalanceDiagnostics.unbalancedEntries.length}
                {' '}
                {t('قيد غير متوازن', 'unbalanced entries')}
                {' · '}
                {trialBalanceDiagnostics.unmappedLineCount}
                {' '}
                {t('سطر بحساب غير مربوط', 'lines with unmapped accounts')}
              </h4>
              {!hasUnbalancedJournalEntries && hasUnmappedJournalLines && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  {t(
                    'القيود المرحلة متوازنة حسابيًا، لكن الميزان غير مكتمل لأن بعض سطورها تستخدم أكواد حسابات غير موجودة في الشجرة الحالية. لذلك لا يجوز اعتبار فرق إجمالي الميزان قيدًا غير موزون.',
                    'Posted entries are mathematically balanced, but the trial balance is incomplete because some lines reference accounts missing from the current chart. The trial-balance total difference is not proof of an unbalanced journal.'
                  )}
                </p>
              )}
              {trialBalanceDiagnostics.unmappedLineCount > 0 && (
                <>
                  <p className="text-rose-800 dark:text-rose-300">
                    {t(
                      `حركة الحسابات غير المربوطة: مدين ${formatMoney(trialBalanceDiagnostics.unmappedDebitTotal)}، دائن ${formatMoney(trialBalanceDiagnostics.unmappedCreditTotal)}. هذه الحركات مستبعدة من إجمالي الميزان.`,
                      `Unmapped account movements: ${formatMoney(trialBalanceDiagnostics.unmappedDebitTotal)} debit and ${formatMoney(trialBalanceDiagnostics.unmappedCreditTotal)} credit. These movements are excluded from trial-balance totals.`
                    )}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-start">
                      <thead className="text-rose-700 dark:text-rose-300">
                        <tr>
                          <th className="py-1 text-start">{t('كود الحساب المفقود', 'Missing account code')}</th>
                          <th className="py-1 text-start">{t('المعرّف القديم', 'Legacy account ID')}</th>
                          <th className="py-1 text-end">{t('عدد الحركات', 'Lines')}</th>
                          <th className="py-1 text-end">{t('إجمالي المدين', 'Total debits')}</th>
                          <th className="py-1 text-end">{t('إجمالي الدائن', 'Total credits')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalanceDiagnostics.unmappedAccountGroups.map((group) => (
                          <tr key={`${group.accountId}-${group.accountCode}`} className="border-t border-rose-200/70 dark:border-rose-900/50">
                            <td className="py-1.5 font-mono">{group.accountCode || '—'}</td>
                            <td className="py-1.5 font-mono">{group.accountId || '—'}</td>
                            <td className="py-1.5 text-end font-mono">{group.lineCount}</td>
                            <td className="py-1.5 text-end font-mono">{formatMoney(group.debit)}</td>
                            <td className="py-1.5 text-end font-mono">{formatMoney(group.credit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {trialBalanceDiagnostics.unmappedAccountGroupCount > trialBalanceDiagnostics.unmappedAccountGroups.length && (
                      <p className="pt-2 text-slate-600 dark:text-slate-400">
                        {t(
                          `المعروض أعلى ${trialBalanceDiagnostics.unmappedAccountGroups.length} مجموعة حركة من أصل ${trialBalanceDiagnostics.unmappedAccountGroupCount}، مرتبة حسب إجمالي الحركة.`,
                          `Showing the ${trialBalanceDiagnostics.unmappedAccountGroups.length} largest movement groups out of ${trialBalanceDiagnostics.unmappedAccountGroupCount}, sorted by total movement.`
                        )}
                      </p>
                    )}
                  </div>
                </>
              )}
              {trialBalanceDiagnostics.unbalancedEntries.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-start">
                    <thead className="text-rose-700 dark:text-rose-300">
                      <tr>
                        <th className="py-1 text-start">{t('رقم القيد / التاريخ', 'Entry / Date')}</th>
                        <th className="py-1 text-end">{t('إجمالي المدين', 'Debits')}</th>
                        <th className="py-1 text-end">{t('إجمالي الدائن', 'Credits')}</th>
                        <th className="py-1 text-end">{t('الفرق (مدين - دائن)', 'Difference (debit - credit)')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalanceDiagnostics.unbalancedEntries.map((entry) => (
                        <tr key={entry.id} className="border-t border-rose-200/70 dark:border-rose-900/50">
                          <td className="py-1.5 font-mono">{entry.entryNumber} · {entry.date}</td>
                          <td className="py-1.5 text-end font-mono">{formatMoney(entry.debit)}</td>
                          <td className="py-1.5 text-end font-mono">{formatMoney(entry.credit)}</td>
                          <td className="py-1.5 text-end font-mono font-bold">
                            {entry.difference > 0 ? t('زيادة مدين ', 'Debit excess ') : t('زيادة دائن ', 'Credit excess ')}
                            {formatMoney(Math.abs(entry.difference))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {trialBalanceDiagnostics.unmappedLineCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <div>
                    <p className="font-bold">
                      {t(
                        `هناك ${trialBalanceDiagnostics.unmappedLineCount} سطرًا بحسابات لا يمكن مطابقتها في الشجرة.`,
                        `${trialBalanceDiagnostics.unmappedLineCount} lines reference accounts that cannot be matched in this chart.`
                      )}
                    </p>
                    <p className="mt-0.5">
                      {t(
                        'يمكن تجميع السطور غير المربوطة الظاهرة في النطاق الحالي تحت حساب مستقل 9999999، مع حفظ الكود والمعرّف الأصليين بكل سطر.',
                        'Consolidate the unmapped lines in the current scope under account 9999999 while preserving each original code and ID on the journal line.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConsolidationError(null);
                      setShowConsolidationDialog(true);
                    }}
                    className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800"
                  >
                    {t('تجميع في الحساب 9999999', 'Consolidate into account 9999999')}
                  </button>
                </div>
              )}
              {trialBalanceDiagnostics.unmappedLines.length > 0 && (
                <div className="space-y-1 text-rose-800 dark:text-rose-300">
                  <p className="font-semibold">
                    {t(
                      `تعذر مطابقة ${trialBalanceDiagnostics.unmappedLineCount} سطرًا بحساب في نفس الكيان والفرع؛ لم تدخل في إجمالي الميزان. المعروض أول ${trialBalanceDiagnostics.unmappedLines.length} سطر فقط:`,
                      `${trialBalanceDiagnostics.unmappedLineCount} lines could not be matched to an account in the same tenant and branch; they were excluded. Showing the first ${trialBalanceDiagnostics.unmappedLines.length} only:`
                    )}
                  </p>
                  {trialBalanceDiagnostics.unmappedLines.map((line, index) => (
                    <p key={`${line.entryNumber}-${line.accountId}-${index}`} className="font-mono">
                      {line.entryNumber} · {line.accountCode} ({line.accountId}) · {t('مدين', 'Dr')} {formatMoney(line.debit)} · {t('دائن', 'Cr')} {formatMoney(line.credit)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          {trialBalanceDiagnostics.resolvedByLegacyCodeCount > 0 && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              {t(
                `تم تضمين ${trialBalanceDiagnostics.resolvedByLegacyCodeCount} سطرًا بمطابقة كود الحساب أو حساب العملاء المجمع، دون تعديل القيود المحفوظة.`,
                `${trialBalanceDiagnostics.resolvedByLegacyCodeCount} lines were included by matching account code or the customer control account; saved journals were not changed.`
              )}
            </p>
          )}

          <PaginationControls
            currentPage={trialBalancePage}
            totalItems={trialBalanceAccounts.length}
            pageSize={rowsPerPage}
            onPageChange={setTrialBalancePage}
            language={language}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-bold text-start">{t('كود الحساب', 'Code')}</th>
                  <th className="pb-3 font-bold text-start">{t('اسم الحساب', 'Account Name')}</th>
                  <th className="pb-3 font-bold text-start">{t('النوع', 'Type')}</th>
                  <th className="pb-3 font-bold text-start">{t('الفرع', 'Branch')}</th>
                  <th className="pb-3 font-bold text-end">{t('رصيد مدين', 'Debit Balance')}</th>
                  <th className="pb-3 font-bold text-end">{t('رصيد دائن', 'Credit Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {paginatedTrialBalanceAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{acc.code}</td>
                    <td className="py-2.5 text-slate-900 dark:text-white">
                      {language === 'ar' ? acc.nameAr : acc.nameEn}
                    </td>
                    <td className="py-2.5 text-slate-500">{acc.type}</td>
                    <td className="py-2.5">
                      {acc.branchId ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800">
                          {branches.find((b) => b.id === acc.branchId)?.name || acc.branchNameAr || acc.branchId}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">{t('عام', 'HQ')}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-end font-mono font-bold text-emerald-600">
                      {acc.balance > 0
                        ? formatMoney(acc.balance)
                        : '-'}
                    </td>
                    <td className="py-2.5 text-end font-mono font-bold text-rose-600">
                      {acc.balance < 0
                        ? formatMoney(-acc.balance)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800/50">
                  <td className="py-3" colSpan={4}>
                    {t('الإجمالي العام لميزان المراجعة:', 'Trial Balance Total:')}
                  </td>
                  <td className="py-3 text-end font-mono font-black text-emerald-600 text-sm">
                    {formatMoney(totalDebits)}
                  </td>
                  <td className="py-3 text-end font-mono font-black text-rose-600 text-sm">
                    {formatMoney(totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {consolidationResult && activeTab === 'trial_balance' && (
        <div className="fixed bottom-5 end-5 z-[80] flex max-w-lg items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-lg dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{consolidationResult}</span>
          <button type="button" onClick={() => setConsolidationResult(null)} aria-label={t('إغلاق', 'Dismiss')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {showConsolidationDialog && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-xl space-y-4 rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl dark:border-amber-900/60 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {t('تجميع الحركات غير المربوطة في حساب 9999999', 'Consolidate Unmapped Movements into 9999999')}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t('النطاق الحالي:', 'Current scope:')} {selectedBranchId === 'all'
                    ? t('كل الفروع', 'All branches')
                    : selectedBranchId === 'general'
                      ? t('الحسابات العامة', 'General accounts')
                      : branches.find((branch) => branch.id === selectedBranchId)?.name || selectedBranchId}
                </p>
              </div>
              <button type="button" onClick={() => setShowConsolidationDialog(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('إغلاق', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-bold">
                {t(
                  `سيتم إعادة ربط ${trialBalanceDiagnostics.unmappedLineCount} سطرًا من القيود المرحلة، منها ${trialBalanceDiagnostics.unresolvedHistoricalLinkCount} سطر بمعرّف حساب قديم غير موجود. المدين ${formatMoney(trialBalanceDiagnostics.unmappedDebitTotal)} والدائن ${formatMoney(trialBalanceDiagnostics.unmappedCreditTotal)}.`,
                  `${trialBalanceDiagnostics.unmappedLineCount} posted journal lines will be reassigned, including ${trialBalanceDiagnostics.unresolvedHistoricalLinkCount} lines with stale account IDs. Debit ${formatMoney(trialBalanceDiagnostics.unmappedDebitTotal)} and credit ${formatMoney(trialBalanceDiagnostics.unmappedCreditTotal)}.`
                )}
              </p>
              <p className="mt-1">
                {t(
                  'لن تتغير مبالغ أو تواريخ القيود. سيُحفظ الكود والمعرّف الأصليان داخل كل سطر للمراجعة، ويظل الحساب 9999999 حسابًا مؤقتًا مجمعًا وليس تصحيحًا لتصنيف الحسابات الأصلية.',
                  'Journal amounts and dates will not change. Each original account code and ID will be retained on its line for review. Account 9999999 is a temporary consolidation, not a determination of the original accounts’ classifications.'
                )}
              </p>
            </div>
            <label className="block space-y-1 text-xs font-bold text-slate-700 dark:text-slate-200">
              <span>{t('تصنيف حساب التجميع (يمكن تغييره لاحقًا بعد المراجعة)', 'Consolidation account type (can be changed after review)')}</span>
              <select
                value={consolidationAccountType}
                onChange={(event) => setConsolidationAccountType(event.target.value as AccountType)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Liability">{t('التزامات - دائن بطبيعته (مقترح لصافي الحركة الحالي)', 'Liability - credit-normal (suggested for the current net movement)')}</option>
                <option value="Asset">{t('أصول - مدين بطبيعته', 'Asset - debit-normal')}</option>
                <option value="Equity">{t('حقوق ملكية - دائن بطبيعته', 'Equity - credit-normal')}</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs font-bold text-slate-700 dark:text-slate-200">
              <span>{t('سبب التجميع (إلزامي للتدقيق)', 'Reason for consolidation (required for audit)')}</span>
              <input
                value={consolidationReason}
                onChange={(event) => setConsolidationReason(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
                placeholder={t('مثال: تجميع أكواد تاريخية بعد مراجعة الشجرة', 'Example: consolidate historical codes after reviewing the chart')}
              />
            </label>
            {consolidationError && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{consolidationError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <button type="button" onClick={() => setShowConsolidationDialog(false)} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                {t('رجوع دون تغيير', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={!consolidationReason.trim() || trialBalanceDiagnostics.unmappedLineCount === 0}
                onClick={handleConsolidateUnmappedLines}
                className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('تجميع الآن في 9999999', 'Consolidate now into 9999999')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT ACCOUNT MODAL */}
      {showUnbalancedJournalModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {t('مراجعة القيود غير المتوازنة ومصادرها', 'Unbalanced Journals & Sources')}
                </h2>
                <p className="text-xs text-slate-500">
                  {t('يُسمح بتصحيح القيد المتوازن مع الحفاظ على إجمالي المصدر. القيود المرتبطة بمصدر آخر تُعدّل من شاشته.', 'Corrections preserve linked source totals. Other source-linked entries must be changed from their source screen.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUnbalancedJournalModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={t('إغلاق', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              {editingUnbalancedEntryId ? (() => {
                const entry = journalEntries.find((candidate) => candidate.id === editingUnbalancedEntryId);
                if (!entry) return <p className="text-sm text-rose-600">{t('القيد لم يعد موجودًا.', 'The journal entry no longer exists.')}</p>;
                const sourceInfo = getJournalEntrySourceInfo(entry.id);
                const repairAccounts = accounts.filter((account) =>
                  account.tenantId === entry.tenantId &&
                  (!account.branchId || account.branchId === 'all' || account.branchId === entry.branchId)
                );
                const debitTotal = repairLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
                const creditTotal = repairLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
                return (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      <p className="font-bold">{entry.entryNumber} · {entry.date} · {entry.description}</p>
                      <p className="mt-1">{t('المصدر:', 'Source:')} {sourceInfo.description}</p>
                      {sourceInfo.expectedAmount !== undefined && (
                        <p className="mt-1 font-semibold">
                          {t('إجمالي المستندات المرتبطة (يجب الحفاظ عليه):', 'Linked source total (must be preserved):')} {formatMoney(sourceInfo.expectedAmount)}
                        </p>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-start text-slate-500 dark:border-slate-700">
                            <th className="p-2 text-start">{t('الحساب', 'Account')}</th>
                            <th className="p-2 text-start">{t('البيان', 'Memo')}</th>
                            <th className="p-2 text-end">{t('مدين', 'Debit')}</th>
                            <th className="p-2 text-end">{t('دائن', 'Credit')}</th>
                            <th className="p-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {repairLines.map((line, index) => (
                            <tr key={`${editingUnbalancedEntryId}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="p-2">
                                <select
                                  value={line.accountId}
                                  onChange={(event) => setRepairLines((previous) => previous.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, accountId: event.target.value } : item
                                  ))}
                                  className="w-full min-w-[220px] rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <option value="">{t('اختر حسابًا', 'Select account')}</option>
                                  {repairAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.code} - {language === 'ar' ? account.nameAr : account.nameEn}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  value={line.memo}
                                  onChange={(event) => setRepairLines((previous) => previous.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, memo: event.target.value } : item
                                  ))}
                                  className="w-full min-w-[140px] rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.debit}
                                  onChange={(event) => setRepairLines((previous) => previous.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, debit: Number(event.target.value) || 0 } : item
                                  ))}
                                  className="w-28 rounded-lg border border-slate-200 bg-white p-2 text-end font-mono dark:border-slate-700 dark:bg-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.credit}
                                  onChange={(event) => setRepairLines((previous) => previous.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, credit: Number(event.target.value) || 0 } : item
                                  ))}
                                  className="w-28 rounded-lg border border-slate-200 bg-white p-2 text-end font-mono dark:border-slate-700 dark:bg-slate-800"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setRepairLines((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                                  className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                  aria-label={t('حذف السطر', 'Remove line')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold">
                            <td className="p-2" colSpan={2}>{t('الإجمالي', 'Totals')}</td>
                            <td className={`p-2 text-end font-mono ${Math.abs(debitTotal - creditTotal) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(debitTotal)}</td>
                            <td className="p-2 text-end font-mono">{formatMoney(creditTotal)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setRepairLines((previous) => [...previous, {
                          accountId: repairAccounts[0]?.id || '',
                          debit: 0,
                          credit: 0,
                          memo: '',
                        }])}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <span className="inline-flex items-center gap-1"><Plus className="h-4 w-4" />{t('إضافة سطر', 'Add line')}</span>
                      </button>
                      <input
                        value={repairReason}
                        onChange={(event) => setRepairReason(event.target.value)}
                        placeholder={t('سبب التصحيح (إلزامي)', 'Correction reason (required)')}
                        className="min-w-[260px] flex-1 rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    {repairError && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{repairError}</p>}
                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <button type="button" onClick={() => setEditingUnbalancedEntryId(null)} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                        {t('رجوع للقائمة', 'Back to list')}
                      </button>
                      <button type="button" onClick={handleRepairJournal} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                        {t('حفظ التصحيح', 'Save correction')}
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div className="space-y-4">
                  {voidingUnbalancedEntryId && (
                    <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                      <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
                        {t('سيتم إلغاء ترحيل القيد اليدوي مع الاحتفاظ بسجله وسجل التدقيق.', 'The manual journal will be unposted while retaining its history and audit trail.')}
                      </p>
                      <input
                        value={voidReason}
                        onChange={(event) => setVoidReason(event.target.value)}
                        placeholder={t('سبب الإلغاء (إلزامي)', 'Void reason (required)')}
                        className="w-full rounded-lg border border-rose-200 bg-white p-2 text-xs dark:border-rose-800 dark:bg-slate-900"
                      />
                      {voidError && <p className="text-xs text-rose-700 dark:text-rose-300">{voidError}</p>}
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setVoidingUnbalancedEntryId(null)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600">{t('إلغاء', 'Back')}</button>
                        <button type="button" onClick={handleVoidJournal} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white">{t('تأكيد إلغاء الترحيل', 'Confirm void')}</button>
                      </div>
                    </div>
                  )}
                  {trialBalanceDiagnostics.unbalancedEntries.length === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                      {t('لا توجد قيود يومية مرحلة غير متوازنة في النطاق الحالي.', 'There are no unbalanced posted journal entries in the current scope.')}
                    </div>
                  ) : (
                    <>
                      <PaginationControls
                        currentPage={unbalancedPage}
                        totalItems={trialBalanceDiagnostics.unbalancedEntries.length}
                        pageSize={rowsPerPage}
                        onPageChange={setUnbalancedPage}
                        language={language}
                      />
                      {paginatedUnbalancedEntries.map((diagnostic) => {
                        const entry = journalEntries.find((candidate) => candidate.id === diagnostic.id);
                        if (!entry) return null;
                        const sourceInfo = getJournalEntrySourceInfo(entry.id);
                        return (
                          <div key={entry.id} className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/10">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-mono text-sm font-black text-slate-900 dark:text-white">{entry.entryNumber} · {entry.date}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300">{entry.description}</p>
                                <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">{t('المصدر:', 'Source:')} {sourceInfo.description}</p>
                              </div>
                              <div className="text-end text-xs">
                                <p>{t('مدين', 'Debit')}: <b className="font-mono">{formatMoney(diagnostic.debit)}</b></p>
                                <p>{t('دائن', 'Credit')}: <b className="font-mono">{formatMoney(diagnostic.credit)}</b></p>
                                <p className="font-bold text-rose-700 dark:text-rose-300">{t('الفرق', 'Difference')}: {formatMoney(Math.abs(diagnostic.difference))}</p>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[520px] text-[11px]">
                                <thead><tr className="text-slate-400"><th className="p-1 text-start">{t('الحساب', 'Account')}</th><th className="p-1 text-start">{t('البيان', 'Memo')}</th><th className="p-1 text-end">{t('مدين', 'Debit')}</th><th className="p-1 text-end">{t('دائن', 'Credit')}</th></tr></thead>
                                <tbody>
                                  {entry.lines.map((line) => (
                                    <tr key={line.id} className="border-t border-rose-100 dark:border-rose-900/40">
                                      <td className="p-1">{line.accountCode} · {language === 'ar' ? line.accountNameAr : line.accountNameEn}</td>
                                      <td className="p-1">{line.memo || '-'}</td>
                                      <td className="p-1 text-end font-mono">{formatMoney(Number(line.debit) || 0)}</td>
                                      <td className="p-1 text-end font-mono">{formatMoney(Number(line.credit) || 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {sourceInfo.reason && <p className="text-xs text-amber-700 dark:text-amber-300">{sourceInfo.reason}</p>}
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={!sourceInfo.canEdit}
                                onClick={() => startRepairJournal(entry.id)}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <span className="inline-flex items-center gap-1"><Edit3 className="h-3.5 w-3.5" />{t('تعديل القيد', 'Edit journal')}</span>
                              </button>
                              <button
                                type="button"
                                disabled={!sourceInfo.canVoid}
                                onClick={() => {
                                  setVoidingUnbalancedEntryId(entry.id);
                                  setVoidReason('');
                                  setVoidError(null);
                                }}
                                className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
                              >
                                <span className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />{t('إلغاء القيد اليدوي', 'Void manual journal')}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {modalMode === 'add'
                  ? t('إضافة حساب جديد إلى شجرة الحسابات', 'Add New Account to COA')
                  : t('تعديل بيانات الحساب المحاسبي', 'Edit Account Details')}
              </h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('كود الحساب *', 'Account Code *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.code}
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold focus:outline-indigo-600"
                    placeholder="e.g. 1113"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('النوع الرئيسي *', 'Account Type *')}
                  </label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => {
                      const newType = e.target.value as AccountType;
                      const isDebit = newType === 'Asset' || newType === 'Expense';
                      setAccountForm({ ...accountForm, type: newType, isDebitNormal: isDebit });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold focus:outline-indigo-600"
                  >
                    <option value="Asset">{t('أصول (Asset)', 'Asset')}</option>
                    <option value="Liability">{t('خصوم والتزامات (Liability)', 'Liability')}</option>
                    <option value="Equity">{t('حقوق ملكية (Equity)', 'Equity')}</option>
                    <option value="Revenue">{t('إيرادات (Revenue)', 'Revenue')}</option>
                    <option value="Expense">{t('مصروفات (Expense)', 'Expense')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الحساب بالعربية *', 'Arabic Account Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={accountForm.nameAr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAccountForm({
                      ...accountForm,
                      nameAr: val,
                      nameEn: autoTranslateArabic(val),
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                  placeholder="مثال: الخزينة الفرعية - عهدة الاستقبال"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('اسم الحساب بالإنجليزية (مترجم تلقائياً)', 'English Account Name')}
                </label>
                <input
                  type="text"
                  value={accountForm.nameEn}
                  onChange={(e) => setAccountForm({ ...accountForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono"
                  placeholder="e.g. Reception Cash Box"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('الفرع التابع له الحساب', 'Branch Affiliation')}</span>
                  </label>
                  <select
                    value={accountForm.branchId}
                    onChange={(e) => {
                      const bId = e.target.value;
                      const matched = branches.find((b) => b.id === bId);
                      setAccountForm({
                        ...accountForm,
                        branchId: bId,
                        branchNameAr: matched ? matched.name : '',
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-bold"
                  >
                    <option value="">{t('🌐 حساب عام (مشترك لجميع الفروع / المركز الرئيسي)', '🌐 Shared / HQ (All Branches)')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        🏢 {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الحساب الرئيسي (الأب)', 'Parent Account')}
                  </label>
                  <select
                    value={accountForm.parentId}
                    onChange={(e) => setAccountForm({ ...accountForm, parentId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="">{t('-- حساب رئيسي مستقل (بدون أب) --', '-- Root Account --')}</option>
                    {accounts
                      .filter((a) => a.id !== editingAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.nameAr}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('طبيعة الحساب', 'Normal Balance')}
                  </label>
                  <select
                    value={accountForm.isDebitNormal ? 'true' : 'false'}
                    onChange={(e) => setAccountForm({ ...accountForm, isDebitNormal: e.target.value === 'true' })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
                  >
                    <option value="true">{t('مدين (Debit)', 'Debit')}</option>
                    <option value="false">{t('دائن (Credit)', 'Credit')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('الرصيد الافتتاحي (ج.م)', 'Opening Balance')}
                  </label>
                  <input
                    type="number"
                    value={accountForm.balance}
                    onChange={(e) => setAccountForm({ ...accountForm, balance: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-bold text-indigo-600 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 font-mono"
                  />
                </div>
              </div>

              {accountModalError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{accountModalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-sm"
                >
                  {modalMode === 'add' ? t('حفظ الحساب الجديد', 'Save Account') : t('تحديث البيانات', 'Update Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT GENERAL LEDGER MODAL */}
      {showPrintGL && activeGLAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('كشف حساب الأستاذ العام المعتمد', 'Official General Ledger Statement')}
                </h3>
                <p className="text-xs text-slate-400">
                  {tenant?.name} • {activeBranch?.nameAr}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  <span>{t('طباعة الآن', 'Print Now')}</span>
                </button>
                <button
                  onClick={() => setShowPrintGL(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Dossier Header */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block">{t('كود الحساب:', 'Code:')}</span>
                <span className="font-mono font-bold text-indigo-600">{activeGLAccount.code}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('اسم الحساب:', 'Name:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{activeGLAccount.nameAr}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('النوع والطبيعة:', 'Type & Nature:')}</span>
                <span className="font-bold">{activeGLAccount.type} ({activeGLAccount.isDebitNormal ? 'مدين' : 'دائن'})</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('الرصيد الختامي:', 'Closing Balance:')}</span>
                <span className="font-mono font-black text-indigo-700 dark:text-indigo-400">{formatMoney(glData.endingBalance)}</span>
              </div>
            </div>

            {/* Printable Table */}
            <table className="w-full text-xs border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                <tr>
                  <th className="p-2 text-start border-b">{t('التاريخ', 'Date')}</th>
                  <th className="p-2 text-start border-b">{t('رقم القيد', 'JV No.')}</th>
                  <th className="p-2 text-start border-b">{t('البيان والشرح', 'Description')}</th>
                  <th className="p-2 text-end border-b">{t('مدين', 'Debit')}</th>
                  <th className="p-2 text-end border-b">{t('دائن', 'Credit')}</th>
                  <th className="p-2 text-end border-b">{t('الرصيد', 'Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr className="bg-slate-50/50">
                  <td className="p-2 font-bold" colSpan={3}>{t('رصيد أول المدة المنقول', 'Opening Balance')}</td>
                  <td className="p-2 text-end font-mono">-</td>
                  <td className="p-2 text-end font-mono">-</td>
                  <td className="p-2 text-end font-mono font-bold text-indigo-600">{formatMoney(glData.openingBalance)}</td>
                </tr>
                {glData.movements.map((m) => (
                  <tr key={m.lineId}>
                    <td className="p-2 font-mono">{m.date}</td>
                    <td className="p-2 font-mono font-bold">{m.entryNumber}</td>
                    <td className="p-2">{m.description}</td>
                    <td className="p-2 text-end font-mono text-emerald-600">{m.debit > 0 ? formatMoney(m.debit) : '-'}</td>
                    <td className="p-2 text-end font-mono text-rose-600">{m.credit > 0 ? formatMoney(m.credit) : '-'}</td>
                    <td className="p-2 text-end font-mono font-bold">{formatMoney(m.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MANUAL JOURNAL MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('إنشاء قيد يومية يدوي جديد', 'Create Manual Journal Entry')}
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('البيان وشرح القيد *', 'Entry Description *')}
                  </label>
                  <input
                    type="text"
                    value={entryDesc}
                    onChange={(e) => setEntryDesc(e.target.value)}
                    placeholder="مثال: تسوية إيجار الفرع، سداد مصروفات عهدة..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('الفرع المسجل عليه القيد *', 'Branch for Journal Entry *')}</span>
                  </label>
                  <select
                    value={manualJournalBranchId}
                    onChange={(e) => setManualJournalBranchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">{t('🌐 المركز الرئيسي / عام للشركة', '🌐 HQ / General Shared')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        🏢 {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Journal Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{t('أطراف القيد (المدين والدائن)', 'Journal Lines')}</span>
                  <button
                    onClick={() =>
                      setLines([...lines, { accountId: accounts[0]?.id || '', debit: 0, credit: 0, memo: '' }])
                    }
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                  >
                    + {t('إضافة طرف قيد', 'Add Line')}
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={line.accountId}
                      onChange={(e) => {
                        const copy = [...lines];
                        copy[idx].accountId = e.target.value;
                        setLines(copy);
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 font-medium text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {accounts.map((a) => {
                        const bName = a.branchId ? (branches.find((b) => b.id === a.branchId)?.name || a.branchNameAr || 'فرع') : '';
                        return (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.nameAr} {bName ? `[${bName}]` : '[عام]'}
                          </option>
                        );
                      })}
                    </select>

                    <input
                      type="number"
                      placeholder={t('مدين', 'Debit')}
                      value={line.debit || ''}
                      onChange={(e) => {
                        const copy = [...lines];
                        copy[idx].debit = Number(e.target.value) || 0;
                        if (copy[idx].debit > 0) copy[idx].credit = 0;
                        setLines(copy);
                      }}
                      className="w-28 rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-end outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />

                    <input
                      type="number"
                      placeholder={t('دائن', 'Credit')}
                      value={line.credit || ''}
                      onChange={(e) => {
                        const copy = [...lines];
                        copy[idx].credit = Number(e.target.value) || 0;
                        if (copy[idx].credit > 0) copy[idx].debit = 0;
                        setLines(copy);
                      }}
                      className="w-28 rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-end outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                ))}
              </div>

              {modalError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSaveManualEntry}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('ترحيل وحفظ القيد في اليومية', 'Post & Balance Entry')}
                </button>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
