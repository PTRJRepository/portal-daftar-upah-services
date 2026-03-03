import { gangService } from '../../backend/src/services/gangService';

async function test() {
    try {
        console.log('Fetching all gangs without division...');
        const allGangs = await gangService.fetchGangs();
        console.log(`Total gangs fetched: ${allGangs.length}`);

        const hmcGangs = allGangs.filter(g => g.gang_code === 'HMC' || g.gang_code.startsWith('HM'));
        console.log('HMC gangs in allGangs:', hmcGangs);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
