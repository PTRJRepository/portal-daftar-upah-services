import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");
    const sheet = workbook.getWorksheet("AIR PAPAN");

    console.log("AIR PAPAN Row 5 non-empty cells:");
    for (let c = 1; c <= sheet.columnCount; c++) {
        const val = sheet.getRow(5).getCell(c).value;
        const val4 = sheet.getRow(4).getCell(c).value;
        const val3 = sheet.getRow(3).getCell(c).value;
        console.log(`Col ${c}: Row3=${val3 ? JSON.stringify(val3) : ""}, Row4=${val4 ? JSON.stringify(val4) : ""}, Row5=${val ? JSON.stringify(val) : ""}`);
    }
}

main().catch(console.error);
