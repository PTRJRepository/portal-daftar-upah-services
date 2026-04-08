import { divisionDefinition } from "../../src/services/divisionDefinition";

async function main() {
    const divs = await divisionDefinition.getAllDivisions(true);
    console.log("All divisions in system:", divs);
    console.log("DME present?", divs.includes("DME"));
    console.log("IJL present?", divs.includes("IJL"));
}

main().catch(console.error);
