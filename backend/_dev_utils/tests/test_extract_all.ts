import { dataExtractorService } from '../../src/services/dataExtractorService.ts';
import { Config } from '../../src/config.ts';

async function main() {
    console.log("Calling extractPayrollData with ALL...");
    const month = 3;
    const year = 2026;
    const div = 'PG1A';
    
    try {
        const result = await dataExtractorService.extractPayrollData(
            month, year, "ALL", div, null, Config.DB_PROFILE, false, false, undefined, true
        );
        
        console.log(`Employees: ${result?.data_rows?.length}`);
        console.log(`Gangs in result:`, Object.keys(result.meta || {}), result.gangs?.length);
        
    } catch(e) {
        console.error("Crash!", e);
    }
    process.exit(0);
}

main();
