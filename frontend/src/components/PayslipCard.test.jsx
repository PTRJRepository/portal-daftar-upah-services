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

        const tileCount = (html.match(/payslip-watermark__tile/g) || []).length;

        expect(tileCount).toBeGreaterThanOrEqual(24);
        expect(html).toContain('payslip-watermark__image');
        expect(html).toContain('/images/rebinmas.webp');
        expect(html).not.toContain('REBINMAS JAYA</span>');
        expect(html).not.toMatch(/RESMI|CREDENTIAL/i);
    });

    it('shows koreksi as a negative income row instead of a deduction row', () => {
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

        expect(html).toContain('Koreksi Pendapatan (-)');
        expect(html).toContain('75.000');
        expect(html).not.toMatch(/Pot\. Upah Kotor|Subtotal Pot\. Kotor|Koreksi DENDA PANEN|Koreksi Denda Panen/);
        expect(html).toContain('TOTAL POTONGAN');
        expect(html).toContain('10.000');
        expect(html).not.toContain('85.000');
    });

    it('prints a compact activity summary with HK, sick days, overtime, and koreksi', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    attendance: {
                        summary: {
                            total_hadir: 18,
                            cuti_sakit: 2,
                        },
                    },
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        jumlah_hk: 20,
                        lembur_jam: 6,
                        lembur_jumlah: 450000,
                        pot_koreksi: 75000,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('Ringkasan Aktivitas');
        expect(html).toContain('HK: 20');
        expect(html).toContain('Sakit: 2 hr');
        expect(html).toContain('Lembur: 6j = 450.000');
        expect(html).toContain('Koreksi: 75.000');
    });

    it('explains compact PPh 21 components including other income and Astek BPJS', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        penghasilan_bruto: 2600000,
                        total_pendapatan_lainnya: 150000,
                        pot_astek: 40000,
                        pot_bpjs_kesehatan_pekerja: 25000,
                        pot_bpjs_pensiun_pekerja: 10000,
                        pot_pph21: 130000,
                        pph21_ter: 130000,
                        tarif_pajak_ter: 5,
                        kategori_ter: 'A',
                        status_ptkp: 'TK/0',
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('Komponen Pajak / PPh 21');
        expect(html).toContain('Bruto/DPP');
        expect(html).toContain('2.600.000');
        expect(html).toContain('Pendapatan Lainnya');
        expect(html).toContain('150.000');
        expect(html).toContain('Astek/BPJS');
        expect(html).toContain('75.000');
        expect(html).toContain('Tarif TER A (TK/0)');
        expect(html).toContain('5.00%');
        expect(html).toContain('PPh 21');
        expect(html).toContain('130.000');
    });

    it('does not render signature fields on the compact printed slip', () => {
        const html = renderToString(
            <PayslipCard data={basePayslipData} month={4} year={2026} />
        );

        expect(html).not.toContain('Dibuat Oleh');
        expect(html).not.toContain('Diterima Oleh');
        expect(html).not.toContain('payslip-card-signature');
    });
});
