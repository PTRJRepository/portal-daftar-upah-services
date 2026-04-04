/**
 * Diagnostic script to check employee_estate data and jabatan mapping
 */
import { EmployeeEstateService } from './backend/src/services/employeeEstateService.js';
import { Database } from './backend/src/db/client.js';

async function diagnoseJabatan() {
    console.log('=== JABATAN DIAGNOSTIC ===\n');

    // 1. Check employee_estate table
    console.log('1. Checking employee_estate table...');
    const extDb = Database.getExtendedInstance();
    const estateRows = await extDb.query<any>(
        'SELECT COUNT(*) as total FROM employee_estate WHERE jabatan IS NOT NULL AND RTRIM(jabatan) != \'\'',
    );
    console.log(`   Total records with jabatan: ${estateRows[0].total}\n`);

    // 2. Sample some records
    console.log('2. Sample employee_estate records:');
    const sampleRows = await extDb.query<any>(
        'SELECT TOP 5 empcode, employee_name, jabatan, gang, divisi_id FROM employee_estate WHERE jabatan IS NOT NULL AND RTRIM(jabatan) != \'\' ORDER BY empcode',
    );
    for (const row of sampleRows) {
        console.log(`   - ${row.empcode}: ${row.employee_name} → ${row.jabatan} (${row.gang}/${row.divisi_id})`);
    }
    console.log('');

    // 3. Get mappings with NIK
    console.log('3. Getting employee job mappings with NIK...');
    const { empcodeMap, nikMap } = await EmployeeEstateService.getEmployeeJobsWithNik();
    console.log(`   empcodeMap entries: ${Object.keys(empcodeMap).length}`);
    console.log(`   nikMap entries: ${Object.keys(nikMap).length}\n`);

    // 4. Sample mappings
    console.log('4. Sample empcodeMap entries:');
    const empcodeSample = Object.entries(empcodeMap).slice(0, 5);
    for (const [code, jabatan] of empcodeSample) {
        console.log(`   ${code} → ${jabatan}`);
    }
    console.log('');

    console.log('5. Sample nikMap entries:');
    const nikSample = Object.entries(nikMap).slice(0, 5);
    for (const [nik, jabatan] of nikSample) {
        console.log(`   ${nik} → ${jabatan}`);
    }
    console.log('');

    // 5. Check HR_EMPLOYEE to see if we can join
    console.log('6. Checking HR_EMPLOYEE table...');
    const mainDb = Database.getInstance();
    const empCount = await mainDb.query<any>(
        'SELECT COUNT(*) as total FROM HR_EMPLOYEE',
    );
    console.log(`   Total HR_EMPLOYEE records: ${empCount[0].total}\n`);

    // 6. Sample HR_EMPLOYEE with NIK
    console.log('7. Sample HR_EMPLOYEE records:');
    const hrSample = await mainDb.query<any>(
        'SELECT TOP 5 RTRIM(EmpCode) as EmpCode, RTRIM(ISNULL(NewICNo,\'\'')) as NewICNo, RTRIM(EmpName) as EmpName FROM HR_EMPLOYEE ORDER BY EmpCode',
    );
    for (const row of hrSample) {
        const nikMapMatch = nikMap[row.NewICNo];
        console.log(`   ${row.EmpCode} (NIK: ${row.NewICNo}) - ${row.EmpName} ${nikMapMatch ? `→ jabatan: ${nikMapMatch}` : '(no jabatan map)'}`);
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

diagnoseJabatan().catch((err) => {
    console.error('Diagnostic failed:', err);
    process.exit(1);
});
