// Verify other incomes calculation for March 2026
import { OtherIncomesService } from '../../backend/src/services/otherIncomesService';

async function main() {
    console.log('=== Verifying Other Incomes for March 2026 ===\n');

    // Check month 3, 2026
    console.log('--- Month 3, 2026 ---');
    const incomes = await OtherIncomesService.getIncomes(2026, 3);
    console.log(`Found ${incomes.length} records for Mar 2026`);

    if (incomes.length > 0) {
        // Group by NIK
        const byNik = new Map<string, { total: number; types: string[] }>();
        for (const inc of incomes) {
            const nik = (inc.nik || '').trim().toUpperCase();
            if (!byNik.has(nik)) {
                byNik.set(nik, { total: 0, types: [] });
            }
            const entry = byNik.get(nik)!;
            if (inc.is_paid_in_thp) {
                entry.total += Number(inc.amount);
            }
            if (!entry.types.includes(inc.income_type)) {
                entry.types.push(inc.income_type);
            }
        }

        console.log('\n--- Top 5 by Amount ---');
        const sorted = Array.from(byNik.entries())
            .map(([nik, data]) => ({ nik, ...data }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        for (const item of sorted) {
            console.log(`${item.nik}: Rp ${item.total.toLocaleString()} (${item.types.join(', ')})`);
        }

        // Summary
        const totalThp = Array.from(byNik.values()).reduce((sum, d) => sum + d.total, 0);
        console.log(`\n--- Summary ---`);
        console.log(`Total Employees with Other Incomes: ${byNik.size}`);
        console.log(`Total Amount (THP): Rp ${totalThp.toLocaleString()}`);

        // Check taxable
        const taxable = incomes.filter(i => i.is_taxable);
        console.log(`Total Taxable Records: ${taxable.length}`);
    } else {
        console.log('No data found!');
    }
}

main().catch(console.error);
