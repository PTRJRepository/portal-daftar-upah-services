export const meta = {
  name: 'investigate-canonical',
  description: 'Investigate 5 INVESTIGATE-flagged divergences (C3/C5/L8/L9/L18) dev vs canonical c9e72ff6; verdict KEEP vs REVERT each',
  phases: [{ title: 'Investigate', detail: 'one agent per item, read dev+canonical, judge intent' }]
}

const CANONICAL = 'c9e72ff6'
const ROOT = 'D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production'

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    file: { type: 'string' },
    devBehavior: { type: 'string' },
    canonicalBehavior: { type: 'string' },
    isIntentionalDevFeature: { type: 'boolean' },
    verdict: { type: 'string', enum: ['KEEP-DEV', 'REVERT-TO-CANONICAL', 'MERGE-BOTH', 'NEEDS-USER-DECISION'] },
    rationale: { type: 'string' },
    evidence: { type: 'string' },
    outputImpact: { type: 'string' }
  },
  required: ['item', 'file', 'devBehavior', 'canonicalBehavior', 'isIntentionalDevFeature', 'verdict', 'rationale', 'evidence', 'outputImpact']
}

const ITEMS = [
  {
    item: 'C3-snapshot-versioning',
    path: 'backend/src/services/historyDatabaseService.ts',
    prompt: `Investigate divergence C3 in ${ROOT}: dev (HEAD) vs canonical ${CANONICAL}.

Context: dev added requestedSnapshotVersion param + available_snapshot_versions array to getHistoricalPayrollDataAsExtractorFormat. Canonical has neither (always picks latest via MAX subquery). This was added earlier per explicit user request ("payroll snapshot belum aktif, masih hardcoded").

Run: git diff HEAD ${CANONICAL} -- backend/src/services/historyDatabaseService.ts
Read the snapshot-version hunks.

Determine: Is dev's snapshot versioning an INTENTIONAL feature (KEEP) or accidental drift (REVERT)? Consider:
- Does canonical break if dev's version param is null/absent? (dev should fall back to MAX = canonical behavior)
- Is the version field additive (new optional param) or does it alter canonical query shape?
- Does it change output numbers when no version requested? (if null→MAX, output same as canonical)

Verdict: KEEP-DEV if additive + backward-compatible (null=canonical). REVERT only if it breaks canonical query/output. Return via StructuredOutput.`
  },
  {
    item: 'C5-dashboard-gang-filters',
    path: 'backend/src/api/dashboardRoutes.ts backend/src/services/dashboardService.ts',
    prompt: `Investigate C5 in ${ROOT}: dev vs canonical ${CANONICAL}.

Context: dev added division_code/gang_code/gang_prefix filters to executive-summary + 6 dashboard service methods (getPayrollTrend etc). Canonical: single aggregate, no filters. Added earlier per user request ("KPI tampilk sesuai divisinya").

Run: git diff HEAD ${CANONICAL} -- backend/src/api/dashboardRoutes.ts backend/src/services/dashboardService.ts
Read the filter hunks.

Determine: Is dev's per-division/gang filtering INTENTIONAL (KEEP) or drift (REVERT)?
- When NO division_code passed (param absent), does dev return same aggregate as canonical? (must be backward-compatible)
- Does filtering alter canonical aggregate math or just narrow the IN(...) gang set?
- Is the gang-filter helper (buildGangCodeFilter) additive?

Verdict: KEEP-DEV if backward-compatible (no filter = canonical aggregate). REVERT if it changes default aggregate. Return via StructuredOutput.`
  },
  {
    item: 'L8-static-serving',
    path: 'backend/src/index.ts',
    prompt: `Investigate L8 in ${ROOT}: dev vs canonical ${CANONICAL}.

Context: dev uses @elysiajs/static plugin + manual serveDistAsset() + noCacheHeaders. Canonical uses custom serveStaticAsset() with .br/.gz precompressed lookup, contentTypeFor(), 1yr immutable cache, Accept-Encoding vary, serveIndexHtml() SPA fallback.

Run: git diff HEAD ${CANONICAL} -- backend/src/index.ts
Read static-serving hunks (the /, /index.html, /assets/*, /images/*, /upah/* route handlers).

Determine: Is dev's @elysiajs/static an INTENTIONAL simplification (KEEP) or lost canonical perf (REVERT)?
- Canonical's precompressed br/gz + immutable cache = real perf win. Dev's noCacheHeaders on HTML is fine, but dev loses br/gz for assets?
- Does dev still serve dist correctly? (build passes, /upah works per earlier tests)
- Is canonical's custom impl more correct (precompression) or just different?

Verdict: REVERT-TO-CANONICAL if dev lost precompression/immutable cache (perf regression). MERGE-BOTH if dev's approach also valid. Return via StructuredOutput.`
  },
  {
    item: 'L9-premium-seeder-routes',
    path: 'backend/src/api/payroll.ts',
    prompt: `Investigate L9 in ${ROOT}: dev vs canonical ${CANONICAL}.

Context: dev has GET /payroll/premium-seeder/progress + /template (lazy import premiumImportService, Excel Content-Disposition). Canonical has none. Came from server-fix-1 merge (cherry-picked).

Run: git diff HEAD ${CANONICAL} -- backend/src/api/payroll.ts
Find the premium-seeder route hunks (search 'premium-seeder').

Determine: Is dev's premium-seeder routes INTENTIONAL feature (KEEP) or orphan (REVERT)?
- Does canonical have premiumImportService at all? (git show c9e72ff6:backend/src/services/premiumImportService.ts — exists?)
- Are these routes referenced by frontend? (grep frontend for premium-seeder)
- Additive (new routes) or do they conflict with canonical payroll routes?

Verdict: KEEP-DEV if additive + frontend uses them. REVERT if orphan/dead. Return via StructuredOutput.`
  },
  {
    item: 'L18-apiBase-proxy',
    path: 'frontend/src/utils/apiBase.js',
    prompt: `Investigate L18 in ${ROOT}: dev vs canonical ${CANONICAL}.

Context: dev has frontend/src/utils/apiBase.js with buildBackendUrl() (proxy-aware, /upah prefix in prod). Canonical uses relative paths (no proxy helper). Dev added for proxy gateway support.

Run: git diff HEAD ${CANONICAL} -- frontend/src/utils/apiBase.js
Also: git show ${CANONICAL}:frontend/src/utils/apiBase.js (does it exist in canonical?)
And grep: how many frontend files call buildBackendUrl? (git grep buildBackendUrl -- frontend/src)

Determine: Is dev's apiBase/buildBackendUrl INTENTIONAL (KEEP) or drift (REVERT)?
- Canonical may rely on Vite proxy in dev + same-origin in prod. Dev's buildBackendUrl handles /upah prefix explicitly.
- If canonical frontend works behind proxy without it, dev's is redundant but harmless. If canonical breaks behind proxy, dev's is needed.
- Is buildBackendUrl used pervasively (many callers = KEEP)?

Verdict: KEEP-DEV if used pervasively + needed for proxy. MERGE-BOTH if canonical approach also viable. Return via StructuredOutput.`
  }
]

phase('Investigate')

const results = await parallel(ITEMS.map(it => () =>
  agent(it.prompt, { label: `inv:${it.item}`, phase: 'Investigate', schema: VERDICT_SCHEMA, agentType: 'Explore' })
    .then(r => ({ item: it.item, ...r }))
    .catch(() => null)
))

const verdicts = results.filter(Boolean)
log(`Investigated: ${verdicts.length}/${ITEMS.length}`)
verdicts.forEach(v => log(`${v.item}: ${v.verdict} (${v.isIntentionalDevFeature ? 'intentional' : 'drift'})`))

return { investigated: verdicts.length, verdicts }
