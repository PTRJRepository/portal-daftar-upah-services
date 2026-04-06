import { Database } from "../../../src/db/client";
import { OtherIncomesService } from "../../../src/services/otherIncomesService";

async function main() {
    const month = 3;
    const year = 2026;
    const divisionCode = "ARA";
    const gangCode = "F1H";

    console.log(`=== Inspecting Other Incomes for ${gangCode} in ${month}/${year} ===\n`);

    const incomes = await OtherIncomesService.getIncomes(year, month, divisionCode, gangCode);
    
    console.log(`Total records found: ${incomes.length}`);
    
    let totalThr = 0;
    let totalBonus = 0;
    let totalCustom = 0;
    let totalOther = 0;

    const groupedByType: Record<string, any[]> = {};

    for (const inc of incomes) {
        const type = inc.income_type || 'UNKNOWN';
        if (!groupedByType[type]) groupedByType[type] = [];
        groupedByType[type].push(inc);

        const amount = Number(inc.amount) || 0;
        if (type === 'THR') totalThr += amount;
        else if (type === 'BONUS') totalBonus += amount;
        else if (type === 'CUSTOM') totalCustom += amount;
        else totalOther += amount;
    }

    console.log(`\nTotals by type:`);
    console.log(`- THR: ${totalThr.toLocaleString('id-ID')}`);
    console.log(`- BONUS: ${totalBonus.toLocaleString('id-ID')}`);
    console.log(`- CUSTOM: ${totalCustom.toLocaleString('id-ID')}`);
    console.log(`- OTHER: ${totalOther.toLocaleString('id-ID')}`);

    console.log(`\nDetailed breakdown:`);
    for (const [type, list] of Object.entries(groupedByType)) {
        console.log(`\n[${type}] (${list.length} records):`);
        for (const item of list.slice(0, 10)) {
            console.log(`  - ${item.emp_name} (${item.nik}): ${Number(item.amount).toLocaleString('id-ID')} (Paid in THP: ${item.is_paid_in_thp})`);
        }
        if (list.length > 10) console.log(`  ... and ${list.length - 10} more`);
    }
}

main().catch(console.error);
