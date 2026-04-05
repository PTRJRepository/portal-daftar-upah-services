import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const liveDb = Database.getInstance();
    const gangCode = "F1H";
    const headerId = 3832;
    
    console.log(`=== FINDING CORRECT F1H EMPLOYEES ===\n`);
    
    // Get actual F1H gang members from HR_GANGLN
    const actualMembers = await liveDb.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(e.EmpName) as emp_name
        FROM HR_GANGLN gl
        JOIN HR_GANG g ON gl.GangCode = g.GangCode
        JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        WHERE g.GangCode = ?
        ORDER BY gl.GangMember
    `, [gangCode]);
    
    console.log(`Actual F1H gang members: ${actualMembers.length}\n`);
    
    // Get detail records for these employees only
    const empCodes = actualMembers.map(m => `'${m.emp_code}'`).join(',');
    
    const matchingDetails = await extDb.query<any>(`
        SELECT d.emp_code, d.emp_name, d.upah_bersih, d.jumlah_upah_kotor, d.total_potongan
        FROM dbo.payroll_history_detail d
        WHERE d.master_id = ?
          AND d.emp_code IN (${empCodes})
        ORDER BY d.emp_code
    `, [headerId]);
    
    console.log(`Matching details found: ${matchingDetails.length}\n`);
    
    // Check for duplicates among actual members
    const dupCheck = await extDb.query<any>(`
        SELECT emp_code, COUNT(*) as cnt
        FROM dbo.payroll_history_detail
        WHERE master_id = ?
          AND emp_code IN (${empCodes})
        GROUP BY emp_code
        HAVING COUNT(*) > 1
    `, [headerId]);
    
    console.log(`Duplicates among actual members: ${dupCheck.length}\n`);
    
    // Get ONE record per employee (latest ID)
    const uniqueDetails = await extDb.query<any>(`
        WITH Ranked AS (
            SELECT d.*,
                   ROW_NUMBER() OVER (PARTITION BY d.emp_code ORDER BY d.id DESC) as rn
            FROM dbo.payroll_history_detail d
            WHERE d.master_id = ?
              AND d.emp_code IN (${empCodes})
        )
        SELECT emp_code, emp_name, upah_bersih, jumlah_upah_kotor, total_potongan
        FROM Ranked
        WHERE rn = 1
        ORDER BY emp_code
    `, [headerId]);
    
    console.log(`Unique employee details (actual F1H members, latest record):\n`);
    
    let sumKotor = 0;
    let sumPotongan = 0;
    let sumBersih = 0;
    
    for (const d of uniqueDetails) {
        console.log(`${d.emp_code} (${d.emp_name}):`);
        console.log(`  kotor=${(d.jumlah_upah_kotor || 0).toLocaleString('id-ID')} | potongan=${(d.total_potongan || 0).toLocaleString('id-ID')} | bersih=${(d.upah_bersih || 0).toLocaleString('id-ID')}`);
        
        sumKotor += d.jumlah_upah_kotor || 0;
        sumPotongan += d.total_potongan || 0;
        sumBersih += d.upah_bersih || 0;
    }
    
    console.log(`\n=== CORRECTED TOTALS (F1H actual members only) ===`);
    console.log(`Employees: ${uniqueDetails.length}`);
    console.log(`upah_kotor: ${sumKotor.toLocaleString('id-ID')}`);
    console.log(`potongan: ${sumPotongan.toLocaleString('id-ID')}`);
    console.log(`upah_bersih: ${sumBersih.toLocaleString('id-ID')}`);
    console.log(`verify (kotor - potongan): ${(sumKotor - sumPotongan).toLocaleString('id-ID')}`);
    
    console.log(`\n=== COMPARISON ===`);
    console.log(`Header says: 170.378.347,46`);
    console.log(`Correct (deduplicated actual members): ${sumBersih.toLocaleString('id-ID')}`);
    console.log(`User says should be: 169.000.000`);
}

main().catch(console.error);
