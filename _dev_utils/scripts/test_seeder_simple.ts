/**
 * Test Seeder Script - Run seeder dengan aman
 * Usage: bun run test_seeder_simple.ts
 */

import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:8002';
const MONTH = 3; // Maret
const YEAR = 2026;
const DIVISION = 'P1A'; // Test dengan 1 divisi kecil dulu

async function getAuthToken(): Promise<string | null> {
    // Coba baca dari localStorage atau cookie
    // Untuk CLI, kita perlu manual token
    console.log('⚠️  Anda perlu menyediakan token auth');
    console.log('💡 Buka browser, login ke http://localhost:8002');
    console.log('💡 Copy token dari localStorage: localStorage.getItem("payroll_token")');
    console.log('💡 Paste token di bawah ini:\n');
    
    // Untuk sekarang, kita skip auth dan pakai direct call
    return null;
}

async function checkHealth() {
    console.log('🔍 Checking backend health...');
    try {
        const response = await fetch(`${BASE_URL}/payroll/history/health`);
        const data = await response.json();
        console.log('✅ Backend health:', data);
        return true;
    } catch (error: any) {
        console.error('❌ Backend unreachable:', error.message);
        return false;
    }
}

async function runSeeder() {
    console.log('\n🚀 Starting Seeder Test...');
    console.log(`📅 Period: ${MONTH}/${YEAR}`);
    console.log(`📊 Division: ${DIVISION}`);
    console.log('⏳ This may take 1-3 minutes...\n');

    // Kita tidak bisa run seeder dari CLI tanpa token
    // Sebagai alternatif, kita akan buka browser dengan URL yang benar
    
    console.log('📋 Instruksi untuk test seeder:');
    console.log('1. Buka browser: http://localhost:5173');
    console.log('2. Login ke aplikasi payroll');
    console.log('3. Buka halaman "Aggregation Seeder"');
    console.log('4. Set parameter:');
    console.log(`   - Division: ${DIVISION}`);
    console.log(`   - Month: ${getMonthName(MONTH)}`);
    console.log(`   - Year: ${YEAR}`);
    console.log('5. Klik "💾 Save to History"');
    console.log('6. Monitor progress di log panel');
    console.log('\n💡 Tips:');
    console.log('   - Pastikan connection status: ✅ Connected');
    console.log('   - Jika error, cek console log di browser');
    console.log('   - Jika stuck, gunakan "⚠️ Reset Stuck Seeder" button');
}

function getMonthName(month: number): string {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return months[month - 1];
}

async function main() {
    console.log('=== TEST SEEDER ===\n');
    
    // Check backend
    const healthy = await checkHealth();
    if (!healthy) {
        console.error('\n❌ Backend tidak reachable!');
        console.error('Pastikan backend running: cd backend && bun run dev');
        process.exit(1);
    }
    
    // Show instructions
    await runSeeder();
    
    console.log('\n✅ Backend ready untuk test seeder!');
    console.log('📝 Ikuti instruksi di atas untuk manual test\n');
}

main().catch(console.error);
