import { historySeederService } from "./src/services/historySeederService";

async function testSeeder() {
    console.log("=== TESTING HISTORY SEEDER ===");
    console.log("Testing with division AB2, period 3/2026\n");

    const result = await historySeederService.seedPayrollHistory({
        periodMonth: 3,
        periodYear: 2026,
        divisionCode: "AB2",
        gangCode: undefined,
        createdBy: "test",
        seederMode: "PAYROLL"
    });

    console.log("\n=== SEEDER RESULT ===");
    console.log("Success:", result.success);
    console.log("History ID:", result.history_id);
    console.log("Total Employees:", result.total_employees);
    console.log("Records:", JSON.stringify(result.records_inserted, null, 2));
    
    if (result.errors.length > 0) {
        console.log("\n=== ERRORS ===");
        result.errors.forEach((err, i) => {
            console.log(`${i + 1}. ${err}`);
        });
    }

    process.exit(result.success ? 0 : 1);
}

testSeeder().catch(err => {
    console.error("Seeder crashed:", err);
    process.exit(1);
});
