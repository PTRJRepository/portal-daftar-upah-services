/**
 * Test Virtual Division Detection
 * 
 * Run: cd backend && bun run test_virtual_detection.ts
 */

import { divisionDefinition } from "./src/services/divisionDefinition";

async function testVirtualDetection() {
    console.log('=== TEST VIRTUAL DIVISION DETECTION ===\n');

    // Test gangs from aggregation history
    const testGangs = [
        { gangCode: 'AMC', sourceLoc: 'P1A', desc: 'WORKSHOP' },
        { gangCode: 'HMC', sourceLoc: 'AB2', desc: 'WORKSHOP AIR RUAK' },
        { gangCode: 'IN01', sourceLoc: 'P1A', desc: 'INFRASTRUKTUR' },
        { gangCode: 'B2N', sourceLoc: 'P1B', desc: 'NURSERY' },
        { gangCode: 'J1H', sourceLoc: 'ARC', desc: 'ARC J1H' },
        { gangCode: 'M01', sourceLoc: 'MILL', desc: 'MILL' },
        { gangCode: 'G1H', sourceLoc: 'AB1', desc: 'AB1 G1H' },
        { gangCode: 'H1H', sourceLoc: 'AB2', desc: 'AB2 H1H' },
    ];

    console.log('--- Testing getVirtualDivisionForGang ---\n');
    for (const { gangCode, sourceLoc, desc } of testGangs) {
        const result = divisionDefinition.getVirtualDivisionForGang(gangCode, sourceLoc, desc);
        console.log(`${gangCode.padEnd(8)} (source=${sourceLoc.padEnd(6)}): ${result || 'NOT DETECTED'}`);
    }

    console.log('\n--- Testing getVirtualDivisionByPatternOnly ---\n');
    for (const { gangCode, desc } of testGangs) {
        const result = divisionDefinition.getVirtualDivisionByPatternOnly(gangCode, desc);
        console.log(`${gangCode.padEnd(8)}: ${result || 'NOT DETECTED'}`);
    }

    console.log('\n--- Checking Virtual Division Registry ---\n');
    const virtualDivs = ['INF', 'NRS', 'WKS_PG', 'WKS_AR', 'WORKSHOP', 'ARC', 'MILL'];
    for (const div of virtualDivs) {
        const isVirtual = divisionDefinition.isVirtualDivision(div);
        const config = divisionDefinition.getVirtualDivisionConfig(div);
        console.log(`${div.padEnd(12)}: isVirtual=${isVirtual}, source=${config?.source_division || 'null'}`);
    }

    console.log('\n=== TEST COMPLETE ===');
}

testVirtualDetection().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
