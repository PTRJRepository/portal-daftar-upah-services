/**
 * PayrollCalculator - Single Source of Truth for all derived payroll field formulas
 *
 * This class centralizes ALL calculations of derived payroll fields to ensure
 * consistency across every tab/service/report in the system:
 *   - Daftar Upah (Main Payroll)
 *   - PAJAK / Tax Tab
 *   - Summary / Analysis Reports
 *   - Aggregation / Seeder
 *
 * IMPORTANT BUSINESS RULES (Updated 2026-04-03):
 *
 * 1. UPAH KOTOR (Gross Wage Before Deductions)
 *    = gaji_pokok_aktual + total_tunjangan + total_premi + pot_koreksi + pendapatan_lainnya
 *
 *    NOTE: pot_koreksi dan pendapatan_lainnya di-ADD ke gross untuk TAMPILAN di Daftar Upah.
 *    total_premi SUDAH MENGEXCLUDE koreksi.
 *
 * 2. POTONGAN UPAH KOTOR (Deductions applied BEFORE tax)
 *    = pot_koreksi (displayed separately as pengurangan upah kotor)
 *
 * 3. UPAH KOTOR PAJAK (Taxable Gross for header/pajak display)
 *    = (gaji + tunjangan + lembur + total_premi) + bpjs_pekerja + taxable_lainnya
 *
 *    NOTE: HANYA komponen POSITIF/gross + bpjs. TIDAK ADA pengurangan di sini.
 *    - pot_koreksi TIDAK dikurangkan dari pajak (koreksi mengurangi take-home pay
 *      HANYA melalui total_potongan).
 *    - pendapatan_lainnya TIDAK dikurangkan dari pajak (dikurangi HANYA melalui
 *      total_potongan).
 *
 * 4. PENGHASILAN BRUTO (Gross Income for PPh21 TER)
 *    = gaji_pokok_aktual + beras + jabatan + masa_kerja + lembur + total_premi
 *      + astek_majikan + bpjs_majikan + taxable_lainnya
 *
 *    NOTE: HANYA komponen POSITIF. Astek/BPJS Majikan DITAMBAH karena menjadi
 *    komponen penghasilan kena pajak (beban pemberi kerja per PP 58/2023).
 *    pot_koreksi TIDAK dikurangkan - koreksi mengurangi take-home pay HANYA
 *    melalui total_potongan (Potongan Upah Bersih).
 *
 * 5. TOTAL POTONGAN (Total Deductions from Net Pay)
 *    = astek_pekerja + bpjs_kes_pekerja + bpjs_pensiun_pekerja
 *      + spsi + pph21 + pot_koreksi + other_potongan + pendapatan_lainnya
 *
 *    NOTE: SEMUA yang "dikurang" (koreksi, pendapatan_lainnya) MASUK di sini.
 *    Ini adalah SATU-SATUNYA tempat pengurangan dari take-home pay.
 *
 * 6. UPAH BERSIH (Take-Home Pay)
 *    = jumlah_upah_kotor - total_potongan + premi_pph
 *
 *    premi_pph = ADDITION (penambah upah bersih), bukan potongan.
 */

export interface PayrollCalculatorInput {
    // Earnings components
    gaji_pokok_aktual: number;
    beras_jumlah: number;
    jabatan_jumlah: number;
    masa_kerja_jumlah: number;
    lembur_jumlah: number;
    total_tunjangan: number;   // beras + jabatan + masa_kerja + lembur
    total_premi: number;       // all premi EXCLUDING koreksi (koreksi handled separately)
    pot_koreksi: number;       // displayed separately in potongan_upah_kotor; reduces take-home via total_potongan
    pendapatan_lainnya: number; // THR + Bonus + Custom + custom types; ALL included in taxable income

    // Deductions components
    pot_astek_pekerja: number;
    pot_bpjs_kesehatan_pekerja: number;
    pot_bpjs_pensiun_pekerja: number;
    pot_spsi: number;
    pot_pph21: number;
    other_potongan: number; // all other dynamic potongan (excluding koreksi)
    pot_premi_pph: number;  // PREMI_PPH = ADDITION, not deduction

