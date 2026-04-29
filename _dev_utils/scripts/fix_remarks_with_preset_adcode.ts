import { Database } from "../../backend/src/db/client";

/**
 * Fix remarks yang masih pakai "MANUAL EDIT" — rebuild dari nol
 * dengan AD code yang benar. Ini juga memperbaiki record yang
 * terkena konversi ganda (double pipe-delimited).
 */

const HARDCODED_AD_CODE_MAP: Record<string, { ad_code: string; task_desc: string }> = {
    // POTONGAN_KOTOR
    "KOREKSI BRONDOL": { ad_code: "DE0004", task_desc: "(DE) POTONGAN PREMI" },
    "KOREKSI PANEN": { ad_code: "DE0004", task_desc: "(DE) POTONGAN PREMI" },
    "KOREKSI PRUNING": { ad_code: "DE0004", task_desc: "(DE) POTONGAN PREMI" },

    // POTONGAN_BERSIH
    "POTONGAN LAINNYA BPJS": { ad_code: "DE0009", task_desc: "(DE) POTONGAN BPJS" },
    "POTONGAN LAINNYA POTONGAN SPSI": { ad_code: "DE0009", task_desc: "(DE) POTONGAN BPJS" },
    "POTONGAN LAINNYA POTONGAN TIKET": { ad_code: "DE0002", task_desc: "(DE) POTONGAN HUTANG" },

    // PREMI
    "PREMI COBA": { ad_code: "AL9999", task_desc: "(AL) TUNJANGAN PREMI" },
    "PREMI JAGA GENSET": { ad_code: "AL0018", task_desc: "(AL) TUNJANGAN JAGA GENSET" },
    "PREMI PANEN": { ad_code: "AL3PM2501", task_desc: "(AL) TUNJANGAN PREMI ((PM) HARVESTING MISCELLANEOUS)" },
    "PREMI PENGEMBALIAN TIKET": { ad_code: "AL3PT2329", task_desc: "(AL) TUNJANGAN PREMI ((PM) HARVESTING LABOUR - HARVESTING)" },
    "PREMI PERBAIKAN JALAN": { ad_code: "AL3PT2329", task_desc: "(AL) TUNJANGAN PREMI ((PM) HARVESTING LABOUR - HARVESTING)" },
    "PREMI PRUNING": { ad_code: "AL3PM0601", task_desc: "(AL) TUNJANGAN PREMI ((PM) PRUNING)" },
    "PREMI RAKING": { ad_code: "AL3PM0106", task_desc: "(AL) TUNJANGAN PREMI ((PM) WEEDING - CIRCLE RAKING)" },
};

interface AdjRow {
    id: number;
    adjustment_name: string;
    amount: number;
    remarks: string;
}

function normalizeName(value: string): string {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function buildAdCodePart(adCode: string, taskDesc: string): string {
    const code = adCode.trim().toUpperCase();
    const desc = taskDesc ? taskDesc.trim() : "";
    return desc ? `${code} - ${desc}` : code;
}

function buildRemarks(adjName: string, amount: number, adCodePart: string): string {
    return `${adjName} | ${adCodePart} | ${amount} | sync:MANUAL | match:MANUAL`;
}

async function main() {
    const db = Database.getExtendedInstance();

    console.log("Hardcoded AD Code mappings:");
    for (const [name, data] of Object.entries(HARDCODED_AD_CODE_MAP)) {
        console.log(`  ${name} -> ${buildAdCodePart(data.ad_code, data.task_desc)}`);
    }
    console.log("");

    const BATCH_SIZE = 200;
    let totalFixed = 0;
    let totalStillManual = 0;
    let offset = 0;

    console.log("=== FIX REMARKS — REBUILD DARI NOL ===\n");

    while (true) {
        const rows: AdjRow[] = await db.query(
            `SELECT id, adjustment_name, amount, remarks
             FROM dbo.payroll_manual_adjustments
             WHERE remarks LIKE '%MANUAL EDIT%'
             ORDER BY id
             OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
            [offset, BATCH_SIZE]
        );

        if (!rows || rows.length === 0) break;

        for (const row of rows) {
            const adjName = normalizeName(row.adjustment_name);
            const mapping = HARDCODED_AD_CODE_MAP[adjName];

            if (!mapping) {
                totalStillManual++;
                console.log(`[SKIP - no mapping] id=${row.id} | ${adjName}`);
                continue;
            }

            const adCodePart = buildAdCodePart(mapping.ad_code, mapping.task_desc);
            const newRemarks = buildRemarks(adjName, row.amount, adCodePart);

            // Hanya update kalau berbeda
            if (newRemarks === row.remarks) {
                continue;
            }

            await db.query(
                `UPDATE dbo.payroll_manual_adjustments SET remarks = ? WHERE id = ?`,
                [newRemarks, row.id]
            );

            console.log(`[FIXED] id=${row.id} | ${adjName}`);
            console.log(`  BEFORE: "${row.remarks}"`);
            console.log(`  AFTER:  "${newRemarks}"`);
            console.log("");

            totalFixed++;
        }

        offset += BATCH_SIZE;
        console.log(`--- Batch done. Offset=${offset}, Fixed=${totalFixed}, StillManual=${totalStillManual} ---`);
    }

    console.log("");
    console.log("=== SELESAI ===");
    console.log(`Total fixed dengan AD code: ${totalFixed}`);
    console.log(`Total masih MANUAL EDIT (mapping tidak ditemukan): ${totalStillManual}`);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
