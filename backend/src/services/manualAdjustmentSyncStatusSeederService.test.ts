import { afterEach, describe, expect, it, mock } from "bun:test";
import { manualAdjustmentService } from "./manualAdjustmentService";
import { ManualAdjustmentSyncStatusSeederService } from "./manualAdjustmentSyncStatusSeederService";

describe("ManualAdjustmentSyncStatusSeederService", () => {
    const originalUpdateManualAdjustmentSyncStatus = manualAdjustmentService.updateManualAdjustmentSyncStatus;

    afterEach(() => {
        (manualAdjustmentService as any).updateManualAdjustmentSyncStatus = originalUpdateManualAdjustmentSyncStatus;
    });

    it("defaults to seeding sync status for manual adjustment and auto-buffer types", async () => {
        const updateManualAdjustmentSyncStatus = mock(async () => ({
            period_month: 4,
            period_year: 2026,
            target_sync_status: "SYNC",
            only_if_adtrans_exists: true,
            dry_run: false,
            matched_count: 10,
            eligible_count: 8,
            adtrans_matched_count: 7,
            updated_count: 6,
            unchanged_count: 1,
            skipped_count: 3,
            partial_count: 1,
            rows: []
        }));
        (manualAdjustmentService as any).updateManualAdjustmentSyncStatus = updateManualAdjustmentSyncStatus;

        const service = new ManualAdjustmentSyncStatusSeederService();
        const result = await service.seedPeriod({
            period_month: 4,
            period_year: 2026,
            division_code: "AB1",
            created_by: "admin"
        });

        expect(updateManualAdjustmentSyncStatus).toHaveBeenCalledWith({
            periodMonth: 4,
            periodYear: 2026,
            divisionCode: "AB1",
            gangCode: undefined,
            empCode: undefined,
            adjustmentTypes: ["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH", "AUTO_BUFFER"],
            adjustmentName: undefined,
            ids: undefined,
            syncStatus: "SYNC",
            updatedBy: "admin",
            onlyIfAdtransExists: true,
            dryRun: false,
            limit: undefined
        });
        expect(result).toMatchObject({
            seeder: "manual_adjustment_sync_status",
            adjustment_types: ["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH", "AUTO_BUFFER"],
            updated_count: 6,
            partial_count: 1
        });
    });
});
