import { Database } from './src/services/database';
import { LemburCalculator } from './src/services/lemburCalculator';

async function main() {
    console.log("Starting test_date...");
    const calc = (LemburCalculator as any).getInstance();
    
    const db = Database.getInstance();
    const rows = await db.query(`SELECT HolidayDate, Description FROM HR_GPH WHERE YEAR(HolidayDate) = 2026 AND MONTH(HolidayDate) = 3`);
    console.log("Raw from DB for March:", rows);

    const holidays = await calc['getHolidays'](2026);
    console.log('Holidays in march (keys that start with 2026-03):', Object.keys(holidays).filter(k => k.startsWith('2026-03')));
    console.log('Is 2026-03-22 religious?', holidays['2026-03-22']);
    
    // Testing classifyDay correctly
    const d1 = new Date('2026-03-22T00:00:00+07:00'); // if local time is +07, this string represents local 22nd. 
    console.log("Using d1 = new Date('2026-03-22T00:00:00+07:00')");
    console.log("d1.toISOString().substring(0, 10) =", d1.toISOString().substring(0, 10));
    
    const val = await calc['classifyDay'](d1, 2026);
    console.log('Value classified for 2026-03-22:', val);

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
