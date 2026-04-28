import { Database } from '../../../backend/src/db/client';

const db = Database.getExtendedInstance();
const mode = process.argv.includes('--apply') ? 'apply' : 'preview';

function normalizeAmount(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildRemark(row: any): string {
  const name = String(row.adjustment_name || '').trim().toUpperCase();
  const source = String(row.ad_code_text || '').trim() || name.toLowerCase();
  return `${name} | ${source} | ${normalizeAmount(row.amount)} | sync:MISS | match:MISMATCH`;
}

async function main() {
  const rows = await db.query<any>(`
    SELECT
      id,
      period_month,
      period_year,
      emp_code,
      gang_code,
      division_code,
      adjustment_name,
      adjustment_type,
      amount,
      remarks,
      created_at,
      CASE
        WHEN remarks LIKE '%|%|%| sync:%' THEN
          LTRIM(RTRIM(SUBSTRING(
            remarks,
            CHARINDEX('|', remarks) + 1,
            CHARINDEX('|', remarks, CHARINDEX('|', remarks) + 1) - CHARINDEX('|', remarks) - 1
          )))
        WHEN remarks LIKE 'AD CODE:%' THEN
          LTRIM(RTRIM(REPLACE(SUBSTRING(remarks, 1, CASE WHEN CHARINDEX(';', remarks) > 0 THEN CHARINDEX(';', remarks) - 1 ELSE LEN(remarks) END), 'AD CODE:', '')))
        ELSE NULL
      END AS ad_code_text
    FROM dbo.payroll_manual_adjustments
    WHERE adjustment_type = 'PREMI'
      AND CAST(created_at AS date) = CAST(GETDATE() AS date)
      AND remarks IS NOT NULL
      AND (
        remarks LIKE 'AD CODE:%'
        OR remarks LIKE '%INIT_COLUMN%'
      )
    ORDER BY id
  `, []);

  console.log(`[${mode}] target rows: ${rows.length}`);
  console.log(rows.slice(0, 20).map((row) => ({
    id: row.id,
    adjustment_name: row.adjustment_name,
    amount: normalizeAmount(row.amount),
    old_remarks: row.remarks,
    new_remarks: buildRemark(row)
  })));

  if (mode !== 'apply') return;

  for (const row of rows) {
    const newRemark = buildRemark(row);
    await db.query(`
      UPDATE dbo.payroll_manual_adjustments
      SET remarks = ?, updated_at = GETDATE(), updated_by = ?
      WHERE id = ?
    `, [newRemark, 'remarks_format_fix', row.id]);
  }

  console.log(`[apply] updated rows: ${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
