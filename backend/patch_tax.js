const fs = require('fs');
const path = require('path');

const tsPath = path.join(__dirname, 'src/services/taxReportService.ts');
let content = fs.readFileSync(tsPath, 'utf8');

const interfaceStr = `
export interface DecemberTaxRow {
    no: number;
    emp_code: string;
    emp_name: string;
    nik: string;
    npwp: string;
    alamat: string;
    jabatan: string;
    gender: string;
    status_ptkp: string;
    kategori_ter: string;
    masa_kerja_tahun: string;
    masa_kerja_bulan: string;
    gaji_pokok_des: number; 
    tunjangan_des: number; 
    premi_asuransi_des: number; 
    tunjangan_pph_des: number; 
    bruto_des: number; 
    thr: number; 
    bonus: number;
    tantiem: number;
    gaji_pokok_setahun: number;
    tunjangan_lainnya_setahun: number;
    premi_asuransi_setahun: number;
    tunjangan_pph_setahun: number;
    natura_setahun: number;
    thr_bonus_tantiem_setahun: number; 
    bruto_setahun: number; 
    biaya_jabatan: number;
    iuran_jht_jp_setahun: number; 
    netto_setahun: number;
    ptkp: number;
    pkp: number;
    pph21_setahun: number;
    pph21_jan_nov: number;
    pph21_desember: number;
}
`;

if (!content.includes('export interface DecemberTaxRow')) {
    content = content.replace('export interface AstekBpjsMonthlyRow {', interfaceStr + '\nexport interface AstekBpjsMonthlyRow {');
}

