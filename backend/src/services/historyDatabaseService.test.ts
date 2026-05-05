import { afterEach, describe, expect, it } from "bun:test";
import { historyDatabaseService } from "./historyDatabaseService";

describe("HistoryDatabaseService.saveHrEmployeeHistory", () => {
    const service = historyDatabaseService;
    const originalGetPayrollDatabase = (service as any).getPayrollDatabase;
    const originalGetTransactionDatabase = (service as any).getTransactionDatabase;

    afterEach(() => {
        (service as any).getPayrollDatabase = originalGetPayrollDatabase;
        (service as any).getTransactionDatabase = originalGetTransactionDatabase;
    });

    it("falls back to legacy history_hr_employee schema when new_nik column is missing", async () => {
        const executedSql: string[] = [];
        const fakeDb = {
            async queryOne(sql: string) {
                executedSql.push(sql);
                if (sql.includes("new_nik")) {
                    throw new Error("Invalid column name 'new_nik'");
                }
                return null;
            },
            async query(sql: string, params: any[]) {
                executedSql.push(sql);
                expect(sql).not.toContain("new_nik");
                expect(params[3]).toBe("3171");
                return [{ id: 99 }];
            }
        };

        (service as any).getPayrollDatabase = () => fakeDb;

        const insertedId = await service.saveHrEmployeeHistory({
            history_id: "HIST-TEST",
            period_month: 4,
            period_year: 2026,
            nik: "3171",
            emp_code: "B0001",
            emp_name: "BUDI",
            source_table: "HR_EMPLOYEE_JOIN"
        });

        expect(insertedId).toBe(99);
        expect(executedSql.some(sql => sql.includes("INSERT INTO dbo.history_hr_employee"))).toBe(true);
    });

    it("migrates history_hr_employee to include jabatan and SPSI membership columns", async () => {
        const executedSql: string[] = [];
        const fakeDb = {
            async query(sql: string) {
                executedSql.push(sql);
                return [];
            }
        };

        (service as any).getPayrollDatabase = () => fakeDb;
        (service as any).getTransactionDatabase = () => fakeDb;

        await service.migrateNewNikColumn();

        expect(executedSql.some(sql => sql.includes("TABLE_NAME='history_hr_employee'") && sql.includes("COLUMN_NAME='jabatan'"))).toBe(true);
        expect(executedSql.some(sql => sql.includes("ALTER TABLE dbo.history_hr_employee ADD jabatan"))).toBe(true);
        expect(executedSql.some(sql => sql.includes("TABLE_NAME='history_hr_employee'") && sql.includes("COLUMN_NAME='is_spsi_member'"))).toBe(true);
        expect(executedSql.some(sql => sql.includes("ALTER TABLE dbo.history_hr_employee ADD is_spsi_member"))).toBe(true);
    });

    it("loads latest tax identity from history_hr_employee by emp_code", async () => {
        const executedSql: string[] = [];
        const executedParams: any[][] = [];
        const fakeDb = {
            async query(sql: string, params: any[]) {
                executedSql.push(sql);
                executedParams.push(params);
                return [
                    {
                        emp_code: "B0001",
                        nik: "OLD-NIK",
                        new_nik: "UPDATED-NIK",
                        pajak_npwp: "UPDATED-NPWP",
                        res_address: "UPDATED ADDRESS",
                        religion: "01 Islam"
                    }
                ];
            }
        };

        (service as any).getPayrollDatabase = () => fakeDb;

        const result = await service.getHistoryTaxIdentityByEmpCodes(4, 2026, ["B0001"]);
        const identity = result.get("B0001");

        expect(identity?.new_nik).toBe("UPDATED-NIK");
        expect(identity?.pajak_npwp).toBe("UPDATED-NPWP");
        expect(identity?.res_address).toBe("UPDATED ADDRESS");
        expect(executedSql[0]).toContain("history_hr_employee");
        expect(executedSql[0]).toContain("new_nik");
        expect(executedSql[0]).toContain("pajak_npwp");
        expect(executedSql[0]).toContain("res_address");
        expect(executedParams[0]).toContain(4);
        expect(executedParams[0]).toContain(2026);
        expect(executedParams[0]).toContain("B0001");
    });
});

