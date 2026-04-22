# Extend DB Persistent Payroll History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `extend_db_ptrj` overlay history + immutable snapshot versioning for Daftar Upah, including editable SPSI membership, effective start date, masa kerja display, and per-period payroll overrides.

**Architecture:** Keep `db_ptrj` as the live extractor source, store all manual edits in append-only overlay tables inside `extend_db_ptrj`, and freeze history through explicit snapshot batches. Live Daftar Upah reads `base + latest overlay`, while history reads a selected `snapshot_version` only. The implementation must reuse the existing THR-oriented join date semantics instead of inventing a second masa kerja rule.

**Tech Stack:** Bun, TypeScript, Elysia, SQL Server, React, Vite, existing `Database` client and payroll/history services

---

## File Structure

**Create**
- `backend/sql/migrations/add_payroll_overlay_history_tables.sql`
  - New append-only overlay tables and immutable snapshot batch metadata.
- `backend/_dev_utils/tests/test_payroll_overlay_schema.ts`
  - Schema smoke test for new tables/indexes.
- `backend/src/types/payroll/payrollOverlay.ts`
  - Shared backend types for profile overrides, value overrides, snapshot batches, and projection rows.
- `backend/src/utils/payrollProfileRules.ts`
  - Pure rules for SPSI seed, effective start date normalization, and masa kerja display math.
- `backend/src/utils/payrollProfileRules.test.ts`
  - Unit tests for rule correctness.
- `backend/src/utils/payrollOverlayLatest.ts`
  - Pure selectors/helpers for “pick latest by update_index” and “pick latest by snapshot_version”.
- `backend/src/utils/payrollOverlayLatest.test.ts`
  - Unit tests for latest-row semantics.
- `backend/src/services/payrollOverlayService.ts`
  - All reads/writes to `employee_profile_override_history` and `payroll_value_override_history`.
- `backend/src/services/payrollWorkingProjectionService.ts`
  - Applies latest overlays to extractor rows and recalculates exposed fields.
- `backend/src/services/payrollWorkingProjectionService.test.ts`
  - Unit tests for `base + overlay` projection behavior.
- `backend/src/services/payrollSnapshotBatchService.ts`
  - Create/find latest snapshot batch and enforce `snapshot_version` increments.
- `backend/src/services/payrollProfileSeedService.ts`
  - Seed SPSI and effective start data from March and THR-compatible join date semantics.
- `frontend/src/utils/payrollEditPayloads.js`
  - Split UI edits into profile override payloads vs period override payloads.
- `frontend/src/utils/payrollEditPayloads.test.js`
  - Unit tests for payload splitting and normalization.

**Modify**
- `backend/src/api/payroll.ts`
  - Add overlay endpoints and route-level comments that snapshots are immutable.
- `backend/src/services/dataExtractorService.ts`
  - Feed live rows through `payrollWorkingProjectionService` and expose new display fields.
- `backend/src/services/historySeederService.ts`
  - Generate `snapshot_version`, apply overlays before writing snapshot, and seed March profile rows when requested.
- `backend/src/services/historyDatabaseService.ts`
  - Read snapshot data by `snapshot_version`; stop treating old history rows as editable master.
- `backend/src/services/manualAdjustmentService.ts`
  - Keep legacy endpoint behavior intact but route the targeted new fields away from mutable legacy tables.
- `backend/src/services/otherIncomesService.ts`
  - Reuse THR join date semantics via helper, not copy-paste.
- `frontend/src/components/CustomPayrollTable.jsx`
  - Show SPSI, effective start date, masa kerja, edit controls, overlay save state, and save flow to new endpoints.
- `frontend/src/services/lockedDivisionService.js`
  - Add prod-mode wrappers for the new overlay endpoints if needed by deployment mode.

## Constraints

- Snapshot tables are immutable. Never write user edits directly into snapshot tables.
- Latest overlay rows must always be resolved by highest `update_index`.
- Latest snapshots must always be resolved by requested `snapshot_version` or highest available `snapshot_version`.
- `history_hr_employee`, `history_gang_member`, and similar history tables are not the editable master for this feature.
- The worktree is already dirty. Do not revert or stage unrelated files while executing this plan.

### Task 1: Add Overlay and Snapshot Batch Schema

**Files:**
- Create: `backend/sql/migrations/add_payroll_overlay_history_tables.sql`
- Create: `backend/_dev_utils/tests/test_payroll_overlay_schema.ts`

- [ ] **Step 1: Write the failing schema smoke test**

