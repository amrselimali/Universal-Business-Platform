# PROJECT STATE

## Last Updated

2026-10-08

## Project

Universal Business Platform

## Repository

Universal-Business-Platform

## Current Development Status

The project is an actively developed React/TypeScript business platform.

The application currently contains multiple operational, financial, inventory, medical/service, staff, payroll, booking, fiscal, notification, and administration modules.

The project is being developed toward a cloud-native architecture using Neon PostgreSQL.

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
