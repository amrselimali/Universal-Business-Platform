# PROJECT STATE

## Import date handling fix — 2026-10-11

- Imported collection receipts and refunds were being dropped when the file date was not `YYYY-MM-DD`, so they never showed in the detailed customer statements.
- Now the importer posts with the upload date and keeps the file date in the notes; the date column is optional in both importers.
- Files: `src/views/CollectionReceiptsView.tsx`, `src/views/CustomerRefundsView.tsx`. Validation: tsc error count unchanged (126 pre-existing); vite build ok.

## Customer Refunds — Excel import + stricter manual validation — 2026-10-11

- The Customer Dues Settlement screen now supports Excel import. Required columns: customer code (auto-serial), customer name, value; everything else is optional.
- Manual entry requires service + units + value.
- Added `customerRefundNumberCounter` so bulk-imported refunds get unique sequential voucher numbers.
- Validation: tsc error count unchanged (126 pre-existing); vite build succeeded.

## New screen — Customer Dues Settlement — 2026-10-11

- New view `CustomerRefundsView` (sidebar: "تسوية مستحقات عميل") lists customer refunds, defaults to today and filters by the active branch; supports customer search by name/customer code/system code/file code/paper code/phone and shows the selected customer's value + quantity balances.
- New type `CustomerRefundVoucher`; context adds `allCustomerRefunds`, `customerRefunds`, `addCustomerRefund`, `cancelCustomerRefund`.
- Posting rule: customer account **debit** / payment-method-linked account **credit**; posts to journal, COA and trial balance; reflected in the customer statement (value debit + negative quantity movement); refunded units reduce the customer's remaining package balance.
- Validation: tsc error count unchanged (126 pre-existing); vite build succeeded.

## Accounting — Excel export + active-branch default — 2026-10-11

- Excel (.xlsx) export buttons added to all five accounting areas (COA, General Ledger, General Journal, Trial Balance, Customer/Supplier Statements). Each exports the full filtered dataset with Arabic headers.
- `selectedBranchId` now defaults to the active branch (`activeBranch.id`); manual switching to all-branches/HQ is still available.
- `PartyStatementModal` gained an optional `branchId` prop; when opened from Accounting it is branch-scoped, otherwise it keeps the previous all-branch behaviour.
- New util: `src/utils/excelExport.ts`. Validation: tsc error count unchanged (126 pre-existing), vite build ok.

## Performance fix — fast bulk selection in General Journal — 2026-10-11

- "Select all filtered entries" no longer freezes the app on large filters. Root cause: O(n²) `includes` checks over up to 40k selected ids, plus resolving each selected entry's source on every render.
- Fixes: memoized selection `Set` (O(1) membership), lazy reversible-subset resolution on action, memoized id lists, and O(n²)→O(n) maps in `forceDeleteJournalEntries`/`reverseJournalEntries`.
- Behaviour/eligibility rules unchanged. Files: `src/views/AccountingView.tsx`, `src/context/PlatformContext.tsx`. Validation: tsc error count unchanged (126 pre-existing), vite build ok.

## Detailed Customer Account — Receipt-linked quantity view & improved selector — 2026-10-11

- Quantity view (QUANTITY mode) now links collection-receipt data (product/service name + booked quantity) into its existing offers/packages mechanism; the earlier standalone table was removed. Receipts already represented as offers are de-duplicated by voucher number.
- Value view records collection receipts as credit movements with service description, date and cumulative running balance (already present; verified).
- Customer selector defaults to no selection and supports search by name, phone, customer code, system code, paper code, file code and file number.
- Chart of accounts untouched. Files: `src/components/PartyStatementModal.tsx`. Validation: tsc error count unchanged (126 pre-existing), vite build succeeded.

## Detailed Customer Account — Collection Receipt Quantity & Service Movements — 2026-10-11

- Collection receipts now appear line by line in the detailed customer account (`PartyStatementModal`, QUANTITY mode) as a dedicated "Quantity & Service Movements" table: date, voucher number, service, booked quantity, value, and collection method, plus totals.
- The table is built directly from the receipt records, so it shows receipts from every source (direct entry, Excel import, migration posting) and honours the statement's date-range filter.
- The chart of accounts is deliberately unchanged: the journal entry still debits the payment-method-linked account and credits the unified customer control account `2000`. The detailed customer account is a separate, per-customer movement view and does not alter the consolidation design.
- Decision: the "customer account" the owner referred to is the detailed/statement account (identified by the auto-serial customer code), not a per-customer chart-of-accounts account. No change to customer account consolidation was made.
- Files: `src/components/PartyStatementModal.tsx`. Validation: `tsc --noEmit` error count unchanged (126 pre-existing) and `vite build` succeeded.

