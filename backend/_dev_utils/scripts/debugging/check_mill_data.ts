/**
 * Debugging script to check MILL data in VenusHR14
 * Run: cd backend && bun run _dev_utils/scripts/debugging/check_mill_data.ts
 */
const DB_API_URL = "http://10.0.0.110:8001";
const DB_API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6";

async function query(server: string, database: string, sql: string, params: any = []) {
    try {
        const response = await fetch(`${DB_API_URL}/v1/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": DB_API_KEY
            },
            body: JSON.stringify({ sql, params, server, database }),
        });
        return response.json();
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

async function checkMillData() {
    const month = 3;
    const year = 2026;
    const monthStr = month.toString().padStart(2, '0');
    const pyNumberPattern = `PYW/PTRJ/${year}${monthStr}%`;

    console.log(`\n=== MILL DATA DEBUG (Maret 2026) ===`);
    console.log(`PYNumber Pattern: ${pyNumberPattern}`);
    console.log(`Database: VenusHR14 (SERVER_PROFILE_3)\n`);

    // 0. First check if VenusHR14 is accessible
    console.log('--- 0. Check VenusHR14 connection ---');
    const tablesQuery = `SELECT name FROM sys.tables ORDER BY name`;
    const tablesResult = await query("SERVER_PROFILE_3", "VenusHR14", tablesQuery);
    if (tablesResult.success !== false && tablesResult.data) {
        console.log(`✅ VenusHR14 connected! ${tablesResult.data.length} tables found`);
        const tableNames = tablesResult.data.map((r: any) => r.name).filter((n: string) => n.includes('HR_T_PY') || n.includes('Weekly'));
        console.log('Related tables:', tableNames.join(", "));
    } else {
        console.log('❌ VenusHR14 ERROR:', tablesResult);
    }

    // 1. Check what PYNumbers exist - embed pattern directly
    console.log('\n--- 1. PYNumber samples ---');
    const sampleQuery = `
        SELECT TOP 10 [PYNumber], [EmployeeID], [TAAbsence], [UnpaidLeave], [TASick]
        FROM [dbo].[HR_T_PYWeekly_M]
        WHERE [PYNumber] LIKE '${pyNumberPattern}'
        ORDER BY [PYNumber] DESC
    `;
    const samples = await query("SERVER_PROFILE_3", "VenusHR14", sampleQuery);
    if (samples.success !== false && samples.data) {
        console.log(`Found ${samples.data.length} PYNumbers matching pattern`);
        samples.data.forEach((r: any) => console.log(`  ${r.PYNumber} | EmployeeID: ${r.EmployeeID} | TAAbsence: ${r.TAAbsence} | UnpaidLeave: ${r.UnpaidLeave} | TASick: ${r.TASick}`));
    } else {
        console.log('ERROR:', samples);
    }

    // 2. Check Total HK and Employees
    console.log('\n--- 2. HK and Employees ---');
    const hkQuery = `
        SELECT
            COUNT([EmployeeID]) AS total_employees,
            SUM(ISNULL([TAAbsence], 0)) AS Total_Mangkir,
            SUM(ISNULL([UnpaidLeave], 0)) AS Total_Unpaid_Leave,
            SUM(ISNULL([TASick], 0)) AS Total_Sakit_With_Note,
            DAY(EOMONTH(CAST(SUBSTRING(MAX([PYNumber]), 10, 6) + '01' AS DATE))) AS DaysInMonth
        FROM [dbo].[HR_T_PYWeekly_M]
        WHERE [PYNumber] LIKE '${pyNumberPattern}'
    `;
    const hkResult = await query("SERVER_PROFILE_3", "VenusHR14", hkQuery);
    if (hkResult.success !== false && hkResult.data) {
        console.log('HK Result:', hkResult.data[0]);
        const r = hkResult.data[0];
        if (r) {
            const totalHK = (r.total_employees * r.DaysInMonth) -
                            (r.Total_Mangkir + r.Total_Unpaid_Leave + r.Total_Sakit_With_Note);
            console.log(`Calculated Total HK: ${totalHK}`);
            console.log(`Total Employees: ${r.total_employees}`);
        }
    } else {
        console.log('ERROR:', hkResult);
    }

    // 3. Check Components in HR_T_PYWeekly_DComponent
    console.log('\n--- 3. DComponent samples ---');
    const compQuery = `
        SELECT TOP 20 [PYNumber], [PYCompCode], [CompAmount], [IsTakeHomePay]
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE '${pyNumberPattern}'
        ORDER BY [PYNumber], [PYCompCode]
    `;
    const comps = await query("SERVER_PROFILE_3", "VenusHR14", compQuery);
    if (comps.success !== false && comps.data) {
        console.log(`Found ${comps.data.length} component records`);
        comps.data.forEach((r: any) => console.log(`  ${r.PYNumber} | ${r.PYCompCode} | ${r.CompAmount} | IsTHP: ${r.IsTakeHomePay}`));
    } else {
        console.log('ERROR:', comps);
    }

    // 4. Check Salary (Take Home Pay)
    console.log('\n--- 4. Salary (IsTakeHomePay = 1) ---');
    const salaryQuery = `
        SELECT CAST(SUM([CompAmount]) AS BIGINT) AS TotalCompAmount
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE '${pyNumberPattern}'
          AND [IsTakeHomePay] = 1
    `;
    const salaryResult = await query("SERVER_PROFILE_3", "VenusHR14", salaryQuery);
    if (salaryResult.success !== false && salaryResult.data) {
        console.log('Salary Result:', salaryResult.data[0]);
    } else {
        console.log('ERROR:', salaryResult);
    }

    // 5. Check PPh21
    console.log('\n--- 5. PPh21 ---');
    const pphQuery = `
        SELECT [PYCompCode], SUM([CompAmount]) AS totalCount
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE '${pyNumberPattern}'
          AND [PYCompCode] LIKE '%#PPH21%'
        GROUP BY [PYCompCode]
    `;
    const pphResult = await query("SERVER_PROFILE_3", "VenusHR14", pphQuery);
    if (pphResult.success !== false && pphResult.data) {
        console.log('PPh21 Result:', pphResult.data);
    } else {
        console.log('ERROR:', pphResult);
    }

    // 6. Check SPSI
    console.log('\n--- 6. SPSI ---');
    const spsiQuery = `
        SELECT [PYCompCode], SUM([CompAmount]) AS totalCount
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE '${pyNumberPattern}'
          AND [PYCompCode] LIKE '%#POT_spsi%'
        GROUP BY [PYCompCode]
    `;
    const spsiResult = await query("SERVER_PROFILE_3", "VenusHR14", spsiQuery);
    if (spsiResult.success !== false && spsiResult.data) {
        console.log('SPSI Result:', spsiResult.data);
    } else {
        console.log('ERROR:', spsiResult);
    }

    // 7. Check OT
    console.log('\n--- 7. Overtime (OT) ---');
    const otQuery = `
        SELECT [PYCompCode], SUM([CompAmount]) AS totalCount
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE '${pyNumberPattern}'
          AND [PYCompCode] LIKE '%#OT%'
        GROUP BY [PYCompCode]
    `;
    const otResult = await query("SERVER_PROFILE_3", "VenusHR14", otQuery);
    if (otResult.success !== false && otResult.data) {
        console.log('OT Result:', otResult.data);
    } else {
        console.log('ERROR:', otResult);
    }

    console.log('\n=== END DEBUG ===\n');
}

checkMillData().catch(console.error);
