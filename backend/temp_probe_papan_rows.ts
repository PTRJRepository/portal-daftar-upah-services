import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");
    const sheet = workbook.getWorksheet("AIR PAPAN");

    console.log("=== ALL ROWS IN AIR PAPAN ===");
    for (let r = 6; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const name = row.getCell(2).value;
        const code = row.getCell(8).value;
        if (!name && !code) continue;

        const details = [];
        for (let c = 3; c <= 10; c++) {
            if (c === 8) continue;
            const val = row.getCell(c).value;
            if (val != null && val !== "") {
                const header = sheet.getRow(5).getCell(c).value;
                details.push(`${header}: ${val}`);
            }
        }
        console.log(`Row ${r} | Emp: ${code} (${name}) | ${details.join(", ")}`);
    }
}

main().catch(console.error);
