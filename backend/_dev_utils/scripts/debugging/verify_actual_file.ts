import * as fs from 'fs';

const filePath = 'D:\\Gawean Rebinmas\\PORTAL_ESTATE\\Plantware_Auto_Report\\Daftar_Upah_baru\\payroll_daftar_upah\\refactor_production\\backend\\src\\api\\parallelAggregationSeeder.ts';
const content = fs.readFileSync(filePath, 'utf8');

// Extract INSERT statement
const insertMatch = content.match(/INSERT INTO dbo\.daftar_upah_aggregation_history.*?`\);/s);
if (!insertMatch) {
    console.log('Could not find INSERT statement');
    process.exit(1);
}

const sql = insertMatch[0];

// Count columns
const colMatch = sql.match(/INSERT INTO.*?\((.*?)\)\s*VALUES/s);
const columns = colMatch ? colMatch[1].split(',').map(c => c.trim()).filter(c => c) : [];
console.log(`Columns: ${columns.length}`);

// Count placeholders
const placeholderCount = (sql.match(/\?/g) || []).length;
console.log(`? placeholders: ${placeholderCount}`);

// Count GETDATE()
const getDateCount = (sql.match(/GETDATE\(\)/g) || []).length;
console.log(`GETDATE(): ${getDateCount}`);

// Extract values array
const arrayMatch = sql.match(/\[\s*([\s\S]*?)\]\s*\)/);
if (arrayMatch) {
    const values = arrayMatch[1].split(',').map(v => v.trim()).filter(v => v && !v.startsWith('//') && v.length > 0);
    console.log(`Values array: ${values.length}`);
    console.log(`\n${'='.repeat(60)}`);
    
    const totalValues = placeholderCount + getDateCount;
    if (columns.length === totalValues && columns.length === values.length) {
        console.log(`✅ MATCH! ${columns.length} columns = ${totalValues} values = ${values.length} array items`);
    } else {
        console.log(`❌ MISMATCH!`);
        console.log(`  Columns: ${columns.length}`);
        console.log(`  Placeholders + GETDATE(): ${totalValues}`);
        console.log(`  Values array: ${values.length}`);
        console.log(`\nMissing ${columns.length - values.length} value(s) in array`);
    }
} else {
    console.log('Could not extract values array');
}
