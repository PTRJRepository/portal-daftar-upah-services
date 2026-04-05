import { Database } from "../../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    const startDate = '2026-03-01';
    const endDate = '2026-04-01';
    
    // Check PPH21 per gang/empCode
    const rows = await db.query<any>(`
        SELECT 
            RTRIM(t.EmpCode) as emp_code,
            t.DocDesc,
            SUM(ln.Amount) as total
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
          AND UPPER(t.DocDesc) LIKE '%PPH%'
        GROUP BY RTRIM(t.EmpCode), t.DocDesc
        ORDER BY total DESC
    `);
    
    console.log(`PPH21 transactions: ${rows.length}\n`);
    
    // Now check which gangs these employees belong to
    const empCodes = rows.slice(0, 50).map(r => r.emp_code);
    const empList = empCodes.map(e => `'${e}'`).join(',');
    
    const gangMap = await db.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(gl.GangCode) as gang_code, RTRIM(g.LocCode) as division_code
        FROM HR_GANGLN gl
        JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE RTRIM(gl.GangMember) IN (${empList})
    `);
    
    const gangLookup = new Map<string, {gang: string, div: string}>();
    for (const r of gangMap) {
        gangLookup.set(r.emp_code, { gang: r.gang_code, div: r.division_code });
    }
    
    // Group PPH21 by division
    const divMap: Record<string, number> = {};
    for (const r of rows) {
        const info = gangLookup.get(r.emp_code);
        const div = info?.div || 'UNKNOWN';
        divMap[div] = (divMap[div] || 0) + (r.total || 0);
    }
    
    console.log("PPH21 per division (from PR_ADTRANS):\n");
    let grandTotal = 0;
    for (const [div, total] of Object.entries(divMap).sort((a, b) => b[1] - a[1])) {
        grandTotal += total;
        console.log(`  ${div}: ${total.toLocaleString('id-ID')}`);
    }
    console.log(`\nGrand Total: ${grandTotal.toLocaleString('id-ID')}`);
    
    // Sample employees from P1A
    const p1aEmps = rows.filter(r => {
        const info = gangLookup.get(r.emp_code);
        return info?.div === 'P1A' || info?.div === 'PG1A';
    });
    console.log(`\nPPH21 employees in P1A: ${p1aEmps.length}`);
    if (p1aEmps.length > 0) {
        p1aEmps.slice(0, 5).forEach(r => {
            const info = gangLookup.get(r.emp_code);
            console.log(`  ${r.emp_code} → ${info?.gang || '?'} (${info?.div || '?'}) = ${r.total.toLocaleString('id-ID')}`);
        });
    }
}

main().catch(console.error);
