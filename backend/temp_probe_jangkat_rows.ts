import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");
    const sheet = workbook.getWorksheet("AIR JANGKAT");

    console.log("=== ALL ROWS IN AIR JANGKAT ===");
    for (let r = 9; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const name = row.getCell(3).value;
        const code = row.getCell(4).value;
        if (!name && !code) continue;

        const details = [];
        for (let c = 5; c <= 10; c++) {
            const val = row.getCell(c).value;
            if (val != null && val !== "") {
                const header = sheet.getRow(8).getCell(c).value || sheet.getRow(6).getCell(c).value;
                details.push(`${header}: ${val}`);
            }
        }
        console.log(`Row ${r} | Emp: ${code} (${name}) | ${details.join(", ")}`);
    }
}

main().catch(console.error);
