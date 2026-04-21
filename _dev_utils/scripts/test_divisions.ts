import { divisionDefinition } from "./src/services/divisionDefinition";

async function test() {
    const divs = await divisionDefinition.getAllDivisions();
    console.log(divs);
    process.exit(0);
}

test();
