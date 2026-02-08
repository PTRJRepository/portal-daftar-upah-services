/**
 * Integration Test for Unified Payroll Component Architecture
 *
 * Tests all component services end-to-end:
 * - LemburService
 * - PremiService
 * - TunjanganService
 * - PotonganService
 * - Pph21TerService
 * - PayrollComponentRegistry
 *
 * Run with: bun run src/scripts/test-component-integration.ts
 */

import { Database } from '../db/client';
import { payrollComponentRegistry } from '../services/payroll';
import { PayrollCalculationInput } from '../types/payroll/BasePayrollTypes';

// Test configuration
const TEST_DIVISION = 'AB1';
const TEST_GANG = 'H1H';
const TEST_MONTH = 12;
const TEST_YEAR = 2025;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ️ ${message}`, 'blue');
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(60));
}

// Test result tracking
const testResults: { name: string; passed: boolean; duration: number; error?: string }[] = [];

async function runTest(name: string, testFn: () => Promise<void>) {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    testResults.push({ name, passed: true, duration });
    logSuccess(`${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.push({ name, passed: false, duration, error: String(error) });
    logError(`${name}: ${error}`);
  }
}

// Get test employee data
async function getTestEmployees(): Promise<any[]> {
  const db = Database.getInstance();
  const rows = await db.query(`
    SELECT TOP 5
      e.EmpCode,
      e.EmpName,
      g.GangCode,
      g.DivID,
      pr.Rate,
      pr.beras_rate,
      pr.masa_kerja_tahun
    FROM HR_EMPLOYEE e
    INNER JOIN HR_GANGLN gl ON gl.EmpCode = e.EmpCode
    INNER JOIN HR_GANG g ON g.GangCode = gl.GangCode
    LEFT JOIN HR_PAYROLL pr ON pr.EmpCode = e.EmpCode
    WHERE g.DivID = ? AND gl.GangCode = ?
    ORDER BY e.EmpCode
  `, [TEST_DIVISION, TEST_GANG]);

  return rows;
}

// Test: Registry Health
async function testRegistryHealth() {
  const status = payrollComponentRegistry.getHealthStatus();

  if (status.total_components < 5) {
    throw new Error(`Expected at least 5 components, got ${status.total_components}`);
  }

  if (status.status !== 'healthy') {
    throw new Error(`Registry status is not healthy: ${status.status}`);
  }

  logInfo(`Registry has ${status.total_components} components`);
  Object.entries(status.components).forEach(([name, info]) => {
    logInfo(`  - ${name}: v${info.version} (${info.status})`);
  });
}

// Test: Lembur Service
async function testLemburService() {
  const employees = await getTestEmployees();
  if (employees.length === 0) throw new Error('No test employees found');

  const emp = employees[0];
  const input: PayrollCalculationInput = {
    emp_code: emp.EmpCode,
    month: TEST_MONTH,
    year: TEST_YEAR,
    upah_dasar: emp.Rate,
    jumlah_hk: 25,
    server_profile: undefined,
  };

  const result = await payrollComponentRegistry.calculate('lembur', input);

  if (!result.output) {
    throw new Error('Lembur service returned no output');
  }

  const output = result.output as any;
  logInfo(`  Lembur: ${output.value?.total_hours || 0} hours, ${output.value?.total_amount || 0} IDR`);

  // Check metadata
  if (!result.output.meta) {
    throw new Error('Lembur result missing metadata');
  }

  const meta = result.output.meta;
  if (!meta.source || !meta.calculation_basis) {
    throw new Error('Lembur metadata incomplete');
  }

  logInfo(`  Source: ${meta.source}`);
  logInfo(`  Calculation: ${meta.calculation_basis}`);
}

// Test: Premi Service
async function testPremiService() {
  const employees = await getTestEmployees();
  if (employees.length === 0) throw new Error('No test employees found');

  const emp = employees[0];
  const input: PayrollCalculationInput = {
    emp_code: emp.EmpCode,
    month: TEST_MONTH,
    year: TEST_YEAR,
    server_profile: undefined,
  };

  const result = await payrollComponentRegistry.calculate('premi', input);

  if (!result.output) {
    throw new Error('Premi service returned no output');
  }

  const output = result.output as any;
  logInfo(`  Premi Brondol: ${output.value?.brondol || 0}`);
  logInfo(`  Premi Pruning: ${output.value?.pruning || 0}`);

  // Check metadata
  if (!result.output.meta) {
    throw new Error('Premi result missing metadata');
  }
}

// Test: Tunjangan Service
async function testTunjanganService() {
  const employees = await getTestEmployees();
  if (employees.length === 0) throw new Error('No test employees found');

  const emp = employees[0];
  const input: PayrollCalculationInput = {
    emp_code: emp.EmpCode,
    month: TEST_MONTH,
    year: TEST_YEAR,
    upah_dasar: emp.Rate,
    beras_rate: emp.beras_rate,
    masa_kerja_tahun: emp.masa_kerja_tahun,
    server_profile: undefined,
  };

  const result = await payrollComponentRegistry.calculate('tunjangan', input);

  if (!result.output) {
    throw new Error('Tunjangan service returned no output');
  }

  const output = result.output as any;
  logInfo(`  Tunjangan Beras: ${output.value?.beras || 0}`);
  logInfo(`  Tunjangan Jabatan: ${output.value?.jabatan || 0}`);
  logInfo(`  Tunjangan Masa Kerja: ${output.value?.masa_kerja || 0}`);
  logInfo(`  Total: ${output.value?.total || 0}`);
}

