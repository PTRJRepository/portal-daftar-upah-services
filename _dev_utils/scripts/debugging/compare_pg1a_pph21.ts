/**
 * Compare PPH21 TER vs PPH21 Amount for PG1A division only
 */

import sql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';

const DB_CONFIG = {
    driver: "ODBC Driver 17 for SQL Server",
    server: "10.0.0.2",
    port: 1888,
    user: "sa",
    password: "supp0rt@",
    database: "db_ptrj",
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

const PPH21_PATTERNS = [
    '%Potongan Pph21%',
    '%Potongan PPH 21%',
    '%Potongan PPH21%',
    '%PPH 21%',
    '%PPH21%',
    '%POTONGAN PPH%',
    '%PPh 21%',
    '%PPh21%'
];

async function main() {
    const DIVISION = 'PG1A';
    console.log('='.repeat(80));
    console.log(`PPH21 TER vs PPH21 Amount - Division ${DIVISION}`);
    console.log('='.repeat(80));

    // [1] Load PG1A from JSON
    console.log('\n[1] Loading PG1A from JSON...');
    const filePath = path.resolve(process.cwd(), '../update_pajak/PG1A_pajak.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    interface EmployeeTax {
        emp_code: string;
        emp_name: string;
        pph21_ter: number;
    }

    const jsonEmployees = new Map<string, EmployeeTax>();
    let jsonTotal = 0;

    if (data.employees) {
        for (const [code, emp] of Object.entries(data.employees)) {
            const empData = emp as any;
            const pph21 = empData.pph21_ter || empData.pph21_amount || 0;
            jsonEmployees.set(code, {
                emp_code: code,
                emp_name: empData.emp_name || '',
                pph21_ter: pph21
            });
            jsonTotal += pph21;
        }
    }

    console.log(`✅ ${jsonEmployees.size} employees loaded from JSON`);
    console.log(`📊 PPH21 TER Total: Rp ${jsonTotal.toLocaleString('id-ID')}\n`);

    // [2] Get from database
    console.log('[2] Fetching from database...');
    const pool = await sql.connect(DB_CONFIG);

    // PG1A gang codes from DivisionConfigService: P1A, P1a, pg1a, PLASMA1A, Plasma 1A
    const gangCondition = `(
        UPPER(RTRIM(g.LocCode)) IN ('P1A', 'P1a', 'pg1a', 'PLASMA1A', 'Plasma 1A')
        OR UPPER(RTRIM(g.LocCode)) = 'PG1A'
    )`;

    const whereClause = PPH21_PATTERNS.map((_, i) => `t.DocDesc LIKE @p${i}`).join(' OR ');
    
    // Get emp codes from JSON
    const empCodes = Array.from(jsonEmployees.keys());

    if (empCodes.length === 0) {
        console.log('No employees in JSON!');
        await pool.close();
        return;
    }

    const placeholders = empCodes.map((_, i) => `@emp${i}`).join(',');
    const query = `
        SELECT 
            RTRIM(t.EmpCode) as emp_code,
            SUM(ln.Amount) as pph21_amount
        FROM PR_ADTRANS t
        INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE (${whereClause})
        AND RTRIM(t.EmpCode) IN (${placeholders})
        GROUP BY RTRIM(t.EmpCode)
    `;

    const request = pool.request();
    PPH21_PATTERNS.forEach((pattern, i) => {
        request.input(`p${i}`, sql.VarChar, pattern);
    });
    empCodes.forEach((code, i) => {
        request.input(`emp${i}`, sql.VarChar, code);
    });

    const result = await request.query(query);

    const dbAmounts = new Map<string, number>();
    let dbTotal = 0;

    for (const row of result.recordset) {
        dbAmounts.set(row.emp_code, row.pph21_amount || 0);
        dbTotal += row.pph21_amount || 0;
    }

    console.log(`✅ ${dbAmounts.size} employees found in DB`);
    console.log(`📊 PPH21 Amount Total: Rp ${dbTotal.toLocaleString('id-ID')}\n`);

    // [3] Comparison
    console.log('='.repeat(80));
    console.log(`COMPARISON for ${DIVISION}:`);
    console.log('='.repeat(80));
    console.log(`  PPH21 TER (JSON):     Rp ${jsonTotal.toLocaleString('id-ID')}`);
    console.log(`  PPH21 Amount (DB):    Rp ${dbTotal.toLocaleString('id-ID')}`);
    console.log(`  Difference:           Rp ${Math.abs(jsonTotal - dbTotal).toLocaleString('id-ID')}`);
    console.log(`  Match:                ${jsonTotal === dbTotal ? '✅ YES' : '❌ NO'}\n`);

    // [4] Find mismatches
    let matchCount = 0;
    let mismatchCount = 0;
    let notInDbCount = 0;

    const mismatches: Array<{
        emp_code: string;
        emp_name: string;
        pph21_ter: number;
        pph21_amount: number;
        difference: number;
    }> = [];

    for (const [code, jsonEmp] of jsonEmployees) {
        const dbAmount = dbAmounts.get(code);

        if (dbAmount === undefined) {
            notInDbCount++;
        } else if (dbAmount !== jsonEmp.pph21_ter) {
            mismatchCount++;
            mismatches.push({
                emp_code: code,
                emp_name: jsonEmp.emp_name,
                pph21_ter: jsonEmp.pph21_ter,
                pph21_amount: dbAmount,
                difference: jsonEmp.pph21_ter - dbAmount
            });
        } else {
            matchCount++;
        }
    }

    console.log(`  ✅ Match: ${matchCount} employees`);
    console.log(`  ❌ Mismatch: ${mismatchCount} employees`);
    console.log(`  ⚠️  Not in DB: ${notInDbCount} employees\n`);

    if (mismatches.length > 0) {
        console.log('='.repeat(80));
        console.log(`ALL ${mismatches.length} Mismatches:`);
        console.log('='.repeat(80));
        mismatches.forEach(m => {
            console.log(`  ${m.emp_code} - ${m.emp_name}`);
            console.log(`    TER: Rp ${m.pph21_ter.toLocaleString('id-ID')}, DB: Rp ${m.pph21_amount.toLocaleString('id-ID')}, Diff: Rp ${m.difference.toLocaleString('id-ID')}`);
        });

        // Check if DB has double records
        console.log('\nChecking for double records...\n');
        for (const m of mismatches) {
            const ratio = m.pph21_amount / m.pph21_ter;
            if (Math.abs(ratio - 2) < 0.01) {
                console.log(`  ⚠️  ${m.emp_code}: DB amount is EXACTLY 2x TER - likely double record!`);
            } else if (Math.abs(ratio - 1.5) < 0.01) {
                console.log(`  ⚠️  ${m.emp_code}: DB amount is 1.5x TER`);
            } else {
                console.log(`  ? ${m.emp_code}: DB/TER ratio = ${ratio.toFixed(3)}`);
            }
        }
    }

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
