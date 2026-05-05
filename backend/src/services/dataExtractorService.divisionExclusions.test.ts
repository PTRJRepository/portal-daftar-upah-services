import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "../db/client";
import { currentPeriodService } from "./currentPeriodService";
import { dataExtractorService } from "./dataExtractorService";
import { EmployeeEstateService } from "./employeeEstateService";
import { gangService } from "./gangService";
import { historyDatabaseService } from "./historyDatabaseService";

describe("DataExtractorService division gang exclusions", () => {
    const originalGetEmployees = (dataExtractorService as any).getEmployees;
    const originalFetchGangs = gangService.fetchGangs;
    const originalGetCurrentPeriod = currentPeriodService.getCurrentPeriod;
    const originalIsHistoryMode = historyDatabaseService.isHistoryMode;
    const originalGetExtendedInstance = Database.getExtendedInstance;
    const originalGetEmployeeJobsWithNik = EmployeeEstateService.getEmployeeJobsWithNik;

    afterEach(() => {
        (dataExtractorService as any).getEmployees = originalGetEmployees;
        (gangService as any).fetchGangs = originalFetchGangs;
        (currentPeriodService as any).getCurrentPeriod = originalGetCurrentPeriod;
        (historyDatabaseService as any).isHistoryMode = originalIsHistoryMode;
        (Database as any).getExtendedInstance = originalGetExtendedInstance;
        (EmployeeEstateService as any).getEmployeeJobsWithNik = originalGetEmployeeJobsWithNik;
    });

    it("filters F1BHL employees from ARA progressive payroll output", async () => {
        (gangService as any).fetchGangs = async () => [
            { gang_code: "F1H", description: "F1H", loc_code: "ARA" }
        ];
        (currentPeriodService as any).getCurrentPeriod = async () => ({
            month: 4,
            year: 2026,
            is_cached: false
        });
        (historyDatabaseService as any).isHistoryMode = () => false;
        (Database as any).getExtendedInstance = () => ({
            query: async () => []
        });
        (EmployeeEstateService as any).getEmployeeJobsWithNik = async () => ({
            empcodeMap: {},
            nikMap: {}
        });
        (dataExtractorService as any).getEmployees = async () => [
            {
                emp_code: "F9999",
                actual_nik: "1902050504860001",
                emp_name: "BHL TEST",
                gender: "M",
                loc_code: "ARA",
                gang_code: "F1BHL",
                gang_desc: "F1BHL",
                pay_rate: 0,
                beras_rate: 0,
                join_date: null,
                res_address: null,
                hr_emp_type: "BHL"
            }
        ];

        const stream = dataExtractorService.extractPayrollDataProgressive(
            4,
            2026,
            "ALL",
            "ARA",
            undefined,
            undefined,
            false,
            undefined,
            "non_db_ptrj"
        );
        const first = await stream.next();

        expect(first.value.phase).toBe("complete");
        expect(first.value.meta.total_employees).toBe(0);
        expect(Array.from(first.value.gangs.keys())).toEqual([]);

        await stream.return(undefined);
    });
});
