
import { Database } from "../src/db/client";
import { Config } from "../src/config";

// Force load env
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function checkData() {
    const db = Database.getInstance();
    const empCode = 'C0595';
    const month = 2; // Based on logs
    const year = 2025; // Based on logs (Selected 2/2025)

    const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
    const endDate = `${year}-${month.toString().padStart(2, "0")}-28`;

    console.log(`Checking data for ${empCode} from ${startDate} to ${endDate}`);

    try {
        const rows = await db.query(`
            SELECT 
                TrxDate, TaskCode, Hours, Amount, Rate
            FROM PR_TASKREGLN
            WHERE RTRIM(EmpCode) = '${empCode}'
              AND TrxDate >= '${startDate}'
              AND TrxDate <= '${endDate}'
              AND OT = 0
            ORDER BY TrxDate
        `);

        console.table(rows);
    } catch (e) {
        console.error(e);
    }
}

checkData();
