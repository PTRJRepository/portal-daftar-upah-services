
import { DataExtractorService } from '../src/services/dataExtractorService';
import { Config } from '../src/services/config';

async function finalAudit() {
    console.log("Starting final audit for IJ1/L1H...");
    // Fetch all employees for March 2026
    const res = await DataExtractorService.getInstance().extractPayrollData(3, 2026, 'ALL', 'ALL', undefined, Config.DB_PROFILE, false, true);
    
    // Find rows belonging to gang L1H
    const l1hRows = res.data_rows.filter(r => r.gang_code?.trim() === 'L1H');
    console.log(`Employees in L1H: ${l1hRows.length}`);
    
    const totalPphAll = l1hRows.reduce((s, r) => s + (Number(r.pph21_ter) || 0), 0);
    const totalPphActiveOnly = l1hRows.filter(r => Number(r.jumlah_hk || 0) > 0).reduce((s, r) => s + (Number(r.pph21_ter) || 0), 0);
    
    console.log(`Total PPh (All): ${totalPphAll.toFixed(0)}`);
    console.log(`Total PPh (Active HK > 0): ${totalPphActiveOnly.toFixed(0)}`);
    console.log(`Difference: ${(totalPphAll - totalPphActiveOnly).toFixed(0)}`);

    const discrepantEmployees = l1hRows.filter(r => (Number(r.jumlah_hk) || 0) === 0 && Number(r.pph21_ter) > 0);
    discrepantEmployees.forEach(e => {
        console.log(`FOUND INACTIVE EMPLOYEE WITH TAX: ${e.emp_code} | ${e.nama} | PPh: ${e.pph21_ter}`);
    });
}

finalAudit().catch(console.error);
