# CHANGELOG

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
