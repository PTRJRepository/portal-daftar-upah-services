/**
 * Diagnostic script: Check why WKS_PG, WKS_AR, NRS, INF are missing from summary
 * Usage: bun run _dev_utils/scripts/diagnose_virtual_divisions.ts
 */

import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import { divisionDefinition } from "../../backend/src/services/divisionDefinition";
import { writeFileSync } from "fs";

const lines: string[] = [];
function log(msg: string) {
    lines.push(msg);
    console.log(msg);
}

async function diagnose() {
    log("=== Diagnosing Virtual Division Issues ===\n");

    const db = Database.getInstance(undefined, "SERVER_PROFILE_2");
    const extDb = Database.getInstance("extend_db_ptrj", Config.DB_EXTEND_PROFILE);

    // 1. Check HR_GANG
    log("--- Step 1: HR_GANG for virtual division gangs ---");
    const hrGangRows = await db.query<{ GangCode: string; LocCode: string; Description: string }>(`
        SELECT GangCode, LocCode, Description FROM dbo.HR_GANG
        WHERE GangCode IN ('AMC', 'HMC', 'B2N')
           OR GangCode LIKE 'IN%'
        ORDER BY GangCode
    `);

    for (const row of hrGangRows) {
        log(`  ${row.GangCode?.trim()} -> LocCode=${row.LocCode?.trim()}, Desc="${row.Description?.trim()}"`);
    }
    if (hrGangRows.length === 0) log("  ⚠️ NO matching gangs found!");

    // 2. Check aggregation_history
    log("\n--- Step 2: aggregation_history for these gangs ---");
    const latestPeriod = await extDb.queryOne<{ period_month: number; period_year: number }>(`
        SELECT TOP 1 period_month, period_year 
        FROM dbo.daftar_upah_aggregation_history
        ORDER BY period_year DESC, period_month DESC
    `);

    if (!latestPeriod) {
        log("  ⚠️ No data in aggregation_history!");
        writeFileSync("_dev_utils/scripts/diagnose_output.txt", lines.join("\n"));
        return;
    }

    log(`  Latest period: ${latestPeriod.period_month}/${latestPeriod.period_year}`);

    const aggRows = await extDb.query<{ gang_code: string; division_code: string; total_employees: number; total_upah_bersih: number }>(`
        SELECT gang_code, division_code, total_employees, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
          AND (gang_code IN ('AMC', 'HMC', 'B2N') 
               OR gang_code LIKE 'IN%')
        ORDER BY gang_code
    `, [latestPeriod.period_month, latestPeriod.period_year]);

    for (const row of aggRows) {
        log(`  ${row.gang_code?.trim()} -> div=${row.division_code?.trim()}, emp=${row.total_employees}, upah=${row.total_upah_bersih}`);
    }
    if (aggRows.length === 0) log("  ⚠️ NO matching gangs in aggregation_history!");

    // 3. All division_codes
    log("\n--- Step 3: All division_codes in aggregation_history ---");
    const divCodes = await extDb.query<{ division_code: string; cnt: number }>(`
        SELECT division_code, COUNT(*) as cnt
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        GROUP BY division_code
        ORDER BY division_code
    `, [latestPeriod.period_month, latestPeriod.period_year]);

    for (const row of divCodes) {
        log(`  ${row.division_code?.trim()}: ${row.cnt} gangs`);
    }

    // 4. Virtual div gangs
    log("\n--- Step 4: Virtual division gang matching ---");
    for (const vc of ["INF", "NRS", "WKS_PG", "WKS_AR"]) {
        const gangs = await divisionDefinition.getGangsForDivision(vc);
        log(`  ${vc}: ${gangs.length} gangs -> [${gangs.map(g => `${g.gang_code}(${g.source_loc_code || ''})`).join(', ')}]`);
    }

    // 5. Virtual div mapping test
    log("\n--- Step 5: getVirtualDivisionForGang test ---");
    for (const row of hrGangRows) {
        const gc = row.GangCode?.trim();
        const lc = row.LocCode?.trim();
        const desc = row.Description?.trim() || "";
        const vd = divisionDefinition.getVirtualDivisionForGang(gc, lc, desc);
        log(`  ${gc}: LocCode=${lc}, desc="${desc}", virtualDiv=${vd || 'NONE'}`);
    }

    // 6. ALL gangs
    log("\n--- Step 6: ALL gangs in aggregation_history ---");
    const allGangs = await extDb.query<{ gang_code: string; division_code: string }>(`
        SELECT gang_code, division_code
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        ORDER BY gang_code
    `, [latestPeriod.period_month, latestPeriod.period_year]);

    log(`  Total: ${allGangs.length} gangs`);
    for (const row of allGangs) {
        log(`    ${row.gang_code?.trim()} (div=${row.division_code?.trim()})`);
    }

    log("\n=== Done ===");
    writeFileSync("_dev_utils/scripts/diagnose_output.txt", lines.join("\n"));
    log("Output written to _dev_utils/scripts/diagnose_output.txt");
}

diagnose().catch(console.error).finally(() => process.exit(0));
