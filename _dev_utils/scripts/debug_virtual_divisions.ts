/**
 * Debug script to check why virtual divisions (NRS, INF, WKS_PG, WKS_AR) 
 * are not appearing in the wages summary.
 * 
 * Checks:
 * 1. What gang codes exist in aggregation_history
 * 2. What gang codes exist in HR_GANG for virtual division source divisions
 * 3. Whether virtual division pattern matching works
 */

import { Database } from "../../backend/src/db/client";
import { divisionDefinition } from "../../backend/src/services/divisionDefinition";

async function debug() {
    const month = 2, year = 2026;

    // 1. Get DB connections
    const mainDb = Database.getInstance(undefined, "SERVER_PROFILE_2");
    const extendDb = Database.getInstance("extend_db_ptrj", "SERVER_PROFILE_2");

    console.log("=== DEBUG VIRTUAL DIVISIONS ===\n");

    // 2. Check what gang codes exist in aggregation_history for this period
    console.log("--- Step 1: Gang codes in aggregation_history ---");
    const aggRows = await extendDb.query<{ gang_code: string, division_code: string }>(`
        SELECT DISTINCT gang_code, division_code 
        FROM dbo.daftar_upah_aggregation_history 
        WHERE period_month = ${month} AND period_year = ${year}
        ORDER BY gang_code
    `);
    console.log(`Total rows in aggregation: ${aggRows.length}`);
    const aggGangCodes = aggRows.map(r => r.gang_code?.trim());
    console.log(`Gang codes: ${aggGangCodes.join(', ')}`);
    console.log(`Division codes in agg: ${[...new Set(aggRows.map(r => r.division_code?.trim()))].join(', ')}`);

    // 3. Check HR_GANG for virtual division source divisions
    console.log("\n--- Step 2: HR_GANG gangs for virtual division source divisions ---");

    // Check P1A (source for INF and WKS_PG)
    const p1aGangs = await mainDb.query<{ GangCode: string, Description: string, LocCode: string }>(`
        SELECT GangCode, Description, LocCode FROM dbo.HR_GANG 
        WHERE RTRIM(LTRIM(UPPER(LocCode))) = 'P1A' 
        ORDER BY GangCode
    `);
    console.log(`\nP1A gangs (source for INF & WKS_PG): ${p1aGangs.length}`);
    for (const g of p1aGangs) {
        const gc = g.GangCode?.trim();
        const desc = g.Description?.trim();
        const inAgg = aggGangCodes.includes(gc);
        console.log(`  ${gc} | ${desc} | in_agg=${inAgg}`);
    }

    // Check P1B (source for NRS)
    const p1bGangs = await mainDb.query<{ GangCode: string, Description: string, LocCode: string }>(`
        SELECT GangCode, Description, LocCode FROM dbo.HR_GANG 
        WHERE RTRIM(LTRIM(UPPER(LocCode))) = 'P1B' 
        ORDER BY GangCode
    `);
    console.log(`\nP1B gangs (source for NRS): ${p1bGangs.length}`);
    for (const g of p1bGangs) {
        const gc = g.GangCode?.trim();
        const desc = g.Description?.trim();
        const inAgg = aggGangCodes.includes(gc);
        console.log(`  ${gc} | ${desc} | in_agg=${inAgg}`);
    }

    // Check AB2 (source for WKS_AR)
    const ab2Gangs = await mainDb.query<{ GangCode: string, Description: string, LocCode: string }>(`
        SELECT GangCode, Description, LocCode FROM dbo.HR_GANG 
        WHERE RTRIM(LTRIM(UPPER(LocCode))) = 'AB2' 
        ORDER BY GangCode
    `);
    console.log(`\nAB2 gangs (source for WKS_AR): ${ab2Gangs.length}`);
    for (const g of ab2Gangs) {
        const gc = g.GangCode?.trim();
        const desc = g.Description?.trim();
        const inAgg = aggGangCodes.includes(gc);
        console.log(`  ${gc} | ${desc} | in_agg=${inAgg}`);
    }

    // 4. Test virtual division pattern matching
    console.log("\n--- Step 3: Virtual Division Pattern Matching ---");

    const testGangs = [
        // INF patterns (^IN)
        ...p1aGangs.map(g => ({ code: g.GangCode?.trim(), desc: g.Description?.trim(), loc: 'P1A' })),
        // NRS pattern (^B2N$)
        ...p1bGangs.map(g => ({ code: g.GangCode?.trim(), desc: g.Description?.trim(), loc: 'P1B' })),
        // WKS_AR pattern (^HMC$)
        ...ab2Gangs.map(g => ({ code: g.GangCode?.trim(), desc: g.Description?.trim(), loc: 'AB2' })),
    ];

    for (const g of testGangs) {
        const vd = divisionDefinition.getVirtualDivisionForGang(g.code, g.loc, g.desc);
        if (vd) {
            console.log(`  MATCH: ${g.code} (${g.loc}) "${g.desc}" → ${vd} | in_agg=${aggGangCodes.includes(g.code)}`);
        }
    }

    // 5. Check getVirtualDivisionGangs output
    console.log("\n--- Step 4: getVirtualDivisionGangs outputs ---");
    for (const vd of ['INF', 'NRS', 'WKS_PG', 'WKS_AR']) {
        const gangs = await divisionDefinition.getGangsForDivision(vd);
        const gangCodes = gangs.map(g => g.gang_code);
        const inAggCount = gangCodes.filter(gc => aggGangCodes.includes(gc)).length;
        console.log(`  ${vd}: ${gangs.length} gangs, ${inAggCount} in aggregation → [${gangCodes.join(', ')}]`);
        for (const g of gangs) {
            const inAgg = aggGangCodes.includes(g.gang_code);
            console.log(`    ${g.gang_code} | "${g.description}" | in_agg=${inAgg}`);
        }
    }

    // 6. Check if Divisi_Description has these virtual divisions
    console.log("\n--- Step 5: Divisi_Description table ---");
    const divDescs = await extendDb.query<any>(`
        SELECT * FROM dbo.Divisi_Description ORDER BY Divisi
    `);
    console.log("Divisions in Divisi_Description:");
    for (const d of divDescs) {
        console.log(`  ${d.Divisi} | ${d.Description}`);
    }

    process.exit(0);
}

debug().catch(e => {
    console.error("Error:", e);
    process.exit(1);
});
