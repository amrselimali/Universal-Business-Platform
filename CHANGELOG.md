# CHANGELOG

# 2026-10-12

## Import all data from Neon (with safety backup and double confirmation)

- Added an **"Import all data from Neon"** action on the Neon screen. It (1) downloads a full multi-sheet Excel backup of the current local data, (2) reads every dataset document from Neon's `app_documents`, and (3) applies them to the app state. Datasets missing in Neon are left untouched, so nothing is deleted locally.
- The action is protected by a **two-step confirmation dialog** and reports how many datasets were imported plus the backup file name. Imported datasets are also marked as synced so the automatic push does not immediately overwrite them with stale local state.
- Files: `src/context/PlatformContext.tsx`, `src/views/NeonHubView.tsx`.

# 2026-10-12

## Neon sync resilience + dataset inventory panel

- Root cause of "bookings/follow-ups were not uploaded": the failing `patients` insert **aborted the whole relational sync** (it runs inside one try block, and patients is step 7), so parties, appointments, follow-ups and journal entries never executed. Every sync section is now isolated in its own try/catch, so one failing section no longer stops the rest.
- `patientFollowUps` was never passed to `syncAllData` from the app, so `patient_follow_ups` could never be filled. It is now passed.
- Added a **dataset inventory panel** to the Neon screen listing every dataset key that is synced and its current record count, so it is easy to verify what is included.
- Files: `src/services/neonService.ts`, `src/context/PlatformContext.tsx`, `src/views/NeonHubView.tsx`.

# 2026-10-12

## Neon upload speed — chunked datasets, parallel uploads and live progress

- The Neon upload used to send one huge HTTP request per dataset, so large datasets (journals, parties) took minutes. Datasets larger than ~0.9 MB are now split into ~0.7 MB chunk documents (`<key>#0`, `<key>#1`, ...) with a small manifest stored under the original key, and chunks are re-assembled transparently on read.
- Chunk documents are uploaded with a small concurrency pool (4 parallel requests) instead of strictly sequentially.
- Added live progress reporting: `neonAutoSyncProgress` (done/total) is shown in the Neon screen's sync status card while uploading.
- Files: `src/services/neonService.ts`, `src/context/PlatformContext.tsx`, `src/views/NeonHubView.tsx`.

# 2026-10-12

## Fix Neon sync error: patients.file_number NOT NULL

- The full transfer to Neon succeeded for all 34 document datasets, but the legacy relational mirror failed with `null value in column "file_number" of relation "patients" violates not-null constraint`.
- `syncAllData` created `patients.file_number` as `NOT NULL` (older schema), while parties mirrored into `patients` have no file number.
- Fixed by: declaring the column nullable, running an idempotent `ALTER TABLE patients ALTER COLUMN file_number DROP NOT NULL`, and inserting safe fallbacks (`fileNumber || ''`, `fullName || name`, `phone || ''`, `gender || ''`) in both the bulk sync and `insertPatientDirect`.
- Files: `src/services/neonService.ts`.

# 2026-10-12

## Full initial transfer to Neon + visible sync status

- `syncAllToNeon` now pushes **every dataset** to `app_documents` (34 documents) in addition to the tagged relational tables, so existing data can be transferred once with the sync button.
- The automatic sync no longer requires the "connected" flag: it runs whenever a valid Neon connection string is configured, and reports failures instead of silently doing nothing.
- Added a **live sync status card** in the Neon screen: uploading / last upload time + dataset count / explicit error message / connected state.
- Files: `src/context/PlatformContext.tsx`, `src/views/NeonHubView.tsx`.

# 2026-10-12

## Backup button now reads live data from Neon

- The "Backup to Excel" button in the Neon screen previously exported the **in-browser** state while claiming to back up the database. It now reads every dataset from Neon's `app_documents` store first and only falls back to the browser copy for datasets missing in Neon.
- The result message clearly states the source (live Neon data with the dataset count, or browser data when Neon is not connected / unreadable).
- Stock levels are now part of the automatic Neon sync (`erp_stock_levels`) so the backup covers them from Neon too.
- Files: `src/views/NeonHubView.tsx`, `src/context/PlatformContext.tsx`.

# 2026-10-12

## All data now syncs automatically to Neon (unified document store)

- Added the `app_documents` table (one JSONB row per dataset per tenant) plus `NeonService.saveDocuments` / `NeonService.fetchDocuments` / `NeonService.ensureDocumentsTable`.
- Added an **automatic Neon sync**: every dataset the app keeps (collection receipts, customer refunds, reception shifts, POS shifts, cash vouchers, tax invoices, goods vouchers, parties, journals, accounts, products, payroll, attendance, staff, laser devices, maintenance, inventory audits, period locks, notifications, audit/activity logs, ...) is uploaded to Neon as a JSONB document. Uploads are debounced (3s after the last change) and only datasets whose content changed are sent.
- Exposed `neonAutoSync` status (syncing / last run / last saved count / error).
- Documented the new table in `scripts/neon_schema_migrations.sql`.
- Files: `src/services/neonService.ts`, `src/context/PlatformContext.tsx`, `scripts/neon_schema_migrations.sql`.

# 2026-10-12

## Statement no longer shows archived receipts (root cause of the "phantom" receipts)

- The detailed customer statement included **archived** collection receipts, while the collection receipts screen (active view) hides them — so receipts like `CR-2026-0007/0008/0009` appeared in the statement but were impossible to see or cancel in the screen.
- The statement (and the balance synchronization) now exclude archived receipts, matching the collection receipts screen.
- Added a safety try/catch around the customer reconciliation effect so an unexpected error preserves existing data instead of surfacing as a browser exception.
- Files: `src/components/PartyStatementModal.tsx`, `src/context/PlatformContext.tsx`.

# 2026-10-12

## Customer balance sync follow-ups

