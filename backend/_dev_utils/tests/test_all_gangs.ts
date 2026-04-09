import { gangService } from "../../src/services/gangService";

async function main() {
    console.log("=== Testing ALL gangs ===\n");
    const gangs = await gangService.fetchGangs('ALL');
    console.log(`Total gangs: ${gangs.length}`);
    
    // Find F1BHL
    const f1bhl = gangs.find(g => g.gang_code === 'F1BHL');
    if (f1bhl) {
        console.log(`\nF1BHL found: ${f1bhl.gang_code} | ${f1bhl.loc_code} | ${f1bhl.description}`);
    } else {
        console.log(`\nF1BHL NOT FOUND!`);
    }
    
    // Show ARA gangs
    const araGangs = gangs.filter(g => g.loc_code === 'ARA');
    console.log(`\nARA gangs: ${araGangs.length}`);
    araGangs.forEach(g => console.log(`  ${g.gang_code} | ${g.description}`));
}

main().catch(console.error);
