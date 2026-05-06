import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PayslipCard from './PayslipCard';

const source = readFileSync(new URL('./PayslipCard.jsx', import.meta.url), 'utf8');

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
    it('hides other income from income and deduction sections when there is no PPh 21', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        pot_pph21: 0,
                        pph21_ter: 0,
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

        expect(html).not.toContain('Kontan Panen');
        expect(html).not.toContain('Pendapatan Lainnya');
        expect(html).not.toContain('Pendapatan Lainnya Dibayar');
        expect(html).not.toContain('Sudah dibayarkan');
        expect(html).not.toContain('ditambahkan ke Upah Kotor');
        expect(html).not.toContain('dikurangkan dari Upah Bersih');
    });

    it('excludes other income from the displayed gross wage total on the payslip', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        jumlah_upah_kotor: 2150000,
                        penghasilan_bruto: 2150000,
                        total_pendapatan_lainnya: 150000,
                        pot_pph21: 0,
                        pph21_ter: 0,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('TOTAL PENDAPATAN KOTOR');
        expect(html).toContain('2.000.000');
        expect(html).not.toContain('2.150.000');
    });

    it('excludes other income from displayed total deductions on the payslip', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        jumlah_upah_kotor: 2150000,
                        penghasilan_bruto: 2150000,
                        total_pendapatan_lainnya: 150000,
                        total_potongan: 400000,
                        potongan_pendapatan_lainnya: 150000,
                        pot_spsi: 250000,
                        upah_bersih: 1750000,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('TOTAL PENDAPATAN KOTOR');
        expect(html).toContain('TOTAL POTONGAN');
        expect(html).toContain('2.000.000');
        expect(html).toContain('250.000');
        expect(html).toContain('1.750.000');
        expect(html).not.toContain('2.150.000');
        expect(html).not.toContain('400.000');
        expect(html).not.toContain('PENDAPATAN LAINNYA');
    });

    it('uses the visible deduction rows as the displayed total deduction source of truth', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        jumlah_upah_kotor: 2150000,
                        penghasilan_bruto: 2150000,
                        total_pendapatan_lainnya: 150000,
                        total_potongan: 500000,
                        potongan_pendapatan_lainnya: 150000,
                        pot_spsi: 250000,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('TOTAL POTONGAN');
        expect(html).toContain('250.000');
        expect(html).toContain('Rp <!-- -->1.750.000');
        expect(html).not.toContain('350.000');
        expect(html).not.toContain('500.000');
        expect(html).not.toContain('PENDAPATAN LAINNYA');
    });

    it('does not show other income on the payslip even when PPh 21 is present while tax detail is hidden', () => {
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

        expect(html).toContain('PPh 21');
        expect(html).toContain('130.000');
        expect(html).not.toContain('Komponen Pajak / PPh 21');
        expect(html).not.toContain('Pendapatan Lainnya');
        expect(html).not.toContain('Bruto/DPP');
        expect(html).not.toContain('Tarif TER');
        expect(html).not.toContain('Kontan Panen');
        expect(html).not.toContain('Pendapatan Lainnya Dibayar');
        expect(html).not.toContain('Sudah dibayarkan');
        expect(html).not.toContain('ditambahkan ke Upah Kotor');
        expect(html).not.toContain('dikurangkan dari Upah Bersih');
    });

    it('prints receipt-style markers and subtotals for allowance and premium groups', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        beras_jumlah: 100000,
                        jabatan_jumlah: 200000,
                        masa_kerja_jumlah: 50000,
                        premi_brondol: 25000,
                        premi_panen: 75000,
                        total_premi: 100000,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('Subtotal Tunjangan');
        expect(html).toContain('350.000');
        expect(html).toContain('Subtotal Premi');
        expect(html).toContain('100.000');
        expect(html).toContain('payslip-total-marker');
        expect(html).toContain('---- +');
    });

    it('moves long income detail into a clearly separated continuation section below deductions', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        beras_jumlah: 100000,
                        jabatan_jumlah: 200000,
                        masa_kerja_jumlah: 50000,
                        premi_brondol: 25000,
                        premi_panen: 75000,
                        premi_kualitas_buah: 30000,
                        premi_basis: 45000,
                        premi_tph: 15000,
                        premi_topografi: 20000,
                        total_premi: 210000,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('payslip-income-overflow-section');
        expect(html).toContain('LANJUTAN PENERIMAAN');
        expect(html).toContain('BUKAN POTONGAN');
        expect(html).toContain('Subtotal Premi');

        const deductionIndex = html.indexOf('POTONGAN');
        const continuationIndex = html.indexOf('LANJUTAN PENERIMAAN');
        expect(deductionIndex).toBeGreaterThan(-1);
        expect(continuationIndex).toBeGreaterThan(deductionIndex);
    });

    it('renders a subtle repeated Rebinmas logo and label watermark pattern', () => {
        const html = renderToString(
            <PayslipCard data={basePayslipData} month={4} year={2026} />
        );

        const tileCount = (html.match(/payslip-watermark__tile/g) || []).length;
        const labelCount = (html.match(/payslip-watermark__label/g) || []).length;

        expect(tileCount).toBeGreaterThanOrEqual(24);
        expect(labelCount).toBe(tileCount);
        expect(html).toContain('payslip-watermark__image');
        expect(html).toContain('payslip-watermark__label');
        expect(html).toContain('/images/rebinmas.webp');
        expect(html).toContain('>REBINMAS</span>');
        expect(html).not.toMatch(/RESMI|CREDENTIAL/i);
    });

    it('centers the payslip header and shows the Rebinmas logo in the header', () => {
        const html = renderToString(
            <PayslipCard data={basePayslipData} month={4} year={2026} />
        );

        expect(html).toContain('payslip-header-logo');
        expect(html).toContain('/images/rebinmas.webp');
        expect(html).toContain('PT REBINMAS JAYA');
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

    it('keeps address and detailed attendance out of the top payslip header', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    employee: {
                        ...basePayslipData.employee,
                        alamat: 'Jl. Kebun Sawit No. 12',
                    },
                    attendance: {
                        summary: {
                            total_hadir: 18,
                            cuti_sakit: 2,
                        },
                    },
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        jumlah_hk: 20,
                        cuti_sakit_haid_hari: 2,
                        pot_koreksi: 75000,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).not.toContain('Alamat');
        expect(html).not.toContain('Jl. Kebun Sawit');
        expect(html).not.toContain('Absensi');
        expect(html).not.toContain('Sakit: 2 hr');
        expect(html).not.toContain('Koreksi: 75.000');
        expect(html).toContain('Sakit<!-- --> (<!-- -->2<!-- --> hr)');
        expect(html).toContain('Koreksi Pendapatan (-)');
    });

    it('prints a compact activity summary with HK and only shows overtime when overtime hours exist', () => {
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
        expect(html).toContain('Lembur: 6j = 450.000');
        expect(html).not.toContain('Sakit: 2 hr');
        expect(html).not.toContain('Koreksi: 75.000');
    });

    it('does not show the overtime label when there are no overtime hours', () => {
        const html = renderToString(
            <PayslipCard
                data={{
                    ...basePayslipData,
                    payroll_data: {
                        ...basePayslipData.payroll_data,
                        jumlah_hk: 20,
                        lembur_jam: 0,
                        lembur_jumlah: 0,
                    },
                }}
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('Ringkasan Aktivitas');
        expect(html).toContain('HK: 20');
        expect(html).not.toContain('Lembur: 0j = 0');
    });

    it('shows only the PPh 21 value and hides compact tax calculation components', () => {
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

        expect(html).toContain('PPh 21');
        expect(html).toContain('130.000');
        expect(html).not.toContain('Komponen Pajak / PPh 21');
        expect(html).not.toContain('Bruto/DPP');
        expect(html).not.toContain('Pendapatan Lainnya');
        expect(html).not.toContain('Astek/BPJS');
        expect(html).not.toContain('Tarif TER A (TK/0)');
        expect(html).not.toContain('5.00%');
    });

    it('removes the compact tax calculation detail markup from the payslip component', () => {
        expect(source).not.toContain('Komponen Pajak / PPh 21');
        expect(source).not.toContain('payslip-tax-breakdown');
        expect(source).not.toContain('Bruto/DPP');
        expect(source).not.toContain('Astek/BPJS');
        expect(source).not.toContain('Tarif TER');
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
