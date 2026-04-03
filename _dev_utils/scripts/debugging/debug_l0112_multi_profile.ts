/**
 * Quick check: L0112 across all server profiles
 */
import { Database } from "../../../backend/src/db/client";

async function main() {
    const profiles = ['SERVER_PROFILE_1', 'SERVER_PROFILE_2', 'SERVER_PROFILE_3'];

    for (const profile of profiles) {
        console.log(`\n=== Checking ${profile} ===`);
        try {
            const db = Database.getInstance(undefined, profile);

            // HR_GANGLN
            const gangln = await db.query(`
                SELECT TOP 3 GangCode, GangMember
                FROM HR_GANGLN
                WHERE UPPER(RTRIM(GangMember)) = 'L0112'
            `);
            console.log(`HR_GANGLN for L0112: ${gangln.length} rows`);
            gangln.forEach(r => console.log(`  GangCode='${r.GangCode}' GangMember='${r.GangMember}'`));

            // HR_GANG for L1H
            const gang = await db.query(`
                SELECT TOP 3 GangCode, Description, LocCode
                FROM HR_GANG
                WHERE UPPER(RTRIM(GangCode)) = 'L1H'
            `);
            console.log(`HR_GANG for L1H: ${gang.length} rows`);
            gang.forEach(r => console.log(`  GangCode='${r.GangCode}' Desc='${r.Description}' LocCode='${r.LocCode}'`));

            // Quick employee check
            const emp = await db.query(`
                SELECT TOP 3 EmpCode, NewICNo, EmpName
                FROM HR_EMPLOYEE
                WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
            `);
            console.log(`HR_EMPLOYEE for L0112: ${emp.length} rows`);
            emp.forEach(r => console.log(`  EmpCode='${r.EmpCode}' NIK='${r.NewICNo}' Name='${r.EmpName}'`));
        } catch (e: any) {
            console.log(`  ERROR: ${e.message}`);
        }
    }

    // Now check the actual API endpoint result
    console.log("\n=== API Result for gang L1H ===");
    try {
        const response = await fetch('http://localhost:8002/payroll/report?gang_code=L1H&month=3&year=2026');
        const data = await response.json();
        const l0112 = data.data?.find((r: any) => r.emp_code?.trim() === 'L0112' || r.nik?.includes('L0112'));
        console.log(`Total rows returned: ${data.data?.length || 0}`);
        console.log(`L0112 found in response: ${l0112 ? 'YES' : 'NO'}`);
        if (l0112) {
            console.log(`L0112 data:`, JSON.stringify(l0112, null, 2));
        } else {
            // Show all emp_codes to see what's there
            console.log(`First 5 emp_codes:`, data.data?.slice(0, 5).map((r: any) => r.emp_code?.trim()));
        }
    } catch (e: any) {
        console.log(`API call failed: ${e.message}`);
    }

    // Check locked endpoint too
    console.log("\n=== Locked API Result for gang L1H ===");
    try {
        const response = await fetch('http://localhost:8002/payroll/locked/report/raw-tree?gang_code=L1H&month=3&year=2026');
        const data = await response.json();
        const allEmps = data.gangs?.flatMap((g: any) => g.employees || []) || [];
        const l0112 = allEmps.find((r: any) => r.emp_code?.trim() === 'L0112');
        console.log(`Total employees returned: ${allEmps.length}`);
        console.log(`L0112 found in response: ${l0112 ? 'YES' : 'NO'}`);
        if (l0112) {
            console.log(`L0112 data:`, JSON.stringify(l0112, null, 2));
        } else {
            console.log(`First 5 emp_codes:`, allEmps.slice(0, 5).map((r: any) => r.emp_code?.trim()));
        }
    } catch (e: any) {
        console.log(`API call failed: ${e.message}`);
    }
}

main().catch(console.error);
