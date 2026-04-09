import db from "../../src/db";

async function run() {
    console.log("Checking HR_EMPLOYEE...");
    try {
        const q = `
            SELECT RTRIM(EmpCode) as EmpCode, EmpName, NewICNo, GangCode, ResAddress, LocCode 
            FROM HR_EMPLOYEE 
            WHERE EmpName LIKE '%SANUSI%' OR NewICNo = '1906050505870001'
        `;
        const rows = await db.query(q);
        console.log("HR_EMPLOYEE records:", rows);
        
        console.log("Checking PR_ADTRANS...");
        // Check PR_ADTRANS for period 3 2026
        const adtrans = await db.query(`
            SELECT RTRIM(EmpCode) as EmpCode, PeriodMonth, PeriodYear, GangCode, Amount
            FROM PR_ADTRANS
            WHERE PeriodMonth = 3 AND PeriodYear = 2026 AND EmpCode IN (
                SELECT EmpCode FROM HR_EMPLOYEE WHERE EmpName LIKE '%SANUSI%'
            )
        `);
        console.log("PR_ADTRANS:", adtrans);
    } catch (e) {
        console.error(e);
    }
    
    process.exit(0);
}

run().catch(console.error);
