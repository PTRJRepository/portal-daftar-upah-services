export const meta = {
  name: 'consistency-audit',
  description: 'Parallel auditors find inconsistencies across payroll subsystems (manual adjustment, jabatan, seeder, data update), synthesize into doc + fix plan',
  phases: [
    { title: 'Audit', detail: 'one auditor per subsystem, find inconsistencies' },
    { title: 'Synthesize', detail: 'merge findings into doc + prioritized fix plan' }
  ]
}

const ROOT = 'D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production'

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    subsystem: { type: 'string' },
    inconsistencies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          files: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          suggestedFix: { type: 'string' }
        },
        required: ['title', 'severity', 'files', 'evidence', 'impact', 'suggestedFix']
      }
    }
  },
  required: ['subsystem', 'inconsistencies']
}

// Each auditor owns one subsystem. Read-only, return structured findings.
const AUDITORS = [
  {
    key: 'manual-adjustment',
    prompt: `You are auditing the payroll "manual adjustment" subsystem for INCONSISTENCIES in repo at ${ROOT} (branch server-dev-merger-1).

Scope (read-only, grep/read):
- backend/src/services/manualAdjustmentService.ts, manualAdjustmentPresetService.ts, autoBufferManualAdjustmentSeederService.ts
- backend/src/services/dataExtractorService.ts (manual adjustment apply/metadata/policy)
- backend/src/api/payroll.ts (manual-edit / pendapatan-lainnya-edit / premium routes)
- frontend CustomPayrollTable.jsx + MainPage.jsx (manual edit UI + save)

Find inconsistencies ONLY (not style):
1. Mismatched field names/keys between backend↔frontend↔DB (e.g. amount vs jumlah, adjustment_type spelling, metadata_json shape).
2. Save/read paths that disagree (e.g. UI saves to endpoint A but extractor reads from B; seeder vs live use different sources).
3. Auth/access divergence: api-key bypass vs token vs role checks on manual-edit endpoints.
4. Stale/duplicate code, two implementations of same logic, dead branches.
5. Data-loss risks (no validation, silent fallback, overwrite without check).
6. Snapshot/history interaction: manual adjustments not flowing into payroll_history / aggregation consistently.

Use grep to locate. Read excerpts (not whole files). For each finding give: title, severity (critical/high/medium/low), files (path:line), evidence (short quote/symptom), impact, suggestedFix (concrete, 1-2 sentences). Return via the StructuredOutput schema. Be precise — every finding must point to real code. If a subsystem is consistent, return empty inconsistencies with a 1-line note in subsystem.`
  },
  {
    key: 'jabatan-tunjangan',
    prompt: `You are auditing the "jabatan / tunjangan jabatan" subsystem for INCONSISTENCIES in repo at ${ROOT}.

Scope:
- backend/src/services/payroll/components/GajiPokokService.ts (and any TunjanganService/JabatanService in services/payroll)
- backend/src/utils/payrollPeriodAdjustments.ts (resolveAdjustedJabatanJumlah, attachPayrollPeriodAdjustmentNotes — note: these were STUBS, recently created)
- backend/src/services/taxReportService.ts, daftarUpahExcelService.ts, reportService.ts (jabatan_jumlah usage)
- backend/src/repositories/payroll/PayrollTunjanganRepository.ts
- frontend CustomPayrollTable.jsx (jabatan column display/edit)

Find inconsistencies ONLY:
1. jabatan_jumlah source of truth: HR_PAYROLL.PayRate? PR_ADTRANS? manual adjustment? different code paths pick different source.
2. resolveAdjustedJabatanJumlah is a STUB returning fallback — what expects real override? Where would real logic live?
3. Tunjangan jabatan rate/amount: hardcoded vs config vs DB; divergent between extractor, tax report, excel export, UI.
4. attachPayrollPeriodAdjustmentNotes stub no-op — who reads the notes it should set?
5. Field naming: jabatan_jumlah vs tunjangan_jabatan vs jabatan_rate — mixed?
6. Tax report vs daftar upah grand total divergence caused by jabatan calc.

Concrete findings via StructuredOutput. Evidence must cite real path:line.`
  },
  {
    key: 'seeder-data-update',
    prompt: `You are auditing the "seeder / aggregation / data update" subsystem for INCONSISTENCIES in repo at ${ROOT}.

Scope:
- backend/src/api/aggregationSeederRoutes.ts, parallelAggregationSeeder.ts, uiBasedSeeder.ts
- backend/src/services/aggregationService.ts, autoBufferManualAdjustmentSeederService.ts, historySeederService.ts, historyDatabaseService.ts
- backend/src/services/dataExtractorService.ts (history snapshot path, db_ptrj_only mode)
- Frontend AggregationSeederPage.jsx, SpreadsheetSyncPage.jsx

Find inconsistencies ONLY:
1. Multiple seeder entrypoints (parallel, UI, aggregation) — do they write the same table with same schema, or divergent columns/NULL handling?
2. snapshot_version: who writes it, who reads MAX, who reads requested — inconsistent (recent fix added requested, verify coverage).
3. daftar_upah_aggregation_history vs payroll_history_header vs payroll_history_detail — overlap, duplication, stale data sources.
4. isHistoryMode / RUN_MODE branching that silently changes source (extend_db vs db_ptrj) and breaks parity.
5. Seeder writes manual adjustments vs extractor reads them: source mismatch (auto-buffer vs manual vs DB).
6. invalidatePayroll cache: missing after seeder writes → stale reads.
7. Type errors seen in tsc (SeederOptions.createdBy required, rowsAffected on any[], useParallel) — list as inconsistencies.

Concrete findings via StructuredOutput, evidence path:line.`
  },
  {
    key: 'db-profile-routing',
    prompt: `You are auditing DATABASE PROFILE ROUTING for INCONSISTENCIES in repo at ${ROOT}. Per CLAUDE.md: extend_db_ptrj + analysis + aggregation MUST use SERVER_PROFILE_1; employee/FFB use SERVER_PROFILE_3 (VenusHR14/db_ptrj_mill); payroll data db_ptrj uses SERVER_PROFILE_2 / Config.DB_PROFILE. HR_GANG lives in db_ptrj.

Scope:
- backend/src/db/client.ts, backend/src/config.ts (profiles, DB_PROFILE, DB_EXTEND_PROFILE)
- All services: grep for Database.getInstance / getExtendedInstance / getVenusInstance / SERVER_PROFILE
- Recently fixed: dashboardService.getAllGangsTrend + executive-summary (HR_GANG was queried on extendDb = wrong). Find OTHER instances of the same bug class.

Find inconsistencies ONLY (this is the highest-value audit):
1. Any HR_GANG / HR_GANGLN / HR_EMPLOYEE query routed to extend_db_ptrj (PROFILE_1) — should be db_ptrj (PROFILE_2/default).
2. Aggregation/analysis queries on wrong profile.
3. Employee/FFB queries not on Venus/mill profile.
4. Hardcoded profile strings vs Config.DB_PROFILE divergence.
5. Cross-DB subqueries that fail at runtime (like the HR_GANG bug) — query A on profile X joining table only on profile Y.
6. getExtendedInstance vs getInstance misuse.

For each: severity, files path:line, evidence (the query + profile), impact (500 error / wrong data / silent fallback), suggestedFix. This audit is critical — be thorough. Return via StructuredOutput.`
  },
  {
    key: 'snapshot-history-flow',
    prompt: `You are auditing the SNAPSHOT / HISTORY data flow for INCONSISTENCIES in repo at ${ROOT}.

Scope:
- backend/src/services/historyDatabaseService.ts (getHistoricalPayrollDataAsExtractorFormat, snapshot_version, isHistoryMode)
- backend/src/repositories/history/PayrollHistoryRepository.ts
- backend/src/services/dataExtractorService.ts (history intercept ~line 820, db_ptrj_only path)
- backend/src/api/payroll.ts (snapshot_version/requested/available in response ~3057)
- backend/src/api/taxReportRoutes.ts (snapshot fields ~805)
- frontend CustomPayrollTable.jsx (snapshot UI — does it exist?)

Find inconsistencies ONLY:
1. snapshot_version meta: backend returns it now (recent fix), but do ALL callers (payroll.ts, taxReportRoutes.ts) propagate it? Frontend reads it?
2. isHistoryMode = RUN_MODE==='prod' — dev mode never hits snapshot, masking bugs.
3. available_snapshot_versions lists versions globally for period but requested version may return null for specific division (edge case) — is that handled or silent 500?
4. History path returns early (line ~844) with historyData.meta — does its shape satisfy extractPayrollData return type? (recent type change)
5. Snapshot write (seeder) vs read parity: written as INT NULL, read with ISNULL(...,0) — version 0 vs NULL ambiguity.
6. taxReport snapshot vs payroll snapshot: same source? divergent fields (is_history_snapshot missing in taxReport response)?

Concrete findings via StructuredOutput, evidence path:line.`
  },
  {
    key: 'auth-access-matrix',
    prompt: `You are auditing AUTH / ACCESS CONTROL for INCONSISTENCIES in repo at ${ROOT}.

Scope:
- backend/src/utils/authBypass.ts (hasValidApiKeyBypass, resolveUserFromHeaders)
- backend/src/services/authService.ts
- backend/src/api/payroll.ts (ProtectedRoute? currentUser checks, role gates on manual-edit/premium/seeder endpoints)
- backend/src/api/aggregationSeederRoutes.ts, uiBasedSeeder.ts (who can seed?)
- frontend App.jsx (ProtectedRoute, role checks, isAdminUser scope leak — recent fix removed out-of-scope block)

Find inconsistencies ONLY:
1. Manual-edit / premium-import / seeder endpoints: inconsistent auth (some api-key bypass, some token, some role check missing).
2. Role matrix divergence: backend role names (ADMIN, KERANI, FINANCE) vs frontend guessRole mapping — do gates agree?
3. Kerani locked-division bypass: can a kerani hit another division's manual-edit?
4. api-key bypass grants admin-equivalent without role scoping — over-permissive?
5. Frontend isAdminUser referenced out of component scope (was a bug; verify no regressions).
6. Endpoints that mutate (save/edit/seed) lacking CSRF/origin or write-rate-limit (Phase 4.4 rate limiter — is it applied to all writes?).

Concrete findings via StructuredOutput, evidence path:line.`
  }
]

