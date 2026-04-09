import { divisionDefinition } from "./divisionDefinition";
import { Database } from "../db/client";

async function run() {
    console.log("Testing WKS_PG gangs fetch...");
    try {
        const gangs = await divisionDefinition.getGangsForDivision("WKS_PG", false);
        console.log("Virtual WKS_PG gangs:", JSON.stringify(gangs, null, 2));

        const sourceGangs = await divisionDefinition.getSourceDivisionsForAggregation("WKS_PG");
        console.log("Source WKS_PG source divisions:", sourceGangs);
    } catch (e) {
        console.error(e);
    }
}
run();
