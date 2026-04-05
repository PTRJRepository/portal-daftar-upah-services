const fs = require('fs');
const path = 'D:\\Gawean Rebinmas\\PORTAL_ESTATE\\Plantware_Auto_Report\\Daftar_Upah_baru\\payroll_daftar_upah\\refactor_production\\backend\\src\\api\\aggregationSeederRoutes.ts';

const content = fs.readFileSync(path, 'utf8');

// Find the INSERT statement
const insertMatch = content.match(/INSERT INTO dbo\.daftar_upah_aggregation_history.*?\);/s);
if (!insertMatch) {
    console.log('Could not find INSERT statement');
    process.exit(1);
}

const insertSql = insertMatch[0];

// Count columns
const colEndIdx = insertSql.indexOf(') VALUES');
const colStartIdx = insertSql.indexOf('(');
const columns = insertSql.substring(colStartIdx + 1, colEndIdx).split(',').map(c => c.trim()).filter(c => c);
console.log(`Columns count: ${columns.length}`);

// Count ? placeholders
const placeholders = (insertSql.match(/\?/g) || []).length;
console.log(`? placeholders: ${placeholders}`);

// Count GETDATE()
const getDates = (insertSql.match(/GETDATE\(\)/g) || []).length;
console.log(`GETDATE() count: ${getDates}`);

console.log(`\nTotal values: ${placeholders + getDates}`);
console.log(`Difference: ${columns.length - (placeholders + getDates)}`);

// Count values in array
const arrayMatch = insertSql.match(/\],\s*\[/s);
if (arrayMatch) {
    const arrayStart = insertSql.indexOf('[', insertSql.indexOf('VALUES'));
    const arrayEnd = insertSql.lastIndexOf(']');
    const arrayContent = insertSql.substring(arrayStart + 1, arrayEnd);
    const values = arrayContent.split(',').map(v => v.trim()).filter(v => v && !v.startsWith('//') && v.length > 0);
    console.log(`\nValues in array: ${values.length}`);
}
