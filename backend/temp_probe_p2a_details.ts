import { Database } from "./src/db/client";

async function main() {
    const db = Database.getExtendedInstance();
    const rows = await db.query<any>(`
        SELECT id, emp_code, emp_name, division_code, gang_code, amount, remarks, metadata_json, updated_at, updated_by
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND division_code = 'P2A' AND adjustment_name = 'PREMI PRUNING'
        ORDER BY id
    `);

    console.log(`P2A Pruning rows count: ${rows.length}`);
    for (const r of rows) {
        let metaSum = 0;
        try {
            if (r.metadata_json) {
                const meta = JSON.parse(r.metadata_json);
                metaSum = (meta.items || []).reduce((s: number, i: any) => s + (Number(i.jumlah) || 0), 0);
            }
        } catch {}
        if (r.amount !== metaSum || r.updated_by) {
            console.log(`ID: ${r.id} | Emp: ${r.emp_code} (${r.emp_name}) | DB Amount: ${r.amount} | Meta Sum: ${metaSum} | Updated By: ${r.updated_by}`);
            console.log(`  Remarks: ${r.remarks}`);
            console.log(`  Meta: ${r.metadata_json}`);
        }
    }
}

main().catch(console.error);
