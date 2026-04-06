/**
 * Diagnostic script for tax report "no data" issue
 * Tests the tax report endpoint with different parameters
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:8002';
const TOKEN = process.env.TOKEN || '';

async function testTaxReport() {
    console.log('=== Tax Report Diagnostic Script ===\n');

    if (!TOKEN) {
        console.log('⚠️  No TOKEN provided. Set TOKEN environment variable to test with authentication.');
        console.log('   Example: $env:TOKEN="your_token_here" bun run test_tax_report.ts\n');
    }

    const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

    // Test 1: Current period without division
    console.log('Test 1: Current period (April 2026) without division');
    try {
        const response = await axios.get(`${BASE_URL}/tax-report/monthly`, {
            params: { year: 2026, month: 4 },
            headers,
            timeout: 30000
        });
        console.log(`✅ Status: ${response.status}`);
        console.log(`   Employees: ${response.data.employees?.length || 0}`);
        console.log(`   Data source: ${response.data.data_source}`);
        console.log(`   Total PPh21: ${response.data.total_pph21 || 0}`);
    } catch (error: any) {
        console.log(`❌ Error: ${error.response?.status || error.message}`);
        console.log(`   Response: ${JSON.stringify(error.response?.data || error.message)}`);
    }

    // Test 2: Current period with division P1A
    console.log('\nTest 2: Current period (April 2026) with division P1A');
    try {
        const response = await axios.get(`${BASE_URL}/tax-report/monthly`, {
            params: { year: 2026, month: 4, division: 'P1A' },
            headers,
            timeout: 60000
        });
        console.log(`✅ Status: ${response.status}`);
        console.log(`   Employees: ${response.data.employees?.length || 0}`);
        console.log(`   Data source: ${response.data.data_source}`);
        console.log(`   Total PPh21: ${response.data.total_pph21 || 0}`);
        if (response.data.employees?.length > 0) {
            console.log(`   Sample employee: ${response.data.employees[0].emp_name}`);
        }
    } catch (error: any) {
        console.log(`❌ Error: ${error.response?.status || error.message}`);
        console.log(`   Response: ${JSON.stringify(error.response?.data || error.message)}`);
    }

    // Test 3: Previous period (March 2026) with division
    console.log('\nTest 3: Previous period (March 2026) with division P1A');
    try {
        const response = await axios.get(`${BASE_URL}/tax-report/monthly`, {
            params: { year: 2026, month: 3, division: 'P1A' },
            headers,
            timeout: 60000
        });
        console.log(`✅ Status: ${response.status}`);
        console.log(`   Employees: ${response.data.employees?.length || 0}`);
        console.log(`   Data source: ${response.data.data_source}`);
    } catch (error: any) {
        console.log(`❌ Error: ${error.response?.status || error.message}`);
        console.log(`   Response: ${JSON.stringify(error.response?.data || error.message)}`);
    }

    // Test 4: Check backend health
    console.log('\nTest 4: Backend health check');
    try {
        const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
        console.log(`✅ Backend is running: ${response.status}`);
    } catch (error: any) {
        console.log(`❌ Backend not reachable: ${error.message}`);
    }

    console.log('\n=== Diagnostic Complete ===');
    console.log('\n💡 Tips:');
    console.log('   - If Test 1 returns 0 employees but Test 2 returns data, the issue is empty division');
    console.log('   - If all tests return 0 employees, check if payroll data exists for that period');
    console.log('   - Run "bun run src/scripts/check_payroll_data.ts" to verify data exists');
}

testTaxReport().catch(console.error);
