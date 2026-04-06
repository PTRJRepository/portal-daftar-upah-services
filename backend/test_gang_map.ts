import { SummaryService } from "../src/services/summaryService";

async function test() {
    try {
        const service = SummaryService.getInstance();
        // @ts-ignore - access private method for testing
        const map = await service.getGangToDivisionMap();
        
        console.log("Map size:", Object.keys(map).length);
        
        // Check some known gangs
        const sampleGangs = ['A01', 'B01', 'G01', 'H01', 'INF', 'AMC', 'HMC', 'B2N'];
        for (const gang of sampleGangs) {
            console.log(`Gang ${gang} -> ${map[gang] || 'NOT FOUND'}`);
        }
        
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

test();