## Forced Permanent Journal Deletion — 2026-10-11

- General Journal now offers a forced permanent delete action for one or multiple entries. After explicit confirmation it bypasses accounting eligibility checks, including source link, period lock, posted state, and balance. A deletion reason is optional; the deleted entry itself and actor/action are recorded in audit/activity logs.
- If the entry was posted, its account snapshot effect is reversed before removing it from journal storage. Exact-linked collection receipts receive a persisted `journalPostingSuppressed` flag so receipt hydration does not recreate the deleted entry.
- This is deliberately a journal-only destructive override. It does not remove source vouchers or reverse unrelated inventory/customer/supplier/operational effects; the confirmation explains that impact. Use only when the user accepts that source and journal data may diverge.
- The override still enforces tenant ownership and requires an explicit final confirmation. Runtime data is modified only when the user confirms the action in the app.

## Journal Source Details and Navigation — 2026-10-11

- General Journal and the unbalanced-entry review now provide a source button that opens a popup with source-specific records and key details, including receipt/payment vouchers, invoices, shift operation rows and expenses, maintenance, inventory audits, payroll items, and goods receipts/issues.
- Each linked record can launch its owning module using the app's existing navigation event. This directs the user to the source workflow, where source edits/cancellations must be applied so their journal/accounting and operational effects remain aligned.
- Source matches use exact stored journal IDs. Text-only or unmatched markers show that no reliable source record can be opened; the journal remains protected from direct mutation.
- This change adds source resolution/navigation, not a universal in-popup source editor or deletion API. The source modules retain responsibility for source-specific correction rules; no source or journal data is changed by opening the popup.

## Journal Quick Filters and Safe Bulk Reversal — 2026-10-11

- General Journal now filters entries by number, date range, account code/name, and debit/credit total ranges. Results retain 50-entry pagination.
- Users can select reversible entries on the current page or reverse one entry directly. Confirming posts an equal-and-opposite journal dated in the current open period, retains the original, and writes an audit/activity record with the required reason. The full batch is validated before any selected entry is applied, and an entry already reversed is blocked.
- To preserve source consistency, reversal is enabled only for balanced, posted, source-free manual journals. Source-linked receipts, inventory, payroll, shift, and other operational entries must be corrected from their source workflow; unbalanced journals remain in the existing dedicated correction flow.
- This is a client-side filter over the journal data already hydrated into Context/local storage, not a server-side database query. No live/runtime journal records were modified.

## Historical Unmapped Account Consolidation — 2026-10-11

- In Trial Balance, users can explicitly consolidate all unresolved lines in the selected branch scope into the tenant-wide temporary account `9999999` (`أرصدة تاريخية مجمعة - تحت المراجعة`).
- Existing posted journal lines are reassigned to this account without changing amount, date, source voucher link, or debit/credit totals. Their original account ID/code are retained on each line and displayed in General Journal and General Ledger.
- The confirmation requires a reason and lets the user choose the account type. The suggested/default type is credit-normal Liability because the current all-branch unresolved movement has a net credit; this is only a temporary classification, not a verified classification of the old accounts.
- Operation is blocked for locked periods, duplicate code 9999999, or an existing account not matching the dedicated consolidation account. It is scoped to the active tenant and selected branch report; audit/activity logs record aggregate counts and totals.
- The live/local browser ledger is not available to this workspace; no runtime journal/account data has been changed. An authorized user must run the confirmation on the updated application.

## Source-Aware Unbalanced Journal Review — 2026-10-11

