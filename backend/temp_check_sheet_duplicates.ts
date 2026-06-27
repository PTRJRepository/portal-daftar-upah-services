import { createRequire } from "module";
import { dirname, join } from "path";

const requireFromBackend = createRequire(join(process.cwd(), "backend/package.json"));
const ExcelJS = requireFromBackend("exceljs");

function clean(value: unknown): string {
    return String(value ?? "").trim();
}
function upper(value: unknown): string {
    return clean(value).toUpperCase();
}
function isEmpCode(value: unknown): boolean {
    return /^[A-HJ]\d{4}$/i.test(clean(value));
}

async function main() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");

    for (const sheet of workbook.worksheets) {
        let empColIdx = 3;
        if (sheet.name === "AIR PAPAN") {
            empColIdx = 8;
        }

        const counts = new Map<string, number[]>();
        for (let r = 1; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const empcode = upper(row.getCell(empColIdx).value);
            if (!isEmpCode(empcode)) continue;

            const rowsList = counts.get(empcode) || [];
            rowsList.push(r);
            counts.set(empcode, rowsList);
        }

        console.log(`\n=== Duplicates in Sheet: ${sheet.name} ===`);
        let hasDup = false;
        for (const [code, rowsList] of counts.entries()) {
            if (rowsList.length > 1) {
                hasDup = true;
                console.log(`Emp: ${code} | Rows: ${rowsList.join(", ")}`);
            }
        }
        if (!hasDup) {
            console.log("No duplicates found in this sheet.");
        }
    }
}

main().catch(console.error);
