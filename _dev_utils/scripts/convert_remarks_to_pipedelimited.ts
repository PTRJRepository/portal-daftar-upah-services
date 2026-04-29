import { Database } from "../../backend/src/db/client";

/**
 * Script konversi remarks lama ke format pipe-delimited standar
 *
 * Pola yang dikonversi:
 * 1. "Edited via UI on <timestamp>"          -> "ADJ_NAME | MANUAL EDIT | AMOUNT | sync:MANUAL | match:MANUAL"
 * 2. "KONTAN edited via UI on <timestamp>"   -> "KONTAN | PENDAPATAN LAINNYA | AMOUNT | sync:MANUAL | match:MANUAL"
 * 3. "KONTAN DELETED via UI on <timestamp>"  -> "KONTAN | DELETED | 0 | sync:MANUAL | match:MANUAL"
 * 4. "AD CODE: XXX - DESC"                   -> "ADJ_NAME | XXX - DESC | AMOUNT | sync:MANUAL | match:MANUAL"
 * 5. catatan bebas (bukan AD CODE, bukan pipe) -> "ADJ_NAME | MANUAL EDIT | AMOUNT | sync:MANUAL | match:MANUAL"
 *
 * Pola yang dilewati (sudah pipe-delimited atau auto buffer):
 * - remarks yang sudah mengandung "| ... | sync:" (pipe format)
 * - "INIT_COLUMN - ..." (kolom baru)
 * - remarks kosong/null
 */

interface ManualAdjRow {
    id: number;
    adjustment_name: string;
    adjustment_type: string;
    amount: number;
    remarks: string | null;
}

function isPipeDelimited(remarks: string): boolean {
    return remarks.includes("|") && /\|\s*-?\d+\s*\|\s*sync:/i.test(remarks);
}

function normalizeName(name: string): string {
    return String(name || "").trim().toUpperCase();
}

function convertRemarks(row: ManualAdjRow): string | null {
    const rawRemarks = String(row.remarks || "").trim();
    if (!rawRemarks) return null;

    // Skip: sudah pipe-delimited (termasuk auto buffer dan manual yang sudah di-convert)
    if (isPipeDelimited(rawRemarks)) return null;

    // Skip: INIT_COLUMN marker
    if (/INIT_COLUMN/i.test(rawRemarks)) return null;

    const adjName = normalizeName(row.adjustment_name);
    const amount = Number(row.amount || 0);

    // Pattern 1/2/3: "Edited via UI on ..." atau "KONTAN edited/DELETED via UI on ..."
    if (/Edited via UI on|edited via UI on|DELETED via UI on/i.test(rawRemarks)) {
        if (adjName === "KONTAN") {
            if (amount === 0) {
                return `KONTAN | DELETED | 0 | sync:MANUAL | match:MANUAL`;
            }
            return `KONTAN | PENDAPATAN LAINNYA | ${amount} | sync:MANUAL | match:MANUAL`;
        }
        return `${adjName} | MANUAL EDIT | ${amount} | sync:MANUAL | match:MANUAL`;
    }

    // Pattern 4: "AD CODE: XXX - DESC"
    const adCodeMatch = rawRemarks.match(/^AD\s*CODE:\s*([^;\-]+)(?:\s*-\s*(.+))?/i);
    if (adCodeMatch) {
        const adCode = adCodeMatch[1].trim().toUpperCase();
        const desc = adCodeMatch[2] ? adCodeMatch[2].trim() : "";
        return `${adjName} | ${adCode}${desc ? ` - ${desc}` : ""} | ${amount} | sync:MANUAL | match:MANUAL`;
    }

    // Pattern 5: catatan bebas (bukan format di atas)
    // Konversi ke pipe-delimited dengan mempertahankan catatan sebagai bagian deskripsi
    // Hindari duplikasi AD CODE jika catatan mengandungnya
    if (/AD\s*CODE:/i.test(rawRemarks)) {
        // Jika catatan mengandung AD CODE tapi tidak match pattern 4, extract manual
        const looseMatch = rawRemarks.match(/AD\s*CODE:\s*([^\s;]+)/i);
        if (looseMatch) {
            const adCode = looseMatch[1].trim().toUpperCase();
            return `${adjName} | ${adCode} | ${amount} | sync:MANUAL | match:MANUAL`;
        }
    }

    // Catatan bebas murni -> masukkan sebagai deskripsi
    return `${adjName} | ${rawRemarks} | ${amount} | sync:MANUAL | match:MANUAL`;
}

async function main() {
    const db = Database.getExtendedInstance();
    const BATCH_SIZE = 200;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let offset = 0;

    console.log("=== KONVERSI REMARKS KE PIPE-DELIMITED ===");
    console.log("Tabel: payroll_manual_adjustments (extend_db_ptrj)");
    console.log("");

    while (true) {
        const rows: ManualAdjRow[] = await db.query(
            `SELECT id, adjustment_name, adjustment_type, amount, remarks
             FROM dbo.payroll_manual_adjustments
             ORDER BY id
             OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
            [offset, BATCH_SIZE]
        );

        if (!rows || rows.length === 0) break;

        for (const row of rows) {
            const newRemarks = convertRemarks(row);

            if (newRemarks === null) {
                totalSkipped++;
                continue;
            }

            // Update database
            await db.query(
                `UPDATE dbo.payroll_manual_adjustments SET remarks = ? WHERE id = ?`,
                [newRemarks, row.id]
            );

            console.log(`[UPDATED] id=${row.id} | ${row.adjustment_name}`);
            console.log(`  BEFORE: "${row.remarks}"`);
            console.log(`  AFTER:  "${newRemarks}"`);
            console.log("");

            totalUpdated++;
        }

        offset += BATCH_SIZE;
        console.log(`--- Batch done. Offset=${offset}, Updated=${totalUpdated}, Skipped=${totalSkipped} ---`);
    }

    console.log("");
    console.log("=== SELESAI ===");
    console.log(`Total updated: ${totalUpdated}`);
    console.log(`Total skipped (sudah format pipe / INIT_COLUMN / kosong): ${totalSkipped}`);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
