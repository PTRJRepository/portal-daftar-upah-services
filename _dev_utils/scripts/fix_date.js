const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/services/lemburCalculator.ts');
let content = fs.readFileSync(filePath, 'utf8');

const helper = `
// Helper to safely format JS Dates to local YYYY-MM-DD
function formatSystemDate(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return \`\${y}-\${m}-\${day}\`;
}
`;

// Inject helper after imports if not exists
if (!content.includes('formatSystemDate(dateInput')) {
    content = content.replace(/(import.*?;(\r?\n))+/, match => match + '\n' + helper + '\n');
}

// Replace all .toISOString().substring(0, 10) on trxDate or date or new Date
content = content.replace(/trxDate\.toISOString\(\)\.substring\(0,\s*10\)/g, 'formatSystemDate(trxDate)');
content = content.replace(/date\.toISOString\(\)\.substring\(0,\s*10\)/g, 'formatSystemDate(date)');
content = content.replace(/new Date\(([^)]+)\)\.toISOString\(\)\.substring\(0,\s*10\)/g, 'formatSystemDate($1)');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed lemburCalculator.ts dates!');
