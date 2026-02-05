
import { DataExtractorService } from "../services/dataExtractorService";
import { divisionDefinition } from "../services/divisionDefinition";

async function main() {
    const service = DataExtractorService.getInstance();

    // Check P1A
    console.log("--- Checking P1A ---");
    const resP1A = await service.extractPayrollData(1, 2026, "ALL", "P1A", null, "SERVER_PROFILE_2");
    const gangsP1A = new Set(resP1A.data_rows.map((r: any) => r.gang_code));
    console.log("Gangs in P1A:", Array.from(gangsP1A).filter(g => (g as string).toLowerCase().includes('wk') || (g as string).toLowerCase().includes('hm')));

    // Check P2A
    console.log("--- Checking P2A ---");
    const resP2A = await service.extractPayrollData(1, 2026, "ALL", "P2A", null, "SERVER_PROFILE_2");
    const gangsP2A = new Set(resP2A.data_rows.map((r: any) => r.gang_code));
    console.log("Gangs in P2A:", Array.from(gangsP2A).filter(g => (g as string).toLowerCase().includes('wk') || (g as string).toLowerCase().includes('hm')));

    // Check AB2
    console.log("--- Checking AB2 ---");
    const resAB2 = await service.extractPayrollData(1, 2026, "ALL", "AB2", null, "SERVER_PROFILE_2");
    const gangsAB2 = new Set(resAB2.data_rows.map((r: any) => r.gang_code));
    console.log("Gangs in AB2:", Array.from(gangsAB2).filter(g => (g as string).toLowerCase().includes('wk') || (g as string).toLowerCase().includes('hm')));

    // Check if WKS definitions match these
    console.log("--- Checking Definitions ---");
    const defPG = await divisionDefinition.getGangsForDivision("WKS_PG");
    console.log("WKS_PG defined gangs:", defPG.map(g => g.gang_code));

    const defAR = await divisionDefinition.getGangsForDivision("WKS_AR");
    console.log("WKS_AR defined gangs:", defAR.map(g => g.gang_code));
}

main().catch(console.error);
