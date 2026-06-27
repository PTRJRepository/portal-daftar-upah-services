import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");

    // Check AIR PAPAN row 6
    const sheet = workbook.getWorksheet("AIR PAPAN");
    console.log("=== AIR PAPAN ROW 6 ===");
    const row6 = sheet.getRow(6);
    for (let c = 1; c <= 15; c++) {
        const cell = row6.getCell(c);
        console.log(`Col ${c}: value=${JSON.stringify(cell.value)}, type=${cell.type}`);
    }

    console.log("\n=== AIR PAPAN ROW 22 (MUSNI) ===");
    const row22 = sheet.getRow(22);
    for (let c = 1; c <= 15; c++) {
        const cell = row22.getCell(c);
        console.log(`Col ${c}: value=${JSON.stringify(cell.value)}, type=${cell.type}`);
    }
}

main().catch(console.error);
