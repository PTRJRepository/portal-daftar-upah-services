/**
 * Check brondol data specifically for harvest employees 
 */
import { DataExtractorService } from '../../src/services/dataExtractorService';

async function main() {
    const extractor = DataExtractorService.getInstance();
    const month = 3, year = 2026, division = 'PG1A';
    
    console.log(`Fetching payroll data for ${division} ${month}/${year}...`);
    
    const data = await extractor.extractPayrollData(
        month, year, 'ALL', division,
        null, undefined, false, undefined, undefined, true, true
    );
    
    if (!data?.data_rows?.length) { console.log('No data!'); process.exit(0); }
    
    // Find employees with brondol > 0
    const withBrondol = data.data_rows.filter((r: any) => 
        r.premi_brondol > 0 || r.premi_brondol_total > 0 || r.premi_brondol_loosefruit > 0 || r.premi_brondol_adtrans > 0
        || (r.premi && typeof r.premi === 'object' && Object.keys(r.premi).some(k => k.toLowerCase().includes('brondol') && r.premi[k] > 0))
    );
    
    console.log(`Total: ${data.data_rows.length}, withBrondol: ${withBrondol.length}`);
    
    if (withBrondol.length > 0) {
        const row = withBrondol[0];
        console.log(`\n=== Brondol employee: ${row.emp_code} ===`);
        console.log(`gang_code: ${row.gang_code}`);
        console.log(`premi_brondol: ${row.premi_brondol}`);
        console.log(`premi_brondol_total: ${row.premi_brondol_total}`);
        console.log(`premi_brondol_loosefruit: ${row.premi_brondol_loosefruit}`);
        console.log(`premi_brondol_adtrans: ${row.premi_brondol_adtrans}`);
        console.log(`total_premi: ${row.total_premi}`);
        
        // Check nested premi object for brondol-related keys
        if (row.premi && typeof row.premi === 'object') {
            const brondolKeys = Object.entries(row.premi).filter(([k]) => k.toLowerCase().includes('brondol'));
            console.log(`\nrow.premi brondol keys:`, brondolKeys);
        }
        
        // All premi keys with values
        console.log(`\nAll row.premi keys with values:`);
        if (row.premi && typeof row.premi === 'object') {
            for (const [k, v] of Object.entries(row.premi)) {
                if (v) console.log(`  premi.${k} = ${v}`);
            }
        }
    } else {
        console.log('No employees with brondol data found!');
        // Check a harvest gang employee
        const harvest = data.data_rows.filter((r: any) => r.gang_code && r.gang_code.endsWith('H'));
        console.log(`Harvest employees: ${harvest.length}`);
        if (harvest.length > 0) {
            const h = harvest[0];
            console.log(`Sample: ${h.emp_code}, gang=${h.gang_code}`);
            console.log(`  premi_brondol=${h.premi_brondol}, total=${h.premi_brondol_total}`);
            console.log(`  premi keys:`, h.premi ? Object.keys(h.premi) : 'none');
            console.log(`  total_premi: ${h.total_premi}`);
        }
    }
    
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
