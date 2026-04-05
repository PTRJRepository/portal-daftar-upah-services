/**
 * INSERT PPH21 records for employees that don't have them yet
 * 
 * This script:
 * 1. Finds employees in JSON without PPH21 records in database
 * 2. INSERT new records into PR_ADTRANS + PR_ADTRANSLN
 * 3. Generates proper DocID, DocDate, etc.
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

// Period info
const PHY_MONTH = 3;
const PHY_YEAR = 2026;
const ACC_MONTH = '12';  // AccMonth 12 = Calendar Month 3
const ACC_YEAR = '2026';
const DOC_DATE = '2026-03-31';
const DOC_DESC = 'POTONGAN PPH21';
const TASK_CODE = 'DEPH21';

// Division code mapping
const DIVISION_MAP: Record<string, string> = {
    'PG1A': 'P1A',
    'PG1B': 'P1B', 
    'PG2A': 'P2A',
    'PG2B': 'P2B',
    'AB1': 'ARB1',
    'AB2': 'ARB2',
    'ARA': 'ARA',
    'ARC': 'AREC',
    'DME': 'DME',
    'IJL': 'IJL',
    'PGE': 'PGE'
};

interface EmployeeData {
    emp_code: string;
    emp_name: string;
    nik: string;
    pph21_ter: number;
    divisi: string;
    gang_code?: string;
}

async function main() {
    console.log('='.repeat(80));
    console.log('INSERT PPH21 Records for Missing Employees');
    console.log('='.repeat(80));

    console.log('\nConnecting to database...');
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected!\n');

    // Load all JSON files
    const updatePajakDir = path.resolve(process.cwd(), '../update_pajak');
    const files = fs.readdirSync(updatePajakDir).filter(f => f.endsWith('_pajak.json'));

    const allEmployees: EmployeeData[] = [];

    for (const file of files) {
        const filePath = path.join(updatePajakDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (data.employees) {
            for (const [code, emp] of Object.entries(data.employees)) {
                const empData = emp as any;
                const pph21 = empData.pph21_ter || empData.pph21_amount || 0;
                
                // Include ALL employees (even with PPh21 = 0)
                allEmployees.push({
                    emp_code: code,
                    emp_name: empData.emp_name || '',
                    nik: empData.nik || '',
                    pph21_ter: pph21,
                    divisi: data.divisi || file.replace('_pajak.json', ''),
                    gang_code: empData.gang_code || ''
                });
            }
        }
    }

    console.log(`Loaded ${allEmployees.length} employees with PPh21 > 0 from JSON files\n`);

    // Find which employees DON'T have PPH21 records
    console.log('Finding employees without PPH21 records...\n');
    const missingEmployees: EmployeeData[] = [];

    for (const emp of allEmployees) {
        const whereClause = PPH21_PATTERNS.map((_, i) => `t.DocDesc LIKE @p${i}`).join(' OR ');
        const query = `
            SELECT COUNT(*) as cnt
            FROM PR_ADTRANS t
            WHERE RTRIM(t.EmpCode) = @empCode
            AND (${whereClause})
        `;

        const request = pool.request();
        request.input('empCode', sql.VarChar, emp.emp_code);
        PPH21_PATTERNS.forEach((pattern, i) => {
            request.input(`p${i}`, sql.VarChar, pattern);
        });

        const result = await request.query(query);
        const count = result.recordset[0].cnt;

        if (count === 0) {
            missingEmployees.push(emp);
        }
    }

    console.log(`Found ${missingEmployees.length} employees missing PPH21 records\n`);

    if (missingEmployees.length === 0) {
        console.log('All employees have PPH21 records! Nothing to insert.');
        await pool.close();
        return;
    }

    // Get the next DocID sequence for each division
    console.log('Getting next DocID sequence...\n');
    const docIdSequences = new Map<string, number>();

    for (const emp of missingEmployees) {
        const locCode = DIVISION_MAP[emp.divisi] || emp.divisi;
        const prefix = `AD${locCode}${PHY_YEAR.toString().slice(2)}${PHY_MONTH.toString().padStart(2, '0')}`;
        
        if (!docIdSequences.has(prefix)) {
            const result = await pool.request()
                .input('prefix', sql.VarChar, `${prefix}%`)
                .query(`
                    SELECT TOP 1 DocID
                    FROM PR_ADTRANS
                    WHERE DocID LIKE @prefix
                    ORDER BY DocID DESC
                `);

            if (result.recordset.length > 0) {
                const lastDocId = result.recordset[0].DocID;
                const seq = parseInt(lastDocId.slice(-4), 10) + 1;
                docIdSequences.set(prefix, seq);
            } else {
                docIdSequences.set(prefix, 1);
            }
        }
    }

    // INSERT records
    console.log('='.repeat(80));
    console.log('INSERTING PPH21 Records...');
    console.log('='.repeat(80));

    let insertedCount = 0;
    let errorCount = 0;

    for (const emp of missingEmployees) {
        try {
            const locCode = DIVISION_MAP[emp.divisi] || emp.divisi;
            const prefix = `AD${locCode}${PHY_YEAR.toString().slice(2)}${PHY_MONTH.toString().padStart(2, '0')}`;
            const seqNum = docIdSequences.get(prefix)!;
            const docId = `${prefix}${seqNum.toString().padStart(4, '0')}`;
            docIdSequences.set(prefix, seqNum + 1);

            console.log(`\n[${emp.divisi}] ${emp.emp_code} - ${emp.emp_name}`);
            console.log(`  PPh21 Amount: Rp ${emp.pph21_ter.toLocaleString('id-ID')}`);
            console.log(`  DocID: ${docId}`);

            // INSERT into PR_ADTRANS
            const insertHeaderQuery = `
                INSERT INTO PR_ADTRANS (
                    DocID, DocDate, DocDesc, EmpCode, EmpName,
                    LocCode, AccMonth, AccYear, PhyMonth, PhyYear,
                    Status, CreatedBy, CreatedDate, UpdatedBy, UpdatedDate,
                    ImpFlag, TransType
                ) VALUES (
                    @docId, @docDate, @docDesc, @empCode, @empName,
                    @locCode, @accMonth, @accYear, @phyMonth, @phyYear,
                    3, 'TAX_MAPPING_SCRIPT', GETDATE(), 'TAX_MAPPING_SCRIPT', GETDATE(),
                    0, '1'
                );
                SELECT SCOPE_IDENTITY() as newId;
            `;

            const headerRequest = pool.request();
            headerRequest.input('docId', sql.VarChar, docId);
            headerRequest.input('docDate', sql.DateTime, new Date(DOC_DATE));
            headerRequest.input('docDesc', sql.VarChar, DOC_DESC);
            headerRequest.input('empCode', sql.VarChar, emp.emp_code);
            headerRequest.input('empName', sql.VarChar, emp.emp_name);
            headerRequest.input('locCode', sql.VarChar, locCode);
            headerRequest.input('accMonth', sql.VarChar, ACC_MONTH);
            headerRequest.input('accYear', sql.VarChar, ACC_YEAR);
            headerRequest.input('phyMonth', sql.VarChar, PHY_MONTH.toString());
            headerRequest.input('phyYear', sql.VarChar, PHY_YEAR.toString());

            const headerResult = await headerRequest.query(insertHeaderQuery);
            const newId = headerResult.recordset[0].newId;

            // INSERT into PR_ADTRANSLN
            const insertDetailQuery = `
                INSERT INTO PR_ADTRANSLN (
                    MasterID, ChargeTo, TaskCode, TaskType, TaskRtnVal,
                    Amount, Status, CreatedBy, CreatedDate, UpdatedBy, UpdatedDate, ImpFlag
                ) VALUES (
                    @masterId, '', @taskCode, '', 0,
                    @amount, 3, 'TAX_MAPPING_SCRIPT', GETDATE(), 'TAX_MAPPING_SCRIPT', GETDATE(), 0
                );
            `;

            const detailRequest = pool.request();
            detailRequest.input('masterId', sql.BigInt, newId);
            detailRequest.input('taskCode', sql.VarChar, TASK_CODE);
            detailRequest.input('amount', sql.Decimal(18, 2), emp.pph21_ter);

            await detailRequest.query(insertDetailQuery);

            console.log(`  ✅ INSERTED successfully (ID: ${newId})`);
            insertedCount++;

        } catch (error) {
            console.error(`  ❌ FAILED: ${emp.emp_code} - ${error}`);
            errorCount++;
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('INSERT Summary:');
    console.log('='.repeat(80));
    console.log(`  Total missing: ${missingEmployees.length}`);
    console.log(`  ✅ Inserted: ${insertedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
