// Test the full dataExtractorService directly to see where it fails
// This simulates what the backend does internally
import { Database } from "../../../src/db/client";
import { Config } from "../../../src/config";
import { gangService } from "../../../src/services/gangService";
import { divisionConfigService } from "../../../src/services/config/DivisionConfigService";

async function main() {
    console.log("=== Testing Backend Services Directly ===\n");

    console.log("Config check:");
    console.log(`  DB_API_URL: ${Config.DB_API_URL}`);
    console.log(`  DB_PROFILE: ${Config.DB_PROFILE}`);
    console.log(`  DEFAULT_DATABASE: ${Config.DEFAULT_DATABASE}`);
    console.log(`  DB_EXTEND_PROFILE: ${Config.DB_EXTEND_PROFILE}`);
    console.log(`  DB_EXTEND_DATABASE: ${Config.DB_EXTEND_DATABASE}`);

    console.log("\n1. Test Database connection (default):");
    const db = Database.getInstance();
    try {
        const gangs = await db.query("SELECT COUNT(*) as cnt FROM HR_GANG");
        console.log(`  HR_GANG count: ${gangs[0]?.cnt ?? "ERROR"}`);
    } catch (e: any) {
        console.log(`  ERROR: ${e.message}`);
    }

    console.log("\n2. Test gangService.fetchGangs('ALL'):");
    try {
        const gangs = await gangService.fetchGangs("ALL", undefined, false);
        console.log(`  Got ${gangs.length} gangs`);
        gangs.slice(0, 5).forEach((g: any) => {
            console.log(`    ${g.gang_code} - ${g.description?.substring(0, 30)}`);
        });
    } catch (e: any) {
        console.log(`  ERROR: ${e.message}`);
    }

    console.log("\n3. Test divisionConfigService.getGangsForDivision('ALL'):");
    try {
        const gangs = await divisionConfigService.getGangsForDivision("ALL");
        console.log(`  Got ${gangs.length} gangs`);
        gangs.slice(0, 5).forEach((g: any) => {
            console.log(`    ${g.gang_code} - ${g.description?.substring(0, 30)}`);
        });
    } catch (e: any) {
        console.log(`  ERROR: ${e.message}`);
    }

    console.log("\n4. Test getEmployees query (simulated):");
    try {
        const emps = await db.query(`
            SELECT TOP 5
                e.EmpCode,
                e.EmpName,
                e.LocCode,
                gl.GangCode,
                g.LocCode as gang_loc
            FROM HR_EMPLOYEE e
            INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
            WHERE e.Status = '1' AND g.Status = '1'
            ORDER BY e.EmpCode
        `);
        console.log(`  Got ${emps.length} employees`);
        emps.forEach((e: any) => {
            console.log(`    ${e.EmpCode?.trim()} - ${e.EmpName?.trim().substring(0, 30)}`);
        });
    } catch (e: any) {
        console.log(`  ERROR: ${e.message}`);
    }

    console.log("\n5. Test PR_TASKREGLN (attendance) for March 2026:");
    try {
        const taskreg = await db.query(`
            SELECT TOP 5
                tr.EmpCode,
                COUNT(DISTINCT CAST(tr.TrxDate AS DATE)) as work_days,
                SUM(tr.Hours) as total_hours
            FROM PR_TASKREGLN tr
            WHERE YEAR(tr.TrxDate) = 2026 AND MONTH(tr.TrxDate) = 3
            GROUP BY tr.EmpCode
            ORDER BY tr.EmpCode
        `);
        console.log(`  Got ${taskreg.length} employees with attendance`);
        taskreg.forEach((e: any) => {
            console.log(`    ${e.EmpCode} - ${e.work_days} days, ${e.total_hours}h`);
        });
    } catch (e: any) {
        console.log(`  ERROR: ${e.message}`);
    }
}

main().catch(console.error);
