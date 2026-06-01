# Planning Notes

## User Intent
GOAL: Fix payroll/upah frontend through proxy so loading stops and monitoring/payroll render.
SCOPE: Diagnose proxy/API/base URL/loading-state/performance/concurrency integration, then plan targeted backend/frontend fixes.
CONTEXT: Existing payroll app with backend and frontend modules. Worktree has uncommitted changes; plan must avoid overwrite risk and account for active WIP.

## Context Findings
- Critical files: frontend/src/utils/apiBase.js, frontend/src/utils/httpSetup.js, frontend/vite.config.js, frontend/src/utils/prodModeUtils.js, frontend/src/context/AuthContext.jsx, frontend/src/hooks/usePayrollStream.js, frontend/src/components/CustomPayrollTable.jsx, backend/src/index.ts, backend/src/api/payroll.ts.
- Conflict risk: high. Required source files are already dirty or untracked.
- Main likely cause: SSE and fallback fetch use raw /payroll paths while proxy backend base is /backend/upah.
- Secondary risks: auth redirect /login vs app basename /upah, stream has no watchdog timeout, proxy strip middleware does not rewrite request, heavy payroll extraction can exceed proxy/SSE idle limits.

## Constraints
- Planning only. Do not execute implementation in this workflow-plan session.
- Preserve pre-existing uncommitted changes.
- Prefer module-local commands and existing project patterns.
- Include focused tests and proxy/runtime verification in execution plan.