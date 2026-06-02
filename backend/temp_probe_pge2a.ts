import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");

    console.log("Sheet names:");
    for (const sheet of workbook.worksheets) {
        console.log(`- ${sheet.name} (rows: ${sheet.rowCount}, cols: ${sheet.columnCount})`);

        // Print first 10 rows and 15 columns
        console.log("Header grid preview (rows 1-10, cols 1-15):");
        for (let r = 1; r <= Math.min(sheet.rowCount, 12); r++) {
            const rowValues = [];
            for (let c = 1; c <= Math.min(sheet.columnCount, 15); c++) {
                const cell = sheet.getRow(r).getCell(c);
                rowValues.push(cell.value ? String(cell.value.result || cell.value.text || cell.value) : "");
            }
            console.log(`Row ${r}:`, rowValues.map(v => v.trim()).join(" | "));
        }
        console.log("\n--------------------------------------------------\n");
    }
}

main().catch(console.error);
