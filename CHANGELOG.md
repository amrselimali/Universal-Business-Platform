# CHANGELOG

This file records important project development events, decisions, and changes.

It is intended to help future AI agents understand how the project evolved.

---

# 2026-10-08

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