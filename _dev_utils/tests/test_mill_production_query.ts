import { Database } from "../../backend/src/db/client";

async function testQuery() {
    console.log("Testing connection to Mill Database (Server 3)...");

    const month = 1;
    const year = 2026;

    const sql = `
        SELECT [WM_TICKET].[CustomerCode],
            min(S.[Name]) AS [SupplierName],
            SUM([WM_TICKET].[NetWeight]) / 1000.0 AS [TotalNetWeight_Ton],
            COUNT([WM_TICKET].[TicketNo]) AS [TotalTickets]
        FROM [db_ptrj_mill].[dbo].[WM_TICKET]
            LEFT JOIN [db_ptrj_mill].[dbo].[PU_SUPPLIER] AS S ON [WM_TICKET].[CustomerCode] = S.[SupplierCode]
        WHERE [WM_TICKET].[CustomerCode] LIKE 'PTRJ%'
            AND MONTH([WM_TICKET].[DateReceived]) = ?
            AND YEAR([WM_TICKET].[DateReceived]) = ?
            AND [WM_TICKET].ProductCode = 'FFB'
        GROUP BY [WM_TICKET].[CustomerCode]
        ORDER BY [TotalNetWeight_Ton] DESC;
    `;

    try {
        const db = Database.getMillInstance();
        console.log(`Executing query for ${month}/${year}...`);

        const params = [month, year];
        const results = await db.query(sql, params);

        console.log(`\nResults (${results.length} rows fallback):`);
        console.table(results);

        console.log("Query test successful!");
    } catch (error) {
        console.error("Test failed:", error);
    }
}

testQuery();
