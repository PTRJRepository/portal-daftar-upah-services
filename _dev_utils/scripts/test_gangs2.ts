import { gangService } from '../../backend/src/services/gangService';
import { divisionDefinition } from '../../backend/src/services/divisionDefinition';

async function test() {
    try {
        const virt = divisionDefinition.VIRTUAL_DIVISION_ORDER;
        console.log('Testing all virtual divisions using gangService:', virt);

        for (const v of virt) {
            const res = await gangService.fetchGangs(v);
            console.log(`fetchGangs ${v}:`, res);
        }

        console.log('--- Testing Aliases ---');
        const aliases = ['HMC', 'AMC', 'WORKSHOP_AR', 'WORKSHOP_PG'];
        for (const a of aliases) {
            const res = await gangService.fetchGangs(a);
            console.log(`fetchGangs alias ${a}:`, res);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