```ts
import { Database } from "../../src/db/client";

const REQUIRED_TABLES = [
  "employee_profile_override_history",
  "payroll_value_override_history",
  "payroll_snapshot_batch"
];

const REQUIRED_INDEXES = [
  "IX_profile_override_emp_update",
  "IX_payroll_value_override_scope_update",
  "IX_payroll_snapshot_batch_scope_version"
];

async function main() {
  const db = Database.getExtendedInstance();

  const tables = await db.query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})
  `, REQUIRED_TABLES);

  const indexes = await db.query<{ name: string }>(`
    SELECT name
    FROM sys.indexes
    WHERE name IN (${REQUIRED_INDEXES.map(() => "?").join(",")})
  `, REQUIRED_INDEXES);

  const missingTables = REQUIRED_TABLES.filter(
    (name) => !tables.some((row) => row.TABLE_NAME === name)
  );
  const missingIndexes = REQUIRED_INDEXES.filter(
    (name) => !indexes.some((row) => row.name === name)
  );

  if (missingTables.length || missingIndexes.length) {
    throw new Error(
      `Missing tables=${missingTables.join(",") || "-"} indexes=${missingIndexes.join(",") || "-"}`
    );
  }

  console.log("overlay schema ready");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the schema smoke test to verify it fails**

Run: `Set-Location backend; bun run .\_dev_utils\tests\test_payroll_overlay_schema.ts`  
Expected: FAIL with missing table/index names.

- [ ] **Step 3: Add the migration for append-only overlay tables and snapshot batches**

```sql
IF NOT EXISTS (
    SELECT * FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[employee_profile_override_history]')
      AND type in (N'U')
)
BEGIN
    CREATE TABLE [dbo].[employee_profile_override_history] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [emp_code] NVARCHAR(32) NOT NULL,
        [nik] NVARCHAR(32) NULL,
        [is_spsi_member] BIT NOT NULL,
        [effective_start_date] DATE NULL,
        [employee_status_at_change] NVARCHAR(32) NULL,
        [update_index] INT NOT NULL,
        [change_source] NVARCHAR(64) NOT NULL,
        [change_reason] NVARCHAR(255) NULL,
        [changed_by] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_profile_override_created_at] DEFAULT SYSUTCDATETIME(),
        [is_active_record] BIT NOT NULL CONSTRAINT [DF_profile_override_active] DEFAULT 1,
        CONSTRAINT [PK_employee_profile_override_history] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_profile_override_emp_update]
    ON [dbo].[employee_profile_override_history] ([emp_code] ASC, [update_index] DESC);
END;

IF NOT EXISTS (
    SELECT * FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[payroll_value_override_history]')
      AND type in (N'U')
)
BEGIN
    CREATE TABLE [dbo].[payroll_value_override_history] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [period_month] INT NOT NULL,
        [period_year] INT NOT NULL,
        [division_code] NVARCHAR(32) NOT NULL,
        [gang_code] NVARCHAR(32) NOT NULL,
        [emp_code] NVARCHAR(32) NOT NULL,
        [nik] NVARCHAR(32) NULL,
        [field_name] NVARCHAR(64) NOT NULL,
        [field_group] NVARCHAR(32) NOT NULL,
        [numeric_value] DECIMAL(18,2) NULL,
        [text_value] NVARCHAR(255) NULL,
        [update_index] INT NOT NULL,
        [change_source] NVARCHAR(64) NOT NULL,
        [change_reason] NVARCHAR(255) NULL,
        [changed_by] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_value_override_created_at] DEFAULT SYSUTCDATETIME(),
        [is_active_record] BIT NOT NULL CONSTRAINT [DF_value_override_active] DEFAULT 1,
        CONSTRAINT [PK_payroll_value_override_history] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_payroll_value_override_scope_update]
    ON [dbo].[payroll_value_override_history] (
        [period_year] ASC,
        [period_month] ASC,
        [division_code] ASC,
        [gang_code] ASC,
        [emp_code] ASC,
        [field_name] ASC,
        [update_index] DESC
    );
END;

IF NOT EXISTS (
    SELECT * FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[payroll_snapshot_batch]')
      AND type in (N'U')
)
BEGIN
    CREATE TABLE [dbo].[payroll_snapshot_batch] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [period_month] INT NOT NULL,
        [period_year] INT NOT NULL,
        [division_code] NVARCHAR(32) NOT NULL,
        [gang_code] NVARCHAR(32) NOT NULL,
        [snapshot_version] INT NOT NULL,
        [base_source] NVARCHAR(64) NOT NULL,
        [overlay_profile_cutoff] DATETIME2 NULL,
        [overlay_value_cutoff] DATETIME2 NULL,
        [created_by] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_snapshot_batch_created_at] DEFAULT SYSUTCDATETIME(),
        [status] NVARCHAR(32) NOT NULL,
        [notes] NVARCHAR(255) NULL,
        CONSTRAINT [PK_payroll_snapshot_batch] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE UNIQUE NONCLUSTERED INDEX [IX_payroll_snapshot_batch_scope_version]
    ON [dbo].[payroll_snapshot_batch] (
        [period_year] ASC,
        [period_month] ASC,
        [division_code] ASC,
        [gang_code] ASC,
        [snapshot_version] ASC
    );
END;
```

