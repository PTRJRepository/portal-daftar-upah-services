import { divisionDefinition } from '../../backend/src/services/divisionDefinition';

async function test() {
    try {
        console.log('Testing WKS_AR...');
        const resTrue = await divisionDefinition.getGangsForDivision('WKS_AR', true);
        console.log('WKS_AR Gangs (exclude virtual true):', resTrue);

        const resFalse = await divisionDefinition.getGangsForDivision('WKS_AR', false);
        console.log('WKS_AR Gangs (exclude virtual false):', resFalse);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