    // Tax calculation components (employer portions)
    astek_majikan: number;   // 0.84% of (payrate * 30 + masa_kerja)
    bpjs_majikan: number;    // 4% of (payrate * 30 + masa_kerja)
}

export interface PayrollCalculatorResult {
    // Core gross wage
    jumlah_upah_kotor: number;        // Gaji Pokok + Tunjangan + Lembur + Premi + Koreksi + Lainnya
    potongan_upah_kotor: number;      // pot_koreksi (displayed separately)
    upah_kotor_pajak: number;        // Taxable gross: only positive + bpjs_pekerja + taxable_lainnya

    // Tax calculation
    penghasilan_bruto: number;        // Gross income for PPh21 TER
    tarif_pajak_ter: number;          // TER rate percentage (5, 15, or 25)
    pph21_ter: number;              // PPh21 using TER method
    taxable_pendapatan_lainnya: number; // same as pendapatan_lainnya (all taxable)

    // Total deductions
    total_potongan: number;           // astek + bpjs + spsi + pph21 + koreksi + other + lainnya
    total_potongan_bersih: number;    // total_potongan - premi_pph (premi_pph is addition)

    // Take-home pay
    upah_bersih: number;               // jumlah_upah_kotor - total_potongan + premi_pph

    // Component breakdown for display
    komponen_kotor: {
        gaji_pokok: number;
        tunjangan: number;       // without lembur
        lembur: number;
        premi: number;           // all premi excluding koreksi
        koreksi: number;        // pot_koreksi as separate component
        lainnya: number;        // THR, Bonus, Custom, etc.
        subtotal: number;        // sum of all components
    };
    komponen_potongan: {
        astek_pekerja: number;
        bpjs_kes_pekerja: number;
        bpjs_pensiun_pekerja: number;
        spsi: number;
        pph21: number;
        koreksi: number;         // pot_koreksi in total potongan (reduces take-home pay)
        other: number;
        lainnya: number;         // pendapatan_lainnya as deduction
        subtotal: number;        // sum of all potongan
    };
}

