const newValues = `
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, GETDATE(), GETDATE(), ?
            )
`;

const placeholders = (newValues.match(/\?/g) || []).length;
const getDates = (newValues.match(/GETDATE\(\)/g) || []).length;
console.log(`New placeholders: ${placeholders}`);
console.log(`New GETDATE(): ${getDates}`);
console.log(`Total values: ${placeholders + getDates}`);
console.log(`Expected: 38 placeholders + 2 GETDATE() = 40 columns`);

if (placeholders === 38 && getDates === 2) {
    console.log('\n✅ FIXED!');
} else {
    console.log(`\n❌ Still wrong: ${placeholders} placeholders, ${getDates} GETDATE()`);
}
