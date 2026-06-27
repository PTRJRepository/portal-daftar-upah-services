import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");

    for (const name of ["AIR PAPAN", "AIR BETANGAN"]) {
        const sheet = workbook.getWorksheet(name);
        console.log(`\n=== Headers for ${name} ===`);
        const headerRowIdx = name === "AIR PAPAN" ? 5 : 4;
        const row = sheet.getRow(headerRowIdx);
        for (let c = 1; c <= sheet.columnCount; c++) {
            console.log(`Col ${c}: ${JSON.stringify(row.getCell(c).value)}`);
        }
    }
}

main().catch(console.error);
