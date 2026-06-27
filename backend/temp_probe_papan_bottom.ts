import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");
    const sheet = workbook.getWorksheet("AIR PAPAN");
    console.log("RowCount:", sheet.rowCount);
    for (let r = 25; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const vals = [];
        for (let c = 1; c <= sheet.columnCount; c++) {
            const cell = row.getCell(c);
            let valStr = "";
            if (cell.value && typeof cell.value === "object" && "formula" in cell.value) {
                valStr = `formula=${cell.value.formula}, result=${cell.value.result}`;
            } else {
                valStr = JSON.stringify(cell.value);
            }
            if (cell.value !== null && cell.value !== "") {
                vals.push(`Col ${c}: ${valStr}`);
            }
        }
        console.log(`Row ${r}:`, vals.join(" | "));
    }
}

main().catch(console.error);
