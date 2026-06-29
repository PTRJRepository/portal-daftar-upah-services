export const meta = {
  name: 'canonical-diff',
  description: 'Compare dev branch (server-dev-merger-1) vs canonical GitHub (temp/server-changes-1 @ c9e72ff6) for logic/calc divergence; report only, no fix',
  phases: [
    { title: 'Diff', detail: 'one agent per area, git diff dev vs canonical, find logic divergence' },
    { title: 'Synthesize', detail: 'merge into DIVERGENCE_REPORT.md' }
  ]
}

const CANONICAL = 'c9e72ff6'  // temp/server-changes-1 tip = canonical logic
const ROOT = 'D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production'

const DIFF_SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    divergences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          canonicalBehavior: { type: 'string' },
          devBehavior: { type: 'string' },
          outputImpact: { type: 'string', enum: ['calc-numeric', 'label-text', 'control-flow', 'none-observed', 'unknown'] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          evidence: { type: 'string' }
        },
        required: ['file', 'canonicalBehavior', 'devBehavior', 'outputImpact', 'severity', 'evidence']
      }
    }
  },
  required: ['area', 'divergences']
}

// Each agent diffs one area: git diff HEAD c9e72ff6 -- <path>, then read hunks
// to judge LOGIC divergence (not style). Canonical wins.
const AGENTS = [
  {
    area: 'payroll-calc-utils',
    paths: 'backend/src/utils/otherIncomeCanonical.ts backend/src/utils/payrollPeriodAdjustments.ts backend/src/utils/payrollTableFormatters.js backend/src/utils/employeeSort.ts backend/src/utils/taxReportIdentity.ts backend/src/utils/taxDomExportRows.ts',
    prompt: `Compare dev (HEAD = server-dev-merger-1) vs canonical GitHub (commit ${CANONICAL}) for payroll calc UTILS in repo ${ROOT}.

Run: git diff HEAD ${CANONICAL} -- ${'${PATHS}'}
where PATHS = the area's files. Read the diff hunks.

CRITICAL: dev has STUB versions of otherIncomeCanonical.ts and payrollPeriodAdjustments.ts (I created them as stubs because they were imported-but-missing). Canonical has REAL implementations. The stubs DIVERGE from canonical:
- otherIncomeCanonical: dev maps EXGRATIA -> "EXGRATIA" (separate); canonical maps EXGRATIA -> "BONUS". Dev label "Bonus"/"Kontan"; canonical "PENDAPATAN BONUS"/"KONTANAN". Dev signature normalizeOtherIncomeType(input: OtherIncomeLike); canonical (value: unknown): string.
- payrollPeriodAdjustments: dev stub returns fallback/boolean no-op; canonical has real override logic.

For EACH file in the area: report canonical behavior vs dev behavior, output impact (does it change numbers/labels/flow?), severity, evidence (diff hunk summary). Canonical = truth. Skip files with no diff or pure-style diff (mark outputImpact none-observed). Return via StructuredOutput.`
  },
  {
    area: 'payroll-services-core',
    paths: 'backend/src/services/dataExtractorService.ts backend/src/services/manualAdjustmentService.ts backend/src/services/taxReportService.ts backend/src/services/reportService.ts backend/src/services/daftarUpahExcelService.ts backend/src/services/taxReportExcelService.ts backend/src/services/otherIncomesService.ts',
    prompt: `Compare dev (HEAD) vs canonical ${CANONICAL} for CORE payroll SERVICES in ${ROOT}.

Run: git diff HEAD ${CANONICAL} -- ${'${PATHS}'}
Read hunks. Note: dev is 43 commits ahead (dashboard per-division, snapshot version, KPI fixes) — many diffs are dev IMPROVEMENTS not in canonical. But USER says canonical = truth. So flag where dev DIVERGES from canonical logic in a way that changes payroll CALCULATION or output:
- Phase 4b calc (upah_bersih, pph21_ter, penghasilan_bruto)
- Manual adjustment apply/merge
- Tax report computation
- Other income canonical type grouping (dev calls stub funcs; canonical calls real)
- Excel export label/format

For each divergence: file, canonical behavior, dev behavior, output impact (calc-numeric/label-text/control-flow), severity, evidence. If dev's change is an ADDITION not in canonical (e.g. snapshot_version meta, dashboard division filter) and doesn't alter canonical calc — note as "dev-addition" with outputImpact none-observed, severity low (not a regression). Focus on calc divergence. Return via StructuredOutput.`
  },
  {
    area: 'seeder-history-snapshot',
    paths: 'backend/src/api/aggregationSeederRoutes.ts backend/src/api/parallelAggregationSeeder.ts backend/src/api/uiBasedSeeder.ts backend/src/services/aggregationService.ts backend/src/services/historyDatabaseService.ts backend/src/services/autoBufferManualAdjustmentSeederService.ts backend/src/services/historySeederService.ts',
    prompt: `Compare dev (HEAD) vs canonical ${CANONICAL} for SEEDER + HISTORY + SNAPSHOT in ${ROOT}.

Run: git diff HEAD ${CANONICAL} -- ${'${PATHS}'}
Dev added: snapshot_version requested/available meta, cache invalidation (some), seeder DELETE division_code (audit fix). Canonical may not have these. Flag divergences that change WRITE behavior or data shape:
- snapshot_version write/read (NULL vs 0)
- DELETE scope (dev may have added division_code per audit fix F16 — verify if canonical lacks it, that's canonical DEFICIENCY not dev divergence)
- cache invalidation presence
- SeederOptions shape

For each: file, canonical behavior, dev behavior, output impact, severity, evidence. IMPORTANT: if dev has a FIX canonical lacks (e.g. division_code in DELETE), mark severity low + note "dev-fix-not-in-canonical" — do NOT recommend reverting dev's fix. Canonical truth applies to LOGIC, not to bug fixes dev added. Return via StructuredOutput.`
  },
  {
    area: 'api-routes-auth',
    paths: 'backend/src/api/payroll.ts backend/src/api/dashboardRoutes.ts backend/src/api/taxReportRoutes.ts backend/src/utils/authBypass.ts backend/src/services/authService.ts backend/src/index.ts',
    prompt: `Compare dev (HEAD) vs canonical ${CANONICAL} for API ROUTES + AUTH + ENTRY in ${ROOT}.

Run: git diff HEAD ${CANONICAL} -- ${'${PATHS}'}
Dev added: dashboard executive-summary division/gang_prefix filter, KPI per division, snapshot route chain, premium-import progress/template. Canonical may have monitor.js/telegramBot (c9e72ff6) dev lacks. Flag divergences in:
- endpoint response shape (snapshot fields, kpi fields)
- auth/role gating (dev audit fixes vs canonical)
- route registration (index.ts)
- monitor/telegram features (canonical has, dev lacks) — mark as "canonical-feature-missing-in-dev" severity medium

For each: file, canonical behavior, dev behavior, output impact, severity, evidence. Return via StructuredOutput.`
  },
  {
    area: 'frontend-calc-display',
    paths: 'frontend/src/components/CustomPayrollTable.jsx frontend/src/pages/ProfessionalDashboard.jsx frontend/src/pages/MainPage.jsx frontend/src/services frontend/src/utils/prodModeUtils.js frontend/src/context/ReportContext.jsx',
    prompt: `Compare dev (HEAD) vs canonical ${CANONICAL} for FRONTEND calc/display in ${ROOT}.

Run: git diff HEAD ${CANONICAL} -- ${'${PATHS}'}
Dev added: sawit banner, group/asistensi filter, dashboard refactor (config/helpers split), buildBackendUrl. Canonical has ReportKpiCards, ServerMonitor, exportPayslipsToExcel, wagesSummaryAudit that dev may lack. Flag divergences in:
- number formatting/currency (id-ID)
- snapshot UI (dev may not have dropdown; canonical?)
- KPI card logic
- export logic (canonical exportPayslipsToExcel missing in dev?)
- wagesSummaryAudit (canonical has, dev?)

For each: file, canonical behavior, dev behavior, output impact (calc-numeric/label-text/control-flow), severity, evidence. Mark canonical-features-missing-in-dev as medium. Return via StructuredOutput.`
  }
]

