# CLAUDE.md - Refactor Production

This file provides guidance for working with the refactored production codebase.

## Database Connection Rules (CRITICAL)

**ALWAYS use `SERVER_PROFILE_1` for:**
- `extend_db_ptrj` database
- Analysis Report queries
- Aggregation tables (`daftar_upah_aggregation_history`)
- Summary Report queries

**Use `SERVER_PROFILE_3` (VenusHR14) for:**
- Employee master data
- FFB weight queries (from `db_ptrj_mill` database)

### Connection Methods

```typescript
// CORRECT - For extend_db_ptrj, analysis, aggregation
const db = Database.getExtendedInstance(); // Uses SERVER_PROFILE_1

// CORRECT - For employee data
const db = Database.getVenusInstance(); // Uses SERVER_PROFILE_3

// WRONG - Never use VenusInstance for extend_db_ptrj!
```

## Database Sources for Aggregation Data

### `db_ptrj_mill` Database (SERVER_PROFILE_3)

The following data comes from `db_ptrj_mill` database via `SERVER_PROFILE_3`:

| Field | Source Table | Status |
|-------|--------------|--------|
| `total_ffb_weight` | WM_TICKET | **NULL** - Not implemented yet |
| `premi_prunning` | Dynamic Premi | **NULL** - Not implemented yet |
| `premi_insentif` | Dynamic Premi | **NULL** - Not implemented yet |
| `premi_kinerja` | Dynamic Premi | **NULL** - Not implemented yet |
| `total_koreksi` | Correction Table | **NULL** - Not implemented yet |

**IMPORTANT:**
- FFB weight is obtained from `db_ptrj_mill` database (always available on `SERVER_PROFILE_3`)
- Dynamic Premi data (prunning, insentif panen, kinerja) comes from `db_ptrj_mill`
- Total Koreksi data is stored separately
- **CURRENT STATUS**: All these fields are currently **NULL** - implementation pending

### FFB Weight Query (Not Yet Implemented)

```typescript
// TODO: Implement FFB weight from db_ptrj_mill
// Current implementation returns 0 because WM_TICKET table doesn't exist in VenusHR14
async function fetchFfbWeightForDivision(divisionCode: string, month: number, year: number): Promise<number> {
    // DISABLED: WM_TICKET table is in db_ptrj_mill, not VenusHR14
    // Need to create getMillInstance() for db_ptrj_mill connection
    return 0; // Currently returns 0
}
```

### Dynamic Premi Fields (Not Yet Implemented)

The following `dynamic_premi` fields are not yet populated:
- **Prunning** (`premi_prunning`) - Prunning activity bonuses
- **Insentif Panen** (`premi_insentif`) - Harvest incentives
- **Kinerja** (`premi_kinerja`) - Performance bonuses
- **Koreksi** (`total_koreksi`) - Manual corrections

These should come from `db_ptrj_mill` database when implemented.

## SQL Query Parameter Rules

**ALWAYS use `?` placeholders with array params:**

```typescript
// CORRECT
const result = await db.queryOne(`
    SELECT * FROM table WHERE col1 = ? AND col2 = ?
`, [value1, value2]);

// WRONG - Do NOT use @p0, @p1 with array params
const result = await db.queryOne(`
    SELECT * FROM table WHERE col1 = @p0 AND col2 = @p1
`, [value1, value2]);
```

The `prepareParams` function automatically converts `?` to `@p0`, `@p1`, etc.

## Frontend Dev Server

If you encounter "Outdated Optimize Dep" error:
```bash
cd frontend
rm -rf node_modules/.vite
npm install
# Then restart dev server
```

## Aggregation Seeder

The Aggregation Seeder modal is available in:
- **Analysis Report Page** - Yellow "SEED AGGREGATION" button
- **Summary Report Page** - Yellow "Seed Aggregation" button

Both use the same `AggregationSeederModal` component.