- [ ] **Step 4: Rerun the schema smoke test**

Run: `Set-Location backend; bun run .\_dev_utils\tests\test_payroll_overlay_schema.ts`  
Expected: PASS with `overlay schema ready`.

### Task 2: Add Pure Rules for Profile Seed, Latest Resolution, and Masa Kerja Math

**Files:**
- Create: `backend/src/types/payroll/payrollOverlay.ts`
- Create: `backend/src/utils/payrollProfileRules.ts`
- Create: `backend/src/utils/payrollProfileRules.test.ts`
- Create: `backend/src/utils/payrollOverlayLatest.ts`
- Create: `backend/src/utils/payrollOverlayLatest.test.ts`

- [ ] **Step 1: Write the failing profile rules tests**

```ts
import { describe, expect, it } from "bun:test";
import {
  calculateMasaKerjaDisplay,
  deriveInitialSpsiMember,
  normalizeEffectiveStartDate
} from "./payrollProfileRules";

describe("payrollProfileRules", () => {
  it("seeds SPSI member from March potongan", () => {
    expect(deriveInitialSpsiMember(1500)).toBe(true);
    expect(deriveInitialSpsiMember(0)).toBe(false);
  });

  it("normalizes editable effective start date", () => {
    expect(normalizeEffectiveStartDate(" 2026-03-15 ")).toBe("2026-03-15");
    expect(normalizeEffectiveStartDate("")).toBeNull();
  });

  it("calculates masa kerja against selected period", () => {
    expect(calculateMasaKerjaDisplay("2025-02-10", 4, 2026)).toEqual({
      years: 1,
      months: 2,
      label: "1 thn 2 bln"
    });
  });
});
```

- [ ] **Step 2: Write the failing latest-resolution tests**

```ts
import { describe, expect, it } from "bun:test";
import {
  pickLatestProfileOverrides,
  pickLatestValueOverrides
} from "./payrollOverlayLatest";

describe("payrollOverlayLatest", () => {
  it("keeps the highest update_index per emp_code", () => {
    const latest = pickLatestProfileOverrides([
      { emp_code: "B0001", update_index: 1, is_spsi_member: false },
      { emp_code: "B0001", update_index: 3, is_spsi_member: true }
    ] as any);

    expect(latest.get("B0001")?.is_spsi_member).toBe(true);
  });

  it("keeps the highest update_index per period scope and field", () => {
    const latest = pickLatestValueOverrides([
      { emp_code: "B0001", field_name: "premi_dynamic", update_index: 2, numeric_value: 9000, period_month: 4, period_year: 2026, division_code: "AB1", gang_code: "A1" },
      { emp_code: "B0001", field_name: "premi_dynamic", update_index: 4, numeric_value: 12000, period_month: 4, period_year: 2026, division_code: "AB1", gang_code: "A1" }
    ] as any);

    expect(latest.get("2026:4:AB1:A1:B0001:premi_dynamic")?.numeric_value).toBe(12000);
  });
});
```

- [ ] **Step 3: Run the rule tests to verify they fail**

Run: `Set-Location backend; bun test .\src\utils\payrollProfileRules.test.ts .\src\utils\payrollOverlayLatest.test.ts`  
Expected: FAIL with missing modules/functions.

- [ ] **Step 4: Implement the shared types and pure helpers**

```ts
export interface EmployeeProfileOverrideRow {
  emp_code: string;
  nik?: string | null;
  is_spsi_member: boolean;
  effective_start_date?: string | null;
  update_index: number;
}

export interface PayrollValueOverrideRow {
  period_month: number;
  period_year: number;
  division_code: string;
  gang_code: string;
  emp_code: string;
  field_name: string;
  numeric_value?: number | null;
  text_value?: string | null;
  update_index: number;
}

export function deriveInitialSpsiMember(potSpsi: number | null | undefined): boolean {
  return Number(potSpsi || 0) > 0;
}

export function normalizeEffectiveStartDate(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

export function calculateMasaKerjaDisplay(startDate: string | null | undefined, month: number, year: number) {
  if (!startDate) return { years: 0, months: 0, label: "0 bln" };
  const start = new Date(`${startDate}T00:00:00`);
  const period = new Date(year, month - 1, 1);
  const totalMonths = Math.max(
    0,
    (period.getFullYear() - start.getFullYear()) * 12 + (period.getMonth() - start.getMonth())
  );
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return { years, months, label: years > 0 ? `${years} thn ${months} bln` : `${months} bln` };
}
```

- [ ] **Step 5: Implement latest-row selectors**

