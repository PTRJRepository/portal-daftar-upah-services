
import { divisionDefinition } from "../services/divisionDefinition";

async function testFiltering() {
    const gangs = [
        { code: "HM", desc: "WORKSHOP DAN TRAKSI HARAPAN MUKTI", loc: "P1A" },
        { code: "HMC", desc: "WORKSHOP DAN TRAKSI HARAPAN MUKTI - AIR RUAK", loc: "AB2" }
    ];

    console.log("Testing Gang Filtering Logic...");

    for (const g of gangs) {
        console.log(`\nTesting Gang: ${g.code} (${g.desc}) in Loc ${g.loc}`);

        // Test inclusion in WKS_PG
        const wksPgConfig = divisionDefinition.getVirtualDivisionConfig("WKS_PG");
        const wksPgPattern = wksPgConfig?.description_pattern ? new RegExp(wksPgConfig.description_pattern, "i") : null;
        console.log(`WKS_PG Pattern: ${wksPgConfig?.description_pattern}`);
        console.log(`Matches WKS_PG? ${wksPgPattern?.test(g.desc)}`);

        // Test inclusion in WKS_AR
        const wksArConfig = divisionDefinition.getVirtualDivisionConfig("WKS_AR");
        const wksArPattern = wksArConfig?.description_pattern ? new RegExp(wksArConfig.description_pattern, "i") : null;
        console.log(`WKS_AR Pattern: ${wksArConfig?.description_pattern}`);
        console.log(`Matches WKS_AR? ${wksArPattern?.test(g.desc)}`);
    }
}

testFiltering().catch(console.error);
