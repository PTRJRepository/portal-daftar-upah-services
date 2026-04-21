/**
 * Find employees in JSON that don't have PPH21 records in database
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
    console.log('Finding employees without PPH21 records...');
    console.log('='.repeat(80));

    console.log('\nConnecting to database...');
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected!\n');

    // Load all JSON files
    const updatePajakDir = path.resolve(process.cwd(), '../update_pajak');
    const files = fs.readdirSync(updatePajakDir).filter(f => f.endsWith('_pajak.json'));

    interface EmployeeData {
        emp_code: string;
        emp_name: string;
        pph21_ter: number;
        divisi: string;
    }

    const allEmployees: EmployeeData[] = [];

    for (const file of files) {
        const filePath = path.join(updatePajakDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (data.employees) {
            for (const [code, emp] of Object.entries(data.employees)) {
                const empData = emp as any;
                allEmployees.push({
                    emp_code: code,
                    emp_name: empData.emp_name || '',
                    pph21_ter: empData.pph21_ter || empData.pph21_amount || 0,
                    divisi: data.divisi || file.replace('_pajak.json', '')
                });
            }
        }
    }

    console.log(`Loaded ${allEmployees.length} employees from JSON files\n`);

    // Check each employee
    const notFoundEmployees: EmployeeData[] = [];
    let checked = 0;

    for (const emp of allEmployees) {
        checked++;
        if (checked % 100 === 0) {
            console.log(`Checking... ${checked}/${allEmployees.length}`);
        }

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
            notFoundEmployees.push(emp);
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('Results:');
    console.log(`  Total employees: ${allEmployees.length}`);
    console.log(`  Have PPH21 records: ${allEmployees.length - notFoundEmployees.length}`);
    console.log(`  Missing PPH21 records: ${notFoundEmployees.length}`);

    if (notFoundEmployees.length > 0) {
        console.log(`\n${'='.repeat(80)}`);
        console.log('Employees WITHOUT PPH21 records:');
        console.log('='.repeat(80));

        // Group by division
        const byDivision = new Map<string, EmployeeData[]>();
        for (const emp of notFoundEmployees) {
            if (!byDivision.has(emp.divisi)) {
                byDivision.set(emp.divisi, []);
            }
            byDivision.get(emp.divisi)!.push(emp);
        }

        for (const [div, emps] of byDivision) {
            console.log(`\n[Division ${div}] (${emps.length} employees):`);
            emps.slice(0, 20).forEach(emp => {
                console.log(`  ${emp.emp_code} - ${emp.emp_name} (PPH21: Rp ${emp.pph21_ter.toLocaleString('id-ID')})`);
            });
            if (emps.length > 20) {
                console.log(`  ... and ${emps.length - 20} more`);
            }
        }
    }

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
