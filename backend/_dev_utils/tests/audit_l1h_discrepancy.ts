
import { DataExtractorService } from '../src/services/dataExtractorService';
import { Config } from '../src/services/config';

async function verifyL1H() {
    console.log("Starting L1H audit...");
    const res = await DataExtractorService.getInstance().extractPayrollData(3, 2026, 'ALL', 'ALL', undefined, Config.DB_PROFILE, false, true);
    const l1hRows = res.data_rows.filter(r => r.gang_code?.trim() === 'L1H');
    
    console.log(`Total L1H rows found: ${l1hRows.length}`);
    
    let totalPphAll = 0;
    let totalPphActive = 0;
    
    for (const r of l1hRows) {
        const pph = Number(r.pph21_ter) || 0;
        const hk = Number(r.jumlah_hk) || 0;
        
        totalPphAll += pph;
        if (hk > 0) {
            totalPphActive += pph;
        } else if (pph > 0) {
            console.log(`FOUND DISCREPANCY CANDIDATE: ${r.emp_code} | ${r.nama} | HK=${hk} | PPh=${pph}`);
        }
    }
    
    console.log(`----------------------------------------`);
    console.log(`Total PPh All: ${totalPphAll}`);
    console.log(`Total PPh Active (HK > 0): ${totalPphActive}`);
    console.log(`Difference: ${totalPphAll - totalPphActive}`);
    console.log(`----------------------------------------`);
}

verifyL1H().catch(error => {
    console.error("Audit script failed:", error);
});
