/**
 * Analysis script to compare reference upah_kotor against system calculations
 * for Infra gang employees across Jan-Nov 2025
 */
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import { dataExtractorService } from "../../backend/src/services/dataExtractorService";
import { writeFileSync } from "fs";

// Reference data from the user's file
const referenceData = [
    { no: 1, nama: "YOYO", upah: { 1: 4164470, 2: 3791160, 3: 4188570, 4: 4059600, 5: 4192070, 6: 4059600, 7: 4192070, 8: 4192070, 9: 4059600, 10: 4192070, 11: 4059600 } },
    { no: 2, nama: "JAMILA", upah: { 1: 7598620, 2: 6892589, 3: 7354229, 4: 6789296, 5: 7525784, 6: 6934948, 7: 7503376, 8: 7480967, 9: 6531602, 10: 7783477, 11: 5868295 } },
    { no: 3, nama: "JUNI MI'UN", upah: { 1: 6360413, 2: 5023613, 3: 5422373, 4: 5603167, 5: 6677227, 6: 6499490, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 } },
    { no: 4, nama: "SUHANDI", upah: { 1: 4188820, 2: 3918605, 3: 4196970, 4: 4186345, 5: 4196970, 6: 4063100, 7: 4196970, 8: 4556970, 9: 4574874, 10: 5086070, 11: 4768955 } },
    { no: 5, nama: "MINARNI", upah: { 1: 5498385, 2: 5013810, 3: 5477240, 4: 5237433, 5: 5766045, 6: 5172709, 7: 5795953, 8: 6185594, 9: 5478718, 10: 5911493, 11: 5019352 } },
    { no: 6, nama: "SUPRIADI", upah: { 1: 4223720, 2: 3689290, 3: 4228370, 4: 4093600, 5: 4228370, 6: 4093600, 7: 4228370, 8: 4228370, 9: 4093600, 10: 4093600, 11: 3958830 } },
    { no: 7, nama: "HARIAH", upah: { 1: 6950193, 2: 5256115, 3: 7263907, 4: 5552667, 5: 5594504, 6: 7625415, 7: 8417924, 8: 7521600, 9: 6236114, 10: 1571077, 11: 6239613 } },
    { no: 8, nama: "YUSMARDIAN", upah: { 1: 4082100, 2: 3899403, 3: 4374870, 4: 4240100, 5: 4224870, 6: 4090100, 7: 4330100, 8: 4554870, 9: 4195330, 10: 4090100, 11: 4090100 } },
    { no: 9, nama: "YULHANI", upah: { 1: 4164470, 2: 3662190, 3: 4192070, 4: 4059600, 5: 4192070, 6: 3930630, 7: 4195570, 8: 4195570, 9: 4063100, 10: 4063100, 11: 4063100 } },
    { no: 10, nama: "HENDRIX", upah: { 1: 4044600, 2: 3647490, 3: 4182970, 4: 4076100, 5: 4076100, 6: 4076100, 7: 4076100, 8: 4210870, 9: 4076100, 10: 4210870, 11: 3941330 } },
];

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

