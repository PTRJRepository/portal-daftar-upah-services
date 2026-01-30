
import { Database } from "./src/db/client";
import { write } from "bun";

async function main() {
    try {
        const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

        // 1. Check if PR_AD has ANY records starting with AL
        console.log("Checking PR_AD for AL%...");
        const result = await db.query(`SELECT TOP 10 ADCode, Description FROM PR_AD WHERE ADCode LIKE 'AL%'`);
        await write("backend/pr_ad_al_check.json", JSON.stringify(result, null, 2));

        // 2. Check PR_ADTRANS if not found in PR_AD (maybe it's a transaction code?)
        console.log("Checking PR_ADTRANS for AL%...");
        const resultTrans = await db.query(`SELECT TOP 10 ADCode, Amount FROM PR_ADTRANS WHERE ADCode LIKE 'AL%'`);
        await write("backend/pr_adtrans_al_check.json", JSON.stringify(resultTrans, null, 2));

        // 3. Check PR_TASKCODE just in case
        console.log("Checking PR_TASKCODE for AL%...");
        const resultTask = await db.query(`SELECT TOP 10 TaskCode, Description FROM PR_TASKCODE WHERE TaskCode LIKE 'AL%'`);
        await write("backend/pr_taskcode_al_check.json", JSON.stringify(resultTask, null, 2));

    } catch (error: any) {
        const errorMsg = `Error: ${error.message}\nStack: ${error.stack}`;
        console.error(errorMsg);
        await write("backend/debug_error.log", errorMsg);
    }
}

main();
