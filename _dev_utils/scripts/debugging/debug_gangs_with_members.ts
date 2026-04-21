
import { divisionConfigService } from "../services/config/DivisionConfigService";
import { Database } from "../db/client";

async function debugGangs() {
    const db = Database.getInstance();
    const divisions = ["PG1A", "PG1B", "AB1", "AB2"];

    for (const div of divisions) {
        console.log(`\n=== DEBUGGING GANGS FOR DIVISION: ${div} ===`);
        const gangs = await divisionConfigService.getGangsForDivision(div);
        console.log(`Service returned ${gangs.length} gangs.`);

        for (const gang of gangs) {
            const memberCount = await db.query<any>(`
                SELECT COUNT(*) as count FROM HR_GANGLN WHERE GangCode = ?
            `, [gang.gang_code]);
            
            const count = memberCount[0]?.count || 0;
            if (count === 0) {
                console.log(`[EMPTY] Gang: ${gang.gang_code} | Desc: ${gang.description}`);
            } else {
                // console.log(`[VALID] Gang: ${gang.gang_code} | Desc: ${gang.description} | Members: ${count}`);
            }
        }

        // Check if there are gangs in HR_GANGLN for this division that are NOT in the returned list
        const aliases = divisionConfigService.getAliases(div);
        const placeholders = aliases.map(() => '?').join(',');
        
        const missingGangs = await db.query<any>(`
            SELECT DISTINCT g.GangCode, h.Description, h.LocCode
            FROM HR_GANGLN g
            JOIN HR_EMPLOYEE e ON g.GangMember = e.EmpCode
            LEFT JOIN HR_GANG h ON g.GangCode = h.GangCode
            WHERE e.LocCode IN (${placeholders})
            AND g.GangCode NOT IN (${gangs.map(() => '?').join(',')})
        `, [...aliases, ...gangs.map(g => g.gang_code)]);

        // Proposed new approach: Query based on HR_GANGLN and HR_EMPLOYEE
        console.log(`\n--- Testing proposed approach for ${div} ---`);
        const proposedGangs = await db.query<any>(`
            SELECT DISTINCT 
                g.GangCode as gang_code, 
                COALESCE(RTRIM(h.Description), 'GANG TANPA DESKRIPSI') as description,
                COALESCE(RTRIM(h.LocCode), RTRIM(e.LocCode)) as loc_code
            FROM HR_GANGLN g
            JOIN HR_EMPLOYEE e ON g.GangMember = e.EmpCode
            LEFT JOIN HR_GANG h ON g.GangCode = h.GangCode
            WHERE RTRIM(e.LocCode) IN (${placeholders})
            ORDER BY g.GangCode
        `, aliases);

        console.log(`Proposed approach found ${proposedGangs.length} gangs:`);
        proposedGangs.forEach((g: any) => {
            console.log(`  Code: ${g.gang_code} | Desc: ${g.description} | LocCode: ${g.loc_code}`);
        });
    }
}

debugGangs().catch(console.error);
