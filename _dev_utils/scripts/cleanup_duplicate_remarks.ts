import { Database } from "../../backend/src/db/client";

/**
 * Cleanup remarks yang terkonversi ganda (duplicate pipe-delimited).
 *
 * Pattern korupsi:
 * "ADJ | ADJ | AD_CODE - DESC | AMOUNT | sync:MANUAL | match:MANUAL | AMOUNT | sync:MANUAL | match:MANUAL"
 *
 * Expected fixed:
 * "ADJ | AD_CODE - DESC | AMOUNT | sync:MANUAL | match:MANUAL"
 */

interface AdjRow {
    id: number;
    adjustment_name: string;
    amount: number;
    remarks: string;
}

function normalizeName(value: string): string {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function fixDuplicatedRemarks(row: AdjRow): string | null {
    const r = row.remarks;

    // Pattern korupsi: adjustment_name muncul 2x di awal + 2x sync: segment
    // Contoh: "KOREKSI PANEN | KOREKSI PANEN | DE0004 ... | -1 | sync:MANUAL | match:MANUAL | -1 | sync:MANUAL | match:MANUAL"
    const parts = r.split(" | ");

    // Kalau tidak ada duplikasi, skip
    if (parts.length < 8) return null;

    // Cek apakah parts[0] === parts[1] (duplikasi adjustment_name)
    if (parts[0] !== parts[1]) return null;

    // Cek apakah ada 2x segment sync:MANUAL | match:MANUAL
    const syncCount = parts.filter(p => p.includes("sync:MANUAL")).length;
    if (syncCount < 2) return null;

    // Rebuild: ambil unique parts
    // Format: ADJ_NAME | AD_CODE_PART | AMOUNT | sync:MANUAL | match:MANUAL
    const adjName = normalizeName(row.adjustment_name);
    const adCodePart = parts[2]; // DE0004 - (DE) POTONGAN PREMI
    const amount = row.amount;

    return `${adjName} | ${adCodePart} | ${amount} | sync:MANUAL | match:MANUAL`;
}

async function main() {
    const db = Database.getExtendedInstance();

    let totalFixed = 0;
    let totalOk = 0;

    console.log("=== CLEANUP DUPLICATE REMARKS ===\n");

    // Query semua record yang mengandung duplikasi sync:MANUAL
    const rows: AdjRow[] = await db.query(
        `SELECT id, adjustment_name, amount, remarks
         FROM dbo.payroll_manual_adjustments
         WHERE remarks LIKE '%sync:MANUAL | match:MANUAL |%'
         ORDER BY id`,
        []
    );

    console.log(`Found ${rows.length} potentially corrupted records.`);
    console.log("");

    for (const row of rows) {
        const fixed = fixDuplicatedRemarks(row);

        if (!fixed) {
            totalOk++;
            continue;
        }

        await db.query(
            `UPDATE dbo.payroll_manual_adjustments SET remarks = ? WHERE id = ?`,
            [fixed, row.id]
        );

        console.log(`[FIXED] id=${row.id} | ${row.adjustment_name}`);
        console.log(`  BEFORE: "${row.remarks}"`);
        console.log(`  AFTER:  "${fixed}"`);
        console.log("");

        totalFixed++;
    }

    console.log("");
    console.log("=== SELESAI ===");
    console.log(`Total fixed: ${totalFixed}`);
    console.log(`Total already OK: ${totalOk}`);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
