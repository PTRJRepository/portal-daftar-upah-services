import { divisionConfigService } from "../../src/services/config/DivisionConfigService";

async function main() {
    const divisions = ['PG1A', 'PG1B', 'PG2A', 'PG2B', 'ARA', 'ARC', 'AB1', 'AB2', 'DME', 'IJL'];
    
    for (const div of divisions) {
        const gangs = await divisionConfigService.getGangsForDivision(div);
        console.log(`\n${div}: ${gangs.length} gangs`);
        gangs.forEach(g => {
            console.log(`  ${g.gang_code} | ${g.loc_code} | ${g.description}`);
        });
    }
}

main().catch(console.error);
