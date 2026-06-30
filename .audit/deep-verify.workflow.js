export const meta = {
  name: 'deep-verify-parity',
  description: 'Deep verify dev vs live parity: all divisions x Mei/Juni, per-emp diff, tax report, seeder output',
  phases: [
    { title: 'Verify', detail: 'one agent per division-batch, per-emp diff dev vs live' },
    { title: 'Synthesize', detail: 'merge into DEEP_VERIFY_REPORT.md' }
  ]
}

const K = "88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"
const LIVE = "http://ptrjestate.rebinmas.com:3001"
const DEV = "http://localhost:8002"

const DIFF_SCHEMA = {
  type: 'object',
  properties: {
    batch: { type: 'string' },
    divisions: { type: 'array', items: { type: 'string' } },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          division: { type: 'string' },
          month: { type: 'number' },
          year: { type: 'number' },
          devGrand: { type: 'number' },
          liveGrand: { type: 'number' },
          matched: { type: 'boolean' },
          empDiffs: { type: 'array', items: { type: 'string' } },
          diffCount: { type: 'number' },
          error: { type: 'string' }
        },
        required: ['division', 'month', 'year', 'matched']
      }
    }
  },
  required: ['batch', 'results']
}

// Division batches. Agent fetches raw-tree per (division, month) dev vs live,
// computes grand upah_bersih + per-emp diff. Use Bash curl via the agent
// (agents have Bash). Backend dev assumed running on :8002.
const BATCHES = [
  { batch: 'estate-A', divisions: ['PG1A','PG1B','PG2A','PG2B'] },
  { batch: 'estate-B', divisions: ['DME','ARA','ARB1','ARB2','ARC'] },
  { batch: 'support', divisions: ['IJL','INF','PGE','STF-OFFICE','SECURITY'] },
]

phase('Verify')

const results = await parallel(BATCHES.map(b => () =>
  agent(`Deep verify payroll parity dev vs live for divisions: ${b.divisions.join(', ')}.

For EACH division x EACH month in [5 (May), 6 (June)] x year 2026:
1. Fetch dev: curl -s -m 90 -H "x-api-key: ${K}" "${DEV}/payroll/report/division-raw-tree?division_code=DIV&month=M&year=2026&gang_code=ALL"
2. Fetch live: first login: curl -s -X POST "${LIVE}/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin","password":"admin123"}' to get token (grep '"token":"..."'). Then curl -s -m 90 -H "Authorization: Bearer TOKEN" "${LIVE}/upah/payroll/report/division-raw-tree?division_code=DIV&month=M&year=2026&gang_code=ALL"
3. Compute grand sum of all "upah_bersih":NUMBER values in each response (use grep -oE '"upah_bersih":[0-9.]+' | awk sum, or node).
4. Per-emp diff: extract emp_code + upah_bersih pairs, find employees where values differ.
5. Record: division, month, year, devGrand, liveGrand, matched (abs diff < 1), diffCount, empDiffs (list up to 5 "EMP: dev=X live=Y"), error if fetch failed.

Use Bash tool with curl. Save responses to /tmp if needed. If a fetch times out, retry once with -m 120. If still fails, record error.

Return via StructuredOutput schema. Be thorough — every division x month.`, { label: `verify:${b.batch}`, phase: 'Verify', schema: DIFF_SCHEMA })
    .then(r => ({ batch: b.batch, ...r }))
    .catch(() => null)
))

const verifyResults = results.filter(Boolean)
const allResults = verifyResults.flatMap(r => r.results || [])
const mismatches = allResults.filter(r => !r.matched)
log(`Verified: ${allResults.length} division-month combos | mismatches: ${mismatches.length}`)

phase('Synthesize')

const report = await agent(
  `Synthesize DEEP_VERIFY_REPORT.md from parity verification (dev server-dev-merger-1 vs live ptrjestate:3001) across divisions x May/June 2026.

Raw results JSON:
${JSON.stringify(allResults, null, 2)}

Produce markdown (no preamble):
1. Executive summary: total combos verified, matched count, mismatched count. If all match: state "FULL PARITY ACHIEVED".
2. Per-division table: division | May (dev/live/match) | June (dev/live/match).
3. Mismatch detail (if any): per-emp diffs, suspected cause.
4. Conclusion: is dev logic now equivalent to live for payroll output?

Cite real numbers. Be concise.`, { label: 'synthesize:deep-verify', phase: 'Synthesize' })

return { combos: allResults.length, mismatches: mismatches.length, report }