```ts
import type { EmployeeProfileOverrideRow, PayrollValueOverrideRow } from "../types/payroll/payrollOverlay";

export function pickLatestProfileOverrides(rows: EmployeeProfileOverrideRow[]) {
  const latest = new Map<string, EmployeeProfileOverrideRow>();
  for (const row of rows) {
    const current = latest.get(row.emp_code);
    if (!current || row.update_index > current.update_index) {
      latest.set(row.emp_code, row);
    }
  }
  return latest;
}

export function buildValueOverrideKey(row: Pick<PayrollValueOverrideRow, "period_year" | "period_month" | "division_code" | "gang_code" | "emp_code" | "field_name">) {
  return `${row.period_year}:${row.period_month}:${row.division_code}:${row.gang_code}:${row.emp_code}:${row.field_name}`;
}

export function pickLatestValueOverrides(rows: PayrollValueOverrideRow[]) {
  const latest = new Map<string, PayrollValueOverrideRow>();
  for (const row of rows) {
    const key = buildValueOverrideKey(row);
    const current = latest.get(key);
    if (!current || row.update_index > current.update_index) {
      latest.set(key, row);
    }
  }
  return latest;
}
```

- [ ] **Step 6: Run the rule tests again**

Run: `Set-Location backend; bun test .\src\utils\payrollProfileRules.test.ts .\src\utils\payrollOverlayLatest.test.ts`  
Expected: PASS.

### Task 3: Implement Overlay Persistence Service and Payroll API Endpoints

**Files:**
- Create: `backend/src/services/payrollOverlayService.ts`
- Create: `backend/src/services/payrollProfileSeedService.ts`
- Modify: `backend/src/api/payroll.ts`
- Modify: `backend/src/services/manualAdjustmentService.ts`
- Modify: `backend/src/services/otherIncomesService.ts`

- [ ] **Step 1: Write a failing payload/service smoke test for profile/value save shapes**

```ts
import { describe, expect, it } from "bun:test";
import { normalizeEffectiveStartDate } from "../utils/payrollProfileRules";

describe("overlay payload contract", () => {
  it("normalizes profile payload for append-only write", () => {
    expect({
      emp_code: "B0001",
      is_spsi_member: true,
      effective_start_date: normalizeEffectiveStartDate("2024-01-10")
    }).toEqual({
      emp_code: "B0001",
      is_spsi_member: true,
      effective_start_date: "2024-01-10"
    });
  });
});
```

- [ ] **Step 2: Add the overlay service with append-only writes and big guardrail comments**

```ts
/**
 * SNAPSHOT TABLES ARE IMMUTABLE.
 * NEVER WRITE USER EDITS DIRECTLY INTO SNAPSHOT TABLES.
 * ALL MANUAL CHANGES MUST GO TO OVERLAY HISTORY TABLES.
 * LATEST OVERLAY MUST ALWAYS BE RESOLVED BY HIGHEST update_index.
 */
export class PayrollOverlayService {
  private db = Database.getExtendedInstance();

  async saveProfileOverride(input: {
    emp_code: string;
    nik?: string | null;
    is_spsi_member: boolean;
    effective_start_date?: string | null;
    changed_by: string;
    change_reason?: string | null;
    change_source: string;
    employee_status_at_change?: string | null;
  }) {
    const next = await this.db.queryOne<{ next_index: number }>(`
      SELECT ISNULL(MAX(update_index), 0) + 1 AS next_index
      FROM dbo.employee_profile_override_history
      WHERE emp_code = ?
    `, [input.emp_code]);

    const result = await this.db.query(`
      INSERT INTO dbo.employee_profile_override_history (
        emp_code, nik, is_spsi_member, effective_start_date,
        employee_status_at_change, update_index, change_source,
        change_reason, changed_by
      ) OUTPUT INSERTED.id
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      input.emp_code,
      input.nik || null,
      input.is_spsi_member ? 1 : 0,
      input.effective_start_date || null,
      input.employee_status_at_change || null,
      next?.next_index || 1,
      input.change_source,
      input.change_reason || null,
      input.changed_by
    ]);

    return result[0]?.id;
  }
}
```

- [ ] **Step 3: Add API endpoints for profile overrides and value overrides**

```ts
.post("/overrides/profile", async ({ body, currentUser, set }) => {
  try {
    const username = currentUser?.username || "system";
    const id = await payrollOverlayService.saveProfileOverride({
      ...body,
      changed_by: username,
      change_source: "DAFTAR_UPAH_UI"
    });
    return { success: true, id };
  } catch (e: any) {
    set.status = 500;
    return { success: false, error: e.message };
  }
}, {
  body: t.Object({
    emp_code: t.String(),
    nik: t.Optional(t.String()),
    is_spsi_member: t.Boolean(),
    effective_start_date: t.Optional(t.Union([t.String(), t.Null()])),
    employee_status_at_change: t.Optional(t.String()),
    change_reason: t.Optional(t.String())
  })
})
.post("/overrides/values", async ({ body, currentUser, set }) => {
  try {
    const username = currentUser?.username || "system";
    const ids = await payrollOverlayService.saveValueOverrides(body.items, username);
    return { success: true, ids };
  } catch (e: any) {
    set.status = 500;
    return { success: false, error: e.message };
  }
}, {
  body: t.Object({
    items: t.Array(t.Object({
      period_month: t.Number(),
      period_year: t.Number(),
      division_code: t.String(),
      gang_code: t.String(),
      emp_code: t.String(),
      nik: t.Optional(t.String()),
      field_name: t.String(),
      field_group: t.String(),
      numeric_value: t.Optional(t.Number()),
      text_value: t.Optional(t.String()),
      change_reason: t.Optional(t.String())
    }))
  })
})
```

- [ ] **Step 4: Reuse THR-compatible effective start lookup for March seed**

```ts
export class PayrollProfileSeedService {
  async buildSeedRowFromMarch(row: { emp_code: string; nik?: string | null; pot_spsi?: number; join_date?: string | null }) {
    return {
      emp_code: row.emp_code,
      nik: row.nik || null,
      is_spsi_member: deriveInitialSpsiMember(row.pot_spsi),
      effective_start_date: normalizeEffectiveStartDate(row.join_date || null)
    };
  }
}
```

- [ ] **Step 5: Run the backend test slice for the new helpers**

Run: `Set-Location backend; bun test .\src\utils\payrollProfileRules.test.ts .\src\utils\payrollOverlayLatest.test.ts`  
Expected: PASS.

### Task 4: Apply Latest Overlays to Live Daftar Upah Projection

**Files:**
- Create: `backend/src/services/payrollWorkingProjectionService.ts`
- Create: `backend/src/services/payrollWorkingProjectionService.test.ts`
- Modify: `backend/src/services/dataExtractorService.ts`

- [ ] **Step 1: Write the failing projection tests**

```ts
import { describe, expect, it } from "bun:test";
import { PayrollWorkingProjectionService } from "./payrollWorkingProjectionService";