// Test: Potongan Service
async function testPotonganService() {
  const employees = await getTestEmployees();
  if (employees.length === 0) throw new Error('No test employees found');

  const emp = employees[0];
  const input: PayrollCalculationInput = {
    emp_code: emp.EmpCode,
    month: TEST_MONTH,
    year: TEST_YEAR,
    upah_dasar: emp.Rate,
    penghasilan_bruto: 5000000,
    beras_rate: emp.beras_rate,
    server_profile: undefined,
  };

  const result = await payrollComponentRegistry.calculate('potongan', input);

  if (!result.output) {
    throw new Error('Potongan service returned no output');
  }

  const output = result.output as any;
  logInfo(`  ASTEK: ${output.value?.astek?.jumlah || 0}`);
  logInfo(`  BPJS Kesehatan: ${output.value?.bpjs?.kesehatan?.jumlah || 0}`);
  logInfo(`  BPJS Pensiun: ${output.value?.bpjs?.pensiun?.jumlah || 0}`);
  logInfo(`  PPH21: ${output.value?.pph21 || 0}`);
  logInfo(`  Total: ${output.value?.total || 0}`);
}

// Test: PPH21 TER Service
async function testPph21TerService() {
  const employees = await getTestEmployees();
  if (employees.length === 0) throw new Error('No test employees found');

  const emp = employees[0];
  const input: PayrollCalculationInput = {
    emp_code: emp.EmpCode,
    month: TEST_MONTH,
    year: TEST_YEAR,
    penghasilan_bruto: 5000000,
    beras_rate: emp.beras_rate || 2250,
    server_profile: undefined,
  };

  const result = await payrollComponentRegistry.calculate('pph21_ter', input);

  if (!result.output) {
    throw new Error('PPH21 TER service returned no output');
  }

  const output = result.output as any;
  logInfo(`  PTKP Status: ${output.value?.ptkp_status || '-'}`);
  logInfo(`  TER Category: ${output.value?.ter_category || '-'}`);
  logInfo(`  Rate: ${output.value?.rate_percent || 0}%`);
  logInfo(`  Tax Amount: ${output.value?.tax_amount || 0}`);
}

// Test: Batch Calculation
async function testBatchCalculation() {
  const employees = await getTestEmployees();
  if (employees.length === 0) throw new Error('No test employees found');

  const inputs: PayrollCalculationInput[] = employees.map(emp => ({
    emp_code: emp.EmpCode,
    month: TEST_MONTH,
    year: TEST_YEAR,
    upah_dasar: emp.Rate,
    beras_rate: emp.beras_rate,
    server_profile: undefined,
  }));

  const result = await payrollComponentRegistry.calculateBatch('lembur', inputs);

  if (!result.results || result.results.size === 0) {
    throw new Error('Batch calculation returned no results');
  }

  logInfo(`  Processed ${result.results.size} employees`);
  logInfo(`  Total calculated: ${result.summary.total_calculated}`);
  logInfo(`  Cached: ${result.summary.cached_count || 0}`);
  logInfo(`  Errors: ${result.summary.total_errors || 0}`);
}

// Test: All Components for One Employee
async function testAllComponentsForEmployee() {
  const employees = await getTestEmployees();
  if (employees.length === 0) throw new Error('No test employees found');

  const emp = employees[0];
  const baseInput: PayrollCalculationInput = {
    emp_code: emp.EmpCode,
    month: TEST_MONTH,
    year: TEST_YEAR,
    upah_dasar: emp.Rate,
    beras_rate: emp.beras_rate,
    masa_kerja_tahun: emp.masa_kerja_tahun,
    server_profile: undefined,
  };

  const components = ['lembur', 'premi', 'tunjangan', 'potongan', 'pph21_ter'] as const;
  const results: Record<string, any> = {};

  for (const component of components) {
    const input = { ...baseInput };
    if (component === 'potongan' || component === 'pph21_ter') {
      (input as any).penghasilan_bruto = 5000000;
    }

    const result = await payrollComponentRegistry.calculate(component, input);
    results[component] = result.output;
  }

  logInfo(`  Employee: ${emp.EmpName} (${emp.EmpCode})`);
  logInfo(`  Components calculated: ${Object.keys(results).length}`);

  // Verify all have metadata
  for (const [name, result] of Object.entries(results)) {
    if (!result.meta) {
      throw new Error(`Component ${name} missing metadata`);
    }
    logInfo(`  ${name}: source=${result.meta.source}, value=${JSON.stringify(result.value).slice(0, 50)}...`);
  }
}

// Main test runner
async function main() {
  logSection('Unified Payroll Component Architecture - Integration Tests');
  logInfo(`Test Configuration: Division=${TEST_DIVISION}, Gang=${TEST_GANG}, Month=${TEST_MONTH}, Year=${TEST_YEAR}`);
  logInfo(`Database: ${process.env.DB_DATABASE || 'db_ptrj'}`);
  logInfo(`Server Profile: ${process.env.DB_PROFILE || 'SERVER_PROFILE_2'}`);

  // Run tests
  await runTest('Registry Health Check', testRegistryHealth);
  await runTest('Lembur Service', testLemburService);
  await runTest('Premi Service', testPremiService);
  await runTest('Tunjangan Service', testTunjanganService);
  await runTest('Potongan Service', testPotonganService);
  await runTest('PPH21 TER Service', testPph21TerService);
  await runTest('Batch Calculation', testBatchCalculation);
  await runTest('All Components for Employee', testAllComponentsForEmployee);

  // Print summary
  logSection('Test Summary');
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  log(`Total Tests: ${testResults.length}`, failed > 0 ? 'red' : 'green');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  logInfo(`Total Duration: ${totalDuration}ms`);

  if (failed > 0) {
    logSection('Failed Tests Details');
    testResults.filter(r => !r.passed).forEach(r => {
      logError(`${r.name}: ${r.error}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  logError(`Fatal error: ${error}`);
  process.exit(1);
});