- Accounting now has a paginated control to review posted unbalanced entries, inspect their debit/credit lines, source references, and differences.
- A journal repair records an audit/activity reason, validates a balanced replacement, and enforces account ownership for the same tenant/branch. Linked cash receipt/payment journals are editable only when the resulting debit total still equals the linked voucher total; source voucher data and customer/supplier statement movements remain unchanged.
- Unlinked manual journals can be corrected or logically voided (unposted, retained in history, account snapshot reversed, and void reason/user/time recorded). Period locks prevent repair and void.
- Journals linked to other operational records or with text-only/ambiguous source markers are read-only in this screen; they must be updated through their source workflow so inventory, payroll, shift, invoice, maintenance, or other downstream effects are not orphaned.
- The real runtime ledger remains unavailable in this workspace, so no live entries were inspected or modified. The new screen surfaces runtime sources when the user opens the app; unsupported source kinds need their source-specific correction workflow.

## Legacy Account Matching and Customer Account Display

- Accounting's Chart of Accounts, general journal entries, General Ledger movements, and Trial Balance tables now render at most 50 rows/entries per page with explicit navigation. Filtering/branch changes reset the relevant page. This is client-side render pagination: the current Context/local storage data source still hydrates the underlying arrays in memory; it does not yet fetch pages from Neon.
- Chart of Accounts displayed balances, revenue/expense summary values, Trial Balance, and General Ledger are now based exclusively on posted journal lines. The chart-account master still supplies account names/codes/types, but stored `account.balance` snapshots are not used as report balances or implicit opening balances.
- General Ledger applies the same tenant/branch-aware account ID/code resolver as Trial Balance and excludes unposted journals; this keeps the customer-control account's chart balance, trial-balance amount, and ledger movements consistent. Existing account snapshots/journals are unchanged.
- Trial Balance status distinguishes genuinely unbalanced posted entries from a numerically incomplete report caused by unmapped lines. The latter explicitly says that zero unbalanced entries does not mean all account activity is included.
- New journal posting paths validate finite, non-negative debit/credit amounts, prohibit both sides on one line, and require a non-empty entry with equal debit/credit totals before it can be built or posted. This does not rewrite existing journals.
- Revenue-session posting now rejects non-finite/negative amounts and collections greater than the session's revenue. Such over-collections require an approved customer-advance account/rule that is not defined in the current chart; collection forms and Excel import report the issue before saving.
- Trial Balance resolves journal lines by exact account ID first, then by a unique tenant-scoped account code, preferring the journal's branch account and falling back only to a unique general account.
- Legacy customer receivable lines using `1120` or `1120-*` are included under account `2000` only when the tenant has exactly one valid debit-normal Asset control account. No journal records or account balances are rewritten by this report-time mapping.
- Unresolved lines remain excluded and diagnosed; only the first 50 details are rendered while the total unresolved count remains visible, preventing a large legacy dataset from overwhelming the screen.
- Trial Balance diagnostics also summarize unresolved lines by their historical account ID/code, showing movement count and debit/credit totals so missing-account mappings can be reviewed without guessing or editing the ledger.
- Customer cards and the compact customer table now display each party's linked chart account, or explicitly show when the stored account link is missing or cannot be resolved.
- Receipt reconciliation now honors a valid posted journal ID linked to the receipt even when its journal-line memo lacks the receipt number. This prevents the hydration repair from creating a second journal for an already-linked receipt. Existing historical duplicate journals are not deleted or netted automatically.
- Runtime/localStorage ledgers are not present in this workspace. The updated report can identify unresolved lines and show the recalculated balances when run with the user's data, but does not claim to have reconciled or changed those real records.

## Last Updated

2026-10-10

## Project

Universal Business Platform

## GitHub Pages Deployment — 2026-10-10

- The repository's Pages settings were confirmed disabled, which explained why merged changes were not appearing on the live site; there had been no existing deployment workflows or recorded deployments.
- Added `.github/workflows/deploy-pages.yml`: pull requests to `main` build and validate the static app; pushes to `main` and manual workflow dispatch build and deploy the site to GitHub Pages using Bun's frozen lockfile.
- Vite uses `/Universal-Business-Platform/` as the Pages production base path and `/` for local development.
- Enabled GitHub Pages using the GitHub Actions source. The workflow's first production deployment on `main` completed successfully at commit `5fe03034cc5ba18118a3be5887e4c50c460940ca`.
- Verified the live site at `https://amrselimali.github.io/Universal-Business-Platform/` and confirmed its HTML, JavaScript, and CSS assets return HTTP 200.

## Customer Control Account and Trial Balance Diagnostics — 2026-10-10

