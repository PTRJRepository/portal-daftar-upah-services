# Repository Guidelines

## Project Structure & Module Organization

This repository is a payroll application split into backend and frontend modules. Backend code lives in `backend/src`, with API routes under `backend/src/api`, services under `backend/src/services`, utilities under `backend/src/utils`, SQL and query helpers under `backend/sql` and `backend/query`, and runtime data under `backend/data`. Frontend code lives in `frontend/src`, with pages, components, and utility modules colocated with their tests. Shared documentation belongs in `docs/`; local browser-only test tools are under `Browser Automation/`. Use `_dev_utils/` for one-off verification scripts rather than mixing them into production modules.

## Build, Test, and Development Commands

- `cd backend && bun run dev`: run the backend API in watch mode.
- `cd backend && bun run start`: run the backend once.
- `cd backend && bun test`: run all backend Bun tests.
- `cd backend && bun test src/services/manualAdjustmentService.test.ts`: run a focused backend test file.
- `cd frontend && npm run dev:test`: start the Vite frontend in test/dev mode.
- `cd frontend && npm run build`: build the frontend bundle.
- `cd frontend && npx vitest run src/utils/payrollNumericValues.test.js`: run a focused frontend test when needed.

Root `package.json` has legacy orchestration scripts; prefer module-local commands unless you are intentionally testing the combined workflow.

## Coding Style & Naming Conventions

Use TypeScript for backend code and React/JavaScript for frontend code. Follow the existing style: 4-space indentation in backend `.ts` files, 2-space indentation in frontend files, semicolons in TypeScript, and descriptive camelCase names for functions and variables. Keep service logic in `backend/src/services` and route parsing/validation in `backend/src/api`. Name tests after the unit or behavior, for example `manualAdjustmentService.test.ts` or `payrollSnapshotQuery.test.js`.

## Testing Guidelines

Add focused tests for behavior changes. Backend tests use `bun:test`; frontend tests use Vitest-compatible files run with `npx vitest run`. Prefer running the smallest relevant test first, then broaden to related files. For manual adjustment work, always include `bun test src/services/manualAdjustmentService.test.ts` before finishing.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit prefixes such as `fix:`, `feat:`, `docs:`, and `chore:`. Keep subjects imperative and scoped, for example `fix: normalize manual adjustment subblok codes`. Pull requests should include a short summary, affected areas, test commands run, and screenshots for UI changes.

## Security & Configuration Tips

Do not commit `.env`, API keys, generated logs, or local tester files with secrets. Keep ignored browser automation pages local unless they are intentionally sanitized for documentation.


## Dokumentasi Historis

Panduan agent versi sebelumnya (CLAUDE.md, QWEN.md) diarsipkan di `docs/archive/`.
Dokumen aktif untuk optimasi sistem: `docs/PRD-daftar-upah-optimization.md`.
