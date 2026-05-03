process.env.LOG_TO_FILE = process.env.LOG_TO_FILE || "false";
process.env.CLEAR_LOGS_ON_STARTUP = process.env.CLEAR_LOGS_ON_STARTUP || "false";

import { readFileSync } from "fs";
import { join } from "path";
import type { Database } from "../../backend/src/db/client";
import {
    buildRakingSeedPayloads,
    parseEstateJsonBlocks,
    PERIOD_MONTH,
    PERIOD_YEAR,
    RAKING_ADJUSTMENT_NAME,
    normalizeSeedDivisionCode,
    type PruningSeedPayload
} from "./pruning_seed_payloads";
import {
    ensureManualAdjustmentIdentitySchema,
    resolveSeedPayloadIdentity
} from "./manual_adjustment_seed_identity";

const DEFAULT_TARGET_DIVISIONS = ["AB1", "P2A", "P2B"];
const IMPORT_TAG = "SEED_IMPORT_RAKING";
const SCRIPT_USER = "seed_raking_data";
const DRY_RUN = process.argv.includes("--dry-run");

type ExistingAdjustmentRow = {
    id: number;
    emp_code: string;
    nik: string | null;
    division_code: string | null;
    gang_code: string | null;
    amount: number | null;
};

function getArgValue(name: string): string | null {
    const prefix = `${name}=`;
    const arg = process.argv.find((value) => value.startsWith(prefix));
    return arg ? arg.slice(prefix.length).trim() : null;
}

function getTargetDivisions(): string[] {
    const raw = getArgValue("--divisions") || getArgValue("--division");
    if (!raw) return DEFAULT_TARGET_DIVISIONS;

    const parsed = raw
        .split(",")
        .map((value) => normalizeSeedDivisionCode(value))
        .filter(Boolean);

    return parsed.length ? Array.from(new Set(parsed)) : DEFAULT_TARGET_DIVISIONS;
}

function getTargetGangs(): string[] {
    const raw = getArgValue("--gangs") || getArgValue("--gang");
    if (!raw) return [];

    return Array.from(new Set(raw
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)));
}

function payloadSummary(payloads: PruningSeedPayload[]) {
    const byDivision = new Map<string, { employees: number; detail_items: number; total_amount: number }>();

    for (const payload of payloads) {
        const metadata = JSON.parse(payload.metadata_json);
        const current = byDivision.get(payload.division_code) || {
            employees: 0,
            detail_items: 0,
            total_amount: 0
        };

        current.employees += 1;
        current.detail_items += Array.isArray(metadata.items) ? metadata.items.length : 0;
        current.total_amount += payload.amount;
        byDivision.set(payload.division_code, current);
    }

    return Array.from(byDivision.entries()).map(([division_code, summary]) => ({
        division_code,
        adjustment_name: RAKING_ADJUSTMENT_NAME,
        ...summary
    }));
}

async function fetchExistingRows(db: Database, payload: PruningSeedPayload): Promise<ExistingAdjustmentRow[]> {
    return await db.query<ExistingAdjustmentRow>(`
        SELECT id, emp_code, nik, division_code, gang_code, amount
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = ?
          AND period_year = ?
          AND (emp_code = ? OR nik = ?)
          AND adjustment_type = 'PREMI'
          AND UPPER(LTRIM(RTRIM(adjustment_name))) = ?
    `, [
        payload.period_month,
        payload.period_year,
        payload.emp_code,
        payload.nik,
        payload.adjustment_name
    ]);
}

async function updateExistingRow(db: Database, id: number, payload: PruningSeedPayload): Promise<void> {
    await db.query(`
        UPDATE dbo.payroll_manual_adjustments
        SET emp_code = ?,
            nik = ?,
            emp_name = ?,
            gang_code = ?,
            division_code = ?,
            amount = ?,
            remarks = ?,
            metadata_json = ?,
            updated_at = GETDATE(),
            updated_by = ?
        WHERE id = ?
    `, [
        payload.emp_code,
        payload.nik,
        payload.emp_name,
        payload.gang_code,
        payload.division_code,
        payload.amount,
        payload.remarks,
        payload.metadata_json,
        SCRIPT_USER,
        id
    ]);
}

