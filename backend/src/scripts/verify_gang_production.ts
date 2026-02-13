
import { dashboardService } from "../services/dashboardService";
import { write } from "bun";

async function main() {
    let log = "";
    try {
        log += "Fetching Gang Comparison for Month 2, Year 2026...\n";
        console.log("Fetching...");

        const result = await dashboardService.getGangComparison(2, 2026);

        log += `Total Gangs: ${result.length}\n`;

        const activeGangs = result.filter(g => g.total_production > 0);
        log += `Gangs with Production > 0: ${activeGangs.length}\n`;

        if (activeGangs.length > 0) {
            log += "Top 5 Gangs by Production:\n";
            log += JSON.stringify(activeGangs.sort((a, b) => b.total_production - a.total_production).slice(0, 5), null, 2);
        } else {
            log += "No gangs have production data yet.\n";
        }

    } catch (e) {
        log += "Error: " + (e.message || e) + "\n";
        if (e.stack) log += e.stack + "\n";
        console.error(e);
    }

    await write("verify_production_output.txt", log);
    console.log("Written to verify_production_output.txt");
}

main().catch(e => {
    console.error(e);
    write("verify_production_output.txt", "Fatal Error: " + e).catch(() => { });
});
