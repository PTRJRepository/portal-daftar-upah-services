import { DataExtractorService } from '../../src/services/dataExtractorService';

async function testFix() {
    const service = new DataExtractorService();
    // Simulate what extractPayrollData does
    const divisionCode = "P1A"; // Plasma 1 Afdeling
    const month = 3;
    const year = 2024;
    
    // We want to test getEmployees behavior for P1A in historical
    const isVirtual = false;
    const aliases = ['P1A', 'P1a', 'pg1a', 'PLASMA1A'];
    const placeholders = aliases.map(a => `'${a.toUpperCase()}'`).join(',');
    const excludePlaceholders = ['IN', 'INT', 'AMC', 'HMC', 'B2N'].map(a => `'${a}'`).join(',');
    
    let gangCondition = `(UPPER(RTRIM(e.LocCode)) IN (${placeholders}) AND UPPER(RTRIM(g.GangCode)) NOT IN (${excludePlaceholders}))`;
    console.log("Original gangCondition:", gangCondition);
    
    // The service replaces g.GangCode with g.GangID
    console.log("Historical gangCondition:", gangCondition.replace(/g\.GangCode/ig, 'g.GangID'));
    
    // Let's call getEmployees with this new gangCondition
    const employees = await service.getEmployees(gangCondition, month, year, undefined, true, null);
    
    console.log(`P1A has ${employees.length} employees historical`);
    
    // check if it includes ANY PERCOBAAN gangs like A1P
    const percobaanCount = employees.filter(e => e.gang_code?.includes('P') || e.gang_desc?.toLowerCase().includes('percobaan'));
    console.log(`Found ${percobaanCount.length} PERCOBAAN employees`);
    
    if (percobaanCount.length > 0) {
        console.log("Sample:", percobaanCount[0]);
    }
    
    process.exit(0);
}

testFix();
