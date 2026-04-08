import { HistoryDatabaseService } from "../backend/src/services/historyDatabaseService";

async function checkDuplicates() {
    const historyDb = HistoryDatabaseService.getInstance();
    const month = 3;
    const year = 2026;
    const division = "ARA";

    console.log(`Checking duplicates for ${division} ${month}/${year}...`);

    try {
        const data = await historyDb.getHistoricalPayrollDataAsExtractorFormat(month, year, "ALL", division);
        
        if (!data || !data.data_rows) {
            console.log("No data found.");
            return;
        }

        const counts: Record<string, number> = {};
        const duplicates: any[] = [];

        data.data_rows.forEach((row: any) => {
            const key = `${row.emp_code}_${row.gang_code}`;
            counts[key] = (counts[key] || 0) + 1;
            if (counts[key] === 2) {
                duplicates.push(row);
            }
        });

        console.log(`Total rows: ${data.data_rows.length}`);
        const totalUnique = Object.keys(counts).length;
        console.log(`Unique employees: ${totalUnique}`);
        console.log(`Duplicate count (based on emp_code + gang_code): ${data.data_rows.length - totalUnique}`);

        if (duplicates.length > 0) {
            console.log("\nSample Duplicates (emp_code & gang_code):");
            const sample = Object.entries(counts).filter(([k,v]) => v > 1).slice(0, 5);
            console.log(sample.map(([k,v]) => `${k}: ${v} occurrences`));

            console.log("\nFirst redundant row sample:");
            console.table([{
                emp_code: duplicates[0].emp_code,
                nama: duplicates[0].nama || duplicates[0].emp_name,
                gang: duplicates[0].gang_code,
                bruto: duplicates[0].penghasilan_bruto
            }]);
        }
    } catch (e: any) {
        console.error("Error in checkDuplicates:", e.message);
    }
}

checkDuplicates().catch(console.error);
