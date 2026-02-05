
import { divisionDefinition } from "../services/divisionDefinition";

async function main() {
    console.log("Checking source divisions for WKS_PG...");
    const sourcesPG = await divisionDefinition.getSourceDivisionsForAggregation("WKS_PG");
    console.log("WKS_PG sources:", sourcesPG);

    console.log("Checking source divisions for WKS_AR...");
    const sourcesAR = await divisionDefinition.getSourceDivisionsForAggregation("WKS_AR");
    console.log("WKS_AR sources:", sourcesAR);

    // Check gang codes for WKS_PG
    const gangsPG = await divisionDefinition.getGangsForDivision("WKS_PG");
    console.log("WKS_PG Gangs:", gangsPG.map(g => `${g.gang_code} (${g.source_loc_code})`));
}

main().catch(console.error);