async function main() {
    const lines: string[] = [];
    lines.push("=== ANALISIS UPAH KOTOR INFRA GANG 2025 ===\n");

    // Step 1: Find employee codes for these names
    const db = Database.getInstance(Config.DB_VENUS_DATABASE, Config.DB_VENUS_PROFILE);

    lines.push("--- STEP 1: Finding Employee Codes ---");
    const names = referenceData.map(r => r.nama);

    // Search employee codes by name
    const empResults: { nama: string, empCode: string, gangCode: string, locCode: string }[] = [];

    for (const ref of referenceData) {
        const searchName = ref.nama.replace(/'/g, "''"); // Escape quotes
        const query = `
            SELECT e.EmpCode, e.EmpName, e.LocCode,
                   gl.GangCode
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember AND gl.Status = 'A'
            WHERE e.EmpName LIKE ?
              AND e.Status = 'A'
        `;
        try {
            const result = await db.query<any>(query, [`%${ref.nama}%`]);
            if (result.length > 0) {
                const r = result[0];
                empResults.push({
                    nama: ref.nama,
                    empCode: (r.EmpCode || '').trim(),
                    gangCode: (r.GangCode || '').trim(),
                    locCode: (r.LocCode || '').trim()
                });
                lines.push(`  ${ref.nama} -> EmpCode: ${(r.EmpCode || '').trim()}, Gang: ${(r.GangCode || '').trim()}, Loc: ${(r.LocCode || '').trim()}`);
            } else {
                lines.push(`  ${ref.nama} -> NOT FOUND!`);
                empResults.push({ nama: ref.nama, empCode: '', gangCode: '', locCode: '' });
            }
        } catch (err: any) {
            lines.push(`  ${ref.nama} -> Error: ${err.message}`);
            empResults.push({ nama: ref.nama, empCode: '', gangCode: '', locCode: '' });
        }
    }

    // Step 2: Check gang history for each employee (if there's a gang history table)
    lines.push("\n--- STEP 2: Gang History (current gang) ---");
    for (const emp of empResults) {
        if (!emp.empCode) continue;
        // Check if there's historical gang data  
        try {
            const gangHistQuery = `
                SELECT GangCode, GangMember, Status, JoinDate
                FROM HR_GANGLN 
                WHERE GangMember = ?
                ORDER BY Status DESC
            `;
            const hist = await db.query<any>(gangHistQuery, [emp.empCode]);
            lines.push(`  ${emp.nama} (${emp.empCode}):`);
            for (const h of hist) {
                lines.push(`    Gang: ${(h.GangCode || '').trim()}, Status: ${(h.Status || '').trim()}, JoinDate: ${h.JoinDate || 'N/A'}`);
            }
        } catch (err: any) {
            lines.push(`  ${emp.nama}: Error getting gang history: ${err.message}`);
        }
    }

    // Step 3: For each month, extract payroll data for Infra division and compare
    lines.push("\n--- STEP 3: Comparison Per Month ---");

    const dbPayroll = Database.getInstance(Config.DEFAULT_DATABASE, Config.DB_PROFILE);

    for (let month = 1; month <= 11; month++) {
        lines.push(`\n=== ${monthNames[month - 1]} 2025 ===`);

        try {
            // Extract payroll data for the Infra division
            // Note: "Infra" gang code typically starts with a specific prefix
            // Let's use the dataExtractor to fetch payroll for the period
            const payrollResult = await dataExtractorService.extractPayrollData(
                month, 2025, "ALL", undefined, undefined, "SERVER_PROFILE_2"
            );

            if (!payrollResult || !payrollResult.data_rows) {
                lines.push(`  No payroll data available for ${monthNames[month - 1]} 2025`);
                continue;
            }

            // Find each reference employee in the payroll data
            for (const ref of referenceData) {
                const refUpah = (ref.upah as any)[month] || 0;
                if (refUpah === 0) {
                    lines.push(`  ${ref.nama}: Ref=0 (SKIPPED)`);
                    continue;
                }

                const emp = empResults.find(e => e.nama === ref.nama);
                if (!emp || !emp.empCode) {
                    lines.push(`  ${ref.nama}: NOT FOUND in system`);
                    continue;
                }

                // Find this employee in payroll data
                const payrollRow = payrollResult.data_rows.find((row: any) =>
                    (row.nik || '').trim().toUpperCase() === emp.empCode.toUpperCase()
                );

                if (payrollRow) {
                    const systemUpahKotor = Number(payrollRow.jumlah_upah_kotor) || 0;
                    const diff = refUpah - systemUpahKotor;
                    const gangInPayroll = (payrollRow.gang_code || payrollRow.gang || '').trim();

                    const status = Math.abs(diff) <= 1 ? "✓ MATCH" : `✗ DIFF: ${diff.toLocaleString('id-ID')}`;
                    lines.push(`  ${ref.nama} (Gang: ${gangInPayroll}): Ref=${refUpah.toLocaleString('id-ID')} | Sys=${systemUpahKotor.toLocaleString('id-ID')} | ${status}`);

                    if (Math.abs(diff) > 1) {
                        // Detailed breakdown
                        lines.push(`    Gaji Pokok: ${Number(payrollRow.gaji_pokok || 0).toLocaleString('id-ID')}`);
                        lines.push(`    Total Tunjangan: ${Number(payrollRow.total_tunjangan || 0).toLocaleString('id-ID')}`);
                        lines.push(`    Total Premi: ${Number(payrollRow.total_premi || 0).toLocaleString('id-ID')}`);
                        lines.push(`    Pot Koreksi: ${Number(payrollRow.pot_koreksi || 0).toLocaleString('id-ID')}`);
                        lines.push(`    -> Calc: (${Number(payrollRow.gaji_pokok || 0)} + ${Number(payrollRow.total_tunjangan || 0)} + ${Number(payrollRow.total_premi || 0)}) - ${Number(payrollRow.pot_koreksi || 0)} = ${systemUpahKotor}`);
                    }
                } else {
                    lines.push(`  ${ref.nama}: NOT FOUND in payroll for this month (might be in different gang/division)`);
                }
            }
        } catch (err: any) {
            lines.push(`  Error fetching data for ${monthNames[month - 1]}: ${err.message}`);
        }
    }

    const output = lines.join('\n');
    writeFileSync('_dev_utils/tests/infra_analysis_result.txt', output, 'utf8');
    console.log("Analysis written to _dev_utils/tests/infra_analysis_result.txt");
    process.exit(0);
}

main();