const methodStr = `
    public async getDecemberTaxReport(
        year: number,
        divisionCode?: string,
        gangCode?: string
    ): Promise<{ employees: DecemberTaxRow[]; year: number }> {
        const monthPromises = [];
        for (let m = 1; m <= 12; m++) {
            monthPromises.push(
                historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
                    m, year, gangCode || 'ALL', divisionCode || undefined
                ).then(data => ({ month: m, data }))
            );
        }

        const allMonthData = await Promise.all(monthPromises);
        const { thrMap, exgratiaMap } = loadThrBonusMaps();
        const activeThr = loadActiveThrPeriode();

        const employeeMap = new Map<string, any>();

        for (const { month, data } of allMonthData) {
            if (!data || data.data_rows.length === 0) continue;
            for (const row of data.data_rows) {
                const empCode = row.emp_code;
                if (!employeeMap.has(empCode)) {
                    employeeMap.set(empCode, {
                        emp_code: empCode,
                        emp_name: row.nama || row.emp_name || '',
                        nik: row.nik_ktp || row.nik || '',
                        npwp: row.pajak_npwp || '',
                        alamat: row.alamat || '',
                        jabatan: row.jabatan || '',
                        gender: row.jenis_kelamin || '',
                        status_ptkp: row.status_ptkp || '',
                        kategori_ter: row.kategori_ter || '',
                        monthly_income: {},
                        monthly_details: {},
                        monthly_pph21: {},
                        monthly_premi_asuransi: {},
                        monthly_iuran_pensiun: {},
                        monthly_thr_factors: {},
                        was_in_target_gang: false,
                        masa_kerja_tahun: '00',
                        masa_kerja_bulan: '00'
                    });
                }

                const emp = employeeMap.get(empCode);

                if (month === 12) {
                    const mkTahunStr = String(row.masa_kerja_tahun || '0').padStart(2, '0');
                    const mkBulanStr = String(row.masa_kerja_bulan || '0').padStart(2, '0');
                    emp.masa_kerja_tahun = mkTahunStr;
                    emp.masa_kerja_bulan = mkBulanStr;
                }

                if (!gangCode || gangCode === 'ALL' || row.gang_code === gangCode) {
                    if (month === 12) {
                        emp.was_in_target_gang = true;
                    }
                }

                const hk = row.jumlah_hk || row.hk || 0;
                const gp = row.gaji_pokok_aktual || row.gaji_pokok || 0;
                const mk = row.masa_kerja_jumlah || 0;
                const dasarPajak = gp + mk;

                emp.monthly_income[String(month)] = row.upah_kotor || row.gross_salary || row.total_income || 0;
                emp.monthly_details[String(month)] = { hk, gaji_pokok: gp, masa_kerja: mk };
                emp.monthly_pph21[String(month)] = row.pot_pph21 || 0;
                
                // Premi Asuransi: BPJS Kes 4% + Astek 0.84% (Opsi B)
                emp.monthly_premi_asuransi[String(month)] = (dasarPajak * 0.04) + (dasarPajak * 0.0084);
                // Iuran Pensiun & JHT: BPJS Pensiun 1% + Astek 2% (Opsi B)
                emp.monthly_iuran_pensiun[String(month)] = (dasarPajak * 0.01) + (dasarPajak * 0.02);

                if (activeThr && month === activeThr.month) {
                    emp.monthly_thr_factors[String(month)] = {
                        masa_kerja_tahun: row.masa_kerja_tahun || 0,
                        upah_dasar: row.upah_dasar || 0,
                        beras_rate: row.r_beras || row.beras_rate || 0,
                        masa_kerja_jumlah: mk
                    };
                }
            }
        }

        const employees: DecemberTaxRow[] = [];
        let idx = 0;

        for (const [empCode, emp] of employeeMap) {
            // Only include those active in target gang in December
            if (!emp.was_in_target_gang) continue; 
            
            // Check if they have december income
            if (!emp.monthly_income['12']) continue;

            idx++;

            let pph21JanNov = 0;
            let gajiPokokSetahun = 0;
            let premiAsuransiSetahun = 0;
            let iuranSetahun = 0;

            for (let m = 1; m <= 11; m++) {
                if (emp.monthly_income[String(m)]) {
                    gajiPokokSetahun += emp.monthly_income[String(m)];
                    premiAsuransiSetahun += emp.monthly_premi_asuransi[String(m)] || 0;
                    iuranSetahun += emp.monthly_iuran_pensiun[String(m)] || 0;
                    pph21JanNov += emp.monthly_pph21[String(m)] || 0;
                }
            }

            // December logic
            const incDes = emp.monthly_income['12'] || 0;
            const detDes = emp.monthly_details['12'];
            const gpDes = detDes ? (detDes.gaji_pokok + detDes.masa_kerja) : 0;
            // Total Tunjangan Des is everything else that makes up the income for Dec (including masa kerja)
            // Wait, my prev analysis proved that gaji pokok in report = gaji_pokok. 
            // So gpDes = detDes.gaji_pokok
            // tunjanganDes = incDes - gpDes
            // For Setahun, gajiPokokSetahun = SUM(inc). So it includes everything.
            
            // Fix: the Screenshot showed Gaji Pokok = 4.005.820. This is exactly detDes.gaji_pokok.
            const detGajiPokokDes = detDes ? detDes.gaji_pokok : 0;
            const tunjanganDes = Math.max(0, incDes - detGajiPokokDes); 
            const premiDes = emp.monthly_premi_asuransi['12'] || 0;
            const iuranDes = emp.monthly_iuran_pensiun['12'] || 0;
            const brutoDes = incDes + premiDes;

            gajiPokokSetahun += incDes;
            premiAsuransiSetahun += premiDes;
            iuranSetahun += iuranDes;

            // THR & Bonus
            const rawEmpNik = String(emp.nik || '').trim().toUpperCase();
            let rawEmpName = String(emp.emp_name || '').toUpperCase().replace(/\\s*\\(.*?\\)\\s*/g, '').trim();
            const firstName = rawEmpName.split(' ')[0].trim();

            let thr = 0;
            if (activeThr) {
                let thrFactors = emp.monthly_thr_factors[String(activeThr.month)];
                if (!thrFactors) {
                    for (let m = 12; m >= 1; m--) {
                        if (emp.monthly_thr_factors[String(m)]) {
                            thrFactors = emp.monthly_thr_factors[String(m)];
                            break;
                        }
                    }
                }
                if (thrFactors && thrFactors.masa_kerja_tahun >= 1) {
                    thr = (thrFactors.upah_dasar * 30) + (thrFactors.beras_rate * 30) + thrFactors.masa_kerja_jumlah;
                }
            }

            let bonus = 0;
            if (exgratiaMap.has(rawEmpNik)) bonus = exgratiaMap.get(rawEmpNik);
            else if (exgratiaMap.has(rawEmpName)) bonus = exgratiaMap.get(rawEmpName);
            else {
                for (const [jsonName, jsonThr] of thrMap.entries()) {
                    if (jsonName === firstName || rawEmpName.startsWith(jsonName)) {
                        bonus = exgratiaMap.get(jsonName) || 0;
                        break;
                    }
                }
            }

            const thrBonusTantiemSetahun = thr + bonus;
            const brutoSetahun = gajiPokokSetahun + premiAsuransiSetahun + thrBonusTantiemSetahun;

            const biayaJabatan = Math.min(brutoSetahun * 0.05, 6000000);
            const nettoSetahun = Math.max(0, brutoSetahun - biayaJabatan - iuranSetahun);

            const ptkpValue = getPtkpValue(emp.status_ptkp);
            
            // Round down to thousands
            const pkpRaw = Math.max(0, nettoSetahun - ptkpValue);
            const pkp = Math.floor(pkpRaw / 1000) * 1000;

            const pph21Setahun = this.calculateProgressivePph21(pkp);
            const pph21Desember = Math.max(0, pph21Setahun - pph21JanNov);

            employees.push({
                no: idx,
                emp_code: emp.emp_code,
                emp_name: emp.emp_name,
                nik: emp.nik,
                npwp: emp.npwp,
                alamat: emp.alamat,
                jabatan: emp.jabatan,
                gender: emp.gender,
                status_ptkp: emp.status_ptkp,
                kategori_ter: emp.kategori_ter,
                masa_kerja_tahun: emp.masa_kerja_tahun,
                masa_kerja_bulan: emp.masa_kerja_bulan,
                gaji_pokok_des: detGajiPokokDes,
                tunjangan_des: tunjanganDes,
                premi_asuransi_des: premiDes,
                tunjangan_pph_des: 0,
                bruto_des: brutoDes,
                thr: thr,
                bonus: bonus,
                tantiem: 0,
                gaji_pokok_setahun: gajiPokokSetahun,
                tunjangan_lainnya_setahun: 0,
                premi_asuransi_setahun: premiAsuransiSetahun,
                tunjangan_pph_setahun: 0,
                natura_setahun: 0,
                thr_bonus_tantiem_setahun: thrBonusTantiemSetahun,
                bruto_setahun: brutoSetahun,
                biaya_jabatan: biayaJabatan,
                iuran_jht_jp_setahun: iuranSetahun,
                netto_setahun: nettoSetahun,
                ptkp: ptkpValue,
                pkp: pkp,
                pph21_setahun: pph21Setahun,
                pph21_jan_nov: pph21JanNov,
                pph21_desember: pph21Desember
            });
        }

        return { employees, year };
    }
`;

if (!content.includes('public async getDecemberTaxReport(')) {
    content = content.replace('private calculateProgressivePph21', methodStr + '\n    private calculateProgressivePph21');
}

fs.writeFileSync(tsPath, content);
console.log('Patched taxReportService.ts');
