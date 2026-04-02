import { dataExtractorService } from '../../src/services/dataExtractorService';
import { gangService } from '../../src/services/gangService';
import { currentPeriodService } from '../../src/services/currentPeriodService';

async function test() {
    try {
        console.log("Fetching period...");
        const period = await currentPeriodService.getCurrentPeriod();
        console.log(`Period: ${period.month}/${period.year}`);

        console.log("Fetching gangs for PG1A...");
        const gangs = await gangService.fetchGangs("PG1A");
        if (gangs.length === 0) {
            console.log("No gangs found for PG1A, trying 'ALL'");
        }
        
        console.log("Extracting payroll data...");
        // divisionCode = 'PG1A', gangCode = 'ALL' or specific
        const result = await dataExtractorService.extractPayrollData(
            period.month, 
            period.year, 
            "ALL", 
            "PG1A", 
            null, 
            undefined, 
            false, 
            false
        );

        console.log(`Total data rows: ${result.data_rows.length}`);
        
        // Find rows with non-empty 'role jabatan', 'thr', or 'kontan/kontanan'
        const hasJabatanEstate = result.data_rows.filter(r => r.jabatan_estate && r.jabatan_estate !== '-' && r.jabatan_estate !== '');
        const hasJabatanJumlah = result.data_rows.filter(r => r.jabatan_jumlah > 0);
        const hasThr = result.data_rows.filter(r => r.pendapatan_thr > 0 || (r.other_incomes && r.other_incomes.some(i => i.type === 'THR')));
        const hasKontan = result.data_rows.filter(r => r.pendapatan_kontan > 0 || r.pendapatan_kontanan > 0 || (r.other_incomes && r.other_incomes.some(i => i.type === 'KONTAN' || i.name === 'KONTAN' || i.type === 'KONTANAN')));

        console.log(`Rows with jabatan_estate: ${hasJabatanEstate.length}`);
        if (hasJabatanEstate.length > 0) console.log(`Example: NIK=${hasJabatanEstate[0].nik}, Jabatan=${hasJabatanEstate[0].jabatan_estate}`);
        
        console.log(`Rows with jabatan_jumlah: ${hasJabatanJumlah.length}`);
        if (hasJabatanJumlah.length > 0) console.log(`Example: NIK=${hasJabatanJumlah[0].nik}, JabatanAmt=${hasJabatanJumlah[0].jabatan_jumlah}`);

        console.log(`Rows with THR: ${hasThr.length}`);
        if (hasThr.length > 0) console.log(`Example: NIK=${hasThr[0].nik}, THR=${hasThr[0].pendapatan_thr}`);

        console.log(`Rows with Kontan: ${hasKontan.length}`);
        if (hasKontan.length > 0) console.log(`Example: NIK=${hasKontan[0].nik}, otherIncomes=${JSON.stringify(hasKontan[0].other_incomes)}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit();
    }
}

test();
