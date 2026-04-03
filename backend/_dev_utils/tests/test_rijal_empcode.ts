import { Database } from '../../src/db/client';

async function testRijalEmpcode() {
    try {
        const db = Database.getInstance();
        const nik = '1902012706890008';
        
        console.log(`Checking data for NIK: ${nik}`);

        const hr_gang = await db.query('SELECT EmpCode, Nik, Nama, Status FROM HR_GANG WHERE Nik = ?', [nik]);
        console.log('\n--- HR_GANG ---');
        console.dir(hr_gang, { depth: null });

        const hr_gang_lv = await db.query('SELECT EmpCode, NIK, Name, IsActive FROM HR_GANG_LV WHERE NIK = ?', [nik]);
        console.log('\n--- HR_GANG_LV ---');
        console.dir(hr_gang_lv, { depth: null });

        const hr_gangln = await db.query('SELECT TOP 5 Month, Year, EmpCode, Nik, Nama, Golongan FROM HR_GANGLN WHERE Nik = ? ORDER BY Year DESC, Month DESC', [nik]);
        console.log('\n--- HR_GANGLN ---');
        console.dir(hr_gangln, { depth: null });

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

testRijalEmpcode();
