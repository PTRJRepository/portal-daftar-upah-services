import { dataExtractorService } from "../../../src/services/dataExtractorService";

async function main() {
    const gangCode = "H1H";
    const division = "ARB2";
    const month = 3;
    const year = 2026;
    
    console.log(`=== CHECKING LIVE H1H DATA ===\n`);
    
    const result = await dataExtractorService.extractPayrollData(
        month, year, gangCode, division, null, "SERVER_PROFILE_2", 
        false, false, undefined, true
    );
    
    const rows = result.data_rows || [];
    console.log(`Total employees in live: ${rows.length}\n`);
    
    let totalKotor = 0;
    let totalPotongan = 0;
    let totalBersih = 0;
    
    console.log(`Employee breakdown:\n`);
    for (const emp of rows) {
        console.log(`${emp.emp_code} | HK: ${emp.jumlah_hk} | kotor: ${(emp.jumlah_upah_kotor || 0).toLocaleString('id-ID')} | potongan: ${(emp.total_potongan || 0).toLocaleString('id-ID')} | bersih: ${(emp.upah_bersih || 0).toLocaleString('id-ID')}`);
        totalKotor += emp.jumlah_upah_kotor || 0;
        totalPotongan += emp.total_potongan || 0;
        totalBersih += emp.upah_bersih || 0;
    }
    
    console.log(`\n=== TOTALS ===`);
    console.log(`upah_kotor: ${totalKotor.toLocaleString('id-ID')}`);
    console.log(`potongan: ${totalPotongan.toLocaleString('id-ID')}`);
    console.log(`upah_bersih: ${totalBersih.toLocaleString('id-ID')}`);
    console.log(`Expected: 176.414.884`);
    console.log(`Difference: ${(totalBersih - 176414884).toLocaleString('id-ID')}`);
}

main().catch(console.error);
