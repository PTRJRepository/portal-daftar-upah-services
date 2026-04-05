/**
 * Debug script - Check specific employee PPH21 records
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

async function main() {
    const empCode = 'J0806';

    console.log('='.repeat(80));
    console.log(`Checking employee: ${empCode}`);
    console.log('='.repeat(80));

    console.log('\nConnecting to database...');
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected!\n');

    // 1. Check if employee exists in HR_EMPLOYEE
    console.log('[1] Checking HR_EMPLOYEE...');
    const empResult = await pool.request()
        .input('empCode', sql.VarChar, empCode)
        .query(`
            SELECT EmpCode, EmpName, NewICNo
            FROM HR_EMPLOYEE
            WHERE RTRIM(EmpCode) = @empCode
        `);

    if (empResult.recordset.length === 0) {
        console.log(`❌ Employee ${empCode} NOT FOUND in HR_EMPLOYEE`);
        await pool.close();
        return;
    }

    const emp = empResult.recordset[0];
    console.log(`✓ Found: ${emp.EmpName} (${emp.EmpCode})`);
    console.log(`  NIK: ${emp.NewICNo}\n`);

    // 2. Check ALL ADTRANS records for this employee
    console.log('[2] Checking ALL PR_ADTRANS records...');
    const allTransResult = await pool.request()
        .input('empCode', sql.VarChar, empCode)
        .query(`
            SELECT TOP 20
                t.ID,
                t.DocID,
                t.DocDate,
                t.DocDesc,
                t.EmpCode,
                t.AccMonth,
                t.AccYear,
                t.PhyMonth,
                t.PhyYear
            FROM PR_ADTRANS t
            WHERE RTRIM(t.EmpCode) = @empCode
            ORDER BY t.DocDate DESC
        `);

    console.log(`Found ${allTransResult.recordset.length} total ADTRANS records\n`);

    if (allTransResult.recordset.length > 0) {
        // Check which ones have PPH-related DocDesc
        const pphRecords = allTransResult.recordset.filter(r =>
            r.DocDesc.toUpperCase().includes('PPH') ||
            r.DocDesc.toUpperCase().includes('PPh') ||
            r.DocDesc.toUpperCase().includes('Pajak')
        );

        console.log(`PPH-related records: ${pphRecords.length}\n`);

        if (pphRecords.length > 0) {
            console.log('PPH Records found:');
            pphRecords.forEach(r => {
                console.log(`  - DocDesc: "${r.DocDesc}"`);
                console.log(`    DocID: ${r.DocID}, Date: ${r.DocDate}`);
                console.log(`    PhyMonth: ${r.PhyMonth}, PhyYear: ${r.PhyYear}\n`);
            });
        } else {
            console.log('❌ NO PPH-related records found!\n');
            console.log('Sample DocDesc values:');
            allTransResult.recordset.slice(0, 5).forEach(r => {
                console.log(`  - "${r.DocDesc}"`);
            });
        }
    }

    // 3. Check with JOIN to PR_ADTRANSLN and PPH patterns
    console.log('\n[3] Checking PR_ADTRANS + PR_ADTRANSLN with PPH patterns...');

    const pphPatterns = [
        '%Potongan Pph21%',
        '%Potongan PPH 21%',
        '%PPH 21%',
        '%PPH21%',
        '%POTONGAN PPH%',
        '%PPh 21%',
        '%PPh21%',
        '%PAJAK%',
        '%Pajak%',
        '%pph%',
        '%PPH%'
    ];

    const whereClause = pphPatterns.map((_, i) => `t.DocDesc LIKE @p${i}`).join(' OR ');

    const query = `
        SELECT 
            t.ID,
            t.DocID,
            t.DocDate,
            t.DocDesc,
            t.EmpCode,
            t.PhyMonth,
            t.PhyYear,
            ln.Amount
        FROM PR_ADTRANS t
        LEFT JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE RTRIM(t.EmpCode) = @empCode
        AND (${whereClause})
        ORDER BY t.DocDate DESC
    `;

    const request = pool.request();
    request.input('empCode', sql.VarChar, empCode);
    pphPatterns.forEach((pattern, i) => {
        request.input(`p${i}`, sql.VarChar, pattern);
    });

    const pphResult = await request.query(query);

    console.log(`Found ${pphResult.recordset.length} PPH records with patterns\n`);

    if (pphResult.recordset.length > 0) {
        pphResult.recordset.forEach(r => {
            console.log(`  DocDesc: "${r.DocDesc}"`);
            console.log(`    Amount: Rp ${r.Amount?.toLocaleString('id-ID') || 'NULL'}`);
            console.log(`    PhyMonth: ${r.PhyMonth}, PhyYear: ${r.PhyYear}\n`);
        });
    } else {
        console.log('❌ NO PPH records found with any pattern!');
        console.log('\nThis means:');
        console.log('  1. Employee has no PPH21 transaction yet, OR');
        console.log('  2. DocDesc uses different naming convention');
    }

    // 4. Check current period
    console.log('\n[4] Checking current period...');
    const periodResult = await pool.request().query(`
        SELECT TOP 10
            TrxDate,
            MONTH(TrxDate) as Month,
            YEAR(TrxDate) as Year
        FROM PR_TASKREGLN
        ORDER BY TrxDate DESC
    `);

    if (periodResult.recordset.length > 0) {
        console.log('Latest periods:');
        periodResult.recordset.forEach(r => {
            console.log(`  - ${r.TrxDate} (Month: ${r.Month}, Year: ${r.Year})`);
        });
    }

    // 5. Check JSON file for this employee's expected PPh21
    console.log('\n[5] Checking tax mapping JSON...');

    const updatePajakDir = path.resolve(process.cwd(), '../update_pajak');
    const files = fs.readdirSync(updatePajakDir).filter(f => f.endsWith('_pajak.json'));

    let foundInJson = false;
    for (const file of files) {
        const filePath = path.join(updatePajakDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (data.employees && data.employees[empCode]) {
            const empData = data.employees[empCode];
            console.log(`✓ Found in ${file}:`);
            console.log(`  emp_name: ${empData.emp_name}`);
            console.log(`  pph21_ter: Rp ${empData.pph21_ter?.toLocaleString('id-ID') || empData.pph21_amount?.toLocaleString('id-ID') || 'N/A'}`);
            console.log(`  gross_income: Rp ${empData.penghasilan_bruto?.toLocaleString('id-ID') || 'N/A'}`);
            console.log(`  ptkp_status: ${empData.status_ptkp || 'N/A'}`);
            foundInJson = true;
            break;
        }
    }

    if (!foundInJson) {
        console.log(`❌ Employee ${empCode} NOT FOUND in any JSON file`);
    }

    await pool.close();
    console.log('\n' + '='.repeat(80));
    console.log('Done!');
    console.log('='.repeat(80));
}

main().catch(console.error);
