/**
 * Compare PPH21 TER vs PPH21 Amount for ALL divisions
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

const DIVISION_GANGS: Record<string, string[]> = {
    'PG1A': ['P1A', 'P1a', 'pg1a', 'PLASMA1A', 'Plasma 1A'],
    'PG1B': ['P1B', 'P1b', 'pg1b', 'PLASMA1B', 'Plasma 1B'],
    'PG2A': ['P2A', 'P2a', 'pg2a', 'PLASMA2A', 'Plasma 2A'],
    'PG2B': ['P2B', 'P2b', 'pg2b', 'PLASMA2B', 'Plasma 2B'],
    'PGE': ['PGE', 'pge'],
    'AB1': ['AB1', 'AB-1', 'ARB1', 'arb1', 'AFDELING1', 'AFD1', 'Air Ruak 1'],
    'AB2': ['AB2', 'AB-2', 'ARB2', 'arb2', 'AFDELING2', 'AFD2', 'Air Ruak 2'],
    'ARA': ['ARA', 'ara', 'Area'],
    'ARC': ['ARC', 'arc', 'AREC', 'arec', 'Air Ruak Central'],
    'DME': ['DME', 'dme', 'Dempo'],
    'IJL': ['IJL', 'ijl', 'Ijuk', 'L']
};

interface DivisionResult {
    division: string;
    jsonTotal: number;
    dbTotal: number;
    jsonCount: number;
    dbCount: number;
    difference: number;
    match: boolean;
    mismatches: Array<{emp_code: string; emp_name: string; ter: number; dbAmount: number}>;
}

async function main() {
    console.log('='.repeat(80));
    console.log('PPH21 TER vs PPH21 Amount - ALL DIVISIONS');
    console.log('='.repeat(80));

    const pool = await sql.connect(DB_CONFIG);
    const updatePajakDir = path.resolve(process.cwd(), '../update_pajak');
    const files = fs.readdirSync(updatePajakDir).filter(f => f.endsWith('_pajak.json'));

    const results: DivisionResult[] = [];

    for (const file of files) {
        const division = file.replace('_pajak.json', '');
        const filePath = path.join(updatePajakDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (!data.employees || Object.keys(data.employees).length === 0) continue;

        console.log(`\n[${division}] Checking...`);

        // Load JSON data
        const jsonEmployees = new Map<string, {emp_code: string; emp_name: string; pph21_ter: number}>();
        let jsonTotal = 0;

        for (const [code, emp] of Object.entries(data.employees)) {
            const empData = emp as any;
            const pph21 = empData.pph21_ter || empData.pph21_amount || 0;
            jsonEmployees.set(code, { emp_code: code, emp_name: empData.emp_name || '', pph21_ter: pph21 });
            jsonTotal += pph21;
        }

        // Fetch DB data
        const empCodes = Array.from(jsonEmployees.keys());
        const placeholders = empCodes.map((_, i) => `@emp${i}`).join(',');
        const whereClause = PPH21_PATTERNS.map((_, i) => `t.DocDesc LIKE @p${i}`).join(' OR ');

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

        // Compare
        const mismatches: DivisionResult['mismatches'] = [];
        let matchCount = 0;

        for (const [code, jsonEmp] of jsonEmployees) {
            const dbAmount = dbAmounts.get(code);
            if (dbAmount !== undefined && dbAmount !== jsonEmp.pph21_ter) {
                mismatches.push({
                    emp_code: code,
                    emp_name: jsonEmp.emp_name,
                    ter: jsonEmp.pph21_ter,
                    dbAmount: dbAmount
                });
            } else if (dbAmount === jsonEmp.pph21_ter) {
                matchCount++;
            }
        }

        results.push({
            division,
            jsonTotal,
            dbTotal,
            jsonCount: jsonEmployees.size,
            dbCount: dbAmounts.size,
            difference: Math.abs(jsonTotal - dbTotal),
            match: jsonTotal === dbTotal,
            mismatches
        });

        const status = jsonTotal === dbTotal ? '✅' : '❌';
        console.log(`  ${status} TER: Rp ${jsonTotal.toLocaleString('id-ID')}, DB: Rp ${dbTotal.toLocaleString('id-ID')}, Diff: Rp ${Math.abs(jsonTotal - dbTotal).toLocaleString('id-ID')}`);

        if (mismatches.length > 0) {
            console.log(`  ❌ ${mismatches.length} mismatches!`);
        }
    }

    // Summary table
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY TABLE');
    console.log('='.repeat(80));
    console.log(`  ${'Division'.padEnd(10)} | ${'TER'.padStart(14)} | ${'DB Amount'.padStart(14)} | ${'Difference'.padStart(12)} | Status`);
    console.log('  ' + '-'.repeat(10) + '-' + '-' + '-'.repeat(14) + '-' + '-' + '-'.repeat(14) + '-' + '-' + '-'.repeat(12) + '-' + '-' + '-'.repeat(6));

    let grandTerTotal = 0;
    let grandDbTotal = 0;

    for (const r of results) {
        const status = r.match ? '✅ Match' : `❌ ${r.mismatches.length} diff`;
        console.log(`  ${r.division.padEnd(10)} | ${('Rp ' + r.jsonTotal.toLocaleString('id-ID')).padStart(14)} | ${('Rp ' + r.dbTotal.toLocaleString('id-ID')).padStart(14)} | ${('Rp ' + r.difference.toLocaleString('id-ID')).padStart(12)} | ${status}`);
        grandTerTotal += r.jsonTotal;
        grandDbTotal += r.dbTotal;
    }

    console.log('  ' + '-'.repeat(10) + '-' + '-' + '-'.repeat(14) + '-' + '-' + '-'.repeat(14) + '-' + '-' + '-'.repeat(12) + '-' + '-' + '-'.repeat(6));
    const grandStatus = grandTerTotal === grandDbTotal ? '✅ Match' : `❌ Rp ${Math.abs(grandTerTotal - grandDbTotal).toLocaleString('id-ID')}`;
    console.log(`  ${'TOTAL'.padEnd(10)} | ${('Rp ' + grandTerTotal.toLocaleString('id-ID')).padStart(14)} | ${('Rp ' + grandDbTotal.toLocaleString('id-ID')).padStart(14)} | ${('Rp ' + Math.abs(grandTerTotal - grandDbTotal).toLocaleString('id-ID')).padStart(12)} | ${grandStatus}`);

    // Show detailed mismatches
    const allMismatches = results.filter(r => r.mismatches.length > 0);
    if (allMismatches.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('ALL MISMATCHES');
        console.log('='.repeat(80));

        for (const r of allMismatches) {
            console.log(`\n[Division ${r.division}] - ${r.mismatches.length} mismatches:`);
            for (const m of r.mismatches) {
                console.log(`  ${m.emp_code} - ${m.emp_name}: TER = Rp ${m.ter.toLocaleString('id-ID')}, DB = Rp ${m.dbAmount.toLocaleString('id-ID')}, Diff = Rp ${(m.ter - m.dbAmount).toLocaleString('id-ID')}`);
            }
        }
    }

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
