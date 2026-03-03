import { divisionDefinition } from "./divisionDefinition";
import { Database } from "../db/client";

async function run() {
    console.log("Testing WKS_AR gangs fetch...");
    try {
        const gangs = await divisionDefinition.getGangsForDivision("WKS_AR", false);
        console.log("Virtual WKS_AR gangs:", gangs);

        const sourceGangs = await divisionDefinition.getSourceDivisionsForAggregation("WKS_AR");
        console.log("Source WKS_AR gangs locCode:", sourceGangs);
    } catch (e) {
        console.error(e);
    }
}
run();
