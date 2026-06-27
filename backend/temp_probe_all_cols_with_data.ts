import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");
    const sheet = workbook.getWorksheet("AIR PAPAN");

    const colHasData = new Array(sheet.columnCount + 1).fill(false);
    for (let r = 1; r <= sheet.rowCount; r++) {
        for (let c = 1; c <= sheet.columnCount; c++) {
            const val = sheet.getRow(r).getCell(c).value;
            if (val != null && val !== "") {
                colHasData[c] = true;
            }
        }
    }

    console.log("Columns with data in AIR PAPAN:");
    for (let c = 1; c <= sheet.columnCount; c++) {
        if (colHasData[c]) {
            console.log(`Col ${c} has data. Row 5 value: ${sheet.getRow(5).getCell(c).value}`);
        }
    }
}

main().catch(console.error);