describe("PayrollWorkingProjectionService", () => {
  it("applies latest SPSI and effective start override", () => {
    const service = new PayrollWorkingProjectionService();
    const rows = service.applyOverrides({
      month: 4,
      year: 2026,
      rows: [{
        emp_code: "B0001",
        nik: "3171",
        gang_code: "A1",
        division_code: "AB1",
        pot_spsi: 0,
        join_date: "2024-01-01"
      }],
      profileOverrides: new Map([["B0001", {
        emp_code: "B0001",
        is_spsi_member: true,
        effective_start_date: "2025-03-01",
        update_index: 2
      } as any]]),
      valueOverrides: new Map()
    });

    expect(rows[0].is_spsi_member).toBe(true);
    expect(rows[0].effective_start_date).toBe("2025-03-01");
    expect(rows[0].masa_kerja_label).toBe("1 thn 1 bln");
  });

  it("applies period value overrides to premi, koreksi, and potongan lain", () => {
    const service = new PayrollWorkingProjectionService();
    const rows = service.applyOverrides({
      month: 4,
      year: 2026,
      rows: [{
        emp_code: "B0001",
        nik: "3171",
        gang_code: "A1",
        division_code: "AB1",
        premi_dynamic: 1000,
        pot_koreksi: -200,
        pot_lainnya: 50
      }],
      profileOverrides: new Map(),
      valueOverrides: new Map([
        ["2026:4:AB1:A1:B0001:premi_dynamic", { numeric_value: 7000 } as any],
        ["2026:4:AB1:A1:B0001:pot_koreksi", { numeric_value: -1000 } as any]
      ])
    });

    expect(rows[0].premi_dynamic).toBe(7000);
    expect(rows[0].pot_koreksi).toBe(-1000);
  });
});
```

- [ ] **Step 2: Run the projection test to verify it fails**

Run: `Set-Location backend; bun test .\src\services\payrollWorkingProjectionService.test.ts`  
Expected: FAIL with missing service.

- [ ] **Step 3: Implement the projection service**

```ts
export class PayrollWorkingProjectionService {
  applyOverrides(input: {
    month: number;
    year: number;
    rows: any[];
    profileOverrides: Map<string, any>;
    valueOverrides: Map<string, any>;
  }) {
    return input.rows.map((row) => {
      const profile = input.profileOverrides.get(row.emp_code);
      const effectiveStart = profile?.effective_start_date || row.join_date || null;
      const masaKerja = calculateMasaKerjaDisplay(effectiveStart, input.month, input.year);

      const output = {
        ...row,
        is_spsi_member: profile?.is_spsi_member ?? Number(row.pot_spsi || 0) > 0,
        effective_start_date: effectiveStart,
        masa_kerja_display_years: masaKerja.years,
        masa_kerja_display_months: masaKerja.months,
        masa_kerja_label: masaKerja.label
      };

      for (const fieldName of ["premi_dynamic", "pot_koreksi", "pot_lainnya"]) {
        const key = `${input.year}:${input.month}:${row.division_code}:${row.gang_code}:${row.emp_code}:${fieldName}`;
        const latest = input.valueOverrides.get(key);
        if (latest && latest.numeric_value !== null && latest.numeric_value !== undefined) {
          output[fieldName] = Number(latest.numeric_value);
        }
      }

      return output;
    });
  }
}
```

- [ ] **Step 4: Integrate the projection into `dataExtractorService.ts`**

```ts
const profileOverrides = await payrollOverlayService.getLatestProfileOverrides(
  employees.map((emp) => emp.emp_code)
);
const valueOverrides = await payrollOverlayService.getLatestValueOverrides({
  month,
  year,
  divisionCode: divisionCode || "ALL",
  gangCode: gangCode || "ALL"
});

