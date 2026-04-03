/**
 * Trace exact KONTAN lookup for a specific employee
 * Find why KONTAN is not matching despite NIK being present
 */
import { Database } from '../../src/db/client';
import { currentPeriodService } from '../../src/services/currentPeriodService';
import * as fs from 'fs';

const mainDb = Database.getInstance();
const extDb = Database.getExtendedInstance();

const lines: string[] = [];
function log(msg: string) {
    console.log(msg);
    lines.push(msg);
}

async function run() {
    const period = await currentPeriodService.getCurrentPeriod();
    const month = period.month;
    const year = period.year;
    log(`Period: ${month}/${year}`);

    // Get first 5 KONTAN records with their NIK
    const kontanRecs = await extDb.query<any>(`
        SELECT TOP 10 id, nik, emp_code, emp_name, income_type, amount, gang_code
        FROM employee_other_incomes
        WHERE (income_type = 'KONTAN' OR income_type = 'KONTANAN')
          AND period_year = ? AND period_month = ?
        ORDER BY id
    `, [year, month]);

    log(`\n=== KONTAN records (${kontanRecs.length}) ===`);
    for (const r of kontanRecs) {
        log(`  id=${r.id}, nik="${r.nik}", code="${r.emp_code}", amount=${r.amount}, gang=${r.gang_code}`);
        
        // For each KONTAN record, find the employee in HR_GANGLN
        if (r.nik) {
            // Find current emp_code via NIK
            const hrRows = await mainDb.query<any>(`
                SELECT RTRIM(e.EmpCode) as emp_code, RTRIM(e.EmpName) as emp_name, RTRIM(e.NewICNo) as nik
                FROM HR_EMPLOYEE e
                WHERE RTRIM(e.NewICNo) = ?
                ORDER BY e.CreateDate DESC
            `, [r.nik.trim()]);
            
            if (hrRows.length === 0) {
                log(`    → HR_EMPLOYEE: NOT FOUND for NIK ${r.nik}`);
            } else {
                log(`    → HR_EMPLOYEE (${hrRows.length} records):`);
                for (const h of hrRows) {
                    log(`      EmpCode=${h.emp_code}, Name="${h.emp_name}"`);
                    
                    // Check gang membership
                    const gangRows = await mainDb.query<any>(`
                        SELECT RTRIM(GangCode) as gang_code FROM HR_GANGLN WHERE RTRIM(GangMember) = ?
                    `, [h.emp_code]);
                    if (gangRows.length > 0) {
                        log(`      Current gangs: ${gangRows.map((g: any) => g.gang_code).join(', ')}`);
                    } else {
                        log(`      NOT in any gang (transferred/left?)`);
                    }
                }
            }
        }
    }

    // Also check PG1A members to see if any have KONTAN
    log(`\n=== PG1A members KONTAN check ===`);
    const pg1aMembers = await mainDb.query<any>(`
        SELECT RTRIM(gl.GangCode) as gang, RTRIM(gl.GangMember) as emp_code,
               RTRIM(e.EmpName) as emp_name, RTRIM(ISNULL(e.NewICNo,'')) as nik
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE gl.GangCode LIKE 'P1A%'
    `);
    
    log(`PG1A members: ${pg1aMembers.length}`);
    
    const kontanNiks = new Set(kontanRecs.map((r: any) => (r.nik || '').trim().toUpperCase()));
    let kontanMatchCount = 0;
    const kontanMatchList: any[] = [];
    
    for (const m of pg1aMembers) {
        const nik = (m.nik || '').trim().toUpperCase();
        if (nik && kontanNiks.has(nik)) {
            kontanMatchCount++;
            kontanMatchList.push(m);
        }
    }
    
    log(`PG1A members with KONTAN in DB: ${kontanMatchCount}`);
    for (const m of kontanMatchList) {
        log(`  EmpCode=${m.emp_code}, NIK=${m.nik}, Name="${m.emp_name}"`);
    }

    // Verify the exact NIK used in dataExtractor vs stored in employee_other_incomes
    // The employee's 'actual_nik' comes from HR_EMPLOYEE.NewICNo (via hrOverride)
    // Let's check the FIRST KONTAN record NIK directly:
    if (kontanRecs.length > 0) {
        const firstKontan = kontanRecs[0];
        const storedNik = (firstKontan.nik || '').trim();
        log(`\n=== TRACE: First KONTAN NIK = "${storedNik}" ===`);
        
        // The code does: empNik = String(emp.actual_nik || '').trim().toUpperCase()
        // emp.actual_nik comes from HR_EMPLOYEE.NewICNo 
        // Let's check what HR_EMPLOYEE.NewICNo looks like for the stored emp_code
        if (firstKontan.emp_code && firstKontan.emp_code !== 'null') {
            const hrByCode = await mainDb.query<any>(`
                SELECT RTRIM(EmpCode) as emp_code, RTRIM(ISNULL(NewICNo,'')) as nik, RTRIM(EmpName) as name
                FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = ?
            `, [firstKontan.emp_code]);
            log(`HR_EMPLOYEE by emp_code "${firstKontan.emp_code}": ${hrByCode.length} rows`);
            for (const h of hrByCode) {
                log(`  emp_code=${h.emp_code}, nik="${h.nik}", name="${h.name}"`);
                log(`  NIK MATCH: stored="${storedNik}" vs HR="${h.nik.trim().toUpperCase()}" = ${storedNik.toUpperCase() === h.nik.trim().toUpperCase()}`);
            }
        }
        
        // The map is built using: (inc.nik || '').trim().toUpperCase()
        // The lookup uses: empNik = String(emp.actual_nik || '').trim().toUpperCase()
        log(`\nNIK format check:`);
        log(`  Stored NIK: "${storedNik}" (length=${storedNik.length})`);
        log(`  UPPER: "${storedNik.toUpperCase()}" (length=${storedNik.toUpperCase().length})`);
        log(`  Char codes: ${Array.from(storedNik).slice(0, 5).map(c => c.charCodeAt(0)).join(',')}`);
    }

    // Final check: does OtherIncomesService.getIncomes return records for PG1A?
    log(`\n=== All KONTAN NIKs vs PG1A NIKs ===`);
    const allPg1aNiks = new Set(pg1aMembers.map((m: any) => (m.nik || '').trim().toUpperCase()).filter(Boolean));
    const allKontanNiksUpper = new Set(kontanRecs.map((r: any) => (r.nik || '').trim().toUpperCase()).filter(Boolean));
    
    log(`PG1A NIKs count: ${allPg1aNiks.size}`);
    log(`KONTAN NIKs count: ${allKontanNiksUpper.size}`);
    
    const intersection = [...allPg1aNiks].filter(n => allKontanNiksUpper.has(n));
    log(`Intersection (PG1A members with KONTAN): ${intersection.length}`);
    
    // Log which KONTAN NIKs are for which gang
    log(`\nKONTAN records by gang_code:`);
    const byGang: Record<string, number> = {};
    for (const r of kontanRecs) {
        const g = r.gang_code || 'UNKNOWN';
        byGang[g] = (byGang[g] || 0) + 1;
    }
    for (const [g, cnt] of Object.entries(byGang)) {
        log(`  Gang ${g}: ${cnt} KONTAN records`);
    }

    fs.writeFileSync('_dev_utils/tests/kontan_trace.txt', lines.join('\n'));
    log('\nSaved to _dev_utils/tests/kontan_trace.txt');
    process.exit(0);
}

run().catch(e => { 
    const errMsg = `Error: ${e.message}\n${e.stack}`;
    console.error(errMsg); 
    fs.writeFileSync('_dev_utils/tests/kontan_trace.txt', errMsg);
    process.exit(1); 
});
