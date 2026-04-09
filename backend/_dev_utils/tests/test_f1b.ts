import { DataExtractorService } from '../../src/services/dataExtractorService';

async function testGangs() {
    const service = (DataExtractorService as any).getInstance();
    const month = 3;
    const year = 2026;
    
    try {
        console.log("Fetching employees for Gang F1BHL...");
        const gangCondition = `(UPPER(RTRIM(gl.GangCode)) = 'F1BHL' OR UPPER(RTRIM(g.GangCode)) = 'F1BHL' OR UPPER(RTRIM(g.Description)) = 'F1BHL')`;
        
        const employees = await service.getEmployees(gangCondition, month, year, undefined, false, 'F1BHL');
        
        console.log(`Found ${employees.length} employees`);
        if (employees.length > 0) {
            console.log(employees[0]);
        }
    } catch(e) {
        console.error("Error", e);
    }
    process.exit(0);
}

testGangs();