const projectedRows = payrollWorkingProjectionService.applyOverrides({
  month,
  year,
  rows: dataRows,
  profileOverrides,
  valueOverrides
});

return {
  data_rows: projectedRows,
  dynamic_premi_headers: Array.from(dynamicPremiSet),
  dynamic_potongan_headers: Array.from(dynamicPotonganSet),
  premi_title_map: premiTitleMap,
  potongan_title_map: potonganTitleMap,
  meta: {
    execution_time_ms: totalMs,
    row_count: projectedRows.length,
    cached: false
  }
};
```

- [ ] **Step 5: Run the projection tests again**

Run: `Set-Location backend; bun test .\src\services\payrollWorkingProjectionService.test.ts .\src\utils\payrollProfileRules.test.ts .\src\utils\payrollOverlayLatest.test.ts`  
Expected: PASS.

### Task 5: Add Snapshot Batch Versioning and March Seed Flow

**Files:**
- Create: `backend/src/services/payrollSnapshotBatchService.ts`
- Modify: `backend/src/services/historySeederService.ts`
- Modify: `backend/src/services/historyDatabaseService.ts`

- [ ] **Step 1: Write the failing snapshot version test**

```ts
import { describe, expect, it } from "bun:test";
import { pickLatestSnapshotVersion } from "../utils/payrollOverlayLatest";

describe("snapshot version selection", () => {
  it("returns the highest snapshot version for the selected scope", () => {
    expect(pickLatestSnapshotVersion([
      { snapshot_version: 1 },
      { snapshot_version: 3 },
      { snapshot_version: 2 }
    ] as any)).toBe(3);
  });
});
```

- [ ] **Step 2: Extend `payrollOverlayLatest.ts` with snapshot version helper**

```ts
export function pickLatestSnapshotVersion(rows: Array<{ snapshot_version: number }>) {
  return rows.reduce((max, row) => Math.max(max, Number(row.snapshot_version || 0)), 0);
}
```

- [ ] **Step 3: Add `payrollSnapshotBatchService.ts`**

```ts
/**
 * SNAPSHOT TABLES ARE IMMUTABLE.
 * NEVER OVERWRITE EXISTING SNAPSHOT ROWS.
 * NEW SNAPSHOT RUNS MUST CREATE snapshot_version + 1.
 */
export class PayrollSnapshotBatchService {
  private db = Database.getExtendedInstance();

  async createNextBatch(scope: {
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code: string;
    created_by: string;
  }) {
    const latest = await this.db.queryOne<{ latest_version: number }>(`
      SELECT ISNULL(MAX(snapshot_version), 0) AS latest_version
      FROM dbo.payroll_snapshot_batch
      WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ?
    `, [scope.period_month, scope.period_year, scope.division_code, scope.gang_code]);

    const nextVersion = Number(latest?.latest_version || 0) + 1;

    const result = await this.db.query(`
      INSERT INTO dbo.payroll_snapshot_batch (
        period_month, period_year, division_code, gang_code,
        snapshot_version, base_source, status, created_by
      ) OUTPUT INSERTED.id, INSERTED.snapshot_version
      VALUES (?, ?, ?, ?, ?, 'db_ptrj', 'completed', ?)
    `, [
      scope.period_month,
      scope.period_year,
      scope.division_code,
      scope.gang_code,
      nextVersion,
      scope.created_by
    ]);

    return result[0];
  }
}
```

- [ ] **Step 4: Apply overlays before writing new history rows in `historySeederService.ts`**

```ts
const batch = await payrollSnapshotBatchService.createNextBatch({
  period_month: options.periodMonth,
  period_year: options.periodYear,
  division_code: options.divisionCode || "ALL",
  gang_code: options.gangCode || "ALL",
  created_by: options.createdBy
});

