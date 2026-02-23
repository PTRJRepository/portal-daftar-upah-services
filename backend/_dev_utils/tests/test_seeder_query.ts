import { Database } from "../../src/db/client";

async function testQuery() {
    const db = Database.getInstance();

    console.log("\n=== Testing Gang Query ===");
    try {
        const gangRows = await db.query(`
                SELECT TOP 1
                    g.LocCode as division_code,
                    g.LocCode as loc_code,
                    g.GangCode as gang_code,
                    g.Description as gang_description,
                    g.GangLeader as mandor_code,
                    m1.EmpName as mandor_name,
                    NULL as mandor_1_code,
                    NULL as mandor_1_name,
                    NULL as assistant_code,
                    NULL as assistant_name,
                    (SELECT COUNT(*) FROM HR_GANGLN gl WHERE gl.GangCode = g.GangCode) as total_members
                FROM HR_GANG g
                LEFT JOIN HR_EMPLOYEE m1 ON g.GangLeader = m1.EmpCode
                -- WHERE g.LocType = 1 -- Testing without LocType since it caused an error
        `);
        console.log("Gang Query PASSED:", gangRows.length > 0 ? "Got Data" : "No Data");
        if (gangRows.length > 0) console.log(Object.keys(gangRows[0]));
    } catch (e: any) {
        console.error("Gang Query FAILED:", e.message);
    }

    console.log("\n=== Testing Employee HR Query ===");
    try {
        const empRows = await db.query(`
                SELECT TOP 1
                    e.NewICNo as nik,
                    e.EmpCode as emp_code,
                    e.EmpName as emp_name,
                    em.CompCode as company_code, -- Changed from CompanyCode to CompCode
                    g.LocCode as division_code,
                    g.LocCode as loc_code,
                    g.GangCode as gang_code,
                    NULL as job_code,
                    NULL as position,
                    em.AppJoinGrpDate as join_date,
                    em.TerminateDate as terminate_date,
                    e.Status as status,
                    e.HREmpType as employee_type,
                    e.Gender as gender,
                    e.Religion as religion,
                    e.MaritalStatus as marital_status,
                    e.PlaceOfBirth as birth_place,
                    e.DOB as birth_date,
                    NULL as tax_status,
                    0 as upah_dasar,
                    (SELECT TOP 1 CAST(RiceRation AS VARCHAR) FROM HR_PAYROLL p WHERE p.EmpCode = e.EmpCode) as ptkp_beras,
                    NULL as ptkp_pajak,
                    COALESCE((
                        SELECT SUM(Hours)/7.0
                        FROM PR_TASKREG tr 
                        JOIN PR_TASKREGLN trl ON tr.ID = trl.MasterID
                        WHERE trl.EmpCode = e.EmpCode 
                          AND MONTH(trl.TrxDate) = 2 
                          AND YEAR(trl.TrxDate) = 2026
                    ), 0) as total_hk
                FROM HR_EMPLOYEE e
                JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                LEFT JOIN HR_GANG g ON gl.GangCode = g.GangCode
                -- WHERE e.LocType = 1 -- Testing without LocType
        `);
        console.log("Employee Query PASSED:", empRows.length > 0 ? "Got Data" : "No Data");
        if (empRows.length > 0) console.log(Object.keys(empRows[0]));
    } catch (e: any) {
        console.error("Employee Query FAILED:", e.message);
    }

    process.exit(0);
}

testQuery().catch(console.error);