export class PayrollCalculator {
    public static calculate(
        input: PayrollCalculatorInput,
        statusPtkp: string = '-',
        periodYear: number = new Date().getFullYear()
    ): PayrollCalculatorResult {

        // ─────────────────────────────────────────────────────────
        // 1. UPAH KOTOR (Gross Wage Before Deductions)
        //
        // Formula: gaji_pokok_aktual + total_tunjangan + total_premi + pot_koreksi + pendapatan_lainnya
        //
        // NOTE: pot_koreksi dan pendapatan_lainnya di-ADD ke gross untuk TAMPILAN di Daftar Upah.
        //       total_premi SUDAH MENGEXCLUDE koreksi (agar bisa ditampilkan terpisah).
        // ─────────────────────────────────────────────────────────
        const komponen_kotor = {
            gaji_pokok: input.gaji_pokok_aktual,
            tunjangan: input.total_tunjangan - input.lembur_jumlah, // exclude lembur from tunjangan display
            lembur: input.lembur_jumlah,
            premi: input.total_premi,          // already excludes koreksi (koreksi shown separately)
            koreksi: input.pot_koreksi,         // koreksi shown as separate earning component
            lainnya: input.pendapatan_lainnya,  // THR, Bonus, Custom, Kontan, etc.
            subtotal: 0, // computed below
        };
        komponen_kotor.subtotal =
            komponen_kotor.gaji_pokok +
            komponen_kotor.tunjangan +
            komponen_kotor.lembur +
            komponen_kotor.premi +
            komponen_kotor.koreksi +
            komponen_kotor.lainnya;

        const jumlah_upah_kotor = komponen_kotor.subtotal;

        // ─────────────────────────────────────────────────────────
        // 2. POTONGAN UPAH KOTOR (Deductions applied BEFORE tax)
        //    = pot_koreksi (displayed separately as pengurangan upah kotor)
        // ─────────────────────────────────────────────────────────
        const potongan_upah_kotor = input.pot_koreksi;

        // ─────────────────────────────────────────────────────────
        // 3. UPAH KOTOR PAJAK (Taxable Gross for header/pajak display)
        //
        // Formula: (gaji + tunjangan + lembur + total_premi) + bpjs_pekerja + pendapatan_lainnya
        //
        // NOTE: HANYA komponen POSITIF/gross + bpjs + pendapatan_lainnya.
        //       TIDAK ADA pengurangan di sini.
        //       - pot_koreksi TIDAK dikurangkan (koreksi mengurangi take-home HANYA via total_potongan).
        //       - bpjs_pekerja DITAMBAH karena menjadi bagian penghasilan bruto kena pajak.
        //       - SEMUA pendapatan_lainnya (THR, Bonus, Custom) MASUK ke pajak.
        // ─────────────────────────────────────────────────────────
        const gross_positif =
            input.gaji_pokok_aktual +
            input.total_tunjangan +
            input.lembur_jumlah +
            input.total_premi;

        const upah_kotor_pajak =
            gross_positif
            + input.pot_bpjs_kesehatan_pekerja
            + input.pendapatan_lainnya;

        // ─────────────────────────────────────────────────────────
        // 4. TOTAL POTONGAN (Total Deductions from Net Pay)
        //
        // Formula: astek_pekerja + bpjs_kes_pekerja + bpjs_pensiun_pekerja
        //          + spsi + pph21 + pot_koreksi + other_potongan + pendapatan_lainnya
        //
        // NOTE: SEMUA yang "dikurang" (koreksi, pendapatan_lainnya) MASUK di sini.
        //       Ini adalah SATU-SATUNYA tempat pengurangan dari take-home pay.
        // ─────────────────────────────────────────────────────────
        const komponen_potongan = {
            astek_pekerja: input.pot_astek_pekerja,
            bpjs_kes_pekerja: input.pot_bpjs_kesehatan_pekerja,
            bpjs_pensiun_pekerja: input.pot_bpjs_pensiun_pekerja,
            spsi: input.pot_spsi,
            pph21: input.pot_pph21,
            koreksi: input.pot_koreksi,   // pot_koreksi in total potongan (reduces take-home pay)
            other: input.other_potongan,
            lainnya: input.pendapatan_lainnya, // pendapatan_lainnya as deduction from net pay
            subtotal: 0, // computed below
        };
        komponen_potongan.subtotal =
            komponen_potongan.astek_pekerja +
            komponen_potongan.bpjs_kes_pekerja +
            komponen_potongan.bpjs_pensiun_pekerja +
            komponen_potongan.spsi +
            komponen_potongan.pph21 +
            komponen_potongan.koreksi +
            komponen_potongan.other +
            komponen_potongan.lainnya;

        const total_potongan = komponen_potongan.subtotal;

        // ─────────────────────────────────────────────────────────
        // 5. TOTAL POTONGAN BERSIH (Net Deductions after PREMI_PPH adjustment)
        //
        // Formula: total_potongan - premi_pph
        //
        // NOTE: premi_pph adalah PENAMBAH (ADDITION) ke upah bersih, bukan potongan.
        //       Maka dari total_potongan (jumlah semua deduction), kita KURANGI
        //       premi_pph agar hasilnya: Potongan Bersih = Potongan - PREMI_PPH
        // ─────────────────────────────────────────────────────────
        const total_potongan_bersih = total_potongan - input.pot_premi_pph;

        // ─────────────────────────────────────────────────────────
        // 6. PENGHASILAN BRUTO (Gross Income for PPh21 TER)
        //
        // Per PP 58/2023, penghasilan bruto meliputi:
        //   Gaji Pokok + Tunjangan (Beras, Jabatan, Masa Kerja) + Lembur + Premi
        //   + Astek/BPJS Pensiun Majikan (0.84%)
        //   + BPJS Kesehatan Majikan (4%)
        //   + SEMUA Pendapatan Lainnya (THR, Bonus, Custom, Kontan, dll)
        //
        // NOTE: HANYA komponen POSITIF. Astek/BPJS Majikan DITAMBAH karena menjadi
        // komponen penghasilan kena pajak (beban pemberi kerja).
        // SEMUA pendapatan_lainnya MASUK ke penghasilan bruto.
        // pot_koreksi TIDAK dikurangkan - koreksi mengurangi take-home pay HANYA
        // melalui total_potongan (Potongan Upah Bersih).
        // ─────────────────────────────────────────────────────────
        const penghasilan_bruto =
            input.gaji_pokok_aktual +
            input.beras_jumlah +
            input.jabatan_jumlah +
            input.masa_kerja_jumlah +
            input.lembur_jumlah +
            input.total_premi +
            input.astek_majikan +
            input.bpjs_majikan +
            input.pendapatan_lainnya;

        // ─────────────────────────────────────────────────────────
        // 7. PPh21 TER Calculation
        // ─────────────────────────────────────────────────────────
        const ptkpAmount = this.getPTKPAmount(statusPtkp, periodYear);
        const taxableIncome = Math.max(0, penghasilan_bruto - ptkpAmount);
        const { rate, tax } = this.calculateTER(taxableIncome, statusPtkp);

        // ─────────────────────────────────────────────────────────
        // 8. UPAH BERSIH (Take-Home Pay)
        //
        // Formula: jumlah_upah_kotor - total_potongan + premi_pph
        //
        // NOTE: pot_koreksi dan pendapatan_lainnya di-add ke gross (jumlah_upah_kotor)
        //       dan di-subtract via total_potongan. Ini agar nominal koreksi dan
        //       lainnya TAMPIL di kolom masing-masing, tapi hasil akhirnya tetap
        //       mengurangi take-home pay dengan BENAR.
        //       premi_pph adalah ADDITION (ditambahkan ke take-home pay).
        // ─────────────────────────────────────────────────────────
        const upah_bersih = jumlah_upah_kotor - total_potongan + input.pot_premi_pph;

        return {
            jumlah_upah_kotor,
            potongan_upah_kotor,
            upah_kotor_pajak,
            penghasilan_bruto,
            tarif_pajak_ter: rate,
            pph21_ter: tax,
            taxable_pendapatan_lainnya: input.pendapatan_lainnya,
            total_potongan,
            total_potongan_bersih,
            upah_bersih,
            komponen_kotor,
            komponen_potongan,
        };
    }

