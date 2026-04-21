const { Database } = require('./src/services/database');
const { LemburCalculator } = require('./src/services/lemburCalculator');
const fs = require('fs');

async function main() {
    let out = [];
    out.push("Starting test_date...");
    const calc = LemburCalculator.getInstance();
    
    const db = Database.getInstance();
    const rows = await db.query(`SELECT HolidayDate, Description FROM HR_GPH WHERE YEAR(HolidayDate) = 2026 AND MONTH(HolidayDate) = 3`);
    out.push("Raw from DB for March:");
    
    const holidays = await calc['getHolidays'](2026);
    out.push('Holidays in march keys: ' + Object.keys(holidays).filter(k => k.startsWith('2026-03')).join(", "));
    out.push('Is 2026-03-22 religious? ' + JSON.stringify(holidays['2026-03-22']));
    out.push('Is 2026-03-21 religious? ' + JSON.stringify(holidays['2026-03-21']));
    
    // Testing classifyDay correctly
    const d1 = new Date('2026-03-22T00:00:00+07:00'); 
    out.push('d1 is ' + d1.toString());
    out.push("d1.toISOString().substring(0, 10) = " + d1.toISOString().substring(0, 10));
    
    const val = await calc['classifyDay'](d1, 2026);
    out.push('Value classified for 2026-03-22: ' + val);

    fs.writeFileSync('result_date.txt', out.join("\n"));
    process.exit(0);
}

main().catch(e => {
    fs.writeFileSync('result_date_error.txt', e.stack);
    process.exit(1);
});
