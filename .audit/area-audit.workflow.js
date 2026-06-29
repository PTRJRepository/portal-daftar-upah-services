export const meta = {
  name: 'area-audit',
  description: 'Audit areas not yet covered: live output parity, test gaps, config/env, dead code, frontend-backend contract, perf, data integrity',
  phases: [
    { title: 'Audit', detail: 'one agent per area' },
    { title: 'Synthesize', detail: 'merge into AREA_AUDIT_REPORT.md' }
  ]
}

const ROOT = 'D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production'
const LIVE = 'http://ptrjestate.rebinmas.com:3001'
const LOCAL = 'http://localhost:8002'
const APIKEY = '88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a'

const SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          suggestedAction: { type: 'string' }
        },
        required: ['title', 'severity', 'evidence', 'impact', 'suggestedAction']
      }
    }
  },
  required: ['area', 'findings']
}

const AGENTS = [
  {
    area: 'live-output-parity',
    prompt: `Audit LIVE OUTPUT PARITY in ${ROOT}. Goal: dev (localhost:8002) must produce IDENTICAL numbers to live (${LIVE}/upah). Earlier spot-check: KPI aggregate 6/2026 matched (9.7B/1814), operational PG1A matched (187 rows), but per-division KPI on live was OLD (ignored division_code). Now that dev has fixes, verify parity across MORE endpoints.

Do NOT start backend (assume it may not be running). Instead, INSPECT code to predict parity gaps:
- Read backend/src/api/payroll.ts, dashboardRoutes.ts, taxReportRoutes.ts response shapes.
- Compare dev response field names/types vs what live frontend expects.
- Identify endpoints where dev added fields (snapshot_version, available_snapshot_versions) that live frontend may not read yet → parity gap.
- Identify endpoints where dev calc differs (per audit: C1 payrollPeriodAdjustments stub, C2 dedupe dropped) → these WILL produce different numbers than live/canonical.
- List specific endpoint+param combos that would diverge.

For each: title, severity, evidence (file:line + endpoint), impact (which number differs), suggestedAction. Return via StructuredOutput. If backend reachable you may curl, but code inspection is primary.`
  },
  {
    area: 'test-coverage-gap',
    prompt: `Audit TEST COVERAGE GAPS in ${ROOT}. Backend uses \`bun test\` (*.test.ts), frontend tests disabled (npm test = stub).

For each CRITICAL backend service file (dataExtractorService.ts, manualAdjustmentService.ts, taxReportService.ts, historyDatabaseService.ts, dashboardService.ts, aggregationService.ts, autoBufferManualAdjustmentSeederService.ts, reportService.ts, daftarUpahExcelService.ts):
- Does a *.test.ts exist? (ls backend/src/services/*.test.ts, backend/src/api/*.test.ts)
- If yes, does it cover the CANONICAL behavior or just dev's current (possibly stub) behavior?
- Flag critical calc paths with NO test: Phase 4b (upah_bersih, pph21_ter), snapshot version selection, manual adjustment merge, other income canonical grouping, seeder DELETE scope.

Also: stub utils (otherIncomeCanonical.ts, payrollPeriodAdjustments.ts) — do their tests assert STUB behavior (wrong) or canonical (right)? If tests assert stub, reverting stub will break tests — flag as test-stale.

For each gap: title, severity, evidence (file + missing test), impact, suggestedAction (write test for X). Return via StructuredOutput.`
  },
  {
    area: 'config-env-divergence',
    prompt: `Audit CONFIG/ENV DIVERGENCE in ${ROOT}. Dev .env vs what live server needs.

Read backend/src/config.ts fully — list every env var + default. Read backend/.env (if exists) + backend/.env.example.
Find:
1. Hardcoded values that should be env (grep SERVER_PROFILE_ literals, host strings, ports, API keys in code not via Config).
2. Defaults that are WRONG for prod (e.g. DB_PROFILE default SERVER_PROFILE_1 = history DB, should be SERVER_PROFILE_2 = payroll — audit ROOT-A).
3. Missing .env.example entries (canonical c9e72ff6 added .env.example — does dev have it? git show c9e72ff6:backend/.env.example).
4. RUN_MODE branching that silently changes behavior (isHistoryMode = prod-only).
5. Feature flags undocumented (VITE_PROXY_MODE, VITE_BACKEND_HOST, etc).

For each: title, severity, evidence (config.ts:line), impact, suggestedAction. Return via StructuredOutput.`
  },
  {
    area: 'dead-code-orphan',
    prompt: `Audit DEAD CODE / ORPHAN FILES in ${ROOT}.

Find files/functions not imported or referenced:
1. Backend services/*.ts not imported by any api/ or other service (grep import). Especially the 91 services — many may be orphan from refactors.
2. Debug/verify scripts committed to backend/src/ (debug_arc.ts, debug_profiles.ts, verify_fix.ts, verify_gang_mapping.ts, verify_profile_fix.ts, output.txt) — these came from merges, should NOT be in production tree.
3. Frontend pages not routed in App.jsx (60 pages — some may be orphan).
4. Duplicate implementations (two functions doing same thing — audit found jabatan 3 query paths).
5. Commented-out code blocks > 10 lines.

Use git grep for import references. For each dead file: title (file), severity (low/medium), evidence (no importers found), impact (maintenance burden, confusion), suggestedAction (delete or archive). Return via StructuredOutput. Focus on backend/src debug scripts + obviously orphan services.`
  },
  {
    area: 'frontend-backend-contract',
    prompt: `Audit FRONTEND-BACKEND CONTRACT (field name/type mismatch) in ${ROOT}.

Compare API response field names (backend) vs what frontend reads:
1. payroll report response: backend returns data_rows with fields (emp_code, upah_bersih, total_premi, etc) — does CustomPayrollTable.jsx read same names? grep field access.
2. snapshot meta: backend returns snapshot_version/requested_snapshot_version/available_snapshot_versions — does frontend read them? (audit said NO snapshot UI in frontend).
3. executive-summary: kpi {curr_wage, curr_headcount} — ProfessionalDashboard buildKpis reads kpi?.curr_wage — match? but does it read available_snapshot_versions?
4. manual adjustment save: frontend sends {amount, adjustment_type, ...} — backend expects same keys?
5. gang/division: frontend gang_code vs backend gang_code; division_code vs division.

For each mismatch: title, severity (high if breaks feature), evidence (backend file:line vs frontend file:line), impact, suggestedAction. Return via StructuredOutput.`
  },
  {
    area: 'data-integrity',
    prompt: `Audit DATA INTEGRITY risks in ${ROOT} (NULL handling, FK, cascade, idempotency).

Find:
1. NULL vs 0 ambiguity (audit F36: snapshot_version INT NULL, read with ISNULL(...,0) — version 0 matches NULL).
2. DELETE without division_code scope (audit F16 — already found, confirm coverage in ALL seeder paths).
3. INSERT without unique constraint check (manual_adjustments, aggregation_history — duplicate row risk).
4. FK/cascade: payroll_history_detail.master_id → payroll_history_header.id — does delete cascade? orphan details?
5. Idempotency: re-running seeder for same period/division — does it DELETE-then-INSERT (safe) or INSERT-only (dup)?
6. Transaction boundaries: multi-step write (delete+insert+cache-invalidate) not wrapped in transaction — partial failure leaves inconsistent state.
7. JSON columns (dynamic_premi_data, metadata_json) — parsed without try/catch? malformed = crash.

For each: title, severity (critical = data loss), evidence (file:line), impact, suggestedAction. Return via StructuredOutput.`
  }
]

