# Implementation Plan: Proxy Loading Payroll Performance

## 1. Requirements Summary
Fix Daftar Upah/payroll frontend when opened through proxy. App must not stay on endless loading. Monitoring/payroll views must render fast, fail clearly, and support many professional users.

Core requirements:
- Proxy mode /upah frontend must call backend API through correct /backend/upah base.
- SSE payroll stream must work behind proxy or degrade to bounded fallback.
- Auth/token expiry must redirect clearly, not leave loading screen stuck.
- Multi-user payroll load must have timeout, retry, cache/dedupe, and observability boundaries.
- Existing dirty WIP must be preserved; inspect diffs before editing.

## 2. Architecture Decisions
- Use frontend/src/utils/apiBase.js as canonical backend URL builder.
- Keep axios relative paths for service modules, but route raw fetch/SSE URLs through buildBackendUrl.
- Keep backend route duplication under /backend/upah unless tests prove middleware rewrite is needed.
- Add watchdog timeout around stream startup/progress; fallback once, then show retryable error UI.
- Add proxy smoke tests for static app, health, auth verify, and payroll stream path.

## 3. Task Breakdown
1. IMPL-1: Lock API base contract with tests. Covers /, /upah, port 3001, VITE_PROXY_MODE, explicit VITE_BACKEND_URL.
2. IMPL-2: Normalize payroll stream and fetch URLs. Replace raw /payroll stream/fallback fetch with buildBackendUrl output, preserve local dev behavior.
3. IMPL-3: Harden loading/auth UX. Add stream watchdog, one-shot fallback, retryable error state, and proxy-safe login redirects.
4. IMPL-4: Verify backend proxy route contract. Add tests/smoke helpers for /backend/upah route group, /upah static fallback, health/API/SSE headers.
5. IMPL-5: Hardening for multi-user performance. Add request timing, cache/dedupe review, timeout limits, and no endless backend work on client abort.
6. IMPL-6: Full verification and runbook. Run focused tests, build, proxy smoke, and document deploy env flags.

## 4. Implementation Strategy
Sequential with small checkpoints. IMPL-1 before URL edits. IMPL-2 and IMPL-3 can be same frontend pass after tests exist. IMPL-4 before backend route changes. IMPL-5 after correctness is stable. IMPL-6 closes verification.

## 5. Risk Assessment
- High conflict risk: backend/src/index.ts, frontend/src/App.jsx, frontend/src/components/CustomPayrollTable.jsx, frontend/src/pages/Report.jsx, frontend/src/utils/httpSetup.js already dirty; frontend/src/utils/apiBase.js untracked.
- Main regression risk: breaking local development paths while fixing proxy mode.
- Main runtime risk: proxy buffers or blocks SSE. Watchdog + fallback required.
- Performance risk: backend extraction still heavy under concurrent users. Need observability and load smoke before broad optimization.

## 6. Verification Commands
- cd frontend && npx vitest run src/utils/apiBase.test.js src/utils/payrollClientRuntime.test.js
- cd frontend && npm run build
- cd backend && bun test src/api/payroll.proxy.test.ts
- cd backend && bun test src/services/cacheService.test.ts
- Manual proxy smoke: /upah, /backend/upah/health, /backend/upah/payroll/locked/verify, /backend/upah/payroll/report/division-raw-tree/stream

Planning ends here. Execute later with workflow-execute --session WFS-proxy-loading-payroll-performance.