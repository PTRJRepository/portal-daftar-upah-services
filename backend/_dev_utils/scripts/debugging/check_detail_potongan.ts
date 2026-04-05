import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    // Get one record and check detail
    const masterRows = await extDb.query<any>(`
        SELECT TOP 1 id, gang_code, total_upah_kotor, total_potongan, total_upah_bersih, total_employees
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026 AND gang_code = 'A1H'
    `);
    
    if (masterRows.length === 0) {
        console.log("No data found");
        return;
    }
    
    const master = masterRows[0];
    console.log(`Gang: ${master.gang_code}`);
    console.log(`Employees: ${master.total_employees}`);
    console.log(`upah_kotor: ${(master.total_upah_kotor || 0).toLocaleString('id-ID')}`);
    console.log(`potongan: ${(master.total_potongan || 0).toLocaleString('id-ID')}`);
    console.log(`upah_bersih: ${(master.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    console.log(`verify: ((master.total_upah_kotor || 0) - (master.total_potongan || 0)).toLocaleString('id-ID')`);
    
    // Check detail records
    const detailRows = await extDb.query<any>(`
        SELECT emp_code, emp_name, jumlah_upah_kotor, total_potongan, upah_bersih,
               pot_pph21, pot_bpjs_pekerja_total, pot_spsi, pot_koreksi
        FROM dbo.payroll_history_detail
        WHERE master_id IN (
            SELECT id FROM dbo.payroll_history_master
            WHERE period_month = 3 AND period_year = 2026 AND gang_code = 'A1H'
        )
        ORDER BY emp_code
    `);
    
    console.log(`\nEmployee details (${detailRows.length}):\n`);
    
    let detailTotalKotor = 0;
    let detailTotalPotongan = 0;
    let detailTotalBersih = 0;
    let detailTotalPph21 = 0;
    let detailTotalBpjs = 0;
    let detailTotalSpsi = 0;
    let detailTotalKoreksi = 0;
    
    for (const emp of detailRows.slice(0, 5)) {
        console.log(`${emp.emp_code} (${emp.emp_name}):`);
        console.log(`  kotor=${(emp.jumlah_upah_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`  potongan=${(emp.total_potongan || 0).toLocaleString('id-ID')}`);
        console.log(`  bersih=${(emp.upah_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`  pph21=${(emp.pot_pph21 || 0).toLocaleString('id-ID')}`);
        console.log(`  bpjs=${(emp.pot_bpjs_pekerja_total || 0).toLocaleString('id-ID')}`);
        console.log(`  spsi=${(emp.pot_spsi || 0).toLocaleString('id-ID')}`);
        console.log(`  koreksi=${(emp.pot_koreksi || 0).toLocaleString('id-ID')}`);
        console.log();
        
        detailTotalKotor += emp.jumlah_upah_kotor || 0;
        detailTotalPotongan += emp.total_potongan || 0;
        detailTotalBersih += emp.upah_bersih || 0;
        detailTotalPph21 += emp.pot_pph21 || 0;
        detailTotalBpjs += emp.pot_bpjs_pekerja_total || 0;
        detailTotalSpsi += emp.pot_spsi || 0;
        detailTotalKoreksi += emp.pot_koreksi || 0;
    }
    
    // Get totals from all details
    for (const emp of detailRows) {
        detailTotalKotor += emp.jumlah_upah_kotor || 0;
        detailTotalPotongan += emp.total_potongan || 0;
        detailTotalBersih += emp.upah_bersih || 0;
    }
    // Subtract the first 5 since we already added them
    for (const emp of detailRows.slice(0, 5)) {
        detailTotalKotor -= emp.jumlah_upah_kotor || 0;
        detailTotalPotongan -= emp.total_potongan || 0;
        detailTotalBersih -= emp.upah_bersih || 0;
    }
    
    console.log(`\nDETAIL TOTALS:`);
    console.log(`  kotor: ${detailTotalKotor.toLocaleString('id-ID')}`);
    console.log(`  potongan: ${detailTotalPotongan.toLocaleString('id-ID')}`);
    console.log(`  bersih: ${detailTotalBersih.toLocaleString('id-ID')}`);
    console.log(`  pph21: ${detailTotalPph21.toLocaleString('id-ID')}`);
    console.log(`  bpjs: ${detailTotalBpjs.toLocaleString('id-ID')}`);
    console.log(`  spsi: ${detailTotalSpsi.toLocaleString('id-ID')}`);
    console.log(`  koreksi: ${detailTotalKoreksi.toLocaleString('id-ID')}`);
}

main().catch(console.error);
