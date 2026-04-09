import { Database } from '../../src/db/client';

async function testQuery() {
    const db = Database.getInstance();
    console.time("historicalGangQuery");
    
    try {
        const rows = await db.query(`
            SELECT DISTINCT
                RTRIM(g.GangID) as gang_code,
                RTRIM(g.Description) as description,
                RTRIM(e.LocCode) as loc_code
            FROM PR_GANGLN_ARC gl
            INNER JOIN PR_GANG g ON g.ID = gl.MasterID
            INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.EmpCode) = RTRIM(e.EmpCode)
            WHERE RTRIM(e.LocCode) IN ('P1A', 'PG1A')
                AND g.Description NOT LIKE '%WORKSHOP%'
                AND g.Description NOT LIKE '%INFRA%'
        `);
        console.timeEnd("historicalGangQuery");
        console.log("Got rows:", rows.length);
        console.log(rows.slice(0, 5));
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}

testQuery();
