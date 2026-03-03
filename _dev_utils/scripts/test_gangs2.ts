import { gangService } from '../../backend/src/services/gangService';

async function test() {
    try {
        console.log('Testing WKS_AR using gangService...');
        const res = await gangService.fetchGangs('WKS_AR');
        console.log('fetchGangs WKS_AR:', res);

        const res2 = await gangService.fetchGangs('WKS_AR', undefined, true);
        console.log('fetchGangs WKS_AR (includeVirtual=true):', res2);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
