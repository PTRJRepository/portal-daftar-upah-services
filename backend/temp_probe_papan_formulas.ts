import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");
    const sheet = workbook.getWorksheet("AIR PAPAN");

    console.log("=== AIR PAPAN ROW 6 to 10 FORMULAS & VALUES ===");
    for (let r = 6; r <= 10; r++) {
        const row = sheet.getRow(r);
        console.log(`Row ${r}:`);
        for (let c = 1; c <= 15; c++) {
            const cell = row.getCell(c);
            if (cell.value !== null && cell.value !== "") {
                let desc = "";
                if (typeof cell.value === "object" && "formula" in cell.value) {
                    desc = `formula=${cell.value.formula}, result=${cell.value.result}`;
                } else {
                    desc = `value=${JSON.stringify(cell.value)}`;
                }
                console.log(`  Col ${c}: ${desc}`);
            }
        }
    }
}

main().catch(console.error);
