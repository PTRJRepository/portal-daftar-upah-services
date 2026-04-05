const fs = require('fs');
const path = require('path');

const directory = path.resolve(__dirname);
const files = fs.readdirSync(directory).filter(f => f.endsWith('_pajak.json'));

console.log('\n=== Verification of PPh21 TER Tax Files ===\n');

let grandTotalEmployees = 0;
let grandTotalTax = 0;
let allNonZero = true;

files.forEach(f => {
    const filePath = path.join(directory, f);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    const nonZeroCount = data.filter(d => d.pph21_amount > 0).length;
    const zeroCount = data.filter(d => d.pph21_amount === 0).length;
    const totalTax = data.reduce((sum, d) => sum + d.pph21_amount, 0);
    const totalGross = data.reduce((sum, d) => sum + d.gross_income, 0);
    
    grandTotalEmployees += data.length;
    grandTotalTax += totalTax;
    
    if (zeroCount > 0) {
        allNonZero = false;
    }
    
    const avgRate = totalGross > 0 ? (totalTax / totalGross * 100).toFixed(2) : '0.00';
    
    console.log(`${f}:`);
    console.log(`  Total employees: ${data.length}`);
    console.log(`  Non-zero tax: ${nonZeroCount}`);
    console.log(`  Zero tax: ${zeroCount}`);
    console.log(`  Total PPh21: Rp ${totalTax.toLocaleString('id-ID')}`);
    console.log(`  Avg tax rate: ${avgRate}%\n`);
});

console.log('=== Summary ===');
console.log(`Total divisions: ${files.length}`);
console.log(`Total employees: ${grandTotalEmployees}`);
console.log(`Grand total PPh21: Rp ${grandTotalTax.toLocaleString('id-ID')}`);
console.log(`All employees have non-zero tax: ${allNonZero ? '✓ YES' : '✗ NO'}\n`);
