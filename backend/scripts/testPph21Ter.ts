import { pph21TerService } from "../src/services/pph21TerService";

console.log("=== TEST PPh21 TER SERVICE ===\n");

try {
    // Initialize service by calling any function (singleton pattern)
    // First call will initialize the service

    // Test 1: Check PTKP mappings
    console.log("1. PTKP Mappings:");
    const testPtkp = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'];
    for (const ptkp of testPtkp) {
        const categoryName = pph21TerService.getTerCategory(ptkp);
        console.log(`   ${ptkp} -> ${categoryName}`);
    }

    // Test 2: Calculate PPh21 TER for various income levels
    console.log("\n2. PPh21 TER Calculation Samples:");

    const testCases = [
        { ptkp: 'TK/0', income: 5000000 },   // Below first tier
        { ptkp: 'TK/0', income: 6000000 },   // First tier (0.25%)
        { ptkp: 'TK/0', income: 10000000 },  // Higher tier
        { ptkp: 'TK/0', income: 50000000 },  // High income
        { ptkp: 'K/3', income: 7000000 },    // K/3 different brackets
        { ptkp: 'K/3', income: 15000000 },
        { ptkp: 'K/3', income: 100000000 },
    ];

    for (const tc of testCases) {
        const result = pph21TerService.calculatePph21Ter(tc.income, tc.ptkp);
        console.log(`\n   PTKP: ${tc.ptkp}, Income: Rp ${tc.income.toLocaleString('id-ID')}`);
        console.log(`   TER Category: ${result.ter_category}`);
        console.log(`   Rate: ${result.rate_percent}% (${result.rate})`);
        console.log(`   Tax Amount: Rp ${result.tax_amount.toLocaleString('id-ID')}`);
    }

    // Test 3: Detailed breakdown for a specific case
    console.log("\n3. Detailed Breakdown Example:");
    const income = 10000000;
    const ptkp = 'TK/0';
    const result = pph21TerService.calculatePph21Ter(income, ptkp);

    console.log(`   Gross Income: Rp ${result.gross_income.toLocaleString('id-ID')}`);
    console.log(`   PTKP Status: ${result.ptkp_status}`);
    console.log(`   TER Category: ${result.ter_category}`);
    console.log(`   Applied Rate: ${result.rate_percent}%`);
    console.log(`   Effective Rate: ${result.rate}`);
    console.log(`   PPh21 TER: Rp ${result.tax_amount.toLocaleString('id-ID')}`);
    console.log(`   Net Income: Rp ${(result.gross_income - result.tax_amount).toLocaleString('id-ID')}`);

    // Test 4: Show rate progression for TER A
    console.log("\n4. TER A Rate Progression:");
    const sampleIncomes = [
        5400000,   // Layer 1 boundary (0%)
        5650000,   // Layer 2-3 boundary (0.50%)
        6300000,   // Layer 4-5 boundary (1.00%)
        7500000,   // Layer 6-7 boundary (1.50%)
        10000000,  // Mid-range
        20000000,  // Higher
        50000000,  // High income
    ];

    for (const inc of sampleIncomes) {
        const result = pph21TerService.calculatePph21Ter(inc, 'TK/0');
        console.log(`   Income: Rp ${inc.toLocaleString('id-ID').padEnd(15)} -> Rate: ${result.rate_percent}% (Tax: Rp ${result.tax_amount.toLocaleString('id-ID')})`);
    }

    console.log("\n=== TEST COMPLETE ===");

} catch (error) {
    console.error("Error:", error);
    process.exit(1);
}
