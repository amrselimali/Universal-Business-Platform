# PROJECT STATE

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
- The trial-balance screen now lists each posted unbalanced journal entry with debit/credit totals and its difference, and lists journal lines whose account IDs do not resolve. Account balance synchronization uses account IDs only to avoid applying same-code movements across tenants.
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