async function insertRow(db: Database, payload: PruningSeedPayload): Promise<number> {
    const result = await db.query<{ id: number }>(`
        INSERT INTO dbo.payroll_manual_adjustments (
            period_month, period_year, emp_code, nik, emp_name, gang_code, division_code,
            adjustment_type, adjustment_name, amount, remarks, metadata_json, created_by
        ) OUTPUT INSERTED.id VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `, [
        payload.period_month,
        payload.period_year,
        payload.emp_code,
        payload.nik,
        payload.emp_name,
        payload.gang_code,
        payload.division_code,
        payload.adjustment_type,
        payload.adjustment_name,
        payload.amount,
        payload.remarks,
        payload.metadata_json,
        SCRIPT_USER
    ]);

    return Number(result[0]?.id || 0);
}

async function seedRakingData() {
    const targetDivisions = getTargetDivisions();
    const targetGangs = getTargetGangs();
    const filePath = join(import.meta.dir, "../../backend/data/raking_sub_block_detail.json");
    const estates = parseEstateJsonBlocks(readFileSync(filePath, "utf-8"));
    const payloads = buildRakingSeedPayloads(estates, {
        targetEstates: targetDivisions,
        targetGangs,
        importTag: IMPORT_TAG
    });

    console.log("Raking seed summary:");
    console.log(JSON.stringify({ targetDivisions, targetGangs: targetGangs.length ? targetGangs : "ALL" }, null, 2));
    console.log(JSON.stringify(payloadSummary(payloads), null, 2));
    console.log("Sample payloads:");
    console.log(JSON.stringify(payloads.slice(0, 3).map((payload) => ({
        emp_code: payload.emp_code,
        nik: payload.nik,
        emp_name: payload.emp_name,
        gang_code: payload.gang_code,
        division_code: payload.division_code,
        amount: payload.amount,
        metadata: JSON.parse(payload.metadata_json)
    })), null, 2));

    if (DRY_RUN) {
        console.log("DRY RUN only. Re-run without --dry-run to write raking rows to payroll_manual_adjustments.");
        return;
    }

    const { Database } = await import("../../backend/src/db/client");
    const db = Database.getExtendedInstance();
    await ensureManualAdjustmentIdentitySchema(db);
    let inserted = 0;
    let updated = 0;
    let multiMatched = 0;

    for (const originalPayload of payloads) {
        const payload = await resolveSeedPayloadIdentity(db, originalPayload);
        const existingRows = await fetchExistingRows(db, payload);

        if (existingRows.length === 0) {
            await insertRow(db, payload);
            inserted += 1;
            continue;
        }

        if (existingRows.length > 1) {
            multiMatched += 1;
        }

        for (const row of existingRows) {
            await updateExistingRow(db, row.id, payload);
            updated += 1;
        }
    }

    const divisionPlaceholders = targetDivisions.map(() => "?").join(", ");
    const verification = await db.query<any>(`
        SELECT
            division_code,
            COUNT(*) AS total,
            SUM(CASE WHEN metadata_json IS NULL OR LTRIM(RTRIM(metadata_json)) = '' THEN 1 ELSE 0 END) AS missing_metadata,
            SUM(CAST(amount AS DECIMAL(18, 2))) AS total_amount
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = ?
          AND period_year = ?
          AND adjustment_name = ?
          AND division_code IN (${divisionPlaceholders})
        GROUP BY division_code
        ORDER BY division_code
    `, [PERIOD_MONTH, PERIOD_YEAR, RAKING_ADJUSTMENT_NAME, ...targetDivisions]);

    console.log("Seed result:");
    console.log(JSON.stringify({
        inserted,
        updated,
        emp_codes_with_multiple_existing_rows: multiMatched,
        verification
    }, null, 2));
}

seedRakingData().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
