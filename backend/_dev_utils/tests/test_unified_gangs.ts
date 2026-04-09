import { Database } from '../../src/db/client';

async function testFetchAllGangs() {
    const db = Database.getInstance();
    
    // Test P1A
    const aliases = ['P1A', 'P1a', 'pg1a', 'PLASMA1A'];
    const placeholders = aliases.map(a => `'${a.toUpperCase()}'`).join(',');
    
    const gangsToExclude = ['IN', 'INT', 'AMC', 'HMC', 'B2N'];
    let excludeClause = '';
    let queryParams: any[] = [];
    
    if (gangsToExclude.length > 0) {
        const excludePlaceholders = gangsToExclude.map(() => '?').join(',');
        excludeClause = `AND RTRIM(GangCode) NOT IN (${excludePlaceholders})`;
        queryParams = gangsToExclude;
    }
    
    console.time("Combined Query");
    try {
        const liveQuery = `
            SELECT DISTINCT
                RTRIM(g.GangCode) as gang_code,
                COALESCE(RTRIM(h.Description), 'Gang Historis / Tanpa Master') as description,
                RTRIM(e.LocCode) as loc_code
            FROM HR_GANGLN g
            LEFT JOIN HR_GANG h ON g.GangCode = h.GangCode
            INNER JOIN HR_EMPLOYEE e ON RTRIM(g.GangMember) = RTRIM(e.EmpCode)
            WHERE RTRIM(e.LocCode) IN (${placeholders})
                ${excludeClause.replace(/GangCode/g, 'g.GangCode')}
                AND (h.Description IS NULL OR (h.Description NOT LIKE '%WORKSHOP%' AND h.Description NOT LIKE '%INFRA%'))
        `;
        
        const historyQuery = `
            SELECT DISTINCT
                RTRIM(g.GangID) as gang_code,
                RTRIM(g.Description) as description,
                RTRIM(e.LocCode) as loc_code
            FROM PR_GANGLN_ARC gl
            INNER JOIN PR_GANG g ON g.ID = gl.MasterID
            INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.EmpCode) = RTRIM(e.EmpCode)
            WHERE RTRIM(e.LocCode) IN (${placeholders})
                ${excludeClause.replace(/GangCode/g, 'g.GangID')}
                AND g.Description NOT LIKE '%WORKSHOP%'
                AND g.Description NOT LIKE '%INFRA%'
        `;
        
        const liveRows = await db.query<any>(liveQuery, queryParams);
        const historyRows = await db.query<any>(historyQuery, queryParams);
        
        console.timeEnd("Combined Query");
        
        const all = [...liveRows, ...historyRows];
        const seen = new Set();
        const final = all.filter(r => {
            if (seen.has(r.gang_code)) return false;
            seen.add(r.gang_code);
            return true;
        });
        
        console.log(`Live: ${liveRows.length}, History: ${historyRows.length}, Combined: ${final.length}`);
        console.log("Sample Historical (Percobaan?):", final.filter(f => f.description.includes('PERCOBAAN')));
        
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}

testFetchAllGangs();
