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

    const empSheets = new Map<string, string[]>();

    for (const sheet of workbook.worksheets) {
        let empColIdx = 3;
        if (sheet.name === "AIR PAPAN") {
            empColIdx = 8;
        } else if (sheet.name === "AIR JANGKAT") {
            empColIdx = 3;
        } else if (sheet.name === "AIR BETANGAN") {
            empColIdx = 3;
        } else {
            continue;
        }

        for (let r = 1; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const empcode = upper(row.getCell(empColIdx).value);
            const name = clean(row.getCell(2).value);
            if (!isEmpCode(empcode)) continue;

            const existing = empSheets.get(empcode) || [];
            if (!existing.includes(sheet.name)) {
                existing.push(sheet.name);
                empSheets.set(empcode, existing);
            }
        }
    }

    console.log("=== EMPLOYEES ACROSS MULTIPLE SHEETS ===");
    for (const [code, sheets] of empSheets.entries()) {
        if (sheets.length > 1) {
            console.log(`Emp: ${code} | Sheets: ${sheets.join(", ")}`);
        }
    }
}

main().catch(console.error);