- The Chart of Accounts view hides legacy generated customer subledger accounts (`acc-customer-*` with `1120-*` codes), so customers are not listed individually in the chart; transaction records and journal lines are not deleted by this display filter.
- After storage hydration, active coded `Customer` and `Both` profiles are linked to the unique account code `2000` in their tenant, without changing their balances or journal history. Archived/merged customers are excluded; `Both` profiles retain their previous supplier account in `supplierAccountId`, used by supplier postings and statements. Missing or duplicate `2000` accounts are logged and left unchanged.
- Direct collection receipts now post a debit to the selected payment method's exact tenant-scoped cash/bank account and a credit to the exact tenant-scoped account code `2000`. Posting is rejected when code `2000` is missing, duplicated, or not a debit-normal Asset, or when the payment method has no valid linked cash/bank Asset account.
- New receipts no longer create `1120-<customerCode>` subsidiary accounts. Existing subledger consolidation targets `2000` only when it is a debit-normal Asset; historical receipt journal credits are reclassified only when the voucher number is explicitly present on the credit-line memo. Generated customer subledgers are removed only when their projected balance is zero and no journal line or party still references them. Locked periods and unidentifiable journal lines are left untouched.
- Customer party links are pointed to control account `2000` without replacing a `Both` party's existing supplier payable link. Receipt vouchers now retain `systemCode` and customer code; customer statements show receipt movements from the voucher once, suppress linked shift-row and journal duplicates, and avoid treating shared account `2000` as a unique party ledger.
- The trial-balance screen now lists posted unbalanced journal entries with debit/credit totals and their difference, and resolves lines by account ID or unique tenant/branch-scoped code. Legacy `1120` customer lines are grouped under `2000` only when that account is a valid debit-normal Asset. Unresolved journal lines remain visible in diagnostics. Account balance synchronization uses account IDs only to avoid applying same-code movements across tenants.
- Repository demo reconciliation: its sole posted opening entry (`JV-2026-0001`) has debit `465,000`, credit `465,000`, difference `0`, and no unresolved accounts. However, the bundled demo account `2000` is `الالتزامات (الخصوم)` with type `Liability`, not a customer receivable Asset. The demo data is therefore correctly rejected by the new collection posting guard; no demo or user ledger was rewritten to hide this chart conflict.
- Runtime/localStorage accounting data is not available in this workspace. To calculate the user's actual trial-balance difference and safely assess all historical entries, export posted journal entries with their lines (`tenantId`, `branchId`, entry number/date/source, line account ID/code, debit, credit, memo), the matching account master (`id`, tenant, branch, code, name, type, normal balance, parent, current balance), and collection vouchers (`partyId`, system/customer code, voucher/reference number, amount/date, journal ID) plus applicable period locks.
- Validation: production build passed. Focused accounting-engine checks confirmed balanced posting, tenant/type isolation, and rejection of an unlinked payment account. TypeScript checking still reports pre-existing unrelated errors, including missing `Branch.nameAr` references. No runtime ledger export or migration was run.

## Repository

Universal-Business-Platform

## Current Development Status

The project is an actively developed React/TypeScript business platform.

The application currently contains multiple operational, financial, inventory, medical/service, staff, payroll, booking, fiscal, notification, and administration modules.

The project is being developed toward a cloud-native architecture using Neon PostgreSQL.

## Collection Receipt Direct Accounting & Customer Quantity Crediting — 2026-10-10

- Collection receipts recorded or imported from the Collection Receipts screen now bypass reception shift run sheets entirely (`receptionShifts` remain unaffected) and post directly to the General Ledger and chart of accounts.
- Journal entries debit the selected payment-method account and credit the customer's own subsidiary receivable account by the receipt amount.
- If a customer has no linked account, posting creates a receivable subaccount beneath account 1120, identifies it with the generated Customer Code, and links it to the customer profile before creating journal lines.
- Receipt posting credits the Party balance snapshot. On first hydration, existing unlocked direct receipt vouchers are reconciled once, linked to existing customer-code subledgers where available, and any missing journal is created as a balanced cash/customer entry; any existing voucher-linked journal credit still on shared account 1120 is reclassified without adding another cash debit. Locked periods are not modified.
- Customer statements include only the customer's receivable credit from a direct collection journal if its voucher movement is missing, and suppress duplicates when the voucher is present; the matching cash debit is never counted as a customer movement.
- Trial balance rows and totals are derived from posted journal entries, avoiding double-counting parent and subsidiary account balances; the balanced status compares actual posted debits and credits.
- Collection receipts now require/support selecting the service, product/package, and booked quantity (`serviceName`, `productId`, `productName`, `bookedQuantity`).
- Added a dedicated "Record Collection Receipt" modal in Collection Receipts view, allowing direct entry of customer, amount, receipt date, payment method, product, service, booked quantity, and notes.
- Customer account statements (`PartyStatementModal`) reflect each collection receipt once as a credit transaction and include the purchased service/product quantity under customer packages and offers; the corresponding direct-posting journal is excluded from the generic journal movement list to prevent duplicate statement credits.
- Validation: `npm run build` passed. `npm run lint` remains blocked by existing repository-wide TypeScript diagnostics; none point to the customer account-linking or direct receipt posting changes.

