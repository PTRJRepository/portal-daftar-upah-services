import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PayslipCard from './PayslipCard';

const basePayslipData = {
    emp_code: 'EMP001',
    employee: {
        nama: 'Budi Santoso',
        jabatan: 'Pemanen',
        gang_code: 'A01',
    },
    attendance: {
        summary: {
            total_hadir: 20,
        },
    },
    payroll_data: {
        hari_kerja: 20,
        upah_dasar: 100000,
        gaji_pokok: 2000000,
        jumlah_upah_kotor: 2150000,
        penghasilan_bruto: 2150000,
        total_potongan: 250000,
        upah_bersih: 1900000,
    },
};

describe('PayslipCard', () => {
    it('shows other income detail again as a paid-income deduction with an explanation', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        other_incomes: [
                            { type: 'KONTAN', name: 'Kontan Panen', amount: 150000 },
                        ],
                        total_pendapatan_lainnya: 150000,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect((html.match(/Kontan Panen/g) || []).length).toBeGreaterThanOrEqual(2);
        expect(html).toContain('Sudah dibayarkan');
        expect(html).toContain('ditambahkan ke Upah Kotor');
        expect(html).toContain('dikurangkan dari Upah Bersih');
    });

    it('renders a subtle repeated Rebinmas Jaya watermark pattern', () => {
        const html = renderToString(
            <PayslipCard data={basePayslipData} month={4} year={2026} />
        );

        expect((html.match(/payslip-watermark__tile/g) || []).length).toBeGreaterThanOrEqual(8);
        expect((html.match(/payslip-watermark__tile">REBINMAS JAYA/g) || []).length).toBeGreaterThanOrEqual(8);
    });

    it('does not show koreksi detail rows but still includes koreksi in fallback total deductions', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        total_potongan: 0,
                        pot_koreksi: 75000,
                        koreksi_denda_panen: 25000,
                        pot_spsi: 10000,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).not.toMatch(/Pot\. Upah Kotor|Koreksi DENDA PANEN|Koreksi Denda Panen|>\s*Koreksi\s*</);
        expect(html).toContain('85.000');
    });
});
