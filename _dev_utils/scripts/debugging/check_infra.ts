import { Database } from "../src/db/client";
import { DivisionDefinition } from "../src/services/divisionDefinition";

async function checkInfra() {
    const divDef = DivisionDefinition.getInstance();
    const infraGangs = await divDef.getGangsForDivision("INF");
    console.log("Infra Gangs:", infraGangs.map(g => g.gang_code));

    const db = Database.getInstance(undefined, "SERVER_PROFILE_2");
    const placeholders = infraGangs.map(() => "?").join(",");
    const rows = await db.query(`
        SELECT TOP 10 GangCode, EmpCode, UpahDasar
        FROM dbo.HR_PAYROLL
        WHERE GangCode IN (${placeholders})
    `, infraGangs.map(g => g.gang_code));

    console.log("Sample HR_PAYROLL for Infra:", rows);
}

checkInfra().catch(console.error);
