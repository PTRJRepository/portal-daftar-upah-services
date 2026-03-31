import { DataExtractorService } from "../../backend/src/services/dataExtractorService";

async function testExtract() {
    console.log("=== Mengambil Payroll Data untuk Gang B2N ===");
    const extractor = DataExtractorService.getInstance();
    const data = await extractor.extractPayrollData(3, 2026, 'B2N', 'PB', null, 'SERVER_PROFILE_2');
    
    console.log(`Berhasil mengambil ${data.data_rows.length} baris data.` );
    console.log("Daftar Karyawan dan THR-nya:");
    
    let countThr = 0;
    
    for (const row of data.data_rows) {
        const hasThr = row.pendapatan_lainnya_amount > 0 || row.pendapatan_tidak_tetap_thp > 0;
        
        let detail = `  - ${row.emp_code} | NIK: ${row.nik} | NAMA: ${row.nama.padEnd(30)}`;
        if (hasThr) {
            countThr++;
            detail += ` | THR Amount: Rp ${(row.pendapatan_lainnya_amount || row.pendapatan_tidak_tetap_thp).toLocaleString()}`;
        } else {
            detail += ` | THR Amount: (KOSONG)`;
        }
        
        console.log(detail);
    }
    
    console.log(`\nTotal karyawan yang punya THR: ${countThr} / ${data.data_rows.length}`);
}

testExtract().catch(e => {
    console.error("\n=== ERROR STACK DUMP ===");
    console.error(e.stack || e);
}).finally(() => process.exit());
