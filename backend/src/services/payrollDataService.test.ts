import { afterEach, describe, expect, it } from "bun:test";
import { DataExtractorService } from "./dataExtractorService";
import { PayrollDataService } from "./payrollDataService";

describe("PayrollDataService aggregation totals", () => {
    const originalGetInstance = DataExtractorService.getInstance;

    afterEach(() => {
        (DataExtractorService as any).getInstance = originalGetInstance;
    });

    it("mirrors Daftar Upah grand-total fields when building aggregation records", async () => {
        (DataExtractorService as any).getInstance = () => ({
            extractPayrollData: async () => ({
                data_rows: [
                    {
                        emp_code: "E001",
                        gang_code: "A01",
                        jumlah_hk: 20,
                        hari_kerja: 18,
                        cuti_tahunan_hari: 1,
                        cuti_sakit_haid_hari: 1,
                        cuti_minggu_hari: 2,
                        cuti_nasional_hari: 0,
                        upah_dasar: 100,
                        upah_pokok: 900,
                        gaji_pokok: 1000,
                        beras_jumlah: 10,
                        jabatan_jumlah: 20,
                        masa_kerja_jumlah: 30,
                        lembur_jumlah: 40,
                        total_tunjangan: 100,
                        premi_brondol: 20,
                        premi_pruning: 15,
                        total_premi: 70,
                        pot_koreksi: 5,
                        total_potongan: 30,
                        pph21_ter: 40,
                        pot_pph21: 10,
                        pot_bpjs_kesehatan_pekerja: 11,
                        pot_bpjs_pensiun_pekerja: 12,
                        pot_bpjs_pekerja_total: 23,
                        pot_bpjs_kesehatan_majikan: 13,
                        pot_bpjs_pensiun_majikan: 14,
                        pot_astek_maj: 99,
                        pot_spsi: 7,
                        jumlah_upah_kotor: 2000,
                        upah_bersih: 1900
                    },
                    {
                        emp_code: "E002",
                        gang_code: "A01",
                        jumlah_hk: 21,
                        hari_kerja: 19,
                        cuti_tahunan_hari: 1,
                        cuti_sakit_haid_hari: 0,
                        cuti_minggu_hari: 2,
                        cuti_nasional_hari: 0,
                        upah_dasar: 200,
                        upah_pokok: 800,
                        gaji_pokok: 1100,
                        beras_jumlah: 11,
                        jabatan_jumlah: 21,
                        masa_kerja_jumlah: 31,
                        lembur_jumlah: 41,
                        total_tunjangan: 104,
                        premi_brondol: 21,
                        premi_pruning: 16,
                        total_premi: 80,
                        pot_koreksi: 6,
                        total_potongan: 31,
                        pph21_ter: 60,
                        pot_pph21: 12,
                        pot_bpjs_kesehatan_pekerja: 13,
                        pot_bpjs_pensiun_pekerja: 14,
                        pot_bpjs_pekerja_total: 27,
                        pot_bpjs_kesehatan_majikan: 15,
                        pot_bpjs_pensiun_majikan: 16,
                        pot_astek_maj: 88,
                        pot_spsi: 8,
                        jumlah_upah_kotor: 3000,
                        upah_bersih: 2900
                    },
                    {
                        emp_code: "E003",
                        gang_code: "A01",
                        jumlah_hk: 2,
                        hari_kerja: 0,
                        cuti_minggu_hari: 2,
                        cuti_nasional_hari: 0,
                        upah_pokok: 9_999_999,
                        gaji_pokok: 9_999_999,
                        total_premi: 9_999_999
                    }
                ],
                dynamic_premi_headers: ["premi_pruning"],
                dynamic_potongan_headers: [],
                premi_title_map: { premi_pruning: "PREMI PRUNING" },
                potongan_title_map: {}
            })
        });

        const recordsByDivision = await PayrollDataService.fetchPayrollData("PG1A", 4, 2026, "Bearer test");
        const record = recordsByDivision.PG1A[0];

        expect(record.total_employees).toBe(3);
        expect(record.total_hk).toBe(43);
        expect(record.total_hari_kerja).toBe(37);
        expect(record.total_upah_dasar).toBe(300);
        expect(record.total_upah_pokok).toBe(10001699);
        expect(record.total_gaji_pokok).toBe(10002099);
        expect(record.total_premi_prunning).toBe(31);
        expect(record.total_premi).toBe(10000149);
        expect(record.total_pph21).toBe(22);
        expect(record.total_bpjs_pekerja).toBe(50);
        expect(record.total_bpjs_majikan).toBe(58);
        expect(record.total_spsi).toBe(15);
        expect(record.total_upah_kotor).toBe(5000);
        expect(record.total_upah_bersih).toBe(4800);
    });

    it("uses progressive complete rows as the aggregation source when available", async () => {
        (DataExtractorService as any).getInstance = () => ({
            extractPayrollData: async () => ({
                data_rows: [
                    {
                        emp_code: "E001",
                        gang_code: "E2H",
                        jumlah_hk: 21,
                        hari_kerja: 21,
                        jabatan_jumlah: 73500,
                        jumlah_upah_kotor: 1000000,
                        upah_bersih: 1000000
                    }
                ],
                dynamic_premi_headers: [],
                dynamic_potongan_headers: [],
                premi_title_map: {},
                potongan_title_map: {}
            }),
            extractPayrollDataProgressive: async function* () {
                yield {
                    phase: "complete",
                    gangs: new Map([
                        ["E2H", [
                            {
                                emp_code: "E001",
                                gang_code: "E2H",
                                jumlah_hk: 21,
                                hari_kerja: 21,
                                jabatan_jumlah: 0,
                                jumlah_upah_kotor: 926500,
                                upah_bersih: 926500
                            }
                        ]]
                    ]),
                    meta: {
                        total_gangs: 1,
                        total_employees: 1,
                        processed_employees: 1,
                        progress_pct: 100,
                        message: "complete"
                    },
                    dynamic_premi_headers: [],
                    dynamic_potongan_headers: [],
                    dynamic_premi_titles: {},
                    dynamic_potongan_titles: {}
                };
            }
        });

        const recordsByDivision = await PayrollDataService.fetchPayrollData("DME", 4, 2026, "Bearer test");
        const record = recordsByDivision.DME[0];

        expect(record.total_upah_bersih).toBe(926500);
        expect(record.total_jabatan).toBe(0);
    });

    it("reconciles per-gang rounding so division totals match Daftar Upah grand total", async () => {
        (DataExtractorService as any).getInstance = () => ({
            extractPayrollDataProgressive: async function* () {
                yield {
                    phase: "complete",
                    gangs: new Map([
                        ["E1", [
                            {
                                emp_code: "E001",
                                gang_code: "E1",
                                jumlah_hk: 1,
                                hari_kerja: 1,
                                upah_bersih: 10.4
                            }
                        ]],
                        ["E2", [
                            {
                                emp_code: "E002",
                                gang_code: "E2",
                                jumlah_hk: 1,
                                hari_kerja: 1,
                                upah_bersih: 10.4
                            }
                        ]]
                    ]),
                    meta: {
                        total_gangs: 2,
                        total_employees: 2,
                        processed_employees: 2,
                        progress_pct: 100,
                        message: "complete"
                    },
                    dynamic_premi_headers: [],
                    dynamic_potongan_headers: [],
                    dynamic_premi_titles: {},
                    dynamic_potongan_titles: {}
                };
            }
        });

        const recordsByDivision = await PayrollDataService.fetchPayrollData("DME", 4, 2026, "Bearer test");
        const storedDivisionTotal = recordsByDivision.DME.reduce(
            (sum, record) => sum + record.total_upah_bersih,
            0
        );

        expect(storedDivisionTotal).toBe(21);
    });
});