phase('Diff')

const results = await parallel(AGENTS.map(a => () =>
  agent(a.prompt.replace('${PATHS}', a.paths), { label: `diff:${a.area}`, phase: 'Diff', schema: DIFF_SCHEMA, agentType: 'Explore' })
    .then(r => ({ area: a.area, ...r }))
    .catch(() => null)
))

const diffResults = results.filter(Boolean)
const allDivergences = diffResults.flatMap(r => (r.divergences || []).map(d => ({ ...d, area: r.area })))
log(`Diffs done: ${diffResults.length}/${AGENTS.length} | divergences: ${allDivergences.length}`)

phase('Synthesize')

const report = await agent(
  `You are the lead auditor. Below are divergence findings (dev vs canonical ${CANONICAL}) from ${AGENTS.length} parallel diff agents of a payroll system (PT Rebinmas, repo ${ROOT}).

User mandate: canonical GitHub (c9e72ff6) = truth. Dev must match. Report ONLY (no fix yet).

Raw divergences (JSON):
${JSON.stringify(allDivergences, null, 2)}

Produce DIVERGENCE_REPORT.md (just markdown, no preamble). Structure:
1. Executive summary: total divergences by severity + outputImpact; count of (a) dev-must-revert-to-canonical, (b) dev-additions-not-in-canonical (keep), (c) canonical-features-missing-in-dev (add).
2. Critical table: calc-numeric divergences that change payroll numbers (must fix).
3. Label/control-flow table.
4. Per-area detail with evidence (file, canonical vs dev, impact, severity).
5. Recommended action per item: REVERT-DEV-TO-CANONICAL / KEEP-DEV-ADDITION / ADD-CANONICAL-TO-DEV / INVESTIGATE.
6. Quick-fix list (files where dev stub should be replaced by canonical real impl — e.g. otherIncomeCanonical, payrollPeriodAdjustments).

Be concrete, cite file:line. Mark the stub-vs-real cases explicitly (dev stub otherIncomeCanonical EXGRATIA->EXGRATIA vs canonical EXGRATIA->BONUS = label + grouping divergence).`,
  { label: 'synthesize:divergence-report', phase: 'Synthesize' }
)

return { areaCount: diffResults.length, divergenceCount: allDivergences.length, report }