describe("HistoryDatabaseService payroll snapshot persistence", () => {
    const service = historyDatabaseService;
    const originalGetPayrollDatabase = (service as any).getPayrollDatabase;

    afterEach(() => {
        (service as any).getPayrollDatabase = originalGetPayrollDatabase;
    });

    it("persists snapshot linkage and brondol breakdown fields in payroll_history_detail insert", async () => {
        const executedSql: string[] = [];
        const fakeDb = {
            async queryOne() {
                return null;
            },
            async query(sql: string) {
                executedSql.push(sql);
                return [{ id: 101 }];
            }
        };

        (service as any).getPayrollDatabase = () => fakeDb;

        const insertedId = await service.savePayrollHistoryDetail({
            history_id: "HIST-TEST",
            master_id: 1,
            snapshot_batch_id: 55,
            snapshot_version: 3,
            emp_code: "B0001",
            gang_code: "A01",
            division_code: "TSA",
            hari_kerja: 20,
            cuti_tahunan_hari: 0,
            cuti_sakit_haid_hari: 0,
            cuti_minggu_hari: 0,
            cuti_nasional_hari: 0,
            jumlah_hk: 20,
            total_jam_kerja: 140,
            upah_dasar: 100000,
            upah_pokok: 100000,
            gaji_pokok: 100000,
            gaji_pokok_ideal: 100000,
            gaji_pokok_aktual: 100000,
            koreksi_hk: 0,
            beras_rate: 0,
            beras_jumlah: 0,
            jabatan_rate: 0,
            jabatan_jumlah: 0,
            masa_kerja_tahun: 1,
            masa_kerja_rate: 0,
            masa_kerja_jumlah: 0,
            lembur_jam: 0,
            lembur_rate: 0,
            lembur_jumlah: 0,
            total_tunjangan: 0,
            premi_brondol: 10,
            premi_brondol_loosefruit: 4,
            premi_brondol_adtrans: 6,
            premi_brondol_total: 10,
            premi_pph: 0,
            total_premi: 10,
            pot_spsi: 0,
            pot_pph21: 0,
            pot_koreksi: 0,
            pot_bpjs_kesehatan_pekerja: 0,
            pot_bpjs_kesehatan_majikan: 0,
            pot_bpjs_pensiun_pekerja: 0,
            pot_bpjs_pensiun_majikan: 0,
            pot_bpjs_pekerja_total: 0,
            pot_astek_pekerja: 0,
            pot_astek_majikan: 0,
            pot_astek_jumlah: 0,
            total_potongan: 0,
            total_potongan_bersih: 0,
            jumlah_upah_kotor: 110,
            upah_kotor_pajak: 110,
            penghasilan_bruto: 110,
            pph21_ter: 0,
            upah_bersih: 110
        });

        const insertSql = executedSql.find(sql => sql.includes("INSERT INTO dbo.payroll_history_detail"));
        expect(insertedId).toBe(101);
        expect(insertSql).toBeTruthy();
        expect(insertSql).toContain("snapshot_batch_id");
        expect(insertSql).toContain("snapshot_version");
        expect(insertSql).toContain("premi_brondol_loosefruit");
        expect(insertSql).toContain("premi_brondol_adtrans");
        expect(insertSql).toContain("premi_brondol_total");
    });

    it("persists snapshot linkage columns in payroll_history_header upsert", async () => {
        const queryOneSql: string[] = [];
        const querySql: string[] = [];
        const fakeDb = {
            async queryOne(sql: string) {
                queryOneSql.push(sql);
                return null;
            },
            async query(sql: string) {
                querySql.push(sql);
                return [{ id: 201 }];
            }
        };

        (service as any).getPayrollDatabase = () => fakeDb;

        const insertedId = await service.savePayrollHistoryMaster({
            history_id: "HIST-TEST",
            snapshot_batch_id: 88,
            snapshot_version: 4,
            period_month: 4,
            period_year: 2026,
            division_code: "TSA",
            gang_code: "A01",
            total_employees: 10,
            total_hk: 10,
            total_hari_kerja: 10,
            total_cuti_tahunan: 0,
            total_cuti_sakit: 0,
            total_cuti_minggu: 0,
            total_cuti_nasional: 0,
            total_upah_dasar: 0,
            total_upah_pokok: 0,
            total_gaji_pokok: 0,
            total_beras: 0,
            total_jabatan: 0,
            total_masa_kerja: 0,
            total_lembur: 0,
            total_tunjangan: 0,
            total_premi_brondol: 0,
            total_premi_prunning: 0,
            total_premi_insentif: 0,
            total_premi_kinerja: 0,
            total_premi: 0,
            total_koreksi: 0,
            total_potongan: 0,
            total_pph21: 0,
            total_bpjs_pekerja: 0,
            total_bpjs_majikan: 0,
            total_spsi: 0,
            total_upah_kotor: 0,
            total_upah_bersih: 0
        });

        const insertSql = querySql.find(sql => sql.includes("INSERT INTO dbo.payroll_history_header"));
        expect(insertedId).toBe(201);
        expect(queryOneSql[0]).toContain("snapshot_version = ?");
        expect(insertSql).toBeTruthy();
        expect(insertSql).toContain("snapshot_batch_id");
        expect(insertSql).toContain("snapshot_version");
    });
});
