import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    const divisions = ["P1A", "P1B", "P2A", "P2B", "AB1", "AB2", "ARA", "ARC", "DME", "IJL"];
    
    console.log("Division Analysis (HR_GANG vs Member LocCode)");
    console.log("----------------------------------------------");
    
    for (const loc of divisions) {
        const gangsG = await db.query(`SELECT DISTINCT GangCode FROM HR_GANG WHERE LocCode = ?`, [loc]);
        const gangsE = await db.query(`
            SELECT DISTINCT gl.GangCode 
            FROM HR_GANGLN gl 
            INNER JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode 
            WHERE e.LocCode = ?
        `, [loc]);
        
        const gSet = new Set(gangsG.map((r: any) => r.GangCode.trim().toUpperCase()));
        const eSet = new Set(gangsE.map((r: any) => r.GangCode.trim().toUpperCase()));
        
        const onlyInG = [...gSet].filter(x => !eSet.has(x));
        const onlyInE = [...eSet].filter(x => !gSet.has(x));
        
        console.log(`${loc}: HR_GANG=${gangsG.length}, MemberLoc=${gangsE.length} | ONLY_G=${onlyInG.length}, ONLY_E=${onlyInE.length}`);
    }
}

main().catch(console.error).finally(() => process.exit(0));
