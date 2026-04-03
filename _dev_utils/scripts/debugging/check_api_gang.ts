/**
 * Debug: Check ifgang condition query works, and current period
 */
import { Database } from "../../../backend/src/db/client";
import { currentPeriodService } from "../../../backend/src/services/currentPeriodService";

async function main() {
    const db = Database.getInstance();

    // Check current period
    const period = await currentPeriodService.getCurrentPeriod();
    console.log('Current period:', JSON.stringify(period));

    // What does the actual getEmployees query return for L1H?
    const empQuery = await db.query(`
        SELECT DISTINCT
            RTRIM(e.EmpCode) as emp_code,
            e.EmpName as emp_name,
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE (UPPER(RTRIM(gl.GangCode)) = 'L1H' OR UPPER(RTRIM(g.GangCode)) = 'L1H' OR UPPER(RTRIM(g.Description)) = 'L1H')
        ORDER BY emp_code
    `);
    console.log(`getEmployees query for L1H: ${empQuery.length} rows`);
    empQuery.forEach(r => console.log(`  ${r.emp_code} | ${r.gang_code} | ${r.emp_name}`));

    // Check isHistorical
    const isMarch = period.month === 3 && period.year === 2026;
    console.log(`\nis March 2026: ${isMarch}`);
    console.log(`latest_acc_month: ${period.latest_acc_month}, latest_acc_year: ${period.latest_acc_year}`);

    // Try thegangService to get gangs
    const { gangService } = await import('../../../backend/src/services/gangService');
    const gangs = await gangService.fetchGangsByLocCode('L');
    console.log(`\ngangService.fetchGangsByLocCode('L'): ${gangs.length} gangs`);
    gangs.slice(0, 5).forEach(g => console.log(`  ${g}`));
}
main().catch(console.error);
