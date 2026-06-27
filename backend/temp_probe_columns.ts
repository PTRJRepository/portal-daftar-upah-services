import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");

    for (const sheet of workbook.worksheets) {
        console.log(`=== SHEET: ${sheet.name} ===`);
        // Find row that looks like headers
        for (let r = 1; r <= 8; r++) {
            const vals = [];
            for (let c = 1; c <= sheet.columnCount; c++) {
                vals.push(sheet.getRow(r).getCell(c).value);
            }
            console.log(`Row ${r}:`, vals.map((v, idx) => `[Col ${idx + 1}: ${v ? JSON.stringify(v) : ""}]`).join(", "));
        }
        console.log("\n");
    }
}

main().catch(console.error);