const projectedRows = payrollWorkingProjectionService.applyOverrides({
  month: options.periodMonth,
  year: options.periodYear,
  rows: extracted.data_rows,
  profileOverrides: await payrollOverlayService.getLatestProfileOverrides(
    extracted.data_rows.map((row: any) => row.emp_code)
  ),
  valueOverrides: await payrollOverlayService.getLatestValueOverrides({
    month: options.periodMonth,
    year: options.periodYear,
    divisionCode: options.divisionCode || "ALL",
    gangCode: options.gangCode || "ALL"
  })
});

// Persist batch id / snapshot_version with all snapshot rows written below this point.
```

- [ ] **Step 5: Make snapshot reads version-aware in `historyDatabaseService.ts`**

```ts
const batch = await db.queryOne<{ id: number; snapshot_version: number }>(`
  SELECT TOP 1 id, snapshot_version
  FROM dbo.payroll_snapshot_batch
  WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ?
  ORDER BY snapshot_version DESC
`, [month, year, divisionCode, gangCode]);

if (!batch) {
  return null;
}

// Read only rows belonging to batch.id or batch.snapshot_version.
```

- [ ] **Step 6: Run the snapshot-related backend tests**

Run: `Set-Location backend; bun test .\src\utils\payrollOverlayLatest.test.ts .\src\services\payrollWorkingProjectionService.test.ts`  
Expected: PASS.

### Task 6: Update Daftar Upah UI and Save Flow

**Files:**
- Create: `frontend/src/utils/payrollEditPayloads.js`
- Create: `frontend/src/utils/payrollEditPayloads.test.js`
- Modify: `frontend/src/components/CustomPayrollTable.jsx`
- Modify: `frontend/src/services/lockedDivisionService.js`

- [ ] **Step 1: Write the failing frontend payload-splitting tests**

```js
import { describe, expect, it } from "bun:test";
import { splitPayrollEdits } from "./payrollEditPayloads";

describe("splitPayrollEdits", () => {
  it("separates profile edits from period value edits", () => {
    const result = splitPayrollEdits({
      month: 4,
      year: 2026,
      division: "AB1",
      edits: [
        { emp_code: "B0001", nik: "3171", field: "is_spsi_member", value: true, gang_code: "A1" },
        { emp_code: "B0001", nik: "3171", field: "effective_start_date", value: "2025-03-01", gang_code: "A1" },
        { emp_code: "B0001", nik: "3171", field: "premi_dynamic", value: 9000, gang_code: "A1" }
      ]
    });

    expect(result.profileItems).toHaveLength(1);
    expect(result.valueItems).toHaveLength(1);
    expect(result.profileItems[0].is_spsi_member).toBe(true);
    expect(result.valueItems[0].field_name).toBe("premi_dynamic");
  });
});
```

- [ ] **Step 2: Run the frontend payload test to verify it fails**

Run: `Set-Location frontend; bun test .\src\utils\payrollEditPayloads.test.js`  
Expected: FAIL with missing module/function.

- [ ] **Step 3: Implement payload splitting**

```js
const PROFILE_FIELDS = new Set(["is_spsi_member", "effective_start_date"]);
const VALUE_FIELDS = new Set(["premi_dynamic", "pot_koreksi", "pot_lainnya"]);

