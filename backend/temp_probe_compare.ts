import { createRequire } from "module";
import { dirname, join } from "path";
import { Database } from "./src/db/client";

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
    const db = Database.getExtendedInstance();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("D:\\GAJII SYIT\\pruning_raking\\PRUNING PGE 2A.xlsx");

    // Load from DB
    const dbRows = await db.query<any>(`
        SELECT id, emp_code, emp_name, division_code, amount, remarks, metadata_json
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND division_code = 'P2A' AND adjustment_name = 'PREMI PRUNING'
    `);

    const dbMap = new Map<string, any>();
    for (const r of dbRows) {
        dbMap.set(upper(r.emp_code), r);
    }

    console.log("=== COMPARING AIR PAPAN & AIR BETANGAN FROM EXCEL TO DB ===");

    for (const sheetName of ["AIR PAPAN", "AIR BETANGAN"]) {
        const sheet = workbook.getWorksheet(sheetName);
        console.log(`\n--- Sheet: ${sheetName} ---`);

        // Find header row and columns
        let headerRowIdx = sheetName === "AIR PAPAN" ? 5 : 4;
        let empColIdx = sheetName === "AIR PAPAN" ? 8 : 3;
        let nameColIdx = sheetName === "AIR PAPAN" ? 2 : 2;

        const blockCols: number[] = [];
        for (let c = 1; c <= sheet.columnCount; c++) {
            const h = upper(sheet.getRow(headerRowIdx).getCell(c).value);
            if (h && h.startsWith("P97") || h.startsWith("N3") || h.startsWith("N4")) {
                blockCols.push(c);
            }
        }

        console.log(`Blocks columns found:`, blockCols.map(c => `${sheet.getRow(headerRowIdx).getCell(c).value} (Col ${c})`));

        for (let r = (sheetName === "AIR PAPAN" ? 6 : 6); r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const empcode = upper(row.getCell(empColIdx).value);
            const name = clean(row.getCell(nameColIdx).value);
            if (!isEmpCode(empcode)) continue;

            // Calculate sum of blocks in excel
            let excelSum = 0;
            const excelItems: any[] = [];
            for (const col of blockCols) {
                const val = row.getCell(col).value;
                if (val != null && val !== "" && Number(val) > 0) {
                    const blockName = upper(sheet.getRow(headerRowIdx).getCell(col).value);
                    excelSum += Number(val);
                    excelItems.push({ subblok: blockName, jumlah: Number(val) });
                }
            }

            const dbRow = dbMap.get(empcode);
            if (!dbRow) {
                console.log(`Emp: ${empcode} (${name}) | NOT FOUND in DB! Excel Sum: ${excelSum}`);
            } else {
                const dbAmount = Number(dbRow.amount);
                // Parse db metadata items sum
                let dbMetaSum = 0;
                try {
                    const meta = JSON.parse(dbRow.metadata_json);
                    dbMetaSum = (meta.items || []).reduce((s: number, i: any) => s + (Number(i.jumlah) || 0), 0);
                } catch {}

                if (dbAmount !== excelSum || dbMetaSum !== excelSum) {
                    console.log(`Emp: ${empcode} (${name}) | MISMATCH!`);
                    console.log(`  Excel Sum: ${excelSum}`);
                    console.log(`  DB Amount: ${dbAmount}`);
                    console.log(`  DB Meta Sum: ${dbMetaSum}`);
                    console.log(`  DB Remarks: ${dbRow.remarks}`);
                }
            }
        }
    }
}

main().catch(console.error);