## Collection Receipt Excel Numeric Handling — 2026-10-10

- Fixed Excel collection import values reaching accounting code as strings: revenue journal construction now safely converts revenue and collection amounts to finite numbers before rounding, and the import explicitly normalizes amounts before adding shift rows.
- Validation: `npm run build` passed; Vite reports the existing large-chunk warning.

## Journal Storage Quota — 2026-10-10

- Accounting journals now persist in IndexedDB instead of writing the full journal history into the `erp_journals` localStorage key. Startup hydration merges IndexedDB journal entries with the legacy localStorage data by entry ID, preserving existing records during migration.
- If IndexedDB persistence fails, the app retains current journal data in memory and reports the persistence failure instead of crashing the receipt import with a quota exception.
- Reception shifts and their detailed run rows now use the same IndexedDB persistence path. Startup merges stored shifts by ID with the legacy localStorage values, preventing quota failures as run history grows.
- The reception-shift persistence effect is placed after its state initialization to avoid a temporal-dead-zone startup exception. Production build passes.

## Collection Receipt Column Filters and Archive — 2026-10-10

- Added optional per-column filters for receipt number/status, date, customer identifiers/contact, branch, source, shift/status, collected amount, payment method, and service/description/notes.
- Added select-all for the current filtered result set, bulk receipt archiving, and active/archived/all display modes. Archiving marks receipt rows only and does not alter financial totals or journal entries.
- The receipt table now shows the branch name in a dedicated column.
- Validation: `npm run build` passed; Vite reports the existing large-chunk warning. `git diff --check` passed.

## Collection Receipt Accounting Posting — 2026-10-10

- Excel collection imports now create posted journal entries that debit each payment method's linked cash/bank account and credit the matched customer's receivable account. Entries are grouped by branch and receipt date, and are created even when no reception shift is open.
- When a shift is open, one batched run-sheet update adds receipt-only rows (`totalRevenue: 0`) linked to the voucher journal IDs, preventing duplicate cash debits and revenue.
- Collection Receipts includes customer cash vouchers that are not already represented by a run-sheet row. A branch-scoped “Post unposted” action backfills eligible unposted vouchers and run-sheet receipt rows by their original date, skipping historical receipts that already have a linked shift journal or fall in a locked period.
- Cash receipts now persist in IndexedDB and hydrate alongside legacy localStorage records to support bulk imports beyond localStorage quota.
- Validation: `npm run build` passed; Vite reports the existing large-chunk warning. `git diff --check` passed.
- TypeScript check remains blocked by existing diagnostics elsewhere (Branch/Tenant `nameAr` references and context properties in Clinics, Neon Hub, Parties, and POS views); no diagnostics point to the collection posting changes.

## Latest Completed Request — 2026-10-08

## Customer Coding Review and Safe Merge — 2026-10-10

