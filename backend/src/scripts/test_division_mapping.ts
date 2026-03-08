import { GangService } from "../services/gangService";

/**
 * Test unified division mapping
 */

const gangService = GangService.getInstance();

console.log("=== Testing Unified Division Mapping ===\n");

const testCases = [
    // Test 3-letter to 4-letter mapping
    { input: 'P1A', expected: 'PG1A' },
    { input: 'P1B', expected: 'PG1B' },
    { input: 'P2A', expected: 'PG2A' },
    { input: 'P2B', expected: 'PG2B' },
    // Test 4-letter to 3-letter mapping
    { input: 'PG1A', expected: 'PG1A' },
    { input: 'PG1B', expected: 'PG1B' },
    // Test AB1/ARB1
    { input: 'AB1', expected: 'AB1' },
    { input: 'ARB1', expected: 'AB1' },
    // Test virtual divisions
    { input: 'HMC', expected: 'WKS_AR' },
    { input: 'AMC', expected: 'WKS_PG' },
    { input: 'WKS_AR', expected: 'WKS_AR' },
    { input: 'INF', expected: 'INF' },
];

console.log("1. Testing normalizeDivisionCode():");
for (const tc of testCases) {
    const result = gangService.normalizeDivisionCode(tc.input);
    const status = result === tc.expected ? '✓' : '✗';
    console.log(`   ${status} '${tc.input}' -> '${result}' (expected: '${tc.expected}')`);
}

console.log("\n2. Testing isSameDivision():");
const sameTests = [
    { a: 'AB1', b: 'ARB1', expected: true },
    { a: 'AB1', b: 'AB1', expected: true },
    { a: 'P1A', b: 'PG1A', expected: true },
    { a: 'HMC', b: 'WKS_AR', expected: true },
    { a: 'AB1', b: 'AB2', expected: false },
    { a: 'P1A', b: 'P1B', expected: false },
];
for (const tc of sameTests) {
    const result = gangService.isSameDivision(tc.a, tc.b);
    const status = result === tc.expected ? '✓' : '✗';
    console.log(`   ${status} isSameDivision('${tc.a}', '${tc.b}') = ${result} (expected: ${tc.expected})`);
}

console.log("\n3. Testing getAllDivisionAliases():");
const aliasTests = [
    { input: 'AB1', expected: ['AB1', 'ARB1', 'AB-1'] },
    { input: 'PG1A', expected: ['PG1A', 'P1A'] },
    { input: 'WKS_AR', expected: ['WKS_AR', 'HMC'] },
];
for (const tc of aliasTests) {
    const result = gangService.getAllDivisionAliases(tc.input);
    const hasAll = tc.expected.every(e => result.includes(e));
    const status = hasAll ? '✓' : '✗';
    console.log(`   ${status} getAllDivisionAliases('${tc.input}') = [${result.join(', ')}]`);
}

console.log("\n4. Testing buildDivisionWhereClause():");
const whereTests = [
    { division: 'AB1', column: 'division_code' },
    { division: 'PG1A', column: 'loc_code' },
];
for (const tc of whereTests) {
    const result = gangService.buildDivisionWhereClause(tc.division, tc.column);
    console.log(`   Input: division='${tc.division}', column='${tc.column}'`);
    console.log(`   SQL: ${result.sql || '(empty - ALL divisions)'}`);
    console.log(`   Params: [${result.params.join(', ')}]`);
    console.log('');
}

console.log("=== Test Complete ===");
