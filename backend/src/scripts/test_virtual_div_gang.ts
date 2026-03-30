import { gangService } from "../backend/src/services/gangService";

async function testINF() {
  const gangsINF = await gangService.fetchGangs("INF", undefined, true);
  console.log("=== INF GANGS ===");
  console.log(gangsINF);
  const conditionsINF = gangsINF.map(g => `UPPER(RTRIM(g.Description)) = UPPER('${g.description.trim()}')`).join(' OR ');
  console.log("CONDITIONS INF:", conditionsINF);

  const gangsWKS = await gangService.fetchGangs("WORKSHOP", undefined, true);
  console.log("=== WORKSHOP GANGS ===");
  console.log(gangsWKS);
  const conditionsWKS = gangsWKS.map(g => `UPPER(RTRIM(g.Description)) = UPPER('${g.description.trim()}')`).join(' OR ');
  console.log("CONDITIONS WORKSHOP:", conditionsWKS);

  process.exit(0);
}
testINF();