- Added a Customer Coding Review modal with searchable customer fields, branch/status/code/phone/date filters, select-all, and bulk archive, guarded permanent delete, and merge actions.
- Branch/status and each identifier filter support multiple selections. The customer-code, system-code, and file-code dropdown options are populated from customer records and narrowed by selected branches. Duplicate review has its own section title.
- Every multi-select dropdown has an option search. Select-all/clear applies to the currently visible choices and preserves selected values outside the current dropdown search.
- Customer Management has a separate all/active/archived status filter with counts. Permanent deletion remains permanent, so deleted profiles are not retained for a deleted-only list.
- Detailed booking/follow-up history for a merged customer resolves linked files from both primary and archived records and matches historical records by linked IDs or legacy name/phone/code fields, without rewriting transaction rows.
- The detailed history customer search excludes archived/merged profiles and resolves matching legacy transaction records to their active primary customer.
- Customer Coding Review can group active customers with matching System Codes and merge all groups in one operation after the user selects each group's primary file.
- Merge selects one active primary customer, records the source customer IDs and transfer note on the primary profile, and archives the source profiles. Existing bookings and follow-ups continue to reference their original customer IDs; the primary profile's booking/follow-up history view includes merged source IDs without changing historical rows.
- Archived/merged customers are excluded from customer selection in Bookings and Reception Operations.
- Permanent deletion skips customers with linked active cash receipts, posted/refunded revenue invoices, active specialized tax invoices, or revenue/collection operation rows. Bulk deletion uses a single customer-state update and consolidated audit/activity entries for large batches.
- Validation: production build passed. `tsc --noEmit` continues to report existing repository-wide type errors; the touched customer review lines produced no diagnostics. The app's customer persistence currently uses local state/local storage and IndexedDB; the existing Neon party service has no update/delete path for party lifecycle operations.

- Collection Receipts now display the linked customer's serialized Customer Code before the customer name, and Excel export includes the customer serial and registered payment method code.
- Collection import validates customer codes against customer records including archived customers, payment method codes against Payment Methods, and rejects dates later than the local current date. Validation errors are shown before confirmation; the existing explicit force-upload option retains rows with their entered values for upload as-is.
- Imported valid receipts link to the matched customer and use the registered payment method's category for cash receipt posting.
- Validation: not run in this request.

## Earlier Completed Request — 2026-10-08

- Added same-branch customer duplicate detection to quick booking intake: name and phone similarity of at least 80%, or exact System Code / File Code match. The warning lets staff select an existing customer or explicitly continue creating a new coded customer linked to the active branch.
- Added the same duplicate warning before Customer Management creates a customer, with a confirmation option to create a new record anyway.
- The date-range review begins only after pressing Review Results, compares names only (Arabic and English name fields), stays within each branch, and scans in yielding batches.
- Optimized the 80% name similarity matcher to retrieve candidates through the rarest necessary bigrams and stop edit-distance checks as soon as a pair cannot meet the threshold. Matching pairs within the selected target range are processed once.
- Validation: npm run build passed. npm run lint remains blocked by existing TypeScript errors outside the new duplicate detection and UI logic.
- Limitation: the review period uses the customer record's createdAt date because the model has no separate coding timestamp.

- Detailed booking and follow-up rows now show Customer Code, System Code, File Code, branch, and date in aligned columns, sourced from the linked Customer Management record. Fixed table layouts and wrapped content display every column without horizontal scrolling. The profile summary uses the same customer fields; branch name comes from the linked customer's branch assignment.
- Validation: `npm run build` passed. `npm run lint` remains blocked by existing repository-wide TypeScript errors; no new diagnostic points to the detailed history changes.

- Booking Management Customer Code, System Code, and File Code columns now use the linked Customer Management record as their primary values. Booking creation, edit, follow-up display, and Excel export use the same source precedence.
- Validation: production build passed; repository TypeScript check remains blocked by existing errors documented in CHANGELOG.md.

- Corrected legacy Customer Code normalization to retain valid unique numeric serials and repair missing, duplicate, or System Code-matching values without resetting valid codes. Booking and follow-up displays now prioritize the linked customer's independent serial and reject a Customer Code equal to its System Code.
- Booking Management agenda uses fixed-width wrapping columns with a 72vh internal vertical scroll area and no horizontal table scrolling.
- Validation: `npm run build` passed; TypeScript validation status is recorded in the latest changelog entry.

- Booking Management agenda heading now reads "Customer Code" in Arabic and English. Removed its fixed-height internal vertical scrolling; the table expands naturally and the top/bottom shortcuts scroll the page.
- Validation for this follow-up: `npm run build` (see latest changelog entry).