phase('Audit')

const results = await parallel(AUDITORS.map(a => () =>
  agent(a.prompt, { label: `audit:${a.key}`, phase: 'Audit', schema: FINDINGS_SCHEMA, agentType: 'Explore' })
    .then(r => ({ subsystem: a.key, ...r }))
    .catch(() => null)
))

const auditResults = results.filter(Boolean)
const allFindings = auditResults.flatMap(r => (r.inconsistencies || []).map(f => ({ ...f, subsystem: r.subsystem })))
log(`Auditors done: ${auditResults.length}/${AUDITORS.length} | total findings: ${allFindings.length}`)

phase('Synthesize')

const synthesis = await agent(
  `You are the lead auditor. Below are structured inconsistency findings from ${AUDITORS.length} parallel auditors of a payroll system (PT Rebinmas, branch server-dev-merger-1, repo ${ROOT}).

Raw findings (JSON):
${JSON.stringify(allFindings, null, 2)}

Produce TWO markdown documents as your return value (just the markdown text, no preamble):

=== DOCUMENT 1: AUDIT_REPORT.md ===
A maintained-able audit report with sections:
- Executive summary (counts by severity, top 5 risks)
- Per-subsystem findings table (subsystem | severity | title | files | impact)
- Detailed findings (each: evidence quote, impact, suggested fix)

=== DOCUMENT 2: FIX_PLAN.md ===
A prioritized fix plan:
- P0 (critical/data-loss/security): immediate, with exact file:line + concrete fix steps
- P1 (high): this sprint
- P2 (medium): next sprint
- P3 (low): backlog
- Each item: title, subsystem, effort (S/M/L), dependencies, acceptance criteria
- A "quick wins" section (items doable in <1hr each)
- A "do not break" list (what NOT to touch: PTRJ AccMonth=CalendarMonth rule, business calc logic)

Be concrete and reference real files. Group duplicates across auditors into one item. Mark cross-subsystem root causes explicitly.`,
  { label: 'synthesize:report+plan', phase: 'Synthesize' }
)

return { auditCount: auditResults.length, findingCount: allFindings.length, synthesis }