    // ─────────────────────────────────────────────────────────
    // PTKP Amount by Status & Year
    // ─────────────────────────────────────────────────────────
    private static getPTKPAmount(statusPtkp: string, year: number): number {
        const ptkpValues: Record<string, number> = {
            'TK/0': 54000000,
            'TK/1': 58500000,
            'TK/2': 63000000,
            'TK/3': 67500000,
            'K/0':  58500000,
            'K/1':  63000000,
            'K/2':  67500000,
            'K/3':  72000000,
        };
        return ptkpValues[statusPtkp] || 54000000;
    }

    // ─────────────────────────────────────────────────────────
    // TER Rate & Tax Calculation
    // ─────────────────────────────────────────────────────────
    private static calculateTER(
        taxableIncome: number,
        statusPtkp: string
    ): { rate: number; tax: number } {
        const terCategory = this.getTERCategory(statusPtkp);
        const monthlyTaxable = taxableIncome / 12;

        let rate: number;
        let annualTax: number;

        switch (terCategory) {
            case 'TER A':
                rate = 5;
                annualTax = Math.round(monthlyTaxable * 0.05 * 12);
                break;
            case 'TER B':
                rate = 15;
                annualTax = Math.round(monthlyTaxable * 0.15 * 12);
                break;
            case 'TER C':
                rate = 25;
                annualTax = Math.round(monthlyTaxable * 0.25 * 12);
                break;
            default:
                rate = 0;
                annualTax = 0;
        }

        return { rate, tax: Math.max(0, annualTax) };
    }

    private static getTERCategory(statusPtkp: string): string {
        if (statusPtkp === 'TK/0' || statusPtkp === 'TK/1' || statusPtkp === 'K/0') {
            return 'TER A';
        }
        if (statusPtkp === 'K/3') {
            return 'TER C';
        }
        return 'TER B'; // TK/2, K/1, K/2
    }
}