- Customer Codes are numeric serials independent from System Codes. New customer creation and bulk imports check existing and in-batch numeric codes before allocation; editing preserves the stored Customer Code.
- Customer import no longer treats System Code as Customer Code, and Customer Management CSV/Excel exports include both identifiers separately.
- Booking and follow-up import/export mappings carry Customer Code and System Code independently, including generated customer codes returned from bulk import.
- Removed the rendered Created By column from the follow-up table and patient follow-up history table; `createdBy` remains on records and in import/export data.
- Removed the Booking Management heading's explicit new-tab behavior, custom context-menu launch actions, and sidebar's dedicated new-tab icon for bookings. Ordinary navigation remains.
- Preserved Add New Booking and New Follow-up actions for past and today bookings.
- Validation: `npm run build` passes. `npm run lint` (`tsc --noEmit`) remains failing with numerous existing type errors across the repository; no errors were reported on the changed Customer Code generator/import/export code.

### Files changed

- `src/context/PlatformContext.tsx`
- `src/views/PartiesView.tsx`
- `src/views/BookingsFollowUpView.tsx`
- `src/components/GlobalContextMenu.tsx`
- `src/components/Sidebar.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Remaining known limitation

- Repository-wide TypeScript checking is not clean. Existing type errors remain in unrelated modules and in pre-existing parts of `BookingsFollowUpView.tsx` and `PlatformContext.tsx`.

## Latest Completed Request — 2026-10-08

- Customer Codes are numeric serials independent from System Codes. New customer creation and bulk imports check existing and in-batch numeric codes before allocation; editing preserves the stored Customer Code.
- Customer import no longer treats System Code as Customer Code, and Customer Management CSV/Excel exports include both identifiers separately.
- Booking and follow-up import/export mappings carry Customer Code and System Code independently, including generated customer codes returned from bulk import.
- Removed the rendered Created By column from the follow-up table and patient follow-up history table; `createdBy` remains on records and in import/export data.
- Removed the Booking Management heading's explicit new-tab behavior, custom context-menu launch actions, and sidebar's dedicated new-tab icon for bookings. Ordinary navigation remains.
- Preserved Add New Booking and New Follow-up actions for past and today bookings.
- Validation: `npm run build` passes. `npm run lint` (`tsc --noEmit`) remains failing with numerous existing type errors across the repository; no errors were reported on the changed Customer Code generator/import/export code.

### Files changed

- `src/context/PlatformContext.tsx`
- `src/views/PartiesView.tsx`
- `src/views/BookingsFollowUpView.tsx`
- `src/components/GlobalContextMenu.tsx`
- `src/components/Sidebar.tsx`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

### Remaining known limitation

- Repository-wide TypeScript checking is not clean. Existing type errors remain in unrelated modules and in pre-existing parts of `BookingsFollowUpView.tsx` and `PlatformContext.tsx`.

---

## Current Technology

- TypeScript 5.8+
- React 19
- Vite 6
- Tailwind CSS 4
- Node.js 22 LTS
- Native ESM
- Neon PostgreSQL
- `@neondatabase/serverless`
- Recharts
- Motion
- Lucide React
- XLSX
- DOCX

---

## Repository State

Current local repository:

`D:\Universal Business Management Platform\universal-business-platform22092026`

Current local branch:

`master`

Remote repository:

`origin`

GitHub repository:

`Universal-Business-Platform`

---

## Important Recent Development

Recent development has included work related to:

- Booking search and sorting performance.
- Patient follow-up persistence.
- General performance and UI consistency.
- Pagination and import flexibility.
- Appointment paper-file-code support.
- Fiscal features and system manual.
- Inventory tracking.
- Accounting functionality.
- Neon database integration.

---

## Current Architecture Areas

### Application entry

- `src/main.tsx`
- `src/App.tsx`

### Shared application state

- `src/context/PlatformContext.tsx`

### Services

- `src/services/accountingEngine.ts`
- `src/services/neonService.ts`

### Views

- `src/views/`

### Components

- `src/components/`

### Data

- `src/data/`

### Utilities

- `src/utils/`

### Types

- `src/types.ts`

### Database/scripts

- `scripts/neon_schema_migrations.sql`
- `scripts/generate_docx_manual.js`

---

## AI Shared-Memory System

The project now uses repository-based shared AI memory.

Primary files:

- `MASTER_AI_INSTRUCTIONS.md`
- `AI_CONTEXT.md`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

The purpose is to allow different AI development tools to continue work using the same project context.

The shared AI instruction system is now configured: root `AGENTS.md` directs Codex to read the shared memory files, and `.github/copilot-instructions.md` directs GitHub Copilot to read them and follow the project change-approval rules. Codex has been successfully installed and authenticated.

---

## Agent Handoff Status

### Previous Agent

Initial setup of shared AI project instructions and memory system.

### Work Completed

Created:

- `MASTER_AI_INSTRUCTIONS.md`
- `AI_CONTEXT.md`
- `PROJECT_STATE.md`
- `CHANGELOG.md`
- `.github/copilot-instructions.md`

The contents of the first three files are being established as part of the shared AI workflow.

### Important Rule

The master instruction file must not be independently rewritten by an AI agent.

It may be changed when the project owner explicitly requests or approves a change.

---

## Current User Goal

The project owner wants multiple AI development tools to work on the same GitHub project while maintaining a shared understanding of the project.

Target tools include:

- Google AI Studio
- OpenAI Codex
- Claude Code
- GitHub Copilot

The desired system should allow one AI tool to continue work started by another without depending on private chat history.

---

## Desired AI Workflow

The intended workflow is:

1. User gives a development task.
2. One AI agent performs the task.
3. The agent records important changes and current state.
4. The work is synchronized with GitHub.
5. The next AI agent reads the shared project memory.
6. The next agent continues from the actual repository state.
7. Agents do not assume that another tool's private conversation is available.

---

## Change Approval Model

AI agents are allowed to modify any files required to complete the user's explicit request.

The project does NOT have an absolute "Core files cannot be changed" rule.

If a significant additional change outside the requested task becomes necessary or desirable, the agent must stop and ask the project owner before implementing that additional change.

The agent should explain:

- Proposed change
- Reason
- Affected files/systems
- Expected impact
- Alternatives

---

## Known Performance Concern

Large data operations require careful handling.

A previous issue occurred when approximately 10,000 customer records were loaded/imported and the browser became blank or unresponsive.

Future large-data features should favor:

- Pagination
- Filtering
- Sorting
- Database-side operations
- Batching
- Incremental loading
- Efficient React updates

---

## Known Repository Notes

At the time this state file was created, the local repository had untracked files including:

- `.vs/`
- `package-lock.json`

Do not automatically delete, add, commit, or discard these files without understanding their purpose and the user's intended Git workflow.

---

## Current Next Steps

1. Verify how each AI tool consumes the shared repository instructions.
2. Establish a safe handoff workflow between AI Studio, Codex, Claude Code, and Copilot.
3. Establish a practical branch/synchronization strategy.
4. Protect the master instruction file from accidental changes while allowing the project owner to change it.
5. Keep `main`/the stable branch safe while allowing normal feature development.

---

## Important Handoff Rule

Before another AI agent starts substantial work:

Read:

1. `MASTER_AI_INSTRUCTIONS.md`
2. `AI_CONTEXT.md`
3. `PROJECT_STATE.md`
4. `CHANGELOG.md`

Then inspect the actual source code relevant to the requested task.

Never rely solely on this document when the actual code can answer the question.
## Codex Setup and Repository Inspection (2026-10-08)

- Codex has been successfully installed and authenticated.
- `AGENTS.md` was created in the repository root to direct Codex to read `MASTER_AI_INSTRUCTIONS.md`, `AI_CONTEXT.md`, `PROJECT_STATE.md`, and `CHANGELOG.md` before substantial work.
- The repository structure was inspected without modifying application code.
- Confirmed application entry points: `src/main.tsx` mounts the app, and `src/App.tsx` provides the platform provider, login/layout orchestration, and view navigation.
- Confirmed central shared state: `src/context/PlatformContext.tsx` provides `PlatformProvider` and `usePlatform`.
- Confirmed main services: `src/services/accountingEngine.ts` and `src/services/neonService.ts`.
- Confirmed Neon integration locations: `src/services/neonService.ts`, `scripts/neon_schema_migrations.sql`, and the database management UI in `src/views/NeonHubView.tsx`.
- Identified large-data-sensitive areas: shared collections and bulk operations in `PlatformContext.tsx`; customer lookup/import and chunk processing in `BookingsFollowUpView.tsx`; customer filtering and pagination in `PartiesView.tsx`; and full-payload workbook generation in `src/utils/fullDatabaseExcelBackup.ts`.
- No application files were modified during this inspection.
