import { Database } from "../../src/db/client";
import { historyDatabaseService, HistoryAdtrans } from "../../src/services/historyDatabaseService";

async function testSave() {
    console.log("Testing saveAdtransHistory...");
    
    const mockData: HistoryAdtrans = {
        history_id: "test-history-id",
        original_master_id: 12345,
        doc_no: "DOC-001",
        doc_date: new Date(),
        doc_desc: "Mock Transaction",
        emp_code: "D0001",
        original_line_id: 67890,
        amount: 1000,
        category: "PREMI",
        is_dynamic: false,
        is_premi_pph: false,
        is_koreksi: false,
        is_potongan: false,
        is_premi: true,
        period_month: 3,
        period_year: 2026,
        source_table: "PR_ADTRANS"
    };

    try {
        const id = await historyDatabaseService.saveAdtransHistory(mockData);
        console.log("Successfully saved with ID:", id);
    } catch (err: any) {
        console.error("Error saving adtrans:", err.message);
        console.error(err);
    }

    process.exit(0);
}

testSave().catch(console.error);
