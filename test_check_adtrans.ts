import { manualAdjustmentService } from "./backend/src/services/manualAdjustmentService";

async function run() {
    console.log("Running checkAdtransDirectly...");
    try {
        const result = await manualAdjustmentService.checkAdtransDirectly(
            4,
            2026,
            ['EMP001', 'EMP002'], // Example emp codes
            ['spsi', 'masa kerja', 'jabatan', 'premi', 'potongan']
        );
        console.log("Check Result:", result);
    } catch (error) {
        console.error("Error:", error);
    }
    process.exit(0);
}

run();
