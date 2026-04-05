/**
 * Compare PPH21 TER (calculation) vs PPH21 Amount (database)
 * Find discrepancy in grand totals
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
    console.log('='.repeat(80));
    console.log('PPH21 TER vs PPH21 Amount Comparison');
    console.log('='.repeat(80));

    console.log('\n[1] Loading PPH21 TER from JSON files...');
    const updatePajakDir = path.resolve(process.cwd(), '../update_pajak');
    const files = fs.readdirSync(updatePajakDir).filter(f => f.endsWith('_pajak.json'));

    interface EmployeeTax {
        emp_code: string;
        emp_name: string;
        pph21_ter: number;
        divisi: string;
    }

    const jsonEmployees: EmployeeTax[] = [];
    let jsonGrandTotal = 0;

    for (const file of files) {
        const filePath = path.join(updatePajakDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (data.employees) {
            for (const [code, emp] of Object.entries(data.employees)) {
                const empData = emp as any;
                const pph21_ter = empData.pph21_ter || empData.pph21_amount || 0;
                jsonEmployees.push({
                    emp_code: code,
                    emp_name: empData.emp_name || '',
                    pph21_ter: pph21_ter,
                    divisi: data.divisi || file.replace('_pajak.json', '')
                });
                jsonGrandTotal += pph21_ter;
            }
        }
    }

    console.log(`✅ Loaded ${jsonEmployees.length} employees from JSON`);
    console.log(`📊 PPH21 TER Grand Total: Rp ${jsonGrandTotal.toLocaleString('id-ID')}\n`);

    // [2] Get PPH21 Amount from database
    console.log('[2] Fetching PPH21 Amount from database (PR_ADTRANSLN)...');

    console.log('\nConnecting to database...');
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected!\n');

    const whereClause = PPH21_PATTERNS.map((_, i) => `t.DocDesc LIKE @p${i}`).join(' OR ');
    const query = `
        SELECT 
            RTRIM(t.EmpCode) as emp_code,
            ln.Amount as pph21_amount
        FROM PR_ADTRANS t
        INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE (${whereClause})
    `;

    const request = pool.request();
    PPH21_PATTERNS.forEach((pattern, i) => {
        request.input(`p${i}`, sql.VarChar, pattern);
    });

    const dbResult = await request.query(query);
    console.log(`✅ Found ${dbResult.recordset.length} PPH21 records in database\n`);

    // Group by employee (some might have multiple records)
    const dbEmployeeMap = new Map<string, number>();
    let dbGrandTotal = 0;

    for (const row of dbResult.recordset) {
        const empCode = row.emp_code;
        const amount = row.pph21_amount || 0;
        dbEmployeeMap.set(empCode, (dbEmployeeMap.get(empCode) || 0) + amount);
        dbGrandTotal += amount;
    }

    console.log(`📊 PPH21 Amount Grand Total (from DB): Rp ${dbGrandTotal.toLocaleString('id-ID')}`);
    console.log(`   (from ${dbEmployeeMap.size} unique employees)\n`);

    // [3] Comparison
    console.log('='.repeat(80));
    console.log('COMPARISON:');
    console.log('='.repeat(80));
    console.log(`  PPH21 TER (JSON):       Rp ${jsonGrandTotal.toLocaleString('id-ID')}`);
    console.log(`  PPH21 Amount (DB):      Rp ${dbGrandTotal.toLocaleString('id-ID')}`);
    console.log(`  Difference:             Rp ${Math.abs(jsonGrandTotal - dbGrandTotal).toLocaleString('id-ID')}`);
    console.log(`  Match:                  ${jsonGrandTotal === dbGrandTotal ? '✅ YES' : '❌ NO'}\n`);

    // [4] Find discrepancies
    console.log('='.repeat(80));
    console.log('DISCREPANCY ANALYSIS:');
    console.log('='.repeat(80));

    let matchCount = 0;
    let mismatchCount = 0;
    let notInDbCount = 0;
    let notInJsonCount = 0;

    const mismatches: Array<{
        emp_code: string;
        emp_name: string;
        pph21_ter: number;
        pph21_amount: number;
        difference: number;
        divisi: string;
    }> = [];

    // Check JSON employees against DB
    for (const jsonEmp of jsonEmployees) {
        const dbAmount = dbEmployeeMap.get(jsonEmp.emp_code);

        if (dbAmount === undefined) {
            notInDbCount++;
            if (jsonEmp.pph21_ter > 0) {
                console.log(`  ⚠️  ${jsonEmp.emp_code} - ${jsonEmp.emp_name}: TER = Rp ${jsonEmp.pph21_ter.toLocaleString('id-ID')}, NOT IN DB`);
            }
        } else if (dbAmount !== jsonEmp.pph21_ter) {
            mismatchCount++;
            if (mismatches.length < 20) {
                mismatches.push({
                    emp_code: jsonEmp.emp_code,
                    emp_name: jsonEmp.emp_name,
                    pph21_ter: jsonEmp.pph21_ter,
                    pph21_amount: dbAmount,
                    difference: jsonEmp.pph21_ter - dbAmount,
                    divisi: jsonEmp.divisi
                });
            }
        } else {
            matchCount++;
        }
    }

    // Check DB employees not in JSON
    for (const [empCode, amount] of dbEmployeeMap) {
        if (!jsonEmployees.find(e => e.emp_code === empCode)) {
            notInJsonCount++;
            if (notInJsonCount <= 10) {
                console.log(`  ⚠️  ${empCode}: In DB (Rp ${amount.toLocaleString('id-ID')}), NOT IN JSON`);
            }
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY:');
    console.log(`  ✅ Match: ${matchCount} employees`);
    console.log(`  ❌ Mismatch: ${mismatchCount} employees`);
    console.log(`  ⚠️  Not in DB: ${notInDbCount} employees (from JSON)`);
    console.log(`  ⚠️  Not in JSON: ${notInJsonCount} employees (from DB)`);

    if (mismatches.length > 0) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Sample mismatches (first ${mismatches.length}):`);
        console.log('='.repeat(80));
        mismatches.forEach(m => {
            console.log(`  ${m.emp_code} - ${m.emp_name} (${m.divisi})`);
            console.log(`    TER: Rp ${m.pph21_ter.toLocaleString('id-ID')}, DB: Rp ${m.pph21_amount.toLocaleString('id-ID')}, Diff: Rp ${m.difference.toLocaleString('id-ID')}`);
        });
    }

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