- The reconciliation effect (which recomputes each customer's card balance from the statement sources) now also depends on `allCustomerRefunds`, so refunds that are auto-recovered after the first pass are immediately reflected in the card balance.
- Fixed duplicated currency text (`ج.م ج.م`) in the statement's card/movements difference notice.
- Collection receipts with **no branch assigned** are no longer hidden in the collection receipts screen for a specific active branch, so branch-less receipts can be reviewed/deleted.
- Files: `src/context/PlatformContext.tsx`, `src/components/PartyStatementModal.tsx`, `src/views/CollectionReceiptsView.tsx`.

# 2026-10-12

## Customer card balance now derives from the same sources as the statement

- The party card balance (`party.balance`) was updated by only a few operations plus the imported opening value, while the statement total was derived from all documents — so the two disagreed by exactly the old "opening balance".
- The reconciliation now recomputes every customer's card balance from the SAME document sources the statement uses (invoices, reception rows with linked-receipt handling, collection receipts and customer refunds), so the card balance and the statement movements total are identical.
- Files: `src/context/PlatformContext.tsx`.

# 2026-10-12

## Customer statement — remove card balance from selector + clarify reference

- Removed the recorded balance shown next to each customer name in the statement's customer selector.
- The card/movements difference notice now states explicitly that the **movements total is the correct reference** and the **card balance needs correcting** (instead of framing the movements as the questionable side).
- Files: `src/components/PartyStatementModal.tsx`.

# 2026-10-12

## Customer statement — remove the fabricated opening balance

- The statement was showing an artificial "opening balance" for many customers because it folded the residual between the recorded card balance and the displayed movements into `رصيد أول المدة`. That residual is no longer fabricated.
- The opening balance is now derived only from real movements recorded before the selected period (so it is 0 for the "All" range).
- When the recorded card balance differs from the displayed movements, an explicit notice shows the difference instead of hiding it in the opening balance.
- Files: `src/components/PartyStatementModal.tsx`.

# 2026-10-12

## Collection receipts — prevent duplicate imports

- `addCollectionReceiptsBulk` now skips items that are exact duplicates of an already-recorded receipt (same tenant + customer + date + amount + service + draft number) and of earlier items in the same batch, returning `skippedDuplicates`. The collection-receipts Excel import surfaces the skipped count.
- This prevents the repeated-import duplicates that inflated a customer's statement (e.g. the same 800 receipt appearing several times).
- Files: `src/context/PlatformContext.tsx`, `src/views/CollectionReceiptsView.tsx`.

# 2026-10-12

## Fix auto-recovered refunds being attached to the wrong customer

- Root cause of the huge unexplained movements in the detailed customer statement: auto-recovered refund vouchers (derived from `JV-CRF-` journals) were matched to a customer by the **shared customer control account** (`party.accountId`), so every refund was attached to the same first customer.
- Recovery now matches the customer by the **auto-serial customer code** written in the journal memo (exact name as a fallback) and **skips** refunds it cannot confidently attribute. The refund journal memo now also records the customer code.
- Recovered refunds (`crf-rec-*`) are derived data and are now rebuilt on each run, which also cleans up previously mis-attributed records.
- Files: `src/context/PlatformContext.tsx`.

# 2026-10-12

## Customer statement — accurate movements and opening balance

- Fixed the detailed customer statement pulling in unrelated movements: invoices, reception rows and journal lines are now matched to the customer by the **exact record id** or by the **auto-serial customer code only**. Removed the broad Arabic-name / system-code / paper-code substring matching that produced large unexplained debit/credit movements.
- Because the closing balance is derived as `party.balance`, the bogus movements were being absorbed into an unexplained opening balance. With accurate movements the opening balance is now meaningful.
- Files: `src/components/PartyStatementModal.tsx`.

# 2026-10-12

## Excel import now links customers by auto-serial code only

- Collection-receipt and customer-refund Excel imports now match the customer by the **auto-serial customer code only** (with optional leading-zero tolerance). Removed system-code / paper-code / file-code / Arabic-name fallbacks so imports cannot be attached to the wrong customer.
- Files: `src/views/CollectionReceiptsView.tsx`, `src/views/CustomerRefundsView.tsx`.

# 2026-10-12

## Fix undefined identifiers introduced by the statement/reconciliation refactor

- Fixed `ReferenceError: pName is not defined` in the detailed customer statement (`PartyStatementModal`): the journal-identifier list referenced `pName` after it had been renamed to `pNameNorm`. Restored a raw customer-name identifier alongside the normalized one.
- Fixed `ReferenceError: customerName is not defined` in the collection-receipt Excel validator (`CollectionReceiptsView`): the customer-name value is now parsed from the row again.
- These were runtime crashes shown as "unexpected browser exception" when opening a customer statement or importing receipts.
- Files: `src/components/PartyStatementModal.tsx`, `src/views/CollectionReceiptsView.tsx`.

# 2026-10-12

## Fix reconciliation crash + link receipts by auto-serial customer code only

- Fixed the runtime crash `ReferenceError: journalIndex is not defined`: the `journalIndex` declaration was missing in the collection-receipt reconciliation loop while still being used. Restored `const journalIndex = findCustomerReceiptJournalIndex(receipt, updatedJournals);`.
- Receipt/refund linking now uses the **auto-serial customer code only** (`customerCode`, with optional leading-zero tolerance). Removed system-code / paper-code / phone / Arabic-name / notes fallbacks in `isReceiptMatchingParty` and `isRefundMatchingParty`.
- Files: `src/utils/statementUtils.ts`, `src/context/PlatformContext.tsx`.

# 2026-10-12

## Collection Receipt Cash/Bank Account Resolution & Balance Synchronization Fix

- Resolved errors during startup hydration: `Collection receipt migration skipped: no linked cash/bank account for CR-2026-0004` through `CR-2026-0009`.
- Root cause: Collection receipt migration previously aborted if no cash or bank account was explicitly matched by ID or method label, which skipped applying the receipt credit (`customerBalanceApplied`) to the customer's ledger balance (`p.balance`). This caused a mismatch between the balance displayed in the customer select dropdown and the running/closing balance calculated from movements in the detailed statement of account.
- Implemented `resolveCashOrBankAccount` in `accountingEngine.ts` to automatically detect tenant cash/bank accounts (`1111`, `1112`, `1110`) by ID, code, payment method type, or name, with a synthesized fallback (`acc-${tenantId}-1111`).
- Decoupled customer ledger balance adjustments from journal account errors so customer dues are always credited immediately upon matching.
- Auto-provisioned account `1111` ('الخزينة الرئيسية (النقدية بالصندوق)') for all tenants during reconciliation.
- Ensured `customerCreditsMap` reduces customer balance in bulk imports even when no booked session offers are generated.
- Files: `src/services/accountingEngine.ts`, `src/context/PlatformContext.tsx`, `src/components/PartyStatementModal.tsx`.

## Customer Statement & Droplist Balance Discrepancy & Date Comparison Fix

- Fixed mismatch between the customer balance shown next to the name/code in the customer selector dropdown (`p.balance`) and the detailed movements ledger (`closingBalance`).
- Resolved string date comparison bug: dates formatted as `DD/MM/YYYY` (e.g. `11/10/2026`) were incorrectly evaluating as less than `'1970-01-01'`, causing collection receipts to be pushed into opening balance rather than appearing in the period movements table.
- Added automatic calculation of initial brought-forward balance (`initialBroughtForward`) so that customer starting balances from Excel or legacy data are honored, guaranteeing that `closingBalance` in "All" periods matches `party.balance` exactly.
- Enhanced customer matching across auto-serial codes (`21045`), system codes (`9502`), paper codes (`9502`), and normalized Arabic spelling variants, preventing receipts from being dropped or unlinked.
- Upgraded collection receipt reconciliation to resolve unlinked receipts and apply outstanding amounts to customer ledger balances so the full true balance (e.g. `-6,549.40`) is displayed.
- Files: `src/utils/statementUtils.ts`, `src/context/PlatformContext.tsx`, `src/views/CollectionReceiptsView.tsx`, `src/components/PartyStatementModal.tsx`.

# 2026-10-11

## Customer Control Account Resolution & Migration Errors Fix (1120 vs 2000)

- Fixed hydration and reconciliation errors for customer account linking and collection receipt migration (`tenant-2718`, `tenant-eg-004`, `tenant-eg-001`).
- Resolved account code confusion: updated `resolveCustomerControlAccount` and `resolveCustomerPartyAccount` in `accountingEngine.ts` to identify the true customer receivable account (`1120` / Accounts Receivable, Asset, debit-normal) rather than mistakenly enforcing account `2000` (which is standard Liabilities in the chart of accounts).
- Added auto-provisioning of `1120` control accounts for any tenant with customers in `PlatformContext.tsx`.
- Updated `PartyStatementModal.tsx` to handle shared control accounts (`1120` and `2000`) cleanly without individual memo leaks.
- Files: `src/services/accountingEngine.ts`, `src/context/PlatformContext.tsx`, `src/components/PartyStatementModal.tsx`.
 
## Detailed Customer Statement Balance Filters & Export Balances by Branch

- Added interactive balance filters to the Customer Statement (`PartyStatementModal`):
  - Filter types: All balances, Greater than (`>`), Less than (`<`), Equals (`=`), Debit balances only, Credit balances only, and Zero balances only.
  - Live count of matching customers and instant synchronization with the customer dropdown selector.
- Added comprehensive Excel export for customer balances:
  - Supports exporting the **Full Branch** or **Filtered Customers** only.
  - Columns exported: Customer Code (`كود العميل`), System Code (`كود السيستم`), Paper Code (`الكود الورقي`), Customer Name (`اسم العميل`), Phone Number (`رقم التليفون`), Balance (`الرصيد`), Balance Nature (`طبيعة الرصيد`), Coding Date (`تاريخ التكويد`), Branch Name (`الفرع`).
- Files: `src/components/PartyStatementModal.tsx`.

## Settlement View Default Today & Customer Statement Date Presentation

- Updated Customer Dues Settlement (`CustomerRefundsView`): Now defaults to showing **today's settlements only** (`today`), with quick buttons for "All" or custom date ranges.
- Refactored Detailed Customer Statement (`PartyStatementModal`):
  - Removed the branch switching toggle and the extra "show receipts outside date" warning button.
  - Receipts uploaded/migrated display the transaction date as the upload date, while any irregular or original file date is cleanly preserved in the receipt notes and description (`[تاريخ الإيصال: ...]`) along with previous notes.
- Files: `src/views/CustomerRefundsView.tsx`, `src/components/PartyStatementModal.tsx`, `src/views/CollectionReceiptsView.tsx`.

## Customer Refunds Persistence & Detailed Statement Linking

- Fixed Customer Dues Settlement (`CustomerRefundsView`) movements disappearing after page refresh: added `erp_customer_refunds` hydration from IndexedDB, mirrored persistence across both IndexedDB and localStorage, and introduced automatic journal recovery for any existing refund transactions.
- Filter improvements in `CustomerRefundsView`: defaulted date range to show all dates, added a branch toggle between active branch and all branches, and an interactive recovery button if records are hidden by active filters.
- Detailed Customer Statement (`PartyStatementModal`):
  - Robust auto-serial customer code matching (supports numerical match, leading zero variations, system code, phone, and normalized Arabic name).
  - Receipts posted with the upload date now prominently display `[تاريخ الإيصال: ...]` inside the description/notes column.
  - Linked quantity movements and package balances reflect all customer collection receipts.
  - Added branch scope toggle and notification banner when receipts exist outside the active date/branch filter.

# 2026-10-11

## Receipt linking by auto-serial customer code + reconciliation resilience

- Collection receipts are now linked to a customer using the **auto-serial customer code only** (system code / paper code / name matching removed) in both the customer statement and the receipt-to-account reconciliation.
- The reconciliation effect now resolves a missing `partyId` from `receipt.customerCode` (auto-serial) before skipping the receipt, so unlinked receipts are attached to the right customer account.
- The customer-account reconciliation effect is now wrapped in try/catch so an unexpected error no longer crashes the whole UI (the previous data is preserved and the error is logged).
- Files: `src/context/PlatformContext.tsx`, `src/components/PartyStatementModal.tsx`.

# 2026-10-11

## Import — file date no longer rejects rows (upload date is posted)

- Fixed imported collection receipts / customer refunds not appearing in the detailed customer statements. Root cause: the Excel importer rejected any row whose date was not strictly `YYYY-MM-DD`, so those rows were never recorded (and never appeared in the statement).
- The importer now accepts the row regardless of the date format: the posted date is the **upload date**, and the date written in the file is appended to the notes (`التاريخ المسجل في الملف: ...`). The date column is now optional in both importers.
- Files: `src/views/CollectionReceiptsView.tsx`, `src/views/CustomerRefundsView.tsx`.

# 2026-10-11

## Customer Refunds — Excel import + stricter manual validation

- Added Excel import (via the shared `ExcelDataTransferModal`) to the Customer Dues Settlement screen. Only **customer code (auto-serial)**, **customer name** and **value** are required; all other columns (units, unit price, service, date, payment-method code, notes) are optional and default sensibly.
- Manual refund entry now requires **service**, **units** and **value**.
- Bulk import now generates sequential refund voucher numbers (counter ref) so a batch does not reuse the same number.
- Files: `src/views/CustomerRefundsView.tsx`, `src/context/PlatformContext.tsx`.

# 2026-10-11

## New screen — Customer Dues Settlement (تسوية مستحقات عميل)

- Added a dedicated screen listing all customer refunds, defaulting to **today's refunds** and scoped to the **active branch**.
- Record a refund with refunded units, unit price and refund value (auto-computed as units × price, editable); the customer is searched by name, customer code, system code, file code, paper code or phone; the selected customer's value and quantity balances are shown before saving.
- Posting: **customer account debit / payment-method-linked account credit**, posted to the journal, chart of accounts and trial balance; the value and quantity are reflected in the customer statement.
- The refunded units reduce the customer's remaining package balance and appear as a negative quantity movement in the statement's quantity view; the refund appears as a debit movement in the value view.
- Refunds can be cancelled with a required reason (reverses the accounting effect and the customer balance) and exported to Excel.
- Files: `src/views/CustomerRefundsView.tsx` (new), `src/types.ts`, `src/context/PlatformContext.tsx`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/PartyStatementModal.tsx`.

# 2026-10-11

## Accounting — Excel export in every tab + active-branch default

- Added real Excel (.xlsx) export to Chart of Accounts, General Ledger, General Journal, Trial Balance, and Customer/Supplier Statements. Exports include the full filtered dataset (not just the visible page) with Arabic headers and sensible column widths.
- Accounting now defaults to the **active branch** instead of "All Branches"; the branch selector remains for manual switching to all branches / HQ.
- Customer/Supplier Statements opened from Accounting are now branch-scoped (only the selected branch's documents); statements opened from Parties/Suppliers keep the existing all-branch behaviour.
- New helper `src/utils/excelExport.ts` (`exportRowsToExcel`). Files: `src/views/AccountingView.tsx`, `src/components/PartyStatementModal.tsx`.

# 2026-10-11

## Performance fix — fast bulk selection in General Journal

- Fixed the UI freeze when using "Select all filtered entries" on very large filters (e.g. 40,000 entries). The freeze was caused by quadratic (O(n²)) membership checks and by resolving every selected entry's source on each render.
- Selection membership is now O(1) via a memoized `Set`; the reversible subset is resolved lazily only when the user presses "Reverse selected"; per-entry ID lists are memoized.
- Removed O(n²) lookups in `forceDeleteJournalEntries` and `reverseJournalEntries` (now use id/source maps).
- No business rule changed: reversal eligibility and source-linked protections are unchanged.
- Files: `src/views/AccountingView.tsx`, `src/context/PlatformContext.tsx`.

# 2026-10-11

## Detailed Customer Account — Receipt-linked quantity view & improved selector

- Reworked the previous standalone quantity table: the collection-receipt quantity/service data is now **linked into the existing quantity view mechanism** instead of a separate section. Receipts not already represented as an offer are merged into the offers list (product/service name + booked quantity), so they appear in the existing packages table and totals whatever the receipt source.
- Value view already records collection receipts on the credit side with description, date and cumulative running balance; verified and left intact.
- Customer selector: default is now **no customer selected**; added a search box and the dropdown is filtered by name, phone, customer code, system code, paper code, file code, and file number.
- Receipt-derived quantity rows are read-only (no session-consumption action).
- No change to the chart of accounts. Files: `src/components/PartyStatementModal.tsx`.

# 2026-10-11

## Detailed Customer Account — Collection Receipt Quantity & Service Movements

- Added a per-customer "Quantity & Service Movements from Collection Receipts" table inside the QUANTITY mode of the detailed customer account (`PartyStatementModal`).
- The table reads directly from the receipt records (service name, booked quantity, value, collection method, voucher number, date), so every collection receipt appears line by line regardless of its source (direct entry, Excel import, migration posting).
- The table respects the statement's active date-range filter and shows totals for booked quantity and value.
- No change to the chart of accounts: the journal posting (debit = payment-method account, credit = unified customer control account 2000) is untouched. This only adds the detailed-account movement view.
- Files: `src/components/PartyStatementModal.tsx`.

# 2026-10-11

## Forced Permanent Journal Deletion

- Added per-entry and bulk forced deletion from the General Journal. It intentionally bypasses accounting eligibility checks such as source linkage, period lock, posting state, and journal balance, while retaining a final confirmation and optional audit reason.
- Deleting a posted entry reverses its account balance snapshot effect before removing it from journal storage; every deleted record is retained in the audit log. Linked collection receipts are flagged to prevent automatic journal recreation.
- Forced deletion removes only accounting journal records. Source vouchers, inventory, customer/supplier statements, and other operational effects are not generally reversed; the confirmation warns about this explicitly.

# 2026-10-11

## Journal Source Details and Navigation

- Added a source action beside each General Journal entry and in unbalanced-journal review. The popup resolves exact linked receipts, payments, invoices, operation rows/expenses, maintenance, inventory audits, payroll items, and goods vouchers where source IDs exist.
- The popup opens the corresponding source module so edits/cancellation are performed by the source workflow and its accounting/operational effects remain synchronized. Text-only or unmatched source markers are identified as lacking a safe direct link.
- The popup does not hard-delete source-linked journals or documents; sources without a safe linked workflow must not be edited by changing the journal alone.

# 2026-10-11

## Journal Quick Filters and Safe Bulk Reversal

- Added General Journal filters for entry number, date range, account code/name, and debit/credit amount ranges, while keeping the existing 50-entry pagination.
- Added page-level multi-selection and per-entry reversal actions. Reversal creates a balanced posted journal in the current open period, preserves the original entry, and records a required reason in the audit/activity logs. Duplicate reversals are blocked.
- Reversal is limited to balanced, posted, unlinked manual journals. Entries tied to receipts, inventory, payroll, shifts, or other operational sources remain disabled here and must be corrected through their source workflow to avoid inconsistent downstream records. Unbalanced entries remain in the dedicated repair flow.
- No runtime ledger entries were changed by this feature; reversal occurs only after user confirmation in the application.

# 2026-10-11

## Historical Unmapped Journal Account Consolidation

- Added an explicit Trial Balance action to consolidate currently unmapped posted journal lines for the selected branch scope under tenant-level account `9999999`, named `أرصدة تاريخية مجمعة - تحت المراجعة`.
- The action preserves every line amount/date, journal header/source link, and entry balance; original account code and ID are retained as historical line metadata and shown in General Journal and General Ledger.
- The user must select the account classification and enter a reason. The account is created with a credit-normal Liability classification by default, matching the current all-branch net credit; this is a temporary reporting classification, not a determination of the missing accounts' original types.
- Closed periods, duplicate use of code `9999999`, or incompatible existing target accounts stop the operation. Bulk changes are audited and account/journal state remains tenant-scoped.
- No live browser ledger was accessed or changed by this code change; the operation runs only after an authorized user confirms it in the updated app.

# 2026-10-11

## Source-Aware Unbalanced Journal Review

- Added an Accounting header action and paginated review dialog for posted unbalanced journals, showing entry totals, difference, source references, and journal lines.
- Journal edits validate line amounts and balance, verify account tenant/branch ownership, and require a reason recorded in the audit trail. Linked cash receipt/payment journals can only be redistributed across accounts while preserving the aggregate amount on their linked vouchers; other source-linked journals are directed back to their source workflow.
- Manual journals can be corrected or logically voided. Voiding marks the entry unposted instead of deleting history, reverses its account snapshot effect, stores who/when/why, and records an audit/activity event. Closed accounting periods block both operations.
- No production/runtime journal records were available or changed. Existing unbalanced entry data must still be reviewed in the user's runtime before any source-specific correction.
- Validation: `npm run build` and `git diff --check` passed. `npm run lint` remains blocked by pre-existing TypeScript errors in PartyStatementModal, branch/tenant name fields, and unrelated staff/payroll shapes; no errors were reported on the new repair methods or dialog.

# 2026-10-11

## Chart of Accounts and General Ledger Balances from Posted Journals

- Added 50-row pagination to Chart of Accounts, journal entries, General Ledger movements, and Trial Balance to limit rendered rows until the user navigates pages.
- Chart of Accounts balances and revenue/expense summary totals are now derived from the same posted journal movements used by Trial Balance, rather than the separately stored account balance snapshots.
- General Ledger now includes only posted entries, resolves historical account references with the same tenant/branch-aware matcher as Trial Balance, and no longer adds a stored account balance as an implicit opening balance.
- These are report-time calculations only; account snapshots and historical journals are not modified. Unmapped journal lines remain reported as incomplete and excluded until safely reconciled. Pagination currently limits rendered items, not records already hydrated in the browser's local Context storage.

# 2026-10-10

## Journal Balance Validation and Trial Balance Status

- New journals are validated before posting: amounts must be finite/non-negative, a line cannot have both debit and credit, and non-empty entry totals must be equal within one piastre.
- Revenue-session posting rejects invalid amounts and collected amounts greater than revenue instead of creating a one-sided automatic journal. The reception form and Excel import show a validation error before recording the operation.
- Trial Balance now labels the report as incomplete when lines reference missing chart accounts, rather than saying journals themselves are unbalanced. Unbalanced-entry diagnostics remain separate.
- Existing journal records are not modified by the validation or status change.

# 2026-10-10

## Legacy Account References in Trial Balance

- Trial Balance now falls back from a stale journal account ID to a unique account code within the same tenant, preferring the journal branch and allowing a unique general account. Ambiguous or missing matches remain unresolved rather than being guessed.
- Legacy customer receivable codes `1120` and `1120-*` are included under account `2000` only when that tenant has a unique debit-normal Asset control account. This is report-time aggregation only; journal lines and stored account balances are not changed.
- Unmapped-line diagnostics now show total excluded debit/credit movement and group missing account IDs/codes by movement count and debit/credit totals, providing reconciliation evidence without automatically assigning a replacement account.
- The unmapped-line diagnostic keeps the true total while displaying at most 50 example lines, so large ledgers do not overwhelm the page. Successfully matched legacy lines are reported separately from actual errors.
- Customer cards and the compact table now show the linked chart account and identify missing/stale links.
- Receipt reconciliation now treats a valid posted journal ID on the receipt as authoritative even if that journal's line memo has no voucher marker, preventing another journal from being generated for the same linked receipt during hydration. Existing duplicates remain untouched pending ledger evidence.
- Runtime ledger data is not available in this workspace; this change does not claim to reconcile the user's actual balance or create adjustment entries.

# 2026-10-10

## GitHub Pages Deployment

- Added an Actions-based Pages build and deploy workflow for pushes to `main`, with pull requests running a build check and manual deployments available through `workflow_dispatch`.
- Configured Vite's production asset base for the repository Pages path (`/Universal-Business-Platform/`); local development continues to use `/`.
- Enabled repository Pages with the GitHub Actions source. The first deployment from `main` completed successfully; the live HTML, JavaScript, and CSS assets all returned HTTP 200.

## Customer Account 2000 Linking

- On storage hydration, active, coded customer profiles are linked to their unique tenant-specific chart account with code `2000`. Archived or merged profiles and supplier-only records are left unchanged; `Both` parties retain their previous supplier account in a separate link.
- Party linking does not rewrite journal entries or account balances. Legacy customer subledger consolidation only targets `2000` when it is a debit-normal Asset; missing, duplicate, or misclassified control accounts are not used as a GL fallback.
- Collection posting continues to reject account `2000` unless it is a debit-normal Asset. The bundled demo chart classifies `2000` as a Liability, so demo receipt posting remains blocked until the chart is corrected by the business owner.

## Customer Control Account and Trial Balance Reconciliation

- The Chart of Accounts no longer lists legacy generated customer subledgers individually (`acc-customer-*` IDs with `1120-*` account codes); the existing party and journal transaction data remains intact.
- Collection receipt postings now use only the exact tenant-scoped account `2000` as the receivable control account and the payment method's linked cash/bank account for the debit. Missing/duplicate/misclassified control accounts, missing payment mappings, invalid amounts, and duplicate supplied receipt reference numbers are rejected before any receipt or journal is saved.
- Removed automatic per-customer chart account creation from direct receipt posting. Existing generated customer subledgers are retired only if the journal-linked balances are reclassified to `2000`, their projected balance is zero, and no party or journal line still references them. Historical receipt credit lines are changed only when their voucher marker is unambiguous; locked periods are not modified.
- Customer receipts preserve system/customer codes for statement identity. Direct receipt vouchers are the single source of their statement movement; linked reception rows and their shared journal are suppressed to prevent duplicate customer credits. Shared account `2000` is not treated as a unique account for generic party statement matching, and existing supplier links for `Both` parties are preserved.
- Trial Balance now identifies individual unbalanced posted journals and journal lines with account IDs that cannot be resolved. Account balance synchronization matches account IDs only, preventing account-code matches from changing same-code accounts belonging to another tenant.
- Bundled demo reconciliation: one opening journal, `JV-2026-0001`, has `465,000` debit and `465,000` credit (difference `0`); all its lines resolve. The demo chart uses code `2000` for `الالتزامات (الخصوم)` as a Liability, not customer receivables. The posting guard intentionally blocks receipts against that demo account rather than silently misclassifying them.
- Runtime accounting data was unavailable, so no production/local ledger was altered and the user's actual debit-credit discrepancy cannot be quantified here. A real reconciliation needs posted journal headers/lines, account masters and balances, collection vouchers with party/system/customer codes and journal links, and period locks.
- Validation: `npm run build` passed; focused TypeScript-based accounting checks passed. Repository TypeScript checking remains blocked by existing unrelated errors, including `Branch.nameAr` diagnostics.

# 2026-10-10

## Collection Receipt Direct Accounting & Customer Quantity Crediting

- Collection receipts recorded or imported from the Collection Receipts screen are no longer routed or posted into reception shift operational sheets.
- Receipts post directly to the General Ledger and chart of accounts: the selected payment method / treasury account is debited, and the matched customer's subsidiary receivable account is credited with the receipt amount.
- Customers without a linked receivable account receive one automatically under account 1120, identified by their generated Customer Code, and the account is linked to the customer profile before posting.
- Posting reduces the customer's displayed balance by the receipt amount; existing unlocked direct receipts are reconciled once, linked to an existing customer-code subledger where available, and any unposted receipt is posted with a balanced cash/customer journal. Old shared-receivable credit lines are reclassified without duplicating their cash debit; locked periods are not changed.
- Customer statements now show only the customer's receivable credit from direct receipt journals when no voucher movement exists, while de-duplicating linked vouchers and never counting the matching cash debit against the customer.
- Trial balance rows and totals now derive from posted journal lines, avoiding parent/subaccount balance duplication; the status indicator reflects whether the posted journal balances actually balance.
- Collection receipts now require selecting or specifying the service, product/package, and booked quantity.
- Added a full manual recording modal ("تسجيل إيصال تحصيل") directly in Collection Receipts with customer lookup, payment method, service, product selection, and booked quantity.
- In Customer Account Statements (`PartyStatementModal`), collection receipts appear once as direct credit transactions, and the purchased service/product quantity is added to the customer's quantity balance under client packages and offers.
- Validation: `npm run build` passed. `npm run lint` remains blocked by existing repository-wide TypeScript diagnostics; none point to the customer account-linking or direct receipt posting changes.

# 2026-10-10

## Collection Receipt Accounting Posting

- Excel collection imports now post date-grouped journal entries debiting each linked payment-method account and crediting the matched customer's receivable account, including when no reception shift is open.
- Imported shift rows are added in one batch as receipt-only (`totalRevenue: 0`) and linked to the voucher journal, so they do not post duplicate cash or revenue.
- Added a branch-scoped action to post eligible legacy vouchers/run rows without journals using each receipt's original date; already-posted and period-locked records are skipped to prevent duplicates or date-lock violations.
- Cash receipt records now persist in IndexedDB with legacy data hydration for larger receipt histories.
- Validation: `npm run build` and `git diff --check` passed; Vite reports the existing large-chunk warning. TypeScript checking still reports existing unrelated repository errors; no diagnostics point to these receipt changes.

# 2026-10-10

## Collection Receipt Filtering, Selection, and Archive

- Added per-column filters across collection receipt details, including status, branch, customer identifiers, shift, method, amount, and descriptions.
- Added select-all for filtered results, bulk archiving, and active/archived/all receipt views. Archived status is stored on the receipt run row without changing its accounting or shift totals.
- Added a separate branch-name column to the receipt table.
- Validation: `npm run build` and `git diff --check` passed; Vite reports the existing large-chunk warning.

# 2026-10-10

## Reception Shift Storage Quota

- Moved reception shift and run-row persistence from the `erp_reception_shifts` localStorage value to IndexedDB.
- Startup merges IndexedDB shifts by ID with legacy localStorage shifts, and IndexedDB write failures are logged without throwing from the UI.
- Corrected the persistence effect placement so it only references reception-shift state after that state is initialized, preventing a startup exception.

# 2026-10-10

## Accounting Journal Storage Quota

- Moved accounting journal persistence from a single `localStorage` JSON value to IndexedDB to avoid `QuotaExceededError` as journal history grows.
- Startup loads IndexedDB journals and merges them by ID with any legacy localStorage journals, preserving both sets during migration.
- Failed IndexedDB writes no longer crash the UI; current records remain in memory and the failure is logged.

# 2026-10-10

## Collection Receipt Excel Save Error

- Fixed `params.totalRevenue.toFixed is not a function` when importing collection receipts. Excel or persisted values may be numeric strings, so the accounting journal builder now converts revenue and collected amounts to finite numbers before rounding.
- Collection import also explicitly converts the collected amount before passing it into operating shift rows.
- Validation: `npm run build` passed. Vite reports the existing large-chunk warning.

# 2026-10-10

## Customer Coding Review, Bulk Actions, and Non-destructive Merge

### Request and implementation

- Added a Customer Coding Review modal and moved the existing duplicate review entry point into it.
- Added customer search across stored profile fields, branch, status, customer/system/file code, phone, and created-date filters; results support select all and bulk actions.
- Added bulk archive and guarded permanent delete. Deletion skips customers with prior collections or revenues.
- Added primary-file selection and merge-note capture. Source profiles are archived and linked to the primary profile. No appointment, follow-up, receipt, invoice, or operation row is rewritten; primary-profile booking/follow-up history reads include linked source file IDs.
- Excluded archived and merged profiles from customer selection in Bookings and Reception Operations.
- Follow-up filter refinement: branch and status filters now allow multiple selections; the customer-code, system-code, and file-code filters are separate multi-select dropdowns populated from registered customer records. Code choices refresh to match selected branches. Added a dedicated “Review Customer Duplicates” section heading.
- Added an in-list search field to every multi-select dropdown. “Select all” now applies to the options currently visible after searching, while keeping selected values outside the search results intact.
- Added a Customer Management status filter for all, active, or archived customers. Permanently deleted customer records are not retained or listed; permanent deletion behavior remains unchanged.
- Fixed bulk permanent deletion for large selections: only prior financial collections/revenues block deletion, and the customer records are removed in one state update with one consolidated audit/activity entry rather than one update per customer.
- Fixed merged-customer detailed history lookup to resolve merged links in both directions and include legacy bookings/follow-ups matched by a linked profile's name, phone, or customer/system/file code. Historical rows remain unchanged.
- Detailed history search now lists active customers only. Legacy matches from appointments/follow-ups resolve through merged sources to the active primary profile and do not show archived sources as separate customers.
- Added a system-code duplicate merge action in Customer Coding Review. It groups active customers by normalized System Code, requires the user to choose one primary file per group, then archives source files and applies all group links in one state update without rewriting historical transactions.

### Files

- `src/types.ts`
- `src/context/PlatformContext.tsx`
- `src/views/PartiesView.tsx`
- `src/views/BookingsFollowUpView.tsx`
- `src/views/ReceptionOpsView.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Decisions and limitation

- A merge is a profile relationship for future use and consolidated booking/follow-up display. Historical transaction rows retain their original customer IDs and details.
- Customer lifecycle persistence is currently local state/local storage and IndexedDB. Existing Neon services do not provide a party update/delete lifecycle operation, so no Neon database write is performed by these actions.

### Validation

- `npm run build` passed. Vite reports the existing large-chunk warning.
- `npx tsc --noEmit` remains blocked by existing repository-wide errors, including pre-existing `PartiesView.tsx` context/call-signature diagnostics. No diagnostics point to the new coding review, merge, archive, or protected delete logic.
- `git diff --check` passed.

This file records important project development events, decisions, and changes.

It is intended to help future AI agents understand how the project evolved.

---

# 2026-10-08

## Customer Codes and Validation for Collection Receipt Excel

- Added the customer's serialized Customer Code before their name in the Collection Receipts history and added Customer Code and Payment Method Code columns to the import/export workbook.
- Collection import checks customer codes against active and archived customer records, payment method codes against Payment Methods, and collection dates against the local current date.
- Validation errors appear before confirmation; the existing explicit force-upload option allows uploading entered values as-is with errors.
- Imported receipts link to the matched customer and use the registered method category for cash receipt posting.
- Validation was not run.

## Same-Branch Customer Duplicate Warning and Review

### Request and implementation

- Added duplicate warnings to quick customer creation for same-branch name or phone similarity >=80%, exact System Code, or exact File Code / legacy paper code.
- Quick creation generates a Customer Code through the existing addParty serial generator, assigns the active branch, and immediately selects the new customer for the booking. Staff can instead select a suggested existing customer or explicitly continue creating a new one.
- Added a Customer Management review action with a required date range; it reviews names only for coded customers created in that period against customers in the same branch. The 80% similarity check stops early when a pair cannot meet the threshold.
- Added the same pre-save duplicate warning to the Customer Management Add Customer flow, with an explicit confirmation option to continue creating a new customer.
- Changed the date-range review to run only after clicking Review Results. Customer indexing and matching yield between batches, and large result sets render incrementally.
- Optimized candidate retrieval using the rarest bigrams guaranteed by the 80% name similarity threshold, removed phone and code matching from the date-range review, avoided processing in-range pairs twice, and added bounded early-exit distance checks.
- The shared matcher uses normalized Levenshtein similarity plus branch-scoped indexes to avoid comparing every record against every other record.

### Files

- `src/utils/customerDuplicateDetection.ts`
- `src/views/BookingsFollowUpView.tsx`
- `src/views/PartiesView.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Validation

- npm run build passed; Vite reported the existing large-chunk warning.
- npm run lint remains blocked by existing repository-wide TypeScript errors. The focused diagnostics contain no new errors in the duplicate matcher; PartiesView has pre-existing context and call-signature errors.

### Remaining limitation

- The selected review period filters by customer createdAt; the Party model has no separate coding timestamp.

## Detailed Customer Identifiers in Booking and Follow-up History

### Request and implementation

- Aligned both detailed history tables so each row displays Customer Code, System Code, File Code (the customer record file identifier), branch, and its date in the matching column. The profile summary uses the same linked customer fields.
- Resolved the branch name from the linked customer's branch assignment rather than displaying a branch ID or active-branch fallback.
- Preserved booking and follow-up rows and their existing actions.
- Removed horizontal scrolling from both detailed history tables; fixed-width column proportions, compact spacing, and wrapped text keep all columns inside the available screen width.

### Files

- `src/views/BookingsFollowUpView.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Validation

- `npm run build` passed (Vite reported the existing large-chunk warning). `npm run lint` remains blocked by existing repository-wide TypeScript errors; no new diagnostic points to the detailed history changes.


## Restore the Booking Table Vertical Scrollbar

### Request and implementation

- Restored a 72vh vertical scroll area to the main Booking Management agenda table while keeping the fixed-width columns and hiding horizontal overflow.
- Restored sticky table headers and connected the existing top/bottom shortcuts to the internal table scroll area.

### Files

- `src/views/BookingsFollowUpView.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Validation

- `npm run build` - passed (Vite reported the existing large-chunk warning).

## Booking Identifiers Match Customer Management

### Request and implementation

- Booking Management Customer Code now comes from the linked customer's serialized Customer Code; System Code comes from that customer's System Code; File Code comes from that customer's File Code.
- Applied customer-record-first resolution to agenda and follow-up displays, booking edit fields, new booking creation, and booking/follow-up Excel exports. Booking row values remain as fallback only when a customer record cannot supply the field.
- Preserved booking actions and existing unrelated data.

### Files

- `src/context/PlatformContext.tsx`
- `src/views/BookingsFollowUpView.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Validation

- `npm run build` - passed.
- `npm run lint` (`tsc --noEmit`) still fails on existing repository-wide type errors.

## Customer Serial Display and Booking Table Fit

### Request and implementation

- Ensure the serialized Customer Code appears in Customer Management and remains independent from System Code. On local storage, IndexedDB hydration, and cross-tab updates, preserve valid unique numeric serials and assign a unique next serial only to missing, invalid, duplicate, or System Code-matching values.
- Booking edit, detail, agenda, next-day, follow-up, and Excel export views now resolve Customer Code from the linked Party first. Non-numeric codes and values matching System Code are excluded from Customer Code display. System Code display now uses the linked Party's System Code first.
- Converted the main Booking Management agenda to fixed-width columns that wrap within the available width, removed table overflow scrolling, and compacted cells/actions to keep the full table width visible.
- Fixed the missing fallback cash-supplier reference so existing local customer records load and normalize instead of falling back to sample data.
- Left date-independent Add New Booking and New Follow-up actions unchanged.

### Files

- `src/context/PlatformContext.tsx`
- `src/views/BookingsFollowUpView.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Validation

- `npm run build` - passed. `npm run lint` (`tsc --noEmit`) - failed with existing repository-wide type errors; no errors were reported at the new Customer Code resolver or normalization lines.

## Booking Management Table Readability

### Request and implementation

- Renamed the Booking Management agenda's application code header to "Customer Code" in Arabic and English.
- Removed the agenda table's fixed-height internal vertical scrolling so the table expands in normal page flow. Updated its top/bottom shortcuts to scroll the page and removed the now-unneeded sticky header behavior.
- Kept horizontal overflow behavior for narrow screens and left booking row actions unchanged.

### Files

- `src/views/BookingsFollowUpView.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Validation

- `npm run build` - passed (Vite production build).

## Customer Code Integrity, Follow-up Table, and Booking Navigation

### Request

- Make numeric Customer Codes sequential and independent from System Codes across customer creation, editing, search, related booking/follow-up workflows, and Excel import/export.
- Remove the rendered Responsible / Assigned To (Created By) column from follow-up tables without deleting record data.
- Remove application-provided new-tab actions for Booking Management while preserving normal navigation and date-independent customer booking actions.

### Implementation

- Added collision-aware Customer Code allocation based on existing numeric identifiers, with an in-memory sequence reservation to protect rapid creates and bulk imports. Bulk imports validate supplied Customer Codes as positive numeric serials, avoid duplicates against stored and in-batch values, and return the assigned codes for linked booking/follow-up rows.
- Kept System Code generation and storage separate. Customer imports no longer resolve the Customer Code field through System Code aliases; booking/follow-up imports match Customer Codes through the Customer Code index and retain System Code separately.
- Added Customer Code and System Code as separate columns in the direct customer CSV export; the existing Excel transfer export already maps both.
- Removed Created By cells and headers from the main follow-up table and the patient follow-up history table. The `createdBy` property remains in records and transfer data.
- Removed the Booking Management heading's explicit `window.open`/new-tab link behavior, removed the global context menu's Booking Management quick-open action, and excluded the sidebar new-tab affordance for bookings. The global context menu now lets the browser handle right-clicks while Bookings Management is active.
- Preserved the past/today booking row actions and their handlers without adding date-based blocking.

### Files

- `src/context/PlatformContext.tsx`
- `src/views/PartiesView.tsx`
- `src/views/BookingsFollowUpView.tsx`
- `src/components/GlobalContextMenu.tsx`
- `src/components/Sidebar.tsx`
- `PROJECT_STATE.md`

### Decisions

- Kept the current `Party.customerCode` / `Party.systemCode` data model; no database migration or identifier reset was introduced.
- Existing numeric Customer Codes are preserved. New assignments begin after the highest known serial and skip occupied values; duplicate or invalid imported codes receive the next available serial.
- System Code remains the separate identifier used by existing business workflows.

### Testing

- `npm run build` — passed.
- `npm run lint` (`tsc --noEmit`) — failed because of numerous existing repository-wide type errors, including unrelated modules and pre-existing errors elsewhere in the touched files. No new errors were reported in the changed Customer Code generator/import/export paths.
- `git diff --check` — passed.
- Source inspection confirmed the past/today Add New Booking and New Follow-up actions remain rendered and callable.

### Result

Requested Customer Code, follow-up table, and Booking Management navigation changes are implemented. No database operations were run.

## Bugfix: Resolve "TypeError: Illegal constructor" in Edit Customer Modal

### Cause
In `src/views/PartiesView.tsx`, the `<Lock />` component was used in both the Add Customer and Edit Customer modals. However, `Lock` had not been added to the `lucide-react` import statement at the top of `PartiesView.tsx`. In web browsers, `window.Lock` is an internal Web Locks API constructor (`Web Locks API - Lock interface`). When React attempted to instantiate `<Lock ... />`, it tried to call `new window.Lock(...)` as an JSX component, which throws a native `TypeError: Illegal constructor`.

### Resolution
- Added `Lock` to the `lucide-react` import list in `src/views/PartiesView.tsx`.
- Successfully compiled the applet and verified that the Edit Customer modal opens smoothly without errors.

---

## Customer Identifiers Unification (Branch, App Code, System Code, File Code) & Full Lifecycle Locking

### Purpose
Completed user requirements regarding customer identification consistency across Customer Management, Bookings, Follow-ups, and Excel imports/exports:
- **Branch Name (`اسم الفرع`)**: Displayed consistently across client directory, booking agenda, follow-ups agenda, and Excel files.
- **Customer Code (`كود العميل (التطبيق)`)**: Serves as the primary immutable application code (`C-XXXXX`), automatically generated and serialized in sequence (`getNextCustomerAppCode`). Users cannot manually modify or disrupt this sequence. Serves as the foundational relationship key linking customer lifecycle, transactions, and appointments.
- **System Code (`كود السيستم`)**: Renamed from previous "Paper Code", retaining all existing entered data (`CUST-XXXX` / `BR-XXXX` or user code).
- **File Code (`كود الملف`)**: Manually entered during customer onboarding or editing. If left blank during coding, an automatic fallback checkbox allows adopting the serialized customer app code directly as the file code.
- **Locked Inputs in Booking & Follow-Up Screens**: All customer creation and core code inputs are strictly locked in Bookings and Follow-ups modals/tables with navigation shortcuts to Customer Management, guaranteeing that Customer Management is the sole authoritative entry point.
- **Excel Transfer & Validation Integration**: Added and synchronized Branch Name, Customer Code, System Code, and File Code across Excel column templates, validator checks, and export mappings for both Bookings and Follow-ups.

---

## Shared AI Development System Initialized

### Purpose

Started establishing a shared AI development and project-memory system for the Universal Business Platform.

The goal is to allow multiple AI development tools to work on the same GitHub repository while maintaining consistent project knowledge.

Target AI tools:

- Google AI Studio
- OpenAI Codex
- Claude Code
- GitHub Copilot

### Shared Memory Files

Created the following project-memory files:

- `MASTER_AI_INSTRUCTIONS.md`
- `AI_CONTEXT.md`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

Also created:

- `.github/copilot-instructions.md`

### Working Model

The repository is intended to become the shared source of truth.

AI agents should not depend on another AI product's private chat history.

Important project knowledge should be preserved in repository documentation.

---

## AI Change Approval Policy

The project does not prohibit AI agents from modifying core files.

Agents may modify any file required to complete the user's explicit request.

However, if an agent discovers a significant additional change that is outside the requested task, it must stop before making that additional change and request approval from the project owner.

The agent must explain:

- What it wants to change.
- Why.
- Which files/systems are affected.
- Expected impact.
- Possible alternatives.

The project owner then decides whether the additional change should proceed.

---

## Master Instructions Policy

`MASTER_AI_INSTRUCTIONS.md` is controlled by the project owner.

AI agents must not independently rewrite, weaken, or remove its rules.

The file may be changed when the project owner explicitly requests or approves the change.

---

## Project Architecture Notes

Current major stack:

- TypeScript
- React 19
- Vite
- Tailwind CSS
- Node.js 22 LTS
- Neon PostgreSQL
- React Context
- Multi-tenant business architecture
- Arabic and English
- RTL and LTR
- Responsive desktop/tablet/mobile interface

Important application areas include:

- POS
- Accounting
- Inventory
- Products
- Invoices
- Parties
- Suppliers
- Companies
- Branches
- Warehouses
- Users and Roles
- Bookings
- Follow-up
- Clinics
- Staff
- Payroll
- Attendance
- Fiscal documents
- Cash operations
- Notifications
- Audit trail
- System manual
- Neon/database management

---

## Existing Performance Concern

A previous large-data issue was identified when importing approximately 10,000 customers.

The browser could become blank or unresponsive.

Future implementations involving large datasets should use appropriate database-side processing, pagination, batching, filtering, sorting, incremental loading, and efficient rendering where appropriate.

---

## Git / Repository Notes

The project currently has a local development repository and a GitHub remote.

The repository should be treated as the shared source of truth for cross-agent development.

Destructive Git operations and history rewriting should not be performed without explicit authorization.

---

## Codex Setup and Repository Inspection

### Request

Record the Codex shared-AI setup and the repository structure inspection.

### Implementation

- Codex has been successfully installed and authenticated.
- Created root `AGENTS.md`, instructing Codex to read `MASTER_AI_INSTRUCTIONS.md`, `AI_CONTEXT.md`, `PROJECT_STATE.md`, and `CHANGELOG.md`.
- Inspected the repository structure without modifying application code.
- Confirmed entry points at `src/main.tsx` and `src/App.tsx`; shared platform state in `src/context/PlatformContext.tsx`; and main services in `src/services/accountingEngine.ts` and `src/services/neonService.ts`.
- Confirmed Neon integration in `src/services/neonService.ts`, `scripts/neon_schema_migrations.sql`, and `src/views/NeonHubView.tsx`.
- Identified large-data-sensitive areas in `PlatformContext.tsx`, `BookingsFollowUpView.tsx`, `PartiesView.tsx`, and `src/utils/fullDatabaseExcelBackup.ts`.
- No application files were modified during the inspection.

### Files

- `AGENTS.md` (created earlier)
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Testing

- Read-only repository structure inspection; no application tests were run because no application code changed.

### Result

Codex setup and repository structure notes are recorded for future shared-AI handoffs.

---
## Future Entries

Future significant changes should be added using this general structure:

### Date

## Change Title

### Request

What the user asked for.

### Implementation

What was changed.

### Files

Important files changed.

### Decisions

Important technical or business decisions.

### Testing

Tests and validation performed.

### Result

Current outcome.

### Follow-up

Remaining work or recommended next step.
