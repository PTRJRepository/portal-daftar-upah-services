import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");

    for (const sheet of workbook.worksheets) {
        console.log(`=== SHEET: ${sheet.name} ===`);
        for (let r = 1; r <= Math.min(sheet.rowCount, 15); r++) {
            const vals = [];
            for (let c = 1; c <= sheet.columnCount; c++) {
                const cell = sheet.getRow(r).getCell(c);
                const val = cell.value ? String(cell.value.result || cell.value.text || cell.value) : "";
                if (val !== "") {
                    vals.push(`Col ${c}: ${val}`);
                }
            }
            if (vals.length > 0) {
                console.log(`Row ${r}:`, vals.join(" | "));
            }
        }
        console.log("\n");
    }
}

main().catch(console.error);
