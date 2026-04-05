/**
 * Debug script to find all gangs in AB2 division
 */

import { GangService } from './backend/src/services/gangService';

async function listGangs() {
    console.log('='.repeat(80));
    console.log('Listing all gangs in AB2 division');
    console.log('='.repeat(80));
    console.log();

    const gangService = GangService.getInstance();
    const gangs = await gangService.fetchGangs('AB2');
    
    console.log(`Found ${gangs.length} gangs:`);
    console.log('-'.repeat(80));
    
    for (const gang of gangs) {
        console.log(`  Gang Code: "${gang.gang_code}" | Description: "${gang.description || ''}"`);
    }
    
    console.log('-'.repeat(80));
    console.log();
    console.log('Note: Look for gang with code or description containing "H!H" or similar');
}

listGangs().catch(console.error);