export function splitPayrollEdits({ month, year, division, edits }) {
  const profileMap = new Map();
  const valueItems = [];

  for (const edit of edits) {
    if (PROFILE_FIELDS.has(edit.field)) {
      const key = edit.emp_code;
      const current = profileMap.get(key) || {
        emp_code: edit.emp_code,
        nik: edit.nik,
        is_spsi_member: false,
        effective_start_date: null,
        employee_status_at_change: edit.employee_status || null
      };
      current[edit.field] = edit.value;
      profileMap.set(key, current);
      continue;
    }

    if (VALUE_FIELDS.has(edit.field)) {
      valueItems.push({
        period_month: month,
        period_year: year,
        division_code: division,
        gang_code: edit.gang_code,
        emp_code: edit.emp_code,
        nik: edit.nik,
        field_name: edit.field,
        field_group: edit.field.startsWith("premi") ? "PREMI" : "POTONGAN",
        numeric_value: Number(edit.value || 0)
      });
    }
  }

  return { profileItems: [...profileMap.values()], valueItems };
}
```

- [ ] **Step 4: Add new columns and edit controls inside `CustomPayrollTable.jsx`**

```jsx
cols.splice(4, 0,
  {
    field: "is_spsi_member",
    headers: ["IDENTITAS", null, "SPSI"],
    w: 70,
    className: "text-center",
    render: (row) => {
      if (isEditMode && row.type === "employee") {
        return (
          <input
            type="checkbox"
            checked={!!row.is_spsi_member}
            onChange={(e) => handleProfileEdit(row, "is_spsi_member", e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
      return row.is_spsi_member ? "SPSI" : "Non-SPSI";
    }
  },
  {
    field: "effective_start_date",
    headers: ["IDENTITAS", null, "TGL MULAI"],
    w: 105,
    className: "text-center",
    render: (row) => {
      if (isEditMode && row.type === "employee") {
        return (
          <input
            type="date"
            className="edit-input"
            value={row.effective_start_date || ""}
            onChange={(e) => handleProfileEdit(row, "effective_start_date", e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
      return row.effective_start_date || "-";
    }
  },
  {
    field: "masa_kerja_label",
    headers: ["IDENTITAS", null, "MASA KERJA"],
    w: 95,
    className: "text-center",
    render: (row) => row.masa_kerja_label || "0 bln"
  }
);
```

- [ ] **Step 5: Route save flow to the new endpoints before legacy manual edits**

```jsx
const { profileItems, valueItems } = splitPayrollEdits({
  month,
  year,
  division,
  edits: Object.values(editedCells)
});

for (const profile of profileItems) {
  await fetch("/payroll/overrides/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(profile)
  });
}

if (valueItems.length > 0) {
  await fetch("/payroll/overrides/values", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ items: valueItems })
  });
}

setOverlaySaveNotice("Perubahan tersimpan di overlay. Snapshot history belum diperbarui.");
onRefresh?.();
```

- [ ] **Step 6: Rerun the frontend payload test**

Run: `Set-Location frontend; bun test .\src\utils\payrollEditPayloads.test.js`  
Expected: PASS.

- [ ] **Step 7: Build the frontend**

Run: `Set-Location frontend; npm run build`  
Expected: PASS with Vite production bundle output.

### Task 7: Full Verification, Comment Audit, and MCP Memory Update

**Files:**
- Modify: `backend/src/api/payroll.ts`
- Modify: `backend/src/services/historyDatabaseService.ts`
- Modify: `backend/src/services/historySeederService.ts`
- Modify: `docs/superpowers/specs/2026-04-22-extend-db-persistent-payroll-history-design.md` only if implementation revealed a real spec mismatch

- [ ] **Step 1: Audit that big guardrail comments exist at every write/read boundary**

```ts
/**
 * SNAPSHOT TABLES ARE IMMUTABLE.
 * NEVER WRITE USER EDITS DIRECTLY INTO SNAPSHOT TABLES.
 * ALL MANUAL CHANGES MUST GO TO OVERLAY HISTORY TABLES.
 * LATEST OVERLAY MUST ALWAYS USE MAX(update_index).
 * LATEST SNAPSHOT MUST ALWAYS USE TARGET OR MAX(snapshot_version).
 */
```

- [ ] **Step 2: Run the backend verification slice**

Run: `Set-Location backend; bun test .\src\utils\payrollProfileRules.test.ts .\src\utils\payrollOverlayLatest.test.ts .\src\services\payrollWorkingProjectionService.test.ts`  
Expected: PASS.

- [ ] **Step 3: Run schema smoke verification**

Run: `Set-Location backend; bun run .\_dev_utils\tests\test_payroll_overlay_schema.ts`  
Expected: PASS with `overlay schema ready`.

- [ ] **Step 4: Run manual scenario verification**

Run:
```powershell
Set-Location backend
bun run .\_dev_utils\tests\test_payroll_overlay_schema.ts
Set-Location ..\frontend
npm run build
```

Expected:
- backend schema test passes
- frontend build passes
- manual QA checklist:
  - edit `SPSI` and save -> row refresh shows new badge
  - edit `Tanggal Mulai Bekerja` and save -> `Masa Kerja` label refreshes
  - edit `premi_dynamic`, `koreksi`, `potongan lainnya` -> live row reflects overlay
  - history snapshot view remains unchanged until new snapshot batch is created
  - new snapshot run creates `snapshot_version + 1`

- [ ] **Step 5: Update MCP memory after verification**

```text
Topic: extend_db_ptrj persistent payroll overlay + immutable snapshot versioning
Include:
- new tables and indexes
- latest-read contract (update_index vs snapshot_version)
- backend files touched
- frontend save flow changes
- exact verification commands and results
```

## Self-Review

### Spec Coverage
- Overlay tables and append-only contract: Task 1
- SPSI seed from March and editable master behavior: Tasks 2, 3, 5
- THR-compatible effective start date semantics: Tasks 2, 3, 4
- Live `base + overlay` projection: Task 4
- Immutable snapshot versioning: Task 5
- UI columns, edit mode, save behavior: Task 6
- Mandatory code comments and MCP update: Task 7

No uncovered spec requirement remains.

### Placeholder Scan
- No `TODO`, `TBD`, or “implement later”.
- All tasks include exact file paths, concrete code blocks, and explicit commands.

### Type Consistency
- `update_index` is used only for overlay rows.
- `snapshot_version` is used only for snapshot batches.
- `is_spsi_member`, `effective_start_date`, and `masa_kerja_label` are the public row fields used throughout the plan.