phase('Audit')

const results = await parallel(AGENTS.map(a => () =>
  agent(a.prompt, { label: `audit:${a.area}`, phase: 'Audit', schema: SCHEMA, agentType: 'Explore' })
    .then(r => ({ area: a.area, ...r }))
    .catch(() => null)
))

const auditResults = results.filter(Boolean)
const allFindings = auditResults.flatMap(r => (r.findings || []).map(f => ({ ...f, area: r.area })))
log(`Areas done: ${auditResults.length}/${AGENTS.length} | findings: ${allFindings.length}`)

phase('Synthesize')

const report = await agent(
  `Synthesize AREA_AUDIT_REPORT.md from ${AGENTS.length} area audits of payroll system ${ROOT}. Raw findings JSON:
${JSON.stringify(allFindings, null, 2)}

Produce markdown (no preamble):
1. Executive summary: counts by area + severity; top 5 cross-area risks.
2. Per-area findings table (area | severity | title | evidence).
3. Cross-cutting root causes (issues spanning multiple areas).
4. Prioritized action list (P0 critical data-loss/security, P1 high, P2 medium, P3 low) — each with area, evidence, action.
5. "Already covered by prior audit" section — items that duplicate AUDIT_REPORT.md/DIVERGENCE_REPORT.md findings (cite them, don't re-recommend).
6. Quick wins.

Be concrete, cite file:line. Mark items that overlap prior audits explicitly to avoid duplicate work.`,
  { label: 'synthesize:area-report', phase: 'Synthesize' }
)

return { areaCount: auditResults.length, findingCount: allFindings.length, report }
